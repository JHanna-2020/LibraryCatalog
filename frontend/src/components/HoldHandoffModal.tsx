import { useState } from "react";
import { api } from "../api";
import type { Book, NextHold } from "../api";
import { useToast } from "../hooks/useToast";
import { formatDateTime } from "../utils/format";
import Modal from "./Modal";

/**
 * Shown right after a check-in when someone is waiting for the book:
 * prompts the admin to set it aside and lets them mark the hold fulfilled.
 */
export default function HoldHandoffModal({
  book,
  hold,
  onClose,
  onFulfilled,
}: {
  book: Book;
  hold: NextHold;
  onClose: () => void;
  onFulfilled: () => Promise<void>;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function fulfill() {
    setBusy(true);
    try {
      await api.fulfillHold(hold.id);
      toast.success(`Hold for ${hold.name} marked fulfilled.`);
      onClose();
      await onFulfilled();
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal title="Someone's waiting for this book" onClose={onClose} narrow>
      <p className="handoff-lead">
        <strong>“{book.title}”</strong> is held for <strong>{hold.name}</strong>
        {hold.contact && <span> ({hold.contact})</span>} — set it aside.
      </p>
      <p className="muted small">Requested {formatDateTime(hold.requested_at)}.</p>
      <div className="row-end">
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
          Keep in queue
        </button>
        <button className="btn btn-primary" onClick={fulfill} disabled={busy} autoFocus>
          {busy ? "…" : "Mark fulfilled"}
        </button>
      </div>
    </Modal>
  );
}
