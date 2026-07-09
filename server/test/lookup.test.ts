import { describe, it, expect, afterEach } from "vitest";
import request from "supertest";
import { createTestEnv, type TestEnv } from "./helpers.js";
import type { IsbnSourceResult } from "../src/lib/isbn/types.js";

const olResult: IsbnSourceResult = {
  title: "OL Title",
  authors: "OL Author",
  publisher: "OL Press",
  published_year: "1999",
  cover_url: "https://covers.openlibrary.org/x.jpg",
  genre: "OL Genre",
  notes: "",
};

const gbResult: IsbnSourceResult = {
  title: "GB Title",
  authors: "GB Author",
  publisher: "GB Press",
  published_year: "2001",
  cover_url: "https://books.google.com/x.jpg",
  genre: "GB Genre",
  notes: "A long description.",
};

describe("ISBN lookup", () => {
  let env: TestEnv;
  afterEach(() => env.cleanup());

  it("prefers Open Library for bibliographic fields and Google for genre/notes", async () => {
    env = createTestEnv({
      isbnSources: {
        openLibrary: async () => olResult,
        googleBooks: async () => gbResult,
      },
    });
    const res = await request(env.app).get("/api/lookup/9780316769488").expect(200);
    expect(res.body).toEqual({
      isbn: "9780316769488",
      title: "OL Title",
      authors: "OL Author",
      publisher: "OL Press",
      published_year: "1999",
      cover_url: "https://covers.openlibrary.org/x.jpg",
      genre: "GB Genre",
      notes: "A long description.",
    });
  });

  it("falls back to Google when Open Library has no match, 404s when neither does", async () => {
    env = createTestEnv({
      isbnSources: {
        openLibrary: async () => null,
        googleBooks: async (isbn) => (isbn === "1111111111" ? gbResult : null),
      },
    });
    const hit = await request(env.app).get("/api/lookup/1111111111").expect(200);
    expect(hit.body.title).toBe("GB Title");
    expect(hit.body.genre).toBe("GB Genre");
    await request(env.app).get("/api/lookup/2222222222").expect(404);
  });

  it("rate limits repeated lookups from one client", async () => {
    env = createTestEnv({
      isbnSources: {
        openLibrary: async () => olResult,
        googleBooks: async () => null,
      },
    });
    let limited = false;
    for (let i = 0; i < 35; i++) {
      const res = await request(env.app).get("/api/lookup/9780316769488");
      if (res.status === 429) {
        limited = true;
        break;
      }
    }
    expect(limited).toBe(true);
  });
});
