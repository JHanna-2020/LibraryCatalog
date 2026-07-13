import type { BooksRepo } from "../repositories/booksRepo.js";
import type { ReadsRepo } from "../repositories/readsRepo.js";
import type { ReadCreateBody } from "../validation.js";
import { HttpError } from "../types.js";

export class ReadsService {
  constructor(
    private books: BooksRepo,
    private reads: ReadsRepo
  ) {}

  list(readerName = "") {
    return this.reads.list(readerName);
  }

  readers() {
    return this.reads.readers();
  }

  listForBook(bookId: number) {
    if (!this.books.getRow(bookId)) throw new HttpError(404, "Not found.");
    return this.reads.listForBook(bookId);
  }

  create(bookId: number, body: ReadCreateBody) {
    if (!this.books.getRow(bookId)) throw new HttpError(404, "Not found.");
    const finishedAt = normalizeFinishedAt(body.finished_at);
    const id = this.reads.create(bookId, body.reader_name, finishedAt);
    return this.reads.get(id);
  }

  delete(id: number): void {
    if (!this.reads.delete(id)) throw new HttpError(404, "Not found.");
  }
}

function normalizeFinishedAt(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return new Date().toISOString();

  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw);
  const date = dateOnly ? new Date(`${raw}T12:00:00.000Z`) : new Date(raw);
  if (Number.isNaN(date.getTime())) throw new HttpError(400, "Finished date is invalid.");
  return date.toISOString();
}
