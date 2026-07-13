import { describe, it, expect } from "vitest";
import { createLegacyDb, seedLegacySampleData, migrate } from "./helpers.js";
import { createDatabase } from "../src/db/connection.js";
import type { BorrowerRow, LoanRow } from "../src/types.js";

describe("migration runner", () => {
  it("applies migrations to a fresh database and is idempotent", () => {
    const db = createDatabase(":memory:");
    const first = migrate(db);
    expect(first).toEqual([
      "001-baseline",
      "002-borrowers-and-loan-history",
      "003-holds",
      "004-reads",
    ]);
    const second = migrate(db);
    expect(second).toEqual([]);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all()
      .map((r: any) => r.name);
    expect(tables).toContain("books");
    expect(tables).toContain("loans");
    expect(tables).toContain("borrowers");
    expect(tables).toContain("holds");
    expect(tables).toContain("reads");
    expect(tables).toContain("migrations");
    db.close();
  });
});

describe("migration 002 against an old-schema database with real-shaped data", () => {
  function migratedFixture() {
    const db = createLegacyDb();
    seedLegacySampleData(db);
    migrate(db);
    return db;
  }

  it("keeps every book and loan", () => {
    const db = migratedFixture();
    expect(db.prepare("SELECT COUNT(*) c FROM books").get()).toEqual({ c: 3 });
    expect(db.prepare("SELECT COUNT(*) c FROM loans").get()).toEqual({ c: 4 });
    db.close();
  });

  it("backfills borrowers with case-insensitive dedupe and most recent non-empty contact", () => {
    const db = migratedFixture();
    const borrowers = db
      .prepare("SELECT * FROM borrowers ORDER BY name COLLATE NOCASE")
      .all() as BorrowerRow[];
    expect(borrowers).toHaveLength(2);

    const alice = borrowers[0]!;
    // Casing of the most recent loan wins, contact is the latest non-empty one.
    expect(alice.name).toBe("ALICE");
    expect(alice.contact).toBe("alice@new.example");
    expect(alice.created_at).toBe("2025-02-01T00:00:00.000Z"); // earliest loan

    const bob = borrowers[1]!;
    expect(bob.name).toBe("Bob");
    expect(bob.contact).toBe("555-1234");
    db.close();
  });

  it("links loans to borrowers and snapshots book titles, preserving loan ids", () => {
    const db = migratedFixture();
    const loans = db.prepare("SELECT * FROM loans ORDER BY id").all() as LoanRow[];
    expect(loans.map((l) => l.id)).toEqual([1, 2, 3, 4]);
    expect(loans[0]!.book_title).toBe("The Hobbit");
    expect(loans[3]!.book_title).toBe("Dune");
    expect(loans[3]!.returned_at).toBeNull();

    const aliceId = (db.prepare("SELECT id FROM borrowers WHERE name = 'alice'").get() as any).id;
    expect(loans[0]!.borrower_id).toBe(aliceId);
    expect(loans[1]!.borrower_id).toBe(aliceId);
    expect(loans[2]!.borrower_id).toBe(aliceId);
    db.close();
  });

  it("loan history survives book deletion (FK is now ON DELETE SET NULL)", () => {
    const db = migratedFixture();
    db.prepare("DELETE FROM books WHERE id = 1").run();
    const loans = db
      .prepare("SELECT * FROM loans WHERE book_title = 'The Hobbit'")
      .all() as LoanRow[];
    expect(loans).toHaveLength(2);
    expect(loans.every((l) => l.book_id === null)).toBe(true);
    db.close();
  });

  it("creates a working holds table on top of legacy data (003)", () => {
    const db = migratedFixture();
    db.prepare(
      "INSERT INTO holds (book_id, name, contact, requested_at) VALUES (2, 'Cara', '', '2025-06-01T00:00:00.000Z')"
    ).run();
    // Duplicate pending hold for the same name (any casing) is blocked by the index.
    expect(() =>
      db
        .prepare(
          "INSERT INTO holds (book_id, name, contact, requested_at) VALUES (2, 'CARA', '', '2025-06-02T00:00:00.000Z')"
        )
        .run()
    ).toThrow(/UNIQUE/);
    // Holds cascade away with their book.
    db.prepare("DELETE FROM books WHERE id = 2").run();
    expect(db.prepare("SELECT COUNT(*) c FROM holds").get()).toEqual({ c: 0 });
    db.close();
  });

  it("enforces one active loan per book via unique partial index", () => {
    const db = migratedFixture();
    expect(() =>
      db
        .prepare(
          "INSERT INTO loans (book_id, borrower_id, book_title, checked_out_at) VALUES (2, 1, 'Dune', '2025-06-01T00:00:00.000Z')"
        )
        .run()
    ).toThrow(/UNIQUE/);
    db.close();
  });
});
