import { z } from "zod";

// Cover uploads arrive base64-encoded, which inflates size ~4/3. A 5MB image
// is ~6.7MB of base64; cap the string a bit above that to fail fast, and let
// decodeCoverUpload enforce the exact decoded-byte limit.
const coverData = z.string().max(7 * 1024 * 1024, "Cover photo is too large. Try a smaller photo.");

const optionalText = z
  .union([z.string(), z.number()])
  .transform((v) => String(v))
  .optional();

const tags = z
  .union([z.array(z.union([z.string(), z.number()])), z.string()])
  .optional();

export const bookCreateSchema = z.object({
  title: z
    .string({ message: "Title is required." })
    .transform((s) => s.trim())
    .refine((s) => s.length > 0, { message: "Title is required." }),
  authors: optionalText,
  isbn: optionalText,
  publisher: optionalText,
  published_year: optionalText,
  cover_url: optionalText,
  genre: optionalText,
  tags,
  location: optionalText,
  notes: optionalText,
  cover_data: coverData.optional(),
});

export const bookUpdateSchema = bookCreateSchema.partial();

export const holdRequestSchema = z.object({
  name: z
    .string({ message: "Name is required." })
    .transform((s) => s.trim())
    .refine((s) => s.length > 0, { message: "Name is required." }),
  contact: optionalText,
});

export const checkoutSchema = z.object({
  borrower_name: z
    .string({ message: "Borrower name is required." })
    .transform((s) => s.trim())
    .refine((s) => s.length > 0, { message: "Borrower name is required." }),
  borrower_contact: optionalText,
});

export type BookCreateBody = z.infer<typeof bookCreateSchema>;
export type BookUpdateBody = z.infer<typeof bookUpdateSchema>;
export type CheckoutBody = z.infer<typeof checkoutSchema>;
export type HoldRequestBody = z.infer<typeof holdRequestSchema>;

/** Comma-joined storage format, same normalization the legacy server used. */
export function normalizeTags(t: BookCreateBody["tags"]): string {
  if (Array.isArray(t)) {
    return t.map((v) => String(v).trim()).filter(Boolean).join(",");
  }
  return String(t ?? "").trim();
}

/**
 * Loose ISBN-10/13 shape check. Invalid ISBNs are accepted (people type all
 * sorts of things for old books) — callers just log a warning.
 */
export function isbnLooksValid(isbn: string): boolean {
  const clean = isbn.replace(/[-\s]/g, "");
  return /^(\d{9}[\dXx]|\d{13})$/.test(clean);
}
