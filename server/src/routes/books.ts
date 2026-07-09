import { Router } from "express";
import type { AppContext } from "../app.js";
import { asyncHandler } from "../middleware/errors.js";
import { parseBody, parseId } from "../middleware/validate.js";
import { bookCreateSchema, bookUpdateSchema } from "../validation.js";

export function createBooksRouter(ctx: AppContext): Router {
  const router = Router();
  const { booksService, loansService } = ctx;

  router.get("/api/books", (_req, res) => {
    res.json(booksService.list());
  });

  router.get(
    "/api/books/:id",
    asyncHandler(async (req, res) => {
      res.json(booksService.get(parseId(req.params.id!)));
    })
  );

  router.get(
    "/api/books/:id/history",
    asyncHandler(async (req, res) => {
      const id = parseId(req.params.id!);
      booksService.get(id); // 404 for unknown books
      res.json(loansService.historyForBook(id));
    })
  );

  router.post(
    "/api/books",
    ctx.requireAdmin,
    asyncHandler(async (req, res) => {
      const body = parseBody(bookCreateSchema, req);
      res.status(201).json(await booksService.create(body));
    })
  );

  router.put(
    "/api/books/:id",
    ctx.requireAdmin,
    asyncHandler(async (req, res) => {
      const body = parseBody(bookUpdateSchema, req);
      res.json(await booksService.update(parseId(req.params.id!), body));
    })
  );

  router.delete(
    "/api/books/:id",
    ctx.requireAdmin,
    asyncHandler(async (req, res) => {
      await booksService.delete(parseId(req.params.id!));
      res.json({ ok: true });
    })
  );

  return router;
}
