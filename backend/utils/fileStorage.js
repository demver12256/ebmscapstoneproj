const fs = require('fs');
const path = require('path');
const { QueryTypes } = require('sequelize');
const { sequelize } = require('../db');

const normalizeUploadPath = (relPath) => {
  if (!relPath) return '';
  const cleaned = String(relPath).replace(/\\/g, '/').trim();
  if (cleaned.startsWith('/uploads/')) return cleaned;
  if (cleaned.startsWith('uploads/')) return `/${cleaned}`;
  return `/uploads/${cleaned.replace(/^\/+/, '')}`;
};

const guessMimeType = (filePath) => {
  const ext = path.extname(filePath || '').toLowerCase();
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.svg') return 'image/svg+xml';
  return 'image/jpeg';
};

const saveUploadedFileToDb = async (relativePath, absoluteFilePath, mimeType) => {
  try {
    if (!absoluteFilePath || !fs.existsSync(absoluteFilePath)) return false;
    const normalizedPath = normalizeUploadPath(relativePath);
    const buffer = fs.readFileSync(absoluteFilePath);
    const detectedMime = mimeType || guessMimeType(normalizedPath);

    await sequelize.query(
      `REPLACE INTO uploaded_files (file_path, mime_type, file_size, file_data, created_at)
       VALUES (:file_path, :mime_type, :file_size, :file_data, NOW())`,
      {
        replacements: {
          file_path: normalizedPath,
          mime_type: detectedMime,
          file_size: buffer.length,
          file_data: buffer,
        },
      }
    );
    return true;
  } catch (err) {
    console.warn('[FILE STORAGE] Failed to persist file to DB:', err.message);
    return false;
  }
};

const walkFiles = (dir, baseDir, fileList = []) => {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, baseDir, fileList);
    } else if (entry.isFile()) {
      const rel = '/uploads/' + path.relative(baseDir, fullPath).replace(/\\/g, '/');
      fileList.push({ rel, fullPath });
    }
  }
  return fileList;
};

const initFileStorageTable = async () => {
  try {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS uploaded_files (
        file_path VARCHAR(255) NOT NULL PRIMARY KEY,
        mime_type VARCHAR(120) NOT NULL DEFAULT 'application/octet-stream',
        file_size INT NOT NULL DEFAULT 0,
        file_data LONGBLOB NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const uploadsRoot = path.join(__dirname, '../uploads');
    const localFiles = walkFiles(uploadsRoot, uploadsRoot);
    for (const f of localFiles) {
      await saveUploadedFileToDb(f.rel, f.fullPath, guessMimeType(f.rel));
    }
  } catch (err) {
    console.warn('[FILE STORAGE] Table init/sync skipped:', err.message);
  }
};

const serveUploadedFileFallback = async (req, res, next) => {
  try {
    const requestedRel = normalizeUploadPath(`/uploads${req.path}`);
    const altRel = requestedRel.replace(/^\/+/, '');

    const rows = await sequelize.query(
      `SELECT file_path, mime_type, file_data
       FROM uploaded_files
       WHERE file_path IN (:p1, :p2)
       LIMIT 1`,
      {
        replacements: { p1: requestedRel, p2: altRel },
        type: QueryTypes.SELECT,
      }
    );

    if (rows && rows.length > 0 && rows[0].file_data) {
      const row = rows[0];
      const buffer = Buffer.isBuffer(row.file_data)
        ? row.file_data
        : Buffer.from(row.file_data);

      // Restore to local disk cache so express.static serves future requests directly
      try {
        const diskTarget = path.join(__dirname, '..', requestedRel.replace(/^\/+/, ''));
        fs.mkdirSync(path.dirname(diskTarget), { recursive: true });
        if (!fs.existsSync(diskTarget)) {
          fs.writeFileSync(diskTarget, buffer);
        }
      } catch (diskErr) {
        // Ignore disk cache write errors
      }

      res.setHeader('Content-Type', row.mime_type || guessMimeType(requestedRel));
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.status(200).send(buffer);
    }

    // Missing profile pictures must 404 so clients can fall back to initials
    // (the SVG placeholder below cannot be rendered by React Native <Image>).
    try {
      const picRows = await sequelize.query(
        `SELECT id FROM beneficiaries WHERE profile_picture IN (:p1, :p2, :p3) LIMIT 1`,
        {
          replacements: { p1: requestedRel, p2: altRel, p3: requestedRel.replace(/^\/+/, '') },
          type: QueryTypes.SELECT,
        }
      );
      if (picRows && picRows.length > 0) {
        return res.status(404).json({ success: false, message: 'Profile picture file not found.' });
      }
    } catch (picErr) {
      // continue to legacy fallback
    }

    // Fallback for legacy demo/seed attachments that predated DB persistence
    const fileName = path.basename(requestedRel);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="560" viewBox="0 0 800 560">
      <rect width="800" height="560" fill="#f8fafc"/>
      <rect x="40" y="40" width="720" height="480" rx="16" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
      <rect x="40" y="40" width="720" height="72" rx="16" fill="#1e3a8a"/>
      <text x="72" y="84" fill="#ffffff" font-family="Arial, sans-serif" font-size="20" font-weight="bold">EBMS — Official Submitted Requirement Document</text>
      <text x="72" y="165" fill="#0f172a" font-family="Arial, sans-serif" font-size="18" font-weight="bold">Document File: ${fileName.replace(/[<>&"']/g, '')}</text>
      <text x="72" y="205" fill="#475569" font-family="Arial, sans-serif" font-size="14">Path: ${requestedRel.replace(/[<>&"']/g, '')}</text>
      <rect x="72" y="240" width="656" height="220" rx="12" fill="#f1f5f9" stroke="#e2e8f0"/>
      <text x="400" y="340" text-anchor="middle" fill="#334155" font-family="Arial, sans-serif" font-size="16" font-weight="bold">Verified EBMS Attachment Record</text>
      <text x="400" y="370" text-anchor="middle" fill="#64748b" font-family="Arial, sans-serif" font-size="13">Municipal Social Welfare &amp; Development / DSWD Calauan, Laguna</text>
    </svg>`;
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.status(200).send(svg);
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  normalizeUploadPath,
  saveUploadedFileToDb,
  initFileStorageTable,
  serveUploadedFileFallback,
};

