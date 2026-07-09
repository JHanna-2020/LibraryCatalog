import type { DB } from "../db/connection.js";
import type { BorrowerRow, BorrowerSummary } from "../types.js";

export class BorrowersRepo {
  constructor(private db: DB) {}

  getById(id: number): BorrowerRow | null {
    return (
      (this.db.prepare("SELECT * FROM borrowers WHERE id = ?").get(id) as BorrowerRow) ?? null
    );
  }

  findByName(name: string): BorrowerRow | null {
    // The name column is COLLATE NOCASE, so = matches case-insensitively.
    return (
      (this.db.prepare("SELECT * FROM borrowers WHERE name = ?").get(name) as BorrowerRow) ?? null
    );
  }

  create(name: string, contact: string, createdAt: string): number {
    const info = this.db
      .prepare("INSERT INTO borrowers (name, contact, created_at) VALUES (?, ?, ?)")
      .run(name, contact, createdAt);
    return Number(info.lastInsertRowid);
  }

  updateContact(id: number, contact: string): void {
    this.db.prepare("UPDATE borrowers SET contact = ? WHERE id = ?").run(contact, id);
  }

  listWithLoanCounts(): BorrowerSummary[] {
    return this.db
      .prepare(
        `SELECT br.id, br.name, br.contact,
                COUNT(CASE WHEN l.returned_at IS NULL AND l.id IS NOT NULL THEN 1 END) AS active_loans,
                COUNT(l.id) AS total_loans
         FROM borrowers br
         LEFT JOIN loans l ON l.borrower_id = br.id
         GROUP BY br.id
         ORDER BY br.name COLLATE NOCASE`
      )
      .all() as BorrowerSummary[];
  }
}
