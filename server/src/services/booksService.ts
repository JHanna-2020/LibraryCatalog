import type { BooksRepo, BookInput } from "../repositories/booksRepo.js";
import type { CoversService } from "./coversService.js";
import { decodeCoverUpload } from "./coversService.js";
import { HttpError, type BookResponse } from "../types.js";
import {
  normalizeTags,
  isbnLooksValid,
  type BookCreateBody,
  type BookUpdateBody,
} from "../validation.js";

export class BooksService {
  constructor(
    private books: BooksRepo,
    private covers: CoversService
  ) {}

  list(): BookResponse[] {
    return this.books.listWithStatus();
  }

  get(id: number): BookResponse {
    const book = this.books.getWithStatus(id);
    if (!book) throw new HttpError(404, "Not found.");
    return book;
  }

  private warnOnOddIsbn(isbn: string): void {
    if (isbn && !isbnLooksValid(isbn)) {
      console.warn(`[books] Accepting ISBN that doesn't look like ISBN-10/13: "${isbn}"`);
    }
  }

  async create(body: BookCreateBody): Promise<BookResponse> {
    const coverBuf = decodeCoverUpload(body.cover_data);
    const input: BookInput = {
      title: body.title,
      authors: body.authors || "",
      isbn: body.isbn || "",
      publisher: body.publisher || "",
      published_year: body.published_year || "",
      cover_url: body.cover_url || "",
      genre: body.genre || "",
      tags: normalizeTags(body.tags),
      location: body.location || "",
      notes: body.notes || "",
    };
    this.warnOnOddIsbn(input.isbn);
    const id = this.books.create(input, new Date().toISOString());
    if (coverBuf) {
      const url = await this.covers.save(id, coverBuf);
      this.books.setCoverUrl(id, url);
    }
    return this.get(id);
  }

  async update(id: number, body: BookUpdateBody): Promise<BookResponse> {
    const existing = this.books.getRow(id);
    if (!existing) throw new HttpError(404, "Not found.");
    const coverBuf = decodeCoverUpload(body.cover_data);
    const input: BookInput = {
      title: body.title !== undefined ? body.title : existing.title,
      authors: body.authors ?? existing.authors,
      isbn: body.isbn ?? existing.isbn,
      publisher: body.publisher ?? existing.publisher,
      published_year: body.published_year ?? existing.published_year,
      cover_url: body.cover_url ?? existing.cover_url,
      genre: body.genre ?? existing.genre,
      tags: body.tags !== undefined ? normalizeTags(body.tags) : existing.tags,
      location: body.location ?? existing.location,
      notes: body.notes ?? existing.notes,
    };
    this.warnOnOddIsbn(input.isbn);
    this.books.update(id, input);

    if (coverBuf) {
      // A newly uploaded photo replaces whatever cover_url was set above.
      const url = await this.covers.save(id, coverBuf);
      this.books.setCoverUrl(id, url);
    } else if (
      body.cover_url !== undefined &&
      existing.cover_url.startsWith("/covers/") &&
      body.cover_url !== existing.cover_url
    ) {
      // The stored upload was replaced by an external URL (or cleared).
      await this.covers.delete(id);
    }
    return this.get(id);
  }

  async delete(id: number): Promise<void> {
    // Loan history survives: the loans FK is ON DELETE SET NULL and each loan
    // carries a book_title snapshot.
    const deleted = this.books.delete(id);
    if (!deleted) throw new HttpError(404, "Not found.");
    await this.covers.delete(id);
  }
}
