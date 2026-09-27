const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 4000;

const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// --- Database (SQLite, disimpan sebagai file hivereel.db) ---
const db = new Database(path.join(__dirname, "hivereel.db"));
db.exec(`
  CREATE TABLE IF NOT EXISTS videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    cat TEXT NOT NULL,
    user TEXT NOT NULL,
    filename TEXT NOT NULL,
    createdAt INTEGER NOT NULL
  )
`);

app.use(cors()); // izinkan diakses dari domain frontend manapun
app.use(express.json());
app.use("/uploads", express.static(UPLOAD_DIR)); // biar file video bisa diakses langsung lewat URL

// --- Setup upload file (multer) ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname || ""));
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // maksimal 500MB per video, sesuaikan kalau perlu
});

// GET /api/videos -> daftar semua video (terbaru dulu)
app.get("/api/videos", (req, res) => {
  const rows = db.prepare("SELECT * FROM videos ORDER BY createdAt DESC").all();
  res.json(rows);
});

// POST /api/videos -> upload video baru (multipart/form-data, field file: "video")
app.post("/api/videos", upload.single("video"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "File video wajib diisi" });

  const title = (req.body.title || "").trim() || "Video tanpa judul";
  const cat = (req.body.cat || "").trim() || "Lainnya";
  const user = (req.body.user || "").trim() || "Tanpa nama";
  const createdAt = Date.now();

  const info = db
    .prepare("INSERT INTO videos (title, cat, user, filename, createdAt) VALUES (?, ?, ?, ?, ?)")
    .run(title, cat, user, req.file.filename, createdAt);

  const row = db.prepare("SELECT * FROM videos WHERE id = ?").get(info.lastInsertRowid);
  res.json(row);
});

// DELETE /api/videos/:id -> hapus video (data + filenya)
app.delete("/api/videos/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM videos WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Video tidak ditemukan" });

  fs.unlink(path.join(UPLOAD_DIR, row.filename), () => {}); // hapus filenya, abaikan error kalau sudah hilang
  db.prepare("DELETE FROM videos WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Hivereel server jalan di http://localhost:${PORT}`);
});
