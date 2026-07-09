import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Minimal localStorage stand-in so the client can run under Node.
function makeStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  };
}

vi.stubGlobal("localStorage", makeStorage());

const { api, ApiError, coverSrc, getApiBase, setApiBase, setPassword, clearPassword } =
  await import("./client");

function mockFetch(status = 200, body: unknown = { ok: true }) {
  // A fresh Response per call: bodies are single-use streams.
  const fn = vi.fn().mockImplementation(() =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      })
    )
  );
  vi.stubGlobal("fetch", fn);
  return fn;
}

beforeEach(() => {
  localStorage.clear();
  setApiBase("https://example.test");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.stubGlobal("localStorage", makeStorage());
});

describe("request headers", () => {
  it("sends x-admin-password when a password is stored", async () => {
    setPassword("secret");
    const fetchMock = mockFetch();
    await api.health();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://example.test/api/health");
    expect((init.headers as Record<string, string>)["x-admin-password"]).toBe("secret");
  });

  it("omits x-admin-password when no password is stored", async () => {
    clearPassword();
    const fetchMock = mockFetch();
    await api.health();
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers).not.toHaveProperty("x-admin-password");
  });
});

describe("error handling", () => {
  it("throws ApiError carrying the HTTP status and server message", async () => {
    mockFetch(409, { error: "Book already checked out" });
    const err = await api.checkout(1, "Mark", "").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(409);
    expect(err.message).toBe("Book already checked out");
  });

  it("wraps network failures in a friendly message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(api.health()).rejects.toThrow(/Can't reach the server/);
  });
});

describe("holds", () => {
  it("posts a public hold request with name and contact", async () => {
    clearPassword();
    const fetchMock = mockFetch(201, {
      id: 7, book_id: 3, name: "Mark", contact: "555-1234",
      requested_at: "2026-07-09T12:00:00Z", status: "pending",
    });
    const receipt = await api.requestHold(3, "Mark", "555-1234");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://example.test/api/books/3/holds");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ name: "Mark", contact: "555-1234" });
    expect(receipt.status).toBe("pending");
  });

  it("uses the right methods for the admin holds endpoints", async () => {
    const fetchMock = mockFetch();
    await api.listHolds();
    await api.cancelHold(5);
    await api.fulfillHold(5);
    const calls = fetchMock.mock.calls;
    expect(calls[0][0]).toBe("https://example.test/api/holds");
    expect(calls[0][1].method).toBeUndefined(); // GET
    expect(calls[1][0]).toBe("https://example.test/api/holds/5");
    expect(calls[1][1].method).toBe("DELETE");
    expect(calls[2][0]).toBe("https://example.test/api/holds/5/fulfill");
    expect(calls[2][1].method).toBe("POST");
  });

  it("surfaces rate limiting as an ApiError with status 429", async () => {
    mockFetch(429, { error: "Too many requests" });
    const err = await api.requestHold(1, "Mark", "").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(429);
  });
});

describe("api base & covers", () => {
  it("strips trailing slashes from the stored base and falls back to the default", () => {
    setApiBase("https://mylib.example.com///");
    expect(getApiBase()).toBe("https://mylib.example.com");
    localStorage.clear();
    expect(getApiBase()).toBe("https://room-controller.tail8ef820.ts.net");
  });

  it("resolves server-relative covers against the API base, passes absolute URLs through", () => {
    setApiBase("https://mylib.example.com");
    expect(coverSrc("/covers/abc.jpg")).toBe("https://mylib.example.com/covers/abc.jpg");
    expect(coverSrc("https://cdn.example.com/x.jpg")).toBe("https://cdn.example.com/x.jpg");
    expect(coverSrc("")).toBe("");
  });
});
