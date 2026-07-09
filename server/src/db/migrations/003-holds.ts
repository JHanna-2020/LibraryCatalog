import type { Migration } from "../migrate.js";

/**
 * Public book-hold (reservation) requests.
 *
 * Deletion policy: holds CASCADE away with their book. Unlike loans, holds
 * are transient requests, not history — the spec explicitly allows this, and
 * it keeps GET /api/holds (which joins books for the title) and the
 * pending_holds counts trivially consistent after a book deletion.
 *
 * The unique partial index backstops the service-level "one pending hold per
 * name per book" rule, case-insensitively.
 */
export const migration003Holds: Migration = {
  name: "003-holds",
  up(db) {
    db.exec(`
      CREATE TABLE holds (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        book_id       INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
        name          TEXT NOT NULL,
        contact       TEXT NOT NULL DEFAULT '',
        requested_at  TEXT NOT NULL,
        status        TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'fulfilled', 'cancelled')),
        resolved_at   TEXT
      );

      CREATE INDEX idx_holds_book_pending
        ON holds(book_id) WHERE status = 'pending';

      CREATE UNIQUE INDEX idx_holds_book_name_pending
        ON holds(book_id, name COLLATE NOCASE) WHERE status = 'pending';
    `);
  },
};
