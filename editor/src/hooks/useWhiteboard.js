import { useState, useEffect, useCallback } from 'react';
import { notification } from 'antd';
import { v4 as uuidv4 } from 'uuid';

export const useWhiteboard = (doc, userName, isHost) => {
  const [boards, setBoards] = useState({});
  const [activeBoard, setActiveBoard] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Initialize host board on mount
  useEffect(() => {
    if (!doc || !isHost) return;
    
    const initializeHostBoard = () => {
      const currentBoards = doc.data.boards || {};
      if (!currentBoards.host) {
        createBoard('host', "Host's Notes", true);
      }
    };

    if (doc.type) {
      initializeHostBoard();
    } else {
      const fetchDoc = () => {
        doc.fetch((err) => {
          if (!err && doc.type) {
            initializeHostBoard();
          }
        });
      };
      fetchDoc();
    }
  }, [doc, isHost]);

  // Subscribe to board changes
  useEffect(() => {
    if (!doc) return;

    const updateBoards = () => {
      if (doc.data) {
        setBoards(doc.data.boards || {});
        setIsLoading(false);
      }
    };

    // Initial data
    if (doc.type) {
      updateBoards();
    } else {
      doc.fetch((err) => {
        if (!err) {
          updateBoards();
        }
      });
    }

    // Subscribe to changes
    const onChange = () => {
      updateBoards();
    };

    doc.subscribe(onChange);

    return () => {
      doc.unsubscribe(onChange);
    };
  }, [doc]);

  // Safe submit operation helper (matching your useEditorState pattern)
  const safeSubmitOp = useCallback((ops, meta) => {
    try {
      if (doc && doc.type) doc.submitOp(ops, meta);
      else console.warn('safeSubmitOp: no doc or doc has no type', ops);
    } catch (e) {
      console.warn('safeSubmitOp failed', e, ops);
    }
  }, [doc]);

  // Create a new board
  const createBoard = useCallback((boardId, name, isHostBoard = false) => {
    if (!doc) {
      notification.error({ message: 'Not connected to document' });
      return;
    }

    const boardData = {
      id: boardId,
      name,
      owner: userName,
      isShared: isHostBoard,
      allowParticipantsEdit: false,
      content: JSON.stringify({
        document: {
          id: 'document',
          name: 'New Document',
          version: 1,
          pages: {
            page: {
              id: 'page',
              name: 'Page 1',
              childIndex: 1,
              shapes: {},
              bindings: {},
            },
          },
          pageStates: {
            page: {
              id: 'page',
              selectedIds: [],
              camera: {
                x: 0,
                y: 0,
                z: 1,
              },
            },
          },
          assets: {},
        },
        schema: {
          schemaVersion: 1,
          storeVersion: 1,
          recordVersions: {},
        },
      }),
      createdAt: Date.now(),
      lastModified: Date.now(),
    };

    try {
      // Ensure boards object exists
      const currentBoards = doc.data.boards || {};
      const newBoards = { ...currentBoards, [boardId]: boardData };
      
      safeSubmitOp([{
        p: ['boards'],
        oi: newBoards,
      }], { source: 'createBoard' });

      setActiveBoard(boardId);
      notification.success({ message: `Board "${name}" created` });
    } catch (error) {
      console.error('Failed to create board:', error);
      notification.error({ message: 'Failed to create board' });
    }
  }, [doc, userName, safeSubmitOp]);

  // Create a new private board
  const createPrivateBoard = useCallback((name) => {
    const boardId = `private_${uuidv4()}`;
    createBoard(boardId, name, false);
  }, [createBoard]);

  // Delete a board
  const deleteBoard = useCallback((boardId) => {
    if (!doc) return;

    const boardToDelete = boards[boardId];
    if (!boardToDelete) return;

    // Check permissions
    if (boardId === 'host' && !isHost) {
      notification.error({ message: 'Only host can delete the host board' });
      return;
    }

    if (boardId.startsWith('private_') && boardToDelete.owner !== userName) {
      notification.error({ message: 'You can only delete your own private boards' });
      return;
    }

    try {
      const currentBoards = { ...boards };
      delete currentBoards[boardId];
      
      safeSubmitOp([{
        p: ['boards'],
        oi: currentBoards,
      }], { source: 'deleteBoard' });

      if (activeBoard === boardId) {
        setActiveBoard(null);
      }
      notification.success({ message: `Board "${boardToDelete.name}" deleted` });
    } catch (error) {
      console.error('Failed to delete board:', error);
      notification.error({ message: 'Failed to delete board' });
    }
  }, [doc, boards, activeBoard, isHost, userName, safeSubmitOp]);

  // Update board content
  const updateBoardContent = useCallback((boardId, content) => {
    if (!doc) return;

    const board = boards[boardId];
    if (!board) return;

    // Check edit permissions
    if (!canEditBoard(board)) {
      notification.warning({ message: 'You do not have permission to edit this board' });
      return;
    }

    try {
      const updatedBoards = { ...boards };
      updatedBoards[boardId] = {
        ...updatedBoards[boardId],
        content: content,
        lastModified: Date.now(),
      };
      
      safeSubmitOp([{
        p: ['boards'],
        oi: updatedBoards,
      }], { source: 'updateBoardContent' });
    } catch (error) {
      console.error('Failed to update board content:', error);
    }
  }, [doc, boards, safeSubmitOp]);

  // Share a private board
  const sharePrivateBoard = useCallback((boardId) => {
    if (!doc) return;

    const board = boards[boardId];
    if (!board || !boardId.startsWith('private_')) return;

    if (board.owner !== userName) {
      notification.error({ message: 'You can only share your own private boards' });
      return;
    }

    try {
      const updatedBoards = { ...boards };
      updatedBoards[boardId] = {
        ...updatedBoards[boardId],
        isShared: true,
      };
      
      safeSubmitOp([{
        p: ['boards'],
        oi: updatedBoards,
      }], { source: 'sharePrivateBoard' });

      notification.success({ message: 'Board shared with participants' });
    } catch (error) {
      console.error('Failed to share board:', error);
      notification.error({ message: 'Failed to share board' });
    }
  }, [doc, boards, userName, safeSubmitOp]);

  // Set board edit mode (host only)
  const setBoardEditMode = useCallback((boardId, allowParticipantsEdit) => {
    if (!doc || !isHost) return;

    const board = boards[boardId];
    if (!board || boardId !== 'host') {
      notification.error({ message: 'Only host board edit mode can be changed' });
      return;
    }

    try {
      const updatedBoards = { ...boards };
      updatedBoards[boardId] = {
        ...updatedBoards[boardId],
        allowParticipantsEdit: allowParticipantsEdit,
      };
      
      safeSubmitOp([{
        p: ['boards'],
        oi: updatedBoards,
      }], { source: 'setBoardEditMode' });

      notification.success({ 
        message: `Participants can ${allowParticipantsEdit ? 'now edit' : 'no longer edit'} the host board` 
      });
    } catch (error) {
      console.error('Failed to update board edit mode:', error);
      notification.error({ message: 'Failed to update board permissions' });
    }
  }, [doc, boards, isHost, safeSubmitOp]);

  // Check if user can edit a specific board
  const canEditBoard = useCallback((board) => {
    if (!board) return false;

    // Private boards: only owner can edit
    if (board.id?.startsWith('private_') || board.owner === userName) {
      return board.owner === userName;
    }

    // Host board: host or participants if allowed
    if (board.id === 'host') {
      return isHost || board.allowParticipantsEdit;
    }

    return false;
  }, [isHost, userName]);

  // Get available boards for current user
  const getAvailableBoards = useCallback(() => {
    return Object.entries(boards)
      .map(([id, board]) => ({
        id,
        ...board,
        canEdit: canEditBoard(board),
      }))
      .filter(board => {
        // Show host board to everyone
        if (board.id === 'host') return true;
        
        // Show private boards if they're shared or owned by current user
        if (board.id.startsWith('private_')) {
          return board.isShared || board.owner === userName;
        }
        
        return false;
      })
      .sort((a, b) => {
        // Host board first, then by creation date
        if (a.id === 'host') return -1;
        if (b.id === 'host') return 1;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
  }, [boards, canEditBoard, userName]);

  // Get board content as JSON
  const getBoardContent = useCallback((boardId) => {
    const board = boards[boardId];
    if (!board || !board.content) return null;
    
    try {
      return JSON.parse(board.content);
    } catch (error) {
      console.error('Failed to parse board content:', error);
      return null;
    }
  }, [boards]);

  return {
    // State
    boards,
    activeBoard,
    isLoading,
    
    // Actions
    createBoard,
    createPrivateBoard,
    deleteBoard,
    updateBoardContent,
    sharePrivateBoard,
    setBoardEditMode,
    setActiveBoard,
    
    // Utilities
    canEditBoard,
    getAvailableBoards,
    getBoardContent,
    
    // Permissions
    hasHostBoard: !!boards.host,
    canCreateBoards: true, // All users can create private boards
  };
};

// Custom hook for individual whiteboard instance
export const useWhiteboardInstance = (doc, userName, isHost, boardId) => {
  const whiteboard = useWhiteboard(doc, userName, isHost);
  const { boards, updateBoardContent, canEditBoard } = whiteboard;
  
  const board = boards[boardId];
  const canEdit = canEditBoard(board);
  
  const updateContent = useCallback((content) => {
    updateBoardContent(boardId, content);
  }, [updateBoardContent, boardId]);
  
  return {
    board,
    canEdit,
    updateContent,
    isLoading: whiteboard.isLoading,
  };
};

export default useWhiteboard;