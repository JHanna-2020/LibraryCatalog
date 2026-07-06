import express from "express";
import cors from "cors";
import db from "./db.js";

const PORT = process.env.PORT || 4000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "change-me-please";
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "*")
  .split(",")
  .map((s) => s.trim());

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(
  cors({
    origin: ALLOWED_ORIGINS.includes("*") ? true : ALLOWED_ORIGINS,
  })
);

const now = () => new Date().toISOString();

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

function normalizeTags(tags) {
  if (Array.isArray(tags)) return tags.map((t) => String(t).trim()).filter(Boolean).join(",");
  return String(tags || "").trim();
}

app.post("/api/books", requireAdmin, (req, res) => {
  const b = req.body || {};
  if (!b.title || !String(b.title).trim()) {
    return res.status(400).json({ error: "Title is required." });
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
  const book = db.prepare("SELECT * FROM books WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json(withStatus(book));
});

app.put("/api/books/:id", requireAdmin, (req, res) => {
  const existing = db.prepare("SELECT * FROM books WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Not found." });
  const b = req.body || {};
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
  const book = db.prepare("SELECT * FROM books WHERE id = ?").get(existing.id);
  res.json(withStatus(book));
});

app.delete("/api/books/:id", requireAdmin, (req, res) => {
  const info = db.prepare("DELETE FROM books WHERE id = ?").run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: "Not found." });
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
app.get("/api/lookup/:isbn", async (req, res) => {
  const isbn = String(req.params.isbn).replace(/[^0-9Xx]/g, "");
  if (!isbn) return res.status(400).json({ error: "Invalid ISBN." });
  try {
    const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`;
    const r = await fetch(url);
    const data = await r.json();
    const entry = data[`ISBN:${isbn}`];
    if (!entry) return res.status(404).json({ error: "No match found for that ISBN." });
    res.json({
      title: entry.title || "",
      authors: (entry.authors || []).map((a) => a.name).join(", "),
      publisher: (entry.publishers || []).map((p) => p.name).join(", "),
      published_year: (entry.publish_date || "").match(/\d{4}/)?.[0] || "",
      cover_url: entry.cover?.medium || entry.cover?.large || "",
      isbn,
    });
  } catch (err) {
    res.status(502).json({ error: "Lookup service unavailable." });
  }
});

app.listen(PORT, () => {
  console.log(`\n  Library catalog API running on http://localhost:${PORT}`);
  console.log(`  Admin password is ${ADMIN_PASSWORD === "change-me-please" ? "NOT set (using default — change it!)" : "set."}\n`);
});
