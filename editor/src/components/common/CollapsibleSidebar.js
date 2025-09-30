// Enhanced CollapsibleSidebar.js - Matching design aesthetic with other components
import React, { useState, useEffect, useCallback } from 'react';
import { Tooltip } from 'antd';
import {
  VscFiles,
  VscAccount,
  VscCommentDiscussion,
  VscChevronLeft,
  VscChevronRight,
  VscPlay,
  VscDeviceCameraVideo, 
} from 'react-icons/vsc';
import {
  RobotOutlined,
  CompressOutlined
} from "@ant-design/icons";
import { Resizable } from 're-resizable';
import FileTree from './FileTree';
import ParticipantsList from './ParticipantsList';
import ParticipantsGrid from './ParticipantsGrid';
import ChatPanel from './ChatPanel';
import SidePanel from './SidePanel';
import { VscSparkle } from 'react-icons/vsc';
import AIChatbot from './AIChatbot';
import PropTypes from 'prop-types';
import { FaChalkboardTeacher } from 'react-icons/fa';
import WhiteboardPanel from './WhiteboardPanel';

const AIDockedSummary = ({ messages, onToggleDock, userName, roomId }) => {
  return (
    <>
      <div className="ai-docked-summary animate-slideInUp">
        <div className="ai-docked-header">
          <div className="ai-docked-icon-container">
            <RobotOutlined className="ai-docked-icon" />
          </div>
          <span className="ai-docked-title">AI Assistant (Docked)</span>
        </div>
        
        <div className="ai-docked-content">
          <div className="ai-status-card">
            <div className="status-indicator"></div>
            <span className="status-text">Ready to assist</span>
          </div>
        </div>

        <button 
          className="ai-undock-btn group"
          onClick={onToggleDock}
        >
          <CompressOutlined className="undock-icon" />
          <span>Undock to Sidebar</span>
        </button>
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

        .animate-slideInUp {
          animation: slideInUp 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .ai-docked-summary {
          padding: 20px;
          height: 100%;
          display: flex;
          flex-direction: column;
          background: linear-gradient(180deg, #0a1628 0%, #0f172a 100%);
          color: #e2e8f0;
          position: relative;
          overflow: hidden;
        }

        .ai-docked-summary::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: radial-gradient(circle at top right, rgba(14, 165, 164, 0.02), transparent 60%);
          pointer-events: none;
          z-index: 0;
        }

        .ai-docked-summary > * {
          position: relative;
          z-index: 1;
        }
        
        .ai-docked-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
          padding-bottom: 16px;
          border-bottom: 1px solid rgba(14, 165, 164, 0.08);
        }

        .ai-docked-icon-container {
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
        
        .ai-docked-icon {
          color: #0ea5a4;
          font-size: 16px;
          filter: drop-shadow(0 0 6px rgba(14, 165, 164, 0.2));
        }
        
        .ai-docked-title {
          color: #f1f5f9;
          font-weight: 600;
          font-size: 14px;
          letter-spacing: 0.3px;
        }

        .ai-docked-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .ai-status-card {
          background: linear-gradient(135deg, rgba(15,23,42,0.4), rgba(12,18,28,0.3));
          border: 1px solid rgba(14, 165, 164, 0.06);
          border-radius: 12px;
          padding: 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          transition: all 0.3s ease;
          backdrop-filter: blur(8px);
        }

        .ai-status-card:hover {
          background: linear-gradient(135deg, rgba(15,23,42,0.6), rgba(12,18,28,0.4));
          border-color: rgba(14, 165, 164, 0.12);
          transform: translateY(-1px);
        }

        .status-indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: linear-gradient(135deg, #0ea5a4, #0891b2);
          animation: pulse 3s infinite;
        }

        .status-text {
          font-size: 13px;
          color: #cbd5e1;
          font-weight: 500;
        }
        
        .ai-undock-btn {
          background: linear-gradient(135deg, rgba(14, 165, 164, 0.1), rgba(14, 116, 144, 0.1));
          border: 1px solid rgba(14, 165, 164, 0.15);
          color: #0ea5a4;
          padding: 12px 16px;
          border-radius: 10px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          margin-top: auto;
          backdrop-filter: blur(8px);
        }
        
        .ai-undock-btn:hover {
          background: linear-gradient(135deg, rgba(14, 165, 164, 0.2), rgba(14, 116, 144, 0.2));
          border-color: rgba(14, 165, 164, 0.3);
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(14, 165, 164, 0.15);
        }

        .undock-icon {
          transition: all 0.3s ease;
        }

        .ai-undock-btn.group:hover .undock-icon {
          transform: scale(1.1);
        }
      `}</style>
    </>
  );
};

const CollapsibleSidebar = ({
  state,
  actions,
  id,
  userName,
  ownerName,
  enableVideo,
  enableChat,
  peers,
  localUserName,
  localStream,
  toggleMic,
  toggleCamera,
  isMicOn,
  isCameraOn,
  videoHook,
  playbackEnabled,
  enablePlayback,
  input,
  output,
  lang,
  handleLang,
  handleRun,
  handleInput,
  runCodeDisabled,
  roomMode,
  projectLanguage,
  sharedInputOutput,
  onPromoteToHost,
  onKickParticipant,
  isLocalHost,
  onUploadDone,
  handleEndCall,
  onSidebarResize,
  enableAI = true,
  onToggleMain = () => {},
  forceCollapsed = false,
  forceExpanded = false,
  onToggleAiDock = () => {},
  showAiInMain = false,
  aiDocked = false,
  videoDocked = false,
  onToggleVideoDock = () => {},
  showVideoInMain = false,
  docRef,
  participants,
  onDockWhiteboard,
  enableHostNotes,
  terminalVisible,
  onToggleTerminal
}) => {
  const [activePanel, setActivePanel] = useState(() => {
    const saved = sessionStorage.getItem('codecrew-active-panel');
    return saved || 'files';
  });
  const [isExpanded, setIsExpanded] = useState(() => {
    const saved = sessionStorage.getItem('codecrew-sidebar-expanded');
    return saved !== null ? saved === 'true' : true;
  });
  const [unreadCount, setUnreadCount] = useState(0);
  const [sidebarWidth, setSidebarWidth] = useState(310);
  const [maxSidebarWidth, setMaxSidebarWidth] = useState(Math.round(window.innerWidth * 0.7));

  useEffect(() => {
    const onResize = () => setMaxSidebarWidth(Math.round(window.innerWidth * 0.7));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!enableAI && activePanel === 'ai') {
      setActivePanel(null);
    }
  }, [enableAI, activePanel]);

  useEffect(() => {
    if (!enableHostNotes && activePanel === 'whiteboard') {
      setActivePanel(null);
      setIsExpanded(false);
      sessionStorage.setItem('codecrew-sidebar-expanded', 'false');
    }
  }, [enableHostNotes, activePanel]);

  useEffect(() => {
    if (forceCollapsed) {
      setIsExpanded(false);
    }
  }, [forceCollapsed]);

  useEffect(() => {
    if (forceExpanded) {
      setIsExpanded(true);
    }
  }, [forceExpanded]);

  useEffect(() => {
    if (typeof onSidebarResize === 'function') {
      onSidebarResize(sidebarWidth, isExpanded);
    }
  }, [sidebarWidth, isExpanded, onSidebarResize]);

  const togglePanel = (panel) => {
    if (activePanel === panel && isExpanded) {
      setIsExpanded(false);
      sessionStorage.setItem('codecrew-sidebar-expanded', 'false');
    } else {
      setActivePanel(panel);
      sessionStorage.setItem('codecrew-active-panel', panel);
      setIsExpanded(true);
      sessionStorage.setItem('codecrew-sidebar-expanded', 'true');
      if (panel === 'chat') {
        setUnreadCount(0);
      }
    }
  };

  const handleUnreadChange = useCallback((count) => {
    setUnreadCount(count);
  }, []);

  const handleDockWhiteboard = useCallback((boardId, boardType, boardConfig = null) => {
    if (onDockWhiteboard) {
      onDockWhiteboard(boardId, boardType, boardConfig);
    }
  }, [onDockWhiteboard]);

  const buildParticipantNames = () => {
    let arr = [];
    if (peers) {
      if (peers instanceof Map) {
        arr = Array.from(peers.values());
      } else if (Array.isArray(peers)) {
        arr = peers;
      } else if (typeof peers === 'object') {
        arr = Object.values(peers);
      }
    }

    const names = arr
      .map(p => (p && (p.userName || p.name || p.displayName || p.username)) || '')
      .filter(Boolean);

    const hostNames = state.hosts ? Array.from(state.hosts).filter(h => !!h) : [];
    const all = Array.from(new Set([...names, ...hostNames, userName].filter(Boolean)));

    return all.filter(n => n !== userName);
  };

  const handleSetIsExpanded = (expanded) => {
    setIsExpanded(expanded);
    sessionStorage.setItem('codecrew-sidebar-expanded', expanded.toString());
  };

  // Panel configuration with icons and labels
  const panels = [
    { key: 'files', icon: VscFiles, label: 'Files', tooltip: 'Explorer' },
    { key: 'compiler', icon: VscPlay, label: 'Compiler', tooltip: 'Compiler' },
    { key: 'participants', icon: VscAccount, label: 'Participants', tooltip: 'Participants' },
    ...(enableHostNotes ? [{ key: 'whiteboard', icon: FaChalkboardTeacher, label: 'Whiteboard', tooltip: 'Whiteboard' }] : []),
    ...(enableAI ? [{ key: 'ai', icon: VscSparkle, label: 'AI Assistant', tooltip: 'AI Assistant' }] : []),
    ...(enableVideo ? [{ key: 'video', icon: VscDeviceCameraVideo, label: 'Video Chat', tooltip: 'Video Chat' }] : []),
    ...(enableChat ? [{ key: 'chat', icon: VscCommentDiscussion, label: 'Chat', tooltip: 'Chat' }] : [])
  ];

  const getPanelTitle = () => {
    const panel = panels.find(p => p.key === activePanel);
    return panel ? panel.label : 'Panel';
  };

  const getPanelIcon = () => {
    const panel = panels.find(p => p.key === activePanel);
    return panel ? panel.icon : VscFiles;
  };

  return (
    <>
      <div className="sidebar-container">
        {/* Sidebar Tab Bar */}
        <div className="sidebar-tabs">
          <div className="tab-buttons">
            {panels.map((panel, index) => {
              const IconComponent = panel.icon;
              const isActive = activePanel === panel.key && isExpanded;
              
              return (
                <Tooltip key={panel.key} title={panel.tooltip} placement="right" color="#0f172a">
                  <button
                    className={`tab-button ${isActive ? 'tab-active' : ''}`}
                    onClick={() => togglePanel(panel.key)}
                    style={{
                      animationDelay: `${index * 0.05}s`
                    }}
                  >
                    <IconComponent className="tab-icon" />
                    {panel.key === 'chat' && unreadCount > 0 && (
                      <span className="unread-badge">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>
                </Tooltip>
              );
            })}
          </div>

          <div className="tab-controls">
            <Tooltip 
              title={isExpanded ? "Collapse sidebar" : "Expand sidebar"} 
              placement="right" 
              color="#0f172a"
            >
              <button
                className="toggle-button group"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? (
                  <VscChevronLeft className="toggle-icon" />
                ) : (
                  <VscChevronRight className="toggle-icon" />
                )}
              </button>
            </Tooltip>
          </div>
        </div>

        {/* Expandable Content Panel */}
        {isExpanded && (
          <Resizable
            style={{ flexShrink: 0 }}
            size={{ width: sidebarWidth, height: '100%' }}
            maxWidth={maxSidebarWidth}
            minWidth={280}
            enable={{ right: true }}
            onResizeStop={(e, direction, ref, d) => {
              setSidebarWidth(w => {
                const next = w + d.width;
                const clamped = Math.max(280, Math.min(maxSidebarWidth, next));
                if (typeof onSidebarResize === 'function') onSidebarResize(clamped);
                return clamped;
              });
            }}
            handleStyles={{
              right: {
                width: '6px',
                right: '-3px',
                cursor: 'col-resize',
                backgroundColor: 'rgba(14, 165, 164, 0.2)',
                borderRadius: '3px',
                transition: 'background-color 0.3s ease'
              }
            }}
            className="sidebar-content-wrapper"
          >
            <div className="sidebar-content animate-slideInRight">
              {/* Panel Header */}
              <div className="panel-header">
                <div className="panel-title-section">
                  <div className="panel-icon-container">
                    {React.createElement(getPanelIcon(), { className: "panel-icon" })}
                  </div>
                  <h2 className="panel-title">{getPanelTitle()}</h2>
                </div>
              </div>

              {/* Panel Body */}
              <div className="panel-body">
                {activePanel === 'files' && (
                  <div className="panel-content animate-fadeInUp">
                    <FileTree
                      tree={state.tree}
                      selectedNodeId={state.selectedNodeId}
                      onSelectNode={actions.selectNode}
                      onCreateFile={actions.createNewFile}
                      onCreateFolder={actions.createFolder}
                      onRenameNode={actions.renameNode}
                      onDeleteNode={actions.deleteNode}
                      onFileClick={actions.handleTabChange}
                      activeFileId={state.activeFileId}
                      onMoveNode={actions.moveNode}
                      editingMode={state.config?.editing || 'open'} // Pass editing mode
  isHost={state.isHost} // Pass host status
                      
                    />
                  </div>
                )}

                {activePanel === 'participants' && (
                  <div className="panel-content animate-fadeInUp">
                    <ParticipantsList
                      peers={peers}
                      localUserName={localUserName || userName}
                      ownerName={ownerName || state.config?.ownerName}
                      onPromoteToHost={(targetName, peerId) => actions.promoteToHost(targetName)}
                      onKickParticipant={(targetName, peerId) => actions.kickParticipant(targetName, peerId)}
                      isLocalHost={isLocalHost}
                    />
                  </div>
                )}

                {activePanel === 'ai' && (
                  <div className="panel-content animate-fadeInUp">
                    {showAiInMain ? (
                      <AIDockedSummary
                        messages={state.aiMessages || []}
                        onToggleDock={onToggleAiDock}
                        userName={userName}
                        roomId={id}
                      />
                    ) : (
                      <AIChatbot
                        roomId={id}
                        userName={userName}
                        isEnabled={state.config?.enableAI !== false}
                        onToggle={(enabled) => {
                          if (actions && typeof actions.updateConfig === 'function') {
                            actions.updateConfig({ enableAI: enabled });
                          }
                        }}
                        sidebarWidth={sidebarWidth}
                        isHost={state.isHost}
                        aiInMain={showAiInMain}
                        onToggleMain={onToggleAiDock}
                        isDocked={aiDocked}
                        onToggleDock={onToggleAiDock}
                        showSummary={false}
                      />
                    )}
                  </div>
                )}

                {activePanel === 'compiler' && (
                  <div className="panel-content animate-fadeInUp full-height">
                    <SidePanel
                      input={input}
                      output={output}
                      lang={lang}
                      handleLang={handleLang}
                      handleRun={handleRun}
                      handleInput={handleInput}
                      runCodeDisabled={runCodeDisabled}
                      roomMode={roomMode}
                      projectLanguage={projectLanguage}
                      sharedInputOutput={sharedInputOutput}
                      terminalVisible={terminalVisible}
                      onToggleTerminal={onToggleTerminal}
                    />
                  </div>
                )}

                {activePanel === 'whiteboard' && (
                  <div className="panel-content animate-fadeInUp">
                    <WhiteboardPanel
                      sessionId={id}
                      userName={userName}
                      isHost={isLocalHost}
                      whiteboardConfig={state.whiteboardConfig || {}}
                      whiteboards={state.whiteboards || {}}
                      onCreateBoard={async (name, mode, initialSnapshot) => {
                        if (actions && typeof actions.createWhiteboard === 'function') {
                          return await actions.createWhiteboard(name, mode, initialSnapshot);
                        } else {
                          console.error('createWhiteboard action not available');
                          return { success: false, error: 'Create board action not available' };
                        }
                      }}
                      onUpdateBoardConfig={async (boardId, updates) => {
                        if (actions && typeof actions.updateWhiteboardConfig === 'function') {
                          return await actions.updateWhiteboardConfig(boardId, updates);
                        } else {
                          console.error('updateWhiteboardConfig action not available');
                          return false;
                        }
                      }}
                      onDeleteBoard={async (boardId) => {
                        if (actions && typeof actions.deleteWhiteboard === 'function') {
                          return await actions.deleteWhiteboard(boardId);
                        } else {
                          console.error('deleteWhiteboard action not available');
                          return false;
                        }
                      }}
                      participants={buildParticipantNames()}
                      docRef={docRef}
                      config={state.config || {}}
                      hosts={state.hosts || new Set()}
                      onDockWhiteboard={handleDockWhiteboard}
                    />
                  </div>
                )}

                {activePanel === 'video' && enableVideo && (
                  <div className="panel-content animate-fadeInUp">
                    <ParticipantsGrid
                      peers={peers}
                      localStream={localStream}
                      localPeerId={videoHook?.localPeerId}
                      localUserName={localUserName || userName}
                      handlePinPeer={videoHook?.handlePinPeer}
                      handleSelfPin={videoHook?.handleSelfPin}
                      pinnedPeerId={videoHook?.pinnedPeerId}
                      compact={true}
                      playbackEnabled={playbackEnabled}
                      enablePlayback={enablePlayback}
                      toggleMic={toggleMic}
                      toggleCamera={toggleCamera}
                      isMicOn={isMicOn}
                      isCameraOn={isCameraOn}
                      handleToggleScreenShare={videoHook?.handleToggleScreenShare}
                      isScreenSharing={videoHook?.isScreenSharing}
                      sidebarWidth={sidebarWidth}
                      handleEndCall={handleEndCall}
                      isLocalHost={isLocalHost}
                      initialPinnedPosition={(state.config && state.config.pinnedObjectPosition) || 'center'}
                      initialPinnedAspectRatio={(state.config && state.config.pinnedAspectRatio) || '16/9'}
                      onPinnedSettingChange={({ objectPosition, aspectRatio }) => {
                        if (actions && typeof actions.updateConfig === 'function') {
                          actions.updateConfig({ pinnedObjectPosition: objectPosition, pinnedAspectRatio: aspectRatio });
                        }
                      }}
                      isDocked={videoDocked}
                      onToggleDock={onToggleVideoDock}
                      showSummary={showVideoInMain}
                      pageSizeOverride={2}
                      onGlobalVideoQualityChange={videoHook?.setGlobalVideoQuality}
                      onPinnedVideoQualityChange={(q) => videoHook?.setPinnedVideoQuality(videoHook?.pinnedPeerId, q)}
                      enableVideo={enableVideo}
                    />
                  </div>
                )}

                {activePanel === 'chat' && enableChat && (
                  <div className="panel-content animate-fadeInUp">
                    <ChatPanel
                      roomId={id}
                      userName={userName}
                      ownerName={ownerName}
                      onUploadDone={onUploadDone}
                      onUnreadChange={handleUnreadChange}
                      embedded={true}
                    />
                  </div>
                )}
              </div>
            </div>
          </Resizable>
        )}
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

        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
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

        .animate-slideInRight {
          animation: slideInRight 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .animate-fadeInUp {
          animation: fadeInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        /* Main Container */
        .sidebar-container {
          display: flex;
          height: 100%;
          flex-shrink: 0;
          font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
        }

        /* Sidebar Tabs */
        .sidebar-tabs {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 16px 0;
          width: 48px;
          background: linear-gradient(180deg, #0a1628 0%, #0f172a 100%);
          border-right: 1px solid rgba(14, 165, 164, 0.08);
          position: relative;
          overflow: hidden;
        }

        .sidebar-tabs::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: radial-gradient(circle at center, rgba(14, 165, 164, 0.02), transparent 60%);
          pointer-events: none;
          z-index: 0;
        }

        .sidebar-tabs > * {
          position: relative;
          z-index: 1;
        }

        .tab-buttons {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          flex: 1;
        }

        .tab-button {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: transparent;
          border: 1px solid rgba(148, 163, 184, 0.08);
          color: #94a3b8;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          backdrop-filter: blur(4px);
          animation: slideInUp 0.6s cubic-bezier(0.4, 0, 0.2, 1);
          animation-fill-mode: both;
        }

        .tab-button:hover {
          background: rgba(14, 165, 164, 0.08);
          border-color: rgba(14, 165, 164, 0.15);
          color: #0ea5a4;
          transform: translateY(-2px) scale(1.05);
          box-shadow: 0 4px 12px rgba(14, 165, 164, 0.15);
        }

        .tab-button.tab-active {
          background: linear-gradient(135deg, rgba(14, 165, 164, 0.15), rgba(14, 116, 144, 0.1));
          border-color: rgba(14, 165, 164, 0.3);
          color: #0ea5a4;
          box-shadow: 0 2px 8px rgba(14, 165, 164, 0.2);
        }

        .tab-icon {
          width: 16px;
          height: 16px;
          transition: all 0.3s ease;
          filter: drop-shadow(0 0 4px rgba(14, 165, 164, 0.1));
        }

        .tab-button:hover .tab-icon,
        .tab-button.tab-active .tab-icon {
          transform: scale(1.1);
          filter: drop-shadow(0 0 8px rgba(14, 165, 164, 0.3));
        }

        .tab-button.tab-active .tab-icon {
          animation: iconBounce 0.6s ease;
        }

        .unread-badge {
          position: absolute;
          top: -4px;
          right: -4px;
          width: 16px;
          height: 16px;
          border-radius: 8px;
          background: linear-gradient(135deg, #ef4444, #dc2626);
          color: white;
          font-size: 9px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
          animation: pulse 2s infinite;
        }

        .tab-controls {
          margin-top: 16px;
        }

        .toggle-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 6px;
          background: transparent;
          border: 1px solid rgba(148, 163, 184, 0.08);
          color: #94a3b8;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          backdrop-filter: blur(4px);
        }

        .toggle-button:hover {
          background: rgba(14, 165, 164, 0.08);
          border-color: rgba(14, 165, 164, 0.15);
          color: #0ea5a4;
          transform: translateY(-1px) scale(1.05);
        }

        .toggle-icon {
          width: 14px;
          height: 14px;
          transition: all 0.3s ease;
        }

        .toggle-button.group:hover .toggle-icon {
          transform: scale(1.1);
        }

        /* Sidebar Content */
        .sidebar-content-wrapper {
          display: flex;
          flex-direction: column;
        }

        .sidebar-content {
          height: 100%;
          display: flex;
          flex-direction: column;
          background: linear-gradient(180deg, #0a1628 0%, #0f172a 100%);
          border-right: 1px solid rgba(14, 165, 164, 0.08);
          position: relative;
          overflow: hidden;
          box-shadow: 0 0 40px rgba(2, 6, 23, 0.4);
        }

        .sidebar-content::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: radial-gradient(circle at top left, rgba(14, 165, 164, 0.02), transparent 60%);
          pointer-events: none;
          z-index: 0;
        }

        .sidebar-content > * {
          position: relative;
          z-index: 1;
        }

        /* Panel Header */
        .panel-header {
          padding: 16px 20px;
          background: linear-gradient(135deg, rgba(15,23,42,0.95), rgba(7,17,27,0.95));
          border-bottom: 1px solid rgba(14, 165, 164, 0.08);
          backdrop-filter: blur(12px);
          transition: all 0.3s ease;
          flex-shrink: 0;
        }

        .panel-header:hover {
          border-bottom-color: rgba(14, 165, 164, 0.15);
          background: linear-gradient(135deg, rgba(15,23,42,0.98), rgba(7,17,27,0.98));
        }

        .panel-title-section {
          display: flex;
          align-items: center;
          gap: 12px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .panel-icon-container {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: linear-gradient(135deg, rgba(14, 165, 164, 0.1), rgba(14, 116, 144, 0.1));
          border: 1px solid rgba(14, 165, 164, 0.15);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .panel-icon {
          color: #0ea5a4;
          width: 16px;
          height: 16px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          filter: drop-shadow(0 0 6px rgba(14, 165, 164, 0.2));
        }

        .panel-title-section:hover .panel-icon-container {
          background: linear-gradient(135deg, rgba(14, 165, 164, 0.2), rgba(14, 116, 144, 0.2));
          border-color: rgba(14, 165, 164, 0.3);
          transform: translateY(-2px) scale(1.05);
          box-shadow: 0 8px 25px rgba(14, 165, 164, 0.15);
        }

        .panel-title-section:hover .panel-icon {
          transform: scale(1.1);
          animation: iconBounce 0.6s ease;
          filter: drop-shadow(0 0 12px rgba(14, 165, 164, 0.4));
        }

        .panel-title {
          font-size: 14px;
          font-weight: 700;
          color: #f1f5f9;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          transition: all 0.3s ease;
          margin: 0;
        }

        .panel-title-section:hover .panel-title {
          color: #0ea5a4;
          text-shadow: 0 0 8px rgba(14, 165, 164, 0.2);
        }

        /* Panel Body */
        .panel-body {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 0;
          background: linear-gradient(180deg, rgba(2,6,23,0.0), rgba(2,6,23,0.02));
        }

        .panel-content {
          flex: 1;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .panel-content.full-height {
          height: 100%;
        }

        /* Resize Handle Enhancement */
        .sidebar-content-wrapper:hover .react-resizable-handle {
          background-color: rgba(14, 165, 164, 0.4) !important;
        }

        /* Custom Scrollbars for consistency */
        .panel-body::-webkit-scrollbar {
          width: 6px;
        }

        .panel-body::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.3);
          border-radius: 3px;
        }

        .panel-body::-webkit-scrollbar-thumb {
          background: rgba(14, 165, 164, 0.2);
          border-radius: 3px;
          transition: background 0.3s ease;
        }

        .panel-body::-webkit-scrollbar-thumb:hover {
          background: rgba(14, 165, 164, 0.4);
        }

        /* Tooltip Enhancements */
        :global(.ant-tooltip-inner) {
          background: linear-gradient(135deg, #0f172a, #071126) !important;
          border: 1px solid rgba(14, 165, 164, 0.2) !important;
          color: #e2e8f0 !important;
          border-radius: 8px !important;
          backdrop-filter: blur(12px) !important;
          box-shadow: 0 8px 25px rgba(2,6,23,0.4) !important;
          font-size: 12px !important;
          font-weight: 500 !important;
        }

        :global(.ant-tooltip-arrow::before) {
          background: linear-gradient(135deg, #0f172a, #071126) !important;
          border: 1px solid rgba(14, 165, 164, 0.2) !important;
        }

        /* Mobile Responsiveness */
        @media (max-width: 768px) {
          .sidebar-tabs {
            width: 44px;
            padding: 12px 0;
          }

          .tab-button {
            width: 28px;
            height: 28px;
          }

          .tab-icon {
            width: 14px;
            height: 14px;
          }

          .toggle-button {
            width: 24px;
            height: 24px;
          }

          .toggle-icon {
            width: 12px;
            height: 12px;
          }

          .panel-header {
            padding: 12px 16px;
          }

          .panel-icon-container {
            width: 28px;
            height: 28px;
          }

          .panel-icon {
            width: 14px;
            height: 14px;
          }

          .panel-title {
            font-size: 12px;
          }

          .unread-badge {
            width: 14px;
            height: 14px;
            font-size: 8px;
            top: -3px;
            right: -3px;
          }
        }

        @media (max-width: 480px) {
          .sidebar-tabs {
            width: 40px;
            padding: 10px 0;
          }

          .tab-button {
            width: 24px;
            height: 24px;
            gap: 8px;
          }

          .tab-icon {
            width: 12px;
            height: 12px;
          }

          .toggle-button {
            width: 20px;
            height: 20px;
          }

          .toggle-icon {
            width: 10px;
            height: 10px;
          }

          .panel-header {
            padding: 10px 14px;
          }

          .panel-title-section {
            gap: 10px;
          }

          .panel-icon-container {
            width: 24px;
            height: 24px;
          }

          .panel-icon {
            width: 12px;
            height: 12px;
          }

          .panel-title {
            font-size: 11px;
          }
        }

        /* Performance Optimizations */
        .sidebar-container {
          will-change: transform;
          backface-visibility: hidden;
        }

        .tab-button,
        .toggle-button,
        .panel-icon-container {
          will-change: transform, box-shadow;
        }

        /* Text Selection */
        .sidebar-container *::selection {
          background: rgba(14, 165, 164, 0.2);
          color: #f1f5f9;
        }

        /* Accessibility Improvements */
        .tab-button:focus-visible,
        .toggle-button:focus-visible {
          outline: 2px solid rgba(14, 165, 164, 0.6) !important;
          outline-offset: 2px !important;
        }

        /* Enhanced Focus States */
        .tab-button:focus,
        .toggle-button:focus {
          outline: 2px solid rgba(14, 165, 164, 0.4) !important;
          outline-offset: 2px !important;
        }

        /* Smooth Scrolling */
        * {
          scroll-behavior: smooth;
        }

        /* Loading States */
        .panel-content.loading {
          opacity: 0.7;
          pointer-events: none;
        }

        .panel-content.loading::after {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 20px;
          height: 20px;
          border: 2px solid rgba(14, 165, 164, 0.2);
          border-top: 2px solid #0ea5a4;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: translate(-50%, -50%) rotate(0deg); }
          100% { transform: translate(-50%, -50%) rotate(360deg); }
        }

        /* Enhanced Glow Effects */
        .tab-icon {
          filter: drop-shadow(0 0 4px rgba(14, 165, 164, 0.1));
        }

        .tab-button:hover .tab-icon,
        .tab-button.tab-active .tab-icon {
          filter: drop-shadow(0 0 8px rgba(14, 165, 164, 0.3));
        }

        .panel-icon {
          filter: drop-shadow(0 0 6px rgba(14, 165, 164, 0.2));
        }

        .panel-title-section:hover .panel-icon {
          filter: drop-shadow(0 0 12px rgba(14, 165, 164, 0.4));
        }

        /* State Transitions */
        .sidebar-content {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .panel-header {
          transition: all 0.3s ease;
        }

        /* Enhanced Shadow System */
        .sidebar-content {
          box-shadow: 
            0 0 40px rgba(2, 6, 23, 0.4),
            inset 0 1px 0 rgba(14, 165, 164, 0.02);
        }

        .tab-button:hover {
          box-shadow: 
            0 4px 12px rgba(14, 165, 164, 0.15),
            0 0 0 1px rgba(14, 165, 164, 0.1);
        }

        .tab-button.tab-active {
          box-shadow: 
            0 2px 8px rgba(14, 165, 164, 0.2),
            inset 0 1px 0 rgba(14, 165, 164, 0.1);
        }

        /* Backdrop Filter Support */
        @supports (backdrop-filter: blur(12px)) {
          .panel-header {
            backdrop-filter: blur(12px);
          }
          
          .tab-button,
          .toggle-button {
            backdrop-filter: blur(4px);
          }
        }

        /* High Contrast Mode Support */
        @media (prefers-contrast: high) {
          .tab-button,
          .toggle-button {
            border-width: 2px;
          }
          
          .panel-header {
            border-bottom-width: 2px;
          }
          
          .sidebar-content {
            border-right-width: 2px;
          }
        }

        /* Reduced Motion Support */
        @media (prefers-reduced-motion: reduce) {
          .animate-slideInUp,
          .animate-slideInRight,
          .animate-fadeInUp {
            animation: none;
          }
          
          .tab-button,
          .toggle-button,
          .panel-icon-container,
          .panel-title-section {
            transition: none;
          }
        }
      `}</style>
    </>
  );
};

// Updated PropTypes to match the enhanced component
CollapsibleSidebar.propTypes = {
  moveNode: PropTypes.func.isRequired,
  state: PropTypes.object,
  actions: PropTypes.object,
  id: PropTypes.string,
  userName: PropTypes.string,
  ownerName: PropTypes.string,
  enableVideo: PropTypes.bool,
  enableChat: PropTypes.bool,
  peers: PropTypes.instanceOf(Map),
  localUserName: PropTypes.string,
  localStream: PropTypes.object,
  toggleMic: PropTypes.func,
  toggleCamera: PropTypes.func,
  isMicOn: PropTypes.bool,
  isCameraOn: PropTypes.bool,
  videoHook: PropTypes.object,
  playbackEnabled: PropTypes.bool,
  enablePlayback: PropTypes.func,
  input: PropTypes.string,
  output: PropTypes.string,
  lang: PropTypes.string,
  handleLang: PropTypes.func,
  handleRun: PropTypes.func,
  handleInput: PropTypes.func,
  runCodeDisabled: PropTypes.bool,
  roomMode: PropTypes.string,
  projectLanguage: PropTypes.string,
  sharedInputOutput: PropTypes.bool,
  onPromoteToHost: PropTypes.func,
  onKickParticipant: PropTypes.func,
  isLocalHost: PropTypes.bool,
  onUploadDone: PropTypes.func,
  handleEndCall: PropTypes.func,
  onSidebarResize: PropTypes.func,
  enableAI: PropTypes.bool,
  onToggleMain: PropTypes.func,
  forceCollapsed: PropTypes.bool,
  forceExpanded: PropTypes.bool,
  onToggleAiDock: PropTypes.func,
  showAiInMain: PropTypes.bool,
  aiDocked: PropTypes.bool,
  videoDocked: PropTypes.bool,
  onToggleVideoDock: PropTypes.func,
  showVideoInMain: PropTypes.bool,
  docRef: PropTypes.object,
  participants: PropTypes.arrayOf(PropTypes.string),
  onDockWhiteboard: PropTypes.func,
  enableHostNotes: PropTypes.bool,
  terminalVisible: PropTypes.bool,
  onToggleTerminal: PropTypes.func,
};

export default CollapsibleSidebar;
