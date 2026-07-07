---
name: Milestone / CR-installment payment aggregation
description: How milestone and change-request installment status must be derived from their linked payments (many-to-one).
---

# Milestone / CR-installment payment aggregation

A milestone (and a change-request installment) can be paid across MULTIPLE payments
(e.g. a 50/50 split). Its `receivedAmount` and `status` are **derived**, never set
from a single payment.

**The rule:** any code path that links/unlinks/creates/updates/deletes a payment
touching a `milestoneId` or `crInstallmentId` must call
`recomputeMilestoneFromPayments(id)` / `recomputeCrInstallmentFromPayments(id)`
(in `server/storage.ts`) for every affected target (both the old and the new one
when a payment moves between targets). Do NOT use the legacy single-payment helpers
(`updateMilestoneStatus`/`linkMilestoneToPayment`, `updateCrInstallmentStatus`/
`linkCrInstallmentToPayment`/`unlinkCrInstallment`) to set status — they assume one
payment == the whole target and corrupt split-payment aggregates.

The recompute sums `receivedAmount` (fallback `expectedAmount`) of all linked
payments with `status="received"`, applies a 0.005 rounding tolerance for "paid",
preserves `cancelled` (never resurrects it), and sets/clears the `paymentId`
back-reference and `paidDate`.

**Why:** before this, each flow synced status from a single payment, so a second
split payment overwrote the first, milestones flipped to paid prematurely, and the
Statement of Account ledger double-counted. The ledger already suppresses payments
linked to a paid milestone and renders `milestone.receivedAmount`, so it self-corrects
once the aggregate is right.

**How to apply:** when adding a new payment flow, recompute every affected target
from the full linked set instead of mutating target status directly.

**Statement of Account ledger:** a milestone/installment that is *fully paid* is the
canonical ledger line; all payments linked to it must be suppressed (else double-count).
Partially-paid targets are NOT aggregated — their payments show as individual rows until
fully paid. The linker UI's running total must count only `status==="received"` payments,
matching the backend recompute.
