---
name: Appraisals two-level grade model
description: How Designation vs Grade are modeled in the appraisals module and the non-obvious constraints around them.
---

# Two-level grade model (Designation + Grade)

Appraisals use TWO levels:
- **Designation** = the `grades` table (name, code, targetScore, baseIncrementPct). Drives eligibility. Admin-managed (carries data not in the salary sheet).
- **Grade** = rows in `salaryGradeBands` (P-01…P-36), each linked to a designation via `designationId`. `salaryAmount` is the **Basic** salary; all other sheet columns (Fuel/Gross/PF/IPD/OPD/Vehicle/Package/Maternity…) live in a jsonb `details` object so any column set is preserved.

A user has BOTH `users.gradeId` (designation) and `users.gradeBandId` (grade). For an appraisal: current salary = the user's grade Basic; the new salary snaps ONLY to grades within the SAME designation during normal (non-override) generation.

**Exception — admin override modal:** the Override Appraisal modal's Assigned Grade dropdown intentionally lists bands starting at the employee's current band and continuing ascending ACROSS designations (not just the current one), since an admin override is a manual promotion decision, not the auto-generated snap. Keep this distinction if either path is touched again — auto-generate stays same-designation, manual override spans designations.

**Why no FK on `users.gradeBandId`:** `users` is defined *before* `salaryGradeBands` in `shared/schema.ts`, so a Drizzle `.references()` to it isn't possible without reordering. Integrity is instead enforced at the app layer: the user PATCH route validates `band.designationId === effectiveGradeId`, and the generate route treats a dangling/missing band id as "No grade assigned" rather than crashing.

# Grade-sheet import must be non-destructive on skips

The grade-sheet upload (`PUT /api/kpi/grade-bands`) matches each row's Designation **by name** to an existing designation; unmatched rows are returned in `skipped` and NOT saved. `replaceSalaryGradeBands` is a smart upsert keyed by `(designationId::gradeCode)` that preserves existing band ids.

**Rule:** deletion during the upsert is scoped to only the designations actually present in the incoming upload. **Why:** without scoping, a typo'd/blank designation that skips rows would make the replace delete every existing grade (potentially all of them), orphaning users' assignments. A fully-skipped upload must delete nothing, and uploading one designation's sheet must never wipe another's grades.

**How to apply:** if you ever change the import/replace logic, keep the "prune only within incoming designations" guard, and keep the `{bands, skipped}` response shape (the frontend reads `skipped` to warn the user and re-queries for the table).

# Cross-designation manual override: client AND server must agree on the candidate list

The ascending, cross-designation candidate list used to populate the Override modal's dropdown (see above) must be the SAME list the server uses to validate/resolve `assignedBandId`, or two failure modes appear: (a) picking a genuinely valid cross-designation band from the dropdown gets rejected server-side as "Band not found" because the route only checked same-designation bands; (b) editing only Base%/HP% while a prior cross-designation manual pick is in effect silently wipes that pick to null, because the "keep existing override" code path also only searched same-designation bands.

**Why:** it's tempting to only fix the validation path for an explicit `assignedBandId` in the request body and forget the "no assignedBandId in body, but `bandOverridden` is already true" path also needs the full candidate list (it looks up the *existing* band, which may itself be cross-designation).

**How to apply:** extract the candidate-list builder into a shared module (`shared/appraisalGrades.ts`) importable by both client and server, and treat "manual band decision" as: explicit assignedBandId present in the request, OR the appraisal already has `bandOverridden = true` (even with no assignedBandId in this particular request). Only fall back to same-designation bands for pure never-overridden auto-snap.

# Two-way live preview needs an explicit "last touched" driver, not a sticky ref

A naive two-way sync between percent inputs (Base%/HP%/Salary) and a manually-picked grade dropdown — implemented as "auto-select nearest band unless the user already picked one" — breaks the "last change wins" requirement: once the user manually picks a band, that pick permanently blocks the auto nearest-band effect from ever running again, even if they go back and edit the percent inputs.

**Why:** a boolean/sticky-ref "has the user manually overridden" flag can only ever move one direction (auto → manual); it has no path back to "auto" except explicitly re-selecting "Auto" in the dropdown.

**How to apply:** model it as `driver: "percent" | "band"` instead. Any percent/salary input's onChange sets `driver = "percent"`; the dropdown's onChange (to a specific grade) sets `driver = "band"`; choosing "Auto" in the dropdown resets to `driver = "percent"` and clears the manual pick. The preview always derives from whichever driver is currently active. This generalizes to any pair of controls that are meant to be a coherent two-way live preview.
