const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');

let pty;
try {
  pty = require('node-pty');
} catch (e) {
  console.warn('node-pty not installed; terminal feature will be disabled.');
}

const TERMINAL_SESSIONS = new Map();

exports.terminalWebSocketHandler = (request, socket, head, sessionId) => {
  const wss = new WebSocket.Server({ noServer: true });
  wss.handleUpgrade(request, socket, head, (ws) => {
    if (!pty) {
      ws.send(JSON.stringify({ type: 'output', data: 'Terminal not available. Install node-pty on the server.' }));
      ws.close();
      return;
    }

    // Define workspace directory path
    const workspaceDir = path.join('/app/workspaces', sessionId);
    
    // Ensure workspace directory exists
    if (!fs.existsSync(workspaceDir)) {
      console.log(`[terminal] Creating workspace directory: ${workspaceDir}`);
      try {
        fs.mkdirSync(workspaceDir, { recursive: true });
      } catch (err) {
        console.error(`[terminal] Failed to create workspace directory: ${err.message}`);
        ws.send(JSON.stringify({ 
          type: 'output', 
          data: `\x1b[31mError: Failed to create workspace directory\x1b[0m\r\n` 
        }));
        ws.close();
        return;
      }
    }

    console.log(`[terminal] Starting terminal in workspace: ${workspaceDir}`);

    // Spawn PTY process with workspace directory as CWD
    const ptyProcess = pty.spawn('bash', [], {
      name: 'xterm-color',
      cwd: workspaceDir,
      env: {
        ...process.env,
        PS1: `session-${sessionId}:~$ ` // Custom prompt showing session directory
      }
    });

    console.log(`[terminal] spawned pty (pid=${ptyProcess.pid}) for session ${sessionId} in ${workspaceDir}`);

    // Send welcome message
    ws.send(JSON.stringify({ 
      type: 'output', 
      data: `\x1b[32mConnected to terminal.\x1b[0m\r\nWorking directory: ${workspaceDir}\r\n` 
    }));

    ptyProcess.onData((data) => {
      ws.send(JSON.stringify({ type: 'output', data }));
    });

    ws.on('message', (msg) => {
      try {
        const parsed = JSON.parse(msg);
        if (parsed.type === 'input') {
          ptyProcess.write(parsed.data);
        } else if (parsed.type === 'resize') {
          ptyProcess.resize(parsed.cols, parsed.rows);
        }
      } catch (err) {
        console.error(`[terminal] Error handling message: ${err.message}`);
      }
    });

    ws.on('close', () => {
      console.log(`[terminal] connection closed for session ${sessionId}, killing pty.`);
      try {
        ptyProcess.kill();
      } catch (err) {
        console.error(`[terminal] Error killing pty: ${err.message}`);
      }
      TERMINAL_SESSIONS.delete(sessionId);
    });

    ws.on('error', (err) => {
      console.error(`[terminal] WebSocket error for session ${sessionId}:`, err);
      try {
        ptyProcess.kill();
      } catch (e) {
        // Ignore
      }
      TERMINAL_SESSIONS.delete(sessionId);
    });

    TERMINAL_SESSIONS.set(sessionId, ptyProcess);
  });
};