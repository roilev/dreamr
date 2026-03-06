import { customAlphabet } from "nanoid";

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const SHORT_ID_LENGTH = 10;

const nanoid = customAlphabet(ALPHABET, SHORT_ID_LENGTH);

export function generateShortId(): string {
  return nanoid();
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUUID(value: string): boolean {
  return UUID_RE.test(value);
}

/** Return the column name to query by: `id` for UUIDs, `short_id` otherwise. */
export function idColumn(value: string): "id" | "short_id" {
  return isUUID(value) ? "id" : "short_id";
}
