import { useMemo } from "react";
import type { Checkout } from "../api";
import { formatDate } from "../utils/format";

/** Active loans, grouped by borrower name. */
export default function CheckedOutView({ checkouts }: { checkouts: Checkout[] }) {
  const byBorrower = useMemo(() => {
    const map = new Map<string, Checkout[]>();
    for (const c of checkouts) {
      const arr = map.get(c.borrower_name) || [];
      arr.push(c);
      map.set(c.borrower_name, arr);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [checkouts]);

  if (checkouts.length === 0) {
    return (
      <div className="empty">
        <h2>Nothing checked out</h2>
        <p>Every book is on the shelf.</p>
      </div>
    );
  }
  return (
    <div className="borrowers">
      {byBorrower.map(([name, items]) => (
        <div key={name} className="borrower-block">
          <h2 className="borrower-name">
            {name} <span className="pill">{items.length}</span>
          </h2>
          {items[0].borrower_contact && <p className="muted">{items[0].borrower_contact}</p>}
          <ul className="loan-list">
            {items.map((c) => (
              <li key={c.book_id}>
                <span className="loan-title">{c.title}</span>
                {c.authors && <span className="muted"> — {c.authors}</span>}
                <span className="muted"> · since {formatDate(c.checked_out_at)}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
