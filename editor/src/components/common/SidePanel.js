// src/components/common/SidePanel.js
import React, { useRef, useEffect, useState } from 'react';
import { Input, Button, Select, Tooltip, Space } from 'antd';
import {
  PlayCircleOutlined,
  CodeOutlined,
  FileTextOutlined,
  LockOutlined,
  CopyOutlined,
  DeleteOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import { FaTerminal, FaCog } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';

const { TextArea } = Input;
const { Option } = Select;

const languageLabelMap = {
  cpp: 'C++',
  java: 'Java',
  python: 'Python 3'
};
const supportedRuntimes = new Set(['cpp', 'java', 'python']);

const SidePanel = ({
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
  terminalVisible,
  onToggleTerminal
}) => {
  const wrapperRef = useRef(null);
  const [isCompact, setIsCompact] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hoverStates, setHoverStates] = useState({});

  const isPolyglot = roomMode === 'polyglot';
  const displayLangKey = isPolyglot ? (lang || 'cpp') : (projectLanguage || lang || 'cpp');
  const displayLangLabel = languageLabelMap[displayLangKey] || displayLangKey.toUpperCase();
  const isRunSupported = supportedRuntimes.has(isPolyglot ? (lang || 'cpp') : displayLangKey);
  const isSharedRun = (typeof sharedInputOutput === 'boolean') ? sharedInputOutput : (roomMode === 'project');

  useEffect(() => {
    if (!wrapperRef.current) return;
    const el = wrapperRef.current;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const w = Math.round(entry.contentRect.width);
        setIsCompact(w < 280);
      }
    });
    ro.observe(el);
    setIsCompact(el.clientWidth < 340);
    return () => ro.disconnect();
  }, []);

  const copyOutput = async () => {
    try {
      await navigator.clipboard.writeText(output || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (e) {
      setCopied(false);
    }
  };

  const clearInput = () => {
    handleInput({ target: { value: '' } });
  };

  const setHoverState = (key, value) => {
    setHoverStates(prev => ({ ...prev, [key]: value }));
  };

  return (
    <>
      <motion.aside
        ref={wrapperRef}
        className="side-panel-container animate-slideInUp"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      >
        {/* Header */}
        <motion.div 
          className="side-panel-header"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <div className="header-content">
            <div className="title-section group">
              <motion.div 
                className="icon-container"
                whileHover={{ scale: 1.05, rotate: 5 }}
                transition={{ duration: 0.2 }}
              >
                <FaTerminal className="title-icon" />
              </motion.div>
              <div className="title-text-container">
                <div className="title-text">Compiler</div>
              </div>
            </div>

            <div className="header-controls">
              

              <Tooltip title="Run code (Ctrl + Enter)" color="#0f172a">
                <motion.div
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button
                    type="primary"
                    icon={<PlayCircleOutlined />}
                    onClick={handleRun}
                    loading={runCodeDisabled}
                    disabled={runCodeDisabled || !isRunSupported}
                    size="small"
                    className="run-button"
                  >
                    {isCompact ? null : (runCodeDisabled ? 'Running...' : 'Run')}
                  </Button>
                </motion.div>
              </Tooltip>
            </div>
          </div>
        </motion.div>

        {/* Body */}
        <div className="side-panel-body">
          {/* Language card */}
          <motion.div 
            className="panel-card"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            whileHover={{ y: -1 }}
            onMouseEnter={() => setHoverState('language', true)}
            onMouseLeave={() => setHoverState('language', false)}
          >
            <div className="card-header">
              <div className="card-header-left">
                <motion.div
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.3 }}
                >
                  <CodeOutlined className="card-icon" />
                </motion.div>
                <div className="card-title">Language</div>
              </div>
              {!isPolyglot && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  <LockOutlined className="lock-icon" />
                </motion.div>
              )}
            </div>

            <div className="card-content">
              {isPolyglot ? (
                <Select
                  value={lang}
                  onChange={handleLang}
                  size="small"
                  className="language-select"
                  popupClassName="language-dropdown"
                  suffixIcon={<CodeOutlined className="select-icon" />}
                  optionLabelProp="children"
                >
                  <Option value="cpp">C++</Option>
                  <Option value="java">Java</Option>
                  <Option value="python">Python 3</Option>
                </Select>
              ) : (
                <div className="locked-language">
                  <div className="language-name">{displayLangLabel}</div>
                  <motion.div 
                    className="locked-badge"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    Locked
                  </motion.div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Input panel */}
          <motion.div 
            className="panel-card"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
            whileHover={{ y: -1 }}
            onMouseEnter={() => setHoverState('input', true)}
            onMouseLeave={() => setHoverState('input', false)}
          >
            <div className="card-header">
              <div className="card-header-left">
                <FileTextOutlined className="card-icon" />
                <div className="card-title">Input</div>
              </div>
              <div className="card-header-right">
                <Tooltip title="Clear input" color="#0f172a">
                  <motion.button 
                    onClick={clearInput} 
                    className="action-button clear-button"
                    whileHover={{ scale: 1.05, rotate: -5 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <DeleteOutlined />
                  </motion.button>
                </Tooltip>
                <motion.div 
                  className="char-count"
                  animate={{ scale: hoverStates.input ? 1.02 : 1 }}
                  transition={{ duration: 0.2 }}
                >
                  {(input || '').length} chars
                </motion.div>
              </div>
            </div>

            <div className="card-content">
              <TextArea
                value={input}
                onChange={handleInput}
                placeholder="Provide input for your program (stdin)."
                autoSize={{ minRows: 3, maxRows: 6 }}
                className="custom-textarea"
                bordered={false}
                style={{ resize: 'vertical'}}
                size="small"
              />
            </div>
          </motion.div>

          {/* Output panel */}
          <motion.div 
            className="panel-card"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.4 }}
            whileHover={{ y: -1 }}
            onMouseEnter={() => setHoverState('output', true)}
            onMouseLeave={() => setHoverState('output', false)}
          >
            <div className="card-header">
              <div className="card-header-left">
                <FaTerminal className="card-icon" />
                <div className="card-title">Output</div>
              </div>

              <Space size={6}>
                <Tooltip title={copied ? 'Copied!' : 'Copy output'} color="#0f172a">
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Button 
                      size="small" 
                      icon={
                        <motion.div
                          initial={false}
                          animate={{ scale: copied ? 1.1 : 1 }}
                          transition={{ duration: 0.2 }}
                        >
                          {copied ? (
                            <CheckCircleOutlined className="success-icon" />
                          ) : (
                            <CopyOutlined />
                          )}
                        </motion.div>
                      }
                      onClick={copyOutput} 
                      className="copy-button"
                    />
                  </motion.div>
                </Tooltip>
              </Space>
            </div>

            <div className="card-content">
              <TextArea
                value={output}
                readOnly
                autoSize={{ minRows: 4, maxRows: 8 }}
                className="custom-textarea output-textarea"
                bordered={false}
                style={{ resize: 'vertical' }}
                placeholder="Program output will appear here..."
                size="small"
              />

              <motion.div 
                className="output-info"
                animate={{ opacity: hoverStates.output ? 1 : 0.8 }}
                transition={{ duration: 0.2 }}
              >

                <div className="output-length">
                  {output ? `${(output || '').length} chars` : 'No output yet'}
                </div>
                
 
                <div className="encoding-badge">UTF-8</div>
                 
              </motion.div>
              
            </div>
          </motion.div>
          
        </div>
        
      </motion.aside>

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

        @keyframes iconGlow {
          0%, 100% { 
            filter: drop-shadow(0 0 3px rgba(14, 165, 164, 0.2)); 
          }
          50% { 
            filter: drop-shadow(0 0 6px rgba(14, 165, 164, 0.3)); 
          }
        }

        .animate-slideInUp {
          animation: slideInUp 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }

        /* ==========================
           Side Panel Container
           ========================== */
        .side-panel-container {
          height: 100%;
          display: flex;
          flex-direction: column;
          background: linear-gradient(180deg, #0a1628 0%, #0f172a 100%);
          color: #e2e8f0;
          font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
          position: relative;
          overflow: hidden;
          font-size: 12px;
          will-change: transform;
          backface-visibility: hidden;
        }

        .side-panel-container::before {
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

        .side-panel-container > * {
          position: relative;
          z-index: 1;
        }

        /* ==========================
           Header Styling
           ========================== */
        .side-panel-header {
          padding: 12px 16px;
          background: linear-gradient(135deg, rgba(15,23,42,0.95), rgba(7,17,27,0.95));
          border-bottom: 1px solid rgba(14, 165, 164, 0.08);
          backdrop-filter: blur(12px);
          transition: all 0.3s ease;
        }

        .side-panel-header:hover {
          border-bottom-color: rgba(14, 165, 164, 0.15);
          background: linear-gradient(135deg, rgba(15,23,42,0.98), rgba(7,17,27,0.98));
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

        .header-controls {
          display: flex;
          align-items: center;
          gap: 8px;
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

        .run-button {
          background: linear-gradient(135deg, rgba(14, 165, 164, 0.9), rgba(14, 116, 144, 0.9)) !important;
          border: 1px solid rgba(14, 165, 164, 0.3) !important;
          color: #ffffff !important;
          font-weight: 600;
          font-size: 11px;
          border-radius: 6px;
          box-shadow: 0 3px 10px rgba(14, 165, 164, 0.25);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          backdrop-filter: blur(8px);
          height: 24px;
          padding: 0 8px;
        }

        .run-button:hover:not(:disabled) {
          background: linear-gradient(135deg, rgba(14, 165, 164, 1), rgba(14, 116, 144, 1)) !important;
          border-color: rgba(14, 165, 164, 0.4) !important;
          box-shadow: 0 4px 15px rgba(14, 165, 164, 0.35);
          filter: drop-shadow(0 0 6px rgba(14, 165, 164, 0.3));
        }

        .run-button:disabled {
          background: linear-gradient(135deg, rgba(71, 85, 105, 0.6), rgba(51, 65, 85, 0.6)) !important;
          border-color: rgba(148, 163, 184, 0.2) !important;
          color: #64748b !important;
          box-shadow: none;
        }

        /* ==========================
           Body Styling
           ========================== */
        .side-panel-body {
          flex: 1;
          overflow-y: auto;
          padding: 12px 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          background: linear-gradient(180deg, rgba(2,6,23,0.0), rgba(2,6,23,0.02));
        }

        .side-panel-body::-webkit-scrollbar {
          width: 4px;
        }

        .side-panel-body::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.3);
          border-radius: 2px;
        }

        .side-panel-body::-webkit-scrollbar-thumb {
          background: rgba(14, 165, 164, 0.2);
          border-radius: 2px;
          transition: background 0.3s ease;
        }

        .side-panel-body::-webkit-scrollbar-thumb:hover {
          background: rgba(14, 165, 164, 0.4);
        }

        /* ==========================
           Panel Cards
           ========================== */
        .panel-card {
          background: linear-gradient(135deg, rgba(15,23,42,0.4), rgba(12,18,28,0.3));
          border: 1px solid rgba(14, 165, 164, 0.06);
          border-radius: 10px;
          padding: 12px;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          backdrop-filter: blur(8px);
          position: relative;
          overflow: hidden;
          cursor: default;
          
          will-change: transform, box-shadow;
        }

        .panel-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(14, 165, 164, 0.2), transparent);
          transition: all 0.3s ease;
        }

        .panel-card:hover {
          background: linear-gradient(135deg, rgba(15,23,42,0.6), rgba(12,18,28,0.4));
          border-color: rgba(14, 165, 164, 0.12);
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(2,6,23,0.4);
        }

        .panel-card:hover::before {
          background: linear-gradient(90deg, transparent, rgba(14, 165, 164, 0.4), transparent);
          height: 2px;
        }

        /* ==========================
           Card Headers
           ========================== */
        .card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }

        .card-header-left {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .card-header-right {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .card-icon {
          color: #0ea5a4;
          font-size: 10px;
          transition: all 0.3s ease;
          filter: drop-shadow(0 0 3px rgba(14, 165, 164, 0.2));
        }

        .panel-card:hover .card-icon {
          animation: iconGlow 2s ease-in-out infinite;
        }

        .card-title {
          font-size: 11px;
          font-weight: 600;
          color: #cbd5e1;
          transition: color 0.3s ease;
        }

        .panel-card:hover .card-title {
          color: #f1f5f9;
        }

        .lock-icon {
          color: #64748b;
          font-size: 10px;
          transition: all 0.3s ease;
        }

        .panel-card:hover .lock-icon {
          color: #94a3b8;
        }

        /* ==========================
           Action Buttons
           ========================== */
        .action-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          border-radius: 4px;
          background: linear-gradient(135deg, rgba(71, 85, 105, 0.4), rgba(51, 65, 85, 0.4));
          border: 1px solid rgba(148, 163, 184, 0.15);
          color: #94a3b8;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          backdrop-filter: blur(8px);
          font-size: 10px;
        }

        .action-button:hover {
          background: linear-gradient(135deg, rgba(71, 85, 105, 0.6), rgba(51, 65, 85, 0.6));
          border-color: rgba(148, 163, 184, 0.25);
          color: #cbd5e1;
          box-shadow: 0 2px 6px rgba(2, 6, 23, 0.2);
        }

        .clear-button:hover {
          background: linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(220, 38, 38, 0.15));
          border-color: rgba(239, 68, 68, 0.3);
          color: #f87171;
        }

        .copy-button {
          background: linear-gradient(135deg, rgba(71, 85, 105, 0.6), rgba(51, 65, 85, 0.6)) !important;
          border: 1px solid rgba(148, 163, 184, 0.2) !important;
          color: #94a3b8 !important;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          backdrop-filter: blur(8px);
          height: 20px;
          width: 20px;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .copy-button:hover {
          background: linear-gradient(135deg, rgba(14, 165, 164, 0.15), rgba(14, 116, 144, 0.15)) !important;
          border-color: rgba(14, 165, 164, 0.3) !important;
          color: #0ea5a4 !important;
          box-shadow: 0 2px 6px rgba(14, 165, 164, 0.15);
        }

        .success-icon {
          color: #10b981 !important;
        }

        /* ==========================
           Badges and Counts
           ========================== */
        .char-count, .encoding-badge, .locked-badge {
          font-size: 9px;
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 500;
          transition: all 0.3s ease;
        }

        .char-count, .encoding-badge {
          color: #64748b;
          background: linear-gradient(135deg, rgba(71, 85, 105, 0.3), rgba(51, 65, 85, 0.3));
          border: 1px solid rgba(148, 163, 184, 0.1);
        }

        .locked-badge {
          color: #64748b;
          background: linear-gradient(135deg, rgba(71, 85, 105, 0.4), rgba(51, 65, 85, 0.4));
          border: 1px solid rgba(148, 163, 184, 0.15);
        }

        .panel-card:hover .char-count,
        .panel-card:hover .encoding-badge,
        .panel-card:hover .locked-badge {
          color: #94a3b8;
          border-color: rgba(148, 163, 184, 0.2);
        }

        /* ==========================
           Card Content
           ========================== */
        .card-content {
          transition: all 0.3s ease;
          
        }

        /* Language Select */
        .language-select {
          width: 100%;
        }

        :global(.language-select .ant-select-selector) {
          background: linear-gradient(135deg, rgba(51, 65, 85, 0.6), rgba(30, 41, 59, 0.6)) !important;
          border: 1px solid rgba(148, 163, 184, 0.2) !important;
          border-radius: 6px !important;
          color: #f1f5f9 !important;
          backdrop-filter: blur(8px);
          transition: all 0.3s ease !important;
          height: 24px !important;
          font-size: 11px !important;
        }

        :global(.language-select .ant-select-selector:hover) {
          background: linear-gradient(135deg, rgba(51, 65, 85, 0.8), rgba(30, 41, 59, 0.8)) !important;
          border-color: rgba(14, 165, 164, 0.3) !important;
        }

        :global(.language-select.ant-select-focused .ant-select-selector) {
          background: linear-gradient(135deg, rgba(51, 65, 85, 0.8), rgba(30, 41, 59, 0.8)) !important;
          border-color: rgba(14, 165, 164, 0.4) !important;
          box-shadow: 0 0 0 2px rgba(14, 165, 164, 0.1) !important;
        }

        .select-icon {
          color: #94a3b8 !important;
          font-size: 10px !important;
        }

        :global(.language-dropdown) {
          background: linear-gradient(135deg, #1e293b, #0f172a) !important;
          border: 1px solid rgba(148, 163, 184, 0.2) !important;
          border-radius: 6px !important;
          backdrop-filter: blur(16px) !important;
        }

        :global(.language-dropdown .ant-select-item) {
          color: #e2e8f0 !important;
          transition: all 0.2s ease !important;
          font-size: 11px !important;
          min-height: 24px !important;
          line-height: 24px !important;
        }

        :global(.language-dropdown .ant-select-item:hover) {
          background: rgba(14, 165, 164, 0.1) !important;
          color: #0ea5a4 !important;
        }

        /* Locked Language */
        .locked-language {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 8px;
          background: linear-gradient(135deg, rgba(51, 65, 85, 0.6), rgba(30, 41, 59, 0.6));
          border-radius: 6px;
          border: 1px solid rgba(148, 163, 184, 0.2);
          backdrop-filter: blur(8px);
          transition: all 0.3s ease;
        }

        .language-name {
          font-size: 11px;
          color: #f1f5f9;
          font-weight: 500;
        }

        .panel-card:hover .locked-language {
          background: linear-gradient(135deg, rgba(51, 65, 85, 0.8), rgba(30, 41, 59, 0.8));
          border-color: rgba(148, 163, 184, 0.3);
        }

        /* ==========================
           Custom Textareas
           ========================== */
        :global(.custom-textarea) {
          background: linear-gradient(135deg, rgba(2, 6, 23, 0.6), rgba(15, 23, 42, 0.6)) !important;
          border: 1px solid rgba(148, 163, 184, 0.15) !important;
          border-radius: 6px !important;
          color: #e2e8f0 !important;
          font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace !important;
          font-size: 11px !important;
          line-height: 1.4 !important;
          transition: all 0.3s ease !important;
          backdrop-filter: blur(8px);
        }

        :global(.custom-textarea::placeholder) {
          color: #64748b !important;
          font-size: 10px !important;
        }

        :global(.custom-textarea:hover) {
          background: linear-gradient(135deg, rgba(2, 6, 23, 0.8), rgba(15, 23, 42, 0.8)) !important;
          border-color: rgba(148, 163, 184, 0.25) !important;
        }

        :global(.custom-textarea:focus) {
          background: linear-gradient(135deg, rgba(2, 6, 23, 0.8), rgba(15, 23, 42, 0.8)) !important;
          border-color: rgba(14, 165, 164, 0.4) !important;
          box-shadow: 0 0 0 2px rgba(14, 165, 164, 0.1) !important;
        }

        :global(.output-textarea) {
          background: linear-gradient(135deg, rgba(2, 6, 23, 0.8), rgba(15, 23, 42, 0.8)) !important;
        }

        /* ==========================
           Output Info
           ========================== */
        .output-info {
          margin-top: 8px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 9px;
          transition: opacity 0.3s ease;
        }

        .output-length {
          color: #94a3b8;
          transition: color 0.3s ease;
        }

        .panel-card:hover .output-length {
          color: #cbd5e1;
        }

        /* ==========================
           Mobile Responsiveness
           ========================== */
        @media (max-width: 768px) {
          .side-panel-header {
            padding: 10px 12px;
          }

          .side-panel-body {
            padding: 10px 12px;
            gap: 6px;
          }

          .panel-card {
            padding: 10px;
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

          .card-title {
            font-size: 10px;
          }

          .run-button {
            font-size: 10px;
            padding: 0 6px;
          }
        }

        @media (max-width: 480px) {
          .side-panel-header {
            padding: 8px 10px;
          }

          .header-content {
            flex-direction: column;
            gap: 8px;
            align-items: stretch;
          }

          .title-section {
            justify-content: center;
          }

          .header-controls {
            justify-content: center;
          }

          .side-panel-body {
            padding: 8px 10px;
          }

          .panel-card {
            padding: 8px;
          }

          .card-header {
            margin-bottom: 6px;
          }

          .run-button {
            width: 100%;
          }
        }

        /* ==========================
           Focus States
           ========================== */
        .action-button:focus-visible,
        .run-button:focus-visible,
        .copy-button:focus-visible,
        .terminal-toggle:focus-visible {
          outline: 2px solid rgba(14, 165, 164, 0.6);
          outline-offset: 1px;
        }

        /* ==========================
           Text Selection
           ========================== */
        .side-panel-container *::selection {
          background: rgba(14, 165, 164, 0.2);
          color: #f1f5f9;
        }

        /* ==========================
           Enhanced Glow Effects
           ========================== */
        .side-panel-header:hover .title-icon {
          filter: drop-shadow(0 0 8px rgba(14, 165, 164, 0.3));
        }

        .panel-card:hover {
          filter: drop-shadow(0 0 6px rgba(14, 165, 164, 0.05));
        }

        .run-button:hover:not(:disabled) {
          filter: drop-shadow(0 0 6px rgba(14, 165, 164, 0.3));
        }

        /* ==========================
           Scrollbar Styling
           ========================== */
        :global(.custom-textarea::-webkit-scrollbar) {
          width: 3px;
        }

        :global(.custom-textarea::-webkit-scrollbar-track) {
          background: rgba(2, 6, 23, 0.3);
          border-radius: 2px;
        }

        :global(.custom-textarea::-webkit-scrollbar-thumb) {
          background: rgba(14, 165, 164, 0.3);
          border-radius: 2px;
          transition: background 0.3s ease;
        }

        :global(.custom-textarea::-webkit-scrollbar-thumb:hover) {
          background: rgba(14, 165, 164, 0.5);
        }

        /* ==========================
           Loading States
           ========================== */
        .run-button.ant-btn-loading {
          pointer-events: none;
        }

        .run-button.ant-btn-loading .anticon {
          animation: loadingPulse 1.5s ease-in-out infinite;
        }

        @keyframes loadingPulse {
          0%, 100% { 
            opacity: 1; 
            transform: scale(1); 
          }
          50% { 
            opacity: 0.7; 
            transform: scale(1.05); 
          }
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
          padding: 6px 8px !important;
        }

        :global(.ant-tooltip-arrow::before) {
          background: linear-gradient(135deg, #0f172a, #071126) !important;
          border: 1px solid rgba(14, 165, 164, 0.2) !important;
        }

        /* ==========================
           Button States
           ========================== */
        :global(.ant-btn-primary[disabled]) {
          background: linear-gradient(135deg, rgba(71, 85, 105, 0.6), rgba(51, 65, 85, 0.6)) !important;
          border-color: rgba(148, 163, 184, 0.2) !important;
          color: rgba(148, 163, 184, 0.6) !important;
        }

        :global(.ant-btn-primary.ant-btn-loading) {
          background: linear-gradient(135deg, rgba(14, 165, 164, 0.7), rgba(14, 116, 144, 0.7)) !important;
        }

        /* ==========================
           Smooth Transitions
           ========================== */
        * {
          scroll-behavior: smooth;
        }

        .side-panel-container,
        .panel-card,
        .action-button,
        .run-button,
        .card-icon,
        .title-icon {
          will-change: transform, box-shadow, filter;
        }

        /* ==========================
           Performance Optimizations
           ========================== */
        .side-panel-container {
          backface-visibility: hidden;
        }
      `}</style>
    </>
  );
}

export default SidePanel;
