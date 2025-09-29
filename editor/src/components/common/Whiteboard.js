// components/Whiteboard.js
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Tldraw, useEditor, AssetRecordType, Box, TLAssetId, TLShapeId, createShapeId } from '@tldraw/tldraw';
import { useSync } from '@tldraw/sync';
import { v4 as uuidv4 } from 'uuid';
import 'tldraw/tldraw.css';
import { Lock, Moon, Sun, FileText, Download, Upload } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';

const WEBSOCKET_URL = process.env.REACT_APP_WEB_SOCKET_URL || 'ws://localhost:8080';

// PDF-related interfaces
export interface PdfPage {
  src: string;
  bounds: Box;
  assetId: TLAssetId;
  shapeId: TLShapeId;
}

export interface Pdf {
  name: string;
  pages: PdfPage[];
  source: string | ArrayBuffer;
}

const pageSpacing = 32;

// stable tab id per browser tab (used as presence id)
const useTabId = () =>
  useMemo(() => {
    const existing = sessionStorage.getItem('tldraw-tab-id');
    if (existing) return existing;
    const id = uuidv4();
    sessionStorage.setItem('tldraw-tab-id', id);
    return id;
  }, []);

// PDF Import Button Component
const PdfImportButton = ({ onPdfLoaded }) => {
  const [isLoading, setIsLoading] = useState(false);
  const editor = useEditor();

  const loadPdf = async (name, source) => {
    try {
      // Import PDF.js and set up worker
      const PdfJS = await import('pdfjs-dist');
      
      // Set up the worker - try multiple approaches for different build systems
      if (typeof PdfJS.GlobalWorkerOptions !== 'undefined') {
        // Try using CDN worker first (most reliable)
        PdfJS.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        
        // Fallback: try to use bundled worker if available
        if (!PdfJS.GlobalWorkerOptions.workerSrc) {
          try {
            const workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.js', import.meta.url).href;
            PdfJS.GlobalWorkerOptions.workerSrc = workerSrc;
          } catch (e) {
            console.warn('Could not load PDF.js worker from bundle, using CDN fallback');
          }
        }
      }
      
      const pdf = await PdfJS.getDocument(source.slice(0)).promise;
      const pages = [];
      const canvas = window.document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      if (!context) throw new Error('Failed to create canvas context');

      const visualScale = 1.5;
      const scale = window.devicePixelRatio;
      let top = 0;
      let widest = 0;

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: scale * visualScale });
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const renderContext = {
          canvasContext: context,
          viewport,
        };

        await page.render(renderContext).promise;

        const width = viewport.width / scale;
        const height = viewport.height / scale;

        pages.push({
          src: canvas.toDataURL(),
          bounds: new Box(0, top, width, height),
          assetId: AssetRecordType.createId(),
          shapeId: createShapeId(),
        });

        top += height + pageSpacing;
        widest = Math.max(widest, width);
      }

      canvas.width = 0;
      canvas.height = 0;

      // Center pages horizontally
      for (const page of pages) {
        page.bounds.x = (widest - page.bounds.width) / 2;
      }

      return { name, pages, source };
    } catch (error) {
      console.error('Error loading PDF:', error);
      throw error;
    }
  };

  const handlePdfImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf';
    input.addEventListener('change', async (e) => {
      const fileList = e.target.files;
      if (!fileList || fileList.length === 0) return;

      const file = fileList[0];
      setIsLoading(true);

      try {
        const pdf = await loadPdf(file.name, await file.arrayBuffer());
        
        // Add PDF pages to the editor
        if (editor) {
          const assets = [];
          const shapes = [];

          for (const page of pdf.pages) {
            // Create asset for the page image
            assets.push({
              id: page.assetId,
              type: 'image',
              typeName: 'asset',
              props: {
                name: `${pdf.name}-page-${assets.length + 1}`,
                src: page.src,
                w: page.bounds.width,
                h: page.bounds.height,
                mimeType: 'image/png',
                isAnimated: false,
              },
              meta: {},
            });

            // Create shape for the page
            shapes.push({
              id: page.shapeId,
              type: 'image',
              typeName: 'shape',
              x: page.bounds.x,
              y: page.bounds.y,
              rotation: 0,
              isLocked: true, // Lock PDF pages to prevent accidental modification
              opacity: 1,
              props: {
                assetId: page.assetId,
                w: page.bounds.width,
                h: page.bounds.height,
                playing: true,
                url: '',
              },
              meta: {
                isPdfPage: true,
                pdfName: pdf.name,
              },
            });
          }

          // Add assets and shapes to the editor
          editor.createAssets(assets);
          editor.createShapes(shapes);

          // Zoom to fit the PDF
          if (shapes.length > 0) {
            const bounds = Box.FromPoints(pdf.pages.map(p => [
              { x: p.bounds.minX, y: p.bounds.minY },
              { x: p.bounds.maxX, y: p.bounds.maxY }
            ]).flat());
            editor.zoomToBounds(bounds, { targetZoom: 1, inset: 50 });
          }

          onPdfLoaded?.(pdf);
        }
      } catch (error) {
        console.error('Failed to import PDF:', error);
        alert('Failed to import PDF. Please try again.');
      } finally {
        setIsLoading(false);
      }
    });

    input.click();
  };

  const buttonStyles = {
    pointerEvents: 'all',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 8px',
    background: 'rgba(37, 37, 37, 0.95)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '6px',
    fontSize: '12px',
    cursor: 'pointer',
    color: '#f3f4f6',
    fontWeight: '500',
    transition: 'all 0.2s ease',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
    height: '32px',
    minWidth: '100px',
  };

  return (
    <button
      onClick={handlePdfImport}
      style={buttonStyles}
      disabled={isLoading}
      title="Import PDF for annotation"
    >
      <Upload size={14} />
      {isLoading ? 'Loading...' : 'Import PDF'}
    </button>
  );
};

// PDF Export Button Component
const PdfExportButton = ({ currentPdf }) => {
  const [exportProgress, setExportProgress] = useState(null);
  const editor = useEditor();

  const exportPdf = async (pdf, onProgress) => {
    try {
      const totalThings = pdf.pages.length * 2 + 2;
      let progressCount = 0;
      const tickProgress = () => {
        progressCount++;
        onProgress(progressCount / totalThings);
      };

      const pdfDoc = await PDFDocument.load(pdf.source);
      tickProgress();

      const pdfPages = pdfDoc.getPages();
      if (pdfPages.length !== pdf.pages.length) {
        throw new Error('PDF page count mismatch');
      }

      const pageShapeIds = new Set(pdf.pages.map(page => page.shapeId));
      const allIds = Array.from(editor.getCurrentPageShapeIds()).filter(id => !pageShapeIds.has(id));

      for (let i = 0; i < pdf.pages.length; i++) {
        const page = pdf.pages[i];
        const pdfPage = pdfPages[i];
        const bounds = page.bounds;

        const shapesInBounds = allIds.filter(id => {
          const shapePageBounds = editor.getShapePageBounds(id);
          if (!shapePageBounds) return false;
          return shapePageBounds.collides(bounds);
        });

        if (shapesInBounds.length === 0) {
          tickProgress();
          tickProgress();
          continue;
        }

        const exportedPng = await editor.toImage(shapesInBounds, {
          format: 'png',
          background: false,
          bounds: bounds,
          padding: 0,
          scale: 1,
        });
        tickProgress();

        pdfPage.drawImage(await pdfDoc.embedPng(await exportedPng.blob.arrayBuffer()), {
          x: 0,
          y: 0,
          width: pdfPage.getWidth(),
          height: pdfPage.getHeight(),
        });
        tickProgress();
      }

      const url = URL.createObjectURL(new Blob([await pdfDoc.save()], { type: 'application/pdf' }));
      tickProgress();

      const a = document.createElement('a');
      a.href = url;
      a.download = pdf.name.replace('.pdf', '-annotated.pdf');
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      throw error;
    }
  };

  const handleExport = async () => {
    if (!currentPdf) return;
    
    setExportProgress(0);
    try {
      await exportPdf(currentPdf, setExportProgress);
    } catch (error) {
      alert('Export failed. Please try again.');
    } finally {
      setExportProgress(null);
    }
  };

  const buttonStyles = {
    pointerEvents: 'all',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 8px',
    background: currentPdf ? 'rgba(34, 197, 94, 0.95)' : 'rgba(107, 114, 128, 0.95)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '6px',
    fontSize: '12px',
    cursor: currentPdf ? 'pointer' : 'not-allowed',
    color: '#f3f4f6',
    fontWeight: '500',
    transition: 'all 0.2s ease',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
    height: '32px',
    minWidth: '100px',
  };

  return (
    <button
      onClick={handleExport}
      style={buttonStyles}
      disabled={!currentPdf || exportProgress !== null}
      title={currentPdf ? 'Export annotated PDF' : 'Import a PDF first'}
    >
      <Download size={14} />
      {exportProgress !== null 
        ? `Exporting... ${Math.round(exportProgress * 100)}%`
        : 'Export PDF'
      }
    </button>
  );
};

// Dark mode toggle button component
const DarkModeButton = () => {
  const editor = useEditor();
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    if (!editor) return;
    
    try {
      const currentIsDark = editor.user.getIsDarkMode();
      setIsDark(currentIsDark);
      
      if (currentIsDark === undefined || currentIsDark === null) {
        editor.user.updateUserPreferences({ colorScheme: 'dark' });
        setIsDark(true);
      }
    } catch (e) {
      setIsDark(true);
      try {
        editor.user.updateUserPreferences({ colorScheme: 'dark' });
      } catch (err) {
        console.warn('Failed to set default dark mode:', err);
      }
    }
  }, [editor]);

  const handleToggle = () => {
    if (!editor) return;
    
    try {
      const newMode = !isDark;
      editor.user.updateUserPreferences({ colorScheme: newMode ? 'dark' : 'light' });
      setIsDark(newMode);
    } catch (e) {
      console.warn('Failed to toggle dark mode:', e);
    }
  };

  const buttonStyles = {
    pointerEvents: 'all',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 8px',
    background: isDark ? 'rgba(37, 37, 37, 0.95)' : 'rgba(255, 255, 255, 0.95)',
    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
    borderRadius: '6px',
    fontSize: '12px',
    cursor: 'pointer',
    color: isDark ? '#f3f4f6' : '#374151',
    fontWeight: '500',
    transition: 'all 0.2s ease',
    boxShadow: isDark 
      ? '0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)' 
      : '0 2px 4px rgba(0, 0, 0, 0.1)',
    height: '32px',
    minWidth: '70px',
  };

  return (
    <button
      onClick={handleToggle}
      style={buttonStyles}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      {isDark ? <Sun size={14} /> : <Moon size={14} />}
      {isDark ? 'Light' : 'Dark'}
    </button>
  );
};

// Top panel with controls
const TopPanel = ({ currentPdf, onPdfLoaded }) => {
  return (
    <div style={{
      position: 'absolute',
      top: '40px',
      left: '3px',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    }}>
      <DarkModeButton />
      <PdfImportButton onPdfLoaded={onPdfLoaded} />
      <PdfExportButton currentPdf={currentPdf} />
    </div>
  );
};

// PDF Status indicator
const PdfStatusIndicator = ({ currentPdf }) => {
  if (!currentPdf) return null;

  return (
    <div style={{
      position: 'absolute',
      bottom: '12px',
      right: '12px',
      zIndex: 1400,
      background: 'rgba(59, 130, 246, 0.95)',
      color: '#fff',
      padding: '6px 10px',
      borderRadius: '6px',
      fontSize: '11px',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
    }}>
      <FileText size={12} />
      <div>
        {currentPdf.name} ({currentPdf.pages.length} pages)
      </div>
    </div>
  );
};

// Read-only badge component
const ReadonlyBadge = ({ boardConfig }) => (
  <div style={{
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 1400,
    background: 'rgba(15,23,42,0.92)',
    color: '#fff',
    padding: '8px 12px',
    borderRadius: 8,
    fontSize: 12,
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    border: '1px solid rgba(255,255,255,0.03)'
  }}>
    <Lock size={14}/>
    <div style={{ lineHeight: 1 }}>
      Read-only — editing disabled
      {boardConfig?.isSharedNote && (
        <div style={{ fontSize: 11, color: '#93c5fd', fontWeight: 600 }}>
          Shared by {boardConfig.sharedFrom}
        </div>
      )}
    </div>
  </div>
);

// Custom collaborator cursor component
const CustomCollaboratorCursor = () => {
  const editor = useEditor();

  useEffect(() => {
    if (!editor) return;

    const screenToPage = (screen) => {
      try {
        if (typeof editor.viewportScreenToPage === 'function') {
          const r = editor.viewportScreenToPage(screen);
          if (r) return r;
        }
        if (typeof editor.screenToPage === 'function') {
          const r = editor.screenToPage(screen);
          if (r) return r;
        }

        const container = document.querySelector('.tldraw__wrap, .tldraw, .tlui__app') || (editor && editor.container) || document.body;
        const rect = container.getBoundingClientRect();
        const rel = { x: screen.x - rect.left, y: screen.y - rect.top };

        if (typeof editor.viewportScreenToPage === 'function') return editor.viewportScreenToPage(rel);
        if (typeof editor.screenToPage === 'function') return editor.screenToPage(rel);
      } catch (e) {
        // ignore
      }
      return null;
    };

    const trySetPresenceOnce = (presence) => {
      try {
        if (typeof editor.setInstancePresence === 'function') {
          editor.setInstancePresence(presence);
          return true;
        }
        if (typeof editor.setPresence === 'function') {
          editor.setPresence(presence);
          return true;
        }
        if (editor.store && typeof editor.store.setPresence === 'function') {
          editor.store.setPresence(presence);
          return true;
        }
        if (typeof editor.broadcast === 'function') {
          editor.broadcast({ type: 'presence', payload: presence });
          return true;
        }
      } catch (e) {
        // swallow error; we'll retry
      }
      return false;
    };

    const ensurePresence = async (presence, opts = {}) => {
      const maxAttempts = opts.maxAttempts || 20;
      const interval = opts.interval || 300;
      for (let i = 0; i < maxAttempts; i++) {
        const ok = trySetPresenceOnce(presence);
        if (ok) return true;
        await new Promise(r => setTimeout(r, interval));
      }
      return false;
    };

    const tabId = sessionStorage.getItem('tldraw-tab-id') || uuidv4();
    const providedName = sessionStorage.getItem('codecrew-username') || 'anonymous';
    const color = sessionStorage.getItem('tldraw-cursor-color') || undefined;

    const sendPresenceNow = async (pagePoint) => {
      const presence = {
        id: tabId,
        userId: providedName,
        name: providedName,
        userName: providedName,
        point: pagePoint ? { x: pagePoint.x, y: pagePoint.y } : undefined,
        lastActivity: new Date().toISOString(),
        color
      };
      await ensurePresence(presence, { maxAttempts: 30, interval: 200 });
    };

    sendPresenceNow(undefined).catch(() => { /* ignore */ });

    const heartbeat = setInterval(() => {
      sendPresenceNow(undefined).catch(() => {});
    }, 5000);

    let last = 0;
    const onPointerMove = (e) => {
      const now = Date.now();
      if (now - last < 60) return;
      last = now;

      const screen = { x: e.clientX, y: e.clientY };
      const pagePoint = screenToPage(screen);

      const presence = {
        id: tabId,
        userId: providedName,
        name: providedName,
        userName: providedName,
        point: pagePoint ? { x: pagePoint.x, y: pagePoint.y } : undefined,
        lastActivity: new Date().toISOString(),
        color
      };

      trySetPresenceOnce(presence);
      ensurePresence(presence, { maxAttempts: 12, interval: 250 }).catch(() => {});
    };

    window.addEventListener('mousemove', onPointerMove);

    try {
      if (typeof editor.on === 'function') {
        editor.on('pointer', (evt) => {
          const p = evt?.point || evt?.pagePoint || (evt && evt.x !== undefined ? { x: evt.x, y: evt.y } : null);
          const presence = {
            id: tabId,
            userId: providedName,
            name: providedName,
            userName: providedName,
            point: p ? { x: p.x, y: p.y } : undefined,
            lastActivity: new Date().toISOString(),
            color
          };
          trySetPresenceOnce(presence);
          ensurePresence(presence, { maxAttempts: 8, interval: 250 }).catch(() => {});
        });
      }
    } catch (e) { /* ignore */ }

    return () => {
      clearInterval(heartbeat);
      window.removeEventListener('mousemove', onPointerMove);
      try { if (typeof editor.off === 'function') editor.off('pointer'); } catch (_) {}
    };
  }, [editor]);

  const collaborators = (() => {
    try {
      if (!editor) return [];
      if (typeof editor.getCollaboratorsOnCurrentPage === 'function') {
        return editor.getCollaboratorsOnCurrentPage() || [];
      }
      if (typeof editor.getCollaborators === 'function') {
        return editor.getCollaborators() || [];
      }
      if (editor.store && typeof editor.store.getPresence === 'function') {
        const map = editor.store.getPresence() || {};
        return Object.values(map);
      }
    } catch (e) {
      // ignore
    }
    return [];
  })();

  const pageToScreen = (p) => {
    try {
      if (!p) return null;
      if (typeof editor.viewportPageToScreen === 'function') return editor.viewportPageToScreen(p);
      if (typeof editor.pageToScreenPoint === 'function') return editor.pageToScreenPoint(p);
      if (typeof editor.pageToScreen === 'function') return editor.pageToScreen(p);
    } catch (e) { /* ignore */ }
    return null;
  };

  const renderCursors = () => {
    if (!editor) return null;
    return collaborators.map((c, i) => {
      try {
        const page = c?.point || c?.camera?.point || c?.position;
        if (!page) return null;
        const screen = pageToScreen(page);
        if (!screen) return null;
        const left = Math.round(screen.x);
        const top = Math.round(screen.y);
        const name = c.name || c.userName || c.userId || c.id || 'anon';
        const color = c.color || '#60a5fa';
        return (
          <div key={c.id || c.userId || i} style={{
            position: 'absolute',
            left,
            top,
            transform: 'translate(-50%,-110%)',
            pointerEvents: 'none',
            zIndex: 2000
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 10, height: 10, borderRadius: 999, background: color, boxShadow: '0 4px 12px rgba(0,0,0,0.45)' }} />
              <div style={{
                background: 'rgba(0,0,0,0.72)',
                color: '#fff',
                padding: '2px 6px',
                borderRadius: 6,
                fontSize: 11,
                whiteSpace: 'nowrap'
              }}>
                {name}
              </div>
            </div>
          </div>
        );
      } catch (e) {
        return null;
      }
    });
  };

  return <>{renderCursors()}</>;
};

// Main Whiteboard component
export default function Whiteboard({
  sessionId,
  boardId,
  isReadOnly = false,
  userName,
  isHost = false,
  boardConfig = {}
}) {
  const tabId = useTabId();
  const [currentPdf, setCurrentPdf] = useState(null);

  useEffect(() => {
    if (userName) {
      sessionStorage.setItem('codecrew-username', userName);
    } else {
      sessionStorage.setItem('codecrew-username', sessionStorage.getItem('codecrew-username') || 'anonymous');
    }
  }, [userName]);

  const wsUrl = useMemo(() => {
    const base = `${WEBSOCKET_URL}/whiteboard/${sessionId}/${boardId}`;
    const params = new URLSearchParams({ tabId, userName: userName || 'anonymous' });
    return `${base}?${params.toString()}`;
  }, [sessionId, boardId, tabId, userName]);

  const privatePrefixes = useMemo(() => ['private_', 'private-note', 'note_', 'note-'], []);
  const isPrivate = useMemo(() => !!(boardId && privatePrefixes.some(p => boardId.startsWith(p))), [boardId, privatePrefixes]);

  const canEdit = useMemo(() => {
    if (isPrivate) return true;
    if (!boardConfig || !boardConfig.mode) return !!isHost && !boardConfig?.isSharedNote;
    if (boardConfig.isSharedNote) return boardConfig.sharedFrom === userName;
    if (boardConfig.isPrivateNote) return boardConfig.createdBy === userName;
    if (isHost) return true;
    return boardConfig.mode === 'public' || boardConfig.mode === 'everyone';
  }, [isPrivate, boardConfig, userName, isHost]);

  const shouldBeReadonly = useMemo(() => isReadOnly || !canEdit, [isReadOnly, canEdit]);

  const store = useSync({
    uri: wsUrl,
    ...(isPrivate ? { persistenceKey: `tldraw:private:${sessionId}:${boardId}:${userName}` } : {}),
  });

  const uiOverrides = useMemo(() => ({
    actions(editor, actions) {
      const a = { ...(actions || {}) };
      if (shouldBeReadonly) {
        ['delete', 'delete-selected', 'copy', 'duplicate', 'cut', 'paste', 'undo', 'redo', 'bring-forward', 'bring-to-front', 'send-backward', 'send-to-back'].forEach(k => {
          if (a[k]) delete a[k];
        });
      } else {
        if (a['export']) delete a['export'];
      }
      return a;
    },

    tools(editor, tools) {
      const t = { ...(tools || {}) };
      if (shouldBeReadonly) {
        ['style', 'color', 'fill', 'stroke', 'opacity', 'dash', 'size', 'line', 'strokeSize'].forEach(k => {
          if (t[k]) delete t[k];
        });
      }
      return t;
    }
  }), [shouldBeReadonly]);

  const componentsOverride = useMemo(() => {
    const baseComponents = {
      CollaboratorCursor: CustomCollaboratorCursor,
      TopPanel: () => <TopPanel currentPdf={currentPdf} onPdfLoaded={setCurrentPdf} />,
    };

    if (shouldBeReadonly) {
      return {
        ...baseComponents,
        ContextMenu: null,
        ActionsMenu: null,
        HelpMenu: null,
        ZoomMenu: null,
        MainMenu: null,
        Minimap: null,
        StylePanel: null,
        PageMenu: null,
        NavigationPanel: null,
        Toolbar: null,
        KeyboardShortcutsDialog: null,
        QuickActions: null,
        HelperButtons: null,
        DebugPanel: null,
        DebugMenu: null,
        SharePanel: null,
        MenuPanel: null,
        TopPanel: null,
        CursorChatBubble: null,
        RichTextToolbar: null,
        ImageToolbar: null,
        VideoToolbar: null,
        Dialogs: null,
        Toasts: null,
        A11y: null,
        FollowingIndicator: null,
      };
    }

    return baseComponents;
  }, [shouldBeReadonly, currentPdf]);

  const [permissionError, setPermissionError] = useState(null);
  useEffect(() => {
    if (store?.status === 'error') {
      setPermissionError('Failed to connect to whiteboard. You may not have permission to access this board.');
    } else {
      setPermissionError(null);
    }
  }, [store?.status]);

  if (permissionError) {
    return <div style={{ padding: 20 }}>{permissionError}</div>;
  }

  if (!store || store.status === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9CA3AF' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: 8 }}>Connecting to whiteboard...</div>
          <div style={{ fontSize: 12, color: '#9CA3AF' }}>Room: {sessionId} | Board: {boardId}</div>
        </div>
      </div>
    );
  }

   return (
    // Ensure parent chain lets children occupy height
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 0 }}>
      {shouldBeReadonly && <ReadonlyBadge boardConfig={boardConfig} />}
      <PdfStatusIndicator currentPdf={currentPdf} />

      {/* explicit full-height wrapper for Tldraw */}
      <div style={{ width: '100%', height: '100%', minHeight: 0 }}>
        <Tldraw
          store={store}
          isReadonly={shouldBeReadonly}
          overrides={uiOverrides}
          components={componentsOverride}
          // if needed you can pass style as well:
          // style={{ width: '100%', height: '100%' }}
        />
      </div>
    </div>
  );
}