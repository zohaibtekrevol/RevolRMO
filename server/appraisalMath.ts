// Pure appraisal eligibility & salary math, extracted from routes.ts so the
// pay-affecting logic can be unit-tested in isolation. The route handlers in
// routes.ts (generate + override PATCH) call these helpers, so the tests
// exercise exactly the same arithmetic that runs in production.

import type { RequestHandler } from "express";
import type { ActivityAction, ActivityEntity } from "@shared/schema";

export type SalaryBand = { id: string; salaryAmount: string | null };

export type Grade = {
  id: string;
  name?: string | null;
  targetScore: string | null;
  baseIncrementPct: string | null;
};

// Snap a raw salary to the nearest uploaded grade-sheet band.
// Smaller absolute difference wins; on a tie the higher (ceiling) band is chosen.
export function snapToBand(raw: number, bands: SalaryBand[]): SalaryBand | null {
  let best: { band: SalaryBand; diff: number; amt: number } | null = null;
  for (const b of bands) {
    const amt = parseFloat(b.salaryAmount || "0");
    const diff = Math.abs(amt - raw);
    if (!best || diff < best.diff || (diff === best.diff && amt > best.amt)) {
      best = { band: b, diff, amt };
    }
  }
  return best ? best.band : null;
}

// Months of service as of the end of the appraisal period. A partial final month
// counts toward service when the period-end day reaches the joining day-of-month.
export function computeServedMonths(
  joiningDate: string | Date | null | undefined,
  periodEndMonth: number,
  periodEndYear: number,
): number | null {
  if (!joiningDate) return null;
  const jd = new Date(joiningDate as any);
  if (isNaN(jd.getTime())) return null;
  const periodEndDate = new Date(periodEndYear, periodEndMonth, 0); // last day of period end month
  let servedMonths =
    (periodEndYear - jd.getFullYear()) * 12 + (periodEndMonth - 1 - jd.getMonth());
  if (periodEndDate.getDate() >= jd.getDate()) {
    // partial month at the end counts toward service
  } else {
    servedMonths -= 1;
  }
  if (servedMonths < 0) servedMonths = 0;
  return servedMonths;
}

export type AppraisalComputation = {
  eligible: boolean;
  reasons: string[];
  targetScore: number | null;
  baseIncrementPct: number | null;
  hpPct: number | null;
  rawNewSalary: number | null;
  assignedBandId: string | null;
  assignedSalary: number | null;
  finalIncrement: number | null;
};

// Filter a shared appraisal window down to only the months after a PM's
// joining date. Months before the joining month are excluded so recent hires'
// averages are not diluted by zero-data months they were never employed for.
// Returns the full window unchanged when joiningDate is absent or invalid.
export function filterWindowForPm(
  windowMonths: { month: number; year: number }[],
  joiningDate: string | Date | null | undefined,
): { month: number; year: number }[] {
  if (!joiningDate) return windowMonths;
  const jd = new Date(joiningDate as any);
  if (isNaN(jd.getTime())) return windowMonths;
  const joinYear = jd.getFullYear();
  const joinMonth = jd.getMonth() + 1; // 1-indexed
  return windowMonths.filter(({ month, year }) => {
    if (year > joinYear) return true;
    if (year === joinYear) return month >= joinMonth;
    return false;
  });
}

// Decide eligibility and, when eligible, compute the new salary. Eligibility
// requires >= 12 months service, an assigned grade, and an average score
// strictly above the grade's target. The increment factor is the grade's base
// increment % plus a high-performer % (HP%) that scales with how far the score
// exceeds target.
// Pass eligibilityOverride=true to bypass the 1-year service requirement for
// a specific appraisal (admin-controlled per-row).
export function computeAppraisal(args: {
  averageScore: number;
  servedMonths: number | null;
  grade: Grade | undefined | null;
  currentSalary: number;
  bands: SalaryBand[];
  hasGradeBand?: boolean;
  eligibilityOverride?: boolean;
}): AppraisalComputation {
  const { averageScore, servedMonths, grade, currentSalary, bands } = args;
  const hasGradeBand = args.hasGradeBand !== false; // default true for legacy callers
  const eligibilityOverride = args.eligibilityOverride === true;

  const reasons: string[] = [];
  const hasService = (servedMonths !== null && servedMonths >= 12) || eligibilityOverride;
  if (!eligibilityOverride) {
    if (servedMonths === null) reasons.push("No joining date set");
    else if (servedMonths < 12) reasons.push(`Less than 1 year service (${servedMonths} mo)`);
  }
  if (!grade) reasons.push("No designation assigned");
  if (!hasGradeBand) reasons.push("No grade assigned");
  const targetScore = grade ? parseFloat(grade.targetScore || "0") : null;
  const meetsScore = grade != null && averageScore > (targetScore as number);
  if (grade && !meetsScore)
    reasons.push(
      `Avg score ${averageScore.toFixed(1)} not above target ${(targetScore as number).toFixed(1)}`,
    );

  const eligible = hasService && !!grade && hasGradeBand && meetsScore;

  let baseIncrementPct: number | null = null;
  let hpPct: number | null = null;
  let rawNewSalary: number | null = null;
  let assignedBandId: string | null = null;
  let assignedSalary: number | null = null;
  let finalIncrement: number | null = null;

  if (eligible && grade) {
    baseIncrementPct = parseFloat(grade.baseIncrementPct || "0");
    hpPct = (targetScore as number) > 0 ? (averageScore / (targetScore as number) - 1) * 100 : 0;
    const factorPct = baseIncrementPct + hpPct;
    rawNewSalary = currentSalary * (1 + factorPct / 100);
    const band = snapToBand(rawNewSalary, bands);
    if (band) {
      assignedBandId = band.id;
      assignedSalary = parseFloat(band.salaryAmount || "0");
    } else {
      assignedSalary = rawNewSalary;
    }
    finalIncrement = assignedSalary - currentSalary;
  }

  return {
    eligible,
    reasons,
    targetScore,
    baseIncrementPct,
    hpPct,
    rawNewSalary,
    assignedBandId,
    assignedSalary,
    finalIncrement,
  };
}

// Per-month KPI total for a single appraisal-window month. `hasData` marks a
// month that actually has reviews/grace/auto-target input — only such months
// count toward the average (empty months are skipped, not scored as zero).
export type MonthScore = { totalScore: number; hasData: boolean };

// Average the monthly efficiency across every month inside the appraisal window
// that has data. Efficiency for a month = totalScore / totalWeightage * 100.
// Months outside the window are ignored (the caller only passes window months),
// and window months without data are skipped so they don't drag the average to 0.
// This is the exact arithmetic computePmAverageScore runs in routes.ts, extracted
// so the "past months inside the window count once they have scores" behaviour is
// unit-testable.
export function averageWindowEfficiency(
  windowMonths: { month: number; year: number }[],
  scoresByKey: Map<string, MonthScore>,
  totalWeightage: number,
): { averageScore: number; monthsCounted: number } {
  let effSum = 0;
  let monthsCounted = 0;
  for (const { month, year } of windowMonths) {
    const entry = scoresByKey.get(`${year}-${month}`);
    if (!entry || !entry.hasData) continue;
    const efficiency = totalWeightage > 0 ? (entry.totalScore / totalWeightage) * 100 : 0;
    effSum += efficiency;
    monthsCounted += 1;
  }
  return {
    averageScore: monthsCounted > 0 ? effSum / monthsCounted : 0,
    monthsCounted,
  };
}

// Score a single KPI review value against the level-specific score mappings for a
// PM's level. Percentage values snap to the nearest configured threshold, inverse
// parameters are flipped against the max configured percentage, and the result is
// weighted by the parameter's weightage. Extracted from routes.ts so the appraisal
// glue can be exercised with the exact arithmetic that runs in production.
export function calculateKpiScore(
  parameterId: string,
  value: string,
  pmLevelId: string | null | undefined,
  parameters: any[],
  allLevels: any[],
  levelScores: any[],
): number {
  const param = parameters.find((p: any) => p.id === parameterId);
  if (!param) return 0;
  const pmLevel = pmLevelId ? allLevels.find((l: any) => l.id === pmLevelId) : allLevels[0];
  if (!pmLevel) return 0;

  const matchingScores = levelScores.filter(
    (s: any) => s.parameterId === parameterId && s.levelId === pmLevel.id
  );
  let scoreMapping = matchingScores.find((s: any) => s.value === value);

  if (!scoreMapping && value.endsWith('%')) {
    const numericValue = parseInt(value.replace('%', ''), 10);
    if (!isNaN(numericValue)) {
      const numericMappings = matchingScores
        .map((s: any) => ({ ...s, numVal: parseInt(s.value.replace('%', ''), 10) }))
        .filter((s: any) => !isNaN(s.numVal))
        .sort((a: any, b: any) => a.numVal - b.numVal);

      if (numericMappings.length > 0) {
        if (numericValue >= numericMappings[numericMappings.length - 1].numVal) {
          scoreMapping = numericMappings[numericMappings.length - 1];
        } else if (numericValue <= numericMappings[0].numVal) {
          scoreMapping = numericMappings[0];
        } else {
          for (let i = numericMappings.length - 1; i >= 0; i--) {
            if (numericValue >= numericMappings[i].numVal) {
              scoreMapping = numericMappings[i];
              break;
            }
          }
        }
      }
    }
  }

  let percentage = parseFloat(scoreMapping?.scorePercentage || "0");

  if (param.isInverse) {
    const maxPercentage = matchingScores.reduce(
      (max: number, s: any) => Math.max(max, parseFloat(s.scorePercentage || "0")), 0
    );
    percentage = maxPercentage - percentage;
  }

  const weightage = parseFloat(param.weightage || "0");
  return (percentage / 100) * weightage;
}

// Context for computePmAverageScore: the shared KPI config plus this PM's reviews,
// grace scores, and the payments/targets needed to derive auto-calculated target
// achievement params.
export type PmAverageContext = {
  parameters: any[];
  autoCalcParams: any[];
  allLevels: any[];
  levelScores: any[];
  totalWeightage: number;
  pmLevelId: string | null | undefined;
  reviews: any[]; // this PM's reviews
  grace: any[]; // this PM's grace scores
  paymentsByKey: Map<string, any[]>; // received payments by `${year}-${month}`
  targetsByKey: Map<string, any[]>; // pm targets by `${year}-${month}`
};

// Compute a PM's average monthly KPI efficiency (%) across a window of months.
// Mirrors the report-card per-month efficiency logic; averages only over months
// that have a real manager-submitted review or grace adjustment within the
// window — a month with only an auto-calculated target-achievement figure (no
// actual review/grace) never counts on its own, matching the report card's
// definition of a "reviewed month". Auto-calc params only fill in a missing
// parameter score for a month that already qualifies. Extracted from
// routes.ts (the generate endpoint calls this) so the wiring of reviews, grace
// scores, and auto-calculated target params into averageWindowEfficiency can be
// tested end-to-end.
export function computePmAverageScore(
  pmId: string,
  windowMonths: { month: number; year: number }[],
  ctx: PmAverageContext,
): { averageScore: number; monthsCounted: number } {
  const windowKeys = new Set(windowMonths.map((w) => `${w.year}-${w.month}`));

  const graceByMonth = new Map<string, number>();
  for (const g of ctx.grace) {
    const key = `${g.year}-${g.month}`;
    if (!windowKeys.has(key)) continue;
    graceByMonth.set(key, (graceByMonth.get(key) || 0) + parseFloat(g.points || "0"));
  }

  const reviewsByMonth = new Map<string, any[]>();
  for (const r of ctx.reviews) {
    const key = `${r.year}-${r.month}`;
    if (!windowKeys.has(key)) continue;
    if (!reviewsByMonth.has(key)) reviewsByMonth.set(key, []);
    reviewsByMonth.get(key)!.push(r);
  }

  const scoresByKey = new Map<string, MonthScore>();

  for (const { month, year } of windowMonths) {
    const key = `${year}-${month}`;
    const monthReviews = [...(reviewsByMonth.get(key) || [])];
    const graceAdj = graceByMonth.get(key) || 0;

    // A month only counts toward the average when a manager actually submitted
    // a review or a grace adjustment for it — mirroring the report card, which
    // derives its month list from real reviews/grace only. A PM target/payment
    // record existing for a month (with no manager review) must NOT, on its
    // own, make that month count; otherwise months nobody ever reviewed can
    // silently drag the average down (or up) relative to the report card.
    const hasRealData = monthReviews.length > 0 || graceAdj !== 0;
    if (!hasRealData) continue;

    // Auto-calculated target achievement params (if not already reviewed) —
    // these only fill in a missing parameter score within a month that
    // already qualifies via a real review/grace entry above.
    if (ctx.autoCalcParams.length > 0) {
      const pmTarget = (ctx.targetsByKey.get(key) || []).find((t) => t.pmId === pmId);
      if (pmTarget) {
        const payments = ctx.paymentsByKey.get(key) || [];
        let received = 0;
        for (const p of payments) {
          if (p.project?.pmId === pmId) received += parseFloat(p.receivedAmount || "0");
        }
        const targetAmt = parseFloat(pmTarget.targetAmount || "0");
        const percentage = targetAmt > 0 ? Math.round((received / targetAmt) * 100) : received > 0 ? 100 : 0;
        for (const param of ctx.autoCalcParams) {
          if (monthReviews.find((r) => r.parameterId === param.id)) continue;
          monthReviews.push({ parameterId: param.id, value: `${percentage}%` });
        }
      }
    }

    let totalScore = 0;
    for (const rev of monthReviews) {
      // Prefer the level snapshotted at review-entry time so a post-rollout
      // level change does not retroactively rescore historical months.
      const revLevelId = rev.levelIdSnapshot ?? ctx.pmLevelId;
      totalScore += calculateKpiScore(rev.parameterId, rev.value, revLevelId, ctx.parameters, ctx.allLevels, ctx.levelScores);
    }
    totalScore += graceAdj;

    scoresByKey.set(key, { totalScore, hasData: true });
  }

  return averageWindowEfficiency(windowMonths, scoresByKey, ctx.totalWeightage);
}

// Thrown when an override request carries invalid input; the route maps this to
// an HTTP 400 response.
export class AppraisalOverrideError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppraisalOverrideError";
  }
}

export type OverrideInput = {
  baseIncrementPct?: unknown;
  hpPct?: unknown;
  currentSalary?: unknown;
  assignedBandId?: unknown;
};

export type ExistingAppraisal = {
  baseIncrementPct: string | null;
  hpPct: string | null;
  currentSalary: string | null;
  bandOverridden: boolean | null;
  assignedBandId: string | null;
};

export type OverrideUpdate = {
  baseIncrementPct?: string;
  baseOverridden?: boolean;
  hpPct?: string;
  hpOverridden?: boolean;
  currentSalary?: string;
  salaryOverridden?: boolean;
  rawNewSalary: string;
  assignedBandId: string | null;
  bandOverridden?: boolean;
  assignedSalary: string;
  finalIncrement: string;
};

// Recompute the financial fields of an appraisal after a manual override. Any of
// base increment %, HP %, current salary, and assigned band may be overridden;
// unspecified fields fall back to the existing appraisal values. Throws
// AppraisalOverrideError on non-finite numbers, negative salary, or unknown band.
export function recomputeOverride(
  existing: ExistingAppraisal,
  body: OverrideInput,
  bands: SalaryBand[],
): OverrideUpdate {
  const update: any = {};

  const parseNum = (v: any, label: string): number => {
    const n = typeof v === "number" ? v : parseFloat(v);
    if (!Number.isFinite(n)) throw new AppraisalOverrideError(`Invalid ${label}`);
    return n;
  };

  let base = existing.baseIncrementPct != null ? parseFloat(existing.baseIncrementPct) : 0;
  if (body.baseIncrementPct !== undefined && body.baseIncrementPct !== null && body.baseIncrementPct !== "") {
    base = parseNum(body.baseIncrementPct, "base increment %");
    update.baseIncrementPct = base.toFixed(2);
    update.baseOverridden = true;
  }

  let hp = existing.hpPct != null ? parseFloat(existing.hpPct) : 0;
  if (body.hpPct !== undefined && body.hpPct !== null && body.hpPct !== "") {
    hp = parseNum(body.hpPct, "HP %");
    update.hpPct = hp.toFixed(2);
    update.hpOverridden = true;
  }

  let currentSalary = existing.currentSalary != null ? parseFloat(existing.currentSalary) : 0;
  if (body.currentSalary !== undefined && body.currentSalary !== null && body.currentSalary !== "") {
    currentSalary = parseNum(body.currentSalary, "current salary");
    if (currentSalary < 0) throw new AppraisalOverrideError("Current salary cannot be negative");
    update.currentSalary = currentSalary.toFixed(2);
    update.salaryOverridden = true;
  }

  const factorPct = base + hp;
  const rawNewSalary = currentSalary * (1 + factorPct / 100);
  update.rawNewSalary = rawNewSalary.toFixed(2);

  let assignedSalary: number;
  if (body.assignedBandId !== undefined) {
    if (body.assignedBandId === null || body.assignedBandId === "") {
      // Clear band override -> re-snap automatically
      const band = snapToBand(rawNewSalary, bands);
      update.assignedBandId = band ? band.id : null;
      assignedSalary = band ? parseFloat(band.salaryAmount || "0") : rawNewSalary;
      update.bandOverridden = false;
    } else {
      const band = bands.find((b) => b.id === body.assignedBandId);
      if (!band) throw new AppraisalOverrideError("Band not found");
      update.assignedBandId = band.id;
      assignedSalary = parseFloat(band.salaryAmount || "0");
      update.bandOverridden = true;
    }
  } else if (existing.bandOverridden && existing.assignedBandId) {
    // Keep the existing manually-chosen band
    const band = bands.find((b) => b.id === existing.assignedBandId);
    assignedSalary = band ? parseFloat(band.salaryAmount || "0") : rawNewSalary;
    update.assignedBandId = band ? band.id : null;
  } else {
    const band = snapToBand(rawNewSalary, bands);
    update.assignedBandId = band ? band.id : null;
    assignedSalary = band ? parseFloat(band.salaryAmount || "0") : rawNewSalary;
  }

  update.assignedSalary = assignedSalary.toFixed(2);
  update.finalIncrement = (assignedSalary - currentSalary).toFixed(2);
  return update;
}

// Minimal storage surface the appraisal-generate handler depends on. Declared
// structurally (not as the full IStorage) so the handler can be exercised by a
// route-level test with a seeded fake store, without dragging in the database.
export type AppraisalGenerateStorage = {
  getAllUsers: () => Promise<any[]>;
  getAllGrades: () => Promise<any[]>;
  getAllSalaryGradeBands: () => Promise<any[]>;
  getAllKpiParameters: (active?: boolean) => Promise<any[]>;
  getAllKpiLevels: (active?: boolean) => Promise<any[]>;
  getAllKpiLevelScores: () => Promise<any[]>;
  getAllPayments: (filter: { month: number; year: number; status: "received" }) => Promise<any[]>;
  getPmTargets: (month: number, year: number) => Promise<any[]>;
  getKpiMonthlyReviewsByPm: (pmId: string) => Promise<any[]>;
  getKpiGraceScoresByPm: (pmId: string) => Promise<any[]>;
  replaceAppraisalsForPeriod: (
    periodMonths: number,
    periodEndMonth: number,
    periodEndYear: number,
    rows: any[],
  ) => Promise<any>;
  getAppraisals: (periodMonths: number, periodEndMonth: number, periodEndYear: number) => Promise<any[]>;
};

// Build the POST /api/kpi/appraisals/generate request handler with its storage
// and activity logger injected. registerRoutes wires in the real singletons;
// tests wire in a seeded fake store so the full glue (reviews + grace +
// auto-calc target params -> window average -> eligibility/salary -> persisted
// rows) can be exercised end-to-end without a database.
export function makeGenerateAppraisalsHandler(
  storageDep: AppraisalGenerateStorage,
  logActivity: (
    userId: string | null,
    action: ActivityAction,
    entity: ActivityEntity,
    entityId?: string,
    details?: string,
    req?: any,
  ) => Promise<void>,
): RequestHandler {
  return async (req: any, res) => {
    try {
      const adminId = req.user?.claims?.sub;
      const periodMonths = parseInt(req.body?.periodMonths);
      const periodEndMonth = parseInt(req.body?.periodEndMonth);
      const periodEndYear = parseInt(req.body?.periodEndYear);
      if (![6, 12].includes(periodMonths)) {
        return res.status(400).json({ message: "periodMonths must be 6 or 12" });
      }
      if (isNaN(periodEndMonth) || periodEndMonth < 1 || periodEndMonth > 12 || isNaN(periodEndYear)) {
        return res.status(400).json({ message: "Invalid period end month/year" });
      }

      // Build window of months ending at the period end (inclusive)
      const windowMonths: { month: number; year: number }[] = [];
      let wm = periodEndMonth, wy = periodEndYear;
      for (let i = 0; i < periodMonths; i++) {
        windowMonths.push({ month: wm, year: wy });
        wm -= 1;
        if (wm < 1) { wm = 12; wy -= 1; }
      }

      const [allUsers, allGrades, allBands, parameters, allLevels, levelScores] = await Promise.all([
        storageDep.getAllUsers(),
        storageDep.getAllGrades(),
        storageDep.getAllSalaryGradeBands(),
        storageDep.getAllKpiParameters(true),
        storageDep.getAllKpiLevels(true),
        storageDep.getAllKpiLevelScores(),
      ]);

      const gradesById = new Map(allGrades.map((g) => [g.id, g]));
      const bandsById = new Map(allBands.map((b) => [b.id, b]));
      const autoCalcParams = parameters.filter((p) => p.isAutoCalculated && p.autoCalcType === "target_achievement");
      const totalWeightage = parameters.reduce((sum, p) => sum + parseFloat(p.weightage || "0"), 0);

      // Preload payments and targets per window month (only if there are auto-calc params)
      const paymentsByKey = new Map<string, any[]>();
      const targetsByKey = new Map<string, any[]>();
      if (autoCalcParams.length > 0) {
        for (const { month, year } of windowMonths) {
          const key = `${year}-${month}`;
          const [payments, targets] = await Promise.all([
            storageDep.getAllPayments({ month, year, status: "received" as const }),
            storageDep.getPmTargets(month, year),
          ]);
          paymentsByKey.set(key, payments);
          targetsByKey.set(key, targets);
        }
      }

      const pms = allUsers.filter((u) => u.isProjectManager && !u.kpiExcluded);

      // Rolled-out appraisals are locked: their board decision and the grade
      // already applied to the employee must survive a regen. Skip those PMs so
      // replaceAppraisalsForPeriod (which preserves rolled_out rows) doesn't get a
      // fresh draft row that would collide with the locked one.
      // Also preserve any eligibilityOverride flags from non-rolled-out rows so
      // an admin's "Force Eligible" toggle survives a regen.
      const existing = await storageDep.getAppraisals(periodMonths, periodEndMonth, periodEndYear);
      const rolledOutPmIds = new Set(
        existing.filter((a) => a.status === "rolled_out").map((a) => a.pmId),
      );
      const overrideByPmId = new Map<string, boolean>(
        existing
          .filter((a) => a.status !== "rolled_out" && a.eligibilityOverride)
          .map((a) => [a.pmId, true]),
      );

      const rows: any[] = [];
      for (const pm of pms) {
        if (rolledOutPmIds.has(pm.id)) continue;
        const [reviews, grace] = await Promise.all([
          storageDep.getKpiMonthlyReviewsByPm(pm.id),
          storageDep.getKpiGraceScoresByPm(pm.id),
        ]);

        // Cap the window to months after this PM's joining date so recent hires
        // aren't scored against months they were never employed for.
        const pmWindow = filterWindowForPm(windowMonths, pm.joiningDate);

        const { averageScore } = computePmAverageScore(pm.id, pmWindow, {
          parameters,
          autoCalcParams,
          allLevels,
          levelScores,
          totalWeightage,
          pmLevelId: pm.kpiLevelId,
          reviews,
          grace,
          paymentsByKey,
          targetsByKey,
        });

        const grade = pm.gradeId ? gradesById.get(pm.gradeId) : undefined; // Designation

        // Service length
        const servedMonths = computeServedMonths(pm.joiningDate, periodEndMonth, periodEndYear);

        // Current salary comes from the PM's assigned pay Grade (Basic). New
        // salaries snap only to grades within the same Designation.
        const currentBand = pm.gradeBandId ? bandsById.get(pm.gradeBandId) : undefined;
        const currentSalary = currentBand ? parseFloat(currentBand.salaryAmount || "0") : 0;
        const designationBands = grade ? allBands.filter((b) => b.designationId === grade.id) : [];

        // Preserve any eligibilityOverride the admin set before this regen.
        const eligibilityOverride = overrideByPmId.get(pm.id) ?? false;

        // Eligibility + salary math
        const {
          eligible,
          reasons,
          targetScore,
          baseIncrementPct,
          hpPct,
          rawNewSalary,
          assignedBandId,
          assignedSalary,
          finalIncrement,
        } = computeAppraisal({
          averageScore,
          servedMonths,
          grade,
          currentSalary,
          bands: designationBands,
          hasGradeBand: !!currentBand,
          eligibilityOverride,
        });

        const assignedBand = assignedBandId ? bandsById.get(assignedBandId) : undefined;

        rows.push({
          pmId: pm.id,
          periodMonths,
          periodEndMonth,
          periodEndYear,
          gradeId: grade?.id ?? null,
          gradeName: grade?.name ?? null,
          currentGradeBandId: currentBand?.id ?? null,
          currentGradeCode: currentBand?.gradeCode ?? null,
          assignedGradeCode: assignedBand?.gradeCode ?? null,
          targetScore: targetScore != null ? targetScore.toString() : null,
          averageScore: averageScore.toFixed(2),
          servedMonths,
          eligible,
          eligibilityOverride,
          eligibilityReason: reasons.length > 0 ? reasons.join("; ") : null,
          baseIncrementPct: baseIncrementPct != null ? baseIncrementPct.toFixed(2) : null,
          hpPct: hpPct != null ? hpPct.toFixed(2) : null,
          currentSalary: currentSalary.toFixed(2),
          rawNewSalary: rawNewSalary != null ? rawNewSalary.toFixed(2) : null,
          assignedBandId,
          assignedSalary: assignedSalary != null ? assignedSalary.toFixed(2) : null,
          finalIncrement: finalIncrement != null ? finalIncrement.toFixed(2) : null,
          baseOverridden: false,
          hpOverridden: false,
          bandOverridden: false,
          salaryOverridden: false,
          status: "draft",
          createdBy: adminId,
        });
      }

      await storageDep.replaceAppraisalsForPeriod(periodMonths, periodEndMonth, periodEndYear, rows);
      await logActivity(adminId, "create", "appraisal" as ActivityEntity, "generate", `Generated ${rows.length} appraisals for ${periodMonths}mo cycle ending ${periodEndMonth}/${periodEndYear}`, req);
      res.json(await storageDep.getAppraisals(periodMonths, periodEndMonth, periodEndYear));
    } catch (error) {
      console.error("Error generating appraisals:", error);
      res.status(500).json({ message: "Failed to generate appraisals" });
    }
  };
}
