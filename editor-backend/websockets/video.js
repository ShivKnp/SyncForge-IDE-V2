// websockets/video.js
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

// Try to import register/unregister helpers from the share module.
let registerSocket = () => {};
let unregisterSocket = () => () => {};
try {
  const share = require('./share');
  if (typeof share.registerSocket === 'function') registerSocket = share.registerSocket;
  if (typeof share.unregisterSocket === 'function') unregisterSocket = share.unregisterSocket;
} catch (e) {
  console.warn('[video] warning: ./share not found — admin kick may not work', e);
}

const VIDEO_ROOMS = new Map();
const ROOM_SERVERS = new Map();

function safeSendJson(ws, obj) {
  try {
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(obj));
    return true;
  } catch (err) {
    console.warn('[video] safeSendJson failed', err);
    return false;
  }
}

exports.videoWebSocketHandler = (request, socket, head, roomId) => {
  if (!VIDEO_ROOMS.has(roomId)) {
    VIDEO_ROOMS.set(roomId, { clients: new Map(), userToWs: new Map() });
    console.log(`[video] created room ${roomId}`);
  }
  const room = VIDEO_ROOMS.get(roomId);

  let wss = ROOM_SERVERS.get(roomId);
  if (!wss) {
    wss = new WebSocket.Server({ noServer: true });
    ROOM_SERVERS.set(roomId, wss);

    wss.on('connection', (ws, request) => {
      const userId = uuidv4();
      const userInfo = { 
        userId, 
        userName: 'Anonymous', 
        mediaState: { 
          isMicOn: false, 
          isCameraOn: false,
          isScreenSharing: false 
        } 
      };

      room.clients.set(ws, userInfo);
      room.userToWs.set(userId, ws);

      try {
        registerSocket(roomId, userId, ws);
      } catch (err) {
        console.warn('[video] registerSocket failed', err);
      }

      console.log(`[video] connection OPEN room=${roomId} userId=${userId}`);

      // Send assigned ID to new client
      safeSendJson(ws, { type: 'assign-id', id: userId });

      // Send existing users to new client WITH their media states
      const users = Array.from(room.clients.values())
        .filter(info => info.userId !== userId)
        .map(info => ({ 
          userId: info.userId, 
          userName: info.userName, 
          mediaState: info.mediaState 
        }));
      safeSendJson(ws, { type: 'user-list', users });

      // Broadcast new user join to all existing clients WITH media state
      const joinMessage = { 
        type: 'join', 
        from: userId, 
        name: userInfo.userName,
        mediaState: userInfo.mediaState
      };

      room.clients.forEach((info, client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          safeSendJson(client, joinMessage);
        }
      });

      // NEW: Trigger existing clients to create offers for new user
      room.clients.forEach((info, client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          safeSendJson(client, { 
            type: 'create-offer', 
            to: userId,
            from: info.userId 
          });
        }
      });

      ws.on('message', (dataRaw) => {
        let message;
        try {
          message = JSON.parse(dataRaw);
        } catch (e) {
          console.warn('[video] invalid JSON message', e);
          return;
        }

        const { type, to } = message;
        const senderInfo = room.clients.get(ws) || { userId, userName: 'Anonymous' };

        // Update user info if provided
        if (message.name && typeof message.name === 'string') {
          senderInfo.userName = message.name;
          try { room.clients.set(ws, senderInfo); } catch (e) { }
        }

        // Update media state if provided
        if (message.type === 'media-update' && typeof message.data === 'object') {
          senderInfo.mediaState = { ...senderInfo.mediaState, ...message.data };
          try { room.clients.set(ws, senderInfo); } catch (e) { }
        }

        const out = { ...message, from: userId, name: senderInfo.userName };

        switch (type) {
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

          case 'create-offer':
            // Handle create-offer requests from existing users to new users
            if (to && room.userToWs.has(to)) {
              const recipientWs = room.userToWs.get(to);
              if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
                safeSendJson(recipientWs, out);
                console.log(`[video] forwarded create-offer from ${userId} -> ${to}`);
              }
            }
            break;

          case 'media-update':
          case 'cursor':
            // Broadcast to other participants
            room.clients.forEach((info, client) => {
              if (client !== ws && client.readyState === WebSocket.OPEN) {
                safeSendJson(client, out);
              }
            });
            break;

          case 'set-quality': {
            try {
              const payload = message.data || {};
              const quality = payload.quality || null;
              const scope = payload.scope || 'global';

              // Ack back to requester
              safeSendJson(ws, { type: 'set-quality-ack', from: userId, data: { scope, quality } });

              // If specific 'to' is set and different from requester, forward only to that peer
              if (to && to !== userId && room.userToWs.has(to)) {
                const recipientWs = room.userToWs.get(to);
                if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
                  safeSendJson(recipientWs, { type: 'set-quality-request', from: userId, data: { scope, quality } });
                  console.log(`[video] forwarded set-quality-request from ${userId} -> ${to} (${quality})`);
                }
              } else {
                // Broadcast to all other participants
                room.clients.forEach((info, client) => {
                  if (client !== ws && client.readyState === WebSocket.OPEN) {
                    safeSendJson(client, { type: 'set-quality-request', from: userId, data: { scope, quality } });
                  }
                });
                console.log(`[video] broadcasted set-quality-request from ${userId} to ${Math.max(0, room.clients.size - 1)} peers (${quality})`);
              }
            } catch (err) {
              console.warn('[video] set-quality handling failed', err);
            }
            break;
          }

          case 'set-quality-done': {
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
                // Broadcast to everyone except sender
                room.clients.forEach((info, client) => {
                  if (client !== ws && client.readyState === WebSocket.OPEN) {
                    safeSendJson(client, { type: 'set-quality-done', from: userId, data: payload });
                  }
                });
                console.log(`[video] broadcasted set-quality-done from ${userId}`);
              }
            } catch (err) {
              console.warn('[video] set-quality-done handling failed', err);
            }
            break;
          }

          case 'join':
            // This case is now handled in the connection setup above
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
            console.warn('[video] unregisterSocket failed', err);
          }

          // remove mappings
          room.clients.delete(ws);
          room.userToWs.delete(leavingId);

          // Clean up room if empty
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
        console.warn('[video] ws error (caught)', err);
      });
    });
  }

  // Handle the upgrade with the existing WebSocket server
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
};
