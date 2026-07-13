import { useEffect, useMemo, useState } from "react";
import { api, getApiBase } from "./api";
import type { Book, BookInput, NextHold } from "./api";
import { useAdmin } from "./hooks/useAdmin";
import { useBooks } from "./hooks/useBooks";
import { ToastProvider, useToast } from "./hooks/useToast";
import { collectGenres, collectTags, EMPTY_FILTERS, filterBooks } from "./utils/filterBooks";
import type { BookFilters } from "./utils/filterBooks";
import CopticCross from "./components/CopticCross";
import ToastStack from "./components/ToastStack";
import AdminLoginModal from "./components/AdminLoginModal";
import ConfirmDialog from "./components/ConfirmDialog";
import type { ConfirmRequest } from "./components/ConfirmDialog";
import BookFormModal, { bookToInput, EMPTY_BOOK } from "./components/BookFormModal";
import BookDetailModal from "./components/BookDetailModal";
import CheckoutModal from "./components/CheckoutModal";
import HoldRequestModal from "./components/HoldRequestModal";
import HoldHandoffModal from "./components/HoldHandoffModal";
import MarkReadModal from "./components/MarkReadModal";
import CatalogView from "./views/CatalogView";
import CheckedOutView from "./views/CheckedOutView";
import BorrowersView from "./views/BorrowersView";
import HoldsView from "./views/HoldsView";
import ReadsView from "./views/ReadsView";
import SettingsView from "./views/SettingsView";

type View = "catalog" | "out" | "borrowers" | "reads" | "holds" | "settings";

export default function App() {
  return (
    <ToastProvider>
      <AppShell />
    </ToastProvider>
  );
}

function AppShell() {
  const [view, setView] = useState<View>("catalog");
  const { books, checkouts, loading, error, connected, reload } = useBooks();
  const { isAdmin, login, logout } = useAdmin();
  const toast = useToast();

  const [filters, setFilters] = useState<BookFilters>(EMPTY_FILTERS);

  // Modals
  const [showLogin, setShowLogin] = useState(false);
  const [editing, setEditing] = useState<{ id: number | null; data: BookInput } | null>(null);
  const [checkoutFor, setCheckoutFor] = useState<Book | null>(null);
  const [detailBook, setDetailBook] = useState<Book | null>(null);
  const [confirmReq, setConfirmReq] = useState<ConfirmRequest | null>(null);
  const [holdFor, setHoldFor] = useState<Book | null>(null);
  const [readFor, setReadFor] = useState<Book | null>(null);
  const [readHistoryVersion, setReadHistoryVersion] = useState(0);
  const [handoff, setHandoff] = useState<{ book: Book; hold: NextHold } | null>(null);

  const hasServer = !!getApiBase();

  const genres = useMemo(() => collectGenres(books), [books]);
  const tags = useMemo(() => collectTags(books), [books]);
  const filtered = useMemo(() => filterBooks(books, filters), [books, filters]);
  const pendingHolds = useMemo(
    () => books.reduce((n, b) => n + (b.pending_holds || 0), 0),
    [books]
  );

  // The Holds tab is admin-only; leave it if the admin logs out.
  useEffect(() => {
    if (view === "holds" && !isAdmin) setView("catalog");
  }, [view, isAdmin]);

  // ---- Book actions ----
  function openAdd() {
    setEditing({ id: null, data: { ...EMPTY_BOOK } });
  }
  function openEdit(b: Book) {
    setDetailBook(null);
    setEditing({ id: b.id, data: bookToInput(b) });
  }
  async function saveBook(data: BookInput, id: number | null) {
    if (id === null) await api.createBook(data);
    else await api.updateBook(id, data);
    setEditing(null);
    toast.success(id === null ? `Added "${data.title}".` : `Saved "${data.title}".`);
    await reload();
  }
  function removeBook(b: Book) {
    setDetailBook(null);
    setConfirmReq({
      title: "Delete book",
      message: (
        <>
          Delete <strong>“{b.title}”</strong>? This can't be undone.
        </>
      ),
      confirmLabel: "Delete",
      danger: true,
      onConfirm: async () => {
        await api.deleteBook(b.id);
        toast.success(`Deleted "${b.title}".`);
        await reload();
      },
    });
  }
  function checkinBook(b: Book) {
    setDetailBook(null);
    setConfirmReq({
      title: "Check in",
      message: (
        <>
          Mark <strong>“{b.title}”</strong> as returned
          {b.loan ? (
            <>
              {" "}
              by <strong>{b.loan.borrower_name}</strong>
            </>
          ) : null}
          ?
        </>
      ),
      confirmLabel: "Check in",
      onConfirm: async () => {
        const res = await api.checkin(b.id);
        toast.success(`"${b.title}" is back on the shelf.`);
        await reload();
        if (res.next_hold) setHandoff({ book: b, hold: res.next_hold });
      },
    });
  }
  function startCheckout(b: Book) {
    setDetailBook(null);
    setCheckoutFor(b);
  }
  function startHoldRequest(b: Book) {
    setDetailBook(null);
    setHoldFor(b);
  }
  function startMarkRead(b: Book) {
    setReadFor(b);
  }

  async function handleLogin(pw: string) {
    await login(pw);
    toast.success("Logged in as admin.");
  }
  function handleLogout() {
    logout();
    toast.info("Logged out.");
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand" onClick={() => setView("catalog")}>
          <span className="brand-mark" aria-hidden="true">
            <CopticCross />
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
          <button className={navCls(view === "borrowers")} onClick={() => setView("borrowers")}>
            Borrowers
          </button>
          <button className={navCls(view === "reads")} onClick={() => setView("reads")}>
            Reads
          </button>
          {isAdmin && (
            <button className={navCls(view === "holds")} onClick={() => setView("holds")}>
              Holds {pendingHolds > 0 && <span className="pill">{pendingHolds}</span>}
            </button>
          )}
          <button className={navCls(view === "settings")} onClick={() => setView("settings")}>
            Settings
          </button>
        </nav>
        <div className="topbar-right">
          {isAdmin ? (
            <button className="btn btn-ghost" onClick={handleLogout}>
              Log out
            </button>
          ) : (
            <button className="btn btn-ghost" onClick={() => setShowLogin(true)}>
              Admin login
            </button>
          )}
        </div>
      </header>

      {connected === false && (
        <div className="banner banner-warn">
          Can't reach your library server.{" "}
          <button className="linklike" onClick={() => setView("settings")}>
            Check settings
          </button>{" "}
          or make sure your laptop and tunnel are running.
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
            filters={filters}
            onFiltersChange={setFilters}
            genres={genres}
            tags={tags}
            onAdd={openAdd}
            onOpen={setDetailBook}
            onEdit={openEdit}
            onDelete={removeBook}
            onCheckout={startCheckout}
            onCheckin={checkinBook}
            onMarkRead={startMarkRead}
            onRequestHold={startHoldRequest}
            onGoSettings={() => setView("settings")}
          />
        )}
        {view === "out" && <CheckedOutView checkouts={checkouts} />}
        {view === "borrowers" && <BorrowersView />}
        {view === "reads" && <ReadsView isAdmin={isAdmin} />}
        {view === "holds" && isAdmin && <HoldsView onChanged={reload} />}
        {view === "settings" && (
          <SettingsView onSaved={reload} connected={connected} onCheckConnection={reload} />
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

      {showLogin && <AdminLoginModal onLogin={handleLogin} onClose={() => setShowLogin(false)} />}
      {editing && (
        <BookFormModal
          initial={editing.data}
          id={editing.id}
          onCancel={() => setEditing(null)}
          onSave={saveBook}
        />
      )}
      {checkoutFor && (
        <CheckoutModal
          book={checkoutFor}
          onCancel={() => setCheckoutFor(null)}
          onDone={async () => {
            setCheckoutFor(null);
            toast.success(`Checked out "${checkoutFor.title}".`);
            await reload();
          }}
        />
      )}
      {detailBook && (
        <BookDetailModal
          book={detailBook}
          isAdmin={isAdmin}
          onClose={() => setDetailBook(null)}
          onEdit={openEdit}
          onCheckout={startCheckout}
          onCheckin={checkinBook}
          onMarkRead={startMarkRead}
          readHistoryVersion={readHistoryVersion}
          onRequestHold={startHoldRequest}
        />
      )}
      {readFor && (
        <MarkReadModal
          book={readFor}
          onCancel={() => setReadFor(null)}
          onDone={async () => {
            setReadFor(null);
            setReadHistoryVersion((n) => n + 1);
            toast.success(`Marked "${readFor.title}" as read.`);
          }}
        />
      )}
      {holdFor && (
        <HoldRequestModal
          book={holdFor}
          onCancel={() => setHoldFor(null)}
          onDone={async () => {
            setHoldFor(null);
            await reload();
          }}
        />
      )}
      {handoff && (
        <HoldHandoffModal
          book={handoff.book}
          hold={handoff.hold}
          onClose={() => setHandoff(null)}
          onFulfilled={reload}
        />
      )}
      {confirmReq && <ConfirmDialog request={confirmReq} onClose={() => setConfirmReq(null)} />}

      <ToastStack />
    </div>
  );
}

function navCls(active: boolean) {
  return "navlink" + (active ? " navlink-active" : "");
}
