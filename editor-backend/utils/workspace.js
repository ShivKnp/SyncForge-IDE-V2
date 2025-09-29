const fs = require('fs');
const path = require('path');
const { connection, ensureSessionExists } = require('../websockets/share');

const WORKSPACES_ROOT = path.resolve(__dirname, '..', 'workspaces');

if (!fs.existsSync(WORKSPACES_ROOT)) {
  try {
    fs.mkdirSync(WORKSPACES_ROOT, { recursive: true, mode: 0o777 });
    console.log('[workspace] created WORKSPACES_ROOT:', WORKSPACES_ROOT);
  } catch (e) {
    console.error('[workspace] failed to create WORKSPACES_ROOT', e);
  }
}

// helper: ensure doc is present; if missing create it
const ensureDocExists = async (id) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = connection.get('examples', id);
      doc.fetch(async (err) => {
        if (err) return reject(err);
        if (doc.type === null) {
          // Use the robust ensureSessionExists function
          try {
            await ensureSessionExists(id, 'cpp', 'project');
            const doc2 = connection.get('examples', id);
            doc2.fetch((err2) => {
              if (err2) return reject(err2);
              if (doc2.type === null) return reject(new Error('Failed to create session document'));
              return resolve(doc2);
            });
          } catch (e) {
            return reject(e);
          }
        } else {
          return resolve(doc);
        }
      });
    } catch (ex) {
      reject(ex);
    }
  });
};

const waitForDocHasTree = (doc, timeoutMs = 3000) => {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      if (doc && doc.data && doc.data.tree && Object.keys(doc.data.tree).length > 0) return resolve(true);
      if (Date.now() - start > timeoutMs) return resolve(false);
      setTimeout(check, 50);
    };
    check();
  });
};

exports.exportProjectToDisk = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ ok: false, error: 'Missing session id' });

    console.log(`[export] requested for session ${id}`);

    // Ensure doc exists (create if needed)
    let doc;
    try {
      doc = await ensureDocExists(id);
    } catch (e) {
      console.error('[export] ensureDocExists error', e && e.stack ? e.stack : e);
      return res.status(500).json({ ok: false, error: 'Failed to fetch or create session document' });
    }

    // Wait briefly for doc to have tree/contents (in case createSession hasn't fully written)
    const hasTree = await waitForDocHasTree(doc, 2000);
    if (!hasTree) {
      console.warn('[export] doc has no tree yet; proceeding but result may be empty');
    }

    if (!doc.data || !doc.data.tree || !doc.data.contents) {
      console.warn('[export] no project data available for export:', { hasDoc: !!doc.data, tree: !!(doc.data && doc.data.tree) });
      // still create empty workspace folder so runner errors are clearer
    }

    const { tree = {}, contents = {} } = doc.data || {};
    const workspaceRoot = path.join(WORKSPACES_ROOT, id);

    // Clean and recreate the directory
    try {
      if (fs.existsSync(workspaceRoot)) {
        fs.rmSync(workspaceRoot, { recursive: true, force: true });
      }
      fs.mkdirSync(workspaceRoot, { recursive: true, mode: 0o777 });
    } catch (e) {
      console.error(`[export] failed to create workspaceRoot ${workspaceRoot}`, e);
      return res.status(500).json({ ok: false, error: 'Failed to create workspace directory' });
    }

    const filesWritten = [];
    const toExport = Object.values(tree).filter(node => node && node.id);

    for (const node of toExport) {
      if (!node || !node.name) continue;

      // build relative path from this node up to 'root' (exclude root node name)
      const relPathParts = [];
      let currId = node.id;
      while (currId && tree[currId] && currId !== 'root') {
        relPathParts.unshift(tree[currId].name);
        currId = tree[currId].parentId;
      }

      const relPath = relPathParts.length > 0 ? path.join(...relPathParts) : '';
      const fullPath = path.join(workspaceRoot, relPath);

      try {
        if (node.type === 'folder') {
          fs.mkdirSync(fullPath, { recursive: true, mode: 0o777 });
        } else if (node.type === 'file') {
          // ensure folder exists for the file
          const dir = path.dirname(fullPath);
          if (dir && !fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true, mode: 0o777 });
          }
          const content = typeof contents[node.id] === 'string' ? contents[node.id] : '';
          fs.writeFileSync(fullPath, content, 'utf8');
          filesWritten.push(relPath);
        }
      } catch (e) {
        console.error(`[export] failed to write node ${node.id} -> ${fullPath}`, e);
        // continue to attempt other files
      }
    }

    console.log(`[export] Exported session ${id} to ${workspaceRoot} (${filesWritten.length} files)`);
    return res.json({ ok: true, workspaceRoot, filesWritten });
  } catch (e) {
    console.error('[export] unexpected error', e && e.stack ? e.stack : e);
    return res.status(500).json({ ok: false, error: e.message || 'Unexpected server error' });
  }
};