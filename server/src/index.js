import express from "express";
import cors from "cors";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import db from "./db.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const PORT = process.env.PORT || 4000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "change-me-please";
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "*")
  .split(",")
  .map((s) => s.trim());

// Book cover photos are stored here on the server and served at /covers.
// Back this folder up alongside library.db.
const COVERS_DIR = join(__dirname, "..", "covers");
const MAX_COVER_BYTES = 6 * 1024 * 1024;
fs.mkdirSync(COVERS_DIR, { recursive: true });

const app = express();
// Limit is generous because uploaded cover photos arrive as base64 in the body.
app.use(express.json({ limit: "12mb" }));
app.use(
  cors({
    origin: ALLOWED_ORIGINS.includes("*") ? true : ALLOWED_ORIGINS,
  })
);
// Serve stored cover images. Long cache; we cache-bust with ?t= on update.
app.use("/covers", express.static(COVERS_DIR, { maxAge: "365d" }));

const now = () => new Date().toISOString();

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function readCoverUpload(dataUrl) {
  if (!dataUrl) return null;
  const m = /^data:image\/[a-zA-Z+]+;base64,([\s\S]+)$/.exec(String(dataUrl || ""));
  if (!m) throw badRequest("Cover photo must be a valid image upload.");
  const buf = Buffer.from(m[1], "base64");
  if (!buf.length) throw badRequest("Cover photo is empty.");
  if (buf.length > MAX_COVER_BYTES) {
    throw badRequest("Cover photo is too large. Try a smaller photo.");
  }
  return buf;
}

// Save a browser-normalized JPEG as covers/<id>.jpg and return the URL path the
// website should store.
function saveCover(id, buf) {
  fs.writeFileSync(join(COVERS_DIR, `${id}.jpg`), buf);
  // Relative path + cache-buster; the website prefixes it with the API address.
  return `/covers/${id}.jpg?t=${Date.now()}`;
}

function deleteCover(id) {
  try {
    fs.unlinkSync(join(COVERS_DIR, `${id}.jpg`));
  } catch {
    /* no cover on disk — fine */
  }
}

function listCoverAssets() {
  return fs
    .readdirSync(COVERS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(jpe?g|png|webp)$/i.test(entry.name))
    .map((entry) => {
      const stat = fs.statSync(join(COVERS_DIR, entry.name));
      return {
        name: entry.name,
        url: `/covers/${entry.name}`,
        size: stat.size,
        modified_at: stat.mtime.toISOString(),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

// ---- Auth: a single shared admin password guards all write actions. ----
// Read actions (GET) are public so borrowers can view the catalog.
function requireAdmin(req, res, next) {
  const provided = req.get("x-admin-password") || "";
  if (provided !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Wrong or missing admin password." });
  }
  next();
}

// Attach the active loan (if any) to a book row.
function withStatus(book) {
  if (!book) return book;
  const loan = db
    .prepare(
      "SELECT borrower_name, borrower_contact, checked_out_at FROM loans WHERE book_id = ? AND returned_at IS NULL"
    )
    .get(book.id);
  return {
    ...book,
    tags: book.tags ? book.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
    status: loan ? "checked_out" : "available",
    loan: loan || null,
  };
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
app.get("/api/health", (req, res) => res.json({ ok: true }));

// Lets the website confirm the admin password without changing anything.
app.post("/api/verify-admin", requireAdmin, (req, res) => res.json({ ok: true }));

// ---------------------------------------------------------------------------
// Books
// ---------------------------------------------------------------------------
app.get("/api/books", (req, res) => {
  const rows = db.prepare("SELECT * FROM books ORDER BY title COLLATE NOCASE").all();
  res.json(rows.map(withStatus));
});

app.get("/api/books/:id", (req, res) => {
  const book = db.prepare("SELECT * FROM books WHERE id = ?").get(req.params.id);
  if (!book) return res.status(404).json({ error: "Not found." });
  res.json(withStatus(book));
});

app.get("/api/covers", requireAdmin, (req, res) => {
  res.json(listCoverAssets());
});

function normalizeTags(tags) {
  if (Array.isArray(tags)) return tags.map((t) => String(t).trim()).filter(Boolean).join(",");
  return String(tags || "").trim();
}

app.post("/api/books", requireAdmin, (req, res) => {
  const b = req.body || {};
  if (!b.title || !String(b.title).trim()) {
    return res.status(400).json({ error: "Title is required." });
  }
  let coverBuf = null;
  try {
    coverBuf = readCoverUpload(b.cover_data);
  } catch (e) {
    return res.status(e.status || 400).json({ error: e.message });
  }
  const info = db
    .prepare(
      `INSERT INTO books (title, authors, isbn, publisher, published_year, cover_url, genre, tags, location, notes, added_at)
       VALUES (@title, @authors, @isbn, @publisher, @published_year, @cover_url, @genre, @tags, @location, @notes, @added_at)`
    )
    .run({
      title: String(b.title).trim(),
      authors: b.authors || "",
      isbn: b.isbn || "",
      publisher: b.publisher || "",
      published_year: b.published_year || "",
      cover_url: b.cover_url || "",
      genre: b.genre || "",
      tags: normalizeTags(b.tags),
      location: b.location || "",
      notes: b.notes || "",
      added_at: now(),
    });
  const id = info.lastInsertRowid;
  // If an uploaded photo came with the request, store it and point cover_url at it.
  if (coverBuf) {
    const url = saveCover(id, coverBuf);
    db.prepare("UPDATE books SET cover_url = ? WHERE id = ?").run(url, id);
  }
  const book = db.prepare("SELECT * FROM books WHERE id = ?").get(id);
  res.status(201).json(withStatus(book));
});

app.put("/api/books/:id", requireAdmin, (req, res) => {
  const existing = db.prepare("SELECT * FROM books WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Not found." });
  const b = req.body || {};
  let coverBuf = null;
  try {
    coverBuf = readCoverUpload(b.cover_data);
  } catch (e) {
    return res.status(e.status || 400).json({ error: e.message });
  }
  db.prepare(
    `UPDATE books SET title=@title, authors=@authors, isbn=@isbn, publisher=@publisher,
       published_year=@published_year, cover_url=@cover_url, genre=@genre, tags=@tags,
       location=@location, notes=@notes WHERE id=@id`
  ).run({
    id: existing.id,
    title: b.title !== undefined ? String(b.title).trim() : existing.title,
    authors: b.authors ?? existing.authors,
    isbn: b.isbn ?? existing.isbn,
    publisher: b.publisher ?? existing.publisher,
    published_year: b.published_year ?? existing.published_year,
    cover_url: b.cover_url ?? existing.cover_url,
    genre: b.genre ?? existing.genre,
    tags: b.tags !== undefined ? normalizeTags(b.tags) : existing.tags,
    location: b.location ?? existing.location,
    notes: b.notes ?? existing.notes,
  });
  // A newly uploaded photo replaces whatever cover_url was set above.
  if (coverBuf) {
    const url = saveCover(existing.id, coverBuf);
    db.prepare("UPDATE books SET cover_url = ? WHERE id = ?").run(url, existing.id);
  } else if (
    b.cover_url !== undefined &&
    existing.cover_url.startsWith("/covers/") &&
    b.cover_url !== existing.cover_url
  ) {
    deleteCover(existing.id);
  }
  const book = db.prepare("SELECT * FROM books WHERE id = ?").get(existing.id);
  res.json(withStatus(book));
});

app.delete("/api/books/:id", requireAdmin, (req, res) => {
  const info = db.prepare("DELETE FROM books WHERE id = ?").run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: "Not found." });
  deleteCover(req.params.id);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Checkout / check-in
// ---------------------------------------------------------------------------
app.post("/api/books/:id/checkout", requireAdmin, (req, res) => {
  const book = db.prepare("SELECT * FROM books WHERE id = ?").get(req.params.id);
  if (!book) return res.status(404).json({ error: "Not found." });
  const active = db
    .prepare("SELECT id FROM loans WHERE book_id = ? AND returned_at IS NULL")
    .get(book.id);
  if (active) return res.status(409).json({ error: "Book is already checked out." });
  const name = String((req.body && req.body.borrower_name) || "").trim();
  if (!name) return res.status(400).json({ error: "Borrower name is required." });
  db.prepare(
    "INSERT INTO loans (book_id, borrower_name, borrower_contact, checked_out_at) VALUES (?, ?, ?, ?)"
  ).run(book.id, name, (req.body && req.body.borrower_contact) || "", now());
  res.json(withStatus(db.prepare("SELECT * FROM books WHERE id = ?").get(book.id)));
});

app.post("/api/books/:id/checkin", requireAdmin, (req, res) => {
  const active = db
    .prepare("SELECT id FROM loans WHERE book_id = ? AND returned_at IS NULL")
    .get(req.params.id);
  if (!active) return res.status(409).json({ error: "Book is not checked out." });
  db.prepare("UPDATE loans SET returned_at = ? WHERE id = ?").run(now(), active.id);
  res.json(withStatus(db.prepare("SELECT * FROM books WHERE id = ?").get(req.params.id)));
});

// Everything currently checked out (for the "Who has what" view).
app.get("/api/checkouts", (req, res) => {
  const rows = db
    .prepare(
      `SELECT l.borrower_name, l.borrower_contact, l.checked_out_at,
              b.id as book_id, b.title, b.authors, b.cover_url
       FROM loans l JOIN books b ON b.id = l.book_id
       WHERE l.returned_at IS NULL
       ORDER BY l.borrower_name COLLATE NOCASE, b.title COLLATE NOCASE`
    )
    .all();
  res.json(rows);
});

// ---------------------------------------------------------------------------
// ISBN lookup (auto-fill) via Open Library — proxied so the browser never
// needs a CORS exception and you can add other sources later.
// ---------------------------------------------------------------------------
// Two free, no-key book databases. We query both and merge, so a scan fills in
// as many fields as possible. Neither costs anything.
async function fromOpenLibrary(isbn) {
  try {
    const r = await fetch(
      `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`
    );
    const e = (await r.json())[`ISBN:${isbn}`];
    if (!e) return null;
    return {
      title: e.title || "",
      authors: (e.authors || []).map((a) => a.name).join(", "),
      publisher: (e.publishers || []).map((p) => p.name).join(", "),
      published_year: (e.publish_date || "").match(/\d{4}/)?.[0] || "",
      cover_url: e.cover?.large || e.cover?.medium || "",
      genre: (e.subjects || []).slice(0, 3).map((s) => s.name).join(", "),
      notes: "",
    };
  } catch {
    return null;
  }
}

async function fromGoogleBooks(isbn) {
  try {
    const r = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
    const v = (await r.json()).items?.[0]?.volumeInfo;
    if (!v) return null;
    return {
      title: v.subtitle ? `${v.title}: ${v.subtitle}` : v.title || "",
      authors: (v.authors || []).join(", "),
      publisher: v.publisher || "",
      published_year: (v.publishedDate || "").match(/\d{4}/)?.[0] || "",
      cover_url: (v.imageLinks?.thumbnail || v.imageLinks?.smallThumbnail || "").replace(
        "http://",
        "https://"
      ),
      genre: (v.categories || []).join(", "),
      notes: v.description || "",
    };
  } catch {
    return null;
  }
}

app.get("/api/lookup/:isbn", async (req, res) => {
  const isbn = String(req.params.isbn).replace(/[^0-9Xx]/g, "");
  if (!isbn) return res.status(400).json({ error: "Invalid ISBN." });
  const [ol, gb] = await Promise.all([fromOpenLibrary(isbn), fromGoogleBooks(isbn)]);
  if (!ol && !gb) return res.status(404).json({ error: "No match found for that ISBN." });
  const pick = (...vals) => vals.find((v) => v && v.length) || "";
  res.json({
    isbn,
    // Prefer Open Library's library-grade bibliographic fields, fill gaps from Google.
    title: pick(ol?.title, gb?.title),
    authors: pick(ol?.authors, gb?.authors),
    publisher: pick(ol?.publisher, gb?.publisher),
    published_year: pick(ol?.published_year, gb?.published_year),
    cover_url: pick(ol?.cover_url, gb?.cover_url),
    // Google's categories/description tend to be cleaner for these two.
    genre: pick(gb?.genre, ol?.genre),
    notes: pick(gb?.notes),
  });
});

app.listen(PORT, () => {
  console.log(`\n  Library catalog API running on http://localhost:${PORT}`);
  console.log(`  Admin password is ${ADMIN_PASSWORD === "change-me-please" ? "NOT set (using default — change it!)" : "set."}\n`);
});
