import type { DB } from "../db/connection.js";
import type { HoldRow, NextHold, PendingHoldEntry } from "../types.js";

export class HoldsRepo {
  constructor(private db: DB) {}

  create(bookId: number, name: string, contact: string, requestedAt: string): HoldRow {
    const info = this.db
      .prepare(
        "INSERT INTO holds (book_id, name, contact, requested_at, status) VALUES (?, ?, ?, ?, 'pending')"
      )
      .run(bookId, name, contact, requestedAt);
    return this.db
      .prepare("SELECT * FROM holds WHERE id = ?")
      .get(info.lastInsertRowid) as HoldRow;
  }

  /** Case-insensitive: is there already a pending hold by this name on this book? */
  findPendingByBookAndName(bookId: number, name: string): HoldRow | null {
    return (
      (this.db
        .prepare(
          "SELECT * FROM holds WHERE book_id = ? AND name = ? COLLATE NOCASE AND status = 'pending'"
        )
        .get(bookId, name) as HoldRow) ?? null
    );
  }

  /** All pending holds, FIFO (oldest first), with the book title joined in. */
  listPending(): PendingHoldEntry[] {
    return this.db
      .prepare(
        `SELECT h.id, h.book_id, b.title AS book_title, h.name, h.contact, h.requested_at
         FROM holds h
         JOIN books b ON b.id = h.book_id
         WHERE h.status = 'pending'
         ORDER BY h.requested_at ASC, h.id ASC`
      )
      .all() as PendingHoldEntry[];
  }

  oldestPendingForBook(bookId: number): NextHold | null {
    return (
      (this.db
        .prepare(
          `SELECT id, name, contact, requested_at
           FROM holds
           WHERE book_id = ? AND status = 'pending'
           ORDER BY requested_at ASC, id ASC
           LIMIT 1`
        )
        .get(bookId) as NextHold) ?? null
    );
  }

  /** Resolve a pending hold; returns false when there is no pending hold with that id. */
  resolve(id: number, status: "fulfilled" | "cancelled", resolvedAt: string): boolean {
    return (
      this.db
        .prepare(
          "UPDATE holds SET status = ?, resolved_at = ? WHERE id = ? AND status = 'pending'"
        )
        .run(status, resolvedAt, id).changes > 0
    );
  }
}
