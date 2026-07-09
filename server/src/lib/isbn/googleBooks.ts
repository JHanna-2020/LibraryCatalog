import type { IsbnSourceResult } from "./types.js";

interface GoogleVolumeInfo {
  title?: string;
  subtitle?: string;
  authors?: string[];
  publisher?: string;
  publishedDate?: string;
  imageLinks?: { thumbnail?: string; smallThumbnail?: string };
  categories?: string[];
  description?: string;
}

export async function fromGoogleBooks(isbn: string): Promise<IsbnSourceResult | null> {
  try {
    const r = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
    const body = (await r.json()) as { items?: { volumeInfo?: GoogleVolumeInfo }[] };
    const v = body.items?.[0]?.volumeInfo;
    if (!v) return null;
    return {
      title: v.subtitle ? `${v.title}: ${v.subtitle}` : v.title || "",
      authors: (v.authors || []).join(", "),
      publisher: v.publisher || "",
      published_year: (v.publishedDate || "").match(/\d{4}/)?.[0] || "",
      cover_url: (v.imageLinks?.thumbnail || v.imageLinks?.smallThumbnail || "").replace(
        "http://",
        "https://"
      ),
      genre: (v.categories || []).join(", "),
      notes: v.description || "",
    };
  } catch {
    return null;
  }
}
