import { useCallback, useEffect, useState } from "react";
import { api, getApiBase } from "../api";
import type { Book, Checkout } from "../api";

/** Loads the catalog + active checkouts and tracks connection state. */
export function useBooks() {
  const [books, setBooks] = useState<Book[]>([]);
  const [checkouts, setCheckouts] = useState<Checkout[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState<boolean | null>(null);

  const reload = useCallback(async () => {
    if (!getApiBase()) return;
    setLoading(true);
    setError("");
    try {
      const [b, c] = await Promise.all([api.listBooks(), api.listCheckouts()]);
      setBooks(b);
      setCheckouts(c);
      setConnected(true);
    } catch (e) {
      setError((e as Error).message);
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { books, checkouts, loading, error, connected, reload };
}
