import { Router } from "express";
import type { AppContext } from "../app.js";
import { asyncHandler } from "../middleware/errors.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { lookupIsbn } from "../lib/isbn/index.js";
import { HttpError } from "../types.js";

export function createLookupRouter(ctx: AppContext): Router {
  const router = Router();

  // Public endpoint that fans out to third-party APIs — keep it modest.
  const lookupLimiter = rateLimit({ windowMs: 60_000, max: 30, name: "lookup" });

  router.get(
    "/api/lookup/:isbn",
    lookupLimiter,
    asyncHandler(async (req, res) => {
      const isbn = String(req.params.isbn).replace(/[^0-9Xx]/g, "");
      if (!isbn) throw new HttpError(400, "Invalid ISBN.");
      const result = await lookupIsbn(isbn, ctx.isbnSources);
      if (!result) throw new HttpError(404, "No match found for that ISBN.");
      res.json(result);
    })
  );

  return router;
}
