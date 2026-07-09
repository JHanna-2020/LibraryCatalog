import type { RequestHandler } from "express";
import { timingSafeEqual } from "node:crypto";

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Single shared admin password guards all write actions; reads stay public so
 * borrowers can browse the catalog.
 */
export function requireAdmin(adminPassword: string): RequestHandler {
  return (req, res, next) => {
    const provided = req.get("x-admin-password") || "";
    if (!safeCompare(provided, adminPassword)) {
      res.status(401).json({ error: "Wrong or missing admin password." });
      return;
    }
    next();
  };
}
