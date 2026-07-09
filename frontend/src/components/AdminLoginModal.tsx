import { useState } from "react";
import Modal from "./Modal";

/** Password prompt that verifies against POST /api/verify-admin. */
export default function AdminLoginModal({
  onLogin,
  onClose,
}: {
  onLogin: (password: string) => Promise<void>;
  onClose: () => void;
}) {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await onLogin(pw);
      onClose();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal title="Admin login" onClose={onClose} narrow>
      <p className="muted">Unlock adding, editing and checkouts.</p>
      <form onSubmit={submit}>
        <label className="field">
          <span>Admin password</span>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoFocus
            required
          />
        </label>
        {err && <p className="form-error">{err}</p>}
        <div className="row-end">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Checking…" : "Log in"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
