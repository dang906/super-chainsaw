require('dotenv').config();
const express = require('express');
const multer = require('multer');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const FAMILY_CODE = process.env.FAMILY_CODE || 'family';

const MEMORIAL = {
  personName: process.env.PERSON_NAME || 'In Loving Memory',
  personDates: process.env.PERSON_DATES || '',
  personBio: process.env.PERSON_BIO || '',
};

// Ensure runtime directories exist
// On cloud platforms, set these env vars to a persistent volume path.
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, 'uploads');
const DATA_DIR    = process.env.DATA_DIR    || path.join(__dirname, 'data');
[UPLOADS_DIR, DATA_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Database
const db = new Database(path.join(DATA_DIR, 'memorial.db'));
db.exec(`
  CREATE TABLE IF NOT EXISTS posts (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    author_name     TEXT    NOT NULL,
    content         TEXT    NOT NULL,
    visibility      TEXT    NOT NULL DEFAULT 'public',
    media_type      TEXT,
    media_filename  TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// File upload
const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
]);
const ALLOWED_VIDEO_MIMES = new Set([
  'video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo',
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = /^\.(jpg|jpeg|png|gif|webp|mp4|mov|webm|avi)$/.test(ext) ? ext : '';
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_IMAGE_MIMES.has(file.mimetype) || ALLOWED_VIDEO_MIMES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only images (JPEG, PNG, GIF, WebP) and videos (MP4, MOV, WebM) are allowed.'));
    }
  },
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

// ── Routes ──────────────────────────────────────────────────────────────────

// GET /api/config
app.get('/api/config', (_req, res) => {
  res.json(MEMORIAL);
});

// GET /api/posts
app.get('/api/posts', (req, res) => {
  const isFamily = req.headers['x-family-code'] === FAMILY_CODE;
  const posts = isFamily
    ? db.prepare('SELECT * FROM posts ORDER BY created_at DESC').all()
    : db.prepare("SELECT * FROM posts WHERE visibility = 'public' ORDER BY created_at DESC").all();
  res.json({ posts, isFamily });
});

// POST /api/posts
app.post('/api/posts', upload.single('media'), (req, res) => {
  const { author_name, content, visibility } = req.body;

  if (!author_name?.trim()) {
    return res.status(400).json({ error: 'Your name is required.' });
  }
  if (!content?.trim()) {
    return res.status(400).json({ error: 'Please share a memory.' });
  }

  const safeVisibility = visibility === 'family' ? 'family' : 'public';
  const authorName = author_name.trim().slice(0, 100);
  const memoryContent = content.trim().slice(0, 5000);

  let mediaType = null;
  let mediaFilename = null;

  if (req.file) {
    mediaType = ALLOWED_VIDEO_MIMES.has(req.file.mimetype) ? 'video' : 'photo';
    mediaFilename = req.file.filename;
  }

  const result = db
    .prepare(
      'INSERT INTO posts (author_name, content, visibility, media_type, media_filename) VALUES (?, ?, ?, ?, ?)',
    )
    .run(authorName, memoryContent, safeVisibility, mediaType, mediaFilename);

  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(post);
});

// POST /api/verify-family
app.post('/api/verify-family', (req, res) => {
  const { code } = req.body;
  if (typeof code === 'string' && code === FAMILY_CODE) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, error: 'Incorrect family code. Please try again.' });
  }
});

// Multer / general error handler
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File is too large. Maximum size is 200 MB.' });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
});

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  Memorial website → http://localhost:${PORT}`);
  console.log(`\n  Configuration:`);
  console.log(`    Person:      ${MEMORIAL.personName}`);
  console.log(`    Family code: ${FAMILY_CODE}`);
  console.log(`\n  Customise by setting env vars: PERSON_NAME, PERSON_DATES, PERSON_BIO, FAMILY_CODE, PORT\n`);
});
