import type { Request } from "express";
import { HttpError } from "../types.js";

/** Parse and validate a request body; throws ZodError → 400 via errorHandler. */
export function parseBody<T>(schema: { parse: (data: unknown) => T }, req: Request): T {
  return schema.parse(req.body ?? {});
}

/** Route :id params must be positive integers; anything else is a 404. */
export function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, "Not found.");
  return id;
}
