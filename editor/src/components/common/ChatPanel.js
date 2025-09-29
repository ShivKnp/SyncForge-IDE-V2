// src/components/common/ChatPanel.js (smaller size version)
import React, { useEffect, useRef, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import ReconnectingWebSocket from 'reconnecting-websocket';
import { message as antdMessage, Dropdown, Menu, Modal } from 'antd';
import { DownOutlined, DeleteOutlined } from '@ant-design/icons';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import { motion, AnimatePresence } from 'framer-motion';
import { FaComment, FaTimes, FaArrowDown } from "react-icons/fa";
import { Tooltip } from 'antd';

// Backend / WS config
const CHAT_WS = (() => {
  if (process.env.REACT_APP_CHAT_WS) return process.env.REACT_APP_CHAT_WS.replace(/\/$/, '');
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const renderHost = 'syncforge-ide.onrender.com';
  return `${proto}://${renderHost}`;
})();

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';

// Local storage keys & palette
const getSessionStorageKey = (roomId) => `chat-messages-${roomId}`;
const USER_COLOR_KEY = 'chat-user-colors';
const DEFAULT_PALETTE = ['#EF4444', '#F97316', '#F59E0B', '#10B981', '#06B6D4', '#3B82F6', '#8B5CF6', '#EC4899', '#0EA5A3', '#7C3AED'];

function hashToIndex(name = '', mod = DEFAULT_PALETTE.length) {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return Math.abs(h) % mod;
}

function loadUserColors() {
  try {
    const raw = sessionStorage.getItem(USER_COLOR_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (e) { return {}; }
}

function saveUserColors(map) { try { sessionStorage.setItem(USER_COLOR_KEY, JSON.stringify(map)); } catch (e) {} }

function getUserColorFromMap(name) {
  const map = loadUserColors();
  if (map[name]) return map[name];
  const c = DEFAULT_PALETTE[hashToIndex(name)];
  map[name] = c; saveUserColors(map); return c;
}

function normalizeMsg(raw = {}) {
  return {
    id: raw.id || `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    user: raw.user || raw.from || raw.sender || 'System',
    text: raw.text || '',
    type: raw.type || (raw.fileName ? 'file' : 'chat'),
    ts: raw.ts || Date.now(),
    fileName: raw.fileName,
    fileType: raw.fileType,
    deleted: raw.deleted || false
  };
}

const TIME_WINDOW = 2 * 60 * 1000; // 2 minutes for consecutive messages
const ACCENT = '#0EA5A4'; // Match the app's cyan accent

const ChatPanel = ({ roomId, userName, ownerName, onUploadDone, onUnreadChange }) => {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [connected, setConnected] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // lightbox state
  const [lightbox, setLightbox] = useState({ visible: false, src: '', fileName: '' });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const panRef = useRef({ dragging: false, start: null, baseOffset: { x: 0, y: 0 } });

  const wsRef = useRef(null);
  const listRef = useRef(null);
  const fileInputRef = useRef(null);
  const textAreaRef = useRef(null);

  const [unreadCount, setUnreadCount] = useState(0);
  const [showJump, setShowJump] = useState(false);

  // load messages from sessionStorage on mount
  useEffect(() => {
    const stored = sessionStorage.getItem(getSessionStorageKey(roomId));
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setMessages(Array.isArray(parsed) ? parsed.map(normalizeMsg) : []);
      } catch (e) { console.error('failed to parse messages', e); }
    }
  }, [roomId]);

  // persist messages to sessionStorage
  useEffect(() => {
    try { sessionStorage.setItem(getSessionStorageKey(roomId), JSON.stringify(messages)); } catch (e) {}
  }, [messages, roomId]);

  // setup WS
  useEffect(() => {
    const url = `${CHAT_WS}/chat/${roomId}`;
    const ws = new ReconnectingWebSocket(url);
    wsRef.current = ws;

    const handleOpen = () => setConnected(true);
    const handleClose = () => setConnected(false);
    const handleError = () => setConnected(false);

    const handleMessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'history' && Array.isArray(msg.items)) {
          setMessages(msg.items.map(normalizeMsg));
          return;
        }
        if (msg.type === 'delete' && msg.id) {
          setMessages(prev => prev.map(m => (m.id === msg.id ? { ...m, deleted: true } : m)));
          return;
        }
        if (msg.type === 'clear') {
          setMessages([]);
          return;
        }
        if (msg.type === 'error') {
          antdMessage.error(msg.message || 'Server error');
          return;
        }
        if (msg && (msg.type === 'chat' || msg.type === 'file' || msg.type === 'system')) {
          setMessages(prev => {
            const nm = normalizeMsg(msg);
            if (prev.some(x => x.id === nm.id)) return prev;
            return [...prev, nm];
          });
        } else {
          setMessages(prev => [...prev, normalizeMsg({ text: ev.data, type: 'system' })]);
        }
      } catch (e) {
        setMessages(prev => [...prev, normalizeMsg({ text: ev.data, type: 'system' })]);
      }
    };

    ws.addEventListener('open', handleOpen);
    ws.addEventListener('message', handleMessage);
    ws.addEventListener('close', handleClose);
    ws.addEventListener('error', handleError);

    return () => {
      try {
        ws.removeEventListener('open', handleOpen);
        ws.removeEventListener('message', handleMessage);
        ws.removeEventListener('close', handleClose);
        ws.removeEventListener('error', handleError);
      } catch (e) {}
      try { if (ws && ws.readyState === WebSocket.OPEN) ws.close(); } catch (e) {}
    };
  }, [roomId]);

  // scroll & unread handling
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const onScroll = () => {
      const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 64;
      setShowJump(!nearBottom);
      if (nearBottom) {
        setUnreadCount(0);
        onUnreadChange && onUnreadChange(0);
      }
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [onUnreadChange]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 160;
    if (nearBottom) {
      el.scrollTo({ top: el.scrollHeight + 200, behavior: 'smooth' });
      setUnreadCount(0);
      onUnreadChange && onUnreadChange(0);
    } else {
      const last = messages[messages.length - 1];
      if (last && last.user !== (userName || '') && last.type !== 'system') {
        setUnreadCount(c => {
          const nc = c + 1;
          onUnreadChange && onUnreadChange(nc);
          return nc;
        });
      }
    }
  }, [messages, userName, onUnreadChange]);

  const sendMessage = () => {
    const text = draft.trim();
    if (!text || !wsRef.current) return;
    const payload = { type: 'chat', from: userName || 'Anonymous', text };
    if (wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
      setDraft('');
    } else {
      antdMessage.error('Not connected — message not sent.');
    }
  };

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault(); textAreaRef.current && textAreaRef.current.focus(); return;
    }
    if (e.key === '/' && !e.metaKey && !e.ctrlKey) {
      e.preventDefault(); textAreaRef.current && textAreaRef.current.focus(); return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); sendMessage();
    }
  };

  const onClickAttach = () => { if (fileInputRef.current) fileInputRef.current.click(); };

  const onFileSelected = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    const form = new FormData();
    form.append('file', file);
    form.append('userName', userName);

    const BACKEND_BASE = (process.env.REACT_APP_BACKEND_URL || '').replace(/\/$/, '') || '';
    const uploadUrl = BACKEND_BASE ? `${BACKEND_BASE}/session/${encodeURIComponent(roomId)}/upload` : `/session/${encodeURIComponent(roomId)}/upload`;

    try {
      antdMessage.loading({ content: `Uploading ${file.name}...`, key: 'upload' });
      const res = await fetch(uploadUrl, { method: 'POST', body: form });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const text = json?.error || (await res.text());
        antdMessage.error({ content: `Upload failed: ${text || res.statusText}`, key: 'upload' });
      } else {
        antdMessage.success({ content: `Uploaded ${file.name}`, key: 'upload' });
        try { if (typeof onUploadDone === 'function') onUploadDone(); } catch (_) {}
      }
    } catch (err) {
      antdMessage.error({ content: `Upload error: ${err.message}`, key: 'upload' });
    } finally {
      e.target.value = '';
    }
  };

  const getDownloadUrl = (fileName) => `${BACKEND_URL}/session/${encodeURIComponent(roomId)}/download/${encodeURIComponent(fileName)}`;

  // lightbox helpers
  const openLightbox = useCallback((src, fileName) => {
    setLightbox({ visible: true, src, fileName });
    setZoom(1); setOffset({ x: 0, y: 0 });
  }, []);
  const closeLightbox = useCallback(() => {
    setLightbox({ visible: false, src: '', fileName: '' });
    setZoom(1); setOffset({ x: 0, y: 0 });
  }, []);
  const zoomIn = () => setZoom(z => Math.min(4, +(z + 0.25).toFixed(2)));
  const zoomOut = () => setZoom(z => Math.max(1, +(z - 0.25).toFixed(2)));
  const resetZoom = () => { setZoom(1); setOffset({ x: 0, y: 0 }); };

  // pan handlers for image lightbox
  const onMouseDownPan = (e) => {
    if (zoom <= 1) return;
    panRef.current.dragging = true;
    panRef.current.start = { x: e.clientX, y: e.clientY };
    panRef.current.baseOffset = { ...offset };
    window.addEventListener('mousemove', onMouseMovePan);
    window.addEventListener('mouseup', onMouseUpPan);
  };
  const onMouseMovePan = (e) => {
    if (!panRef.current.dragging) return;
    const dx = e.clientX - panRef.current.start.x;
    const dy = e.clientY - panRef.current.start.y;
    setOffset({ x: panRef.current.baseOffset.x + dx, y: panRef.current.baseOffset.y + dy });
  };
  const onMouseUpPan = () => {
    panRef.current.dragging = false;
    window.removeEventListener('mousemove', onMouseMovePan);
    window.removeEventListener('mouseup', onMouseUpPan);
  };

  // message deletion helpers
  const deleteForEveryone = (id) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      antdMessage.error('Not connected — cannot delete for everyone.');
      return;
    }
    wsRef.current.send(JSON.stringify({ type: 'delete', id, requester: userName }));
    setMessages(prev => prev.map(m => (m.id === id ? { ...m, deleted: true } : m)));
  };

  const deleteForMe = (id) => setMessages(prev => prev.filter(m => m.id !== id));

  const clearChatForEveryone = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      antdMessage.error('Not connected — cannot clear chat.');
      return;
    }
    setIsAnimating(true);
    setTimeout(() => {
      wsRef.current.send(JSON.stringify({ type: 'clear', requester: userName }));
      setMessages([]);
      setIsAnimating(false);
    }, 300);
  };

  const scrollToBottom = () => {
    if (!listRef.current) return;
    listRef.current.scrollTo({ top: listRef.current.scrollHeight + 200, behavior: 'smooth' });
    setUnreadCount(0); onUnreadChange && onUnreadChange(0);
  };

  // Helper to determine if we should show username
  const shouldShowUsername = (currentMsg, prevMsg, currentUser) => {
    if (!prevMsg) return !currentUser; // First message, show username if not current user
    if (prevMsg.user !== currentMsg.user) return !currentUser; // Different user, show username if not current user
    const timeDiff = currentMsg.ts - prevMsg.ts;
    return timeDiff > TIME_WINDOW && !currentUser; // Show username after time gap for other users
  };

  // Helper to determine message spacing
  const getMessageSpacing = (currentMsg, prevMsg) => {
    if (!prevMsg) return 'mt-3'; // First message
    if (prevMsg.user !== currentMsg.user) return 'mt-3'; // Different user
    const timeDiff = currentMsg.ts - prevMsg.ts;
    return timeDiff > TIME_WINDOW ? 'mt-3' : 'mt-1'; // Closer spacing for consecutive messages
  };

  const getUserColor = (name) => getUserColorFromMap(name || 'System');

  return (
    <>
      <div className="chat-container animate-slideInUp">
        {/* Header */}
        <div className="chat-header">
          <div className="header-content">
            <div className="title-section group">
              <div className="icon-container">
                <FaComment className="title-icon" />
              </div>
              <div className="title-text-container">
                <div className="title-text">Chat</div>
              </div>
            </div>

            <div className="controls-section">
              <div className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
                <div className="status-indicator"></div>
                <span className="status-text">
                  {connected ? 'Connected' : 'Disconnected'}
                </span>
              </div>

              <Tooltip title="Clear conversation" color="#0f172a">
                <button
                  onClick={() => clearChatForEveryone()}
                  aria-label="Clear conversation"
                  className="clear-btn group"
                  disabled={isAnimating}
                >
                  <DeleteOutlined className="clear-icon" />
                </button>
              </Tooltip>
            </div>
          </div>
        </div>

        {/* Messages list */}
        <div
          ref={listRef}
          className="chat-messages"
          style={{
            opacity: isAnimating ? 0.6 : 1,
            transform: isAnimating ? 'scale(0.98)' : 'scale(1)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          {messages.map((msg, index) => {
            const prevMsg = index > 0 ? messages[index - 1] : null;
            const isMine = (msg.user || '') === (userName || '') && msg.type !== 'system';
            const userColor = getUserColor(msg.user);
            const showUsername = shouldShowUsername(msg, prevMsg, isMine);
            const spacing = getMessageSpacing(msg, prevMsg);

            return (
              <motion.div 
                key={msg.id} 
                className={`message-container ${spacing}`}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ 
                  duration: 0.4, 
                  delay: index * 0.02,
                  ease: [0.4, 0, 0.2, 1] 
                }}
              >
                {/* Username for other users */}
                {showUsername && !isMine && msg.type !== 'system' && (
                  <div className="username-label">
                    <span 
                      className="username-text"
                      style={{ color: userColor }}
                    >
                      {msg.user}
                    </span>
                  </div>
                )}

                {/* Message bubble container */}
                <div className={`message-row ${isMine ? 'message-mine' : 'message-theirs'}`}>
                  <div className="message-bubble-container">
                    <ChatMessage
                      m={msg}
                      mine={isMine}
                      bubbleColor={userColor}
                      getDownloadUrl={(fn) => getDownloadUrl(fn)}
                      onImageClick={(src, fname) => openLightbox(src, fname)}
                      sidebarWidth={300}
                      onDeleteForEveryone={() => deleteForEveryone(msg.id)}
                      onDeleteForMe={() => deleteForMe(msg.id)}
                      accent={ACCENT}
                      showSmallTime={false}
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}

          {/* Empty state */}
          {messages.length === 0 && (
            <div className="empty-state animate-fadeIn">
              <div className="empty-icon-container">
                <FaComment className="empty-icon" />
              </div>
              <div className="empty-text">
                <p className="empty-title">No messages yet</p>
                <p className="empty-subtitle">Start a conversation by typing a message below</p>
              </div>
            </div>
          )}

          <div className="messages-padding" />
        </div>

        {/* Jump to bottom button */}
        <AnimatePresence>
          {showJump && unreadCount > 0 && (
            <motion.button 
              initial={{ scale: 0, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0, opacity: 0, y: 20 }}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={scrollToBottom} 
              className="jump-to-bottom"
            >
              <span className="jump-text">
                {unreadCount} new message{unreadCount > 1 ? 's' : ''}
              </span>
              <FaArrowDown className="jump-icon" />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Input area */}
        <div className="chat-input-section">
          <ChatInput
            draft={draft}
            setDraft={setDraft}
            handleKeyDown={handleKeyDown}
            sendMessage={sendMessage}
            onClickAttach={onClickAttach}
            fileInputRef={fileInputRef}
            onFileSelected={onFileSelected}
            inputRef={textAreaRef}
          />
        </div>

        {/* Lightbox */}
        <AnimatePresence>
          {lightbox.visible && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="lightbox-overlay"
              onDoubleClick={resetZoom}
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }} 
                animate={{ scale: 1, opacity: 1 }} 
                exit={{ scale: 0.95, opacity: 0 }}
                className="lightbox-container"
              >
                {/* Lightbox header */}
                <div className="lightbox-header">
                  <div className="lightbox-title">{lightbox.fileName}</div>
                  <div className="lightbox-controls">
                    <button onClick={zoomOut} className="lightbox-btn zoom-btn">
                      −
                    </button>
                    <button onClick={resetZoom} className="lightbox-btn reset-btn">
                      Reset
                    </button>
                    <button onClick={zoomIn} className="lightbox-btn zoom-btn">
                      +
                    </button>
                    <button onClick={closeLightbox} className="lightbox-btn close-btn">
                      <FaTimes />
                    </button>
                  </div>
                </div>

                {/* Lightbox content */}
                <div className="lightbox-content">
                  <div onMouseDown={onMouseDownPan} className="lightbox-image-container">
                    <motion.img 
                      src={lightbox.src} 
                      alt={lightbox.fileName} 
                      className="lightbox-image"
                      style={{ 
                        transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                        transition: 'transform 0.1s ease-out'
                      }}
                      draggable={false}
                    />
                  </div>
                </div>

                {/* Lightbox footer */}
                <div className="lightbox-footer">
                  {Math.round(zoom * 100)}% zoom • Double-click to reset
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style jsx>{`
        /* ==========================
           Enhanced Animations & Transitions
           ========================== */
        @keyframes slideInUp {
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
            box-shadow: 0 0 0 4px rgba(14, 165, 164, 0);
          } 
          100% { 
            opacity: 1; 
            box-shadow: 0 0 0 0 rgba(14, 165, 164, 0);
          } 
        }

        @keyframes iconBounce {
          0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-2px); }
          60% { transform: translateY(-1px); }
        }

        @keyframes iconSpin {
          from { transform: rotate(0deg) scale(1); }
          50% { transform: rotate(180deg) scale(1.05); }
          to { transform: rotate(360deg) scale(1); }
        }

        .animate-slideInUp {
          animation: slideInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .animate-fadeIn {
          animation: fadeIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        /* ==========================
           Main Container
           ========================== */
        .chat-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 0;
          background: linear-gradient(180deg, #0a1628 0%, #0f172a 100%);
          color: #e2e8f0;
          font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
          position: relative;
          overflow: hidden;
        }

        .chat-container::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: radial-gradient(circle at bottom left, rgba(14, 165, 164, 0.02), transparent 60%);
          pointer-events: none;
          z-index: 0;
        }

        .chat-container > * {
          position: relative;
          z-index: 1;
        }

        /* ==========================
           Header Styling
           ========================== */
        .chat-header {
          padding: 12px 16px;
          background: linear-gradient(135deg, rgba(15,23,42,0.95), rgba(7,17,27,0.95));
          border-bottom: 1px solid rgba(14, 165, 164, 0.08);
          backdrop-filter: blur(12px);
          transition: all 0.3s ease;
        }

        .chat-header:hover {
          border-bottom-color: rgba(14, 165, 164, 0.15);
          background: linear-gradient(135deg, rgba(15,23,42,0.98), rgba(7,17,27,0.98));
        }

        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .title-section {
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .icon-container {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 8px;
          background: linear-gradient(135deg, rgba(14, 165, 164, 0.1), rgba(14, 116, 144, 0.1));
          border: 1px solid rgba(14, 165, 164, 0.15);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .title-icon {
          color: #0ea5a4;
          font-size: 12px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          filter: drop-shadow(0 0 4px rgba(14, 165, 164, 0.2));
        }

        .title-section.group:hover .icon-container {
          background: linear-gradient(135deg, rgba(14, 165, 164, 0.2), rgba(14, 116, 144, 0.2));
          border-color: rgba(14, 165, 164, 0.3);
          transform: translateY(-1px) scale(1.05);
          box-shadow: 0 6px 20px rgba(14, 165, 164, 0.15);
        }

        .title-section.group:hover .title-icon {
          transform: scale(1.1);
          animation: iconBounce 0.6s ease;
        }

        .title-text {
          font-size: 12px;
          font-weight: 700;
          color: #f1f5f9;
          letter-spacing: 0.3px;
          text-transform: uppercase;
          transition: all 0.3s ease;
        }

        .title-section.group:hover .title-text {
          color: #0ea5a4;
          text-shadow: 0 0 6px rgba(14, 165, 164, 0.2);
        }

        /* ==========================
           Controls Section
           ========================== */
        .controls-section {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .connection-status {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 8px;
          border-radius: 6px;
          border: 1px solid rgba(148,163,184,0.1);
          backdrop-filter: blur(8px);
          transition: all 0.3s ease;
        }

        .connection-status.connected {
          background: rgba(16, 185, 129, 0.08);
          border-color: rgba(16, 185, 129, 0.2);
        }

        .connection-status.disconnected {
          background: rgba(239, 68, 68, 0.08);
          border-color: rgba(239, 68, 68, 0.2);
        }

        .status-indicator {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          transition: all 0.3s ease;
        }

        .connected .status-indicator {
          background: linear-gradient(135deg, #10b981, #059669);
          animation: pulse 3s infinite;
        }

        .disconnected .status-indicator {
          background: linear-gradient(135deg, #ef4444, #dc2626);
          animation: pulse 3s infinite;
        }

        .status-text {
          font-size: 10px;
          font-weight: 500;
          transition: color 0.3s ease;
        }

        .connected .status-text {
          color: #10b981;
        }

        .disconnected .status-text {
          color: #ef4444;
        }

        .clear-btn {
          background: transparent;
          border: 1px solid rgba(148,163,184,0.08);
          color: #94a3b8;
          border-radius: 6px;
          padding: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          backdrop-filter: blur(4px);
        }

        .clear-btn:hover:not(:disabled) {
          background: rgba(239,68,68,0.08);
          border-color: rgba(239,68,68,0.2);
          color: #f87171;
          transform: translateY(-1px) scale(1.05);
          box-shadow: 0 3px 10px rgba(239, 68, 68, 0.15);
        }

        .clear-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none !important;
        }

        .clear-btn.group:hover:not(:disabled) .clear-icon {
          animation: iconSpin 0.4s ease;
        }

        .clear-icon {
          font-size: 12px;
          transition: all 0.3s ease;
        }

        /* ==========================
           Messages Container
           ========================== */
        .chat-messages {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 12px 16px;
          background: linear-gradient(180deg, rgba(2,6,23,0.0), rgba(2,6,23,0.02));
          display: flex;
          flex-direction: column;
          min-height: 0;
        }

        .chat-messages::-webkit-scrollbar {
          width: 4px;
        }

        .chat-messages::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.3);
          border-radius: 2px;
        }

        .chat-messages::-webkit-scrollbar-thumb {
          background: rgba(14, 165, 164, 0.2);
          border-radius: 2px;
          transition: background 0.3s ease;
        }

        .chat-messages::-webkit-scrollbar-thumb:hover {
          background: rgba(14, 165, 164, 0.4);
        }

        .message-container {
          display: flex;
          flex-direction: column;
          margin-bottom: 6px;
        }

        .username-label {
          padding: 0 12px 3px 12px;
        }

        .username-text {
          font-size: 11px;
          font-weight: 600;
          opacity: 0.8;
          transition: all 0.3s ease;
        }

        .username-label:hover .username-text {
          opacity: 1;
          transform: translateX(1px);
        }

        .message-row {
          display: flex;
          padding: 0 6px;
        }

        .message-mine {
          justify-content: flex-end;
        }

        .message-theirs {
          justify-content: flex-start;
        }

        .message-bubble-container {
          max-width: 85%;
          display: flex;
          flex-direction: column;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .message-container:hover .message-bubble-container {
          transform: translateY(-0.5px);
        }

        .messages-padding {
          height: 12px;
          flex-shrink: 0;
        }

        /* ==========================
           Empty State
           ========================== */
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 16px;
          text-align: center;
          opacity: 0.8;
          flex: 1;
        }

        .empty-icon-container {
          width: 60px;
          height: 60px;
          border-radius: 12px;
          background: linear-gradient(135deg, rgba(14, 165, 164, 0.1), rgba(14, 116, 144, 0.1));
          border: 1px solid rgba(14, 165, 164, 0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
          transition: all 0.3s ease;
        }

        .empty-icon {
          font-size: 24px;
          color: #94a3b8;
          opacity: 0.6;
          transition: all 0.3s ease;
        }

        .empty-state:hover .empty-icon-container {
          background: linear-gradient(135deg, rgba(14, 165, 164, 0.15), rgba(14, 116, 144, 0.15));
          border-color: rgba(14, 165, 164, 0.25);
          transform: translateY(-2px) scale(1.05);
        }

        .empty-state:hover .empty-icon {
          color: #0ea5a4;
          opacity: 0.8;
          transform: scale(1.05);
        }

        .empty-text {
          max-width: 240px;
        }

        .empty-title {
          font-size: 14px;
          font-weight: 600;
          color: #cbd5e1;
          margin-bottom: 6px;
          transition: color 0.3s ease;
        }

        .empty-subtitle {
          font-size: 12px;
          color: #94a3b8;
          margin: 0;
          line-height: 1.4;
          transition: color 0.3s ease;
        }

        .empty-state:hover .empty-title {
          color: #f1f5f9;
        }

        .empty-state:hover .empty-subtitle {
          color: #cbd5e1;
        }

        /* ==========================
           Jump to Bottom Button
           ========================== */
        .jump-to-bottom {
          position: fixed;
          bottom: 100px;
          right: 20px;
          z-index: 50;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 12px;
          border-radius: 10px;
          background: linear-gradient(135deg, rgba(14, 165, 164, 0.15), rgba(14, 116, 144, 0.15));
          border: 1px solid rgba(14, 165, 164, 0.25);
          color: #0ea5a4;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          backdrop-filter: blur(12px);
          box-shadow: 0 6px 20px rgba(2,6,23,0.4);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .jump-to-bottom:hover {
          background: linear-gradient(135deg, rgba(14, 165, 164, 0.25), rgba(14, 116, 144, 0.25));
          border-color: rgba(14, 165, 164, 0.4);
          box-shadow: 0 8px 25px rgba(14, 165, 164, 0.25);
          filter: drop-shadow(0 0 6px rgba(14, 165, 164, 0.3));
        }

        .jump-text {
          white-space: nowrap;
        }

        .jump-icon {
          font-size: 9px;
          transition: transform 0.3s ease;
        }

        .jump-to-bottom:hover .jump-icon {
          transform: translateY(1px);
        }

        /* ==========================
           Input Section
           ========================== */
        .chat-input-section {
          padding: 12px 16px;
          border-top: 1px solid rgba(14, 165, 164, 0.08);
          background: linear-gradient(135deg, rgba(15,23,42,0.95), rgba(7,17,27,0.95));
          backdrop-filter: blur(12px);
          transition: all 0.3s ease;
        }

        .chat-input-section:hover {
          border-top-color: rgba(14, 165, 164, 0.15);
          background: linear-gradient(135deg, rgba(15,23,42,0.98), rgba(7,17,27,0.98));
        }

        /* ==========================
           Lightbox Styling
           ========================== */
        .lightbox-overlay {
          position: fixed;
          inset: 0;
          z-index: 60;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0,0,0,0.85);
          backdrop-filter: blur(8px);
        }

        .lightbox-container {
          width: 100%;
          max-width: 900px;
          max-height: 85vh;
          background: linear-gradient(180deg, rgba(15,23,42,0.95), rgba(7,17,27,0.95));
          backdrop-filter: blur(16px);
          border-radius: 14px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          border: 1px solid rgba(14, 165, 164, 0.15);
          box-shadow: 0 16px 40px rgba(2,6,23,0.6);
          margin: 16px;
        }

        .lightbox-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 10px;
          border-bottom: 1px solid rgba(14, 165, 164, 0.08);
        }

        .lightbox-title {
          color: #f1f5f9;
          font-weight: 600;
          font-size: 14px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          flex: 1;
          margin-right: 12px;
        }

        .lightbox-controls {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .lightbox-btn {
          background: rgba(15, 23, 42, 0.8);
          border: 1px solid rgba(14, 165, 164, 0.15);
          border-radius: 6px;
          padding: 6px 10px;
          color: #cbd5e1;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          backdrop-filter: blur(8px);
          font-weight: 500;
          font-size: 12px;
        }

        .lightbox-btn:hover {
          background: rgba(15, 23, 42, 0.95);
          border-color: rgba(14, 165, 164, 0.3);
          color: #f1f5f9;
          transform: translateY(-0.5px);
        }

        .zoom-btn:hover {
          color: #0ea5a4;
          border-color: rgba(14, 165, 164, 0.4);
        }

        .reset-btn:hover {
          color: #60a5fa;
          border-color: rgba(96, 165, 250, 0.4);
        }

        .close-btn {
          background: rgba(239, 68, 68, 0.1);
          border-color: rgba(239, 68, 68, 0.2);
          color: #f87171;
        }

        .close-btn:hover {
          background: rgba(239, 68, 68, 0.2);
          border-color: rgba(239, 68, 68, 0.4);
          color: #fecaca;
        }

        .lightbox-content {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          border-radius: 10px;
          background: rgba(0,0,0,0.3);
          position: relative;
        }

        .lightbox-image-container {
          cursor: grab;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
        }

        .lightbox-image-container:active {
          cursor: grabbing;
        }

        .lightbox-image {
          max-width: 100%;
          max-height: 65vh;
          border-radius: 6px;
          box-shadow: 0 6px 20px rgba(2,6,23,0.4);
          object-fit: contain;
        }

        .lightbox-footer {
          text-align: center;
          color: #94a3b8;
          font-size: 12px;
          padding-top: 6px;
          border-top: 1px solid rgba(14, 165, 164, 0.08);
        }

        /* ==========================
           Mobile Responsiveness
           ========================== */
        @media (max-width: 768px) {
          .chat-header {
            padding: 10px 12px;
          }

          .header-content {
            gap: 8px;
          }

          .title-text {
            font-size: 11px;
          }

          .icon-container {
            width: 24px;
            height: 24px;
          }

          .title-icon {
            font-size: 10px;
          }

          .controls-section {
            gap: 6px;
          }

          .connection-status {
            padding: 3px 6px;
          }

          .status-text {
            font-size: 9px;
          }

          .chat-messages {
            padding: 10px 12px;
          }

          .message-bubble-container {
            max-width: 90%;
          }

          .username-label {
            padding: 0 10px 2px 10px;
          }

          .message-row {
            padding: 0 3px;
          }

          .chat-input-section {
            padding: 10px 12px;
          }

          .jump-to-bottom {
            bottom: 90px;
            right: 12px;
            padding: 8px 10px;
            font-size: 10px;
          }

          .empty-state {
            padding: 30px 12px;
          }

          .empty-icon-container {
            width: 50px;
            height: 50px;
          }

          .empty-icon {
            font-size: 20px;
          }

          .lightbox-container {
            margin: 12px;
            padding: 12px;
            max-height: 90vh;
          }

          .lightbox-controls {
            gap: 4px;
          }

          .lightbox-btn {
            padding: 5px 8px;
            font-size: 11px;
          }
        }

        @media (max-width: 480px) {
          .chat-header {
            padding: 8px 10px;
          }

          .header-content {
            flex-direction: column;
            align-items: stretch;
            gap: 8px;
          }

          .title-section {
            justify-content: center;
          }

          .controls-section {
            justify-content: space-between;
          }

          .chat-messages {
            padding: 8px 10px;
          }

          .message-bubble-container {
            max-width: 92%;
          }

          .chat-input-section {
            padding: 8px 10px;
          }

          .jump-to-bottom {
            bottom: 80px;
            right: 10px;
            padding: 6px 8px;
            font-size: 9px;
          }

          .jump-text {
            display: none;
          }

          .lightbox-container {
            margin: 8px;
            padding: 10px;
          }

          .lightbox-title {
            font-size: 12px;
          }
        }

        /* ==========================
           Enhanced Focus States
           ========================== */
        .clear-btn:focus,
        .jump-to-bottom:focus,
        .lightbox-btn:focus {
          outline: 1px solid rgba(14, 165, 164, 0.4) !important;
          outline-offset: 1px !important;
        }

        /* ==========================
           Performance Optimizations
           ========================== */
        .chat-container {
          will-change: transform;
          backface-visibility: hidden;
        }

        .message-container,
        .jump-to-bottom,
        .clear-btn,
        .lightbox-container {
          will-change: transform, box-shadow;
        }

        /* ==========================
           Text Selection
           ========================== */
        .chat-container *::selection {
          background: rgba(14, 165, 164, 0.2);
          color: #f1f5f9;
        }

        /* ==========================
           Accessibility Improvements
           ========================== */
        .clear-btn:focus-visible,
        .jump-to-bottom:focus-visible,
        .lightbox-btn:focus-visible {
          outline: 1px solid rgba(14, 165, 164, 0.6) !important;
          outline-offset: 1px !important;
        }

        /* ==========================
           Enhanced Glow Effects
           ========================== */
        .title-icon {
          filter: drop-shadow(0 0 4px rgba(14, 165, 164, 0.2));
        }

        .title-section.group:hover .title-icon {
          filter: drop-shadow(0 0 8px rgba(14, 165, 164, 0.4));
        }

        .jump-to-bottom:hover {
          filter: drop-shadow(0 0 6px rgba(14, 165, 164, 0.3));
        }

        .connected .status-indicator {
          filter: drop-shadow(0 0 3px rgba(16, 185, 129, 0.4));
        }

        .disconnected .status-indicator {
          filter: drop-shadow(0 0 3px rgba(239, 68, 68, 0.4));
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
          border-radius: 6px !important;
          backdrop-filter: blur(12px) !important;
          box-shadow: 0 6px 20px rgba(2,6,23,0.4) !important;
          font-size: 11px !important;
        }

        :global(.ant-tooltip-arrow::before) {
          background: linear-gradient(135deg, #0f172a, #071126) !important;
          border: 1px solid rgba(14, 165, 164, 0.2) !important;
        }

        /* ==========================
           Message Notification Styling
           ========================== */
        :global(.ant-message-notice-content) {
          background: linear-gradient(135deg, #0f172a, #071126) !important;
          border: 1px solid rgba(14, 165, 164, 0.2) !important;
          color: #e2e8f0 !important;
          border-radius: 6px !important;
          backdrop-filter: blur(12px) !important;
          box-shadow: 0 6px 20px rgba(2,6,23,0.4) !important;
        }
      `}</style>
    </>
  );
};

ChatPanel.propTypes = {
  roomId: PropTypes.string.isRequired,
  userName: PropTypes.string,
  ownerName: PropTypes.string,
  onUploadDone: PropTypes.func,
  onUnreadChange: PropTypes.func
};

export default ChatPanel;