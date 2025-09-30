import React, { Suspense, useState, useRef, useEffect } from 'react';
import { Button, Space, Tooltip, Dropdown, message, Input } from 'antd';
import {
  FileAddOutlined,
  FolderAddOutlined,
  MoreOutlined,
  FontSizeOutlined,
  FontColorsOutlined,
  BgColorsOutlined,
  UploadOutlined,
  FileZipOutlined,
  PlusOutlined,
  MinusOutlined,
  FolderOutlined,
  ShareAltOutlined
} from '@ant-design/icons';
import { FaTerminal, FaSearch } from 'react-icons/fa';
import JSZip from 'jszip';

import Editor from '@monaco-editor/react';
const { Search } = Input;

const BACKEND_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8080';

// Enhanced AI ghost widget styles with transitions
const aiStyles = `
  .ai-ghost-widget {
    position: fixed;
    background: linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9));
    border: 1px solid rgba(14, 165, 164, 0.2);
    border-radius: 8px;
    padding: 8px 12px;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 14px;
    pointer-events: none;
    user-select: none;
    z-index: 10000;
    box-shadow: 
      0 8px 25px rgba(2, 6, 23, 0.4),
      0 0 0 1px rgba(14, 165, 164, 0.1);
    backdrop-filter: blur(12px);
    animation: aiGhostSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    transform-origin: top left;
  }
  
  .ai-ghost-text {
    color: rgba(14, 165, 164, 0.8) !important;
    font-style: italic;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  }
  
  .ai-ghost-hint {
    font-size: 11px;
    color: rgba(148, 163, 184, 0.7);
    margin-top: 4px;
    border-top: 1px solid rgba(14, 165, 164, 0.2);
    padding-top: 4px;
    animation: aiHintFadeIn 0.5s ease-out 0.2s both;
  }
  
  .vs .ai-ghost-widget {
    background: linear-gradient(135deg, rgba(248, 250, 252, 0.95), rgba(226, 232, 240, 0.9));
    border-color: rgba(14, 165, 164, 0.3);
  }
  
  .vs .ai-ghost-text {
    color: rgba(14, 116, 144, 0.9) !important;
  }
  
  .vs .ai-ghost-hint {
    color: rgba(71, 85, 105, 0.8);
    border-top-color: rgba(14, 165, 164, 0.3);
  }
  
  .ai-loading-indicator {
    display: inline-flex;
    align-items: center;
    margin-left: 8px;
    padding: 6px 10px;
    background: linear-gradient(135deg, rgba(14, 165, 164, 0.1), rgba(14, 165, 164, 0.05));
    border-radius: 6px;
    border: 1px solid rgba(14, 165, 164, 0.2);
    backdrop-filter: blur(4px);
    animation: aiLoadingPulse 2s ease-in-out infinite;
  }
  
  .ai-loading-spinner {
    width: 12px;
    height: 12px;
    border: 2px solid rgba(14, 165, 164, 0.3);
    border-top: 2px solid rgb(14, 165, 164);
    border-radius: 50%;
    animation: aiSpin 1s linear infinite;
  }
  
  @keyframes aiGhostSlideIn {
    from {
      opacity: 0;
      transform: translateY(-10px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
  
  @keyframes aiHintFadeIn {
    from {
      opacity: 0;
      transform: translateY(-5px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @keyframes aiSpin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  @keyframes aiLoadingPulse {
    0%, 100% { 
      opacity: 0.7; 
      box-shadow: 0 0 0 0 rgba(14, 165, 164, 0.7);
    }
    50% { 
      opacity: 1; 
      box-shadow: 0 0 0 4px rgba(14, 165, 164, 0);
    }
  }
  
  .bg-slate-900\\/60 .ai-loading-spinner {
    width: 10px;
    height: 10px;
    border-width: 1.5px;
  }
`;

// Inject enhanced styles
const styleSheet = document.createElement('style');
styleSheet.textContent = aiStyles;
document.head.appendChild(styleSheet);

const CodeEditor = ({
  activeFile,
  lang,
  theme,
  fontSize,
  onEditorMount,
  onEditorChange,
  onNewFile,
  onNewFolder,
  onTerminalOpen,
  onSaveToWorkspace,
  onUploadFiles,
  onUploadZip,
  onThemeChange,
  onDecreaseFontSize,
  onIncreaseFontSize,
  onFontFamilyChange,
  files = {},
  fileTree = {},
  sidebarWidth = 300,
  isHost = false,
  editingMode = 'open',
  openHostModal = null,
  sessionId = null,
  style = {}, 
  terminalVisible = false
}) => {
  const [wordWrap, setWordWrap] = useState(false);
  const fileContent = activeFile ? activeFile.content : '';
  const fileInputRef = useRef(null);
  const zipInputRef = useRef(null);

  const editorInstanceRef = useRef(null);
  const monacoRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [collapsedToolbar, setCollapsedToolbar] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [cursorPosition, setCursorPosition] = useState({ lineNumber: 1, column: 1 });
  const [isToolbarExpanded, setIsToolbarExpanded] = useState(true);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [cursorBlinking, setCursorBlinking] = useState(true);

  const aiDebounceRef = useRef(null);
  const ghostRef = useRef(null);
  const connectionCheckRef = useRef(null);

  useEffect(() => {
    const calc = () => {
      const w = window.innerWidth || document.documentElement.clientWidth;
      setCollapsedToolbar((sidebarWidth / w) > 0.6);
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, [sidebarWidth]);

  useEffect(() => {
    return () => {
      if (aiDebounceRef.current) clearTimeout(aiDebounceRef.current);
      if (connectionCheckRef.current) clearTimeout(connectionCheckRef.current);
      clearGhost();
    };
  }, []);

  // Connection status simulation (replace with actual connection logic)
  useEffect(() => {
    const checkConnection = () => {
      // This would be replaced with actual terminal/backend connection check
      const isTerminalConnected = terminalVisible && Math.random() > 0.3; // Simulate occasional disconnection
      setIsConnected(isTerminalConnected || !terminalVisible);
    };

    connectionCheckRef.current = setInterval(checkConnection, 3000);
    return () => {
      if (connectionCheckRef.current) clearInterval(connectionCheckRef.current);
    };
  }, [terminalVisible]);

  // Cursor blinking effect
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setCursorBlinking(prev => !prev);
    }, 530); // Standard cursor blink rate

    return () => clearInterval(blinkInterval);
  }, []);

  const editingHostOnly = editingMode === 'host-only';
  const readOnly = editingHostOnly && !isHost;

  const editorOptions = {
    fontSize,
    theme,
    automaticLayout: true,
    minimap: { enabled: false },
    wordWrap: wordWrap ? 'on' : 'off',
    scrollBeyondLastLine: false,
    lineNumbers: 'on',
    glyphMargin: true,
    folding: true,
    lineDecorationsWidth: 10,
    lineNumbersMinChars: 3,
    scrollbar: { vertical: 'auto', horizontal: 'auto', useShadows: true },
    readOnly,
    inlineSuggest: { enabled: false }
  };

  // AI Completion Functions (unchanged functionality)
  const fetchAiCompletion = async (prefix, suffix, language, filename) => {
    setIsAiLoading(true);
    try {
      const payload = {
        language: language || 'plaintext',
        prefix: prefix || '',
        suffix: suffix || '',
        filename: filename || 'file.txt'
      };

      const response = await fetch(`${BACKEND_BASE}/api/ai-complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      return data.suggestions || [];

    } catch (error) {
      console.error('[AI] Fetch error:', error);
      
      const fallbacks = [];
      if (prefix.includes('#include')) {
        fallbacks.push({ insertText: '<vector>', label: 'Include vector' });
      } else if (prefix.includes('function') || prefix.includes('def ') || prefix.includes('func ')) {
        fallbacks.push({ insertText: '() {\n    \n}', label: 'Function template' });
      } else if (prefix.includes('console')) {
        fallbacks.push({ insertText: 'log("");', label: 'Console log' });
      } else {
        fallbacks.push({ insertText: '// Your code here', label: 'Code template' });
      }
      
      return fallbacks;
    } finally {
      setIsAiLoading(false);
    }
  };

  const clearGhost = () => {
    if (!ghostRef.current) return;
    
    const widget = document.getElementById('ai-ghost-widget');
    if (widget) widget.remove();
    
    ghostRef.current = null;
  };

  const showGhost = (suggestion, editor, monaco, prefix) => {
    if (!suggestion || !editor || !monaco) return;

    const position = editor.getPosition();
    if (!position) return;

    const fullText = suggestion.insertText || '';
    if (!fullText) return;

    let remaining = fullText;
    if (prefix && prefix.length > 0) {
      const maxCheckLength = Math.min(prefix.length, 20);
      for (let i = maxCheckLength; i > 0; i--) {
        const endOfPrefix = prefix.slice(-i);
        if (fullText.startsWith(endOfPrefix)) {
          remaining = fullText.slice(i);
          break;
        }
      }
    }

    if (!remaining || remaining.trim().length === 0) {
      clearGhost();
      return;
    }

    clearGhost();

    const editorDomNode = editor.getDomNode();
    if (!editorDomNode) return;

    const widget = document.createElement('div');
    widget.id = 'ai-ghost-widget';
    widget.className = 'ai-ghost-widget';
    widget.innerHTML = `
      <div class="ai-ghost-text">${remaining}</div>
      <div class="ai-ghost-hint">Press Tab to accept</div>
    `;

    const coordinates = editor.getScrolledVisiblePosition(position);
    if (coordinates) {
      const editorRect = editorDomNode.getBoundingClientRect();
      const scrollContainer = editorDomNode.querySelector('.monaco-scrollable-element');
      
      if (scrollContainer) {
        const scrollLeft = scrollContainer.scrollLeft;
        const scrollTop = scrollContainer.scrollTop;
        
        widget.style.position = 'absolute';
        widget.style.left = `${coordinates.left - scrollLeft + editorRect.left}px`;
        widget.style.top = `${coordinates.top - scrollTop + editorRect.top}px`;
        widget.style.zIndex = '1000';
      }
    }

    document.body.appendChild(widget);

    ghostRef.current = {
      widget: widget,
      suggestion: suggestion,
      remaining: remaining,
      fullText: fullText,
      position: { ...position }
    };
  };

  const acceptGhost = () => {
    if (!ghostRef.current) return;

    const editor = editorInstanceRef.current;
    const monaco = monacoRef.current;
    const suggestion = ghostRef.current.suggestion;
    if (!editor || !monaco || !suggestion) return;

    const position = editor.getPosition();
    if (!position) return;

    try {
      editor.executeEdits('ai-accept', [{
        range: new monaco.Range(
          position.lineNumber,
          position.column,
          position.lineNumber,
          position.column
        ),
        text: suggestion.insertText,
        forceMoveMarkers: true
      }]);
    } catch (err) {
      console.error('[AI] acceptGhost failed', err);
    } finally {
      clearGhost();
    }
  };

  const triggerAICompletion = async () => {
    const editor = editorInstanceRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    const model = editor.getModel();
    const position = editor.getPosition();
    if (!model || !position) return;

    const offset = model.getOffsetAt(position);
    const value = model.getValue();
    const prefix = value.substring(0, offset);
    const suffix = value.substring(offset);

    if (prefix.trim().length < 2) {
      clearGhost();
      return;
    }

    try {
      const suggestions = await fetchAiCompletion(prefix, suffix, lang, activeFile?.name);
      if (suggestions && suggestions.length > 0) {
        showGhost(suggestions[0], editor, monaco, prefix);
      } else {
        clearGhost();
      }
    } catch (err) {
      console.error('[AI] Completion failed', err);
      clearGhost();
    }
  };

  // Enhanced Editor Mount with transitions and cursor effects
  const handleEditorMount = (editor, monaco) => {
    editorInstanceRef.current = editor;
    monacoRef.current = monaco;

    setTimeout(() => setIsEditorReady(true), 300);

    if (typeof onEditorMount === 'function') onEditorMount(editor, monaco);

    // Enhanced cursor position tracking with smooth transitions
    editor.onDidChangeCursorPosition((e) => {
      setCursorPosition(e.position);
      setCursorBlinking(true); // Reset cursor blink on movement
      clearGhost();
      
      // Add smooth cursor movement effect
      const cursorElement = document.querySelector('.monaco-editor .cursor');
      if (cursorElement) {
        cursorElement.style.transition = 'all 0.1s ease-out';
      }
    });

    editor.onDidChangeModel(() => clearGhost());
    editor.onDidBlurEditorWidget(() => clearGhost());
    editor.onDidScrollChange(() => clearGhost());

    // Enhanced typing effects
    editor.onDidChangeModelContent((e) => {
      // Add typing animation class to changed lines
      const changedLines = e.changes.map(change => change.range.startLineNumber);
      changedLines.forEach(lineNumber => {
        setTimeout(() => {
          const lineElement = document.querySelector(`.monaco-editor .view-line[data-line-number="${lineNumber}"]`);
          if (lineElement) {
            lineElement.classList.add('typing-animation');
            setTimeout(() => {
              lineElement.classList.remove('typing-animation');
            }, 300);
          }
        }, 10);
      });
    });

    editor.addCommand(monaco.KeyCode.Tab, () => {
      if (ghostRef.current) {
        acceptGhost();
        return;
      }
      editor.trigger('keyboard', 'tab', {});
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Space, () => {
      triggerAICompletion();
    });

    editor.onKeyDown((e) => {
      if (e.code !== 'Shift' && e.code !== 'Control' && e.code !== 'Alt' && e.code !== 'Meta' && e.code !== 'Tab') {
        clearGhost();
      }

      if (e.code === 'Space' || e.code === 'Enter') {
        if (aiDebounceRef.current) clearTimeout(aiDebounceRef.current);
        aiDebounceRef.current = setTimeout(triggerAICompletion, 400);
      }
    });

    const updateWidgetPosition = () => {
      if (ghostRef.current && ghostRef.current.widget) {
        const editorDomNode = editor.getDomNode();
        const position = editor.getPosition();
        
        if (editorDomNode && position) {
          const coordinates = editor.getScrolledVisiblePosition(position);
          if (coordinates) {
            const editorRect = editorDomNode.getBoundingClientRect();
            const scrollContainer = editorDomNode.querySelector('.monaco-scrollable-element');
            
            if (scrollContainer) {
              const scrollLeft = scrollContainer.scrollLeft;
              const scrollTop = scrollContainer.scrollTop;
              
              ghostRef.current.widget.style.left = `${coordinates.left - scrollLeft + editorRect.left}px`;
              ghostRef.current.widget.style.top = `${coordinates.top - scrollTop + editorRect.top}px`;
            }
          }
        }
      }
    };

    editor.onDidScrollChange(updateWidgetPosition);

    // Apply enhanced editor styling
    setTimeout(() => {
      const editorContainer = editor.getDomNode();
      if (editorContainer) {
        editorContainer.classList.add('enhanced-monaco-editor');
      }
    }, 100);
  };

  // UI Helper Functions with enhanced feedback
  const openMonacoFind = (q = '') => {
    const editor = editorInstanceRef.current;
    if (!editor) return;
    
    try {
      editor.getAction('actions.find').run();
      setTimeout(() => {
        const findInput = document.querySelector('.find-widget input');
        if (findInput) {
          findInput.value = q;
          findInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }, 100);
    } catch (e) {
      console.warn('Find action failed', e);
    }
  };

  const handleFileUpload = (event) => {
    if (editingHostOnly && !isHost) return message.warn('Only the host can upload files.');
    const filesArr = Array.from(event.target.files || []);
    if (filesArr.length === 0) return;
    
    const validExtensions = ['.cpp', '.c', '.h', '.hpp', '.java', '.py', '.js', '.ts', '.html', '.css', '.txt'];
    const validFiles = filesArr.filter(file => {
      const ext = '.' + file.name.split('.').pop().toLowerCase();
      return validExtensions.includes(ext);
    });
    
    if (validFiles.length === 0) {
      message.error('No valid files selected. Supported formats: ' + validExtensions.join(', '));
      return;
    }
    
    if (onUploadFiles) onUploadFiles(validFiles);
    if (fileInputRef.current) fileInputRef.current.value = '';
    message.success(`Uploaded ${validFiles.length} file${validFiles.length !== 1 ? 's' : ''}`);
  };

  const handleZipUpload = (event) => {
    if (editingHostOnly && !isHost) return message.warn('Only the host can upload ZIP files.');
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (!file.name.toLowerCase().endsWith('.zip')) {
      message.error('Please select a valid ZIP file');
      return;
    }
    
    if (onUploadZip) onUploadZip(file);
    if (zipInputRef.current) zipInputRef.current.value = '';
    message.success('ZIP file uploaded successfully');
  };

  const handleDownloadProject = async () => {
    try {
      const zip = new JSZip();
      const addToZip = (node, path = '') => {
        if (!node) return;
        if (node.type === 'file') {
          zip.file(path + node.name, files[node.id]?.content || '');
        } else if (node.type === 'folder') {
          const folderPath = path + node.name + '/';
          (node.children || []).forEach(childId => {
            const childNode = fileTree[childId];
            if (childNode) addToZip(childNode, folderPath);
          });
        }
      };
      
      const root = fileTree?.root;
      if (root && root.children) {
        root.children.forEach(cid => addToZip(fileTree[cid], ''));
      }
      
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `project-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 150);
      
      message.success('Project downloaded successfully!');
    } catch (err) {
      console.error(err);
      message.error('Failed to download project');
    }
  };

  // Enhanced menu items with better styling
  const collapsedMenuItems = [
    { key: 'search', label: <button className="w-full text-left px-3 py-2 text-slate-200 hover:text-cyan-400 hover:bg-slate-700/50 transition-all duration-200 rounded-md" onClick={() => openMonacoFind(searchQuery)}>Search…</button> },
    { key: 'theme-dark', label: <button className="w-full text-left px-3 py-2 text-slate-200 hover:text-cyan-400 hover:bg-slate-700/50 transition-all duration-200 rounded-md" onClick={() => onThemeChange && onThemeChange('vs-dark')}>Theme: Dark</button> },
    { key: 'theme-light', label: <button className="w-full text-left px-3 py-2 text-slate-200 hover:text-cyan-400 hover:bg-slate-700/50 transition-all duration-200 rounded-md" onClick={() => onThemeChange && onThemeChange('vs')}>Theme: Light</button> },
    { key: 'font-monaco', label: <button className="w-full text-left px-3 py-2 text-slate-200 hover:text-cyan-400 hover:bg-slate-700/50 transition-all duration-200 rounded-md" onClick={() => onFontFamilyChange && onFontFamilyChange('Monaco, Menlo, \"Ubuntu Mono\", monospace')}>Font: Monaco</button> },
    { key: 'font-fira', label: <button className="w-full text-left px-3 py-2 text-slate-200 hover:text-cyan-400 hover:bg-slate-700/50 transition-all duration-200 rounded-md" onClick={() => onFontFamilyChange && onFontFamilyChange('\"Fira Code\", \"Cascadia Code\", \"JetBrains Mono\", monospace')}>Font: Fira Code</button> },
    { key: 'dec-font', label: <button className="w-full text-left px-3 py-2 text-slate-200 hover:text-cyan-400 hover:bg-slate-700/50 transition-all duration-200 rounded-md" onClick={() => onDecreaseFontSize && onDecreaseFontSize()}>Decrease font</button> },
    { key: 'inc-font', label: <button className="w-full text-left px-3 py-2 text-slate-200 hover:text-cyan-400 hover:bg-slate-700/50 transition-all duration-200 rounded-md" onClick={() => onIncreaseFontSize && onIncreaseFontSize()}>Increase font</button> },
    { key: 'word-wrap', label: <button className="w-full text-left px-3 py-2 text-slate-200 hover:text-cyan-400 hover:bg-slate-700/50 transition-all duration-200 rounded-md" onClick={() => setWordWrap(w => !w)}>{wordWrap ? 'Disable Word Wrap' : 'Enable Word Wrap'}</button> },
    { key: 'save-workspace', label: <button className="w-full text-left px-3 py-2 text-slate-200 hover:text-cyan-400 hover:bg-slate-700/50 transition-all duration-200 rounded-md" onClick={() => { if (typeof onSaveToWorkspace === 'function') onSaveToWorkspace(); }}>Save to Workspace</button> },
    { key: 'download-project', label: <button className="w-full text-left px-3 py-2 text-slate-200 hover:text-cyan-400 hover:bg-slate-700/50 transition-all duration-200 rounded-md" onClick={() => handleDownloadProject()}>Download Project (ZIP)</button> },
    { key: 'open-terminal', label: <button className="w-full text-left px-3 py-2 text-slate-200 hover:text-cyan-400 hover:bg-slate-700/50 transition-all duration-200 rounded-md" onClick={() => onTerminalOpen && onTerminalOpen()}>Open Terminal</button> }
  ];

  if (isHost) {
    collapsedMenuItems.push({
      key: 'host-controls',
      label: <button className="w-full text-left px-3 py-2 text-slate-200 hover:text-cyan-400 hover:bg-slate-700/50 transition-all duration-200 rounded-md" onClick={() => { if (typeof openHostModal === 'function') openHostModal(); }}>Host Controls</button>
    });
  }

  collapsedMenuItems.push({
    key: 'more',
    label: <button className="w-full text-left px-3 py-2 text-slate-200 hover:text-cyan-400 hover:bg-slate-700/50 transition-all duration-200 rounded-md" onClick={() => message.info('More options')}>More…</button>
  });

  const shareSession = async () => {
    try {
      let sess = sessionId;
      if (!sess) {
        try {
          const parts = window.location.pathname.split('/').filter(Boolean);
          if (parts.length >= 2) {
            sess = parts[parts.length - 1];
          }
        } catch (e) {
          sess = null;
        }
      }
      const inviteUrl = sess ? `${window.location.origin}/lobby/${sess}` : window.location.origin;

      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(inviteUrl);
        message.success('Invite link copied to clipboard');
        return;
      }

      const ta = document.createElement('textarea');
      ta.value = inviteUrl;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        message.success('Invite link copied to clipboard');
      } catch (err) {
        message.error('Unable to copy invite link automatically — please copy manually: ' + inviteUrl);
      } finally {
        document.body.removeChild(ta);
      }
    } catch (err) {
      console.error('shareSession failed', err);
      message.error('Failed to copy invite link');
    }
  };

  const getEnhancedButtonClassName = (baseClass = "") => {
    return `${baseClass} enhanced-button group transition-all duration-300 ease-out hover:scale-105`;
  };

  return (
    <>
      <div 
        className="code-editor-container"
        style={style}
      >
        {/* Enhanced Toolbar */}
        <div className="code-editor-toolbar">
          <Space size="small" className="toolbar-left">
            <Tooltip title={readOnly ? 'Read-only (host-only editing enabled)' : 'Upload Files'} color="#0f172a">
              <Button
                type="text"
                icon={<UploadOutlined className="button-icon upload-icon" />}
                onClick={() => fileInputRef.current?.click()}
                disabled={readOnly}
                className={getEnhancedButtonClassName()}
              >
                <input type="file" ref={fileInputRef} multiple accept=".cpp,.c,.h,.hpp,.java,.py,.js,.ts,.html,.css,.txt" onChange={handleFileUpload} style={{ display: 'none' }} />
              </Button>
            </Tooltip>

            <Tooltip title={readOnly ? 'Read-only (host-only editing enabled)' : 'Upload ZIP Project'} color="#0f172a">
              <Button
                type="text"
                icon={<FileZipOutlined className="button-icon zip-icon" />}
                onClick={() => zipInputRef.current?.click()}
                disabled={readOnly}
                className={getEnhancedButtonClassName()}
              >
                <input type="file" ref={zipInputRef} accept=".zip" onChange={handleZipUpload} style={{ display: 'none' }} />
              </Button>
            </Tooltip>

            <div className="toolbar-divider" />

            <Tooltip title="Share / Invite" color="#0f172a">
              <Button
                type="text"
                icon={<ShareAltOutlined className="button-icon share-icon" />}
                onClick={shareSession}
                className={getEnhancedButtonClassName()}
              />
            </Tooltip>

            <Tooltip title="Download Project as ZIP" color="#0f172a">
              <Button
                type="text"
                icon={<FolderOutlined className="button-icon folder-icon" />}
                onClick={handleDownloadProject}
                className={getEnhancedButtonClassName()}
              />
            </Tooltip>

            <Tooltip title="Toggle Terminal" color="#0f172a">
              <Button
                type="text"
                icon={<FaTerminal className="button-icon terminal-icon" />}
                onClick={() => onTerminalOpen && onTerminalOpen()}
                className={getEnhancedButtonClassName()}
              />
            </Tooltip>
          </Space>

         <div className="toolbar-right">
  {!collapsedToolbar && (
    <Tooltip title="Open Monaco Search" color="#0f172a">
    <Button
      type="text"
      icon={<FaSearch className="button-icon search-icon " />}
      onClick={() => openMonacoFind(searchQuery)}
      className={getEnhancedButtonClassName("search-button")}
    />
  </Tooltip>
  )}

          

            {!collapsedToolbar ? (
              <Space size="small" className="toolbar-controls">
                <div className="toolbar-divider" />
                
                <Dropdown
                  menu={{
                    items: [
                      { key: 'dark', label: 'Dark', onClick: () => onThemeChange && onThemeChange('vs-dark') },
                      { key: 'light', label: 'Light', onClick: () => onThemeChange && onThemeChange('vs') }
                    ],
                    className: 'enhanced-dropdown'
                  }}
                  trigger={['click']}
                  placement="bottomRight"
                >
                  <Tooltip title="Change Theme" color="#0f172a">
                    <Button
                      type="text"
                      icon={<BgColorsOutlined className="button-icon theme-icon" />}
                      className={getEnhancedButtonClassName()}
                    />
                  </Tooltip>
                </Dropdown>

                <Dropdown
                  menu={{
                    items: [
                      { key: 'monaco', label: 'Monaco', onClick: () => onFontFamilyChange && onFontFamilyChange('Monaco, Menlo, "Ubuntu Mono", monospace') },
                      { key: 'fira', label: 'Fira Code', onClick: () => onFontFamilyChange && onFontFamilyChange('"Fira Code", "Cascadia Code", "JetBrains Mono", monospace') },
                    ],
                    className: 'enhanced-dropdown'
                  }}
                  trigger={['click']}
                  placement="bottomRight"
                >
                  <Tooltip title="Change Font Style" color="#0f172a">
                    <Button
                      type="text"
                      icon={<FontColorsOutlined className="button-icon font-icon" />}
                      className={getEnhancedButtonClassName()}
                    />
                  </Tooltip>
                </Dropdown>

                <Tooltip title="Decrease Font Size" color="#0f172a">
                  <Button
                    type="text"
                    icon={<MinusOutlined className="button-icon minus-icon" />}
                    className={getEnhancedButtonClassName()}
                    onClick={() => onDecreaseFontSize && onDecreaseFontSize()}
                  />
                </Tooltip>

                <Tooltip title="Font Size" color="#0f172a">
                  <Button
                    type="text"
                    icon={<FontSizeOutlined />}
                    className="font-size-display"
                  >
                    <span className="font-size-text">{fontSize}px</span>
                  </Button>
                </Tooltip>

                <Tooltip title="Increase Font Size" color="#0f172a">
                  <Button
                    type="text"
                    icon={<PlusOutlined className="button-icon plus-icon" />}
                    className={getEnhancedButtonClassName()}
                    onClick={() => onIncreaseFontSize && onIncreaseFontSize()}
                  />
                </Tooltip>

                <div className="toolbar-divider" />

                <Tooltip title="More Options" color="#0f172a">
                  <Dropdown
                    placement="bottomRight"
                    trigger={['click']}
                    menu={{
                      items: [
                        { key: 'wordwrap', label: wordWrap ? 'Disable Word Wrap' : 'Enable Word Wrap', onClick: () => setWordWrap(w => !w) },
                        { key: 'save', label: 'Save to Workspace', onClick: () => { if (typeof onSaveToWorkspace === 'function') onSaveToWorkspace(); } },
                        { key: 'download', label: 'Download Project (ZIP)', onClick: () => handleDownloadProject() },
                        { key: 'terminal', label: 'Open Terminal', onClick: () => onTerminalOpen && onTerminalOpen() },
                        ...(isHost ? [{ key: 'host', label: 'Host Controls', onClick: () => { if (typeof openHostModal === 'function') openHostModal(); } }] : []),
                      ],
                      className: 'enhanced-dropdown'
                    }}
                  >
                    <Button
                      type="text"
                      icon={<MoreOutlined className="button-icon more-icon" />}
                      className={getEnhancedButtonClassName()}
                    />
                  </Dropdown>
                </Tooltip>
              </Space>
            ) : (
              <Dropdown
                menu={{
                  items: collapsedMenuItems,
                  className: 'enhanced-dropdown'
                }}
                trigger={['click']}
                placement="bottomRight"
              >
                <Button
                  type="text"
                  icon={<MoreOutlined className="button-icon more-icon" />}
                  className={getEnhancedButtonClassName()}
                />
              </Dropdown>
            )}
          </div>
        </div>

        {/* Enhanced Editor Container */}
        <div className="editor-container">
          <Suspense fallback={
            <div className="editor-loading">
              <div className="loading-content">
                <div className="loading-spinner"></div>
                <div className="loading-text">Loading editor…</div>
                <div className="loading-subtext">Preparing your coding environment</div>
              </div>
            </div>
          }>
            <div className="monaco-wrapper">
              <Editor
                height="100%"
                language={lang}
                theme={theme}
                value={fileContent || ''}
                options={editorOptions}
                onMount={handleEditorMount}
                onChange={onEditorChange}
              />
              
              {/* Editor overlay effects */}
              <div className="editor-overlay" />
            </div>
          </Suspense>
        </div>

        {/* Enhanced Status Bars */}
        {readOnly && (
          <div className="read-only-banner">
            <div className="banner-content">
              <div className="banner-indicator" />
              <span className="banner-title">Read-only mode active</span>
              <span className="banner-subtitle">— Host has restricted editing to hosts only</span>
            </div>
            <div className="banner-action">
              Ask the host to promote you to edit files
            </div>
          </div>
        )}

        <div className="status-bar">
          <div className="status-left">
            <span className="language-badge">
              {lang ? lang.toUpperCase() : 'TEXT'}
            </span>

            <span className={`word-wrap-status ${wordWrap ? 'active' : ''}`}>
              Word Wrap: {wordWrap ? 'On' : 'Off'}
            </span>

            <span className="encoding-status">UTF-8</span>

            {activeFile?.name && (
              <span className="filename-status">
                {activeFile.name}
              </span>
            )}
          </div>

          <div className="status-right">
            <span className="cursor-position">
              Ln {cursorPosition.lineNumber}, Col {cursorPosition.column}
            </span>

            <span className="spaces-status">Spaces: 2</span>

            {isAiLoading && (
              <span className="ai-status">
                <div className="ai-loading-spinner" />
                <span className="ai-text">AI</span>
              </span>
            )}

            
          </div>
        </div>
      </div>

      <style jsx>{`
        /* ==========================
           Main Container & Layout
           ========================== */
        .code-editor-container {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-height: 0;
          min-width: 0;
          background: linear-gradient(180deg, #0a1628 0%, #0f172a 100%);
          color: #e2e8f0;
          font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
          position: relative;
          overflow: hidden;
          animation: slideInUp 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .code-editor-container::before {
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

        .code-editor-container > * {
          position: relative;
          z-index: 1;
        }

        /* ==========================
           Enhanced Toolbar
           ========================== */
        .code-editor-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: linear-gradient(135deg, rgba(15,23,42,0.95), rgba(7,17,27,0.95));
          border-bottom: 1px solid rgba(14, 165, 164, 0.08);
          backdrop-filter: blur(12px);
          transition: all 0.3s ease;
          animation: slideInLeft 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .code-editor-toolbar:hover {
          border-bottom-color: rgba(14, 165, 164, 0.15);
          background: linear-gradient(135deg, rgba(15,23,42,0.98), rgba(7,17,27,0.98));
        }

        .toolbar-left,
        .toolbar-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .toolbar-left {
          animation: slideInLeft 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .toolbar-right {
          animation: slideInRight 0.4s cubic-bezier(0.4, 0, 0.2, 1) 0.1s both;
        }

        .toolbar-controls {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .toolbar-divider {
          width: 1px;
          height: 20px;
          background: linear-gradient(to bottom, transparent, rgba(148, 163, 184, 0.3), transparent);
          margin: 0 4px;
          transition: all 0.3s ease;
        }

        .code-editor-toolbar:hover .toolbar-divider {
          background: linear-gradient(to bottom, transparent, rgba(14, 165, 164, 0.4), transparent);
        }

        /* ==========================
           Enhanced Buttons
           ========================== */
        .enhanced-button {
          background: transparent !important;
          border: 1px solid rgba(148, 163, 184, 0.08) !important;
          color: #94a3b8 !important;
          border-radius: 8px !important;
          padding: 6px 8px !important;
          height: 32px !important;
          min-width: 32px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          backdrop-filter: blur(8px) !important;
          position: relative !important;
          overflow: hidden !important;
        }

        .enhanced-button::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(135deg, rgba(14, 165, 164, 0.1), rgba(14, 116, 144, 0.05));
          opacity: 0;
          transition: opacity 0.3s ease;
          z-index: 0;
        }

        .enhanced-button:hover::before {
          opacity: 1;
        }

        .enhanced-button:hover {
          color: #0ea5a4 !important;
          border-color: rgba(14, 165, 164, 0.2) !important;
          transform: translateY(-1px) scale(1.05) !important;
          box-shadow: 0 6px 20px rgba(14, 165, 164, 0.15) !important;
        }

        .enhanced-button:active {
          transform: translateY(0) scale(1.02) !important;
        }

        .enhanced-button:disabled {
          opacity: 0.4 !important;
          transform: none !important;
          box-shadow: none !important;
        }

        .enhanced-button:disabled:hover {
          color: #94a3b8 !important;
          border-color: rgba(148, 163, 184, 0.08) !important;
        }

        /* ==========================
           Button Icons
           ========================== */
        .button-icon {
          font-size: 12px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          z-index: 1;
        }

        .enhanced-button:hover .button-icon {
          transform: scale(1.1);
        }

        .upload-icon {
          transform-origin: bottom center;
        }

        .enhanced-button:hover .upload-icon {
          transform: translateY(-1px) scale(1.1);
        }

        .zip-icon {
          transform-origin: center;
        }

        .enhanced-button:hover .zip-icon {
          transform: rotate(6deg) scale(1.1);
        }

        .share-icon {
          transform-origin: center;
        }

        .enhanced-button:hover .share-icon {
          transform: rotate(12deg) scale(1.1);
        }

        .terminal-icon {
          transform-origin: bottom center;
        }

        .enhanced-button:hover .terminal-icon {
          transform: translateY(-1px) scale(1.1);
        }

        .search-icon {
          transform-origin: center;
        }
        
        /* ==========================
   Button Icons - FIXED VERSION
   ========================== */
.button-icon {
  font-size: 12px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  z-index: 1;
  /* Add these fixes to prevent layout shifts */
  display: inline-block;
  vertical-align: middle;
  transform-origin: center;
  will-change: transform;
}

/* Remove or modify the hover transforms that cause shifting */
.enhanced-button:hover .button-icon {
  transform: scale(1.1);
  /* Ensure the transform doesn't affect layout */
  transform-box: fill-box;
}

/* Specific fixes for each icon type */
.search-icon {
  transform-origin: center !important;
  /* Prevent any layout-affecting transforms */
  transition: transform 0.2s ease !important;
}

.enhanced-button:hover .search-icon {
  transform: scale(1.1) !important;
  /* Ensure no position shift */
  position: relative !important;
}

/* Fix for the search button specifically */
.search-button.enhanced-button {
  background: transparent !important;
  border: 1px solid rgba(88, 110, 107, 0.08) !important;
  color: #94a3b8 !important;
  /* Ensure stable positioning */
  position: relative !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}

.search-button.enhanced-button:hover {
  color: #0ea5a4 !important;
  border-color: rgba(14, 165, 164, 0.2) !important;
  transform: translateY(-1px) scale(1.05) !important;
  /* Prevent layout shifts on hover */
  transform-box: border-box !important;
}

/* Ensure the search icon container is stable */
.search-button .button-icon {
  position: relative !important;
  top: auto !important;
  left: auto !important;
  right: auto !important;
  bottom: auto !important;
}

/* Fix for React Icons specifically */
.search-button .search-icon {
  color: inherit !important;
  fill: currentColor !important;
  /* Prevent any layout shifts */
  display: block !important;
  line-height: 1 !important;
}
        .enhanced-button:hover .search-icon {
          transform: scale(1.1);
        }

        .theme-icon {
          transform-origin: center;
        }

        .enhanced-button:hover .theme-icon {
          transform: rotate(12deg) scale(1.1);
        }

        .font-icon {
          transform-origin: center;
        }

        .enhanced-button:hover .font-icon {
          transform: scale(1.1);
        }

        .minus-icon,
        .plus-icon {
          transform-origin: center;
        }

        .enhanced-button:hover .minus-icon,
        .enhanced-button:hover .plus-icon {
          transform: scale(1.1);
        }

        .more-icon {
          transform-origin: center;
        }

        .enhanced-button:hover .more-icon {
          transform: rotate(90deg) scale(1.1);
        }

        .folder-icon {
          transform-origin: center;
        }

        .enhanced-button:hover .folder-icon {
          transform: scale(1.1);
        }

        /* ==========================
           Special Buttons
           ========================== */
        .font-size-display {
          background: transparent !important;
          border: 1px solid rgba(14, 165, 164, 0.15) !important;
          color: #0ea5a4 !important;
          border-radius: 8px !important;
          padding: 6px 12px !important;
          height: 32px !important;
          transition: all 0.3s ease !important;
          backdrop-filter: blur(8px) !important;
        }

        .font-size-display:hover {
          border-color: rgba(14, 165, 164, 0.3) !important;
          background: rgba(14, 165, 164, 0.05) !important;
          transform: translateY(-0.5px) !important;
        }

        .font-size-text {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.5px;
          margin-left: 4px;
        }

        /* ==========================
           AI Loading Indicator
           ========================== */
        .ai-loading-indicator {
          display: inline-flex;
          align-items: center;
          padding: 6px 10px;
          background: linear-gradient(135deg, rgba(14, 165, 164, 0.1), rgba(14, 165, 164, 0.05));
          border-radius: 6px;
          border: 1px solid rgba(14, 165, 164, 0.2);
          backdrop-filter: blur(4px);
          animation: aiLoadingPulse 2s ease-in-out infinite;
        }

        .ai-loading-text {
          font-size: 11px;
          font-weight: 600;
          color: #0ea5a4;
          margin-left: 6px;
          letter-spacing: 0.5px;
        }

        /* ==========================
           Editor Container
           ========================== */
        .editor-container {
          flex: 1;
          min-height: 0;
          overflow: hidden;
          transition: all 0.5s ease;
          opacity: 0;
          animation: fadeIn 0.5s ease 0.3s both;
        }

        .monaco-wrapper {
          height: 100%;
          min-height: 0;
          position: relative;
          background: linear-gradient(180deg, rgba(2,6,23,0.0), rgba(2,6,23,0.02));
        }

        .editor-overlay {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: linear-gradient(to top, rgba(15, 23, 42, 0.05) 0%, transparent 20%);
          opacity: 0.3;
        }

        /* ==========================
           Loading State
           ========================== */
        .editor-loading {
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(180deg, #0a1628 0%, #0f172a 100%);
        }

        .loading-content {
          text-align: center;
          animation: pulse 2s ease-in-out infinite;
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 2px solid rgba(14, 165, 164, 0.2);
          border-top: 2px solid #0ea5a4;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 16px;
          filter: drop-shadow(0 0 8px rgba(14, 165, 164, 0.2));
        }

        .loading-text {
          color: #94a3b8;
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 4px;
          letter-spacing: 0.5px;
        }

        .loading-subtext {
          color: #64748b;
          font-size: 12px;
          opacity: 0.8;
        }

        /* ==========================
           Read-only Banner
           ========================== */
        .read-only-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 16px;
          background: linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(251, 191, 36, 0.1));
          border-bottom: 1px solid rgba(245, 158, 11, 0.2);
          backdrop-filter: blur(8px);
          animation: slideInUp 0.4s ease;
        }

        .banner-content {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .banner-indicator {
          width: 6px;
          height: 6px;
          background: #f59e0b;
          border-radius: 50%;
          animation: pulse 2s ease-in-out infinite;
          box-shadow: 0 0 8px rgba(245, 158, 11, 0.4);
        }

        .banner-title {
          font-size: 12px;
          font-weight: 600;
          color: #fbbf24;
        }

        .banner-subtitle {
          font-size: 11px;
          color: rgba(251, 191, 36, 0.8);
        }

        .banner-action {
          font-size: 10px;
          color: rgba(251, 191, 36, 0.7);
          background: rgba(245, 158, 11, 0.1);
          padding: 4px 8px;
          border-radius: 4px;
          border: 1px solid rgba(245, 158, 11, 0.2);
        }

        /* ==========================
           Status Bar
           ========================== */
        .status-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 16px;
          background: linear-gradient(135deg, rgba(15,23,42,0.95), rgba(7,17,27,0.95));
          border-top: 1px solid rgba(14, 165, 164, 0.08);
          backdrop-filter: blur(12px);
          font-size: 11px;
          color: #94a3b8;
          flex-shrink: 0;
          animation: slideInUp 0.4s ease 0.2s both;
        }

        .status-left,
        .status-right {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .language-badge {
          background: linear-gradient(135deg, rgba(14, 165, 164, 0.2), rgba(14, 116, 144, 0.15));
          color: #0ea5a4;
          padding: 2px 8px;
          border-radius: 4px;
          font-weight: 600;
          border: 1px solid rgba(14, 165, 164, 0.2);
          transition: all 0.3s ease;
          font-size: 10px;
          letter-spacing: 0.5px;
        }

        .language-badge:hover {
          border-color: rgba(14, 165, 164, 0.3);
          color: #06d6a0;
          transform: translateY(-0.5px);
          box-shadow: 0 2px 8px rgba(14, 165, 164, 0.15);
        }

        .word-wrap-status {
          transition: all 0.3s ease;
          font-size: 10px;
        }

        .word-wrap-status.active {
          color: #0ea5a4;
        }

        .encoding-status,
        .filename-status {
          color: #64748b;
          font-size: 10px;
        }

        .filename-status {
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .cursor-position {
          transition: all 0.3s ease;
          font-size: 10px;
        }

        .cursor-position:hover {
          color: #0ea5a4;
        }

        .spaces-status {
          color: #64748b;
          font-size: 10px;
        }

        .ai-status {
          display: flex;
          align-items: center;
          gap: 4px;
          color: #0ea5a4;
          animation: fadeIn 0.3s ease;
        }

        .ai-status .ai-loading-spinner {
          width: 8px;
          height: 8px;
          border-width: 1px;
        }

        .ai-text {
          font-size: 10px;
          font-weight: 600;
        }

        .connection-status {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .status-indicator {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .status-indicator.connected {
          background: #10b981;
          animation: pulse 2s ease-in-out infinite;
          box-shadow: 0 0 6px rgba(16, 185, 129, 0.4);
        }

        .status-indicator.disconnected {
          background: #ef4444;
          animation: disconnectedPulse 1.5s ease-in-out infinite;
          box-shadow: 0 0 6px rgba(239, 68, 68, 0.4);
        }

        .status-text {
          font-size: 10px;
          font-weight: 600;
          transition: all 0.3s ease;
        }

        .status-text.connected {
          color: #10b981;
        }

        .status-text.disconnected {
          color: #ef4444;
        }

        /* ==========================
           Enhanced Dropdowns
           ========================== */
        :global(.enhanced-dropdown) {
          background: linear-gradient(180deg, #1e293b, #0f172a) !important;
          border: 1px solid rgba(14, 165, 164, 0.15) !important;
          border-radius: 8px !important;
          box-shadow: 0 10px 30px rgba(2,6,23,0.5) !important;
          backdrop-filter: blur(12px) !important;
        }

        :global(.enhanced-dropdown .ant-dropdown-menu-item) {
          color: #e2e8f0 !important;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
          border-radius: 6px !important;
          margin: 2px 4px !important;
        }

        :global(.enhanced-dropdown .ant-dropdown-menu-item:hover) {
          background: linear-gradient(90deg, rgba(14, 165, 164, 0.1), rgba(14, 165, 164, 0.05)) !important;
          color: #0ea5a4 !important;
          transform: translateX(2px) !important;
        }

        /* ==========================
           Enhanced Monaco Editor Styling
           ========================== */
        :global(.enhanced-monaco-editor) {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        /* Enhanced cursor styling */
        :global(.monaco-editor .cursor) {
          transition: all 0.1s ease-out !important;
          animation: cursorBlink 1.06s step-end infinite !important;
          box-shadow: 0 0 8px rgba(14, 165, 164, 0.3) !important;
          background: linear-gradient(to bottom, #0ea5a4, #06b6d4) !important;
          width: 2px !important;
          border-radius: 1px !important;
        }

        :global(.monaco-editor .cursor.blink) {
          animation: smoothCursorBlink 1.06s ease-in-out infinite !important;
        }

        /* Enhanced line highlighting */
        :global(.monaco-editor .current-line) {
          background: rgba(14, 165, 164, 0.03) !important;
          border: 1px solid rgba(14, 165, 164, 0.08) !important;
          border-radius: 2px !important;
          transition: all 0.2s ease-out !important;
        }

        :global(.monaco-editor .current-line-exact) {
          background: rgba(14, 165, 164, 0.05) !important;
          box-shadow: 0 0 10px rgba(14, 165, 164, 0.1) !important;
        }

        /* Enhanced selection styling */
        :global(.monaco-editor .selected-text) {
          background: rgba(14, 165, 164, 0.2) !important;
          border-radius: 2px !important;
          animation: selectionGlow 0.3s ease-out !important;
        }

        /* Typing animation for changed lines */
        :global(.monaco-editor .view-line.typing-animation) {
          animation: lineTyping 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
          background: linear-gradient(90deg, 
            rgba(14, 165, 164, 0.1) 0%, 
            rgba(14, 165, 164, 0.05) 50%, 
            transparent 100%) !important;
          border-radius: 2px !important;
        }

        /* Enhanced scrollbar for Monaco */
        :global(.monaco-editor .monaco-scrollable-element > .scrollbar) {
          background: rgba(15, 23, 42, 0.8) !important;
          border-radius: 4px !important;
          transition: all 0.3s ease !important;
        }

        :global(.monaco-editor .monaco-scrollable-element > .scrollbar > .slider) {
          background: linear-gradient(180deg, rgba(14, 165, 164, 0.4), rgba(14, 165, 164, 0.6)) !important;
          border-radius: 2px !important;
          border: 1px solid rgba(14, 165, 164, 0.2) !important;
          transition: all 0.3s ease !important;
        }

        :global(.monaco-editor .monaco-scrollable-element > .scrollbar:hover > .slider) {
          background: linear-gradient(180deg, rgba(14, 165, 164, 0.6), rgba(14, 165, 164, 0.8)) !important;
          box-shadow: 0 0 8px rgba(14, 165, 164, 0.3) !important;
        }

        /* Enhanced line numbers */
        :global(.monaco-editor .line-numbers) {
          color: rgba(148, 163, 184, 0.6) !important;
          transition: all 0.2s ease !important;
          font-weight: 500 !important;
        }

        :global(.monaco-editor .line-numbers.active-line-number) {
          color: rgba(14, 165, 164, 0.8) !important;
          font-weight: 600 !important;
          text-shadow: 0 0 4px rgba(14, 165, 164, 0.2) !important;
        }

        /* Enhanced bracket matching */
        :global(.monaco-editor .bracket-match) {
          background: rgba(14, 165, 164, 0.15) !important;
          border: 1px solid rgba(14, 165, 164, 0.3) !important;
          border-radius: 2px !important;
          animation: bracketHighlight 0.2s ease-out !important;
        }

        /* Enhanced find widget styling */
        :global(.monaco-editor .find-widget) {
          background: linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9)) !important;
          border: 1px solid rgba(14, 165, 164, 0.2) !important;
          border-radius: 8px !important;
          box-shadow: 0 8px 25px rgba(2, 6, 23, 0.4) !important;
          backdrop-filter: blur(12px) !important;
          animation: findWidgetSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }

        :global(.monaco-editor .find-widget .monaco-inputbox) {
          background: rgba(15, 23, 42, 0.8) !important;
          border: 1px solid rgba(14, 165, 164, 0.2) !important;
          border-radius: 4px !important;
        }

        :global(.monaco-editor .find-widget .monaco-inputbox.synthetic-focus) {
          border-color: rgba(14, 165, 164, 0.5) !important;
          box-shadow: 0 0 0 2px rgba(14, 165, 164, 0.1) !important;
        }

        /* Enhanced minimap (when enabled) */
        :global(.monaco-editor .minimap) {
          background: linear-gradient(180deg, rgba(15, 23, 42, 0.8), rgba(7, 17, 27, 0.9)) !important;
          border-left: 1px solid rgba(14, 165, 164, 0.1) !important;
        }

        /* Text selection enhancement */
        :global(.monaco-editor .view-lines .view-line span) {
          transition: background-color 0.1s ease-out !important;
        }

        /* Smooth text rendering */
        :global(.monaco-editor .monaco-editor-background) {
          background: transparent !important;
        }

        :global(.monaco-editor .margin) {
          background: transparent !important;
        }
        /* ==========================
           Enhanced Animations & Keyframes
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

        @keyframes slideInLeft {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
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

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }

        @keyframes disconnectedPulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.6;
            transform: scale(1.1);
          }
        }

        @keyframes aiLoadingPulse {
          0%, 100% { 
            opacity: 0.7; 
            box-shadow: 0 0 0 0 rgba(14, 165, 164, 0.7);
          }
          50% { 
            opacity: 1; 
            box-shadow: 0 0 0 4px rgba(14, 165, 164, 0);
          }
        }

        /* Enhanced cursor animations */
        @keyframes cursorBlink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }

        @keyframes smoothCursorBlink {
          0%, 45% { 
            opacity: 1; 
            transform: scaleY(1);
          }
          50%, 95% { 
            opacity: 0.3; 
            transform: scaleY(0.8);
          }
          100% { 
            opacity: 1; 
            transform: scaleY(1);
          }
        }

        /* Text and line animations */
        @keyframes lineTyping {
          0% {
            background-position: -100% 0;
            opacity: 0.8;
          }
          50% {
            opacity: 1;
          }
          100% {
            background-position: 100% 0;
            opacity: 0.9;
          }
        }

        @keyframes selectionGlow {
          0% {
            box-shadow: 0 0 0 0 rgba(14, 165, 164, 0.4);
          }
          50% {
            box-shadow: 0 0 8px 2px rgba(14, 165, 164, 0.2);
          }
          100% {
            box-shadow: 0 0 4px 1px rgba(14, 165, 164, 0.1);
          }
        }

        @keyframes bracketHighlight {
          0% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(14, 165, 164, 0.4);
          }
          50% {
            transform: scale(1.02);
            box-shadow: 0 0 8px 2px rgba(14, 165, 164, 0.3);
          }
          100% {
            transform: scale(1);
            box-shadow: 0 0 4px 1px rgba(14, 165, 164, 0.2);
          }
        }

        @keyframes findWidgetSlideIn {
          from {
            opacity: 0;
            transform: translateY(-10px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        /* ==========================
           Enhanced Tooltips
           ========================== */
        :global(.ant-tooltip-inner) {
          background: linear-gradient(135deg, #0f172a, #071126) !important;
          border: 1px solid rgba(14, 165, 164, 0.2) !important;
          color: #e2e8f0 !important;
          border-radius: 6px !important;
          backdrop-filter: blur(12px) !important;
          box-shadow: 0 8px 25px rgba(2,6,23,0.4) !important;
          font-size: 11px !important;
          padding: 6px 8px !important;
        }

        :global(.ant-tooltip-arrow::before) {
          background: linear-gradient(135deg, #0f172a, #071126) !important;
          border: 1px solid rgba(14, 165, 164, 0.2) !important;
        }

        /* ==========================
           Enhanced Messages
           ========================== */
        :global(.ant-message-notice-content) {
          background: linear-gradient(135deg, #0f172a, #071126) !important;
          border: 1px solid rgba(14, 165, 164, 0.2) !important;
          color: #e2e8f0 !important;
          border-radius: 8px !important;
          backdrop-filter: blur(12px) !important;
          box-shadow: 0 8px 25px rgba(2,6,23,0.4) !important;
        }

        /* ==========================
           Scrollbar Enhancements
           ========================== */
        *::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }

        *::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.3);
          border-radius: 3px;
        }

        *::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, rgba(14, 165, 164, 0.3), rgba(14, 165, 164, 0.6));
          border-radius: 3px;
          border: 1px solid rgba(14, 165, 164, 0.1);
          transition: all 0.3s ease;
        }

        *::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, rgba(14, 165, 164, 0.5), rgba(14, 165, 164, 0.8));
          box-shadow: 0 0 10px rgba(14, 165, 164, 0.3);
        }

        /* ==========================
           Focus States
           ========================== */
        .enhanced-button:focus-visible {
          outline: 2px solid rgba(14, 165, 164, 0.6) !important;
          outline-offset: 2px !important;
        }

        /* ==========================
           Selection Styling
           ========================== */
        ::selection {
          background: rgba(14, 165, 164, 0.3);
          color: #f1f5f9;
        }

        /* ==========================
           Mobile Responsiveness
           ========================== */
        @media (max-width: 768px) {
          .code-editor-toolbar {
            padding: 8px 12px;
          }

          .toolbar-left,
          .toolbar-right {
            gap: 6px;
          }

          .enhanced-button {
            height: 28px !important;
            min-width: 28px !important;
            padding: 4px 6px !important;
          }

          .button-icon {
            font-size: 11px;
          }

          .font-size-display {
            height: 28px !important;
            padding: 4px 8px !important;
          }

          .font-size-text {
            font-size: 10px;
          }

          .status-bar {
            padding: 4px 12px;
            font-size: 10px;
          }

          .status-left,
          .status-right {
            gap: 12px;
          }

          .language-badge {
            font-size: 9px;
            padding: 1px 6px;
          }

          .read-only-banner {
            padding: 6px 12px;
            flex-direction: column;
            align-items: flex-start;
            gap: 4px;
          }

          .banner-content {
            width: 100%;
          }

          .banner-action {
            font-size: 9px;
            align-self: flex-end;
          }
        }

        @media (max-width: 480px) {
          .code-editor-toolbar {
            padding: 6px 8px;
            flex-wrap: wrap;
            gap: 8px;
          }

          .toolbar-left,
          .toolbar-right {
            gap: 4px;
          }

          .enhanced-button {
            height: 24px !important;
            min-width: 24px !important;
            padding: 3px 4px !important;
          }

          .button-icon {
            font-size: 10px;
          }

          .font-size-display {
            height: 24px !important;
            padding: 3px 6px !important;
          }

          .font-size-text {
            font-size: 9px;
          }

          .toolbar-divider {
            height: 16px;
          }

          .status-bar {
            padding: 3px 8px;
            font-size: 9px;
            flex-wrap: wrap;
            gap: 8px;
          }

          .status-left,
          .status-right {
            gap: 8px;
          }

          .language-badge {
            font-size: 8px;
            padding: 1px 4px;
          }

          .filename-status {
            max-width: 120px;
          }

          .ai-loading-indicator {
            padding: 4px 6px;
          }

          .ai-loading-text {
            font-size: 9px;
          }
        }

        /* ==========================
           Performance Optimizations
           ========================== */
        .code-editor-container {
          will-change: transform;
          backface-visibility: hidden;
        }

        .enhanced-button,
        .ai-loading-indicator {
          will-change: transform, box-shadow;
        }

        /* ==========================
           Enhanced Glow Effects
           ========================== */
        .enhanced-button:hover {
          filter: drop-shadow(0 0 8px rgba(14, 165, 164, 0.2));
        }

        .language-badge:hover {
          filter: drop-shadow(0 0 6px rgba(14, 165, 164, 0.3));
        }

        .status-indicator {
          filter: drop-shadow(0 0 4px rgba(16, 185, 129, 0.3));
        }

        .status-indicator.connected {
          filter: drop-shadow(0 0 4px rgba(16, 185, 129, 0.3));
        }

        .status-indicator.disconnected {
          filter: drop-shadow(0 0 4px rgba(239, 68, 68, 0.4));
        }

        /* ==========================
           Accessibility Improvements
           ========================== */
        .enhanced-button,
        .font-size-display {
          cursor: pointer;
        }

        .enhanced-button:disabled {
          cursor: not-allowed;
        }

        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }

          .loading-spinner,
          .ai-loading-spinner {
            animation: none;
          }

          .banner-indicator,
          .status-indicator {
            animation: none;
          }
        }

        /* ==========================
           High Contrast Mode Support
           ========================== */
        @media (prefers-contrast: high) {
          .enhanced-button {
            border-color: #ffffff !important;
          }

          .enhanced-button:hover {
            background: #ffffff !important;
            color: #000000 !important;
          }

          .toolbar-divider {
            background: #ffffff !important;
          }

          .language-badge {
            border-color: #ffffff !important;
            background: #000000 !important;
          }
        }

        /* ==========================
           Print Styles
           ========================== */
        @media print {
          .code-editor-toolbar,
          .status-bar,
          .read-only-banner {
            display: none !important;
          }

          .code-editor-container {
            background: white !important;
            color: black !important;
          }

          .editor-container {
            border: 1px solid #000000 !important;
          }
        }
      `}</style>
    </>
  );
};

export default CodeEditor;
