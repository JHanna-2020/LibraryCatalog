import { useEffect, useState } from "react";
import { api } from "../api";
import type { Borrower, BorrowerLoan } from "../api";
import { formatDate } from "../utils/format";
import Modal from "../components/Modal";

/**
 * Everyone who has ever borrowed a book, with active/total loan counts.
 * Clicking a borrower opens their full loan history.
 */
export default function BorrowersView() {
  const [borrowers, setBorrowers] = useState<Borrower[] | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Borrower | null>(null);

  useEffect(() => {
    let active = true;
    api
      .listBorrowers()
      .then((b) => {
        if (active) setBorrowers(b);
      })
      .catch((e) => {
        if (active) setError((e as Error).message);
      });
    return () => {
      active = false;
    };
  }, []);

  if (error) {
    return (
      <div className="empty">
        <h2>Couldn't load borrowers</h2>
        <p>{error}</p>
      </div>
    );
  }
  if (borrowers === null) {
    return <div className="result-count">Loading…</div>;
  }
  if (borrowers.length === 0) {
    return (
      <div className="empty">
        <h2>No borrowers yet</h2>
        <p>Once you lend a book out, the borrower will appear here.</p>
      </div>
    );
  }

  return (
    <>
      <div className="result-count">
        {borrowers.length} borrower{borrowers.length === 1 ? "" : "s"}
      </div>
      <ul className="borrower-ledger">
        {borrowers.map((b) => (
          <li key={b.id}>
            <button className="borrower-row" onClick={() => setSelected(b)}>
              <span className="borrower-row-name">{b.name}</span>
              {b.contact && <span className="muted borrower-row-contact">{b.contact}</span>}
              <span className="borrower-row-counts">
                {b.active_loans > 0 && <span className="pill">{b.active_loans} out</span>}
                <span className="muted small">
                  {b.total_loans} loan{b.total_loans === 1 ? "" : "s"} all-time
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {selected && <BorrowerLoansModal borrower={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function BorrowerLoansModal({ borrower, onClose }: { borrower: Borrower; onClose: () => void }) {
  const [loans, setLoans] = useState<BorrowerLoan[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api
      .borrowerLoans(borrower.id)
      .then((l) => {
        if (active) setLoans(l);
      })
      .catch((e) => {
        if (active) setError((e as Error).message);
      });
    return () => {
      active = false;
    };
  }, [borrower.id]);

  return (
    <Modal title={borrower.name} onClose={onClose}>
      {borrower.contact && <p className="muted">{borrower.contact}</p>}
      {error && <p className="form-error">Couldn't load loans: {error}</p>}
      {!error && loans === null && <p className="muted small">Loading loan history…</p>}
      {loans && loans.length === 0 && <p className="muted">No loans on record.</p>}
      {loans && loans.length > 0 && (
        <ul className="history-list">
          {loans.map((l) => (
            <li key={l.id} className={l.returned_at ? "" : "history-active"}>
              <span className="loan-title">{l.book_title}</span>
              <span className="history-dates">
                {formatDate(l.checked_out_at)}
                {" — "}
                {l.returned_at ? formatDate(l.returned_at) : <em>still out</em>}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="row-end">
        <button className="btn btn-ghost" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}
