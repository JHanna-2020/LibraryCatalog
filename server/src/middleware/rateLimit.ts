import type { RequestHandler } from "express";

interface Window {
  count: number;
  resetAt: number;
}

/**
 * Small in-memory fixed-window per-IP limiter. Fine for a single-process
 * hobby deployment; swap for a shared store if this ever runs multi-instance.
 */
export function rateLimit(options: { windowMs: number; max: number; name: string }): RequestHandler {
  const windows = new Map<string, Window>();

  return (req, res, next) => {
    const nowMs = Date.now();
    const key = req.ip || "unknown";
    let w = windows.get(key);
    if (!w || w.resetAt <= nowMs) {
      w = { count: 0, resetAt: nowMs + options.windowMs };
      windows.set(key, w);
    }
    w.count += 1;

    // Opportunistic cleanup so the map doesn't grow unbounded.
    if (windows.size > 10_000) {
      for (const [k, v] of windows) if (v.resetAt <= nowMs) windows.delete(k);
    }

    if (w.count > options.max) {
      res.setHeader("Retry-After", Math.ceil((w.resetAt - nowMs) / 1000));
      res.status(429).json({ error: "Too many requests. Try again shortly." });
      return;
    }
    next();
  };
}
