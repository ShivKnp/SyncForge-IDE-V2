// src/components/common/TerminalPanel.js
import React, { useRef, useEffect, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import ReconnectingWebSocket from 'reconnecting-websocket';
import 'xterm/css/xterm.css';

const WEBSOCKET_URL = process.env.REACT_APP_WEB_SOCKET_URL || 'ws://localhost:8080';

const TerminalPanel = ({ sessionId, visible = false, workingDir = '', onToggle, onClose }) => {
  const containerRef = useRef(null);
  const termRef = useRef(null);
  const fitAddonRef = useRef(null);
  const wsRef = useRef(null);

  // debug / dedupe refs
  const lastStatusWriteRef = useRef({ msg: '', t: 0 });
  const printedConnectedRef = useRef(false); // lifecycle guard: only print connected once per mount
  const printedDisconnectedRef = useRef(false);

  const [status, setStatus] = useState('connecting');
  const [connected, setConnected] = useState(false);
  const [collapsed, setCollapsed] = useState(!visible);
  const [heightPx, setHeightPx] = useState(null);
  const dragStateRef = useRef({ dragging: false, startY: 0, startH: 0 });

  const lastRequestedDirRef = useRef('');

  const collapsedHeight = 32;
  const defaultHeight = 280;
  const minHeight = 120;
  const maxHeightMargin = 120;
  const heightKey = `terminal-height:${sessionId}`;

  // safe write wrapper - use this everywhere to write
  const safeWrite = (text, opts = {}) => {
    try {
      // tiny console instrumentation to debug duplicate writes
      console.log('[term.write]', opts.tag || '', JSON.stringify(text).slice(0, 200));
    } catch (e) {}
    try {
      termRef.current?.writeln(text);
    } catch (e) {}
  };

  // load stored height once
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(heightKey);
      const val = raw ? parseInt(raw, 10) : null;
      if (val && !Number.isNaN(val)) setHeightPx(val);
      else setHeightPx(defaultHeight);
    } catch (e) {
      setHeightPx(defaultHeight);
    }
  }, [sessionId]);

  // keep collapsed in sync with prop
  useEffect(() => {
    setCollapsed(!visible);
  }, [visible]);

  // when parent asks to expand (visible === true), ensure panel expands, set a sensible height
  useEffect(() => {
    if (!visible) return;
    setCollapsed(false);

    const winH = window.innerHeight;
    const suggested = Math.max(defaultHeight, Math.floor(winH * 0.28));
    setHeightPx(prev => {
      const next = (prev && prev >= minHeight) ? prev : suggested;
      try { sessionStorage.setItem(heightKey, String(next)); } catch (e) {}
      return next;
    });

    setTimeout(() => {
      try { fitAddonRef.current?.fit(); } catch (e) {}
      try { termRef.current?.focus(); } catch (e) {}
    }, 120);

    if (workingDir && typeof workingDir === 'string') {
      lastRequestedDirRef.current = workingDir;
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: 'input', data: `cd ${workingDir}\n` }));
          ws.send(JSON.stringify({ type: 'resize', cols: termRef.current?.cols || 80, rows: termRef.current?.rows || 24 }));
        } catch (e) {}
      }
    }

  }, [visible, workingDir]);

  // xterm + websocket setup (keeps connection persistent while mounted)
  useEffect(() => {
    // create terminal only once per mount
    const term = new Terminal({ theme: { background: '#0b1220', foreground: '#e6eef8' }, cursorBlink: true, scrollback: 1000 });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // reset lifecycle-printed flags for this mount
    printedConnectedRef.current = false;
    printedDisconnectedRef.current = false;

    const wsUrl = `${WEBSOCKET_URL}/terminal/${sessionId}`;
    const ws = new ReconnectingWebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      setConnected(true);

      // print connected only once per component mount (lifecycle)
      if (!printedConnectedRef.current) {
       safeWrite('\x1b[32mConnected to terminal.\x1b[0m', { tag: 'onopen-first' });
        printedConnectedRef.current = true;
        // clear any previous disconnected flag so a later true disconnect can print (if needed)
        printedDisconnectedRef.current = false;
      } else {
        console.log('[terminal] suppressed duplicate connected (already printed this mount)');
      }

      try { fitAddon.fit(); } catch (e) {}
      if (ws.readyState === WebSocket.OPEN) {
        try { ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows })); } catch(e){}
      }

      // if working dir requested earlier, run it now
      const pendingDir = lastRequestedDirRef.current;
      if (pendingDir) {
        try {
          ws.send(JSON.stringify({ type: 'input', data: `cd ${pendingDir}\n` }));
          lastRequestedDirRef.current = '';
        } catch (e) {}
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'output') {
          term.write(msg.data);
        } else {
          term.write(event.data);
        }
      } catch (e) {
        term.write(event.data);
      }
    };

    ws.onclose = () => {
      setStatus('closed');
      setConnected(false);

      // Print a single disconnected message per lifecycle if we ever printed connected
      if (printedConnectedRef.current && !printedDisconnectedRef.current) {
        safeWrite('\x1b[33mTerminal disconnected.\x1b[0m', { tag: 'onclose-first' });
        printedDisconnectedRef.current = true;
      } else {
        console.log('[terminal] suppressed duplicate disconnected or no prior connected print');
      }
    };

    ws.onerror = () => {
      setStatus('error');
      setConnected(false);
    };

    term.onData((data) => {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'input', data }));
    });

    const onWindowResize = () => { try { fitAddon.fit(); } catch (e) {} };
    window.addEventListener('resize', onWindowResize);

    return () => {
      // cleanup
      window.removeEventListener('resize', onWindowResize);
      try { if (ws && ws.readyState === WebSocket.OPEN) ws.close(); } catch (e) {}
      try { term.dispose(); } catch (e) {}
      // clear refs so future mounts start fresh
      wsRef.current = null;
      termRef.current = null;
      fitAddonRef.current = null;
      // reset lifecycle flags
      printedConnectedRef.current = false;
      printedDisconnectedRef.current = false;
    };
  }, [sessionId]); // recreate when sessionId changes

  useEffect(() => {
    const t = setTimeout(() => { try { fitAddonRef.current?.fit(); } catch (e) {} }, 140);
    return () => clearTimeout(t);
  }, [collapsed, heightPx]);

  const clampHeightToWindow = (h = null) => {
    const winH = window.innerHeight;
    const maxH = Math.max(minHeight, winH - maxHeightMargin);
    const newH = h === null ? (heightPx || defaultHeight) : h;
    const clamped = Math.min(Math.max(newH, minHeight), maxH);
    if (clamped !== (heightPx || 0)) setHeightPx(clamped);
    return clamped;
  };

  // Drag handlers...
  const startDrag = (e) => {
    e.preventDefault();
    dragStateRef.current = {
      dragging: true,
      startY: e.type.includes('mouse') ? e.clientY : e.touches[0].clientY,
      startH: heightPx
    };

    document.addEventListener('mousemove', handleDrag);
    document.addEventListener('touchmove', handleDrag);
    document.addEventListener('mouseup', stopDrag);
    document.addEventListener('touchend', stopDrag);
  };

  const handleDrag = (e) => {
    if (!dragStateRef.current.dragging) return;

    const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
    const deltaY = dragStateRef.current.startY - clientY;
    const newHeight = clampHeightToWindow(dragStateRef.current.startH + deltaY);

    setHeightPx(newHeight);
    try { sessionStorage.setItem(heightKey, String(newHeight)); } catch (e) {}

    setTimeout(() => {
      try { fitAddonRef.current?.fit(); } catch (e) {}
    }, 10);
  };

  const stopDrag = () => {
    dragStateRef.current.dragging = false;
    document.removeEventListener('mousemove', handleDrag);
    document.removeEventListener('touchmove', handleDrag);
    document.removeEventListener('mouseup', stopDrag);
    document.removeEventListener('touchend', stopDrag);
  };

  // Toggle / close handlers
  const handleCollapseToggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    if (onToggle) onToggle(!next);
  };
  const handleClose = () => { if (onClose) onClose(); };

  const expandedHeight = clampHeightToWindow(heightPx || defaultHeight);
  const displayHeight = collapsed ? collapsedHeight : expandedHeight;

  return (
    <div
      className="bottom"
      style={{
        borderRadius: '8px 8px 0 0',
        background: '#0b1220',
        borderTop: '1px solid rgba(255,255,255,0.04)',
        height: displayHeight,
        transition: collapsed ? 'height 160ms ease' : 'none',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        zIndex: 100
      }}
    >
      {/* header */}
      <div style={{
        height: collapsedHeight,
        display:'flex',
        alignItems:'center',
        justifyContent:'space-between',
        padding:'0 10px',
        background:'linear-gradient(180deg, rgba(10,14,20,0.95), rgba(8,10,12,0.9))',
        cursor: 'pointer'
      }}
      onClick={handleCollapseToggle}
      >
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ fontSize:13, fontWeight:600, color:'#e6eef8' }}>Terminal</div>
          <div style={{ fontSize:12, color:'#9fb0c8' }}>{connected ? 'connected' : status}</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <button onClick={handleCollapseToggle} title={collapsed ? 'Expand' : 'Collapse'} style={{ background:'transparent', border:'none', color:'#cbd7e6', padding:'6px 8px', cursor:'pointer' }}>{collapsed ? '▴' : '▾'}</button>
        </div>
      </div>

      {/* drag handle */}
      {!collapsed && (
        <div
          onMouseDown={startDrag}
          onTouchStart={startDrag}
          style={{
            height: 8,
            cursor: 'ns-resize',
            background:'linear-gradient(90deg, rgba(255,255,255,0.02), rgba(255,255,255,0))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div style={{
            width: 48,
            height: 4,
            borderRadius: 2,
            background: 'rgba(255,255,255,0.15)',
            transition: 'background-color 0.2s ease'
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.25)'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.15)'}
          />
        </div>
      )}

      <div ref={containerRef} style={{
        flex: 1,
        minHeight: 0,
        height: collapsed ? 0 : `calc(100% - ${collapsedHeight + 8}px)`,
        overflow: 'hidden',
        padding: '0 8px 8px 8px'
      }} aria-hidden={collapsed}/>

    </div>
  );
};

export default TerminalPanel;
