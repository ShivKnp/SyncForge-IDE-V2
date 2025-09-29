class StringBinding {
  constructor(doc, path, localPresence) {
    this.doc = doc;
    this.path = path;
    this.localPresence = localPresence;
    this.isInitialSync = true;

    this.editor = null;
    this.model = null;
    this.monaco = null;

    this._changeListener = null;
    this._cursorListener = null;
    this._opListener = this._opListener.bind(this);
    this._onCursorChange = this._onCursorChange.bind(this);
    this._onEditorChange = this._onEditorChange.bind(this);

    this.localChange = false;
    this._debounceTimer = null;
    this._debounceDelay = 120; // reduced from 300 -> faster submit
  }

  attach(editor) {
    if (!editor) return;
    this.editor = editor;
    this.model = editor.getModel();
    this.monaco = window.monaco || null;

    // initial safe sync
    this.update();
    this.isInitialSync = false;

    // listen for remote ops
    this.doc.on('op', this._opListener);

    // listen for local editor changes (debounced)
    if (this.model && !this._changeListener) {
      this._changeListener = this.model.onDidChangeContent(() => this._onEditorChange());
    }
    try {
      this._cursorListener = this.editor.onDidChangeCursorSelection(this._onCursorChange);
    } catch (e) {}
  }

  detach() {
    try { if (this._changeListener) this._changeListener.dispose(); } catch (e) {}
    try { if (this._cursorListener) this._cursorListener.dispose(); } catch (e) {}
    try { this.doc.off('op', this._opListener); } catch (e) {}
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
    this._debounceTimer = null;
  }

  updatePath(newPath) {
    this.detach();
    this.path = newPath;
    this.isInitialSync = true;
    this.attach(this.editor);
  }

  // --- minimal-edit helper ---
  _computeMinimalEdit(oldStr, newStr) {
    if (oldStr === newStr) return null;
    let start = 0;
    const oldLen = oldStr.length;
    const newLen = newStr.length;
    const minLen = Math.min(oldLen, newLen);

    // find common prefix
    while (start < minLen && oldStr[start] === newStr[start]) start++;

    // find common suffix
    let endOld = oldLen - 1;
    let endNew = newLen - 1;
    while (endOld >= start && endNew >= start && oldStr[endOld] === newStr[endNew]) {
      endOld--;
      endNew--;
    }

    const replaceStart = start;
    const replaceEnd = endOld + 1; // exclusive
    const replacementText = newStr.slice(start, endNew + 1);
    return { start: replaceStart, end: replaceEnd, text: replacementText };
  }

  // Apply minimal edit to Monaco model (safer than setValue)
  _applyRemoteValueMinimal(docValue) {
    if (!this.model || !this.monaco) {
      // fallback to setValue if we don't have monaco/model
      try { this.model.setValue(docValue); } catch (e) { console.warn('fallback setValue failed', e); }
      return;
    }

    const modelValue = this.model.getValue();
    if (modelValue === docValue) return;

    const edit = this._computeMinimalEdit(modelValue, docValue);
    if (!edit) {
      // fallback
      try { this.model.setValue(docValue); } catch (e) { console.warn('setValue fallback failed', e); }
      return;
    }

    try {
      // convert offsets to positions
      const startPos = this.model.getPositionAt(edit.start);
      const endPos = this.model.getPositionAt(edit.end);
      const range = new this.monaco.Range(
        startPos.lineNumber, startPos.column,
        endPos.lineNumber, endPos.column
      );

      // mark localChange to avoid echoing back
      this.localChange = true;
      this.model.pushEditOperations(
        [], // no selection adjustments
        [{ range, text: edit.text, forceMoveMarkers: true }],
        () => null
      );
    } catch (e) {
      // fallback setValue on any error
      try { this.model.setValue(docValue); } catch (err) { console.warn('pushEditOperations failed', err); }
    } finally {
      // clear localChange on next tick
      setTimeout(() => { this.localChange = false; }, 0);
    }
  }

  update() {
    const docValue = this._getDeepValue(this.doc && this.doc.data ? this.doc.data : {}, this.path) || '';
    if (!this.model) return;

    const modelValue = this.model.getValue();

    if (this.isInitialSync) {
      if (modelValue !== docValue) {
        this.localChange = true;
        try {
          this.model.setValue(docValue);
        } catch (e) {
          console.warn('StringBinding.update initial setValue failed', e);
        } finally {
          setTimeout(() => { this.localChange = false; }, 0);
        }
      }
      return;
    }

    // For subsequent updates: apply minimal edit if values differ
    if (modelValue !== docValue) {
      this._applyRemoteValueMinimal(docValue);
    }
  }

  _onEditorChange() {
    if (this.localChange || !this.doc || !this.model) return;

    if (this._debounceTimer) clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => {
      this._debounceTimer = null;
      const newValue = this.model.getValue();
      const existing = this._getDeepValue(this.doc.data || {}, this.path) || '';
      if (newValue === existing) return;

      this.localChange = true;
      try {
        // safer: include old value (od) + new value (oi) as replacement
        // JSON0 replace op uses oi/od — this preserves context for some OT engines
        this.doc.submitOp([{ p: this.path, od: existing, oi: newValue }], { source: this });
      } catch (e) {
        console.error('StringBinding submit failed', e);
      } finally {
        setTimeout(() => { this.localChange = false; }, 0);
      }
    }, this._debounceDelay);
  }

  _onCursorChange(event) {
    if (this.localPresence && this.doc && this.doc.data) {
      try {
        this.localPresence.submit({ cursor: event.selection, name: this.doc.data.userName || '' });
      } catch (e) {}
    }
  }

  _opListener(op, source) {
    if (source === this) return; // ignore our own ops
    if (!Array.isArray(op)) return;

    // quickly check whether op touched our path -> call update which now applies minimal edits
    for (const comp of op) {
      if (!comp || !comp.p) continue;
      const p = comp.p;
      if (p.length !== this.path.length) continue;
      let matches = true;
      for (let i = 0; i < this.path.length; ++i) {
        if (p[i] !== this.path[i]) { matches = false; break; }
      }
      if (matches) {
        this.update();
        break;
      }
    }
  }

  _getDeepValue(obj, path) {
    return path.reduce((acc, key) => (acc && acc[key] !== undefined) ? acc[key] : undefined, obj);
  }
}
