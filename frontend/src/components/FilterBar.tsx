import type { BookFilters } from "../utils/filterBooks";

/** Search box + genre/tag/status selects for the catalog toolbar. */
export default function FilterBar({
  filters,
  onChange,
  genres,
  tags,
  isAdmin,
  onAdd,
}: {
  filters: BookFilters;
  onChange: (f: BookFilters) => void;
  genres: string[];
  tags: string[];
  isAdmin: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="toolbar">
      <input
        className="search"
        type="search"
        placeholder="Search title, author, ISBN, tag…"
        aria-label="Search books"
        value={filters.query}
        onChange={(e) => onChange({ ...filters, query: e.target.value })}
      />
      <select
        aria-label="Filter by genre"
        value={filters.genre}
        onChange={(e) => onChange({ ...filters, genre: e.target.value })}
      >
        <option value="">All genres</option>
        {genres.map((g) => (
          <option key={g} value={g}>
            {g}
          </option>
        ))}
      </select>
      <select
        aria-label="Filter by tag"
        value={filters.tag}
        onChange={(e) => onChange({ ...filters, tag: e.target.value })}
      >
        <option value="">All tags</option>
        {tags.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <select
        aria-label="Filter by status"
        value={filters.status}
        onChange={(e) =>
          onChange({ ...filters, status: e.target.value as BookFilters["status"] })
        }
      >
        <option value="">Any status</option>
        <option value="available">Available</option>
        <option value="checked_out">Checked out</option>
      </select>
      {isAdmin && (
        <button className="btn btn-primary" onClick={onAdd}>
          + Add book
        </button>
      )}
    </div>
  );
}
