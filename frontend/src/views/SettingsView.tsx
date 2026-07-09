import { useState } from "react";
import { api, getApiBase, getPassword, setApiBase, setPassword } from "../api";

export default function SettingsView({
  onSaved,
  connected,
  onCheckConnection,
}: {
  onSaved: () => void;
  connected: boolean | null;
  onCheckConnection: () => void;
}) {
  const [url, setUrl] = useState(getApiBase());
  const [pw, setPw] = useState(getPassword());
  const [status, setStatus] = useState("");

  async function save() {
    setApiBase(url);
    setPassword(pw);
    setStatus("Saved. Checking connection…");
    try {
      await api.health();
      setStatus("Connected to your library server. ✓");
      onSaved();
    } catch (e) {
      setStatus((e as Error).message);
    }
  }

  return (
    <div className="settings">
      <h2>Settings</h2>
      <p className="muted">
        This website runs on GitHub Pages and talks to the library server on your laptop. Enter
        that server's web address below.
      </p>

      <label className="field">
        <span>Library server address</span>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://your-tunnel-name.trycloudflare.com"
        />
      </label>
      <label className="field">
        <span>Admin password (only needed to add/edit/check out)</span>
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="leave blank if you only want to view"
        />
      </label>

      <div className="row-start">
        <button className="btn btn-primary" onClick={save}>
          Save & connect
        </button>
        <button className="btn" onClick={onCheckConnection}>
          Re-check connection
        </button>
      </div>
      {status && <p className="settings-status">{status}</p>}
      <p className="muted small">
        Connection status:{" "}
        {connected === null ? "unknown" : connected ? "connected ✓" : "not connected ✗"}
      </p>
    </div>
  );
}
