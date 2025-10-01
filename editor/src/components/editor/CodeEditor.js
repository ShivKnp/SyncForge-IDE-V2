import React, { Suspense, useState, useRef, useEffect } from 'react';
import { Button, Space, Tooltip, Dropdown, message, Input, Modal, Form } from 'antd';
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
  ShareAltOutlined,
  DownloadOutlined,
  PlayCircleOutlined,
  FileOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { FaTerminal, FaSearch } from 'react-icons/fa';
import JSZip from 'jszip';

import Editor from '@monaco-editor/react';
const { Search } = Input;
const { TextArea } = Input;

const BACKEND_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8080';

// Enhanced AI ghost widget styles
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

// Create Item Modal Component (from FileTree)
const CreateItemModal = ({ 
  visible, 
  onCancel, 
  onConfirm, 
  type, 
  parentNode,
  existingNames = []
}) => {
  const [form] = Form.useForm();
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    if (visible) {
      form.resetFields();
      setValidationError('');
    }
  }, [visible, form]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const itemName = values.name.trim();

      const validation = validateItemName(itemName, type, existingNames);

      if (!validation.isValid) {
        setValidationError(validation.error);
        return;
      }

      setValidationError('');
      onConfirm(itemName);
      form.resetFields();
    } catch (error) {
      console.log('Validation failed:', error);
    }
  };

  const validateItemName = (name, itemType, existingNames) => {
    if (!name || name.trim().length === 0) {
      return { isValid: false, error: `${itemType === 'file' ? 'File' : 'Folder'} name is required` };
    }

    if (name.length > 255) {
      return { isValid: false, error: 'Name must be less than 255 characters' };
    }

    const invalidChars = /[<>:"/\\|?*\x00-\x1F]/;
    if (invalidChars.test(name)) {
      return { isValid: false, error: 'Name contains invalid characters: < > : " / \\ | ? *' };
    }

    const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
    if (reservedNames.includes(name.toUpperCase())) {
      return { isValid: false, error: 'This name is reserved by the system' };
    }

    if (existingNames.includes(name)) {
      return { isValid: false, error: `A ${itemType === 'file' ? 'file' : 'folder'} with this name already exists` };
    }

    if (itemType === 'file') {
      if (name.endsWith('.') || name.endsWith(' ')) {
        return { isValid: false, error: 'File name cannot end with a dot or space' };
      }
    }

    if (itemType === 'folder') {
      if (name.endsWith('.') || name.endsWith(' ')) {
        return { isValid: false, error: 'Folder name cannot end with a dot or space' };
      }
    }

    return { isValid: true, error: '' };
  };

  const handleNameChange = (e) => {
    const name = e.target.value;
    if (name.trim()) {
      const validation = validateItemName(name, type, existingNames);
      setValidationError(validation.error || '');
    } else {
      setValidationError('');
    }
  };

  const getPlaceholder = () => {
    if (type === 'file') {
      return 'e.g., index.html, script.js, styles.css';
    }
    return 'e.g., src, components, assets';
  };

  const getDefaultName = () => {
    const baseName = type === 'file' ? 'new-file' : 'new-folder';
    let counter = 1;
    let newName = baseName;

    while (existingNames.includes(newName)) {
      newName = `${baseName}-${counter}`;
      counter++;
    }

    return newName;
  };

  return (
    <Modal
  title={
    <div className="flex items-center gap-2">
      <div className="terminal-toggle active" style={{ 
        background: type === 'file' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(245, 158, 11, 0.1)',
        borderColor: type === 'file' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(245, 158, 11, 0.3)'
      }}>
        {type === 'file' ? <FileOutlined className="terminal-icon" /> : <FolderOutlined className="terminal-icon" />}
      </div>
      <span className="text-slate-100 font-semibold text-sm">
        Create New {type === 'file' ? 'File' : 'Folder'}
      </span>
    </div>
  }
  open={visible}
  onOk={handleOk}
  onCancel={() => {
    form.resetFields();
    setValidationError('');
    onCancel();
  }}
  okText={`Create ${type === 'file' ? 'File' : 'Folder'}`}
  cancelText="Cancel"
  className="create-item-modal host-modal-style"
  width={480}
  transitionName="ant-zoom"
  maskTransitionName="ant-fade"
  styles={{
    body: { 
      padding: '20px',
      background: 'linear-gradient(180deg, rgba(15,23,42,0.95), rgba(7,17,26,0.95))',
      color: '#e2e8f0',
      backdropFilter: 'blur(20px)',
      opacity: 0,
      transform: 'scale(0.95) translateY(-10px)',
      animation: 'modalEnter 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards'
    },
    header: {
      background: 'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(30,41,59,0.9))',
      borderBottom: `1px solid ${type === 'file' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(245, 158, 11, 0.15)'}`,
      color: '#e2e8f0',
      padding: '16px 20px',
      minHeight: 'auto',
      opacity: 0,
      transform: 'translateY(-10px)',
      animation: 'modalHeaderEnter 0.3s cubic-bezier(0.4, 0, 0.2, 1) 0.1s forwards'
    },
    content: {
      backgroundColor: 'transparent',
      backdropFilter: 'blur(20px)',
      boxShadow: `0 20px 40px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px ${type === 'file' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(245, 158, 11, 0.1)'}`,
      border: 'none',
      opacity: 0,
      transform: 'scale(0.95)',
      animation: 'modalContentEnter 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards'
    },
    footer: {
      background: 'linear-gradient(180deg, rgba(15,23,42,0.8), rgba(7,17,26,0.9))',
      borderTop: `1px solid ${type === 'file' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(245, 158, 11, 0.1)'}`,
      padding: '16px 20px',
      marginTop: '8px',
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '8px'
    }
  }}
  okButtonProps={{
    className: type === 'file' ? 'modal-file-create-btn animate-pulse-once' : 'modal-folder-create-btn animate-pulse-once'
  }}
  cancelButtonProps={{
    className: 'modal-cancel-btn'
  }}
  closeIcon={
    <div className="modal-close-btn">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path 
          d="M1 1L13 13M13 1L1 13" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          className="transition-all duration-300"
        />
      </svg>
    </div>
  }
  destroyOnClose
>
  <div className="space-y-4 modal-content-inner">
    <div className="text-slate-400 text-sm animate-fadeInUp" style={{ animationDelay: '0.1s' }}>
      Creating in: <span className="text-cyan-300 font-medium">{parentNode?.name || 'root'}</span>
    </div>

    <Form
      form={form}
      layout="vertical"
      initialValues={{ name: getDefaultName() }}
    >
      <Form.Item
        label={
          <span className="text-slate-300 text-sm font-medium animate-fadeInUp" style={{ animationDelay: '0.2s' }}>
            {type === 'file' ? 'File Name' : 'Folder Name'}
          </span>
        }
        name="name"
        rules={[
          { required: true, message: `Please enter a ${type === 'file' ? 'file' : 'folder'} name` },
        ]}
        help={validationError && (
          <div className="flex items-center gap-2 text-rose-400 text-xs mt-1 animate-fadeInUp" style={{ animationDelay: '0.3s' }}>
            <ExclamationCircleOutlined />
            <span>{validationError}</span>
          </div>
        )}
        validateStatus={validationError ? 'error' : ''}
      >
        <Input
          placeholder={getPlaceholder()}
          onChange={handleNameChange}
          autoFocus
          className="modal-input animate-fadeInUp"
          style={{ animationDelay: '0.2s' }}
          onPressEnter={handleOk}
        />
      </Form.Item>
    </Form>

    <div className="bg-gradient-to-r from-slate-800/40 to-slate-700/30 p-4 border border-slate-700/30 animate-fadeInUp" style={{ animationDelay: '0.3s' }}>
      <div className="text-xs text-slate-400 space-y-2">
        <div className="font-medium text-slate-300 mb-2 flex items-center gap-2">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path 
              d="M6 3V6M6 9H6.005M5 1H7C7.55228 1 8 1.44772 8 2V10C8 10.5523 7.55228 11 7 11H5C4.44772 11 4 10.5523 4 10V2C4 1.44772 4.44772 1 5 1Z" 
              stroke="currentColor" 
              strokeWidth="1.2" 
              strokeLinecap="round"
            />
          </svg>
          Naming Rules:
        </div>
        <div className="grid grid-cols-2 gap-1 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-1 h-1 bg-rose-400"></div>
            <span>No: &lt; &gt; : " / \\ | ? *</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1 h-1 bg-rose-400"></div>
            <span>Max 255 characters</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1 h-1 bg-rose-400"></div>
            <span>No reserved names</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1 h-1 bg-rose-400"></div>
            <span>Must be unique</span>
          </div>
        </div>
        {type === 'file' && (
          <div className="flex items-center gap-1 mt-2 text-cyan-400">
            <div className="w-1 h-1 bg-cyan-400"></div>
            <span>Include extension (e.g., .js, .html, .css)</span>
          </div>
        )}
      </div>
    </div>
  </div>
</Modal>
  );
};

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
  terminalVisible = false,
  // Run functionality props (from SidePanel)
  input,
  output,
  handleLang,
  handleRun,
  handleInput,
  runCodeDisabled = false,
  roomMode,
  projectLanguage,
  sharedInputOutput,
  // Sidebar control props
  onOpenSidebarPanel, // Function to open specific sidebar panel
  selectedNodeId, // For getting parent folder context
  getExistingNames,
  isSaving = false,
  lastSaved = null,
  hasUnsavedChanges = false 
}) => {
  const [wordWrap, setWordWrap] = useState(false);
  const fileContent = activeFile ? activeFile.content : '';
  const fileInputRef = useRef(null);
  const zipInputRef = useRef(null);

  const editorInstanceRef = useRef(null);
  const monacoRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const formatLastSaved = (date) => {
    if (!date) return 'Never';
    const now = new Date();
    const diffMs = now - new Date(date);
    const diffMins = Math.floor(diffMs / 60000);
    const diffSecs = Math.floor(diffMs / 1000);
    
    if (diffSecs < 60) return `${diffSecs}s ago`;
    if (diffMins < 60) return `${diffMins}m ago`;
    return date.toLocaleTimeString();
  };

  const [collapsedToolbar, setCollapsedToolbar] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [cursorPosition, setCursorPosition] = useState({ lineNumber: 1, column: 1 });
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [cursorBlinking, setCursorBlinking] = useState(true);

  // Modal states for file/folder creation
  const [createModal, setCreateModal] = useState({
    visible: false,
    type: 'file',
    parentNodeId: null,
    parentNode: null
  });

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

  // Cursor blinking effect
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setCursorBlinking(prev => !prev);
    }, 530);

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

  const clearGhost = () => {
    if (!ghostRef.current) return;
    const widget = document.getElementById('ai-ghost-widget');
    if (widget) widget.remove();
    ghostRef.current = null;
  };

  const handleEditorMount = (editor, monaco) => {
    editorInstanceRef.current = editor;
    monacoRef.current = monaco;

    setTimeout(() => setIsEditorReady(true), 300);

    if (typeof onEditorMount === 'function') onEditorMount(editor, monaco);

    editor.onDidChangeCursorPosition((e) => {
      setCursorPosition(e.position);
      setCursorBlinking(true);
      clearGhost();

      const cursorElement = document.querySelector('.monaco-editor .cursor');
      if (cursorElement) {
        cursorElement.style.transition = 'all 0.1s ease-out';
      }
    });

    editor.onDidChangeModel(() => {
      clearGhost();
    });
    editor.onDidBlurEditorWidget(() => clearGhost());
    editor.onDidScrollChange(() => clearGhost());

    setTimeout(() => {
      const editorContainer = editor.getDomNode();
      if (editorContainer) {
        editorContainer.classList.add('enhanced-monaco-editor');
      }
    }, 100);
  };

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

  // Handle Run button click - opens sidebar to compiler panel
  const handleRunClick = () => {
    if (handleRun) {
      handleRun();
    }
    // Automatically open sidebar to compiler panel
    if (onOpenSidebarPanel) {
      onOpenSidebarPanel('compiler');
    }
  };

  // Handle New File - shows modal
  const handleNewFileClick = () => {
    if (editingHostOnly && !isHost) {
      return message.warn('Only the host can create files.');
    }

    const parentNodeId = selectedNodeId || 'root';
    const parentNode = fileTree[parentNodeId];

    if (!parentNode || parentNode.type !== 'folder') {
      message.error('Please select a folder first');
      return;
    }

    setCreateModal({
      visible: true,
      type: 'file',
      parentNodeId: parentNodeId,
      parentNode: parentNode
    });
  };

  // Handle New Folder - shows modal
  const handleNewFolderClick = () => {
    if (editingHostOnly && !isHost) {
      return message.warn('Only the host can create folders.');
    }

    const parentNodeId = selectedNodeId || 'root';
    const parentNode = fileTree[parentNodeId];

    if (!parentNode || parentNode.type !== 'folder') {
      message.error('Please select a folder first');
      return;
    }

    setCreateModal({
      visible: true,
      type: 'folder',
      parentNodeId: parentNodeId,
      parentNode: parentNode
    });
  };

  // Handle modal confirm
  const handleModalConfirm = (itemName) => {
    if (createModal.type === 'file') {
      if (onNewFile) {
        onNewFile(createModal.parentNodeId, itemName);
      }
    } else {
      if (onNewFolder) {
        onNewFolder(createModal.parentNodeId, itemName);
      }
    }
    setCreateModal({ ...createModal, visible: false });
  };

  // Handle modal cancel
  const handleModalCancel = () => {
    setCreateModal({ ...createModal, visible: false });
  };

  // Get existing names for validation
  const getModalExistingNames = () => {
    if (typeof getExistingNames === 'function') {
      return getExistingNames(createModal.parentNodeId);
    }

    // Fallback: get names from fileTree
    if (!createModal.parentNodeId || !fileTree[createModal.parentNodeId]) {
      return [];
    }

    const parentNode = fileTree[createModal.parentNodeId];
    if (!parentNode.children) {
      return [];
    }

    return parentNode.children.map(childId => fileTree[childId]?.name).filter(Boolean);
  };

  const collapsedMenuItems = [
    { key: 'search', label: <button className="w-full text-left px-3 py-2 text-slate-200 hover:text-cyan-400 hover:bg-slate-700/50 transition-all duration-200 rounded-md" onClick={() => openMonacoFind(searchQuery)}>Search…</button> },
    { key: 'theme-dark', label: <button className="w-full text-left px-3 py-2 text-slate-200 hover:text-cyan-400 hover:bg-slate-700/50 transition-all duration-200 rounded-md" onClick={() => onThemeChange && onThemeChange('vs-dark')}>Theme: Dark</button> },
    { key: 'theme-light', label: <button className="w-full text-left px-3 py-2 text-slate-200 hover:text-cyan-400 hover:bg-slate-700/50 transition-all duration-200 rounded-md" onClick={() => onThemeChange && onThemeChange('vs')}>Theme: Light</button> },
    { key: 'font-monaco', label: <button className="w-full text-left px-3 py-2 text-slate-200 hover:text-cyan-400 hover:bg-slate-700/50 transition-all duration-200 rounded-md" onClick={() => onFontFamilyChange && onFontFamilyChange('Monaco, Menlo, "Ubuntu Mono", monospace')}>Font: Monaco</button> },
    { key: 'font-fira', label: <button className="w-full text-left px-3 py-2 text-slate-200 hover:text-cyan-400 hover:bg-slate-700/50 transition-all duration-200 rounded-md" onClick={() => onFontFamilyChange && onFontFamilyChange('"Fira Code", "Cascadia Code", "JetBrains Mono", monospace')}>Font: Fira Code</button> },
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
            {/* New File Button */}
            <Tooltip title={readOnly ? 'Read-only (host-only editing enabled)' : 'New File'} color="#0f172a">
              <Button
                type="text"
                icon={<FileAddOutlined className="button-icon file-add-icon" />}
                onClick={handleNewFileClick}
                disabled={readOnly}
                className={getEnhancedButtonClassName()}
              />
            </Tooltip>

            {/* New Folder Button */}
            <Tooltip title={readOnly ? 'Read-only (host-only editing enabled)' : 'New Folder'} color="#0f172a">
              <Button
                type="text"
                icon={<FolderAddOutlined className="button-icon folder-add-icon" />}
                onClick={handleNewFolderClick}
                disabled={readOnly}
                className={getEnhancedButtonClassName()}
              />
            </Tooltip>

            

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
                icon={<DownloadOutlined className="button-icon folder-icon" />}
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

            <div className="toolbar-divider" />

            {/* Run Button */}
      
<Tooltip title="Run" color="#0f172a">
  <Button
    type="text"  // Changed from "primary" to "text"
    icon={<PlayCircleOutlined className="button-icon play-icon" /> }
    onClick={handleRunClick}
    loading={runCodeDisabled}
    disabled={runCodeDisabled}
    className={getEnhancedButtonClassName()}
  >
    {!collapsedToolbar && (runCodeDisabled ? 'Running' : 'Run')}
  </Button>
</Tooltip>

            <div className="toolbar-divider" />
          </Space>

          <div className="toolbar-right">
            {!collapsedToolbar && (
              <Tooltip title="Open Monaco Search" color="#0f172a">
                <Button
                  type="text"
                  icon={<FaSearch className="button-icon search-icon" />}
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
            {/* ADD SAVING INDICATOR */}
<div className="saving-indicator-container">
  {isSaving ? (
    <div className="saving-indicator saving">
      <div className="saving-spinner"></div>
      <span className="saving-text">Saving...</span>
    </div>
  ) : (
    <div className="saving-indicator saved">
      <div className="saved-icon">✓</div>
      <span className="saving-text">Saved</span>
    </div>
  )}
</div>
            {isAiLoading && (
              <span className="ai-status">
                <div className="ai-loading-spinner" />
                <span className="ai-text">AI</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Create Item Modal */}
      <CreateItemModal
        visible={createModal.visible}
        onCancel={handleModalCancel}
        onConfirm={handleModalConfirm}
        type={createModal.type}
        parentNode={createModal.parentNode}
        existingNames={getModalExistingNames()}
      />
    
      <style jsx>{`
      /* ==========================
   Footer Saving Indicator Styles
   ========================== */
.saving-indicator-container {
  display: flex;
  align-items: center;
  margin-left: auto;
  padding: 2px 10px;
  border-radius: 6px;
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(14, 165, 164, 0.2);
  backdrop-filter: blur(8px);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.saving-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.3px;
  transition: all 0.3s ease;
}

.saving-indicator.saving {
  color: #0ea5a4;
}

.saving-indicator.saved {
  color: #10b981;
}

.saving-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid currentColor;
  border-top: 2px solid transparent;
  border-radius: 50%;
  animation: savingSpin 1s linear infinite;
  filter: drop-shadow(0 0 4px rgba(14, 165, 164, 0.3));
}

.saved-icon {
  width: 14px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: bold;
  background: rgba(16, 185, 129, 0.1);
  border-radius: 50%;
  border: 1px solid rgba(16, 185, 129, 0.3);
  animation: savedPulse 2s ease-in-out infinite;
}

.saving-text {
  font-size: 9px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Enhanced animations */
@keyframes savingSpin {
  0% { 
    transform: rotate(0deg); 
    border-color: #0ea5a4;
    border-top-color: transparent;
  }
  50% { 
    border-color: #06d6a0;
    border-top-color: transparent;
  }
  100% { 
    transform: rotate(360deg); 
    border-color: #0ea5a4;
    border-top-color: transparent;
  }
}

@keyframes savedPulse {
  0%, 100% { 
    opacity: 1;
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4);
  }
  50% { 
    opacity: 0.8;
    box-shadow: 0 0 0 4px rgba(16, 185, 129, 0);
  }
}

/* Hover effects */
.saving-indicator-container:hover {
  background: rgba(15, 23, 42, 0.9);
  border-color: rgba(14, 165, 164, 0.4);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(14, 165, 164, 0.15);
}

.saving-indicator.saving:hover .saving-spinner {
  animation-duration: 0.6s;
  filter: drop-shadow(0 0 6px rgba(14, 165, 164, 0.5));
}

.saving-indicator.saved:hover .saved-icon {
  animation-duration: 1s;
  background: rgba(16, 185, 129, 0.2);
  transform: scale(1.1);
}

/* Status bar integration */
.status-bar .saving-indicator-container {
  margin-left: 16px;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(14, 165, 164, 0.15);
}

/* Responsive design */
@media (max-width: 768px) {
  .saving-indicator-container {
    padding: 3px 8px;
    margin-left: 12px;
  }
  
  .saving-indicator {
    gap: 6px;
  }
  
  .saving-spinner {
    width: 10px;
    height: 10px;
    border-width: 1.5px;
  }
  
  .saved-icon {
    width: 12px;
    height: 12px;
    font-size: 9px;
  }
  
  .saving-text {
    font-size: 10px;
  }
}

@media (max-width: 480px) {
  .saving-indicator-container {
    padding: 2px 6px;
    margin-left: 8px;
  }
  
  .saving-text {
    font-size: 9px;
    letter-spacing: 0.2px;
  }
}

/* Performance optimizations */
.saving-spinner,
.saved-icon {
  will-change: transform, opacity;
  transform: translateZ(0);
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .saving-indicator-container {
    border-width: 2px;
  }
  
  .saving-spinner {
    border-width: 3px;
  }
  
  .saved-icon {
    border-width: 2px;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .saving-spinner {
    animation: none;
    border-top-color: currentColor;
  }
  
  .saved-icon {
    animation: none;
  }
  
  .saving-indicator-container:hover {
    transform: none;
  }
}
      /* ==========================
   Terminal & Run Button Matching Styles
   ========================== */

/* Ensure both terminal and run buttons have identical styling */
.enhanced-button .terminal-icon,
.enhanced-button .play-icon {
  font-size: 13px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  z-index: 1;
  display: inline-block;
  vertical-align: middle;
  transform-origin: center;
  will-change: transform;
}

/* Hover effects for both icons */
.enhanced-button:hover .terminal-icon,
.enhanced-button:hover .play-icon {
  transform: translateY(-1px) scale(1.1);
  color: #0ea5a4 !important;
  
}

/* Specific animation for play icon to match terminal icon behavior */
.enhanced-button:hover .play-icon {
  animation: playIconHover 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes playIconHover {
  0% {
    transform: translateY(0) scale(1);
  }
  50% {
    transform: translateY(-2px) scale(1.15);
  }
  100% {
    transform: translateY(-1px) scale(1.1);
  }
}

/* Loading state for run button - subtle pulse to match terminal aesthetic */
.run-button.enhanced-button.ant-btn-loading {
  position: relative;
  overflow: hidden;
}

.run-button.enhanced-button.ant-btn-loading::after {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(14, 165, 164, 0.1), transparent);
  animation: loadingShimmer 1.5s ease-in-out infinite;
}

@keyframes loadingShimmer {
  0% {
    left: -100%;
  }
  100% {
    left: 100%;
  }
}

/* Disabled state matching */
.enhanced-button:disabled .terminal-icon,
.enhanced-button:disabled .play-icon {
  opacity: 0.4;
  transform: none !important;
  animation: none !important;
}

/* Ensure both buttons have identical layout and spacing */
.toolbar-left .enhanced-button,
.toolbar-right .enhanced-button {
  min-width: 32px !important;
  min-height: 32px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}

/* Remove any text content from run button to match terminal button */
.enhanced-button .ant-btn-loading-icon + span,
.enhanced-button > span:not(.ant-btn-icon) {
  display: none !important;
}
      
      /* Create File Button */
.modal-file-create-btn {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 8px !important;
  padding: 8px 20px !important;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.9), rgba(37, 99, 235, 0.8)) !important;
  border: 1px solid rgba(59, 130, 246, 0.3) !important;
  color: white !important;
  font-size: 12px !important;
  font-weight: 500 !important;
  cursor: pointer !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
  backdrop-filter: blur(8px) !important;
  position: relative !important;
  overflow: hidden !important;
  min-width: 100px !important;
}

.modal-file-create-btn:hover {
  background: linear-gradient(135deg, rgba(59, 130, 246, 1), rgba(37, 99, 235, 0.9)) !important;
  border-color: rgba(59, 130, 246, 0.5) !important;
  transform: translateY(-2px) scale(1.05) !important;
  box-shadow: 0 8px 25px rgba(59, 130, 246, 0.4) !important;
}

/* Create Folder Button */
.modal-folder-create-btn {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 8px !important;
  padding: 8px 20px !important;
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.9), rgba(217, 119, 6, 0.8)) !important;
  border: 1px solid rgba(245, 158, 11, 0.3) !important;
  color: white !important;
  font-size: 12px !important;
  font-weight: 500 !important;
  cursor: pointer !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
  backdrop-filter: blur(8px) !important;
  position: relative !important;
  overflow: hidden !important;
  min-width: 120px !important;
}

.modal-folder-create-btn:hover {
  background: linear-gradient(135deg, rgba(245, 158, 11, 1), rgba(217, 119, 6, 0.9)) !important;
  border-color: rgba(245, 158, 11, 0.5) !important;
  transform: translateY(-2px) scale(1.05) !important;
  box-shadow: 0 8px 25px rgba(245, 158, 11, 0.4) !important;
}

/* Button shimmer effects */
.modal-file-create-btn::before,
.modal-folder-create-btn::before {
  content: '' !important;
  position: absolute !important;
  top: 0 !important;
  left: -100% !important;
  width: 100% !important;
  height: 100% !important;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent) !important;
  transition: left 0.5s !important;
}

.modal-file-create-btn:hover::before,
.modal-folder-create-btn:hover::before {
  left: 100% !important;
}

/* Modal animations */
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

.animate-fadeInUp {
  animation: fadeInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

.animate-pulse-once {
  animation: pulseOnce 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes pulseOnce {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
  }
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

/* File/Folder specific terminal toggle animations */
.create-item-modal .terminal-toggle {
  animation: gentleBounce 2s ease-in-out infinite !important;
}

@keyframes gentleBounce {
  0%, 100% { transform: scale(1) translateY(0); }
  50% { transform: scale(1.05) translateY(-1px); }
}
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
        .play-icon {
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
