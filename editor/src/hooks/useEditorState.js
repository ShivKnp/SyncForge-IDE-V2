// src/hooks/useEditorState.js
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import ReconnectingWebSocket from 'reconnecting-websocket';
import ShareDB from 'sharedb/lib/client';
import { notification } from 'antd';
import { v4 as uuidv4 } from 'uuid';
import StringBinding from '../lib/StringBinding';
import JSZip from 'jszip';

const SERVER_URL = process.env.REACT_APP_SERVER_URL || 'http://localhost:8080';
const WEBSOCKET_URL = process.env.REACT_APP_WEB_SOCKET_URL || 'ws://localhost:8080';

/**
 * useEditorState
 */
const useEditorState = (id, userName) => {
  const navigate = useNavigate();

  const prefsKey = (roomId, user) => `codecrew:prefs:${roomId}:${user}`;
  const loadPrefs = (roomId, user) => {
    try {
      const raw = sessionStorage.getItem(prefsKey(roomId, user));
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  };
  const savePrefs = (roomId, user, prefs) => {
    try { sessionStorage.setItem(prefsKey(roomId, user), JSON.stringify(prefs)); } catch (e) {}
  };

  const [state, setState] = useState({
    files: {},
    activeFileId: null,
    input: '',
    output: '',
    lang: 'cpp',
    runCodeDisabled: false,
    isLoading: true,
    theme: 'vs-dark',
    fontSize: 14,
    userName,
    roomMode: 'project',
    projectLanguage: 'cpp',
    config: null,
    isHost: false,
    tree: {},
    contents: {},
    selectedNodeId: 'root',
    terminalVisible: false,
    editor: null,
    monaco: null,
    binding: null,
    docLoaded: false,
    whiteboards: {},
    whiteboardConfig: {},
    
  });

  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const docRef = useRef(null);
  const bindingRef = useRef(null);
  const connectionRef = useRef(null);
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const localPresenceRef = useRef(null);
  const autosaveTimerRef = useRef(null);
  const previousConfigRef = useRef(null);
  const wsRef = useRef(null); // track websocket used for ShareDB

  const [pendingOperations, setPendingOperations] = useState([]);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [currentPendingOp, setCurrentPendingOp] = useState(null);

  const [editorTheme, setEditorTheme] = useState('vs-dark');
  const [fontFamily, setFontFamily] = useState('Monaco, Menlo, "Ubuntu Mono", monospace');
  const [editorFontSize, setEditorFontSize] = useState(14);

  const checkForDuplicate = (parentId, name, type) => {
    const parentNode = stateRef.current.tree[parentId];
    if (!parentNode || !parentNode.children) return false;
    return parentNode.children.some(childId => {
      const child = stateRef.current.tree[childId];
      return child && child.name === name && child.type === type;
    });
  };

  useEffect(() => {
    if (!userName) {
      notification.warning({ message: 'Please enter a name to join the session.' });
      navigate(`/lobby/${id}`);
    }
  }, [userName, id, navigate]);

  const setEditorLanguage = (monacoInstance, model, langKey) => {
    if (!monacoInstance || !model) return;
    try {
      const langMap = { cpp: 'cpp', python: 'python', java: 'java' };
      const monacoLang = langMap[langKey] || 'cpp';
      monacoInstance.editor.setModelLanguage(model, monacoLang);
    } catch (e) {
      console.warn('Failed to set Monaco language', e);
    }
  };

  const [hosts, setHosts] = useState(new Set());

  const updateStateFromDoc = (doc) => {
    if (!doc || !doc.data) return;
    const { tree, contents, input, output, lang: docLang, roomMode, projectLanguage, config, whiteboards, whiteboardConfig, } = doc.data;
    const effectiveConfig = config || {};
    const effectiveConfigWithDefaults = {
    enableAI: true,
    ...effectiveConfig
  };
    const effectiveRoomMode = effectiveConfig.roomMode || roomMode || stateRef.current.roomMode || 'project';
    const effectiveProjectLanguage = effectiveConfig.projectLanguage || projectLanguage || docLang || stateRef.current.projectLanguage || 'cpp';
    const sharedIO = (typeof effectiveConfig.sharedInputOutput === 'boolean') ? effectiveConfig.sharedInputOutput : (effectiveRoomMode === 'project');

    const hostNames = effectiveConfig.hosts || [];
    if (effectiveConfig.ownerName && !hostNames.includes(effectiveConfig.ownerName)) {
      hostNames.push(effectiveConfig.ownerName);
    }
    const isHost = hostNames.includes(stateRef.current.userName);

    const updatedFiles = {};
    const fileNodes = Object.values(tree || {}).filter(n => n && n.type === 'file');
    fileNodes.forEach(node => {
      updatedFiles[node.id] = { name: node.name, content: contents[node.id] || '' };
    });

    setState(s => ({
    ...s,
    tree: tree || {},
    contents: contents || {},
    files: updatedFiles,
    input: sharedIO ? (input || '') : s.input,
    output: sharedIO ? (output || '') : s.output,
    lang: (effectiveRoomMode === 'project') ? effectiveProjectLanguage : s.lang,
    roomMode: effectiveRoomMode,
    projectLanguage: effectiveProjectLanguage,
    config: effectiveConfigWithDefaults, // CHANGED: Use config with defaults
    isHost,
    hosts: new Set(hostNames),
    whiteboards: whiteboards || {},
      whiteboardConfig: whiteboardConfig || {}
  }));
  };

  const waitForDocTreeKey = (key, timeoutMs = 2000) => {
    return new Promise((resolve) => {
      const start = Date.now();
      const check = () => {
        const doc = docRef.current;
        if (doc && doc.data && doc.data.tree && doc.data.tree[key]) return resolve(true);
        if (Date.now() - start > timeoutMs) return resolve(false);
        setTimeout(check, 50);
      };
      check();
    });
  };

  const saveActiveEditorContent = async () => {
    try {
      const curState = stateRef.current;
      const activeId = curState.activeFileId;
      if (!activeId || !docRef.current) return;
      const editor = editorRef.current;
      let currentText = '';
      if (editor && editor.getModel) {
        const model = editor.getModel();
        if (model) currentText = model.getValue();
      } else {
        currentText = (docRef.current.data && docRef.current.data.contents && docRef.current.data.contents[activeId]) || '';
      }

      const existing = (docRef.current.data && docRef.current.data.contents && docRef.current.data.contents[activeId]) || '';
      if (existing === currentText) return;
      safeSubmitOp([{ p: ['contents', activeId], oi: currentText }], { source: 'autosave' });
    } catch (e) {
      console.warn('saveActiveEditorContent failed', e);
    }
  };

  // safe submit helper
  const safeSubmitOp = (ops, meta) => {
    try {
      if (docRef.current && docRef.current.type) docRef.current.submitOp(ops, meta);
      else console.warn('safeSubmitOp: no doc or doc has no type', ops);
    } catch (e) {
      console.warn('safeSubmitOp failed', e, ops);
    }
  };

  // Consolidated ShareDB + websocket setup with proper cleanup
  useEffect(() => {
    // guard
    if (!id || !userName) return;

   // Create websocket and shareDB connection
    const ws = new ReconnectingWebSocket(`${WEBSOCKET_URL}/sharedb`);
    wsRef.current = ws;
    connectionRef.current = new ShareDB.Connection(ws);
    docRef.current = connectionRef.current.get('examples', id);

    // unified message handler (single listener)
    const onWsMessage = (evt) => {
      let msg;
      try { msg = JSON.parse(evt.data); } catch (e) { return; }

      // Accept both legacy 'kick' and 'kicked'
      if (msg && (msg.type === 'kick' || msg.type === 'kicked')) {
        const amTargetedByName = msg.target && stateRef.current && (msg.target === stateRef.current.userName);
        const amTargetedByPeer = msg.peerId && (msg.peerId === (stateRef.current.peerId || msg.peerId));
        if (amTargetedByName || amTargetedByPeer) {
          notification.error({ message: 'You were removed from the session', description: msg.reason || 'Removed by host' });
          try { if (bindingRef.current && typeof bindingRef.current.detach === 'function') bindingRef.current.detach(); } catch (e) {}
          try { if (localPresenceRef.current && typeof localPresenceRef.current.destroy === 'function') localPresenceRef.current.destroy(); } catch (e) {}
          try { if (docRef.current && typeof docRef.current.unsubscribe === 'function') docRef.current.unsubscribe(); } catch (e) {}
          try { if (connectionRef.current) connectionRef.current.close(); } catch (e) {}
          try { if (wsRef.current) wsRef.current.close(); } catch (e) {}
          navigate('/');
        }
      }
      

      // other server messages can be handled here
    };

    ws.addEventListener('message', onWsMessage);

    // subscribe to doc
    docRef.current.subscribe((err) => {
      if (err) {
        notification.error({ message: 'Failed to connect to session.' });
        setState(s => ({ ...s, isLoading: false }));
        return;
      }
      if (!docRef.current.type) {
        setState(s => ({ ...s, isLoading: false, docLoaded: false }));
        return;
      }

      // initial doc handling (mirrors earlier logic)
      try {
        const { tree, contents, input, output, lang: docLang, roomMode: docRoomMode, projectLanguage, config } = docRef.current.data || {};
        const effectiveConfig = config || {};
        const effectiveRoomMode = effectiveConfig.roomMode || docRoomMode || stateRef.current.roomMode || 'project';
        const effectiveProjectLanguage = effectiveConfig.projectLanguage || projectLanguage || docLang || stateRef.current.projectLanguage || 'cpp';
        const sharedIO = (typeof effectiveConfig.sharedInputOutput === 'boolean') ? effectiveConfig.sharedInputOutput : (effectiveRoomMode === 'project');

        const hostNames = effectiveConfig.hosts || [];
        if (effectiveConfig.ownerName && !hostNames.includes(effectiveConfig.ownerName)) {
          hostNames.push(effectiveConfig.ownerName);
        }
        const isHost = hostNames.includes(userName);

        // presence
        try {
          const presence = connectionRef.current.getPresence(`presence-${id}`);
          presence.subscribe();
          const localPresence = presence.create();
          localPresence.submit({ name: userName, editingFile: docRef.current.data?.activeFileId || null });
          localPresenceRef.current = localPresence;
        } catch (e) {
          console.warn('presence setup failed', e);
          localPresenceRef.current = null;
        }

        // initial binding if docActiveFileId present
        let binding = null;
        const docActiveFileId = docRef.current.data?.activeFileId || null;
        if (docActiveFileId) {
          try {
            binding = new StringBinding(docRef.current, ['contents', docActiveFileId], localPresenceRef.current);
            bindingRef.current = binding;
          } catch (e) {
            console.warn('initial binding create failed', e);
            bindingRef.current = null;
          }
        }

        const fileNodes = Object.values(tree || {}).filter(n => n && n.type === 'file');
        const updatedFiles = {};
        fileNodes.forEach(node => {
          updatedFiles[node.id] = { name: node.name, content: contents[node.id] || '' };
        });

        const localPrefs = loadPrefs(id, userName) || {};
        const initialLang = (effectiveRoomMode === 'project') ? effectiveProjectLanguage : (localPrefs.lang || stateRef.current.lang);
        const initialInput = sharedIO ? (input || '') : (localPrefs.input || stateRef.current.input);

        setState(s => ({
          ...s,
          tree: tree || {},
          contents: contents || {},
          files: updatedFiles,
          input: initialInput,
          output: sharedIO ? (output || '') : s.output,
          projectLanguage: effectiveProjectLanguage,
          roomMode: effectiveRoomMode,
          config: effectiveConfig,
          isHost,
          activeFileId: docActiveFileId || (fileNodes.length > 0 ? fileNodes[0].id : null),
          binding,
          lang: initialLang,
          isLoading: false,
          docLoaded: true
        }));

        previousConfigRef.current = JSON.stringify(effectiveConfig || {});
        if (binding && editorRef.current) {
          try { binding.attach(editorRef.current); } catch (e) { console.warn('binding.attach failed in subscribe', e); }
        }

        if (monacoRef.current && editorRef.current && docActiveFileId && effectiveRoomMode === 'project') {
          const model = editorRef.current.getModel();
          if (model) setEditorLanguage(monacoRef.current, model, effectiveProjectLanguage);
        }
      } catch (e) {
        console.error('Error in doc subscribe handler', e);
      }
    });

    // op listener
    const onDocOp = (op, source) => {
      if (source === bindingRef.current) return;
      try {
        updateStateFromDoc(docRef.current);
        const newConfigObj = (docRef.current && docRef.current.data && docRef.current.data.config) ? docRef.current.data.config : null;
        const newConfigJson = JSON.stringify(newConfigObj || {});
        const prevConfigJson = previousConfigRef.current || JSON.stringify(stateRef.current.config || {});
        if (prevConfigJson !== newConfigJson) {
          previousConfigRef.current = newConfigJson;
          try {
            const prev = JSON.parse(prevConfigJson || '{}');
            const curr = newConfigObj || {};
            const changes = [];
            const keysToCheck = new Set([...Object.keys(prev), ...Object.keys(curr)]);
            keysToCheck.forEach((k) => {
              if (JSON.stringify(prev[k]) !== JSON.stringify(curr[k])) changes.push(`${k}: ${String(prev[k])} → ${String(curr[k])}`);
            });
            const msg = (changes.length > 0) ? `Host updated room settings: ${changes.join('; ')}` : 'Host updated room settings.';
            notification.info({ message: msg, duration: 4 });
          } catch (e) {
            notification.info({ message: 'Host updated room settings.', duration: 4 });
          }
        }
      } catch (e) {
        console.warn('onDocOp handler error', e);
      }
    };

    docRef.current.on('op', onDocOp);

    // CLEANUP
    return () => {
      try { docRef.current?.off && docRef.current.off('op', onDocOp); } catch (e) {}
      try { wsRef.current?.removeEventListener('message', onWsMessage); } catch (e) {}
      // detach binding
      try { if (bindingRef.current && typeof bindingRef.current.detach === 'function') bindingRef.current.detach(); } catch (e) {}
      // destroy local presence
      try { if (localPresenceRef.current && typeof localPresenceRef.current.destroy === 'function') localPresenceRef.current.destroy(); } catch (e) {}
      // unsubscribe presence if possible
      try {
        const presence = connectionRef.current?.getPresence && connectionRef.current.getPresence(`presence-${id}`);
        presence?.unsubscribe && presence.unsubscribe();
      } catch (e) {}
      // unsubscribe doc
      try { docRef.current && typeof docRef.current.unsubscribe === 'function' && docRef.current.unsubscribe(); } catch (e) {}
      // close connection and websocket
      try { if (connectionRef.current) connectionRef.current.close(); } catch (e) {}
      try { if (wsRef.current) wsRef.current.close(); } catch (e) {}
      // clear refs
      bindingRef.current = null;
      localPresenceRef.current = null;
      docRef.current = null;
      connectionRef.current = null;
      wsRef.current = null;
    };
  }, [id, userName, navigate]);

  useEffect(() => {
    autosaveTimerRef.current = setInterval(() => {
      saveActiveEditorContent();
    }, 5000);

    const beforeunload = () => {
      saveActiveEditorContent();
    };
    window.addEventListener('beforeunload', beforeunload);

    return () => {
      clearInterval(autosaveTimerRef.current);
      window.removeEventListener('beforeunload', beforeunload);
    };
  }, []);

  const handleSaveToWorkspace = async () => {
    if (!stateRef.current?.docLoaded) {
      notification.error({ message: 'Document not loaded yet.' });
      return false;
    }
    try {
      await saveActiveEditorContent();

      notification.info({ message: 'Saving to workspace...', duration: 1.5 });
      const resp = await axios.post(`${SERVER_URL}/session/${id}/export`);
      if (!resp || !resp.data || resp.data.ok !== true) {
        console.error('Export response:', resp?.data);
        notification.error({ message: 'Export failed: ' + (resp?.data?.error || 'unknown') });
        return false;
      }
      notification.success({ message: 'Workspace saved successfully!' });
      return true;
    } catch (err) {
      console.error('handleSaveToWorkspace error', err);
      notification.error({ message: 'Failed to save workspace.' });
      return false;
    }
  };

  const openTerminalInWorkspace = async () => {
    setState(s => ({ ...s, terminalVisible: true }));
    const ok = await handleSaveToWorkspace();
    if (!ok) {
      const useSharedIO = (() => {
        const cfg2 = stateRef.current.config;
        if (cfg2 && typeof cfg2.sharedInputOutput === 'boolean') return cfg2.sharedInputOutput;
        return stateRef.current.roomMode === 'project';
      })();

      const errorMsg = 'Failed to save workspace. Some features may be unavailable.';
      if (useSharedIO && docRef.current) {
        try { docRef.current.submitOp([{ p: ['output'], oi: errorMsg }]); } catch (e) {}
      } else {
        setState(s => ({ ...s, output: errorMsg }));
      }
    }
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem('editor-theme');
    const savedFontFamily = localStorage.getItem('editor-font-family');
    const savedFontSize = localStorage.getItem('editor-font-size');

    if (savedTheme) {
      setState(s => ({ ...s, theme: savedTheme }));
    }
    if (savedFontFamily) {
      setState(s => ({ ...s, fontFamily: savedFontFamily }));
    }
    if (savedFontSize) {
      setState(s => ({ ...s, fontSize: parseInt(savedFontSize) })); // keep backward-compatible
    }
  }, []);

  const actions = {
    editorDidMount: (editor, monaco) => {
      editorRef.current = editor;
      monacoRef.current = monaco;
      setState(s => ({ ...s, editor, monaco }));

      const binding = bindingRef.current;
      if (binding) {
        try { binding.attach(editor); } catch (e) { console.warn('binding.attach failed in editorDidMount', e); }
      }

      const curLang = stateRef.current.projectLanguage || stateRef.current.lang;
      if (curLang) {
        const model = editor.getModel();
        if (model) setEditorLanguage(monaco, model, curLang);
      }

      try {
        editor.onDidFocusEditorText(() => {
          if (localPresenceRef.current) {
            localPresenceRef.current.submit({ editingFile: stateRef.current.activeFileId || null, name: stateRef.current.userName });
          }
        });
        editor.onDidBlurEditorText(() => {
          if (localPresenceRef.current) {
            localPresenceRef.current.submit({ editingFile: null, name: stateRef.current.userName });
          }
        });
      } catch (e) { /* ignore */ }
    },

    editorOnChange: (newValue) => {
      // binding handles updates
    },

    uploadFiles: async (files) => {
      if (!stateRef.current.docLoaded || !docRef.current) return;

      const cfg = stateRef.current.config || {};
      const editingHostOnly = cfg.editing === 'host-only';
      const allowFileCreation = (typeof cfg.allowFileCreation === 'boolean') ? cfg.allowFileCreation : true;

      if (editingHostOnly && !stateRef.current.isHost) {
        return notification.warning({ message: 'Only the host can upload files.' });
      }
      if (!allowFileCreation) {
        return notification.warning({ message: 'File creation is disabled for this room.' });
      }

      try {
        await saveActiveEditorContent();

        const parentId = 'root';
        const parentNode = docRef.current.data.tree[parentId];
        if (!parentNode) return notification.error({ message: "Root directory not found." });

        const ops = [];
        // make a local copy to update children counts for ordering
        const localTree = { ...stateRef.current.tree };
        localTree[parentId] = { ...(localTree[parentId] || {}), children: [...(localTree[parentId]?.children || [])] };

        for (const file of files) {
          const reader = new FileReader();
          const fileContent = await new Promise((resolve) => {
            reader.onload = (e) => resolve(e.target.result);
            reader.readAsText(file);
          });

          const newFileId = uuidv4();
          const fileName = file.name;

          ops.push(
            { p: ['tree', newFileId], oi: { id: newFileId, parentId, name: fileName, type: 'file' } },
            { p: ['contents', newFileId], oi: fileContent }
          );

          const idx = localTree[parentId].children.length;
          if (idx > 0) {
            ops.push({ p: ['tree', parentId, 'children', idx], li: newFileId });
          } else {
            ops.push({ p: ['tree', parentId, 'children'], oi: [newFileId] });
          }
          localTree[parentId].children.push(newFileId);
        }

        safeSubmitOp(ops, { source: 'uploadFiles' });
        notification.success({ message: `Uploaded ${files.length} file(s)` });

      } catch (e) {
        console.error('File upload error', e);
        notification.error({ message: 'Failed to upload files.' });
      }
    },

    uploadZip: async (zipFile) => {
      if (!stateRef.current.docLoaded || !docRef.current) return;

      const cfg = stateRef.current.config || {};
      const editingHostOnly = cfg.editing === 'host-only';

      if (editingHostOnly && !stateRef.current.isHost) {
        return notification.warning({ message: 'Only hosts can upload ZIP files.' });
      }

      try {
        await saveActiveEditorContent();

        const zip = new JSZip();
        const zipContent = await zip.loadAsync(zipFile);
        const ops = [];

        const localTree = { ...(stateRef.current.tree || {}) };

        const findChildByName = (parentId, name, type) => {
          const p = localTree[parentId];
          if (!p || !Array.isArray(p.children)) return null;
          for (const cid of p.children) {
            const child = localTree[cid];
            if (child && child.name === name && child.type === type) return cid;
          }
          return null;
        };

        const ensureFolderPath = (segments) => {
          let currentParent = 'root';
          for (const seg of segments) {
            if (!seg) continue;
            let found = findChildByName(currentParent, seg, 'folder');
            if (found) {
              currentParent = found;
              continue;
            }
            const newFolderId = uuidv4();
            const folderNode = { id: newFolderId, parentId: currentParent, name: seg, type: 'folder', children: [] };
            ops.push({ p: ['tree', newFolderId], oi: folderNode });
            const parentChildren = localTree[currentParent]?.children || [];
            if (parentChildren.length > 0) {
              ops.push({ p: ['tree', currentParent, 'children', parentChildren.length], li: newFolderId });
              localTree[currentParent] = { ...(localTree[currentParent] || {}), children: [...parentChildren, newFolderId] };
            } else {
              ops.push({ p: ['tree', currentParent, 'children'], oi: [newFolderId] });
              localTree[currentParent] = { ...(localTree[currentParent] || {}), children: [newFolderId] };
            }
            localTree[newFolderId] = folderNode;
            currentParent = newFolderId;
          }
          return currentParent;
        };

        const entries = [];
        zipContent.forEach((relativePath, entry) => {
          entries.push({ relativePath, entry });
        });

        for (const { relativePath, entry } of entries) {
          if (relativePath.includes('__MACOSX/') || relativePath.includes('/._') || relativePath.endsWith('/.DS_Store') || relativePath.startsWith('.')) {
            continue;
          }
          if (entry.dir) {
            const parts = relativePath.split('/').filter(Boolean);
            ensureFolderPath(parts);
            continue;
          }

          const parts = relativePath.split('/').filter(Boolean);
          const fileName = parts.pop();
          const folderId = parts.length > 0 ? ensureFolderPath(parts) : 'root';

          const duplicate = findChildByName(folderId, fileName, 'file');
          if (duplicate) {
            console.warn('Skipping duplicate file from zip:', relativePath);
            continue;
          }

          try {
            const content = await entry.async('text');
            const newFileId = uuidv4();
            ops.push({ p: ['tree', newFileId], oi: { id: newFileId, parentId: folderId, name: fileName, type: 'file' } });
            ops.push({ p: ['contents', newFileId], oi: content });

            const parentChildren = localTree[folderId]?.children || [];
            if (parentChildren.length > 0) {
              ops.push({ p: ['tree', folderId, 'children', parentChildren.length], li: newFileId });
              localTree[folderId] = { ...(localTree[folderId] || {}), children: [...parentChildren, newFileId] };
            } else {
              ops.push({ p: ['tree', folderId, 'children'], oi: [newFileId] });
              localTree[folderId] = { ...(localTree[folderId] || {}), children: [newFileId] };
            }
            localTree[newFileId] = { id: newFileId, parentId: folderId, name: fileName, type: 'file' };
          } catch (readErr) {
            console.warn('Skipping binary or unreadable file in ZIP:', relativePath, readErr);
          }
        }

        if (ops.length > 0) {
          safeSubmitOp(ops, { source: 'uploadZip' });
          notification.success({ message: 'ZIP uploaded and folder structure created' });
        } else {
          notification.info({ message: 'No new files created from ZIP' });
        }
      } catch (e) {
        console.error('ZIP upload error', e);
        notification.error({ message: 'Failed to upload ZIP file' });
      }
    },

    approveOperation: (operation) => {
      if (stateRef.current.isHost && operation && docRef.current) {
        try {
          if (operation.ops) safeSubmitOp(operation.ops, { source: 'approvedOperation' });
          setPendingOperations(prev => prev.filter(op => op !== operation));
          notification.success({ message: 'Operation approved' });
        } catch (e) {
          console.error('approveOperation failed', e);
        }
      }
    },

    rejectOperation: (operation) => {
      if (stateRef.current.isHost && operation) {
        setPendingOperations(prev => prev.filter(op => op !== operation));
        notification.info({ message: 'Operation rejected' });
      }
    },

    promoteToHost: (userNameToPromote) => {
      if (!stateRef.current.isHost || !docRef.current) return;
      const currentHosts = new Set(stateRef.current.config?.hosts || []);
      currentHosts.add(userNameToPromote);
      const newConfig = {
        ...stateRef.current.config,
        hosts: Array.from(currentHosts),
        ownerName: stateRef.current.config?.ownerName || stateRef.current.userName
      };
      try {
        safeSubmitOp([{ p: ['config'], oi: newConfig }], { source: 'promoteToHost' });
        notification.success({ message: `${userNameToPromote} is now a host` });
      } catch (e) {
        console.error('promoteToHost failed', e);
      }
    },

    kickParticipant: async (userToKick, peerId) => {
      if (!stateRef.current.isHost) {
        notification.warning({ message: 'Only hosts can remove participants.' });
        return false;
      }

      notification.info({ message: `Removing ${userToKick}...` });

      try {
        const serverUrl = SERVER_URL.replace(/\/$/, '');
        const resp = await axios.post(`${serverUrl}/session/${encodeURIComponent(id)}/kick`, { peerId }, {
          headers: { 'Content-Type': 'application/json' },
        });

        if (!resp || !resp.data || resp.data.ok !== true) {
          throw new Error(resp?.data?.error || 'Server rejected kick');
        }

        notification.success({ message: `Kicked ${userToKick}` });

      } catch (httpErr) {
        console.warn('kickParticipant: HTTP kick failed, falling back to ws signalling', httpErr);

        // Fallback: use wsRef first, then connectionRef.ws
        try {
          const msg = { type: 'kick', target: userToKick, peerId, sessionId: id, from: stateRef.current.userName, timestamp: Date.now() };
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(msg));
          } else if (connectionRef.current && connectionRef.current.ws && connectionRef.current.ws.readyState === WebSocket.OPEN) {
            connectionRef.current.ws.send(JSON.stringify(msg));
          } else {
            throw new Error('No open websocket available for fallback kick');
          }
        } catch (e) {
          console.error('kickParticipant fallback error', e);
          notification.error({ message: 'Failed to kick participant' });
          return false;
        }

        notification.success({ message: `Requested kick for ${userToKick} (fallback)` });
      }

      // If kicked user was host, remove them from hosts list in config
      try {
        const currentHosts = new Set(stateRef.current.config?.hosts || []);
        if (currentHosts.has(userToKick)) {
          currentHosts.delete(userToKick);
          const newConfig = { ...stateRef.current.config, hosts: Array.from(currentHosts) };
          if (docRef.current && docRef.current.type) {
            safeSubmitOp([{ p: ['config'], oi: newConfig }], { source: 'kickHost' });
          } else {
            setState(s => ({ ...s, config: newConfig }));
          }
        }
      } catch (e) {
        console.warn('kickParticipant: failed to update host list in config', e);
      }

      return true;
    },

    createNewFile: async (parentId, name) => {
      if (!stateRef.current.docLoaded || !docRef.current) return;
      const cfg = stateRef.current.config || {};
      const editingHostOnly = cfg.editing === 'host-only';
      const allowFileCreation = (typeof cfg.allowFileCreation === 'boolean') ? cfg.allowFileCreation : true;
      if (editingHostOnly && !stateRef.current.isHost) return notification.warning({ message: 'Only the host can create files.' });
      if (!allowFileCreation) return notification.warning({ message: 'File creation is disabled for this room.' });

      try {
        await saveActiveEditorContent();

        const validParent = parentId && stateRef.current.tree[parentId] && stateRef.current.tree[parentId].type === 'folder' ? parentId : (stateRef.current.selectedNodeId && stateRef.current.tree[stateRef.current.selectedNodeId]?.type === 'folder' ? stateRef.current.selectedNodeId : 'root');
        const parentNode = docRef.current.data.tree[validParent];
        if (!parentNode) return notification.error({ message: "Parent directory not found." });

        const duplicate = Object.values(stateRef.current.tree || {}).some(n => n.parentId === validParent && n.name === name);
        if (duplicate) return notification.warning({ message: 'A file with this name already exists in this folder.' });

        const newFileId = uuidv4();
        const children = parentNode.children || [];

        const ops = [
          { p: ['tree', newFileId], oi: { id: newFileId, parentId: validParent, name, type: 'file' } },
          { p: ['contents', newFileId], oi: '' }
        ];
        if (children.length > 0) {
          ops.push({ p: ['tree', validParent, 'children', children.length], li: newFileId });
        } else {
          ops.push({ p: ['tree', validParent, 'children'], oi: [newFileId] });
        }

        safeSubmitOp(ops, { source: 'createNewFile' });

        const ok = await waitForDocTreeKey(newFileId, 2000);
        if (ok) {
          try {
            if (bindingRef.current && typeof bindingRef.current.updatePath === 'function') {
              bindingRef.current.updatePath(['contents', newFileId]);
              setState(s => ({ ...s, activeFileId: newFileId }));
            } else {
              const presence = connectionRef.current.getPresence(`presence-${id}`);
              presence.subscribe();
              const localPresence = presence.create();
              localPresence.submit({ name: stateRef.current.userName, editingFile: newFileId });
              localPresenceRef.current = localPresence;
              const newBinding = new StringBinding(docRef.current, ['contents', newFileId], localPresenceRef.current);
              bindingRef.current = newBinding;
              setState(s => ({ ...s, binding: newBinding, activeFileId: newFileId }));
              if (editorRef.current) newBinding.attach(editorRef.current);
            }
          } catch (attachErr) {
            console.warn('createNewFile attach failed', attachErr);
            setState(s => ({ ...s, activeFileId: newFileId }));
          }
        } else {
          setState(s => ({ ...s, activeFileId: newFileId }));
        }
      } catch (e) {
        console.error('createNewFile error', e);
        notification.error({ message: 'Failed to create file' });
      }
    },

    createFolder: async (parentId, name) => {
      if (!stateRef.current.docLoaded || !docRef.current) return;
      const cfg = stateRef.current.config || {};
      const editingHostOnly = cfg.editing === 'host-only';
      const allowFileCreation = (typeof cfg.allowFileCreation === 'boolean') ? cfg.allowFileCreation : true;
      if (editingHostOnly && !stateRef.current.isHost) return notification.warning({ message: 'Only the host can create folders.' });
      if (!allowFileCreation) return notification.warning({ message: 'Folder creation is disabled for this room.' });

      try {
        const finalParentId = parentId && stateRef.current.tree[parentId]?.type === 'folder' ? parentId : stateRef.current.selectedNodeId || 'root';
        const parentNode = docRef.current.data.tree[finalParentId];
        if (!parentNode) return notification.error({ message: "Parent directory not found." });

        const duplicate = Object.values(stateRef.current.tree || {}).some(n => n.parentId === finalParentId && n.name === name && n.type === 'folder');
        if (duplicate) return notification.warning({ message: 'A folder with this name already exists in this folder.' });

        const newFolderId = uuidv4();
        const children = parentNode.children || [];
        const ops = [
          { p: ['tree', newFolderId], oi: { id: newFolderId, parentId: finalParentId, name, type: 'folder', children: [] } },
        ];
        if (children.length > 0) {
          ops.push({ p: ['tree', finalParentId, 'children', children.length], li: newFolderId });
        } else {
          ops.push({ p: ['tree', finalParentId, 'children'], oi: [newFolderId] });
        }

        safeSubmitOp(ops, { source: 'createFolder' });
        notification.success({ message: `Folder '${name}' created.` });
      } catch (e) {
        console.error('createFolder error', e);
        notification.error({ message: 'Failed to create folder' });
      }
    },

    handleTabChange: async (fileId) => {
      setState(prev => ({ ...prev, activeFileId: fileId }));

      try {
        if (docRef.current && docRef.current.type) {
          safeSubmitOp([{ p: ['activeFileId'], oi: fileId }], { source: 'tab-change' });
        }
      } catch (e) {
        console.warn('persist activeFileId failed', e);
      }

      try {
        if (!docRef.current) return;

        try {
          if (!localPresenceRef.current) {
            const presence = connectionRef.current.getPresence(`presence-${id}`);
            presence.subscribe();
            const localPresence = presence.create();
            localPresence.submit({ name: stateRef.current.userName, editingFile: fileId });
            localPresenceRef.current = localPresence;
          } else {
            try { localPresenceRef.current.submit({ editingFile: fileId, name: stateRef.current.userName }); } catch (e) {}
          }
        } catch (e) {}

        if (bindingRef.current && typeof bindingRef.current.updatePath === 'function') {
          bindingRef.current.updatePath(['contents', fileId]);
        } else {
          const newBinding = new StringBinding(docRef.current, ['contents', fileId], localPresenceRef.current);
          bindingRef.current = newBinding;
          setState(s => ({ ...s, binding: newBinding }));
          if (editorRef.current) {
            try { newBinding.attach(editorRef.current); } catch (e) { console.warn('attach binding failed', e); }
          }
        }
      } catch (e) {
        console.warn('handleTabChange binding logic failed', e);
      }
    },

    handleFileClose: (fileId) => {
      if (!stateRef.current.docLoaded || Object.keys(stateRef.current.files).length <= 1) return notification.warning({ message: 'Cannot close the last file.' });

      const { parentId } = stateRef.current.tree[fileId] || {};
      const parentNode = stateRef.current.tree[parentId];
      if (!parentNode || !parentNode.children) return;

      const children = parentNode.children;
      const childIndex = children.indexOf(fileId);

      const ops = [
        { p: ['tree', parentId, 'children', childIndex], ld: fileId },
        { p: ['tree', fileId], od: stateRef.current.tree[fileId] },
        { p: ['contents', fileId], od: stateRef.current.contents[fileId] }
      ];
      try { safeSubmitOp(ops, { source: 'closeFile' }); } catch (e) { console.warn('handleFileClose submit failed', e); }

      const nextFileId = children.find(id => id !== fileId) || stateRef.current.activeFileId;
      if (stateRef.current.activeFileId === fileId) {
        actions.handleTabChange(nextFileId);
      }
    },

    renameNode: async (nodeId, newName) => {
      if (!stateRef.current.docLoaded || !newName || !newName.trim()) return;
      const cfg = stateRef.current.config || {};
      const editingHostOnly = cfg.editing === 'host-only';
      if (editingHostOnly && !stateRef.current.isHost) return notification.warning({ message: 'Only the host can rename files/folders.' });

      try {
        await saveActiveEditorContent();
        safeSubmitOp([{ p: ['tree', nodeId, 'name'], oi: newName.trim() }], { source: 'renameNode' });
      } catch (e) {
        console.warn('renameNode failed', e);
      }
    },

    deleteNode: async (nodeId) => {
      if (!stateRef.current.docLoaded || !docRef.current) return;
      const node = stateRef.current.tree[nodeId];
      if (!node) return;
      const cfg = stateRef.current.config || {};
      const editingHostOnly = cfg.editing === 'host-only';
      if (editingHostOnly && !stateRef.current.isHost) return notification.warning({ message: 'Only the host can delete files/folders.' });

      try {
        await saveActiveEditorContent();

        const ops = [];
        const collectDeletes = (id) => {
          const nd = stateRef.current.tree[id];
          if (!nd) return;
          if (nd.type === 'file') {
            ops.push({ p: ['contents', id], od: stateRef.current.contents[id] || '' });
            ops.push({ p: ['tree', id], od: stateRef.current.tree[id] });
          } else if (nd.type === 'folder') {
            const children = nd.children ? [...nd.children] : [];
            children.forEach(childId => collectDeletes(childId));
            ops.push({ p: ['tree', id], od: stateRef.current.tree[id] });
          }
        };

        collectDeletes(nodeId);

        const parent = stateRef.current.tree[node.parentId];
        if (parent && Array.isArray(parent.children)) {
          const idx = parent.children.indexOf(nodeId);
          if (idx > -1) {
            ops.push({ p: ['tree', node.parentId, 'children', idx], ld: nodeId });
          }
        }

        if (ops.length > 0) safeSubmitOp(ops, { source: 'deleteNode' });
      } catch (e) {
        console.error('deleteNode error', e);
      }
    },

  moveNode: async (sourceNodeId, targetNodeId) => {
  console.log('moveNode called:', { sourceNodeId, targetNodeId });
  
  if (!stateRef.current.docLoaded || !docRef.current) {
    console.log('Document not loaded or no docRef');
    return;
  }
  
  const cfg = stateRef.current.config || {};
  const editingHostOnly = cfg.editing === 'host-only';
  
  if (editingHostOnly && !stateRef.current.isHost) {
    console.log('User not authorized to move nodes');
    return notification.warning({ message: 'Only the host can move files/folders.' });
  }

  try {
    await saveActiveEditorContent();

    const sourceNode = stateRef.current.tree[sourceNodeId];
    const targetNode = stateRef.current.tree[targetNodeId];
    
    if (!sourceNode) {
      return notification.error({ message: 'Source item not found.' });
    }
    
    if (!targetNode || targetNode.type !== 'folder') {
      return notification.error({ message: 'Can only move items into folders.' });
    }

    // Prevent moving a folder into itself or its descendants
    const isDescendant = (tree, ancestorId, descendantId) => {
      const node = tree[ancestorId];
      if (!node || !node.children) return false;
      
      if (node.children.includes(descendantId)) return true;
      
      for (const childId of node.children) {
        if (isDescendant(tree, childId, descendantId)) return true;
      }
      
      return false;
    };

    if (sourceNode.type === 'folder' && isDescendant(stateRef.current.tree, sourceNodeId, targetNodeId)) {
      return notification.error({ message: 'Cannot move a folder into itself or its subfolders.' });
    }

    // Check for duplicate names in target folder
    const existingNames = (targetNode.children || []).map(childId => {
      const child = stateRef.current.tree[childId];
      return child ? child.name : null;
    }).filter(Boolean);

    if (existingNames.includes(sourceNode.name)) {
      return notification.error({ 
        message: `A ${sourceNode.type} with name "${sourceNode.name}" already exists in the target folder.` 
      });
    }

    const ops = [];

    // Remove from current parent
    const currentParent = stateRef.current.tree[sourceNode.parentId];
    if (currentParent && Array.isArray(currentParent.children)) {
      const currentIndex = currentParent.children.indexOf(sourceNodeId);
      if (currentIndex > -1) {
        ops.push({ 
          p: ['tree', sourceNode.parentId, 'children', currentIndex], 
          ld: sourceNodeId 
        });
      }
    }

    // Add to new parent
    const targetChildren = targetNode.children || [];
    if (targetChildren.length > 0) {
      ops.push({ 
        p: ['tree', targetNodeId, 'children', targetChildren.length], 
        li: sourceNodeId 
      });
    } else {
      ops.push({ 
        p: ['tree', targetNodeId, 'children'], 
        oi: [sourceNodeId] 
      });
    }

    // Update source node's parent reference
    ops.push({ 
      p: ['tree', sourceNodeId, 'parentId'], 
      oi: targetNodeId 
    });

    safeSubmitOp(ops, { source: 'moveNode' });

    // Update selected node if the moved node was selected
    if (stateRef.current.selectedNodeId === sourceNodeId) {
      setState(s => ({ ...s, selectedNodeId: sourceNodeId }));
    }

    notification.success({ 
      message: `Moved ${sourceNode.type} to ${targetNode.name}` 
    });

  } catch (e) {
    console.error('moveNode error', e);
    notification.error({ message: 'Failed to move item.' });
  }
},

    selectNode: (nodeId) => setState(s => ({ ...s, selectedNodeId: nodeId })),

    toggleTerminal: (visible) => setState(s => ({ ...s, terminalVisible: visible })),

    // inside `actions` in useEditorState (replace existing updateConfig)
updateConfig: async (newConfig) => {
  // LOCAL GUARD: mirror host-only pattern used for video/terminal/chat
  if (!stateRef.current.isHost) {
    notification.warning({ message: 'Only the host can update room settings.' });
    return false;
  }

  if (!stateRef.current.docLoaded || !docRef.current) {
    notification.error({ message: 'Document not loaded yet.' });
    return false;
  }

  if (!newConfig || typeof newConfig !== 'object') return false;

  try {
    const currentConfig = stateRef.current.config || {};

    // Merge with defaults (keep enableAI default true unless explicitly changed)
    const merged = {
      enableAI: true,
      ...currentConfig,
      ...newConfig,
    };

    // Submit config update as a single atomic op (authoritative doc change)
    safeSubmitOp([{ p: ['config'], oi: merged }], { source: 'config-update' });

    // Keep other fields in sync (roomMode / projectLanguage / lang)
    const extraOps = [];
    if (merged.roomMode) extraOps.push({ p: ['roomMode'], oi: merged.roomMode });
    if (merged.projectLanguage) {
      extraOps.push({ p: ['projectLanguage'], oi: merged.projectLanguage });
      extraOps.push({ p: ['lang'], oi: merged.projectLanguage });
    }
    if (extraOps.length > 0) safeSubmitOp(extraOps, { source: 'config-update' });

    // Optimistically update local state for snappy UX (mirrors other host flows)
    setState(s => ({
      ...s,
      config: merged,
      roomMode: merged.roomMode || s.roomMode,
      projectLanguage: merged.projectLanguage || s.projectLanguage,
    }));

    return true;
  } catch (e) {
    console.error('updateConfig failed', e);
    notification.error({ message: 'Failed to update room configuration.' });
    return false;
  }
},

// convenience helper — host-only toggle for AI
toggleAI: async (value) => {
  if (!stateRef.current.isHost) {
    notification.warning({ message: 'Only the host can toggle AI.' });
    return false;
  }
  return actions.updateConfig({ enableAI: value });
},


    handleSaveCode: () => {
      if (!stateRef.current.docLoaded || !stateRef.current.activeFileId) return;
      const activeFile = stateRef.current.files[stateRef.current.activeFileId];
      if (!activeFile) return;

      const blob = new Blob([activeFile.content], { type: 'text/plain;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = activeFile.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
      notification.success({ message: 'File downloaded successfully!' });
    },

    handleThemeChange: (theme) => {
      setState(s => ({ ...s, theme }));
      if (monacoRef.current) {
        try { monacoRef.current.editor.setTheme(theme); } catch (e) {}
      }
      localStorage.setItem('editor-theme', theme);
    },

    handleFontFamilyChange: (font) => {
      setState(s => ({ ...s, fontFamily: font }));
      if (editorRef.current) {
        try { editorRef.current.updateOptions({ fontFamily: font }); } catch (e) {}
      }
      localStorage.setItem('editor-font-family', font);
    },

    handleFontSizeChange: (size) => {
      const newSize = Math.max(8, Math.min(32, size));
      setState(s => ({ ...s, fontSize: newSize }));
      if (editorRef.current) {
        try { editorRef.current.updateOptions({ fontSize: newSize }); } catch (e) {}
      }
      localStorage.setItem('editor-font-size', newSize);
    },

    increaseFontSize: () => {
      const newSize = Math.max(8, Math.min(32, stateRef.current.fontSize + 1));
      actions.handleFontSizeChange(newSize);
    },

    decreaseFontSize: () => {
      const newSize = Math.max(8, Math.min(32, stateRef.current.fontSize - 1));
      actions.handleFontSizeChange(newSize);
    },

    handleRun: async () => {
      if (!stateRef.current.docLoaded || stateRef.current.runCodeDisabled || !stateRef.current.activeFileId) return;

      const cfg = stateRef.current.config || {};
      const allowRun = (typeof cfg.allowRun === 'boolean') ? cfg.allowRun : true;
      const runHostOnly = cfg.runHostOnly === true;
      if (!allowRun) {
        return notification.warning({ message: 'Run is disabled by the host.' });
      }
      if (runHostOnly && !stateRef.current.isHost) {
        return notification.warning({ message: 'Only the host can run code in this room.' });
      }

      setState(s => ({ ...s, runCodeDisabled: true, output: 'Preparing to run...' }));

      const exported = await handleSaveToWorkspace();
      if (!exported) {
        const useSharedIO = (() => {
          const cfg2 = stateRef.current.config;
          if (cfg2 && typeof cfg2.sharedInputOutput === 'boolean') return cfg2.sharedInputOutput;
          return stateRef.current.roomMode === 'project';
        })();

        if (useSharedIO && docRef.current) {
          try { docRef.current.submitOp([{ p: ['output'], oi: 'Failed to save workspace. Aborting run.' }]); } catch (e) {}
        } else {
          setState(s => ({ ...s, output: 'Failed to save workspace. Aborting run.' }));
        }

        setState(s => ({ ...s, runCodeDisabled: false }));
        return;
      }

      const useSharedIO = (() => {
        const cfg2 = stateRef.current.config;
        if (cfg2 && typeof cfg2.sharedInputOutput === 'boolean') return cfg2.sharedInputOutput;
        return stateRef.current.roomMode === 'project';
      })();

      if (useSharedIO && docRef.current) {
        try { docRef.current.submitOp([{ p: ['output'], oi: 'Executing...' }]); } catch (e) {}
      } else {
        setState(s => ({ ...s, output: 'Executing...' }));
      }

      const payload = {
        sessionId: id,
        lang: stateRef.current.lang,
        input: stateRef.current.input,
        entrypointFile: stateRef.current.files[stateRef.current.activeFileId]?.name,
      };

      try {
        const res = await axios.post(`${SERVER_URL}/code/run`, payload);
        if (useSharedIO && docRef.current) {
          docRef.current.submitOp([{ p: ['output'], oi: res.data }]);
        } else {
          setState(s => ({ ...s, output: res.data }));
        }
        setState(s => ({ ...s, runCodeDisabled: false }));
      } catch (err) {
        const errorOutput = err.response?.data || err.message || 'An unexpected error occurred during execution.';
        if (useSharedIO && docRef.current) {
          try { docRef.current.submitOp([{ p: ['output'], oi: errorOutput }]); } catch (e) {}
        } else {
          setState(s => ({ ...s, output: errorOutput }));
        }
        setState(s => ({ ...s, runCodeDisabled: false }));
      }
    },

    handleInput: (e) => {
      const newValue = e.target.value;
      const cfg = stateRef.current.config;
      const useSharedIO = cfg && typeof cfg.sharedInputOutput === 'boolean' ? cfg.sharedInputOutput : stateRef.current.roomMode === 'project';
      if (useSharedIO) {
        if (!docRef.current?.data) return;
        try { docRef.current.submitOp([{ p: ['input'], oi: newValue }]); } catch (e) { console.warn('handleInput submit failed', e); }
      } else {
        setState(s => ({ ...s, input: newValue }));
        savePrefs(id, stateRef.current.userName, { ...(loadPrefs(id, stateRef.current.userName) || {}), input: newValue });
      }
    },

    handleLang: (value) => {
      if (stateRef.current.roomMode === 'polyglot') {
        setState(s => ({ ...s, lang: value }));
        savePrefs(id, stateRef.current.userName, { ...(loadPrefs(id, stateRef.current.userName) || {}), lang: value });
        if (monacoRef.current && editorRef.current) {
          const model = editorRef.current.getModel();
          if (model) setEditorLanguage(monacoRef.current, model, value);
        }
        return;
      }

      if (!docRef.current?.data) return;
      try {
        safeSubmitOp([{ p: ['projectLanguage'], oi: value }, { p: ['lang'], oi: value }], { source: 'lang-change' });
      } catch (e) {
        console.warn('Failed to submit project language change', e);
      }
      setState(s => ({ ...s, lang: value, projectLanguage: value }));
      if (monacoRef.current && editorRef.current) {
        const model = editorRef.current.getModel();
        if (model) setEditorLanguage(monacoRef.current, model, value);
      }
    },
    // Updated actions for whiteboard functionality in useEditorState.js

// Add this to the actions object in useEditorState:

createWhiteboard: async (name, mode, initialSnapshot = null) => {
  if (!stateRef.current.isHost) {
    notification.error({ message: 'Only hosts can create new shared boards.' });
    return false;
  }
  if (!name || !mode) {
    notification.error({ message: 'Board name and mode are required.' });
    return false;
  }

  try {
    const newBoardId = uuidv4();
    const boardConfig = {
      id: newBoardId,
      name: name.trim(),
      mode, // 'host-only', 'everyone', or 'public'
      createdBy: stateRef.current.userName,
      createdAt: new Date().toISOString()
    };

    const ops = [
      // Initialize the board data (snapshot or empty object)
      { p: ['whiteboards', newBoardId], oi: initialSnapshot || {} },
      // Set the board configuration
      { p: ['whiteboardConfig', newBoardId], oi: boardConfig }
    ];

    safeSubmitOp(ops, { source: 'createWhiteboard' });
    
    // after safeSubmitOp(ops, { source: 'createWhiteboard' });
// try to refresh local doc so host UI is in-sync immediately
try {
  if (docRef.current && typeof docRef.current.fetch === 'function') {
    await new Promise((resolve, reject) => {
      docRef.current.fetch((err) => (err ? reject(err) : resolve()));
    });
    // update local editor state from the doc immediately
    try { updateStateFromDoc(docRef.current); } catch (e) { console.warn('updateStateFromDoc after createWhiteboard failed', e); }
  }
} catch (fetchErr) {
  console.warn('createWhiteboard: doc.fetch failed', fetchErr);
}

// return canonical id when available
return { success: true, boardId: newBoardId };

  } catch (e) {
    console.error('createWhiteboard error', e);
    notification.error({ message: 'Failed to create board.' });
    return false;
  }
},

updateWhiteboardConfig: async (boardId, updates) => {
  if (!stateRef.current.isHost) {
    notification.error({ message: 'Only hosts can modify board settings.' });
    return false;
  }
  
  if (!boardId || !updates) return false;

  try {
    const currentConfig = stateRef.current.whiteboardConfig[boardId];
    if (!currentConfig) {
      notification.error({ message: 'Board not found.' });
      return false;
    }

    const updatedConfig = {
      ...currentConfig,
      ...updates,
      updatedAt: new Date().toISOString(),
      updatedBy: stateRef.current.userName
    };

    safeSubmitOp([{ p: ['whiteboardConfig', boardId], oi: updatedConfig }], { 
      source: 'updateWhiteboardConfig' 
    });

    notification.success({ message: 'Board settings updated.' });
    return true;
  } catch (e) {
    console.error('updateWhiteboardConfig error', e);
    notification.error({ message: 'Failed to update board settings.' });
    return false;
  }
},

deleteWhiteboard: async (boardId) => {
  if (!stateRef.current.isHost) {
    notification.error({ message: 'Only hosts can delete boards.' });
    return false;
  }

  if (!boardId) return false;

  try {
    const boardConfig = stateRef.current.whiteboardConfig[boardId];
    const boardName = boardConfig?.name || 'Unknown Board';

    const ops = [
      { p: ['whiteboards', boardId], od: stateRef.current.whiteboards[boardId] || {} },
      { p: ['whiteboardConfig', boardId], od: stateRef.current.whiteboardConfig[boardId] }
    ];

    safeSubmitOp(ops, { source: 'deleteWhiteboard' });
    
    notification.success({ message: `Board "${boardName}" deleted.` });
    return true;
  } catch (e) {
    console.error('deleteWhiteboard error', e);
    notification.error({ message: 'Failed to delete board.' });
    return false;
  }
},

// Helper method to check board permissions
canEditBoard: (boardId) => {
  const boardConfig = stateRef.current.whiteboardConfig[boardId];
  if (!boardConfig) return false;

  // Hosts can always edit
  if (stateRef.current.isHost) return true;

  // For non-hosts, check board mode
  return boardConfig.mode === 'everyone' || boardConfig.mode === 'public';
},

// Helper to get board access level
getBoardAccessLevel: (boardId) => {
  const boardConfig = stateRef.current.whiteboardConfig[boardId];
  if (!boardConfig) return 'none';

  if (stateRef.current.isHost) return 'edit';
  
  switch (boardConfig.mode) {
    case 'everyone':
    case 'public':
      return 'edit';
    case 'host-only':
      return 'view';
    default:
      return 'none';
  }
}
  };


  // alias to allow nested actions reference
  const actionsProxy = actions;
  const actionsFinal = new Proxy(actionsProxy, {
    get(target, prop) {
      return target[prop];
    }
  });

  const actionsRef = actionsFinal;

  return { 
    state, 
    actions: actionsRef, 
    handleSaveToWorkspace, 
    openTerminalInWorkspace,
    docRef // CRITICAL: Export docRef for real-time whiteboard updates
  };
};

export default useEditorState;
