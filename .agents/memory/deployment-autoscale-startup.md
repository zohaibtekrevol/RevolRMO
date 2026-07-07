---
name: Autoscale deploy promote/health-check fragility
description: Why deploy "build failed" can actually be a promote/health-check failure, and how prod DB schema drift fits in
---

# Autoscale publish failures: build vs promote vs schema drift

A Replit autoscale publish goes build → promote (health check `GET /` must return 200) → serve.
A publish can report "failed" even when the **build phase fully succeeds** (build logs end at
"Created Repl layer" with no error). In that case the failure is the **promote/health-check** step,
not the build.

**Rule:** before binding the HTTP port, the entrypoint must not `await` any DB/network work that can
hang or throw. A blocked pre-listen call means the port never binds, `GET /` never returns 200, and
promote fails. Bind first, then run non-critical startup maintenance in the background, each guarded
by try/catch.
**Why:** autoscale cold-starts are timed; one slow prod DB call before `listen()` fails the whole publish.
**How to apply:** keep route registration before `listen()` (routes must exist), but move idempotent
maintenance (role/permission seeding, one-time data fixes) to run from the `listen()` callback.

## Dev→prod DB schema drift is normal and is applied on re-publish
The production DB is frozen at the **last successful publish**. After that, dev-only schema changes
(via `db:push`, applied to dev on task merge) accumulate as drift. Replit applies the dev→prod diff
**during a successful publish** — so a publish that fails leaves prod on the old schema.
Symptom of drift hitting code: `column <table>.<col> does not exist` on the endpoints that query the
new columns (these are runtime errors, NOT health-check failures, since `GET /` is static).
**Fix path (do NOT write prod DDL / migration scripts / startup DDL / build-step db:push):** make the
schema change in the Drizzle source of truth, verify in dev, then **re-publish** so the publish flow
applies the diff to prod. See `.local/skills/database/references/database-migrations-on-publish.md`.
