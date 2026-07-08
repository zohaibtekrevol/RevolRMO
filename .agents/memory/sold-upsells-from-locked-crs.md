---
name: Sold upsells are derived from locked change requests
description: Upsell module design — sold/completed upsells are a read-only projection of locked CRs, not a separate table.
---

Schema changes in this repo are applied via `drizzle-kit push` (`npm run db:push`),
NOT committed SQL migration files — there is no `migrations/` dir and no
`db:generate` script. Adding columns means edit `shared/schema.ts` then push.

Sold/completed upsells in the Upsell Planning module are NOT stored separately.
They are a read-only projection of `change_requests` where `dateLocked IS NOT NULL`,
enriched with project, PM, installments, and received amount.

**Why:** A locked CR *is* the sold upsell — duplicating it into the `upsells`
table (which holds pipeline opportunities only) would create two sources of truth
that drift apart and double-count revenue.

**How to apply:**
- The Upsells page has two tabs: Pipeline (from `upsells` table) and Sold Upsells
  (from locked CRs via `GET /api/sold-upsells` → `getSoldUpsells`).
- CR enrichment fields (category, whatWasSold, attachmentPath, attachmentName,
  pandadocLink, outcome) live on `change_requests`. Category references the
  admin-editable `upsell_type_settings.name` (shared with pipeline upsellType).
- File attachments use the object-storage flow; `attachmentPath` must always be
  the canonical `/objects/...` path (server rejects non-`/objects/` paths on CR
  create/update). Never persist raw GCS/signed URLs.
- Object serving (`/objects/:objectPath`) is `isAuthenticated` only — matches the
  app's flat access model where all staff already see all CR/financial data.
- Do not change installment/payment recompute logic when touching this area.
