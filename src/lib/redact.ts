import type { Json } from "@/lib/db/database.types";

/**
 * Keys that must never reach the audit trail, matched case-insensitively as
 * substrings so variants like `accessToken` and `X-Api-Key` are caught too.
 */
const FORBIDDEN_METADATA_KEYS = [
  "password",
  "token",
  "secret",
  "key",
  "auth",
  "cookie",
  "session",
  "credential",
];

const MAX_STRING_LENGTH = 200;
const MAX_ARRAY_LENGTH = 20;

/**
 * Strips anything sensitive and caps the size of a metadata payload, so the
 * audit trail can never become a secondary store of credentials or bulk
 * personal data.
 *
 * Nested objects are dropped rather than serialised: an unbounded payload is
 * exactly how personal data leaks into logs by accident.
 */
export function sanitizeMetadata(metadata: Record<string, unknown>): Record<string, Json> {
  const safe: Record<string, Json> = {};

  for (const [key, value] of Object.entries(metadata)) {
    const lowered = key.toLowerCase();
    if (FORBIDDEN_METADATA_KEYS.some((forbidden) => lowered.includes(forbidden))) {
      continue;
    }

    if (value === null || value === undefined) continue;

    if (typeof value === "string") {
      safe[key] =
        value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH - 3)}…` : value;
    } else if (typeof value === "number" || typeof value === "boolean") {
      safe[key] = value;
    } else if (Array.isArray(value)) {
      safe[key] = value.slice(0, MAX_ARRAY_LENGTH).map((item) => String(item).slice(0, 100));
    }
  }

  return safe;
}
