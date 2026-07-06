import { useEffect, useMemo, useState, useCallback } from "react";
import { api, getApiBase, setApiBase, getPassword, setPassword, clearPassword } from "./api";
import type { Book, BookInput, Checkout } from "./types";
import BarcodeScanner from "./BarcodeScanner";

type View = "catalog" | "out" | "settings";

const EMPTY_BOOK: BookInput = {
  title: "", authors: "", isbn: "", publisher: "", published_year: "",
  cover_url: "", genre: "", tags: "", location: "", notes: "",
};

export default function App() {
  const [view, setView] = useState<View>("catalog");
  const [books, setBooks] = useState<Book[]>([]);
  const [checkouts, setCheckouts] = useState<Checkout[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState<boolean | null>(null);

  const [isAdmin, setIsAdmin] = useState(false);

  // Filters
  const [query, setQuery] = useState("");
  const [genreFilter, setGenreFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "available" | "checked_out">("");

  // Modals
  const [editing, setEditing] = useState<{ id: number | null; data: BookInput } | null>(null);
  const [checkoutFor, setCheckoutFor] = useState<Book | null>(null);

  const hasServer = !!getApiBase();

  const load = useCallback(async () => {
    if (!getApiBase()) return;
    setLoading(true);
    setError("");
    try {
      const [b, c] = await Promise.all([api.listBooks(), api.listCheckouts()]);
      setBooks(b);
      setCheckouts(c);
      setConnected(true);
    } catch (e) {
      setError((e as Error).message);
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Remember admin session if a password is already stored and valid.
    if (getPassword()) {
      api.verifyAdmin().then(() => setIsAdmin(true)).catch(() => clearPassword());
    }
    load();
  }, [load]);

  const genres = useMemo(
    () => [...new Set(books.map((b) => b.genre).filter(Boolean))].sort(),
    [books]
  );
  const tags = useMemo(
    () => [...new Set(books.flatMap((b) => b.tags))].sort(),
    [books]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return books.filter((b) => {
      if (genreFilter && b.genre !== genreFilter) return false;
      if (tagFilter && !b.tags.includes(tagFilter)) return false;
      if (statusFilter && b.status !== statusFilter) return false;
      if (!q) return true;
      return (
        b.title.toLowerCase().includes(q) ||
        b.authors.toLowerCase().includes(q) ||
        b.isbn.toLowerCase().includes(q) ||
        b.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [books, query, genreFilter, tagFilter, statusFilter]);

  // ---- Admin login ----
  async function handleLogin() {
    const pw = prompt("Enter the admin password:");
    if (pw === null) return;
    setPassword(pw);
    try {
      await api.verifyAdmin();
      setIsAdmin(true);
    } catch (e) {
      clearPassword();
      alert((e as Error).message);
    }
  }
  function handleLogout() {
    clearPassword();
    setIsAdmin(false);
  }

  // ---- Book actions ----
  function openAdd() {
    setEditing({ id: null, data: { ...EMPTY_BOOK } });
  }
  function openEdit(b: Book) {
    setEditing({
      id: b.id,
      data: {
        title: b.title, authors: b.authors, isbn: b.isbn, publisher: b.publisher,
        published_year: b.published_year, cover_url: b.cover_url, genre: b.genre,
        tags: b.tags.join(", "), location: b.location, notes: b.notes,
      },
    });
  }
  async function saveBook(data: BookInput, id: number | null) {
    if (id === null) await api.createBook(data);
    else await api.updateBook(id, data);
    setEditing(null);
    await load();
  }
  async function removeBook(b: Book) {
    if (!confirm(`Delete "${b.title}"? This can't be undone.`)) return;
    await api.deleteBook(b.id);
    await load();
  }
  async function checkinBook(b: Book) {
    await api.checkin(b.id);
    await load();
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand" onClick={() => setView("catalog")}>
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 100 100" fill="currentColor" role="img" aria-label="Coptic cross">
              <polygon points="44,50 56,50 63,13 37,13" />
              <polygon points="44,50 56,50 63,87 37,87" />
              <polygon points="50,44 50,56 13,63 13,37" />
              <polygon points="50,44 50,56 87,63 87,37" />
              <circle cx="50" cy="11" r="4" />
              <circle cx="50" cy="89" r="4" />
              <circle cx="11" cy="50" r="4" />
              <circle cx="89" cy="50" r="4" />
              <circle cx="31" cy="31" r="3.4" />
              <circle cx="69" cy="31" r="3.4" />
              <circle cx="31" cy="69" r="3.4" />
              <circle cx="69" cy="69" r="3.4" />
            </svg>
          </span>
          <span className="brand-name">Library Catalog</span>
        </div>
        <nav className="nav">
          <button className={navCls(view === "catalog")} onClick={() => setView("catalog")}>
            Catalog
          </button>
          <button className={navCls(view === "out")} onClick={() => setView("out")}>
            Checked Out {checkouts.length > 0 && <span className="pill">{checkouts.length}</span>}
          </button>
          <button className={navCls(view === "settings")} onClick={() => setView("settings")}>
            Settings
          </button>
        </nav>
        <div className="topbar-right">
          {isAdmin ? (
            <button className="btn btn-ghost" onClick={handleLogout}>Log out</button>
          ) : (
            <button className="btn btn-ghost" onClick={handleLogin}>Admin login</button>
          )}
        </div>
      </header>

      {connected === false && (
        <div className="banner banner-warn">
          Can't reach your library server.{" "}
          <button className="linklike" onClick={() => setView("settings")}>Check settings</button>
          {" "}or make sure your laptop and tunnel are running.
        </div>
      )}
      {error && view !== "settings" && <div className="banner banner-error">{error}</div>}

      <main className="content">
        {view === "catalog" && (
          <CatalogView
            books={filtered}
            total={books.length}
            loading={loading}
            hasServer={hasServer}
            isAdmin={isAdmin}
            query={query} setQuery={setQuery}
            genres={genres} genreFilter={genreFilter} setGenreFilter={setGenreFilter}
            tags={tags} tagFilter={tagFilter} setTagFilter={setTagFilter}
            statusFilter={statusFilter} setStatusFilter={setStatusFilter}
            onAdd={openAdd} onEdit={openEdit} onDelete={removeBook}
            onCheckout={setCheckoutFor} onCheckin={checkinBook}
            onGoSettings={() => setView("settings")}
          />
        )}
        {view === "out" && <CheckoutsView checkouts={checkouts} />}
        {view === "settings" && (
          <SettingsView onSaved={load} connected={connected} onCheckConnection={load} />
        )}
      </main>

      <footer className="site-footer">
        <div className="footer-plate">
          <img
            src={`${import.meta.env.BASE_URL}images/st-moses-the-black.jpg`}
            alt="Icon of Saint Moses the Black"
          />
        </div>
        <p className="footer-credit">Icon of St. Moses the Black.</p>
      </footer>

      {editing && (
        <BookForm
          initial={editing.data}
          id={editing.id}
          onCancel={() => setEditing(null)}
          onSave={saveBook}
        />
      )}
      {checkoutFor && (
        <CheckoutForm
          book={checkoutFor}
          onCancel={() => setCheckoutFor(null)}
          onDone={async () => { setCheckoutFor(null); await load(); }}
        />
      )}
    </div>
  );
}

function navCls(active: boolean) {
  return "navlink" + (active ? " navlink-active" : "");
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------
function CatalogView(props: {
  books: Book[]; total: number; loading: boolean; hasServer: boolean; isAdmin: boolean;
  query: string; setQuery: (s: string) => void;
  genres: string[]; genreFilter: string; setGenreFilter: (s: string) => void;
  tags: string[]; tagFilter: string; setTagFilter: (s: string) => void;
  statusFilter: "" | "available" | "checked_out"; setStatusFilter: (s: "" | "available" | "checked_out") => void;
  onAdd: () => void; onEdit: (b: Book) => void; onDelete: (b: Book) => void;
  onCheckout: (b: Book) => void; onCheckin: (b: Book) => void;
  onGoSettings: () => void;
}) {
  const {
    books, total, loading, hasServer, isAdmin, query, setQuery, genres, genreFilter,
    setGenreFilter, tags, tagFilter, setTagFilter, statusFilter, setStatusFilter,
    onAdd, onEdit, onDelete, onCheckout, onCheckin, onGoSettings,
  } = props;

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
        <button className="btn btn-primary" onClick={onGoSettings}>Open Settings</button>
      </div>
    );
  }

  return (
    <>
      <div className="toolbar">
        <input
          className="search"
          placeholder="Search title, author, ISBN, tag…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select value={genreFilter} onChange={(e) => setGenreFilter(e.target.value)}>
          <option value="">All genres</option>
          {genres.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
          <option value="">All tags</option>
          {tags.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
          <option value="">Any status</option>
          <option value="available">Available</option>
          <option value="checked_out">Checked out</option>
        </select>
        {isAdmin && <button className="btn btn-primary" onClick={onAdd}>+ Add book</button>}
      </div>

      <div className="result-count">
        {loading ? "Loading…" : `${books.length} of ${total} book${total === 1 ? "" : "s"}`}
      </div>

      {books.length === 0 && !loading ? (
        <div className="empty">
          <p>No books match. {total === 0 && isAdmin && "Add your first book to get started."}</p>
          {total === 0 && isAdmin && <button className="btn btn-primary" onClick={onAdd}>+ Add book</button>}
        </div>
      ) : (
        <div className="grid">
          {books.map((b) => (
            <BookCard
              key={b.id} book={b} isAdmin={isAdmin}
              onEdit={onEdit} onDelete={onDelete} onCheckout={onCheckout} onCheckin={onCheckin}
            />
          ))}
        </div>
      )}
    </>
  );
}

function BookCard({
  book, isAdmin, onEdit, onDelete, onCheckout, onCheckin,
}: {
  book: Book; isAdmin: boolean;
  onEdit: (b: Book) => void; onDelete: (b: Book) => void;
  onCheckout: (b: Book) => void; onCheckin: (b: Book) => void;
}) {
  const out = book.status === "checked_out";
  return (
    <div className="card">
      <div className="cover">
        {book.cover_url
          ? <img src={book.cover_url} alt="" loading="lazy" />
          : <div className="cover-placeholder">{book.title.slice(0, 1).toUpperCase()}</div>}
        <span className={"badge " + (out ? "badge-out" : "badge-in")}>
          {out ? "Out" : "In"}
        </span>
      </div>
      <div className="card-body">
        <h3 className="card-title" title={book.title}>{book.title}</h3>
        {book.authors && <p className="card-author">{book.authors}</p>}
        <div className="meta">
          {book.published_year && <span>{book.published_year}</span>}
          {book.location && <span>· {book.location}</span>}
        </div>
        {book.tags.length > 0 && (
          <div className="tags">
            {book.tags.map((t) => <span key={t} className="tag">{t}</span>)}
          </div>
        )}
        {out && book.loan && (
          <p className="loan-note">With <strong>{book.loan.borrower_name}</strong></p>
        )}
      </div>
      {isAdmin && (
        <div className="card-actions">
          {out
            ? <button className="btn btn-small" onClick={() => onCheckin(book)}>Check in</button>
            : <button className="btn btn-small btn-primary" onClick={() => onCheckout(book)}>Check out</button>}
          <button className="btn btn-small btn-ghost" onClick={() => onEdit(book)}>Edit</button>
          <button className="btn btn-small btn-ghost" onClick={() => onDelete(book)}>Delete</button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Checked-out view (grouped by borrower)
// ---------------------------------------------------------------------------
function CheckoutsView({ checkouts }: { checkouts: Checkout[] }) {
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
    return <div className="empty"><h2>Nothing checked out</h2><p>Every book is on the shelf.</p></div>;
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
                <span className="muted"> · since {new Date(c.checked_out_at).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add / edit form
// ---------------------------------------------------------------------------
function BookForm({
  initial, id, onCancel, onSave,
}: {
  initial: BookInput; id: number | null;
  onCancel: () => void; onSave: (data: BookInput, id: number | null) => Promise<void>;
}) {
  const [data, setData] = useState<BookInput>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [scanning, setScanning] = useState(false);
  const [looking, setLooking] = useState(false);

  const set = (k: keyof BookInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setData((d) => ({ ...d, [k]: e.target.value }));

  async function lookup(isbn: string) {
    if (!isbn.trim()) return;
    setLooking(true);
    setErr("");
    try {
      const found = await api.lookupIsbn(isbn);
      setData((d) => ({
        ...d,
        isbn: found.isbn || d.isbn,
        title: found.title || d.title,
        authors: found.authors || d.authors,
        publisher: found.publisher || d.publisher,
        published_year: found.published_year || d.published_year,
        cover_url: found.cover_url || d.cover_url,
      }));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLooking(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await onSave(data, id);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{id === null ? "Add book" : "Edit book"}</h2>
        <form onSubmit={submit}>
          <div className="isbn-row">
            <label className="field grow">
              <span>ISBN</span>
              <input value={data.isbn} onChange={set("isbn")} placeholder="978…" />
            </label>
            <button type="button" className="btn" onClick={() => lookup(data.isbn)} disabled={looking}>
              {looking ? "Looking…" : "Auto-fill"}
            </button>
            <button type="button" className="btn" onClick={() => setScanning(true)}>Scan</button>
          </div>

          <label className="field">
            <span>Title *</span>
            <input value={data.title} onChange={set("title")} required autoFocus />
          </label>
          <label className="field">
            <span>Author(s)</span>
            <input value={data.authors} onChange={set("authors")} />
          </label>
          <div className="field-row">
            <label className="field">
              <span>Genre</span>
              <input value={data.genre} onChange={set("genre")} />
            </label>
            <label className="field">
              <span>Year</span>
              <input value={data.published_year} onChange={set("published_year")} />
            </label>
          </div>
          <div className="field-row">
            <label className="field">
              <span>Publisher</span>
              <input value={data.publisher} onChange={set("publisher")} />
            </label>
            <label className="field">
              <span>Shelf / location</span>
              <input value={data.location} onChange={set("location")} />
            </label>
          </div>
          <label className="field">
            <span>Tags (comma-separated)</span>
            <input value={data.tags} onChange={set("tags")} placeholder="favorite, signed, sci-fi" />
          </label>
          <label className="field">
            <span>Cover image URL</span>
            <input value={data.cover_url} onChange={set("cover_url")} />
          </label>
          <label className="field">
            <span>Notes</span>
            <textarea value={data.notes} onChange={set("notes")} rows={2} />
          </label>

          {err && <p className="form-error">{err}</p>}
          <div className="row-end">
            <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
      {scanning && (
        <BarcodeScanner
          onClose={() => setScanning(false)}
          onDetected={(code) => { setScanning(false); setData((d) => ({ ...d, isbn: code })); lookup(code); }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Checkout form
// ---------------------------------------------------------------------------
function CheckoutForm({
  book, onCancel, onDone,
}: {
  book: Book; onCancel: () => void; onDone: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await api.checkout(book.id, name, contact);
      await onDone();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal modal-narrow" onClick={(e) => e.stopPropagation()}>
        <h2>Check out</h2>
        <p className="muted">“{book.title}”</p>
        <form onSubmit={submit}>
          <label className="field">
            <span>Borrower name *</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </label>
          <label className="field">
            <span>Contact (optional)</span>
            <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="phone / email" />
          </label>
          {err && <p className="form-error">{err}</p>}
          <div className="row-end">
            <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? "…" : "Check out"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
function SettingsView({
  onSaved, connected, onCheckConnection,
}: {
  onSaved: () => void; connected: boolean | null; onCheckConnection: () => void;
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
        This website runs on GitHub Pages and talks to the library server on your laptop.
        Enter that server's web address below.
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
        <button className="btn btn-primary" onClick={save}>Save & connect</button>
        <button className="btn" onClick={onCheckConnection}>Re-check connection</button>
      </div>
      {status && <p className="settings-status">{status}</p>}
      <p className="muted small">
        Connection status:{" "}
        {connected === null ? "unknown" : connected ? "connected ✓" : "not connected ✗"}
      </p>
    </div>
  );
}
