export interface IsbnSourceResult {
  title: string;
  authors: string;
  publisher: string;
  published_year: string;
  cover_url: string;
  genre: string;
  notes: string;
}

export interface IsbnLookupResult extends IsbnSourceResult {
  isbn: string;
}
