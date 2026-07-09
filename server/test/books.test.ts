import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import fs from "node:fs";
import { join } from "node:path";
import { createTestEnv, TEST_PASSWORD, TINY_JPEG_DATA_URL, type TestEnv } from "./helpers.js";

describe("books API", () => {
  let env: TestEnv;
  beforeEach(() => {
    env = createTestEnv();
  });
  afterEach(() => env.cleanup());

  const admin = () => ({ "x-admin-password": TEST_PASSWORD });

  it("rejects writes with a wrong or missing password", async () => {
    await request(env.app).post("/api/books").send({ title: "X" }).expect(401);
    await request(env.app)
      .post("/api/books")
      .set("x-admin-password", "nope")
      .send({ title: "X" })
      .expect(401);
    await request(env.app).post("/api/verify-admin").set(admin()).expect(200);
  });

  it("creates a book with defaults and parsed tags", async () => {
    const res = await request(env.app)
      .post("/api/books")
      .set(admin())
      .send({ title: "  The Hobbit  ", authors: "Tolkien", tags: ["fantasy", " classic "] })
      .expect(201);
    expect(res.body.title).toBe("The Hobbit");
    expect(res.body.tags).toEqual(["fantasy", "classic"]);
    expect(res.body.status).toBe("available");
    expect(res.body.loan).toBeNull();
    expect(res.body.isbn).toBe("");
    expect(res.body.added_at).toBeTruthy();
  });

  it("requires a title", async () => {
    const res = await request(env.app).post("/api/books").set(admin()).send({}).expect(400);
    expect(res.body.error).toBe("Title is required.");
    await request(env.app).post("/api/books").set(admin()).send({ title: "   " }).expect(400);
  });

  it("accepts an odd-looking ISBN instead of rejecting it", async () => {
    await request(env.app)
      .post("/api/books")
      .set(admin())
      .send({ title: "Old Pamphlet", isbn: "not-an-isbn" })
      .expect(201);
  });

  it("stores an uploaded cover and serves it with a cache-busting URL", async () => {
    const res = await request(env.app)
      .post("/api/books")
      .set(admin())
      .send({ title: "With Cover", cover_data: TINY_JPEG_DATA_URL })
      .expect(201);
    expect(res.body.cover_url).toMatch(/^\/covers\/\d+\.jpg\?t=\d+$/);
    const id = res.body.id;
    expect(fs.existsSync(join(env.coversDir, `${id}.jpg`))).toBe(true);
    await request(env.app).get(`/covers/${id}.jpg`).expect(200);

    const list = await request(env.app).get("/api/covers").set(admin()).expect(200);
    expect(list.body.map((a: any) => a.name)).toContain(`${id}.jpg`);
  });

  it("rejects malformed and oversized cover uploads", async () => {
    await request(env.app)
      .post("/api/books")
      .set(admin())
      .send({ title: "Bad Cover", cover_data: "data:text/plain;base64,aGk=" })
      .expect(400);
    const big = "data:image/jpeg;base64," + "A".repeat(8 * 1024 * 1024);
    const res = await request(env.app)
      .post("/api/books")
      .set(admin())
      .send({ title: "Huge Cover", cover_data: big })
      .expect(400);
    expect(res.body.error).toMatch(/too large/i);
  });

  it("updates fields partially and preserves the rest", async () => {
    const created = await request(env.app)
      .post("/api/books")
      .set(admin())
      .send({ title: "Dune", authors: "Frank Herbert", location: "Shelf A" })
      .expect(201);
    const res = await request(env.app)
      .put(`/api/books/${created.body.id}`)
      .set(admin())
      .send({ notes: "signed copy" })
      .expect(200);
    expect(res.body.title).toBe("Dune");
    expect(res.body.location).toBe("Shelf A");
    expect(res.body.notes).toBe("signed copy");
  });

  it("removes the stored cover file when a book is deleted", async () => {
    const created = await request(env.app)
      .post("/api/books")
      .set(admin())
      .send({ title: "Doomed", cover_data: TINY_JPEG_DATA_URL })
      .expect(201);
    const id = created.body.id;
    expect(fs.existsSync(join(env.coversDir, `${id}.jpg`))).toBe(true);
    await request(env.app).delete(`/api/books/${id}`).set(admin()).expect(200);
    expect(fs.existsSync(join(env.coversDir, `${id}.jpg`))).toBe(false);
    await request(env.app).get(`/api/books/${id}`).expect(404);
  });

  it("returns 404 for unknown or non-numeric ids", async () => {
    await request(env.app).get("/api/books/9999").expect(404);
    await request(env.app).get("/api/books/abc").expect(404);
    await request(env.app).delete("/api/books/9999").set(admin()).expect(404);
  });

  it("lists books alphabetically with correct per-book status from one join", async () => {
    const ids: number[] = [];
    for (const title of ["Zebra Book", "Apple Book", "Mango Book"]) {
      const r = await request(env.app).post("/api/books").set(admin()).send({ title });
      ids.push(r.body.id);
    }
    await request(env.app)
      .post(`/api/books/${ids[1]}/checkout`)
      .set(admin())
      .send({ borrower_name: "Cara", borrower_contact: "cara@example.com" })
      .expect(200);

    const res = await request(env.app).get("/api/books").expect(200);
    expect(res.body.map((b: any) => b.title)).toEqual(["Apple Book", "Mango Book", "Zebra Book"]);
    const apple = res.body[0];
    expect(apple.status).toBe("checked_out");
    expect(apple.loan).toEqual({
      borrower_name: "Cara",
      borrower_contact: "cara@example.com",
      checked_out_at: expect.any(String),
    });
    expect(res.body[1].status).toBe("available");
    expect(res.body[2].loan).toBeNull();
  });
});
