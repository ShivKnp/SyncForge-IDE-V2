const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const url = require('url');

const codeRunRouter = require('./routes/code');
const { videoWebSocketHandler } = require('./websockets/video');
const { terminalWebSocketHandler } = require('./websockets/terminal');
const { exportProjectToDisk } = require('./utils/workspace');
const { chatWebSocketHandler } = require('./websockets/chat');
const uploadRouter = require('./routes/upload');
const uploadzipRouter = require('./routes/uploadzip');
const downloadRouter = require('./routes/download');
// add with other requires near top of server.js
const aiCompleteRouter = require('./routes/ai-complete');
const { whiteboardWebSocketHandler } = require('./websockets/whiteboard');
const whiteboardRouter = require('./routes/whiteboard');



const { shareWebSocketHandler, ensureSessionExists, connection, kickParticipant, setSessionOwner } = require('./websockets/share');



const PORT = process.env.PORT || 8080;
const app = express();

// server.js - Update CORS to be more permissive for testing
// quick test only — allows all origins
app.use(require('cors')({ origin: true, credentials: true }));
app.options('*', require('cors')({ origin: true, credentials: true }));

app.use(bodyParser.json());


app.use('/session', whiteboardRouter);
app.use('/code', codeRunRouter);
app.use('/session', uploadRouter);
app.use('/session', downloadRouter);
app.use('/session', uploadzipRouter);
// mount AI completion route (POST /api/ai-complete)
app.use('/api/ai-complete', aiCompleteRouter);


app.get('/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// add near other routes in server.js (after your existing app.use lines)

// Kick participant by peerId (server will close that participant's sockets)
app.post('/session/:id/kick', async (req, res) => {
  const sessionId = req.params.id;
  const { peerId } = req.body || {};
  if (!peerId) return res.status(400).json({ ok: false, error: 'Missing peerId' });
  try {
    await kickParticipant(sessionId, peerId);
    return res.json({ ok: true });
  } catch (err) {
    console.error('kick error', err);
    return res.status(500).json({ ok: false, error: 'Failed to kick participant' });
  }
});


// Promote / set owner for session (persisted to shared doc config)
app.post('/session/:id/owner', async (req, res) => {
  const sessionId = req.params.id;
  const { ownerName } = req.body || {};
  if (!ownerName) return res.status(400).json({ ok: false, error: 'Missing ownerName' });
  try {
    await setSessionOwner(sessionId, ownerName);
    return res.json({ ok: true });
  } catch (err) {
    console.error('[/session/:id/owner] error', err);
    return res.status(500).json({ ok: false, error: 'Failed to set owner' });
  }
});

app.post('/session', async (req, res) => {
    try {
        const { id } = req.body || {};
        const providedConfig = req.body?.config || {
            roomMode: req.body?.roomMode || 'project',
            projectLanguage: req.body?.language || req.body?.lang || req.body?.projectLanguage || 'cpp',
            multiFile: (typeof req.body?.multiFile === 'boolean') ? req.body.multiFile : true,
            enableVideo: (typeof req.body?.enableVideo === 'boolean') ? req.body.enableVideo : true,
            enableTerminal: (typeof req.body?.enableTerminal === 'boolean') ? req.body.enableTerminal : true,
            sharedInputOutput: (typeof req.body?.sharedInputOutput === 'boolean') ? req.body.sharedInputOutput : true,
            allowFileCreation: true,
            allowRun: (typeof req.body?.allowRun === 'boolean') ? req.body.allowRun : true,
            enableChat: (typeof req.body?.enableChat === 'boolean') ? req.body.enableChat : true
        };

        if (!id) return res.status(400).json({ ok: false, error: 'Missing session id' });

        console.log('[Backend] POST /session id=', id, 'config=', providedConfig);
        const result = await ensureSessionExists(id, providedConfig);
        
        // Ensure initial export happens
        await exportProjectToDisk({ params: { id } }, { 
            json: () => {}, 
            status: () => ({ json: () => {} }) 
        });
        
        return res.json({ ok: true });
    } catch (err) {
        console.error('[Backend] POST /session error:', err && err.stack ? err.stack : err);
        return res.status(500).json({ ok: false, error: 'Server error' });
    }
});


app.get('/session/:id/details', async (req, res) => {
  const { id } = req.params;
  console.log('[Backend] GET /session/:id/details id=', id);
  try {
    const doc = connection.get('examples', id);
    let finished = false;
    const timer = setTimeout(() => {
      if (finished) return;
      finished = true;
      console.error('[Backend] /session/:id/details timed out for', id);
      return res.json({ isNew: true });
    }, 5000);
    doc.fetch((err) => {
      if (finished) {
        clearTimeout(timer);
        return;
      }
      finished = true;
      clearTimeout(timer);
      if (err) {
        console.error('[Backend] /session/details fetch error', err);
        return res.status(500).json({ isNew: true });
      }
      if (doc.type === null) {
        return res.json({ isNew: true });
      }
      const config = doc.data.config || {};
      const projectLanguage = config.projectLanguage || doc.data.projectLanguage || doc.data.lang || 'cpp';
      const roomMode = config.roomMode || doc.data.roomMode || 'project';
      return res.json({ isNew: false, roomMode, projectLanguage, config });
    });
  } catch (e) {
    console.error('[Backend] unexpected error in /session/:id/details', e && e.stack ? e.stack : e);
    return res.status(500).json({ isNew: true });
  }
});

app.post('/session/:id/export', exportProjectToDisk);

const server = app.listen(PORT, () => console.log(`Server started on port ${PORT}`));

server.on('upgrade', (request, socket, head) => {
  const pathname = url.parse(request.url).pathname;
  console.log('[upgrade] incoming ws upgrade for', pathname);
  const terminalMatch = pathname && pathname.match(/^\/terminal\/([\w-]+)$/);
  const videoMatch = pathname && pathname.match(/^\/video\/([\w-]+)$/);
  const chatMatch = pathname && pathname.match(/^\/chat\/([\w-]+)$/);
  const whiteboardMatch = pathname && pathname.match(/^\/whiteboard\/([\w-]+)\/([\w-]+)$/);
  // ----------------
  if (terminalMatch) {
    const sessionId = terminalMatch[1];
    const doc = connection.get('examples', sessionId);
    doc.fetch((err) => {
      if (err) {
        console.error('[upgrade] failed to fetch doc for terminal check', err);
        socket.destroy();
        return;
      }
      const cfg = (doc.data && doc.data.config) || {};
      const enabled = (typeof cfg.enableTerminal === 'boolean') ? cfg.enableTerminal : true;
      if (!enabled) {
        try { socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); } catch (e) {}
        socket.destroy();
        console.log(`[upgrade] terminal ws refused for ${sessionId} (disabled by config)`);
        return;
      }
      terminalWebSocketHandler(request, socket, head, sessionId);
    });
  } else if (videoMatch) {
    const roomId = videoMatch[1];
    const doc = connection.get('examples', roomId);
    doc.fetch((err) => {
      if (err) { socket.destroy(); return; }
      const cfg = (doc.data && doc.data.config) || {};
      const enabled = (typeof cfg.enableVideo === 'boolean') ? cfg.enableVideo : true;
      if (!enabled) {
        try { socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); } catch (e) {}
        socket.destroy();
        console.log(`[upgrade] video ws refused for ${roomId} (disabled by config)`);
        return;
      }
      videoWebSocketHandler(request, socket, head, roomId);
    });
  } else if (chatMatch) {
    const roomId = chatMatch[1];
    const doc = connection.get('examples', roomId);
    doc.fetch((err) => {
      if (err) { socket.destroy(); return; }
      const cfg = (doc.data && doc.data.config) || {};
      const enabled = (typeof cfg.enableChat === 'boolean') ? cfg.enableChat : true;
      if (!enabled) {
        try { socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); } catch (e) {}
        socket.destroy();
        console.log(`[upgrade] chat ws refused for ${roomId} (disabled by config)`);
        return;
      }
      chatWebSocketHandler(request, socket, head, roomId);
    });
  } else if (whiteboardMatch) {
    const sessionId = whiteboardMatch[1];
    const boardId = whiteboardMatch[2];
    // For now, we allow all connections. You could add a doc fetch here
    // to check if the whiteboard feature is enabled for the session.
    whiteboardWebSocketHandler(request, socket, head, sessionId, boardId);
  // ------------------------------
  } else if (pathname === '/sharedb') {
    shareWebSocketHandler(request, socket, head);
  } else {
    console.warn('[upgrade] Unknown WS path:', pathname);
    socket.destroy();
  }
});
