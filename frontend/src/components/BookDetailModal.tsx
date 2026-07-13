import { coverSrc } from "../api";
import type { Book } from "../api";
import { formatDate } from "../utils/format";
import Modal from "./Modal";
import LoanHistory from "./LoanHistory";
import ReadHistory from "./ReadHistory";

/** Read-only book view with metadata, notes and the loan history section. */
export default function BookDetailModal({
  book,
  isAdmin,
  onClose,
  onEdit,
  onCheckout,
  onCheckin,
  onMarkRead,
  readHistoryVersion,
  onRequestHold,
}: {
  book: Book;
  isAdmin: boolean;
  onClose: () => void;
  onEdit: (b: Book) => void;
  onCheckout: (b: Book) => void;
  onCheckin: (b: Book) => void;
  onMarkRead: (b: Book) => void;
  readHistoryVersion?: number;
  onRequestHold: (b: Book) => void;
}) {
  const out = book.status === "checked_out";
  const holds = book.pending_holds || 0;
  return (
    <Modal title={book.title} onClose={onClose} wide>
      <div className="detail-layout">
        <div className="detail-cover">
          {book.cover_url ? (
            <img src={coverSrc(book.cover_url)} alt={`Cover of ${book.title}`} />
          ) : (
            <div className="cover-placeholder">{book.title.slice(0, 1).toUpperCase()}</div>
          )}
        </div>
        <div className="detail-info">
          {book.authors && <p className="detail-authors">{book.authors}</p>}
          <dl className="detail-meta">
            {book.genre && (
              <>
                <dt>Genre</dt>
                <dd>{book.genre}</dd>
              </>
            )}
            {book.published_year && (
              <>
                <dt>Year</dt>
                <dd>{book.published_year}</dd>
              </>
            )}
            {book.publisher && (
              <>
                <dt>Publisher</dt>
                <dd>{book.publisher}</dd>
              </>
            )}
            {book.isbn && (
              <>
                <dt>ISBN</dt>
                <dd>{book.isbn}</dd>
              </>
            )}
            {book.location && (
              <>
                <dt>Shelf</dt>
                <dd>{book.location}</dd>
              </>
            )}
            <dt>Status</dt>
            <dd>
              {out && book.loan ? (
                <span className="detail-out">
                  Out with <strong>{book.loan.borrower_name}</strong> since{" "}
                  {formatDate(book.loan.checked_out_at)}
                </span>
              ) : (
                "On the shelf"
              )}
              {out && holds > 0 && (
                <span className="detail-holds">
                  {" "}
                  · {holds} hold{holds === 1 ? "" : "s"} pending
                </span>
              )}
            </dd>
          </dl>
          {book.tags.length > 0 && (
            <div className="tags">
              {book.tags.map((t) => (
                <span key={t} className="tag">
                  {t}
                </span>
              ))}
            </div>
          )}
          {book.notes && <p className="detail-notes">{book.notes}</p>}
        </div>
      </div>

      <h3 className="detail-section-title">Loan history</h3>
      <LoanHistory bookId={book.id} />

      <h3 className="detail-section-title">Read history</h3>
      <ReadHistory bookId={book.id} version={readHistoryVersion} />

      <div className="row-end">
        {out && !isAdmin && (
          <button className="btn btn-primary" onClick={() => onRequestHold(book)}>
            Request hold
          </button>
        )}
        {isAdmin &&
          (out ? (
            <button className="btn" onClick={() => onCheckin(book)}>
              Check in
            </button>
          ) : (
            <button className="btn btn-primary" onClick={() => onCheckout(book)}>
              Check out
            </button>
          ))}
        <button className="btn" onClick={() => onMarkRead(book)}>
          Mark read
        </button>
        {isAdmin && (
          <button className="btn btn-ghost" onClick={() => onEdit(book)}>
            Edit
          </button>
        )}
        <button className="btn btn-ghost" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}
