---
name: Appraisal rollout undo
description: How an accidental appraisal rollout is reversed and why prior grade/band is snapshotted.
---

# Undo rollout

Rollout applies the appraisal's designation + assigned pay band to the employee (`users.gradeId`/`users.gradeBandId`) and locks the row as `rolled_out`. To make this reversible, rollout snapshots the employee's grade/band **before** overwriting them into `appraisals.priorGradeId`/`priorGradeBandId`.

Undo (`POST /api/kpi/appraisals/:id/undo-rollout`, manage_kpis) flips the row back to `finalized`, clears `finalVerdict`/`boardComment`/`rolledOutAt`/`rolledOutBy`/`priorGrade*`, and restores the employee's grade/band.

**Why the restore is conditional, not a blanket overwrite:** rollout only writes a user field when the appraisal actually carries it (`updated.gradeId` / `updated.assignedBandId`). Undo mirrors that same conditional — it restores `users.gradeId` only if `appraisal.gradeId` is set, and `users.gradeBandId` only if `appraisal.assignedBandId` is set — so it never clears a field the rollout never touched (e.g. ineligible/unsnapped rows).

**How to apply:** both rollout and undo are atomic-idempotent via a status-guarded UPDATE (only `finalized`→`rolled_out`, only `rolled_out`→`finalized`); a concurrent second request matches 0 rows and the route returns the current record. Keep the snapshot/restore field-set in lockstep with the rollout's applied field-set.
