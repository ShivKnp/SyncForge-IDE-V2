// websockets/video.js
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

// Try to import register/unregister helpers from the share module.
// share.js exports registerSocket(sessionId, peerId, ws) and unregisterSocket(sessionId, peerId)
let registerSocket = () => {};
let unregisterSocket = () => () => {};
try {
  const share = require('./share');
  // defensive mapping if functions exist
  if (typeof share.registerSocket === 'function') registerSocket = share.registerSocket;
  if (typeof share.unregisterSocket === 'function') unregisterSocket = share.unregisterSocket;
} catch (e) {
  console.warn('[video] warning: ./share not found or failed to load — admin kick may not work', e && e.stack ? e.stack : e);
}

const VIDEO_ROOMS = new Map();
const ROOM_SERVERS = new Map();

/**
 * safeSendJson - guard send to avoid throwing on CLOSED sockets
 */
function safeSendJson(ws, obj) {
  try {
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(obj));
    return true;
  } catch (err) {
    console.warn('[video] safeSendJson failed', err && err.stack ? err.stack : err);
    return false;
  }
}

/**
 * videoWebSocketHandler
 * Handles upgrade for /video/:roomId websocket
 */
exports.videoWebSocketHandler = (request, socket, head, roomId) => {
  // Initialize room data structure if it doesn't exist
  if (!VIDEO_ROOMS.has(roomId)) {
    VIDEO_ROOMS.set(roomId, { clients: new Map(), userToWs: new Map() });
    console.log(`[video] created room ${roomId}`);
  }
  const room = VIDEO_ROOMS.get(roomId);

  // Get or create the WebSocket server for this room
  let wss = ROOM_SERVERS.get(roomId);
  if (!wss) {
    wss = new WebSocket.Server({ noServer: true });
    ROOM_SERVERS.set(roomId, wss);

    // Per-room connection handler
    wss.on('connection', (ws, request) => {
      const userId = uuidv4();
      const userInfo = { userId, userName: 'Anonymous', mediaState: undefined };

      // store client ws -> info and userId -> ws
      room.clients.set(ws, userInfo);
      room.userToWs.set(userId, ws);

      // Register socket in shared session registry so admin APIs can find it
      try {
        registerSocket(roomId, userId, ws);
      } catch (err) {
        console.warn('[video] registerSocket failed', err && err.stack ? err.stack : err);
      }

      console.log(`[video] connection OPEN room=${roomId} userId=${userId}`);

      // Tell the newly-connected socket its assigned id
      safeSendJson(ws, { type: 'assign-id', id: userId });

      // Send the current user-list to the new socket only (so it can build connections)
      const users = Array.from(room.clients.values())
        .filter(info => info.userId !== userId)
        .map(info => ({ userId: info.userId, userName: info.userName, mediaState: info.mediaState }));
      safeSendJson(ws, { type: 'user-list', users });
      console.log(`[video] sent user-list to ${userId}:`, users.map(u => u.userId));

      // IMPORTANT: do NOT broadcast a 'join' here using server-side default userName.
      // Wait for the client to send its own 'join' message (which carries the real name).

      ws.on('message', (dataRaw) => {
        let message;
        try {
          message = JSON.parse(dataRaw);
        } catch (e) {
          console.warn('[video] invalid JSON message', e);
          return;
        }

        const { type, to } = message;
        // Retrieve the authoritative stored info for this ws
        const senderInfo = room.clients.get(ws) || { userId, userName: 'Anonymous' };

        // If client provided a name, update authoritative record
        if (message.name && typeof message.name === 'string') {
          senderInfo.userName = message.name;
          try { room.clients.set(ws, senderInfo); } catch (e) { /* ignore */ }
        }

        // If client updated media state, persist it
        if (message.type === 'media-update' && typeof message.data === 'object') {
          senderInfo.mediaState = message.data;
          try { room.clients.set(ws, senderInfo); } catch (e) { /* ignore */ }
        }

        // Compose outgoing message that includes authoritative name
        const out = { ...message, from: userId, name: senderInfo.userName };

        switch (type) {
          // direct signaling messages (to specific peer)
          case 'offer':
          case 'answer':
          case 'ice-candidate':
            if (to && room.userToWs.has(to)) {
              const recipientWs = room.userToWs.get(to);
              if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
                safeSendJson(recipientWs, out);
                console.log(`[video] forwarded ${type} from ${userId} -> ${to}`);
              } else {
                console.warn(`[video] recipient ${to} not open for ${type}`);
              }
            } else {
              console.warn(`[video] signaling ${type} with missing/invalid 'to' field from ${userId}`);
            }
            break;

          // broadcast messages (join/media-update) to other participants
          case 'media-update':
            case 'cursor':
  // payload should include { userId, selection, caret, name }
  // Broadcast to other participants
  room.clients.forEach((info, client) => {
    if (client !== ws && client.readyState === WebSocket.OPEN) {
      safeSendJson(client, out); // `out` is message with { ...message, from: userId, name }
    }
  });
  break;

  case 'set-quality': {
  // message.data expected: { scope: 'global'|'pinned', quality: 'HIGH'|'MEDIUM'|'LOW' }
  try {
    const payload = message.data || {};
    const quality = payload.quality || null;
    const scope = payload.scope || 'global';

    // Ack back to requester so UI can show a response
    safeSendJson(ws, { type: 'set-quality-ack', from: userId, data: { scope, quality } });

    // If a 'to' is included but it equals the requester, treat it as invalid (no-op)
    if (to && to === userId) {
      console.log(`[video] set-quality request from ${userId} contained self-target 'to'=${to} — ignoring direct forward`);
      // Still broadcast to others (if desired) or return early. We'll broadcast below if no explicit target.
    }

    // If a specific 'to' is set and it's different from the requester, forward only to that peer
    if (to && to !== userId && room.userToWs.has(to)) {
      const recipientWs = room.userToWs.get(to);
      if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
        safeSendJson(recipientWs, { type: 'set-quality-request', from: userId, data: { scope, quality } });
        console.log(`[video] forwarded set-quality-request from ${userId} -> ${to} (${quality})`);
      } else {
        console.warn(`[video] recipient ${to} not open for set-quality-request from ${userId}`);
      }
    } else {
      // Broadcast to all other participants (exclude sender)
      room.clients.forEach((info, client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          safeSendJson(client, { type: 'set-quality-request', from: userId, data: { scope, quality } });
        }
      });
      console.log(`[video] broadcasted set-quality-request from ${userId} to ${Math.max(0, room.clients.size - 1)} peers (${quality})`);
    }
  } catch (err) {
    console.warn('[video] set-quality handling failed', err && err.stack ? err.stack : err);
  }
  break;
}

case 'set-quality-done': {
  // Client -> server -> forward to 'to' (the original requester) so they know it completed.
  // message.to should be the original requester id
  try {
    const payload = message.data || {};
    const target = message.to;
    if (target && room.userToWs.has(target)) {
      const targetWs = room.userToWs.get(target);
      if (targetWs && targetWs.readyState === WebSocket.OPEN) {
        safeSendJson(targetWs, { type: 'set-quality-done', from: userId, data: payload });
        console.log(`[video] forwarded set-quality-done from ${userId} -> ${target}`);
      }
    } else {
      // If no 'to' provided, broadcast a done ack to everyone (exclude sender)
      room.clients.forEach((info, client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          safeSendJson(client, { type: 'set-quality-done', from: userId, data: payload });
        }
      });
      console.log(`[video] broadcasted set-quality-done from ${userId}`);
    }
  } catch (err) {
    console.warn('[video] set-quality-done handling failed', err && err.stack ? err.stack : err);
  }
  break;
}





  

          case 'join':
            room.clients.forEach((info, client) => {
              if (client !== ws && client.readyState === WebSocket.OPEN) {
                safeSendJson(client, out);
              }
            });
            console.log(`[video] broadcasted ${type} from ${userId} to ${room.clients.size - 1} peers`);
            break;

          default:
            console.warn(`[video] received unknown message type: ${type} from ${userId}`);
            break;
        }
      });

      ws.on('close', (code, reason) => {
        console.log(`[video] connection CLOSE room=${roomId} userId=${userId} code=${code} reason=${reason}`);
        const leavingInfo = room.clients.get(ws);
        if (leavingInfo) {
          const { userId: leavingId, userName } = leavingInfo;
          const leaveMessage = { type: 'leave', from: leavingId, name: userName };

          // Broadcast leave to remaining clients
          room.clients.forEach((info, client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              safeSendJson(client, leaveMessage);
            }
          });

          // Unregister from admin session registry
          try {
            unregisterSocket(roomId, leavingId);
          } catch (err) {
            console.warn('[video] unregisterSocket failed', err && err.stack ? err.stack : err);
          }

          // remove mappings
          room.clients.delete(ws);
          room.userToWs.delete(leavingId);

          // Clean up room if empty (close wss after delay to allow reconnections)
          if (room.clients.size === 0) {
            VIDEO_ROOMS.delete(roomId);
            setTimeout(() => {
              if (!VIDEO_ROOMS.has(roomId)) {
                try { wss.close(); } catch (e) {}
                ROOM_SERVERS.delete(roomId);
                console.log(`[video] deleted empty room ${roomId} and cleaned up server`);
              }
            }, 30000);
          }
        }
      });

      ws.on('error', (err) => {
        console.warn('[video] ws error (caught)', err && err.stack ? err.stack : err);
      });
    });
  }

  // Handle the upgrade with the existing WebSocket server
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
};