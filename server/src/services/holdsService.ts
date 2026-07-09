import type { DB } from "../db/connection.js";
import type { BooksRepo } from "../repositories/booksRepo.js";
import type { LoansRepo } from "../repositories/loansRepo.js";
import type { HoldsRepo } from "../repositories/holdsRepo.js";
import { HttpError, type HoldResponse, type PendingHoldEntry } from "../types.js";
import type { HoldRequestBody } from "../validation.js";

export const HOLD_BOOK_AVAILABLE_MESSAGE =
  "Good news — this book is already back on the shelf, so there's no need for a hold. Come by and pick it up!";
export const HOLD_ALREADY_EXISTS_MESSAGE =
  "You already have a hold on this book. We'll set it aside for you as soon as it comes back.";

export class HoldsService {
  constructor(
    private db: DB,
    private books: BooksRepo,
    private loans: LoansRepo,
    private holds: HoldsRepo
  ) {}

  /**
   * Public hold request. Only checked-out books can be held; one pending hold
   * per visitor name per book (case-insensitive), backstopped by the unique
   * partial index.
   */
  request(bookId: number, body: HoldRequestBody): HoldResponse {
    return this.db.transaction(() => {
      const book = this.books.getRow(bookId);
      if (!book) throw new HttpError(404, "Not found.");
      if (!this.loans.findActiveByBook(bookId)) {
        throw new HttpError(409, HOLD_BOOK_AVAILABLE_MESSAGE);
      }
      if (this.holds.findPendingByBookAndName(bookId, body.name)) {
        throw new HttpError(409, HOLD_ALREADY_EXISTS_MESSAGE);
      }
      const hold = this.holds.create(
        bookId,
        body.name,
        body.contact || "",
        new Date().toISOString()
      );
      return {
        id: hold.id,
        book_id: hold.book_id,
        name: hold.name,
        contact: hold.contact,
        requested_at: hold.requested_at,
        status: "pending" as const,
      };
    })();
  }

  listPending(): PendingHoldEntry[] {
    return this.holds.listPending();
  }

  cancel(holdId: number): void {
    if (!this.holds.resolve(holdId, "cancelled", new Date().toISOString())) {
      throw new HttpError(404, "No pending hold with that id.");
    }
  }

  fulfill(holdId: number): void {
    if (!this.holds.resolve(holdId, "fulfilled", new Date().toISOString())) {
      throw new HttpError(404, "No pending hold with that id.");
    }
  }
}
