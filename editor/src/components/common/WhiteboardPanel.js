// components/WhiteboardPanel.js - Enhanced version with matching ParticipantsList design
import React, { useState, useMemo, useEffect } from 'react';
import { Button, Input, Modal, Select, List, Tag, Tooltip, message } from 'antd';
import { VscLock, VscEdit } from 'react-icons/vsc';
import { Share2, Crown, Globe, FileText, Eye, Plus, Users, Layers, Edit2, Trash2 } from 'lucide-react';
import Whiteboard from './Whiteboard';

import axios from 'axios';
const SERVER_URL = process.env.REACT_APP_SERVER_URL || 'http://localhost:8080';

const { Option } = Select;

export default function WhiteboardPanel({
  sessionId,
  userName,
  isHost,
  whiteboardConfig = {},
  onCreateBoard,
  onUpdateBoardConfig,
  docRef,
  participants = [],
  onDockWhiteboard
}) {
  const [view, setView] = useState('list');
  const [selectedBoardId, setSelectedBoardId] = useState(null);
  const [selectedBoardType, setSelectedBoardType] = useState('shared');
  const [isCreateModalVisible, setCreateModalVisible] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [newBoardMode, setNewBoardMode] = useState('host-only');
  const [activeTab, setActiveTab] = useState('all');

  // Real-time board updates from ShareDB
  const [realtimeBoards, setRealtimeBoards] = useState({});
  const [sharedNotes, setSharedNotes] = useState({});

  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renameTarget, setRenameTarget] = useState(null);

  // Private notes state
  const [privateNotes, setPrivateNotes] = useState(() => {
    try {
      const saved = localStorage.getItem(`codecrew-private-notes-${userName || 'anonymous'}`);
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  // Share modal state
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [shareTarget, setShareTarget] = useState('');
  const [noteToShare, setNoteToShare] = useState(null);

  // Listen for real-time updates from ShareDB document
  useEffect(() => {
    if (!docRef?.current) return;

    const handleDocUpdate = () => {
      const doc = docRef.current;
      if (!doc?.data) return;

      if (doc.data.whiteboardConfig) {
        setRealtimeBoards(doc.data.whiteboardConfig);
      }

      if (doc.data.sharedNotes) {
        setSharedNotes(doc.data.sharedNotes);
      }
    };

    if (docRef.current.on) {
      docRef.current.on('op', handleDocUpdate);
    }

    handleDocUpdate();

    return () => {
      if (docRef.current?.off) {
        try {
          docRef.current.off('op', handleDocUpdate);
        } catch (e) {
          console.warn('Failed to remove ShareDB listener:', e);
        }
      }
    };
  }, [docRef]);

  // Update localStorage when privateNotes change
  useEffect(() => {
    try {
      localStorage.setItem(`codecrew-private-notes-${userName || 'anonymous'}`, JSON.stringify(privateNotes));
    } catch (e) {
      console.warn('Failed to save private notes to localStorage:', e);
    }
  }, [privateNotes, userName]);

  // Listen for shared notes updates and merge with private notes
  useEffect(() => {
    if (!docRef?.current) return;

    const handleDocUpdate = () => {
      const doc = docRef.current;
      if (!doc?.data) return;

      setSharedNotes(doc.data.sharedNotes || {});
    };

    if (docRef.current.on) {
      docRef.current.on('op', handleDocUpdate);
    }

    handleDocUpdate();

    return () => {
      if (docRef.current?.off) {
        try {
          docRef.current.off('op', handleDocUpdate);
        } catch (e) {
          console.warn('Failed to remove shared notes listener:', e);
        }
      }
    };
  }, [docRef]);

  // Merge real-time boards with prop-based boards
  const allBoards = useMemo(() => ({ ...whiteboardConfig, ...realtimeBoards }), [whiteboardConfig, realtimeBoards]);

  const boardList = useMemo(() => {
    return Object.values(allBoards || {})
      .filter(b => b && (b.id || b.originalId))
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }, [allBoards]);

  const categorizedBoards = useMemo(() => {
    const categories = { shared: [], host: [], public: [], private: [] };

    // 1) Shared notes targeted to this user
    const myShared = (sharedNotes && sharedNotes[userName]) || {};
    Object.entries(myShared).forEach(([sharedKey, sharedNote]) => {
      if (sharedNote) {
        categories.shared.push({
          ...sharedNote,
          _sharedKey: sharedKey,
          type: 'shared',
          category: 'Shared Notes',
          isSharedNote: true
        });
      }
    });

    // 2) Private notes: only those that are truly private
    Object.values(privateNotes || {}).forEach(note => {
      if (!note) return;
      const isActuallyShared = !!(note.shared === true) || !!(myShared && myShared[note.id]);
      if (!isActuallyShared) {
        categories.private.push({
          ...note,
          type: 'private',
          category: 'Private Notes',
          isPrivateNote: true
        });
      }
    });

    // 3) Regular boards come from boardList
    boardList.forEach(board => {
      if (!board) return;

      if (board.isSharedNote || board.isPrivateNote) return;

      if (board.mode === 'host-only') {
        categories.host.push({ ...board, type: 'host', category: 'Host Notes' });
      } else if (board.mode === 'everyone' || board.mode === 'public') {
        categories.public.push({ ...board, type: 'public', category: 'Public Notes' });
      } else {
        categories.public.push({ ...board, type: 'public', category: 'Public Notes' });
      }
    });

    return categories;
  }, [boardList, sharedNotes, privateNotes, userName]);

  // Aggregate all notes for the "All Notes" tab
  const allNotes = useMemo(() => {
    return [
      ...categorizedBoards.shared,
      ...categorizedBoards.host,
      ...categorizedBoards.public,
      ...categorizedBoards.private
    ].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }, [categorizedBoards]);

  // Create board
  const handleCreateBoard = async () => {
    if (!newBoardName.trim()) {
      message.error('Board name is required');
      return;
    }

    try {
      const result = await onCreateBoard(newBoardName.trim(), newBoardMode);
      const createdBoardId = result && (result.boardId || result.id) ? (result.boardId || result.id) : null;
      const succeeded = (result && (result.success === true || createdBoardId)) || result === true;

      if (!succeeded) throw new Error('Create board failed');

      const boardTypeForOpen = newBoardMode === 'host-only' ? 'host' : 'public';
      const boardId = createdBoardId || `tmp_${Date.now()}`;

      const optimisticConfig = {
        id: boardId,
        name: newBoardName.trim(),
        mode: newBoardMode,
        createdBy: userName || 'unknown',
        createdAt: new Date().toISOString(),
        _optimistic: true
      };
      setRealtimeBoards(prev => ({ ...(prev || {}), [boardId]: optimisticConfig }));

      setCreateModalVisible(false);
      setNewBoardName('');
      setNewBoardMode('host-only');
      message.success('Board created successfully!');

      setSelectedBoardId(boardId);
      setSelectedBoardType(boardTypeForOpen);
      setView('board');

    } catch (error) {
      console.error('Failed to create board:', error);
      message.error('Failed to create board');
    }
  };

  const handleCreatePrivateNote = () => {
    if (!newBoardName.trim()) {
      message.error('Note name is required');
      return;
    }

    const noteId = `private_note_${Date.now()}`;
    setPrivateNotes(prev => ({
      ...prev,
      [noteId]: {
        id: noteId,
        name: newBoardName.trim(),
        snapshot: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        shared: false,
        isPrivateNote: true,
        createdBy: userName,
        _local: true
      }
    }));
    setNewBoardName('');
    setCreateModalVisible(false);
    setSelectedBoardId(noteId);
    setSelectedBoardType('private');
    setView('board');
    message.success('Private note created!');
  };

  const openBoard = (idOrItem, boardType = 'shared') => {
    const canonicalId = (typeof idOrItem === 'string') ? idOrItem : (idOrItem._sharedKey || idOrItem.originalId || idOrItem.id || null);
    const cfgFromPrivate = privateNotes[canonicalId];
    const cfgFromShared = (sharedNotes && sharedNotes[userName] && (sharedNotes[userName][canonicalId] || Object.values(sharedNotes[userName] || {}).find(n => (n.originalId || n.id) === canonicalId))) || null;
    const cfgFromBoards = allBoards[canonicalId] || boardList.find(b => (b.id || b.originalId) === canonicalId) || null;
    const chosenConfig = (typeof idOrItem === 'object' && idOrItem) || cfgFromPrivate || cfgFromShared || cfgFromBoards || null;

    if (typeof onDockWhiteboard === 'function') {
      onDockWhiteboard(canonicalId || idOrItem, boardType, chosenConfig);
      return;
    }

    setSelectedBoardId(canonicalId || idOrItem);
    setSelectedBoardType(boardType);
    setView('board');
  };

  const confirmShareNote = () => {
    if (!shareTarget || !shareTarget.trim()) {
      message.error('Please select a participant to share with');
      return;
    }

    if (!docRef?.current) {
      message.error('Unable to share note - document not available');
      return;
    }

    if (!noteToShare) {
      message.error('No note selected for sharing');
      return;
    }

    try {
      const sharedNote = {
        ...noteToShare,
        sharedFrom: userName,
        sharedAt: new Date().toISOString(),
        originalId: noteToShare.id
      };

      const doc = docRef.current;
      if (!doc || !doc.data) {
        throw new Error('Shared document not ready');
      }

      const currentSharedNotes = docRef.current.data.sharedNotes || {};
      const targetUserNotes = { ...(currentSharedNotes[shareTarget] || {}) };
      targetUserNotes[noteToShare.id] = sharedNote;

      const ops = [];
      if (!doc.data.sharedNotes) {
        ops.push({ p: ['sharedNotes'], oi: { [shareTarget]: targetUserNotes } });
      } else {
        ops.push({ p: ['sharedNotes', shareTarget], oi: targetUserNotes });
      }

      doc.submitOp(ops, { source: 'share-note' });

      message.success(`Note "${noteToShare.name}" shared with ${shareTarget}!`);
      setShareModalVisible(false);
      setShareTarget('');
      setNoteToShare(null);
    } catch (error) {
      console.error('Failed to share note:', error);
      message.error('Failed to share note');
    }
  };

  const openRenameModal = (id, type, config = null) => {
    setRenameTarget({ id, type, config });
    setRenameValue((config && config.name) || '');
    setRenameModalVisible(true);
  };

  const confirmRename = async () => {
    if (!renameTarget) return;
    const { id, type, config } = renameTarget;
    const newName = (renameValue || '').trim();
    if (!newName) return message.error('Name is required');

    try {
      if (type === 'private') {
        if (privateNotes[id]) {
          setPrivateNotes(prev => ({
            ...prev,
            [id]: {
              ...prev[id],
              name: newName,
              updatedAt: new Date().toISOString()
            }
          }));
        }

        if (docRef?.current && docRef.current.data) {
          const serverBoard = docRef.current.data.whiteboardConfig?.[id];
          if (serverBoard && serverBoard.isPrivateNote && serverBoard.createdBy === userName) {
            await axios.put(
              `${SERVER_URL}/session/${encodeURIComponent(sessionId)}/boards/${encodeURIComponent(id)}`,
              { updater: userName, name: newName }
            );
          }
        }

        message.success('Renamed successfully');
        setRenameModalVisible(false);
        setRenameTarget(null);
        setRenameValue('');
        return;
      }

      else if (type === 'shared') {
        if (!docRef?.current || !docRef.current.data) throw new Error('Document not available');
        const doc = docRef.current;
        const currentShared = doc.data.sharedNotes || {};
        const myShared = { ...(currentShared[userName] || {}) };

        let sharedKey = null;
        if (renameTarget?.config && renameTarget.config._sharedKey) {
          sharedKey = renameTarget.config._sharedKey;
        } else {
          sharedKey = id;
          if (!myShared[sharedKey]) {
            const foundKey = Object.keys(myShared).find(k => {
              const entry = myShared[k];
              if (!entry) return false;
              return (entry.originalId === id) || (entry.id === id) || (k === id);
            });
            if (foundKey) sharedKey = foundKey;
          }
        }

        const existing = myShared[sharedKey] || {};
        const canRename = (existing.sharedFrom === userName) || (isHost && existing.sharedFrom !== userName);
        
        if (!canRename) {
          message.error('You can only rename notes that you shared or notes shared with you (if you are a host)');
          setRenameModalVisible(false);
          setRenameTarget(null);
          setRenameValue('');
          return;
        }

        myShared[sharedKey] = {
          ...existing,
          name: newName,
          updatedAt: new Date().toISOString(),
          updatedBy: userName
        };

        const op = [{ p: ['sharedNotes', userName], oi: myShared }];
        doc.submitOp(op, { source: 'rename-shared' }, (err) => {
          if (err) {
            console.error('[rename-shared] submitOp failed', err);
            message.error('Failed to rename shared note: ' + (err.message || err));
            return;
          }
          setSharedNotes(prev => ({ ...(prev || {}), [userName]: myShared }));

          message.success('Renamed successfully');
          setRenameModalVisible(false);
          setRenameTarget(null);
          setRenameValue('');
        });

        return;
      }

      else if (type === 'public' || type === 'host') {
        await axios.put(
          `${SERVER_URL}/session/${encodeURIComponent(sessionId)}/boards/${encodeURIComponent(id)}`,
          { updater: userName, name: newName }
        );

        setRealtimeBoards(prev => {
          const next = { ...(prev || {}) };
          if (next[id]) next[id] = { ...next[id], name: newName, updatedAt: new Date().toISOString() };
          return next;
        });

        message.success('Renamed successfully');
        setRenameModalVisible(false);
        setRenameTarget(null);
        setRenameValue('');
        return;
      }

    } catch (err) {
      console.error('Rename failed', err);
      const errMsg = err?.response?.data?.error || err.message || 'Rename failed';
      message.error(errMsg);
    }
  };

  const handleDeletePrivateNote = (noteId) => {
  const noteToDelete = privateNotes[noteId];
  if (!noteToDelete) return;

  Modal.confirm({
    title: (
      <div className="flex items-center gap-2">
        <div className="terminal-toggle active" style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path 
              d="M5 3.5V2.5C5 1.94772 5.44772 1.5 6 1.5H8C8.55228 1.5 9 1.94772 9 2.5V3.5M11 3.5H3M10.5 3.5V10.5C10.5 11.0523 10.0523 11.5 9.5 11.5H4.5C3.94772 11.5 3.5 11.0523 3.5 10.5V3.5H10.5Z" 
              stroke="currentColor" 
              strokeWidth="1.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <span className="text-slate-100 font-semibold text-sm">
          Delete {noteToDelete.shared ? 'Shared Note' : 'Private Note'}?
        </span>
      </div>
    ),
    content: (
      <div className="text-slate-300 text-sm leading-6 mt-2">
        {noteToDelete.shared 
          ? 'This will remove the shared note from your view. The original owner will still have access to it.'
          : 'This action cannot be undone. The note will be permanently deleted.'
        }
        {noteToDelete.name && (
          <div className="mt-3 p-3 rounded-lg bg-gradient-to-r from-slate-800/40 to-slate-700/30 border border-slate-700/30">
            <span className="text-slate-400 text-xs">Note: </span>
            <span className="text-cyan-300 font-medium">{noteToDelete.name}</span>
          </div>
        )}
      </div>
    ),
    onOk: () => {
      if (noteToDelete.shared) {
        if (docRef?.current) {
          try {
            const currentSharedNotes = docRef.current.data.sharedNotes || {};
            const userSharedNotes = currentSharedNotes[userName] || {};
            delete userSharedNotes[noteId];

            docRef.current.submitOp([{
              p: ['sharedNotes', userName],
              oi: userSharedNotes
            }]);
          } catch (e) {
            console.warn('Failed to remove shared note from document:', e);
          }
        }
      }

      setPrivateNotes(prev => {
        const newNotes = { ...prev };
        delete newNotes[noteId];
        return newNotes;
      });

      if (selectedBoardId === noteId) {
        setView('list');
      }
      message.success('Note deleted');
    },
    okText: noteToDelete.shared ? 'Remove from View' : 'Delete Note',
    cancelText: 'Cancel',
    className: 'delete-confirm-modal private-note-delete-modal',
    width: 440,
    styles: {
      body: { 
        padding: '20px',
        background: 'linear-gradient(180deg, rgba(15,23,42,0.95), rgba(7,17,26,0.95))',
        color: '#e2e8f0',
        borderRadius: '0 0 12px 12px',
        backdropFilter: 'blur(20px)',
      },
      header: {
        background: 'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(30,41,59,0.9))',
        borderBottom: `1px solid ${noteToDelete.shared ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)'}`,
        color: '#e2e8f0',
        borderRadius: '12px 12px 0 0',
        padding: '16px 20px',
        minHeight: 'auto'
      },
      content: {
        backgroundColor: 'transparent',
        backdropFilter: 'blur(20px)',
        borderRadius: '12px',
        boxShadow: `0 20px 40px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px ${noteToDelete.shared ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)'}`,
        border: 'none',
        overflow: 'hidden'
      }
    },
    okButtonProps: {
      className: noteToDelete.shared ? 'modal-remove-btn' : 'modal-delete-btn',
      icon: noteToDelete.shared ? (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path 
            d="M9 3L3 9M3 3L9 9" 
            stroke="currentColor" 
            strokeWidth="1.2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path 
            d="M4 3V2C4 1.44772 4.44772 1 5 1H7C7.55228 1 8 1.44772 8 2V3M9 3H3M8.5 3V9C8.5 9.55228 8.05228 10 7.5 10H4.5C3.94772 10 3.5 9.55228 3.5 9V3H8.5Z" 
            stroke="currentColor" 
            strokeWidth="1.2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
        </svg>
      )
    },
    cancelButtonProps: {
      className: 'modal-cancel-btn'
    }
  });
};

  const handleDeleteSharedNote = (noteIdOrKey) => {
    if (!noteIdOrKey) return message.error('Note id missing');

    Modal.confirm({
      title: 'Remove shared note from your view?',
      content: 'This will remove the shared note only from your shared notes (others will still have it).',
      okType: 'danger',
      onOk: async () => {
        try {
          const doc = docRef?.current;
          if (!doc || !doc.data) throw new Error('Document not available');

          const currentShared = doc.data.sharedNotes || {};
          const myShared = { ...(currentShared[userName] || {}) };

          let sharedKey = noteIdOrKey;
          if (!myShared[sharedKey]) {
            const foundKey = Object.keys(myShared).find(k => {
              const entry = myShared[k];
              if (!entry) return false;
              return (entry.originalId === noteIdOrKey) || (entry.id === noteIdOrKey) || (k === noteIdOrKey);
            });
            if (foundKey) sharedKey = foundKey;
          }

          if (!myShared[sharedKey]) {
            setSharedNotes(prev => {
              const next = { ...(prev || {}) };
              if (next[userName]) {
                const cp = { ...next[userName] };
                delete cp[noteIdOrKey];
                next[userName] = cp;
              }
              return next;
            });
            return message.success('Note removed from your view');
          }

          delete myShared[sharedKey];

          doc.submitOp([{ p: ['sharedNotes', userName], oi: myShared }], { source: 'delete-shared-note' }, (err) => {
            if (err) {
              console.error('[delete-shared-note] submitOp failed', err);
              message.error('Failed to remove shared note: ' + (err.message || err));
              return;
            }
            setSharedNotes(prev => {
              const next = { ...(prev || {}) };
              next[userName] = myShared;
              return next;
            });
            if (selectedBoardId === noteIdOrKey || selectedBoardId === sharedKey) {
              setView('list');
              setSelectedBoardId(null);
            }
            message.success('Note removed from your shared notes');
          });
        } catch (err) {
          console.error('Failed to remove shared note:', err);
          message.error('Failed to remove shared note');
        }
      }
    });
  };

  const handleDeleteBoard = async (boardId, boardName) => {
  if (!boardId) return message.error('Board id missing');

  Modal.confirm({
    title: (
      <div className="flex items-center gap-2">
        <div className="terminal-toggle active" style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path 
              d="M5 3.5V2.5C5 1.94772 5.44772 1.5 6 1.5H8C8.55228 1.5 9 1.94772 9 2.5V3.5M11 3.5H3M10.5 3.5V10.5C10.5 11.0523 10.0523 11.5 9.5 11.5H4.5C3.94772 11.5 3.5 11.0523 3.5 10.5V3.5H10.5Z" 
              stroke="currentColor" 
              strokeWidth="1.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <span className="text-slate-100 font-semibold text-sm">Delete "{boardName}"?</span>
      </div>
    ),
    content: (
      <div className="text-slate-300 text-sm leading-6 mt-2">
        This action will permanently remove the board for everyone. Only hosts can delete public/host boards.
      </div>
    ),
    onOk: async () => {
      try {
        const url = `${SERVER_URL}/session/${encodeURIComponent(sessionId)}/boards/${encodeURIComponent(boardId)}`;
        const resp = await axios.delete(url, { data: { deleter: userName } });

        if (resp?.data?.ok) {
          setRealtimeBoards(prev => {
            const next = { ...(prev || {}) };
            delete next[boardId];
            return next;
          });

          setSharedNotes(prev => {
            const next = { ...(prev || {}) };
            Object.keys(next).forEach(u => {
              if (next[u] && next[u][boardId]) {
                const copy = { ...next[u] };
                delete copy[boardId];
                next[u] = copy;
              }
            });
            return next;
          });

          if (view === 'board' && selectedBoardId === boardId) {
            setView('list');
            setSelectedBoardId(null);
          }

          message.success(`Board "${boardName}" deleted`);
        } else {
          throw new Error(resp?.data?.error || 'Delete failed');
        }
      } catch (err) {
        console.error('Failed to delete board:', err);
        const errMsg = err?.response?.data?.error || err.message || 'Delete failed';
        message.error(`Delete failed: ${errMsg}`);
      }
    },
    okText: 'Delete',
    cancelText: 'Cancel',
    className: 'delete-confirm-modal',
    width: 420,
    styles: {
      body: { 
        padding: '20px',
        background: 'linear-gradient(180deg, rgba(15,23,42,0.95), rgba(7,17,26,0.95))',
        color: '#e2e8f0',
        borderRadius: '0 0 12px 12px',
        backdropFilter: 'blur(20px)',
      },
      header: {
        background: 'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(30,41,59,0.9))',
        borderBottom: '1px solid rgba(239, 68, 68, 0.15)',
        color: '#e2e8f0',
        borderRadius: '12px 12px 0 0',
        padding: '16px 20px',
        minHeight: 'auto'
      },
      content: {
        backgroundColor: 'transparent',
        backdropFilter: 'blur(20px)',
        borderRadius: '12px',
        boxShadow: '0 20px 40px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(239, 68, 68, 0.1)',
        border: 'none',
        overflow: 'hidden'
      }
    },
    okButtonProps: {
      className: 'modal-delete-btn',
      icon: (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path 
            d="M4 3V2C4 1.44772 4.44772 1 5 1H7C7.55228 1 8 1.44772 8 2V3M9 3H3M8.5 3V9C8.5 9.55228 8.05228 10 7.5 10H4.5C3.94772 10 3.5 9.55228 3.5 9V3H8.5Z" 
            stroke="currentColor" 
            strokeWidth="1.2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
        </svg>
      )
    },
    cancelButtonProps: {
      className: 'modal-cancel-btn'
    }
  });
};

  const canEditBoard = (boardConfig) => {
    if (!boardConfig) return false;

    if (boardConfig.isSharedNote) {
      if (boardConfig.sharedFrom === userName) return true;
      return false;
    }

    if (isHost && !boardConfig.isSharedNote) return true;

    if (boardConfig.isPrivateNote) return true;

    return boardConfig.mode === 'public' || boardConfig.mode === 'everyone';
  };

  const canRemoveSharedNote = (boardConfig) => {
    if (!boardConfig || !boardConfig.isSharedNote) return false;
    return true;
  };

  const getBoardIcon = (boardConfig) => {
    if (!boardConfig) return <VscLock className="text-gray-400" />;
    if (boardConfig.isSharedNote) return <Share2 className="text-blue-500 w-3 h-3" />;
    if (boardConfig.isPrivateNote) return <Eye className="text-purple-500 w-3 h-3" />;
    switch (boardConfig.mode) {
      case 'public':
      case 'everyone':
        return <Globe className="text-green-500 w-3 h-3" />;
      case 'host-only':
        return <Crown className="text-orange-500 w-3 h-3" />;
      default:
        return <VscLock className="text-gray-400" />;
    }
  };

  const getBoardModeLabel = (boardConfig) => {
    if (!boardConfig) return 'Unknown';
    if (boardConfig.isSharedNote) return `Shared by ${boardConfig.sharedFrom}`;
    if (boardConfig.isPrivateNote) return boardConfig.shared ? `Shared by ${boardConfig.sharedFrom}` : 'Private note';
    switch (boardConfig.mode) {
      case 'public':
      case 'everyone':
        return 'Everyone can edit';
      case 'host-only':
        return 'Hosts only';
      default:
        return 'Unknown';
    }
  };

  const getBoardAccessLevel = (boardConfig) => {
    if (!boardConfig) return { canEdit: false, level: 'none', label: 'No Access', icon: null };
    const canEdit = canEditBoard(boardConfig);
    if (canEdit) {
      return { canEdit: true, level: 'edit', label: 'Editable', icon: <VscEdit className="inline w-2 h-2 mr-1" /> };
    } else {
      return { canEdit: false, level: 'view', label: 'View Only', icon: null };
    }
  };

  const getCanonicalId = (itemOrId) => {
    if (!itemOrId) return itemOrId;
    if (typeof itemOrId === 'string') return itemOrId;
    return itemOrId._sharedKey || itemOrId.originalId || itemOrId.id || null;
  };

  const renderBoardList = (boards = [], category = 'public') => {
    if (!boards || boards.length === 0) {
      const emptyMessages = {
        shared: 'No shared notes yet',
        host: 'No host notes yet',
        public: 'No public boards yet',
        private: 'No private notes yet',
        all: 'No notes available'
      };

      return (
        <div className="empty-state animate-fadeIn">
          <div className="empty-icon-container">
            <FileText className="empty-icon" />
          </div>
          <div className="empty-text">
            <p className="empty-title">{emptyMessages[category] || 'No boards yet'}</p>
          </div>
        </div>
      );
    }

    return (
      <div className="notes-list">
        {boards.map((item, index) => {
          const accessLevel = getBoardAccessLevel(item);
          const isOwner = item.createdBy ? (item.createdBy === userName) : !!privateNotes[item.id];
          return (
            <div
              key={item.id || item._sharedKey}
              onClick={() => {
                let actualType = category;
                if (category === 'all') {
                  if (item.isSharedNote) actualType = 'shared';
                  else if (item.isPrivateNote) actualType = 'private';
                  else if (item.mode === 'host-only') actualType = 'host';
                  else actualType = 'public';
                }
                openBoard(item, actualType);
              }}
              className={`note-item`}
              style={{
                animationDelay: `${index * 0.05}s`,
                animationFillMode: 'both'
              }}
            >
              <div className="note-content">
                <div className="note-avatar-section">
                  <div className="note-avatar-container">
                    <div className={`note-avatar ${
                      item.isSharedNote ? 'avatar-shared' : 
                      item.isPrivateNote ? 'avatar-private' :
                      item.mode === 'host-only' ? 'avatar-host' : 'avatar-public'
                    }`}>
                      {getBoardIcon(item)}
                    </div>
                  </div>
                </div>
                
                <div className="note-info">
                  <div className="note-name-section">
                    <span className="note-name">{item.name}</span>
                    <div className="note-badges">
                      <span className={`access-badge ${accessLevel.canEdit ? 'badge-edit' : 'badge-view'}`}>
                        {accessLevel.icon ? <span className="badge-icon">{accessLevel.icon}</span> : null}
                        {accessLevel.label}
                      </span>
                    </div>
                  </div>
                  <div className="note-description">
                    <div>{getBoardModeLabel(item)}</div>
                    <div className="note-date">
                      {item.isSharedNote ? (
                        <>Shared {item.sharedAt ? new Date(item.sharedAt).toLocaleDateString() : ''}</>
                      ) : (
                        <>Created {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}</>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="note-controls">
                  {/* Share button: only for true private notes */}
                  {item.isPrivateNote === true && !item.isSharedNote && !item.shared && (isHost || isOwner) && (
                    <Tooltip title="Share this note" color="#0f172a">
                      <button
                        onClick={(e) => {
                          e?.stopPropagation && e.stopPropagation();
                          const noteObj = privateNotes[item.id] || item;
                          setNoteToShare(noteObj);
                          setShareModalVisible(true);
                        }}
                        className="control-button share-button"
                      >
                        <Share2 className="control-icon" />
                      </button>
                    </Tooltip>
                  )}

                  {/* Rename: only for private notes, regular boards, but NOT for shared notes */}
                  {!item.isSharedNote && accessLevel.canEdit && (
                    <Tooltip title="Rename" color="#0f172a">
                      <button
                        onClick={(e) => {
                          e?.stopPropagation && e.stopPropagation();
                          let typeForRename = 'public';
                          if (item.isPrivateNote) typeForRename = 'private';
                          else if (item.mode === 'host-only') typeForRename = 'host';
                          else typeForRename = 'public';

                          openRenameModal(item._sharedKey || getCanonicalId(item), typeForRename, item);
                        }}
                        className="control-button rename-button"
                      >
                        <Edit2 className="control-icon" />
                      </button>
                    </Tooltip>
                  )}

                  {/* Delete/Remove buttons */}
                  {item.isSharedNote ? (
                    canRemoveSharedNote(item) && (
                      <Tooltip title="Remove from your view" color="#0f172a">
                        <button
                          onClick={(e) => {
                            e?.stopPropagation && e.stopPropagation();
                            const deleteId = item._sharedKey || getCanonicalId(item);
                            handleDeleteSharedNote(deleteId);
                          }}
                          className="control-button delete-button"
                        >
                          <Trash2 className="control-icon" />
                        </button>
                      </Tooltip>
                    )
                  ) : (
                    <>
                      {accessLevel.canEdit && !item.isPrivateNote && (
                        <Tooltip title="Delete board" color="#0f172a">
                          <button
                            onClick={(e) => {
                              e?.stopPropagation && e.stopPropagation();
                              const canonicalId = getCanonicalId(item);
                              handleDeleteBoard(canonicalId, item.name || 'Unnamed board');
                            }}
                            className="control-button delete-button"
                          >
                            <Trash2 className="control-icon" />
                          </button>
                        </Tooltip>
                      )}

                      {item.isPrivateNote === true && (
                        <Tooltip title="Delete note" color="#0f172a">
                          <button
                            onClick={(e) => {
                              e?.stopPropagation && e.stopPropagation();
                              handleDeletePrivateNote(item.id);
                            }}
                            className="control-button delete-button"
                          >
                            <Trash2 className="control-icon" />
                          </button>
                        </Tooltip>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Tab configuration with counts and icons
  const tabs = [
    { key: 'all', icon: Layers, label: 'All', count: allNotes.length },
    { key: 'shared', icon: Share2, label: 'Shared', count: categorizedBoards.shared.length },
    { key: 'host', icon: Crown, label: 'Host', count: categorizedBoards.host.length },
    { key: 'public', icon: Globe, label: 'Public', count: categorizedBoards.public.length },
    { key: 'private', icon: Eye, label: 'Private', count: categorizedBoards.private.length }
  ];

  const getTabData = (tabKey) => {
    switch (tabKey) {
      case 'all': return allNotes;
      case 'shared': return categorizedBoards.shared;
      case 'host': return categorizedBoards.host;
      case 'public': return categorizedBoards.public;
      case 'private': return categorizedBoards.private;
      default: return [];
    }
  };

  return (
    <>
      <div className="whiteboard-container animate-slideInUp">
        <div className="whiteboard-header">
          <div className="header-content">
            <div className="title-section group">
              <div className="icon-container">
                <FileText className="title-icon" />
              </div>
              <div className="title-text-container">
                <div className="title-text">Notes & Boards</div>
              </div>
            </div>

            {/* Central Create Button */}
            <div className="create-section">
              <button
                onClick={() => setCreateModalVisible(true)}
                className="create-button group"
              >
                <Plus className="create-icon" />
              </button>
            </div>
          </div>
        </div>

        <div className="whiteboard-body">
          {/* Tab bubbles */}
          <div className="tab-bubbles">
            {tabs.map(tab => {
              const IconComponent = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`tab-bubble ${activeTab === tab.key ? 'tab-active' : ''}`}
                  title={`${tab.label} (${tab.count})`}
                >
                  <IconComponent className="tab-icon" />
                  <span className="tab-count">{tab.count}</span>
                </button>
              );
            })}
          </div>

          {/* Notes content */}
          <div className="notes-content">
            {renderBoardList(getTabData(activeTab), activeTab)}
          </div>
        </div>
      </div>

      {/* Create Modal */}
<Modal
  title={
    <div className="flex items-center gap-2">
      <div className="terminal-toggle active">
        <Plus className="terminal-icon" />
      </div>
      <span className="text-slate-100 font-semibold text-sm">
        Create New {activeTab === 'private' || !isHost ? 'Private Note' : 'Note'}
      </span>
    </div>
  }
  open={isCreateModalVisible}
  onOk={activeTab === 'private' || !isHost ? handleCreatePrivateNote : handleCreateBoard}
  onCancel={() => {
    setCreateModalVisible(false);
    setNewBoardName('');
    setNewBoardMode('host-only');
  }}
  okText={activeTab === 'private' || !isHost ? "Create Note" : "Create Board"}
  cancelText="Cancel"
  className="whiteboard-modal host-modal-style"
  width={380}
  transitionName="ant-zoom"
  maskTransitionName="ant-fade"
  styles={{
    body: { 
      padding: '20px',
      background: 'linear-gradient(180deg, rgba(15,23,42,0.95), rgba(7,17,26,0.95))',
      color: '#e2e8f0',
      borderRadius: '0 0 12px 12px',
      backdropFilter: 'blur(20px)',
      opacity: 0,
      transform: 'scale(0.95) translateY(-10px)',
      animation: 'modalEnter 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards'
    },
    header: {
      background: 'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(30,41,59,0.9))',
      borderBottom: '1px solid rgba(14, 165, 164, 0.15)',
      color: '#e2e8f0',
      borderRadius: '12px 12px 0 0',
      padding: '16px 20px',
      minHeight: 'auto',
      opacity: 0,
      transform: 'translateY(-10px)',
      animation: 'modalHeaderEnter 0.3s cubic-bezier(0.4, 0, 0.2, 1) 0.1s forwards'
    },
    content: {
      backgroundColor: 'transparent',
      backdropFilter: 'blur(20px)',
      borderRadius: '12px',
      boxShadow: '0 20px 40px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(14, 165, 164, 0.1)',
      border: 'none',
      opacity: 0,
      transform: 'scale(0.95)',
      animation: 'modalContentEnter 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards'
    },
    footer: {
      background: 'linear-gradient(180deg, rgba(15,23,42,0.8), rgba(7,17,26,0.9))',
      borderTop: '1px solid rgba(14, 165, 164, 0.1)',
      borderRadius: '0 0 12px 12px',
      padding: '16px 20px',
      marginTop: '8px',
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '8px'
    }
  }}
  okButtonProps={{
    className: 'modal-apply-btn animate-pulse-once'
  }}
  cancelButtonProps={{
    className: 'modal-cancel-btn'
  }}
  closeIcon={
    <div className="modal-close-btn">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path 
          d="M13 1L1 13M1 1L13 13" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          className="transition-all duration-300"
        />
      </svg>
    </div>
  }
>
  <div className="space-y-4 modal-content-inner">
    <div className="input-group" style={{ animationDelay: '0.1s' }}>
      <label className="text-slate-300 font-medium text-xs mb-2 block">
        {activeTab === 'private' || !isHost ? "Note Name" : "Board Name"}
      </label>
      <Input
        placeholder={activeTab === 'private' || !isHost ? "Enter note name..." : "Enter board name..."}
        value={newBoardName}
        onChange={(e) => setNewBoardName(e.target.value)}
        onPressEnter={activeTab === 'private' || !isHost ? handleCreatePrivateNote : handleCreateBoard}
        className="modal-input"
        size="small"
      />
    </div>

    {activeTab !== 'private' && isHost && (
      <div className="input-group" style={{ animationDelay: '0.2s' }}>
        <label className="text-slate-300 font-medium text-xs mb-2 block">Access Level</label>
        <Select 
          value={newBoardMode} 
          onChange={setNewBoardMode}
          className="modal-select"
          size="small"
          popupClassName="bg-slate-800 border-slate-700 "
        >
          <Option value="host-only">
            <div className="flex items-center gap-2 text-xs transition-all duration-300 hover:text-cyan-300">
              <Crown className="w-3 h-3 text-amber-400 transition-transform duration-300 group-hover:scale-110" />
              <span>Host Notes (Only hosts can edit)</span>
            </div>
          </Option>
          <Option value="everyone">
            <div className="flex items-center gap-2 text-xs transition-all duration-300 hover:text-cyan-300">
              <Globe className="w-3 h-3 text-cyan-400 transition-transform duration-300 group-hover:scale-110" />
              <span>Public Board (Everyone can edit)</span>
            </div>
          </Option>
        </Select>

        <div className="text-slate-400 text-xs mt-2 leading-relaxed" style={{ animationDelay: '0.3s' }}>
          {newBoardMode === 'host-only' 
            ? 'Only meeting hosts can edit this board. Participants can view only.' 
            : 'All participants can edit this board.'
          }
        </div>
      </div>
    )}
  </div>
</Modal>

{/* Rename Modal */}
<Modal
  title={
    <div className="flex items-center gap-2">
      <div className="terminal-toggle active">
        <Edit2 className="terminal-icon" />
      </div>
      <span className="text-slate-100 font-semibold text-sm">Rename Note</span>
    </div>
  }
  open={renameModalVisible}
  onOk={confirmRename}
  onCancel={() => { 
    setRenameModalVisible(false); 
    setRenameTarget(null); 
    setRenameValue(''); 
  }}
  okText="Rename"
  cancelText="Cancel"
  className="whiteboard-modal host-modal-style"
  width={380}
  transitionName="ant-zoom"
  maskTransitionName="ant-fade"
  styles={{
    body: { 
      padding: '20px',
      background: 'linear-gradient(180deg, rgba(15,23,42,0.95), rgba(7,17,26,0.95))',
      color: '#e2e8f0',
      borderRadius: '0 0 12px 12px',
      backdropFilter: 'blur(20px)',
      opacity: 0,
      transform: 'scale(0.95) translateY(-10px)',
      animation: 'modalEnter 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards'
    },
    header: {
      background: 'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(30,41,59,0.9))',
      borderBottom: '1px solid rgba(14, 165, 164, 0.15)',
      color: '#e2e8f0',
      borderRadius: '12px 12px 0 0',
      padding: '16px 20px',
      minHeight: 'auto',
      opacity: 0,
      transform: 'translateY(-10px)',
      animation: 'modalHeaderEnter 0.3s cubic-bezier(0.4, 0, 0.2, 1) 0.1s forwards'
    },
    content: {
      backgroundColor: 'transparent',
      backdropFilter: 'blur(20px)',
      borderRadius: '12px',
      boxShadow: '0 20px 40px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(14, 165, 164, 0.1)',
      border: 'none',
      opacity: 0,
      transform: 'scale(0.95)',
      animation: 'modalContentEnter 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards'
    },
    footer: {
      background: 'linear-gradient(180deg, rgba(15,23,42,0.8), rgba(7,17,26,0.9))',
      borderTop: '1px solid rgba(14, 165, 164, 0.1)',
      borderRadius: '0 0 12px 12px',
      padding: '16px 20px',
      marginTop: '8px',
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '8px'
    }
  }}
  okButtonProps={{
    className: 'modal-apply-btn animate-pulse-once'
  }}
  cancelButtonProps={{
    className: 'modal-cancel-btn'
  }}
  closeIcon={
    <div className="modal-close-btn">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path 
          d="M13 1L1 13M1 1L13 13" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          className="transition-all duration-300"
        />
      </svg>
    </div>
  }
>
  <div className="space-y-4 modal-content-inner">
    <div className="input-group " style={{ animationDelay: '0.1s' }}>
      <label className="text-slate-300 font-medium text-xs mb-2 block">New Name</label>
      <Input
        value={renameValue}
        onChange={(e) => setRenameValue(e.target.value)}
        placeholder="Enter new name"
        onPressEnter={confirmRename}
        className="modal-input"
        size="small"
      />
      <div className="text-slate-400 text-xs mt-2 leading-relaxed" style={{ animationDelay: '0.2s' }}>
        Renaming will be applied according to room permissions.
      </div>
    </div>
  </div>
</Modal>

{/* Share Modal */}
<Modal
  title={
    <div className="flex items-center gap-2">
      <div className="terminal-toggle active">
        <Share2 className="terminal-icon" />
      </div>
      <span className="text-slate-100 font-semibold text-sm">Share Private Note</span>
    </div>
  }
  open={shareModalVisible}
  onOk={confirmShareNote}
  onCancel={() => {
    setShareModalVisible(false);
    setShareTarget('');
    setNoteToShare(null);
  }}
  okText="Share Note"
  cancelText="Cancel"
  className="whiteboard-modal host-modal-style"
  width={380}
  transitionName="ant-zoom"
  maskTransitionName="ant-fade"
  styles={{
    body: { 
      padding: '20px',
      background: 'linear-gradient(180deg, rgba(15,23,42,0.95), rgba(7,17,26,0.95))',
      color: '#e2e8f0',
      borderRadius: '0 0 12px 12px',
      backdropFilter: 'blur(20px)',
      opacity: 0,
      transform: 'scale(0.95) translateY(-10px)',
      animation: 'modalEnter 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards'
    },
    header: {
      background: 'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(30,41,59,0.9))',
      borderBottom: '1px solid rgba(14, 165, 164, 0.15)',
      color: '#e2e8f0',
      borderRadius: '12px 12px 0 0',
      padding: '16px 20px',
      minHeight: 'auto',
      opacity: 0,
      transform: 'translateY(-10px)',
      animation: 'modalHeaderEnter 0.3s cubic-bezier(0.4, 0, 0.2, 1) 0.1s forwards'
    },
    content: {
      backgroundColor: 'transparent',
      backdropFilter: 'blur(20px)',
      borderRadius: '12px',
      boxShadow: '0 20px 40px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(14, 165, 164, 0.1)',
      border: 'none',
      opacity: 0,
      transform: 'scale(0.95)',
      animation: 'modalContentEnter 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards'
    },
    footer: {
      background: 'linear-gradient(180deg, rgba(15,23,42,0.8), rgba(7,17,26,0.9))',
      borderTop: '1px solid rgba(14, 165, 164, 0.1)',
      borderRadius: '0 0 12px 12px',
      padding: '16px 20px',
      marginTop: '8px',
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '8px'
    }
  }}
  okButtonProps={{
    className: 'modal-apply-btn animate-pulse-once'
  }}
  cancelButtonProps={{
    className: 'modal-cancel-btn'
  }}
  closeIcon={
    <div className="modal-close-btn">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path 
          d="M13 1L1 13M1 1L13 13" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          className="transition-all duration-300"
        />
      </svg>
    </div>
  }
>
  <div className="space-y-4 modal-content-inner">
    <div className="share-info text-slate-300 text-sm leading-relaxed mb-2" style={{ animationDelay: '0.1s' }}>
      Share this note with a participant. They will be able to view and edit it.
    </div>
    
    <div className="input-group" style={{ animationDelay: '0.2s' }}>
      <label className="text-slate-300 font-medium text-xs mb-2 block">Share with:</label>
      <Select
        placeholder="Select participant..."
        value={shareTarget}
        onChange={setShareTarget}
        className="modal-select"
        size="small"
        showSearch
        allowClear
        popupClassName="bg-slate-800 border-slate-700"
        filterOption={(input, option) =>
          option?.children?.toLowerCase().indexOf(input.toLowerCase()) >= 0
        }
        notFoundContent={
          participants.length === 0 ? (
            <div className="text-slate-400 text-xs p-2">No other participants in the session</div>
          ) : null
        }
      >
        {participants
          .filter(p => p && p !== userName)
          .map(participant => (
            <Option key={participant} value={participant}>
              <div className="flex items-center gap-2 text-xs transition-all duration-300 hover:text-cyan-300">
                <Users className="w-3 h-3 text-cyan-400 transition-transform duration-300 group-hover:scale-110" />
                <span>{participant}</span>
              </div>
            </Option>
          ))
        }
      </Select>
      {participants.length === 0 && (
        <div className="text-amber-400 text-xs mt-2 leading-relaxed " style={{ animationDelay: '0.3s' }}>
          There are no other participants to share with yet.
        </div>
      )}
    </div>
    
    {noteToShare && (
      <div className="share-preview text-slate-300 text-sm p-3 rounded-lg bg-gradient-to-r from-slate-800/40 to-slate-700/30 border border-slate-700/30" style={{ animationDelay: '0.4s' }}>
        Sharing: <strong className="text-cyan-300">{noteToShare.name}</strong>
      </div>
    )}
  </div>
</Modal>

      <style jsx>{`
      /* Private Note Delete Modal Specific Styles */
.private-note-delete-modal .ant-modal-confirm-btns {
  display: flex !important;
  gap: 12px !important;
  justify-content: flex-end !important;
  margin-top: 20px !important;
  padding-top: 16px !important;
  border-top: 1px solid rgba(71, 85, 105, 0.2) !important;
}

.private-note-delete-modal .ant-modal-confirm-body {
  padding: 0 !important;
}

.private-note-delete-modal .ant-modal-confirm-body > .anticon {
  display: none !important;
}

.private-note-delete-modal .ant-modal-confirm-body-wrapper {
  background: transparent !important;
}

/* Remove Button Styling (for shared notes) */
.modal-remove-btn {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 8px !important;
  padding: 8px 20px !important;
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.9), rgba(217, 119, 6, 0.8)) !important;
  border: 1px solid rgba(245, 158, 11, 0.3) !important;
  color: white !important;
  border-radius: 6px !important;
  font-size: 12px !important;
  font-weight: 500 !important;
  cursor: pointer !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
  backdrop-filter: blur(8px) !important;
  position: relative !important;
  overflow: hidden !important;
  min-width: 120px !important;
}

.modal-remove-btn:hover {
  background: linear-gradient(135deg, rgba(245, 158, 11, 1), rgba(217, 119, 6, 0.9)) !important;
  border-color: rgba(245, 158, 11, 0.5) !important;
  transform: translateY(-2px) scale(1.05) !important;
  box-shadow: 0 8px 25px rgba(245, 158, 11, 0.4) !important;
}

.modal-remove-btn::before {
  content: '' !important;
  position: absolute !important;
  top: 0 !important;
  left: -100% !important;
  width: 100% !important;
  height: 100% !important;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent) !important;
  transition: left 0.5s !important;
}

.modal-remove-btn:hover::before {
  left: 100% !important;
}

/* Delete Button Styling (for private notes) */
.modal-delete-btn {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 8px !important;
  padding: 8px 20px !important;
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.9), rgba(220, 38, 38, 0.8)) !important;
  border: 1px solid rgba(239, 68, 68, 0.3) !important;
  color: white !important;
  border-radius: 6px !important;
  font-size: 12px !important;
  font-weight: 500 !important;
  cursor: pointer !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
  backdrop-filter: blur(8px) !important;
  position: relative !important;
  overflow: hidden !important;
  min-width: 100px !important;
}

.modal-delete-btn:hover {
  background: linear-gradient(135deg, rgba(239, 68, 68, 1), rgba(220, 38, 38, 0.9)) !important;
  border-color: rgba(239, 68, 68, 0.5) !important;
  transform: translateY(-2px) scale(1.05) !important;
  box-shadow: 0 8px 25px rgba(239, 68, 68, 0.4) !important;
}

.modal-delete-btn::before {
  content: '' !important;
  position: absolute !important;
  top: 0 !important;
  left: -100% !important;
  width: 100% !important;
  height: 100% !important;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent) !important;
  transition: left 0.5s !important;
}

.modal-delete-btn:hover::before {
  left: 100% !important;
}

.modal-cancel-btn {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 8px !important;
  padding: 8px 20px !important;
  background: rgba(30, 41, 59, 0.6) !important;
  border: 1px solid rgba(71, 85, 105, 0.3) !important;
  color: #94a3b8 !important;
  border-radius: 6px !important;
  font-size: 12px !important;
  font-weight: 500 !important;
  cursor: pointer !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
  backdrop-filter: blur(8px) !important;
  min-width: 80px !important;
}

.modal-cancel-btn:hover {
  background: rgba(51, 65, 85, 0.8) !important;
  border-color: rgba(100, 116, 139, 0.4) !important;
  color: #cbd5e1 !important;
  transform: translateY(-2px) scale(1.05) !important;
}

/* Note preview styling */
.private-note-delete-modal .note-preview {
  background: linear-gradient(135deg, rgba(30, 41, 59, 0.4), rgba(15, 23, 42, 0.6));
  border: 1px solid rgba(14, 165, 164, 0.1);
  border-radius: 8px;
  padding: 12px;
  margin-top: 12px;
}

/* Modal animations */
.private-note-delete-modal .ant-modal-content {
  animation: modalContentEnter 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
}

@keyframes modalContentEnter {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

/* Delete icon animation */
.private-note-delete-modal .terminal-toggle {
  animation: gentlePulse 2s ease-in-out infinite !important;
}

@keyframes gentlePulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.05); opacity: 0.8; }
}
      /* Delete Confirmation Modal Styles */
.delete-confirm-modal .ant-modal-confirm-btns {
  display: flex !important;
  gap: 12px !important;
  justify-content: flex-end !important;
  margin-top: 20px !important;
  padding-top: 16px !important;
  border-top: 1px solid rgba(239, 68, 68, 0.1) !important;
}

.delete-confirm-modal .ant-modal-confirm-body {
  padding: 0 !important;
}

.delete-confirm-modal .ant-modal-confirm-body > .anticon {
  display: none !important;
}

.delete-confirm-modal .ant-modal-confirm-body-wrapper {
  background: transparent !important;
}

/* Delete Button Styling */
.modal-delete-btn {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 8px !important;
  padding: 8px 20px !important;
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.9), rgba(220, 38, 38, 0.8)) !important;
  border: 1px solid rgba(239, 68, 68, 0.3) !important;
  color: white !important;
  border-radius: 6px !important;
  font-size: 12px !important;
  font-weight: 500 !important;
  cursor: pointer !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
  backdrop-filter: blur(8px) !important;
  position: relative !important;
  overflow: hidden !important;
  min-width: 80px !important;
}

.modal-delete-btn:hover {
  background: linear-gradient(135deg, rgba(239, 68, 68, 1), rgba(220, 38, 38, 0.9)) !important;
  border-color: rgba(239, 68, 68, 0.5) !important;
  transform: translateY(-2px) scale(1.05) !important;
  box-shadow: 0 8px 25px rgba(239, 68, 68, 0.4) !important;
}

.modal-delete-btn::before {
  content: '' !important;
  position: absolute !important;
  top: 0 !important;
  left: -100% !important;
  width: 100% !important;
  height: 100% !important;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent) !important;
  transition: left 0.5s !important;
}

.modal-delete-btn:hover::before {
  left: 100% !important;
}

.modal-cancel-btn {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 8px !important;
  padding: 8px 20px !important;
  background: rgba(30, 41, 59, 0.6) !important;
  border: 1px solid rgba(71, 85, 105, 0.3) !important;
  color: #94a3b8 !important;
  border-radius: 6px !important;
  font-size: 12px !important;
  font-weight: 500 !important;
  cursor: pointer !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
  backdrop-filter: blur(8px) !important;
  min-width: 80px !important;
}

.modal-cancel-btn:hover {
  background: rgba(51, 65, 85, 0.8) !important;
  border-color: rgba(100, 116, 139, 0.4) !important;
  color: #cbd5e1 !important;
  transform: translateY(-2px) scale(1.05) !important;
}

/* Delete icon animation */
.delete-confirm-modal .terminal-toggle {
  animation: shake 0.5s cubic-bezier(0.4, 0, 0.2, 1) !important;
}

@keyframes shake {
  0%, 100% { transform: translateX(0) scale(1); }
  25% { transform: translateX(-2px) scale(1.1); }
  75% { transform: translateX(2px) scale(1.1); }
}

/* Modal animations */
.delete-confirm-modal .ant-modal-content {
  animation: modalContentEnter 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
}

@keyframes modalContentEnter {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
      /* Enhanced Modal Animations */
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

.animate-fadeInUp {
  animation: fadeInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

.animate-pulse-once {
  animation: pulseOnce 0.6s cubic-bezier(0.4, 0, 0.2, 1);
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

/* White Close Button */
.modal-close-btn {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: 12px !important;
  height: 12px !important;
  border-radius: 6px !important;
  background: transparent !important;
  border: 1px solid rgba(148, 163, 184, 0.08) !important;
  color: #8fa09fff !important;
  cursor: pointer !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
  backdrop-filter: blur(4px) !important;
  position: relative !important;
  top: -15px !important;
  right: -14px !important;
}

.modal-close-btn:hover {
  background: rgba(239, 68, 68, 0.1) !important;
  border-color: rgba(239, 68, 68, 0.3) !important;
  color: #fecaca !important;
  transform: scale(1.1) !important;
}

/* Enhanced Button Group Styling */
.ant-modal-footer {
  display: flex !important;
  justify-content: flex-end !important;
  gap: 8px !important;
  padding: 16px 20px !important;
}

/* Modal Input with Animations */
.modal-input .ant-input {
  background: rgba(30, 41, 59, 0.6) !important;
  border: 1px solid rgba(71, 85, 105, 0.3) !important;
  border-radius: 6px !important;
  color: #e2e8f0 !important;
  font-size: 12px !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
}

.modal-input .ant-input:hover {
  border-color: rgba(14, 165, 164, 0.4) !important;
  background: rgba(30, 41, 59, 0.8) !important;
  transform: translateY(-1px);
}

.modal-input .ant-input:focus {
  border-color: rgba(14, 165, 164, 0.6) !important;
  background: rgba(30, 41, 59, 0.9) !important;
  box-shadow: 0 0 0 2px rgba(14, 165, 164, 0.1) !important;
  transform: translateY(-1px) scale(1.02);
}

/* Enhanced Select Options with Hover Animations */
.ant-select-item {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
}


/* Terminal toggle with enhanced animations */
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
  transform: scale(1.1);
}

.terminal-toggle.active {
  background: linear-gradient(135deg, rgba(14, 165, 164, 0.15), rgba(14, 116, 144, 0.1));
  border-color: rgba(14, 165, 164, 0.3);
  animation: pulseOnce 2s infinite;
}

.terminal-icon {
  font-size: 10px;
  transition: all 0.3s ease;
}

.terminal-toggle:hover .terminal-icon {
  transform: scale(1.2);
}

/* Modal Apply Button with Enhanced Animations */
.modal-apply-btn {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 8px !important;
  padding: 8px 20px !important;
  background: linear-gradient(135deg, rgba(14, 165, 164, 0.9), rgba(14, 116, 144, 0.8)) !important;
  border: 1px solid rgba(14, 165, 164, 0.3) !important;
  color: white !important;
  border-radius: 6px !important;
  font-size: 12px !important;
  font-weight: 500 !important;
  cursor: pointer !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
  backdrop-filter: blur(8px) !important;
  position: relative !important;
  overflow: hidden !important;
  min-width: 80px !important;
}

.modal-apply-btn:hover {
  background: linear-gradient(135deg, rgba(14, 165, 164, 1), rgba(14, 116, 144, 0.9)) !important;
  border-color: rgba(14, 165, 164, 0.5) !important;
  transform: translateY(-2px) scale(1.05) !important;
  box-shadow: 0 8px 25px rgba(14, 165, 164, 0.4) !important;
}

.modal-apply-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  transition: left 0.5s;
}

.modal-apply-btn:hover::before {
  left: 100%;
}

.modal-cancel-btn {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 8px !important;
  padding: 8px 20px !important;
  background: rgba(30, 41, 59, 0.6) !important;
  border: 1px solid rgba(71, 85, 105, 0.3) !important;
  color: #94a3b8 !important;
  border-radius: 6px !important;
  font-size: 12px !important;
  font-weight: 500 !important;
  cursor: pointer !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
  backdrop-filter: blur(8px) !important;
  min-width: 80px !important;
}

.modal-cancel-btn:hover {
  background: rgba(51, 65, 85, 0.8) !important;
  border-color: rgba(100, 116, 139, 0.4) !important;
  color: #cbd5e1 !important;
  transform: translateY(-2px) scale(1.05) !important;
}
        /* Enhanced Animations & Transitions matching ParticipantsList */
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

        .animate-slideInUp {
          animation: slideInUp 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .animate-fadeInUp {
          animation: fadeInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .animate-fadeIn {
          animation: fadeIn 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }

        /* Main Container */
        .whiteboard-container {
          height: 100%;
          display: flex;
          flex-direction: column;
          background: linear-gradient(180deg, #0a1628 0%, #0f172a 100%);
          color: #e2e8f0;
          font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
          position: relative;
          overflow: hidden;
        }

        .whiteboard-container::before {
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

        .whiteboard-container > * {
          position: relative;
          z-index: 1;
        }

        /* Header Styling - Smaller to match sidebar */
        .whiteboard-header {
          padding: 12px 16px;
          background: linear-gradient(135deg, rgba(15,23,42,0.95), rgba(7,17,27,0.95));
          border-bottom: 1px solid rgba(14, 165, 164, 0.08);
          backdrop-filter: blur(12px);
          transition: all 0.3s ease;
        }

        .whiteboard-header:hover {
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
          width: 14px;
          height: 14px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          filter: drop-shadow(0 0 6px rgba(14, 165, 164, 0.2));
        }

        .title-section.group:hover .icon-container {
          background: linear-gradient(135deg, rgba(14, 165, 164, 0.2), rgba(14, 116, 144, 0.2));
          border-color: rgba(14, 165, 164, 0.3);
          transform: translateY(-2px) scale(1.05);
          box-shadow: 0 8px 25px rgba(14, 165, 164, 0.15);
        }

        .title-section.group:hover .title-icon {
          transform: scale(1.1);
          animation: iconBounce 0.6s ease;
          filter: drop-shadow(0 0 12px rgba(14, 165, 164, 0.4));
        }

        .title-text {
          font-size: 12px;
          font-weight: 700;
          color: #f1f5f9;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          transition: all 0.3s ease;
        }

        .title-section.group:hover .title-text {
          color: #0ea5a4;
          text-shadow: 0 0 8px rgba(14, 165, 164, 0.2);
        }

        /* Create Button - Smaller */
        .create-section {
          flex-shrink: 0;
        }

        .create-button {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          background: linear-gradient(135deg, rgba(14, 165, 164, 0.1), rgba(14, 116, 144, 0.1));
          border: 1px solid rgba(14, 165, 164, 0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          backdrop-filter: blur(8px);
        }

        .create-button:hover {
          background: linear-gradient(135deg, rgba(14, 165, 164, 0.2), rgba(14, 116, 144, 0.2));
          border-color: rgba(14, 165, 164, 0.3);
          transform: translateY(-2px) scale(1.05);
          box-shadow: 0 8px 25px rgba(14, 165, 164, 0.15);
        }

        .create-icon {
          color: #0ea5a4;
          width: 14px;
          height: 14px;
          transition: all 0.3s ease;
          filter: drop-shadow(0 0 6px rgba(14, 165, 164, 0.2));
        }

        .create-button.group:hover .create-icon {
          transform: scale(1.1) rotate(90deg);
          filter: drop-shadow(0 0 12px rgba(14, 165, 164, 0.4));
        }

        /* Body and Tab Bubbles - Smaller */
        .whiteboard-body {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 0;
          background: linear-gradient(180deg, rgba(2,6,23,0.0), rgba(2,6,23,0.02));
        }

        .tab-bubbles {
          padding: 12px 16px 8px;
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .tab-bubble {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          border-radius: 12px;
          background: linear-gradient(135deg, rgba(15,23,42,0.4), rgba(12,18,28,0.3));
          border: 1px solid rgba(14, 165, 164, 0.06);
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          backdrop-filter: blur(6px);
          font-size: 10px;
          font-weight: 500;
          color: #94a3b8;
        }

        .tab-bubble:hover {
          background: linear-gradient(135deg, rgba(15,23,42,0.6), rgba(12,18,28,0.4));
          border-color: rgba(14, 165, 164, 0.12);
          transform: translateY(-1px) scale(1.02);
          color: #cbd5e1;
        }

        .tab-bubble.tab-active {
          background: linear-gradient(135deg, rgba(14, 165, 164, 0.15), rgba(14, 116, 144, 0.1));
          border-color: rgba(14, 165, 164, 0.3);
          color: #0ea5a4;
          box-shadow: 0 2px 8px rgba(14, 165, 164, 0.1);
        }

        .tab-icon {
          width: 10px;
          height: 10px;
          transition: all 0.3s ease;
        }

        .tab-bubble:hover .tab-icon,
        .tab-bubble.tab-active .tab-icon {
          transform: scale(1.1);
        }

        .tab-count {
          font-weight: 600;
          font-size: 9px;
          min-width: 12px;
          height: 12px;
          border-radius: 6px;
          background: rgba(14, 165, 164, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
        }

        .tab-bubble.tab-active .tab-count {
          background: rgba(14, 165, 164, 0.2);
          color: #0ea5a4;
        }

        /* Notes Content */
        .notes-content {
          flex: 1;
          overflow-y: auto;
          padding: 0 16px 16px;
        }

        .notes-content::-webkit-scrollbar {
          width: 4px;
        }

        .notes-content::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.3);
          border-radius: 2px;
        }

        .notes-content::-webkit-scrollbar-thumb {
          background: rgba(14, 165, 164, 0.2);
          border-radius: 2px;
          transition: background 0.3s ease;
        }

        .notes-content::-webkit-scrollbar-thumb:hover {
          background: rgba(14, 165, 164, 0.4);
        }

        /* Notes List - Smaller items */
        .notes-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .note-item {
          background: linear-gradient(135deg, rgba(15,23,42,0.4), rgba(12,18,28,0.3));
          border: 1px solid rgba(14, 165, 164, 0.06);
          border-radius: 10px;
          padding: 10px;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          backdrop-filter: blur(8px);
          position: relative;
          overflow: hidden;
          cursor: pointer;
        }

        .note-item::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(14, 165, 164, 0.2), transparent);
          transition: all 0.3s ease;
        }

        .note-item:hover {
          background: linear-gradient(135deg, rgba(15,23,42,0.6), rgba(12,18,28,0.4));
          border-color: rgba(14, 165, 164, 0.12);
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(2,6,23,0.4);
        }

        .note-item:hover::before {
          background: linear-gradient(90deg, transparent, rgba(14, 165, 164, 0.4), transparent);
          height: 2px;
        }

        .note-content {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        /* Note Avatar - Smaller */
        .note-avatar-section {
          flex-shrink: 0;
        }

        .note-avatar-container {
          position: relative;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .note-item:hover .note-avatar-container {
          transform: scale(1.05);
        }

        .note-avatar {
          width: 24px;
          height: 24px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .avatar-shared {
          background: linear-gradient(135deg, #3b82f6, #1d4ed8);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
        }

        .avatar-private {
          background: linear-gradient(135deg, #8b5cf6, #7c3aed);
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.15);
        }

        .avatar-host {
          background: linear-gradient(135deg, #fbbf24, #f59e0b);
          box-shadow: 0 4px 12px rgba(251, 191, 36, 0.15);
        }

        .avatar-public {
          background: linear-gradient(135deg, #10b981, #059669);
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.15);
        }

        /* Note Info - Smaller text */
        .note-info {
          flex: 1;
          min-width: 0;
        }

        .note-name-section {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 3px;
          justify-content: space-between;
        }

        .note-name {
          font-size: 11px;
          font-weight: 600;
          color: #e2e8f0;
          transition: color 0.3s ease;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
          flex: 1;
        }

        .note-item:hover .note-name {
          color: #f1f5f9;
        }

        .note-badges {
          display: flex;
          align-items: center;
          gap: 4px;
          flex-shrink: 0;
        }

        .access-badge {
          display: flex;
          align-items: center;
          font-size: 8px;
          font-weight: 600;
          padding: 1px 4px;
          border-radius: 4px;
          transition: all 0.3s ease;
          backdrop-filter: blur(4px);
        }

        .badge-edit {
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.2);
          color: #10b981;
        }

        .badge-view {
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.2);
          color: #3b82f6;
        }

        .note-item:hover .badge-edit {
          background: rgba(16, 185, 129, 0.15);
          border-color: rgba(16, 185, 129, 0.3);
        }

        .note-item:hover .badge-view {
          background: rgba(59, 130, 246, 0.15);
          border-color: rgba(59, 130, 246, 0.3);
        }

        .badge-icon {
          margin-right: 1px;
        }

        .note-description {
          font-size: 9px;
          color: #94a3b8;
          transition: color 0.3s ease;
        }

        .note-item:hover .note-description {
          color: #cbd5e1;
        }

        .note-date {
          margin-top: 1px;
          opacity: 0.8;
        }

        /* Note Controls - Smaller buttons */
        .note-controls {
          display: flex;
          align-items: center;
          gap: 4px;
          flex-shrink: 0;
        }

        .control-button {
          background: transparent;
          border: 1px solid rgba(148,163,184,0.08);
          border-radius: 4px;
          padding: 3px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          backdrop-filter: blur(4px);
        }

        .control-icon {
          width: 10px;
          height: 10px;
          transition: all 0.3s ease;
        }

        .share-button {
          color: #3b82f6;
        }

        .share-button:hover {
          background: rgba(59, 130, 246, 0.08);
          border-color: rgba(59, 130, 246, 0.2);
          transform: translateY(-1px) scale(1.1);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
        }

        .rename-button {
          color: #fbbf24;
        }

        .rename-button:hover {
          background: rgba(251, 191, 36, 0.08);
          border-color: rgba(251, 191, 36, 0.2);
          transform: translateY(-1px) scale(1.1);
          box-shadow: 0 4px 12px rgba(251, 191, 36, 0.15);
        }

        .delete-button {
          color: #f87171;
        }

        .delete-button:hover {
          background: rgba(248, 113, 113, 0.08);
          border-color: rgba(248, 113, 113, 0.2);
          transform: translateY(-1px) scale(1.1);
          box-shadow: 0 4px 12px rgba(248, 113, 113, 0.15);
        }

        /* Empty State - Smaller */
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 30px 16px;
          text-align: center;
          opacity: 0.8;
        }

        .empty-icon-container {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: linear-gradient(135deg, rgba(14, 165, 164, 0.1), rgba(14, 116, 144, 0.1));
          border: 1px solid rgba(14, 165, 164, 0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 12px;
          transition: all 0.3s ease;
        }

        .empty-icon {
          width: 18px;
          height: 18px;
          color: #94a3b8;
          opacity: 0.6;
          transition: all 0.3s ease;
        }

        .empty-state:hover .empty-icon-container {
          background: linear-gradient(135deg, rgba(14, 165, 164, 0.15), rgba(14, 116, 144, 0.15));
          border-color: rgba(14, 165, 164, 0.25);
          transform: translateY(-2px);
        }

        .empty-state:hover .empty-icon {
          color: #0ea5a4;
          opacity: 0.8;
          transform: scale(1.1);
        }

        .empty-text {
          max-width: 160px;
        }

        .empty-title {
          font-size: 12px;
          font-weight: 600;
          color: #94a3b8;
          margin: 0;
          transition: color 0.3s ease;
        }

        .empty-state:hover .empty-title {
          color: #cbd5e1;
        }

        /* Modal Styling - Smaller */
        :global(.whiteboard-modal .ant-modal-content) {
          background: linear-gradient(180deg, #0f172a, #071126) !important;
          border: 1px solid rgba(14, 165, 164, 0.15) !important;
          border-radius: 12px !important;
          box-shadow: 0 20px 60px rgba(2,6,23,0.6) !important;
          backdrop-filter: blur(20px) !important;
        }

        :global(.whiteboard-modal .ant-modal-header) {
          background: transparent !important;
          border-bottom: 1px solid rgba(14, 165, 164, 0.1) !important;
          padding: 16px 20px 12px !important;
        }

        :global(.whiteboard-modal .ant-modal-body) {
          padding: 16px 20px !important;
        }

        :global(.whiteboard-modal .ant-modal-footer) {
          background: transparent !important;
          border-top: 1px solid rgba(14, 165, 164, 0.1) !important;
          padding: 12px 20px 16px !important;
        }

        .modal-title {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #f1f5f9 !important;
          font-weight: 600 !important;
          font-size: 14px !important;
        }

        .modal-title-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border-radius: 6px;
          background: linear-gradient(135deg, rgba(14, 165, 164, 0.1), rgba(14, 116, 144, 0.1));
          border: 1px solid rgba(14, 165, 164, 0.15);
          color: #0ea5a4;
        }

        .modal-content {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .input-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .input-label {
          font-size: 11px;
          font-weight: 600;
          color: #e2e8f0;
          margin: 0;
        }

        :global(.whiteboard-modal .modal-input) {
          background: rgba(15, 23, 42, 0.6) !important;
          border: 1px solid rgba(14, 165, 164, 0.1) !important;
          border-radius: 8px !important;
          padding: 8px 12px !important;
          font-size: 11px !important;
          color: #e2e8f0 !important;
          transition: all 0.3s ease !important;
        }

        :global(.whiteboard-modal .modal-input:hover) {
          border-color: rgba(14, 165, 164, 0.2) !important;
          background: rgba(15, 23, 42, 0.8) !important;
        }

        :global(.whiteboard-modal .modal-input:focus) {
          border-color: rgba(14, 165, 164, 0.4) !important;
          background: rgba(15, 23, 42, 0.9) !important;
          box-shadow: 0 0 0 3px rgba(14, 165, 164, 0.1) !important;
        }

        :global(.whiteboard-modal .ant-select-selector) {
          background: rgba(15, 23, 42, 0.6) !important;
          border: 1px solid rgba(14, 165, 164, 0.1) !important;
          border-radius: 8px !important;
          padding: 2px 6px !important;
          height: auto !important;
          min-height: 32px !important;
          transition: all 0.3s ease !important;
        }

        :global(.whiteboard-modal .ant-select-selector) {
          border-color: rgba(14, 165, 164, 0.2) !important;
          background: rgba(15, 23, 42, 0.8) !important;
        }

        :global(.whiteboard-modal.ant-select-focused .ant-select-selector) {
          border-color: rgba(14, 165, 164, 0.4) !important;
          background: rgba(15, 23, 42, 0.9) !important;
          box-shadow: 0 0 0 3px rgba(14, 165, 164, 0.1) !important;
        }

        .select-option {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #e2e8f0;
          font-size: 11px;
        }

        .select-icon {
          width: 12px;
          height: 12px;
          color: #0ea5a4;
        }

        .select-empty {
          padding: 8px;
          text-align: center;
          color: #94a3b8;
          font-style: italic;
          font-size: 11px;
        }

        .input-help {
          font-size: 10px;
          color: #94a3b8;
          line-height: 1.4;
        }

        .input-help.warning {
          color: #fbbf24;
        }

        .share-info {
          font-size: 11px;
          color: #cbd5e1;
          line-height: 1.4;
        }

        .share-preview {
          background: rgba(14, 165, 164, 0.1);
          border: 1px solid rgba(14, 165, 164, 0.2);
          border-radius: 6px;
          padding: 8px;
          font-size: 10px;
          color: #e2e8f0;
        }

        /* Modal Button Styling - Smaller */
        :global(.whiteboard-modal .ant-btn) {
          font-size: 11px !important;
          height: 28px !important;
          padding: 0 12px !important;
        }

        :global(.whiteboard-modal .ant-btn-primary) {
          background: linear-gradient(135deg, #0ea5a4, #0891b2) !important;
          border: 1px solid rgba(14, 165, 164, 0.3) !important;
          border-radius: 6px !important;
          font-weight: 600 !important;
          transition: all 0.3s ease !important;
        }

        :global(.whiteboard-modal .ant-btn-primary:hover) {
          background: linear-gradient(135deg, #0891b2, #0e7490) !important;
          border-color: rgba(14, 165, 164, 0.5) !important;
          transform: translateY(-1px) !important;
          box-shadow: 0 4px 12px rgba(14, 165, 164, 0.2) !important;
        }

        :global(.whiteboard-modal .ant-btn-default) {
          background: rgba(15, 23, 42, 0.6) !important;
          border: 1px solid rgba(148, 163, 184, 0.2) !important;
          border-radius: 6px !important;
          color: #e2e8f0 !important;
          font-weight: 500 !important;
          transition: all 0.3s ease !important;
        }

        :global(.whiteboard-modal .ant-btn-default:hover) {
          background: rgba(15, 23, 42, 0.8) !important;
          border-color: rgba(148, 163, 184, 0.3) !important;
          color: #f1f5f9 !important;
          transform: translateY(-1px) !important;
        }

        /* Dropdown Styling - Smaller */
        :global(.ant-select-dropdown) {
          background: linear-gradient(180deg, #0f172a, #071126) !important;
          border: 1px solid rgba(14, 165, 164, 0.15) !important;
          border-radius: 8px !important;
          box-shadow: 0 12px 40px rgba(2,6,23,0.5) !important;
          backdrop-filter: blur(16px) !important;
        }

        :global(.ant-select-item) {
          color: #e2e8f0 !important;
          font-size: 11px !important;
          min-height: 28px !important;
          padding: 6px 12px !important;
          transition: all 0.3s ease !important;
        }

        :global(.ant-select-item:hover) {
          background: rgba(14, 165, 164, 0.08) !important;
          color: #0ea5a4 !important;
        }

        :global(.ant-select-item-option-selected) {
          background: rgba(14, 165, 164, 0.1) !important;
          color: #0ea5a4 !important;
        }

        /* Tooltip Styling */
        :global(.ant-tooltip-inner) {
          background: linear-gradient(135deg, #0f172a, #071126) !important;
          border: 1px solid rgba(14, 165, 164, 0.2) !important;
          color: #e2e8f0 !important;
          border-radius: 6px !important;
          backdrop-filter: blur(12px) !important;
          box-shadow: 0 8px 25px rgba(2,6,23,0.4) !important;
          font-size: 10px !important;
        }

        :global(.ant-tooltip-arrow::before) {
          background: linear-gradient(135deg, #0f172a, #071126) !important;
          border: 1px solid rgba(14, 165, 164, 0.2) !important;
        }

        /* Mobile Responsiveness */
        @media (max-width: 768px) {
          .whiteboard-header {
            padding: 10px 12px;
          }

          .header-content {
            gap: 8px;
          }

          .title-text {
            font-size: 11px;
          }

          .icon-container,
          .create-button {
            width: 24px;
            height: 24px;
          }

          .title-icon,
          .create-icon {
            width: 12px;
            height: 12px;
          }

          .tab-bubbles {
            padding: 10px 12px 6px;
            gap: 4px;
          }

          .tab-bubble {
            padding: 3px 6px;
            font-size: 9px;
          }

          .tab-icon {
            width: 8px;
            height: 8px;
          }

          .tab-count {
            font-size: 8px;
            min-width: 10px;
            height: 10px;
          }

          .notes-content {
            padding: 0 12px 12px;
          }

          .notes-list {
            gap: 6px;
          }

          .note-item {
            padding: 8px;
          }

          .note-content {
            gap: 8px;
          }

          .note-avatar {
            width: 20px;
            height: 20px;
          }

          .note-name {
            font-size: 10px;
          }

          .note-description {
            font-size: 8px;
          }

          .control-icon {
            width: 8px;
            height: 8px;
          }
        }

        @media (max-width: 480px) {
          .whiteboard-header {
            padding: 8px 10px;
          }

          .header-content {
            gap: 6px;
          }

          .tab-bubbles {
            padding: 8px 10px 4px;
            gap: 3px;
          }

          .tab-bubble {
            padding: 2px 4px;
            font-size: 8px;
          }

          .notes-content {
            padding: 0 10px 10px;
          }

          .note-item {
            padding: 6px;
          }

          .note-content {
            gap: 6px;
          }

          .note-controls {
            gap: 2px;
          }
        }

        /* Performance Optimizations */
        .whiteboard-container {
          will-change: transform;
          backface-visibility: hidden;
        }

        .note-item,
        .tab-bubble,
        .control-button,
        .create-button {
          will-change: transform, box-shadow;
        }

        /* Text Selection */
        .whiteboard-container *::selection {
          background: rgba(14, 165, 164, 0.2);
          color: #f1f5f9;
        }

        /* Accessibility */
        .note-item:focus-within,
        .tab-bubble:focus-visible,
        .control-button:focus-visible,
        .create-button:focus-visible {
          outline: 2px solid rgba(14, 165, 164, 0.6) !important;
          outline-offset: 2px !important;
        }

        /* Smooth Scrolling */
        * {
          scroll-behavior: smooth;
        }
      `}</style>
    </>
  );
}