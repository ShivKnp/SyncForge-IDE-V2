// src/pages/EditorPage.js - Enhanced with matching transitions and animations
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Spin, notification, Modal, Switch, Select, Button, Tooltip,} from 'antd';
import { 
  FaCog, 
  FaVideo, 
  FaVideoSlash, 
  FaMicrophone, 
  FaMicrophoneSlash, 
  FaDesktop, 
  FaPhoneSlash
} from 'react-icons/fa';
import CodeEditor from '../components/editor/CodeEditor';
import TerminalPanel from '../components/common/TerminalPanel';
import { useVideoChat } from '../hooks/useVideoChat';
import HostApprovalModal from '../components/common/HostApprovalModal';
import CollapsibleSidebar from '../components/common/CollapsibleSidebar';
import AIChatbot from '../components/common/AIChatbot';
import ParticipantsGrid from '../components/common/ParticipantsGrid';
import useEditorState from '../hooks/useEditorState';
import Whiteboard from '../components/common/Whiteboard';
import { LoadingOutlined, CheckCircleOutlined } from '@ant-design/icons';

const { Option } = Select;

const EditorPageContent = ({ id, userName }) => {
  const {
    state,
    actions,
    handleSaveToWorkspace,
    editorTheme,
    files,
    fileTree,
    docRef,
    isSaving,
    lastSaved,
    hasUnsavedChanges
  } = useEditorState(id, userName);

  const videoHook = useVideoChat(id, userName);
  const {
    peers,
    localStream,
    localPeerId,
    pinnedPeerId,
    handlePinPeer,
    handleSelfPin,
    isSelfPinned,
    toggleMic,
    toggleCamera,
    isMicOn,
    isCameraOn,
    isScreenSharing,
    handleToggleScreenShare,
    handleEndCall,
    playbackEnabled,
    enablePlayback,
  } = videoHook;

  const [aiDocked, setAiDocked] = useState(false);
  // restore videoDocked from sessionStorage so docked state survives refresh
  const [videoDocked, setVideoDocked] = useState(() => {
    try {
      const s = sessionStorage.getItem('codecrew-video-docked');
      return s === 'true';
    } catch (e) {
      return false;
    }
  });
const [activeSidebarPanel, setActiveSidebarPanel] = useState(() => {
  const saved = sessionStorage.getItem('codecrew-active-panel');
  // Default to 'files' if no saved preference exists (first time entering)
  return saved || 'files';
});

  const handleOpenSidebarPanel = useCallback((panelName) => {
    setActiveSidebarPanel(panelName);
    sessionStorage.setItem('codecrew-active-panel', panelName);
    
    // Force sidebar to expand
    setForceSidebarExpanded(true);
    
    // Reset force flag after animation
    setTimeout(() => {
      setForceSidebarExpanded(false);
    }, 500);
  }, []);

  const getExistingNames = useCallback((parentNodeId) => {
    if (!parentNodeId || !state.tree || !state.tree[parentNodeId]) {
      return [];
    }

    const parentNode = state.tree[parentNodeId];
    if (!parentNode.children) {
      return [];
    }

    return parentNode.children
      .map(childId => state.tree[childId]?.name)
      .filter(Boolean);
  }, [state.tree]);


  const [hostModalVisible, setHostModalVisible] = useState(false);
  const [configDraft, setConfigDraft] = useState(null);
  const [configSaving, setConfigSaving] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [currentPendingOp, setCurrentPendingOp] = useState(null);
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [videoHookReady, setVideoHookReady] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [forceSidebarExpanded, setForceSidebarExpanded] = useState(false);
  
  // Enhanced state for transitions
  const [pageLoaded, setPageLoaded] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(false);
  const [contentVisible, setContentVisible] = useState(false);

  useEffect(() => {
    if (videoHook && videoHook.localPeerId) {
      setVideoHookReady(true);
    }
  }, [videoHook]);

  // Enhanced loading sequence with staggered animations
  useEffect(() => {
    const timer1 = setTimeout(() => setPageLoaded(true), 100);
    const timer2 = setTimeout(() => setHeaderVisible(true), 300);
    const timer3 = setTimeout(() => setContentVisible(true), 500);
    
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  // Main view state with transitions
  const [mainView, setMainView] = useState(() => {
    const saved = sessionStorage.getItem('codecrew-main-view');
    return saved || 'editor'; // 'editor', 'video', 'ai', or 'whiteboard'
  });
  const [dockedWhiteboard, setDockedWhiteboard] = useState(null);
  const [viewTransitioning, setViewTransitioning] = useState(false);

  const handleDockWhiteboard = useCallback((boardId, boardType, boardConfig = null) => {
    setViewTransitioning(true);
    setTimeout(() => {
      setDockedWhiteboard({ boardId, boardType, boardConfig });
      setMainView('whiteboard');
      setViewTransitioning(false);
    }, 200);
  }, []);

  const handleUndockWhiteboard = useCallback(() => {
    setViewTransitioning(true);
    setTimeout(() => {
      setDockedWhiteboard(null);
      setMainView('editor');
      setViewTransitioning(false);
    }, 200);
  }, []);

  // Persist main view changes
  useEffect(() => {
    sessionStorage.setItem('codecrew-main-view', mainView);
  }, [mainView]);

  // Enhanced toggle functions with transitions
  const handleToggleVideoDock = useCallback(() => {
    setViewTransitioning(true);
    setVideoDocked(prev => {
      const next = !prev;
      try { 
        sessionStorage.setItem('codecrew-video-docked', String(next)); 
      } catch (e) {}

      setTimeout(() => {
        setMainView(next ? 'video' : 'editor');
        setViewTransitioning(false);
      }, 200);
      
      return next;
    });
    setDockedWhiteboard(null);
  }, []);

  // Ensure mainView and videoDocked are consistent on mount
  useEffect(() => {
    try {
      const s = sessionStorage.getItem('codecrew-video-docked');
      if (s === 'true') {
        setMainView('video');
        setVideoDocked(true);
      }
    } catch (e) { /* ignore */ }
  }, []);

  const handleToggleAiDock = useCallback(() => {
    setViewTransitioning(true);
    setAiDocked(prev => !prev);
    setTimeout(() => {
      setMainView(prevView => prevView === 'ai' ? 'editor' : 'ai');
      setDockedWhiteboard(null);
      setViewTransitioning(false);
    }, 200);
  }, []);

  // View state helpers
  const showVideoInMain = mainView === 'video';
  const showAiInMain = mainView === 'ai';
  const showWhiteboardInMain = mainView === 'whiteboard' && dockedWhiteboard;

  const handlePromoteToHost = (userToPromote, peerId) => {
    if (!actions || typeof actions.promoteToHost !== 'function') {
      console.warn('promoteToHost action not available');
      return;
    }
    actions.promoteToHost(userToPromote);
  };

  const handleKickParticipant = (userToKick, peerId) => {
    if (!actions || typeof actions.kickParticipant !== 'function') {
      console.warn('kickParticipant action not available');
      return;
    }
    actions.kickParticipant(userToKick, peerId);
  };

  const confirmEndCall = () => {
  Modal.confirm({
    title: (
      <div className="flex items-center gap-2">
        <div className="terminal-toggle active" style={{ 
          background: 'rgba(239, 68, 68, 0.1)', 
          borderColor: 'rgba(239, 68, 68, 0.3)' 
        }}>
         <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path 
    d="M1 1L13 13M13 1L1 13" 
    stroke="currentColor" 
    strokeWidth="1.5" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  />
</svg>
        </div>
        <span className="text-slate-100 font-semibold text-sm">End Call</span>
      </div>
    ),
    content: (
      <div className="text-slate-300 text-sm leading-6 mt-2">
        Are you sure you want to leave the session and end the call? 
        <div className="mt-3 p-3 rounded-lg bg-gradient-to-r from-rose-500/10 to-rose-600/5 border border-rose-500/20">
          <div className="flex items-center gap-2 text-rose-400 text-xs">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path 
                d="M6 3V6M6 9H6.005" 
                stroke="currentColor" 
                strokeWidth="1.2" 
                strokeLinecap="round"
              />
            </svg>
            <span>This will disconnect you from all participants</span>
          </div>
        </div>
      </div>
    ),
    okText: 'Leave Session',
    cancelText: 'Cancel',
    className: 'end-call-modal',
    width: 420,
    styles: {
      body: { 
        padding: '20px',
        background: 'linear-gradient(180deg, rgba(15,23,42,0.95), rgba(7,17,26,0.95))',
        color: '#e2e8f0',
        borderRadius: '0 0 12px 12px',
        backdropFilter: 'blur(20px)',
      },
      header: {
        background: 'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(30,41,59,0.9))',
        borderBottom: '1px solid rgba(239, 68, 68, 0.15)',
        color: '#e2e8f0',
        borderRadius: '12px 12px 0 0',
        padding: '16px 20px',
        minHeight: 'auto'
      },
      content: {
        backgroundColor: 'transparent',
        backdropFilter: 'blur(20px)',
        borderRadius: '12px',
        boxShadow: '0 20px 40px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(239, 68, 68, 0.1)',
        border: 'none',
        overflow: 'hidden'
      }
    },
    okButtonProps: {
      className: 'modal-end-call-btn',
      
    },
    cancelButtonProps: {
      className: 'modal-cancel-btn'
    },
    onOk: async () => {
      try {
        if (typeof handleEndCall === 'function') {
          await handleEndCall();
          notification.info({ message: 'Left the session' });
        } else {
          notification.warning({ message: 'Leave handler not provided — redirecting to home' });
          window.location.href = '/';
        }
      } catch (err) {
        console.error('Error ending call', err);
        notification.error({ message: 'Failed to leave cleanly. Reloading.' });
        window.location.href = '/';
      }
    }
  });
};

  // Terminal state management
  const [terminalVisible, setTerminalVisible] = useState(() => {
    const saved = sessionStorage.getItem('codecrew-terminal-visible');
    return saved ? JSON.parse(saved) : false;
  });

  const [terminalHeight, setTerminalHeight] = useState(() => {
    const saved = sessionStorage.getItem('codecrew-terminal-height');
    const height = saved ? parseInt(saved, 10) : 280;
    return Math.max(120, height);
  });

  const toggleTerminal = useCallback((expanded) => {
    const newVisible = expanded !== undefined ? expanded : !terminalVisible;
    
    setTerminalVisible(newVisible);
    sessionStorage.setItem('codecrew-terminal-visible', JSON.stringify(newVisible));
    
    if (newVisible) {
      const validHeight = Math.max(120, terminalHeight);
      setTerminalHeight(validHeight);
      sessionStorage.setItem('codecrew-terminal-height', validHeight.toString());
    }
  }, [terminalVisible, terminalHeight]);

  const handleTerminalResize = useCallback((newHeight) => {
    const validHeight = Math.max(120, newHeight);
    setTerminalHeight(validHeight);
    sessionStorage.setItem('codecrew-terminal-height', validHeight.toString());
  }, []);

  const openTerminalInWorkspace = useCallback(() => {
    toggleTerminal(!terminalVisible);
  }, [toggleTerminal, terminalVisible]);

  // Media state restoration
 

  useEffect(() => {
    if (state.config) {
      setConfigDraft({ ...state.config });
    }
  }, [state.config]);

  const openHostModal = () => {
    setConfigDraft({ ...(state.config || {
      roomMode: state.roomMode,
      projectLanguage: state.projectLanguage,
      enableVideo: true,
      enableTerminal: true,
      multiFile: true,
      enableAI: true,
      sharedInputOutput: state.roomMode === 'project',
      enableHostNotes: true
    }) });
    setHostModalVisible(true);
  };

  const applyHostConfig = async () => {
    if (!state.isHost) {
      notification.warning({ message: 'Only the host can apply configuration.' });
      setHostModalVisible(false);
      return;
    }
  Modal.confirm({
    title: (
      <div className="flex items-center gap-2">
        <div className="terminal-toggle active">
          <FaCog className="terminal-icon" />
        </div>
        <span className="text-slate-100 font-semibold text-sm">Apply configuration changes?</span>
      </div>
    ),
    content: (
      <div className="text-slate-300 text-sm leading-6 mt-2">
        This will update room settings and may affect all participants. Are you sure you want to proceed?
      </div>
    ),
    onOk: async () => {
      setConfigSaving(true);
      const ok = await actions.updateConfig(configDraft);
      setConfigSaving(false);
      setHostModalVisible(false);
      if (!ok) notification.error({ message: 'Failed to update room configuration.' });
      else notification.success({ message: 'Room configuration updated.' });
    },
    okText: 'Apply Changes',
    cancelText: 'Cancel',
    className: 'host-confirm-modal',
    width: 480,
    styles: {
      body: { 
        padding: '20px',
        background: 'linear-gradient(180deg, rgba(15,23,42,0.95), rgba(7,17,26,0.95))',
        color: '#e2e8f0',
        borderRadius: '0 0 16px 16px',
        backdropFilter: 'blur(20px)',
      },
      header: {
        background: 'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(30,41,59,0.9))',
        borderBottom: '1px solid rgba(14, 165, 164, 0.15)',
        color: '#e2e8f0',
        borderRadius: '16px 16px 0 0',
        padding: '16px 20px',
        minHeight: 'auto'
      },
      content: {
        backgroundColor: 'transparent',
        backdropFilter: 'blur(20px)',
        borderRadius: '16px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(14, 165, 164, 0.1)',
        border: 'none',
        overflow: 'hidden'
      }
    },
    okButtonProps: {
      className: 'modal-apply-btn confirm-ok-btn',
      icon: <CheckCircleOutlined />
    },
    cancelButtonProps: {
      className: 'modal-cancel-btn confirm-cancel-btn'
    }
  });
};
  

  if (state.isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-black flex items-center justify-center">
        <div className="text-center animate-slideInUp">
          <div className="relative mb-6">
            <div className="w-16 h-16 border-2 border-cyan-400/20 border-t-cyan-400 rounded-full animate-spin mx-auto"></div>
            <div className="absolute inset-0 w-16 h-16 border-2 border-transparent border-r-cyan-300/40 rounded-full animate-spin-reverse mx-auto"></div>
          </div>
          <div className="space-y-2">
            <div className="text-cyan-400 text-lg font-semibold">Loading Session...</div>
            <div className="text-slate-400 text-sm">Preparing your collaborative workspace</div>
          </div>
        </div>
      </div>
    );
  }

  const cfg = state.config || {};
  const enableVideo = (typeof cfg.enableVideo === 'boolean') ? cfg.enableVideo : true;
  const enableHostNotes = (typeof cfg.enableHostNotes === 'boolean') ? cfg.enableHostNotes : true;
  const enableTerminal = (typeof cfg.enableTerminal === 'boolean') ? cfg.enableTerminal : true;
  const enableChat = (typeof cfg.enableChat === 'boolean') ? cfg.enableChat : true;
  const enableAI = (typeof cfg.enableAI === 'boolean') ? cfg.enableAI : true;
  const sharedInputOutput = (state.config && typeof state.config.sharedInputOutput === 'boolean')
    ? state.config.sharedInputOutput
    : (state.roomMode === 'project');

  return (
    <>
      <div className={`flex h-screen overflow-hidden bg-gradient-to-b from-slate-900 via-slate-950 to-black text-slate-100 font-sans transition-all duration-700 ${pageLoaded ? 'opacity-100' : 'opacity-0'}`}>
        {/* Enhanced Sidebar with slide-in animation */}
        <div className={`transition-all duration-500 ease-out transform ${pageLoaded ? 'translate-x-0' : '-translate-x-full'}`}>
          <CollapsibleSidebar
          activePanel={activeSidebarPanel}
 onPanelChange={(panel) => {
    setActiveSidebarPanel(panel);
    sessionStorage.setItem('codecrew-active-panel', panel);
  }}
            forceExpanded={forceSidebarExpanded}
            terminalVisible={terminalVisible}
            onToggleTerminal={toggleTerminal}
            onSidebarResize={(width, expanded) => {
              setSidebarWidth(width);
              setSidebarExpanded(expanded);
            }}
            docRef={docRef}
            enableAI={enableAI}
            state={state}
            actions={actions}
            id={id}
            userName={userName}
            enableVideo={enableVideo}
            enableChat={enableChat}
            peers={peers}
            localUserName={userName}
            ownerName={state.config?.ownerName}
            localStream={videoHook.localStream}
            toggleMic={videoHook.toggleMic}
            toggleCamera={videoHook.toggleCamera}
            isMicOn={videoHook.isMicOn}
            isCameraOn={videoHook.isCameraOn}
            videoHook={videoHook}
            playbackEnabled={playbackEnabled}
            enablePlayback={enablePlayback}
            input={state.input}
            output={state.output}
            lang={state.lang}
            handleLang={actions.handleLang}
            handleRun={actions.handleRun}
            handleInput={actions.handleInput}
            runCodeDisabled={state.runCodeDisabled}
            roomMode={state.roomMode}
            projectLanguage={state.projectLanguage}
            sharedInputOutput={sharedInputOutput}
            onPromoteToHost={handlePromoteToHost}
            onKickParticipant={handleKickParticipant}
            isLocalHost={state.isHost}
            aiDocked={aiDocked}
            onToggleAiDock={handleToggleAiDock}
            showAiInMain={showAiInMain}
            aiMessages={state.aiMessages || []}
            roomId={id}
            videoDocked={videoDocked}
            onToggleVideoDock={handleToggleVideoDock}
            showVideoInMain={showVideoInMain}
            onDockWhiteboard={handleDockWhiteboard}
            enableHostNotes={enableHostNotes}
          />
        </div>

        {/* Main Content Area with enhanced animations */}
        <div className={`flex flex-col flex-1 min-w-0 min-h-0 h-full transition-all duration-500 ease-out transform ${contentVisible ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'}`}>
          
          {/* Enhanced Whiteboard Header */}
          {showWhiteboardInMain && dockedWhiteboard && (
            <div className={`w-full bg-gradient-to-r from-slate-900/80 to-slate-800/60 border-b border-slate-800/50 p-4 flex items-center justify-between flex-shrink-0 backdrop-blur-md transition-all duration-500 ${headerVisible ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'}`}>
              <div className="flex items-center gap-4">
                <Button
  onClick={handleUndockWhiteboard}
  type="text"
  className="flex items-center gap-2 !bg-transparent bg-gradient-to-r from-slate-800/40 to-slate-700/30 hover:from-slate-700/50 hover:to-slate-600/40 border border-slate-700/30 hover:border-cyan-500/30 !text-slate-300 hover:!text-cyan-400 text-sm font-medium shadow-sm shadow-slate-500/5 transition-all duration-500 hover:scale-105 hover:shadow-lg hover:shadow-cyan-500/10 px-4 py-2 rounded-lg backdrop-blur-sm hover:backdrop-blur-md hover:translate-y-[-1px] active:scale-95 group relative overflow-hidden"
>
  {/* Shimmer overlay effect */}
  <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 via-cyan-400/10 to-slate-900/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-out" />
  
  {/* Dark overlay for depth */}
  <div className="absolute inset-0 bg-gradient-to-r from-slate-900/0 to-slate-900/0 group-hover:from-cyan-900/20 group-hover:to-blue-900/10 transition-all duration-500 rounded-lg" />
  
  {/* Subtle glow effect */}
  <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500 shadow-[0_0_10px_rgba(34,211,238,0.2)]" />
  
  <span className="relative z-10 group-hover:drop-shadow-sm transition-all duration-300">← Back to Editor</span>
</Button>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-sm text-slate-300 font-medium bg-gradient-to-r from-slate-800/60 to-slate-700/40 px-2 py-0.5 rounded-lg border border-slate-700/30 backdrop-blur-sm">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  Whiteboard ID: <span className="text-cyan-300 font-mono">{id}</span>
                </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-slate-400 text-sm bg-slate-800/30 px-3 py-1.5 rounded-lg">
                <div className={`w-2 h-2 rounded-full ${state.isHost ? 'bg-amber-400' : 'bg-green-400'} animate-pulse`}></div>
                {state.isHost ? 'Host' : 'Participant'} • {userName}
              </div>
            </div>
          )}

          {/* Enhanced Header Bar with Larger Video Controls */}
          {!showAiInMain && !showVideoInMain && !showWhiteboardInMain && (
            <div className={`flex items-center justify-between px-4 py-3 bg-gradient-to-r from-slate-900/80 to-slate-800/60 border-b border-slate-800/50 flex-shrink-0 backdrop-blur-md transition-all duration-500 ${headerVisible ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'}`}>
              {/* Left side with enhanced animations */}
              <div className="flex items-center gap-3 animate-slideInLeft">
                {state.isHost && (

                  
                  <Button
  onClick={openHostModal}
  type="text"
  className="flex items-center gap-2 !bg-transparent bg-gradient-to-r from-slate-800/40 to-slate-700/30 hover:from-slate-700/50 hover:to-slate-600/40 border border-slate-700/30 hover:border-cyan-500/30 !text-slate-300 hover:!text-cyan-400 text-sm font-medium shadow-sm shadow-slate-500/5 transition-all duration-500 hover:scale-105 hover:shadow-lg hover:shadow-cyan-500/10 px-4 py-0.5 rounded-lg backdrop-blur-sm hover:backdrop-blur-md hover:translate-y-[-1px] active:scale-95 group relative overflow-hidden"
  icon={<FaCog size={12} className="transition-all duration-500 group-hover:rotate-180 group-hover:scale-110 group-active:rotate-360" />}
>
  {/* Shimmer overlay effect */}
  <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 via-cyan-400/10 to-slate-900/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-out" />
  
  {/* Dark overlay for depth */}
  <div className="absolute inset-0 bg-gradient-to-r from-slate-900/0 to-slate-900/0 group-hover:from-cyan-900/20 group-hover:to-blue-900/10 transition-all duration-500 rounded-lg" />
  
  {/* Subtle glow effect */}
  <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500 shadow-[0_0_10px_rgba(34,211,238,0.2)]" />
  
  <span className="relative z-10 group-hover:drop-shadow-sm transition-all duration-300">Host</span>
</Button>
                )}
                <div className="flex items-center gap-2 text-sm text-slate-300 font-medium bg-gradient-to-r from-slate-800/60 to-slate-700/40 px-2 py-0.5 rounded-lg border border-slate-700/30 backdrop-blur-sm">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  Session ID: <span className="text-cyan-300 font-mono">{id}</span>
                </div>
              </div>

              {/* Right side with enhanced video controls */}
              {videoHookReady && (
                <div className="flex items-center gap-2 animate-slideInRight">
                  <div className="flex items-center gap-1 p-1 bg-gradient-to-r from-slate-800/60 to-slate-700/40 rounded-xl border border-slate-700/30 backdrop-blur-sm">
                    <Tooltip title={videoHook.isMicOn ? 'Mute microphone' : 'Unmute microphone'} color="#0f172a">
                      <button
                        onClick={videoHook.toggleMic}
                        className={`p-2 rounded-lg transition-all duration-300 transform hover:scale-110 ${
                          videoHook.isMicOn 
                            ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg shadow-green-500/25' 
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        {videoHook.isMicOn ? <FaMicrophone size={12} /> : <FaMicrophoneSlash size={12} />}
                      </button>
                    </Tooltip>

                    <Tooltip title={videoHook.isCameraOn ? 'Turn camera off' : 'Turn camera on'} color="#0f172a">
                      <button
                        onClick={videoHook.toggleCamera}
                        className={`p-2 rounded-lg transition-all duration-300 transform hover:scale-110 ${
                          videoHook.isCameraOn 
                            ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg shadow-green-500/25' 
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        {videoHook.isCameraOn ? <FaVideo size={12} /> : <FaVideoSlash size={12} />}
                      </button>
                    </Tooltip>

                    <Tooltip title={videoHook.isScreenSharing ? 'Stop screen sharing' : 'Start screen sharing'} color="#0f172a">
                      <button
                        onClick={videoHook.handleToggleScreenShare}
                        className={`p-2 rounded-lg transition-all duration-300 transform hover:scale-110 ${
                          videoHook.isScreenSharing 
                            ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25' 
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        <FaDesktop size={12} />
                      </button>
                    </Tooltip>

                    <div className="h-4 w-px bg-slate-600 mx-1"></div>

                    <Tooltip title="End call for everyone" color="#0f172a">
                      <button
                        onClick={confirmEndCall}
                        className="p-2 rounded-lg bg-gradient-to-r from-rose-500 to-rose-600 text-white hover:from-rose-600 hover:to-rose-700 shadow-lg shadow-rose-500/20 transition-all duration-300 transform hover:scale-110"
                      >
                        <FaPhoneSlash size={12} />
                      </button>
                    </Tooltip>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Compact File Tab Bar */}
          {!showAiInMain && !showVideoInMain && !showWhiteboardInMain && Object.entries(state.files).length > 0 && (
            <div className={`flex flex-row bg-gradient-to-r from-slate-900/40 to-slate-800/30 border-b border-slate-800/50 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900 flex-shrink-0 backdrop-blur-sm transition-all duration-500 ${contentVisible ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'}`}>
              {Object.entries(state.files).map(([fileId, file], index) => (
                <div 
                  key={fileId} 
                  className={`flex items-center px-3 py-1.5 border-r border-slate-800/50 cursor-pointer transition-all duration-300 flex-shrink-0 hover:bg-slate-800/40 group ${
                    state.activeFileId === fileId 
                      ? 'bg-gradient-to-b from-slate-800 to-slate-800/80 text-white border-t-2 border-t-cyan-500 shadow-lg' 
                      : 'bg-transparent text-slate-400 hover:text-slate-200'
                  }`}
                  onClick={() => actions.handleTabChange(fileId)}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <span className="truncate max-w-xs text-xs font-medium transition-colors duration-300">{file.name}</span>
                  <button 
                    className="ml-2 text-slate-500 hover:text-slate-300 hover:bg-slate-700/60 rounded-full p-0.5 transition-all duration-300 opacity-0 group-hover:opacity-100 transform hover:scale-110 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      actions.handleFileClose(fileId);
                    }}
                    title="Close tab"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Enhanced Main Content Area with view transitions */}
          <div className={`flex-1 min-h-0 flex flex-col overflow-hidden transition-all duration-500 ${viewTransitioning ? 'opacity-50 scale-95' : 'opacity-100 scale-100'}`}>
            
            {/* Enhanced Editor Content */}
            {!showAiInMain && !showVideoInMain && !showWhiteboardInMain && (
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden animate-fadeIn">
                <CodeEditor
                 isSaving={isSaving}
        lastSaved={lastSaved}
        hasUnsavedChanges={hasUnsavedChanges}
                input={state.input}
                output={state.output}
                lang={state.lang}
                handleLang={actions.handleLang}
                handleRun={actions.handleRun}
                handleInput={actions.handleInput}
                runCodeDisabled={state.runCodeDisabled}
                roomMode={state.roomMode}
                projectLanguage={state.projectLanguage}
                sharedInputOutput={sharedInputOutput}
                
                // Sidebar control props
                onOpenSidebarPanel={handleOpenSidebarPanel}
                selectedNodeId={state.selectedNodeId}
                getExistingNames={getExistingNames}
                
                // Updated file/folder creation signatures
                onNewFile={(parentNodeId, fileName) => {
                  // Create file with the provided name
                  if (actions.createNewFile) {
                    actions.createNewFile(parentNodeId, fileName);
                  }
                }}
                onNewFolder={(parentNodeId, folderName) => {
                  // Create folder with the provided name
                  if (actions.createFolder) {
                    actions.createFolder(parentNodeId, folderName);
                  }
                }}
                  monaco={state.monaco}
                  editor={state.editor}
                  binding={state.binding}
                  activeFile={state.activeFileId ? state.files[state.activeFileId] : null}
                  
                  theme={state.theme}
                  fontSize={state.fontSize}
                  openFiles={state.files}
                  activeFileId={state.activeFileId}
                  onTabChange={actions.handleTabChange}
                  onEditorMount={actions.editorDidMount}
                  onEditorChange={actions.editorOnChange}
                  // onNewFile={actions.createNewFile}
                  // onNewFolder={actions.createFolder}
                  terminalVisible={terminalVisible}
                  onDownloadFile={actions.handleSaveCode}
                  onSaveToWorkspace={handleSaveToWorkspace}
                  onUploadFiles={actions.uploadFiles}
                  onUploadZip={actions.uploadZip}
                  onThemeChange={actions.handleThemeChange}
                  onFontFamilyChange={actions.handleFontFamilyChange}
                  onIncreaseFontSize={actions.increaseFontSize}
                  onDecreaseFontSize={actions.decreaseFontSize}
                  files={state.files}
                  fileTree={state.tree}
                  sidebarWidth={sidebarWidth}
                  isHost={state.isHost}
                  editingMode={state.config?.editing || 'open'}
                  openHostModal={openHostModal}
                  onTerminalOpen={openTerminalInWorkspace}
                />
              </div>
            )}

            {/* Enhanced Whiteboard in Main View */}
            {showWhiteboardInMain && dockedWhiteboard && (
              <div className="flex-1 min-h-0 overflow-hidden bg-gradient-to-b from-slate-900 to-slate-950 animate-slideInUp">
                <div className="w-full h-full flex flex-col">
                  {(() => {
                    const resolveBoardConfig = (boardId, passedConfig) => {
                      if (passedConfig && Object.keys(passedConfig).length > 0) return passedConfig;
                      if (state.whiteboardConfig && state.whiteboardConfig[boardId]) {
                        return state.whiteboardConfig[boardId];
                      }
                      try {
                        if (docRef && docRef.current && docRef.current.data && docRef.current.data.whiteboardConfig) {
                          const remote = docRef.current.data.whiteboardConfig[boardId];
                          if (remote) return remote;
                        }
                      } catch (e) {
                        // ignore
                      }
                      return passedConfig || {};
                    };

                    const dockCfg = resolveBoardConfig(dockedWhiteboard.boardId, dockedWhiteboard.boardConfig || {});

                    let canEdit = false;
                    if (dockCfg && dockCfg.isSharedNote) {
                      canEdit = (dockCfg.sharedFrom === userName);
                    } else if (dockCfg && dockCfg.isPrivateNote) {
                      if (dockCfg.createdBy && dockCfg.createdBy === userName) {
                        canEdit = true;
                      } else {
                        const privatePrefixes = ['private_', 'private-note', 'private-note_', 'private_note_', 'note_', 'note-'];
                        const looksLikePrivate = dockedWhiteboard.boardId && privatePrefixes.some(p => String(dockedWhiteboard.boardId).startsWith(p));
                        canEdit = !!looksLikePrivate;
                      }
                    } else if (state.isHost && !(dockCfg && dockCfg.isSharedNote)) {
                      canEdit = true;
                    } else if (dockCfg && (dockCfg.mode === 'public' || dockCfg.mode === 'everyone')) {
                      canEdit = true;
                    } else {
                      canEdit = false;
                    }

                    if (!(dockCfg && dockCfg.mode) && state.isHost && !(dockCfg && dockCfg.isSharedNote)) {
                      canEdit = true;
                    }

                    const boardName = (dockCfg && dockCfg.name) ? dockCfg.name : `Note ${String(dockedWhiteboard.boardId || '').substring(0, 8)}...`;

                    return (
                      <div className="w-full h-full">
                        <Whiteboard
                          sessionId={id}
                          boardId={dockedWhiteboard.boardId}
                          isReadOnly={!canEdit}
                          userName={userName}
                          boardName={boardName}
                          isHost={state.isHost}
                          boardConfig={dockCfg}
                          participants={(() => {
                            let participantNames = [];
                            
                            if (peers) {
                              if (peers instanceof Map) {
                                participantNames = Array.from(peers.values())
                                  .map(p => p?.userName || p?.name || p?.displayName)
                                  .filter(Boolean);
                              } else if (Array.isArray(peers)) {
                                participantNames = peers.map(p => p?.userName || p?.name || p?.displayName).filter(Boolean);
                              } else if (typeof peers === 'object') {
                                participantNames = Object.values(peers)
                                  .map(p => p?.userName || p?.name || p?.displayName)
                                  .filter(Boolean);
                              }
                            }
                            
                            const hostNames = state.hosts ? Array.from(state.hosts).filter(Boolean) : [];
                            const allParticipants = Array.from(new Set([
                              ...participantNames,
                              ...hostNames,
                              userName,
                              ...(state.config?.ownerName ? [state.config.ownerName] : [])
                            ])).filter(Boolean);
                            
                            return allParticipants;
                          })()}
                        />
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Enhanced AI Chatbot in Main View */}
            {showAiInMain && (
              <div className="flex-1 min-h-0 overflow-hidden animate-slideInRight">
                <AIChatbot
                  roomId={id}
                  userName={userName}
                  isEnabled={state.config?.enableAI !== false}
                  isHost={state.isHost}
                  aiInMain={showAiInMain}
                  onToggleMain={handleToggleAiDock}
                  isDocked={aiDocked}
                  onToggleDock={handleToggleAiDock}
                  showSummary={false}
                />
              </div>
            )}

            {/* Enhanced Video Grid in Main View */}
            {showVideoInMain && (
              <div className="flex-1 min-h-0 overflow-auto bg-gradient-to-b from-slate-900 to-slate-950 p-6 animate-slideInUp">
                <ParticipantsGrid
                  peers={peers}
                  localStream={localStream}
                  localPeerId={videoHook?.localPeerId}
                  localUserName={userName}
                  handlePinPeer={videoHook?.handlePinPeer}
                  handleSelfPin={videoHook?.handleSelfPin}
                  pinnedPeerId={videoHook?.pinnedPeerId}
                  compact={false}
                  playbackEnabled={playbackEnabled}
                  enablePlayback={enablePlayback}
                  toggleMic={videoHook?.toggleMic}
                  toggleCamera={videoHook?.toggleCamera}
                  isMicOn={videoHook?.isMicOn}
                  isCameraOn={videoHook?.isCameraOn}
                  handleToggleScreenShare={videoHook?.handleToggleScreenShare}
                  isScreenSharing={videoHook?.isScreenSharing}
                  handleEndCall={handleEndCall}
                  isLocalHost={state.isHost}
                  initialPinnedPosition={(state.config && state.config.pinnedObjectPosition) || 'center'}
                  initialPinnedAspectRatio={(state.config && state.config.pinnedAspectRatio) || '16/9'}
                  onPinnedSettingChange={({ objectPosition, aspectRatio }) => {
                    if (actions && typeof actions.updateConfig === 'function') {
                      actions.updateConfig({ pinnedObjectPosition: objectPosition, pinnedAspectRatio: aspectRatio });
                    }
                  }}
                  isDocked={videoDocked}
                  onToggleDock={handleToggleVideoDock}
                  showSummary={false}
                  enableVideo={enableVideo}
                />
              </div>
            )}

            {/* Enhanced Terminal Panel */}
            {!showAiInMain && !showVideoInMain && !showWhiteboardInMain && enableTerminal && (
              <div className={`flex-shrink-0 border-t border-slate-800/50 backdrop-blur-sm transition-all duration-500 ${terminalVisible ? 'animate-slideInUp' : ''}`}>
                <TerminalPanel
                  sessionId={id}
                  visible={terminalVisible}
                  height={terminalHeight}
                  onToggle={toggleTerminal}
                  onResize={handleTerminalResize}
                  onClose={() => toggleTerminal(false)}
                  isEditorMode={true}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      
{/* Enhanced Modals */}
<HostApprovalModal
  visible={showApprovalModal}
  operation={currentPendingOp}
  onApprove={(op) => { actions.approveOperation(op); setShowApprovalModal(false); setCurrentPendingOp(null); }}
  onReject={(op) => { actions.rejectOperation(op); setShowApprovalModal(false); setCurrentPendingOp(null); }}
  onCancel={() => setShowApprovalModal(false)}
/>

{/* Compact Host Controls Modal with Enhanced Buttons */}
<Modal
  title={
    <div className="flex items-center gap-2">
      <div className="terminal-toggle active">
        <FaCog className="terminal-icon" />
      </div>
      <span className="text-slate-100 font-semibold text-sm">Host Controls</span>
    </div>
  }
  open={hostModalVisible}
  onCancel={() => setHostModalVisible(false)}
  onOk={applyHostConfig}
  okText="Apply Changes"
  confirmLoading={configSaving}
  className="host-controls-modal compact-modal"
  width={600}
  transitionName="ant-zoom"
  maskTransitionName="ant-fade"
  styles={{
    body: { 
      padding: '16px 20px', 
      background: 'linear-gradient(180deg, rgba(15,23,42,0.95), rgba(7,17,26,0.95))', 
      color: '#e2e8f0',
      borderRadius: '0 0 16px 16px',
      backdropFilter: 'blur(20px)',
      maxHeight: '70vh',
      overflowY: 'auto',
      opacity: 0,
      transform: 'scale(0.95) translateY(-10px)',
      animation: 'modalEnter 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards'
    },
    header: {
      background: 'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(30,41,59,0.9))',
      borderBottom: '1px solid rgba(14, 165, 164, 0.15)',
      color: '#e2e8f0',
      borderRadius: '16px 16px 0 0',
      padding: '12px 20px',
      minHeight: 'auto',
      opacity: 0,
      transform: 'translateY(-10px)',
      animation: 'modalHeaderEnter 0.3s cubic-bezier(0.4, 0, 0.2, 1) 0.1s forwards'
    },
    content: {
      backgroundColor: 'transparent',
      backdropFilter: 'blur(20px)',
      borderRadius: '16px',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(14, 165, 164, 0.1)',
      border: 'none',
      opacity: 0,
      transform: 'scale(0.95)',
      animation: 'modalContentEnter 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards'
    },
    footer: {
      background: 'linear-gradient(180deg, rgba(15,23,42,0.8), rgba(7,17,26,0.9))',
      borderTop: '1px solid rgba(14, 165, 164, 0.1)',
      borderRadius: '0 0 16px 16px',
      padding: '16px 20px',
      marginTop: '8px'
    }
  }}
  okButtonProps={{
    className: 'modal-apply-btn',
    icon: configSaving ? <LoadingOutlined /> : <CheckCircleOutlined />
  }}
  cancelButtonProps={{
    className: 'modal-cancel-btn'
  }}
  footer={
    <div className="flex justify-end gap-3 pt-2">
      <button
        onClick={() => setHostModalVisible(false)}
        className="modal-cancel-btn"
        disabled={configSaving}
      >
        <span>Cancel</span>
      </button>
      <button
        onClick={applyHostConfig}
        className="modal-apply-btn"
        disabled={configSaving}
      >
        {configSaving ? (
          <>
            <LoadingOutlined className="animate-spin" />
            <span>Applying...</span>
          </>
        ) : (
          <>
            <CheckCircleOutlined />
            <span>Apply Changes</span>
          </>
        )}
      </button>
    </div>
  }
>
  {configDraft && (
    <div className="grid grid-cols-2 gap-3 max-h-none modal-content-inner">
      {[
        { label: 'Room Mode', key: 'roomMode', type: 'select', options: [
          { value: 'project', label: 'Project' },
          { value: 'polyglot', label: 'Playground' }
        ], current: configDraft.roomMode || state.roomMode },
        { label: 'Language', key: 'projectLanguage', type: 'select', options: [
          { value: 'cpp', label: 'C++' },
          { value: 'java', label: 'Java' },
          { value: 'python', label: 'Python' }
        ], current: configDraft.projectLanguage || state.projectLanguage },
        { label: 'AI Assistant', key: 'enableAI', type: 'switch', current: !!configDraft.enableAI },
        { label: 'Video Calls', key: 'enableVideo', type: 'switch', current: !!configDraft.enableVideo },
        { label: 'Text Chat', key: 'enableChat', type: 'switch', current: !!configDraft.enableChat },
        { label: 'Multi-file', key: 'multiFile', type: 'switch', current: !!configDraft.multiFile },
        { label: 'Shared I/O', key: 'sharedInputOutput', type: 'switch', current: !!configDraft.sharedInputOutput },
        { label: 'Code Execution', key: 'allowRun', type: 'switch', current: configDraft.allowRun !== false },
        { label: 'Host Notes', key: 'enableHostNotes', type: 'switch', current: !!configDraft.enableHostNotes },
        { label: 'Editing Mode', key: 'editing', type: 'select', options: [
          { value: 'open', label: 'Everyone' },
          { value: 'host-only', label: 'Host only' }
        ], current: configDraft.editing || 'open' }
      ].map((item, index) => (
        <div 
          key={item.key} 
          className="flex items-center justify-between p-2.5 rounded-lg bg-gradient-to-r from-slate-800/40 to-slate-700/30 border border-slate-700/30 backdrop-blur-sm transition-all duration-300 hover:border-cyan-500/30 hover:bg-slate-800/50 modal-item"
          style={{ 
            animationDelay: `${index * 25}ms`,
            opacity: 0,
            transform: 'translateY(10px)',
            animation: `modalItemEnter 0.4s cubic-bezier(0.4, 0, 0.2, 1) ${index * 25 + 200}ms forwards`
          }}
        >
          <div className="text-slate-300 font-medium text-xs">{item.label}</div>
          {item.type === 'select' ? (
            <Select 
              value={item.current}
              onChange={(v) => setConfigDraft(d => ({ ...d, [item.key]: v }))} 
              style={{ width: 120 }}
              size="small"
              className="compact-select"
              popupClassName="bg-slate-800 border-slate-700"
            >
              {item.options.map(opt => (
                <Option key={opt.value} value={opt.value} className="text-xs">{opt.label}</Option>
              ))}
            </Select>
          ) : (
            <Switch 
              checked={item.current}
              onChange={(val) => setConfigDraft(d => ({ ...d, [item.key]: val }))}
              size="small"
              className="bg-slate-700 transition-all duration-300"
              disabled={item.key === 'enableAI' && !state.isHost}
            />
          )}
        </div>
      ))}
    </div>
  )}
</Modal>

{/* Add these styles to your global CSS */}
<style jsx>{`
/* End Call Modal Specific Styles */
.end-call-modal .ant-modal-confirm-btns {
  display: flex !important;
  gap: 12px !important;
  justify-content: flex-end !important;
  margin-top: 20px !important;
  padding-top: 16px !important;
  border-top: 1px solid rgba(239, 68, 68, 0.1) !important;
}

.end-call-modal .ant-modal-confirm-body {
  padding: 0 !important;
}

.end-call-modal .ant-modal-confirm-body > .anticon {
  display: none !important;
}

.end-call-modal .ant-modal-confirm-body-wrapper {
  background: transparent !important;
}

/* End Call Button Styling */
.modal-end-call-btn {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 8px !important;
  padding: 8px 20px !important;
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.9), rgba(220, 38, 38, 0.8)) !important;
  border: 1px solid rgba(239, 68, 68, 0.3) !important;
  color: white !important;
  border-radius: 6px !important;
  font-size: 12px !important;
  font-weight: 500 !important;
  cursor: pointer !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
  backdrop-filter: blur(8px) !important;
  position: relative !important;
  overflow: hidden !important;
  min-width: 120px !important;
}

.modal-end-call-btn:hover {
  background: linear-gradient(135deg, rgba(239, 68, 68, 1), rgba(220, 38, 38, 0.9)) !important;
  border-color: rgba(239, 68, 68, 0.5) !important;
  transform: translateY(-2px) scale(1.05) !important;
  box-shadow: 0 8px 25px rgba(239, 68, 68, 0.4) !important;
}

.modal-end-call-btn::before {
  content: '' !important;
  position: absolute !important;
  top: 0 !important;
  left: -100% !important;
  width: 100% !important;
  height: 100% !important;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent) !important;
  transition: left 0.5s !important;
}

.modal-end-call-btn:hover::before {
  left: 100% !important;
}

.modal-cancel-btn {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 8px !important;
  padding: 8px 20px !important;
  background: rgba(30, 41, 59, 0.6) !important;
  border: 1px solid rgba(71, 85, 105, 0.3) !important;
  color: #94a3b8 !important;
  border-radius: 6px !important;
  font-size: 12px !important;
  font-weight: 500 !important;
  cursor: pointer !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
  backdrop-filter: blur(8px) !important;
  min-width: 80px !important;
}

.modal-cancel-btn:hover {
  background: rgba(51, 65, 85, 0.8) !important;
  border-color: rgba(100, 116, 139, 0.4) !important;
  color: #cbd5e1 !important;
  transform: translateY(-2px) scale(1.05) !important;
}

/* End call icon animation */
.end-call-modal .terminal-toggle {
  animation: pulseEndCall 1.5s ease-in-out infinite !important;
}

@keyframes pulseEndCall {
  0%, 100% { 
    transform: scale(1); 
    background: rgba(239, 68, 68, 0.1);
  }
  50% { 
    transform: scale(1.1); 
    background: rgba(239, 68, 68, 0.15);
  }
}

/* Warning section animation */
.end-call-modal .ant-modal-confirm-content {
  animation: fadeInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
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

/* Modal animations */
.end-call-modal .ant-modal-content {
  animation: modalContentEnter 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
}

@keyframes modalContentEnter {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

/* Button shimmer effect for confirm modal */

@keyframes modalContentEnter {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}


  .terminal-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 6px;
    background: transparent;
    border: 1px solid rgba(148, 163, 184, 0.08);
    color: #94a3b8;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    backdrop-filter: blur(4px);
  }

  .terminal-toggle:hover,
  .terminal-toggle.active {
    background: rgba(14, 165, 164, 0.08);
    border-color: rgba(14, 165, 164, 0.15);
    color: #0ea5a4;
  }

  .terminal-toggle.active {
    background: linear-gradient(135deg, rgba(14, 165, 164, 0.15), rgba(14, 116, 144, 0.1));
    border-color: rgba(14, 165, 164, 0.3);
  }

  .terminal-icon {
    font-size: 10px;
    transition: all 0.3s ease;
  }

  /* Enhanced Button Styles */
  .modal-apply-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 8px 20px;
    background: linear-gradient(135deg, rgba(14, 165, 164, 0.9), rgba(14, 116, 144, 0.8));
    border: 1px solid rgba(14, 165, 164, 0.3);
    color: white;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    backdrop-filter: blur(8px);
    position: relative;
    overflow: hidden;
    min-width: 120px;
  }

  .modal-apply-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, rgba(14, 165, 164, 1), rgba(14, 116, 144, 0.9));
    border-color: rgba(14, 165, 164, 0.5);
    transform: translateY(-1px);
    box-shadow: 0 8px 25px rgba(14, 165, 164, 0.3);
  }

  .modal-apply-btn:active:not(:disabled) {
    transform: translateY(0);
  }

  .modal-apply-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .modal-cancel-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 8px 20px;
    background: rgba(30, 41, 59, 0.6);
    border: 1px solid rgba(71, 85, 105, 0.3);
    color: #94a3b8;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    backdrop-filter: blur(8px);
    min-width: 100px;
  }

  .modal-cancel-btn:hover:not(:disabled) {
    background: rgba(51, 65, 85, 0.8);
    border-color: rgba(100, 116, 139, 0.4);
    color: #cbd5e1;
    transform: translateY(-1px);
  }

  .modal-cancel-btn:active:not(:disabled) {
    transform: translateY(0);
  }

  .modal-cancel-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Button shimmer effect */
  .modal-apply-btn::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
    transition: left 0.5s;
  }

  .modal-apply-btn:hover::before {
    left: 100%;
  }

  @keyframes modalEnter {
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  @keyframes modalHeaderEnter {
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes modalContentEnter {
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  @keyframes modalItemEnter {
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .host-controls-modal .ant-modal-content {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .modal-content-inner {
    opacity: 0;
    animation: modalContentInner 0.3s ease 0.2s forwards;
  }

  @keyframes modalContentInner {
    to {
      opacity: 1;
    }
  }
`}</style>

{/* Add these styles to your global CSS */}
<style jsx>{`
  .terminal-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 6px;
    background: transparent;
    border: 1px solid rgba(148, 163, 184, 0.08);
    color: #94a3b8;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    backdrop-filter: blur(4px);
  }

  .terminal-toggle:hover,
  .terminal-toggle.active {
    background: rgba(14, 165, 164, 0.08);
    border-color: rgba(14, 165, 164, 0.15);
    color: #0ea5a4;
  }

  .terminal-toggle.active {
    background: linear-gradient(135deg, rgba(14, 165, 164, 0.15), rgba(14, 116, 144, 0.1));
    border-color: rgba(14, 165, 164, 0.3);
  }

  .terminal-icon {
    font-size: 10px;
    transition: all 0.3s ease;
  }

  @keyframes modalEnter {
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  @keyframes modalHeaderEnter {
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes modalContentEnter {
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  @keyframes modalItemEnter {
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .host-controls-modal .ant-modal-content {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .modal-content-inner {
    opacity: 0;
    animation: modalContentInner 0.3s ease 0.2s forwards;
  }

  @keyframes modalContentInner {
    to {
      opacity: 1;
    }
  }
`}</style>

      {/* Enhanced CSS Styles */}
      <style jsx>{`
        /* Enhanced Animations */
        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(30px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes slideInLeft {
          from {
            opacity: 0;
            transform: translateX(-30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.98);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes spin-reverse {
          to {
            transform: rotate(-360deg);
          }
        }

        .animate-slideInUp {
          animation: slideInUp 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .animate-slideInLeft {
          animation: slideInLeft 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .animate-slideInRight {
          animation: slideInRight 0.5s cubic-bezier(0.4, 0, 0.2, 1) 0.1s both;
        }

        .animate-fadeIn {
          animation: fadeIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .animate-spin {
          animation: spin 1s linear infinite;
        }

        .animate-spin-reverse {
          animation: spin-reverse 2s linear infinite;
        }

        /* Enhanced Modal Styling */
        :global(.enhanced-modal .ant-modal-content) {
          background: linear-gradient(180deg, rgba(15,23,42,0.95), rgba(7,17,26,0.95)) !important;
          border: 1px solid rgba(14, 165, 164, 0.1) !important;
          border-radius: 16px !important;
          backdrop-filter: blur(20px) !important;
          box-shadow: 
            0 25px 50px -12px rgba(0, 0, 0, 0.6),
            0 0 0 1px rgba(14, 165, 164, 0.1),
            inset 0 1px 0 rgba(255, 255, 255, 0.05) !important;
        }

        :global(.enhanced-modal .ant-modal-header) {
          background: linear-gradient(135deg, rgba(15,23,42,0.95), rgba(30,41,59,0.9)) !important;
          border-bottom: 1px solid rgba(14, 165, 164, 0.15) !important;
          border-radius: 16px 16px 0 0 !important;
        }

        :global(.enhanced-modal .ant-modal-title) {
          color: #f1f5f9 !important;
          font-weight: 600 !important;
          font-size: 18px !important;
          display: flex !important;
          align-items: center !important;
          gap: 12px !important;
        }

        :global(.enhanced-modal .ant-modal-title::before) {
          content: '⚙️' !important;
          font-size: 20px !important;
        }

        /* Compact Select Styling */
        :global(.compact-select .ant-select-selector) {
          background: linear-gradient(135deg, rgba(15,23,42,0.8), rgba(30,41,59,0.6)) !important;
          border: 1px solid rgba(14, 165, 164, 0.2) !important;
          border-radius: 6px !important;
          color: #e2e8f0 !important;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
          min-height: 24px !important;
          font-size: 11px !important;
        }

        :global(.compact-select:hover .ant-select-selector) {
          border-color: rgba(14, 165, 164, 0.4) !important;
          box-shadow: 0 0 0 2px rgba(14, 165, 164, 0.1) !important;
        }

        :global(.compact-select.ant-select-focused .ant-select-selector) {
          border-color: rgba(14, 165, 164, 0.6) !important;
          box-shadow: 0 0 0 2px rgba(14, 165, 164, 0.15) !important;
        }

        :global(.compact-select .ant-select-selection-item) {
          font-size: 11px !important;
          line-height: 1.2 !important;
        }

        /* Compact Modal Styling */
        :global(.compact-modal .ant-modal-content) {
          background: linear-gradient(180deg, rgba(15,23,42,0.95), rgba(7,17,26,0.95)) !important;
          border: 1px solid rgba(14, 165, 164, 0.1) !important;
          border-radius: 16px !important;
          backdrop-filter: blur(20px) !important;
          box-shadow: 
            0 25px 50px -12px rgba(0, 0, 0, 0.6),
            0 0 0 1px rgba(14, 165, 164, 0.1),
            inset 0 1px 0 rgba(255, 255, 255, 0.05) !important;
        }

        :global(.compact-modal .ant-modal-header) {
          background: linear-gradient(135deg, rgba(15,23,42,0.95), rgba(30,41,59,0.9)) !important;
          border-bottom: 1px solid rgba(14, 165, 164, 0.15) !important;
          border-radius: 16px 16px 0 0 !important;
          padding: 12px 20px !important;
          min-height: auto !important;
        }

        :global(.compact-modal .ant-modal-title) {
          color: #f1f5f9 !important;
          font-weight: 600 !important;
          font-size: 14px !important;
          line-height: 1.4 !important;
        }

        :global(.compact-modal .ant-modal-body) {
          padding: 16px 20px !important;
          max-height: 70vh !important;
          overflow-y: auto !important;
        }

        :global(.compact-modal .ant-modal-footer) {
          padding: 12px 20px !important;
          border-top: 1px solid rgba(14, 165, 164, 0.1) !important;
          background: transparent !important;
        }

        /* Enhanced Switch Styling for Compact Mode */
        :global(.ant-switch-small) {
          min-width: 28px !important;
          height: 16px !important;
          line-height: 14px !important;
        }

        :global(.ant-switch-small .ant-switch-handle) {
          width: 12px !important;
          height: 12px !important;
          top: 2px !important;
        }

        :global(.ant-switch-small.ant-switch-checked .ant-switch-handle) {
          left: calc(100% - 12px - 2px) !important;
        }

        /* Enhanced Switch Styling */
        :global(.ant-switch) {
          background: rgba(71, 85, 105, 0.8) !important;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }

        :global(.ant-switch-checked) {
          background: linear-gradient(135deg, #0ea5a4, #0891b2) !important;
        }

        :global(.ant-switch:hover) {
          box-shadow: 0 0 0 2px rgba(14, 165, 164, 0.1) !important;
        }

        /* Enhanced Dropdown Styling */
        :global(.ant-select-dropdown) {
          background: linear-gradient(180deg, rgba(15,23,42,0.95), rgba(7,17,26,0.95)) !important;
          border: 1px solid rgba(14, 165, 164, 0.2) !important;
          border-radius: 12px !important;
          backdrop-filter: blur(20px) !important;
          box-shadow: 0 20px 40px rgba(2,6,23,0.6) !important;
        }

        :global(.ant-select-item) {
          color: #e2e8f0 !important;
          transition: all 0.2s ease !important;
          border-radius: 8px !important;
          margin: 4px 8px !important;
        }

        :global(.ant-select-item:hover) {
          background: linear-gradient(90deg, rgba(14, 165, 164, 0.15), rgba(14, 165, 164, 0.1)) !important;
          color: #0ea5a4 !important;
        }

        :global(.ant-select-item-option-selected) {
          background: linear-gradient(90deg, rgba(14, 165, 164, 0.2), rgba(14, 165, 164, 0.15)) !important;
          color: #0ea5a4 !important;
          font-weight: 600 !important;
        }

        /* Enhanced Button Styling */
        :global(.ant-btn-primary) {
          background: linear-gradient(135deg, #0ea5a4, #0891b2) !important;
          border: none !important;
          border-radius: 10px !important;
          font-weight: 600 !important;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
          box-shadow: 0 4px 12px rgba(14, 165, 164, 0.3) !important;
        }

        :global(.ant-btn-primary:hover) {
          background: linear-gradient(135deg, #0891b2, #0e7490) !important;
          transform: translateY(-2px) scale(1.02) !important;
          box-shadow: 0 8px 25px rgba(14, 165, 164, 0.4) !important;
        }

        :global(.ant-btn-default) {
          background: rgba(71, 85, 105, 0.8) !important;
          border: 1px solid rgba(148, 163, 184, 0.3) !important;
          border-radius: 10px !important;
          color: #e2e8f0 !important;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }

        :global(.ant-btn-default:hover) {
          background: rgba(71, 85, 105, 1) !important;
          border-color: rgba(148, 163, 184, 0.5) !important;
          color: #f1f5f9 !important;
          transform: translateY(-1px) !important;
        }

        /* Enhanced Scrollbar */
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        ::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.5);
          border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, rgba(14, 165, 164, 0.3), rgba(14, 165, 164, 0.6));
          border-radius: 4px;
          border: 1px solid rgba(14, 165, 164, 0.1);
          transition: all 0.3s ease;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, rgba(14, 165, 164, 0.5), rgba(14, 165, 164, 0.8));
          box-shadow: 0 0 10px rgba(14, 165, 164, 0.3);
        }

        /* Enhanced Notifications */
        :global(.ant-notification-notice) {
          background: linear-gradient(135deg, rgba(15,23,42,0.95), rgba(30,41,59,0.9)) !important;
          border: 1px solid rgba(14, 165, 164, 0.2) !important;
          border-radius: 12px !important;
          backdrop-filter: blur(20px) !important;
          box-shadow: 0 8px 25px rgba(2,6,23,0.4) !important;
        }

        :global(.ant-notification-notice-message) {
          color: #f1f5f9 !important;
          font-weight: 600 !important;
        }

        :global(.ant-notification-notice-description) {
          color: #cbd5e1 !important;
        }

        /* Performance Optimizations */
        * {
          will-change: auto;
        }

        .transition-all {
          will-change: transform, opacity, background-color, border-color, box-shadow;
        }

        /* Enhanced Focus States */
        button:focus-visible,
        .ant-btn:focus-visible {
          outline: 2px solid rgba(14, 165, 164, 0.6) !important;
          outline-offset: 2px !important;
        }

        /* Selection Styling */
        ::selection {
          background: rgba(14, 165, 164, 0.3);
          color: #f1f5f9;
        }

        /* Loading State Enhancements */
        .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.7;
          }
        }
      `}</style>
    </>
  );
};

const EditorPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const userName = sessionStorage.getItem('codecrew-username');

  useEffect(() => {
    if (!userName) {
      notification.warning({ message: 'Please enter a name to join the session.' });
      navigate(`/lobby/${id}`);
    }
  }, [userName, id, navigate]);

  if (!userName) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-black flex items-center justify-center">
        <div className="text-center animate-slideInUp">
          <div className="relative mb-6">
            <div className="w-16 h-16 border-2 border-cyan-400/20 border-t-cyan-400 rounded-full animate-spin mx-auto"></div>
            <div className="absolute inset-0 w-16 h-16 border-2 border-transparent border-r-cyan-300/40 rounded-full animate-spin-reverse mx-auto"></div>
          </div>
          <div className="space-y-2">
            <div className="text-cyan-400 text-lg font-semibold">Joining Session...</div>
            <div className="text-slate-400 text-sm">Preparing your entry to the workspace</div>
          </div>
        </div>
      </div>
    );
  }

  return <EditorPageContent id={id} userName={userName} />;
};

export default EditorPage;
