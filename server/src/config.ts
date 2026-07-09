import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// This file lives one level below the server root in both src/ (dev, via tsx)
// and dist/ (compiled), so ".." always resolves to server/.
const serverRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const DEFAULT_ADMIN_PASSWORD = "change-me-please";

export interface Config {
  port: number;
  adminPassword: string;
  adminPasswordIsDefault: boolean;
  allowedOrigins: string[];
  dbPath: string;
  coversDir: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const adminPasswordIsDefault = !env.ADMIN_PASSWORD;
  if (adminPasswordIsDefault) {
    // Keep the fallback so a hobby deployment still boots, but make the risk loud.
    console.warn(
      [
        "",
        "  *********************************************************************",
        "  *  WARNING: ADMIN_PASSWORD is not set.                              *",
        "  *  The server is using the well-known default password, so anyone  *",
        "  *  who reads the source can edit your library.                     *",
        "  *  Set ADMIN_PASSWORD in server/.env before exposing this API.     *",
        "  *********************************************************************",
        "",
      ].join("\n")
    );
  }

  return {
    port: Number(env.PORT) || 4000,
    adminPassword: env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD,
    adminPasswordIsDefault,
    allowedOrigins: (env.ALLOWED_ORIGINS || "*").split(",").map((s) => s.trim()),
    dbPath: env.DB_PATH || resolve(serverRoot, "library.db"),
    coversDir: env.COVERS_DIR || resolve(serverRoot, "covers"),
  };
}
