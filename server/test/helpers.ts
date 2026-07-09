import fs from "node:fs";
import os from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { loadConfig, type Config } from "../src/config.js";
import { createDatabase, type DB } from "../src/db/connection.js";
import { runMigrations } from "../src/db/migrate.js";
import { allMigrations } from "../src/db/migrations/index.js";
import { createApp, createContext, type AppContext } from "../src/app.js";

export const TEST_PASSWORD = "test-secret";

/** Legacy schema exactly as the plain-JS server created it. */
export function createLegacyDb(path = ":memory:"): DB {
  const db = new Database(path) as DB;
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE books (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      title           TEXT NOT NULL,
      authors         TEXT NOT NULL DEFAULT '',
      isbn            TEXT NOT NULL DEFAULT '',
      publisher       TEXT NOT NULL DEFAULT '',
      published_year  TEXT NOT NULL DEFAULT '',
      cover_url       TEXT NOT NULL DEFAULT '',
      genre           TEXT NOT NULL DEFAULT '',
      tags            TEXT NOT NULL DEFAULT '',
      location        TEXT NOT NULL DEFAULT '',
      notes           TEXT NOT NULL DEFAULT '',
      added_at        TEXT NOT NULL
    );
    CREATE TABLE loans (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id           INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      borrower_name     TEXT NOT NULL,
      borrower_contact  TEXT NOT NULL DEFAULT '',
      checked_out_at    TEXT NOT NULL,
      returned_at       TEXT
    );
    CREATE INDEX idx_loans_book_active ON loans(book_id) WHERE returned_at IS NULL;
  `);
  return db;
}

export function seedLegacySampleData(db: DB): void {
  const addBook = db.prepare(
    "INSERT INTO books (title, authors, tags, added_at) VALUES (?, ?, ?, ?)"
  );
  addBook.run("The Hobbit", "J.R.R. Tolkien", "fantasy, classic", "2025-01-01T00:00:00.000Z"); // id 1
  addBook.run("Dune", "Frank Herbert", "", "2025-01-02T00:00:00.000Z"); // id 2
  addBook.run("Emma", "Jane Austen", "", "2025-01-03T00:00:00.000Z"); // id 3

  const addLoan = db.prepare(
    "INSERT INTO loans (book_id, borrower_name, borrower_contact, checked_out_at, returned_at) VALUES (?, ?, ?, ?, ?)"
  );
  // "alice" appears with three casings and mixed contacts; latest non-empty
  // contact is "alice@new.example" and the latest casing is "ALICE".
  addLoan.run(1, "alice", "alice@old.example", "2025-02-01T00:00:00.000Z", "2025-02-10T00:00:00.000Z");
  addLoan.run(2, "Alice", "", "2025-03-01T00:00:00.000Z", "2025-03-10T00:00:00.000Z");
  addLoan.run(1, "ALICE", "alice@new.example", "2025-04-01T00:00:00.000Z", "2025-04-10T00:00:00.000Z");
  // Bob has one active loan on Dune.
  addLoan.run(2, "Bob", "555-1234", "2025-05-01T00:00:00.000Z", null);
}

export function migrate(db: DB): string[] {
  return runMigrations(db, allMigrations);
}

export interface TestEnv {
  app: ReturnType<typeof createApp>;
  ctx: AppContext;
  db: DB;
  config: Config;
  coversDir: string;
  cleanup: () => void;
}

/** Fully-migrated app on an in-memory DB with a temp covers directory. */
export function createTestEnv(options?: {
  db?: DB;
  isbnSources?: AppContext["isbnSources"];
}): TestEnv {
  const coversDir = fs.mkdtempSync(join(os.tmpdir(), "libcat-covers-"));
  const config = loadConfig({
    ADMIN_PASSWORD: TEST_PASSWORD,
    COVERS_DIR: coversDir,
    DB_PATH: ":memory:",
  } as NodeJS.ProcessEnv);
  const db = options?.db ?? createDatabase(":memory:");
  migrate(db);
  const ctx = createContext(config, db, options?.isbnSources);
  const app = createApp(ctx);
  return {
    app,
    ctx,
    db,
    config,
    coversDir,
    cleanup: () => {
      db.close();
      fs.rmSync(coversDir, { recursive: true, force: true });
    },
  };
}

/** 1x1 white JPEG as a data URL, for cover upload tests. */
export const TINY_JPEG_DATA_URL =
  "data:image/jpeg;base64," +
  Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00,
    0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
  ]).toString("base64");
