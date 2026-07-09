import { useState } from "react";
import { api, ApiError } from "../api";
import type { Book } from "../api";
import { useToast } from "../hooks/useToast";
import Modal from "./Modal";

function holdErrorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    switch (e.status) {
      case 409:
        // The server distinguishes "book is available" from "duplicate hold";
        // pass its message through when it gives one.
        return e.message && !e.message.startsWith("Request failed")
          ? e.message
          : "This book can't be put on hold right now — it may already be back on the shelf, or you may already have a hold on it.";
      case 404:
        return "That book is no longer in the catalog.";
      case 429:
        return "Too many requests right now — please wait a minute and try again.";
    }
  }
  return (e as Error).message;
}

/** Public "save this book for me" form shown on checked-out books. */
export default function HoldRequestModal({
  book,
  onCancel,
  onDone,
}: {
  book: Book;
  onCancel: () => void;
  onDone: () => Promise<void>;
}) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.requestHold(book.id, name.trim(), contact.trim());
      toast.success("We'll set it aside for you when it's returned.");
      await onDone();
    } catch (e) {
      toast.error(holdErrorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Modal title="Request a hold" onClose={onCancel} narrow>
      <p className="muted">
        “{book.title}” is out right now. Leave your name and we'll set it aside for you when it
        comes back.
      </p>
      <form onSubmit={submit}>
        <label className="field">
          <span>Your name *</span>
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
        <div className="row-end">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "…" : "Request hold"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
