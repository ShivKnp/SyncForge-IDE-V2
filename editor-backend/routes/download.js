// editor-backend/routes/download.js
const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Note: route accepts nested path after /:id/download/
router.get('/:id/download/*', (req, res) => {
  const { id } = req.params;
  // remaining path after /:id/download/
  const relPath = req.params[0] || '';
  // resolve path within uploads/<id> safely
  const baseDir = path.join(__dirname, '..', 'uploads', id);
  const filePath = path.normalize(path.join(baseDir, relPath));

  // security: ensure filePath is inside baseDir
  if (!filePath.startsWith(baseDir)) {
    return res.status(400).send('Invalid file path.');
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    res.download(filePath, (err) => {
      if (err) {
        console.error('[Download] Error serving file:', err);
        res.status(500).send('Could not download the file.');
      }
    });
  } else {
    res.status(404).send('File not found.');
  }
});

module.exports = router;

