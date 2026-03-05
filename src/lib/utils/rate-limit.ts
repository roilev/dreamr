import { NextResponse } from "next/server";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

if (typeof globalThis !== "undefined") {
  const interval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) store.delete(key);
    }
  }, 60_000);

  if (typeof interval === "object" && "unref" in interval) {
    interval.unref();
  }
}

interface RateLimitOptions {
  windowMs?: number;
  max?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function rateLimit(
  key: string,
  options: RateLimitOptions = {},
): RateLimitResult {
  const { windowMs = 60_000, max = 60 } = options;
  const now = Date.now();

  let entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs };
    store.set(key, entry);
  }

  entry.count++;

  return {
    allowed: entry.count <= max,
    remaining: Math.max(0, max - entry.count),
    resetAt: entry.resetAt,
  };
}

export function rateLimitByIP(
  request: Request,
  options?: RateLimitOptions,
): RateLimitResult {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0] ??
    request.headers.get("x-real-ip") ??
    "unknown";
  return rateLimit(`ip:${ip}`, options);
}

export function rateLimitResponse(result: RateLimitResult): NextResponse | null {
  if (result.allowed) return null;

  return NextResponse.json(
    { error: "Too many requests" },
    {
      status: 429,
      headers: {
        "Retry-After": String(
          Math.ceil((result.resetAt - Date.now()) / 1000),
        ),
        "X-RateLimit-Remaining": String(result.remaining),
      },
    },
  );
}
