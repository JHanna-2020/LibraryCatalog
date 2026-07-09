import type { Migration } from "../migrate.js";

/**
 * Baseline: the exact schema the plain-JS server created. CREATE IF NOT EXISTS
 * makes this a no-op on existing databases and bootstraps fresh installs with
 * the legacy shape (migration 002 then upgrades both the same way).
 */
export const migration001Baseline: Migration = {
  name: "001-baseline",
  up(db) {
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
        tags            TEXT NOT NULL DEFAULT '',
        location        TEXT NOT NULL DEFAULT '',
        notes           TEXT NOT NULL DEFAULT '',
        added_at        TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS loans (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        book_id           INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
        borrower_name     TEXT NOT NULL,
        borrower_contact  TEXT NOT NULL DEFAULT '',
        checked_out_at    TEXT NOT NULL,
        returned_at       TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_loans_book_active
        ON loans(book_id) WHERE returned_at IS NULL;
    `);
  },
};
