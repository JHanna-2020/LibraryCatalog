import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { HttpError } from "../types.js";

/**
 * Express 4 doesn't forward rejected promises to the error handler; wrap
 * async handlers so a thrown/rejected error becomes next(err) instead of an
 * unhandled rejection that kills the process.
 */
export function asyncHandler(fn: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: "Not found." });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err instanceof ZodError) {
    const first = err.issues[0];
    res.status(400).json({ error: first ? first.message : "Invalid request." });
    return;
  }
  // Malformed JSON bodies and similar parser errors carry a status.
  const status = typeof err?.status === "number" ? err.status : 500;
  if (status >= 500) console.error("[error]", err);
  res.status(status).json({
    error: status >= 500 ? "Internal server error." : err.message || "Bad request.",
  });
};
