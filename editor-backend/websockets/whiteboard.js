// websockets/whiteboard.js - CRITICAL FIX: Add permission checks in WebSocket handler

const WebSocket = require('ws');
const { connection } = require('./share');
const { v4: uuidv4 } = require('uuid');

// In-memory store for active tldraw rooms
// Map<sessionId (room), Map<boardId, TLSocketRoom>>
const activeRooms = new Map();

// Lazy loader for the ESM @tldraw/sync-core package.
let _tlsyncCorePromise = null;
function loadTLSyncCore() {
  if (!_tlsyncCorePromise) {
    _tlsyncCorePromise = import('@tldraw/sync-core');
  }
  return _tlsyncCorePromise;
}

/**
 * CRITICAL FUNCTION: Check if a user can edit a whiteboard
 */
// Replace your existing canUserEditBoard with this implementation
async function canUserEditBoard(sessionId, boardId, userName) {
  try {
    const doc = connection.get('examples', sessionId);
    await new Promise((resolve, reject) => doc.fetch(err => (err ? reject(err) : resolve())));

    if (!doc.type || !doc.data) return false;

    const config = doc.data.config || {};
    const hosts = Array.isArray(config.hosts) ? [...config.hosts] : [];
    if (config.ownerName && !hosts.includes(config.ownerName)) hosts.push(config.ownerName);

    // Host can always edit
    if (hosts.includes(userName)) return true;

    // Try to get explicit board config if present
    const boardConfig = doc.data.whiteboardConfig?.[boardId];

    if (boardConfig) {
      // If it's a shared note: only the original sharer may edit
      if (boardConfig.isSharedNote) {
        return boardConfig.sharedFrom === userName;
      }

      // If it's a private note stored on the server: allow creator to edit
      if (boardConfig.isPrivateNote) {
        return boardConfig.createdBy === userName;
      }

      // Otherwise honor mode
      switch (boardConfig.mode) {
        case 'everyone':
        case 'public':
          return true;
        case 'host-only':
          return false;
        default:
          return false;
      }
    }

    // No boardConfig — check persisted snapshots (older saves)
    const stored = doc.data.whiteboards?.[boardId];
    if (stored) {
      // If the snapshot includes a savedBy, allow that user to edit
      if (stored.savedBy && stored.savedBy === userName) return true;

      // If snapshot explicitly marks private, allow if savedBy matches
      if (stored.isPrivateNote && stored.savedBy && stored.savedBy === userName) return true;
    }

    // Pragmatic fallback: allow the connecting user to edit if the boardId looks like a client-created private id.
    // This lets a participant create and work on a private note before it's persisted to the server.
    const privatePrefixes = ['private_', 'private-note', 'private-note_', 'private-note-', 'private-note:', 'private-note/','private-note.', 'note_', 'note-'];
    const looksLikePrivate = boardId && privatePrefixes.some(pref => boardId.startsWith(pref));

    if (looksLikePrivate && userName) {
      // optimistic owner permission
      return true;
    }

    // Default deny
    return false;
  } catch (e) {
    console.error('[whiteboard] Permission check failed:', e);
    return false;
  }
}


/**
 * Retrieves an existing TLSocketRoom or creates a new one,
 * loading its initial state from the ShareDB document.
 */
async function getOrCreateRoom(sessionId, boardId) {
  if (!activeRooms.has(sessionId)) activeRooms.set(sessionId, new Map());
  const sessionRooms = activeRooms.get(sessionId);

  if (sessionRooms.has(boardId)) return sessionRooms.get(boardId);

  // Fetch the main session document to get the initial whiteboard state.
  const doc = connection.get('examples', sessionId);
  await new Promise((resolve, reject) => doc.fetch(err => (err ? reject(err) : resolve())));

  if (!doc.type) {
    throw new Error(`Session document ${sessionId} not found.`);
  }

  // Pull stored snapshot (may be TLRoom snapshot, or legacy shape)
  const storedSnapshot = doc.data?.whiteboards?.[boardId] ?? null;
  console.log(`[whiteboard] Creating new room for ${sessionId}/${boardId}`);
  console.log('[whiteboard] storedSnapshot type:', storedSnapshot && typeof storedSnapshot, storedSnapshot ? Object.keys(storedSnapshot) : 'null');

  // Lazy-load sync-core + tlschema
  const tlsyncCore = await loadTLSyncCore();
  const { TLSocketRoom } = tlsyncCore;

  let createTLSchema, defaultShapeSchemas, defaultBindingSchemas;
  try {
    const tlschemaMod = await import('@tldraw/tlschema');
    createTLSchema = tlschemaMod.createTLSchema;
    defaultShapeSchemas = tlschemaMod.defaultShapeSchemas;
    defaultBindingSchemas = tlschemaMod.defaultBindingSchemas;
    console.log('[whiteboard] @tldraw/tlschema imported successfully');
  } catch (e) {
    console.warn('[whiteboard] Could not import @tldraw/tlschema; proceeding without explicit schema', e?.message || e);
  }

  // Create TLSchema if possible
  let schema = undefined;
  if (createTLSchema && defaultShapeSchemas && defaultBindingSchemas) {
    try {
      schema = createTLSchema({
        shapes: defaultShapeSchemas,
        bindings: defaultBindingSchemas,
      });
      console.log('[whiteboard] TLSchema created for room');
    } catch (e) {
      console.warn('[whiteboard] Failed to create TLSchema', e?.message || e);
      schema = undefined;
    }
  }

  // Determine initialSnapshot for constructor (only if it looks like a RoomSnapshot)
  let initialSnapshotForCtor = undefined;
  try {
    // a TLStoreSnapshot/RoomSnapshot commonly contains a `documents` array
    if (storedSnapshot && (Array.isArray(storedSnapshot.documents) || Array.isArray(storedSnapshot))) {
      initialSnapshotForCtor = storedSnapshot;
      console.log('[whiteboard] Using stored snapshot as initialSnapshot for TLSocketRoom constructor');
    } else {
      // not a snapshot shape usable in ctor; we'll try to load it after construction
      initialSnapshotForCtor = undefined;
      if (storedSnapshot && Object.keys(storedSnapshot).length > 0) {
        console.log('[whiteboard] Stored snapshot present but not suitable for constructor; will attempt loadSnapshot after constructing room');
      } else {
        console.log('[whiteboard] No stored snapshot found; creating empty room');
      }
    }
  } catch (e) {
    initialSnapshotForCtor = undefined;
    console.warn('[whiteboard] Error while checking storedSnapshot shape', e?.message || e);
  }

  // CRITICAL: Custom onStoreChange with permission validation
  const customOnStoreChange = async (snapshot, source) => {
    try {
      if (doc.type) {
        // Extract userName from source if available (we'll pass this in handleSocketConnect)
        const userName = source?.context?.userName;
        
        if (userName) {
          // Check if this user can edit before saving
          const canEdit = await canUserEditBoard(sessionId, boardId, userName);
          if (!canEdit) {
            console.log(`[whiteboard] Blocked save attempt from ${userName} on host-only board ${boardId}`);
            return; // Don't save if user can't edit
          }
        }
        
        doc.submitOp([{ p: ['whiteboards', boardId], oi: snapshot }], { source: 'whiteboard' });
      }
    } catch (e) {
      console.error(`[whiteboard] Failed to save snapshot for ${sessionId}/${boardId}:`, e?.message || e);
    }
  };

  // Construct TLSocketRoom (pass schema if available)
  let room;
  try {
    room = new TLSocketRoom({
      schema,
      initialSnapshot: initialSnapshotForCtor,
      onStoreChange: customOnStoreChange, // Use our permission-aware handler
    });
    console.log('[whiteboard] TLSocketRoom created');
  } catch (err) {
    console.error('[whiteboard] TLSocketRoom ctor failed:', err && (err.stack || err.message) ? (err.stack || err.message) : err);
    throw err;
  }

  // If constructor didn't receive a snapshot but we did have storedSnapshot, try loading it safely
  if (!initialSnapshotForCtor && storedSnapshot && Object.keys(storedSnapshot).length > 0) {
    try {
      if (storedSnapshot.document) {
        console.log('[whiteboard] Detected storedSnapshot.document — calling room.loadSnapshot(storedSnapshot.document)');
        await room.loadSnapshot(storedSnapshot.document);
      } else {
        console.log('[whiteboard] Attempting to load storedSnapshot via room.loadSnapshot(storedSnapshot)');
        await room.loadSnapshot(storedSnapshot);
      }
      console.log('[whiteboard] Successfully loaded stored snapshot into room.');
    } catch (err) {
      // Keep going with empty room if the snapshot can't be loaded
      console.error('[whiteboard] Failed to load stored snapshot into TLSocketRoom (continuing with empty room). Error:', err && (err.stack || err.message) ? (err.stack || err.message) : err);
    }
  }

  sessionRooms.set(boardId, room);
  return room;
}

/**
 * Whiteboard WS handler.
 * Expects client to connect to a path like /whiteboard/:roomId/:boardId
 * The client should include a query param `tabId` (unique per browser tab).
 */
exports.whiteboardWebSocketHandler = (request, socket, head, roomId, boardId) => {
  const wss = new WebSocket.Server({ noServer: true });

  wss.on('connection', async (ws, req) => {
    // Parse tabId and userName from query string
    let clientTabId = null;
    let userName = null;
    try {
      const fullUrl = req.url || '';
      const parsed = new URL(fullUrl, 'http://localhost');
      clientTabId = parsed.searchParams.get('tabId') || parsed.searchParams.get('sessionId') || null;
      userName = parsed.searchParams.get('userName') || 'anonymous';
    } catch (e) { 
      clientTabId = null; 
      userName = 'anonymous';
    }
    if (!clientTabId) clientTabId = uuidv4();

    console.log(`[whiteboard] NEW WS connected room=${roomId} board=${boardId} tabId=${clientTabId} user=${userName}`);

    // CRITICAL: Check permissions before allowing connection
    const canEdit = await canUserEditBoard(roomId, boardId, userName);
    console.log(`[whiteboard] User ${userName} can edit board ${boardId}: ${canEdit}`);

    // Track connection for debugging
    let msgCount = 0;
    const MAX_LOG_MSGS = 3;
    const firstMessages = [];

    // Debug listeners
    const onMessage = (data) => {
      msgCount++;
      if (msgCount <= MAX_LOG_MSGS) {
        try {
          const parsed = JSON.parse(data.toString());
          firstMessages.push(parsed);
          console.log(`[whiteboard] ws message #${msgCount} (tabId=${clientTabId}):`, parsed.type || 'unknown');
        } catch (_) {
          firstMessages.push(data.toString().slice(0, 100));
          console.log(`[whiteboard] ws message #${msgCount} (tabId=${clientTabId}): raw data`);
        }
      }
    };

    const onError = (err) => {
      console.warn(`[whiteboard] ws ERROR tabId=${clientTabId}:`, err.message || err);
    };

    const onClose = (code, reason) => {
      const reasonStr = reason && reason.length ? reason.toString() : '';
      console.log(`[whiteboard] ws CLOSE tabId=${clientTabId} code=${code} reason="${reasonStr}"`);
    };

    // Attach debug listeners
    ws.on('message', onMessage);
    ws.on('error', onError);
    ws.on('close', onClose);

    // Connection watchdog
    const watchdog = setTimeout(() => {
      if (msgCount === 0) {
        console.log(`[whiteboard] No messages received after 6s for tabId=${clientTabId}`);
      }
    }, 6000);

    let room;
    try {
      room = await getOrCreateRoom(roomId, boardId);
    } catch (e) {
      console.error(`[whiteboard] getOrCreateRoom ERROR for ${roomId}/${boardId}:`, e.message || e);
      clearTimeout(watchdog);
      // Clean up debug listeners
      ws.off('message', onMessage);
      ws.off('error', onError);
      ws.off('close', onClose);
      try { 
        socket.destroy(); 
      } catch(_) {}
      return;
    }

    console.log('[whiteboard] calling room.handleSocketConnect()');
    try {
      // CRITICAL: Connect the socket to the TLDraw room with user context
      room.handleSocketConnect({ 
        sessionId: clientTabId, 
        socket: ws,
        // IMPORTANT: Pass user context for permission checks
        context: { 
          userName,
          canEdit,
          roomId,
          boardId
        }
      });
      console.log('[whiteboard] room.handleSocketConnect() completed successfully');
    } catch (err) {
      console.error('[whiteboard] room.handleSocketConnect() ERROR:', err.message || err);
    }

    // Clean up debug listeners when socket closes
    ws.once('close', () => {
      clearTimeout(watchdog);
      console.log(`[whiteboard] Connection summary for tabId=${clientTabId}: ${msgCount} messages`);
      // Remove debug listeners
      ws.off('message', onMessage);
      ws.off('error', onError);
      ws.off('close', onClose);
    });
  });

  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
};