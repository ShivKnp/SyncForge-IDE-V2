// ChatInput.jsx
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Tooltip } from 'antd';
import { PaperClipOutlined, SendOutlined } from '@ant-design/icons';
import { motion } from 'framer-motion';

export default function ChatInput({ 
  draft, 
  setDraft, 
  handleKeyDown, 
  sendMessage, 
  onClickAttach, 
  fileInputRef, 
  onFileSelected, 
  inputRef 
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [attachHover, setAttachHover] = useState(false);
  const [sendHover, setSendHover] = useState(false);

  const hasContent = draft.trim().length > 0;

  return (
    <>
      <div className="chat-input-container">
        <input 
          type="file" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          onChange={onFileSelected} 
        />
        
        {/* Attach button */}
        <Tooltip title="Attach file" color="#0f172a">
          <motion.button 
            onClick={onClickAttach}
            className="attach-button"
            onMouseEnter={() => setAttachHover(true)}
            onMouseLeave={() => setAttachHover(false)}
            whileHover={{ scale: 1.05, y: -1 }}
            whileTap={{ scale: 0.95 }}
            aria-label="Attach file"
          >
            <PaperClipOutlined className="attach-icon" />
          </motion.button>
        </Tooltip>

        {/* Input form */}
        <form 
          onSubmit={(e) => { e.preventDefault(); sendMessage(); }} 
          className="input-form"
        >
          {/* Textarea container */}
          <div className={`textarea-container ${isFocused ? 'focused' : ''} ${hasContent ? 'has-content' : ''}`}>
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Type a message..."
              rows={1}
              className="message-textarea"
            />
          </div>

          {/* Send button */}
          <motion.button 
            type="submit" 
            className={`send-button ${hasContent ? 'has-content' : ''}`}
            onMouseEnter={() => setSendHover(true)}
            onMouseLeave={() => setSendHover(false)}
            whileHover={{ scale: 1.05, y: -1 }}
            whileTap={{ scale: 0.95 }}
            aria-label="Send message"
            disabled={!hasContent}
          >
            <SendOutlined className="send-icon" />
          </motion.button>
        </form>
      </div>

      <style jsx>{`
        /* ==========================
           Chat Input Container
           ========================== */
        .chat-input-container {
          display: flex;
          align-items: flex-end;
          gap: 10px;
          width: 100%;
          min-width: 0;
          padding: 8px;
          background: linear-gradient(135deg, rgba(15, 23, 42, 0.4), rgba(7, 17, 27, 0.4));
          border-radius: 16px;
          border: 1px solid rgba(148, 163, 184, 0.08);
          backdrop-filter: blur(16px);
          position: relative;
          box-shadow: 0 4px 16px rgba(2, 6, 23, 0.15);
        }

        /* ==========================
           Attach Button
           ========================== */
        .attach-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          flex-shrink: 0;
          border-radius: 10px;
          background: linear-gradient(135deg, rgba(51, 65, 85, 0.8), rgba(30, 41, 59, 0.8));
          border: 1px solid rgba(148, 163, 184, 0.25);
          color: #94a3b8;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          backdrop-filter: blur(12px);
          box-shadow: 0 2px 8px rgba(2, 6, 23, 0.2);
          position: relative;
          overflow: hidden;
        }

        .attach-button::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(14, 165, 164, 0.1), rgba(14, 116, 144, 0.1));
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .attach-button:hover {
          background: linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95));
          border-color: rgba(14, 165, 164, 0.3);
          color: #0ea5a4;
          box-shadow: 0 4px 16px rgba(14, 165, 164, 0.15);
          transform: translateY(-1px);
        }

        .attach-button:hover::before {
          opacity: 1;
        }

        .attach-button:active {
          transform: translateY(0) scale(0.98);
        }

        .attach-icon {
          font-size: 14px;
          transition: all 0.3s ease;
          position: relative;
          z-index: 1;
        }

        .attach-button:hover .attach-icon {
          transform: rotate(-10deg) scale(1.1);
          filter: drop-shadow(0 0 6px rgba(14, 165, 164, 0.3));
        }

        /* ==========================
           Input Form
           ========================== */
        .input-form {
          display: flex;
          align-items: flex-end;
          gap: 12px;
          flex: 1;
          min-width: 0;
        }

        /* ==========================
           Textarea Container
           ========================== */
        .textarea-container {
          flex: 1;
          min-width: 0;
          position: relative;
          border-radius: 10px;
          background: linear-gradient(135deg, rgba(51, 65, 85, 0.4), rgba(30, 41, 59, 0.4));
          border: 1px solid rgba(148, 163, 184, 0.2);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          backdrop-filter: blur(12px);
          box-shadow: inset 0 1px 3px rgba(2, 6, 23, 0.2);
          overflow: hidden;
          height: 32px;
          display: flex;
          align-items: center;
        }

        .textarea-container::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(14, 165, 164, 0.05), rgba(14, 116, 144, 0.05));
          opacity: 0;
          transition: opacity 0.3s ease;
          pointer-events: none;
        }

        .textarea-container.focused {
          background: linear-gradient(135deg, rgba(51, 65, 85, 0.6), rgba(30, 41, 59, 0.6));
          border-color: rgba(14, 165, 164, 0.4);
          box-shadow: 0 0 0 2px rgba(14, 165, 164, 0.1), inset 0 1px 3px rgba(2, 6, 23, 0.2);
          transform: none;
        }

        .textarea-container.focused::before {
          opacity: 1;
        }

        .textarea-container.has-content {
          background: linear-gradient(135deg, rgba(51, 65, 85, 0.5), rgba(30, 41, 59, 0.5));
          border-color: rgba(148, 163, 184, 0.3);
        }

        /* ==========================
           Message Textarea
           ========================== */
        .message-textarea {
          width: 100%;
          height: 32px;
          min-height: 32px;
          max-height: 96px;
          padding: 6px 12px;
          border: none;
          outline: none;
          background: transparent;
          color: #f1f5f9;
          font-size: 13px;
          font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
          font-weight: 400;
          line-height: 1.3;
          resize: none;
          overflow-y: auto;
          transition: all 0.2s ease;
          position: relative;
          z-index: 1;
          box-sizing: border-box;
        }

        .message-textarea::placeholder {
          color: #64748b;
          transition: color 0.3s ease;
          font-weight: 400;
        }

        .textarea-container.focused .message-textarea::placeholder {
          color: #94a3b8;
        }

        .message-textarea::-webkit-scrollbar {
          width: 4px;
        }

        .message-textarea::-webkit-scrollbar-track {
          background: transparent;
        }

        .message-textarea::-webkit-scrollbar-thumb {
          background: rgba(14, 165, 164, 0.3);
          border-radius: 2px;
        }

        .message-textarea::-webkit-scrollbar-thumb:hover {
          background: rgba(14, 165, 164, 0.5);
        }

        /* ==========================
           Send Button
           ========================== */
        .send-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          flex-shrink: 0;
          border-radius: 10px;
          background: linear-gradient(135deg, rgba(71, 85, 105, 0.8), rgba(51, 65, 85, 0.8));
          border: 1px solid rgba(148, 163, 184, 0.25);
          color: #64748b;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          backdrop-filter: blur(12px);
          box-shadow: 0 2px 8px rgba(2, 6, 23, 0.15);
          position: relative;
          overflow: hidden;
        }

        .send-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none !important;
        }

        .send-button::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(14, 165, 164, 0.1), rgba(14, 116, 144, 0.1));
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .send-button.has-content {
          background: linear-gradient(135deg, rgba(14, 165, 164, 0.8), rgba(14, 116, 144, 0.8));
          border-color: rgba(14, 165, 164, 0.3);
          color: #ffffff;
          box-shadow: 0 4px 16px rgba(14, 165, 164, 0.25);
        }

        .send-button.has-content:hover:not(:disabled) {
          background: linear-gradient(135deg, rgba(14, 165, 164, 0.9), rgba(14, 116, 144, 0.9));
          border-color: rgba(14, 165, 164, 0.4);
          box-shadow: 0 6px 20px rgba(14, 165, 164, 0.35);
          transform: translateY(-2px) scale(1.05);
        }

        .send-button:hover:not(:disabled):not(.has-content) {
          background: linear-gradient(135deg, rgba(71, 85, 105, 0.8), rgba(51, 65, 85, 0.8));
          border-color: rgba(148, 163, 184, 0.25);
          color: #94a3b8;
          transform: translateY(-1px);
        }

        .send-button:hover:not(:disabled)::before {
          opacity: 1;
        }

        .send-button:active:not(:disabled) {
          transform: translateY(0) scale(0.98);
        }

        .send-icon {
          font-size: 14px;
          transition: all 0.3s ease;
          position: relative;
          z-index: 1;
        }

        .send-button.has-content .send-icon {
          filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.3));
        }

        .send-button:hover:not(:disabled) .send-icon {
          transform: translateX(1px) scale(1.1);
        }

        /* ==========================
           Loading/Sending States
           ========================== */
        .send-button.sending {
          pointer-events: none;
        }

        .send-button.sending .send-icon {
          animation: sendPulse 1.5s ease-in-out infinite;
        }

        @keyframes sendPulse {
          0%, 100% { 
            transform: scale(1); 
            opacity: 1; 
          }
          50% { 
            transform: scale(1.1); 
            opacity: 0.8; 
          }
        }

        /* ==========================
           Mobile Responsiveness
           ========================== */
        @media (max-width: 768px) {
          .chat-input-container {
            gap: 8px;
            padding: 2px;
          }

          .attach-button,
          .send-button {
            width: 36px;
            height: 36px;
            border-radius: 8px;
          }

          .attach-icon,
          .send-icon {
            font-size: 14px;
          }

          .textarea-container {
            border-radius: 10px;
          }

          .message-textarea {
            padding: 8px 12px;
            min-height: 36px;
            font-size: 14px;
          }

          .input-form {
            gap: 8px;
          }
        }

        @media (max-width: 480px) {
          .chat-input-container {
            gap: 6px;
          }

          .attach-button,
          .send-button {
            width: 32px;
            height: 32px;
          }

          .attach-icon,
          .send-icon {
            font-size: 13px;
          }

          .message-textarea {
            padding: 6px 10px;
            min-height: 32px;
            font-size: 13px;
          }

          .input-form {
            gap: 6px;
          }
        }

        /* ==========================
           Focus Ring Enhancement
           ========================== */
        .attach-button:focus-visible,
        .send-button:focus-visible {
          outline: 2px solid rgba(14, 165, 164, 0.6);
          outline-offset: 2px;
        }

        .message-textarea:focus {
          outline: none;
        }

        /* ==========================
           Animation Keyframes
           ========================== */
        @keyframes iconBounce {
          0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-2px); }
          60% { transform: translateY(-1px); }
        }

        .attach-button:active .attach-icon {
          animation: iconBounce 0.4s ease;
        }

        /* ==========================
           Dark Theme Enhancements
           ========================== */
        .chat-input-container {
          background: linear-gradient(135deg, rgba(15, 23, 42, 0.02), rgba(7, 17, 27, 0.02));
          border-radius: 16px;
          padding: 8px;
          position: relative;
        }

        .chat-input-container::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at center, rgba(14, 165, 164, 0.01), transparent 70%);
          pointer-events: none;
          border-radius: 16px;
        }

        /* ==========================
           Smooth Transitions
           ========================== */
        * {
          box-sizing: border-box;
        }

        .chat-input-container,
        .attach-button,
        .textarea-container,
        .send-button,
        .message-textarea {
          will-change: transform, box-shadow;
        }

        /* ==========================
           Enhanced Glow Effects
           ========================== */
        .textarea-container.focused {
          filter: drop-shadow(0 0 8px rgba(14, 165, 164, 0.1));
        }

        .send-button.has-content {
          filter: drop-shadow(0 0 8px rgba(14, 165, 164, 0.2));
        }

        .attach-button:hover {
          filter: drop-shadow(0 0 6px rgba(14, 165, 164, 0.15));
        }

        /* ==========================
           Text Selection
           ========================== */
        .message-textarea::selection {
          background: rgba(14, 165, 164, 0.3);
          color: #f1f5f9;
        }

        /* ==========================
           Tooltip Styling
           ========================== */
        :global(.ant-tooltip-inner) {
          background: linear-gradient(135deg, #0f172a, #071126) !important;
          border: 1px solid rgba(14, 165, 164, 0.2) !important;
          color: #e2e8f0 !important;
          border-radius: 8px !important;
          backdrop-filter: blur(12px) !important;
          box-shadow: 0 8px 25px rgba(2,6,23,0.4) !important;
          font-size: 12px !important;
        }

        :global(.ant-tooltip-arrow::before) {
          background: linear-gradient(135deg, #0f172a, #071126) !important;
          border: 1px solid rgba(14, 165, 164, 0.2) !important;
        }
      `}</style>
    </>
  );
}

ChatInput.propTypes = {
  draft: PropTypes.string.isRequired,
  setDraft: PropTypes.func.isRequired,
  handleKeyDown: PropTypes.func.isRequired,
  sendMessage: PropTypes.func.isRequired,
  onClickAttach: PropTypes.func.isRequired,
  fileInputRef: PropTypes.object.isRequired,
  onFileSelected: PropTypes.func.isRequired,
  inputRef: PropTypes.object
};