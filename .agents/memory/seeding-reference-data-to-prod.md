---
name: Seeding reference data into production
description: How lookup/reference data (e.g. Designations + Grades) reliably reaches the prod DB on publish.
---

# Getting reference/lookup data into the production database

The prod DB is **read-only** to agent tooling (executeSql), so you cannot INSERT
into prod directly. The Publish UI's data sync is **wholesale** (replaces prod
data with dev data), which risks clobbering data already in prod.

**Decision:** seed reference/lookup data with an **idempotent startup seed** that
inserts rows ONLY when the target table is currently empty. Wire it into
`runStartupMaintenance()` in `server/index.ts` (runs after the port binds, inside
try/catch, never blocks the health check).

**Why:** seed-when-empty never overwrites admin edits made in prod, works in any
environment (dev, prod, fresh forks), and needs no prod write access from tooling.

**How to apply:**
- Export the current dev rows to a bundled JSON snapshot under `server/seed-data/`.
  **Import** the JSON (`await import(... , { with: { type: "json" } })`) rather than
  reading from disk — the prod build (`script/build.ts`, esbuild `bundle:true`)
  inlines the JSON into `dist/index.cjs`, avoiding cwd/path fragility.
- Preserve original IDs from the snapshot so child→parent FKs stay intact on a
  fresh DB.
- For child tables with an FK, do not blindly trust snapshot FK IDs: in a mixed
  state (parent table populated separately with different IDs, child empty) the
  snapshot IDs may not exist. Resolve the parent from the **current DB** — match
  by id, then fall back to a stable natural key (name/code), else null (if the FK
  is nullable). Wrap grade+band seeding in one `db.transaction`.
- After publish, the user must **re-publish** for the new startup code to run in
  prod.
