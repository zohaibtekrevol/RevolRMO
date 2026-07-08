import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { makeGenerateAppraisalsHandler, type AppraisalGenerateStorage } from "./appraisalMath";

// End-to-end / route-level coverage for POST /api/kpi/appraisals/generate.
//
// Task #131 unit-tested the pure window-averaging helper, and the service-level
// tests in appraisalMath.test.ts cover computePmAverageScore. This file exercises
// the *endpoint* itself: a real HTTP request flows through express + the
// dependency-injected handler, reads from a seeded fake store, persists the
// generated appraisal rows (replaceAppraisalsForPeriod), and returns the stored
// records (getAppraisals). It asserts the persisted averageScore / eligibility /
// salary-glue both before and after an admin enters a previously-empty
// past-month score, and that months outside the window never count.

type LevelScore = { parameterId: string; levelId: string; value: string; scorePercentage: string };

// A single quality parameter weighted 100, so a month's efficiency equals the
// configured scorePercentage of the chosen rating (e.g. "Good" -> 80%).
const QUALITY_PARAM = { id: "p-quality", weightage: "100", isInverse: false, isAutoCalculated: false, autoCalcType: null };
const QUALITY_LEVEL_SCORES: LevelScore[] = [
  { parameterId: "p-quality", levelId: "lvl-1", value: "Excellent", scorePercentage: "100" },
  { parameterId: "p-quality", levelId: "lvl-1", value: "Good", scorePercentage: "80" },
  { parameterId: "p-quality", levelId: "lvl-1", value: "Average", scorePercentage: "60" },
  { parameterId: "p-quality", levelId: "lvl-1", value: "Poor", scorePercentage: "30" },
];

// A mutable in-memory store implementing exactly the surface the handler needs.
// `reviews` is keyed by PM id so a test can add a past-month score between calls.
function makeFakeStore(opts: { seedAppraisals?: any[] } = {}) {
  const reviewsByPm = new Map<string, any[]>();
  reviewsByPm.set("pm-1", [
    { pmId: "pm-1", parameterId: "p-quality", value: "Good", month: 1, year: 2026 }, // in-window, 80
    { pmId: "pm-1", parameterId: "p-quality", value: "Excellent", month: 6, year: 2026 }, // in-window, 100
    { pmId: "pm-1", parameterId: "p-quality", value: "Poor", month: 6, year: 2025 }, // OUT of window (June 2025)
  ]);

  let appraisals: any[] = [...(opts.seedAppraisals || [])];
  let replaceCalls = 0;
  let lastReplaceRows: any[] = [];
  const extraUsers: any[] = [];

  const store: AppraisalGenerateStorage = {
    getAllUsers: async () => [
      // The PM under test: 24 months service, designation des-1, current band band-cur (10000).
      {
        id: "pm-1",
        isProjectManager: true,
        kpiExcluded: false,
        kpiLevelId: "lvl-1",
        gradeId: "des-1",
        gradeBandId: "band-cur",
        joiningDate: "2020-01-01",
      },
      // A non-PM and an excluded PM that must be filtered out.
      { id: "u-2", isProjectManager: false, kpiExcluded: false },
      { id: "pm-excluded", isProjectManager: true, kpiExcluded: true, kpiLevelId: "lvl-1" },
      ...extraUsers,
    ],
    getAllGrades: async () => [
      { id: "des-1", name: "Senior PM", targetScore: "80", baseIncrementPct: "5" },
    ],
    getAllSalaryGradeBands: async () => [
      { id: "band-cur", designationId: "des-1", salaryAmount: "10000", gradeCode: "G1" },
      { id: "band-2", designationId: "des-1", salaryAmount: "12000", gradeCode: "G2" },
    ],
    getAllKpiParameters: async () => [QUALITY_PARAM],
    getAllKpiLevels: async () => [{ id: "lvl-1", name: "L1" }],
    getAllKpiLevelScores: async () => QUALITY_LEVEL_SCORES,
    getAllPayments: async () => [],
    getPmTargets: async () => [],
    getKpiMonthlyReviewsByPm: async (pmId: string) => reviewsByPm.get(pmId) || [],
    getKpiGraceScoresByPm: async () => [],
    replaceAppraisalsForPeriod: async (periodMonths, periodEndMonth, periodEndYear, rows) => {
      replaceCalls += 1;
      lastReplaceRows = rows;
      // Mirror the real "replace the period" semantics, which preserve rolled-out
      // appraisals (their board decision + applied grade are locked).
      appraisals = appraisals.filter(
        (a) =>
          !(a.periodMonths === periodMonths && a.periodEndMonth === periodEndMonth && a.periodEndYear === periodEndYear && a.status !== "rolled_out"),
      );
      for (const r of rows) appraisals.push({ id: `appr-${appraisals.length + 1}`, ...r });
    },
    getAppraisals: async (periodMonths, periodEndMonth, periodEndYear) =>
      appraisals.filter(
        (a) => a.periodMonths === periodMonths && a.periodEndMonth === periodEndMonth && a.periodEndYear === periodEndYear,
      ),
  };

  return {
    store,
    addReview: (r: any) => {
      if (!reviewsByPm.has(r.pmId)) reviewsByPm.set(r.pmId, []);
      reviewsByPm.get(r.pmId)!.push(r);
    },
    addUser: (u: any) => extraUsers.push(u),
    getReplaceCalls: () => replaceCalls,
    getLastReplaceRows: () => lastReplaceRows,
  };
}

// Spin up a throwaway express server mounting only the generate endpoint with a
// stubbed auth middleware (sets the admin user) and the injected fake store.
async function withServer(
  store: AppraisalGenerateStorage,
  logActivityCalls: any[],
  fn: (baseUrl: string) => Promise<void>,
) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.user = { claims: { sub: "admin-1" } };
    next();
  });
  const logActivity = async (...args: any[]) => {
    logActivityCalls.push(args);
  };
  app.post("/api/kpi/appraisals/generate", makeGenerateAppraisalsHandler(store, logActivity as any));

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

async function generate(baseUrl: string, body: any) {
  const res = await fetch(`${baseUrl}/api/kpi/appraisals/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
}

test("generate endpoint: rejects an invalid period", async () => {
  const { store } = makeFakeStore();
  const logs: any[] = [];
  await withServer(store, logs, async (baseUrl) => {
    const r = await generate(baseUrl, { periodMonths: 7, periodEndMonth: 6, periodEndYear: 2026 });
    assert.equal(r.status, 400);
    assert.match(r.json.message, /periodMonths must be 6 or 12/);
  });
});

test("generate endpoint: persists an eligible appraisal averaging only in-window months", async () => {
  const { store, getReplaceCalls } = makeFakeStore();
  const logs: any[] = [];
  await withServer(store, logs, async (baseUrl) => {
    const r = await generate(baseUrl, { periodMonths: 12, periodEndMonth: 6, periodEndYear: 2026 });
    assert.equal(r.status, 200);

    // Only the single eligible PM is generated (non-PM + excluded PM filtered out).
    assert.equal(r.json.length, 1);
    const row = r.json[0];
    assert.equal(row.pmId, "pm-1");

    // (Good 80 + Excellent 100) / 2 = 90. The out-of-window June 2025 "Poor" (30)
    // must NOT drag this down.
    assert.equal(row.averageScore, "90.00");
    assert.equal(row.eligible, true);
    assert.equal(row.eligibilityReason, null);

    // Salary glue: HP% = (90/80 - 1)*100 = 12.5, base 5 -> 17.5% -> 11750, which
    // snaps to the 12000 band (G2).
    assert.equal(row.currentSalary, "10000.00");
    assert.equal(row.hpPct, "12.50");
    assert.equal(row.baseIncrementPct, "5.00");
    assert.equal(row.assignedSalary, "12000.00");
    assert.equal(row.assignedGradeCode, "G2");
    assert.equal(row.finalIncrement, "2000.00");
    assert.equal(row.status, "draft");

    // The endpoint actually persisted (and an activity log was written).
    assert.equal(getReplaceCalls(), 1);
    assert.equal(logs.length, 1);
    const persisted = await store.getAppraisals(12, 6, 2026);
    assert.equal(persisted.length, 1);
    assert.equal(persisted[0].averageScore, "90.00");
  });
});

test("generate endpoint: entering a previously-empty past-month score lowers the stored average and flips eligibility", async () => {
  const { store, addReview, getReplaceCalls } = makeFakeStore();
  const logs: any[] = [];
  await withServer(store, logs, async (baseUrl) => {
    // First run with only the two strong in-window months -> eligible at 90.
    const first = await generate(baseUrl, { periodMonths: 12, periodEndMonth: 6, periodEndYear: 2026 });
    assert.equal(first.json[0].averageScore, "90.00");
    assert.equal(first.json[0].eligible, true);

    // Admin enters a score for July 2025 — a previously-empty past month that is
    // still inside the appraisal window — then regenerates.
    addReview({ pmId: "pm-1", parameterId: "p-quality", value: "Poor", month: 7, year: 2025 });
    const second = await generate(baseUrl, { periodMonths: 12, periodEndMonth: 6, periodEndYear: 2026 });
    assert.equal(second.status, 200);

    const row = second.json[0];
    // (Poor 30 + Good 80 + Excellent 100) / 3 = 70.
    assert.equal(row.averageScore, "70.00");
    // 70 is no longer above the target of 80, so the PM is now ineligible and no
    // salary increment is assigned.
    assert.equal(row.eligible, false);
    assert.match(row.eligibilityReason, /not above target/);
    assert.equal(row.assignedSalary, null);
    assert.equal(row.finalIncrement, null);

    // Regeneration replaced the period rather than appending.
    assert.equal(getReplaceCalls(), 2);
    const persisted = await store.getAppraisals(12, 6, 2026);
    assert.equal(persisted.length, 1);
    assert.equal(persisted[0].averageScore, "70.00");
    assert.equal(persisted[0].eligible, false);
  });
});

test("generate endpoint: a Force-Eligible recent hire's average only counts months since their actual joining date", async () => {
  // A recent hire (< 12mo service) forced eligible via the admin override.
  // Their average must be computed only over months since they actually
  // joined — a stray pre-joining review (e.g. mis-dated data) must not drag
  // the average down, even though it falls inside the shared period window.
  const { store, addReview, addUser, getReplaceCalls } = makeFakeStore();
  const logs: any[] = [];
  await withServer(store, logs, async (baseUrl) => {
    addUser({
      id: "pm-recent",
      isProjectManager: true,
      kpiExcluded: false,
      kpiLevelId: "lvl-1",
      gradeId: "des-1",
      gradeBandId: "band-cur",
      joiningDate: "2025-09-01", // 10 months of service as of period end (June 2026)
    });
    addReview({ pmId: "pm-recent", parameterId: "p-quality", value: "Poor", month: 7, year: 2025 }); // before joining — must be excluded
    addReview({ pmId: "pm-recent", parameterId: "p-quality", value: "Excellent", month: 9, year: 2025 }); // in-tenure
    addReview({ pmId: "pm-recent", parameterId: "p-quality", value: "Excellent", month: 6, year: 2026 }); // in-tenure

    // First generate persists pm-recent as ineligible (< 12mo, no override yet).
    const first = await generate(baseUrl, { periodMonths: 12, periodEndMonth: 6, periodEndYear: 2026 });
    const recentRow = first.json.find((r: any) => r.pmId === "pm-recent");
    assert.ok(recentRow, "pm-recent should be generated even though ineligible");
    assert.equal(recentRow.eligible, false);
    // Average must already only reflect the two in-tenure "Excellent" months (100),
    // not the pre-joining "Poor" (30).
    assert.equal(recentRow.averageScore, "100.00");

    // Admin flips the Force Eligible toggle directly on the store (mirrors the
    // override PATCH route), then regenerates — the flag must survive regen.
    const stored = await store.getAppraisals(12, 6, 2026);
    const row = stored.find((a: any) => a.pmId === "pm-recent")!;
    row.eligibilityOverride = true;

    const second = await generate(baseUrl, { periodMonths: 12, periodEndMonth: 6, periodEndYear: 2026 });
    const recentRow2 = second.json.find((r: any) => r.pmId === "pm-recent");
    assert.equal(recentRow2.eligibilityOverride, true);
    assert.equal(recentRow2.eligible, true);
    // Still only the in-tenure months feed the average — tenure-window capping
    // is unaffected by the eligibility override.
    assert.equal(recentRow2.averageScore, "100.00");

    assert.ok(getReplaceCalls() >= 2);
  });
});

test("generate endpoint: a rolled-out appraisal survives regen and isn't re-generated", async () => {
  // Seed a locked, rolled-out appraisal for the only PM in the period. Its board
  // decision and the grade already applied to the employee must not be touched.
  const rolledOut = {
    id: "appr-locked",
    pmId: "pm-1",
    periodMonths: 12,
    periodEndMonth: 6,
    periodEndYear: 2026,
    status: "rolled_out",
    averageScore: "90.00",
    eligible: true,
    finalVerdict: "Approved",
    boardComment: "Strong year.",
  };
  const { store, getLastReplaceRows } = makeFakeStore({ seedAppraisals: [rolledOut] });
  const logs: any[] = [];
  await withServer(store, logs, async (baseUrl) => {
    const r = await generate(baseUrl, { periodMonths: 12, periodEndMonth: 6, periodEndYear: 2026 });
    assert.equal(r.status, 200);

    // The handler skipped pm-1 (already rolled out) — no fresh draft row was built.
    assert.equal(getLastReplaceRows().some((row: any) => row.pmId === "pm-1"), false);

    // The locked row is still the only appraisal for the period, untouched.
    const persisted = await store.getAppraisals(12, 6, 2026);
    assert.equal(persisted.length, 1);
    assert.equal(persisted[0].id, "appr-locked");
    assert.equal(persisted[0].status, "rolled_out");
    assert.equal(persisted[0].finalVerdict, "Approved");
    assert.equal(persisted[0].boardComment, "Strong year.");
  });
});
