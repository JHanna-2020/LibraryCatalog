import { Router } from "express";
import type { AppContext } from "../app.js";
import { asyncHandler } from "../middleware/errors.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { parseBody, parseId } from "../middleware/validate.js";
import { holdRequestSchema } from "../validation.js";

export function createHoldsRouter(ctx: AppContext): Router {
  const router = Router();
  const { holdsService } = ctx;

  // Public and write-capable, so keep the limiter tight.
  const holdLimiter = rateLimit({ windowMs: 60_000, max: 10, name: "holds" });

  router.post(
    "/api/books/:id/holds",
    holdLimiter,
    asyncHandler(async (req, res) => {
      const body = parseBody(holdRequestSchema, req);
      res.status(201).json(holdsService.request(parseId(req.params.id!), body));
    })
  );

  router.get("/api/holds", ctx.requireAdmin, (_req, res) => {
    res.json(holdsService.listPending());
  });

  router.delete(
    "/api/holds/:id",
    ctx.requireAdmin,
    asyncHandler(async (req, res) => {
      holdsService.cancel(parseId(req.params.id!));
      res.json({ ok: true });
    })
  );

  router.post(
    "/api/holds/:id/fulfill",
    ctx.requireAdmin,
    asyncHandler(async (req, res) => {
      holdsService.fulfill(parseId(req.params.id!));
      res.json({ ok: true });
    })
  );

  return router;
}
