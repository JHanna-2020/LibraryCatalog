import type { DB } from "../db/connection.js";
import type { BookResponse, BookRow } from "../types.js";

interface BookWithLoanRow extends BookRow {
  loan_borrower_name: string | null;
  loan_borrower_contact: string | null;
  loan_checked_out_at: string | null;
  pending_holds: number;
}

/**
 * Books + their active loan in one LEFT JOIN (fixes the old per-book N+1),
 * plus a correlated pending-holds count served by the partial index — still a
 * single statement, no per-book round trips. The unique partial index
 * guarantees at most one active loan per book, so the join cannot fan out.
 */
const BOOK_WITH_LOAN_SELECT = `
  SELECT b.*,
         br.name    AS loan_borrower_name,
         br.contact AS loan_borrower_contact,
         l.checked_out_at AS loan_checked_out_at,
         (SELECT COUNT(*) FROM holds h
           WHERE h.book_id = b.id AND h.status = 'pending') AS pending_holds
  FROM books b
  LEFT JOIN loans l ON l.book_id = b.id AND l.returned_at IS NULL
  LEFT JOIN borrowers br ON br.id = l.borrower_id
`;

function toResponse(row: BookWithLoanRow): BookResponse {
  const { loan_borrower_name, loan_borrower_contact, loan_checked_out_at, ...book } = row;
  const checkedOut = loan_checked_out_at !== null;
  return {
    ...book,
    tags: book.tags
      ? book.tags.split(",").map((t) => t.trim()).filter(Boolean)
      : [],
    status: checkedOut ? "checked_out" : "available",
    loan: checkedOut
      ? {
          borrower_name: loan_borrower_name ?? "",
          borrower_contact: loan_borrower_contact ?? "",
          checked_out_at: loan_checked_out_at,
        }
      : null,
    pending_holds: row.pending_holds,
  };
}

export interface BookInput {
  title: string;
  authors: string;
  isbn: string;
  publisher: string;
  published_year: string;
  cover_url: string;
  genre: string;
  tags: string;
  location: string;
  notes: string;
}

export class BooksRepo {
  constructor(private db: DB) {}

  listWithStatus(): BookResponse[] {
    const rows = this.db
      .prepare(`${BOOK_WITH_LOAN_SELECT} ORDER BY b.title COLLATE NOCASE`)
      .all() as BookWithLoanRow[];
    return rows.map(toResponse);
  }

  getWithStatus(id: number): BookResponse | null {
    const row = this.db
      .prepare(`${BOOK_WITH_LOAN_SELECT} WHERE b.id = ?`)
      .get(id) as BookWithLoanRow | undefined;
    return row ? toResponse(row) : null;
  }

  getRow(id: number): BookRow | null {
    return (this.db.prepare("SELECT * FROM books WHERE id = ?").get(id) as BookRow) ?? null;
  }

  create(input: BookInput, addedAt: string): number {
    const info = this.db
      .prepare(
        `INSERT INTO books (title, authors, isbn, publisher, published_year, cover_url, genre, tags, location, notes, added_at)
         VALUES (@title, @authors, @isbn, @publisher, @published_year, @cover_url, @genre, @tags, @location, @notes, @added_at)`
      )
      .run({ ...input, added_at: addedAt });
    return Number(info.lastInsertRowid);
  }

  update(id: number, input: BookInput): void {
    this.db
      .prepare(
        `UPDATE books SET title=@title, authors=@authors, isbn=@isbn, publisher=@publisher,
           published_year=@published_year, cover_url=@cover_url, genre=@genre, tags=@tags,
           location=@location, notes=@notes WHERE id=@id`
      )
      .run({ ...input, id });
  }

  setCoverUrl(id: number, coverUrl: string): void {
    this.db.prepare("UPDATE books SET cover_url = ? WHERE id = ?").run(coverUrl, id);
  }

  delete(id: number): boolean {
    return this.db.prepare("DELETE FROM books WHERE id = ?").run(id).changes > 0;
  }
}
