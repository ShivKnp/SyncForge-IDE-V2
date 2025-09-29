
export default PrivateNotesManager;import React, { useState, useReducer, useEffect, useCallback } from 'react';
import { Tldraw, useEditor } from 'tldraw';
import { Button, List, Input, Modal, message, Tooltip, Dropdown, Menu, Select } from 'antd';
import { 
    ChevronLeft, 
    Save, 
    Plus, 
    Trash2, 
    Share2, 
    Copy, 
    Eye, 
    Users,
    Send,
    Edit2,
    FileText
} from 'lucide-react';

const { Option } = Select;

const getPrivateNotesKey = (userName) => `codecrew-private-notes-${userName || 'anonymous'}`;

// A custom component to add a Save button to the Tldraw UI
const SaveButton = ({ onSave }) => {
    const editor = useEditor();
    const handleSaveClick = useCallback(() => {
        const snapshot = editor.getSnapshot();
        onSave(snapshot);
    }, [editor, onSave]);

    return (
        <button
            onClick={handleSaveClick}
            className="tldraw-save-button"
        >
            <Save className="w-4 h-4" />
            Save
        </button>
    );
};

const ShareButton = ({ onShare, noteData, participants }) => {
    const editor = useEditor();
    const [shareModalVisible, setShareModalVisible] = useState(false);
    const [shareTarget, setShareTarget] = useState('');
    
    const handleShareClick = useCallback(() => {
        setShareModalVisible(true);
    }, []);

    const handleConfirmShare = useCallback(() => {
        if (!shareTarget.trim()) {
            message.error('Please select a participant to share with');
            return;
        }
        
        const snapshot = editor.getSnapshot();
        onShare(noteData.id, snapshot, shareTarget.trim());
        setShareModalVisible(false);
        setShareTarget('');
    }, [editor, onShare, noteData.id, shareTarget]);

    return (
        <>
            <button
                onClick={handleShareClick}
                className="tldraw-share-button"
            >
                <Share2 className="w-4 h-4" />
                Share
            </button>
            
            <Modal
                title={
                    <div className="modal-title">
                        <div className="modal-title-icon">
                            <Share2 className="w-5 h-5" />
                        </div>
                        <span>Share Private Note</span>
                    </div>
                }
                open={shareModalVisible}
                onOk={handleConfirmShare}
                onCancel={() => {
                    setShareModalVisible(false);
                    setShareTarget('');
                }}
                okText="Share Note"
                cancelText="Cancel"
                className="private-notes-modal"
            >
                <div className="modal-content">
                    <div className="share-info">
                        Share this note with a participant. They will be able to view and edit it.
                    </div>
                    
                    <div className="input-group">
                        <label className="input-label">Share with:</label>
                        <Select
                            placeholder="Select participant..."
                            value={shareTarget}
                            onChange={setShareTarget}
                            className="modal-select"
                            showSearch
                            allowClear
                            filterOption={(input, option) =>
                                option?.children?.toLowerCase().indexOf(input.toLowerCase()) >= 0
                            }
                        >
                            {participants.map(participant => (
                                <Option key={participant} value={participant}>
                                    <div className="select-option">
                                        <Users className="select-icon" />
                                        {participant}
                                    </div>
                                </Option>
                            ))}
                        </Select>
                    </div>
                </div>
            </Modal>
        </>
    );
};

const PrivateNotesManager = ({ onBack, sessionId, userName, isHost, onCreateBoard, participants = [], docRef }) => {
    const getPrivateNotesKey = useCallback(() => {
        return `codecrew-private-notes-${userName || 'anonymous'}`;
    }, [userName]);

    const [notes, setNotes] = useState(() => {
        try {
            const saved = localStorage.getItem(getPrivateNotesKey());
            return saved ? JSON.parse(saved) : {};
        } catch (e) {
            return {};
        }
    });

    const [activeNoteId, setActiveNoteId] = useState(null);
    const [isCreateModalVisible, setCreateModalVisible] = useState(false);
    const [newNoteName, setNewNoteName] = useState('');
    const [sharedNotesState, setSharedNotesState] = useState({});

    // Listen to ShareDB document changes for shared notes
    useEffect(() => {
        if (!docRef?.current) return;

        const handleDocUpdate = () => {
            const doc = docRef.current;
            if (!doc?.data) return;

            // Only reflect the shared notes object into component state
            const sharedNotesFromDoc = doc.data.sharedNotes || {};
            // Update only if we want to display them somewhere else; do NOT merge into local notes that are persisted
            setNotes(prevNotes => {
                const updated = { ...prevNotes };
                const myShared = sharedNotesFromDoc[userName] || {};
                Object.keys(myShared).forEach(id => {
                    // if we already have a local note with same id and it's marked shared, keep/refresh it;
                    // otherwise, do NOT copy it into local 'notes' so it doesn't show in Private Notes
                    if (updated[id] && updated[id].shared) {
                        updated[id] = { ...myShared[id], shared: true, sharedFrom: myShared[id].sharedFrom };
                    }
                });
                return updated;
            });

            // Keep a separate shared map state if you need to render these directly:
            setSharedNotesState(sharedNotesFromDoc);
        };

        if (docRef.current.on) {
            docRef.current.on('op', handleDocUpdate);
        }
        handleDocUpdate();

        return () => {
            if (docRef.current?.off) docRef.current.off('op', handleDocUpdate);
        };
    }, [docRef, userName]);

    useEffect(() => {
        const key = getPrivateNotesKey();
        // Only save non-shared notes to localStorage
        const notesToSave = {};
        Object.keys(notes).forEach(noteId => {
            if (!notes[noteId].shared) {
                notesToSave[noteId] = notes[noteId];
            }
        });
        localStorage.setItem(key, JSON.stringify(notesToSave));
    }, [notes, getPrivateNotesKey]);

    const handleCreateNote = () => {
        if (!newNoteName.trim()) {
            message.error('Note name is required');
            return;
        }

        const noteId = `note_${Date.now()}`;
        setNotes(prev => ({
            ...prev,
            [noteId]: { 
                id: noteId, 
                name: newNoteName.trim(), 
                snapshot: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                shared: false,
                isPrivateNote: true
            }
        }));

        setNewNoteName('');
        setCreateModalVisible(false);
        setActiveNoteId(noteId);
        message.success('Private note created!');
    };
    
    const handleDeleteNote = (noteId) => {
        const noteToDelete = notes[noteId];
        if (!noteToDelete) return;

        Modal.confirm({
            title: 'Delete this note?',
            content: noteToDelete.shared 
                ? 'This will remove the shared note from your view.' 
                : 'This action cannot be undone.',
            okType: 'danger',
            className: 'private-notes-modal',
            onOk: () => {
                if (noteToDelete.shared) {
                    // Remove from shared notes in document
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

                setNotes(prev => {
                    const newNotes = { ...prev };
                    delete newNotes[noteId];
                    return newNotes;
                });
                
                if (activeNoteId === noteId) {
                    setActiveNoteId(null);
                }
                message.success('Note deleted');
            }
        });
    };

    const handleSaveNote = (noteId, snapshot) => {
        setNotes(prev => ({
            ...prev,
            [noteId]: { 
                ...prev[noteId], 
                snapshot,
                updatedAt: new Date().toISOString()
            }
        }));
        message.success('Note saved!');
    };

    const handleShareNote = (noteId, snapshot, targetParticipant) => {
        const note = notes[noteId];
        if (!note) return;

        if (note.shared) {
            message.error('Cannot share a note that was already shared with you');
            return;
        }

        if (!docRef?.current) {
            message.error('Unable to share note - document not available');
            return;
        }

        if (!targetParticipant || !targetParticipant.trim()) {
            message.error('Please select a participant to share with');
            return;
        }

        try {
            // Create shared note object
            const sharedNote = {
                ...note,
                snapshot,
                sharedFrom: userName,
                sharedAt: new Date().toISOString(),
                originalId: note.id
            };

            // Update ShareDB document with shared note
            const currentSharedNotes = docRef.current.data.sharedNotes || {};
            const targetUserNotes = { ...(currentSharedNotes[targetParticipant] || {}) };
            targetUserNotes[note.id] = sharedNote;

            docRef.current.submitOp(
                [{ p: ['sharedNotes', targetParticipant], oi: targetUserNotes }],
                { source: 'share-note' }
            );

            message.success(`Note "${note.name}" shared with ${targetParticipant}!`);
        } catch (error) {
            console.error('Failed to share note:', error);
            message.error('Failed to share note');
        }
    };

    // Individual note editing view
    if (activeNoteId) {
        const activeNote = notes[activeNoteId];
        if (!activeNote) {
            setActiveNoteId(null);
            return null;
        }

        return (
            <>
                <div className="private-notes-editor animate-slideInUp">
                    <div className="editor-header">
                        <div className="header-content">
                            <button 
                                onClick={() => setActiveNoteId(null)} 
                                className="back-button group"
                            >
                                <ChevronLeft className="back-icon" />
                            </button>
                            
                            <div className="note-info">
                                <span className="note-title">{activeNote.name}</span>
                                {activeNote.shared && (
                                    <span className="shared-badge">
                                        Shared by {activeNote.sharedFrom}
                                    </span>
                                )}
                            </div>
                            
                            <div className="note-type-badge">
                                {activeNote.shared ? 'Shared Note' : 'Private Note'}
                            </div>
                        </div>
                    </div>
                    
                    <div className="editor-canvas">
                        <Tldraw
                            snapshot={activeNote.snapshot}
                            persistenceKey={`private-note-active-${activeNote.id}`}
                        >
                            <SaveButton onSave={(snapshot) => handleSaveNote(activeNoteId, snapshot)} />
                            {!activeNote.shared && (
                                <ShareButton 
                                    onShare={handleShareNote} 
                                    noteData={activeNote}
                                    participants={participants}
                                />
                            )}
                        </Tldraw>
                    </div>
                </div>
    return (
        
            <div className="private-notes-container animate-slideInUp">
                <div className="private-notes-header">
                    <div className="header-content">
                        <button 
                            onClick={onBack} 
                            className="back-button group"
                        >
                            <ChevronLeft className="back-icon" />
                            Back to Boards
                        </button>
                        
                        <div className="title-section">
                            <div className="icon-container">
                                <Eye className="title-icon" />
                            </div>
                            <h3 className="title-text">My Private Notes</h3>
                        </div>

                        <button
                            onClick={() => setCreateModalVisible(true)}
                            className="create-button group"
                        >
                            <Plus className="create-icon" />
                        </button>
                    </div>
                </div>

                <div className="private-notes-body">
                    <div className="notes-list">
                        {Object.keys(notes).length === 0 ? (
                            <div className="empty-state animate-fadeIn">
                                <div className="empty-icon-container">
                                    <Eye className="empty-icon" />
                                </div>
                                <div className="empty-text">
                                    <p className="empty-title">No notes yet</p>
                                    <p className="empty-subtitle">Create one to get started!</p>
                                </div>
                            </div>
                        ) : (
                            Object.values(notes)
                                .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
                                .map((item, index) => (
                                    <div
                                        key={item.id}
                                        onClick={() => setActiveNoteId(item.id)}
                                        className={`note-item animate-fadeInUp`}
                                        style={{
                                            animationDelay: `${index * 0.05}s`,
                                            animationFillMode: 'both'
                                        }}
                                    >
                                        <div className="note-content">
                                            <div className="note-avatar-section">
                                                <div className="note-avatar-container">
                                                    <div className={`note-avatar ${item.shared ? 'avatar-shared' : 'avatar-private'}`}>
                                                        {item.shared ? (
                                                            <Share2 className="avatar-icon" />
                                                        ) : (
                                                            <Eye className="avatar-icon" />
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="note-info">
                                                <div className="note-name-section">
                                                    <span className="note-name">{item.name}</span>
                                                    <div className="note-badges">
                                                        {item.shared && (
                                                            <span className="shared-badge">
                                                                Shared
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="note-description">
                                                    {item.shared ? (
                                                        <div>Shared by {item.sharedFrom} • {new Date(item.sharedAt).toLocaleDateString()}</div>
                                                    ) : (
                                                        <div>
                                                            {item.updatedAt ? (
                                                                <>Updated {new Date(item.updatedAt).toLocaleDateString()}</>
                                                            ) : item.createdAt ? (
                                                                <>Created {new Date(item.createdAt).toLocaleDateString()}</>
                                                            ) : (
                                                                'No date available'
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            <div className="note-controls">
                                                <Tooltip title="Delete note" color="#0f172a">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteNote(item.id);
                                                        }}
                                                        className="control-button delete-button"
                                                    >
                                                        <Trash2 className="control-icon" />
                                                    </button>
                                                </Tooltip>
                                            </div>
                                        </div>
                                    </div>
                                ))
                        )}
                    </div>
                </div>
            </div>

            {/* Create note modal */}
            <Modal
                title={
                    <div className="modal-title">
                        <div className="modal-title-icon">
                            <Plus className="w-5 h-5" />
                        </div>
                        <span>Create New Private Note</span>
                    </div>
                }
                open={isCreateModalVisible}
                onOk={handleCreateNote}
                onCancel={() => {
                    setCreateModalVisible(false);
                    setNewNoteName('');
                }}
                okText="Create Note"
                className="private-notes-modal"
            >
                <div className="modal-content">
                    <div className="input-group">
                        <label className="input-label">Note Name</label>
                        <Input
                            placeholder="Enter note name..."
                            value={newNoteName}
                            onChange={(e) => setNewNoteName(e.target.value)}
                            onPressEnter={handleCreateNote}
                            className="modal-input"
                        />
                    </div>
                </div>
            </Modal>

            



                <style jsx>{`
                    .note-info {
                        flex: 1;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        gap: 4px;
                        min-width: 0;
                    }

                    .note-title {
                        font-size: 16px;
                        font-weight: 600;
                        color: #f1f5f9;
                        text-align: center;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                        max-width: 100%;
                    }

                    .shared-badge {
                        font-size: 11px;
                        color: #3b82f6;
                        background: rgba(59, 130, 246, 0.1);
                        border: 1px solid rgba(59, 130, 246, 0.2);
                        padding: 2px 8px;
                        border-radius: 12px;
                        backdrop-filter: blur(4px);
                    }

                    .note-type-badge {
                        font-size: 11px;
                        font-weight: 500;
                        color: #94a3b8;
                        padding: 4px 8px;
                        background: rgba(15, 23, 42, 0.6);
                        border: 1px solid rgba(148, 163, 184, 0.1);
                        border-radius: 6px;
                        backdrop-filter: blur(4px);
                    }

                    .editor-canvas {
                        flex: 1;
                        min-height: 0;
                        position: relative;
                    }

                    :global(.tldraw-save-button) {
                        position: absolute;
                        top: 12px;
                        right: 12px;
                        z-index: 999;
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        padding: 8px 12px;
                        background: linear-gradient(135deg, #0ea5a4, #0891b2);
                        border: 1px solid rgba(14, 165, 164, 0.3);
                        border-radius: 8px;
                        color: white;
                        font-size: 12px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.3s ease;
                        backdrop-filter: blur(8px);
                        box-shadow: 0 2px 8px rgba(14, 165, 164, 0.2);
                    }

                    :global(.tldraw-save-button:hover) {
                        background: linear-gradient(135deg, #0891b2, #0e7490);
                        border-color: rgba(14, 165, 164, 0.5);
                        transform: translateY(-1px);
                        box-shadow: 0 4px 12px rgba(14, 165, 164, 0.3);
                    }

                    :global(.tldraw-share-button) {
                        position: absolute;
                        top: 12px;
                        right: 100px;
                        z-index: 999;
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        padding: 8px 12px;
                        background: rgba(15, 23, 42, 0.9);
                        border: 1px solid rgba(148, 163, 184, 0.2);
                        border-radius: 8px;
                        color: #e2e8f0;
                        font-size: 12px;
                        font-weight: 500;
                        cursor: pointer;
                        transition: all 0.3s ease;
                        backdrop-filter: blur(8px);
                    }

                    :global(.tldraw-share-button:hover) {
                        background: rgba(59, 130, 246, 0.1);
                        border-color: rgba(59, 130, 246, 0.3);
                        color: #3b82f6;
                        transform: translateY(-1px);
                    }

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

                    .animate-slideInUp {
                        animation: slideInUp 0.6s cubic-bezier(0.4, 0, 0.2, 1);
                    }

                    @media (max-width: 768px) {
                        .editor-header {
                            padding: 14px 16px;
                        }

                        .header-content {
                            gap: 12px;
                        }

                        .note-title {
                            font-size: 14px;
                        }

                        .back-button {
                            padding: 6px 10px;
                            font-size: 12px;
                        }

                        .back-icon {
                            width: 12px;
                            height: 12px;
                        }

                        :global(.tldraw-save-button),
                        :global(.tldraw-share-button) {
                            padding: 6px 8px;
                            font-size: 11px;
                        }

                        :global(.tldraw-share-button) {
                            right: 80px;
                        }
                    
            
                    .private-notes-editor {
                        height: 100%;
                        display: flex;
                        flex-direction: column;
                        background: linear-gradient(180deg, #0a1628 0%, #0f172a 100%);
                        color: #e2e8f0;
                        position: relative;
                        overflow: hidden;
                    }

                    .private-notes-editor::before {
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

                    .private-notes-editor > * {
                        position: relative;
                        z-index: 1;
                    }

                    .editor-header {
                        padding: 16px 20px;
                        background: linear-gradient(135deg, rgba(15,23,42,0.95), rgba(7,17,27,0.95));
                        border-bottom: 1px solid rgba(14, 165, 164, 0.08);
                        backdrop-filter: blur(12px);
                        transition: all 0.3s ease;
                        flex-shrink: 0;
                    }

                    .header-content {
                        display: flex;
                        align-items: center;
                        gap: 16px;
                    }

                    .back-button {
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        padding: 8px 12px;
                        background: transparent;
                        border: 1px solid rgba(148,163,184,0.08);
                        border-radius: 8px;
                        color: #94a3b8;
                        cursor: pointer;
                        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                        font-size: 13px;
                        font-weight: 500;
                    }

                    .back-button:hover {
                        background: rgba(14,165,164,0.08);
                        border-color: rgba(14,165,164,0.2);
                        color: #0ea5a4;
                        transform: translateX(-2px);
                    }

                    .back-icon {
                        width: 14px;
                        height: 14px;
                        transition: all 0.3s ease;
                    }

                    .back-button.group:hover .back-icon {
                        transform: translateX(-2px);
                    }

                    .note-info {
                        flex: 1;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        gap: 4px;
                        min-width: 0;
                    }
                    
                /* Enhanced Animations matching ParticipantsList */
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
                .private-notes-container {
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    background: linear-gradient(180deg, #0a1628 0%, #0f172a 100%);
                    color: #e2e8f0;
                    font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
                    position: relative;
                    overflow: hidden;
                }

                .private-notes-container::before {
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

                .private-notes-container > * {
                    position: relative;
                    z-index: 1;
                }

                /* Header Styling */
                .private-notes-header {
                    padding: 16px 20px;
                    background: linear-gradient(135deg, rgba(15,23,42,0.95), rgba(7,17,27,0.95));
                    border-bottom: 1px solid rgba(14, 165, 164, 0.08);
                    backdrop-filter: blur(12px);
                    transition: all 0.3s ease;
                }

                .private-notes-header:hover {
                    border-bottom-color: rgba(14, 165, 164, 0.15);
                    background: linear-gradient(135deg, rgba(15,23,42,0.98), rgba(7,17,27,0.98));
                }

                .header-content {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                }

                .back-button {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 8px 12px;
                    background: transparent;
                    border: 1px solid rgba(148,163,184,0.08);
                    border-radius: 8px;
                    color: #94a3b8;
                    cursor: pointer;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    font-size: 13px;
                    font-weight: 500;
                }

                .back-button:hover {
                    background: rgba(14,165,164,0.08);
                    border-color: rgba(14,165,164,0.2);
                    color: #0ea5a4;
                    transform: translateX(-2px);
                }

                .back-icon {
                    width: 14px;
                    height: 14px;
                    transition: all 0.3s ease;
                }

                .back-button.group:hover .back-icon {
                    transform: translateX(-2px);
                }

                .title-section {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    justify-content: center;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .icon-container {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 36px;
                    height: 36px;
                    border-radius: 10px;
                    background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(124, 58, 237, 0.1));
                    border: 1px solid rgba(139, 92, 246, 0.15);
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .title-icon {
                    color: #8b5cf6;
                    width: 16px;
                    height: 16px;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    filter: drop-shadow(0 0 6px rgba(139, 92, 246, 0.2));
                }

                .title-section:hover .icon-container {
                    background: linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(124, 58, 237, 0.2));
                    border-color: rgba(139, 92, 246, 0.3);
                    transform: translateY(-2px) scale(1.05);
                    box-shadow: 0 8px 25px rgba(139, 92, 246, 0.15);
                }

                .title-section:hover .title-icon {
                    transform: scale(1.1);
                    animation: iconBounce 0.6s ease;
                    filter: drop-shadow(0 0 12px rgba(139, 92, 246, 0.4));
                }

                .title-text {
                    font-size: 14px;
                    font-weight: 700;
                    color: #f1f5f9;
                    letter-spacing: 0.5px;
                    text-transform: uppercase;
                    transition: all 0.3s ease;
                    margin: 0;
                }

                .title-section:hover .title-text {
                    color: #8b5cf6;
                    text-shadow: 0 0 8px rgba(139, 92, 246, 0.2);
                }

                .create-button {
                    width: 36px;
                    height: 36px;
                    border-radius: 10px;
                    background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(124, 58, 237, 0.1));
                    border: 1px solid rgba(139, 92, 246, 0.15);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    backdrop-filter: blur(8px);
                }

                .create-button:hover {
                    background: linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(124, 58, 237, 0.2));
                    border-color: rgba(139, 92, 246, 0.3);
                    transform: translateY(-2px) scale(1.05);
                    box-shadow: 0 8px 25px rgba(139, 92, 246, 0.15);
                }

                .create-icon {
                    color: #8b5cf6;
                    width: 16px;
                    height: 16px;
                    transition: all 0.3s ease;
                    filter: drop-shadow(0 0 6px rgba(139, 92, 246, 0.2));
                }

                .create-button.group:hover .create-icon {
                    transform: scale(1.1) rotate(90deg);
                    filter: drop-shadow(0 0 12px rgba(139, 92, 246, 0.4));
                }

                /* Body and Notes List */
                .private-notes-body {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    min-height: 0;
                    background: linear-gradient(180deg, rgba(2,6,23,0.0), rgba(2,6,23,0.02));
                }

                .notes-list {
                    flex: 1;
                    overflow-y: auto;
                    padding: 20px;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .notes-list::-webkit-scrollbar {
                    width: 6px;
                }

                .notes-list::-webkit-scrollbar-track {
                    background: rgba(15, 23, 42, 0.3);
                    border-radius: 3px;
                }

                .notes-list::-webkit-scrollbar-thumb {
                    background: rgba(139, 92, 246, 0.2);
                    border-radius: 3px;
                    transition: background 0.3s ease;
                }

                .notes-list::-webkit-scrollbar-thumb:hover {
                    background: rgba(139, 92, 246, 0.4);
                }

                /* Note Items */
                .note-item {
                    background: linear-gradient(135deg, rgba(15,23,42,0.4), rgba(12,18,28,0.3));
                    border: 1px solid rgba(139, 92, 246, 0.06);
                    border-radius: 14px;
                    padding: 16px;
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
                    background: linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.2), transparent);
                    transition: all 0.3s ease;
                }

                .note-item:hover {
                    background: linear-gradient(135deg, rgba(15,23,42,0.6), rgba(12,18,28,0.4));
                    border-color: rgba(139, 92, 246, 0.12);
                    transform: translateY(-2px);
                    box-shadow: 0 8px 25px rgba(2,6,23,0.4);
                }

                .note-item:hover::before {
                    background: linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.4), transparent);
                    height: 2px;
                }

                .note-content {
                    display: flex;
                    align-items: center;
                    gap: 14px;
                }

                /* Note Avatar */
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
                    width: 32px;
                    height: 32px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .avatar-private {
                    background: linear-gradient(135deg, #8b5cf6, #7c3aed);
                    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.15);
                }

                .avatar-shared {
                    background: linear-gradient(135deg, #3b82f6, #1d4ed8);
                    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
                }

                .avatar-icon {
                    width: 16px;
                    height: 16px;
                    color: white;
                }

                /* Note Info */
                .note-info {
                    flex: 1;
                    min-width: 0;
                }

                .note-name-section {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 4px;
                    justify-content: space-between;
                }

                .note-name {
                    font-size: 14px;
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
                    gap: 6px;
                    flex-shrink: 0;
                }

                .shared-badge {
                    font-size: 9px;
                    font-weight: 600;
                    color: #3b82f6;
                    background: rgba(59, 130, 246, 0.1);
                    border: 1px solid rgba(59, 130, 246, 0.2);
                    padding: 2px 6px;
                    border-radius: 6px;
                    transition: all 0.3s ease;
                    backdrop-filter: blur(4px);
                }

                .note-item:hover .shared-badge {
                    background: rgba(59, 130, 246, 0.15);
                    border-color: rgba(59, 130, 246, 0.3);
                }

                .note-description {
                    font-size: 11px;
                    color: #94a3b8;
                    transition: color 0.3s ease;
                }

                .note-item:hover .note-description {
                    color: #cbd5e1;
                }

                /* Note Controls */
                .note-controls {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    flex-shrink: 0;
                }

                .control-button {
                    background: transparent;
                    border: 1px solid rgba(148,163,184,0.08);
                    border-radius: 6px;
                    padding: 4px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    backdrop-filter: blur(4px);
                }

                .control-icon {
                    width: 12px;
                    height: 12px;
                    transition: all 0.3s ease;
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

                /* Empty State */
                .empty-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 40px 20px;
                    text-align: center;
                    opacity: 0.8;
                }

                .empty-icon-container {
                    width: 64px;
                    height: 64px;
                    border-radius: 16px;
                    background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(124, 58, 237, 0.1));
                    border: 1px solid rgba(139, 92, 246, 0.15);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-bottom: 16px;
                    transition: all 0.3s ease;
                }

                .empty-icon {
                    width: 24px;
                    height: 24px;
                    color: #94a3b8;
                    opacity: 0.6;
                    transition: all 0.3s ease;
                }

                .empty-state:hover .empty-icon-container {
                    background: linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(124, 58, 237, 0.15));
                    border-color: rgba(139, 92, 246, 0.25);
                    transform: translateY(-2px);
                }

                .empty-state:hover .empty-icon {
                    color: #8b5cf6;
                    opacity: 0.8;
                    transform: scale(1.1);
                }

                .empty-text {
                    max-width: 200px;
                }

                .empty-title {
                    font-size: 14px;
                    font-weight: 600;
                    color: #94a3b8;
                    margin-bottom: 4px;
                    transition: color 0.3s ease;
                }

                .empty-subtitle {
                    font-size: 12px;
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

                /* Modal Styling matching WhiteboardPanel */
                :global(.private-notes-modal .ant-modal-content) {
                    background: linear-gradient(180deg, #0f172a, #071126) !important;
                    border: 1px solid rgba(139, 92, 246, 0.15) !important;
                    border-radius: 16px !important;
                    box-shadow: 0 20px 60px rgba(2,6,23,0.6) !important;
                    backdrop-filter: blur(20px) !important;
                }

                :global(.private-notes-modal .ant-modal-header) {
                    background: transparent !important;
                    border-bottom: 1px solid rgba(139, 92, 246, 0.1) !important;
                    padding: 20px 24px 16px !important;
                }

                :global(.private-notes-modal .ant-modal-body) {
                    padding: 20px 24px !important;
                }

                :global(.private-notes-modal .ant-modal-footer) {
                    background: transparent !important;
                    border-top: 1px solid rgba(139, 92, 246, 0.1) !important;
                    padding: 16px 24px 20px !important;
                }

                .modal-title {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    color: #f1f5f9 !important;
                    font-weight: 600 !important;
                    font-size: 16px !important;
                }

                .modal-title-icon {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 32px;
                    height: 32px;
                    border-radius: 8px;
                    background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(124, 58, 237, 0.1));
                    border: 1px solid rgba(139, 92, 246, 0.15);
                    color: #8b5cf6;
                }

                .modal-content {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }

                .input-group {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .input-label {
                    font-size: 13px;
                    font-weight: 600;
                    color: #e2e8f0;
                    margin: 0;
                }

                :global(.private-notes-modal .modal-input) {
                    background: rgba(15, 23, 42, 0.6) !important;
                    border: 1px solid rgba(139, 92, 246, 0.1) !important;
                    border-radius: 10px !important;
                    padding: 10px 14px !important;
                    font-size: 13px !important;
                    color: #e2e8f0 !important;
                    transition: all 0.3s ease !important;
                }

                :global(.private-notes-modal .modal-input:hover) {
                    border-color: rgba(139, 92, 246, 0.2) !important;
                    background: rgba(15, 23, 42, 0.8) !important;
                }

                :global(.private-notes-modal .modal-input:focus) {
                    border-color: rgba(139, 92, 246, 0.4) !important;
                    background: rgba(15, 23, 42, 0.9) !important;
                    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1) !important;
                }

                :global(.private-notes-modal .modal-select .ant-select-selector) {
                    background: rgba(15, 23, 42, 0.6) !important;
                    border: 1px solid rgba(139, 92, 246, 0.1) !important;
                    border-radius: 10px !important;
                    padding: 4px 8px !important;
                    transition: all 0.3s ease !important;
                }

                :global(.private-notes-modal .modal-select:hover .ant-select-selector) {
                    border-color: rgba(139, 92, 246, 0.2) !important;
                    background: rgba(15, 23, 42, 0.8) !important;
                }

                :global(.private-notes-modal .modal-select.ant-select-focused .ant-select-selector) {
                    border-color: rgba(139, 92, 246, 0.4) !important;
                    background: rgba(15, 23, 42, 0.9) !important;
                    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1) !important;
                }

                .select-option {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    color: #e2e8f0;
                }

                .select-icon {
                    width: 14px;
                    height: 14px;
                    color: #8b5cf6;
                }

                .share-info {
                    font-size: 13px;
                    color: #cbd5e1;
                    line-height: 1.4;
                }

                /* Modal Button Styling */
                :global(.private-notes-modal .ant-btn-primary) {
                    background: linear-gradient(135deg, #8b5cf6, #7c3aed) !important;
                    border: 1px solid rgba(139, 92, 246, 0.3) !important;
                    border-radius: 8px !important;
                    font-weight: 600 !important;
                    transition: all 0.3s ease !important;
                }

                :global(.private-notes-modal .ant-btn-primary:hover) {
                    background: linear-gradient(135deg, #7c3aed, #6d28d9) !important;
                    border-color: rgba(139, 92, 246, 0.5) !important;
                    transform: translateY(-1px) !important;
                    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.2) !important;
                }

                :global(.private-notes-modal .ant-btn-default) {
                    background: rgba(15, 23, 42, 0.6) !important;
                    border: 1px solid rgba(148, 163, 184, 0.2) !important;
                    border-radius: 8px !important;
                    color: #e2e8f0 !important;
                    font-weight: 500 !important;
                    transition: all 0.3s ease !important;
                }

                :global(.private-notes-modal .ant-btn-default:hover) {
                    background: rgba(15, 23, 42, 0.8) !important;
                    border-color: rgba(148, 163, 184, 0.3) !important;
                    color: #f1f5f9 !important;
                    transform: translateY(-1px) !important;
                }

                /* Tooltip Styling */
                :global(.ant-tooltip-inner) {
                    background: linear-gradient(135deg, #0f172a, #071126) !important;
                    border: 1px solid rgba(139, 92, 246, 0.2) !important;
                    color: #e2e8f0 !important;
                    border-radius: 8px !important;
                    backdrop-filter: blur(12px) !important;
                    box-shadow: 0 8px 25px rgba(2,6,23,0.4) !important;
                }

                :global(.ant-tooltip-arrow::before) {
                    background: linear-gradient(135deg, #0f172a, #071126) !important;
                    border: 1px solid rgba(139, 92, 246, 0.2) !important;
                }

                /* Mobile Responsiveness */
                @media (max-width: 768px) {
                    .private-notes-header {
                        padding: 14px 16px;
                    }

                    .header-content {
                        gap: 12px;
                    }

                    .title-text {
                        font-size: 12px;
                    }

                    .icon-container,
                    .create-button {
                        width: 32px;
                        height: 32px;
                    }

                    .title-icon,
                    .create-icon {
                        width: 14px;
                        height: 14px;
                    }

                    .back-button {
                        padding: 6px 10px;
                        font-size: 12px;
                    }

                    .back-icon {
                        width: 12px;
                        height: 12px;
                    }

                    .notes-list {
                        padding: 16px;
                        gap: 10px;
                    }

                    .note-item {
                        padding: 12px;
                    }

                    .note-content {
                        gap: 10px;
                    }

                    .note-avatar {
                        width: 28px;
                        height: 28px;
                    }

                    .avatar-icon {
                        width: 14px;
                        height: 14px;
                    }

                    .note-name {
                        font-size: 12px;
                    }

                    .note-description {
                        font-size: 10px;
                    }

                    .control-icon {
                        width: 10px;
                        height: 10px;
                    }
                }

                @media (max-width: 480px) {
                    .private-notes-header {
                        padding: 12px 14px;
                    }

                    .header-content {
                        gap: 10px;
                    }

                    .notes-list {
                        padding: 14px;
                    }

                    .note-item {
                        padding: 10px;
                    }

                    .note-content {
                        gap: 8px;
                    }
                }

                /* Performance Optimizations */
                .private-notes-container {
                    will-change: transform;
                    backface-visibility: hidden;
                }

                .note-item,
                .control-button,
                .create-button,
                .back-button {
                    will-change: transform, box-shadow;
                }

                /* Text Selection */
                .private-notes-container *::selection {
                    background: rgba(139, 92, 246, 0.2);
                    color: #f1f5f9;
                }

                /* Accessibility */
                .note-item:focus-within,
                .control-button:focus-visible,
                .create-button:focus-visible,
                .back-button:focus-visible {
                    outline: 2px solid rgba(139, 92, 246, 0.6) !important;
                    outline-offset: 2px !important;
                }

                /* Smooth Scrolling */
                * {
                    scroll-behavior: smooth;
                }
            `}</style>
        </>
    );
}  }       