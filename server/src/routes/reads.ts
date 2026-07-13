import { Router } from "express";
import type { AppContext } from "../app.js";
import { asyncHandler } from "../middleware/errors.js";
import { parseBody, parseId } from "../middleware/validate.js";
import { readCreateSchema } from "../validation.js";

export function createReadsRouter(ctx: AppContext): Router {
  const router = Router();
  const { readsService } = ctx;

  router.get("/api/reads", (req, res) => {
    res.json(readsService.list(String(req.query.reader ?? "")));
  });

  router.get("/api/reads/readers", (_req, res) => {
    res.json(readsService.readers());
  });

  router.get(
    "/api/books/:id/reads",
    asyncHandler(async (req, res) => {
      res.json(readsService.listForBook(parseId(req.params.id!)));
    })
  );

  router.post(
    "/api/books/:id/reads",
    asyncHandler(async (req, res) => {
      const body = parseBody(readCreateSchema, req);
      res.status(201).json(readsService.create(parseId(req.params.id!), body));
    })
  );

  router.delete(
    "/api/reads/:id",
    ctx.requireAdmin,
    asyncHandler(async (req, res) => {
      readsService.delete(parseId(req.params.id!));
      res.json({ ok: true });
    })
  );

  return router;
}
