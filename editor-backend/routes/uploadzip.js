// editor-backend/routes/upload.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;
const AdmZip = require('adm-zip');
const { broadcastMessageToRoom } = require('../websockets/chat') || (() => { return {}; });
const cors = require('cors');
const router = express.Router();
const corsOptions = { origin: true, credentials: true };
// Temp upload storage
const tmpUploadDir = path.join(__dirname, '..', 'tmp-uploads');
if (!fs.existsSync(tmpUploadDir)) fs.mkdirSync(tmpUploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tmpUploadDir);
  },
  filename: (req, file, cb) => {
    // keep original name in tmp dir
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

// Workspaces root (same as code runner expects)
const WORKSPACES_ROOT = path.join(__dirname, '..', 'workspaces');
if (!fs.existsSync(WORKSPACES_ROOT)) fs.mkdirSync(WORKSPACES_ROOT, { recursive: true });

// sanitize path helper
const sanitizeEntryName = (entryName) => {
  // Normalize and remove any leading ../ segments
  const normalized = path.normalize(entryName).replace(/^(\.\.(\/|\\|$))+/, '');
  return normalized;
};
router.options('/:id/upload', cors(corsOptions));
router.post('/:id/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }

  const sessionId = req.params.id;
  const tmpPath = req.file.path;
  const originalName = req.file.originalname;
  const mimeType = req.file.mimetype || '';

  console.log(`[Upload] Received file: ${originalName} for session ${sessionId}`);

  try {
    const sessionWorkspace = path.join(WORKSPACES_ROOT, sessionId);
    await fsPromises.mkdir(sessionWorkspace, { recursive: true });

    if (originalName.endsWith('.zip')) {
      const zip = new AdmZip(tmpPath);
      const entries = zip.getEntries();
      for (const entry of entries) {
        const entryName = entry.entryName;
        const sanitized = sanitizeEntryName(entryName);
        if (!sanitized) continue;

        const destPath = path.join(sessionWorkspace, sanitized);
        if (entry.isDirectory) {
          await fsPromises.mkdir(destPath, { recursive: true });
          continue;
        }
        // ensure parent dir exists
        await fsPromises.mkdir(path.dirname(destPath), { recursive: true });
        // write file buffer
        const data = entry.getData();
        await fsPromises.writeFile(destPath, data);
      }
      console.log(`[Upload] Extracted ZIP to workspace ${sessionWorkspace}`);
    } else {
      // treat as a single file: write into workspace root preserving filename
      const destPath = path.join(sessionWorkspace, req.file.originalname);
      // ensure parent exists
      await fsPromises.mkdir(path.dirname(destPath), { recursive: true });
      await fsPromises.copyFile(tmpPath, destPath);
      console.log(`[Upload] Saved file to ${destPath}`);
    }

    // Remove tmp upload
    try { fs.unlinkSync(tmpPath); } catch (e) {}

    // Broadcast to chat room (if available)
    try {
      const uploaderName = req.body?.userName || 'Anonymous';
      if (typeof broadcastMessageToRoom === 'function') {
        broadcastMessageToRoom(sessionId, {
          type: 'file',
          from: uploaderName,
          fileName: originalName,
          fileType: mimeType
        });
      }
    } catch (e) {
      console.warn('[Upload] broadcast message failed', e);
    }

    return res.status(200).send('File uploaded and processed successfully.');
  } catch (error) {
    console.error(`[Upload] Error processing file for session ${sessionId}:`, error);
    return res.status(500).send('Error processing file.');
  }
});

module.exports = router;
