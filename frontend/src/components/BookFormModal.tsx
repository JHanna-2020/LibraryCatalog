import { lazy, Suspense, useState } from "react";
import { api } from "../api";
import type { Book, BookInput } from "../api";
import Modal from "./Modal";
import CoverPicker from "./CoverPicker";

// ZXing is ~400 kB — load it only when the user actually opens the scanner.
const BarcodeScanner = lazy(() => import("./BarcodeScanner"));

export const EMPTY_BOOK: BookInput = {
  title: "", authors: "", isbn: "", publisher: "", published_year: "",
  cover_url: "", genre: "", tags: "", location: "", notes: "",
};

export function bookToInput(b: Book): BookInput {
  return {
    title: b.title, authors: b.authors, isbn: b.isbn, publisher: b.publisher,
    published_year: b.published_year, cover_url: b.cover_url, genre: b.genre,
    tags: b.tags.join(", "), location: b.location, notes: b.notes,
  };
}

/** Add/edit form with ISBN auto-fill, barcode scanning and cover selection. */
export default function BookFormModal({
  initial,
  id,
  onCancel,
  onSave,
}: {
  initial: BookInput;
  id: number | null;
  onCancel: () => void;
  onSave: (data: BookInput, id: number | null) => Promise<void>;
}) {
  const [data, setData] = useState<BookInput>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [scanning, setScanning] = useState(false);
  const [looking, setLooking] = useState(false);

  const set = (k: keyof BookInput) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setData((d) => ({ ...d, [k]: e.target.value }));

  async function lookup(isbn: string) {
    if (!isbn.trim()) return;
    setLooking(true);
    setErr("");
    try {
      const found = await api.lookupIsbn(isbn);
      setData((d) => ({
        ...d,
        isbn: found.isbn || d.isbn,
        title: found.title || d.title,
        authors: found.authors || d.authors,
        publisher: found.publisher || d.publisher,
        published_year: found.published_year || d.published_year,
        cover_url: found.cover_url || d.cover_url,
        genre: found.genre || d.genre,
        // Don't clobber notes the user already typed.
        notes: d.notes || found.notes || "",
      }));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLooking(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await onSave(data, id);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <>
      <Modal title={id === null ? "Add book" : "Edit book"} onClose={onCancel}>
        <form onSubmit={submit}>
          <div className="isbn-row">
            <label className="field grow">
              <span>ISBN</span>
              <input value={data.isbn} onChange={set("isbn")} placeholder="978…" />
            </label>
            <button type="button" className="btn" onClick={() => lookup(data.isbn)} disabled={looking}>
              {looking ? "Looking…" : "Auto-fill"}
            </button>
            <button type="button" className="btn" onClick={() => setScanning(true)}>Scan</button>
          </div>

          <label className="field">
            <span>Title *</span>
            <input value={data.title} onChange={set("title")} required autoFocus />
          </label>
          <label className="field">
            <span>Author(s)</span>
            <input value={data.authors} onChange={set("authors")} />
          </label>
          <div className="field-row">
            <label className="field">
              <span>Genre</span>
              <input value={data.genre} onChange={set("genre")} />
            </label>
            <label className="field">
              <span>Year</span>
              <input value={data.published_year} onChange={set("published_year")} />
            </label>
          </div>
          <div className="field-row">
            <label className="field">
              <span>Publisher</span>
              <input value={data.publisher} onChange={set("publisher")} />
            </label>
            <label className="field">
              <span>Shelf / location</span>
              <input value={data.location} onChange={set("location")} />
            </label>
          </div>
          <label className="field">
            <span>Tags (comma-separated)</span>
            <input value={data.tags} onChange={set("tags")} placeholder="favorite, signed, sci-fi" />
          </label>
          <label className="field">
            <span>Cover image URL</span>
            <input value={data.cover_url} onChange={set("cover_url")} />
          </label>

          <CoverPicker
            coverUrl={data.cover_url}
            coverData={data.cover_data}
            title={data.title}
            onChange={(patch) => setData((d) => ({ ...d, ...patch }))}
            onError={setErr}
          />

          <label className="field">
            <span>Notes</span>
            <textarea value={data.notes} onChange={set("notes")} rows={2} />
          </label>

          {err && <p className="form-error">{err}</p>}
          <div className="row-end">
            <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </Modal>
      {scanning && (
        <Suspense fallback={null}>
          <BarcodeScanner
            onClose={() => setScanning(false)}
            onDetected={(code) => {
              setScanning(false);
              setData((d) => ({ ...d, isbn: code }));
              lookup(code);
            }}
          />
        </Suspense>
      )}
    </>
  );
}
