---
name: express-rate-limit with trust proxy true
description: Why express-rate-limit crashes on boot in this app and how it's configured.
---

This app sets `app.set("trust proxy", true)` (in `server/index.ts` and `server/googleAuth.ts setupAuth`) because its self-hosted/multi-hop proxy OAuth needs the full `X-Forwarded-*` chain — without it the secure session cookie is dropped and login breaks ("Unable to verify authorization request state").

`express-rate-limit` treats `trust proxy: true` as permissive and throws a `ValidationError` (`ERR_ERL_PERMISSIVE_TRUST_PROXY`) at request time, which surfaces in logs and breaks the limiter. Fix used: pass `validate: { trustProxy: false }` on each limiter to acknowledge the deliberate setting.

**Why:** the proxy-trust setting is load-bearing for auth and must not be changed to a CIDR/number casually — doing so risks breaking the deployed login flow. The bypass risk (spoofable `X-Forwarded-For`) is a known, accepted tradeoff for "basic" hardening; tightening proxy trust is tracked as a follow-up.

**How to apply:** when adding any IP-based middleware (rate limit, IP allowlist), don't fight `trust proxy: true` — configure the middleware to accept it, and verify login still works after changes.
