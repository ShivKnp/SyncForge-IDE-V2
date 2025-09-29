// src/utils/CursorManager.js
export default function createCursorManager(editor, model, signalWs, myId = null) {
  // color palette
  const COLORS = [
    '#EF4444', // red
    '#06B6D4', // cyan
    '#7C3AED', // violet
    '#F59E0B', // amber
    '#10B981', // green
    '#3B82F6', // blue
    '#E879F9'  // pink
  ];

  const userColorMap = new Map();
  const getColorForUser = (id) => {
    if (!userColorMap.has(id)) {
      const i = userColorMap.size % COLORS.length;
      userColorMap.set(id, COLORS[i]);
    }
    return userColorMap.get(id);
  };

  const decorationIdsByUser = new Map(); // userId -> [decId]
  const widgetByUser = new Map(); // userId -> content widget
  const latestPosByUser = new Map(); // userId -> stringified position for cheap equality

  const monaco = (typeof window !== 'undefined' && window.monaco) ? window.monaco : null;

  function updateSelectionDecoration(userId, range) {
    if (!model) return;
    const prev = decorationIdsByUser.get(userId) || [];
    const decoration = {
      range,
      options: {
        className: 'remote-selection',
        isWholeLine: false
      }
    };
    try {
      const newIds = model.deltaDecorations(prev, [decoration]);
      decorationIdsByUser.set(userId, newIds);
    } catch (e) {
      // silent fallback
      console.warn('[CursorManager] deltaDecorations failed', e);
    }
  }

  function makeCaretWidget(userId, labelText, color, position) {
    const domNode = document.createElement('div');
    domNode.style.display = 'flex';
    domNode.style.flexDirection = 'column';
    domNode.style.alignItems = 'flex-start';
    domNode.style.pointerEvents = 'none';

    const label = document.createElement('div');
    label.className = 'remote-caret-label';
    label.textContent = labelText || 'Anon';
    label.style.background = color;
    label.style.marginBottom = '4px';
    domNode.appendChild(label);

    const caret = document.createElement('div');
    caret.className = 'remote-caret';
    caret.style.background = color;
    domNode.appendChild(caret);

    const widget = {
      getId: () => `remote-caret-${userId}`,
      getDomNode: () => domNode,
      getPosition: () => {
        if (!position) return null;
        return {
          position: {
            lineNumber: position.lineNumber,
            column: position.column
          },
          preference: [1] // ABOVE
        };
      }
    };

    return widget;
  }

  function removeUser(userId) {
    const decs = decorationIdsByUser.get(userId) || [];
    if (decs.length && model) {
      try { model.deltaDecorations(decs, []); } catch (e) { /* ignore */ }
    }
    decorationIdsByUser.delete(userId);
    const w = widgetByUser.get(userId);
    if (w) {
      try { editor.removeContentWidget(w); } catch (e) {}
      widgetByUser.delete(userId);
    }
    userColorMap.delete(userId);
    latestPosByUser.delete(userId);
  }

  function selectionToRange(selection) {
    if (!selection) return null;
    if (!monaco) return null;
    try {
      const { startLine, startColumn, endLine, endColumn } = selection;
      return new monaco.Range(startLine, startColumn, endLine, endColumn);
    } catch (e) {
      return null;
    }
  }

  // handle incoming remote cursor payloads
  function handleRemoteCursor(payload) {
    try {
      if (!payload || !payload.userId) return;
      if (payload.userId === myId) return;

      const key = JSON.stringify(payload.selection || payload.caret || {});
      const last = latestPosByUser.get(payload.userId);
      if (key === last) return;
      latestPosByUser.set(payload.userId, key);

      const color = getColorForUser(payload.userId);
      const range = payload.selection ? selectionToRange(payload.selection) : null;
      if (range) updateSelectionDecoration(payload.userId, range);
      else {
        // remove decorations if no selection
        const prev = decorationIdsByUser.get(payload.userId) || [];
        if (prev.length) {
          try { model.deltaDecorations(prev, []); } catch(e) {}
          decorationIdsByUser.delete(payload.userId);
        }
      }

      const caretPos = payload.caret || (payload.selection && {
        lineNumber: payload.selection.endLine,
        column: payload.selection.endColumn
      });

      if (caretPos) {
        const existing = widgetByUser.get(payload.userId);
        if (existing) {
          try { editor.removeContentWidget(existing); } catch (e) {}
          widgetByUser.delete(payload.userId);
        }
        const widget = makeCaretWidget(payload.userId, payload.name || 'Anon', color, caretPos);
        try {
          editor.addContentWidget(widget);
          widgetByUser.set(payload.userId, widget);
          editor.layoutContentWidget(widget);
        } catch (e) {
          // ignore layout errors
        }
      }
    } catch (e) {
      console.warn('[CursorManager] handleRemoteCursor error', e);
    }
  }

  // wire up socket messages (if provided)
  if (signalWs && typeof signalWs.addEventListener === 'function') {
    signalWs.addEventListener('message', (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (!msg) return;
        if (msg.type === 'cursor') {
          handleRemoteCursor(msg);
        } else if (msg.type === 'leave') {
          removeUser(msg.userId);
        }
      } catch (e) {
        // ignore non-json or other messages
      }
    });
  }

  return {
    handleRemoteCursor,
    removeUser,
    dispose: () => {
      for (const uid of Array.from(widgetByUser.keys())) removeUser(uid);
      // optionally remove socket listener: not removing here because we don't keep the handler ref
    }
  };
}
