import type { DB } from "./connection.js";

export interface Migration {
  /** Unique, ordered name, e.g. "001-baseline". Recorded in the migrations table. */
  name: string;
  up: (db: DB) => void;
}

/**
 * Tiny versioned migration runner. Applied migration names are recorded in a
 * `migrations` table; pending ones run in order, each inside its own
 * transaction so a failure leaves the database untouched.
 */
export function runMigrations(db: DB, migrations: Migration[]): string[] {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      name       TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = new Set(
    (db.prepare("SELECT name FROM migrations").all() as { name: string }[]).map((r) => r.name)
  );

  const ordered = [...migrations].sort((a, b) => a.name.localeCompare(b.name));
  const ran: string[] = [];

  for (const migration of ordered) {
    if (applied.has(migration.name)) continue;
    db.transaction(() => {
      migration.up(db);
      db.prepare("INSERT INTO migrations (name, applied_at) VALUES (?, ?)").run(
        migration.name,
        new Date().toISOString()
      );
    })();
    ran.push(migration.name);
  }

  return ran;
}
