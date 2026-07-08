---
name: CR / sold-upsell shared edit route
description: change_requests is the single source of truth for both CRs and "sold upsells"; one PATCH route serves two frontend edit surfaces.
---

`PATCH /api/change-requests/:id` is the single backend route used by BOTH the
project workspace CR edit dialog (project-workspace-panel.tsx) AND the Upsell
module's "Edit Sold Upsell" dialog (upsells.tsx). A "sold upsell" is just a
locked change_request (it has dateLocked); there is no separate table.

**Why:** When adding any new editable field to change requests, the backend
change lives in ONE place, but the frontend must be wired in TWO places (both
dialogs), plus any list-row display in both project-workspace and the upsells
sold table. Missing one surface looks like "the field saves in projects but not
in upsells" (or vice-versa).

**How to apply:**
- Fields not part of insert/update zod schemas (e.g. `tagIds` for CR tags) must
  be pulled off `req.body` BEFORE `safeParse` strips unknown keys, then synced
  separately after the row write.
- The create path for CRs is `POST /api/projects/:id/change-requests`. The
  upsells page's "create" button hits `POST /api/upsells` — a DIFFERENT table
  (pipeline upsells), NOT a change_request. Don't conflate them.
