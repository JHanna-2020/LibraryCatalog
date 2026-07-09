import express from "express";
import cors from "cors";
import type { Config } from "./config.js";
import type { DB } from "./db/connection.js";
import { BooksRepo } from "./repositories/booksRepo.js";
import { LoansRepo } from "./repositories/loansRepo.js";
import { BorrowersRepo } from "./repositories/borrowersRepo.js";
import { HoldsRepo } from "./repositories/holdsRepo.js";
import { BooksService } from "./services/booksService.js";
import { LoansService } from "./services/loansService.js";
import { HoldsService } from "./services/holdsService.js";
import { CoversService } from "./services/coversService.js";
import { requireAdmin } from "./middleware/auth.js";
import { errorHandler, notFoundHandler } from "./middleware/errors.js";
import { createHealthRouter } from "./routes/health.js";
import { createBooksRouter } from "./routes/books.js";
import { createLoansRouter } from "./routes/loans.js";
import { createBorrowersRouter } from "./routes/borrowers.js";
import { createHoldsRouter } from "./routes/holds.js";
import { createCoversRouter } from "./routes/covers.js";
import { createLookupRouter } from "./routes/lookup.js";
import type { IsbnSource } from "./lib/isbn/index.js";

export interface AppContext {
  config: Config;
  db: DB;
  booksService: BooksService;
  loansService: LoansService;
  holdsService: HoldsService;
  coversService: CoversService;
  borrowersRepo: BorrowersRepo;
  loansRepo: LoansRepo;
  requireAdmin: express.RequestHandler;
  /** Test seam for the external ISBN sources. */
  isbnSources?: { openLibrary: IsbnSource; googleBooks: IsbnSource };
}

export function createContext(
  config: Config,
  db: DB,
  isbnSources?: AppContext["isbnSources"]
): AppContext {
  const booksRepo = new BooksRepo(db);
  const loansRepo = new LoansRepo(db);
  const borrowersRepo = new BorrowersRepo(db);
  const holdsRepo = new HoldsRepo(db);
  const coversService = new CoversService(config.coversDir);
  return {
    config,
    db,
    booksService: new BooksService(booksRepo, coversService),
    loansService: new LoansService(db, booksRepo, loansRepo, borrowersRepo, holdsRepo),
    holdsService: new HoldsService(db, booksRepo, loansRepo, holdsRepo),
    coversService,
    borrowersRepo,
    loansRepo,
    requireAdmin: requireAdmin(config.adminPassword),
    isbnSources,
  };
}

export function createApp(ctx: AppContext): express.Express {
  const app = express();

  // Generous limit: uploaded cover photos arrive as base64 in the JSON body.
  app.use(express.json({ limit: "12mb" }));
  app.use(
    cors({
      origin: ctx.config.allowedOrigins.includes("*") ? true : ctx.config.allowedOrigins,
    })
  );

  // Stored cover images. Long cache; updates cache-bust with ?t=.
  app.use("/covers", express.static(ctx.config.coversDir, { maxAge: "365d" }));

  app.use(createHealthRouter(ctx));
  app.use(createBooksRouter(ctx));
  app.use(createLoansRouter(ctx));
  app.use(createBorrowersRouter(ctx));
  app.use(createHoldsRouter(ctx));
  app.use(createCoversRouter(ctx));
  app.use(createLookupRouter(ctx));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
