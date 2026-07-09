import { describe, expect, it } from "vitest";
import { collectGenres, collectTags, EMPTY_FILTERS, filterBooks } from "./filterBooks";
import type { Book } from "../api/types";

function makeBook(overrides: Partial<Book>): Book {
  return {
    id: 1,
    title: "Untitled",
    authors: "",
    isbn: "",
    publisher: "",
    published_year: "",
    cover_url: "",
    genre: "",
    tags: [],
    location: "",
    notes: "",
    added_at: "2026-01-01",
    status: "available",
    loan: null,
    pending_holds: 0,
    ...overrides,
  };
}

const books: Book[] = [
  makeBook({ id: 1, title: "Desert Fathers", authors: "Benedicta Ward", genre: "History", tags: ["favorite", "monastic"] }),
  makeBook({ id: 2, title: "The Hobbit", authors: "J.R.R. Tolkien", genre: "Fantasy", tags: ["fiction"], isbn: "9780618968633" }),
  makeBook({
    id: 3,
    title: "On the Incarnation",
    authors: "Athanasius",
    genre: "History",
    tags: ["monastic"],
    status: "checked_out",
    loan: { borrower_name: "Mark", borrower_contact: "", checked_out_at: "2026-06-01" },
  }),
];

describe("filterBooks", () => {
  it("returns everything with empty filters", () => {
    expect(filterBooks(books, EMPTY_FILTERS)).toHaveLength(3);
  });

  it("matches title, author, isbn and tags case-insensitively", () => {
    expect(filterBooks(books, { ...EMPTY_FILTERS, query: "hobbit" }).map((b) => b.id)).toEqual([2]);
    expect(filterBooks(books, { ...EMPTY_FILTERS, query: "TOLKIEN" }).map((b) => b.id)).toEqual([2]);
    expect(filterBooks(books, { ...EMPTY_FILTERS, query: "9780618" }).map((b) => b.id)).toEqual([2]);
    expect(filterBooks(books, { ...EMPTY_FILTERS, query: "monas" }).map((b) => b.id)).toEqual([1, 3]);
  });

  it("ignores surrounding whitespace in the query", () => {
    expect(filterBooks(books, { ...EMPTY_FILTERS, query: "  hobbit  " })).toHaveLength(1);
  });

  it("filters by genre, tag and status", () => {
    expect(filterBooks(books, { ...EMPTY_FILTERS, genre: "History" })).toHaveLength(2);
    expect(filterBooks(books, { ...EMPTY_FILTERS, tag: "favorite" }).map((b) => b.id)).toEqual([1]);
    expect(filterBooks(books, { ...EMPTY_FILTERS, status: "checked_out" }).map((b) => b.id)).toEqual([3]);
  });

  it("combines facets and text query with AND semantics", () => {
    const result = filterBooks(books, { ...EMPTY_FILTERS, genre: "History", query: "incarnation" });
    expect(result.map((b) => b.id)).toEqual([3]);
  });
});

describe("collectGenres / collectTags", () => {
  it("dedupes, drops empties and sorts", () => {
    expect(collectGenres(books)).toEqual(["Fantasy", "History"]);
    expect(collectTags(books)).toEqual(["favorite", "fiction", "monastic"]);
  });
});
