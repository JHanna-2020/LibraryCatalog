import { useEffect, useMemo, useState } from "react";
import { api, coverSrc } from "../api";
import type { ReadEntry } from "../api";
import { formatDate } from "../utils/format";

export default function ReadsView({ isAdmin }: { isAdmin: boolean }) {
  const [reads, setReads] = useState<ReadEntry[] | null>(null);
  const [readers, setReaders] = useState<string[]>([]);
  const [reader, setReader] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setError("");
    const [readRows, readerRows] = await Promise.all([api.listReads(reader), api.listReaders()]);
    setReads(readRows);
    setReaders(readerRows);
  }

  useEffect(() => {
    let active = true;
    setReads(null);
    setError("");
    Promise.all([api.listReads(reader), api.listReaders()])
      .then(([readRows, readerRows]) => {
        if (!active) return;
        setReads(readRows);
        setReaders(readerRows);
      })
      .catch((e) => {
        if (active) setError((e as Error).message);
      });
    return () => {
      active = false;
    };
  }, [reader]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return reads ?? [];
    return (reads ?? []).filter((r) =>
      [r.book_title, r.authors, r.reader_name].some((v) => v.toLowerCase().includes(q))
    );
  }, [reads, query]);

  async function deleteRead(id: number) {
    await api.deleteRead(id);
    await load();
  }

  if (error) {
    return (
      <div className="empty">
        <h2>Couldn't load read history</h2>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <>
      <div className="toolbar">
        <input
          className="search"
          placeholder="Search read books"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select value={reader} onChange={(e) => setReader(e.target.value)}>
          <option value="">All readers</option>
          {readers.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      <div className="result-count">
        {reads === null
          ? "Loading…"
          : `${filtered.length} read entr${filtered.length === 1 ? "y" : "ies"}`}
      </div>

      {reads !== null && filtered.length === 0 ? (
        <div className="empty">
          <h2>No read history yet</h2>
          <p>Use Mark read on a book to start the log.</p>
        </div>
      ) : (
        <ul className="read-ledger">
          {filtered.map((r) => (
            <li key={r.id} className="read-row">
              <div className="read-cover">
                {r.cover_url ? (
                  <img src={coverSrc(r.cover_url)} alt="" loading="lazy" />
                ) : (
                  <div className="cover-placeholder">{r.book_title.slice(0, 1).toUpperCase()}</div>
                )}
              </div>
              <div className="read-info">
                <span className="loan-title">{r.book_title}</span>
                {r.authors && <span className="muted read-authors">{r.authors}</span>}
                <span className="read-meta">
                  {r.reader_name} · {formatDate(r.finished_at)}
                </span>
              </div>
              {isAdmin && (
                <button className="btn btn-small btn-ghost" onClick={() => deleteRead(r.id)}>
                  Delete
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
