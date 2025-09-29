// editor-backend/websockets/chat.js
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const CHAT_ROOMS = new Map();
const MAX_HISTORY = 100;
const ROOM_TTL_MS = 30 * 60 * 1000; // keep room for 30 minutes after last client disconnect
const MAX_MESSAGE_BYTES = 64 * 1024; // 64 KB max message text

function createRoomIfMissing(roomId) {
  if (!CHAT_ROOMS.has(roomId)) {
    CHAT_ROOMS.set(roomId, { clients: new Set(), history: [], cleanupTimer: null });
  }
  return CHAT_ROOMS.get(roomId);
}

function clearRoomCleanupTimer(room) {
  if (room && room.cleanupTimer) {
    clearTimeout(room.cleanupTimer);
    room.cleanupTimer = null;
  }
}

function scheduleRoomCleanup(roomId) {
  const room = CHAT_ROOMS.get(roomId);
  if (!room) return;
  if (room.cleanupTimer) return;
  room.cleanupTimer = setTimeout(() => {
    const r = CHAT_ROOMS.get(roomId);
    if (r && r.clients.size === 0) {
      CHAT_ROOMS.delete(roomId);
      console.log(`[chat] cleaned up room ${roomId} after TTL`);
    } else if (r) {
      clearRoomCleanupTimer(r);
    }
  }, ROOM_TTL_MS);
}

function safePayload(m) {
  return {
    ...m,
    id: uuidv4(),
    type: m.type || 'system',
    from: m.from || 'System',
    text: m.text || '',
    ts: Date.now()
  };
}

exports.broadcastMessageToRoom = (roomId, message) => {
  const room = CHAT_ROOMS.get(roomId);
  if (!room) return;
  const payload = safePayload(message);

  // persist only known types
  if (payload.type === 'chat' || payload.type === 'file' || payload.type === 'system') {
    room.history.push(payload);
    if (room.history.length > MAX_HISTORY) room.history.shift();
  }

  room.clients.forEach(client => {
    if (client && client.readyState === WebSocket.OPEN) {
      try { client.send(JSON.stringify(payload)); } catch (e) { /* ignore */ }
    }
  });
};

exports.broadcastDeleteToRoom = (roomId, msgId, by) => {
  const room = CHAT_ROOMS.get(roomId);
  if (!room) return;
  room.history = room.history.map(m => (m.id === msgId ? { ...m, deleted: true } : m));
  const payload = { type: 'delete', id: msgId, by: by || 'system', ts: Date.now() };
  room.clients.forEach(client => { if (client && client.readyState === WebSocket.OPEN) {
    try { client.send(JSON.stringify(payload)); } catch (e) {}
  }});
};

exports.clearRoomHistory = (roomId, by) => {
  const room = CHAT_ROOMS.get(roomId);
  if (!room) return;
  room.history = [];
  const payload = { type: 'clear', by: by || 'system', ts: Date.now() };
  room.clients.forEach(client => { if (client && client.readyState === WebSocket.OPEN) {
    try { client.send(JSON.stringify(payload)); } catch (e) {}
  }});
};

exports.chatWebSocketHandler = (request, socket, head, roomId, ownerName = null) => {
  const wss = new WebSocket.Server({ noServer: true });
  wss.handleUpgrade(request, socket, head, (ws) => {
    const room = createRoomIfMissing(roomId);
    clearRoomCleanupTimer(room);
    room.clients.add(ws);

    // send history to new client
    try { ws.send(JSON.stringify({ type: 'history', items: room.history })); } catch (e) {}

    ws.on('message', (raw) => {
      // quick size guard for raw payload (helps prevent huge floods)
      if (typeof raw === 'string' && Buffer.byteLength(raw, 'utf8') > (MAX_MESSAGE_BYTES * 2)) {
        try { ws.send(JSON.stringify({ type: 'error', code: 'payload_too_large', message: 'Payload too large' })); } catch (e) {}
        return;
      }

      let msg;
      try { msg = JSON.parse(raw); } catch (e) {
        try { ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' })); } catch (e2) {}
        return;
      }

      if (msg.text && Buffer.byteLength(String(msg.text), 'utf8') > MAX_MESSAGE_BYTES) {
        try { ws.send(JSON.stringify({ type: 'error', code: 'text_too_large', message: 'Message text too large' })); } catch (e) {}
        return;
      }

      if (msg.type === 'chat') {
        exports.broadcastMessageToRoom(roomId, {
          type: 'chat',
          from: msg.from || 'Anonymous',
          text: msg.text || '',
          fileName: msg.fileName,
          fileType: msg.fileType
        });
      } else if (msg.type === 'delete' && msg.id) {
        const requester = msg.requester || msg.from || 'unknown';
        const orig = room.history.find(m => m.id === msg.id);
        const allowed = orig ? (requester === orig.from || requester === ownerName) : false;
        if (allowed) {
          exports.broadcastDeleteToRoom(roomId, msg.id, requester);
        } else {
          try { ws.send(JSON.stringify({ type: 'error', code: 'unauthorized', message: 'Not authorized to delete this message' })); } catch (e) {}
        }
      } else if (msg.type === 'clear') {
        const requester = msg.requester || msg.from || 'unknown';
        if (ownerName && requester !== ownerName) {
          try { ws.send(JSON.stringify({ type: 'error', code: 'unauthorized', message: 'Only the session owner can clear chat' })); } catch(e){}
        } else {
          exports.clearRoomHistory(roomId, requester);
        }
      } else {
        exports.broadcastMessageToRoom(roomId, {
          type: 'system',
          text: msg.text || '[unrecognized]'
        });
      }
    });

    ws.on('close', () => {
      room.clients.delete(ws);
      if (room.clients.size === 0) {
        scheduleRoomCleanup(roomId);
      }
    });

    ws.on('error', (err) => {
      room.clients.delete(ws);
      if (room.clients.size === 0) scheduleRoomCleanup(roomId);
      try { ws.terminate(); } catch (_) {}
    });
  });
};
