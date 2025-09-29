// editor-backend/routes/upload.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');
const { broadcastMessageToRoom } = require('../websockets/chat');
const cors = require('cors');
const router = express.Router();
const corsOptions = { origin: true, credentials: true };

// Limits
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MB per file
const MAX_UNZIPPED_BYTES = 150 * 1024 * 1024; // 150 MB total uncompressed allowed per zip
const ALLOWED_MIMES = null; // null = allow all; set an array like ['image/png','application/pdf'] to restrict

function sanitizeFileName(name) {
  // keep basename and remove suspicious characters
  const base = path.basename(name);
  return base.replace(/[\0<>:"/\\|?*\x00-\x1F]/g, '_').slice(0, 255);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const sessionId = req.params.id;
    const uploadPath = path.join(__dirname, '..', 'uploads', sessionId);
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const safe = sanitizeFileName(file.originalname);
    // if file exists, append timestamp to avoid clobbering
    const dest = path.join(__dirname, '..', 'uploads', req.params.id, safe);
    if (fs.existsSync(dest)) {
      const ext = path.extname(safe);
      const nameOnly = path.basename(safe, ext);
      cb(null, `${nameOnly}-${Date.now()}${ext}`);
    } else cb(null, safe);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_BYTES }
});

async function safeExtractZip(zipPath, destDir) {
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();

  // Calculate total uncompressed length and detect path traversal
  let totalUncompressed = 0;
  for (const entry of entries) {
    const entryName = entry.entryName;
    if (entryName.includes('..') || path.isAbsolute(entryName)) {
      throw new Error(`Zip contains unsafe entry: ${entryName}`);
    }
    totalUncompressed += entry.header.size || 0;
    if (totalUncompressed > MAX_UNZIPPED_BYTES) {
      throw new Error('Zip uncompressed size exceeds allowed limit');
    }
  }

  // extract to destination
  zip.extractAllTo(destDir, true);
  return { extracted: entries.length };
}

router.options('/:id/upload', cors(corsOptions));
router.post('/:id/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, error: 'No file uploaded.' });

  const sessionId = req.params.id;
  const filePath = req.file.path;
  const originalName = req.file.originalname;
  const fileName = sanitizeFileName(originalName);
  const fileType = req.file.mimetype;

  console.log(`[Upload] Received file: ${fileName} (${fileType}) for session ${sessionId}, size=${req.file.size}`);

  try {
    if (ALLOWED_MIMES && !ALLOWED_MIMES.includes(fileType)) {
      // delete uploaded file
      try { fs.unlinkSync(filePath); } catch (_) {}
      return res.status(400).json({ ok: false, error: 'File type not allowed' });
    }

    if (fileName.toLowerCase().endsWith('.zip')) {
      const outputDir = path.join(req.file.destination, path.basename(fileName, '.zip'));
      fs.mkdirSync(outputDir, { recursive: true });
      try {
        const info = await safeExtractZip(filePath, outputDir);
        console.log(`[Upload] Extracted zip file to ${outputDir} (${info.extracted} entries)`);
      } catch (err) {
        console.error('[Upload] Zip extraction error:', err.message);
        // cleanup and respond with error so uploader knows
        try { fs.unlinkSync(filePath); } catch (_) {}
        return res.status(400).json({ ok: false, error: 'Zip extraction failed or not allowed: ' + err.message });
      }
    } else {
      // simple file uploaded — kept on disk
      console.log('[Upload] Saved file to uploads folder.');
    }

    const uploaderName = req.body?.userName || 'Anonymous';

    // Only broadcast metadata to WS; do not include contents
    broadcastMessageToRoom(sessionId, {
      type: 'file',
      from: uploaderName,
      fileName: fileName,
      fileType: fileType
    });

    return res.status(200).json({ ok: true, message: 'File uploaded and processed successfully.' });
  } catch (error) {
    console.error(`[Upload] Error processing file for session ${sessionId}:`, error && error.stack ? error.stack : error);
    try { fs.unlinkSync(filePath); } catch (_) {}
    return res.status(500).json({ ok: false, error: 'Error processing file.' });
  }
});

module.exports = router;
