import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createTestEnv, createLegacyDb, seedLegacySampleData, TEST_PASSWORD, type TestEnv } from "./helpers.js";

const admin = () => ({ "x-admin-password": TEST_PASSWORD });

describe("borrowers API", () => {
  let env: TestEnv;
  beforeEach(() => {
    env = createTestEnv();
  });
  afterEach(() => env.cleanup());

  it("reuses an existing borrower case-insensitively and refreshes contact", async () => {
    const book1 = await request(env.app).post("/api/books").set(admin()).send({ title: "A" });
    const book2 = await request(env.app).post("/api/books").set(admin()).send({ title: "B" });

    await request(env.app)
      .post(`/api/books/${book1.body.id}/checkout`)
      .set(admin())
      .send({ borrower_name: "Alice", borrower_contact: "old@example.com" });
    await request(env.app)
      .post(`/api/books/${book2.body.id}/checkout`)
      .set(admin())
      .send({ borrower_name: "ALICE", borrower_contact: "new@example.com" });

    const res = await request(env.app).get("/api/borrowers").expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toEqual({
      id: expect.any(Number),
      name: "Alice",
      contact: "new@example.com",
      active_loans: 2,
      total_loans: 2,
    });
  });

  it("counts active vs total loans", async () => {
    const book = await request(env.app).post("/api/books").set(admin()).send({ title: "A" });
    await request(env.app)
      .post(`/api/books/${book.body.id}/checkout`)
      .set(admin())
      .send({ borrower_name: "Bob" });
    await request(env.app).post(`/api/books/${book.body.id}/checkin`).set(admin());
    await request(env.app)
      .post(`/api/books/${book.body.id}/checkout`)
      .set(admin())
      .send({ borrower_name: "Bob" });

    const res = await request(env.app).get("/api/borrowers").expect(200);
    expect(res.body[0].active_loans).toBe(1);
    expect(res.body[0].total_loans).toBe(2);
  });

  it("lists a borrower's loans newest first and 404s for unknown borrowers", async () => {
    const book = await request(env.app).post("/api/books").set(admin()).send({ title: "A" });
    await request(env.app)
      .post(`/api/books/${book.body.id}/checkout`)
      .set(admin())
      .send({ borrower_name: "Cara" });

    const borrowers = await request(env.app).get("/api/borrowers").expect(200);
    const loans = await request(env.app)
      .get(`/api/borrowers/${borrowers.body[0].id}/loans`)
      .expect(200);
    expect(loans.body).toHaveLength(1);
    expect(loans.body[0]).toEqual({
      id: expect.any(Number),
      book_id: book.body.id,
      book_title: "A",
      checked_out_at: expect.any(String),
      returned_at: null,
    });

    await request(env.app).get("/api/borrowers/9999/loans").expect(404);
  });

  it("serves borrowers backfilled by the migration from legacy data", async () => {
    const legacy = createLegacyDb();
    seedLegacySampleData(legacy);
    const legacyEnv = createTestEnv({ db: legacy });
    const res = await request(legacyEnv.app).get("/api/borrowers").expect(200);
    expect(res.body.map((b: any) => b.name)).toEqual(["ALICE", "Bob"]);
    const alice = res.body[0];
    expect(alice.total_loans).toBe(3);
    expect(alice.active_loans).toBe(0);
    legacyEnv.cleanup();
  });
});
