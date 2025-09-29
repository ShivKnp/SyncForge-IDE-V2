// routes/whiteboard.js - CRITICAL FIX for permission enforcement
const express = require('express');
const { connection } = require('../websockets/share');
const { v4: uuidv4 } = require('uuid');
const { broadcastToSession } = require('../websockets/share');


const router = express.Router();

// POST /session/:sessionId/boards/:boardId/snapshot

// Save whiteboard snapshot to server
// Save whiteboard snapshot to server
router.post('/:sessionId/boards/:boardId/snapshot', async (req, res) => {
  const { sessionId, boardId } = req.params;
  const { snapshot, saver } = req.body;

  try {
    if (!sessionId || !boardId) {
      return res.status(400).json({ ok: false, error: 'Session ID and Board ID are required' });
    }

    if (!snapshot) {
      return res.status(400).json({ ok: false, error: 'Snapshot data is required' });
    }

    // Get the session document
    const doc = connection.get('examples', sessionId);
    await new Promise((resolve, reject) => {
      doc.fetch(err => (err ? reject(err) : resolve()));
    });

    if (!doc.type) {
      return res.status(404).json({ ok: false, error: 'Session not found' });
    }

    // Determine hosts and board config
    const config = doc.data.config || {};
    const hosts = config.hosts ? [...config.hosts] : [];
    if (config.ownerName && !hosts.includes(config.ownerName)) {
      hosts.push(config.ownerName);
    }

    const boardConfig = doc.data.whiteboardConfig?.[boardId];

    // Permission check
    let canSave = false;
    if (saver && hosts.includes(saver)) {
      canSave = true; // Host can always save
    } else if (boardConfig) {
      // Check board mode for non-hosts
      canSave = (boardConfig.mode === 'everyone' || boardConfig.mode === 'public');
    }

    // Special handling: allow saver to persist "private" notes (client uses private_* or privateNote ids)
    const looksLikePrivate = boardId && (boardId.startsWith('private_') || boardId.startsWith('private-note') || boardId.startsWith('note_'));
    if (!canSave && looksLikePrivate && saver) {
      // create a minimal board config and persist snapshot as a whiteboards entry
      const privateConfig = {
        id: boardId,
        name: snapshot?.name || 'Private Note',
        mode: 'host-only',
        createdBy: saver,
        createdAt: new Date().toISOString(),
        isPrivateNote: true
      };

      const ops = [
        { p: ['whiteboards', boardId], oi: { ...(snapshot || {}), lastSaved: new Date().toISOString(), savedBy: saver } },
        { p: ['whiteboardConfig', boardId], oi: privateConfig }
      ];

      // Create or update in one atomic submitOp
      doc.submitOp(ops, { source: 'server-snapshot-private' });

      console.log(`[whiteboard] Private snapshot saved for ${sessionId}/${boardId} by ${saver}`);
      return res.json({ ok: true, message: 'Private snapshot saved', timestamp: new Date().toISOString() });
    }

    if (!canSave) {
      return res.status(403).json({
        ok: false,
        error: 'You do not have permission to save this board'
      });
    }

    // Normal save for configured boards
    const saveOp = [{
      p: ['whiteboards', boardId],
      oi: {
        ...(snapshot || {}),
        lastSaved: new Date().toISOString(),
        savedBy: saver
      }
    }];

    doc.submitOp(saveOp, { source: 'snapshot-save' });

    console.log(`[whiteboard] Snapshot saved for ${sessionId}/${boardId} by ${saver}`);

    res.json({
      ok: true,
      message: 'Snapshot saved successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[whiteboard] Snapshot save error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to save snapshot: ' + (error.message || 'Unknown error')
    });
  }
});

// Get whiteboard snapshot from server
router.get('/:sessionId/boards/:boardId/snapshot', async (req, res) => {
  const { sessionId, boardId } = req.params;

  try {
    if (!sessionId || !boardId) {
      return res.status(400).json({ ok: false, error: 'Session ID and Board ID are required' });
    }

    // Get the session document
    const doc = connection.get('examples', sessionId);
    await new Promise((resolve, reject) => {
      doc.fetch(err => (err ? reject(err) : resolve()));
    });

    if (!doc.type) {
      return res.status(404).json({ ok: false, error: 'Session not found' });
    }

    const snapshot = doc.data.whiteboards?.[boardId];
    const boardConfig = doc.data.whiteboardConfig?.[boardId];

    if (!snapshot) {
      return res.status(404).json({ ok: false, error: 'Board snapshot not found' });
    }

    res.json({ 
      ok: true, 
      snapshot,
      boardConfig,
      retrieved: new Date().toISOString()
    });

  } catch (error) {
    console.error('[whiteboard] Snapshot retrieval error:', error);
    res.status(500).json({ 
      ok: false, 
      error: 'Failed to retrieve snapshot: ' + (error.message || 'Unknown error')
    });
  }
});

// POST /session/:sessionId/boards - Create a new whiteboard
router.post('/:sessionId/boards', async (req, res) => {
  const { sessionId } = req.params;
  const { name, mode, creator, snapshot } = req.body;

  if (!name || !mode || !creator) {
    return res.status(400).json({ 
      ok: false, 
      error: 'Missing required fields: name, mode, creator' 
    });
  }

  // Validate mode
  if (!['host-only', 'everyone', 'public'].includes(mode)) {
    return res.status(400).json({ 
      ok: false, 
      error: 'Invalid mode. Must be host-only, everyone, or public' 
    });
  }

  try {
    // Get the session document
    const doc = connection.get('examples', sessionId);
    
    await new Promise((resolve, reject) => {
      doc.fetch((err) => {
        if (err) return reject(err);
        if (!doc.type) return reject(new Error('Session not found'));
        resolve();
      });
    });

    // Check if creator is a host (basic authorization)
    const config = doc.data.config || {};
    const hosts = config.hosts || [];
    if (config.ownerName && !hosts.includes(config.ownerName)) {
      hosts.push(config.ownerName);
    }
    
    const isCreatorHost = hosts.includes(creator);
    if (!isCreatorHost) {
      return res.status(403).json({ 
        ok: false, 
        error: 'Only hosts can create boards' 
      });
    }

    // Create new board
    const boardId = uuidv4();
    const boardConfig = {
      id: boardId,
      name: name.trim(),
      mode,
      createdBy: creator,
      createdAt: new Date().toISOString()
    };

    // Prepare ShareDB operations
    const ops = [
      { p: ['whiteboards', boardId], oi: snapshot || {} },
      { p: ['whiteboardConfig', boardId], oi: boardConfig }
    ];

    // Submit operations to ShareDB
    await new Promise((resolve, reject) => {
      doc.submitOp(ops, { source: 'server-create-board' }, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    try {
  broadcastToSession(sessionId, { type: 'new-board', sessionId, boardId, name: boardConfig.name, createdBy: creator });
} catch (e) {
  console.warn('broadcastToSession failed', e);
}

    console.log(`[whiteboard] Board created: ${boardId} by ${creator} in session ${sessionId}`);
    
    res.json({ 
      ok: true, 
      boardId,
      config: boardConfig
    });

  } catch (error) {
    console.error('[whiteboard] Create board error:', error);
    res.status(500).json({ 
      ok: false, 
      error: 'Failed to create board' 
    });
  }
});

// GET /session/:sessionId/boards - List all boards for a session
router.get('/:sessionId/boards', async (req, res) => {
  const { sessionId } = req.params;

  try {
    const doc = connection.get('examples', sessionId);
    
    await new Promise((resolve, reject) => {
      doc.fetch((err) => {
        if (err) return reject(err);
        if (!doc.type) return reject(new Error('Session not found'));
        resolve();
      });
    });

    const whiteboardConfig = doc.data.whiteboardConfig || {};
    const boards = Object.values(whiteboardConfig);

    res.json({ 
      ok: true, 
      boards,
      count: boards.length
    });

  } catch (error) {
    console.error('[whiteboard] List boards error:', error);
    res.status(500).json({ 
      ok: false, 
      error: 'Failed to fetch boards' 
    });
  }
});

// PUT /session/:sessionId/boards/:boardId - Update board configuration
router.put('/:sessionId/boards/:boardId', async (req, res) => {
  const { sessionId, boardId } = req.params;
  const { updater, ...updates } = req.body;

  if (!updater) {
    return res.status(400).json({
      ok: false,
      error: 'Missing updater field'
    });
  }

  try {
    const doc = connection.get('examples', sessionId);

    await new Promise((resolve, reject) => {
      doc.fetch((err) => {
        if (err) return reject(err);
        if (!doc.type) return reject(new Error('Session not found'));
        resolve();
      });
    });

    const config = doc.data.config || {};
    const hosts = Array.isArray(config.hosts) ? [...config.hosts] : [];
    if (config.ownerName && !hosts.includes(config.ownerName)) hosts.push(config.ownerName);

    const isUpdaterHost = hosts.includes(updater);

    // Board existence check (may be undefined for shared/private notes stored elsewhere)
    const currentBoardConfig = doc.data.whiteboardConfig?.[boardId];
    const sharedNotes = doc.data.sharedNotes || {};

    // Case 1: updater is host — allowed to update any board config
    if (isUpdaterHost) {
      if (!currentBoardConfig) {
        return res.status(404).json({ ok: false, error: 'Board not found' });
      }
      const updatedConfig = {
        ...currentBoardConfig,
        ...updates,
        updatedAt: new Date().toISOString(),
        updatedBy: updater
      };

      const ops = [{ p: ['whiteboardConfig', boardId], oi: updatedConfig }];
      await new Promise((resolve, reject) => {
        doc.submitOp(ops, { source: 'server-update-board' }, (err) => (err ? reject(err) : resolve()));
      });

      return res.json({ ok: true, config: updatedConfig });
    }

    // Case 2: updater is the creator of a private note stored in whiteboardConfig (allow rename)
    if (currentBoardConfig && currentBoardConfig.isPrivateNote && currentBoardConfig.createdBy === updater) {
      const updatedConfig = {
        ...currentBoardConfig,
        ...updates,
        updatedAt: new Date().toISOString(),
        updatedBy: updater
      };

      const ops = [{ p: ['whiteboardConfig', boardId], oi: updatedConfig }];
      await new Promise((resolve, reject) => {
        doc.submitOp(ops, { source: 'server-update-board' }, (err) => (err ? reject(err) : resolve()));
      });

      return res.json({ ok: true, config: updatedConfig });
    }

    // Case 3: updater is renaming a note that was shared with them (sharedNotes[updater][boardId])
    // This updates only that user's sharedNotes map.
    if (sharedNotes && sharedNotes[updater] && sharedNotes[updater][boardId]) {
      const userSharedMap = { ...(sharedNotes[updater] || {}) };
      const existing = userSharedMap[boardId] || {};
      const updatedShared = {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString(),
        updatedBy: updater
      };
      userSharedMap[boardId] = updatedShared;

      // Submit op to set the user's sharedNotes map
      const ops = [{ p: ['sharedNotes', updater], oi: userSharedMap }];
      await new Promise((resolve, reject) => {
        doc.submitOp(ops, { source: 'server-update-shared-note' }, (err) => (err ? reject(err) : resolve()));
      });

      return res.json({ ok: true, sharedNote: updatedShared });
    }

    // Otherwise, not allowed
    return res.status(403).json({
      ok: false,
      error: 'You do not have permission to update this board'
    });

  } catch (error) {
    console.error('[whiteboard] Update board error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to update board'
    });
  }
});

// DELETE /session/:sessionId/boards/:boardId - Delete a board
router.delete('/:sessionId/boards/:boardId', async (req, res) => {
  const { sessionId, boardId } = req.params;
  const { deleter } = req.body;

  if (!deleter) {
    return res.status(400).json({ 
      ok: false, 
      error: 'Missing deleter field' 
    });
  }

  try {
    const doc = connection.get('examples', sessionId);
    
    await new Promise((resolve, reject) => {
      doc.fetch((err) => {
        if (err) return reject(err);
        if (!doc.type) return reject(new Error('Session not found'));
        resolve();
      });
    });

    // Check authorization
    const config = doc.data.config || {};
    const hosts = config.hosts || [];
    if (config.ownerName && !hosts.includes(config.ownerName)) {
      hosts.push(config.ownerName);
    }
    
    const isDeleterHost = hosts.includes(deleter);
    if (!isDeleterHost) {
      return res.status(403).json({ 
        ok: false, 
        error: 'Only hosts can delete boards' 
      });
    }

    // Check if board exists
    const currentBoardConfig = doc.data.whiteboardConfig?.[boardId];
    const currentBoardData = doc.data.whiteboards?.[boardId];
    
    if (!currentBoardConfig) {
      return res.status(404).json({ 
        ok: false, 
        error: 'Board not found' 
      });
    }

    // Delete board
    const ops = [
      { p: ['whiteboards', boardId], od: currentBoardData || {} },
      { p: ['whiteboardConfig', boardId], od: currentBoardConfig }
    ];

    await new Promise((resolve, reject) => {
      doc.submitOp(ops, { source: 'server-delete-board' }, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    console.log(`[whiteboard] Board deleted: ${boardId} by ${deleter} in session ${sessionId}`);
    
    res.json({ 
      ok: true, 
      message: `Board "${currentBoardConfig.name}" deleted successfully`
    });

  } catch (error) {
    console.error('[whiteboard] Delete board error:', error);
    res.status(500).json({ 
      ok: false, 
      error: 'Failed to delete board' 
    });
  }
});

module.exports = router;