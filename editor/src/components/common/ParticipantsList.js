// src/components/common/ParticipantsList.js
import React, { useMemo, useState, useEffect } from 'react';
import { Avatar, Badge, Dropdown, Menu, Input, Button, Tooltip } from 'antd';
import { FaCrown, FaUser, FaMicrophone, FaMicrophoneSlash, FaVideo, FaVideoSlash, FaEllipsisV } from 'react-icons/fa';
import { SearchOutlined } from '@ant-design/icons';

const ParticipantsList = ({
  peers = new Map(),
  localUserName = '',
  ownerName = '',
  onPromoteToHost,
  onKickParticipant,
  isLocalHost
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [animatingItems, setAnimatingItems] = useState(new Set());

  // simple debounce
  useEffect(() => {
    const t = setTimeout(() => setDebounced(searchTerm.trim().toLowerCase()), 200);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const list = useMemo(() => {
    const items = [];
    items.push({
      id: 'local',
      userName: localUserName || 'You',
      isLocal: true,
      isHost: localUserName && ownerName === localUserName,
      isSpeaking: false,
      hasAudio: true,
      hasVideo: true
    });

    for (const [id, p] of peers) {
      if (!id) continue;
      items.push({
        id,
        userName: p.userName || 'Anonymous',
        isLocal: false,
        isHost: ownerName && p.userName === ownerName,
        isSpeaking: false,
        hasAudio: !!(p.stream && p.stream.getAudioTracks && p.stream.getAudioTracks().some(t => t.enabled)),
        hasVideo: !!(p.stream && p.stream.getVideoTracks && p.stream.getVideoTracks().some(t => t.enabled))
      });
    }

    items.sort((a, b) => {
      if (a.isHost && !b.isHost) return -1;
      if (b.isHost && !a.isHost) return 1;
      if (a.isLocal && !b.isLocal) return -1;
      if (b.isLocal && !a.isLocal) return 1;
      return a.userName.localeCompare(b.userName);
    });

    const seen = new Set();
    const filtered = items.filter(it => {
      const key = `${it.id}:${it.userName}`;
      if (seen.has(key)) return false;
      seen.add(key);

      if (!debounced) return true;
      return (it.userName || '').toLowerCase().includes(debounced);
    });

    return filtered;
  }, [peers, localUserName, ownerName, debounced]);

  const getMenuItems = (participant) => {
    if (!isLocalHost || participant.isLocal || participant.isHost) return null;

    return (
      <Menu className="participants-dropdown-menu">
        <Menu.Item 
          key="promote" 
          onClick={() => onPromoteToHost && onPromoteToHost(participant.userName, participant.id)}
          className="dropdown-item promote-item"
        >
          <FaCrown className="dropdown-icon" />
          Make Host
        </Menu.Item>
        <Menu.Item 
          key="kick" 
          danger 
          onClick={() => onKickParticipant && onKickParticipant(participant.userName, participant.id)}
          className="dropdown-item kick-item"
        >
          <FaUser className="dropdown-icon" />
          Kick Participant
        </Menu.Item>
      </Menu>
    );
  };

  return (
    <>
      <div className="participants-container animate-slideInUp">
        <div className="participants-header">
          <div className="header-content">
            <div className="title-section group">
              <div className="icon-container">
                <FaUser className="title-icon" />
              </div>
              <div className="title-text-container">
                <div className="title-text">Participants</div>
              </div>
            </div>
            
            <div className="search-section">
              <div className={`search-container ${isSearchFocused ? 'search-focused' : ''}`}>
                <input
                  type="text"
                  placeholder="Search names..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                  className="search-input"
                />
                <SearchOutlined className="search-icon" />
              </div>
            </div>
          </div>
        </div>
        
        <div className="participants-body">
          <div className="participants-list">
            {list.map((p, index) => (
              <div 
                key={p.id} 
                className={`participant-item animate-fadeInUp ${
                  p.isSpeaking ? 'participant-speaking' : ''
                } ${p.isHost ? 'participant-host' : ''} ${p.isLocal ? 'participant-local' : ''}`}
                style={{
                  animationDelay: `${index * 0.05}s`,
                  animationFillMode: 'both'
                }}
              >
                <div className="participant-content">
                  <div className="avatar-section">
                    <div className="avatar-container">
                      <Avatar
                        size="small"
                        icon={<FaUser />}
                        className={`participant-avatar ${
                          p.isHost ? 'avatar-host' : 'avatar-default'
                        } ${p.isSpeaking ? 'avatar-speaking' : ''}`}
                      />
                      <div className="status-indicators">
                        <div className="audio-indicator">
                          {p.hasAudio ? (
                            <FaMicrophone className="audio-icon audio-on" />
                          ) : (
                            <FaMicrophoneSlash className="audio-icon audio-off" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="participant-info">
                    <div className="name-section">
                      <span className="participant-name">{p.userName}</span>
                      <div className="badges-section">
                        {p.isHost && (
                          <Tooltip title="Session Host" color="#0f172a">
                            <div className="host-badge">
                              <FaCrown className="crown-icon" />
                            </div>
                          </Tooltip>
                        )}
                        {p.isLocal && (
                          <div className="local-badge">You</div>
                        )}
                      </div>
                    </div>
                    <div className="participant-role">
                      {p.isHost ? 'Host' : p.isLocal ? 'Local participant' : 'Remote participant'}
                    </div>
                  </div>
                  
                  <div className="controls-section">
                    <div className="video-indicator">
                      {p.hasVideo ? (
                        <FaVideo className="video-icon video-on" />
                      ) : (
                        <FaVideoSlash className="video-icon video-off" />
                      )}
                    </div>
                    
                    {isLocalHost && !p.isLocal && !p.isHost && (
                      <Dropdown 
                        overlay={getMenuItems(p)} 
                        trigger={['click']}
                        placement="bottomRight"
                        overlayClassName="participants-dropdown"
                      >
                        <button className="menu-button group">
                          <FaEllipsisV className="menu-icon" />
                        </button>
                      </Dropdown>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            {list.length === 0 && (
              <div className="empty-state animate-fadeIn">
                <div className="empty-icon-container">
                  <FaUser className="empty-icon" />
                </div>
                <div className="empty-text">
                  <p className="empty-title">No participants found</p>
                  {debounced && (
                    <p className="empty-subtitle">Try a different search term</p>
                  )}
                </div>
              </div>
            )}
          </div>
          
          <div className="participants-footer">
            <div className="participant-count">
              <div className="count-indicator"></div>
              <span className="count-text">
                {list.length} participant{list.length !== 1 ? 's' : ''} in session
              </span>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        /* ==========================
           Enhanced Animations & Transitions
           ========================== */
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

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
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

        @keyframes crownSpin {
          from { transform: rotate(0deg) scale(1); }
          50% { transform: rotate(180deg) scale(1.1); }
          to { transform: rotate(360deg) scale(1); }
        }

        .animate-slideInUp {
          animation: slideInUp 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .animate-fadeInUp {
          animation: fadeInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .animate-fadeIn {
          animation: fadeIn 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }

        /* ==========================
           Main Container
           ========================== */
        .participants-container {
          height: 100%;
          display: flex;
          flex-direction: column;
          background: linear-gradient(180deg, #0a1628 0%, #0f172a 100%);
          color: #e2e8f0;
          font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
          position: relative;
          overflow: hidden;
          font-size: 12px; /* Reduced base font size */
        }

        .participants-container::before {
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

        .participants-container > * {
          position: relative;
          z-index: 1;
        }

        /* ==========================
           Header Styling
           ========================== */
        .participants-header {
          padding: 12px 16px; /* Reduced padding */
          background: linear-gradient(135deg, rgba(15,23,42,0.95), rgba(7,17,27,0.95));
          border-bottom: 1px solid rgba(14, 165, 164, 0.08);
          backdrop-filter: blur(12px);
          transition: all 0.3s ease;
        }

        .participants-header:hover {
          border-bottom-color: rgba(14, 165, 164, 0.15);
          background: linear-gradient(135deg, rgba(15,23,42,0.98), rgba(7,17,27,0.98));
        }

        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px; /* Reduced gap */
        }

        .title-section {
          display: flex;
          align-items: center;
          gap: 10px; /* Reduced gap */
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

        /* ==========================
           Search Section
           ========================== */
        .search-section {
          flex-shrink: 0;
        }

        .search-container {
          position: relative;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .search-input {
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(14, 165, 164, 0.08);
          border-radius: 8px; /* Smaller radius */
          padding: 6px 10px 6px 28px; /* Reduced padding */
          font-size: 11px; /* Smaller font */
          color: #e2e8f0;
          width: 120px; /* Smaller width */
          outline: none;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          backdrop-filter: blur(8px);
          height: 28px; /* Fixed height */
        }

        .search-input::placeholder {
          color: #94a3b8;
          font-style: italic;
          font-size: 10px; /* Smaller placeholder */
        }

        .search-input:hover {
          border-color: rgba(14, 165, 164, 0.15);
          background: rgba(15, 23, 42, 0.8);
          transform: translateY(-1px);
        }

        .search-input:focus,
        .search-focused .search-input {
          border-color: rgba(14, 165, 164, 0.4);
          background: rgba(15, 23, 42, 0.9);
          box-shadow: 0 0 0 2px rgba(14, 165, 164, 0.1), 0 6px 20px rgba(2,6,23,0.3); /* Reduced shadow */
          transform: translateY(-1px) scale(1.02); /* Reduced transform */
          width: 140px; /* Smaller expanded width */
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

        /* ==========================
           Body and List
           ========================== */
        .participants-body {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 0;
          background: linear-gradient(180deg, rgba(2,6,23,0.0), rgba(2,6,23,0.02));
        }

        .participants-list {
          flex: 1;
          overflow-y: auto;
          padding: 12px 16px; /* Reduced padding */
          display: flex;
          flex-direction: column;
          gap: 8px; /* Reduced gap */
        }

        .participants-list::-webkit-scrollbar {
          width: 4px; /* Thinner scrollbar */
        }

        .participants-list::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.3);
          border-radius: 2px; /* Smaller radius */
        }

        .participants-list::-webkit-scrollbar-thumb {
          background: rgba(14, 165, 164, 0.2);
          border-radius: 2px; /* Smaller radius */
          transition: background 0.3s ease;
        }

        .participants-list::-webkit-scrollbar-thumb:hover {
          background: rgba(14, 165, 164, 0.4);
        }

        /* ==========================
           Participant Items
           ========================== */
        .participant-item {
          background: linear-gradient(135deg, rgba(15,23,42,0.4), rgba(12,18,28,0.3));
          border: 1px solid rgba(14, 165, 164, 0.06);
          border-radius: 10px; /* Smaller radius */
          padding: 12px; /* Reduced padding */
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          backdrop-filter: blur(8px);
          position: relative;
          overflow: hidden;
          cursor: default;
        }

        .participant-item::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(14, 165, 164, 0.2), transparent);
          transition: all 0.3s ease;
        }

        .participant-item:hover {
          background: linear-gradient(135deg, rgba(15,23,42,0.6), rgba(12,18,28,0.4));
          border-color: rgba(14, 165, 164, 0.12);
          transform: translateY(-1px); /* Reduced transform */
          box-shadow: 0 6px 20px rgba(2,6,23,0.4); /* Reduced shadow */
        }

        .participant-item:hover::before {
          background: linear-gradient(90deg, transparent, rgba(14, 165, 164, 0.4), transparent);
          height: 2px;
        }

        .participant-speaking {
          background: linear-gradient(135deg, rgba(6, 78, 59, 0.3), rgba(14, 116, 144, 0.2));
          border-color: rgba(14, 165, 164, 0.3);
          box-shadow: 0 3px 15px rgba(14, 165, 164, 0.1); /* Reduced shadow */
          animation: pulse 2s infinite;
        }

        .participant-host {
          background: linear-gradient(135deg, rgba(120, 53, 15, 0.2), rgba(146, 64, 14, 0.15));
          border-color: rgba(251, 191, 36, 0.2);
        }

        .participant-local {
          background: linear-gradient(135deg, rgba(14, 116, 144, 0.15), rgba(6, 78, 59, 0.1));
          border-color: rgba(14, 165, 164, 0.2);
        }

        .participant-content {
          display: flex;
          align-items: center;
          gap: 10px; /* Reduced gap */
        }

        /* ==========================
           Avatar Section
           ========================== */
        .avatar-section {
          flex-shrink: 0;
        }

        .avatar-container {
          position: relative;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .participant-item:hover .avatar-container {
          transform: scale(1.05);
        }

        .participant-avatar {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }

        .avatar-default {
          background: linear-gradient(135deg, #0ea5a4, #0891b2) !important;
          box-shadow: 0 3px 10px rgba(14, 165, 164, 0.15) !important; /* Reduced shadow */
        }

        .avatar-host {
          background: linear-gradient(135deg, #fbbf24, #f59e0b) !important;
          box-shadow: 0 3px 10px rgba(251, 191, 36, 0.2) !important; /* Reduced shadow */
        }

        .avatar-speaking {
          box-shadow: 0 0 0 2px rgba(14, 165, 164, 0.4), 0 3px 10px rgba(14, 165, 164, 0.2) !important; /* Reduced shadow */
        }

        .status-indicators {
          position: absolute;
          bottom: -2px;
          right: -2px;
        }

        .audio-indicator {
          background: linear-gradient(135deg, rgba(15,23,42,0.95), rgba(7,17,27,0.95));
          border: 1px solid rgba(14, 165, 164, 0.1);
          border-radius: 50%;
          padding: 3px; /* Reduced padding */
          backdrop-filter: blur(8px);
          transition: all 0.3s ease;
        }

        .participant-item:hover .audio-indicator {
          transform: scale(1.1);
          border-color: rgba(14, 165, 164, 0.2);
        }

        .audio-icon {
          font-size: 8px; /* Smaller icon */
          transition: all 0.3s ease;
        }

        .audio-on {
          color: #10b981;
          filter: drop-shadow(0 0 3px rgba(16, 185, 129, 0.3)); /* Reduced shadow */
        }

        .audio-off {
          color: #f87171;
          filter: drop-shadow(0 0 3px rgba(248, 113, 113, 0.3)); /* Reduced shadow */
        }

        /* ==========================
           Participant Info
           ========================== */
        .participant-info {
          flex: 1;
          min-width: 0;
        }

        .name-section {
          display: flex;
          align-items: center;
          gap: 6px; /* Reduced gap */
          margin-bottom: 2px; /* Reduced margin */
        }

        .participant-name {
          font-size: 12px; /* Reduced font size */
          font-weight: 600;
          color: #e2e8f0;
          transition: color 0.3s ease;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
          max-width: 120px; /* Added max width */
        }

        .participant-item:hover .participant-name {
          color: #f1f5f9;
        }

        .badges-section {
          display: flex;
          align-items: center;
          gap: 4px; /* Reduced gap */
        }

        .host-badge {
          display: flex;
          align-items: center;
          padding: 1px 4px; /* Reduced padding */
          background: rgba(251, 191, 36, 0.1);
          border: 1px solid rgba(251, 191, 36, 0.2);
          border-radius: 4px; /* Smaller radius */
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          backdrop-filter: blur(4px);
        }

        .participant-item:hover .host-badge {
          background: rgba(251, 191, 36, 0.15);
          border-color: rgba(251, 191, 36, 0.3);
          transform: translateY(-1px);
        }

        .crown-icon {
          color: #fbbf24;
          font-size: 9px; /* Smaller icon */
          filter: drop-shadow(0 0 3px rgba(251, 191, 36, 0.4)); /* Reduced shadow */
          transition: all 0.3s ease;
        }

        .participant-item:hover .crown-icon {
          animation: crownSpin 0.8s ease;
        }

        .local-badge {
          font-size: 9px; /* Smaller font */
          font-weight: 600;
          color: #0ea5a4;
          background: rgba(14, 165, 164, 0.1);
          border: 1px solid rgba(14, 165, 164, 0.2);
          padding: 1px 4px; /* Reduced padding */
          border-radius: 4px; /* Smaller radius */
          transition: all 0.3s ease;
          backdrop-filter: blur(4px);
        }

        .participant-item:hover .local-badge {
          background: rgba(14, 165, 164, 0.15);
          border-color: rgba(14, 165, 164, 0.3);
          transform: translateY(-1px);
        }

        .participant-role {
          font-size: 10px; /* Smaller font */
          color: #94a3b8;
          transition: color 0.3s ease;
        }

        .participant-item:hover .participant-role {
          color: #cbd5e1;
        }

        /* ==========================
           Controls Section
           ========================== */
        .controls-section {
          display: flex;
          align-items: center;
          gap: 6px; /* Reduced gap */
        }

        .video-indicator {
          background: linear-gradient(135deg, rgba(15,23,42,0.6), rgba(7,17,27,0.6));
          border: 1px solid rgba(14, 165, 164, 0.1);
          border-radius: 6px; /* Smaller radius */
          padding: 4px; /* Reduced padding */
          transition: all 0.3s ease;
          backdrop-filter: blur(6px);
        }

        .participant-item:hover .video-indicator {
          background: linear-gradient(135deg, rgba(15,23,42,0.8), rgba(7,17,27,0.8));
          border-color: rgba(14, 165, 164, 0.2);
          transform: translateY(-1px);
        }

        .video-icon {
          font-size: 10px; /* Smaller icon */
          transition: all 0.3s ease;
        }

        .video-on {
          color: #10b981;
          filter: drop-shadow(0 0 3px rgba(16, 185, 129, 0.3)); /* Reduced shadow */
        }

        .video-off {
          color: #f87171;
          filter: drop-shadow(0 0 3px rgba(248, 113, 113, 0.3)); /* Reduced shadow */
        }

        .menu-button {
          background: transparent;
          border: 1px solid rgba(148,163,184,0.08);
          color: #94a3b8;
          border-radius: 6px; /* Smaller radius */
          padding: 4px 6px; /* Reduced padding */
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          backdrop-filter: blur(4px);
          width: 24px; /* Fixed width */
          height: 24px; /* Fixed height */
        }

        .menu-button:hover {
          background: rgba(14,116,144,0.08);
          border-color: rgba(14,116,144,0.2);
          color: #0ea5a4;
          transform: translateY(-1px) scale(1.1); /* Reduced transform */
          box-shadow: 0 3px 10px rgba(14, 165, 164, 0.15); /* Reduced shadow */
        }

        .menu-button.group:hover .menu-icon {
          transform: scale(1.1);
        }

        .menu-icon {
          font-size: 10px; /* Smaller icon */
          transition: all 0.3s ease;
        }

        /* ==========================
           Empty State
           ========================== */
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 30px 16px; /* Reduced padding */
          text-align: center;
          opacity: 0.8;
        }

        .empty-icon-container {
          width: 48px; /* Reduced size */
          height: 48px; /* Reduced size */
          border-radius: 12px; /* Smaller radius */
          background: linear-gradient(135deg, rgba(14, 165, 164, 0.1), rgba(14, 116, 144, 0.1));
          border: 1px solid rgba(14, 165, 164, 0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 12px; /* Reduced margin */
          transition: all 0.3s ease;
        }

        .empty-icon {
          font-size: 18px; /* Smaller icon */
          color: #94a3b8;
          opacity: 0.6;
          transition: all 0.3s ease;
        }

        .empty-state:hover .empty-icon-container {
          background: linear-gradient(135deg, rgba(14, 165, 164, 0.15), rgba(14, 116, 144, 0.15));
          border-color: rgba(14, 165, 164, 0.25);
          transform: translateY(-1px); /* Reduced transform */
        }

        .empty-state:hover .empty-icon {
          color: #0ea5a4;
          opacity: 0.8;
          transform: scale(1.1);
        }

        .empty-text {
          max-width: 160px; /* Reduced width */
        }

        .empty-title {
          font-size: 12px; /* Smaller font */
          font-weight: 600;
          color: #94a3b8;
          margin-bottom: 3px; /* Reduced margin */
          transition: color 0.3s ease;
        }

        .empty-subtitle {
          font-size: 10px; /* Smaller font */
          color: #64748b;
          margin: 0;
          transition: color 0.3s ease;
        }

        .empty-state:hover .empty-title {
          color: #cbd5e1;
        }

        .empty-state:hover .empty-subtitle {
          color: #94a3b8;
        }

        /* ==========================
           Footer
           ========================== */
        .participants-footer {
          padding: 12px 16px; /* Reduced padding */
          border-top: 1px solid rgba(14, 165, 164, 0.08);
          background: linear-gradient(135deg, rgba(15,23,42,0.6), rgba(7,17,27,0.6));
          backdrop-filter: blur(8px);
          transition: all 0.3s ease;
        }

        .participants-footer:hover {
          border-top-color: rgba(14, 165, 164, 0.15);
          background: linear-gradient(135deg, rgba(15,23,42,0.8), rgba(7,17,27,0.8));
        }

        .participant-count {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px; /* Reduced gap */
          transition: all 0.3s ease;
        }

        .count-indicator {
          width: 6px; /* Smaller indicator */
          height: 6px; /* Smaller indicator */
          border-radius: 50%;
          background: linear-gradient(135deg, #0ea5a4, #0891b2);
          transition: all 0.3s ease;
          animation: pulse 3s infinite;
        }

        .participants-footer:hover .count-indicator {
          transform: scale(1.2);
          box-shadow: 0 0 8px rgba(14, 165, 164, 0.4); /* Reduced shadow */
        }

        .count-text {
          font-size: 10px; /* Smaller font */
          color: #94a3b8;
          font-weight: 500;
          transition: color 0.3s ease;
        }

        .participants-footer:hover .count-text {
          color: #0ea5a4;
        }

        /* ==========================
           Dropdown Menu Styling
           ========================== */
        :global(.participants-dropdown .ant-dropdown) {
          backdrop-filter: blur(12px);
        }

        :global(.participants-dropdown-menu) {
          background: linear-gradient(180deg, #0f172a, #071126) !important;
          border: 1px solid rgba(14, 165, 164, 0.15) !important;
          border-radius: 8px !important; /* Smaller radius */
          box-shadow: 0 8px 25px rgba(2,6,23,0.5) !important; /* Reduced shadow */
          padding: 4px !important; /* Reduced padding */
          backdrop-filter: blur(16px) !important;
          min-width: 140px !important; /* Smaller menu */
        }

        :global(.participants-dropdown-menu .ant-dropdown-menu-item) {
          border-radius: 4px !important; /* Smaller radius */
          margin: 1px 0 !important; /* Reduced margin */
          padding: 8px 10px !important; /* Reduced padding */
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
          font-size: 11px !important; /* Smaller font */
        }

        .dropdown-item {
          display: flex !important;
          align-items: center !important;
          gap: 6px !important; /* Reduced gap */
          color: #e2e8f0 !important;
          font-weight: 500 !important;
        }

        .dropdown-icon {
          font-size: 10px !important; /* Smaller icon */
          transition: all 0.3s ease !important;
        }

        .promote-item:hover {
          background: rgba(251, 191, 36, 0.08) !important;
          color: #fbbf24 !important;
          transform: translateX(3px) !important; /* Reduced transform */
        }

        .promote-item:hover .dropdown-icon {
          color: #fbbf24 !important;
          transform: scale(1.1) !important;
        }

        .kick-item:hover {
          background: rgba(239, 68, 68, 0.08) !important;
          color: #f87171 !important;
          transform: translateX(3px) !important; /* Reduced transform */
        }

        .kick-item:hover .dropdown-icon {
          color: #f87171 !important;
          transform: scale(1.1) !important;
        }

        /* ==========================
           Mobile Responsiveness
           ========================== */
        @media (max-width: 768px) {
          .participants-header {
            padding: 10px 12px; /* Further reduced padding */
          }

          .header-content {
            gap: 10px; /* Further reduced gap */
          }

          .title-text {
            font-size: 11px; /* Further reduced font */
          }

          .icon-container {
            width: 24px; /* Further reduced size */
            height: 24px; /* Further reduced size */
          }

          .title-icon {
            font-size: 10px; /* Further reduced icon */
          }

          .search-input {
            width: 100px; /* Further reduced width */
            font-size: 10px; /* Further reduced font */
            padding: 5px 8px 5px 26px; /* Further reduced padding */
          }

          .search-input:focus,
          .search-focused .search-input {
            width: 120px; /* Further reduced expanded width */
          }

          .participants-list {
            padding: 10px 12px; /* Further reduced padding */
            gap: 6px; /* Further reduced gap */
          }

          .participant-item {
            padding: 10px; /* Further reduced padding */
          }

          .participant-content {
            gap: 8px; /* Further reduced gap */
          }

          .participant-name {
            font-size: 11px; /* Further reduced font */
            max-width: 100px; /* Further reduced max width */
          }

          .participant-role {
            font-size: 9px; /* Further reduced font */
          }

          .participants-footer {
            padding: 10px 12px; /* Further reduced padding */
          }

          .count-text {
            font-size: 9px; /* Further reduced font */
          }
        }

        @media (max-width: 480px) {
          .participants-header {
            padding: 8px 10px; /* Minimal padding */
          }

          .header-content {
            flex-direction: column;
            align-items: stretch;
            gap: 8px; /* Minimal gap */
          }

          .title-section {
            justify-content: center;
          }

          .search-section {
            display: flex;
            justify-content: center;
          }

          .search-input {
            width: 100%;
            max-width: 160px; /* Reduced max width */
          }

          .search-input:focus,
          .search-focused .search-input {
            width: 100%;
          }

          .participants-list {
            padding: 8px 10px; /* Minimal padding */
          }

          .participant-item {
            padding: 8px; /* Minimal padding */
          }

          .participant-content {
            gap: 6px; /* Minimal gap */
          }

          .controls-section {
            gap: 4px; /* Minimal gap */
          }
        }

        /* ==========================
           Enhanced Focus States
           ========================== */
        .menu-button:focus,
        .search-input:focus {
          outline: 2px solid rgba(14, 165, 164, 0.4) !important;
          outline-offset: 1px !important; /* Reduced offset */
        }

        /* ==========================
           Performance Optimizations
           ========================== */
        .participants-container {
          will-change: transform;
          backface-visibility: hidden;
        }

        .participant-item,
        .menu-button,
        .search-container {
          will-change: transform, box-shadow;
        }

        /* ==========================
           Text Selection
           ========================== */
        .participants-container *::selection {
          background: rgba(14, 165, 164, 0.2);
          color: #f1f5f9;
        }

        /* ==========================
           Accessibility Improvements
           ========================== */
        .participant-item:focus-within,
        .menu-button:focus-visible,
        .search-input:focus-visible {
          outline: 2px solid rgba(14, 165, 164, 0.6) !important;
          outline-offset: 1px !important; /* Reduced offset */
        }

        /* ==========================
           Enhanced Glow Effects
           ========================== */
        .title-icon {
          filter: drop-shadow(0 0 4px rgba(14, 165, 164, 0.2)); /* Reduced shadow */
        }

        .title-section.group:hover .title-icon {
          filter: drop-shadow(0 0 8px rgba(14, 165, 164, 0.4)); /* Reduced shadow */
        }

        .audio-on {
          filter: drop-shadow(0 0 2px rgba(16, 185, 129, 0.3)); /* Reduced shadow */
        }

        .audio-off {
          filter: drop-shadow(0 0 2px rgba(248, 113, 113, 0.3)); /* Reduced shadow */
        }

        .video-on {
          filter: drop-shadow(0 0 2px rgba(16, 185, 129, 0.3)); /* Reduced shadow */
        }

        .video-off {
          filter: drop-shadow(0 0 2px rgba(248, 113, 113, 0.3)); /* Reduced shadow */
        }

        .crown-icon {
          filter: drop-shadow(0 0 2px rgba(251, 191, 36, 0.4)); /* Reduced shadow */
        }

        /* ==========================
           Smooth Scrolling
           ========================== */
        * {
          scroll-behavior: smooth;
        }

        /* ==========================
           Tooltip Enhancements
           ========================== */
        :global(.ant-tooltip-inner) {
          background: linear-gradient(135deg, #0f172a, #071126) !important;
          border: 1px solid rgba(14, 165, 164, 0.2) !important;
          color: #e2e8f0 !important;
          border-radius: 6px !important; /* Smaller radius */
          backdrop-filter: blur(12px) !important;
          box-shadow: 0 6px 20px rgba(2,6,23,0.4) !important; /* Reduced shadow */
          font-size: 11px !important; /* Smaller font */
          padding: 6px 8px !important; /* Reduced padding */
        }

        :global(.ant-tooltip-arrow::before) {
          background: linear-gradient(135deg, #0f172a, #071126) !important;
          border: 1px solid rgba(14, 165, 164, 0.2) !important;
        }
      `}</style>
    </>
  );
};

export default ParticipantsList;