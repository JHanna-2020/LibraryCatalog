import type { DB } from "../db/connection.js";
import type { ReadEntry, ReadRow } from "../types.js";

export class ReadsRepo {
  constructor(private db: DB) {}

  create(bookId: number, readerName: string, finishedAt: string): number {
    const info = this.db
      .prepare("INSERT INTO reads (book_id, reader_name, finished_at) VALUES (?, ?, ?)")
      .run(bookId, readerName, finishedAt);
    return Number(info.lastInsertRowid);
  }

  get(id: number): ReadRow | null {
    return (this.db.prepare("SELECT * FROM reads WHERE id = ?").get(id) as ReadRow) ?? null;
  }

  list(readerName = ""): ReadEntry[] {
    const trimmed = readerName.trim();
    const where = trimmed ? "WHERE r.reader_name = ?" : "";
    const args = trimmed ? [trimmed] : [];
    return this.db
      .prepare(
        `SELECT r.id, r.book_id, r.reader_name, r.finished_at,
                b.title AS book_title, b.authors, b.cover_url
         FROM reads r
         JOIN books b ON b.id = r.book_id
         ${where}
         ORDER BY r.finished_at DESC, r.id DESC`
      )
      .all(...args) as ReadEntry[];
  }

  listForBook(bookId: number): ReadRow[] {
    return this.db
      .prepare(
        `SELECT id, book_id, reader_name, finished_at
         FROM reads
         WHERE book_id = ?
         ORDER BY finished_at DESC, id DESC`
      )
      .all(bookId) as ReadRow[];
  }

  readers(): string[] {
    const rows = this.db
      .prepare("SELECT DISTINCT reader_name FROM reads ORDER BY reader_name COLLATE NOCASE")
      .all() as { reader_name: string }[];
    return rows.map((r) => r.reader_name);
  }

  delete(id: number): boolean {
    return this.db.prepare("DELETE FROM reads WHERE id = ?").run(id).changes > 0;
  }
}
