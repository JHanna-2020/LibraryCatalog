import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createTestEnv, TEST_PASSWORD, type TestEnv } from "./helpers.js";

describe("reads API", () => {
  let env: TestEnv;
  let bookId: number;

  beforeEach(async () => {
    env = createTestEnv();
    const res = await request(env.app)
      .post("/api/books")
      .set("x-admin-password", TEST_PASSWORD)
      .send({ title: "The Hobbit", authors: "J.R.R. Tolkien" })
      .expect(201);
    bookId = res.body.id;
  });

  afterEach(() => env.cleanup());

  const admin = () => ({ "x-admin-password": TEST_PASSWORD });

  it("marks a book read without admin auth and lists per-book history newest first", async () => {
    const first = await request(env.app)
      .post(`/api/books/${bookId}/reads`)
      .send({ reader_name: "  Maria  ", finished_at: "2026-07-01" })
      .expect(201);
    expect(first.body).toMatchObject({
      book_id: bookId,
      reader_name: "Maria",
    });
    expect(first.body.finished_at).toContain("2026-07-01");

    await request(env.app)
      .post(`/api/books/${bookId}/reads`)
      .send({ reader_name: "John", finished_at: "2026-07-10" })
      .expect(201);

    const res = await request(env.app).get(`/api/books/${bookId}/reads`).expect(200);
    expect(res.body.map((r: any) => r.reader_name)).toEqual(["John", "Maria"]);
  });

  it("validates reader name, finished date, and unknown books", async () => {
    const missing = await request(env.app)
      .post(`/api/books/${bookId}/reads`)
      .send({ finished_at: "2026-07-01" })
      .expect(400);
    expect(missing.body.error).toBe("Reader name is required.");

    const badDate = await request(env.app)
      .post(`/api/books/${bookId}/reads`)
      .send({ reader_name: "Maria", finished_at: "not-a-date" })
      .expect(400);
    expect(badDate.body.error).toBe("Finished date is invalid.");

    await request(env.app)
      .post("/api/books/9999/reads")
      .send({ reader_name: "Maria" })
      .expect(404);
  });

  it("lists all reads with book metadata and filters by reader", async () => {
    await request(env.app)
      .post(`/api/books/${bookId}/reads`)
      .send({ reader_name: "Maria", finished_at: "2026-07-01" })
      .expect(201);
    await request(env.app)
      .post(`/api/books/${bookId}/reads`)
      .send({ reader_name: "John", finished_at: "2026-07-02" })
      .expect(201);

    const all = await request(env.app).get("/api/reads").expect(200);
    expect(all.body).toHaveLength(2);
    expect(all.body[0]).toMatchObject({
      book_id: bookId,
      book_title: "The Hobbit",
      authors: "J.R.R. Tolkien",
    });

    const maria = await request(env.app).get("/api/reads?reader=Maria").expect(200);
    expect(maria.body.map((r: any) => r.reader_name)).toEqual(["Maria"]);

    const readers = await request(env.app).get("/api/reads/readers").expect(200);
    expect(readers.body).toEqual(["John", "Maria"]);
  });

  it("allows only admin to delete read entries and cascades reads when books are deleted", async () => {
    const read = await request(env.app)
      .post(`/api/books/${bookId}/reads`)
      .send({ reader_name: "Maria" })
      .expect(201);

    await request(env.app).delete(`/api/reads/${read.body.id}`).expect(401);
    await request(env.app).delete(`/api/reads/${read.body.id}`).set(admin()).expect(200);
    await request(env.app).delete(`/api/reads/${read.body.id}`).set(admin()).expect(404);

    await request(env.app)
      .post(`/api/books/${bookId}/reads`)
      .send({ reader_name: "Maria" })
      .expect(201);
    await request(env.app).delete(`/api/books/${bookId}`).set(admin()).expect(200);
    const reads = await request(env.app).get("/api/reads").expect(200);
    expect(reads.body).toEqual([]);
  });
});
