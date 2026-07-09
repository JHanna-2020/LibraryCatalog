import type { Migration } from "../migrate.js";

/**
 * Introduces first-class borrowers and durable loan history:
 *
 * 1. New `borrowers` table, backfilled from distinct loans.borrower_name
 *    (case-insensitive dedupe; keeps the most recent non-empty contact and the
 *    casing used on the most recent loan; created_at = earliest loan).
 * 2. Rebuilds `loans`:
 *      - book_id becomes nullable with ON DELETE SET NULL, so history
 *        survives book deletion,
 *      - adds borrower_id (FK to borrowers) backfilled via the name mapping,
 *      - adds book_title, a snapshot of the book's title at checkout,
 *        backfilled from the current books table,
 *      - drops borrower_name / borrower_contact (API responses derive them
 *        from the borrowers join).
 * 3. The active-loan index becomes UNIQUE: at most one open loan per book.
 */
export const migration002BorrowersAndLoanHistory: Migration = {
  name: "002-borrowers-and-loan-history",
  up(db) {
    db.exec(`
      CREATE TABLE borrowers (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT NOT NULL COLLATE NOCASE UNIQUE,
        contact     TEXT NOT NULL DEFAULT '',
        created_at  TEXT NOT NULL
      );
    `);

    // One borrower per case-insensitive name. SQLite's "bare column with a
    // single MIN aggregate" rule is not relied on for correctness here: the
    // group key is only used for NOCASE-matched subqueries, so any casing of
    // the group's name works.
    db.exec(`
      INSERT INTO borrowers (name, contact, created_at)
      SELECT
        (SELECT l2.borrower_name FROM loans l2
           WHERE l2.borrower_name = l.borrower_name COLLATE NOCASE
           ORDER BY l2.checked_out_at DESC, l2.id DESC LIMIT 1),
        COALESCE(
          (SELECT l3.borrower_contact FROM loans l3
             WHERE l3.borrower_name = l.borrower_name COLLATE NOCASE
               AND l3.borrower_contact IS NOT NULL AND l3.borrower_contact <> ''
             ORDER BY l3.checked_out_at DESC, l3.id DESC LIMIT 1),
          ''
        ),
        MIN(l.checked_out_at)
      FROM loans l
      GROUP BY l.borrower_name COLLATE NOCASE;
    `);

    db.exec(`
      CREATE TABLE loans_new (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        book_id         INTEGER REFERENCES books(id) ON DELETE SET NULL,
        borrower_id     INTEGER REFERENCES borrowers(id) ON DELETE SET NULL,
        book_title      TEXT NOT NULL DEFAULT '',
        checked_out_at  TEXT NOT NULL,
        returned_at     TEXT
      );

      INSERT INTO loans_new (id, book_id, borrower_id, book_title, checked_out_at, returned_at)
      SELECT
        l.id,
        l.book_id,
        (SELECT b2.id FROM borrowers b2 WHERE b2.name = l.borrower_name COLLATE NOCASE),
        COALESCE((SELECT bk.title FROM books bk WHERE bk.id = l.book_id), ''),
        l.checked_out_at,
        l.returned_at
      FROM loans l;

      DROP TABLE loans;
      ALTER TABLE loans_new RENAME TO loans;

      CREATE UNIQUE INDEX idx_loans_book_active
        ON loans(book_id) WHERE returned_at IS NULL;
      CREATE INDEX idx_loans_borrower ON loans(borrower_id);
      CREATE INDEX idx_loans_book ON loans(book_id);
    `);
  },
};
