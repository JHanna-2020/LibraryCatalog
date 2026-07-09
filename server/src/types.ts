/** Raw books row as stored in SQLite. */
export interface BookRow {
  id: number;
  title: string;
  authors: string;
  isbn: string;
  publisher: string;
  published_year: string;
  cover_url: string;
  genre: string;
  tags: string; // comma-separated in the DB
  location: string;
  notes: string;
  added_at: string;
}

/** Active-loan fields embedded in book API responses (legacy flat shape). */
export interface ActiveLoanInfo {
  borrower_name: string;
  borrower_contact: string;
  checked_out_at: string;
}

/** Book as returned by the API: parsed tags + computed loan status. */
export interface BookResponse extends Omit<BookRow, "tags"> {
  tags: string[];
  status: "available" | "checked_out";
  loan: ActiveLoanInfo | null;
  pending_holds: number;
}

export interface LoanRow {
  id: number;
  book_id: number | null;
  borrower_id: number | null;
  book_title: string;
  checked_out_at: string;
  returned_at: string | null;
}

export interface BorrowerRow {
  id: number;
  name: string;
  contact: string;
  created_at: string;
}

export interface CheckoutRow {
  borrower_name: string;
  borrower_contact: string;
  checked_out_at: string;
  book_id: number;
  title: string;
  authors: string;
  cover_url: string;
}

export interface BookHistoryEntry {
  id: number;
  borrower_name: string;
  borrower_contact: string;
  checked_out_at: string;
  returned_at: string | null;
}

export interface BorrowerSummary {
  id: number;
  name: string;
  contact: string;
  active_loans: number;
  total_loans: number;
}

export interface BorrowerLoanEntry {
  id: number;
  book_id: number | null;
  book_title: string;
  checked_out_at: string;
  returned_at: string | null;
}

export type HoldStatus = "pending" | "fulfilled" | "cancelled";

export interface HoldRow {
  id: number;
  book_id: number;
  name: string;
  contact: string;
  requested_at: string;
  status: HoldStatus;
  resolved_at: string | null;
}

/** Shape returned by POST /api/books/:id/holds. */
export interface HoldResponse {
  id: number;
  book_id: number;
  name: string;
  contact: string;
  requested_at: string;
  status: "pending";
}

/** Row of GET /api/holds (admin queue, FIFO). */
export interface PendingHoldEntry {
  id: number;
  book_id: number;
  book_title: string;
  name: string;
  contact: string;
  requested_at: string;
}

/** Embedded in the checkin response: the oldest pending hold, if any. */
export interface NextHold {
  id: number;
  name: string;
  contact: string;
  requested_at: string;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}
