import React, { useCallback } from 'react';
import { useEditor, getSnapshot } from 'tldraw';
import axios from 'axios';
import { Button, message } from 'antd';
import { Save } from 'lucide-react';

const SERVER_URL = process.env.REACT_APP_SERVER_URL || 'http://localhost:8080';

export default function WhiteboardSaveButton({ sessionId, boardId, userName, docRef }) {
  const editor = useEditor(); // MUST be inside Tldraw tree

  const handleSaveToServer = useCallback(async () => {
    try {
      const snapshot = getSnapshot(editor.store); // { document, session }
      
      // Save to server via HTTP API
      const payload = { snapshot, saver: userName };
      const url = `${SERVER_URL}/session/${encodeURIComponent(sessionId)}/boards/${encodeURIComponent(boardId)}/snapshot`;
      
      const resp = await axios.post(url, payload);
      if (resp?.data?.ok) {
        message.success('Board snapshot saved to server.');
        
        // Also update ShareDB document for real-time sync
        if (docRef?.current) {
          try {
            docRef.current.submitOp([{
              p: ['whiteboards', boardId],
              oi: {
                ...snapshot,
                lastSaved: new Date().toISOString(),
                savedBy: userName
              }
            }], { source: 'manual-save' });
          } catch (e) {
            console.warn('Failed to update ShareDB after server save:', e);
          }
        }
      } else {
        message.error('Failed to save snapshot to server.');
      }
    } catch (err) {
      console.error('save snapshot error', err);
      if (err.response?.status === 403) {
        message.error('You do not have permission to save this board.');
      } else {
        message.error('Failed to save snapshot (network/error).');
      }
    }
  }, [editor, sessionId, boardId, userName, docRef]);

  return (
    <Button 
      onClick={handleSaveToServer} 
      type="primary" 
      icon={<Save size={14} />}
      style={{ position: 'absolute', right: 12, top: 10, zIndex: 999 }}
    >
      Save Board
    </Button>
  );
}