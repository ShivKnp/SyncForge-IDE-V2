const fs = require('fs');
const path = require('path');

const WORKSPACES_ROOT = path.resolve(__dirname, '..', 'workspaces');

/**
 * Setup real-time synchronization for a session
 * Watches ShareDB changes and syncs to filesystem
 */
function setupRealtimeSync(sessionId, doc) {
  console.log(`[realtime-sync] Setting up sync for session ${sessionId}`);

  // Ensure workspace directory exists
  const workspaceRoot = path.join(WORKSPACES_ROOT, sessionId);
  if (!fs.existsSync(workspaceRoot)) {
    fs.mkdirSync(workspaceRoot, { recursive: true, mode: 0o777 });
  }

  // Subscribe to document if not already subscribed
  if (!doc.type) {
    doc.fetch((err) => {
      if (err) {
        console.error(`[realtime-sync] Failed to fetch doc for ${sessionId}:`, err);
        return;
      }
      startWatching(sessionId, doc, workspaceRoot);
    });
  } else {
    startWatching(sessionId, doc, workspaceRoot);
  }
}

function startWatching(sessionId, doc, workspaceRoot) {
  // Do initial sync
  syncFullTreeToDisk(sessionId, doc.data, workspaceRoot);

  // Listen for operations (real-time changes)
  doc.on('op', (op, source) => {
    if (!op || !Array.isArray(op)) return;

    console.log(`[realtime-sync] Operation received for ${sessionId}:`, JSON.stringify(op));

    op.forEach((operation) => {
      try {
        handleOperation(sessionId, doc, operation, workspaceRoot);
      } catch (err) {
        console.error(`[realtime-sync] Error handling operation:`, err);
      }
    });
  });
}

/**
 * Handle individual ShareDB operations
 */
function handleOperation(sessionId, doc, operation, workspaceRoot) {
  const path_array = operation.p; // Operation path
  
  if (!path_array || path_array.length === 0) return;

  const firstKey = path_array[0];

  // Handle changes to file contents
  if (firstKey === 'contents') {
    const fileId = path_array[1];
    if (!fileId) return;

    // Content was modified (oi = object insert, od = object delete)
    if (operation.oi !== undefined || operation.si !== undefined || operation.sd !== undefined) {
      console.log(`[realtime-sync] Content changed for file ${fileId}`);
      syncFileToDisk(sessionId, doc.data, fileId, workspaceRoot);
    }
  }

  // Handle changes to tree structure (file/folder creation, deletion, rename)
  if (firstKey === 'tree') {
    const nodeId = path_array[1];
    if (!nodeId) return;

    // New node created
    if (operation.oi !== undefined && operation.od === undefined) {
      console.log(`[realtime-sync] New node created: ${nodeId}`);
      const node = doc.data.tree[nodeId];
      if (node?.type === 'file') {
        syncFileToDisk(sessionId, doc.data, nodeId, workspaceRoot);
      } else if (node?.type === 'folder') {
        createFolderOnDisk(sessionId, doc.data, nodeId, workspaceRoot);
      }
    }

    // Node deleted
    if (operation.od !== undefined && operation.oi === undefined && path_array.length === 2) {
      console.log(`[realtime-sync] Node deleted: ${nodeId}`);
      deleteNodeFromDisk(sessionId, operation.od, nodeId, workspaceRoot);
    }

    // Node property changed (like name for rename)
    if (path_array.length === 3 && path_array[2] === 'name') {
      const oldName = operation.od;
      const newName = operation.oi;
      if (oldName && newName) {
        console.log(`[realtime-sync] Node renamed: ${nodeId} (${oldName} -> ${newName})`);
        renameNodeOnDisk(sessionId, doc.data, nodeId, oldName, workspaceRoot);
      }
    }
  }
}

/**
 * Sync the entire tree to disk (initial sync or full refresh)
 */
function syncFullTreeToDisk(sessionId, data, workspaceRoot) {
  if (!data || !data.tree) return;

  console.log(`[realtime-sync] Full sync for session ${sessionId}`);

  const { tree, contents = {} } = data;

  // Clear existing workspace and recreate
  try {
    if (fs.existsSync(workspaceRoot)) {
      fs.rmSync(workspaceRoot, { recursive: true, force: true });
    }
    fs.mkdirSync(workspaceRoot, { recursive: true, mode: 0o777 });
  } catch (err) {
    console.error(`[realtime-sync] Failed to recreate workspace ${workspaceRoot}:`, err);
    return;
  }

  // Export all nodes
  const nodes = Object.values(tree).filter(node => node && node.id && node.id !== 'root');

  for (const node of nodes) {
    const diskPath = getNodeDiskPath(node, tree, workspaceRoot);
    
    try {
      if (node.type === 'folder') {
        fs.mkdirSync(diskPath, { recursive: true, mode: 0o777 });
      } else if (node.type === 'file') {
        const dir = path.dirname(diskPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true, mode: 0o777 });
        }
        const content = contents[node.id] || '';
        fs.writeFileSync(diskPath, content, 'utf8');
      }
    } catch (err) {
      console.error(`[realtime-sync] Failed to sync node ${node.id}:`, err);
    }
  }
}

/**
 * Sync a single file to disk
 */
function syncFileToDisk(sessionId, data, fileId, workspaceRoot) {
  if (!data || !data.tree || !data.tree[fileId]) return;

  const { tree, contents = {} } = data;
  const node = tree[fileId];

  if (node.type !== 'file') return;

  const diskPath = getNodeDiskPath(node, tree, workspaceRoot);
  const content = contents[fileId] || '';

  try {
    const dir = path.dirname(diskPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o777 });
    }
    fs.writeFileSync(diskPath, content, 'utf8');
    console.log(`[realtime-sync] Synced file ${node.name} to ${diskPath}`);
  } catch (err) {
    console.error(`[realtime-sync] Failed to sync file ${fileId}:`, err);
  }
}

/**
 * Create a folder on disk
 */
function createFolderOnDisk(sessionId, data, folderId, workspaceRoot) {
  if (!data || !data.tree || !data.tree[folderId]) return;

  const { tree } = data;
  const node = tree[folderId];

  if (node.type !== 'folder') return;

  const diskPath = getNodeDiskPath(node, tree, workspaceRoot);

  try {
    fs.mkdirSync(diskPath, { recursive: true, mode: 0o777 });
    console.log(`[realtime-sync] Created folder ${node.name} at ${diskPath}`);
  } catch (err) {
    console.error(`[realtime-sync] Failed to create folder ${folderId}:`, err);
  }
}

/**
 * Delete a node from disk
 */
function deleteNodeFromDisk(sessionId, deletedNode, nodeId, workspaceRoot) {
  if (!deletedNode) return;

  // We need to reconstruct the path from the deleted node data
  // Since the node is already removed from the tree, we can't traverse up
  // So we'll just do a full resync for now (simpler and safer)
  console.log(`[realtime-sync] Node deleted, performing full resync`);
  
  // Note: In production, you might want to cache parent paths to handle this better
  // For now, just trigger a full sync after a short delay
  setTimeout(() => {
    const { connection } = require('../websockets/share');
    const doc = connection.get('examples', sessionId);
    doc.fetch((err) => {
      if (!err && doc.data) {
        syncFullTreeToDisk(sessionId, doc.data, workspaceRoot);
      }
    });
  }, 100);
}

/**
 * Rename a node on disk
 */
function renameNodeOnDisk(sessionId, data, nodeId, oldName, workspaceRoot) {
  if (!data || !data.tree || !data.tree[nodeId]) return;

  const { tree } = data;
  const node = tree[nodeId];
  const newName = node.name;

  // Get parent path
  const parentPath = node.parentId ? getNodeDiskPath(tree[node.parentId], tree, workspaceRoot) : workspaceRoot;
  
  const oldPath = path.join(parentPath, oldName);
  const newPath = path.join(parentPath, newName);

  try {
    if (fs.existsSync(oldPath)) {
      fs.renameSync(oldPath, newPath);
      console.log(`[realtime-sync] Renamed ${oldPath} to ${newPath}`);
    }
  } catch (err) {
    console.error(`[realtime-sync] Failed to rename ${oldPath}:`, err);
  }
}

/**
 * Get the disk path for a node
 */
function getNodeDiskPath(node, tree, workspaceRoot) {
  if (!node) return workspaceRoot;

  const pathParts = [];
  let current = node;

  while (current && current.id !== 'root') {
    pathParts.unshift(current.name);
    current = tree[current.parentId];
  }

  return path.join(workspaceRoot, ...pathParts);
}

module.exports = {
  setupRealtimeSync,
  syncFullTreeToDisk
};
