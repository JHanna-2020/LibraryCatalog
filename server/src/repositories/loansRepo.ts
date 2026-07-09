import type { DB } from "../db/connection.js";
import type { BookHistoryEntry, BorrowerLoanEntry, CheckoutRow, LoanRow } from "../types.js";

export class LoansRepo {
  constructor(private db: DB) {}

  findActiveByBook(bookId: number): LoanRow | null {
    return (
      (this.db
        .prepare("SELECT * FROM loans WHERE book_id = ? AND returned_at IS NULL")
        .get(bookId) as LoanRow) ?? null
    );
  }

  create(bookId: number, borrowerId: number, bookTitle: string, checkedOutAt: string): number {
    const info = this.db
      .prepare(
        "INSERT INTO loans (book_id, borrower_id, book_title, checked_out_at) VALUES (?, ?, ?, ?)"
      )
      .run(bookId, borrowerId, bookTitle, checkedOutAt);
    return Number(info.lastInsertRowid);
  }

  markReturned(loanId: number, returnedAt: string): void {
    this.db.prepare("UPDATE loans SET returned_at = ? WHERE id = ?").run(returnedAt, loanId);
  }

  /** All currently-active checkouts, flat legacy shape for GET /api/checkouts. */
  listActiveCheckouts(): CheckoutRow[] {
    return this.db
      .prepare(
        `SELECT br.name AS borrower_name,
                br.contact AS borrower_contact,
                l.checked_out_at,
                b.id AS book_id, b.title, b.authors, b.cover_url
         FROM loans l
         JOIN books b ON b.id = l.book_id
         LEFT JOIN borrowers br ON br.id = l.borrower_id
         WHERE l.returned_at IS NULL
         ORDER BY br.name COLLATE NOCASE, b.title COLLATE NOCASE`
      )
      .all() as CheckoutRow[];
  }

  /** Full loan history for a book, newest first. */
  historyForBook(bookId: number): BookHistoryEntry[] {
    return this.db
      .prepare(
        `SELECT l.id,
                COALESCE(br.name, '') AS borrower_name,
                COALESCE(br.contact, '') AS borrower_contact,
                l.checked_out_at, l.returned_at
         FROM loans l
         LEFT JOIN borrowers br ON br.id = l.borrower_id
         WHERE l.book_id = ?
         ORDER BY l.checked_out_at DESC, l.id DESC`
      )
      .all(bookId) as BookHistoryEntry[];
  }

  /** All loans for a borrower, newest first, with the title snapshot. */
  listForBorrower(borrowerId: number): BorrowerLoanEntry[] {
    return this.db
      .prepare(
        `SELECT id, book_id, book_title, checked_out_at, returned_at
         FROM loans
         WHERE borrower_id = ?
         ORDER BY checked_out_at DESC, id DESC`
      )
      .all(borrowerId) as BorrowerLoanEntry[];
  }
}
