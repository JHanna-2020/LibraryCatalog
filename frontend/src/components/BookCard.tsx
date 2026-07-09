import { coverSrc } from "../api";
import type { Book } from "../api";

export default function BookCard({
  book,
  isAdmin,
  onOpen,
  onEdit,
  onDelete,
  onCheckout,
  onCheckin,
  onRequestHold,
}: {
  book: Book;
  isAdmin: boolean;
  onOpen: (b: Book) => void;
  onEdit: (b: Book) => void;
  onDelete: (b: Book) => void;
  onCheckout: (b: Book) => void;
  onCheckin: (b: Book) => void;
  onRequestHold: (b: Book) => void;
}) {
  const out = book.status === "checked_out";
  const holds = book.pending_holds || 0;
  return (
    <div className="card">
      <button
        className="card-main"
        onClick={() => onOpen(book)}
        aria-label={`View details for ${book.title}`}
      >
        <div className="cover">
          {book.cover_url ? (
            <img src={coverSrc(book.cover_url)} alt="" loading="lazy" />
          ) : (
            <div className="cover-placeholder">{book.title.slice(0, 1).toUpperCase()}</div>
          )}
          <span className={"badge " + (out ? "badge-out" : "badge-in")}>{out ? "Out" : "In"}</span>
          {out && holds > 0 && (
            <span className="badge badge-holds">
              {holds} hold{holds === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <div className="card-body">
          <h3 className="card-title" title={book.title}>
            {book.title}
          </h3>
          {book.authors && <p className="card-author">{book.authors}</p>}
          <div className="meta">
            {book.published_year && <span>{book.published_year}</span>}
            {book.location && <span>· {book.location}</span>}
          </div>
          {book.tags.length > 0 && (
            <div className="tags">
              {book.tags.map((t) => (
                <span key={t} className="tag">
                  {t}
                </span>
              ))}
            </div>
          )}
          {out && book.loan && (
            <p className="loan-note">
              With <strong>{book.loan.borrower_name}</strong>
            </p>
          )}
        </div>
      </button>
      {isAdmin ? (
        <div className="card-actions">
          {out ? (
            <button className="btn btn-small" onClick={() => onCheckin(book)}>
              Check in
            </button>
          ) : (
            <button className="btn btn-small btn-primary" onClick={() => onCheckout(book)}>
              Check out
            </button>
          )}
          <button className="btn btn-small btn-ghost" onClick={() => onEdit(book)}>
            Edit
          </button>
          <button className="btn btn-small btn-ghost" onClick={() => onDelete(book)}>
            Delete
          </button>
        </div>
      ) : out ? (
        <div className="card-actions">
          <button className="btn btn-small" onClick={() => onRequestHold(book)}>
            Request hold
          </button>
        </div>
      ) : null}
    </div>
  );
}
