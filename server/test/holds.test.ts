import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createTestEnv, TEST_PASSWORD, type TestEnv } from "./helpers.js";
import {
  HOLD_BOOK_AVAILABLE_MESSAGE,
  HOLD_ALREADY_EXISTS_MESSAGE,
} from "../src/services/holdsService.js";

const admin = () => ({ "x-admin-password": TEST_PASSWORD });

describe("holds API", () => {
  let env: TestEnv;
  let bookId: number; // checked out — holdable
  let shelfBookId: number; // available — not holdable

  beforeEach(async () => {
    env = createTestEnv();
    const a = await request(env.app).post("/api/books").set(admin()).send({ title: "Dune" });
    bookId = a.body.id;
    const b = await request(env.app).post("/api/books").set(admin()).send({ title: "Emma" });
    shelfBookId = b.body.id;
    await request(env.app)
      .post(`/api/books/${bookId}/checkout`)
      .set(admin())
      .send({ borrower_name: "Alice" })
      .expect(200);
  });
  afterEach(() => env.cleanup());

  const placeHold = (id: number, name: string, contact?: string) =>
    request(env.app).post(`/api/books/${id}/holds`).send({ name, contact });

  it("creates a pending hold on a checked-out book without auth", async () => {
    const res = await placeHold(bookId, "  Cara  ", "cara@example.com").expect(201);
    expect(res.body).toEqual({
      id: expect.any(Number),
      book_id: bookId,
      name: "Cara",
      contact: "cara@example.com",
      requested_at: expect.any(String),
      status: "pending",
    });
  });

  it("requires a name and 404s for unknown books", async () => {
    const res = await request(env.app)
      .post(`/api/books/${bookId}/holds`)
      .send({ name: "   " })
      .expect(400);
    expect(res.body.error).toBe("Name is required.");
    await request(env.app).post(`/api/books/${bookId}/holds`).send({}).expect(400);
    await placeHold(9999, "Cara").expect(404);
    await request(env.app).post("/api/books/abc/holds").send({ name: "Cara" }).expect(404);
  });

  it("409s with distinct friendly messages for available books and duplicate holds", async () => {
    const onShelf = await placeHold(shelfBookId, "Cara").expect(409);
    expect(onShelf.body.error).toBe(HOLD_BOOK_AVAILABLE_MESSAGE);

    await placeHold(bookId, "Cara").expect(201);
    const dup = await placeHold(bookId, "cara").expect(409); // case-insensitive
    expect(dup.body.error).toBe(HOLD_ALREADY_EXISTS_MESSAGE);
    expect(dup.body.error).not.toBe(onShelf.body.error);
  });

  it("counts pending holds on book responses, in a single-query list", async () => {
    await placeHold(bookId, "Cara").expect(201);
    await placeHold(bookId, "Dan").expect(201);

    const list = await request(env.app).get("/api/books").expect(200);
    const dune = list.body.find((b: any) => b.id === bookId);
    const emma = list.body.find((b: any) => b.id === shelfBookId);
    expect(dune.pending_holds).toBe(2);
    expect(emma.pending_holds).toBe(0);

    const one = await request(env.app).get(`/api/books/${bookId}`).expect(200);
    expect(one.body.pending_holds).toBe(2);
  });

  it("lists pending holds FIFO with book titles, admin only", async () => {
    await request(env.app).get("/api/holds").expect(401);

    await placeHold(bookId, "Cara", "cara@example.com").expect(201);
    await placeHold(bookId, "Dan").expect(201);

    const res = await request(env.app).get("/api/holds").set(admin()).expect(200);
    expect(res.body.map((h: any) => h.name)).toEqual(["Cara", "Dan"]);
    expect(res.body[0]).toEqual({
      id: expect.any(Number),
      book_id: bookId,
      book_title: "Dune",
      name: "Cara",
      contact: "cara@example.com",
      requested_at: expect.any(String),
    });
  });

  it("surfaces the oldest pending hold as next_hold on checkin and keeps it pending", async () => {
    const first = await placeHold(bookId, "Cara", "cara@example.com").expect(201);
    await placeHold(bookId, "Dan").expect(201);

    const checkin = await request(env.app)
      .post(`/api/books/${bookId}/checkin`)
      .set(admin())
      .expect(200);
    expect(checkin.body.status).toBe("available");
    expect(checkin.body.next_hold).toEqual({
      id: first.body.id,
      name: "Cara",
      contact: "cara@example.com",
      requested_at: first.body.requested_at,
    });

    // The hold was only surfaced, not consumed.
    const queue = await request(env.app).get("/api/holds").set(admin()).expect(200);
    expect(queue.body).toHaveLength(2);
  });

  it("returns next_hold: null when nobody is waiting", async () => {
    const checkin = await request(env.app)
      .post(`/api/books/${bookId}/checkin`)
      .set(admin())
      .expect(200);
    expect(checkin.body.next_hold).toBeNull();
  });

  it("cancels a pending hold exactly once and stops counting it", async () => {
    const hold = await placeHold(bookId, "Cara").expect(201);
    await request(env.app).delete(`/api/holds/${hold.body.id}`).expect(401);
    await request(env.app).delete(`/api/holds/${hold.body.id}`).set(admin()).expect(200);
    await request(env.app).delete(`/api/holds/${hold.body.id}`).set(admin()).expect(404);
    await request(env.app).delete("/api/holds/9999").set(admin()).expect(404);

    const book = await request(env.app).get(`/api/books/${bookId}`).expect(200);
    expect(book.body.pending_holds).toBe(0);
    const queue = await request(env.app).get("/api/holds").set(admin()).expect(200);
    expect(queue.body).toHaveLength(0);
  });

  it("fulfills a pending hold exactly once and stops counting it", async () => {
    const hold = await placeHold(bookId, "Cara").expect(201);
    await request(env.app).post(`/api/holds/${hold.body.id}/fulfill`).set(admin()).expect(200);
    await request(env.app).post(`/api/holds/${hold.body.id}/fulfill`).set(admin()).expect(404);

    const book = await request(env.app).get(`/api/books/${bookId}`).expect(200);
    expect(book.body.pending_holds).toBe(0);
    // A fulfilled hold no longer blocks the same visitor from holding again.
    await placeHold(bookId, "Cara").expect(201);
  });

  it("keeps the holds queue working after a book with pending holds is deleted", async () => {
    await placeHold(bookId, "Cara").expect(201);
    await request(env.app).delete(`/api/books/${bookId}`).set(admin()).expect(200);

    const queue = await request(env.app).get("/api/holds").set(admin()).expect(200);
    expect(queue.body).toEqual([]);
    const list = await request(env.app).get("/api/books").expect(200);
    expect(list.body.every((b: any) => b.pending_holds === 0)).toBe(true);
  });

  it("rate limits repeated hold requests from one client", async () => {
    let limited = false;
    for (let i = 0; i < 12; i++) {
      const res = await placeHold(bookId, `Visitor ${i}`);
      if (res.status === 429) {
        limited = true;
        break;
      }
    }
    expect(limited).toBe(true);
  });
});
