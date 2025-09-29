// src/components/common/ChatMessage.js
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { DownloadOutlined, DownOutlined, MoreOutlined } from '@ant-design/icons';
import { Modal, Menu, Dropdown, Tooltip } from 'antd';
import { motion } from 'framer-motion';

const { confirm } = Modal;

/**
 * Optimized ChatMessage Component
 * - Compact design for 320px sidebar width
 * - Reduced blur effects
 * - Original text and bubble sizes
 * - Dark bluish color scheme matching background
 */
const ChatMessage = ({
  m,
  mine,
  bubbleColor,
  getDownloadUrl,
  onImageClick,
  sidebarWidth,
  onDeleteForEveryone,
  onDeleteForMe,
  accent = '#0ea5a4',
  showSmallTime = false
}) => {
  const [hover, setHover] = useState(false);

  // Compact bubble base styles - original sizes
  const bubbleBase = {
    position: 'relative',
    padding: '6px 10px',
    borderRadius: '16px',
    maxWidth: '220px', // Reduced for 320px sidebar
    minWidth: '50px',
    wordBreak: 'break-word',
    overflowWrap: 'break-word',
    whiteSpace: 'pre-wrap',
    display: 'inline-block',
    fontSize: '13px', // Original smaller size
    fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif',
    fontWeight: '400',
    lineHeight: '1.3', // Original tighter spacing
    transition: 'all 0.2s ease',
    transform: hover ? 'translateY(-1px)' : 'translateY(0)', // Reduced transform
  };

  // My message styles - darker blue matching background
  const mineStyle = {
    ...bubbleBase,
    background: '#21717e30', // Solid blue-600, no transparency
    color: '#ffffff',
    boxShadow: hover 
      ? '0 4px 12px rgba(30, 64, 175, 0.3)'
      : '0 2px 6px rgba(0, 0, 0, 0.1)',
    borderBottomRightRadius: '4px',
    border: '1px solid rgba(59, 130, 246, 0.2)',
  };

  // Other person's message styles - dark bluish grey
  const otherStyle = {
    ...bubbleBase,
    background: '#3341556d', // Slate-700, solid color
    color: '#e2e8f0',
    boxShadow: hover 
      ? '0 4px 12px rgba(51, 65, 85, 0.3)'
      : '0 2px 6px rgba(0, 0, 0, 0.1)',
    borderBottomLeftRadius: '4px',
    border: '1px solid rgba(71, 85, 105, 0.3)',
  };

  const confirmDeleteForEveryone = (cb) => {
    confirm({
      title: 'Delete message for everyone?',
      content: 'This will remove the message for all participants. This cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk() { cb && cb(); },
      centered: true,
    });
  };

  const menu = (
    <Menu
      style={{
        background: '#1e293b',
        border: '1px solid rgba(71, 85, 105, 0.3)',
        borderRadius: '8px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
        minWidth: '140px',
        padding: '4px',
      }}
    >
      {mine && (
        <Menu.Item 
          key="del-all" 
          onClick={() => confirmDeleteForEveryone(onDeleteForEveryone)}
          style={{ 
            color: '#f87171', 
            fontSize: '12px',
            padding: '6px 8px',
            margin: '2px 0',
            borderRadius: '6px',
            fontWeight: '500',
            height: 'auto',
            lineHeight: '1.3',
          }}
        >
          Delete for everyone
        </Menu.Item>
      )}
      <Menu.Item 
        key="del-me" 
        onClick={() => onDeleteForMe && onDeleteForMe()}
        style={{ 
          color: mine ? '#94a3b8' : '#e2e8f0', 
          fontSize: '12px',
          padding: '6px 8px',
          margin: '2px 0',
          borderRadius: '6px',
          fontWeight: '500',
          height: 'auto',
          lineHeight: '1.3',
        }}
      >
        {mine ? 'Delete for me' : 'Remove'}
      </Menu.Item>
    </Menu>
  );

  // Original timestamp style
  const timestampStyle = {
    fontSize: '11px',
    fontWeight: '400',
    color: mine ? 'rgba(255, 255, 255, 0.7)' : 'rgba(226, 232, 240, 0.7)',
    marginLeft: '8px',
    marginTop: '2px',
    flexShrink: 0,
    alignSelf: 'flex-end',
  };

  // Smaller action button
  const actionButtonStyle = {
    position: 'absolute',
    top: '2px',
    right: mine ? '2px' : undefined,
    left: mine ? undefined : '2px',
    background: 'rgba(0, 0, 0, 0.6)',
    borderRadius: '50%',
    width: '18px',
    height: '18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: hover ? 1 : 0,
    transition: 'opacity 0.2s ease',
    cursor: 'pointer',
    zIndex: 10,
    border: '1px solid rgba(255, 255, 255, 0.2)',
  };

  // Compact download button style
  const downloadButtonStyle = {
    color: mine ? 'rgba(255, 255, 255, 0.9)' : '#94a3b8',
    fontSize: '12px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '10px',
    background: mine ? '#9ca2a509' : '#9ca2a509',
    border: `1px solid ${mine ? 'rgba(59, 130, 246, 0.3)' : 'rgba(71, 85, 105, 0.3)'}`,
    transition: 'all 0.2s ease',
    textDecoration: 'none',
    fontWeight: '500',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  };

  if (m.deleted) {
    return (
      <motion.div 
        style={{
          ...bubbleBase,
          background: '#475569',
          color: '#94a3b8',
          fontStyle: 'italic',
          fontSize: '13px',
          padding: '8px 12px',
          borderRadius: '16px',
          border: '1px solid rgba(71, 85, 105, 0.3)',
        }}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
      >
        This message was deleted
      </motion.div>
    );
  }

  // Image file handling - reduced blur
  if (m.type === 'file') {
    const fileUrl = getDownloadUrl(m.fileName);
    if (m.fileType && m.fileType.startsWith('image/')) {
      const maxImgWidth = Math.min(280, 200); // Max 200px for 320px sidebar
      return (
        <motion.div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: mine ? 'flex-end' : 'flex-start',
            gap: '8px',
            position: 'relative',
            width: '100%',
            minWidth: 0,
          }}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Image container - minimal blur */}
          <div 
            style={{ 
              position: 'relative', 
              width: '100%', 
              maxWidth: maxImgWidth,
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: hover 
                ? '0 6px 20px rgba(0, 0, 0, 0.2)' 
                : '0 3px 10px rgba(0, 0, 0, 0.1)',
              transform: hover ? 'translateY(-2px)' : 'translateY(0)',
              transition: 'all 0.2s ease',
            }}
          >
            <a
              href={fileUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => { 
                e.preventDefault(); 
                onImageClick && onImageClick(fileUrl, m.fileName); 
              }}
              style={{ display: 'block' }}
            >
              <img
                src={fileUrl}
                alt={m.fileName}
                loading="lazy"
                style={{ 
                  width: '100%', 
                  height: 'auto', 
                  maxHeight: '200px', 
                  objectFit: 'cover', 
                  display: 'block',
                }}
                draggable={false}
              />
            </a>

            {/* Minimal overlay - no blur */}
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '40px',
              background: 'linear-gradient(transparent, rgba(0, 0, 0, 0.7))',
              display: 'flex',
              alignItems: 'flex-end',
              padding: '8px 12px',
            }}>
              <span style={{ 
                color: '#ffffff', 
                fontSize: '12px', 
                fontWeight: '500',
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {m.fileName}
              </span>
            </div>

            {/* Small action button */}
            {hover && (
              <div style={actionButtonStyle}>
                <Dropdown overlay={menu} trigger={['click']}>
                  <a onClick={e => e.preventDefault()} style={{ 
                    color: '#ffffff', 
                    fontSize: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%',
                    height: '100%',
                  }} aria-label="message menu">
                    <MoreOutlined />
                  </a>
                </Dropdown>
              </div>
            )}
          </div>

          {/* Compact download button */}
          <Tooltip title="Download image">
            <a 
              href={fileUrl} 
              download 
              style={downloadButtonStyle}
              onMouseEnter={(e) => {
                e.target.style.background = mine ? '#9ba1a123' : '#7e858f30';
                e.target.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = mine ? '#c6c9d005' : '#71777e17';
                e.target.style.transform = 'translateY(0)';
              }}
            >
              <DownloadOutlined />
             
            </a>
          </Tooltip>
        </motion.div>
      );
    }

    // Non-image file with compact layout
    return (
      <motion.div 
        style={{ 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: mine ? 'flex-end' : 'flex-start',
          gap: '8px', 
          maxWidth: '85%',
        }} 
        onMouseEnter={() => setHover(true)} 
        onMouseLeave={() => setHover(false)}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <div style={{ ...bubbleBase, ...(mine ? mineStyle : otherStyle), minWidth: '180px' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px',
            position: 'relative',
            paddingRight: '40px',
          }}>
            {/* Compact file icon */}
            <div 
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: mine ? 'rgba(255, 255, 255, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                border: `1px solid ${mine ? 'rgba(255, 255, 255, 0.2)' : 'rgba(148, 163, 184, 0.2)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
              }}
            >
              📄
            </div>
            
            {/* Compact file details */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ 
                fontWeight: '600', 
                fontSize: '13px', 
                marginBottom: '2px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                color: mine ? '#ffffff' : '#f1f5f9',
              }}>
                {m.fileName}
              </div>
              <div style={{ 
                fontSize: '11px', 
                color: mine ? 'rgba(255,255,255,0.8)' : 'rgba(241,243,245,0.7)',
                fontWeight: '500',
                textTransform: 'uppercase',
                letterSpacing: '0.3px',
              }}>
                {m.fileType?.split('/')[1] || 'file'}
              </div>
            </div>
          </div>

          {/* Timestamp */}
          <div style={{
            ...timestampStyle,
            position: 'absolute',
            bottom: '6px',
            right: '10px',
            fontSize: '10px',
          }}>
            {new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>

          {/* Action button */}
          {hover && (
            <div style={actionButtonStyle}>
              <Dropdown overlay={menu} trigger={['click']}>
                <a onClick={e => e.preventDefault()} style={{ 
                  color: '#ffffff', 
                  fontSize: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  height: '100%',
                }} aria-label="message menu">
                  <MoreOutlined />
                </a>
              </Dropdown>
            </div>
          )}
        </div>

        {/* Download button for files */}
        <Tooltip title={`Download ${m.fileName}`}>
          <a 
            href={getDownloadUrl(m.fileName)} 
            download 
            style={downloadButtonStyle}
            onMouseEnter={(e) => {
                e.target.style.background = mine ? '#9ba1a123' : '#7e858f30';
                e.target.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = mine ? '#c6c9d005' : '#71777e17';
                e.target.style.transform = 'translateY(0)';
              }}
          >
            <DownloadOutlined />
            
          </a>
        </Tooltip>
      </motion.div>
    );
  }

  // Code block - no blur
  const isCode = typeof m.text === 'string' && (
    m.text.includes('\n') || 
    m.text.startsWith('npm') || 
    m.text.startsWith('`') ||
    m.text.includes('function') ||
    m.text.includes('const ') ||
    m.text.includes('let ')
  );
  
  if (isCode) {
    return (
      <motion.div 
        style={{ position: 'relative' }} 
        onMouseEnter={() => setHover(true)} 
        onMouseLeave={() => setHover(false)}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <pre
          style={{
            ...bubbleBase,
            ...(mine ? {
              ...mineStyle,
              background: '#1e3a8a', // Darker blue for code
            } : {
              ...otherStyle,
              background: '#374151', // Darker grey for code
            }),
            fontFamily: '"SF Mono", "Monaco", "Inconsolata", "Roboto Mono", monospace',
            fontSize: '12px',
            lineHeight: '1.4',
            margin: 0,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            paddingRight: '50px',
            border: `1px solid ${mine ? 'rgba(59, 130, 246, 0.3)' : 'rgba(71, 85, 105, 0.3)'}`,
          }}
        >
          {m.text}
          
          {showSmallTime && (
            <div style={{
              ...timestampStyle,
              position: 'absolute',
              bottom: '8px',
              right: '10px',
              fontSize: '10px',
            }}>
              {new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </pre>

        {/* Action button */}
        {hover && (
          <div style={{
            ...actionButtonStyle,
            top: '8px',
          }}>
            <Dropdown overlay={menu} trigger={['click']}>
              <a onClick={e => e.preventDefault()} style={{ 
                color: '#ffffff', 
                fontSize: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                height: '100%',
              }} aria-label="message menu">
                <MoreOutlined />
              </a>
            </Dropdown>
          </div>
        )}
      </motion.div>
    );
  }

  // Default text message - original compact size
  return (
    <motion.div 
      style={{ minWidth: 0, position: 'relative' }} 
      onMouseEnter={() => setHover(true)} 
      onMouseLeave={() => setHover(false)}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <div style={{
          ...(mine ? mineStyle : otherStyle),
          display: 'inline-flex',
          alignItems: 'flex-end',
          gap: '4px',
          minWidth: '50px',
          maxWidth: '220px',
          width: 'auto',
        }}>
          {/* Message text - original size */}
          <div style={{ 
            whiteSpace: 'pre-wrap',
            wordBreak: 'normal',
            overflowWrap: 'break-word',
            fontWeight: '400',
            flex: 1,
            minWidth: 0,
            fontSize: '13px',
            lineHeight: '1.3',
          }}>
            {String(m.text || '')}
          </div>

          {/* Compact timestamp */}
          <div style={{
            fontSize: '10px',
            color: mine ? 'rgba(255, 255, 255, 0.7)' : 'rgba(226, 232, 240, 0.7)',
            flexShrink: 0,
            marginLeft: '4px',
            whiteSpace: 'nowrap',
            opacity: 0.8,
          }}>
            {new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>

        {/* Small action button */}
        {hover && (
          <div style={{
            position: 'absolute',
            top: '1px',
            right: mine ? '1px' : undefined,
            left: mine ? undefined : '1px',
            background: 'rgba(0, 0, 0, 0.6)',
            borderRadius: '50%',
            width: '16px',
            height: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 10,
            opacity: hover ? 1 : 0,
            transition: 'opacity 0.2s ease',
          }}>
            <Dropdown overlay={menu} trigger={['click']}>
              <a onClick={e => e.preventDefault()} style={{ 
                color: '#ffffff', 
                fontSize: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                height: '100%',
              }} aria-label="message menu">
                <MoreOutlined />
              </a>
            </Dropdown>
          </div>
        )}
      </div>
    </motion.div>
  );
};

ChatMessage.propTypes = {
  m: PropTypes.object.isRequired,
  mine: PropTypes.bool,
  bubbleColor: PropTypes.string,
  getDownloadUrl: PropTypes.func.isRequired,
  onImageClick: PropTypes.func,
  sidebarWidth: PropTypes.number,
  onDeleteForEveryone: PropTypes.func,
  onDeleteForMe: PropTypes.func,
  accent: PropTypes.string,
  showSmallTime: PropTypes.bool
};

export default ChatMessage;