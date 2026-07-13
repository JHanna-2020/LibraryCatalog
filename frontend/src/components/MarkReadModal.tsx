import { useMemo, useState } from "react";
import { api } from "../api";
import type { Book } from "../api";
import Modal from "./Modal";

const READER_KEY = "lib_last_reader_name";

export default function MarkReadModal({
  book,
  onCancel,
  onDone,
}: {
  book: Book;
  onCancel: () => void;
  onDone: () => Promise<void>;
}) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [reader, setReader] = useState(() => localStorage.getItem(READER_KEY) || "");
  const [finishedAt, setFinishedAt] = useState(today);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await api.markRead(book.id, reader, finishedAt);
      localStorage.setItem(READER_KEY, reader.trim());
      await onDone();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal title="Mark as read" onClose={onCancel} narrow>
      <p className="muted">“{book.title}”</p>
      <form onSubmit={submit}>
        <label className="field">
          <span>Reader name *</span>
          <input value={reader} onChange={(e) => setReader(e.target.value)} required autoFocus />
        </label>
        <label className="field">
          <span>Finished date</span>
          <input
            type="date"
            value={finishedAt}
            onChange={(e) => setFinishedAt(e.target.value)}
            required
          />
        </label>
        {err && <p className="form-error">{err}</p>}
        <div className="row-end">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "…" : "Mark read"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
