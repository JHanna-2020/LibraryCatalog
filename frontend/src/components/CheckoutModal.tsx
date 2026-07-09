import { useState } from "react";
import { api, ApiError } from "../api";
import type { Book } from "../api";
import Modal from "./Modal";

/** Lend a book to someone. Surfaces a friendly message on a 409 conflict. */
export default function CheckoutModal({
  book,
  onCancel,
  onDone,
}: {
  book: Book;
  onCancel: () => void;
  onDone: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await api.checkout(book.id, name, contact);
      await onDone();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setErr(`"${book.title}" is already checked out. Refresh the catalog to see who has it.`);
      } else {
        setErr((e as Error).message);
      }
      setBusy(false);
    }
  }

  return (
    <Modal title="Check out" onClose={onCancel} narrow>
      <p className="muted">“{book.title}”</p>
      <form onSubmit={submit}>
        <label className="field">
          <span>Borrower name *</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </label>
        <label className="field">
          <span>Contact (optional)</span>
          <input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="phone / email"
          />
        </label>
        {err && <p className="form-error">{err}</p>}
        <div className="row-end">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "…" : "Check out"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
