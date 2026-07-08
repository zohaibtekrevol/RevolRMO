import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";
import {
  applyRollout,
  computeRolloutOverride,
  makeRolloutHandler,
  performRollout,
  type RolloutAppraisal,
  type RolloutData,
  type RolloutTx,
} from "./appraisalRollout";

// Coverage for the board "Rollout" flow — the highest-risk step because it
// mutates an employee's grade/pay band. Two layers are exercised:
//
//   1. applyRollout (the transaction-scoped storage logic shared by
//      storage.rollOutAppraisal): the finalized->rolled_out transition, applying
//      the appraisal's grade/band to the user, idempotency on a repeat call, and
//      the "don't wipe the user's grade/band when the appraisal fields are null"
//      rule.
//   2. makeRolloutHandler (the route guards): rejecting rollout when the
//      appraisal isn't finalized and when a final verdict is missing.

// A fake RolloutTx backed by an in-memory appraisal row + a user grade record.
// transitionToRolledOut mirrors the real SQL gate: it only flips a "finalized"
// row, returning undefined otherwise (already rolled out / wrong status).
function makeFakeTx(seed: {
  appraisal: RolloutAppraisal;
  user?: { gradeId: string | null; gradeBandId: string | null };
}) {
  const appraisal = { ...seed.appraisal };
  const user = seed.user ? { ...seed.user } : null;
  let transitionCalls = 0;
  let applyGradeCalls = 0;

  const tx: RolloutTx = {
    transitionToRolledOut: async (id: string, data: RolloutData) => {
      transitionCalls += 1;
      if (appraisal.id !== id || appraisal.status !== "finalized") return undefined;
      appraisal.status = "rolled_out";
      appraisal.finalVerdict = data.finalVerdict;
      appraisal.boardComment = data.boardComment;
      appraisal.rolledOutBy = data.rolledOutBy;
      return { ...appraisal };
    },
    applyUserGrade: async (userId: string, fields: { gradeId?: string; gradeBandId?: string }) => {
      applyGradeCalls += 1;
      if (user && userId === appraisal.pmId) {
        if (fields.gradeId !== undefined) user.gradeId = fields.gradeId;
        if (fields.gradeBandId !== undefined) user.gradeBandId = fields.gradeBandId;
      }
    },
  };

  return {
    tx,
    getAppraisal: () => appraisal,
    getUser: () => user,
    getTransitionCalls: () => transitionCalls,
    getApplyGradeCalls: () => applyGradeCalls,
  };
}

test("applyRollout: flips finalized -> rolled_out and applies grade/band to the user", async () => {
  const fake = makeFakeTx({
    appraisal: {
      id: "appr-1",
      pmId: "pm-1",
      status: "finalized",
      gradeId: "des-2",
      assignedBandId: "band-2",
    },
    user: { gradeId: "des-1", gradeBandId: "band-1" },
  });

  const result = await applyRollout(fake.tx, "appr-1", {
    finalVerdict: "Approved",
    boardComment: "Strong year.",
    rolledOutBy: "admin-1",
  });

  // The appraisal transitioned and carries the board's decision.
  assert.ok(result);
  assert.equal(result!.status, "rolled_out");
  assert.equal(result!.finalVerdict, "Approved");
  assert.equal(result!.boardComment, "Strong year.");
  assert.equal(result!.rolledOutBy, "admin-1");

  // The employee now sits on the appraisal's new designation + pay band.
  const user = fake.getUser()!;
  assert.equal(user.gradeId, "des-2");
  assert.equal(user.gradeBandId, "band-2");
  assert.equal(fake.getApplyGradeCalls(), 1);
});

test("applyRollout: a second rollout (already rolled_out) is a no-op and returns undefined", async () => {
  const fake = makeFakeTx({
    appraisal: {
      id: "appr-1",
      pmId: "pm-1",
      status: "finalized",
      gradeId: "des-2",
      assignedBandId: "band-2",
    },
    user: { gradeId: "des-1", gradeBandId: "band-1" },
  });

  // First rollout succeeds and applies the grade.
  const first = await applyRollout(fake.tx, "appr-1", { finalVerdict: "Approved", boardComment: null, rolledOutBy: "admin-1" });
  assert.ok(first);
  assert.equal(fake.getApplyGradeCalls(), 1);

  // Second rollout finds the row already rolled out -> 0-row transition -> undefined,
  // and must NOT re-apply the grade.
  const second = await applyRollout(fake.tx, "appr-1", { finalVerdict: "Changed", boardComment: "late edit", rolledOutBy: "admin-2" });
  assert.equal(second, undefined);
  assert.equal(fake.getApplyGradeCalls(), 1, "grade must not be re-applied on the second call");

  // The board's original decision is untouched by the second attempt.
  const appraisal = fake.getAppraisal();
  assert.equal(appraisal.finalVerdict, "Approved");
  assert.equal(appraisal.boardComment, null);
});

test("applyRollout: a null gradeId/assignedBandId leaves the user's existing grade/band untouched", async () => {
  const fake = makeFakeTx({
    appraisal: {
      id: "appr-1",
      pmId: "pm-1",
      status: "finalized",
      gradeId: null, // ineligible/unsnapped appraisal carries no grade
      assignedBandId: null,
    },
    user: { gradeId: "des-1", gradeBandId: "band-1" },
  });

  const result = await applyRollout(fake.tx, "appr-1", { finalVerdict: "No increment", boardComment: null, rolledOutBy: "admin-1" });

  // The appraisal still transitions to rolled_out...
  assert.ok(result);
  assert.equal(result!.status, "rolled_out");

  // ...but the employee's current grade/band must NOT be wiped.
  const user = fake.getUser()!;
  assert.equal(user.gradeId, "des-1");
  assert.equal(user.gradeBandId, "band-1");
  assert.equal(fake.getApplyGradeCalls(), 0, "applyUserGrade must not run when there is nothing to set");
});

test("applyRollout: applies only the band when grade is null (partial fields)", async () => {
  const fake = makeFakeTx({
    appraisal: {
      id: "appr-1",
      pmId: "pm-1",
      status: "finalized",
      gradeId: null,
      assignedBandId: "band-2",
    },
    user: { gradeId: "des-1", gradeBandId: "band-1" },
  });

  await applyRollout(fake.tx, "appr-1", { finalVerdict: "Approved", boardComment: null, rolledOutBy: "admin-1" });

  const user = fake.getUser()!;
  assert.equal(user.gradeId, "des-1", "grade left untouched when appraisal carries no gradeId");
  assert.equal(user.gradeBandId, "band-2", "band applied from the appraisal");
  assert.equal(fake.getApplyGradeCalls(), 1);
});

// ---- Route-level guards --------------------------------------------------

type StoreSeed = { appraisal: any };

// A fake store + email/log capture for the rollout handler. rollOutAppraisal is
// only reachable once the route's guards pass; the route tests below assert the
// guards reject first, so it should never run in those cases.
function makeRouteFake(seed: StoreSeed & { bands?: any[] }) {
  const calls = { rollout: 0, notify: 0, email: 0, log: 0, updateAppraisal: 0, getBands: 0 };
  // A mutable copy so a draft->finalized updateAppraisal is visible to the
  // subsequent rollout transition check (which only flips a finalized row).
  let current = seed.appraisal ? { ...seed.appraisal } : undefined;
  const storage = {
    getAppraisalWithPm: async (_id: string) => (current ? { ...current } : undefined),
    updateAppraisal: async (_id: string, data: any) => {
      calls.updateAppraisal += 1;
      current = { ...(current as any), ...data };
      return { ...(current as any) };
    },
    updateAppraisalIfMutable: async (_id: string, data: any) => {
      calls.updateAppraisal += 1;
      // Mirror the real SQL gate: only a not-yet-rolled-out row is editable.
      if (!current || (current.status !== "draft" && current.status !== "finalized")) return undefined;
      current = { ...(current as any), ...data };
      return { ...(current as any) };
    },
    rollOutAppraisal: async (_id: string, data: RolloutData) => {
      calls.rollout += 1;
      // Mirror the real SQL gate: only a finalized row transitions.
      if (!current || current.status !== "finalized") return undefined;
      current = { ...current, status: "rolled_out", ...data };
      return { ...current };
    },
    createNotification: async (_n: any) => {
      calls.notify += 1;
      return {};
    },
    getAllSalaryGradeBands: async () => {
      calls.getBands += 1;
      return seed.bands ?? [];
    },
  };
  const logActivity = async () => {
    calls.log += 1;
  };
  const sendEmail = async () => {
    calls.email += 1;
    return { success: true };
  };
  return { storage, logActivity, sendEmail, calls };
}

async function withRolloutServer(
  fake: ReturnType<typeof makeRouteFake>,
  fn: (baseUrl: string) => Promise<void>,
) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.user = { claims: { sub: "admin-1" } };
    next();
  });
  app.post(
    "/api/kpi/appraisals/:id/rollout",
    makeRolloutHandler({
      storage: fake.storage as any,
      logActivity: fake.logActivity as any,
      sendEmail: fake.sendEmail as any,
      generateToken: () => "tok-fixed",
    }),
  );
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

async function rollout(baseUrl: string, id: string, body: any) {
  const res = await fetch(`${baseUrl}/api/kpi/appraisals/${id}/rollout`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
}

test("rollout route: a draft is finalized as part of locking, then rolled out", async () => {
  // New behavior: the board console locks a row directly; a still-draft row is
  // finalized first (status -> finalized via updateAppraisal) so the rollout
  // transition matches, then it rolls out.
  const fake = makeRouteFake({
    appraisal: { id: "appr-1", pmId: "pm-1", status: "draft", periodMonths: 12, periodEndMonth: 6, periodEndYear: 2026 },
  });
  await withRolloutServer(fake, async (baseUrl) => {
    const r = await rollout(baseUrl, "appr-1", { finalVerdict: "Approved" });
    assert.equal(r.status, 200);
    assert.equal(r.json.status, "rolled_out");
    assert.equal(fake.calls.rollout, 1);
    assert.equal(fake.calls.notify, 1);
    // updateAppraisal ran at least once to finalize the draft (+ token).
    assert.ok(fake.calls.updateAppraisal >= 1);
  });
});

test("rollout route: applies the board's inline band edit before locking", async () => {
  const fake = makeRouteFake({
    appraisal: {
      id: "appr-1",
      pmId: "pm-1",
      status: "finalized",
      gradeId: "des-1",
      currentSalary: "1000.00",
      assignedSalary: "1000.00",
      periodMonths: 12,
      periodEndMonth: 6,
      periodEndYear: 2026,
    },
    bands: [
      { id: "band-2", designationId: "des-1", gradeCode: "G2", salaryAmount: "1500.00" },
      { id: "band-x", designationId: "des-OTHER", gradeCode: "GX", salaryAmount: "9999.00" },
    ],
  });
  await withRolloutServer(fake, async (baseUrl) => {
    const r = await rollout(baseUrl, "appr-1", { finalVerdict: "Approved", assignedBandId: "band-2" });
    assert.equal(r.status, 200);
    assert.equal(r.json.status, "rolled_out");
    // Bands were consulted and the override persisted via updateAppraisal.
    assert.equal(fake.calls.getBands, 1);
    assert.ok(fake.calls.updateAppraisal >= 1);
    assert.equal(fake.calls.rollout, 1);
  });
});

test("rollout route: rejects an inline band that isn't in the appraisal's designation", async () => {
  const fake = makeRouteFake({
    appraisal: {
      id: "appr-1",
      pmId: "pm-1",
      status: "finalized",
      gradeId: "des-1",
      currentSalary: "1000.00",
      assignedSalary: "1000.00",
      periodMonths: 12,
      periodEndMonth: 6,
      periodEndYear: 2026,
    },
    bands: [{ id: "band-x", designationId: "des-OTHER", gradeCode: "GX", salaryAmount: "9999.00" }],
  });
  await withRolloutServer(fake, async (baseUrl) => {
    const r = await rollout(baseUrl, "appr-1", { finalVerdict: "Approved", assignedBandId: "band-x" });
    assert.equal(r.status, 400);
    assert.match(r.json.message, /Band not found/);
    // Guard rejected before any locking/notify.
    assert.equal(fake.calls.rollout, 0);
    assert.equal(fake.calls.notify, 0);
  });
});

test("rollout route: rejects when the final verdict is missing", async () => {
  const fake = makeRouteFake({
    appraisal: { id: "appr-1", pmId: "pm-1", status: "finalized", periodMonths: 12, periodEndMonth: 6, periodEndYear: 2026 },
  });
  await withRolloutServer(fake, async (baseUrl) => {
    // Blank/whitespace verdict is treated as missing.
    const r = await rollout(baseUrl, "appr-1", { finalVerdict: "   " });
    assert.equal(r.status, 400);
    assert.match(r.json.message, /final verdict is required/);
    assert.equal(fake.calls.rollout, 0);
  });
});

test("rollout route: an already rolled-out appraisal returns alreadyRolledOut without re-applying", async () => {
  const fake = makeRouteFake({
    appraisal: { id: "appr-1", pmId: "pm-1", status: "rolled_out", periodMonths: 12, periodEndMonth: 6, periodEndYear: 2026 },
  });
  await withRolloutServer(fake, async (baseUrl) => {
    const r = await rollout(baseUrl, "appr-1", { finalVerdict: "Approved" });
    assert.equal(r.status, 200);
    assert.equal(r.json.alreadyRolledOut, true);
    assert.equal(fake.calls.rollout, 0);
    assert.equal(fake.calls.notify, 0);
    assert.equal(fake.calls.email, 0);
  });
});

test("rollout route: happy path rolls out, notifies, emails, and logs", async () => {
  const fake = makeRouteFake({
    appraisal: {
      id: "appr-1",
      pmId: "pm-1",
      status: "finalized",
      eligible: true,
      periodMonths: 12,
      periodEndMonth: 6,
      periodEndYear: 2026,
      pm: { email: "pm@example.com", firstName: "Pat", lastName: "Lee" },
    },
  });
  await withRolloutServer(fake, async (baseUrl) => {
    const r = await rollout(baseUrl, "appr-1", { finalVerdict: "Approved", boardComment: "Great work" });
    assert.equal(r.status, 200);
    assert.equal(r.json.status, "rolled_out");
    assert.equal(r.json.emailSent, true);
    assert.equal(fake.calls.rollout, 1);
    assert.equal(fake.calls.notify, 1);
    assert.equal(fake.calls.email, 1);
    assert.equal(fake.calls.log, 1);
  });
});

test("performRollout: a concurrent lock during an inline edit returns alreadyRolledOut and never mutates the locked row", async () => {
  // Simulate the race: the row is read as "finalized", but a concurrent request
  // locks it before this request's pay-affecting override write lands. The
  // status-guarded updateAppraisalIfMutable must refuse the write and the flow
  // must report alreadyRolledOut without re-rolling or notifying.
  let writeAttempts = 0;
  let rolloutAttempts = 0;
  const locked = {
    id: "appr-1",
    pmId: "pm-1",
    status: "rolled_out",
    gradeId: "des-1",
    currentSalary: "1000.00",
    assignedSalary: "1500.00",
    assignedBandId: "band-2",
    periodMonths: 12,
    periodEndMonth: 6,
    periodEndYear: 2026,
  };
  const storage = {
    // First read sees a still-finalized row (the board's snapshot); after the
    // concurrent lock, every later read returns the locked record.
    getAppraisalWithPm: async () => (writeAttempts === 0 ? { ...locked, status: "finalized" } : { ...locked }),
    updateAppraisal: async () => {
      throw new Error("updateAppraisal must not run once the row is locked");
    },
    updateAppraisalIfMutable: async () => {
      // The concurrent rollout already flipped the row to rolled_out, so the
      // guarded write matches 0 rows.
      writeAttempts += 1;
      return undefined;
    },
    rollOutAppraisal: async () => {
      rolloutAttempts += 1;
      return undefined;
    },
    createNotification: async () => {
      throw new Error("must not notify when already rolled out");
    },
    getAllSalaryGradeBands: async () => [
      { id: "band-2", designationId: "des-1", gradeCode: "G2", salaryAmount: "1500.00" },
    ],
  };
  const result = await performRollout(
    {
      storage: storage as any,
      logActivity: async () => {},
      sendEmail: async () => ({ success: true }),
      generateToken: () => "tok-fixed",
    },
    { id: "appr-1", finalVerdict: "Approved", assignedBandId: "band-2", adminId: "admin-1", baseUrl: "http://x" },
  );
  assert.equal(result.ok, true);
  assert.equal((result as any).alreadyRolledOut, true);
  assert.equal(writeAttempts, 1); // the guarded write was attempted once
  assert.equal(rolloutAttempts, 0); // never reached the lock transition
});

test("performRollout: a draft locked by a concurrent request is not re-finalized or rolled out twice", async () => {
  // The draft race with NO inline edits: the row is read as "draft", but a
  // concurrent request locks it before this request finalizes. The guarded
  // finalize write must match 0 rows so we never revert rolled_out -> finalized
  // (which would let it roll out a second time and double-notify).
  let finalizeAttempts = 0;
  let rolloutAttempts = 0;
  let notifyCount = 0;
  const storage = {
    // First read: still a draft. After the concurrent lock, reads return locked.
    getAppraisalWithPm: async () =>
      finalizeAttempts === 0
        ? { id: "appr-1", pmId: "pm-1", status: "draft", periodMonths: 12, periodEndMonth: 6, periodEndYear: 2026 }
        : { id: "appr-1", pmId: "pm-1", status: "rolled_out", periodMonths: 12, periodEndMonth: 6, periodEndYear: 2026 },
    updateAppraisal: async () => {
      throw new Error("un-guarded updateAppraisal must not run in the rollout path");
    },
    updateAppraisalIfMutable: async () => {
      // The concurrent rollout already flipped the row, so the guarded finalize
      // matches 0 rows.
      finalizeAttempts += 1;
      return undefined;
    },
    rollOutAppraisal: async () => {
      rolloutAttempts += 1;
      return undefined;
    },
    createNotification: async () => {
      notifyCount += 1;
      return {};
    },
    getAllSalaryGradeBands: async () => [],
  };
  const result = await performRollout(
    {
      storage: storage as any,
      logActivity: async () => {},
      sendEmail: async () => ({ success: true }),
      generateToken: () => "tok-fixed",
    },
    { id: "appr-1", finalVerdict: "Approved", adminId: "admin-1", baseUrl: "http://x" },
  );
  assert.equal(result.ok, true);
  assert.equal((result as any).alreadyRolledOut, true);
  assert.equal(finalizeAttempts, 1); // guarded finalize attempted once, matched nothing
  assert.equal(rolloutAttempts, 0); // never reached the lock transition
  assert.equal(notifyCount, 0); // no duplicate notification
});

// ---- computeRolloutOverride (inline final-grade / final-salary math) --------

test("computeRolloutOverride: picking a band sets band + grade code + the band's basic salary and the increment", () => {
  const update = computeRolloutOverride(
    { currentSalary: "1000.00", assignedSalary: "1000.00" },
    { assignedBandId: "band-2" },
    [{ id: "band-2", designationId: "des-1", gradeCode: "G2", salaryAmount: "1500.00" }],
  );
  assert.equal(update.assignedBandId, "band-2");
  assert.equal(update.assignedGradeCode, "G2");
  assert.equal(update.bandOverridden, true);
  assert.equal(update.assignedSalary, "1500.00");
  assert.equal(update.finalIncrement, "500.00");
});

test("computeRolloutOverride: an explicit final salary wins over the band's basic", () => {
  const update = computeRolloutOverride(
    { currentSalary: "1000.00", assignedSalary: "1000.00" },
    { assignedBandId: "band-2", assignedSalary: 1800 },
    [{ id: "band-2", designationId: "des-1", gradeCode: "G2", salaryAmount: "1500.00" }],
  );
  assert.equal(update.assignedBandId, "band-2");
  assert.equal(update.assignedSalary, "1800.00");
  assert.equal(update.salaryOverridden, true);
  assert.equal(update.finalIncrement, "800.00");
});

test("computeRolloutOverride: a salary-only edit recomputes the increment without touching the band", () => {
  const update = computeRolloutOverride(
    { currentSalary: "1000.00", assignedSalary: "1200.00" },
    { assignedSalary: "1300" },
    [],
  );
  assert.equal(update.assignedBandId, undefined);
  assert.equal(update.salaryOverridden, true);
  assert.equal(update.assignedSalary, "1300.00");
  assert.equal(update.finalIncrement, "300.00");
});

test("computeRolloutOverride: an unknown band throws", () => {
  assert.throws(
    () => computeRolloutOverride({ currentSalary: "1000", assignedSalary: null }, { assignedBandId: "nope" }, []),
    /Band not found/,
  );
});

test("computeRolloutOverride: a negative final salary throws", () => {
  assert.throws(
    () => computeRolloutOverride({ currentSalary: "1000", assignedSalary: null }, { assignedSalary: -5 }, []),
    /cannot be negative/,
  );
});

test("computeRolloutOverride: no edits produce an empty update", () => {
  const update = computeRolloutOverride({ currentSalary: "1000", assignedSalary: "1000" }, {}, []);
  assert.deepEqual(update, {});
});
