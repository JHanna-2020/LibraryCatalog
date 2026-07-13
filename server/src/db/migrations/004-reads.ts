import type { Migration } from "../migrate.js";

/**
 * Personal read-tracking log. Any number of household members can each log a
 * read (including re-reads) against the same book. Unlike loans, entries
 * CASCADE away with their book — this is a personal log, not lending history
 * that needs to survive deletion.
 */
export const migration004Reads: Migration = {
  name: "004-reads",
  up(db) {
    db.exec(`
      CREATE TABLE reads (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        book_id       INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
        reader_name   TEXT NOT NULL,
        finished_at   TEXT NOT NULL
      );

      CREATE INDEX idx_reads_book ON reads(book_id);
    `);
  },
};
