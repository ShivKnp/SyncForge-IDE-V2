// websockets/video.js - FIXED VERSION
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

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

      // 1. Send assigned ID to new client
      safeSendJson(ws, { type: 'assign-id', id: userId });

      // 2. Send existing users to new client WITH their media states
      const users = Array.from(room.clients.values())
        .filter(info => info.userId !== userId)
        .map(info => ({ 
          userId: info.userId, 
          userName: info.userName, 
          mediaState: info.mediaState 
        }));
      safeSendJson(ws, { type: 'user-list', users });

      // 3. Request existing clients to create offers for the new user
      // This ensures proper signaling flow
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

        // Update user name if provided
        if (message.name && typeof message.name === 'string') {
          senderInfo.userName = message.name;
          try { room.clients.set(ws, senderInfo); } catch (e) { }
        }

        // CRITICAL FIX: Update media state properly
        if (type === 'media-update' && message.data) {
          senderInfo.mediaState = { 
            ...senderInfo.mediaState, 
            ...message.data 
          };
          try { room.clients.set(ws, senderInfo); } catch (e) { }
          console.log(`[video] updated media state for ${userId}:`, senderInfo.mediaState);
        }

        const out = { ...message, from: userId, name: senderInfo.userName };

        switch (type) {
          case 'join':
            // When a client sends 'join', broadcast to all OTHER clients
            console.log(`[video] ${userId} joined with name ${message.name}`);
            
            // Update userName in our records
            senderInfo.userName = message.name || senderInfo.userName;
            room.clients.set(ws, senderInfo);
            
            // Broadcast join with current media state
            const joinMsg = {
              type: 'join',
              from: userId,
              name: senderInfo.userName,
              mediaState: senderInfo.mediaState
            };
            
            room.clients.forEach((info, client) => {
              if (client !== ws && client.readyState === WebSocket.OPEN) {
                safeSendJson(client, joinMsg);
              }
            });
            break;

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
            if (to && room.userToWs.has(to)) {
              const recipientWs = room.userToWs.get(to);
              if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
                safeSendJson(recipientWs, out);
                console.log(`[video] forwarded create-offer from ${userId} -> ${to}`);
              }
            }
            break;

          case 'media-update':
            // Broadcast media updates to all other participants
            console.log(`[video] broadcasting media-update from ${userId}`, message.data);
            room.clients.forEach((info, client) => {
              if (client !== ws && client.readyState === WebSocket.OPEN) {
                safeSendJson(client, out);
              }
            });
            break;

          case 'set-quality':
          case 'set-quality-request':
          case 'set-quality-done':
            // Forward quality control messages
            if (to && room.userToWs.has(to)) {
              const recipientWs = room.userToWs.get(to);
              if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
                safeSendJson(recipientWs, out);
              }
            } else {
              // Broadcast to all if no specific target
              room.clients.forEach((info, client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                  safeSendJson(client, out);
                }
              });
            }
            break;

          default:
            console.warn(`[video] received unknown message type: ${type} from ${userId}`);
            break;
        }
      });

      ws.on('close', (code, reason) => {
        console.log(`[video] connection CLOSE room=${roomId} userId=${userId} code=${code}`);
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

          try {
            unregisterSocket(roomId, leavingId);
          } catch (err) {
            console.warn('[video] unregisterSocket failed', err);
          }

          room.clients.delete(ws);
          room.userToWs.delete(leavingId);

          // Clean up room if empty
          if (room.clients.size === 0) {
            VIDEO_ROOMS.delete(roomId);
            setTimeout(() => {
              if (!VIDEO_ROOMS.has(roomId)) {
                try { wss.close(); } catch (e) {}
                ROOM_SERVERS.delete(roomId);
                console.log(`[video] deleted empty room ${roomId}`);
              }
            }, 30000);
          }
        }
      });

      ws.on('error', (err) => {
        console.warn('[video] ws error', err);
      });
    });
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
};
