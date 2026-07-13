export interface Loan {
  borrower_name: string;
  borrower_contact: string;
  checked_out_at: string;
}

export interface Book {
  id: number;
  title: string;
  authors: string;
  isbn: string;
  publisher: string;
  published_year: string;
  cover_url: string;
  genre: string;
  tags: string[];
  location: string;
  notes: string;
  added_at: string;
  status: "available" | "checked_out";
  loan: Loan | null;
  /** Count of pending holds on this book (0 when none). */
  pending_holds: number;
}

export interface Checkout {
  borrower_name: string;
  borrower_contact: string;
  checked_out_at: string;
  book_id: number;
  title: string;
  authors: string;
  cover_url: string;
}

export interface CoverAsset {
  name: string;
  url: string;
  size: number;
  modified_at: string;
}

/** One row of a book's loan history (GET /api/books/:id/history). */
export interface LoanRecord {
  id: number;
  borrower_name: string;
  borrower_contact: string;
  checked_out_at: string;
  returned_at: string | null;
}

export interface ReadRecord {
  id: number;
  book_id: number;
  reader_name: string;
  finished_at: string;
}

export interface ReadEntry extends ReadRecord {
  book_title: string;
  authors: string;
  cover_url: string;
}

/** Summary row (GET /api/borrowers). */
export interface Borrower {
  id: number;
  name: string;
  contact: string;
  active_loans: number;
  total_loans: number;
}

/** A pending hold in the admin queue (GET /api/holds, FIFO order). */
export interface Hold {
  id: number;
  book_id: number;
  book_title: string;
  name: string;
  contact: string;
  requested_at: string;
}

/** Receipt returned when a hold is placed (POST /api/books/:id/holds). */
export interface HoldReceipt {
  id: number;
  book_id: number;
  name: string;
  contact: string;
  requested_at: string;
  status: "pending";
}

/** The next pending hold, attached to a check-in response. */
export interface NextHold {
  id: number;
  name: string;
  contact: string;
  requested_at: string;
}

/** POST /api/books/:id/checkin returns the book plus the next hold in line. */
export type CheckinResponse = Book & { next_hold: NextHold | null };

/** One row of a borrower's loan history (GET /api/borrowers/:id/loans). */
export interface BorrowerLoan {
  id: number;
  book_id: number;
  book_title: string;
  checked_out_at: string;
  returned_at: string | null;
}

// Data used by the add/edit form. Tags handled as a raw string in the form.
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
  // Optional base64 data-URL of a newly uploaded cover photo (transient — sent
  // to the server on save, which stores it and sets cover_url).
  cover_data?: string;
}
