import type { IsbnSourceResult } from "./types.js";

interface OpenLibraryEntry {
  title?: string;
  authors?: { name?: string }[];
  publishers?: { name?: string }[];
  publish_date?: string;
  cover?: { large?: string; medium?: string };
  subjects?: { name?: string }[];
}

export async function fromOpenLibrary(isbn: string): Promise<IsbnSourceResult | null> {
  try {
    const r = await fetch(
      `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`
    );
    const body = (await r.json()) as Record<string, OpenLibraryEntry | undefined>;
    const e = body[`ISBN:${isbn}`];
    if (!e) return null;
    return {
      title: e.title || "",
      authors: (e.authors || []).map((a) => a.name || "").filter(Boolean).join(", "),
      publisher: (e.publishers || []).map((p) => p.name || "").filter(Boolean).join(", "),
      published_year: (e.publish_date || "").match(/\d{4}/)?.[0] || "",
      cover_url: e.cover?.large || e.cover?.medium || "",
      genre: (e.subjects || []).slice(0, 3).map((s) => s.name || "").filter(Boolean).join(", "),
      notes: "",
    };
  } catch {
    return null;
  }
}
