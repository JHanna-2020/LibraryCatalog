import type { Book } from "../api";

export interface BookFilters {
  query: string;
  genre: string;
  tag: string;
  status: "" | "available" | "checked_out";
}

export const EMPTY_FILTERS: BookFilters = { query: "", genre: "", tag: "", status: "" };

/** Client-side catalog filtering: text search + genre/tag/status facets. */
export function filterBooks(books: Book[], filters: BookFilters): Book[] {
  const q = filters.query.trim().toLowerCase();
  return books.filter((b) => {
    if (filters.genre && b.genre !== filters.genre) return false;
    if (filters.tag && !b.tags.includes(filters.tag)) return false;
    if (filters.status && b.status !== filters.status) return false;
    if (!q) return true;
    return (
      b.title.toLowerCase().includes(q) ||
      b.authors.toLowerCase().includes(q) ||
      b.isbn.toLowerCase().includes(q) ||
      b.tags.some((t) => t.toLowerCase().includes(q))
    );
  });
}

export function collectGenres(books: Book[]): string[] {
  return [...new Set(books.map((b) => b.genre).filter(Boolean))].sort();
}

export function collectTags(books: Book[]): string[] {
  return [...new Set(books.flatMap((b) => b.tags))].sort();
}
