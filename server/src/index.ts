import { loadConfig } from "./config.js";
import { createDatabase } from "./db/connection.js";
import { runMigrations } from "./db/migrate.js";
import { allMigrations } from "./db/migrations/index.js";
import { createApp, createContext } from "./app.js";

const config = loadConfig();

const db = createDatabase(config.dbPath);
const ran = runMigrations(db, allMigrations);
if (ran.length) {
  console.log(`  Applied ${ran.length} database migration(s): ${ran.join(", ")}`);
}

const ctx = createContext(config, db);
await ctx.coversService.ensureDir();

const app = createApp(ctx);
app.listen(config.port, () => {
  console.log(`\n  Library catalog API running on http://localhost:${config.port}`);
  console.log(
    `  Admin password is ${config.adminPasswordIsDefault ? "NOT set (using default — change it!)" : "set."}\n`
  );
});
