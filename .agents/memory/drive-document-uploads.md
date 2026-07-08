---
name: Drive document upload policy
description: How invoice/receipt PDFs get auto-saved to Google Drive, and the idempotency/backfill tradeoffs.
---

# Drive document upload policy

Invoice and payment-receipt PDFs are auto-saved to each project's Drive subfolders
(fail-soft, fire-and-forget) by `server/googleDrive/documentUploads.ts`. Uploads are
**idempotent by filename**: `uploadFileIfAbsent` lists the target folder and skips if a
file with the same name already exists.

**Why:** users clicking "Generate Invoice" / re-marking payments received must not pile
up duplicate Drive files. Also, the `/api/invoices/from-payment` route returns early when
an invoice already exists for a payment — so it now ALSO fires the invoice upload in that
early-return branch to backfill copies for invoices created before Drive auto-upload
existed (or whose earlier upload failed).

**How to apply / gotchas:**
- Skip-if-exists means regenerating the SAME invoice number will NOT replace the Drive
  copy — the old file is silently kept. If a "replace/version on regenerate" policy is
  ever wanted, change `uploadFileIfAbsent` (delete-then-upload or versioned name).
- Filename check is not race-safe (TOCTOU): two simultaneous requests can both upload.
  Unlikely in normal use; only matters if strict single-copy guarantees are required.
- Receipts upload on every payment→received path; invoices upload on creation AND on the
  from-payment existing-invoice branch. Both rely on `getOrCreateProjectFolders`.
