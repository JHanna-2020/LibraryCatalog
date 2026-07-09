import { fromOpenLibrary } from "./openLibrary.js";
import { fromGoogleBooks } from "./googleBooks.js";
import type { IsbnLookupResult, IsbnSourceResult } from "./types.js";

export type IsbnSource = (isbn: string) => Promise<IsbnSourceResult | null>;

const pick = (...vals: (string | undefined)[]): string =>
  vals.find((v) => v && v.length) || "";

/**
 * Query both free sources and merge: Open Library is preferred for the
 * library-grade bibliographic fields (title/authors/publisher/year/cover);
 * Google Books fills genre and description, which it tends to do better.
 */
export async function lookupIsbn(
  isbn: string,
  sources: { openLibrary: IsbnSource; googleBooks: IsbnSource } = {
    openLibrary: fromOpenLibrary,
    googleBooks: fromGoogleBooks,
  }
): Promise<IsbnLookupResult | null> {
  const [ol, gb] = await Promise.all([sources.openLibrary(isbn), sources.googleBooks(isbn)]);
  if (!ol && !gb) return null;
  return {
    isbn,
    title: pick(ol?.title, gb?.title),
    authors: pick(ol?.authors, gb?.authors),
    publisher: pick(ol?.publisher, gb?.publisher),
    published_year: pick(ol?.published_year, gb?.published_year),
    cover_url: pick(ol?.cover_url, gb?.cover_url),
    genre: pick(gb?.genre, ol?.genre),
    notes: pick(gb?.notes),
  };
}
