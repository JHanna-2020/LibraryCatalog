import { useEffect, useState } from "react";
import { api } from "../api";
import type { LoanRecord } from "../api";
import { formatDate } from "../utils/format";

/** Fetches and renders a book's loan history (newest first from the API). */
export default function LoanHistory({ bookId }: { bookId: number }) {
  const [records, setRecords] = useState<LoanRecord[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setRecords(null);
    setError("");
    api
      .bookHistory(bookId)
      .then((r) => {
        if (active) setRecords(r);
      })
      .catch((e) => {
        if (active) setError((e as Error).message);
      });
    return () => {
      active = false;
    };
  }, [bookId]);

  if (error) return <p className="form-error">Couldn't load loan history: {error}</p>;
  if (records === null) return <p className="muted small">Loading loan history…</p>;
  if (records.length === 0) return <p className="muted">This book has never been lent out.</p>;

  return (
    <ul className="history-list">
      {records.map((r) => (
        <li key={r.id} className={r.returned_at ? "" : "history-active"}>
          <span className="history-borrower">{r.borrower_name}</span>
          {r.borrower_contact && <span className="muted"> · {r.borrower_contact}</span>}
          <span className="history-dates">
            {formatDate(r.checked_out_at)}
            {" — "}
            {r.returned_at ? formatDate(r.returned_at) : <em>still out</em>}
          </span>
        </li>
      ))}
    </ul>
  );
}
