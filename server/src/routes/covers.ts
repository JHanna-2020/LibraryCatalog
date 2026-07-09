import { Router } from "express";
import type { AppContext } from "../app.js";
import { asyncHandler } from "../middleware/errors.js";

export function createCoversRouter(ctx: AppContext): Router {
  const router = Router();

  router.get(
    "/api/covers",
    ctx.requireAdmin,
    asyncHandler(async (_req, res) => {
      res.json(await ctx.coversService.listAssets());
    })
  );

  return router;
}
