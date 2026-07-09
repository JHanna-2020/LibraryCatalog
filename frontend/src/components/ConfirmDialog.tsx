import { useState } from "react";
import type { ReactNode } from "react";
import Modal from "./Modal";

export interface ConfirmRequest {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => Promise<void> | void;
}

/** Confirmation modal for destructive actions (delete, check in). */
export default function ConfirmDialog({
  request,
  onClose,
}: {
  request: ConfirmRequest;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function confirm() {
    setBusy(true);
    setErr("");
    try {
      await request.onConfirm();
      onClose();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal title={request.title} onClose={onClose} narrow>
      <p className="confirm-message">{request.message}</p>
      {err && <p className="form-error">{err}</p>}
      <div className="row-end">
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button
          className={"btn " + (request.danger ? "btn-danger" : "btn-primary")}
          onClick={confirm}
          disabled={busy}
          autoFocus
        >
          {busy ? "Working…" : request.confirmLabel || "Confirm"}
        </button>
      </div>
    </Modal>
  );
}
