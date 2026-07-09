import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import type { Hold } from "../api";
import { useToast } from "../hooks/useToast";
import { formatDateTime } from "../utils/format";
import ConfirmDialog from "../components/ConfirmDialog";
import type { ConfirmRequest } from "../components/ConfirmDialog";

/** Admin queue of pending holds, oldest first, with cancel/fulfill actions. */
export default function HoldsView({ onChanged }: { onChanged: () => void }) {
  const toast = useToast();
  const [holds, setHolds] = useState<Hold[] | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirmReq, setConfirmReq] = useState<ConfirmRequest | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      setHolds(await api.listHolds());
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function fulfill(h: Hold) {
    setBusyId(h.id);
    try {
      await api.fulfillHold(h.id);
      toast.success(`Hold on "${h.book_title}" fulfilled for ${h.name}.`);
      await load();
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  function cancel(h: Hold) {
    setConfirmReq({
      title: "Cancel hold",
      message: (
        <>
          Cancel <strong>{h.name}</strong>'s hold on <strong>“{h.book_title}”</strong>? They won't
          be notified.
        </>
      ),
      confirmLabel: "Cancel hold",
      danger: true,
      onConfirm: async () => {
        await api.cancelHold(h.id);
        toast.success(`Hold on "${h.book_title}" cancelled.`);
        await load();
        onChanged();
      },
    });
  }

  if (error) {
    return (
      <div className="empty">
        <h2>Couldn't load holds</h2>
        <p>{error}</p>
      </div>
    );
  }
  if (holds === null) {
    return <div className="result-count">Loading…</div>;
  }
  if (holds.length === 0) {
    return (
      <div className="empty">
        <h2>No pending holds</h2>
        <p>When a visitor requests a checked-out book, it will appear here.</p>
      </div>
    );
  }

  return (
    <>
      <div className="result-count">
        {holds.length} pending hold{holds.length === 1 ? "" : "s"} · oldest first
      </div>
      <ul className="hold-ledger">
        {holds.map((h, i) => (
          <li key={h.id} className="hold-row">
            <span className="hold-position" aria-hidden="true">
              {i + 1}
            </span>
            <div className="hold-info">
              <span className="loan-title">{h.book_title}</span>
              <span className="hold-requester">
                for <strong>{h.name}</strong>
                {h.contact && <span className="muted"> · {h.contact}</span>}
              </span>
              <span className="muted small">requested {formatDateTime(h.requested_at)}</span>
            </div>
            <div className="hold-actions">
              <button
                className="btn btn-small btn-primary"
                onClick={() => fulfill(h)}
                disabled={busyId === h.id}
              >
                {busyId === h.id ? "…" : "Mark fulfilled"}
              </button>
              <button
                className="btn btn-small btn-ghost"
                onClick={() => cancel(h)}
                disabled={busyId === h.id}
              >
                Cancel
              </button>
            </div>
          </li>
        ))}
      </ul>
      {confirmReq && <ConfirmDialog request={confirmReq} onClose={() => setConfirmReq(null)} />}
    </>
  );
}
