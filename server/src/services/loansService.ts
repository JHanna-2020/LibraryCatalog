import type { DB } from "../db/connection.js";
import type { BooksRepo } from "../repositories/booksRepo.js";
import type { LoansRepo } from "../repositories/loansRepo.js";
import type { BorrowersRepo } from "../repositories/borrowersRepo.js";
import type { HoldsRepo } from "../repositories/holdsRepo.js";
import { HttpError, type BookResponse, type NextHold } from "../types.js";
import type { CheckoutBody } from "../validation.js";

export class LoansService {
  constructor(
    private db: DB,
    private books: BooksRepo,
    private loans: LoansRepo,
    private borrowers: BorrowersRepo,
    private holds: HoldsRepo
  ) {}

  /**
   * Check a book out to a (possibly new) borrower. Runs in a transaction; the
   * unique partial index on active loans backstops the 409 check.
   */
  checkout(bookId: number, body: CheckoutBody): BookResponse {
    const result = this.db.transaction(() => {
      const book = this.books.getRow(bookId);
      if (!book) throw new HttpError(404, "Not found.");
      if (this.loans.findActiveByBook(bookId)) {
        throw new HttpError(409, "Book is already checked out.");
      }

      const now = new Date().toISOString();
      const contact = body.borrower_contact || "";
      const existing = this.borrowers.findByName(body.borrower_name);
      let borrowerId: number;
      if (existing) {
        borrowerId = existing.id;
        // Refresh the contact when the admin supplies a new one.
        if (contact && contact !== existing.contact) {
          this.borrowers.updateContact(existing.id, contact);
        }
      } else {
        borrowerId = this.borrowers.create(body.borrower_name, contact, now);
      }

      this.loans.create(bookId, borrowerId, book.title, now);
      return this.books.getWithStatus(bookId);
    })();
    if (!result) throw new HttpError(404, "Not found.");
    return result;
  }

  /**
   * Check a book back in. The response surfaces the oldest pending hold so
   * the admin can contact the next person; the hold itself stays pending
   * until fulfilled explicitly.
   */
  checkin(bookId: number): BookResponse & { next_hold: NextHold | null } {
    const result = this.db.transaction(() => {
      const active = this.loans.findActiveByBook(bookId);
      if (!active) throw new HttpError(409, "Book is not checked out.");
      this.loans.markReturned(active.id, new Date().toISOString());
      const book = this.books.getWithStatus(bookId);
      if (!book) throw new HttpError(404, "Not found.");
      return { ...book, next_hold: this.holds.oldestPendingForBook(bookId) };
    })();
    return result;
  }

  historyForBook(bookId: number) {
    return this.loans.historyForBook(bookId);
  }

  listActiveCheckouts() {
    return this.loans.listActiveCheckouts();
  }
}
