import Database from "better-sqlite3";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// The whole database is a single file living next to the server code.
// Back it up by copying this one file.
const dbPath = join(__dirname, "..", "library.db");

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS books (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    title           TEXT NOT NULL,
    authors         TEXT NOT NULL DEFAULT '',
    isbn            TEXT NOT NULL DEFAULT '',
    publisher       TEXT NOT NULL DEFAULT '',
    published_year  TEXT NOT NULL DEFAULT '',
    cover_url       TEXT NOT NULL DEFAULT '',
    genre           TEXT NOT NULL DEFAULT '',
    tags            TEXT NOT NULL DEFAULT '',   -- comma-separated
    location        TEXT NOT NULL DEFAULT '',   -- shelf / room
    notes           TEXT NOT NULL DEFAULT '',
    added_at        TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS loans (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id           INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    borrower_name     TEXT NOT NULL,
    borrower_contact  TEXT NOT NULL DEFAULT '',
    checked_out_at    TEXT NOT NULL,
    returned_at       TEXT            -- NULL means still checked out
  );

  CREATE INDEX IF NOT EXISTS idx_loans_book_active
    ON loans(book_id) WHERE returned_at IS NULL;
`);

export default db;
