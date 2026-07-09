import { Router } from "express";
import type { AppContext } from "../app.js";
import { asyncHandler } from "../middleware/errors.js";
import { parseId } from "../middleware/validate.js";
import { HttpError } from "../types.js";

export function createBorrowersRouter(ctx: AppContext): Router {
  const router = Router();
  const { borrowersRepo, loansRepo } = ctx;

  router.get("/api/borrowers", (_req, res) => {
    res.json(borrowersRepo.listWithLoanCounts());
  });

  router.get(
    "/api/borrowers/:id/loans",
    asyncHandler(async (req, res) => {
      const id = parseId(req.params.id!);
      if (!borrowersRepo.getById(id)) throw new HttpError(404, "Not found.");
      res.json(loansRepo.listForBorrower(id));
    })
  );

  return router;
}
