// Board "Rollout" logic, extracted from routes.ts + storage.ts so the
// pay-affecting transition can be unit-tested in isolation. The real route
// handler and storage transaction below delegate to these helpers, so the tests
// exercise exactly the code paths that run in production.
//
// Two pieces live here:
//   1. applyRollout — the pure, transaction-scoped rollout logic: flip a
//      "finalized" appraisal to "rolled_out" and apply its grade/band to the
//      employee. Storage.rollOutAppraisal wraps this in a db.transaction.
//   2. makeRolloutHandler — the express handler factory (guards + notify/email
//      orchestration) with its dependencies injected so a fake store can drive it.

import type { RequestHandler } from "express";
import type { ActivityAction, ActivityEntity } from "@shared/schema";
import { AppraisalOverrideError } from "./appraisalMath";

// The minimal appraisal shape the rollout logic reads from / returns.
export type RolloutAppraisal = {
  id: string;
  pmId: string | null;
  status: string;
  gradeId: string | null;
  assignedBandId: string | null;
  [k: string]: any;
};

export type RolloutData = {
  finalVerdict: string | null;
  boardComment: string | null;
  rolledOutBy: string | null;
};

// Transaction-scoped operations the rollout needs. Implemented in storage.ts
// against a real Drizzle tx; faked in tests.
export interface RolloutTx<T extends RolloutAppraisal = RolloutAppraisal> {
  // Flip ONLY a "finalized" row to "rolled_out". Returns the updated row, or
  // undefined when no finalized row matched (already rolled out / wrong status).
  transitionToRolledOut(id: string, data: RolloutData): Promise<T | undefined>;
  // Apply the appraisal's designation + pay band to the employee. May optionally
  // return a further-updated appraisal (e.g. carrying a prior-grade snapshot so
  // an accidental rollout can be undone), which becomes the rollout's result.
  applyUserGrade(userId: string, fields: { gradeId?: string; gradeBandId?: string }): Promise<T | void>;
}

// Atomic-idempotent rollout. The transition gate (transitionToRolledOut) only
// matches a "finalized" row, so a repeat call on an already rolled-out appraisal
// returns undefined and never re-applies grades. A null gradeId/assignedBandId
// leaves the employee's current value untouched (we only set fields present).
export async function applyRollout<T extends RolloutAppraisal>(
  tx: RolloutTx<T>,
  id: string,
  data: RolloutData,
): Promise<T | undefined> {
  const updated = await tx.transitionToRolledOut(id, data);
  if (!updated) return undefined;

  const userUpdate: { gradeId?: string; gradeBandId?: string } = {};
  if (updated.gradeId) userUpdate.gradeId = updated.gradeId;
  if (updated.assignedBandId) userUpdate.gradeBandId = updated.assignedBandId;
  if (updated.pmId && Object.keys(userUpdate).length > 0) {
    const afterApply = await tx.applyUserGrade(updated.pmId, userUpdate);
    if (afterApply) return afterApply;
  }

  return updated;
}

// Dependencies the route handler needs, injected so tests can supply fakes.
export interface RolloutHandlerStorage {
  getAppraisalWithPm(id: string): Promise<any | undefined>;
  updateAppraisal(id: string, data: any): Promise<any>;
  // Status-guarded update: only writes when the row is still "draft" or
  // "finalized" (i.e. not yet rolled out). Returns the updated row, or undefined
  // if a concurrent request already locked it. Used for pay-affecting edits so a
  // late override can never mutate an already rolled-out appraisal.
  updateAppraisalIfMutable(id: string, data: any): Promise<any | undefined>;
  rollOutAppraisal(id: string, data: RolloutData): Promise<any | undefined>;
  createNotification(notification: any): Promise<any>;
  // Needed only when the board edits a row's final grade/salary at lock time.
  getAllSalaryGradeBands(): Promise<any[]>;
}

// A pay band the board may assign at rollout time. Mirrors the columns the
// override math reads (id + grade code + basic salary).
export type RolloutBand = {
  id: string;
  designationId?: string | null;
  gradeCode?: string | null;
  salaryAmount?: string | null;
};

export type RolloutOverrideInput = {
  // A band id to assign, "" / null to clear the band, or undefined to leave it.
  assignedBandId?: unknown;
  // An explicit final salary, or undefined to leave it (falls back to the band's basic).
  assignedSalary?: unknown;
};

export type RolloutOverrideUpdate = {
  assignedBandId?: string | null;
  assignedGradeCode?: string | null;
  assignedSalary?: string;
  bandOverridden?: boolean;
  salaryOverridden?: boolean;
  finalIncrement?: string;
};

// Translate the board's inline final-grade / final-salary edits (made on the
// roll-out console) into the appraisal columns to persist BEFORE locking.
// Picking a band sets the band + its grade code and defaults the salary to that
// band's basic; an explicit final salary then wins over the band's basic. The
// final increment is recomputed against the current salary. Throws
// AppraisalOverrideError on an unknown band or an invalid/negative salary so the
// route can surface a 400. An empty result means there was nothing to change.
export function computeRolloutOverride(
  existing: { currentSalary: string | null; assignedSalary: string | null },
  body: RolloutOverrideInput,
  bands: RolloutBand[],
): RolloutOverrideUpdate {
  const update: RolloutOverrideUpdate = {};
  const parseSalary = (v: string | null): number | null =>
    v != null && v !== "" && Number.isFinite(parseFloat(v)) ? parseFloat(v) : null;

  let assignedSalary: number | null = parseSalary(existing.assignedSalary);

  if (body.assignedBandId !== undefined) {
    if (body.assignedBandId === null || body.assignedBandId === "") {
      // Board cleared the band — drop the band + its grade-code snapshot.
      update.assignedBandId = null;
      update.assignedGradeCode = null;
      update.bandOverridden = true;
    } else {
      const band = bands.find((b) => b.id === body.assignedBandId);
      if (!band) throw new AppraisalOverrideError("Band not found");
      update.assignedBandId = band.id;
      update.assignedGradeCode = band.gradeCode ?? null;
      update.bandOverridden = true;
      const bandSalary = parseSalary(band.salaryAmount ?? null);
      if (bandSalary != null) assignedSalary = bandSalary;
    }
  }

  if (body.assignedSalary !== undefined && body.assignedSalary !== null && body.assignedSalary !== "") {
    const n = typeof body.assignedSalary === "number" ? body.assignedSalary : parseFloat(String(body.assignedSalary));
    if (!Number.isFinite(n)) throw new AppraisalOverrideError("Invalid final salary");
    if (n < 0) throw new AppraisalOverrideError("Final salary cannot be negative");
    assignedSalary = n;
    update.salaryOverridden = true;
  }

  // Re-derive the salary snapshot + increment whenever a band or salary changed.
  if ((update.assignedBandId !== undefined || update.salaryOverridden) && assignedSalary != null) {
    update.assignedSalary = assignedSalary.toFixed(2);
    const cur = parseSalary(existing.currentSalary) ?? 0;
    update.finalIncrement = (assignedSalary - cur).toFixed(2);
  }

  return update;
}

export type RolloutEmailSender = (
  user: { email?: string | null; firstName?: string | null; lastName?: string | null },
  ctx: { reportUrl: string; cycleLabel: string; finalVerdict?: string | null; boardComment?: string | null; eligible: boolean },
) => Promise<{ success: boolean; error?: string }>;

export type RolloutLogActivity = (
  userId: string | null,
  action: ActivityAction,
  entity: ActivityEntity,
  entityId?: string,
  details?: string,
  req?: any,
) => Promise<void>;

// All the dependencies the rollout flow needs, injected so tests (and the batch
// route) can supply fakes / share one set.
export interface RolloutDeps {
  storage: RolloutHandlerStorage;
  logActivity: RolloutLogActivity;
  sendEmail: RolloutEmailSender;
  generateToken: () => string;
}

// One appraisal's roll-out request, decoupled from express so it can be driven
// by both the single-row route and the batch route (loop), or a test.
export interface PerformRolloutParams {
  id: string;
  finalVerdict?: unknown;
  boardComment?: unknown;
  // Optional inline final-grade / final-salary edits applied before locking.
  assignedBandId?: unknown;
  assignedSalary?: unknown;
  adminId: string | null;
  baseUrl: string; // e.g. "https://host" — used to build the report link
  req?: any; // forwarded to logActivity for request context
}

export type PerformRolloutResult =
  | { ok: true; appraisal: any; emailSent: boolean; alreadyRolledOut?: boolean }
  | { ok: false; status: number; message: string };

// The board's final sign-off for ONE appraisal: optionally apply the board's
// inline grade/salary edits, finalize a still-draft row, then atomically lock it
// (apply the new grade/band to the employee) and notify them. Idempotent — a row
// already rolled out (or won by a concurrent request) returns alreadyRolledOut
// without re-applying or re-notifying. Pay-affecting, so guards run first.
export async function performRollout(deps: RolloutDeps, params: PerformRolloutParams): Promise<PerformRolloutResult> {
  const { storage, logActivity, sendEmail, generateToken } = deps;
  const { id, adminId } = params;

  const appraisal = await storage.getAppraisalWithPm(id);
  if (!appraisal) return { ok: false, status: 404, message: "Appraisal not found" };

  // Already rolled out — return the current record, don't re-apply or re-notify.
  if (appraisal.status === "rolled_out") {
    return { ok: true, appraisal: { ...appraisal, alreadyRolledOut: true }, emailSent: false, alreadyRolledOut: true };
  }
  // A draft is finalized as part of locking (below); any other status can't roll out.
  if (appraisal.status !== "finalized" && appraisal.status !== "draft") {
    return { ok: false, status: 400, message: "This appraisal can't be rolled out from its current state." };
  }

  const finalVerdictRaw = typeof params.finalVerdict === "string" ? params.finalVerdict.trim() : "";
  if (!finalVerdictRaw) {
    return { ok: false, status: 400, message: "A final verdict is required to roll out." };
  }
  const finalVerdict = finalVerdictRaw.slice(0, 200);
  const boardCommentRaw = typeof params.boardComment === "string" ? params.boardComment.trim() : "";
  const boardComment = boardCommentRaw ? boardCommentRaw.slice(0, 4000) : null;

  // Persist the board's inline final-grade / final-salary edits (if any) BEFORE
  // locking, since rollOutAppraisal applies the appraisal's gradeId + assignedBandId
  // to the employee.
  let working = appraisal;
  if (params.assignedBandId !== undefined || params.assignedSalary !== undefined) {
    const allBands = await storage.getAllSalaryGradeBands();
    // Grades can only be assigned within the appraisal's own designation.
    const designationBands = appraisal.gradeId
      ? allBands.filter((b: any) => b.designationId === appraisal.gradeId)
      : [];
    let ov: RolloutOverrideUpdate;
    try {
      ov = computeRolloutOverride(appraisal, { assignedBandId: params.assignedBandId, assignedSalary: params.assignedSalary }, designationBands);
    } catch (e: any) {
      if (e instanceof AppraisalOverrideError) return { ok: false, status: 400, message: e.message };
      throw e;
    }
    if (Object.keys(ov).length > 0) {
      // Status-guarded: if a concurrent request already locked this row, skip the
      // pay-affecting edit entirely and report it as already rolled out — never
      // mutate a locked appraisal's final grade/salary.
      const updated = await storage.updateAppraisalIfMutable(id, ov);
      if (!updated) {
        const current = await storage.getAppraisalWithPm(id);
        return { ok: true, appraisal: { ...current, alreadyRolledOut: true }, emailSent: false, alreadyRolledOut: true };
      }
      working = { ...working, ...updated };
    }
  }

  // Finalize a still-draft row so the rollout transition (finalized -> rolled_out)
  // matches. Status-guarded: if a concurrent request already locked the row, this
  // write matches 0 rows — never revert a rolled_out row back to finalized (which
  // would let it roll out twice). Bail out as alreadyRolledOut instead.
  if (working.status === "draft") {
    const finalized = await storage.updateAppraisalIfMutable(id, { status: "finalized" });
    if (!finalized) {
      const current = await storage.getAppraisalWithPm(id);
      return { ok: true, appraisal: { ...current, alreadyRolledOut: true }, emailSent: false, alreadyRolledOut: true };
    }
  }

  // Ensure a no-login share token exists so the email link works even when the
  // employee isn't signed in. Status-guarded for the same reason as above.
  let shareToken = working.shareToken;
  if (!shareToken) {
    shareToken = generateToken();
    const tokened = await storage.updateAppraisalIfMutable(id, { shareToken });
    if (!tokened) {
      const current = await storage.getAppraisalWithPm(id);
      return { ok: true, appraisal: { ...current, alreadyRolledOut: true }, emailSent: false, alreadyRolledOut: true };
    }
  }

  const updated = await storage.rollOutAppraisal(id, {
    finalVerdict,
    boardComment,
    rolledOutBy: adminId ?? null,
  });
  // 0 rows updated means a concurrent request already rolled it out — return
  // the current record without re-applying grades or re-notifying.
  if (!updated) {
    const current = await storage.getAppraisalWithPm(id);
    return { ok: true, appraisal: { ...current, alreadyRolledOut: true }, emailSent: false, alreadyRolledOut: true };
  }

  const publicUrl = `${params.baseUrl}/r/appraisal/${shareToken}`;
  const cycleLen = appraisal.periodMonths === 12 ? "Annual" : `${appraisal.periodMonths}-month`;
  const cycleLabel = `${cycleLen} appraisal ending ${appraisal.periodEndMonth}/${appraisal.periodEndYear}`;

  // In-app notification (fail-soft).
  try {
    if (appraisal.pmId) {
      await storage.createNotification({
        userId: appraisal.pmId,
        type: "appraisal_rollout",
        title: "Your appraisal is final",
        message: `The board has rolled out your ${cycleLabel}. Verdict: ${finalVerdict}.${boardComment ? ` Comment: ${boardComment}` : ""} View your report: ${publicUrl}`,
        createdBy: adminId ?? null,
      } as any);
    }
  } catch (notifyErr) {
    console.error("Rollout notification failed (non-fatal):", notifyErr);
  }

  // Email with a link to the report (fail-soft — SMTP may be unconfigured).
  let emailSent = false;
  try {
    if (appraisal.pm?.email) {
      const result = await sendEmail(appraisal.pm, {
        reportUrl: publicUrl,
        cycleLabel,
        finalVerdict,
        boardComment,
        eligible: appraisal.eligible,
      });
      emailSent = result.success;
    }
  } catch (emailErr) {
    console.error("Rollout email failed (non-fatal):", emailErr);
  }

  const personName = [appraisal.pm?.firstName, appraisal.pm?.lastName].filter(Boolean).join(" ").trim() || "employee";
  // "appraisal" is recorded in the varchar activity-log entity column even
  // though it isn't in the ActivityEntity union (matches the other appraisal
  // routes); cast keeps this faithful port type-clean.
  await logActivity(adminId, "update", "appraisal" as ActivityEntity, id, `Rolled out appraisal for ${personName} (verdict: ${finalVerdict})`, params.req);
  return { ok: true, appraisal: { ...updated, emailSent }, emailSent };
}

// Express handler for the single-row roll-out route — a thin wrapper over
// performRollout.
export function makeRolloutHandler(deps: RolloutDeps): RequestHandler {
  return async (req: any, res) => {
    try {
      const result = await performRollout(deps, {
        id: req.params.id,
        finalVerdict: req.body?.finalVerdict,
        boardComment: req.body?.boardComment,
        assignedBandId: req.body?.assignedBandId,
        assignedSalary: req.body?.assignedSalary,
        adminId: req.user?.claims?.sub ?? null,
        baseUrl: `${req.protocol}://${req.get("host")}`,
        req,
      });
      if (!result.ok) return res.status(result.status).json({ message: result.message });
      res.json(result.appraisal);
    } catch (error) {
      console.error("Error rolling out appraisal:", error);
      res.status(500).json({ message: "Failed to roll out appraisal" });
    }
  };
}
