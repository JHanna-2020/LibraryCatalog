import type {
  Book,
  BookInput,
  Borrower,
  BorrowerLoan,
  Checkout,
  CheckinResponse,
  CoverAsset,
  Hold,
  HoldReceipt,
  LoanRecord,
  ReadEntry,
  ReadRecord,
} from "./types";

// The website is static (on GitHub Pages) and points at YOUR laptop's API.
// These two values are stored in the browser so no rebuild is needed to change
// them — set them once on the Settings screen.
// NOTE: the storage keys, default URL and header name are a compatibility
// contract with existing users' browsers. Do not rename them.
const API_KEY = "lib_api_base";
const PW_KEY = "lib_admin_pw";
const DEFAULT_API_BASE = "https://room-controller.tail8ef820.ts.net";

export function getApiBase(): string {
  return (localStorage.getItem(API_KEY) || DEFAULT_API_BASE).replace(/\/+$/, "");
}
export function setApiBase(url: string) {
  localStorage.setItem(API_KEY, url.trim());
}
export function getPassword(): string {
  return localStorage.getItem(PW_KEY) || "";
}
export function setPassword(pw: string) {
  localStorage.setItem(PW_KEY, pw);
}
export function clearPassword() {
  localStorage.removeItem(PW_KEY);
}

// Cover URLs are stored either as full external URLs (from ISBN lookup) or as a
// relative "/covers/..." path served by your own server. Resolve the latter
// against the configured API address so the <img> loads from the laptop.
export function coverSrc(url: string): string {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return getApiBase() + url;
}

/** Error carrying the HTTP status so callers can special-case e.g. 409. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const base = getApiBase();
  if (!base) throw new Error("No server URL set. Open Settings and enter your API address.");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const pw = getPassword();
  if (pw) headers["x-admin-password"] = pw;

  let res: Response;
  try {
    res = await fetch(base + path, { ...options, headers: { ...headers, ...(options.headers as object) } });
  } catch {
    throw new Error("Can't reach the server. Is your laptop on and the tunnel running?");
  }
  if (!res.ok) {
    let message = `Request failed (${res.status}).`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* keep default */
    }
    throw new ApiError(message, res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<{ ok: boolean }>("/api/health"),
  verifyAdmin: () => request<{ ok: boolean }>("/api/verify-admin", { method: "POST" }),

  listBooks: () => request<Book[]>("/api/books"),
  getBook: (id: number) => request<Book>(`/api/books/${id}`),
  listCovers: () => request<CoverAsset[]>("/api/covers"),
  createBook: (b: BookInput) =>
    request<Book>("/api/books", { method: "POST", body: JSON.stringify(b) }),
  updateBook: (id: number, b: BookInput) =>
    request<Book>(`/api/books/${id}`, { method: "PUT", body: JSON.stringify(b) }),
  deleteBook: (id: number) => request<{ ok: boolean }>(`/api/books/${id}`, { method: "DELETE" }),

  checkout: (id: number, borrower_name: string, borrower_contact: string) =>
    request<Book>(`/api/books/${id}/checkout`, {
      method: "POST",
      body: JSON.stringify({ borrower_name, borrower_contact }),
    }),
  checkin: (id: number) => request<CheckinResponse>(`/api/books/${id}/checkin`, { method: "POST" }),

  listCheckouts: () => request<Checkout[]>("/api/checkouts"),
  lookupIsbn: (isbn: string) =>
    request<Partial<BookInput>>(`/api/lookup/${encodeURIComponent(isbn)}`),

  bookHistory: (id: number) => request<LoanRecord[]>(`/api/books/${id}/history`),
  bookReads: (id: number) => request<ReadRecord[]>(`/api/books/${id}/reads`),
  markRead: (bookId: number, reader_name: string, finished_at: string) =>
    request<ReadRecord>(`/api/books/${bookId}/reads`, {
      method: "POST",
      body: JSON.stringify({ reader_name, finished_at }),
    }),
  listReads: (reader = "") =>
    request<ReadEntry[]>(
      `/api/reads${reader ? `?reader=${encodeURIComponent(reader)}` : ""}`
    ),
  listReaders: () => request<string[]>("/api/reads/readers"),
  deleteRead: (id: number) => request<{ ok: boolean }>(`/api/reads/${id}`, { method: "DELETE" }),
  listBorrowers: () => request<Borrower[]>("/api/borrowers"),
  borrowerLoans: (id: number) => request<BorrowerLoan[]>(`/api/borrowers/${id}/loans`),

  // Holds. Requesting one is public; managing the queue is admin-only.
  requestHold: (bookId: number, name: string, contact: string) =>
    request<HoldReceipt>(`/api/books/${bookId}/holds`, {
      method: "POST",
      body: JSON.stringify({ name, contact }),
    }),
  listHolds: () => request<Hold[]>("/api/holds"),
  cancelHold: (id: number) => request<{ ok: boolean }>(`/api/holds/${id}`, { method: "DELETE" }),
  fulfillHold: (id: number) =>
    request<{ ok: boolean }>(`/api/holds/${id}/fulfill`, { method: "POST" }),
};
