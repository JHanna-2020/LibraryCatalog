import fs from "node:fs/promises";
import { join } from "node:path";
import { HttpError } from "../types.js";

export const MAX_COVER_BYTES = 5 * 1024 * 1024;

/**
 * Decode a base64 data-URL cover upload. Returns null when nothing was
 * uploaded; throws a 400 HttpError for malformed / oversized payloads.
 */
export function decodeCoverUpload(dataUrl: string | undefined | null): Buffer | null {
  if (!dataUrl) return null;
  const m = /^data:image\/[a-zA-Z+]+;base64,([\s\S]+)$/.exec(String(dataUrl));
  if (!m || !m[1]) throw new HttpError(400, "Cover photo must be a valid image upload.");
  const buf = Buffer.from(m[1], "base64");
  if (!buf.length) throw new HttpError(400, "Cover photo is empty.");
  if (buf.length > MAX_COVER_BYTES) {
    throw new HttpError(400, "Cover photo is too large. Try a smaller photo.");
  }
  return buf;
}

export class CoversService {
  constructor(private coversDir: string) {}

  async ensureDir(): Promise<void> {
    await fs.mkdir(this.coversDir, { recursive: true });
  }

  /**
   * Save a cover as covers/<bookId>.jpg and return the relative URL the
   * frontend stores (cache-busted with ?t=; it prefixes the API origin).
   */
  async save(bookId: number, buf: Buffer): Promise<string> {
    await fs.writeFile(join(this.coversDir, `${bookId}.jpg`), buf);
    return `/covers/${bookId}.jpg?t=${Date.now()}`;
  }

  async delete(bookId: number): Promise<void> {
    try {
      await fs.unlink(join(this.coversDir, `${bookId}.jpg`));
    } catch {
      /* no cover on disk — fine */
    }
  }

  async listAssets(): Promise<
    { name: string; url: string; size: number; modified_at: string }[]
  > {
    const entries = await fs.readdir(this.coversDir, { withFileTypes: true });
    const files = entries.filter(
      (e) => e.isFile() && /\.(jpe?g|png|webp)$/i.test(e.name)
    );
    const assets = await Promise.all(
      files.map(async (e) => {
        const stat = await fs.stat(join(this.coversDir, e.name));
        return {
          name: e.name,
          url: `/covers/${e.name}`,
          size: stat.size,
          modified_at: stat.mtime.toISOString(),
        };
      })
    );
    return assets.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }
}
