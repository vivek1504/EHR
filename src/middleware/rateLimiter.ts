import type { Context, Next } from "hono";

const WINDOW_MS = 60000;
const MAX_REQUESTS = 100;

const requests = new Map<
  string,
  {
    count: number;
    resetAt: number;
  }
>();

export async function rateLimiter(c: Context, next: Next) {
  const key =
    (c.get("userId") as string | undefined) ??
    c.req.header("X-Forwarded-For") ??
    "anonymous";

  const now = Date.now();

  const entry = requests.get(key);

  if (!entry || now > entry.resetAt) {
    requests.set(key, { count: 1, resetAt: now + WINDOW_MS });
  } else if (entry.count >= MAX_REQUESTS) {
    c.header("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
    return c.json({ error: "Rate limit exceeded" }, 429);
  } else {
    entry.count++;
  }
  return next();
}
