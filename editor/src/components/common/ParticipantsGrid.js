import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import VideoTile from './VideoTile';
import { FaVideo, FaVideoSlash, FaMicrophone, FaMicrophoneSlash, FaDesktop, FaPhoneSlash, FaExpand, FaCompress, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { Modal, notification, Input, Tooltip, Button } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { FaPhone } from "react-icons/fa";
import PropTypes from 'prop-types';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const ParticipantsGrid = ({
  peers = new Map(),
  localStream,
  localPeerId,
  localUserName = 'You',
  handlePinPeer = () => {},
  handleSelfPin = () => {},
  pinnedPeerId = null,
  playbackEnabled = true,
  enablePlayback = () => {},
  toggleMic,
  toggleCamera,
  isMicOn,
  isCameraOn,
  compact = false,
  className = '',
  handleToggleScreenShare = () => {},
  isScreenSharing = false,
  sidebarCollapsed = false,
  handleEndCall = null,
  isLocalHost = false,
  initialPinnedAspectRatio,
  initialPinnedPosition,
  onPinnedSettingChange,
  isDocked = false,
  onToggleDock = () => {},
  showSummary = false,
  onGlobalVideoQualityChange = null,
  onPinnedVideoQualityChange = null,
  pageSizeOverride = null,
  enableVideo = true
}) => {
  
  const containerRef = useRef(null);
  const [width, setWidth] = useState(360);
  const [cols, setCols] = useState(2);
  const [searchTerm, setSearchTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [pinnedObjectPosition, setPinnedObjectPosition] = useState('center');
  const [pinnedAspectRatio, setPinnedAspectRatio] = useState('16/9');
  const [currentPage, setCurrentPage] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (typeof initialPinnedPosition === 'string') setPinnedObjectPosition(initialPinnedPosition);
    if (typeof initialPinnedAspectRatio === 'string') setPinnedAspectRatio(initialPinnedAspectRatio);
  }, [initialPinnedPosition, initialPinnedAspectRatio]);

  const handlePinnedPositionChange = (pos) => {
    setPinnedObjectPosition(pos);
    if (typeof onPinnedSettingChange === 'function') onPinnedSettingChange({ objectPosition: pos, aspectRatio: pinnedAspectRatio });
  };

  const handlePinnedAspectChange = (ratio) => {
    setPinnedAspectRatio(ratio);
    if (typeof onPinnedSettingChange === 'function') onPinnedSettingChange({ objectPosition: pinnedObjectPosition, aspectRatio: ratio });
  };

  useEffect(() => {
    const t = setTimeout(() => setDebounced(searchTerm.trim().toLowerCase()), 200);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setWidth(Math.round(el.clientWidth));
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setWidth(Math.round(entry.contentRect.width));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    // Calculate columns based on available width
    const tileTarget = compact ? 140 : 180;
    const calculated = Math.floor(width / tileTarget) || 1;
    setCols(clamp(calculated, 1, 4));
  }, [width, compact]);

  // Determine layout based on pinned state and docked mode
  const hasPinnedVideo = Boolean(pinnedPeerId);
  const isDockedMode = isDocked && !showSummary;

  // Calculate page size based on layout mode
  const pageSize = useMemo(() => {
    if (typeof pageSizeOverride === 'number' && pageSizeOverride > 0) return pageSizeOverride;
    
    if (isDockedMode) {
      if (hasPinnedVideo) {
        // Docked mode with pinned video: show 3 tiles per page in vertical layout
        return 3;
      } else {
        // Docked mode with no pinned video: show 4 tiles per page in grid layout
        return 4;
      }
    } else {
      // Undocked mode: use the same calculation as before
      const rows = 2; // Show 2 rows of tiles
      return Math.max(4, cols * rows);
    }
  }, [pageSizeOverride, cols, isDockedMode, hasPinnedVideo]);

  const allParticipants = useMemo(() => {
    const arr = [
      {
        id: localPeerId || 'local',
        label: localUserName,
        stream: localStream,
        isLocal: true,
        peerObj: { 
          isScreenSharing,
          isMicOn: isMicOn,
          isCameraOn: isCameraOn
        }
      }
    ];
    
    for (const p of peers.values()) {
      arr.push({
        id: p.id || p.peerId || p.userId,
        label: p.userName || 'Anon',
        stream: p.stream,
        isLocal: false,
        peerObj: {
          ...p,
          isMicOn: p.isMicOn,
          isCameraOn: p.isCameraOn,
          isScreenSharing: p.isScreenSharing
        }
      });
    }
    return arr;
  }, [peers, localPeerId, localUserName, localStream, isScreenSharing, isMicOn, isCameraOn]);

  const visibleParticipants = useMemo(() => {
    if (!debounced) return allParticipants;
    return allParticipants.filter(p => (p.label || '').toLowerCase().includes(debounced));
  }, [allParticipants, debounced]);

  const pinnedEntry = visibleParticipants.find(p => p.id === pinnedPeerId) || null;
  
  // Get participants for current page (excluding pinned)
  const others = useMemo(() => {
    return visibleParticipants.filter(p => p.id !== (pinnedEntry?.id));
  }, [visibleParticipants, pinnedEntry]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(others.length / pageSize)), [others.length, pageSize]);

  // Reset to page 1 when filters, pinned or layout changes
  useEffect(() => {
    setIsTransitioning(true);
    setCurrentPage(1);
    setTimeout(() => setIsTransitioning(false), 300);
  }, [debounced, pinnedPeerId, isDocked, showSummary]);

  // Clamp current page when totalPages changes
  useEffect(() => {
    setCurrentPage(prev => Math.min(Math.max(1, prev), totalPages));
  }, [totalPages]);

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentParticipants = others.slice(startIndex, endIndex);

  const handleToggleMic = useCallback(() => {
    toggleMic?.();
  }, [toggleMic]);

  const handleToggleCamera = useCallback(() => {
    toggleCamera?.();
  }, [toggleCamera]);

  const handleToggleScreenShareCallback = useCallback(() => {
    handleToggleScreenShare?.();
  }, [handleToggleScreenShare]);

  const handlePageChange = useCallback((newPage) => {
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentPage(newPage);
      setIsTransitioning(false);
    }, 150);
  }, []);

  const generateParticipantSummary = () => {
    const total = allParticipants.length;
    const activeWithVideo = allParticipants.filter(p => p.stream && p.peerObj?.isScreenSharing !== true).length;
    const screenSharing = allParticipants.filter(p => p.peerObj?.isScreenSharing).length;
    
    return `${total} participant${total !== 1 ? 's' : ''}, ${activeWithVideo} with video, ${screenSharing} screen sharing`;
  };

  const confirmEndCall = () => {
    Modal.confirm({
      title: 'End Call',
      content: 'Are you sure you want to leave the session and end the call?',
      okText: 'Yes, leave',
      cancelText: 'Cancel',
      okButtonProps: {
        className: 'bg-rose-600 hover:bg-rose-700 border-0 transition-all duration-200 transform hover:scale-105'
      },
      cancelButtonProps: {
        className: 'bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600 transition-all duration-200 transform hover:scale-105'
      },
      className: 'video-modal',
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
          console.error('[ParticipantsGrid] error calling handleEndCall', err);
          notification.error({ message: 'Failed to leave cleanly. Reloading.' });
          window.location.href = '/';
        }
      }
    });
  };

  // Docked-mode sizing constants
  const pinnedDockedHeight = '83.8vh';

  if (isDocked && showSummary) {
    return (
      <div className="video-docked-summary animate-fadeIn">
        <div className="video-docked-header transform transition-all duration-300 hover:translate-y-[-1px]">
          <FaVideo className="video-docked-icon transition-all duration-300 hover:scale-110" />
          <span className="video-docked-title">Video Chat (Docked)</span>
        </div>
        
        <div className="video-docked-content">
          <div className="video-docked-stats transform transition-all duration-300 hover:scale-105">
            <p>{generateParticipantSummary()}</p>
          </div>
          
          <div className="video-docked-status">
            <span className="video-status-indicator"></span>
            <span>Click below to undock</span>
          </div>
        </div>
        
        <button 
          className="video-undock-btn transform transition-all duration-300 hover:scale-105 hover:shadow-lg"
          onClick={onToggleDock}
        >
          <FaCompress className="transition-transform duration-200 group-hover:rotate-12" />
          Undock to Sidebar
        </button>

        

        <style jsx>{`
        
          .video-docked-summary { 
            padding: 20px; 
            height: 100%; 
            display: flex; 
            flex-direction: column; 
            background: linear-gradient(180deg, #071126 0%, #0f172a 100%);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          }
          .video-docked-header { 
            display: flex; 
            align-items: center; 
            gap: 10px; 
            margin-bottom: 20px; 
            padding-bottom: 15px; 
            border-bottom: 1px solid rgba(255,255,255,0.1);
            transition: border-color 0.3s ease;
          }
          .video-docked-icon { 
            color: #0ea5a4; 
            font-size: 18px;
            filter: drop-shadow(0 0 8px rgba(14, 165, 164, 0.3));
          }
          .video-docked-title { 
            color: #f1f5f9; 
            font-weight: 600; 
            font-size: 16px;
            text-shadow: 0 2px 4px rgba(0,0,0,0.3);
          }
          .video-docked-content { 
            flex: 1; 
            display: flex; 
            flex-direction: column; 
            justify-content: center; 
            text-align: center;
            transition: opacity 0.3s ease;
          }
          .video-docked-stats p { 
            color: #cbd5e1; 
            font-size: 14px; 
            line-height: 1.5; 
            margin-bottom: 20px;
            text-shadow: 0 1px 2px rgba(0,0,0,0.2);
          }
          .video-docked-status { 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            gap: 8px; 
            color: #0ea5a4; 
            font-size: 12px; 
            margin: 15px 0;
            opacity: 0.8;
            transition: opacity 0.3s ease;
          }
          .video-docked-status:hover { opacity: 1; }
          .video-status-indicator { 
            width: 8px; 
            height: 8px; 
            border-radius: 50%; 
            background-color: #0ea5a4; 
            animation: pulse 2s infinite;
            box-shadow: 0 0 0 0 rgba(14, 165, 164, 0.7);
          }
          .video-undock-btn { 
            background: rgba(14,116,144,0.15); 
            border: 1px solid rgba(14,116,144,0.3); 
            color: #0ea5a4; 
            padding: 12px 16px; 
            border-radius: 12px; 
            cursor: pointer; 
            font-size: 13px; 
            font-weight: 600; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            gap: 8px; 
            margin-top: auto;
            backdrop-filter: blur(8px);
            box-shadow: 0 4px 16px rgba(0,0,0,0.1);
          }
          .video-undock-btn:hover { 
            background: rgba(14,116,144,0.25); 
            border-color: rgba(14,116,144,0.5);
            box-shadow: 0 8px 32px rgba(14, 165, 164, 0.2);
          }
          @keyframes pulse { 
            0% { 
              opacity: 1; 
              box-shadow: 0 0 0 0 rgba(14, 165, 164, 0.7);
            } 
            70% { 
              opacity: 0.6; 
              box-shadow: 0 0 0 10px rgba(14, 165, 164, 0);
            } 
            100% { 
              opacity: 1; 
              box-shadow: 0 0 0 0 rgba(14, 165, 164, 0);
            } 
          }
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fadeIn {
            animation: fadeIn 0.5s cubic-bezier(0.4, 0, 0.2, 1);
          }
        `}</style>
      </div>
    );
  }

 // Replace JUST the header section (the part starting from the return statement) with this:

return (
    <div 
      ref={containerRef} 
      className={`w-full transition-all duration-500 ease-in-out ${className}`} 
      style={{
        height: isDockedMode ? '100%' : 'auto',
        overflow: isDockedMode ? 'hidden' : 'visible'
      }}
    >
      {/* Updated Header - Matching ParticipantsList */}
      <div className="participants-header">
        <div className="header-content">
          <div className="title-section group">
            <div className="icon-container">
              <FaVideo className="title-icon" />
            </div>
            <div className="title-text-container">
              <div className="title-text">Video Chat</div>
            </div>
          </div>
          
          <div className="controls-section">
            {/* Search Input */}
            <div className={`search-container ${searchTerm ? 'search-active' : ''}`}>
              <input
                type="text"
                placeholder="Search participants..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
              <SearchOutlined className="search-icon" />
            </div>

            {/* Dock/Undock Toggle */}
            {enableVideo && (
              <Tooltip title={isDocked ? "Undock to sidebar" : "Dock to main view"} color="#0f172a">
                <button
                  onClick={onToggleDock}
                  className="control-btn dock-btn"
                  aria-label={isDocked ? "Undock" : "Dock"}
                >
                  {isDocked ? <FaCompress size={10} /> : <FaExpand size={10} />}
                </button>
              </Tooltip>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area - EXACTLY THE SAME AS BEFORE */}
      <div className={`transition-all duration-500 ease-in-out ${isDockedMode && hasPinnedVideo ? 'flex h-full gap-4' : ''}`}>
        {/* Pinned Video */}
        {hasPinnedVideo && (
          <div
            className={`rounded-xl overflow-hidden shadow-xl border border-slate-700 transition-all duration-500 ease-in-out hover:border-slate-600 hover:shadow-2xl hover:shadow-cyan-500/5 ${isDockedMode ? 'flex-grow' : 'mb-4'}`}
            style={{
              height: isDockedMode ? pinnedDockedHeight : 'auto',
              width: isDockedMode ? 'calc(75% - 16px)' : undefined,
              transform: isTransitioning ? 'scale(0.98)' : 'scale(1)',
            }}
          >
            <VideoTile
              stream={pinnedEntry.stream}
              visible={true}
              id={pinnedEntry.id}
              label={pinnedEntry.label}
              isLocal={pinnedEntry.isLocal}
              isPinned={true}
              playbackEnabled={playbackEnabled}
              onPin={() => (pinnedEntry.isLocal ? handleSelfPin() : handlePinPeer(pinnedEntry.id))}
              onRequestUnmute={() => enablePlayback()}
              compact={compact}
              remoteMediaState={pinnedEntry.peerObj}
              objectPosition={pinnedObjectPosition}
              onChangeObjectPosition={handlePinnedPositionChange}
              onChangeAspectRatio={handlePinnedAspectChange}
              aspectRatio={pinnedAspectRatio}
              showStats={false}
              isScreenSharing={pinnedEntry.peerObj?.isScreenSharing || false}
              showPositionControl={!isDockedMode}
              showAspectControl={!isDockedMode}
              dockedMode={isDockedMode ? 'main' : 'sidebar'}
              forceFullScreen={isDockedMode}
              fitMode={'fill'}
              videoQuality={'high'}
            />
          </div>
        )}

        {/* Unpinned Participants */}
        <div className={`transition-all duration-500 ease-in-out ${isDockedMode && hasPinnedVideo ? 'flex-shrink-0 flex flex-col' : ''}`}
             style={{
               width: isDockedMode && hasPinnedVideo ? '25%' : undefined,
               minWidth: isDockedMode && hasPinnedVideo ? '300px' : undefined,
               maxWidth: isDockedMode && hasPinnedVideo ? '400px' : undefined,
               height: isDockedMode ? pinnedDockedHeight : 'auto',
               overflowY: isDockedMode ? 'auto' : 'visible'
             }}>
          
          {/* Grid with Paging */}
          <div 
            className={`transition-all duration-500 ease-in-out ${hasPinnedVideo && isDockedMode ? 'flex flex-col gap-3' : 'grid gap-3'}`} 
            style={{ 
              gridTemplateColumns: hasPinnedVideo && isDockedMode 
                ? '1fr'  // Single column when pinned in docked mode
                : `repeat(${cols}, minmax(0, 1fr))`, // Grid layout otherwise
              gridAutoRows: isDockedMode ? '140px' : 'auto',
              opacity: isTransitioning ? 0.6 : 1,
              transform: isTransitioning ? 'translateY(10px)' : 'translateY(0)',
            }}
          >
            {currentParticipants.map((p, index) => (
              <div 
                key={p.id} 
                className={`rounded-xl overflow-hidden shadow-md bg-slate-800/40 border border-slate-700 transition-all duration-300 hover:border-slate-600 hover:bg-slate-800/60 hover:shadow-lg hover:shadow-cyan-500/5 hover:scale-105 ${hasPinnedVideo && isDockedMode ? 'h-37' : ''}`}
                style={{
                  animationDelay: `${index * 50}ms`,
                  animation: 'slideInUp 0.5s cubic-bezier(0.4, 0, 0.2, 1) both'
                }}
              >
                <VideoTile
                  stream={p.stream}
                  visible={true}
                  id={p.id}
                  label={p.label}
                  isLocal={p.isLocal}
                  isPinned={p.id === pinnedPeerId}
                  onPin={() => (p.isLocal ? handleSelfPin() : handlePinPeer(p.id))}
                  playbackEnabled={playbackEnabled}
                  onRequestUnmute={() => enablePlayback()}
                  compact={compact}
                  remoteMediaState={p.peerObj}
                  isScreenSharing={p.peerObj?.isScreenSharing || false}
                  showStats={false}
                  dockedMode={isDockedMode ? (hasPinnedVideo ? 'filmstrip' : 'sidebar') : 'sidebar'}
                  videoQuality={'high'}
                />
              </div>
            ))}
          </div>

          {/* Pagination Controls - Updated Styling */}
          {others.length > pageSize && (
            <div className="pagination-controls">
              <button
                onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="pagination-btn prev-btn"
              >
                <FaChevronLeft size={10} />
                <span>Previous</span>
              </button>
              
              <span className="pagination-info">
                Page {currentPage} of {totalPages}
              </span>
              
              <button
                onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="pagination-btn next-btn"
              >
                <span>Next</span>
                <FaChevronRight size={10} />
              </button>
            </div>
          )}

          {/* Empty State */}
          {visibleParticipants.length === 0 && (
            <div className="text-center py-8 text-slate-500 transition-all duration-500 animate-fadeIn">
              <FaVideo className="text-3xl mx-auto mb-3 opacity-50 transition-all duration-300 hover:opacity-70 hover:scale-110" />
              <p className="text-sm transition-colors duration-300">No participants found</p>
              {debounced && (
                <p className="text-xs mt-1 transition-all duration-300 opacity-0 animate-fadeInUp" style={{animationDelay: '200ms', animationFillMode: 'forwards'}}>
                  Try a different search term
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* New Footer Section */}
      <div className="participants-footer">
        <div className="footer-content">
          <div className="participant-count">
            <div className="count-indicator"></div>
            <span className="count-text">
              {allParticipants.length} participant{allParticipants.length !== 1 ? 's' : ''} in call
            </span>
          </div>
          <div className="footer-stats">
            <span className="stat-item">
              {allParticipants.filter(p => p.peerObj?.isCameraOn).length} with video
            </span>
            <span className="stat-divider">•</span>
            <span className="stat-item">
              {allParticipants.filter(p => p.peerObj?.isScreenSharing).length} sharing
            </span>
          </div>
        </div>
      </div>

      {/* CSS Styles - ADD THESE TO YOUR EXISTING STYLE SECTION */}
      <style jsx>{`
        /* Header Styles - Matching ParticipantsList */
        .participants-header {
          padding: 12px 16px;
          background: linear-gradient(135deg, rgba(15,23,42,0.95), rgba(7,17,27,0.95));
          border-bottom: 1px solid rgba(14, 165, 164, 0.08);
          backdrop-filter: blur(12px);
          transition: all 0.3s ease;
        }

        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .title-section {
          display: flex;
          align-items: center;
          gap: 10px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .icon-container {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px; /* Reduced size */
          height: 28px; /* Reduced size */
          border-radius: 8px; /* Slightly smaller radius */
          background: linear-gradient(135deg, rgba(14, 165, 164, 0.1), rgba(14, 116, 144, 0.1));
          border: 1px solid rgba(14, 165, 164, 0.15);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .title-icon {
          color: #0ea5a4;
          font-size: 12px; /* Reduced icon size */
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          filter: drop-shadow(0 0 6px rgba(14, 165, 164, 0.2));
        }

        .title-section.group:hover .icon-container {
          background: linear-gradient(135deg, rgba(14, 165, 164, 0.2), rgba(14, 116, 144, 0.2));
          border-color: rgba(14, 165, 164, 0.3);
          transform: translateY(-1px) scale(1.05); /* Reduced transform */
          box-shadow: 0 6px 20px rgba(14, 165, 164, 0.15); /* Reduced shadow */
        }

        .title-section.group:hover .title-icon {
          transform: scale(1.1);
          animation: iconBounce 0.6s ease;
        }

        .title-text {
          font-size: 12px; /* Reduced font size */
          font-weight: 700;
          color: #f1f5f9;
          letter-spacing: 0.3px; /* Reduced letter spacing */
          text-transform: uppercase;
          transition: all 0.3s ease;
        }

        .title-section.group:hover .title-text {
          color: #0ea5a4;
          text-shadow: 0 0 6px rgba(14, 165, 164, 0.2); /* Reduced shadow */
        }

        .controls-section {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .search-container {
          position: relative;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .search-input {
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(14, 165, 164, 0.08);
          border-radius: 8px;
          padding: 6px 10px 6px 28px;
          font-size: 11px;
          color: #e2e8f0;
          width: 120px;
          outline: none;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          backdrop-filter: blur(8px);
          height: 28px;
        }

        .search-input::placeholder {
          color: #94a3b8;
          font-style: italic;
          font-size: 10px;
        }

        .search-input:focus {
          border-color: rgba(14, 165, 164, 0.4);
          background: rgba(15, 23, 42, 0.9);
          box-shadow: 0 0 0 2px rgba(14, 165, 164, 0.1);
          width: 140px;
        }

        .search-icon {
          position: absolute;
          left: 10px; /* Adjusted position */
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
          font-size: 10px; /* Smaller icon */
          transition: all 0.3s ease;
          pointer-events: none;
        }

        .search-focused .search-icon,
        .search-input:focus + .search-icon {
          color: #0ea5a4;
          transform: translateY(-50%) scale(1.1);
        }

        .control-btn {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(14, 165, 164, 0.08);
  color: #94a3b8;
  border-radius: 8px;
  padding: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  font-size: 12px;
  width: 30px;
  height: 30px;
  backdrop-filter: blur(4px);
  flex-shrink: 0;
}

.control-btn:hover {
  background: rgba(14,116,144,0.08);
  border-color: rgba(14,116,144,0.2);
  color: #0ea5a4;
  transform: translateY(-1px) scale(1.1);
  box-shadow: 0 4px 12px rgba(14, 165, 164, 0.15);
}

.clear-btn:hover {
  background: rgba(239,68,68,0.08) !important;
  border-color: rgba(239,68,68,0.2) !important;
  color: #f87171 !important;
  transform: translateY(-1px) scale(1.1);
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.15);
}

        /* Footer Styles */
        .participants-footer {
          padding: 12px 16px;
          border-top: 1px solid rgba(14, 165, 164, 0.08);
          background: linear-gradient(135deg, rgba(15,23,42,0.6), rgba(7,17,27,0.6));
          backdrop-filter: blur(8px);
          transition: all 0.3s ease;
        }

        .footer-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .participant-count {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .count-indicator {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: linear-gradient(135deg, #0ea5a4, #0891b2);
          animation: pulse 2s infinite;
        }

        .count-text {
          font-size: 11px;
          color: #94a3b8;
          font-weight: 500;
        }

        .footer-stats {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .stat-item {
          font-size: 10px;
          color: #94a3b8;
        }

        .stat-divider {
          font-size: 10px;
          color: #64748b;
        }

        /* Pagination Controls Styling */
        .pagination-controls {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-top: 16px;
          padding: 8px 0;
        }

        .pagination-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(14, 165, 164, 0.1);
          color: #94a3b8;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 11px;
          cursor: pointer;
          transition: all 0.3s ease;
          backdrop-filter: blur(4px);
        }

        .pagination-btn:hover:not(:disabled) {
          background: rgba(14, 165, 164, 0.1);
          color: #0ea5a4;
          border-color: rgba(14, 165, 164, 0.2);
          transform: translateY(-1px);
        }

        .pagination-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }

        .pagination-info {
          font-size: 11px;
          color: #94a3b8;
          font-weight: 500;
          min-width: 80px;
          text-align: center;
        }

        /* Animation */
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.6; }
          100% { opacity: 1; }
        }

        /* Mobile Responsiveness */
        @media (max-width: 768px) {
          .participants-header {
            padding: 10px 12px;
          }
          
          .header-content {
            gap: 10px;
          }
          
          .search-input {
            width: 100px;
            font-size: 10px;
            padding: 5px 8px 5px 26px;
          }
          
          .search-input:focus {
            width: 120px;
          }
          
          .participants-footer {
            padding: 10px 12px;
          }
          
          .footer-content {
            flex-direction: column;
            gap: 8px;
            align-items: flex-start;
          }
          
          .pagination-controls {
            gap: 8px;
          }
          
          .pagination-btn {
            padding: 4px 8px;
            font-size: 10px;
          }
          
          .pagination-info {
            font-size: 10px;
            min-width: 70px;
          }
        }

        /* Keep your existing animations */
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
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .animate-fadeInUp {
          animation: fadeInUp 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .animate-fadeIn {
          animation: fadeIn 0.3s ease-in-out;
        }
      `}</style>
      
<style jsx>{`
  .w-full {
    transition: all 0.5s ease-in-out;
    ${!isDockedMode ? `
      padding-left: 12px;
      padding-right: 16px;
      box-sizing: border-box;
    ` : `
      padding-left: 0;
      padding-right: 0;
    `}
  }

  /* Header and footer full width styling */
  .participants-header {
    padding: 12px 16px;
    background: linear-gradient(135deg, rgba(15,23,42,0.95), rgba(7,17,27,0.95));
    border-bottom: 1px solid rgba(14, 165, 164, 0.08);
    backdrop-filter: blur(12px);
    transition: all 0.3s ease;
    ${!isDockedMode ? `
      margin-left: -16px;
      margin-right: -16px;
      width: calc(100% + 32px);
    ` : ''}
  }

  .participants-footer {
    padding: 12px 16px;
    border-top: 1px solid rgba(14, 165, 164, 0.08);
    background: linear-gradient(135deg, rgba(15,23,42,0.6), rgba(7,17,27,0.6));
    backdrop-filter: blur(8px);
    transition: all 0.3s ease;
    ${!isDockedMode ? `
      margin-left: -16px;
      margin-right: -16px;
      width: calc(100% + 32px);
    ` : ''}
  }

  /* Mobile adjustments */
  @media (max-width: 768px) {
    .w-full {
      ${!isDockedMode ? `
        padding-left: 12px;
        padding-right: 12px;
      ` : ''}
    }
    
    .participants-header,
    .participants-footer {
      ${!isDockedMode ? `
        margin-left: -12px;
        margin-right: -12px;
        width: calc(100% + 24px);
      ` : ''}
    }
  }
`}</style>
    </div>
  );
};

ParticipantsGrid.propTypes = {
  peers: PropTypes.instanceOf(Map),
  localStream: PropTypes.object,
  localPeerId: PropTypes.string,
  localUserName: PropTypes.string,
  handlePinPeer: PropTypes.func,
  handleSelfPin: PropTypes.func,
  pinnedPeerId: PropTypes.string,
  playbackEnabled: PropTypes.bool,
  enablePlayback: PropTypes.func,
  toggleMic: PropTypes.func,
  toggleCamera: PropTypes.func,
  isMicOn: PropTypes.bool,
  isCameraOn: PropTypes.bool,
  compact: PropTypes.bool,
  className: PropTypes.string,
  handleToggleScreenShare: PropTypes.func,
  isScreenSharing: PropTypes.bool,
  sidebarCollapsed: PropTypes.bool,
  handleEndCall: PropTypes.func,
  isLocalHost: PropTypes.bool,
  initialPinnedAspectRatio: PropTypes.string,
  initialPinnedPosition: PropTypes.string,
  onPinnedSettingChange: PropTypes.func,
  isDocked: PropTypes.bool,
  onToggleDock: PropTypes.func,
  showSummary: PropTypes.bool,
  onGlobalVideoQualityChange: PropTypes.func,
  onPinnedVideoQualityChange: PropTypes.func,
  enableVideo: PropTypes.bool,
  pageSizeOverride: PropTypes.number
};

export default React.memo(ParticipantsGrid);








