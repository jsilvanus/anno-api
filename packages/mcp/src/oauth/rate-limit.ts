/**
 * Fixed-window, in-memory rate limiter keyed by client (IP address).
 * Enough for a single-process server; use a shared store when scaling out.
 */
export class RateLimiter {
  private readonly hits = new Map<string, { count: number; reset: number }>();

  constructor(private readonly options: { limit: number; windowMs: number }) {}

  /** Whether the key may still make an attempt. */
  allow(key: string, now = Date.now()): boolean {
    const entry = this.hits.get(key);
    return !entry || entry.reset <= now || entry.count < this.options.limit;
  }

  /** Record one attempt (a failed login, a registration). */
  hit(key: string, now = Date.now()): void {
    const entry = this.hits.get(key);
    if (!entry || entry.reset <= now) {
      this.hits.set(key, { count: 1, reset: now + this.options.windowMs });
      if (this.hits.size > 10_000) this.prune(now);
    } else {
      entry.count++;
    }
  }

  private prune(now: number): void {
    for (const [key, entry] of this.hits) if (entry.reset <= now) this.hits.delete(key);
  }
}
