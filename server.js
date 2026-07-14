const express = require('express');
const multer  = require('multer');
const fs      = require('fs');
const path    = require('path');

const app  = express();
app.set('trust proxy', 1);  // Render terminates SSL at the load balancer
const PORT = process.env.PORT || 3456;
const USE_DB = !!process.env.DATABASE_URL;

// ── PostgreSQL (Render) ────────────────────────────────────────
let pool;
if (USE_DB) {
  const { Pool } = require('pg');
  pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  pool.query(`
    CREATE TABLE IF NOT EXISTS submissions (
      id           TEXT PRIMARY KEY,
      student_name TEXT NOT NULL,
      day          TEXT NOT NULL DEFAULT '1',
      photo_data   TEXT,
      photo_mime   TEXT DEFAULT 'image/jpeg',
      submitted_at TIMESTAMPTZ DEFAULT NOW(),
      feedback     TEXT DEFAULT '',
      reviewed     BOOLEAN DEFAULT FALSE
    )
  `).then(() => console.log('DB ready'))
    .catch(err => console.error('DB init error:', err));
}

// ── Local file storage (dev) ───────────────────────────────────
const UPLOAD_DIR       = path.join(__dirname, 'data', 'uploads');
const SUBMISSIONS_FILE = path.join(__dirname, 'data', 'submissions.json');

if (!USE_DB) {
  if (!fs.existsSync(UPLOAD_DIR))       fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  if (!fs.existsSync(SUBMISSIONS_FILE)) fs.writeFileSync(SUBMISSIONS_FILE, '[]');
}

function readSubs()       { return JSON.parse(fs.readFileSync(SUBMISSIONS_FILE, 'utf8')); }
function writeSubs(data)  { fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(data, null, 2)); }

// ── Multer ─────────────────────────────────────────────────────
const upload = USE_DB
  ? multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })
  : multer({
      storage: multer.diskStorage({
        destination: UPLOAD_DIR,
        filename: (req, file, cb) => {
          const ext = path.extname(file.originalname) || '.jpg';
          cb(null, `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
        }
      }),
      limits: { fileSize: 20 * 1024 * 1024 }
    });

app.use(express.json());

// Serve day pages with dynamic OG base URL injected
const PUBLIC_DIR = path.join(__dirname, 'public');
app.get(/^\/(frindle\/)?day\d+\.html$/, (req, res) => {
  const file = path.join(PUBLIC_DIR, req.path);
  if (!fs.existsSync(file)) return res.status(404).end();
  const base = req.protocol + '://' + req.get('host');
  const html = fs.readFileSync(file, 'utf8').replace(/__OG_BASE__/g, base);
  res.set('Content-Type', 'text/html; charset=utf-8').send(html);
});

app.use(express.static(PUBLIC_DIR));
if (!USE_DB) app.use('/uploads', express.static(UPLOAD_DIR));

// ── POST /api/submit ───────────────────────────────────────────
app.post('/api/submit', upload.single('photo'), async (req, res) => {
  const { studentName, day } = req.body;
  if (!studentName || !req.file) return res.status(400).json({ error: '缺少姓名或照片' });

  if (USE_DB) {
    const id = Date.now().toString();
    await pool.query(
      `INSERT INTO submissions (id, student_name, day, photo_data, photo_mime)
       VALUES ($1,$2,$3,$4,$5)`,
      [id, studentName.trim(), day || '1',
       req.file.buffer.toString('base64'),
       req.file.mimetype || 'image/jpeg']
    );
    return res.json({ ok: true, id });
  }

  const subs  = readSubs();
  const entry = {
    id: Date.now().toString(), studentName: studentName.trim(),
    day: day || '1', photoPath: `/uploads/${req.file.filename}`,
    submittedAt: new Date().toISOString(), feedback: '', reviewed: false
  };
  subs.unshift(entry);
  writeSubs(subs);
  res.json({ ok: true, id: entry.id });
});

// ── GET /api/submissions ───────────────────────────────────────
app.get('/api/submissions', async (req, res) => {
  if (USE_DB) {
    const { rows } = await pool.query(
      `SELECT id, student_name AS "studentName", day,
              '/api/photo/' || id AS "photoPath",
              submitted_at AS "submittedAt", feedback, reviewed
       FROM submissions ORDER BY submitted_at DESC`
    );
    return res.json(rows);
  }
  res.json(readSubs());
});

// ── GET /api/photo/:id ─────────────────────────────────────────
app.get('/api/photo/:id', async (req, res) => {
  if (!USE_DB) return res.status(404).end();
  const { rows } = await pool.query(
    `SELECT photo_data, photo_mime FROM submissions WHERE id = $1`, [req.params.id]
  );
  if (!rows.length) return res.status(404).end();
  res.set('Content-Type', rows[0].photo_mime);
  res.send(Buffer.from(rows[0].photo_data, 'base64'));
});

// ── POST /api/feedback/:id ─────────────────────────────────────
app.post('/api/feedback/:id', async (req, res) => {
  if (USE_DB) {
    const sets = [], vals = [];
    if (req.body.feedback !== undefined) sets.push(`feedback=$${vals.push(req.body.feedback)}`);
    if (req.body.reviewed !== undefined) sets.push(`reviewed=$${vals.push(req.body.reviewed)}`);
    if (sets.length) {
      vals.push(req.params.id);
      await pool.query(`UPDATE submissions SET ${sets.join(',')} WHERE id=$${vals.length}`, vals);
    }
    return res.json({ ok: true });
  }
  const subs  = readSubs();
  const entry = subs.find(s => s.id === req.params.id);
  if (!entry) return res.status(404).json({ error: 'Not found' });
  if (req.body.feedback !== undefined) entry.feedback = req.body.feedback;
  if (req.body.reviewed !== undefined) entry.reviewed = req.body.reviewed;
  writeSubs(subs);
  res.json({ ok: true });
});

app.listen(PORT, () => console.log(`Fish in a Tree camp server → http://localhost:${PORT}`));
