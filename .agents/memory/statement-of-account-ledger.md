---
name: Statement of Account is a payment ledger
description: Rules the Reports "Statement of Account" ledger must follow (payment-ledger semantics, installment expansion, no double counting).
---

The Reports → Statement of Account endpoint (`GET /api/reports/payments/ledger`) is a CLIENT PAYMENT LEDGER (charges + payments + running balance), not a general journal. Surfaces: on-screen table + PDF (`payment-statement-pdf.ts`) + CSV must stay coherent.

Rules to keep consistent on any change:
- **Drop empty rows:** never emit a line with both debit≈0 and credit≈0. These are placeholder/target rows and were the cause of the "Settled filter shows Not Invoiced" bug (0/0 satisfied debit-credit<=0).
- **Installment lines use the change-request name** (`cr.title`), never the internal installment name ("Installment X of Y").
- **Split payments are expanded, not aggregated:** a CR installment can be settled by several payments. Show EACH linked payment as its own row; emit the aggregate installment line ONLY when the installment has zero linked payments. Showing both = double counting.
- **Financial equivalence on expansion:** a paid-installment payment with 0 received → credit = expected (mirrors the old aggregate line's `received===0 ? expected` rule) so totals don't change when expanding.

**Why:** production financial statement shared with clients; double counting or empty/odd rows undermine trust and the numbers must reconcile across table/PDF/CSV.

**How to apply:** when touching ledger composition, keep the per-payment vs aggregate-fallback split, the 0/0 drop, and CR-title descriptions. The word "upsell" must never reach a client-facing line (always "Additional Services").
