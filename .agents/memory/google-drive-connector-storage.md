---
name: Google Drive connector storage
description: Durable rules for Drive-backed file storage in RevolRMO (auth, scope, folder provisioning, download authz).
---

# Google Drive file storage (RevolRMO)

Project files live in Google Drive (Replit `google-drive` connector), in a per-project
folder tree under a shared app root. Folder ids are cached per project so provisioning
runs only on the first upload.

**Connector binding needs BOTH `addIntegration` and `proposeIntegration`.**
- **Why:** without `proposeIntegration` (the Repl-side binding + user OAuth) the credential
  proxy returns nothing for this Repl even though account-level creds exist → runtime
  "not connected". `proposeIntegration` exits the agent loop, so call it last.
- **How to apply:** auth resolves a short-lived access token from the connectors proxy on
  every call — build a fresh Drive client each time, never cache the token/client.

**Scope is `drive.file` (app-created files only).**
- find-or-create-by-name only sees files THIS app made, so name lookups are safe from the
  user's unrelated files. Same-named projects still need a unique suffix (we add `[id8]`).

**Folder provisioning MUST be concurrency-safe and idempotent.**
- **Why:** Drive has no unique-name constraint; a plain list-then-create races under
  concurrent first uploads and silently creates duplicate folders (incl. the shared root).
- **How to apply:** serialize provisioning with a single global Postgres advisory lock
  (`pg_advisory_xact_lock` in a txn), then double-check the cache after acquiring it. One
  global lock (not per-project) is required because the shared root would otherwise be
  raced by two different projects provisioning at once. Provisioning is rare (cache miss
  only), so global serialization is cheap.

**File downloads must be keyed by a domain record, never a raw fileId.**
- **Why:** a route taking a client-supplied Drive fileId lets any authenticated user
  enumerate/stream arbitrary app-created files (broken object-level authorization).
- **How to apply:** resolve the Drive id server-side from the owning record (e.g. the
  change request) and check the caller's permission on that record before streaming.
