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
