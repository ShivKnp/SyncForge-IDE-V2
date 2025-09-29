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

// Performance tracking
const performanceMetrics = {
  activeConnections: 0,
  bandwidthUsage: 0,
  cpuUsage: 0
};

// Global store to track active connections by roomId
const activeConnections = new Map();

// Video quality profiles
const VIDEO_PROFILES = {
  LOW: { width: 320, height: 240, frameRate: 15, bitrate: 150000 },
  MEDIUM: { width: 640, height: 480, frameRate: 20, bitrate: 500000 },
  HIGH: { width: 1280, height: 720, frameRate: 25, bitrate: 1000000 }
};

export const useVideoChat = (roomId, userName) => {
  const navigate = useNavigate();

  // states
  const [localPeerId, setLocalPeerId] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [peers, setPeers] = useState(new Map());
  const [isMicOn, setIsMicOn] = useState(() => {
    const saved = sessionStorage.getItem('codecrew-mic-on');
    return saved !== null ? saved === 'true' : true;
  });

  const [isCameraOn, setIsCameraOn] = useState(() => {
    const saved = sessionStorage.getItem('codecrew-camera-on');
    return saved !== null ? saved === 'true' : true;
  });
  const [pinnedPeerId, setPinnedPeerId] = useState(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [playbackEnabled, setPlaybackEnabled] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [videoQuality, setVideoQuality] = useState('MEDIUM');

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
  const performanceMonitorRef = useRef(null);
  const mediaInitializedRef = useRef(false);

  // keep ref synchronized with state
  useEffect(() => {
    sessionStorage.setItem('codecrew-mic-on', isMicOn.toString());
  }, [isMicOn]);

  useEffect(() => {
    sessionStorage.setItem('codecrew-camera-on', isCameraOn.toString());
  }, [isCameraOn]);

  useEffect(() => { 
    localStreamRef.current = localStream; 
  }, [localStream]);

  // Performance monitoring
  useEffect(() => {
    if (performanceMonitorRef.current) {
      clearInterval(performanceMonitorRef.current);
    }

    performanceMonitorRef.current = setInterval(() => {
      const activePCs = Array.from(peerConnectionsRef.current.values()).filter(pc => 
        pc.connectionState === 'connected' || pc.connectionState === 'connecting'
      ).length;
      
      performanceMetrics.activeConnections = activePCs;
      
      // Adjust quality based on number of connections
      if (activePCs > 8 && videoQuality !== 'LOW') {
        setVideoQuality('LOW');
        optimizeAllVideoStreams('LOW');
      } else if (activePCs > 4 && videoQuality !== 'MEDIUM') {
        setVideoQuality('MEDIUM');
        optimizeAllVideoStreams('MEDIUM');
      } else if (activePCs <= 4 && videoQuality !== 'HIGH') {
        setVideoQuality('HIGH');
        optimizeAllVideoStreams('HIGH');
      }
    }, 5000);

    return () => {
      if (performanceMonitorRef.current) {
        clearInterval(performanceMonitorRef.current);
      }
    };
  }, [videoQuality]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      
      if (performanceMonitorRef.current) {
        clearInterval(performanceMonitorRef.current);
      }

      // Remove from global tracking
      if (connectionIdRef.current && activeConnections.has(roomId)) {
        const roomConnections = activeConnections.get(roomId);
        roomConnections.delete(connectionIdRef.current);
        if (roomConnections.size === 0) {
          activeConnections.delete(roomId);
        }
      }

      // Cleanup all connections
      cleanupAllConnections();
    };
  }, [roomId]);

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

  const optimizeVideoStream = useCallback(async (stream, profile = videoQuality) => {
    if (!stream) return stream;
    
    const profileConfig = VIDEO_PROFILES[profile] || VIDEO_PROFILES.MEDIUM;
    
    const videoTracks = stream.getVideoTracks();
    for (const track of videoTracks) {
      try {
        await track.applyConstraints({
          width: { ideal: profileConfig.width },
          height: { ideal: profileConfig.height },
          frameRate: { ideal: profileConfig.frameRate }
        });
        
        // Set bandwidth constraints if supported
        const sender = Array.from(peerConnectionsRef.current.values())
          .flatMap(pc => pc.getSenders())
          .find(s => s.track === track);
        
        if (sender && sender.setParameters) {
          const parameters = sender.getParameters();
          if (!parameters.encodings) {
            parameters.encodings = [{}];
          }
          parameters.encodings[0].maxBitrate = profileConfig.bitrate;
          await sender.setParameters(parameters);
        }
      } catch (err) {
        console.warn('Failed to optimize video track:', err);
      }
    }
    
    return stream;
  }, [videoQuality]);

  const optimizeAllVideoStreams = useCallback(async (profile) => {
    // Optimize local stream
    if (cameraStreamRef.current) {
      await optimizeVideoStream(cameraStreamRef.current, profile);
    }
    
    // Optimize screen share if active
    if (screenStreamRef.current) {
      await optimizeVideoStream(screenStreamRef.current, profile);
    }
  }, [optimizeVideoStream]);

  const UI_TO_PROFILE = {
    high: 'HIGH',
    medium: 'MEDIUM',
    low: 'LOW'
  };

  /**
   * Set global video quality (affects local outgoing stream + requests SFU to change subscriptions)
   * uiQuality: 'high' | 'medium' | 'low'
   */
  const setGlobalVideoQuality = useCallback(async (uiQuality = 'medium') => {
    const profileKey = UI_TO_PROFILE[uiQuality] || 'MEDIUM';
    setVideoQuality(profileKey);

    // optimize local outgoing streams to new profile (camera + screen)
    try {
      await optimizeAllVideoStreams(profileKey);
    } catch (err) {
      console.warn('[useVideoChat] optimizeAllVideoStreams failed', err);
    }

    // notify server/SFU to change subscription/resolution for non-pinned tiles
    try {
      sendToServer?.({ type: 'set-quality', data: { scope: 'global', quality: profileKey } });
    } catch (err) {
      console.warn('[useVideoChat] send set-quality(global) failed', err);
    }
  }, [optimizeAllVideoStreams, sendToServer]);

  const setPinnedVideoQuality = useCallback(async (peerId, uiQuality = 'high') => {
    // If no peerId provided, treat as global
    if (!peerId) {
      return setGlobalVideoQuality(uiQuality);
    }

    const profileKey = UI_TO_PROFILE[uiQuality] || 'MEDIUM';

    // If peerId === localPeerId, we are essentially asking ourselves.
    // Apply local optimization immediately rather than asking the network to change us.
    if (peerId === localPeerId) {
      console.log('[useVideoChat] setPinnedVideoQuality for local peer — applying locally');
      try {
        await optimizeAllVideoStreams(profileKey);
        setVideoQuality(profileKey);
        // send ack to server for UI feedback if you like
        sendToServer({ type: 'set-quality-done', data: { success: true, quality: profileKey } });
      } catch (err) {
        console.warn('[useVideoChat] local setPinnedVideoQuality failed', err);
        sendToServer({ type: 'set-quality-done', data: { success: false, quality: profileKey } });
      }
      return;
    }

    // Normal path: request the publisher (peerId) to change their outgoing encoding for us only
    try {
      sendToServer?.({ type: 'set-quality', to: peerId, data: { scope: 'pinned', quality: profileKey } });
      // optionally wait for set-quality-done ack from publisher
    } catch (err) {
      console.warn('[useVideoChat] send set-quality(pinned) failed', err);
    }
  }, [localPeerId, optimizeAllVideoStreams, sendToServer]);

  // Ensure all non-pinned peers use LOW; request HIGH for pinned
  const enforceUnpinnedLow = useCallback(async () => {
    try {
      const peersIds = Array.from(peerConnectionsRef.current.keys());
      for (const pid of peersIds) {
        // if we're the publisher and someone requests different quality for us,
        // they'll send a request we already handle in 'set-quality-request' branch.
        if (pid === pinnedPeerId) {
          // ask the publisher (the pinned peer) to send better quality to us
          // (if publisher is remote). If pinned is local, we'll adjust our capture locally.
          if (pid !== localPeerId) {
            sendToServer?.({ type: 'set-quality', to: pid, data: { scope: 'pinned', quality: 'HIGH' } });
            // also send the request variant — server may forward it differently
            sendToServer?.({ type: 'set-quality-request', to: pid, data: { quality: 'HIGH' } });
          } else {
            // we are pinned to ourselves: bump our local capture for pinned experience
            try { await optimizeAllVideoStreams('HIGH'); setVideoQuality('HIGH'); } catch (e) { console.warn(e); }
          }
        } else {
          // force unpinned connections to low (subscriber side asks publisher to lower outgoing resolution)
          sendToServer?.({ type: 'set-quality', to: pid, data: { scope: 'subscriber', quality: 'LOW' } });
          sendToServer?.({ type: 'set-quality-request', to: pid, data: { quality: 'LOW' } });
        }
      }
    } catch (err) {
      console.warn('[useVideoChat] enforceUnpinnedLow error', err);
    }
  }, [pinnedPeerId, localPeerId, optimizeAllVideoStreams, sendToServer]);

  // --- add this near the other useEffects in useVideoChat ---
  useEffect(() => {
    // Listen for UI-driven global/pinned quality requests using CustomEvent
    const onSetGlobal = (ev) => {
      try {
        const uiQuality = ev?.detail?.quality || ev?.detail; // 'high'|'medium'|'low'
        if (!uiQuality) return;
        console.debug('[useVideoChat:event] set-global-quality', uiQuality);
        setGlobalVideoQuality(uiQuality);
      } catch (err) {
        console.warn('[useVideoChat] set-global-quality handler error', err);
      }
    };

    const onSetPinned = (ev) => {
      try {
        const uiQuality = ev?.detail?.quality || ev?.detail;
        const peerId = ev?.detail?.peerId || ev?.detail?.to; // optional
        if (!uiQuality) return;
        console.debug('[useVideoChat:event] set-pinned-quality', { uiQuality, peerId });
        if (peerId) {
          // request pinned quality change for a specific peer
          setPinnedVideoQuality(peerId, uiQuality);
        } else {
          // if no peer provided, try to apply to pinnedPeerId
          if (pinnedPeerId) setPinnedVideoQuality(pinnedPeerId, uiQuality);
        }
      } catch (err) {
        console.warn('[useVideoChat] set-pinned-quality handler error', err);
      }
    };

    window.addEventListener('set-global-quality', onSetGlobal);
    window.addEventListener('set-pinned-quality', onSetPinned);

    return () => {
      window.removeEventListener('set-global-quality', onSetGlobal);
      window.removeEventListener('set-pinned-quality', onSetPinned);
    };
  }, [setGlobalVideoQuality, setPinnedVideoQuality, pinnedPeerId]);

  const cleanupAllConnections = useCallback(() => {
    if (wsRef.current) {
      try { 
        wsRef.current.onclose = null;
        wsRef.current.close(); 
      } catch (e) {}
      wsRef.current = null;
    }
    
    for (const [peerId, pc] of peerConnectionsRef.current.entries()) {
      cleanupPeerConnection(peerId);
    }
    
    if (cameraStreamRef.current) {
      try { cameraStreamRef.current.getTracks().forEach(t => t.stop()); } catch (e) {}
    }
    if (screenStreamRef.current) {
      try { screenStreamRef.current.getTracks().forEach(t => t.stop()); } catch (e) {}
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

  // Helper to replace audio track
  const replaceAudioTrack = useCallback(async (newTrack) => {
    for (const [peerId, pc] of peerConnectionsRef.current.entries()) {
      const sender = pc.getSenders().find(s => s.track?.kind === 'audio');
      if (sender && newTrack) {
        try {
          await sender.replaceTrack(newTrack);
          console.log(`[useVideoChat] replaced audio track for peer ${peerId}`);
        } catch (err) {
          console.warn('replaceAudioTrack failed', err);
        }
      }
    }
  }, []);

  // FIXED: Initialize media with proper state handling
  const initializeMedia = useCallback(async (forceVideoOn = false, forceAudioOn = false) => {
    try {
      console.log('[useVideoChat] initializeMedia called with', { forceVideoOn, forceAudioOn, isCameraOn, isMicOn });
      
      // Determine what media we need
      const needsVideo = forceVideoOn || isCameraOn;
      const needsAudio = forceAudioOn || isMicOn;
      
      const profile = VIDEO_PROFILES[videoQuality];
      const constraints = { 
        video: needsVideo ? { 
          width: { ideal: profile.width },
          height: { ideal: profile.height },
          frameRate: { ideal: profile.frameRate }
        } : false,
        audio: needsAudio
      };
      
      console.log('[useVideoChat] getUserMedia constraints:', constraints);
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (!isMountedRef.current) {
        stream.getTracks().forEach(t => t.stop());
        return null;
      }
      
      // Set track enabled states based on current toggle states
      stream.getAudioTracks().forEach(track => {
        track.enabled = isMicOn;
        console.log(`[useVideoChat] Audio track enabled: ${track.enabled} (state: ${isMicOn})`);
      });
      
      stream.getVideoTracks().forEach(track => {
        track.enabled = isCameraOn;
        console.log(`[useVideoChat] Video track enabled: ${track.enabled} (state: ${isCameraOn})`);
      });
      
      cameraStreamRef.current = stream;
      setLocalStream(stream);
      mediaInitializedRef.current = true;
      
      return stream;
      
    } catch (err) {
      console.error('[useVideoChat] initializeMedia failed', err);
      // Try with just audio if video fails
      if (constraints.video && constraints.audio) {
        try {
          console.log('[useVideoChat] Retrying with audio only');
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          
          audioStream.getAudioTracks().forEach(track => {
            track.enabled = isMicOn;
          });
          
          cameraStreamRef.current = audioStream;
          setLocalStream(audioStream);
          mediaInitializedRef.current = true;
          setIsCameraOn(false); // Update state to reflect reality
          
          return audioStream;
        } catch (audioErr) {
          console.error('[useVideoChat] Audio-only fallback also failed', audioErr);
        }
      }
      
      // If all else fails, update states to reflect reality
      setIsMicOn(false);
      setIsCameraOn(false);
      mediaInitializedRef.current = true;
      return null;
    }
  }, [videoQuality, isMicOn, isCameraOn]);

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

    // Configure bandwidth limits
    const configureBandwidth = () => {
      try {
        const senders = pc.getSenders();
        senders.forEach(sender => {
          if (sender.track?.kind === 'video') {
            const parameters = sender.getParameters();
            if (!parameters.encodings) {
              parameters.encodings = [{}];
            }
            parameters.encodings[0].maxBitrate = VIDEO_PROFILES[videoQuality].bitrate;
            sender.setParameters(parameters).catch(console.warn);
          }
        });
      } catch (err) {
        console.warn('Bandwidth configuration failed:', err);
      }
    };

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
        configureBandwidth();
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
        configureBandwidth();
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
              configureBandwidth();
              sendToServer({ type: 'offer', to: peerId, data: offer });
            });
          }
        } catch (restartErr) {
          console.warn('[PC] ICE restart failed', restartErr);
        }
      }
    };

    // Add tracks immediately if stream exists
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
  }, [sendToServer, isScreenSharing, videoQuality]);

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

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const backendHost = window.location.hostname === 'localhost' ? 'localhost:8080' : 'syncforge-ide.onrender.com';
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
        ws.send(JSON.stringify({ type: 'media-update', data: { audio: isMicOn, video: isCameraOn } }));
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
            // Limit simultaneous connection attempts
            const usersToConnect = message.users.slice(0, 8); // Max 8 simultaneous connections
            for (const u of usersToConnect) {
              createPeerConnection(u.userId, u.userName, true);
            }
            break;

          case 'join':
            console.log('[WS] peer joined:', from, peerUserName);
            // Limit total connections
            if (peerConnectionsRef.current.size < 12) {
              createPeerConnection(from, peerUserName, false);
            } else {
              console.warn('[WS] connection limit reached, ignoring new peer');
            }
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

          // inside ws.onmessage switch(type) { ... add:

          case 'set-quality-request': {
            try {
              const requesterId = from; // the peer who asked for a change
              const qualityKey = (message.data && message.data.quality) || 'MEDIUM';
              console.log('[useVideoChat] received set-quality-request from', requesterId, '->', qualityKey);

              const pc = peerConnectionsRef.current.get(requesterId);

              // Preferred: adjust the RTP sender parameters that send video to requester
              let adjusted = false;
              if (pc) {
                const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
                if (sender && typeof sender.getParameters === 'function' && typeof sender.setParameters === 'function') {
                  const profile = VIDEO_PROFILES[qualityKey] || VIDEO_PROFILES.MEDIUM;
                  try {
                    const params = sender.getParameters() || {};
                    if (!params.encodings) params.encodings = [{}];
                    params.encodings[0].maxBitrate = profile.bitrate;
                    // optional: set scaleResolutionDownBy if supported: params.encodings[0].scaleResolutionDownBy = ...
                    sender.setParameters(params).then(() => {
                      console.log(`[useVideoChat] adjusted sender parameters for ${requesterId} -> ${qualityKey} (${profile.bitrate})`);
                    }).catch(err => {
                      console.warn('[useVideoChat] sender.setParameters failed', err);
                    });
                    adjusted = true;
                  } catch (err) {
                    console.warn('[useVideoChat] setParameters thrown', err);
                  }
                }
              }

              // Fallback: try to lower our capture constraints (reduces outgoing bandwidth for everyone)
              if (!adjusted && cameraStreamRef.current) {
                const profile = VIDEO_PROFILES[qualityKey] || VIDEO_PROFILES.MEDIUM;
                try {
                  const vTracks = cameraStreamRef.current.getVideoTracks();
                  for (const t of vTracks) {
                    if (typeof t.applyConstraints === 'function') {
                      await t.applyConstraints({
                        width: { ideal: profile.width },
                        height: { ideal: profile.height },
                        frameRate: { ideal: profile.frameRate }
                      });
                    }
                  }
                  console.log('[useVideoChat] applied fallback capture constraints for quality', qualityKey);
                  adjusted = true;
                } catch (err) {
                  console.warn('[useVideoChat] applyConstraints fallback failed', err);
                }
              }

              // If still not adjusted, try to replace senders with lower-resolution track (best-effort)
              if (!adjusted && cameraStreamRef.current) {
                try {
                  // Try getUserMedia with lower constraints and replaceTrack
                  const profile = VIDEO_PROFILES[qualityKey] || VIDEO_PROFILES.MEDIUM;
                  const low = await navigator.mediaDevices.getUserMedia({
                    video: { width: { ideal: profile.width }, height: { ideal: profile.height }, frameRate: { ideal: profile.frameRate } },
                    audio: false
                  });
                  const lowTrack = low.getVideoTracks()[0];
                  if (lowTrack) {
                    for (const [peerId, pcItem] of peerConnectionsRef.current.entries()) {
                      const sender = pcItem.getSenders().find(s => s.track && s.track.kind === 'video');
                      if (sender) {
                        try { await sender.replaceTrack(lowTrack); } catch (replaceErr) { console.warn('replaceTrack fallback failed', replaceErr); }
                      }
                    }
                  }
                  // stop low track after use (we only used to replace for a moment)
                  setTimeout(() => {
                    try { low.getTracks().forEach(t => t.stop()); } catch (e) {}
                  }, 1000);
                  adjusted = true;
                } catch (err) {
                  console.warn('[useVideoChat] replaceTrack fallback failed', err);
                }
              }

              // Optionally notify the requester that we've adjusted (so their UI can show done)
              try {
                sendToServer({ type: 'set-quality-done', to: requesterId, data: { success: !!adjusted, quality: qualityKey }});
              } catch (e) { /* ignore */ }

            } catch (err) {
              console.warn('[useVideoChat] set-quality-request handling error', err);
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
  }, [roomId, userName, cleanupPeerConnection, sendToServer, createPeerConnection, localPeerId, isScreenSharing, pinnedPeerId, navigate, isMicOn, isCameraOn]);

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

  // FIXED: Media acquisition with proper initialization
  useEffect(() => {
    let cancelled = false;
    
    const initMedia = async () => {
      if (mediaInitializedRef.current) {
        console.log('[useVideoChat] Media already initialized, skipping');
        return;
      }
      
      console.log('[useVideoChat] Initializing media...', { isMicOn, isCameraOn });
      
      try {
        const stream = await initializeMedia();
        
        if (cancelled || !stream) {
          return;
        }
        
        // Add tracks to existing peer connections
        for (const [peerId, pc] of peerConnectionsRef.current.entries()) {
          try {
            stream.getTracks().forEach(track => {
              if (!pc.getSenders().some(snd => snd.track === track)) {
                pc.addTrack(track, stream);
                console.log(`[useVideoChat] Added ${track.kind} track to existing peer ${peerId}`);
              }
            });
          } catch (err) {
            console.warn('[useVideoChat] Failed to add track to existing peer', peerId, err);
          }
        }
        
      } catch (err) {
        console.error('[useVideoChat] Media initialization failed', err);
      }
    };
    
    // Only initialize once when component mounts
    if (!mediaInitializedRef.current) {
      initMedia();
    }
    
    return () => { 
      cancelled = true; 
    };
  }, []); // Empty dependency array - only run once

  // When localStream changes, add tracks to existing PCs
  useEffect(() => {
    if (!localStream || !mediaInitializedRef.current) return;
    
    console.log('[useVideoChat] Local stream changed, updating peer connections');
    
    const currentStream = isScreenSharing && screenStreamRef.current ? screenStreamRef.current : cameraStreamRef.current;
    if (!currentStream) return;
    
    // Update track enabled states based on current settings
    currentStream.getAudioTracks().forEach(track => {
      try { 
        track.enabled = isMicOn;
        console.log(`[useVideoChat] Set audio track enabled: ${track.enabled}`);
      } catch (e) {}
    });
    currentStream.getVideoTracks().forEach(track => {
      try { 
        track.enabled = isCameraOn;
        console.log(`[useVideoChat] Set video track enabled: ${track.enabled}`);
      } catch (e) {}
    });
    
    for (const [peerId, pc] of peerConnectionsRef.current.entries()) {
      try {
        currentStream.getTracks().forEach(track => {
          if (!pc.getSenders().some(snd => snd.track === track)) {
            pc.addTrack(track, currentStream);
            console.log(`[useVideoChat] Added ${track.kind} track to peer ${peerId}`);
          }
        });
      } catch (err) {
        console.warn('[useVideoChat] addTrack to pc failed', err);
      }
    }
  }, [localStream, isScreenSharing, isMicOn, isCameraOn]);

  // Adaptive pinned quality: measure inbound bitrate to decide HIGH/LOW for pinned
  useEffect(() => {
    let iv = null;
    let lastBytes = 0;
    let lastTs = 0;

    const samplePinned = async () => {
      try {
        if (!pinnedPeerId) return;
        const pc = peerConnectionsRef.current.get(pinnedPeerId);
        if (!pc || typeof pc.getStats !== 'function') {
          // No direct pc (maybe not connected yet) - still enforce unpinned low
          await enforceUnpinnedLow();
          return;
        }

        const stats = await pc.getStats();
        // find inbound-rtp for video
        let inbound;
        stats.forEach(report => {
          if (report.type === 'inbound-rtp' && (report.kind === 'video' || report.mediaType === 'video')) {
            inbound = report;
          }
        });

        if (!inbound) {
          // nothing to measure yet
          await enforceUnpinnedLow();
          return;
        }

        const nowTs = inbound.timestamp || Date.now();
        const nowBytes = inbound.bytesReceived || inbound.bytes || 0;

        if (lastTs && nowTs > lastTs) {
          const deltaBytes = nowBytes - lastBytes;
          const deltaSec = (nowTs - lastTs) / 1000;
          const bps = deltaSec > 0 ? (deltaBytes * 8) / deltaSec : 0; // bits per second

          // thresholds (tunable): if inbound to pinned > 200kbps => HIGH, else LOW
          const THRESH_HIGH = 200 * 1000; // 200 kbps
          const desired = bps >= THRESH_HIGH ? 'HIGH' : 'LOW';

          // Request publisher to change encoding for this subscriber (us)
          if (pinnedPeerId === localPeerId) {
            // we pinned ourselves — ensure our outgoing capture quality is adjusted
            if (desired === 'HIGH') {
              await optimizeAllVideoStreams('HIGH');
              setVideoQuality('HIGH');
            } else {
              await optimizeAllVideoStreams('LOW');
              setVideoQuality('LOW');
            }
          } else {
            // ask the remote publisher to change for our subscription
            sendToServer?.({ type: 'set-quality', to: pinnedPeerId, data: { scope: 'pinned', quality: desired } });
            sendToServer?.({ type: 'set-quality-request', to: pinnedPeerId, data: { quality: desired } });
          }

          // Always keep all others on LOW
          await enforceUnpinnedLow();
        }

        lastTs = nowTs;
        lastBytes = nowBytes;
      } catch (err) {
        console.warn('[useVideoChat] samplePinned error', err);
      }
    };

    // start sampling at a modest interval
    iv = setInterval(samplePinned, 3000);
    // run one immediately
    samplePinned();

    return () => {
      if (iv) clearInterval(iv);
    };
  }, [pinnedPeerId, localPeerId, enforceUnpinnedLow, optimizeAllVideoStreams, sendToServer]);

  // Whenever connections change or pinned changes, enforce unpinned low quality
  useEffect(() => {
    // short debounce to avoid spamming on quick connect churn
    const t = setTimeout(() => {
      enforceUnpinnedLow();
    }, 200);
    return () => clearTimeout(t);
  }, [Array.from(peerConnectionsRef.current.keys()).length, pinnedPeerId, enforceUnpinnedLow]);

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

  // FIXED: Toggle functions that handle media acquisition properly
  const toggleMic = useCallback(async () => {
    console.log('[useVideoChat] toggleMic called, current state:', isMicOn);
    
    const newState = !isMicOn;
    setIsMicOn(newState);
    
    // If we don't have a stream or need to enable audio, get media
    if (!cameraStreamRef.current || (newState && !cameraStreamRef.current.getAudioTracks().length)) {
      console.log('[useVideoChat] Need to acquire media for mic toggle');
      try {
        const stream = await initializeMedia(isCameraOn, newState);
        if (stream) {
          // Replace audio track for all peers
          const audioTrack = stream.getAudioTracks()[0];
          if (audioTrack) {
            await replaceAudioTrack(audioTrack);
          }
          
          // Send media update
          sendToServer({ type: 'media-update', data: { isMicOn: newState, isCameraOn } });
        }
      } catch (err) {
        console.error('[useVideoChat] Failed to acquire media for mic toggle', err);
        // Revert state if acquisition failed
        setIsMicOn(!newState);
        return;
      }
    } else {
      // We have a stream, just toggle the track
      cameraStreamRef.current.getAudioTracks().forEach(track => {
        try { 
          track.enabled = newState;
          console.log(`[useVideoChat] Set audio track enabled: ${track.enabled}`);
        } catch (e) {}
      });
      
      sendToServer({ type: 'media-update', data: { isMicOn: newState, isCameraOn } });
    }
  }, [isMicOn, isCameraOn, sendToServer, initializeMedia, replaceAudioTrack]);

  const toggleCamera = useCallback(async () => {
    console.log('[useVideoChat] toggleCamera called, current state:', isCameraOn);
    
    const newState = !isCameraOn;
    setIsCameraOn(newState);
    
    // If we don't have a stream or need to enable video, get media
    if (!cameraStreamRef.current || (newState && !cameraStreamRef.current.getVideoTracks().length)) {
      console.log('[useVideoChat] Need to acquire media for camera toggle');
      try {
        const stream = await initializeMedia(newState, isMicOn);
        if (stream) {
          // Replace video track for all peers
          const videoTrack = stream.getVideoTracks()[0];
          if (videoTrack) {
            await replaceVideoTrack(videoTrack);
          }
          
          // Send media update
          sendToServer({ type: 'media-update', data: { isCameraOn: newState, isMicOn } });
        }
      } catch (err) {
        console.error('[useVideoChat] Failed to acquire media for camera toggle', err);
        // Revert state if acquisition failed
        setIsCameraOn(!newState);
        return;
      }
    } else {
      // We have a stream, just toggle the track
      cameraStreamRef.current.getVideoTracks().forEach(track => {
        try { 
          track.enabled = newState;
          console.log(`[useVideoChat] Set video track enabled: ${track.enabled}`);
        } catch (e) {}
      });
      
      sendToServer({ type: 'media-update', data: { isCameraOn: newState, isMicOn } });
    }
  }, [isCameraOn, isMicOn, sendToServer, initializeMedia, replaceVideoTrack]);

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
    maxReconnectAttempts,
    videoQuality,
    setVideoQuality,
    performanceMetrics,
    setGlobalVideoQuality,
    setPinnedVideoQuality
  };
};