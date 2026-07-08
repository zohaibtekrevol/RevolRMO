import { test } from "node:test";
import assert from "node:assert/strict";
import {
  snapToBand,
  computeServedMonths,
  computeAppraisal,
  recomputeOverride,
  averageWindowEfficiency,
  calculateKpiScore,
  computePmAverageScore,
  AppraisalOverrideError,
  type SalaryBand,
  type Grade,
  type MonthScore,
  type PmAverageContext,
} from "./appraisalMath";

// A grade with target score 80, 5% base increment. Helpers below override.
function makeGrade(overrides: Partial<Grade> = {}): Grade {
  return {
    id: "grade-1",
    name: "G1",
    targetScore: "80",
    baseIncrementPct: "5",
    ...overrides,
  };
}

const BANDS: SalaryBand[] = [
  { id: "b-9000", salaryAmount: "9000" },
  { id: "b-10000", salaryAmount: "10000" },
  { id: "b-11000", salaryAmount: "11000" },
];

// ===== Eligibility =====

test("ineligible: less than 1 year of service", () => {
  const r = computeAppraisal({
    averageScore: 95,
    servedMonths: 11,
    grade: makeGrade(),
    currentSalary: 10000,
    bands: BANDS,
  });
  assert.equal(r.eligible, false);
  assert.ok(r.reasons.some((m) => m.includes("Less than 1 year service (11 mo)")));
  // No salary math should run for an ineligible PM.
  assert.equal(r.rawNewSalary, null);
  assert.equal(r.assignedSalary, null);
  assert.equal(r.finalIncrement, null);
});

test("ineligible: no joining date set (null service)", () => {
  const r = computeAppraisal({
    averageScore: 95,
    servedMonths: null,
    grade: makeGrade(),
    currentSalary: 10000,
    bands: BANDS,
  });
  assert.equal(r.eligible, false);
  assert.ok(r.reasons.some((m) => m.includes("No joining date set")));
});

test("ineligible: no designation assigned", () => {
  const r = computeAppraisal({
    averageScore: 95,
    servedMonths: 24,
    grade: null,
    currentSalary: 10000,
    bands: BANDS,
  });
  assert.equal(r.eligible, false);
  assert.equal(r.targetScore, null);
  assert.ok(r.reasons.some((m) => m.includes("No designation assigned")));
});

test("ineligible: no grade (pay band) assigned", () => {
  const r = computeAppraisal({
    averageScore: 95,
    servedMonths: 24,
    grade: makeGrade({ targetScore: "80" }),
    currentSalary: 0,
    bands: BANDS,
    hasGradeBand: false,
  });
  assert.equal(r.eligible, false);
  assert.ok(r.reasons.some((m) => m.includes("No grade assigned")));
  assert.equal(r.assignedSalary, null);
});

test("ineligible: average score equal to target (must be strictly above)", () => {
  const r = computeAppraisal({
    averageScore: 80,
    servedMonths: 24,
    grade: makeGrade({ targetScore: "80" }),
    currentSalary: 10000,
    bands: BANDS,
  });
  assert.equal(r.eligible, false);
  assert.ok(r.reasons.some((m) => m.includes("not above target")));
});

test("eligible: average score above target with full service and a grade", () => {
  const r = computeAppraisal({
    averageScore: 80.1,
    servedMonths: 12,
    grade: makeGrade({ targetScore: "80" }),
    currentSalary: 10000,
    bands: [],
  });
  assert.equal(r.eligible, true);
  assert.equal(r.reasons.length, 0);
});

// ===== HP% formula, factor and raw new salary =====

test("HP% formula: (avg/target - 1) * 100", () => {
  // avg 100, target 80 => 100/80 - 1 = 0.25 => 25% HP.
  const r = computeAppraisal({
    averageScore: 100,
    servedMonths: 24,
    grade: makeGrade({ targetScore: "80", baseIncrementPct: "5" }),
    currentSalary: 10000,
    bands: [], // no bands -> raw salary used directly
  });
  assert.equal(r.eligible, true);
  assert.equal(r.baseIncrementPct, 5);
  assert.equal(r.hpPct, 25);
  // factor = 5 + 25 = 30% => 10000 * 1.30 = 13000.
  assert.equal(r.rawNewSalary, 13000);
  // No band list -> assigned equals raw, increment = 3000.
  assert.equal(r.assignedSalary, 13000);
  assert.equal(r.finalIncrement, 3000);
});

test("HP% is 0 when target score is 0", () => {
  const r = computeAppraisal({
    averageScore: 50,
    servedMonths: 24,
    grade: makeGrade({ targetScore: "0", baseIncrementPct: "10" }),
    currentSalary: 10000,
    bands: [],
  });
  // target 0 -> meetsScore is 50 > 0 -> eligible; HP guarded to 0.
  assert.equal(r.eligible, true);
  assert.equal(r.hpPct, 0);
  // factor = base only = 10% => 11000.
  assert.equal(r.rawNewSalary, 11000);
});

// ===== Band snapping =====

test("snapToBand: smaller absolute difference wins", () => {
  const band = snapToBand(10400, BANDS);
  assert.equal(band?.id, "b-10000"); // 400 away vs 600 away from 11000
});

test("snapToBand: exact tie picks the higher (ceiling) band", () => {
  // 10500 is 500 from both 10000 and 11000 -> higher wins.
  const band = snapToBand(10500, BANDS);
  assert.equal(band?.id, "b-11000");
});

test("snapToBand: empty band list returns null", () => {
  assert.equal(snapToBand(10000, []), null);
});

test("computeAppraisal snaps the raw salary to the nearest band", () => {
  // avg 84, target 80 => HP 5%, base 5% => factor 10% => 10000 * 1.10 = 11000.
  const r = computeAppraisal({
    averageScore: 84,
    servedMonths: 24,
    grade: makeGrade({ targetScore: "80", baseIncrementPct: "5" }),
    currentSalary: 10000,
    bands: BANDS,
  });
  assert.equal(r.rawNewSalary, 11000);
  assert.equal(r.assignedBandId, "b-11000");
  assert.equal(r.assignedSalary, 11000);
  assert.equal(r.finalIncrement, 1000);
});

// ===== computeServedMonths =====

test("computeServedMonths: returns null without a joining date", () => {
  assert.equal(computeServedMonths(null, 6, 2026), null);
  assert.equal(computeServedMonths(undefined, 6, 2026), null);
});

test("computeServedMonths: returns null for an invalid date", () => {
  assert.equal(computeServedMonths("not-a-date", 6, 2026), null);
});

test("computeServedMonths: partial final month counts when day reached", () => {
  // Joined Jan 10 2025, period ends June 2026 (last day June 30 >= 10).
  // (2026-2025)*12 + (6-1-0) = 12 + 5 = 17.
  assert.equal(computeServedMonths("2025-01-10", 6, 2026), 17);
});

test("computeServedMonths: partial final month dropped when day not reached", () => {
  // Joined July 15 2025, period ends June 2026 (June 30 < 15? no, 30 >= 15).
  // Use a joining day past the period-end's last day is impossible, so test the
  // subtract branch with a February period end (28 days) and joining day 29.
  // (2026-2025)*12 + (2-1-0) = 12 + 1 = 13, then -1 because 28 < 29 => 12.
  assert.equal(computeServedMonths("2025-01-29", 2, 2026), 12);
});

test("computeServedMonths: never returns negative", () => {
  // Joined after the period end.
  assert.equal(computeServedMonths("2030-01-01", 6, 2026), 0);
});

// ===== Override recompute =====

function makeExisting(overrides: Partial<Parameters<typeof recomputeOverride>[0]> = {}) {
  return {
    baseIncrementPct: "5",
    hpPct: "10",
    currentSalary: "10000",
    bandOverridden: false,
    assignedBandId: null,
    ...overrides,
  };
}

test("override base increment %: recomputes raw salary and snaps", () => {
  const u = recomputeOverride(makeExisting(), { baseIncrementPct: "10" }, BANDS);
  assert.equal(u.baseIncrementPct, "10.00");
  assert.equal(u.baseOverridden, true);
  // factor = 10 (new base) + 10 (existing hp) = 20% => 12000, nearest band 11000.
  assert.equal(u.rawNewSalary, "12000.00");
  assert.equal(u.assignedBandId, "b-11000");
  assert.equal(u.assignedSalary, "11000.00");
  assert.equal(u.finalIncrement, "1000.00");
});

test("override HP %: recomputes from existing base and salary", () => {
  const u = recomputeOverride(makeExisting(), { hpPct: "0" }, []);
  assert.equal(u.hpPct, "0.00");
  assert.equal(u.hpOverridden, true);
  // factor = 5 (base) + 0 (new hp) = 5% => 10500, no bands -> raw used.
  assert.equal(u.rawNewSalary, "10500.00");
  assert.equal(u.assignedSalary, "10500.00");
  assert.equal(u.finalIncrement, "500.00");
});

test("override current salary: recomputes increment off the new base salary", () => {
  const u = recomputeOverride(makeExisting(), { currentSalary: "20000" }, []);
  assert.equal(u.currentSalary, "20000.00");
  assert.equal(u.salaryOverridden, true);
  // factor = 5 + 10 = 15% => 20000 * 1.15 = 23000.
  assert.equal(u.rawNewSalary, "23000.00");
  assert.equal(u.finalIncrement, "3000.00");
});

test("override band: explicit band id forces that band and marks overridden", () => {
  const u = recomputeOverride(makeExisting(), { assignedBandId: "b-9000" }, BANDS);
  assert.equal(u.assignedBandId, "b-9000");
  assert.equal(u.bandOverridden, true);
  assert.equal(u.assignedSalary, "9000.00");
  // raw = 5+10=15% => 11500, but explicit band 9000 wins; increment negative.
  assert.equal(u.finalIncrement, "-1000.00");
});

test("override band: clearing band re-snaps automatically", () => {
  const u = recomputeOverride(
    makeExisting({ bandOverridden: true, assignedBandId: "b-9000" }),
    { assignedBandId: "" },
    BANDS,
  );
  assert.equal(u.bandOverridden, false);
  // raw = 11500 -> nearest band 11000 (500 vs 11000) ties? 11500 is 500 from 11000
  // and 1500 from 10000 -> 11000 wins.
  assert.equal(u.assignedBandId, "b-11000");
  assert.equal(u.assignedSalary, "11000.00");
});

test("override band: existing manual band is kept when not overridden in request", () => {
  const u = recomputeOverride(
    makeExisting({ bandOverridden: true, assignedBandId: "b-9000" }),
    { hpPct: "0" },
    BANDS,
  );
  // Band not part of the request, but it was manually chosen before -> keep it.
  assert.equal(u.assignedBandId, "b-9000");
  assert.equal(u.assignedSalary, "9000.00");
});

test("override rejects non-numeric input with AppraisalOverrideError", () => {
  assert.throws(
    () => recomputeOverride(makeExisting(), { baseIncrementPct: "abc" }, BANDS),
    (err: unknown) =>
      err instanceof AppraisalOverrideError && /Invalid base increment %/.test((err as Error).message),
  );
});

test("override rejects negative current salary", () => {
  assert.throws(
    () => recomputeOverride(makeExisting(), { currentSalary: "-1" }, BANDS),
    (err: unknown) =>
      err instanceof AppraisalOverrideError &&
      /Current salary cannot be negative/.test((err as Error).message),
  );
});

test("override rejects an unknown band id", () => {
  assert.throws(
    () => recomputeOverride(makeExisting(), { assignedBandId: "nope" }, BANDS),
    (err: unknown) =>
      err instanceof AppraisalOverrideError && /Band not found/.test((err as Error).message),
  );
});

// ===== averageWindowEfficiency: appraisal-period averaging =====

// A 12-month appraisal window ending June 2026 (i.e. July 2025 -> June 2026).
function julyToJuneWindow(): { month: number; year: number }[] {
  const window: { month: number; year: number }[] = [];
  let m = 6, y = 2026;
  for (let i = 0; i < 12; i++) {
    window.push({ month: m, year: y });
    m -= 1;
    if (m < 1) { m = 12; y -= 1; }
  }
  return window;
}

test("averageWindowEfficiency: averages only months that have data", () => {
  // totalWeightage 100, so efficiency == totalScore. Data only in Jan-Jun 2026.
  const scores = new Map<string, MonthScore>([
    ["2026-1", { totalScore: 60, hasData: true }],
    ["2026-2", { totalScore: 60, hasData: true }],
    ["2026-3", { totalScore: 90, hasData: true }],
    ["2026-4", { totalScore: 90, hasData: true }],
    ["2026-5", { totalScore: 90, hasData: true }],
    ["2026-6", { totalScore: 90, hasData: true }],
  ]);
  const r = averageWindowEfficiency(julyToJuneWindow(), scores, 100);
  assert.equal(r.monthsCounted, 6);
  // (60+60+90+90+90+90)/6 = 80
  assert.equal(r.averageScore, 80);
});

test("averageWindowEfficiency: a past month inside the window counts once it has a score", () => {
  const before = new Map<string, MonthScore>([
    ["2026-1", { totalScore: 60, hasData: true }],
    ["2026-2", { totalScore: 90, hasData: true }],
  ]);
  const rBefore = averageWindowEfficiency(julyToJuneWindow(), before, 100);
  assert.equal(rBefore.monthsCounted, 2);
  assert.equal(rBefore.averageScore, 75); // (60+90)/2

  // Admin later enters a score for July 2025 (a previously-empty past month that
  // is still inside the appraisal window) and regenerates. It must now count.
  const after = new Map(before);
  after.set("2025-7", { totalScore: 30, hasData: true });
  const rAfter = averageWindowEfficiency(julyToJuneWindow(), after, 100);
  assert.equal(rAfter.monthsCounted, 3);
  assert.equal(rAfter.averageScore, 60); // (60+90+30)/3
});

test("averageWindowEfficiency: months outside the window are ignored", () => {
  // June 2025 is just before the July 2025 -> June 2026 window starts.
  const scores = new Map<string, MonthScore>([
    ["2025-6", { totalScore: 0, hasData: true }], // outside window, must not count
    ["2026-6", { totalScore: 80, hasData: true }],
  ]);
  const r = averageWindowEfficiency(julyToJuneWindow(), scores, 100);
  assert.equal(r.monthsCounted, 1);
  assert.equal(r.averageScore, 80);
});

test("averageWindowEfficiency: no data anywhere yields zero and counts nothing", () => {
  const r = averageWindowEfficiency(julyToJuneWindow(), new Map(), 100);
  assert.equal(r.monthsCounted, 0);
  assert.equal(r.averageScore, 0);
});

test("averageWindowEfficiency: efficiency scales by total weightage", () => {
  // totalScore 40 against weightage 50 => 80% efficiency.
  const scores = new Map<string, MonthScore>([
    ["2026-6", { totalScore: 40, hasData: true }],
  ]);
  const r = averageWindowEfficiency(julyToJuneWindow(), scores, 50);
  assert.equal(r.monthsCounted, 1);
  assert.equal(r.averageScore, 80);
});

// ===== computePmAverageScore + computeAppraisal: full generation glue =====
//
// These exercise the same wiring the POST /api/kpi/appraisals/generate endpoint
// runs: per-PM reviews + grace scores + auto-calculated target params are fed
// month-by-month into averageWindowEfficiency, and the resulting average flows
// into computeAppraisal to decide eligibility and the new salary. The route only
// loads this data from storage; the arithmetic under test is identical.

type LevelScore = { parameterId: string; levelId: string; value: string; scorePercentage: string };

const KPI_LEVEL = { id: "lvl-1", name: "L1" };

// A single quality parameter weighted 100, so a month's efficiency equals the
// configured scorePercentage of the chosen rating (e.g. "Good" -> 80%).
const QUALITY_PARAM = { id: "p-quality", weightage: "100", isInverse: false };
const QUALITY_LEVEL_SCORES: LevelScore[] = [
  { parameterId: "p-quality", levelId: "lvl-1", value: "Excellent", scorePercentage: "100" },
  { parameterId: "p-quality", levelId: "lvl-1", value: "Good", scorePercentage: "80" },
  { parameterId: "p-quality", levelId: "lvl-1", value: "Average", scorePercentage: "60" },
  { parameterId: "p-quality", levelId: "lvl-1", value: "Poor", scorePercentage: "30" },
];

function qualityCtx(
  reviews: { month: number; year: number; value: string }[],
  grace: { month: number; year: number; points: string }[] = [],
): PmAverageContext {
  return {
    parameters: [QUALITY_PARAM],
    autoCalcParams: [],
    allLevels: [KPI_LEVEL],
    levelScores: QUALITY_LEVEL_SCORES,
    totalWeightage: 100,
    pmLevelId: "lvl-1",
    reviews: reviews.map((r) => ({ ...r, parameterId: "p-quality" })),
    grace,
    paymentsByKey: new Map(),
    targetsByKey: new Map(),
  };
}

// Sanity check that the score mapping wiring produces the expected per-rating %.
test("calculateKpiScore: maps a rating to its weighted score", () => {
  assert.equal(
    calculateKpiScore("p-quality", "Good", "lvl-1", [QUALITY_PARAM], [KPI_LEVEL], QUALITY_LEVEL_SCORES),
    80,
  );
  assert.equal(
    calculateKpiScore("p-quality", "Poor", "lvl-1", [QUALITY_PARAM], [KPI_LEVEL], QUALITY_LEVEL_SCORES),
    30,
  );
});

test("generate glue: averages every in-window month and ignores months outside the window", () => {
  const ctx = qualityCtx([
    // In-window months (July 2025 -> June 2026).
    { month: 1, year: 2026, value: "Good" }, // 80
    { month: 6, year: 2026, value: "Excellent" }, // 100
    // Out-of-window months must never count.
    { month: 6, year: 2025, value: "Poor" }, // June 2025, just before the window
    { month: 12, year: 2024, value: "Poor" }, // long before the window
  ]);
  const r = computePmAverageScore("pm-1", julyToJuneWindow(), ctx);
  assert.equal(r.monthsCounted, 2);
  assert.equal(r.averageScore, 90); // (80 + 100) / 2
});

test("generate glue end-to-end: entering a low past-month score lowers the average and flips eligibility", () => {
  const grade = makeGrade({ targetScore: "80", baseIncrementPct: "5" });
  const window = julyToJuneWindow();

  // Before: only two strong in-window months are scored -> average 90.
  const before = computePmAverageScore(
    "pm-1",
    window,
    qualityCtx([
      { month: 1, year: 2026, value: "Good" }, // 80
      { month: 6, year: 2026, value: "Excellent" }, // 100
    ]),
  );
  assert.equal(before.monthsCounted, 2);
  assert.equal(before.averageScore, 90);

  const apprBefore = computeAppraisal({
    averageScore: before.averageScore,
    servedMonths: 24,
    grade,
    currentSalary: 10000,
    bands: [],
  });
  assert.equal(apprBefore.eligible, true); // 90 > target 80

  // Admin later enters a score for July 2025 — a previously-empty past month that
  // is still inside the appraisal window. It must now be included in the average.
  const after = computePmAverageScore(
    "pm-1",
    window,
    qualityCtx([
      { month: 7, year: 2025, value: "Poor" }, // 30, the newly-entered past month
      { month: 1, year: 2026, value: "Good" }, // 80
      { month: 6, year: 2026, value: "Excellent" }, // 100
    ]),
  );
  assert.equal(after.monthsCounted, 3);
  assert.equal(after.averageScore, 70); // (30 + 80 + 100) / 3

  const apprAfter = computeAppraisal({
    averageScore: after.averageScore,
    servedMonths: 24,
    grade,
    currentSalary: 10000,
    bands: [],
  });
  assert.equal(apprAfter.eligible, false); // 70 is no longer above target 80
  assert.ok(apprAfter.reasons.some((m) => m.includes("not above target")));
});

test("generate glue: grace points make an otherwise-empty month count and adjust its score", () => {
  // No reviews at all; a single grace entry inside the window gives that month
  // data so it is averaged in.
  const ctx = qualityCtx(
    [{ month: 6, year: 2026, value: "Average" }], // 60
    [{ month: 5, year: 2026, points: "40" }], // grace-only month, total 40 -> 40% efficiency
  );
  const r = computePmAverageScore("pm-1", julyToJuneWindow(), ctx);
  assert.equal(r.monthsCounted, 2);
  assert.equal(r.averageScore, 50); // (60 + 40) / 2

  // A grace entry outside the window is ignored.
  const ctxOutside = qualityCtx(
    [{ month: 6, year: 2026, value: "Average" }], // 60
    [{ month: 6, year: 2025, points: "40" }], // June 2025, outside the window
  );
  const rOutside = computePmAverageScore("pm-1", julyToJuneWindow(), ctxOutside);
  assert.equal(rOutside.monthsCounted, 1);
  assert.equal(rOutside.averageScore, 60);
});

const TARGET_PARAM = {
  id: "p-target",
  weightage: "50",
  isInverse: false,
  isAutoCalculated: true,
  autoCalcType: "target_achievement",
};
const TARGET_LEVEL_SCORES: LevelScore[] = [
  { parameterId: "p-target", levelId: "lvl-1", value: "0%", scorePercentage: "0" },
  { parameterId: "p-target", levelId: "lvl-1", value: "50%", scorePercentage: "50" },
  { parameterId: "p-target", levelId: "lvl-1", value: "100%", scorePercentage: "100" },
];
// A second parameter so totalWeightage (100) exceeds the auto-calc param's own
// weightage (50), making it obvious when the auto-calc score is (or isn't)
// blended with a real review's score rather than standing in on its own.
const OTHER_PARAM = { id: "p-other", weightage: "50", isInverse: false };
const OTHER_LEVEL_SCORES: LevelScore[] = [
  { parameterId: "p-other", levelId: "lvl-1", value: "Good", scorePercentage: "80" },
];

test("generate glue: a month with only an auto-calc target/payment record and no real review is excluded", () => {
  // No reviews, no grace — only a PM target + received payment for June 2026.
  // This must NOT count toward the average on its own (it would silently
  // diverge from the report card, which never counts months nobody reviewed).
  const ctx: PmAverageContext = {
    parameters: [TARGET_PARAM, OTHER_PARAM],
    autoCalcParams: [TARGET_PARAM],
    allLevels: [KPI_LEVEL],
    levelScores: [...TARGET_LEVEL_SCORES, ...OTHER_LEVEL_SCORES],
    totalWeightage: 100,
    pmLevelId: "lvl-1",
    reviews: [],
    grace: [],
    paymentsByKey: new Map([
      ["2026-6", [{ project: { pmId: "pm-1" }, receivedAmount: "1000" }]],
    ]),
    targetsByKey: new Map([
      ["2026-6", [{ pmId: "pm-1", targetAmount: "1000" }]],
    ]),
  };

  const r = computePmAverageScore("pm-1", julyToJuneWindow(), ctx);
  assert.equal(r.monthsCounted, 0);
  assert.equal(r.averageScore, 0);
});

test("generate glue: auto-calculated target-achievement params only supplement a month that already has a real review", () => {
  // June 2026 has a real review for the "other" parameter, so the month
  // qualifies; the auto-calc target-achievement param then fills in its own
  // score for that same month (PM hit 100% of target -> 100% score).
  const ctx: PmAverageContext = {
    parameters: [TARGET_PARAM, OTHER_PARAM],
    autoCalcParams: [TARGET_PARAM],
    allLevels: [KPI_LEVEL],
    levelScores: [...TARGET_LEVEL_SCORES, ...OTHER_LEVEL_SCORES],
    totalWeightage: 100,
    pmLevelId: "lvl-1",
    reviews: [{ pmId: "pm-1", parameterId: "p-other", value: "Good", month: 6, year: 2026 }],
    grace: [],
    paymentsByKey: new Map([
      ["2026-6", [{ project: { pmId: "pm-1" }, receivedAmount: "1000" }]],
    ]),
    targetsByKey: new Map([
      ["2026-6", [{ pmId: "pm-1", targetAmount: "1000" }]],
    ]),
  };

  const r = computePmAverageScore("pm-1", julyToJuneWindow(), ctx);
  assert.equal(r.monthsCounted, 1);
  // Good (40 of 50 weight) + auto-calc 100% (50 of 50 weight) = 90 of 100 -> 90%.
  assert.equal(r.averageScore, 90);
});
