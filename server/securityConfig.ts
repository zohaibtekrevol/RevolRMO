// Single source of truth for rate-limit settings so the limiters in index.ts and
// the Security dashboard (routes.ts) never drift apart.
export const RATE_LIMIT_CONFIG = {
  // Stricter limit guarding auth/login routes against brute-force / OAuth abuse.
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30,
    paths: ["/api/login", "/api/callback", "/api/logout"],
  },
  // Broader limit protecting the rest of the API from runaway clients.
  api: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000,
    paths: ["/api"],
  },
} as const;
