// src/hooks/useVideoChat.js
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
};

// Global store to track active connections by roomId
const activeConnections = new Map();

export const useVideoChat = (roomId, userName) => {
  const navigate = useNavigate();

  // states
  const [localPeerId, setLocalPeerId] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [peers, setPeers] = useState(new Map());
  
  // Restore mic/camera state from sessionStorage (set in lobby)
  const [isMicOn, setIsMicOn] = useState(() => {
    try {
      const saved = sessionStorage.getItem('codecrew-mic-on');
      return saved !== null ? saved === 'true' : true;
    } catch (e) {
      return true;
    }
  });
  
  const [isCameraOn, setIsCameraOn] = useState(() => {
    try {
      const saved = sessionStorage.getItem('codecrew-camera-on');
      return saved !== null ? saved === 'true' : true;
    } catch (e) {
      return true;
    }
  });
  
  const [pinnedPeerId, setPinnedPeerId] = useState(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [playbackEnabled, setPlaybackEnabled] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  // refs for stability
  const wsRef = useRef(null);
  const peerConnectionsRef = useRef(new Map());
  const cameraStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const localStreamRef = useRef(null);
  const pendingRemoteDescriptions = useRef(new Map());
  const pendingIceCandidates = useRef(new Map());
  const isMountedRef = useRef(true);
  const connectionIdRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 8;

  // keep ref synchronized with state
  useEffect(() => { 
    localStreamRef.current = localStream; 
  }, [localStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      
      // Remove from global tracking
      if (connectionIdRef.current && activeConnections.has(roomId)) {
        const roomConnections = activeConnections.get(roomId);
        roomConnections.delete(connectionIdRef.current);
        if (roomConnections.size === 0) {
          activeConnections.delete(roomId);
        }
      }

      // Cleanup all connections
      if (wsRef.current) {
        try { 
          wsRef.current.onclose = null;
          wsRef.current.close(); 
        } catch (e) {}
        wsRef.current = null;
      }
      
      for (const [peerId, pc] of peerConnectionsRef.current.entries()) {
        try { 
          pc.onnegotiationneeded = null;
          pc.ontrack = null;
          pc.onicecandidate = null;
          pc.onconnectionstatechange = null;
          pc.oniceconnectionstatechange = null;
          pc.onsignalingstatechange = null;
          pc.close(); 
        } catch (e) {}
      }
      peerConnectionsRef.current.clear();
      
      if (cameraStreamRef.current) {
        try { cameraStreamRef.current.getTracks().forEach(t => t.stop()); } catch (e) {}
      }
      if (screenStreamRef.current) {
        try { screenStreamRef.current.getTracks().forEach(t => t.stop()); } catch (e) {}
      }
    };
  }, [roomId]);

  // Stable send function
  const sendToServer = useCallback((message) => {
    try {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        console.warn('[useVideoChat] WebSocket not ready for sending');
        return false;
      }
      ws.send(JSON.stringify(message));
      return true;
    } catch (err) {
      console.warn('[useVideoChat] sendToServer error', err);
      return false;
    }
  }, []);

  // cleanup helper
  const cleanupPeerConnection = useCallback((peerId) => {
    const pc = peerConnectionsRef.current.get(peerId);
    if (pc) {
      try { 
        pc.onnegotiationneeded = null;
        pc.ontrack = null;
        pc.onicecandidate = null;
        pc.onconnectionstatechange = null;
        pc.oniceconnectionstatechange = null;
        pc.onsignalingstatechange = null;
        pc.close(); 
      } catch (e) {}
      peerConnectionsRef.current.delete(peerId);
    }
    pendingRemoteDescriptions.current.delete(peerId);
    pendingIceCandidates.current.delete(peerId);
    setPeers(prev => {
      const m = new Map(prev);
      m.delete(peerId);
      return m;
    });
  }, []);

  // Helper to replace video track
  const replaceVideoTrack = useCallback(async (newTrack) => {
    for (const [peerId, pc] of peerConnectionsRef.current.entries()) {
      const sender = pc.getSenders().find(s => s.track?.kind === 'video');
      if (sender && newTrack) {
        try {
          await sender.replaceTrack(newTrack);
          console.log(`[useVideoChat] replaced video track for peer ${peerId}`);
        } catch (err) {
          console.warn('replaceTrack failed', err);
        }
      }
    }
  }, []);

  // createPeerConnection - FIXED VERSION with role-based negotiation
  const createPeerConnection = useCallback((peerId, peerUserName, isInitiator = false) => {
    if (peerConnectionsRef.current.has(peerId)) {
      if (peerUserName) {
        setPeers(prev => {
          const m = new Map(prev);
          const prevEntry = m.get(peerId) || {};
          m.set(peerId, { ...prevEntry, userName: peerUserName });
          return m;
        });
      }
      return peerConnectionsRef.current.get(peerId);
    }

    console.log(`[PC] creating new peer connection for ${peerId}, initiator: ${isInitiator}`);
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pc.__peerId = peerId;
    pc.__isInitiator = isInitiator;

    // Only initiate negotiation if we're the initiator
    pc.onnegotiationneeded = async () => {
      try {
        if (pc.signalingState !== 'stable' || !pc.__isInitiator) {
          console.debug('[PC] skipping negotiation - not initiator or not stable');
          return;
        }
        
        console.log(`[PC] negotiation needed for ${peerId} (initiator)`);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendToServer({ type: 'offer', to: peerId, data: offer });
        console.log(`[PC] sent offer to ${peerId}`);
      } catch (err) {
        console.warn('[PC] negotiationneeded error', err);
      }
    };

    pc.ontrack = (event) => {
      if (!isMountedRef.current) return;
      
      console.log(`[PC] ontrack from ${peerId}`, event.streams, event.track);
      
      let incoming = null;
      if (event.streams && event.streams.length > 0) {
        incoming = event.streams[0];
      } else {
        incoming = new MediaStream();
        if (event.track) incoming.addTrack(event.track);
      }
      
      setPeers(prev => {
        const m = new Map(prev);
        const prevEntry = m.get(peerId) || {};
        m.set(peerId, { 
          ...prevEntry, 
          id: peerId, 
          userName: peerUserName, 
          stream: incoming,
          hasVideo: incoming.getVideoTracks().length > 0,
          hasAudio: incoming.getAudioTracks().length > 0
        });
        return m;
      });
    };

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        console.log(`[PC] ICE candidate for ${peerId}`);
        sendToServer({ type: 'ice-candidate', to: peerId, data: ev.candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[PC] ${peerId} connection state: ${pc.connectionState}`);
      if (pc.connectionState === 'connected') {
        setConnectionStatus('connected');
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[PC] ${peerId} ICE connection state: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === 'failed') {
        console.warn(`[PC] ICE connection failed for ${peerId}, restarting ICE`);
        try {
          if (pc.signalingState === 'stable' && pc.__isInitiator) {
            pc.createOffer().then(offer => {
              pc.setLocalDescription(offer);
              sendToServer({ type: 'offer', to: peerId, data: offer });
            });
          }
        } catch (restartErr) {
          console.warn('[PC] ICE restart failed', restartErr);
        }
      }
    };

    // Add tracks immediately
    const currentStream = isScreenSharing && screenStreamRef.current ? screenStreamRef.current : cameraStreamRef.current;
    if (currentStream) {
      currentStream.getTracks().forEach(track => {
        try {
          if (!pc.getSenders().some(s => s.track === track)) {
            pc.addTrack(track, currentStream);
            console.log(`[PC] added ${track.kind} track to ${peerId}`);
          }
        } catch (err) {
          console.warn(`[PC] addTrack failed for ${peerId}`, err);
        }
      });
    }

    peerConnectionsRef.current.set(peerId, pc);
    
    // Initialize peer in state
    setPeers(prev => {
      const m = new Map(prev);
      if (!m.has(peerId)) {
        m.set(peerId, { 
          id: peerId, 
          userName: peerUserName, 
          stream: new MediaStream(),
          hasVideo: false,
          hasAudio: false
        });
      } else {
        m.set(peerId, { ...m.get(peerId), userName: peerUserName });
      }
      return m;
    });

    return pc;
  }, [sendToServer, isScreenSharing]);

  // WebSocket connection management
  const setupWebSocket = useCallback(() => {
    if (!roomId || typeof userName !== 'string' || userName.trim() === '' || !isMountedRef.current) return;

    // Initialize room tracking
    if (!activeConnections.has(roomId)) {
      activeConnections.set(roomId, new Set());
    }
    const roomConnections = activeConnections.get(roomId);

    // If we already have an active connection for this room, don't create a new one
    if (roomConnections.size > 0) {
      console.debug('[WS] already have active connection for room', roomId, 'skipping new connection');
      return;
    }

    // Use Render backend without port
    const protocol = 'wss';
    const backendHost = 'syncforge-ide.onrender.com';
    const wsUrl = `${protocol}://${backendHost}/video/${roomId}`;

    console.log('[useVideoChat] opening ws', wsUrl);

    // Close existing connection if any
    if (wsRef.current) {
      try { 
        wsRef.current.onclose = null;
        wsRef.current.close(); 
        wsRef.current = null;
      } catch (e) {}
    }

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    connectionIdRef.current = Date.now() + Math.random().toString(36).substr(2, 9);
    roomConnections.add(connectionIdRef.current);

    ws.onopen = () => {
      if (!isMountedRef.current) {
        ws.close();
        return;
      }
      console.log('[WS] connected successfully');
      setConnectionStatus('connected');
      reconnectAttemptsRef.current = 0;
      
      try { 
        ws.send(JSON.stringify({ type: 'join', name: userName })); 
        // Send initial media state from sessionStorage
        const initialMicState = (() => {
          try {
            const saved = sessionStorage.getItem('codecrew-mic-on');
            return saved !== null ? saved === 'true' : true;
          } catch (e) {
            return true;
          }
        })();
        const initialCameraState = (() => {
          try {
            const saved = sessionStorage.getItem('codecrew-camera-on');
            return saved !== null ? saved === 'true' : true;
          } catch (e) {
            return true;
          }
        })();
        ws.send(JSON.stringify({ 
          type: 'media-update', 
          data: { 
            audio: initialMicState, 
            video: initialCameraState,
            isMicOn: initialMicState,
            isCameraOn: initialCameraState
          } 
        }));
      } catch (e) {
        console.warn('[WS] failed to send join message', e);
      }
    };

    ws.onmessage = async (evt) => {
      if (!isMountedRef.current) return;
      
      let message;
      try { 
        message = JSON.parse(evt.data); 
      } catch (e) { 
        console.warn('[WS] invalid JSON', e); 
        return; 
      }
      
      const { from, type, data, name: peerUserName } = message;
      console.log('[WS] receive', type, 'from', from);

      try {
        switch (type) {
          case 'assign-id':
            setLocalPeerId(message.id);
            break;

          case 'user-list':
            console.log('[WS] received user list:', message.users);
            // We are the newcomer, so we initiate connections to existing users
            for (const u of message.users) {
              createPeerConnection(u.userId, u.userName, true); // true = we are initiator
            }
            break;

          case 'join':
            console.log('[WS] peer joined:', from, peerUserName);
            // Another peer joined, they will initiate connection to us
            createPeerConnection(from, peerUserName, false); // false = we are responder
            break;

          case 'offer': {
            console.log('[WS] offer from', from);
            const pc = peerConnectionsRef.current.get(from) || createPeerConnection(from, peerUserName, false);
            
            try {
              // Check if we already have a local description (meaning we made an offer too)
              if (pc.localDescription && pc.localDescription.type === 'offer') {
                console.log('[WS] glare detected - we also made an offer, being polite and rolling back');
                await pc.setLocalDescription({ type: 'rollback' });
                await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
              }
              
              await pc.setRemoteDescription(new RTCSessionDescription(data));
              console.log(`[WS] set remote description (offer) for ${from}`);

              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              sendToServer({ type: 'answer', to: from, data: answer });
              console.log(`[WS] answered offer to ${from}`);

            } catch (err) {
              console.error('[WS] offer handling failed', err);
              // Send negotiation failed message to trigger retry
              sendToServer({ type: 'negotiation-failed', to: from });
            }
            break;
          }

          case 'answer': {
            console.log('[WS] answer from', from);
            const pc = peerConnectionsRef.current.get(from);
            if (!pc) { 
              console.warn('[WS] answer for unknown pc', from); 
              break; 
            }

            try {
              // Only set remote description if we're in the right state
              if (pc.signalingState === 'have-local-offer') {
                await pc.setRemoteDescription(new RTCSessionDescription(data));
                console.log(`[WS] applied remote answer for ${from}`);
              } else {
                console.warn(`[WS] ignoring answer - wrong signaling state: ${pc.signalingState}`);
                // Queue the answer and try again later
                pendingRemoteDescriptions.current.set(from, data);
                setTimeout(() => {
                  const queuedAnswer = pendingRemoteDescriptions.current.get(from);
                  if (queuedAnswer && pc.signalingState === 'have-local-offer') {
                    pc.setRemoteDescription(new RTCSessionDescription(queuedAnswer))
                      .then(() => pendingRemoteDescriptions.current.delete(from))
                      .catch(err => console.warn('[WS] queued answer apply failed', err));
                  }
                }, 1000);
              }

              // Process any queued ICE candidates
              const queuedCandidates = pendingIceCandidates.current.get(from) || [];
              for (const candidate of queuedCandidates) {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (candidateErr) {
                  console.warn('[WS] queued addIceCandidate failed', candidateErr);
                }
              }
              pendingIceCandidates.current.delete(from);
              
            } catch (err) {
              console.warn('[WS] setRemoteDescription(answer) failed', err);
            }
            break;
          }

          case 'ice-candidate': {
            const pc = peerConnectionsRef.current.get(from);
            if (pc) {
              try {
                if (pc.remoteDescription) {
                  await pc.addIceCandidate(new RTCIceCandidate(data));
                } else {
                  // Queue ICE candidates if remote description isn't set yet
                  if (!pendingIceCandidates.current.has(from)) {
                    pendingIceCandidates.current.set(from, []);
                  }
                  pendingIceCandidates.current.get(from).push(data);
                }
              } catch (err) {
                console.warn('[WS] addIceCandidate failed', err);
              }
            } else {
              console.warn('[WS] ice-candidate for unknown pc', from);
            }
            break;
          }

          case 'media-update': {
            setPeers(prev => {
              const m = new Map(prev);
              const existing = m.get(from) || {};
              m.set(from, { ...existing, ...data });
              return m;
            });
            break;
          }

          case 'leave': {
            console.log('[WS] peer left', from);
            if (pinnedPeerId === from) setPinnedPeerId(null);
            cleanupPeerConnection(from);
            break;
          }

          case 'kicked': {
            const reason = message.reason || 'Removed by host';
            alert(`You were removed from the session. Reason: ${reason}`);
            if (wsRef.current) { wsRef.current.close(); }
            navigate(`/lobby/${roomId}`);
            break;
          }

          case 'negotiation-failed': {
            console.warn('[WS] negotiation failed with', from, 'recreating connection');
            cleanupPeerConnection(from);
            // Retry connection but reverse roles
            const wasInitiator = peerConnectionsRef.current.get(from)?.__isInitiator;
            createPeerConnection(from, peerUserName, !wasInitiator);
            break;
          }

          default:
            console.log('[WS] unknown type', type);
            break;
        }
      } catch (err) {
        console.error('[WS] message handler error', err);
      }
    };

    ws.onclose = (ev) => {
      if (!isMountedRef.current) return;
      console.log('[WS] closed', ev.code, ev.reason);
      setConnectionStatus('disconnected');
      
      // Remove from global tracking
      if (connectionIdRef.current && activeConnections.has(roomId)) {
        const roomConnections = activeConnections.get(roomId);
        roomConnections.delete(connectionIdRef.current);
        if (roomConnections.size === 0) {
          activeConnections.delete(roomId);
        }
      }

      // Attempt reconnection
      if (isMountedRef.current && reconnectAttemptsRef.current < maxReconnectAttempts) {
        reconnectAttemptsRef.current++;
        const delay = Math.min(5000, reconnectAttemptsRef.current * 1000);
        console.log(`[WS] attempting reconnection in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);
        
        setTimeout(() => {
          if (isMountedRef.current && roomId && userName) {
            setupWebSocket();
          }
        }, delay);
      }
    };

    ws.onerror = (err) => {
      if (!isMountedRef.current) return;
      console.error('[WS] ws error', err);
      setConnectionStatus('error');
    };
  }, [roomId, userName, cleanupPeerConnection, sendToServer, createPeerConnection, localPeerId, isScreenSharing, pinnedPeerId, navigate]);

  // WebSocket effect - setup only when needed
  useEffect(() => {
    if (roomId && userName) {
      setConnectionStatus('connecting');
      setupWebSocket();
    }
    
    return () => {
      // Cleanup will be handled by the main unmount effect
    };
  }, [roomId, userName, setupWebSocket]);

  // Acquire local media - ONLY ONCE, with proper initial track state
  useEffect(() => {
    let cancelled = false;
    const initMedia = async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 1280, height: 720 },
          audio: true 
        });
        if (cancelled) {
          s.getTracks().forEach(t => t.stop());
          return;
        }
        
        // Apply saved mic/camera state to tracks immediately
        const audioTracks = s.getAudioTracks();
        const videoTracks = s.getVideoTracks();
        
        audioTracks.forEach(track => {
          track.enabled = isMicOn;
        });
        
        videoTracks.forEach(track => {
          track.enabled = isCameraOn;
        });
        
        cameraStreamRef.current = s;
        setLocalStream(s);
        console.log('[useVideoChat] local media acquired with mic:', isMicOn, 'camera:', isCameraOn);
      } catch (err) {
        console.error('[useVideoChat] getUserMedia failed', err);
        alert('Could not access camera/microphone. Please check permissions.');
      }
    };
    initMedia();
    return () => { cancelled = true; };
  }, []); // Run only once on mount

  // When localStream changes, add tracks to existing PCs
  useEffect(() => {
    const currentStream = isScreenSharing && screenStreamRef.current ? screenStreamRef.current : cameraStreamRef.current;
    if (!currentStream) return;
    
    for (const [peerId, pc] of peerConnectionsRef.current.entries()) {
      try {
        currentStream.getTracks().forEach(track => {
          if (!pc.getSenders().some(snd => snd.track === track)) {
            pc.addTrack(track, currentStream);
            console.log('[useVideoChat] added local track to pc', peerId, track.kind);
          }
        });
      } catch (err) {
        console.warn('[useVideoChat] addTrack to pc failed', err);
      }
    }
  }, [localStream, isScreenSharing]);

  // screen share toggle
  const handleToggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      // Stop screen sharing and revert to camera
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
        screenStreamRef.current = null;
      }
      
      // Switch back to camera stream for local preview
      if (cameraStreamRef.current) {
        setLocalStream(cameraStreamRef.current);
        await replaceVideoTrack(cameraStreamRef.current.getVideoTracks()[0]);
      }
      
      setIsScreenSharing(false);
      sendToServer({ type: 'media-update', data: { isScreenSharing: false } });
      return;
    }

    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({ 
        video: { cursor: 'always' },
        audio: true 
      });
      screenStreamRef.current = screen;
      
      setLocalStream(screen);
      await replaceVideoTrack(screen.getVideoTracks()[0]);
      
      screen.getVideoTracks()[0].onended = () => {
        if (isScreenSharing) {
          handleToggleScreenShare();
        }
      };
      
      setIsScreenSharing(true);
      sendToServer({ type: 'media-update', data: { isScreenSharing: true } });
    } catch (err) {
      console.error('[useVideoChat] getDisplayMedia failed', err);
    }
  }, [isScreenSharing, sendToServer, replaceVideoTrack]);

  // Get the appropriate stream for local display
  const getDisplayStream = useCallback(() => {
    if (isScreenSharing && screenStreamRef.current) {
      return screenStreamRef.current;
    }
    return cameraStreamRef.current;
  }, [isScreenSharing]);

  // mic/camera toggles
  const toggleMic = useCallback(() => {
    const currentStream = isScreenSharing && screenStreamRef.current 
      ? screenStreamRef.current 
      : cameraStreamRef.current;
      
    if (!currentStream) return;
    
    const newState = !isMicOn;
    
    currentStream.getAudioTracks().forEach(t => t.enabled = newState);
    
    try {
      sessionStorage.setItem('codecrew-mic-on', String(newState));
    } catch (e) {}
    
    setIsMicOn(newState);
    
    try {
      sendToServer({ type: 'media-update', data: { isMicOn: newState, isCameraOn } });
    } catch (e) {}
  }, [isMicOn, isCameraOn, sendToServer, isScreenSharing]);

  const toggleCamera = useCallback(() => {
    const currentStream = isScreenSharing && screenStreamRef.current 
      ? screenStreamRef.current 
      : cameraStreamRef.current;
      
    if (!currentStream) return;
    
    const newState = !isCameraOn;
    
    currentStream.getVideoTracks().forEach(t => t.enabled = newState);
    
    try {
      sessionStorage.setItem('codecrew-camera-on', String(newState));
    } catch (e) {}
    
    setIsCameraOn(newState);
    
    try {
      sendToServer({ type: 'media-update', data: { isCameraOn: newState, isMicOn } });
    } catch (e) {}
  }, [isCameraOn, isMicOn, sendToServer, isScreenSharing]);

  const handlePinPeer = useCallback((peerId) => {
    setPinnedPeerId(current => (current === peerId ? null : peerId));
  }, []);

  const handleSelfPin = useCallback(() => {
    if (localPeerId) {
      setPinnedPeerId(current => (current === localPeerId ? null : localPeerId));
    }
  }, [localPeerId]);

  const handleEndCall = useCallback(() => {
    try {
      for (const [peerId, pc] of peerConnectionsRef.current.entries()) {
        try { pc.close(); } catch {}
      }
      peerConnectionsRef.current.clear();
      if (wsRef.current) try { wsRef.current.close(); } catch {}
      if (cameraStreamRef.current) try { cameraStreamRef.current.getTracks().forEach(t => t.stop()); } catch {}
      if (screenStreamRef.current) try { screenStreamRef.current.getTracks().forEach(t => t.stop()); } catch {}
    } catch (err) {
      console.warn('[useVideoChat] handleEndCall cleanup error', err);
    }
    navigate('/');
  }, [navigate]);

  const enablePlayback = useCallback(() => {
    setPlaybackEnabled(true);
  }, []);

  const reconnect = useCallback(() => {
    if (reconnectAttemptsRef.current < maxReconnectAttempts) {
      reconnectAttemptsRef.current = 0;
      setupWebSocket();
    }
  }, [setupWebSocket]);

  return {
    localPeerId,
    localStream: getDisplayStream(),
    peers,
    toggleMic,
    toggleCamera,
    isMicOn,
    isCameraOn,
    handleEndCall,
    isScreenSharing,
    handleToggleScreenShare,
    pinnedPeerId,
    handlePinPeer,
    handleSelfPin,
    isSelfPinned: pinnedPeerId === localPeerId,
    playbackEnabled,
    enablePlayback,
    cameraStream: cameraStreamRef.current,
    screenStream: screenStreamRef.current,
    hasScreenShare: !!screenStreamRef.current,
    hasCamera: !!cameraStreamRef.current,
    getCurrentStream: getDisplayStream,
    connectionStatus,
    reconnect,
    reconnectAttempts: reconnectAttemptsRef.current,
    maxReconnectAttempts
  };
};
