import { useEffect, useState } from "react";
import { api } from "../api";
import type { ReadRecord } from "../api";
import { formatDate } from "../utils/format";

export default function ReadHistory({ bookId, version = 0 }: { bookId: number; version?: number }) {
  const [records, setRecords] = useState<ReadRecord[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setRecords(null);
    setError("");
    api
      .bookReads(bookId)
      .then((r) => {
        if (active) setRecords(r);
      })
      .catch((e) => {
        if (active) setError((e as Error).message);
      });
    return () => {
      active = false;
    };
  }, [bookId, version]);

  if (error) return <p className="form-error">Couldn't load read history: {error}</p>;
  if (records === null) return <p className="muted small">Loading read history…</p>;
  if (records.length === 0) return <p className="muted">No one has marked this book as read.</p>;

  return (
    <ul className="history-list">
      {records.map((r) => (
        <li key={r.id}>
          <span className="history-borrower">{r.reader_name}</span>
          <span className="history-dates">{formatDate(r.finished_at)}</span>
        </li>
      ))}
    </ul>
  );
}
