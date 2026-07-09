import type { Book } from "../api";
import type { BookFilters } from "../utils/filterBooks";
import BookCard from "../components/BookCard";
import FilterBar from "../components/FilterBar";

export default function CatalogView({
  books,
  total,
  loading,
  hasServer,
  isAdmin,
  filters,
  onFiltersChange,
  genres,
  tags,
  onAdd,
  onOpen,
  onEdit,
  onDelete,
  onCheckout,
  onCheckin,
  onRequestHold,
  onGoSettings,
}: {
  books: Book[];
  total: number;
  loading: boolean;
  hasServer: boolean;
  isAdmin: boolean;
  filters: BookFilters;
  onFiltersChange: (f: BookFilters) => void;
  genres: string[];
  tags: string[];
  onAdd: () => void;
  onOpen: (b: Book) => void;
  onEdit: (b: Book) => void;
  onDelete: (b: Book) => void;
  onCheckout: (b: Book) => void;
  onCheckin: (b: Book) => void;
  onRequestHold: (b: Book) => void;
  onGoSettings: () => void;
}) {
  if (!hasServer) {
    return (
      <div className="empty empty-welcome">
        <div className="icon-plate">
          <img
            src={`${import.meta.env.BASE_URL}images/st-moses-the-black.jpg`}
            alt="Icon of Saint Moses the Black"
          />
        </div>
        <h2>Welcome to your library</h2>
        <p>To get started, connect this website to your library server.</p>
        <button className="btn btn-primary" onClick={onGoSettings}>
          Open Settings
        </button>
      </div>
    );
  }

  return (
    <>
      <FilterBar
        filters={filters}
        onChange={onFiltersChange}
        genres={genres}
        tags={tags}
        isAdmin={isAdmin}
        onAdd={onAdd}
      />

      <div className="result-count">
        {loading ? "Loading…" : `${books.length} of ${total} book${total === 1 ? "" : "s"}`}
      </div>

      {books.length === 0 && !loading ? (
        <div className="empty">
          <p>No books match. {total === 0 && isAdmin && "Add your first book to get started."}</p>
          {total === 0 && isAdmin && (
            <button className="btn btn-primary" onClick={onAdd}>
              + Add book
            </button>
          )}
        </div>
      ) : (
        <div className="grid">
          {books.map((b) => (
            <BookCard
              key={b.id}
              book={b}
              isAdmin={isAdmin}
              onOpen={onOpen}
              onEdit={onEdit}
              onDelete={onDelete}
              onCheckout={onCheckout}
              onCheckin={onCheckin}
              onRequestHold={onRequestHold}
            />
          ))}
        </div>
      )}
    </>
  );
}
