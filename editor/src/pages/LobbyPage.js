// Enhanced LobbyPage.js - Matching design aesthetic with improved compact layout
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Input, Button, Spin, notification, Switch } from 'antd';
import { 
  FaVideo, 
  FaVideoSlash, 
  FaMicrophone, 
  FaMicrophoneSlash, 
  FaLink,
  FaCode,
  FaGlobe,
  FaUserEdit,
  FaUserFriends,
  FaCog,
  FaRocket,
  FaUsers
} from 'react-icons/fa';

const SERVER_URL = process.env.REACT_APP_SERVER_URL || 'http://localhost:8080';

const LobbyPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const videoRef = useRef();

  // user & room
  const [userName, setUserName] = useState(sessionStorage.getItem('codecrew-username') || '');
  const [projectLanguage, setProjectLanguage] = useState(sessionStorage.getItem('codecrew-project-language') || 'cpp');
  const [roomMode, setRoomMode] = useState(sessionStorage.getItem('codecrew-room-mode') || 'project');

  // creator flags / toggles
  const [isRoomCreator, setIsRoomCreator] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [enableHostNotes, setEnableHostNotes] = useState(true);

  // Media / preview
  const [isMicOn, setIsMicOn] = useState(() => {
    const saved = sessionStorage.getItem('codecrew-mic-on');
    return saved !== null ? saved === 'true' : true;
  });

  const [isCameraOn, setIsCameraOn] = useState(() => {
    const saved = sessionStorage.getItem('codecrew-camera-on');
    return saved !== null ? saved === 'true' : true;
  });

  const [localStream, setLocalStream] = useState(null);
  const localStreamRef = useRef(null);

  // Config toggles (creator)
  const [enableVideo, setEnableVideo] = useState(true);
  const [multiFile, setMultiFile] = useState(true);
  const [sharedInputOutput, setSharedInputOutput] = useState(true);
  const [enableChat, setEnableChat] = useState(true);
  const [allowRun, setAllowRun] = useState(true);
  const [hostOnlyEditing, setHostOnlyEditing] = useState(false);
  const [enableAI, setEnableAI] = useState(true);

  // Language options
  const languages = [
    { id: 'cpp', name: 'C++', icon: <FaCode className="text-blue-400" /> },
    { id: 'java', name: 'Java', icon: <FaCode className="text-red-400" /> },
    { id: 'python', name: 'Python', icon: <FaCode className="text-yellow-400" /> },
  ];

  // Fetch session details once on mount to see if session is new / already initialized
  useEffect(() => {
    let mounted = true;
    const fetchSessionDetails = async () => {
      setIsLoading(true);
      try {
        const res = await axios.get(`${SERVER_URL}/session/${id}/details`, { timeout: 5000 });
        if (!mounted) return;
        if (res.data && res.data.isNew === false) {
          setIsRoomCreator(false);
          setRoomMode(res.data.roomMode || 'project');
          setProjectLanguage(res.data.projectLanguage || 'cpp');
          // apply config if present
          const cfg = res.data.config || {};
          setEnableVideo(cfg.enableVideo !== undefined ? cfg.enableVideo : true);
          setMultiFile(cfg.multiFile !== undefined ? cfg.multiFile : true);
          setSharedInputOutput(cfg.sharedInputOutput !== undefined ? cfg.sharedInputOutput : (res.data.roomMode === 'project'));
          setEnableChat(cfg.enableChat !== undefined ? cfg.enableChat : true);
          setAllowRun(cfg.allowRun !== undefined ? cfg.allowRun : true);
          setEnableAI(cfg.enableAI !== undefined ? cfg.enableAI : true);
          setEnableHostNotes(cfg.enableHostNotes !== undefined ? cfg.enableHostNotes : true);
          setHostOnlyEditing(cfg.editing === 'host-only');
        } else {
          setIsRoomCreator(true);
          // defaults for creator
          setEnableVideo(true);
          setMultiFile(true);
          setSharedInputOutput(true);
          setEnableChat(true);
          setAllowRun(true);
          setHostOnlyEditing(false);
          setEnableAI(true);
        }
      } catch (error) {
        console.warn('[Lobby] fetching session details failed:', error?.message || error);
        if (mounted) {
          setIsRoomCreator(true);
          setEnableVideo(true);
          setMultiFile(true);
          setSharedInputOutput(true);
          setEnableChat(true);
          setAllowRun(true);
          setHostOnlyEditing(false);
          setEnableAI(true);
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    fetchSessionDetails();
    return () => { mounted = false; };
  }, [id]);

  // Acquire media preview (safe pattern using ref)
  useEffect(() => {
    let mounted = true;
    const getMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (!mounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        localStreamRef.current = stream;
        setLocalStream(stream);
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        console.error('Error accessing media devices.', err);
        // reflect reality in UI
        setEnableVideo(false);
        setIsCameraOn(false);
      }
    };
    getMedia();

    return () => {
      mounted = false;
      try {
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(track => track.stop());
        }
      } catch (e) { /* ignore */ }
      localStreamRef.current = null;
      if (videoRef.current) {
        try { videoRef.current.srcObject = null; } catch (e) {}
      }
    };
  }, [id]);

  const toggleMic = () => {
    const stream = localStreamRef.current;
    if (!stream) {
      setIsMicOn(false);
      return;
    }
    const audioTracks = stream.getAudioTracks();
    const currentlyOn = audioTracks.length > 0 ? audioTracks[0].enabled : isMicOn;
    const newState = !currentlyOn;
    audioTracks.forEach(track => { 
      try { track.enabled = newState; } catch (e) {} 
    });
    setIsMicOn(newState);
    sessionStorage.setItem('codecrew-mic-on', newState.toString());
  };

  const toggleCamera = () => {
    const stream = localStreamRef.current;
    if (!stream) {
      setIsCameraOn(false);
      return;
    }
    const videoTracks = stream.getVideoTracks();
    const currentlyOn = videoTracks.length > 0 ? videoTracks[0].enabled : isCameraOn;
    const newState = !currentlyOn;
    videoTracks.forEach(track => { 
      try { track.enabled = newState; } catch (e) {} 
    });
    setIsCameraOn(newState);
    sessionStorage.setItem('codecrew-camera-on', newState.toString());
  };

  const handleJoin = async () => {
    if (!userName.trim()) {
      notification.warning({ message: 'Name Required' });
      return;
    }
    // Save current media state
    sessionStorage.setItem('codecrew-mic-on', isMicOn.toString());
    sessionStorage.setItem('codecrew-camera-on', isCameraOn.toString());

    if (isLoading) {
      notification.info({ message: 'Checking session... please wait' });
      return;
    }

    try {
      if (isRoomCreator) {
        // build config from creator toggles
        const config = {
          roomMode,
          projectLanguage,
          multiFile,
          enableVideo,
          sharedInputOutput,
          enableChat,
          allowRun,
          editing: hostOnlyEditing ? 'host-only' : 'open',
          ownerName: userName,
          enableAI,
          enableHostNotes
        };
        await axios.post(`${SERVER_URL}/session`, { id, config });
      }
    } catch (err) {
      console.warn('Failed to initialize session on server (continuing to join):', err?.response?.data || err?.message || err);
      notification.warning({ message: 'Session initialization may have failed; attempting to join anyway.' });
    }

    // Save local preferences
    sessionStorage.setItem('codecrew-username', userName);
    sessionStorage.setItem('codecrew-project-language', projectLanguage);
    sessionStorage.setItem('codecrew-room-mode', roomMode);
    sessionStorage.setItem('codecrew-mic-on', isMicOn);
    sessionStorage.setItem('codecrew-camera-on', isCameraOn);
    sessionStorage.setItem('codecrew-enable-host-notes', enableHostNotes.toString());

    // stop preview stream then navigate
    try {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
    } catch (e) { /* ignore */ }

    navigate(`/editor/${id}`);
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/lobby/${id}`;
    navigator.clipboard.writeText(url);
    notification.success({ message: 'Link Copied!' });
  };

  if (isLoading) {
    return (
      <>
        <div className="loading-container animate-slideInUp">
          <div className="loading-content">
            <div className="loading-spinner">
              <Spin size="large" />
            </div>
            <p className="loading-text">Loading session...</p>
          </div>
        </div>

        <style jsx>{`
          @keyframes slideInUp {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          .animate-slideInUp {
            animation: slideInUp 0.6s cubic-bezier(0.4, 0, 0.2, 1);
          }

          .loading-container {
            min-height: 100vh;
            background: linear-gradient(180deg, #0a1628 0%, #0f172a 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
          }

          .loading-content {
            text-align: center;
            color: #e2e8f0;
          }

          .loading-spinner {
            margin-bottom: 16px;
          }

          .loading-text {
            font-size: 14px;
            color: #94a3b8;
          }

          :global(.ant-spin-dot-item) {
            background-color: #0ea5a4 !important;
          }
        `}</style>
      </>
    );
  }

  return (
    <>
      <div className="lobby-container animate-slideInUp">
        {/* Header */}
        <header className="lobby-header">
          <div className="status-badge">
            <span className="status-indicator">Live</span>
            <span className="status-text">Real-time collaborative coding session</span>
          </div>
          <h1 className="main-title">
            Join <span className="brand-text">SyncForge</span> Session
          </h1>
          <p className="subtitle">
            {isRoomCreator ? 'Configure your session before joining' : 'Join the collaborative coding session'}
          </p>
        </header>

        <div className="content-grid">
          {/* Left: Video Preview */}
          <div className="video-panel animate-fadeInUp">
            <div className="video-header">
              <div className="window-controls">
                <div className="control-dot red"></div>
                <div className="control-dot yellow"></div>
                <div className="control-dot green"></div>
                <span className="window-title">Camera Preview</span>
              </div>
              <div className="media-controls">
                <button
                  onClick={toggleMic}
                  className={`media-button ${isMicOn ? 'active' : 'disabled'}`}
                >
                  {isMicOn ? <FaMicrophone /> : <FaMicrophoneSlash />}
                </button>
                <button
                  onClick={toggleCamera}
                  className={`media-button ${isCameraOn ? 'active' : 'disabled'}`}
                >
                  {isCameraOn ? <FaVideo /> : <FaVideoSlash />}
                </button>
              </div>
            </div>
            
            <div className="video-content">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="video-element"
              />
              {!isCameraOn && (
                <div className="video-disabled">
                  <div className="disabled-content">
                    <FaVideoSlash className="disabled-icon" />
                    <p className="disabled-text">Camera is off</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Configuration */}
          <div className="config-panel animate-fadeInUp">
            <div className="config-header">
              <div className="config-icon-container">
                {isRoomCreator ? (
                  <FaUserEdit className="config-icon" />
                ) : (
                  <FaUsers className="config-icon" />
                )}
              </div>
              <h2 className="config-title">
                {isRoomCreator ? 'Session Configuration' : 'Join Session'}
              </h2>
            </div>

            <div className="config-content">
              {/* Name Input */}
              <div className="input-group">
                <label htmlFor="userNameInput" className="input-label">
                  Your Name
                </label>
                <Input
                  id="userNameInput"
                  placeholder="Enter your name"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  onPressEnter={handleJoin}
                  className="custom-input"
                />
              </div>

              {/* Session Mode */}
              <div className="input-group">
                <label className="input-label">Session Mode</label>
                <div className="mode-grid">
                  <button
                    onClick={() => setRoomMode('project')}
                    className={`mode-button ${roomMode === 'project' ? 'active' : ''}`}
                    data-mode="project"
                  >
                    <FaCode className="mode-icon" />
                    <span className="mode-label">Project</span>
                  </button>
                  <button
                    onClick={() => setRoomMode('polyglot')}
                    className={`mode-button ${roomMode === 'polyglot' ? 'active' : ''}`}
                    data-mode="polyglot"
                  >
                    <FaGlobe className="mode-icon" />
                    <span className="mode-label">Playground</span>
                  </button>
                </div>
              </div>

              {/* Language Selection */}
              {roomMode === 'project' && (
                <div className="input-group">
                  <label className="input-label">Project Language</label>
                  <div className="language-grid">
                    {languages.map((lang) => (
                      <button
                        key={lang.id}
                        onClick={() => setProjectLanguage(lang.id)}
                        className={`language-button ${projectLanguage === lang.id ? 'active' : ''}`}
                      >
                        {lang.icon}
                        <span className="language-label">{lang.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Creator Settings */}
              {isRoomCreator && (
                <div className="settings-section">
                  <div className="settings-header">
                    <FaCog className="settings-icon" />
                    <h3 className="settings-title">Session Settings</h3>
                  </div>
                  <div className="settings-grid">
                    <div className="setting-item">
                      <span className="setting-label">Video Chat</span>
                      <Switch 
                        checked={enableVideo} 
                        onChange={setEnableVideo}
                        className="custom-switch"
                      />
                    </div>

                    <div className="setting-item">
                      <span className="setting-label">Multi-file</span>
                      <Switch 
                        checked={multiFile} 
                        onChange={setMultiFile}
                        className="custom-switch"
                      />
                    </div>

                    <div className="setting-item">
                      <span className="setting-label">Shared I/O</span>
                      <Switch 
                        checked={sharedInputOutput} 
                        onChange={setSharedInputOutput}
                        className="custom-switch"
                      />
                    </div>

                    <div className="setting-item">
                      <span className="setting-label">Chat</span>
                      <Switch 
                        checked={enableChat} 
                        onChange={setEnableChat}
                        className="custom-switch"
                      />
                    </div>

                    <div className="setting-item">
                      <span className="setting-label">AI Assistant</span>
                      <Switch 
                        checked={enableAI} 
                        onChange={setEnableAI}
                        className="custom-switch"
                      />
                    </div>

                    <div className="setting-item">
                      <span className="setting-label">Host Notes</span>
                      <Switch 
                        checked={enableHostNotes} 
                        onChange={setEnableHostNotes}
                        className="custom-switch"
                      />
                    </div>

                    <div className="setting-item">
                      <span className="setting-label">Code Runner</span>
                      <Switch 
                        checked={allowRun} 
                        onChange={setAllowRun}
                        className="custom-switch"
                      />
                    </div>

                    <div className="setting-item">
                      <span className="setting-label">Host Edit Only</span>
                      <Switch 
                        checked={hostOnlyEditing} 
                        onChange={setHostOnlyEditing}
                        className="custom-switch"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="action-section">
                <button
                  onClick={handleJoin}
                  className="join-button group"
                >
                  <FaRocket className="join-icon" />
                  <span>{isRoomCreator ? 'Create & Join Session' : 'Join Session'}</span>
                </button>

                <button
                  onClick={handleCopyLink}
                  className="copy-button group"
                >
                  <FaLink className="copy-icon" />
                  <span>Copy Session Link</span>
                </button>
              </div>

              {/* Info Text */}
              <div className="info-text">
                {isRoomCreator
                  ? 'As the session creator, your configuration will initialize the session.'
                  : 'This session already exists. You will join with the existing configuration.'}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="lobby-footer">
          <p className="footer-text">
            SyncForge — Collaborative IDE with real-time editing, video, and shared runtimes
          </p>
        </footer>
      </div>

      <style jsx>{`
        /* Enhanced Animations matching other components */
        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(12px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes pulse {
          0% { 
            opacity: 1; 
            box-shadow: 0 0 0 0 rgba(14, 165, 164, 0.7);
          } 
          70% { 
            opacity: 0.8; 
            box-shadow: 0 0 0 8px rgba(14, 165, 164, 0);
          } 
          100% { 
            opacity: 1; 
            box-shadow: 0 0 0 0 rgba(14, 165, 164, 0);
          } 
        }

        @keyframes iconBounce {
          0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-3px); }
          60% { transform: translateY(-1px); }
        }

        .animate-slideInUp {
          animation: slideInUp 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .animate-fadeInUp {
          animation: fadeInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        /* Main Container */
        .lobby-container {
          min-height: 100vh;
          background: linear-gradient(180deg, #0a1628 0%, #0f172a 100%);
          color: #e2e8f0;
          font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
          position: relative;
          overflow: hidden;
          padding: 16px;
        }

        .lobby-container::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: radial-gradient(circle at top center, rgba(14, 165, 164, 0.02), transparent 60%);
          pointer-events: none;
          z-index: 0;
        }

        .lobby-container > * {
          position: relative;
          z-index: 1;
        }

        /* Header */
        .lobby-header {
          text-align: center;
          margin-bottom: 32px;
          max-width: 800px;
          margin-left: auto;
          margin-right: auto;
          padding-top: 20px;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          border-radius: 20px;
          background: linear-gradient(135deg, rgba(15,23,42,0.8), rgba(7,17,27,0.8));
          border: 1px solid rgba(14, 165, 164, 0.08);
          font-size: 12px;
          margin-bottom: 20px;
          backdrop-filter: blur(8px);
          transition: all 0.3s ease;
        }

        .status-badge:hover {
          border-color: rgba(14, 165, 164, 0.15);
          transform: translateY(-1px);
        }

        .status-indicator {
          padding: 2px 8px;
          border-radius: 12px;
          background: linear-gradient(135deg, #0ea5a4, #0891b2);
          color: white;
          font-weight: 600;
          font-size: 10px;
          letter-spacing: 0.5px;
        }

        .status-text {
          color: #94a3b8;
          font-weight: 500;
        }

        .main-title {
          font-size: 28px;
          font-weight: 800;
          letter-spacing: -0.02em;
          margin-bottom: 12px;
          color: #f1f5f9;
        }

        .brand-text {
          background: linear-gradient(135deg, #0ea5a4, #8b5cf6);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
        }

        .subtitle {
          color: #94a3b8;
          font-size: 14px;
          margin: 0;
          font-weight: 500;
        }

        /* Content Grid */
        .content-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 24px;
          max-width: 1200px;
          margin: 0 auto;
        }

        @media (min-width: 1024px) {
          .content-grid {
            grid-template-columns: 1fr 1fr;
          }
        }

        /* Video Panel */
        .video-panel {
          background: linear-gradient(135deg, rgba(15,23,42,0.4), rgba(12,18,28,0.3));
          border: 1px solid rgba(14, 165, 164, 0.06);
          border-radius: 16px;
          overflow: hidden;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          backdrop-filter: blur(8px);
          box-shadow: 0 8px 32px rgba(2, 6, 23, 0.3);
        }

        .video-panel:hover {
          border-color: rgba(14, 165, 164, 0.12);
          transform: translateY(-2px);
          box-shadow: 0 12px 40px rgba(2, 6, 23, 0.4);
        }

        .video-header {
          padding: 16px 20px;
          background: linear-gradient(135deg, rgba(15,23,42,0.95), rgba(7,17,27,0.95));
          border-bottom: 1px solid rgba(14, 165, 164, 0.08);
          display: flex;
          align-items: center;
          justify-content: space-between;
          backdrop-filter: blur(12px);
        }

        .window-controls {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .control-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          transition: all 0.3s ease;
        }

        .control-dot.red {
          background: #ff5f56;
        }

        .control-dot.yellow {
          background: #ffbd2e;
        }

        .control-dot.green {
          background: #27c93f;
        }

        .window-title {
          color: #94a3b8;
          font-size: 13px;
          font-weight: 500;
          margin-left: 4px;
        }

        .media-controls {
          display: flex;
          gap: 8px;
        }

        .media-button {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          border: 1px solid rgba(148, 163, 184, 0.08);
          background: transparent;
          color: #94a3b8;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          backdrop-filter: blur(4px);
        }

        .media-button.active {
          background: rgba(14, 165, 164, 0.1);
          border-color: rgba(14, 165, 164, 0.2);
          color: #0ea5a4;
        }

        .media-button.disabled {
          background: rgba(239, 68, 68, 0.1);
          border-color: rgba(239, 68, 68, 0.2);
          color: #ef4444;
        }

        .media-button:hover {
          transform: translateY(-1px) scale(1.05);
        }

        .media-button.active:hover {
          background: rgba(14, 165, 164, 0.15);
          border-color: rgba(14, 165, 164, 0.3);
        }

        .media-button.disabled:hover {
          background: rgba(239, 68, 68, 0.15);
          border-color: rgba(239, 68, 68, 0.3);
        }

        .video-content {
          position: relative;
          aspect-ratio: 16 / 9;
          background: #000;
          overflow: hidden;
        }

        .video-element {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transform: scaleX(-1);
        }

        .video-disabled {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, rgba(15,23,42,0.9), rgba(7,17,27,0.9));
          backdrop-filter: blur(8px);
        }

        .disabled-content {
          text-align: center;
          color: #94a3b8;
        }

        .disabled-icon {
          font-size: 32px;
          margin-bottom: 12px;
          opacity: 0.6;
        }

        .disabled-text {
          font-size: 14px;
          font-weight: 500;
          margin: 0;
        }

        /* Config Panel */
        .config-panel {
          background: linear-gradient(135deg, rgba(15,23,42,0.4), rgba(12,18,28,0.3));
          border: 1px solid rgba(14, 165, 164, 0.06);
          border-radius: 16px;
          padding: 24px;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          backdrop-filter: blur(8px);
          box-shadow: 0 8px 32px rgba(2, 6, 23, 0.3);
        }

        .config-panel:hover {
          border-color: rgba(14, 165, 164, 0.12);
          transform: translateY(-2px);
          box-shadow: 0 12px 40px rgba(2, 6, 23, 0.4);
        }

        .config-header {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-bottom: 24px;
        }

        .config-icon-container {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: linear-gradient(135deg, rgba(14, 165, 164, 0.1), rgba(14, 116, 144, 0.1));
          border: 1px solid rgba(14, 165, 164, 0.15);
          transition: all 0.3s ease;
        }

        .config-icon {
          color: #0ea5a4;
          font-size: 16px;
          filter: drop-shadow(0 0 6px rgba(14, 165, 164, 0.2));
        }

        .config-title {
          font-size: 18px;
          font-weight: 600;
          color: #f1f5f9;
          margin: 0;
          letter-spacing: -0.01em;
        }

        .config-content {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        /* Input Groups */
        .input-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .input-label {
          font-size: 13px;
          font-weight: 600;
          color: #e2e8f0;
          margin: 0;
          letter-spacing: 0.2px;
        }

        /* Custom Input Styling */
        :global(.custom-input) {
          background: rgba(15, 23, 42, 0.6) !important;
          border: 1px solid rgba(14, 165, 164, 0.1) !important;
          border-radius: 10px !important;
          padding: 10px 14px !important;
          font-size: 14px !important;
          color: #e2e8f0 !important;
          transition: all 0.3s ease !important;
          height: 44px !important;
        }

        :global(.custom-input:hover) {
          border-color: rgba(14, 165, 164, 0.2) !important;
          background: rgba(15, 23, 42, 0.8) !important;
        }

        :global(.custom-input:focus) {
          border-color: rgba(14, 165, 164, 0.4) !important;
          background: rgba(15, 23, 42, 0.9) !important;
          box-shadow: 0 0 0 3px rgba(14, 165, 164, 0.1) !important;
        }

        :global(.custom-input::placeholder) {
          color: #94a3b8 !important;
        }

        /* Mode Selection */
        .mode-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .mode-button {
          padding: 16px;
          border-radius: 12px;
          border: 1px solid rgba(14, 165, 164, 0.06);
          background: linear-gradient(135deg, rgba(15,23,42,0.3), rgba(12,18,28,0.2));
          color: #94a3b8;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          backdrop-filter: blur(4px);
        }

        .mode-button:hover {
          border-color: rgba(14, 165, 164, 0.12);
          background: linear-gradient(135deg, rgba(15,23,42,0.5), rgba(12,18,28,0.3));
          transform: translateY(-1px);
        }

        .mode-button.active {
          border-color: rgba(14, 165, 164, 0.3);
          background: linear-gradient(135deg, rgba(14, 165, 164, 0.15), rgba(14, 116, 144, 0.1));
          color: #0ea5a4;
          box-shadow: 0 2px 8px rgba(14, 165, 164, 0.1);
        }

        /* Specific styling for polyglot mode */
        .mode-button.active[data-mode="polyglot"] {
          border-color: rgba(139, 92, 246, 0.3);
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(124, 58, 237, 0.1));
          color: #8b5cf6;
          box-shadow: 0 2px 8px rgba(139, 92, 246, 0.1);
        }

        .mode-icon {
          font-size: 20px;
          transition: all 0.3s ease;
        }

        .mode-button.active .mode-icon {
          transform: scale(1.1);
        }

        .mode-label {
          font-size: 13px;
          font-weight: 600;
          transition: all 0.3s ease;
        }

        /* Language Selection */
        .language-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }

        .language-button {
          padding: 12px 8px;
          border-radius: 10px;
          border: 1px solid rgba(14, 165, 164, 0.06);
          background: linear-gradient(135deg, rgba(15,23,42,0.3), rgba(12,18,28,0.2));
          color: #94a3b8;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          backdrop-filter: blur(4px);
        }

        .language-button:hover {
          border-color: rgba(14, 165, 164, 0.12);
          background: linear-gradient(135deg, rgba(15,23,42,0.5), rgba(12,18,28,0.3));
          transform: translateY(-1px);
        }

        .language-button.active {
          border-color: rgba(14, 165, 164, 0.3);
          background: linear-gradient(135deg, rgba(14, 165, 164, 0.15), rgba(14, 116, 144, 0.1));
          color: #0ea5a4;
          box-shadow: 0 2px 8px rgba(14, 165, 164, 0.1);
        }

        .language-label {
          font-size: 11px;
          font-weight: 600;
          text-align: center;
        }

        /* Settings Section */
        .settings-section {
          border-top: 1px solid rgba(14, 165, 164, 0.08);
          padding-top: 20px;
        }

        .settings-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 16px;
        }

        .settings-icon {
          color: #0ea5a4;
          font-size: 14px;
        }

        .settings-title {
          font-size: 13px;
          font-weight: 600;
          color: #e2e8f0;
          margin: 0;
          letter-spacing: 0.2px;
        }

        .settings-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .setting-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px;
          border-radius: 8px;
          background: linear-gradient(135deg, rgba(15,23,42,0.5), rgba(12,18,28,0.3));
          border: 1px solid rgba(14, 165, 164, 0.04);
          transition: all 0.3s ease;
          backdrop-filter: blur(4px);
        }

        .setting-item:hover {
          border-color: rgba(14, 165, 164, 0.08);
          background: linear-gradient(135deg, rgba(15,23,42,0.7), rgba(12,18,28,0.4));
        }

        .setting-label {
          font-size: 12px;
          color: #cbd5e1;
          font-weight: 500;
        }

        /* Custom Switch Styling */
        :global(.custom-switch.ant-switch) {
          background-color: rgba(15, 23, 42, 0.8) !important;
          border: 1px solid rgba(148, 163, 184, 0.2) !important;
        }

        :global(.custom-switch.ant-switch-checked) {
          background-color: #0ea5a4 !important;
          border-color: rgba(14, 165, 164, 0.3) !important;
        }

        :global(.custom-switch.ant-switch:hover) {
          background-color: rgba(15, 23, 42, 0.9) !important;
        }

        :global(.custom-switch.ant-switch-checked:hover) {
          background-color: #0891b2 !important;
        }

        /* Action Section */
        .action-section {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-top: 8px;
        }

        .join-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 14px 24px;
          border-radius: 12px;
          background: linear-gradient(135deg, #0ea5a4, #0891b2);
          border: 1px solid rgba(14, 165, 164, 0.3);
          color: white;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 4px 12px rgba(14, 165, 164, 0.2);
        }

        .join-button:hover {
          background: linear-gradient(135deg, #0891b2, #0e7490);
          border-color: rgba(14, 165, 164, 0.5);
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(14, 165, 164, 0.3);
        }

        .join-icon {
          font-size: 14px;
          transition: all 0.3s ease;
        }

        .join-button.group:hover .join-icon {
          transform: scale(1.1);
          animation: iconBounce 0.6s ease;
        }

        .copy-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 14px 24px;
          border-radius: 12px;
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(148, 163, 184, 0.2);
          color: #e2e8f0;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          backdrop-filter: blur(8px);
        }

        .copy-button:hover {
          background: rgba(15, 23, 42, 0.8);
          border-color: rgba(148, 163, 184, 0.3);
          color: #f1f5f9;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(2, 6, 23, 0.2);
        }

        .copy-icon {
          font-size: 14px;
          transition: all 0.3s ease;
        }

        .copy-button.group:hover .copy-icon {
          transform: scale(1.1);
        }

        /* Info Text */
        .info-text {
          font-size: 11px;
          color: #94a3b8;
          text-align: center;
          line-height: 1.4;
          padding: 12px;
          background: rgba(15, 23, 42, 0.3);
          border-radius: 8px;
          border: 1px solid rgba(14, 165, 164, 0.04);
          backdrop-filter: blur(4px);
        }

        /* Footer */
        .lobby-footer {
          text-align: center;
          margin-top: 48px;
          padding-bottom: 24px;
        }

        .footer-text {
          font-size: 12px;
          color: #64748b;
          margin: 0;
          font-weight: 500;
        }

        /* Mobile Responsiveness */
        @media (max-width: 768px) {
          .lobby-container {
            padding: 12px;
          }

          .lobby-header {
            margin-bottom: 24px;
            padding-top: 12px;
          }

          .main-title {
            font-size: 24px;
          }

          .content-grid {
            gap: 20px;
          }

          .config-panel,
          .video-panel {
            padding: 20px;
          }

          .settings-grid {
            grid-template-columns: 1fr;
          }

          .mode-grid {
            gap: 8px;
          }

          .mode-button {
            padding: 12px;
          }

          .language-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .join-button,
          .copy-button {
            padding: 12px 20px;
            font-size: 13px;
          }
        }

        @media (max-width: 480px) {
          .lobby-container {
            padding: 8px;
          }

          .main-title {
            font-size: 20px;
          }

          .subtitle {
            font-size: 13px;
          }

          .config-panel,
          .video-panel {
            padding: 16px;
          }

          .config-content {
            gap: 16px;
          }

          .mode-button {
            padding: 10px;
            font-size: 12px;
          }

          .language-button {
            padding: 10px 6px;
          }

          .language-label {
            font-size: 10px;
          }

          .setting-item {
            padding: 10px;
          }

          .setting-label {
            font-size: 11px;
          }
        }

        /* Performance Optimizations */
        .lobby-container {
          will-change: transform;
          backface-visibility: hidden;
        }

        .mode-button,
        .language-button,
        .media-button,
        .join-button,
        .copy-button {
          will-change: transform, box-shadow;
        }

        /* Text Selection */
        .lobby-container *::selection {
          background: rgba(14, 165, 164, 0.2);
          color: #f1f5f9;
        }

        /* Accessibility */
        .mode-button:focus-visible,
        .language-button:focus-visible,
        .media-button:focus-visible,
        .join-button:focus-visible,
        .copy-button:focus-visible {
          outline: 2px solid rgba(14, 165, 164, 0.6) !important;
          outline-offset: 2px !important;
        }

        /* Smooth Scrolling */
        * {
          scroll-behavior: smooth;
        }

        /* Notification Styling */
        :global(.ant-notification) {
          backdrop-filter: blur(12px);
        }

        :global(.ant-notification-notice) {
          background: linear-gradient(135deg, #0f172a, #071126) !important;
          border: 1px solid rgba(14, 165, 164, 0.15) !important;
          border-radius: 12px !important;
          color: #e2e8f0 !important;
        }

        :global(.ant-notification-notice-message) {
          color: #f1f5f9 !important;
          font-weight: 600 !important;
        }

        :global(.ant-notification-notice-description) {
          color: #cbd5e1 !important;
        }

        /* Enhanced Glow Effects */
        .config-icon {
          filter: drop-shadow(0 0 6px rgba(14, 165, 164, 0.2));
        }

        .settings-icon {
          filter: drop-shadow(0 0 4px rgba(14, 165, 164, 0.2));
        }

        .join-icon,
        .copy-icon {
          filter: drop-shadow(0 0 4px rgba(14, 165, 164, 0.1));
        }

        .join-button:hover .join-icon {
          filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.3));
        }

        /* Reduced Motion Support */
        @media (prefers-reduced-motion: reduce) {
          .animate-slideInUp,
          .animate-fadeInUp {
            animation: none;
          }
          
          .mode-button,
          .language-button,
          .media-button,
          .join-button,
          .copy-button,
          .config-panel,
          .video-panel {
            transition: none;
          }
        }

        /* High Contrast Mode Support */
        @media (prefers-contrast: high) {
          .mode-button,
          .language-button,
          .media-button,
          .setting-item {
            border-width: 2px;
          }
          
          .config-panel,
          .video-panel {
            border-width: 2px;
          }
        }
      `}</style>
    </>
  );
};


export default LobbyPage;
