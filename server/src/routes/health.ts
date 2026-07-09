import { Router } from "express";
import type { AppContext } from "../app.js";
import { rateLimit } from "../middleware/rateLimit.js";

export function createHealthRouter(ctx: AppContext): Router {
  const router = Router();

  router.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  // Rate-limited: this endpoint is the natural brute-force target.
  const verifyLimiter = rateLimit({ windowMs: 60_000, max: 10, name: "verify-admin" });
  router.post("/api/verify-admin", verifyLimiter, ctx.requireAdmin, (_req, res) => {
    res.json({ ok: true });
  });

  return router;
}
