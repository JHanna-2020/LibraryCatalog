import { Router } from "express";
import type { AppContext } from "../app.js";
import { asyncHandler } from "../middleware/errors.js";
import { parseBody, parseId } from "../middleware/validate.js";
import { checkoutSchema } from "../validation.js";

export function createLoansRouter(ctx: AppContext): Router {
  const router = Router();
  const { loansService } = ctx;

  router.post(
    "/api/books/:id/checkout",
    ctx.requireAdmin,
    asyncHandler(async (req, res) => {
      const body = parseBody(checkoutSchema, req);
      res.json(loansService.checkout(parseId(req.params.id!), body));
    })
  );

  router.post(
    "/api/books/:id/checkin",
    ctx.requireAdmin,
    asyncHandler(async (req, res) => {
      res.json(loansService.checkin(parseId(req.params.id!)));
    })
  );

  // Everything currently checked out (for the "Who has what" view).
  router.get("/api/checkouts", (_req, res) => {
    res.json(loansService.listActiveCheckouts());
  });

  return router;
}
