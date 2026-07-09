import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createTestEnv, TEST_PASSWORD, type TestEnv } from "./helpers.js";

describe("checkout / checkin flow", () => {
  let env: TestEnv;
  let bookId: number;

  beforeEach(async () => {
    env = createTestEnv();
    const res = await request(env.app)
      .post("/api/books")
      .set("x-admin-password", TEST_PASSWORD)
      .send({ title: "The Hobbit", authors: "Tolkien" });
    bookId = res.body.id;
  });
  afterEach(() => env.cleanup());

  const admin = () => ({ "x-admin-password": TEST_PASSWORD });

  it("checks a book out and back in, updating status and the embedded loan", async () => {
    const out = await request(env.app)
      .post(`/api/books/${bookId}/checkout`)
      .set(admin())
      .send({ borrower_name: "Alice", borrower_contact: "alice@example.com" })
      .expect(200);
    expect(out.body.status).toBe("checked_out");
    expect(out.body.loan.borrower_name).toBe("Alice");
    expect(out.body.loan.borrower_contact).toBe("alice@example.com");
    expect(out.body.loan.checked_out_at).toBeTruthy();

    const back = await request(env.app)
      .post(`/api/books/${bookId}/checkin`)
      .set(admin())
      .expect(200);
    expect(back.body.status).toBe("available");
    expect(back.body.loan).toBeNull();
  });

  it("returns 409 on double checkout and on checking in an available book", async () => {
    await request(env.app)
      .post(`/api/books/${bookId}/checkout`)
      .set(admin())
      .send({ borrower_name: "Alice" })
      .expect(200);
    const dup = await request(env.app)
      .post(`/api/books/${bookId}/checkout`)
      .set(admin())
      .send({ borrower_name: "Bob" })
      .expect(409);
    expect(dup.body.error).toBe("Book is already checked out.");

    await request(env.app).post(`/api/books/${bookId}/checkin`).set(admin()).expect(200);
    const idle = await request(env.app)
      .post(`/api/books/${bookId}/checkin`)
      .set(admin())
      .expect(409);
    expect(idle.body.error).toBe("Book is not checked out.");
  });

  it("requires a borrower name and auth", async () => {
    const res = await request(env.app)
      .post(`/api/books/${bookId}/checkout`)
      .set(admin())
      .send({ borrower_name: "  " })
      .expect(400);
    expect(res.body.error).toBe("Borrower name is required.");
    await request(env.app)
      .post(`/api/books/${bookId}/checkout`)
      .send({ borrower_name: "Alice" })
      .expect(401);
  });

  it("lists active checkouts in the legacy flat shape", async () => {
    await request(env.app)
      .post(`/api/books/${bookId}/checkout`)
      .set(admin())
      .send({ borrower_name: "Alice", borrower_contact: "alice@example.com" })
      .expect(200);
    const res = await request(env.app).get("/api/checkouts").expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toEqual({
      borrower_name: "Alice",
      borrower_contact: "alice@example.com",
      checked_out_at: expect.any(String),
      book_id: bookId,
      title: "The Hobbit",
      authors: "Tolkien",
      cover_url: "",
    });
  });

  it("exposes per-book history newest first and keeps it after book deletion", async () => {
    await request(env.app)
      .post(`/api/books/${bookId}/checkout`)
      .set(admin())
      .send({ borrower_name: "Alice", borrower_contact: "alice@example.com" });
    await request(env.app).post(`/api/books/${bookId}/checkin`).set(admin());
    await request(env.app)
      .post(`/api/books/${bookId}/checkout`)
      .set(admin())
      .send({ borrower_name: "Bob" });

    const history = await request(env.app).get(`/api/books/${bookId}/history`).expect(200);
    expect(history.body).toHaveLength(2);
    expect(history.body[0].borrower_name).toBe("Bob");
    expect(history.body[0].returned_at).toBeNull();
    expect(history.body[1].borrower_name).toBe("Alice");
    expect(history.body[1].returned_at).toBeTruthy();
    expect(history.body[1]).toEqual({
      id: expect.any(Number),
      borrower_name: "Alice",
      borrower_contact: "alice@example.com",
      checked_out_at: expect.any(String),
      returned_at: expect.any(String),
    });

    // Delete the book: history survives, findable through the borrower.
    await request(env.app).delete(`/api/books/${bookId}`).set(admin()).expect(200);
    const borrowers = await request(env.app).get("/api/borrowers").expect(200);
    const bob = borrowers.body.find((b: any) => b.name === "Bob");
    const loans = await request(env.app).get(`/api/borrowers/${bob.id}/loans`).expect(200);
    expect(loans.body).toHaveLength(1);
    expect(loans.body[0].book_title).toBe("The Hobbit");
    expect(loans.body[0].book_id).toBeNull();
  });
});
