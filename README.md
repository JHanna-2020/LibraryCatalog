# 📚 Library Catalog

A personal library catalog website. Add books (with ISBN auto-fill and barcode
scanning), organize them with tags and shelves, check books out to people, and
see who has what — all from a link you can open on any device. Visitors can
even **request a hold** on a checked-out book so it's set aside for them when
it comes back.

## How it works

There are two pieces:

1. **The website (frontend)** — a static site hosted **free on GitHub Pages**.
   This is the link you and your borrowers open.
2. **The server (backend)** — a tiny Node.js program that runs on **your
   always-on laptop** and stores all your books in a single SQLite file
   (`server/library.db`).

The website talks to your laptop's server over the internet through a free
**Cloudflare Tunnel**, which gives your laptop a secure `https://…` address
without any router/port-forwarding setup.

```
  You / borrowers  ─►  GitHub Pages (website)  ─►  Cloudflare Tunnel  ─►  Your laptop (server + database)
```

**Anyone with the link can view** the catalog and see who has what.
**Only you** (with the admin password) can add, edit, delete, or check books in/out.

---

## Part 1 — Run the server on your laptop

You need [Node.js](https://nodejs.org) 20 or newer installed.

```bash
cd server
npm install
cp .env.example .env
```

Open `.env` in a text editor and set your **admin password** (this is what
unlocks editing). Then build and start it:

```bash
npm run build
npm start
```

> The first time the new server starts against an existing `library.db`, it
> automatically upgrades the database (adding borrowers, loan history, and
> holds). Make a quick copy of `server/library.db` first if you want an extra
> safety net.

You should see `Library catalog API running on http://localhost:4000`.
Leave this running. To keep it running permanently after you close the terminal
or reboot, see **Keeping the server always on** below.

## Part 2 — Expose the server with a free Cloudflare Tunnel

This gives your laptop a public `https://` address the website can reach.

1. Install cloudflared:
   - macOS: `brew install cloudflared`
   - Other systems: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
2. In a **second** terminal, run:

   ```bash
   cloudflared tunnel --url http://localhost:4000
   ```

3. It prints a URL like `https://random-words-here.trycloudflare.com`.
   **Copy that URL** — that's your library server address.

> The quick-tunnel URL changes each time you restart it. For a permanent,
> unchanging address, create a named tunnel (free, needs a domain on Cloudflare):
> https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/

## Part 3 — Publish the website to GitHub Pages

1. Create a new GitHub repository and push this whole project to it.
2. In the repo, go to **Settings → Pages → Build and deployment** and set
   **Source** to **GitHub Actions**.
3. Push to the `main` branch. The included workflow
   (`.github/workflows/deploy.yml`) builds the site and publishes it.
4. After it finishes, your site is live at
   `https://<your-username>.github.io/<repo-name>/`.

## Part 4 — Connect the website to your server

1. Open your GitHub Pages link.
2. Go to **Settings** in the app.
3. The default server address is `https://room-controller.tail8ef820.ts.net`.
   Change "Library server address" only if the server moves.
4. Enter your **admin password** and click **Save & connect**. You should see
   "Connected ✓".

That's it. Add your first book with the **+ Add book** button.

> **Tip:** For security, once you know your GitHub Pages URL, edit the server's
> `.env` and set `ALLOWED_ORIGINS=https://<your-username>.github.io` so only your
> own site can talk to the server, then restart the server.

---

## Using it day to day

- **Add a book** — click *+ Add book*. Type or **scan** the ISBN, hit
  **Auto-fill**, and the title/author/cover fill in automatically. For books
  without an online cover, use **Choose saved cover** to pick a file already in
  `server/covers/`, or use **Upload cover photo** to save a new picture on your
  laptop. Add tags (comma-separated) and a shelf location.
- **Search & filter** — search box matches title, author, ISBN, and tags;
  dropdowns filter by genre, tag, and availability.
- **Check out** — click *Check out* on a book, enter the borrower's name.
- **Who has what** — the **Checked Out** tab lists every borrowed book grouped
  by person. The **Borrowers** tab shows everyone who has ever borrowed, with
  their full history; clicking a book shows that book's loan history too.
- **Holds** — anyone viewing the site can click **Request hold** on a
  checked-out book and leave their name. You'll see the queue in the
  admin-only **Holds** tab, and when you check the book back in the app tells
  you who's next in line so you can set it aside.
- **Borrowers viewing** — just share your GitHub Pages link. Without the admin
  password they see a clean read-only catalog (plus the hold-request button).

## Backing up your data

Your book records are in `server/library.db`. Uploaded cover photos are in
`server/covers/`. Copy both somewhere safe (cloud drive, external disk) now and
then. To restore, put them back in the same locations.

## Keeping the server always on

Simplest option — run the server and tunnel as background services with
[pm2](https://pm2.keymetrics.io/):

```bash
npm install -g pm2
cd server
pm2 start "npm start" --name library-server
pm2 start "cloudflared tunnel --url http://localhost:4000" --name library-tunnel
pm2 save
pm2 startup   # follow the printed instructions so it survives reboots
```

## Project layout

```
LibraryCatalog/
├── frontend/                 # The website (React + Vite + TypeScript) → GitHub Pages
│   └── src/
│       ├── api/              # typed API client
│       ├── components/       # cards, modals, dialogs, scanner, toasts
│       ├── views/            # Catalog, Checked Out, Borrowers, Holds, Settings
│       ├── hooks/            # data loading, admin session, toasts
│       └── styles/           # the "private study" theme, split by concern
├── server/                   # The API + database (TypeScript) → your laptop
│   ├── src/
│   │   ├── db/migrations/    # versioned schema upgrades, run at startup
│   │   ├── repositories/     # all SQL (books, loans, borrowers, holds)
│   │   ├── services/         # business logic (checkouts, holds, covers, ISBN)
│   │   ├── routes/           # thin Express routers
│   │   └── middleware/       # admin auth, validation, rate limits, errors
│   ├── test/                 # Vitest suite (40 tests)
│   ├── covers/               # uploaded cover photos (not in git)
│   └── library.db            # your data (created on first run; not in git)
└── .github/workflows/        # Auto-deploy the website to GitHub Pages
```

To work on the code: `npm run dev` in `frontend/` and `npm run dev` in
`server/` (auto-reloading TypeScript). Run tests with `npm test` in either
directory.

## Image credits

- **Icon of Saint Moses the Black** (`frontend/public/images/st-moses-the-black.jpg`)
  — traditional Coptic icon supplied by the library owner for personal use.
- **Coptic cross** (`frontend/public/images/coptic-cross.svg`) — original vector
  artwork created for this project.

## Tech stack

React + Vite + TypeScript (frontend) · Node.js + Express + TypeScript +
better-sqlite3 with versioned migrations (backend) · Zod (validation) · Vitest
(tests) · Open Library + Google Books APIs (ISBN lookup) · ZXing (barcode
scanning) · Cloudflare Tunnel (secure exposure) · GitHub Pages + Actions
(hosting).
