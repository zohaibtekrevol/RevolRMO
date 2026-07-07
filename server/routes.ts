import type { Express, RequestHandler } from "express";
import type { Server } from "http";
import express from "express";
import crypto from "crypto";
import { z } from "zod";
import { storage, PodMembershipValidationError } from "./storage";
import { getUpsellAnalysisStats, totalDataPoints } from "./upsellAnalysis";
import {
  configuredProviders,
  isProviderConfigured,
  generateUpsellInsights,
  generateAppraisalAnalysis,
  type AppraisalAnalysisInput,
  ProviderNotConfiguredError,
} from "./aiProviders";
import {
  settleLinkedInvoiceForReceivedPayment as settleLinkedInvoice,
  revertLinkedInvoiceForUnreceivedPayment as revertLinkedInvoice,
} from "./invoiceSettlement";
import {
  computeServedMonths,
  computeAppraisal,
  recomputeOverride,
  calculateKpiScore,
  computePmAverageScore,
  AppraisalOverrideError,
  makeGenerateAppraisalsHandler,
} from "./appraisalMath";
import { makeRolloutHandler, performRollout } from "./appraisalRollout";
import {
  sanitizeClientText,
  buildMilestoneLedgerEntry,
  applyRunningBalance,
} from "./statementLedger";
import { setupAuth, isAuthenticated } from "./googleAuth";
import { ObjectStorageService, ObjectNotFoundError } from "./replit_integrations/object_storage";
import {
  getUncachableDriveClient,
  uploadFileToFolder,
  getFileMetadata,
  downloadFileStream,
  listFolderChildren,
  isDriveConnected,
  DriveNotConnectedError,
} from "./googleDrive/driveService";
import { getOrCreateProjectFolders } from "./googleDrive/projectFolders";
import { uploadInvoicePdfToDrive, uploadReceiptPdfToDrive } from "./googleDrive/documentUploads";
import { RATE_LIMIT_CONFIG } from "./securityConfig";
import { setupPresenceWebSocket } from "./presence";
import Papa from "papaparse";
import { 
  insertProjectSchema, 
  insertPaymentSchema, 
  insertPaymentCommentSchema,
  type PaymentCommentWithUser,
  insertMonthlyPlanSchema,
  insertActivityLogSchema,
  insertUserSchema,
  updateAppSettingsSchema,
  insertPmTargetSchema,
  insertPodSchema,
  updatePodSchema,
  type PodMoveStrategy,
  insertPodTargetOverrideSchema,
  insertUpsellSchema,
  updateUpsellSchema,
  insertUpsellActivitySchema,
  insertRoleSchema,
  updateRoleSchema,
  insertMilestoneSchema,
  updateMilestoneSchema,
  insertChangeRequestSchema,
  updateChangeRequestSchema,
  insertCrTagSchema,
  updateCrInstallmentSchema,
  insertInvoiceSchema,
  updateInvoiceSchema,
  insertInvoiceLineItemSchema,
  insertTimesheetSchema,
  updateTimesheetSchema,
  insertProjectEstimatedCostSchema,
  updateProjectEstimatedCostSchema,
  insertProjectActualCostSchema,
  updateProjectActualCostSchema,
  insertVendorCostSchema,
  updateVendorCostSchema,
  insertToolCostSchema,
  updateToolCostSchema,
  insertMarginSettingsSchema,
  updateMarginSettingsSchema,
  timesheetStatuses,
  paymentStatuses,
  paymentTypes,
  upsellStatuses,
  upsellAiProviders,
  upsellAnalysisScopes,
  type UpsellAnalysisScope,
  milestoneStatuses,
  projectBillingTypes,
  invoiceStatuses,
  systemPermissions,
  type Region,
  type PaymentStatus,
  type PaymentType,
  type ActivityAction,
  type ActivityEntity,
  type Project,
  type Payment,
  type UpsellStatus,
  type SystemPermission,
  type MilestoneStatus,
  type ProjectBillingType,
  type InvoiceStatus,
  type TimesheetStatus,
  type NotificationWithDetails,
  type AppraisalReport,
  type AppraisalWithPm,
  type SalaryGradeBand,
  insertKpiParameterSchema,
  insertKpiLevelSchema,
  insertKpiLevelScoreSchema,
  insertKpiMonthlyReviewSchema,
  insertKpiGraceScoreSchema,
  insertGradeSchema,
  insertSalaryGradeBandSchema,
  insertPodMembershipSchema,
} from "@shared/schema";
import { buildAscendingGradeCandidates } from "@shared/appraisalGrades";

// In-memory undo registry for project deletions (30 second window)
interface UndoEntry {
  project: Project;
  payments: Payment[];
  expiresAt: number;
}
const projectUndoRegistry = new Map<string, UndoEntry>();

// In-memory undo registry for import operations (30 second window)
interface ImportUndoEntry {
  createdPaymentIds: string[];
  createdMilestoneIds: string[];
  expiresAt: number;
}
const importUndoRegistry = new Map<string, ImportUndoEntry>();

// Cleanup expired undo entries every 10 seconds
setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of projectUndoRegistry.entries()) {
    if (entry.expiresAt < now) {
      projectUndoRegistry.delete(token);
    }
  }
  for (const [token, entry] of importUndoRegistry.entries()) {
    if (entry.expiresAt < now) {
      importUndoRegistry.delete(token);
    }
  }
}, 10000);
import { 
  triggerPaymentReceivedNotification, 
  triggerInvoicePendingNotification,
  triggerMilestoneReadyNotification,
  checkAndSendDueDateReminders,
  sendNotification,
  sendEmail,
  getEmailServiceStatus,
  sendPasswordResetEmail,
  sendUserInviteEmail,
  testSMTPConnection,
  sendTestEmail,
  clearTransporterCache,
  sendBucketStatusNotification,
  sendTimesheetApprovalNotification,
  sendAppraisalRolloutEmail,
} from "./emailService";

const isAdmin: RequestHandler = async (req: any, res, next) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const user = await storage.getUser(userId);
    if (!user || (user.role !== "admin" && user.role !== "administrator")) {
      return res.status(403).json({ message: "Forbidden: Admin access required" });
    }
    next();
  } catch (error) {
    return res.status(500).json({ message: "Authorization check failed" });
  }
};

const requirePermission = (...requiredPermissions: SystemPermission[]): RequestHandler => {
  return async (req: any, res, next) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ message: "Unauthorized: User not found" });
      }
      
      // Legacy admin fallback: users with role === "admin" or "administrator" have all permissions
      if (user.role === "admin" || user.role === "administrator") {
        req.userPermissions = requiredPermissions;
        return next();
      }
      
      const userPermissions = await storage.getUserPermissions(userId);
      
      const hasPermission = requiredPermissions.some(perm => userPermissions.includes(perm));
      if (!hasPermission) {
        return res.status(403).json({ 
          message: `Forbidden: Required permission(s): ${requiredPermissions.join(' or ')}` 
        });
      }
      
      req.userPermissions = userPermissions;
      next();
    } catch (error) {
      console.error("Permission check failed:", error);
      return res.status(500).json({ message: "Authorization check failed" });
    }
  };
};

// Internal helper for server-side activity logging
async function logActivityInternal(
  userId: string | null,
  action: ActivityAction,
  entity: ActivityEntity,
  entityId?: string,
  details?: string,
  req?: any
): Promise<void> {
  try {
    const logData = {
      userId,
      action,
      entity,
      entityId: entityId || null,
      details: details || null,
      ipAddress: req?.ip || null,
      userAgent: req?.headers?.["user-agent"] || null,
    };
    
    const parsed = insertActivityLogSchema.safeParse(logData);
    if (!parsed.success) {
      console.error("Activity log validation failed:", parsed.error.errors);
      return;
    }
    
    await storage.createActivityLog(parsed.data);
  } catch (error) {
    console.error("Failed to log activity:", error);
  }
}

// Settle a payment's linked invoice in full when that payment is marked received.
// Thin wrapper that injects the real storage + activity logger into the shared,
// unit-tested settlement helper in ./invoiceSettlement.
async function settleLinkedInvoiceForReceivedPayment(
  paymentId: string,
  paidDate: Date,
  userId: string | null,
  req?: any
) {
  return settleLinkedInvoice(storage, logActivityInternal, paymentId, paidDate, userId, req);
}

// Helper function to calculate bucket status for a single project and send notification if needed
async function checkAndNotifyBucketStatus(projectId: string): Promise<void> {
  try {
    const project = await storage.getProject(projectId);
    if (!project || !project.pmId) return;

    // Get app settings for global values
    const appSettings = await storage.getAppSettings();
    const globalProfitabilityPercent = parseFloat(appSettings?.defaultProfitabilityPercent || "25");
    const globalVarianceHours = parseFloat(appSettings?.defaultVarianceHours || "10");
    
    // Get hourly rates from settings
    const hourlyRates = {
      CA: parseFloat(appSettings?.hourlyRateCA || "75"),
      TX: parseFloat(appSettings?.hourlyRateTX || "75"),
      AE: parseFloat(appSettings?.hourlyRateAE || "75"),
    };

    // Calculate project values
    const baseCost = parseFloat(project.cost || "0");
    
    // Get converted upsells
    const upsellTotals = await storage.getConvertedUpsellsTotalByProject();
    const upsellAmount = upsellTotals.get(projectId) || 0;
    const projectValue = baseCost + upsellAmount;

    // Get rates and settings (with overrides)
    const hourlyRate = project.overrideHourlyRate 
      ? parseFloat(project.overrideHourlyRate) 
      : (hourlyRates[project.region as keyof typeof hourlyRates] || 75);
    const profitabilityPercent = project.overrideProfitabilityPercent
      ? parseFloat(project.overrideProfitabilityPercent)
      : globalProfitabilityPercent;
    const varianceHours = project.overrideVarianceHours
      ? parseFloat(project.overrideVarianceHours)
      : globalVarianceHours;

    // Calculate bucket values
    const totalHourBucket = hourlyRate > 0 ? projectValue / hourlyRate : 0;
    const profitReservedHours = totalHourBucket * (profitabilityPercent / 100);
    const implementationHours = totalHourBucket - profitReservedHours;
    const calculatedAvailableHours = implementationHours + varianceHours;
    const finalAvailableHours = project.overrideAvailableHours 
      ? parseFloat(project.overrideAvailableHours)
      : calculatedAvailableHours;

    // Get consumed hours from approved timesheets only
    const timesheets = await storage.getAllTimesheets({ projectId, status: "approved" as any });
    const consumedHours = timesheets.reduce((sum, t) => sum + parseFloat(t.hoursLogged || "0"), 0);

    const remainingHours = finalAvailableHours - consumedHours;
    const utilizationPercent = finalAvailableHours > 0 
      ? (consumedHours / finalAvailableHours) * 100 
      : 0;

    // Determine bucket status
    let currentStatus: "on_track" | "warning" | "critical" = "on_track";
    if (utilizationPercent >= 100) {
      currentStatus = "critical";
    } else if (utilizationPercent >= 80) {
      currentStatus = "warning";
    }

    const previousStatus = project.lastBucketStatus;

    // Only send notification if status changed TO warning or critical (not from)
    const shouldNotify = 
      (currentStatus === "warning" && previousStatus !== "warning") ||
      (currentStatus === "critical" && previousStatus !== "critical");

    if (shouldNotify) {
      const pm = await storage.getUser(project.pmId);
      if (pm) {
        await sendBucketStatusNotification({
          project,
          pm,
          status: currentStatus as "warning" | "critical",
          utilizationPercent,
          consumedHours,
          availableHours: finalAvailableHours,
          remainingHours,
        });
      }
    }

    // Update stored status if changed
    if (previousStatus !== currentStatus) {
      await storage.updateProject(projectId, { lastBucketStatus: currentStatus });
    }
  } catch (error) {
    console.error(`Error checking bucket status for project ${projectId}:`, error);
  }
}

// Parse the optional attribution strategy sent when moving PMs between PODs.
// Returns undefined (treated as "move all") when absent or malformed.
function parsePodMoveStrategy(raw: any): PodMoveStrategy | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const mode = raw.mode;
  if (mode !== "move_all" && mode !== "keep_previous") return undefined;
  if (mode === "move_all") return { mode };
  const effMonth = Number(raw.effMonth);
  const effYear = Number(raw.effYear);
  if (
    !Number.isInteger(effMonth) || effMonth < 1 || effMonth > 12 ||
    !Number.isInteger(effYear) || effYear < 2000 || effYear > 2100
  ) {
    return undefined;
  }
  return { mode, effMonth, effYear };
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  app.get("/api/health", (_req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
  });

  await setupAuth(app);
  
  setupPresenceWebSocket(httpServer, app);

  // API Metrics Middleware - tracks response times and errors for system health monitoring
  app.use("/api", (req: any, res, next) => {
    const startTime = Date.now();
    const originalSend = res.send;
    const originalJson = res.json;
    
    // Skip tracking for the metrics endpoint itself to avoid recursion
    if (req.path === "/api/system-health" || req.path === "/api/system-health/metrics") {
      return next();
    }
    
    const recordMetric = async () => {
      const responseTimeMs = Date.now() - startTime;
      const endpoint = req.originalUrl || req.path;
      const method = req.method;
      const statusCode = res.statusCode;
      const userId = req.user?.dbUserId || null;
      
      // Only record for actual API calls (not static assets, etc.)
      if (endpoint.startsWith("/api/")) {
        try {
          await storage.recordApiMetric({
            endpoint,
            method,
            statusCode,
            responseTimeMs,
            errorMessage: statusCode >= 400 ? res.locals.errorMessage || null : null,
            userId,
          });
        } catch (e) {
          // Silently fail - don't let metrics recording break the app
          console.error("Failed to record API metric:", e);
        }
      }
    };
    
    res.send = function(body: any) {
      recordMetric();
      return originalSend.call(this, body);
    };
    
    res.json = function(body: any) {
      // Capture error message if present
      if (res.statusCode >= 400 && body?.message) {
        res.locals.errorMessage = body.message;
      }
      recordMetric();
      return originalJson.call(this, body);
    };
    
    next();
  });

  // Development-only endpoints. NEVER register these in production — the
  // dev-login route would let anyone impersonate any user without auth.
  if (process.env.NODE_ENV !== "production") {
    // Development-only: Return all users so the landing page can offer a dev-login picker
    app.get("/api/dev-users", async (_req, res) => {
      try {
        const users = await storage.getAllUsers();
        res.json(users.map((u) => ({ id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName })));
      } catch (error: any) {
        console.error("Dev-users error:", error?.message || error);
        res.status(500).json({ message: "Failed to fetch users" });
      }
    });

    // Development-only: Direct login endpoint to bypass OAuth in Replit preview
    app.get("/api/dev-login/:userId", async (req: any, res) => {
      try {
        const userId = req.params.userId;
        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        // Check if user is blocked
        if (user.status === "blocked") {
          return res.status(403).json({ message: "Your account has been blocked. Please contact an administrator." });
        }

        // Create a session user object that matches what passport expects
        const sessionUser = {
          claims: {
            sub: user.id,
            email: user.email,
            first_name: user.firstName,
            last_name: user.lastName,
          },
          dbUserId: user.id,
          // Set sessionExpiresAt to 30 days from now (required by isAuthenticated middleware)
          sessionExpiresAt: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60),
        };

        // Use passport's login method to properly establish the session
        req.login(sessionUser, (err: any) => {
          if (err) {
            console.error("Login error:", err);
            return res.status(500).json({ message: "Failed to create session" });
          }
          res.redirect("/");
        });
      } catch (error) {
        console.error("Dev login error:", error);
        res.status(500).json({ message: "Login failed" });
      }
    });
  }

  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // ===== Google Drive document browser =====
  // Lists the per-project Drive folders and their files, and streams downloads
  // through the authenticated backend (no public Drive links). Gated by
  // view_projects since documents are organized by project.
  app.get("/api/drive/status", isAuthenticated, requirePermission("view_projects"), async (_req, res) => {
    try {
      const connected = await isDriveConnected();
      res.json({ connected });
    } catch {
      res.json({ connected: false });
    }
  });

  app.get("/api/drive/projects", isAuthenticated, requirePermission("view_projects"), async (_req, res) => {
    try {
      const folders = await storage.getAllProjectDriveFolders();
      res.json(
        folders.map((f) => ({
          projectId: f.projectId,
          projectName: f.projectName,
          region: f.region,
          status: f.status,
        })),
      );
    } catch (error) {
      console.error("Error listing Drive projects:", error);
      res.status(500).json({ message: "Failed to list Drive projects" });
    }
  });

  app.get("/api/drive/projects/:projectId/files", isAuthenticated, requirePermission("view_projects"), async (req, res) => {
    try {
      const folders = await storage.getProjectDriveFolders(req.params.projectId);
      if (!folders) {
        return res.status(404).json({ message: "This project has no Drive folder yet." });
      }
      const drive = await getUncachableDriveClient();
      const [changeRequests, invoices, paymentReceipts] = await Promise.all([
        listFolderChildren(drive, folders.changeRequestsFolderId),
        listFolderChildren(drive, folders.invoicesFolderId),
        listFolderChildren(drive, folders.paymentReceiptsFolderId),
      ]);
      res.json({ changeRequests, invoices, paymentReceipts });
    } catch (error) {
      if (error instanceof DriveNotConnectedError) {
        return res.status(503).json({ message: error.message });
      }
      console.error("Error listing Drive files:", error);
      res.status(500).json({ message: "Failed to list Drive files" });
    }
  });

  app.get("/api/drive/files/:fileId/download", isAuthenticated, requirePermission("view_projects"), async (req, res) => {
    try {
      const { fileId } = req.params;
      // Defense-in-depth: only allow downloading files that live inside one of our
      // managed project subfolders (the drive.file scope already limits visibility
      // to app-created files, but this prevents downloading anything outside the
      // documents structure).
      const all = await storage.getAllProjectDriveFolders();
      const allowedParents = new Set<string>();
      for (const f of all) {
        allowedParents.add(f.changeRequestsFolderId);
        allowedParents.add(f.invoicesFolderId);
        allowedParents.add(f.paymentReceiptsFolderId);
      }
      const drive = await getUncachableDriveClient();
      const meta = await getFileMetadata(drive, fileId);
      if (!meta.parents || !meta.parents.some((p) => allowedParents.has(p))) {
        return res.status(404).json({ message: "File not found" });
      }
      const stream = await downloadFileStream(drive, fileId);
      res.setHeader("Content-Type", meta.mimeType || "application/octet-stream");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(meta.name)}"`,
      );
      stream.on("error", (err) => {
        console.error("Drive download stream error:", err);
        if (!res.headersSent) res.status(500).json({ message: "Failed to download file" });
        else res.destroy();
      });
      stream.pipe(res);
    } catch (error) {
      if (error instanceof DriveNotConnectedError) {
        return res.status(503).json({ message: error.message });
      }
      console.error("Error downloading Drive file:", error);
      if (!res.headersSent) res.status(500).json({ message: "Failed to download file" });
    }
  });

  app.get("/api/users", isAuthenticated, requirePermission("view_users"), async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Lightweight list of Project Managers (by designation), accessible to anyone
  // who can view projects — so PM filters work without the view_users permission.
  app.get("/api/project-managers", isAuthenticated, requirePermission("view_projects"), async (_req, res) => {
    try {
      const pms = await storage.getProjectManagers();
      res.json(pms);
    } catch (error) {
      console.error("Error fetching project managers:", error);
      res.status(500).json({ message: "Failed to fetch project managers" });
    }
  });

  app.get("/api/users/:id", isAuthenticated, requirePermission("view_users"), async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.post("/api/users", isAuthenticated, requirePermission("edit_users"), async (req: any, res) => {
    try {
      const parsed = insertUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid user data", errors: parsed.error.errors });
      }
      
      const existingUser = await storage.getUserByEmail(parsed.data.email || "");
      if (existingUser) {
        return res.status(409).json({ message: "A user with this email already exists" });
      }
      
      // If role name is provided, look up the role and set roleId
      let createData = { ...parsed.data };
      if (parsed.data.role && typeof parsed.data.role === 'string') {
        const role = await storage.getRoleByName(parsed.data.role);
        if (role) {
          createData.roleId = role.id;
        }
      }
      
      const user = await storage.createUser(createData);
      const adminId = req.user?.claims?.sub;
      await logActivityInternal(adminId, "create", "user", user.id, `Created user: ${user.email}`, req);
      
      // Send invite email to the new user
      let inviteEmailSent = false;
      let inviteEmailError: string | null = null;
      
      if (user.email) {
        const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
        const host = req.headers["x-forwarded-host"] || req.headers.host;
        const systemUrl = `${protocol}://${host}`;
        
        const emailResult = await sendUserInviteEmail(
          { email: user.email, firstName: user.firstName, lastName: user.lastName },
          systemUrl
        );
        
        if (emailResult.success) {
          inviteEmailSent = true;
        } else {
          inviteEmailError = emailResult.error || "Failed to send invite email";
          console.log(`[User Create] Invite email failed for ${user.email}: ${inviteEmailError}`);
        }
      }
      
      res.status(201).json({ ...user, inviteEmailSent, inviteEmailError });
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  // Resend invite email to a user who hasn't logged in yet
  app.post("/api/users/:id/resend-invite", isAuthenticated, requirePermission("edit_users"), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      if (!user.email) {
        return res.status(400).json({ message: "User has no email address" });
      }
      
      // Check if user has already logged in
      if (user.lastLogin) {
        return res.status(400).json({ message: "User has already logged in. Invite not needed." });
      }
      
      const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
      const host = req.headers["x-forwarded-host"] || req.headers.host;
      const systemUrl = `${protocol}://${host}`;
      
      const emailResult = await sendUserInviteEmail(
        { email: user.email, firstName: user.firstName, lastName: user.lastName },
        systemUrl
      );
      
      if (!emailResult.success) {
        return res.status(500).json({ message: emailResult.error || "Failed to send invite email" });
      }
      
      const adminId = req.user?.claims?.sub;
      await logActivityInternal(adminId, "update", "user", user.id, `Resent invite email to: ${user.email}`, req);
      
      res.json({ success: true, message: "Invite email sent successfully" });
    } catch (error) {
      console.error("Error resending invite:", error);
      res.status(500).json({ message: "Failed to resend invite" });
    }
  });

  app.patch("/api/users/:id", isAuthenticated, requirePermission("edit_users"), async (req: any, res) => {
    try {
      const oldUser = await storage.getUser(req.params.id);
      
      // If role name is provided, look up the role and set roleId
      let updateData = { ...req.body };
      if (req.body.role && typeof req.body.role === 'string') {
        const role = await storage.getRoleByName(req.body.role);
        if (role) {
          updateData.roleId = role.id;
        }
      }

      // Blocking a user removes them from any POD they belonged to — a departed
      // member should not keep counting toward a POD's roster or stats.
      if (updateData.status === "blocked") {
        updateData.podId = null;
      }

      // A pay grade must belong to the user's designation. Validate coherence so
      // the API can't persist a grade from a different designation than gradeId.
      if (updateData.gradeBandId) {
        const effectiveGradeId = updateData.gradeId !== undefined ? updateData.gradeId : oldUser?.gradeId;
        const allBands = await storage.getAllSalaryGradeBands();
        const band = allBands.find((b) => b.id === updateData.gradeBandId);
        if (!band) {
          return res.status(400).json({ message: "Selected grade does not exist." });
        }
        if (!effectiveGradeId || band.designationId !== effectiveGradeId) {
          return res.status(400).json({ message: "Selected grade does not belong to the chosen designation." });
        }
      }

      const user = await storage.updateUser(req.params.id, updateData);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const adminId = req.user?.claims?.sub;
      const roleChanged = oldUser && oldUser.role !== user.role;
      if (roleChanged) {
        await logActivityInternal(adminId, "update", "user", user.id, `Changed user role from ${oldUser?.role} to ${user.role} for ${user.email}`, req);
      } else {
        await logActivityInternal(adminId, "update", "user", user.id, `Updated user: ${user.email}`, req);
      }
      res.json(user);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.get("/api/users/:id/linked-data", isAuthenticated, requirePermission("edit_users"), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const counts = await storage.getUserLinkedDataCounts(req.params.id);
      const total = Object.values(counts).reduce((sum, c) => sum + c, 0);
      res.json({ counts, total });
    } catch (error) {
      console.error("Error fetching user linked data:", error);
      res.status(500).json({ message: "Failed to fetch linked data" });
    }
  });

  app.delete("/api/users/:id", isAuthenticated, requirePermission("edit_users"), async (req: any, res) => {
    try {
      const adminId = req.user?.claims?.sub;
      const replacementUserId = req.query.replacementUserId as string | undefined;
      
      if (req.params.id === adminId) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }
      
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (replacementUserId) {
        if (replacementUserId === req.params.id) {
          return res.status(400).json({ message: "Replacement user cannot be the same as the user being deleted" });
        }
        const replacementUser = await storage.getUser(replacementUserId);
        if (!replacementUser) {
          return res.status(404).json({ message: "Replacement user not found" });
        }
        if (replacementUser.status !== "active") {
          return res.status(400).json({ message: "Replacement user must be an active user" });
        }
        const success = await storage.reassignAndDeleteUser(req.params.id, replacementUserId);
        if (!success) {
          return res.status(500).json({ message: "Failed to delete user" });
        }
        await logActivityInternal(adminId, "delete", "user", req.params.id, `Deleted user: ${user.email}, reassigned data to ${replacementUser.email}`, req);
      } else {
        const success = await storage.deleteUser(req.params.id);
        if (!success) {
          return res.status(500).json({ message: "Failed to delete user" });
        }
        await logActivityInternal(adminId, "delete", "user", req.params.id, `Deleted user: ${user.email}`, req);
      }
      
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  app.post("/api/users/:id/reset-password", isAuthenticated, requirePermission("edit_users"), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      if (!user.email) {
        return res.status(400).json({ message: "User has no email address" });
      }
      
      const result = await sendPasswordResetEmail(user);
      
      if (result.success) {
        const adminId = req.user?.claims?.sub;
        await logActivityInternal(adminId, "update", "user", user.id, `Sent password reset email to ${user.email}`, req);
        res.json({ message: "Password reset email sent successfully" });
      } else {
        res.status(500).json({ message: result.error || "Failed to send password reset email" });
      }
    } catch (error) {
      console.error("Error sending password reset email:", error);
      res.status(500).json({ message: "Failed to send password reset email" });
    }
  });

  app.get("/api/projects", isAuthenticated, async (req, res) => {
    try {
      const projects = await storage.getAllProjects();
      res.json(projects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.get("/api/projects/:id", isAuthenticated, async (req, res) => {
    try {
      const project = await storage.getProjectWithPM(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      console.error("Error fetching project:", error);
      res.status(500).json({ message: "Failed to fetch project" });
    }
  });

  app.post("/api/projects", isAuthenticated, requirePermission("create_projects"), async (req: any, res) => {
    try {
      const parsed = insertProjectSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid project data", errors: parsed.error.errors });
      }
      const project = await storage.createProject(parsed.data);
      const userId = req.user?.claims?.sub;
      await logActivityInternal(userId, "create", "project", project.id, `Created project: ${project.name}`, req);
      res.status(201).json(project);
    } catch (error) {
      console.error("Error creating project:", error);
      res.status(500).json({ message: "Failed to create project" });
    }
  });

  // Bulk import projects from CSV
  app.post("/api/projects/import", isAuthenticated, requirePermission("create_projects"), async (req: any, res) => {
    try {
      const { projects: projectsData } = req.body;
      
      if (!Array.isArray(projectsData) || projectsData.length === 0) {
        return res.status(400).json({ message: "No projects to import" });
      }
      
      const results = {
        success: [] as any[],
        failed: [] as { index: number; name: string; error: string }[]
      };
      
      for (let i = 0; i < projectsData.length; i++) {
        const projectData = projectsData[i];
        try {
          // Build project insert data
          const insertData: any = {
            name: projectData.name,
            clientName: projectData.clientName,
            clientEmail: projectData.clientEmail || null,
            region: projectData.region,
            pmId: projectData.pmId || null,
            projectType: projectData.projectType || null,
            totalCost: projectData.totalCost,
            paymentTerms: projectData.paymentTerms || null,
            billingType: projectData.billingType || null,
            numberOfPhases: projectData.numberOfPhases || null,
            tbeHoursPerMonth: projectData.tbeHoursPerMonth || null,
            tbeHourlyRate: projectData.tbeHourlyRate || null,
            mrrMonthlyAmount: projectData.mrrMonthlyAmount || null,
            mrrDurationMonths: projectData.mrrDurationMonths || null,
          };
          
          // Handle date fields
          if (projectData.contractStartDate) {
            insertData.contractStartDate = new Date(projectData.contractStartDate);
          }
          if (projectData.contractEndDate) {
            insertData.contractEndDate = new Date(projectData.contractEndDate);
          }
          
          const project = await storage.createProject(insertData);
          results.success.push(project);
          
          const userId = req.user?.claims?.sub;
          await logActivityInternal(userId, "create", "project", project.id, `Imported project: ${project.name}`, req);
        } catch (error: any) {
          results.failed.push({
            index: i,
            name: projectData.name || `Row ${i + 1}`,
            error: error.message || "Unknown error"
          });
        }
      }
      
      res.status(201).json({
        message: `Imported ${results.success.length} projects successfully`,
        successCount: results.success.length,
        failedCount: results.failed.length,
        failed: results.failed
      });
    } catch (error) {
      console.error("Error importing projects:", error);
      res.status(500).json({ message: "Failed to import projects" });
    }
  });

  app.patch("/api/projects/:id", isAuthenticated, requirePermission("edit_projects"), async (req: any, res) => {
    try {
      // Convert date strings to Date objects for timestamp columns
      const updateData = { ...req.body };
      if (updateData.contractStartDate) {
        updateData.contractStartDate = new Date(updateData.contractStartDate);
      }
      if (updateData.contractEndDate) {
        updateData.contractEndDate = new Date(updateData.contractEndDate);
      }
      
      const project = await storage.updateProject(req.params.id, updateData);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      const userId = req.user?.claims?.sub;
      await logActivityInternal(userId, "update", "project", project.id, `Updated project: ${project.name}`, req);
      
      // Check bucket status if cost field was updated (affects remaining hours calculation)
      if (updateData.cost !== undefined) {
        checkAndNotifyBucketStatus(project.id).catch(err => 
          console.error("Error checking bucket status after project cost update:", err)
        );
      }
      
      res.json(project);
    } catch (error) {
      console.error("Error updating project:", error);
      res.status(500).json({ message: "Failed to update project" });
    }
  });

  // Update project cost margin overrides (hourly rate, profitability, variance, available hours)
  app.patch("/api/projects/:id/cost-overrides", isAuthenticated, requirePermission("view_cost_margin"), async (req: any, res) => {
    try {
      const { overrideHourlyRate, overrideProfitabilityPercent, overrideVarianceHours, overrideAvailableHours } = req.body;
      
      const updateData: Record<string, string | null> = {};
      updateData.overrideHourlyRate = overrideHourlyRate || null;
      updateData.overrideProfitabilityPercent = overrideProfitabilityPercent || null;
      updateData.overrideVarianceHours = overrideVarianceHours || null;
      updateData.overrideAvailableHours = overrideAvailableHours || null;
      
      const project = await storage.updateProject(req.params.id, updateData);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      const userId = req.user?.claims?.sub;
      await logActivityInternal(userId, "update", "project", project.id, `Updated cost margin overrides for: ${project.name}`, req);
      
      // Check bucket status when cost overrides change (affects remaining hours calculation)
      checkAndNotifyBucketStatus(project.id).catch(err => 
        console.error("Error checking bucket status after cost override update:", err)
      );
      
      res.json(project);
    } catch (error) {
      console.error("Error updating project cost overrides:", error);
      res.status(500).json({ message: "Failed to update project cost overrides" });
    }
  });

  // Update project delivery status (green/amber/red)
  app.patch("/api/projects/:id/delivery-status", isAuthenticated, requirePermission("edit_projects"), async (req: any, res) => {
    try {
      const { deliveryStatus } = req.body;
      if (!deliveryStatus || !["green", "amber", "red"].includes(deliveryStatus)) {
        return res.status(400).json({ message: "Invalid delivery status. Must be green, amber, or red." });
      }
      
      const project = await storage.updateProject(req.params.id, { deliveryStatus });
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      const userId = req.user?.claims?.sub;
      await logActivityInternal(userId, "update", "project", project.id, `Updated delivery status to ${deliveryStatus} for: ${project.name}`, req);
      res.json(project);
    } catch (error) {
      console.error("Error updating delivery status:", error);
      res.status(500).json({ message: "Failed to update delivery status" });
    }
  });

  // Get payments for a specific project (for delete confirmation)
  app.get("/api/projects/:id/payments", isAuthenticated, async (req: any, res) => {
    try {
      const payments = await storage.getPaymentsByProjectId(req.params.id);
      res.json(payments);
    } catch (error) {
      console.error("Error fetching project payments:", error);
      res.status(500).json({ message: "Failed to fetch project payments" });
    }
  });

  app.delete("/api/projects/:id", isAuthenticated, requirePermission("delete_projects"), async (req: any, res) => {
    try {
      const projectId = req.params.id;
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      // Get associated payments before deletion
      const projectPayments = await storage.getPaymentsByProjectId(projectId);
      
      // Delete the project and its payments
      const deleted = await storage.deleteProject(projectId);
      if (!deleted) {
        return res.status(500).json({ message: "Failed to delete project" });
      }
      
      // Generate undo token and store for 30 seconds
      const undoToken = `undo_${projectId}_${Date.now()}`;
      projectUndoRegistry.set(undoToken, {
        project,
        payments: projectPayments,
        expiresAt: Date.now() + 30000, // 30 seconds
      });
      
      const userId = req.user?.claims?.sub;
      await logActivityInternal(userId, "delete", "project", projectId, `Deleted project: ${project.name}`, req);
      
      res.json({ 
        message: "Project deleted successfully",
        undoToken,
        projectName: project.name,
        paymentsDeleted: projectPayments.length,
      });
    } catch (error) {
      console.error("Error deleting project:", error);
      res.status(500).json({ message: "Failed to delete project" });
    }
  });

  // Undo project deletion
  app.post("/api/projects/undo-delete", isAuthenticated, requirePermission("delete_projects"), async (req: any, res) => {
    try {
      const { undoToken } = req.body;
      if (!undoToken) {
        return res.status(400).json({ message: "Undo token is required" });
      }
      
      const undoEntry = projectUndoRegistry.get(undoToken);
      if (!undoEntry) {
        return res.status(410).json({ message: "Undo expired or invalid token" });
      }
      
      if (undoEntry.expiresAt < Date.now()) {
        projectUndoRegistry.delete(undoToken);
        return res.status(410).json({ message: "Undo window has expired" });
      }
      
      // Restore the project and payments
      const restoredProject = await storage.restoreProject(undoEntry.project, undoEntry.payments);
      
      // Remove from undo registry
      projectUndoRegistry.delete(undoToken);
      
      const userId = req.user?.claims?.sub;
      await logActivityInternal(userId, "create", "project", restoredProject.id, `Restored project: ${restoredProject.name} (undo delete)`, req);
      
      res.json({ 
        message: "Project restored successfully",
        project: restoredProject,
        paymentsRestored: undoEntry.payments.length,
      });
    } catch (error) {
      console.error("Error restoring project:", error);
      res.status(500).json({ message: "Failed to restore project" });
    }
  });

  // Project Merge API
  app.post("/api/projects/merge/preview", isAuthenticated, requirePermission("delete_projects"), async (req: any, res) => {
    try {
      const { targetProjectId, sourceProjectIds } = req.body;
      
      if (!targetProjectId || !sourceProjectIds || !Array.isArray(sourceProjectIds) || sourceProjectIds.length === 0) {
        return res.status(400).json({ message: "Target project ID and at least one source project ID are required" });
      }
      
      if (sourceProjectIds.includes(targetProjectId)) {
        return res.status(400).json({ message: "Target project cannot be in source projects list" });
      }
      
      const preview = await storage.getProjectMergePreview(targetProjectId, sourceProjectIds);
      res.json(preview);
    } catch (error: any) {
      console.error("Error getting merge preview:", error);
      res.status(500).json({ message: error.message || "Failed to get merge preview" });
    }
  });

  app.post("/api/projects/merge", isAuthenticated, requirePermission("delete_projects"), async (req: any, res) => {
    try {
      const { targetProjectId, sourceProjectIds } = req.body;
      const userId = req.user?.claims?.sub;
      
      if (!targetProjectId || !sourceProjectIds || !Array.isArray(sourceProjectIds) || sourceProjectIds.length === 0) {
        return res.status(400).json({ message: "Target project ID and at least one source project ID are required" });
      }
      
      if (sourceProjectIds.includes(targetProjectId)) {
        return res.status(400).json({ message: "Target project cannot be in source projects list" });
      }
      
      const audit = await storage.mergeProjects(targetProjectId, sourceProjectIds, userId);
      res.json({ 
        message: "Projects merged successfully",
        audit
      });
    } catch (error: any) {
      console.error("Error merging projects:", error);
      res.status(500).json({ message: error.message || "Failed to merge projects" });
    }
  });

  app.get("/api/projects/merge/audits", isAuthenticated, requirePermission("view_projects"), async (req: any, res) => {
    try {
      const { projectId } = req.query;
      const audits = await storage.getProjectMergeAudits(projectId as string | undefined);
      res.json(audits);
    } catch (error) {
      console.error("Error fetching merge audits:", error);
      res.status(500).json({ message: "Failed to fetch merge audits" });
    }
  });

  // Project Milestones API
  app.get("/api/projects/:id/milestones", isAuthenticated, async (req, res) => {
    try {
      const milestones = await storage.getProjectMilestones(req.params.id);
      res.json(milestones);
    } catch (error) {
      console.error("Error fetching milestones:", error);
      res.status(500).json({ message: "Failed to fetch milestones" });
    }
  });

  app.get("/api/projects/:id/with-milestones", isAuthenticated, async (req, res) => {
    try {
      const project = await storage.getProjectWithMilestones(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      console.error("Error fetching project with milestones:", error);
      res.status(500).json({ message: "Failed to fetch project" });
    }
  });

  app.post("/api/projects/:id/milestones", isAuthenticated, requirePermission("edit_projects"), async (req: any, res) => {
    try {
      const milestoneData = { ...req.body, projectId: req.params.id };
      const parsed = insertMilestoneSchema.safeParse(milestoneData);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid milestone data", errors: parsed.error.errors });
      }
      const milestone = await storage.createMilestone(parsed.data);
      
      const userId = req.user?.claims?.sub;
      await logActivityInternal(userId, "create", "project", req.params.id, `Created milestone: ${milestone.name}`, req);
      
      res.status(201).json(milestone);
    } catch (error) {
      console.error("Error creating milestone:", error);
      res.status(500).json({ message: "Failed to create milestone" });
    }
  });

  app.post("/api/projects/:id/milestones/generate", isAuthenticated, requirePermission("edit_projects"), async (req: any, res) => {
    try {
      const projectId = req.params.id;
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      if (!project.billingType) {
        return res.status(400).json({ message: "Project has no billing type configured" });
      }
      
      // Delete existing milestones before generating new ones
      await storage.deleteProjectMilestones(projectId);
      
      const milestones: any[] = [];
      
      if (project.billingType === 'ftfc') {
        // Fixed Time Fixed Cost: Generate phase-based milestones
        // Check if phases were provided in request body
        const providedPhases = req.body.phases as Array<{ name: string; percentage: number; cost: number; dueDate?: string }> | undefined;
        
        if (providedPhases && providedPhases.length > 0) {
          // Use the provided phases data
          providedPhases.forEach((phase, index) => {
            milestones.push({
              projectId,
              name: phase.name || `Phase ${index + 1}`,
              description: `${phase.percentage}% of total project cost`,
              sequenceNumber: index + 1,
              phaseNumber: index + 1,
              expectedAmount: phase.cost.toFixed(2),
              dueDate: phase.dueDate ? new Date(phase.dueDate) : null,
              status: 'planned' as MilestoneStatus,
            });
          });
        } else {
          // Fallback to equal distribution
          const phases = project.numberOfPhases || 1;
          const totalCost = parseFloat(project.totalCost) || 0;
          const amountPerPhase = totalCost / phases;
          
          for (let i = 1; i <= phases; i++) {
            milestones.push({
              projectId,
              name: `Phase ${i}`,
              description: `Phase ${i} milestone payment`,
              sequenceNumber: i,
              phaseNumber: i,
              expectedAmount: amountPerPhase.toFixed(2),
              status: 'planned' as MilestoneStatus,
            });
          }
        }
      } else if (project.billingType === 'tbe') {
        // Team Based Engagement: Generate monthly milestones
        if (!project.contractStartDate || !project.contractEndDate) {
          return res.status(400).json({ message: "TBE projects require contract start and end dates" });
        }
        
        const hoursPerMonth = project.tbeHoursPerMonth || 0;
        const hourlyRate = parseFloat(project.tbeHourlyRate || "0");
        const monthlyAmount = hoursPerMonth * hourlyRate;
        
        const startDate = new Date(project.contractStartDate);
        const endDate = new Date(project.contractEndDate);
        let sequence = 1;
        let currentDate = new Date(startDate);
        
        while (currentDate <= endDate) {
          const month = currentDate.getMonth() + 1;
          const year = currentDate.getFullYear();
          
          // Set due date as the first of each billing month
          const dueDate = new Date(year, month - 1, 1);
          
          milestones.push({
            projectId,
            name: `${currentDate.toLocaleString('default', { month: 'long' })} ${year}`,
            description: `${hoursPerMonth} hours @ $${hourlyRate}/hr`,
            sequenceNumber: sequence,
            billingMonth: month,
            billingYear: year,
            hoursCommitted: hoursPerMonth,
            hourlyRate: hourlyRate.toFixed(2),
            expectedAmount: monthlyAmount.toFixed(2),
            dueDate: dueDate,
            status: 'planned' as MilestoneStatus,
          });
          
          sequence++;
          currentDate.setMonth(currentDate.getMonth() + 1);
        }
      } else if (project.billingType === 'mrr') {
        // Monthly Recurring Revenue: Generate monthly installments
        const durationMonths = project.mrrDurationMonths || 1;
        const monthlyAmount = parseFloat(project.mrrMonthlyAmount || "0");
        
        const startDate = project.contractStartDate ? new Date(project.contractStartDate) : new Date();
        const startDay = startDate.getDate(); // Preserve the day from start date
        
        for (let i = 0; i < durationMonths; i++) {
          // Calculate the due date preserving the start day (e.g., Jan 22 -> Feb 22 -> Mar 22)
          const dueDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, startDay);
          
          // Handle edge cases where the day doesn't exist in the target month (e.g., Jan 31 -> Feb 28)
          if (dueDate.getDate() !== startDay) {
            // Set to last day of the previous month (the month we wanted)
            dueDate.setDate(0);
          }
          
          const month = dueDate.getMonth() + 1;
          const year = dueDate.getFullYear();
          
          milestones.push({
            projectId,
            name: `Month ${i + 1} - ${dueDate.toLocaleString('default', { month: 'long' })} ${year}`,
            description: `Monthly recurring payment`,
            sequenceNumber: i + 1,
            phaseNumber: i + 1,
            billingMonth: month,
            billingYear: year,
            expectedAmount: monthlyAmount.toFixed(2),
            dueDate: dueDate,
            status: 'planned' as MilestoneStatus,
          });
        }
      }
      
      if (milestones.length === 0) {
        return res.status(400).json({ message: "Could not generate milestones for this project configuration" });
      }
      
      const created = await storage.createBulkMilestones(milestones);
      
      const userId = req.user?.claims?.sub;
      await logActivityInternal(userId, "create", "project", projectId, `Generated ${created.length} milestones for project`, req);
      
      res.json({ message: "Milestones generated successfully", milestones: created });
    } catch (error) {
      console.error("Error generating milestones:", error);
      res.status(500).json({ message: "Failed to generate milestones" });
    }
  });

  // Get all unpaid milestones across all projects (for payment form dropdown)
  // NOTE: This static route MUST be defined before /api/milestones/:id
  app.get("/api/milestones/unpaid", isAuthenticated, async (req, res) => {
    try {
      const unpaidMilestones = await storage.getUnpaidMilestones();
      res.json(unpaidMilestones);
    } catch (error) {
      console.error("Error fetching unpaid milestones:", error);
      res.status(500).json({ message: "Failed to fetch unpaid milestones" });
    }
  });

  app.get("/api/milestones/:id", isAuthenticated, async (req, res) => {
    try {
      const milestone = await storage.getMilestoneWithPayment(req.params.id);
      if (!milestone) {
        return res.status(404).json({ message: "Milestone not found" });
      }
      res.json(milestone);
    } catch (error) {
      console.error("Error fetching milestone:", error);
      res.status(500).json({ message: "Failed to fetch milestone" });
    }
  });

  app.patch("/api/milestones/:id", isAuthenticated, requirePermission("edit_projects"), async (req: any, res) => {
    try {
      const parsed = updateMilestoneSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid milestone data", errors: parsed.error.errors });
      }
      const updateData = { ...parsed.data };
      if (updateData.dueDate) {
        const dueDate = new Date(updateData.dueDate);
        updateData.billingMonth = dueDate.getMonth() + 1;
        updateData.billingYear = dueDate.getFullYear();
      }
      const milestone = await storage.updateMilestone(req.params.id, updateData);
      if (!milestone) {
        return res.status(404).json({ message: "Milestone not found" });
      }
      
      const userId = req.user?.claims?.sub;
      await logActivityInternal(userId, "update", "project", milestone.projectId, `Updated milestone: ${milestone.name}`, req);
      
      res.json(milestone);
    } catch (error) {
      console.error("Error updating milestone:", error);
      res.status(500).json({ message: "Failed to update milestone" });
    }
  });

  app.patch("/api/milestones/:id/status", isAuthenticated, requirePermission("edit_projects"), async (req: any, res) => {
    try {
      const { status } = req.body;
      if (!status || !milestoneStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid status", validStatuses: milestoneStatuses });
      }
      
      const oldMilestone = await storage.getMilestone(req.params.id);
      const milestone = await storage.updateMilestoneStatus(req.params.id, status as MilestoneStatus);
      if (!milestone) {
        return res.status(404).json({ message: "Milestone not found" });
      }
      
      const userId = req.user?.claims?.sub;
      await logActivityInternal(userId, "status_change", "project", milestone.projectId, `Changed milestone "${milestone.name}" status to ${status}`, req);
      
      // Trigger email notification when milestone becomes ready for invoice
      if (status === "ready_for_invoice" && oldMilestone?.status !== "ready_for_invoice") {
        triggerMilestoneReadyNotification(milestone.id, milestone.paymentId || undefined).catch(console.error);
      }
      
      res.json(milestone);
    } catch (error) {
      console.error("Error updating milestone status:", error);
      res.status(500).json({ message: "Failed to update milestone status" });
    }
  });

  app.delete("/api/milestones/:id", isAuthenticated, requirePermission("edit_projects"), async (req: any, res) => {
    try {
      const milestone = await storage.getMilestone(req.params.id);
      if (!milestone) {
        return res.status(404).json({ message: "Milestone not found" });
      }
      
      const deleted = await storage.deleteMilestone(req.params.id);
      if (!deleted) {
        return res.status(500).json({ message: "Failed to delete milestone" });
      }
      
      const userId = req.user?.claims?.sub;
      await logActivityInternal(userId, "delete", "project", milestone.projectId, `Deleted milestone: ${milestone.name}`, req);
      
      res.json({ message: "Milestone deleted successfully" });
    } catch (error) {
      console.error("Error deleting milestone:", error);
      res.status(500).json({ message: "Failed to delete milestone" });
    }
  });

  app.post("/api/milestones/:id/link-payment", isAuthenticated, requirePermission("edit_projects"), async (req: any, res) => {
    try {
      const { paymentId } = req.body;
      if (!paymentId) {
        return res.status(400).json({ message: "Payment ID is required" });
      }
      
      const milestone = await storage.linkMilestoneToPayment(req.params.id, paymentId);
      if (!milestone) {
        return res.status(404).json({ message: "Milestone not found" });
      }
      
      res.json(milestone);
    } catch (error) {
      console.error("Error linking milestone to payment:", error);
      res.status(500).json({ message: "Failed to link milestone to payment" });
    }
  });

  // Get recent payments for a project (for payment form history display)
  app.get("/api/projects/:id/recent-payments", isAuthenticated, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 3;
      const recentPayments = await storage.getRecentPaymentsByProject(req.params.id, limit);
      res.json(recentPayments);
    } catch (error) {
      console.error("Error fetching recent payments:", error);
      res.status(500).json({ message: "Failed to fetch recent payments" });
    }
  });

  // Get billing type options
  app.get("/api/billing-types", isAuthenticated, async (req, res) => {
    res.json({
      types: [
        { value: 'ftfc', label: 'Fixed Time Fixed Cost', description: 'Projects with multiple phases, each phase has a milestone payment' },
        { value: 'tbe', label: 'Team Based Engagement', description: 'Fixed hours sold per month at an hourly rate' },
        { value: 'mrr', label: 'Monthly Recurring Revenue', description: 'Fixed monthly payment for a defined duration' },
      ],
      statuses: milestoneStatuses.map(s => ({ value: s, label: s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) })),
    });
  });

  // ==== INVOICE ROUTES ====
  
  // Get all invoices with optional filters
  app.get("/api/invoices", isAuthenticated, requirePermission("view_invoices"), async (req, res) => {
    try {
      const filters: {
        projectId?: string;
        status?: InvoiceStatus;
        region?: Region;
        startDate?: Date;
        endDate?: Date;
      } = {};

      if (req.query.projectId) filters.projectId = req.query.projectId as string;
      if (req.query.status) filters.status = req.query.status as InvoiceStatus;
      if (req.query.region) filters.region = req.query.region as Region;
      if (req.query.startDate) filters.startDate = new Date(req.query.startDate as string);
      if (req.query.endDate) filters.endDate = new Date(req.query.endDate as string);

      const invoices = await storage.getAllInvoices(filters);
      res.json(invoices);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });

  // Get invoice statuses and source types for UI
  app.get("/api/invoice-options", isAuthenticated, async (req, res) => {
    res.json({
      statuses: invoiceStatuses.map(s => ({ value: s, label: s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) })),
      sources: [
        { value: 'manual', label: 'Manual' },
        { value: 'payment', label: 'Payment' },
        { value: 'milestone', label: 'Milestone' },
      ],
    });
  });

  // Get next invoice number (needed during invoice creation)
  app.get("/api/invoices/next-number", isAuthenticated, requirePermission("create_invoices"), async (req, res) => {
    try {
      const invoiceNumber = await storage.getNextInvoiceNumber();
      res.json({ invoiceNumber });
    } catch (error) {
      console.error("Error getting next invoice number:", error);
      res.status(500).json({ message: "Failed to get next invoice number" });
    }
  });

  // Get single invoice with full details
  app.get("/api/invoices/:id", isAuthenticated, requirePermission("view_invoices"), async (req, res) => {
    try {
      const invoice = await storage.getInvoiceWithDetails(req.params.id);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.json(invoice);
    } catch (error) {
      console.error("Error fetching invoice:", error);
      res.status(500).json({ message: "Failed to fetch invoice" });
    }
  });

  // Create new invoice with line items
  app.post("/api/invoices", isAuthenticated, requirePermission("create_invoices"), async (req: any, res) => {
    try {
      const { lineItems, ...invoiceData } = req.body;
      
      // Generate invoice number if not provided
      if (!invoiceData.invoiceNumber) {
        invoiceData.invoiceNumber = await storage.getNextInvoiceNumber();
      }
      
      // Set creator
      const userId = req.user?.claims?.sub;
      invoiceData.createdBy = userId;
      
      const parsed = insertInvoiceSchema.safeParse(invoiceData);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid invoice data", errors: parsed.error.errors });
      }

      const invoice = await storage.createInvoice(parsed.data);
      
      // Create line items if provided
      if (lineItems && Array.isArray(lineItems) && lineItems.length > 0) {
        const itemsWithInvoiceId = lineItems.map((item: any, index: number) => ({
          ...item,
          invoiceId: invoice.id,
          sortOrder: item.sortOrder ?? index,
        }));
        await storage.createBulkInvoiceLineItems(itemsWithInvoiceId);
      }
      
      await logActivityInternal(userId, "create", "payment", invoice.id, `Created invoice: ${invoice.invoiceNumber}`, req);
      
      const createdInvoice = await storage.getInvoiceWithDetails(invoice.id);
      res.status(201).json(createdInvoice);
    } catch (error) {
      console.error("Error creating invoice:", error);
      res.status(500).json({ message: "Failed to create invoice" });
    }
  });

  // Update invoice
  app.patch("/api/invoices/:id", isAuthenticated, requirePermission("create_invoices"), async (req: any, res) => {
    try {
      const { lineItems, ...invoiceData } = req.body;
      
      const parsed = updateInvoiceSchema.safeParse(invoiceData);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid invoice data", errors: parsed.error.errors });
      }

      const invoice = await storage.updateInvoice(req.params.id, parsed.data);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      
      // Update line items if provided
      if (lineItems && Array.isArray(lineItems)) {
        await storage.deleteInvoiceLineItems(invoice.id);
        if (lineItems.length > 0) {
          const itemsWithInvoiceId = lineItems.map((item: any, index: number) => ({
            ...item,
            invoiceId: invoice.id,
            sortOrder: item.sortOrder ?? index,
          }));
          await storage.createBulkInvoiceLineItems(itemsWithInvoiceId);
        }
      }
      
      const userId = req.user?.claims?.sub;
      await logActivityInternal(userId, "update", "payment", invoice.id, `Updated invoice: ${invoice.invoiceNumber}`, req);
      
      const updatedInvoice = await storage.getInvoiceWithDetails(invoice.id);
      res.json(updatedInvoice);
    } catch (error) {
      console.error("Error updating invoice:", error);
      res.status(500).json({ message: "Failed to update invoice" });
    }
  });

  // Create invoice from a payment (auto-link via paymentId)
  app.post("/api/invoices/from-payment", isAuthenticated, requirePermission("create_invoices"), async (req: any, res) => {
    try {
      const { paymentId, invoiceNumber, invoiceDate, description, notes } = req.body;
      
      if (!paymentId) {
        return res.status(400).json({ message: "Payment ID is required" });
      }
      
      // Check if invoice already exists for this payment
      const existingInvoice = await storage.getInvoiceByPaymentId(paymentId);
      if (existingInvoice) {
        // Fail-soft: backfill the Drive copy for invoices that predate Drive
        // auto-upload (or whose earlier upload failed). The upload helper is
        // idempotent by filename, so repeat clicks won't create duplicates.
        void uploadInvoicePdfToDrive({
          paymentId,
          invoiceNumber: existingInvoice.invoiceNumber,
          invoiceDate: existingInvoice.issueDate,
          description,
          notes: existingInvoice.notes,
        });
        return res.status(200).json(existingInvoice); // Return existing invoice instead of creating duplicate
      }
      
      // Get payment details
      const payment = await storage.getPaymentWithProject(paymentId);
      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }
      
      const userId = req.user?.claims?.sub;
      const finalInvoiceNumber = invoiceNumber || await storage.getNextInvoiceNumber();
      
      // For AE region projects, apply VAT to compute tax amount and total.
      // Non-AE invoices keep their original persisted values byte-for-byte.
      const isAERegion = payment.project?.region === "AE";
      const subtotalNum = parseFloat(payment.expectedAmount || "0") || 0;
      const vatRate = isAERegion ? (parseFloat(payment.project?.vat || "0") || 0) : 0;
      const taxAmountNum = subtotalNum * vatRate / 100;
      const totalNum = subtotalNum + taxAmountNum;
      const aeAmounts = isAERegion
        ? {
            subtotal: subtotalNum.toFixed(2),
            taxRate: vatRate.toString(),
            taxAmount: taxAmountNum.toFixed(2),
            total: totalNum.toFixed(2),
            balance: totalNum.toFixed(2),
          }
        : {
            subtotal: payment.expectedAmount || "0",
            total: payment.expectedAmount || "0",
            balance: payment.expectedAmount || "0",
          };
      
      // Create invoice linked to payment
      const invoiceData = {
        invoiceNumber: finalInvoiceNumber,
        paymentId,
        projectId: payment.projectId,
        source: "payment" as const,
        clientName: payment.project?.clientName || "Unknown Client",
        clientEmail: payment.project?.clientEmail || null,
        clientAddress: null,
        issueDate: invoiceDate ? new Date(invoiceDate) : new Date(),
        dueDate: payment.dueDate ? new Date(payment.dueDate) : null,
        paidDate: null,
        ...aeAmounts,
        status: "sent" as const,
        notes: notes || null,
        region: payment.project?.region || null,
        createdBy: userId,
      };
      
      const invoice = await storage.createInvoice(invoiceData);
      
      // Create a single line item from the payment
      await storage.createInvoiceLineItem({
        invoiceId: invoice.id,
        description: description || payment.narration || `${payment.project?.name} - ${payment.project?.phase || "Services"}`,
        quantity: "1",
        unitPrice: payment.expectedAmount || "0",
        amount: payment.expectedAmount || "0",
        sortOrder: 0,
      });
      
      // Link the invoice and update payment status. A "received" payment must keep its
      // status (the user is just downloading the invoice for bookkeeping); any other
      // status moves to "invoiced".
      const keepStatus = payment.status === "received";
      await storage.updatePayment(paymentId, {
        ...(keepStatus ? {} : { status: "invoiced" }),
        invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date(),
      });
      
      await logActivityInternal(userId, "create", "payment", invoice.id, `Created invoice ${invoice.invoiceNumber} from payment`, req);
      if (!keepStatus) {
        await logActivityInternal(userId, "update", "payment", paymentId, `Marked payment as invoiced via invoice ${invoice.invoiceNumber}`, req);
      }
      
      const createdInvoice = await storage.getInvoiceWithDetails(invoice.id);

      // Fail-soft: auto-save a copy of the generated invoice PDF to Drive.
      void uploadInvoicePdfToDrive({
        paymentId,
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate,
        description,
        notes,
      });

      res.status(201).json(createdInvoice);
    } catch (error) {
      console.error("Error creating invoice from payment:", error);
      res.status(500).json({ message: "Failed to create invoice from payment" });
    }
  });

  // Mark invoice as sent
  app.post("/api/invoices/:id/send", isAuthenticated, requirePermission("create_invoices"), async (req: any, res) => {
    try {
      const invoice = await storage.updateInvoice(req.params.id, { 
        status: "sent",
        sentDate: new Date(),
      });
      
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      
      const userId = req.user?.claims?.sub;
      await logActivityInternal(userId, "update", "payment", invoice.id, `Marked invoice as sent: ${invoice.invoiceNumber}`, req);
      
      res.json(invoice);
    } catch (error) {
      console.error("Error marking invoice as sent:", error);
      res.status(500).json({ message: "Failed to mark invoice as sent" });
    }
  });

  // Record payment on invoice
  app.post("/api/invoices/:id/record-payment", isAuthenticated, requirePermission("record_payment_invoices"), async (req: any, res) => {
    try {
      const { amount, paidDate } = req.body;
      
      if (!amount || isNaN(parseFloat(amount))) {
        return res.status(400).json({ message: "Valid payment amount is required" });
      }
      
      const invoice = await storage.markInvoicePaid(
        req.params.id, 
        paidDate ? new Date(paidDate) : new Date(),
        amount.toString()
      );
      
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      
      // If invoice is linked to a payment, update payment status to "received"
      if (invoice.paymentId) {
        const priorPayment = await storage.getPayment(invoice.paymentId);
        await storage.updatePayment(invoice.paymentId, {
          status: "received",
          receivedDate: paidDate ? new Date(paidDate) : new Date(),
          receivedAmount: amount.toString(),
        });
        const userId = req.user?.claims?.sub;
        await logActivityInternal(userId, "update", "payment", invoice.paymentId, `Marked payment as received via invoice ${invoice.invoiceNumber}`, req);
        // Fail-soft: only upload a receipt on the actual transition to received
        // (avoids duplicate Drive copies when record-payment is replayed).
        if (priorPayment?.status !== "received") {
          void uploadReceiptPdfToDrive(invoice.paymentId);
        }

        // Keep the linked milestone in sync: now that the payment is received,
        // recompute the milestone so it flips to paid / partially_paid.
        try {
          const linkedPayment = await storage.getPayment(invoice.paymentId);
          if (linkedPayment?.milestoneId) {
            await storage.recomputeMilestoneFromPayments(linkedPayment.milestoneId);
          }
        } catch (milestoneSyncError) {
          console.error("Error syncing milestone after recording payment:", milestoneSyncError);
          // Continue - payment recording succeeded, milestone sync is secondary
        }
      }
      
      const userId = req.user?.claims?.sub;
      await logActivityInternal(userId, "update", "payment", invoice.id, `Recorded payment of $${amount} on invoice: ${invoice.invoiceNumber}`, req);
      
      res.json(invoice);
    } catch (error) {
      console.error("Error recording payment:", error);
      res.status(500).json({ message: "Failed to record payment" });
    }
  });

  // Cancel invoice
  app.post("/api/invoices/:id/cancel", isAuthenticated, requirePermission("cancel_invoices"), async (req: any, res) => {
    try {
      const invoice = await storage.updateInvoice(req.params.id, { status: "cancelled" });
      
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      
      const userId = req.user?.claims?.sub;
      await logActivityInternal(userId, "update", "payment", invoice.id, `Cancelled invoice: ${invoice.invoiceNumber}`, req);
      
      res.json(invoice);
    } catch (error) {
      console.error("Error cancelling invoice:", error);
      res.status(500).json({ message: "Failed to cancel invoice" });
    }
  });

  // Reactivate a cancelled invoice (return it to an active "sent" state so its
  // status can be updated / a payment recorded again).
  app.post("/api/invoices/:id/reactivate", isAuthenticated, requirePermission("cancel_invoices"), async (req: any, res) => {
    try {
      const existing = await storage.getInvoice(req.params.id);
      if (!existing) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      if (existing.status !== "cancelled") {
        return res.status(400).json({ message: "Only cancelled invoices can be reactivated" });
      }

      const invoice = await storage.updateInvoice(req.params.id, { status: "sent" });

      const userId = req.user?.claims?.sub;
      await logActivityInternal(userId, "update", "payment", existing.id, `Reactivated invoice: ${existing.invoiceNumber}`, req);

      res.json(invoice);
    } catch (error) {
      console.error("Error reactivating invoice:", error);
      res.status(500).json({ message: "Failed to reactivate invoice" });
    }
  });

  // Delete invoice (only drafts)
  app.delete("/api/invoices/:id", isAuthenticated, requirePermission("delete_invoices"), async (req: any, res) => {
    try {
      const existing = await storage.getInvoice(req.params.id);
      if (!existing) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      
      if (existing.status !== "draft" && existing.status !== "cancelled") {
        return res.status(400).json({ message: "Only draft or cancelled invoices can be deleted" });
      }
      
      await storage.deleteInvoice(req.params.id);
      
      const userId = req.user?.claims?.sub;
      await logActivityInternal(userId, "delete", "payment", existing.id, `Deleted ${existing.status} invoice: ${existing.invoiceNumber}`, req);
      
      res.json({ message: "Invoice deleted successfully" });
    } catch (error) {
      console.error("Error deleting invoice:", error);
      res.status(500).json({ message: "Failed to delete invoice" });
    }
  });

  // Get invoice by payment ID
  app.get("/api/payments/:id/invoice", isAuthenticated, async (req, res) => {
    try {
      const invoice = await storage.getInvoiceByPaymentId(req.params.id);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found for this payment" });
      }
      res.json(invoice);
    } catch (error) {
      console.error("Error fetching invoice for payment:", error);
      res.status(500).json({ message: "Failed to fetch invoice" });
    }
  });

  // Ensure the invoice linked to a received payment is marked paid (idempotent safety net for receipts)
  app.post("/api/payments/:id/mark-invoice-paid", isAuthenticated, requirePermission("edit_payments"), async (req: any, res) => {
    try {
      const payment = await storage.getPaymentWithProject(req.params.id);
      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }

      // Only received payments can have their linked invoice settled this way
      if (payment.status !== "received") {
        return res.status(400).json({ message: "Payment is not marked as received" });
      }

      const paidDate = payment.receivedDate ? new Date(payment.receivedDate) : new Date();
      const userId = req.user?.claims?.sub;
      const settled = await settleLinkedInvoiceForReceivedPayment(req.params.id, paidDate, userId, req);
      if (!settled) {
        return res.json({ invoice: null });
      }

      res.json(settled);
    } catch (error) {
      console.error("Error marking linked invoice paid:", error);
      res.status(500).json({ message: "Failed to mark invoice paid" });
    }
  });

  // Create invoice from payment (for backward compatibility with existing payment invoice generation)
  app.post("/api/payments/:id/create-invoice", isAuthenticated, requirePermission("create_payments"), async (req: any, res) => {
    try {
      const payment = await storage.getPaymentWithProject(req.params.id);
      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }
      
      // Check if invoice already exists for this payment
      const existingInvoice = await storage.getInvoiceByPaymentId(req.params.id);
      if (existingInvoice) {
        return res.status(400).json({ message: "Invoice already exists for this payment", invoice: existingInvoice });
      }
      
      const userId = req.user?.claims?.sub;
      const invoiceNumber = await storage.getNextInvoiceNumber();
      
      // Create invoice from payment data
      const invoiceData = {
        invoiceNumber,
        projectId: payment.projectId,
        paymentId: payment.id,
        clientName: payment.project?.clientName || "Unknown Client",
        clientEmail: payment.project?.clientEmail || null,
        region: payment.project?.region || null,
        issueDate: new Date(),
        dueDate: payment.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default 30 days
        paidDate: payment.status === "received" ? new Date() : null,
        subtotal: payment.expectedAmount?.toString() || "0",
        total: payment.expectedAmount?.toString() || "0",
        amountPaid: payment.status === "received" ? payment.expectedAmount?.toString() || "0" : "0",
        balance: payment.status === "received" ? "0" : payment.expectedAmount?.toString() || "0",
        status: payment.status === "received" ? "paid" as const : "draft" as const,
        source: "payment" as const,
        createdBy: userId,
        notes: payment.narration || null,
      };
      
      const invoice = await storage.createInvoice(invoiceData);
      
      // Create line item from payment
      await storage.createInvoiceLineItem({
        invoiceId: invoice.id,
        description: payment.paymentType || "Payment",
        quantity: "1",
        unitPrice: payment.expectedAmount?.toString() || "0",
        amount: payment.expectedAmount?.toString() || "0",
        sortOrder: 0,
      });
      
      await logActivityInternal(userId, "create", "payment", invoice.id, `Created invoice ${invoiceNumber} from payment`, req);
      
      const createdInvoice = await storage.getInvoiceWithDetails(invoice.id);

      // Fail-soft: auto-save a copy of the generated invoice PDF to Drive.
      void uploadInvoicePdfToDrive({
        paymentId: payment.id,
        invoiceNumber,
        invoiceDate: invoice.issueDate,
        description: payment.narration,
        notes: payment.narration,
      });

      res.status(201).json(createdInvoice);
    } catch (error) {
      console.error("Error creating invoice from payment:", error);
      res.status(500).json({ message: "Failed to create invoice from payment" });
    }
  });

  app.get("/api/payments", isAuthenticated, async (req, res) => {
    try {
      const filters: {
        month?: number;
        year?: number;
        region?: Region;
        status?: PaymentStatus;
        pmId?: string;
        paymentType?: PaymentType;
      } = {};

      if (req.query.month) filters.month = parseInt(req.query.month as string);
      if (req.query.year) filters.year = parseInt(req.query.year as string);
      if (req.query.region) filters.region = req.query.region as Region;
      if (req.query.status) filters.status = req.query.status as PaymentStatus;
      if (req.query.pmId) filters.pmId = req.query.pmId as string;
      if (req.query.paymentType) filters.paymentType = req.query.paymentType as PaymentType;

      const payments = await storage.getAllPayments(filters);
      res.json(payments);
    } catch (error) {
      console.error("Error fetching payments:", error);
      res.status(500).json({ message: "Failed to fetch payments" });
    }
  });

  app.get("/api/payments/:id", isAuthenticated, async (req, res) => {
    try {
      const payment = await storage.getPaymentWithProject(req.params.id);
      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }
      res.json(payment);
    } catch (error) {
      console.error("Error fetching payment:", error);
      res.status(500).json({ message: "Failed to fetch payment" });
    }
  });

  app.post("/api/payments", isAuthenticated, requirePermission("create_payments"), async (req: any, res) => {
    try {
      const parsed = insertPaymentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid payment data", errors: parsed.error.errors });
      }
      const payment = await storage.createPayment(parsed.data);
      const userId = req.user?.claims?.sub;
      await logActivityInternal(userId, "create", "payment", payment.id, `Created payment: $${payment.expectedAmount}`, req);
      // Fail-soft: a payment created already "received" gets a receipt PDF.
      if (payment.status === "received") {
        void uploadReceiptPdfToDrive(payment.id);
      }
      
      // Recompute the linked milestone from the FULL set of its linked payments so
      // it aggregates correctly even when paid across several split payments.
      if (payment.milestoneId) {
        await storage.recomputeMilestoneFromPayments(payment.milestoneId);
      }

      // Recompute the linked change-request installment for upsell payments.
      if (payment.crInstallmentId) {
        const installment = await storage.getCrInstallment(payment.crInstallmentId);
        // Only sync installments that belong to the same project (and CR, if specified).
        const coherent = installment
          && installment.projectId === payment.projectId
          && (!payment.changeRequestId || installment.changeRequestId === payment.changeRequestId);
        if (installment && coherent) {
          await storage.recomputeCrInstallmentFromPayments(payment.crInstallmentId);
        }
      }
      
      res.status(201).json(payment);
    } catch (error) {
      console.error("Error creating payment:", error);
      res.status(500).json({ message: "Failed to create payment" });
    }
  });

  // Bulk create payments for plan generation
  app.post("/api/payments/bulk", isAuthenticated, requirePermission("create_payments"), async (req: any, res) => {
    try {
      const { payments: paymentsList } = req.body;
      
      if (!Array.isArray(paymentsList) || paymentsList.length === 0) {
        return res.status(400).json({ message: "No payments provided" });
      }

      const created: any[] = [];
      const errors: string[] = [];
      const userId = req.user?.claims?.sub;

      for (const paymentData of paymentsList) {
        try {
          const parsed = insertPaymentSchema.safeParse(paymentData);
          if (!parsed.success) {
            errors.push(`Invalid data for project ${paymentData.projectId}: ${parsed.error.message}`);
            continue;
          }

          const payment = await storage.createPayment(parsed.data);
          created.push(payment);
          // Fail-soft: a payment created already "received" gets a receipt PDF.
          if (payment.status === "received") {
            void uploadReceiptPdfToDrive(payment.id);
          }
          
          await logActivityInternal(userId, "create", "payment", payment.id, `Bulk created payment: $${payment.expectedAmount}`, req);
        } catch (err: any) {
          errors.push(`Failed to create payment for project ${paymentData.projectId}: ${err.message}`);
        }
      }

      res.status(201).json({ 
        created: created.length, 
        total: paymentsList.length,
        errors 
      });
    } catch (error) {
      console.error("Error bulk creating payments:", error);
      res.status(500).json({ message: "Failed to bulk create payments" });
    }
  });

  app.patch("/api/payments/:id", isAuthenticated, requirePermission("edit_payments"), async (req: any, res) => {
    try {
      const oldPayment = await storage.getPayment(req.params.id);
      
      // Convert date strings to Date objects for database
      const updateData = { ...req.body };
      if (updateData.receivedDate && typeof updateData.receivedDate === 'string') {
        updateData.receivedDate = new Date(updateData.receivedDate);
      }
      if (updateData.invoiceDate && typeof updateData.invoiceDate === 'string') {
        updateData.invoiceDate = new Date(updateData.invoiceDate);
      }
      if (updateData.dueDate && typeof updateData.dueDate === 'string') {
        updateData.dueDate = new Date(updateData.dueDate);
      }
      
      // Auto-set receivedAmount when status changes to "received" and receivedAmount is not provided
      // This ensures receivedAmount is populated for all received payments (used in cost & margin calculations)
      const isChangingToReceived = updateData.status === "received" && oldPayment?.status !== "received";
      // Check if receivedAmount is missing, empty, zero, or falsy (handles string/number/undefined cases)
      const receivedVal = parseFloat(updateData.receivedAmount?.toString() || "0") || 0;
      const receivedAmountNotProvided = receivedVal === 0;
      if (isChangingToReceived && receivedAmountNotProvided && oldPayment) {
        // Use totalAmount (required field) as fallback, then expectedAmount
        const fallbackAmount = oldPayment.totalAmount?.toString() || oldPayment.expectedAmount?.toString() || "0";
        updateData.receivedAmount = fallbackAmount;
      }
      
      const payment = await storage.updatePayment(req.params.id, updateData);
      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }
      const userId = req.user?.claims?.sub;
      const statusChanged = oldPayment && oldPayment.status !== payment.status;
      if (statusChanged) {
        await logActivityInternal(userId, "status_change", "payment", payment.id, `Changed payment status from ${oldPayment?.status} to ${payment.status}`, req);

        if (payment.status === "received") {
          triggerPaymentReceivedNotification(payment.id).catch(console.error);
          // Fail-soft: auto-save a receipt PDF to Drive when a payment is received.
          void uploadReceiptPdfToDrive(payment.id);
          
          // Sync linked invoice status to "paid" when payment is marked received.
          // Settle the full outstanding balance so VAT-inclusive (AE) invoices also
          // reach "paid" — see settleLinkedInvoiceForReceivedPayment.
          try {
            const paidDate = payment.receivedDate
              ? new Date(payment.receivedDate)
              : (updateData.receivedDate ? new Date(updateData.receivedDate) : new Date());
            await settleLinkedInvoiceForReceivedPayment(payment.id, paidDate, userId, req);
          } catch (invoiceSyncError) {
            console.error("Error syncing invoice status to paid:", invoiceSyncError);
            // Continue - payment update succeeded, invoice sync is secondary
          }
        } else if (payment.status === "pending_invoice") {
          triggerInvoicePendingNotification(payment.id).catch(console.error);
        }
        
        // Handle status reversion: if payment status changed FROM "received" to something else
        if (oldPayment?.status === "received" && payment.status !== "received") {
          try {
            // Revert the linked invoice back to "sent" (balance restored) when the
            // payment is no longer received — see ./invoiceSettlement.
            await revertLinkedInvoice(storage, logActivityInternal, payment.id, payment.status, userId, req);
          } catch (invoiceRevertError) {
            console.error("Error reverting invoice status:", invoiceRevertError);
            // Continue - payment update succeeded, invoice revert is secondary
          }
        }
      } else {
        await logActivityInternal(userId, "update", "payment", payment.id, `Updated payment: $${payment.expectedAmount}`, req);
      }

      // Recompute any milestone this payment is (or was) linked to, from the FULL set
      // of its linked payments. This keeps a milestone's received amount and status
      // correct even when it is paid across several split payments.
      if (oldPayment?.milestoneId && oldPayment.milestoneId !== payment.milestoneId) {
        await storage.recomputeMilestoneFromPayments(oldPayment.milestoneId);
      }
      if (payment.milestoneId) {
        await storage.recomputeMilestoneFromPayments(payment.milestoneId);
      }

      // Recompute any CR installment this payment is (or was) linked to. Same aggregation
      // logic as milestones so an installment split across payments stays correct.
      if (oldPayment?.crInstallmentId && oldPayment.crInstallmentId !== payment.crInstallmentId) {
        await storage.recomputeCrInstallmentFromPayments(oldPayment.crInstallmentId);
      }
      if (payment.crInstallmentId) {
        const installment = await storage.getCrInstallment(payment.crInstallmentId);
        // Only sync installments that belong to the same project (and CR, if specified) as the payment.
        const coherent = installment
          && installment.projectId === payment.projectId
          && (!payment.changeRequestId || installment.changeRequestId === payment.changeRequestId);
        if (installment && coherent) {
          await storage.recomputeCrInstallmentFromPayments(payment.crInstallmentId);
        }
      }

      // When payment is marked as received and has no milestone linked,
      // check for matching milestones and return them for the frontend to prompt
      let milestoneSyncSuggestion: any = null;
      if (isChangingToReceived && !payment.milestoneId && !payment.crInstallmentId && payment.projectId) {
        try {
          const settings = await storage.getAppSettings();
          if (settings?.enableMilestoneSyncPrompt) {
            const projectMilestones = await storage.getProjectMilestones(payment.projectId);
            const unpaidMilestones = projectMilestones?.filter(ms => 
              ms.status !== "paid" && ms.status !== "cancelled"
            ) || [];
            
            if (unpaidMilestones.length > 0) {
              const phaseName = payment.phase?.toLowerCase().trim();
              const exactMatch = phaseName ? unpaidMilestones.find(ms => 
                ms.name?.toLowerCase().trim() === phaseName
              ) : null;
              
              if (exactMatch) {
                await storage.updatePayment(payment.id, { milestoneId: exactMatch.id });
                // Recompute from the full set of linked payments rather than forcing "paid".
                const recomputed = await storage.recomputeMilestoneFromPayments(exactMatch.id);
                await logActivityInternal(userId, "status_change", "payment", payment.id, `Auto-linked milestone "${exactMatch.name}" and set to ${recomputed?.status || "partially_paid"}`, req);
                milestoneSyncSuggestion = { autoLinked: true, milestone: recomputed || exactMatch };
              } else {
                milestoneSyncSuggestion = {
                  autoLinked: false,
                  availableMilestones: unpaidMilestones.map(ms => ({
                    id: ms.id,
                    name: ms.name,
                    sequenceNumber: ms.sequenceNumber,
                    expectedAmount: ms.expectedAmount,
                    status: ms.status,
                    dueDate: ms.dueDate,
                  })),
                };
              }
            }
          }
        } catch (syncError) {
          console.error("Error checking milestone sync:", syncError);
        }
      }
      
      res.json({ ...payment, milestoneSyncSuggestion });
    } catch (error) {
      console.error("Error updating payment:", error);
      res.status(500).json({ message: "Failed to update payment" });
    }
  });

  // Link a payment to a milestone manually (from milestone sync prompt)
  app.post("/api/payments/:id/link-milestone", isAuthenticated, requirePermission("edit_payments"), async (req: any, res) => {
    try {
      const { milestoneId } = req.body;
      if (!milestoneId) return res.status(400).json({ message: "milestoneId is required" });
      
      const payment = await storage.getPayment(req.params.id);
      if (!payment) return res.status(404).json({ message: "Payment not found" });
      
      const milestone = await storage.getMilestone(milestoneId);
      if (!milestone) return res.status(404).json({ message: "Milestone not found" });
      
      const userId = req.user?.claims?.sub;

      // Integrity guards: payment must be a received recurring payment on the same project.
      if (payment.projectId !== milestone.projectId) {
        return res.status(400).json({ message: "Payment and milestone belong to different projects" });
      }
      if (payment.paymentType !== "recurring") {
        return res.status(400).json({ message: "Only recurring payments can be linked to milestones" });
      }
      if (payment.status !== "received") {
        return res.status(400).json({ message: "Only received payments can be linked" });
      }
      
      // If this payment was linked to a DIFFERENT milestone, detach it from that one
      // and recompute the old milestone's total from its remaining linked payments.
      if (payment.milestoneId && payment.milestoneId !== milestoneId) {
        const previousMilestoneId = payment.milestoneId;
        await storage.updatePayment(payment.id, { milestoneId: null });
        await storage.recomputeMilestoneFromPayments(previousMilestoneId);
      }

      // Attach this payment to the target milestone. We deliberately do NOT clear any
      // other payments already linked to this milestone so a milestone can be paid
      // across several split payments.
      await storage.updatePayment(payment.id, { milestoneId });

      // Recompute the target milestone from the full set of its linked payments.
      const updatedMilestone = await storage.recomputeMilestoneFromPayments(milestoneId);
      const newStatus = updatedMilestone?.status || "partially_paid";

      await logActivityInternal(userId, "status_change", "payment", payment.id, `Manually linked milestone "${milestone.name}" and set to ${newStatus}`, req);
      
      res.json({ success: true, milestoneStatus: newStatus });
    } catch (error) {
      console.error("Error linking payment to milestone:", error);
      res.status(500).json({ message: "Failed to link payment to milestone" });
    }
  });

  // Clear the link between a payment and its milestone (manual linker).
  app.post("/api/payments/:id/unlink-milestone", isAuthenticated, requirePermission("edit_payments"), async (req: any, res) => {
    try {
      const payment = await storage.getPayment(req.params.id);
      if (!payment) return res.status(404).json({ message: "Payment not found" });

      const milestoneId = payment.milestoneId;
      await storage.updatePayment(payment.id, { milestoneId: null });
      if (milestoneId) {
        // Recompute from the milestone's remaining linked payments (not a full reset),
        // so other split payments still count toward it.
        await storage.recomputeMilestoneFromPayments(milestoneId);
      }

      const userId = req.user?.claims?.sub;
      await logActivityInternal(userId, "status_change", "payment", payment.id, `Cleared milestone link`, req);

      res.json({ success: true });
    } catch (error) {
      console.error("Error unlinking payment from milestone:", error);
      res.status(500).json({ message: "Failed to unlink payment from milestone" });
    }
  });

  // Link an upsell payment to a change-request installment (manual linker).
  app.post("/api/payments/:id/link-cr-installment", isAuthenticated, requirePermission("edit_payments"), async (req: any, res) => {
    try {
      const { crInstallmentId } = req.body;
      if (!crInstallmentId) return res.status(400).json({ message: "crInstallmentId is required" });

      const payment = await storage.getPayment(req.params.id);
      if (!payment) return res.status(404).json({ message: "Payment not found" });

      const installment = await storage.getCrInstallment(crInstallmentId);
      if (!installment) return res.status(404).json({ message: "Installment not found" });

      const userId = req.user?.claims?.sub;

      // Integrity guards: payment must be a received upsell payment on the same project.
      if (payment.projectId !== installment.projectId) {
        return res.status(400).json({ message: "Payment and installment belong to different projects" });
      }
      if (payment.paymentType !== "upsell") {
        return res.status(400).json({ message: "Only upsell payments can be linked to installments" });
      }
      if (payment.status !== "received") {
        return res.status(400).json({ message: "Only received payments can be linked" });
      }

      // If this payment was linked to a DIFFERENT installment, detach it from that one
      // and recompute the old installment's total from its remaining linked payments.
      if (payment.crInstallmentId && payment.crInstallmentId !== crInstallmentId) {
        const previousInstallmentId = payment.crInstallmentId;
        await storage.updatePayment(payment.id, { crInstallmentId: null, changeRequestId: null });
        await storage.recomputeCrInstallmentFromPayments(previousInstallmentId);
      }

      // Attach this payment to the target installment. We deliberately do NOT clear any
      // other payments already linked to this installment so it can be paid across
      // several split payments.
      await storage.updatePayment(payment.id, {
        crInstallmentId,
        changeRequestId: installment.changeRequestId,
      });

      // Recompute the target installment from the full set of its linked payments.
      const updatedInstallment = await storage.recomputeCrInstallmentFromPayments(crInstallmentId);
      const newStatus = updatedInstallment?.status || "partially_paid";

      await logActivityInternal(userId, "status_change", "payment", payment.id, `Manually linked installment "${installment.name}" and set to ${newStatus}`, req);

      res.json({ success: true, installmentStatus: newStatus });
    } catch (error) {
      console.error("Error linking payment to installment:", error);
      res.status(500).json({ message: "Failed to link payment to installment" });
    }
  });

  // Clear the link between a payment and its change-request installment (manual linker).
  app.post("/api/payments/:id/unlink-cr-installment", isAuthenticated, requirePermission("edit_payments"), async (req: any, res) => {
    try {
      const payment = await storage.getPayment(req.params.id);
      if (!payment) return res.status(404).json({ message: "Payment not found" });

      const installmentId = payment.crInstallmentId;
      await storage.updatePayment(payment.id, { crInstallmentId: null, changeRequestId: null });
      if (installmentId) {
        // Recompute from the installment's remaining linked payments (not a full reset).
        await storage.recomputeCrInstallmentFromPayments(installmentId);
      }

      const userId = req.user?.claims?.sub;
      await logActivityInternal(userId, "status_change", "payment", payment.id, `Cleared installment link`, req);

      res.json({ success: true });
    } catch (error) {
      console.error("Error unlinking payment from installment:", error);
      res.status(500).json({ message: "Failed to unlink payment from installment" });
    }
  });

  // ===== Change Requests =====
  app.get("/api/projects/:id/change-requests", isAuthenticated, async (req, res) => {
    try {
      const changeRequests = await storage.getProjectChangeRequests(req.params.id);
      res.json(changeRequests);
    } catch (error) {
      console.error("Error fetching change requests:", error);
      res.status(500).json({ message: "Failed to fetch change requests" });
    }
  });

  app.get("/api/projects/:id/unpaid-cr-installments", isAuthenticated, async (req, res) => {
    try {
      const installments = await storage.getProjectUnpaidCrInstallments(req.params.id);
      res.json(installments);
    } catch (error) {
      console.error("Error fetching unpaid CR installments:", error);
      res.status(500).json({ message: "Failed to fetch unpaid CR installments" });
    }
  });

  // CR Tags (Task #122): shared, reusable colored tags for change requests.
  // Colors auto-assigned at creation from a fixed palette (white text legible).
  const CR_TAG_PALETTE = [
    "#dc2626", "#ea580c", "#d97706", "#ca8a04", "#65a30d", "#16a34a",
    "#059669", "#0d9488", "#0891b2", "#0284c7", "#2563eb", "#4f46e5",
    "#7c3aed", "#9333ea", "#c026d3", "#db2777", "#e11d48", "#475569",
  ];

  app.get("/api/cr-tags", isAuthenticated, async (_req, res) => {
    try {
      const tags = await storage.getCrTags();
      res.json(tags);
    } catch (error) {
      console.error("Error fetching CR tags:", error);
      res.status(500).json({ message: "Failed to fetch tags" });
    }
  });

  app.post("/api/cr-tags", isAuthenticated, requirePermission("edit_projects"), async (req, res) => {
    try {
      const parsed = insertCrTagSchema.partial({ color: true }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid tag data", errors: parsed.error.errors });
      }
      const name = parsed.data.name.trim();
      // Dedupe by case-insensitive name: return the existing tag instead of creating a duplicate.
      const existing = await storage.getCrTags();
      const match = existing.find((t) => t.name.toLowerCase() === name.toLowerCase());
      if (match) {
        return res.status(200).json(match);
      }
      const color = parsed.data.color || CR_TAG_PALETTE[existing.length % CR_TAG_PALETTE.length];
      const created = await storage.createCrTag({ name, color });
      res.status(201).json(created);
    } catch (error) {
      console.error("Error creating CR tag:", error);
      res.status(500).json({ message: "Failed to create tag" });
    }
  });

  app.post("/api/projects/:id/change-requests", isAuthenticated, requirePermission("edit_projects"), async (req: any, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const userId = req.user?.claims?.sub;
      // tagIds are not part of the CR schema; extract before zod parse strips them.
      const tagIds: string[] = Array.isArray(req.body.tagIds) ? req.body.tagIds : [];
      const crData = { ...req.body, projectId: req.params.id, createdBy: userId };
      const parsed = insertChangeRequestSchema.safeParse(crData);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid change request data", errors: parsed.error.errors });
      }

      // Task #111: on CREATE, an upsell (CR) must capture category, what was sold,
      // and a mandatory file attachment. Legacy CRs remain editable without these.
      const missing: string[] = [];
      if (!parsed.data.category?.trim()) missing.push("category");
      if (!parsed.data.whatWasSold?.trim()) missing.push("whatWasSold");
      // Files now live in Google Drive: a new upsell must have a Drive attachment.
      if (!parsed.data.attachmentDriveId?.trim()) missing.push("attachment");
      if (missing.length > 0) {
        return res.status(400).json({
          message: `Missing required upsell fields: ${missing.join(", ")}`,
          errors: missing.map((f) => ({ path: [f], message: `${f} is required` })),
        });
      }

      // Legacy invariant: if an old-style object-storage path is sent, it must be the
      // canonical /objects/... path (new uploads use Drive and won't set this).
      if (parsed.data.attachmentPath && !parsed.data.attachmentPath.startsWith("/objects/")) {
        return res.status(400).json({
          message: "Invalid attachmentPath: must be a canonical /objects/... path",
          errors: [{ path: ["attachmentPath"], message: "must start with /objects/" }],
        });
      }

      const changeRequest = await storage.createChangeRequest(parsed.data);

      // Generate installments via even split of the total amount
      const count = Math.max(1, changeRequest.numberOfInstallments || 1);
      const total = parseFloat(changeRequest.totalAmount?.toString() || "0");
      const baseAmount = Math.floor((total / count) * 100) / 100;
      const lastAmount = Math.round((total - baseAmount * (count - 1)) * 100) / 100;

      const installmentsToCreate = Array.from({ length: count }, (_, i) => ({
        changeRequestId: changeRequest.id,
        projectId: req.params.id,
        name: count === 1 ? "Installment 1" : `Installment ${i + 1} of ${count}`,
        sequenceNumber: i + 1,
        expectedAmount: (i === count - 1 ? lastAmount : baseAmount).toFixed(2),
        status: "planned" as MilestoneStatus,
        dueDate: changeRequest.dateLocked || null,
        invoicedDate: null,
        paidDate: null,
      }));

      const installments = await storage.createBulkCrInstallments(installmentsToCreate);

      await storage.setChangeRequestTags(changeRequest.id, tagIds);
      const tags = (await storage.getCrTags()).filter((t) => tagIds.includes(t.id));

      await logActivityInternal(userId, "create", "project", req.params.id, `Created change request: ${changeRequest.title}`, req);

      res.status(201).json({ ...changeRequest, installments: installments.map(inst => ({ ...inst, payment: null })), tags });
    } catch (error) {
      console.error("Error creating change request:", error);
      res.status(500).json({ message: "Failed to create change request" });
    }
  });

  app.patch("/api/change-requests/:id", isAuthenticated, requirePermission("edit_projects"), async (req: any, res) => {
    try {
      const parsed = updateChangeRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid change request data", errors: parsed.error.errors });
      }
      // Invariant: if an attachment is being set, it must be a canonical /objects/... path.
      if (parsed.data.attachmentPath && !parsed.data.attachmentPath.startsWith("/objects/")) {
        return res.status(400).json({
          message: "Invalid attachmentPath: must be a canonical /objects/... path",
          errors: [{ path: ["attachmentPath"], message: "must start with /objects/" }],
        });
      }
      const changeRequest = await storage.updateChangeRequest(req.params.id, parsed.data);
      if (!changeRequest) {
        return res.status(404).json({ message: "Change request not found" });
      }
      // tagIds are managed separately from the CR row. Only touch tags when the
      // caller explicitly sends a tagIds array (so non-tag edits leave them intact).
      if (Array.isArray(req.body.tagIds)) {
        await storage.setChangeRequestTags(req.params.id, req.body.tagIds);
      }
      const userId = req.user?.claims?.sub;
      await logActivityInternal(userId, "update", "project", changeRequest.projectId, `Updated change request: ${changeRequest.title}`, req);
      res.json(changeRequest);
    } catch (error) {
      console.error("Error updating change request:", error);
      res.status(500).json({ message: "Failed to update change request" });
    }
  });

  app.delete("/api/change-requests/:id", isAuthenticated, requirePermission("edit_projects"), async (req: any, res) => {
    try {
      const changeRequest = await storage.getChangeRequest(req.params.id);
      if (!changeRequest) {
        return res.status(404).json({ message: "Change request not found" });
      }
      const deleted = await storage.deleteChangeRequest(req.params.id);
      if (!deleted) {
        return res.status(500).json({ message: "Failed to delete change request" });
      }
      const userId = req.user?.claims?.sub;
      await logActivityInternal(userId, "delete", "project", changeRequest.projectId, `Deleted change request: ${changeRequest.title}`, req);
      res.json({ message: "Change request deleted successfully" });
    } catch (error) {
      console.error("Error deleting change request:", error);
      res.status(500).json({ message: "Failed to delete change request" });
    }
  });

  // ===== Object storage (file attachments) =====
  // Authenticated presigned-URL upload flow + authenticated file serving. Files
  // live in the private object dir; only logged-in users can request an upload
  // URL or stream a stored file (internal financial documents).
  const objectStorageService = new ObjectStorageService();

  app.post("/api/uploads/request-url", isAuthenticated, async (req: any, res) => {
    try {
      const { name } = req.body || {};
      if (!name) {
        return res.status(400).json({ message: "Missing required field: name" });
      }
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
      res.json({ uploadURL, objectPath });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ message: "Failed to generate upload URL" });
    }
  });

  app.get("/objects/:objectPath(*)", isAuthenticated, async (req: any, res) => {
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      await objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ message: "File not found" });
      }
      console.error("Error serving object:", error);
      if (!res.headersSent) {
        res.status(500).json({ message: "Failed to serve file" });
      }
    }
  });

  // ===== Google Drive (file attachments) =====
  // New uploads live in Google Drive under a per-project folder structure. The raw
  // file body is streamed in; the filename comes from ?name= and the mime type from
  // the Content-Type header. Returns the Drive file id + web view link.
  app.post(
    "/api/projects/:id/change-requests/attachments",
    isAuthenticated,
    requirePermission("edit_projects"),
    express.raw({ type: () => true, limit: "25mb" }),
    async (req: any, res) => {
      try {
        const project = await storage.getProject(req.params.id);
        if (!project) {
          return res.status(404).json({ message: "Project not found" });
        }

        const fileName = (req.query.name as string)?.trim();
        if (!fileName) {
          return res.status(400).json({ message: "Missing required query param: name" });
        }
        const body: Buffer = req.body;
        if (!body || !Buffer.isBuffer(body) || body.length === 0) {
          return res.status(400).json({ message: "Empty file upload" });
        }
        const mimeType = req.headers["content-type"] || "application/octet-stream";

        const folders = await getOrCreateProjectFolders(req.params.id);
        const drive = await getUncachableDriveClient();
        const uploaded = await uploadFileToFolder(
          drive,
          folders.changeRequestsFolderId,
          fileName,
          mimeType,
          body,
        );

        res.json({ driveId: uploaded.id, name: uploaded.name, link: uploaded.webViewLink });
      } catch (error) {
        if (error instanceof DriveNotConnectedError) {
          return res.status(503).json({ message: error.message, code: "DRIVE_NOT_CONNECTED" });
        }
        console.error("Error uploading attachment to Drive:", error);
        res.status(500).json({ message: "Failed to upload file" });
      }
    },
  );

  // Streams a Change Request's Drive attachment. The Drive file id is resolved from
  // the CR record server-side (never taken from the client) so an authenticated user
  // can only fetch files that are actually referenced by a change request — they
  // cannot enumerate arbitrary Drive file ids.
  app.get("/api/change-requests/:id/attachment", isAuthenticated, requirePermission("view_projects"), async (req: any, res) => {
    try {
      const changeRequest = await storage.getChangeRequest(req.params.id);
      if (!changeRequest) {
        return res.status(404).json({ message: "Change request not found" });
      }
      if (!changeRequest.attachmentDriveId) {
        return res.status(404).json({ message: "No Drive attachment for this change request" });
      }
      const fileId = changeRequest.attachmentDriveId;
      const drive = await getUncachableDriveClient();
      const meta = await getFileMetadata(drive, fileId);
      res.setHeader("Content-Type", meta.mimeType);
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${meta.name.replace(/"/g, "")}"`,
      );
      const stream = await downloadFileStream(drive, fileId);
      stream.on("error", (err) => {
        console.error("Error streaming Drive file:", err);
        if (!res.headersSent) res.status(500).json({ message: "Failed to stream file" });
      });
      stream.pipe(res);
    } catch (error) {
      if (error instanceof DriveNotConnectedError) {
        return res.status(503).json({ message: error.message, code: "DRIVE_NOT_CONNECTED" });
      }
      console.error("Error serving Drive file:", error);
      if (!res.headersSent) res.status(500).json({ message: "Failed to serve file" });
    }
  });

  // Sold upsells = all locked change requests across projects, enriched (Task #111).
  app.get("/api/sold-upsells", isAuthenticated, requirePermission("view_upsells"), async (req, res) => {
    try {
      const soldUpsells = await storage.getSoldUpsells();
      res.json(soldUpsells);
    } catch (error) {
      console.error("Error fetching sold upsells:", error);
      res.status(500).json({ message: "Failed to fetch sold upsells" });
    }
  });

  app.patch("/api/cr-installments/:id", isAuthenticated, requirePermission("edit_projects"), async (req: any, res) => {
    try {
      const parsed = updateCrInstallmentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid installment data", errors: parsed.error.errors });
      }
      const installment = await storage.updateCrInstallment(req.params.id, parsed.data);
      if (!installment) {
        return res.status(404).json({ message: "Installment not found" });
      }
      const userId = req.user?.claims?.sub;
      await logActivityInternal(userId, "update", "project", installment.projectId, `Updated CR installment: ${installment.name}`, req);
      res.json(installment);
    } catch (error) {
      console.error("Error updating CR installment:", error);
      res.status(500).json({ message: "Failed to update CR installment" });
    }
  });

  app.patch("/api/cr-installments/:id/status", isAuthenticated, requirePermission("edit_projects"), async (req: any, res) => {
    try {
      const { status } = req.body;
      if (!status || !milestoneStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid status", validStatuses: milestoneStatuses });
      }
      const installment = await storage.updateCrInstallmentStatus(req.params.id, status as MilestoneStatus);
      if (!installment) {
        return res.status(404).json({ message: "Installment not found" });
      }
      const userId = req.user?.claims?.sub;
      await logActivityInternal(userId, "status_change", "project", installment.projectId, `Changed CR installment "${installment.name}" status to ${status}`, req);
      res.json(installment);
    } catch (error) {
      console.error("Error updating CR installment status:", error);
      res.status(500).json({ message: "Failed to update CR installment status" });
    }
  });

  // Delete all payments for a given month/year (delete entire monthly plan)
  // NOTE: This route MUST be defined before /api/payments/:id to prevent "bulk" from being matched as :id
  app.delete("/api/payments/bulk", isAuthenticated, requirePermission("delete_payments"), async (req: any, res) => {
    try {
      const month = parseInt(req.query.month as string);
      const year = parseInt(req.query.year as string);
      
      if (!month || !year || month < 1 || month > 12) {
        return res.status(400).json({ message: "Valid month and year are required" });
      }
      
      // Get all payments for the month/year
      const payments = await storage.getAllPayments({ month, year });
      
      if (payments.length === 0) {
        return res.json({ deleted: 0, message: "No payments found for this month" });
      }
      
      // Delete each payment
      let deletedCount = 0;
      const userId = req.user?.claims?.sub;
      
      for (const payment of payments) {
        const deleted = await storage.deletePayment(payment.id);
        if (deleted) {
          deletedCount++;
        }
      }
      
      await logActivityInternal(userId, "delete", "payment", undefined, `Deleted ${deletedCount} payments for ${month}/${year}`, req);
      
      res.json({ deleted: deletedCount, message: `Successfully deleted ${deletedCount} payments` });
    } catch (error) {
      console.error("Error deleting monthly payments:", error);
      res.status(500).json({ message: "Failed to delete monthly payments" });
    }
  });

  app.delete("/api/payments/:id", isAuthenticated, requirePermission("delete_payments"), async (req: any, res) => {
    try {
      const payment = await storage.getPayment(req.params.id);
      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }
      const deleted = await storage.deletePayment(req.params.id);
      if (!deleted) {
        return res.status(500).json({ message: "Failed to delete payment" });
      }
      // Recompute any milestone/installment this payment was linked to from the
      // remaining linked payments, so other split payments still count toward it.
      if (payment.milestoneId) {
        await storage.recomputeMilestoneFromPayments(payment.milestoneId);
      }
      if (payment.crInstallmentId) {
        await storage.recomputeCrInstallmentFromPayments(payment.crInstallmentId);
      }
      const userId = req.user?.claims?.sub;
      await logActivityInternal(userId, "delete", "payment", req.params.id, `Deleted payment: $${payment.expectedAmount}`, req);
      res.json({ message: "Payment deleted successfully" });
    } catch (error) {
      console.error("Error deleting payment:", error);
      res.status(500).json({ message: "Failed to delete payment" });
    }
  });

  // ========== PAYMENT COMMENTS ROUTES ==========
  app.get("/api/payments/:id/comments", isAuthenticated, async (req: any, res) => {
    try {
      const comments = await storage.getPaymentComments(req.params.id);
      res.json(comments);
    } catch (error) {
      console.error("Error fetching payment comments:", error);
      res.status(500).json({ message: "Failed to fetch payment comments" });
    }
  });

  app.get("/api/payment-comments/summary", isAuthenticated, async (req: any, res) => {
    try {
      const idsParam = req.query.paymentIds;
      let ids: string[] = [];
      if (typeof idsParam === "string") {
        ids = idsParam.split(",").map(s => s.trim()).filter(Boolean);
      } else if (Array.isArray(idsParam)) {
        ids = idsParam.flatMap((v: any) => String(v).split(",")).map(s => s.trim()).filter(Boolean);
      }
      const [counts, latest] = await Promise.all([
        storage.getPaymentCommentCounts(ids),
        storage.getLatestPaymentComments(ids),
      ]);
      const summary: Record<string, { count: number; latest: PaymentCommentWithUser | null }> = {};
      for (const id of ids) {
        summary[id] = {
          count: counts.get(id) || 0,
          latest: latest.get(id) || null,
        };
      }
      res.json(summary);
    } catch (error) {
      console.error("Error fetching payment comment summary:", error);
      res.status(500).json({ message: "Failed to fetch payment comment summary" });
    }
  });

  app.post("/api/payments/:id/comments", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const payment = await storage.getPayment(req.params.id);
      if (!payment) return res.status(404).json({ message: "Payment not found" });
      const parsed = insertPaymentCommentSchema.safeParse({
        paymentId: req.params.id,
        userId,
        comment: req.body?.comment,
      });
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid comment", errors: parsed.error.errors });
      }
      if (!parsed.data.comment.trim()) {
        return res.status(400).json({ message: "Comment cannot be empty" });
      }
      const created = await storage.createPaymentComment(parsed.data);
      const [withUser] = await storage.getPaymentComments(req.params.id).then(list => list.filter(c => c.id === created.id));
      res.status(201).json(withUser || created);
    } catch (error) {
      console.error("Error creating payment comment:", error);
      res.status(500).json({ message: "Failed to create payment comment" });
    }
  });

  app.patch("/api/payment-comments/:commentId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const existing = await storage.getPaymentComment(req.params.commentId);
      if (!existing) return res.status(404).json({ message: "Comment not found" });
      if (existing.userId !== userId) {
        return res.status(403).json({ message: "You can only edit your own comments" });
      }
      const comment = String(req.body?.comment || "").trim();
      if (!comment) return res.status(400).json({ message: "Comment cannot be empty" });
      const updated = await storage.updatePaymentComment(req.params.commentId, comment);
      res.json(updated);
    } catch (error) {
      console.error("Error updating payment comment:", error);
      res.status(500).json({ message: "Failed to update payment comment" });
    }
  });

  app.delete("/api/payment-comments/:commentId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const existing = await storage.getPaymentComment(req.params.commentId);
      if (!existing) return res.status(404).json({ message: "Comment not found" });
      const user = await storage.getUser(userId);
      const isAdminUser = user?.role === "admin";
      if (existing.userId !== userId && !isAdminUser) {
        return res.status(403).json({ message: "You can only delete your own comments" });
      }
      const deleted = await storage.deletePaymentComment(req.params.commentId);
      res.json({ success: deleted });
    } catch (error) {
      console.error("Error deleting payment comment:", error);
      res.status(500).json({ message: "Failed to delete payment comment" });
    }
  });

  // Carry forward unreceived payments from previous month
  app.post("/api/payments/carry-forward", isAuthenticated, requirePermission("edit_payments"), async (req: any, res) => {
    try {
      const { paymentIds, targetMonth, targetYear } = req.body;
      
      if (!paymentIds || !Array.isArray(paymentIds) || paymentIds.length === 0) {
        return res.status(400).json({ message: "Payment IDs are required" });
      }
      
      if (!targetMonth || !targetYear || typeof targetMonth !== "number" || typeof targetYear !== "number") {
        return res.status(400).json({ message: "Target month and year are required and must be numbers" });
      }
      
      // Calculate expected previous month based on target
      const expectedPrevMonth = targetMonth === 1 ? 12 : targetMonth - 1;
      const expectedPrevYear = targetMonth === 1 ? targetYear - 1 : targetYear;
      
      const createdPayments = [];
      const skippedPayments = [];
      const userId = req.user?.claims?.sub;
      
      for (const paymentId of paymentIds) {
        if (typeof paymentId !== "string") {
          skippedPayments.push({ id: paymentId, reason: "Invalid payment ID format" });
          continue;
        }
        
        const originalPayment = await storage.getPaymentWithProject(paymentId);
        if (!originalPayment) {
          skippedPayments.push({ id: paymentId, reason: "Payment not found" });
          continue;
        }
        
        // Validate payment is from the previous month
        if (originalPayment.month !== expectedPrevMonth || originalPayment.year !== expectedPrevYear) {
          skippedPayments.push({ id: paymentId, reason: "Payment is not from the previous month" });
          continue;
        }
        
        // Validate payment is unreceived
        if (originalPayment.status === "received") {
          skippedPayments.push({ id: paymentId, reason: "Payment is already received" });
          continue;
        }
        
        // Build and validate payload for the new payment
        const newPaymentData = {
          projectId: originalPayment.projectId,
          expectedAmount: originalPayment.expectedAmount,
          totalAmount: originalPayment.totalAmount,
          paymentType: originalPayment.paymentType,
          status: "pending_invoice" as const, // Reset status for new month
          narration: originalPayment.narration ? `Carried forward: ${originalPayment.narration}` : "Carried forward from previous month",
          month: targetMonth,
          year: targetYear,
          isTarget: true,
        };
        
        // Validate against schema before creating
        const parsed = insertPaymentSchema.safeParse(newPaymentData);
        if (!parsed.success) {
          skippedPayments.push({ id: paymentId, reason: "Invalid payment data" });
          continue;
        }
        
        const newPayment = await storage.createPayment(parsed.data);
        createdPayments.push(newPayment);
        await logActivityInternal(userId, "create", "payment", newPayment.id, `Carried forward payment from ${originalPayment.month}/${originalPayment.year}: $${newPayment.expectedAmount}`, req);
      }
      
      res.status(201).json({ 
        message: `${createdPayments.length} payment(s) carried forward successfully`,
        payments: createdPayments,
        skipped: skippedPayments.length > 0 ? skippedPayments : undefined
      });
    } catch (error) {
      console.error("Error carrying forward payments:", error);
      res.status(500).json({ message: "Failed to carry forward payments" });
    }
  });

  // Monthly Plan CRUD routes
  app.get("/api/monthly-plans", isAuthenticated, async (req, res) => {
    try {
      const year = req.query.year ? parseInt(req.query.year as string) : undefined;
      const plans = await storage.getAllMonthlyPlans(year);
      res.json(plans);
    } catch (error) {
      console.error("Error fetching monthly plans:", error);
      res.status(500).json({ message: "Failed to fetch monthly plans" });
    }
  });

  // Get monthly plan by month and year
  app.get("/api/monthly-plans/by-date", isAuthenticated, async (req, res) => {
    try {
      const month = parseInt(req.query.month as string);
      const year = parseInt(req.query.year as string);
      if (isNaN(month) || isNaN(year)) {
        return res.status(400).json({ message: "Month and year are required" });
      }
      const plan = await storage.getMonthlyPlan(month, year);
      if (!plan) {
        return res.json(null);
      }
      res.json(plan);
    } catch (error) {
      console.error("Error fetching monthly plan by date:", error);
      res.status(500).json({ message: "Failed to fetch monthly plan" });
    }
  });

  app.get("/api/monthly-plans/:id", isAuthenticated, async (req, res) => {
    try {
      const plan = await storage.getMonthlyPlanById(req.params.id);
      if (!plan) {
        return res.status(404).json({ message: "Monthly plan not found" });
      }
      res.json(plan);
    } catch (error) {
      console.error("Error fetching monthly plan:", error);
      res.status(500).json({ message: "Failed to fetch monthly plan" });
    }
  });

  app.post("/api/monthly-plans", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const data = { ...req.body, createdBy: userId };
      const parsed = insertMonthlyPlanSchema.safeParse(data);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid monthly plan data", errors: parsed.error.errors });
      }
      
      // Check for duplicate month/year
      const existing = await storage.getMonthlyPlan(parsed.data.month, parsed.data.year);
      if (existing) {
        return res.status(409).json({ message: `A plan for ${parsed.data.month}/${parsed.data.year} already exists` });
      }
      
      const plan = await storage.createMonthlyPlan(parsed.data);
      await logActivityInternal(userId, "create", "monthly_plan", plan.id, `Created monthly plan for ${plan.month}/${plan.year}: target $${plan.monthlyTarget}`, req);
      res.status(201).json(plan);
    } catch (error) {
      console.error("Error creating monthly plan:", error);
      res.status(500).json({ message: "Failed to create monthly plan" });
    }
  });

  app.patch("/api/monthly-plans/:id", isAuthenticated, async (req: any, res) => {
    try {
      const plan = await storage.updateMonthlyPlan(req.params.id, req.body);
      if (!plan) {
        return res.status(404).json({ message: "Monthly plan not found" });
      }
      const userId = req.user?.claims?.sub;
      await logActivityInternal(userId, "update", "monthly_plan", plan.id, `Updated monthly plan for ${plan.month}/${plan.year}: target $${plan.monthlyTarget}`, req);
      res.json(plan);
    } catch (error) {
      console.error("Error updating monthly plan:", error);
      res.status(500).json({ message: "Failed to update monthly plan" });
    }
  });

  app.delete("/api/monthly-plans/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const plan = await storage.getMonthlyPlanById(req.params.id);
      const deleted = await storage.deleteMonthlyPlan(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Monthly plan not found" });
      }
      const userId = req.user?.claims?.sub;
      await logActivityInternal(userId, "delete", "monthly_plan", req.params.id, `Deleted monthly plan for ${plan?.month}/${plan?.year}`, req);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting monthly plan:", error);
      res.status(500).json({ message: "Failed to delete monthly plan" });
    }
  });

  // Monthly Plan Payments routes
  app.get("/api/monthly-plans/:id/payments", isAuthenticated, async (req: any, res) => {
    try {
      const filters: { pmId?: string; region?: Region; paymentType?: PaymentType; status?: PaymentStatus } = {};
      if (req.query.pmId) filters.pmId = req.query.pmId as string;
      if (req.query.region) filters.region = req.query.region as Region;
      if (req.query.paymentType) filters.paymentType = req.query.paymentType as PaymentType;
      if (req.query.status) filters.status = req.query.status as PaymentStatus;
      
      const payments = await storage.getMonthlyPlanPayments(req.params.id, filters);
      res.json(payments);
    } catch (error) {
      console.error("Error fetching monthly plan payments:", error);
      res.status(500).json({ message: "Failed to fetch monthly plan payments" });
    }
  });

  app.get("/api/monthly-plans/:id/summary", isAuthenticated, async (req, res) => {
    try {
      const plan = await storage.getMonthlyPlanById(req.params.id);
      if (!plan) {
        return res.status(404).json({ message: "Monthly plan not found" });
      }
      
      const payments = await storage.getMonthlyPlanPayments(req.params.id, {});
      
      let totalRecurringTarget = 0;
      let totalReceived = 0;
      let totalUpsells = 0;
      
      for (const payment of payments) {
        const expected = parseFloat(payment.expectedAmount) || 0;
        const received = parseFloat(payment.receivedAmount || "0") || 0;
        
        if (payment.paymentType === "recurring" && payment.isTarget) {
          totalRecurringTarget += expected;
        }
        if (payment.paymentType === "upsell") {
          totalUpsells += expected;
        }
        totalReceived += received;
      }
      
      res.json({
        id: plan.id,
        month: plan.month,
        year: plan.year,
        monthlyTarget: parseFloat(plan.monthlyTarget) || 0,
        totalRecurringTarget,
        totalReceived,
        totalRemaining: totalRecurringTarget - totalReceived,
        totalUpsells,
        paymentCount: payments.length,
      });
    } catch (error) {
      console.error("Error fetching monthly plan summary:", error);
      res.status(500).json({ message: "Failed to fetch monthly plan summary" });
    }
  });

  app.post("/api/monthly-plans/:id/payments", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const plan = await storage.getMonthlyPlanById(req.params.id);
      if (!plan) {
        return res.status(404).json({ message: "Monthly plan not found" });
      }
      
      const data = { 
        ...req.body, 
        monthlyPlanId: req.params.id,
        month: plan.month,
        year: plan.year,
      };
      
      const parsed = insertPaymentSchema.safeParse(data);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid payment data", errors: parsed.error.errors });
      }
      
      const payment = await storage.createPayment(parsed.data);
      const userId = req.user?.claims?.sub;
      await logActivityInternal(userId, "create", "payment", payment.id, `Added payment to plan ${plan.month}/${plan.year}: $${payment.expectedAmount}`, req);
      // Fail-soft: a payment created already "received" gets a receipt PDF.
      if (payment.status === "received") {
        void uploadReceiptPdfToDrive(payment.id);
      }
      res.status(201).json(payment);
    } catch (error) {
      console.error("Error creating payment for monthly plan:", error);
      res.status(500).json({ message: "Failed to create payment" });
    }
  });

  app.post("/api/monthly-plans/:id/link-payment", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { paymentId } = req.body;
      if (!paymentId) {
        return res.status(400).json({ message: "Payment ID is required" });
      }
      
      const payment = await storage.linkPaymentToMonthlyPlan(paymentId, req.params.id);
      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }
      
      const userId = req.user?.claims?.sub;
      await logActivityInternal(userId, "update", "payment", paymentId, `Linked payment to monthly plan`, req);
      res.json(payment);
    } catch (error) {
      console.error("Error linking payment to monthly plan:", error);
      res.status(500).json({ message: "Failed to link payment" });
    }
  });

  // PM Targets routes
  app.get("/api/pm-targets", isAuthenticated, async (req, res) => {
    try {
      const now = new Date();
      const month = req.query.month ? parseInt(req.query.month as string) : now.getMonth() + 1;
      const year = req.query.year ? parseInt(req.query.year as string) : now.getFullYear();
      
      const targets = await storage.getPmTargets(month, year);
      res.json(targets);
    } catch (error) {
      console.error("Error fetching PM targets:", error);
      res.status(500).json({ message: "Failed to fetch PM targets" });
    }
  });

  app.post("/api/pm-targets", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const parsed = insertPmTargetSchema.safeParse({
        pmId: req.body.pmId,
        month: typeof req.body.month === "string" ? parseInt(req.body.month) : req.body.month,
        year: typeof req.body.year === "string" ? parseInt(req.body.year) : req.body.year,
        targetAmount: req.body.targetAmount?.toString(),
      });
      
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid PM target data", errors: parsed.error.errors });
      }
      
      const target = await storage.upsertPmTarget(parsed.data);
      
      const userId = req.user?.claims?.sub;
      await logActivityInternal(userId, "update", "monthly_plan", target.id, `Set PM target: $${parsed.data.targetAmount} for ${parsed.data.month}/${parsed.data.year}`, req);
      res.json(target);
    } catch (error) {
      console.error("Error setting PM target:", error);
      res.status(500).json({ message: "Failed to set PM target" });
    }
  });

  app.delete("/api/pm-targets/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const success = await storage.deletePmTarget(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "PM target not found" });
      }
      
      const userId = req.user?.claims?.sub;
      await logActivityInternal(userId, "delete", "monthly_plan", req.params.id, `Deleted PM target`, req);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting PM target:", error);
      res.status(500).json({ message: "Failed to delete PM target" });
    }
  });

  // ============================================================================
  // PODs routes
  // ============================================================================

  // List all PODs
  app.get("/api/pods", isAuthenticated, requirePermission("view_pods", "manage_pods"), async (_req, res) => {
    try {
      const podsList = await storage.getAllPods();
      res.json(podsList);
    } catch (error) {
      console.error("Error fetching PODs:", error);
      res.status(500).json({ message: "Failed to fetch PODs" });
    }
  });

  // POD stats for a single month: /api/pods/stats?month=&year= (also accepts startMonth/startYear/endMonth/endYear)
  // POD stats for a cumulative range: /api/pods/stats/range?startMonth=&startYear=&endMonth=&endYear=
  const podStatsHandler = async (req: any, res: any) => {
    try {
      const now = new Date();
      // Single-month shortcut: month=&year=
      const singleMonth = req.query.month ? parseInt(req.query.month as string) : null;
      const singleYear = req.query.year ? parseInt(req.query.year as string) : null;
      const sm = singleMonth ?? (req.query.startMonth ? parseInt(req.query.startMonth as string) : now.getMonth() + 1);
      const sy = singleYear ?? (req.query.startYear ? parseInt(req.query.startYear as string) : now.getFullYear());
      const em = singleMonth ?? (req.query.endMonth ? parseInt(req.query.endMonth as string) : sm);
      const ey = singleYear ?? (req.query.endYear ? parseInt(req.query.endYear as string) : sy);
      if (
        !Number.isFinite(sm) || !Number.isFinite(sy) ||
        !Number.isFinite(em) || !Number.isFinite(ey) ||
        sm < 1 || sm > 12 || em < 1 || em > 12 ||
        ey < sy || (ey === sy && em < sm)
      ) {
        return res.status(400).json({ message: "Invalid period" });
      }
      const stats = await storage.getPodStats(sm, sy, em, ey);
      const totals = stats.reduce(
        (acc, p) => {
          acc.t1 += p.t1;
          acc.t2 += p.t2;
          acc.recurringReceived += p.recurringReceived;
          acc.upsellReceived += p.upsellReceived;
          acc.totalReceived += p.totalReceived;
          return acc;
        },
        { t1: 0, t2: 0, recurringReceived: 0, upsellReceived: 0, totalReceived: 0 },
      );
      const totalsWithDerived = {
        ...totals,
        achievedT1Percent: totals.t1 > 0 ? (totals.totalReceived / totals.t1) * 100 : 0,
        achievedT2Percent: totals.t2 > 0 ? (totals.totalReceived / totals.t2) * 100 : 0,
        remainingT1: totals.t1 - totals.totalReceived,
        remainingT2: totals.t2 - totals.totalReceived,
        period: { startMonth: sm, startYear: sy, endMonth: em, endYear: ey },
      };
      res.json({ pods: stats, totals: totalsWithDerived });
    } catch (error) {
      console.error("Error fetching POD stats:", error);
      res.status(500).json({ message: "Failed to fetch POD stats" });
    }
  };
  app.get("/api/pods/stats", isAuthenticated, requirePermission("view_pods", "manage_pods"), podStatsHandler);
  app.get("/api/pods/stats/range", isAuthenticated, requirePermission("view_pods", "manage_pods"), podStatsHandler);

  // Single POD detail including members and overrides
  app.get("/api/pods/:id", isAuthenticated, requirePermission("view_pods", "manage_pods"), async (req, res) => {
    try {
      const pod = await storage.getPod(req.params.id);
      if (!pod) return res.status(404).json({ message: "POD not found" });
      const overrides = await storage.getPodTargetOverrides(pod.id);
      res.json({ ...pod, overrides });
    } catch (error) {
      console.error("Error fetching POD:", error);
      res.status(500).json({ message: "Failed to fetch POD" });
    }
  });

  // Create POD
  app.post("/api/pods", isAuthenticated, requirePermission("manage_pods"), async (req: any, res) => {
    try {
      const parsed = insertPodSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid POD data", errors: parsed.error.errors });
      }
      const userId = req.user?.claims?.sub;
      const pod = await storage.createPod({ ...parsed.data, createdBy: userId });
      // Optional members on create
      if (Array.isArray(req.body.memberIds)) {
        await storage.setPodMembers(pod.id, req.body.memberIds as string[], parsePodMoveStrategy(req.body.memberMoveStrategy));
      }
      await logActivityInternal(userId, "create", "pod", pod.id, `Created POD: ${pod.name}`, req);
      res.status(201).json(pod);
    } catch (error: any) {
      console.error("Error creating POD:", error);
      if (error?.code === "23505") {
        return res.status(409).json({ message: "A POD with this name already exists" });
      }
      res.status(500).json({ message: "Failed to create POD" });
    }
  });

  // Update POD
  app.patch("/api/pods/:id", isAuthenticated, requirePermission("manage_pods"), async (req: any, res) => {
    try {
      const parsed = updatePodSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid POD data", errors: parsed.error.errors });
      }
      const pod = await storage.updatePod(req.params.id, parsed.data);
      if (!pod) return res.status(404).json({ message: "POD not found" });
      if (Array.isArray(req.body.memberIds)) {
        await storage.setPodMembers(pod.id, req.body.memberIds as string[], parsePodMoveStrategy(req.body.memberMoveStrategy));
      }
      const userId = req.user?.claims?.sub;
      await logActivityInternal(userId, "update", "pod", pod.id, `Updated POD: ${pod.name}`, req);
      res.json(pod);
    } catch (error: any) {
      console.error("Error updating POD:", error);
      if (error?.code === "23505") {
        return res.status(409).json({ message: "A POD with this name already exists" });
      }
      res.status(500).json({ message: "Failed to update POD" });
    }
  });

  // Delete POD
  app.delete("/api/pods/:id", isAuthenticated, requirePermission("manage_pods"), async (req: any, res) => {
    try {
      const pod = await storage.getPod(req.params.id);
      const ok = await storage.deletePod(req.params.id);
      if (!ok) return res.status(404).json({ message: "POD not found" });
      const userId = req.user?.claims?.sub;
      await logActivityInternal(userId, "delete", "pod", req.params.id, `Deleted POD: ${pod?.name ?? req.params.id}`, req);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting POD:", error);
      res.status(500).json({ message: "Failed to delete POD" });
    }
  });

  // Replace POD members (bulk set) — kept for management dialog convenience
  app.put("/api/pods/:id/members", isAuthenticated, requirePermission("manage_pods"), async (req: any, res) => {
    try {
      const memberIds = Array.isArray(req.body?.memberIds) ? req.body.memberIds as string[] : null;
      if (!memberIds) return res.status(400).json({ message: "memberIds (string[]) required" });
      const pod = await storage.getPod(req.params.id);
      if (!pod) return res.status(404).json({ message: "POD not found" });
      await storage.setPodMembers(req.params.id, memberIds, parsePodMoveStrategy(req.body?.memberMoveStrategy));
      const userId = req.user?.claims?.sub;
      await logActivityInternal(userId, "update", "pod", req.params.id, `Updated POD members for ${pod.name} (${memberIds.length})`, req);
      res.json({ success: true });
    } catch (error) {
      console.error("Error setting POD members:", error);
      res.status(500).json({ message: "Failed to set POD members" });
    }
  });

  // Add a single PM to the POD (moves them if they were in another POD)
  app.post("/api/pods/:id/members", isAuthenticated, requirePermission("manage_pods"), async (req: any, res) => {
    try {
      const userIdToAdd = typeof req.body?.userId === "string" ? req.body.userId : null;
      if (!userIdToAdd) return res.status(400).json({ message: "userId required" });
      const pod = await storage.getPod(req.params.id);
      if (!pod) return res.status(404).json({ message: "POD not found" });
      await storage.addPodMember(req.params.id, userIdToAdd, parsePodMoveStrategy(req.body?.memberMoveStrategy));
      const actor = req.user?.claims?.sub;
      await logActivityInternal(actor, "update", "pod", req.params.id, `Added PM ${userIdToAdd} to POD ${pod.name}`, req);
      res.json({ success: true });
    } catch (error) {
      console.error("Error adding POD member:", error);
      res.status(500).json({ message: "Failed to add POD member" });
    }
  });

  // Remove a specific PM from this POD
  app.delete("/api/pods/:id/members/:userId", isAuthenticated, requirePermission("manage_pods"), async (req: any, res) => {
    try {
      const pod = await storage.getPod(req.params.id);
      if (!pod) return res.status(404).json({ message: "POD not found" });
      const ok = await storage.removePodMember(req.params.id, req.params.userId);
      if (!ok) return res.status(404).json({ message: "Member not in this POD" });
      const actor = req.user?.claims?.sub;
      await logActivityInternal(actor, "update", "pod", req.params.id, `Removed PM ${req.params.userId} from POD ${pod.name}`, req);
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing POD member:", error);
      res.status(500).json({ message: "Failed to remove POD member" });
    }
  });

  // List a PM's POD membership history (effective-dated attribution overrides).
  app.get("/api/users/:userId/pod-memberships", isAuthenticated, requirePermission("view_pods", "manage_pods"), async (req, res) => {
    try {
      const memberships = await storage.getPodMembershipsForUser(req.params.userId);
      res.json(memberships);
    } catch (error) {
      console.error("Error fetching PM POD memberships:", error);
      res.status(500).json({ message: "Failed to fetch POD membership history" });
    }
  });

  // Create a POD membership history record for a PM.
  app.post("/api/pod-memberships", isAuthenticated, requirePermission("manage_pods"), async (req: any, res) => {
    try {
      const parsed = insertPodMembershipSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid membership data", errors: parsed.error.errors });
      }
      const pod = await storage.getPod(parsed.data.podId);
      if (!pod) return res.status(404).json({ message: "Target POD not found" });
      const created = await storage.createPodMembership(parsed.data);
      const actor = req.user?.claims?.sub;
      await logActivityInternal(actor, "create", "pod", created.id, `Added POD history record for PM ${created.userId} → ${pod.name}`, req);
      res.status(201).json(created);
    } catch (error) {
      if (error instanceof PodMembershipValidationError) {
        return res.status(400).json({ message: error.message });
      }
      console.error("Error creating POD membership:", error);
      res.status(500).json({ message: "Failed to create POD membership" });
    }
  });

  // Update a POD membership history record (adjust range or target POD).
  app.patch("/api/pod-memberships/:id", isAuthenticated, requirePermission("manage_pods"), async (req: any, res) => {
    try {
      const partialSchema = insertPodMembershipSchema.partial();
      const parsed = partialSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid membership data", errors: parsed.error.errors });
      }
      if (parsed.data.podId) {
        const pod = await storage.getPod(parsed.data.podId);
        if (!pod) return res.status(404).json({ message: "Target POD not found" });
      }
      const updated = await storage.updatePodMembership(req.params.id, parsed.data);
      if (!updated) return res.status(404).json({ message: "Membership record not found" });
      const actor = req.user?.claims?.sub;
      await logActivityInternal(actor, "update", "pod", updated.id, `Updated POD history record for PM ${updated.userId}`, req);
      res.json(updated);
    } catch (error) {
      if (error instanceof PodMembershipValidationError) {
        return res.status(400).json({ message: error.message });
      }
      console.error("Error updating POD membership:", error);
      res.status(500).json({ message: "Failed to update POD membership" });
    }
  });

  // Delete a POD membership history record.
  app.delete("/api/pod-memberships/:id", isAuthenticated, requirePermission("manage_pods"), async (req: any, res) => {
    try {
      const ok = await storage.deletePodMembership(req.params.id);
      if (!ok) return res.status(404).json({ message: "Membership record not found" });
      const actor = req.user?.claims?.sub;
      await logActivityInternal(actor, "delete", "pod", req.params.id, `Deleted POD history record ${req.params.id}`, req);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting POD membership:", error);
      res.status(500).json({ message: "Failed to delete POD membership" });
    }
  });

  // List overrides for a POD
  app.get("/api/pods/:id/overrides", isAuthenticated, requirePermission("view_pods", "manage_pods"), async (req, res) => {
    try {
      const pod = await storage.getPod(req.params.id);
      if (!pod) return res.status(404).json({ message: "POD not found" });
      const overrides = await storage.getPodTargetOverrides(req.params.id);
      res.json(overrides);
    } catch (error) {
      console.error("Error fetching POD overrides:", error);
      res.status(500).json({ message: "Failed to fetch overrides" });
    }
  });

  // Upsert POD target override for a specific month (PUT per spec, POST kept as alias)
  const upsertOverrideHandler = async (req: any, res: any) => {
    try {
      const parsed = insertPodTargetOverrideSchema.safeParse({
        podId: req.params.id,
        month: typeof req.body.month === "string" ? parseInt(req.body.month) : req.body.month,
        year: typeof req.body.year === "string" ? parseInt(req.body.year) : req.body.year,
        t1: req.body.t1,
        t2: req.body.t2,
      });
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid override data", errors: parsed.error.errors });
      }
      const row = await storage.upsertPodTargetOverride(parsed.data);
      const userId = req.user?.claims?.sub;
      await logActivityInternal(userId, "update", "pod", req.params.id, `Set POD override ${parsed.data.month}/${parsed.data.year}`, req);
      res.json(row);
    } catch (error) {
      console.error("Error setting POD override:", error);
      res.status(500).json({ message: "Failed to set POD override" });
    }
  };
  app.put("/api/pods/:id/overrides", isAuthenticated, requirePermission("manage_pods"), upsertOverrideHandler);
  app.post("/api/pods/:id/overrides", isAuthenticated, requirePermission("manage_pods"), upsertOverrideHandler);

  // Delete an override by month/year (per spec)
  app.delete("/api/pods/:id/overrides/:month/:year", isAuthenticated, requirePermission("manage_pods"), async (req: any, res) => {
    try {
      const month = parseInt(req.params.month);
      const year = parseInt(req.params.year);
      if (!Number.isFinite(month) || month < 1 || month > 12 || !Number.isFinite(year)) {
        return res.status(400).json({ message: "Invalid month/year" });
      }
      const overrides = await storage.getPodTargetOverrides(req.params.id);
      const owned = overrides.find((o) => o.month === month && o.year === year);
      if (!owned) return res.status(404).json({ message: "Override not found" });
      const ok = await storage.deletePodTargetOverride(owned.id);
      if (!ok) return res.status(404).json({ message: "Override not found" });
      const userId = req.user?.claims?.sub;
      await logActivityInternal(userId, "delete", "pod", req.params.id, `Deleted POD override ${month}/${year}`, req);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting POD override:", error);
      res.status(500).json({ message: "Failed to delete POD override" });
    }
  });

  app.get("/api/dashboard/stats", isAuthenticated, async (req, res) => {
    try {
      const now = new Date();
      const month = req.query.month ? parseInt(req.query.month as string) : now.getMonth() + 1;
      const year = req.query.year ? parseInt(req.query.year as string) : now.getFullYear();

      const stats = await storage.getDashboardStats(month, year);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // PM Leaders endpoint - returns top performer (%), top value performer (cash-in), and top upseller
  app.get("/api/dashboard/pm-leaders", isAuthenticated, async (req, res) => {
    try {
      const now = new Date();
      const month = req.query.month ? parseInt(req.query.month as string) : now.getMonth() + 1;
      const year = req.query.year ? parseInt(req.query.year as string) : now.getFullYear();

      const pmTargets = await storage.getPmTargets(month, year);
      const pmsWithActivity = pmTargets.filter(pt => parseFloat(pt.targetAmount) > 0 || pt.actualReceived > 0);
      
      // Top Performer - highest percentage (actualReceived / targetAmount)
      // Only consider PMs with a target > 0
      let topPerformer = null;
      let highestProgress = -Infinity;
      for (const pt of pmsWithActivity) {
        const target = parseFloat(pt.targetAmount) || 0;
        if (target > 0) {
          const progress = (pt.actualReceived / target) * 100;
          if (progress > highestProgress) {
            highestProgress = progress;
            topPerformer = {
              pm: pt.pm,
              progress,
              actualReceived: pt.actualReceived,
              targetAmount: target,
            };
          }
        }
      }
      
      // Top Value Performer - highest total cash-in (actualReceived)
      // Consider any PM with activity (target or received > 0)
      let topValuePerformer = null;
      let highestCashIn = -Infinity;
      for (const pt of pmsWithActivity) {
        if (pt.actualReceived > highestCashIn) {
          highestCashIn = pt.actualReceived;
          topValuePerformer = {
            pm: pt.pm,
            totalCashIn: pt.actualReceived,
          };
        }
      }
      
      // Top Upseller - highest upsell received
      // Only show if there are upsells
      let topUpseller = null;
      let highestUpsell = 0;
      for (const pt of pmsWithActivity) {
        if (pt.upsellReceived > highestUpsell) {
          highestUpsell = pt.upsellReceived;
          topUpseller = {
            pm: pt.pm,
            upsellAmount: pt.upsellReceived,
          };
        }
      }
      
      res.json({ topPerformer, topValuePerformer, topUpseller });
    } catch (error) {
      console.error("Error fetching PM leaders:", error);
      res.status(500).json({ message: "Failed to fetch PM leaders" });
    }
  });

  // Dashboard - Attention Required items (overdue payments, pending invoices, etc.)
  app.get("/api/dashboard/attention-required", isAuthenticated, async (req, res) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Get overdue payments directly
      const overduePayments = await storage.getOverduePayments();
      
      // Get all invoices
      const allInvoices = await storage.getAllInvoices();
      
      // Overdue invoices: due date passed, status is sent
      const overdueInvoices = allInvoices.filter((inv: any) => {
        if (!inv.dueDate) return false;
        const dueDate = new Date(inv.dueDate);
        return dueDate < today && inv.status === "sent";
      }).slice(0, 5);
      
      // Pending invoices (drafts that need to be sent)
      const pendingInvoices = allInvoices.filter((inv: any) => inv.status === "draft").slice(0, 5);
      
      // Projects with low bucket hours (under 20% remaining)
      const projects = await storage.getAllProjects();
      const projectsAtRisk = projects.filter((p: any) => {
        if (!p.totalHours || p.totalHours <= 0) return false;
        const usedHours = p.usedHours || 0;
        const remaining = p.totalHours - usedHours;
        const percentRemaining = (remaining / p.totalHours) * 100;
        return percentRemaining < 20 && percentRemaining >= 0 && p.status === "active";
      }).slice(0, 5);
      
      res.json({
        overduePayments: overduePayments.slice(0, 5).map((p: any) => ({
          id: p.id,
          projectName: p.project?.name || "Unknown",
          clientName: p.project?.clientName || "Unknown",
          expectedAmount: p.expectedAmount,
          expectedDate: p.expectedDate,
          daysOverdue: Math.floor((today.getTime() - new Date(p.expectedDate!).getTime()) / (1000 * 60 * 60 * 24)),
        })),
        overdueInvoices: overdueInvoices.map((inv: any) => ({
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          clientName: inv.clientName,
          totalAmount: String(parseFloat(inv.totalAmount) || 0),
          dueDate: inv.dueDate,
          daysOverdue: Math.floor((today.getTime() - new Date(inv.dueDate!).getTime()) / (1000 * 60 * 60 * 24)),
        })),
        pendingInvoices: pendingInvoices.map((inv: any) => ({
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          clientName: inv.clientName,
          totalAmount: String(parseFloat(inv.totalAmount) || 0),
          createdAt: inv.createdAt,
        })),
        projectsAtRisk: projectsAtRisk.map((p: any) => ({
          id: p.id,
          name: p.name,
          clientName: p.clientName,
          totalHours: p.totalHours,
          usedHours: p.usedHours || 0,
          percentRemaining: Math.round(((p.totalHours! - (p.usedHours || 0)) / p.totalHours!) * 100),
        })),
        counts: {
          overduePayments: Math.min(overduePayments.length, 5),
          overdueInvoices: overdueInvoices.length,
          pendingInvoices: pendingInvoices.length,
          projectsAtRisk: projectsAtRisk.length,
        }
      });
    } catch (error) {
      console.error("Error fetching attention required:", error);
      res.status(500).json({ message: "Failed to fetch attention required items" });
    }
  });

  // Dashboard - Upcoming payments (next 7 days)
  app.get("/api/dashboard/upcoming-payments", isAuthenticated, async (req, res) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Get payments due soon (within 7 days)
      const upcomingPayments = await storage.getPaymentsDueSoon(7);
      
      res.json({
        upcomingPayments: upcomingPayments.slice(0, 10).map((p: any) => ({
          id: p.id,
          projectName: p.project?.name || "Unknown",
          clientName: p.project?.clientName || "Unknown",
          region: p.project?.region,
          expectedAmount: p.expectedAmount,
          expectedDate: p.expectedDate,
          paymentType: p.paymentType,
          daysUntilDue: Math.max(0, Math.ceil((new Date((p.dueDate || p.expectedDate)!).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))),
        })),
        totalExpected: upcomingPayments.reduce((sum: number, p: any) => sum + parseFloat(p.expectedAmount?.toString() || "0"), 0),
      });
    } catch (error) {
      console.error("Error fetching upcoming payments:", error);
      res.status(500).json({ message: "Failed to fetch upcoming payments" });
    }
  });

  // Dashboard - Invoice summary by status
  app.get("/api/dashboard/invoice-summary", isAuthenticated, async (req, res) => {
    try {
      const allInvoices = await storage.getAllInvoices();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const summary = {
        draft: { count: 0, amount: 0 },
        sent: { count: 0, amount: 0 },
        paid: { count: 0, amount: 0 },
        overdue: { count: 0, amount: 0 },
        cancelled: { count: 0, amount: 0 },
      };
      
      for (const inv of allInvoices) {
        const amount = parseFloat(inv.totalAmount?.toString() || "0");
        
        if (inv.status === "cancelled") {
          summary.cancelled.count++;
          summary.cancelled.amount += amount;
        } else if (inv.status === "paid") {
          summary.paid.count++;
          summary.paid.amount += amount;
        } else if (inv.status === "sent") {
          // Check if overdue
          if (inv.dueDate && new Date(inv.dueDate) < today) {
            summary.overdue.count++;
            summary.overdue.amount += amount;
          } else {
            summary.sent.count++;
            summary.sent.amount += amount;
          }
        } else if (inv.status === "draft") {
          summary.draft.count++;
          summary.draft.amount += amount;
        }
      }
      
      res.json(summary);
    } catch (error) {
      console.error("Error fetching invoice summary:", error);
      res.status(500).json({ message: "Failed to fetch invoice summary" });
    }
  });

  // Dashboard - Recent activity
  app.get("/api/dashboard/recent-activity", isAuthenticated, async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const activities = await storage.getActivityLogs(limit);
      
      res.json({
        activities: activities.map((a: any) => ({
          id: a.id,
          type: a.action,
          description: a.details || `${a.action} ${a.entity}`,
          userName: a.user ? `${a.user.firstName || ""} ${a.user.lastName || ""}`.trim() || a.user.email : "System",
          createdAt: a.createdAt,
        })),
      });
    } catch (error) {
      console.error("Error fetching recent activity:", error);
      res.status(500).json({ message: "Failed to fetch recent activity" });
    }
  });

  // =================== FORECASTING MODULE ===================

  // Get all forecast entries with optional filters
  app.get("/api/forecasting/entries", isAuthenticated, requirePermission("view_forecasting", "view_payments"), async (req: any, res) => {
    try {
      const projectId = req.query.projectId as string | undefined;
      const month = req.query.month ? parseInt(req.query.month as string) : undefined;
      const year = req.query.year ? parseInt(req.query.year as string) : undefined;
      const entries = await storage.getForecastEntries(projectId, month, year);
      res.json(entries);
    } catch (error) {
      console.error("Error fetching forecast entries:", error);
      res.status(500).json({ message: "Failed to fetch forecast entries" });
    }
  });

  // Get forecast overview data - projects with their financials and forecast entries for a date range
  app.get("/api/forecasting/overview", isAuthenticated, requirePermission("view_forecasting", "view_payments"), async (req: any, res) => {
    try {
      const startMonth = req.query.startMonth ? parseInt(req.query.startMonth as string) : new Date().getMonth() + 1;
      const startYear = req.query.startYear ? parseInt(req.query.startYear as string) : new Date().getFullYear();
      const monthsToShow = req.query.months ? parseInt(req.query.months as string) : 12;
      
      // Get all projects with their PM
      const allProjects = await storage.getAllProjects();
      const activeProjects = allProjects;
      
      // Get all forecast entries  
      const allEntries = await storage.getForecastEntries();
      
      // Get all payments to calculate paid amounts
      const allPayments = await storage.getAllPayments({});
      
      // Get all milestones for automatic forecasting
      const allMilestones = await storage.getAllProjectMilestones();
      
      // Build months array
      const months: { month: number; year: number; label: string }[] = [];
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      let m = startMonth;
      let y = startYear;
      for (let i = 0; i < monthsToShow; i++) {
        months.push({ month: m, year: y, label: `${monthNames[m - 1]} ${y}` });
        m++;
        if (m > 12) { m = 1; y++; }
      }
      
      // Build project data
      const projectData = activeProjects.map(project => {
        const projectPayments = allPayments.filter(p => p.projectId === project.id);
        const totalPaid = projectPayments
          .filter(p => p.status === "received")
          .reduce((sum, p) => sum + parseFloat(p.receivedAmount || "0"), 0);
        const recurringPaid = projectPayments
          .filter(p => p.status === "received" && p.paymentType === "recurring")
          .reduce((sum, p) => sum + parseFloat(p.receivedAmount || "0"), 0);
        const upsellPaid = projectPayments
          .filter(p => p.status === "received" && p.paymentType === "upsell")
          .reduce((sum, p) => sum + parseFloat(p.receivedAmount || "0"), 0);
        const totalCost = parseFloat(project.totalCost || "0");
        const totalPending = Math.max(0, totalCost - totalPaid);
        
        // Get forecast entries for this project (manual entries)
        const projectEntries = allEntries.filter(e => e.projectId === project.id);
        
        // Get milestones for this project (automatic entries)
        const projectMilestonesList = allMilestones.filter(ms => ms.projectId === project.id);
        
        // Map entries to months
        const monthlyForecasts: Record<string, { amount: number; paymentType: string; phase: string | null; entryId: string; source: string; milestoneName: string | null; milestoneStatus: string | null; month: number; year: number; notes: string | null; probability: number | null }[]> = {};
        
        // Add manual forecast entries
        for (const entry of projectEntries) {
          const key = `${entry.month}-${entry.year}`;
          if (!monthlyForecasts[key]) monthlyForecasts[key] = [];
          monthlyForecasts[key].push({
            amount: parseFloat(entry.amount || "0"),
            paymentType: entry.paymentType,
            phase: entry.phase,
            entryId: entry.id,
            source: "manual",
            milestoneName: null,
            milestoneStatus: null,
            month: entry.month,
            year: entry.year,
            notes: entry.notes,
            probability: entry.probability,
          });
        }
        
        // Add milestone-based entries (automatic)
        for (const ms of projectMilestonesList) {
          if (ms.status === "cancelled") continue;
          let msMonth = ms.billingMonth;
          let msYear = ms.billingYear;
          if (!msMonth || !msYear) {
            if (ms.dueDate) {
              const dueDate = new Date(ms.dueDate);
              msMonth = dueDate.getMonth() + 1;
              msYear = dueDate.getFullYear();
            } else {
              continue;
            }
          }
          const key = `${msMonth}-${msYear}`;
          if (!monthlyForecasts[key]) monthlyForecasts[key] = [];
          monthlyForecasts[key].push({
            amount: parseFloat(ms.expectedAmount || "0"),
            paymentType: "recurring",
            phase: ms.name || `Installment ${ms.sequenceNumber}`,
            entryId: `milestone-${ms.id}`,
            source: "milestone",
            milestoneName: ms.name,
            milestoneStatus: ms.status,
            month: msMonth,
            year: msYear,
            notes: null,
            probability: ms.probability,
          });
        }
        
        return {
          id: project.id,
          name: project.name,
          clientName: project.clientName,
          region: project.region,
          billingType: project.billingType || "ftfc",
          status: project.status,
          isNewProject: project.isNewProject !== false,
          isFullyPaid: project.isFullyPaid === true,
          totalCost,
          totalPaid,
          recurringPaid,
          upsellPaid,
          totalPending,
          pmId: project.pmId,
          pmName: project.pm ? `${project.pm.firstName || ""} ${project.pm.lastName || ""}`.trim() : null,
          mrrMonthlyAmount: project.mrrMonthlyAmount ? parseFloat(project.mrrMonthlyAmount) : null,
          mrrDurationMonths: project.mrrDurationMonths,
          numberOfPhases: project.numberOfPhases,
          monthlyForecasts,
        };
      });
      
      // Calculate monthly totals
      const monthlyTotals: Record<string, number> = {};
      for (const month of months) {
        const key = `${month.month}-${month.year}`;
        monthlyTotals[key] = projectData.reduce((sum, p) => {
          const entries = p.monthlyForecasts[key] || [];
          return sum + entries.reduce((s, e) => s + e.amount, 0);
        }, 0);
      }
      
      res.json({
        months,
        projects: projectData,
        monthlyTotals,
      });
    } catch (error) {
      console.error("Error fetching forecast overview:", error);
      res.status(500).json({ message: "Failed to fetch forecast overview" });
    }
  });

  // Create a forecast entry
  app.post("/api/forecasting/entries", isAuthenticated, requirePermission("edit_forecasting"), async (req: any, res) => {
    try {
      const data = { ...req.body, createdBy: req.user?.claims?.sub };
      const entry = await storage.createForecastEntry(data);
      res.status(201).json(entry);
    } catch (error: any) {
      console.error("Error creating forecast entry:", error);
      res.status(400).json({ message: error.message || "Failed to create forecast entry" });
    }
  });

  // Bulk create forecast entries (for MRR auto-population)
  app.post("/api/forecasting/entries/bulk", isAuthenticated, requirePermission("edit_forecasting"), async (req: any, res) => {
    try {
      const { entries } = req.body;
      if (!Array.isArray(entries)) return res.status(400).json({ message: "entries must be an array" });
      
      const created = [];
      for (const entry of entries) {
        const data = { ...entry, createdBy: req.user?.claims?.sub };
        const result = await storage.createForecastEntry(data);
        created.push(result);
      }
      res.status(201).json(created);
    } catch (error: any) {
      console.error("Error bulk creating forecast entries:", error);
      res.status(400).json({ message: error.message || "Failed to bulk create forecast entries" });
    }
  });

  // Update a forecast entry
  app.patch("/api/forecasting/entries/:id", isAuthenticated, requirePermission("edit_forecasting"), async (req: any, res) => {
    try {
      const updated = await storage.updateForecastEntry(req.params.id, req.body);
      if (!updated) return res.status(404).json({ message: "Forecast entry not found" });
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating forecast entry:", error);
      res.status(400).json({ message: error.message || "Failed to update forecast entry" });
    }
  });

  // Delete a forecast entry
  app.delete("/api/forecasting/entries/:id", isAuthenticated, requirePermission("edit_forecasting"), async (req: any, res) => {
    try {
      const success = await storage.deleteForecastEntry(req.params.id);
      if (!success) return res.status(404).json({ message: "Forecast entry not found" });
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting forecast entry:", error);
      res.status(400).json({ message: error.message || "Failed to delete forecast entry" });
    }
  });

  // Delete all forecast entries for a project (optionally filtered by month/year)
  app.delete("/api/forecasting/entries/project/:projectId", isAuthenticated, requirePermission("edit_forecasting"), async (req: any, res) => {
    try {
      const month = req.query.month ? parseInt(req.query.month as string) : undefined;
      const year = req.query.year ? parseInt(req.query.year as string) : undefined;
      const count = await storage.deleteForecastEntriesByProject(req.params.projectId, month, year);
      res.json({ success: true, deleted: count });
    } catch (error: any) {
      console.error("Error deleting forecast entries:", error);
      res.status(400).json({ message: error.message || "Failed to delete forecast entries" });
    }
  });

  // Auto-generate MRR forecast entries for a project
  app.post("/api/forecasting/auto-populate/:projectId", isAuthenticated, requirePermission("edit_forecasting"), async (req: any, res) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      const userId = req.user?.claims?.sub;
      const created: any[] = [];

      if (project.billingType === "mrr") {
        const monthlyAmount = parseFloat(project.mrrMonthlyAmount || "0");
        const durationMonths = project.mrrDurationMonths || 12;
        if (monthlyAmount <= 0) return res.status(400).json({ message: "MRR monthly amount is not configured" });

        const milestones = await storage.getProjectMilestones(project.id);
        const unpaidMilestones = milestones?.filter(ms => ms.status !== "paid" && ms.status !== "cancelled") || [];

        await storage.deleteForecastEntriesByProject(project.id);

        if (unpaidMilestones.length > 0) {
          for (const milestone of unpaidMilestones) {
            const amount = parseFloat(milestone.expectedAmount || "0") || monthlyAmount;
            let month: number;
            let year: number;

            if (milestone.billingMonth && milestone.billingYear) {
              month = milestone.billingMonth;
              year = milestone.billingYear;
            } else if (milestone.dueDate) {
              const dueDate = new Date(milestone.dueDate);
              month = dueDate.getMonth() + 1;
              year = dueDate.getFullYear();
            } else {
              const now = new Date();
              month = now.getMonth() + 1;
              year = now.getFullYear();
            }

            const entry = await storage.createForecastEntry({
              projectId: project.id,
              month,
              year,
              amount: amount.toString(),
              paymentType: "recurring",
              probability: milestone.probability || 100,
              phase: milestone.name || `Installment ${milestone.sequenceNumber}`,
              createdBy: userId,
            });
            created.push(entry);
          }
        } else {
          const projectPayments = await storage.getPaymentsByProjectId(project.id);
          const paidRecurring = projectPayments.filter(p => p.status === "received" && p.paymentType === "recurring");
          const paidCount = paidRecurring.length;
          const remainingInstallments = Math.max(0, durationMonths - paidCount);

          if (remainingInstallments <= 0) return res.status(400).json({ message: "All installments have been paid" });

          const startMonth = req.body.startMonth || new Date().getMonth() + 1;
          const startYear = req.body.startYear || new Date().getFullYear();

          let m = startMonth;
          let y = startYear;
          for (let i = 0; i < remainingInstallments; i++) {
            const entry = await storage.createForecastEntry({
              projectId: project.id,
              month: m,
              year: y,
              amount: monthlyAmount.toString(),
              paymentType: "recurring",
              phase: `Installment ${paidCount + i + 1}`,
              createdBy: userId,
            });
            created.push(entry);
            m++;
            if (m > 12) { m = 1; y++; }
          }
        }
      } else if (project.billingType === "ftfc" || project.billingType === "tbe") {
        const milestones = await storage.getProjectMilestones(project.id);
        if (!milestones || milestones.length === 0) {
          return res.status(400).json({ message: "No milestones found for this project. Please define milestones with due dates in the Projects module first." });
        }

        const unpaidMilestones = milestones.filter(m => m.status !== "paid" && m.status !== "cancelled");
        if (unpaidMilestones.length === 0) {
          return res.status(400).json({ message: "All milestones have been paid or cancelled" });
        }

        await storage.deleteForecastEntriesByProject(project.id);

        for (const milestone of unpaidMilestones) {
          const amount = parseFloat(milestone.expectedAmount || "0");
          if (amount <= 0) continue;

          let month: number;
          let year: number;

          if (milestone.dueDate) {
            const dueDate = new Date(milestone.dueDate);
            month = dueDate.getMonth() + 1;
            year = dueDate.getFullYear();
          } else if (milestone.billingMonth && milestone.billingYear) {
            month = milestone.billingMonth;
            year = milestone.billingYear;
          } else {
            const now = new Date();
            month = now.getMonth() + 1;
            year = now.getFullYear();
          }

          const entry = await storage.createForecastEntry({
            projectId: project.id,
            month,
            year,
            amount: amount.toString(),
            paymentType: "recurring",
            probability: milestone.probability || 100,
            phase: milestone.name,
            createdBy: userId,
          });
          created.push(entry);
        }
      } else {
        return res.status(400).json({ message: `Auto-populate is not supported for billing type: ${project.billingType}` });
      }

      res.status(201).json({ message: `Created ${created.length} forecast entries`, entries: created });
    } catch (error: any) {
      console.error("Error auto-populating forecast:", error);
      res.status(400).json({ message: error.message || "Failed to auto-populate forecast" });
    }
  });

  // Activity Log routes
  app.get("/api/activity-logs", isAuthenticated, requirePermission("view_settings"), async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
      const logs = await storage.getActivityLogs(limit, offset);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching activity logs:", error);
      res.status(500).json({ message: "Failed to fetch activity logs" });
    }
  });

  // Settings routes (requires manage_settings permission)
  app.get("/api/settings", isAuthenticated, requirePermission("edit_settings"), async (req, res) => {
    try {
      let settings = await storage.getAppSettings();
      if (!settings) {
        settings = await storage.initializeAppSettings();
      }
      res.json(settings);
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.patch("/api/settings", isAuthenticated, requirePermission("edit_settings"), async (req: any, res) => {
    try {
      const parsed = updateAppSettingsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid settings data", errors: parsed.error.errors });
      }
      const userId = req.user?.claims?.sub;
      const settings = await storage.updateAppSettings(parsed.data, userId);
      await logActivityInternal(userId, "update", "settings", settings.id, "Updated application settings", req);
      res.json(settings);
    } catch (error) {
      console.error("Error updating settings:", error);
      res.status(500).json({ message: "Failed to update settings" });
    }
  });

  // Navigation module visibility - readable by ALL authenticated users so the sidebar
  // can hide admin-disabled modules globally (regardless of the user's RBAC permissions).
  app.get("/api/navigation/hidden-modules", isAuthenticated, async (req, res) => {
    try {
      let settings = await storage.getAppSettings();
      if (!settings) {
        settings = await storage.initializeAppSettings();
      }
      res.json(settings.hiddenModules ?? []);
    } catch (error) {
      console.error("Error fetching hidden modules:", error);
      res.status(500).json({ message: "Failed to fetch hidden modules" });
    }
  });

  // User Theme Settings - Get user's effective theme (personal theme or fallback to global)
  app.get("/api/theme", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      // Get user's personal theme
      const user = await storage.getUser(userId);
      if (user?.themeSettings) {
        return res.json({ theme: user.themeSettings, source: "user" });
      }
      
      // Fallback to global theme
      const appSettings = await storage.getAppSettings();
      if (appSettings?.globalThemeSettings) {
        return res.json({ theme: appSettings.globalThemeSettings, source: "global" });
      }
      
      // No theme set, return default
      return res.json({ theme: null, source: "default" });
    } catch (error) {
      console.error("Error fetching theme:", error);
      res.status(500).json({ message: "Failed to fetch theme" });
    }
  });

  // Update current user's personal theme
  app.put("/api/theme", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      const themeSettings = req.body;
      await storage.updateUserTheme(userId, themeSettings);
      res.json({ message: "Theme updated successfully", theme: themeSettings });
    } catch (error) {
      console.error("Error updating theme:", error);
      res.status(500).json({ message: "Failed to update theme" });
    }
  });

  // Reset user's personal theme (revert to global theme)
  app.delete("/api/theme", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      await storage.updateUserTheme(userId, null);
      res.json({ message: "Theme reset to global default" });
    } catch (error) {
      console.error("Error resetting theme:", error);
      res.status(500).json({ message: "Failed to reset theme" });
    }
  });

  // Admin: Get global theme settings
  app.get("/api/settings/global-theme", isAuthenticated, requirePermission("edit_settings"), async (req, res) => {
    try {
      const appSettings = await storage.getAppSettings();
      res.json({ theme: appSettings?.globalThemeSettings || null });
    } catch (error) {
      console.error("Error fetching global theme:", error);
      res.status(500).json({ message: "Failed to fetch global theme" });
    }
  });

  // Admin: Update global theme settings
  app.put("/api/settings/global-theme", isAuthenticated, requirePermission("edit_settings"), async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const themeSettings = req.body;
      await storage.updateGlobalTheme(themeSettings, userId);
      await logActivityInternal(userId, "update", "settings", "global-theme", "Updated global theme settings", req);
      res.json({ message: "Global theme updated successfully", theme: themeSettings });
    } catch (error) {
      console.error("Error updating global theme:", error);
      res.status(500).json({ message: "Failed to update global theme" });
    }
  });

  // Admin: Reset/clear global theme settings
  app.delete("/api/settings/global-theme", isAuthenticated, requirePermission("edit_settings"), async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      await storage.clearGlobalTheme(userId);
      await logActivityInternal(userId, "update", "settings", "global-theme", "Reset global theme to default", req);
      res.json({ message: "Global theme reset successfully" });
    } catch (error) {
      console.error("Error resetting global theme:", error);
      res.status(500).json({ message: "Failed to reset global theme" });
    }
  });

  // Document Repository / Signoffs API
  app.get("/api/signoffs", isAuthenticated, requirePermission("view_signoffs"), async (req: any, res) => {
    try {
      const { projectId, status, milestoneId } = req.query;
      const signoffs = await storage.getAllSignoffs({
        projectId: projectId as string,
        status: status as string,
        milestoneId: milestoneId as string,
      });

      const enriched = await Promise.all(signoffs.map(async (s) => {
        const project = await storage.getProject(s.projectId);
        let milestone = undefined;
        if (s.milestoneId) {
          milestone = await storage.getMilestone(s.milestoneId);
        }
        return { ...s, project: project || undefined, milestone: milestone || undefined };
      }));
      res.json(enriched);
    } catch (error) {
      console.error("Error fetching signoffs:", error);
      res.status(500).json({ message: "Failed to fetch signoffs" });
    }
  });

  app.get("/api/signoffs/:id", isAuthenticated, requirePermission("view_signoffs"), async (req, res) => {
    try {
      const signoff = await storage.getSignoff(req.params.id);
      if (!signoff) {
        return res.status(404).json({ message: "Signoff not found" });
      }
      res.json(signoff);
    } catch (error) {
      console.error("Error fetching signoff:", error);
      res.status(500).json({ message: "Failed to fetch signoff" });
    }
  });

  app.get("/api/signoffs/project/:projectId", isAuthenticated, requirePermission("view_signoffs"), async (req, res) => {
    try {
      const signoffs = await storage.getSignoffsByProject(req.params.projectId);
      res.json(signoffs);
    } catch (error) {
      console.error("Error fetching project signoffs:", error);
      res.status(500).json({ message: "Failed to fetch project signoffs" });
    }
  });

  app.get("/api/signoffs/milestone/:milestoneId", isAuthenticated, requirePermission("view_signoffs"), async (req, res) => {
    try {
      const signoff = await storage.getSignoffByMilestone(req.params.milestoneId);
      res.json(signoff || null);
    } catch (error) {
      console.error("Error fetching milestone signoff:", error);
      res.status(500).json({ message: "Failed to fetch milestone signoff" });
    }
  });

  app.post("/api/signoffs", isAuthenticated, requirePermission("create_signoffs"), async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const data = { ...req.body, createdBy: userId };
      
      // Convert signedDate string to Date if present, empty string to null
      if (data.signedDate && typeof data.signedDate === 'string') {
        data.signedDate = new Date(data.signedDate);
      } else if (data.signedDate === '' || data.signedDate === undefined) {
        data.signedDate = null;
      }
      
      const signoff = await storage.createSignoff(data);
      
      // Log activity
      await storage.createActivityLog({
        userId,
        action: "created",
        entity: "signoff",
        entityId: signoff.id,
        details: `Created signoff for phase "${signoff.phaseName}"`,
      });

      res.status(201).json(signoff);
    } catch (error: any) {
      console.error("Error creating signoff:", error);
      res.status(500).json({ message: error.message || "Failed to create signoff" });
    }
  });

  app.put("/api/signoffs/:id", isAuthenticated, requirePermission("edit_signoffs"), async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const data = { ...req.body };
      
      // Convert signedDate string to Date if present, empty string to null
      if (data.signedDate && typeof data.signedDate === 'string') {
        data.signedDate = new Date(data.signedDate);
      } else if (data.signedDate === '' || data.signedDate === undefined) {
        data.signedDate = null;
      }

      // Ensure signedBy is explicitly set (even to null for clearing)
      if (data.signedBy !== undefined) {
        data.signedBy = data.signedBy || null;
      }
      
      const signoff = await storage.updateSignoff(req.params.id, data);
      if (!signoff) {
        return res.status(404).json({ message: "Signoff not found" });
      }

      // Log activity
      await storage.createActivityLog({
        userId,
        action: "updated",
        entity: "signoff",
        entityId: signoff.id,
        details: `Updated signoff for phase "${signoff.phaseName}"`,
      });

      res.json(signoff);
    } catch (error: any) {
      console.error("Error updating signoff:", error);
      res.status(500).json({ message: error.message || "Failed to update signoff" });
    }
  });

  app.delete("/api/signoffs/:id", isAuthenticated, requirePermission("delete_signoffs"), async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const signoff = await storage.getSignoff(req.params.id);
      if (!signoff) {
        return res.status(404).json({ message: "Signoff not found" });
      }

      await storage.deleteSignoff(req.params.id);

      // Log activity
      await storage.createActivityLog({
        userId,
        action: "deleted",
        entity: "signoff",
        entityId: req.params.id,
        details: `Deleted signoff for phase "${signoff.phaseName}"`,
      });

      res.json({ message: "Signoff deleted successfully" });
    } catch (error) {
      console.error("Error deleting signoff:", error);
      res.status(500).json({ message: "Failed to delete signoff" });
    }
  });

  // Missing signoffs detection
  app.get("/api/signoffs/missing/all", isAuthenticated, requirePermission("view_signoffs"), async (req, res) => {
    try {
      const missingSignoffs = await storage.getMissingSignoffs();
      res.json(missingSignoffs);
    } catch (error) {
      console.error("Error fetching missing signoffs:", error);
      res.status(500).json({ message: "Failed to fetch missing signoffs" });
    }
  });

  // Send reminder for missing signoff
  app.post("/api/signoffs/:id/send-reminder", isAuthenticated, requirePermission("send_signoff_reminders"), async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const signoff = await storage.getSignoff(req.params.id);
      if (!signoff) {
        return res.status(404).json({ message: "Signoff not found" });
      }

      // Get project and PM info
      const project = await storage.getProjectWithPM(signoff.projectId);
      if (!project || !project.pm) {
        return res.status(400).json({ message: "Project or PM not found" });
      }

      // Send reminder email
      const { sendMissingSignoffReminder } = await import("./emailService");
      await sendMissingSignoffReminder(
        project.pm.email,
        project.pm.firstName || project.pm.email,
        project.name,
        signoff.phaseName
      );

      // Update reminder tracking
      await storage.updateSignoffReminder(signoff.id);

      // Log activity
      await storage.createActivityLog({
        userId,
        action: "sent_reminder",
        entity: "signoff",
        entityId: signoff.id,
        details: `Sent signoff reminder for phase "${signoff.phaseName}" on project "${project.name}"`,
      });

      res.json({ message: "Reminder sent successfully" });
    } catch (error: any) {
      console.error("Error sending signoff reminder:", error);
      res.status(500).json({ message: error.message || "Failed to send reminder" });
    }
  });

  // System Health Monitoring routes (Admin only)
  app.get("/api/system-health", isAuthenticated, requirePermission("edit_settings"), async (req, res) => {
    try {
      const hours = req.query.hours ? parseInt(req.query.hours as string) : 24;
      const summary = await storage.getApiMetricsSummary(hours);
      res.json(summary);
    } catch (error) {
      console.error("Error fetching system health:", error);
      res.status(500).json({ message: "Failed to fetch system health data" });
    }
  });

  app.get("/api/system-health/metrics", isAuthenticated, requirePermission("edit_settings"), async (req, res) => {
    try {
      const filters: any = {};
      if (req.query.endpoint) filters.endpoint = req.query.endpoint as string;
      if (req.query.startTime) filters.startTime = new Date(req.query.startTime as string);
      if (req.query.endTime) filters.endTime = new Date(req.query.endTime as string);
      if (req.query.statusCode) filters.statusCode = parseInt(req.query.statusCode as string);
      if (req.query.limit) filters.limit = parseInt(req.query.limit as string);
      
      const metrics = await storage.getApiMetrics(filters);
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching API metrics:", error);
      res.status(500).json({ message: "Failed to fetch API metrics" });
    }
  });

  app.delete("/api/system-health/cleanup", isAuthenticated, requirePermission("edit_settings"), async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const daysToKeep = req.query.daysToKeep ? parseInt(req.query.daysToKeep as string) : 7;
      const deletedCount = await storage.cleanupOldApiMetrics(daysToKeep);
      await logActivityInternal(userId, "delete", "settings", "system-health", `Cleaned up ${deletedCount} old API metrics`, req);
      res.json({ message: `Cleaned up ${deletedCount} old metrics`, deletedCount });
    } catch (error) {
      console.error("Error cleaning up API metrics:", error);
      res.status(500).json({ message: "Failed to cleanup API metrics" });
    }
  });

  // Security dashboard - aggregated cyber-security stats (rate limiting, auth
  // failures, sessions, blocked users, security headers, recent events).
  app.get("/api/security/dashboard", isAuthenticated, requirePermission("edit_settings"), async (req, res) => {
    try {
      const parsedHours = parseInt(req.query.hours as string);
      const hours = Number.isFinite(parsedHours)
        ? Math.min(Math.max(parsedHours, 1), 720)
        : 24;
      const stats = await storage.getSecurityDashboard(hours);
      const isProd = process.env.NODE_ENV === "production";
      const dashboard = {
        ...stats,
        rateLimitConfig: {
          auth: {
            windowMinutes: Math.round(RATE_LIMIT_CONFIG.auth.windowMs / 60000),
            max: RATE_LIMIT_CONFIG.auth.max,
            paths: [...RATE_LIMIT_CONFIG.auth.paths],
          },
          api: {
            windowMinutes: Math.round(RATE_LIMIT_CONFIG.api.windowMs / 60000),
            max: RATE_LIMIT_CONFIG.api.max,
            paths: [...RATE_LIMIT_CONFIG.api.paths],
          },
        },
        securityHeaders: [
          { name: "HSTS (Strict-Transport-Security)", enabled: isProd, detail: isProd ? "Enabled over HTTPS (180 days)" : "Active in production (HTTPS) only" },
          { name: "X-Content-Type-Options", enabled: true, detail: "nosniff - blocks MIME-type sniffing" },
          { name: "X-Frame-Options", enabled: true, detail: "Prevents clickjacking via framing" },
          { name: "X-DNS-Prefetch-Control", enabled: true, detail: "Limits DNS prefetch leakage" },
          { name: "Referrer-Policy", enabled: true, detail: "no-referrer - limits referrer leakage" },
          { name: "Content-Security-Policy", enabled: false, detail: "Disabled for Vite/inline-asset compatibility" },
        ],
      };
      res.json(dashboard);
    } catch (error) {
      console.error("Error fetching security dashboard:", error);
      res.status(500).json({ message: "Failed to fetch security dashboard data" });
    }
  });

  // Banking Details routes - GET accessible to all authenticated users for invoice generation
  app.get("/api/settings/banking", isAuthenticated, async (req, res) => {
    try {
      const bankingDetails = await storage.getAllBankingDetails();
      res.json(bankingDetails);
    } catch (error) {
      console.error("Error fetching banking details:", error);
      res.status(500).json({ message: "Failed to fetch banking details" });
    }
  });

  app.get("/api/settings/banking/:region", isAuthenticated, async (req: any, res) => {
    try {
      const region = req.params.region as Region;
      if (!["CA", "TX", "AE"].includes(region)) {
        return res.status(400).json({ message: "Invalid region" });
      }
      const bankingDetails = await storage.getBankingDetailsByRegion(region);
      if (!bankingDetails) {
        return res.status(404).json({ message: "Banking details not found for this region" });
      }
      res.json(bankingDetails);
    } catch (error) {
      console.error("Error fetching banking details:", error);
      res.status(500).json({ message: "Failed to fetch banking details" });
    }
  });

  app.put("/api/settings/banking/:region", isAuthenticated, requirePermission("edit_settings"), async (req: any, res) => {
    try {
      const region = req.params.region as Region;
      if (!["CA", "TX", "AE"].includes(region)) {
        return res.status(400).json({ message: "Invalid region" });
      }
      const data = { ...req.body, region };
      const bankingDetails = await storage.upsertBankingDetails(data);
      const userId = req.user?.claims?.sub;
      await logActivityInternal(userId, "update", "settings", bankingDetails.id, `Updated banking details for ${region}`, req);
      res.json(bankingDetails);
    } catch (error) {
      console.error("Error updating banking details:", error);
      res.status(500).json({ message: "Failed to update banking details" });
    }
  });

  app.delete("/api/settings/banking/:region", isAuthenticated, requirePermission("edit_settings"), async (req: any, res) => {
    try {
      const region = req.params.region as Region;
      if (!["CA", "TX", "AE"].includes(region)) {
        return res.status(400).json({ message: "Invalid region" });
      }
      const deleted = await storage.deleteBankingDetails(region);
      if (!deleted) {
        return res.status(404).json({ message: "Banking details not found for this region" });
      }
      const userId = req.user?.claims?.sub;
      await logActivityInternal(userId, "delete", "settings", region, `Deleted banking details for ${region}`, req);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting banking details:", error);
      res.status(500).json({ message: "Failed to delete banking details" });
    }
  });

  // SMTP Settings routes
  app.get("/api/settings/smtp", isAuthenticated, requirePermission("edit_settings"), async (req: any, res) => {
    try {
      const settings = await storage.getSMTPSettings();
      if (!settings) {
        return res.json(null);
      }
      // Don't return password for security
      const { password, ...safeSettings } = settings;
      res.json({ ...safeSettings, hasPassword: !!password });
    } catch (error) {
      console.error("Error fetching SMTP settings:", error);
      res.status(500).json({ message: "Failed to fetch SMTP settings" });
    }
  });

  app.put("/api/settings/smtp", isAuthenticated, requirePermission("edit_settings"), async (req: any, res) => {
    try {
      const { host, port, username, password, fromEmail, fromName, encryption } = req.body;
      
      if (!host || !port || !username || !fromEmail || !fromName) {
        return res.status(400).json({ message: "Missing required SMTP configuration fields" });
      }
      
      const userId = req.user?.claims?.sub;
      const data: any = {
        host,
        port: parseInt(port, 10),
        username,
        fromEmail,
        fromName,
        encryption: encryption || "starttls",
        isActive: true,
      };
      
      // Only update password if provided
      if (password) {
        data.password = password;
      }
      
      const settings = await storage.upsertSMTPSettings(data, userId);
      
      // Clear transporter cache to use new settings
      clearTransporterCache();
      
      await logActivityInternal(userId, "update", "settings", settings.id, "Updated SMTP settings", req);
      
      // Don't return password
      const { password: _, ...safeSettings } = settings;
      res.json({ ...safeSettings, hasPassword: true });
    } catch (error) {
      console.error("Error updating SMTP settings:", error);
      res.status(500).json({ message: "Failed to update SMTP settings" });
    }
  });

  // AI Provider Settings routes — manage provider API keys in-app.
  app.get("/api/settings/ai-providers", isAuthenticated, requirePermission("edit_settings"), async (_req, res) => {
    try {
      const settings = await storage.getAiProviderSettings();
      // Never return the API key itself; expose whether one is stored.
      const safe = settings.map(({ apiKey, ...rest }) => ({ ...rest, hasApiKey: !!apiKey }));
      res.json(safe);
    } catch (error) {
      console.error("Error fetching AI provider settings:", error);
      res.status(500).json({ message: "Failed to fetch AI provider settings" });
    }
  });

  app.put("/api/settings/ai-providers/:provider", isAuthenticated, requirePermission("edit_settings"), async (req: any, res) => {
    try {
      const parsedProvider = z.enum(upsellAiProviders).safeParse(req.params.provider);
      if (!parsedProvider.success) {
        return res.status(400).json({ message: "A valid provider (anthropic or openai) is required" });
      }
      const provider = parsedProvider.data;

      const bodySchema = z.object({
        apiKey: z.string().optional(),
        model: z.string().optional().nullable(),
        isActive: z.boolean().optional(),
      });
      const parsedBody = bodySchema.safeParse(req.body);
      if (!parsedBody.success) {
        return res.status(400).json({ message: "Invalid AI provider settings" });
      }
      const { apiKey, model, isActive } = parsedBody.data;

      const existing = await storage.getAiProviderSetting(provider);
      // An API key is required when creating a brand-new provider entry.
      if (!existing && !apiKey) {
        return res.status(400).json({ message: "An API key is required to save this provider" });
      }

      const userId = req.user?.claims?.sub;
      const data: any = {
        provider,
        model: model ?? null,
        isActive: isActive ?? true,
      };
      if (apiKey) {
        data.apiKey = apiKey;
      }

      const saved = await storage.upsertAiProviderSetting(data, userId);
      await logActivityInternal(userId, "update", "settings", saved.id, `Updated ${provider} AI provider settings`, req);

      const { apiKey: _omit, ...safe } = saved;
      res.json({ ...safe, hasApiKey: !!saved.apiKey });
    } catch (error) {
      console.error("Error updating AI provider settings:", error);
      res.status(500).json({ message: "Failed to update AI provider settings" });
    }
  });

  app.post("/api/settings/smtp/test-connection", isAuthenticated, requirePermission("edit_settings"), async (req: any, res) => {
    try {
      const { host, port, username, password, encryption } = req.body;
      
      if (!host || !port || !username) {
        return res.status(400).json({ message: "Missing required SMTP connection fields" });
      }
      
      // If no password provided, try to get from stored settings
      let testPassword = password;
      if (!testPassword) {
        const storedSettings = await storage.getSMTPSettings();
        testPassword = storedSettings?.password;
      }
      
      if (!testPassword) {
        return res.status(400).json({ message: "Password is required for connection test" });
      }
      
      const result = await testSMTPConnection({
        host,
        port: parseInt(port, 10),
        username,
        password: testPassword,
        encryption: encryption || "starttls",
      });
      
      if (result.success) {
        res.json({ success: true, message: "SMTP connection successful" });
      } else {
        res.status(400).json({ success: false, message: result.error || "Connection failed" });
      }
    } catch (error: any) {
      console.error("Error testing SMTP connection:", error);
      res.status(500).json({ success: false, message: error.message || "Failed to test connection" });
    }
  });

  app.post("/api/settings/smtp/send-test", isAuthenticated, requirePermission("edit_settings"), async (req: any, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email address is required" });
      }
      
      const result = await sendTestEmail(email);
      
      if (result.success) {
        const userId = req.user?.claims?.sub;
        await logActivityInternal(userId, "create", "notification", undefined, `Sent test email to ${email}`, req);
        res.json({ success: true, message: "Test email sent successfully" });
      } else {
        res.status(400).json({ success: false, message: result.error || "Failed to send test email" });
      }
    } catch (error: any) {
      console.error("Error sending test email:", error);
      res.status(500).json({ success: false, message: error.message || "Failed to send test email" });
    }
  });

  // Upsell Types Settings routes
  app.get("/api/settings/upsell-types", isAuthenticated, async (req, res) => {
    try {
      await storage.initializeDefaultUpsellTypes();
      const upsellTypes = await storage.getAllUpsellTypes();
      res.json(upsellTypes);
    } catch (error) {
      console.error("Error fetching upsell types:", error);
      res.status(500).json({ message: "Failed to fetch upsell types" });
    }
  });

  app.get("/api/settings/upsell-types/active", isAuthenticated, async (req, res) => {
    try {
      await storage.initializeDefaultUpsellTypes();
      const upsellTypes = await storage.getActiveUpsellTypes();
      res.json(upsellTypes);
    } catch (error) {
      console.error("Error fetching active upsell types:", error);
      res.status(500).json({ message: "Failed to fetch active upsell types" });
    }
  });

  app.post("/api/settings/upsell-types", isAuthenticated, requirePermission("edit_settings"), async (req: any, res) => {
    try {
      const upsellType = await storage.createUpsellType(req.body);
      const userId = req.user?.claims?.sub;
      await logActivityInternal(userId, "create", "settings", upsellType.id, `Created upsell type: ${upsellType.displayName}`, req);
      res.status(201).json(upsellType);
    } catch (error) {
      console.error("Error creating upsell type:", error);
      res.status(500).json({ message: "Failed to create upsell type" });
    }
  });

  app.patch("/api/settings/upsell-types/:id", isAuthenticated, requirePermission("edit_settings"), async (req: any, res) => {
    try {
      const upsellType = await storage.updateUpsellType(req.params.id, req.body);
      if (!upsellType) {
        return res.status(404).json({ message: "Upsell type not found" });
      }
      const userId = req.user?.claims?.sub;
      await logActivityInternal(userId, "update", "settings", upsellType.id, `Updated upsell type: ${upsellType.displayName}`, req);
      res.json(upsellType);
    } catch (error) {
      console.error("Error updating upsell type:", error);
      res.status(500).json({ message: "Failed to update upsell type" });
    }
  });

  app.delete("/api/settings/upsell-types/:id", isAuthenticated, requirePermission("edit_settings"), async (req: any, res) => {
    try {
      const upsellType = await storage.getUpsellType(req.params.id);
      if (!upsellType) {
        return res.status(404).json({ message: "Upsell type not found" });
      }
      const deleted = await storage.deleteUpsellType(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Upsell type not found" });
      }
      const userId = req.user?.claims?.sub;
      await logActivityInternal(userId, "delete", "settings", req.params.id, `Deleted upsell type: ${upsellType.displayName}`, req);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting upsell type:", error);
      res.status(500).json({ message: "Failed to delete upsell type" });
    }
  });

  // Roles and Permissions routes
  app.get("/api/access/roles", isAuthenticated, async (req, res) => {
    try {
      // Initialize default roles if none exist
      await storage.initializeDefaultRoles();
      const rolesData = await storage.getAllRoles();
      // Transform permissions to string array for frontend consumption
      const rolesWithPermissionStrings = rolesData.map(role => ({
        ...role,
        permissions: role.permissions.map(p => p.permission),
      }));
      res.json(rolesWithPermissionStrings);
    } catch (error) {
      console.error("Error fetching roles:", error);
      res.status(500).json({ message: "Failed to fetch roles" });
    }
  });

  app.get("/api/access/roles/:id", isAuthenticated, async (req, res) => {
    try {
      const role = await storage.getRole(req.params.id);
      if (!role) {
        return res.status(404).json({ message: "Role not found" });
      }
      res.json(role);
    } catch (error) {
      console.error("Error fetching role:", error);
      res.status(500).json({ message: "Failed to fetch role" });
    }
  });

  app.post("/api/access/roles", isAuthenticated, requirePermission("manage_roles"), async (req: any, res) => {
    try {
      const parsed = insertRoleSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid role data", errors: parsed.error.errors });
      }
      const role = await storage.createRole(parsed.data);
      
      // Set permissions if provided
      if (req.body.permissions && Array.isArray(req.body.permissions)) {
        const validPermissions = req.body.permissions.filter((p: string) => 
          systemPermissions.includes(p as SystemPermission)
        ) as SystemPermission[];
        await storage.setRolePermissions(role.id, validPermissions);
      }
      
      const roleWithPermissions = await storage.getRole(role.id);
      const userId = req.user?.claims?.sub;
      await logActivityInternal(userId, "create", "settings", role.id, `Created role: ${role.displayName}`, req);
      res.status(201).json(roleWithPermissions);
    } catch (error) {
      console.error("Error creating role:", error);
      res.status(500).json({ message: "Failed to create role" });
    }
  });

  app.patch("/api/access/roles/:id", isAuthenticated, requirePermission("manage_roles"), async (req: any, res) => {
    try {
      const { permissions, ...roleData } = req.body;
      
      // Update role basic info
      if (Object.keys(roleData).length > 0) {
        const parsed = updateRoleSchema.safeParse(roleData);
        if (!parsed.success) {
          return res.status(400).json({ message: "Invalid role data", errors: parsed.error.errors });
        }
        await storage.updateRole(req.params.id, parsed.data);
      }
      
      // Update permissions if provided
      if (permissions && Array.isArray(permissions)) {
        const validPermissions = permissions.filter((p: string) => 
          systemPermissions.includes(p as SystemPermission)
        ) as SystemPermission[];
        await storage.setRolePermissions(req.params.id, validPermissions);
      }
      
      const role = await storage.getRole(req.params.id);
      if (!role) {
        return res.status(404).json({ message: "Role not found" });
      }
      
      const userId = req.user?.claims?.sub;
      await logActivityInternal(userId, "update", "settings", role.id, `Updated role: ${role.displayName}`, req);
      res.json(role);
    } catch (error) {
      console.error("Error updating role:", error);
      res.status(500).json({ message: "Failed to update role" });
    }
  });

  app.delete("/api/access/roles/:id", isAuthenticated, requirePermission("manage_roles"), async (req: any, res) => {
    try {
      const role = await storage.getRole(req.params.id);
      if (!role) {
        return res.status(404).json({ message: "Role not found" });
      }
      if (role.isSystem) {
        return res.status(400).json({ message: "Cannot delete system roles" });
      }
      
      const deleted = await storage.deleteRole(req.params.id);
      if (!deleted) {
        return res.status(500).json({ message: "Failed to delete role" });
      }
      
      const userId = req.user?.claims?.sub;
      await logActivityInternal(userId, "delete", "settings", req.params.id, `Deleted role: ${role.displayName}`, req);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting role:", error);
      res.status(500).json({ message: "Failed to delete role" });
    }
  });

  app.get("/api/access/permissions", isAuthenticated, async (req, res) => {
    try {
      // Return the list of all available permissions
      res.json(systemPermissions);
    } catch (error) {
      console.error("Error fetching permissions:", error);
      res.status(500).json({ message: "Failed to fetch permissions" });
    }
  });

  app.get("/api/access/my-permissions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const permissions = await storage.getUserPermissions(userId);
      res.json(permissions);
    } catch (error) {
      console.error("Error fetching user permissions:", error);
      res.status(500).json({ message: "Failed to fetch user permissions" });
    }
  });

  app.patch("/api/users/:id/role", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { roleId } = req.body;
      if (!roleId) {
        return res.status(400).json({ message: "Role ID is required" });
      }
      
      const role = await storage.getRole(roleId);
      if (!role) {
        return res.status(404).json({ message: "Role not found" });
      }
      
      const user = await storage.assignRoleToUser(req.params.id, roleId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const adminId = req.user?.claims?.sub;
      await logActivityInternal(adminId, "update", "user", user.id, `Assigned role ${role.displayName} to user`, req);
      res.json(user);
    } catch (error) {
      console.error("Error assigning role:", error);
      res.status(500).json({ message: "Failed to assign role" });
    }
  });

  // Notification routes
  async function buildPaymentAlerts(userId: string, dismissedIds?: Set<string>): Promise<NotificationWithDetails[]> {
    const settings = await storage.getAppSettings();
    const dueDays = settings?.dueDateWarningDays || 7;
    const userPermissions = await storage.getUserPermissions(userId);
    const hasViewNotifications = userPermissions.includes("view_notifications");

    const [dueSoon, overdue] = await Promise.all([
      storage.getPaymentsDueSoon(dueDays),
      storage.getOverduePayments(),
    ]);

    const userProjects = hasViewNotifications
      ? null
      : new Set((await storage.getAllProjects()).filter(p => p.pmId === userId).map(p => p.id));

    const alerts: NotificationWithDetails[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const p of overdue) {
      if (!hasViewNotifications && userProjects && !userProjects.has(p.projectId)) continue;
      const alertId = `alert-overdue-${p.id}`;
      if (dismissedIds && dismissedIds.has(alertId)) continue;
      const daysOverdue = Math.floor((today.getTime() - new Date(p.dueDate!).getTime()) / (1000 * 60 * 60 * 24));
      alerts.push({
        id: alertId,
        userId,
        type: "payment_overdue",
        title: "Payment Overdue",
        message: `Payment for ${p.project?.name || "Unknown"} ($${parseFloat(p.expectedAmount).toLocaleString()}) is ${daysOverdue} day(s) overdue.`,
        paymentId: p.id,
        isRead: false,
        createdAt: p.dueDate ? new Date(p.dueDate) : new Date(),
        createdBy: null,
        payment: { ...p, project: p.project || undefined },
      });
    }

    for (const p of dueSoon) {
      if (!hasViewNotifications && userProjects && !userProjects.has(p.projectId)) continue;
      const alertId = `alert-due-${p.id}`;
      if (dismissedIds && dismissedIds.has(alertId)) continue;
      const daysUntilDue = Math.floor((new Date(p.dueDate!).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      alerts.push({
        id: alertId,
        userId,
        type: "payment_due_soon",
        title: "Payment Due Soon",
        message: `Payment for ${p.project?.name || "Unknown"} ($${parseFloat(p.expectedAmount).toLocaleString()}) is due in ${daysUntilDue} day(s).`,
        paymentId: p.id,
        isRead: false,
        createdAt: p.dueDate ? new Date(p.dueDate) : new Date(),
        createdBy: null,
        payment: { ...p, project: p.project || undefined },
      });
    }

    return alerts;
  }

  app.get("/api/notifications", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const [storedNotifications, dismissedIds] = await Promise.all([
        storage.getNotifications(userId, limit),
        storage.getDismissedAlertIds(userId),
      ]);
      const paymentAlerts = await buildPaymentAlerts(userId, dismissedIds);

      const storedPaymentIds = new Set(storedNotifications.filter(n => n.paymentId).map(n => n.paymentId));
      const dedupedAlerts = paymentAlerts.filter(a => !storedPaymentIds.has(a.paymentId));

      const combined = [...dedupedAlerts, ...storedNotifications]
        .sort((a, b) => {
          const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const db2 = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return db2 - da;
        })
        .slice(0, limit);

      res.json(combined);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.get("/api/notifications/unread-count", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const [storedCount, dismissedIds] = await Promise.all([
        storage.getUnreadNotificationCount(userId),
        storage.getDismissedAlertIds(userId),
      ]);
      const paymentAlerts = await buildPaymentAlerts(userId, dismissedIds);
      res.json({ count: storedCount + paymentAlerts.length });
    } catch (error) {
      console.error("Error fetching unread count:", error);
      res.status(500).json({ message: "Failed to fetch unread count" });
    }
  });

  app.post("/api/notifications/:id/read", isAuthenticated, async (req: any, res) => {
    try {
      const notification = await storage.markNotificationAsRead(req.params.id);
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }
      res.json(notification);
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  app.post("/api/notifications/read-all", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const allAlerts = await buildPaymentAlerts(userId);
      const alertIds = allAlerts.map(a => a.id);
      await Promise.all([
        storage.markAllNotificationsAsRead(userId),
        storage.dismissAlerts(userId, alertIds),
      ]);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ message: "Failed to mark all notifications as read" });
    }
  });

  // PM: Respond to a notification
  app.post("/api/notifications/:id/respond", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { responseMessage } = req.body;
      if (!responseMessage || typeof responseMessage !== "string" || responseMessage.trim().length === 0) {
        return res.status(400).json({ message: "Response message is required" });
      }

      const notificationId = req.params.id;
      
      const response = await storage.createNotificationResponse({
        notificationId,
        responderId: userId,
        responseMessage: responseMessage.trim(),
        isRead: false,
      });

      res.json(response);
    } catch (error) {
      console.error("Error creating notification response:", error);
      res.status(500).json({ message: "Failed to send response" });
    }
  });

  // Admin: Get all notification responses from PMs
  app.get("/api/notifications/responses", isAuthenticated, requirePermission("view_notifications"), async (req: any, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const responses = await storage.getNotificationResponses(limit);
      res.json(responses);
    } catch (error) {
      console.error("Error fetching notification responses:", error);
      res.status(500).json({ message: "Failed to fetch responses" });
    }
  });

  // Admin: Get unread response count
  app.get("/api/notifications/responses/unread-count", isAuthenticated, requirePermission("view_notifications"), async (req: any, res) => {
    try {
      const count = await storage.getUnreadResponseCount();
      res.json({ count });
    } catch (error) {
      console.error("Error fetching unread response count:", error);
      res.status(500).json({ message: "Failed to fetch unread response count" });
    }
  });

  // Admin: Mark a response as read
  app.post("/api/notifications/responses/:id/read", isAuthenticated, requirePermission("view_notifications"), async (req: any, res) => {
    try {
      const response = await storage.markResponseAsRead(req.params.id);
      if (!response) {
        return res.status(404).json({ message: "Response not found" });
      }
      res.json(response);
    } catch (error) {
      console.error("Error marking response as read:", error);
      res.status(500).json({ message: "Failed to mark response as read" });
    }
  });

  // Admin: Mark all responses as read
  app.post("/api/notifications/responses/read-all", isAuthenticated, requirePermission("view_notifications"), async (req: any, res) => {
    try {
      await storage.markAllResponsesAsRead();
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking all responses as read:", error);
      res.status(500).json({ message: "Failed to mark all responses as read" });
    }
  });

  // Admin: Get all sent notifications
  app.get("/api/notifications/sent", isAuthenticated, requirePermission("view_notifications"), async (req: any, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const notifications = await storage.getAllSentNotifications(limit);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching sent notifications:", error);
      res.status(500).json({ message: "Failed to fetch sent notifications" });
    }
  });

  // Admin: Send manual payment reminders
  app.post("/api/notifications/send-reminders", isAuthenticated, requirePermission("send_notifications"), async (req: any, res) => {
    try {
      const { paymentIds, message, sendEmail: shouldSendEmail = true } = req.body;
      if (!paymentIds || !Array.isArray(paymentIds) || paymentIds.length === 0) {
        return res.status(400).json({ message: "Payment IDs are required" });
      }

      const adminId = req.user?.claims?.sub;
      const notificationsToCreate: any[] = [];
      const pmNotifications = new Map<string, { payments: any[], pmId: string }>();
      let emailsSent = 0;
      let emailErrors = 0;

      for (const paymentId of paymentIds) {
        const payment = await storage.getPaymentWithProject(paymentId);
        if (!payment || !payment.project?.pmId) continue;

        const pmId = payment.project.pmId;
        if (!pmNotifications.has(pmId)) {
          pmNotifications.set(pmId, { payments: [], pmId });
        }
        pmNotifications.get(pmId)!.payments.push(payment);
      }

      for (const [pmId, data] of pmNotifications) {
        const customMessage = message || `You have ${data.payments.length} payment(s) that need attention.`;
        const pm = await storage.getUser(pmId);
        
        for (const payment of data.payments) {
          notificationsToCreate.push({
            userId: pmId,
            type: "manual_reminder" as const,
            title: "Payment Reminder",
            message: `${customMessage} - ${payment.project?.name}: $${parseFloat(payment.expectedAmount).toLocaleString()}`,
            paymentId: payment.id,
            createdBy: adminId,
          });
          
          // Send email notification if enabled
          if (shouldSendEmail && pm?.email) {
            try {
              const result = await sendNotification("manual_reminder", {
                payment,
                project: payment.project,
                pm,
                customMessage,
              }, pm.email);
              
              if (result.success) {
                emailsSent++;
              } else {
                emailErrors++;
              }
            } catch (emailError) {
              console.error("Error sending manual reminder email:", emailError);
              emailErrors++;
            }
          }
        }
      }

      if (notificationsToCreate.length > 0) {
        await storage.createBulkNotifications(notificationsToCreate);
        await logActivityInternal(adminId, "create", "notification", null, `Sent ${notificationsToCreate.length} payment reminder(s) to PMs (${emailsSent} emails sent)`, req);
      }

      res.json({ 
        success: true, 
        notificationsSent: notificationsToCreate.length,
        pmsNotified: pmNotifications.size,
        emailsSent,
        emailErrors
      });
    } catch (error) {
      console.error("Error sending payment reminders:", error);
      res.status(500).json({ message: "Failed to send payment reminders" });
    }
  });

  // Admin: Get payments due soon or overdue (for notification page)
  app.get("/api/notifications/payments-needing-attention", isAuthenticated, requirePermission("view_notifications"), async (req, res) => {
    try {
      const settings = await storage.getAppSettings();
      const dueDays = settings?.dueDateWarningDays || 7;
      
      const [dueSoon, overdue] = await Promise.all([
        storage.getPaymentsDueSoon(dueDays),
        storage.getOverduePayments(),
      ]);

      res.json({ dueSoon, overdue });
    } catch (error) {
      console.error("Error fetching payments needing attention:", error);
      res.status(500).json({ message: "Failed to fetch payments needing attention" });
    }
  });

  // Dismiss a payment from reminders (hides it from due/overdue lists without changing status)
  app.post("/api/payments/:id/dismiss-from-reminders", isAuthenticated, requirePermission("edit_payments"), async (req: any, res) => {
    try {
      const payment = await storage.dismissPaymentFromReminders(req.params.id, true);
      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }
      const userId = req.user?.claims?.sub;
      await logActivityInternal(userId, "update", "payment", payment.id, `Dismissed payment from reminders`, req);
      res.json(payment);
    } catch (error) {
      console.error("Error dismissing payment from reminders:", error);
      res.status(500).json({ message: "Failed to dismiss payment from reminders" });
    }
  });

  // Restore a payment to reminders (show it again in due/overdue lists)
  app.post("/api/payments/:id/restore-to-reminders", isAuthenticated, requirePermission("edit_payments"), async (req: any, res) => {
    try {
      const payment = await storage.dismissPaymentFromReminders(req.params.id, false);
      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }
      const userId = req.user?.claims?.sub;
      await logActivityInternal(userId, "update", "payment", payment.id, `Restored payment to reminders`, req);
      res.json(payment);
    } catch (error) {
      console.error("Error restoring payment to reminders:", error);
      res.status(500).json({ message: "Failed to restore payment to reminders" });
    }
  });

  // Send client payment reminder email
  app.post("/api/payments/:id/send-reminder", isAuthenticated, requirePermission("edit_payments"), async (req: any, res) => {
    try {
      const payment = await storage.getPayment(req.params.id);
      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }

      const project = await storage.getProject(payment.projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      if (!project.clientEmail) {
        return res.status(400).json({ message: "Client email is not configured for this project. Please add a client email in the project settings." });
      }

      const appSettings = await storage.getAppSettings();
      const ccEmail = appSettings?.reminderCcEmail || null;

      const { sendClientPaymentReminder } = await import("./emailService");
      const result = await sendClientPaymentReminder(payment, project, ccEmail);

      if (result.success) {
        const userId = req.user?.claims?.sub;
        const ccInfo = ccEmail ? ` (CC: ${ccEmail})` : "";
        await logActivityInternal(userId, "create", "notification", payment.id, `Sent ${result.reminderType} reminder email to client${ccInfo} for payment`, req);
        res.json({ 
          success: true, 
          message: `Payment reminder sent to ${project.clientEmail}${ccInfo}`,
          reminderType: result.reminderType 
        });
      } else {
        res.status(500).json({ message: result.error || "Failed to send reminder email" });
      }
    } catch (error) {
      console.error("Error sending client payment reminder:", error);
      res.status(500).json({ message: "Failed to send payment reminder" });
    }
  });

  // Send payment receipt confirmation to client
  app.post("/api/payments/:id/send-receipt", isAuthenticated, requirePermission("edit_payments"), async (req: any, res) => {
    try {
      const payment = await storage.getPayment(req.params.id);
      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }

      if (payment.status !== "received") {
        return res.status(400).json({ message: "Payment must be marked as received before sending a receipt" });
      }

      const project = await storage.getProject(payment.projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      if (!project.clientEmail) {
        return res.status(400).json({ message: "Client email is not configured for this project. Please add a client email in the project settings." });
      }

      const appSettings = await storage.getAppSettings();
      const ccEmail = appSettings?.reminderCcEmail || null;
      const companyName = appSettings?.companyName || "RevolRMO";

      const { pdfBase64, fileName } = req.body || {};
      const receiptPdf = typeof pdfBase64 === "string" && pdfBase64.length > 0
        ? { base64: pdfBase64, fileName: typeof fileName === "string" && fileName ? fileName : `Receipt-${payment.id}.pdf` }
        : null;

      const { sendPaymentReceiptConfirmation } = await import("./emailService");
      const result = await sendPaymentReceiptConfirmation(payment, project, companyName, ccEmail, receiptPdf);

      if (result.success) {
        const userId = req.user?.claims?.sub;
        const ccInfo = ccEmail ? ` (CC: ${ccEmail})` : "";
        await logActivityInternal(userId, "create", "notification", payment.id, `Sent payment receipt confirmation to client${ccInfo}`, req);
        res.json({ 
          success: true, 
          message: `Payment receipt sent to ${project.clientEmail}${ccInfo}`
        });
      } else {
        res.status(500).json({ message: result.error || "Failed to send receipt email" });
      }
    } catch (error) {
      console.error("Error sending payment receipt confirmation:", error);
      res.status(500).json({ message: "Failed to send payment receipt" });
    }
  });

  // Dismiss all payments from reminders (bulk dismiss)
  app.post("/api/notifications/dismiss-all", isAuthenticated, requirePermission("edit_payments"), async (req: any, res) => {
    try {
      const settings = await storage.getAppSettings();
      const dueDays = settings?.dueDateWarningDays || 7;
      
      // Get all payments currently needing attention (due soon + overdue)
      const [dueSoon, overdue] = await Promise.all([
        storage.getPaymentsDueSoon(dueDays),
        storage.getOverduePayments(),
      ]);
      
      const allPayments = [...dueSoon, ...overdue];
      const paymentIds = allPayments.map(p => p.id);
      
      if (paymentIds.length === 0) {
        return res.json({ dismissed: 0, message: "No payments to dismiss" });
      }
      
      // Dismiss all payments
      let dismissedCount = 0;
      for (const id of paymentIds) {
        const payment = await storage.dismissPaymentFromReminders(id, true);
        if (payment) dismissedCount++;
      }
      
      const userId = req.user?.claims?.sub;
      await logActivityInternal(userId, "update", "notification", null, `Dismissed ${dismissedCount} payments from reminders`, req);
      
      res.json({ dismissed: dismissedCount, message: `Successfully dismissed ${dismissedCount} payments from reminders` });
    } catch (error) {
      console.error("Error dismissing all payments:", error);
      res.status(500).json({ message: "Failed to dismiss all payments" });
    }
  });

  // Get dismissed payments
  app.get("/api/notifications/dismissed-payments", isAuthenticated, requirePermission("view_notifications"), async (req, res) => {
    try {
      const dismissed = await storage.getDismissedPayments();
      res.json(dismissed);
    } catch (error) {
      console.error("Error fetching dismissed payments:", error);
      res.status(500).json({ message: "Failed to fetch dismissed payments" });
    }
  });

  // Auto-generate reminders for due/overdue payments (called periodically or on demand)
  app.post("/api/notifications/generate-auto-reminders", isAuthenticated, requirePermission("send_notifications"), async (req: any, res) => {
    try {
      const adminId = req.user?.claims?.sub;
      const { sendEmail: shouldSendEmail = true } = req.body || {};
      const settings = await storage.getAppSettings();
      const dueDays = settings?.dueDateWarningDays || 7;

      const [dueSoon, overdue] = await Promise.all([
        storage.getPaymentsDueSoon(dueDays),
        storage.getOverduePayments(),
      ]);

      const notificationsToCreate: any[] = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let emailsSent = 0;
      let emailErrors = 0;

      // Create notifications for overdue payments
      for (const payment of overdue) {
        if (!payment.project?.pmId) continue;
        const daysOverdue = Math.floor((today.getTime() - new Date(payment.dueDate!).getTime()) / (1000 * 60 * 60 * 24));
        
        notificationsToCreate.push({
          userId: payment.project.pmId,
          type: "payment_overdue" as const,
          title: "Payment Overdue",
          message: `Payment for ${payment.project.name} ($${parseFloat(payment.expectedAmount).toLocaleString()}) is ${daysOverdue} day(s) overdue.`,
          paymentId: payment.id,
          createdBy: adminId,
        });
        
        // Send email for overdue payment
        if (shouldSendEmail) {
          try {
            const pm = await storage.getUser(payment.project.pmId);
            if (pm?.email) {
              const result = await sendNotification("due_date_reminder", {
                payment,
                project: payment.project,
                pm,
                daysUntilDue: -daysOverdue,
              }, pm.email);
              if (result.success) emailsSent++;
              else emailErrors++;
            }
          } catch (e) { emailErrors++; }
        }
      }

      // Create notifications for payments due soon
      for (const payment of dueSoon) {
        if (!payment.project?.pmId) continue;
        const daysUntilDue = Math.floor((new Date(payment.dueDate!).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        notificationsToCreate.push({
          userId: payment.project.pmId,
          type: "payment_due_soon" as const,
          title: "Payment Due Soon",
          message: `Payment for ${payment.project.name} ($${parseFloat(payment.expectedAmount).toLocaleString()}) is due in ${daysUntilDue} day(s).`,
          paymentId: payment.id,
          createdBy: adminId,
        });
        
        // Send email for due soon payment
        if (shouldSendEmail) {
          try {
            const pm = await storage.getUser(payment.project.pmId);
            if (pm?.email) {
              const result = await sendNotification("due_date_reminder", {
                payment,
                project: payment.project,
                pm,
                daysUntilDue,
              }, pm.email);
              if (result.success) emailsSent++;
              else emailErrors++;
            }
          } catch (e) { emailErrors++; }
        }
      }

      if (notificationsToCreate.length > 0) {
        await storage.createBulkNotifications(notificationsToCreate);
        await logActivityInternal(adminId, "create", "notification", null, `Auto-generated ${notificationsToCreate.length} payment reminder(s) (${emailsSent} emails sent)`, req);
      }

      res.json({
        success: true,
        overdueNotifications: overdue.length,
        dueSoonNotifications: dueSoon.length,
        totalNotifications: notificationsToCreate.length,
        emailsSent,
        emailErrors,
      });
    } catch (error) {
      console.error("Error generating auto reminders:", error);
      res.status(500).json({ message: "Failed to generate auto reminders" });
    }
  });

  // Bulk payment export (CSV)
  app.get("/api/payments/export", isAuthenticated, async (req, res) => {
    try {
      const filters: {
        month?: number;
        year?: number;
        region?: Region;
        status?: PaymentStatus;
        pmId?: string;
        paymentType?: PaymentType;
      } = {};

      if (req.query.month) filters.month = parseInt(req.query.month as string);
      if (req.query.year) filters.year = parseInt(req.query.year as string);
      if (req.query.region) filters.region = req.query.region as Region;
      if (req.query.status) filters.status = req.query.status as PaymentStatus;
      if (req.query.pmId) filters.pmId = req.query.pmId as string;
      if (req.query.paymentType) filters.paymentType = req.query.paymentType as PaymentType;

      const payments = await storage.getAllPayments(filters);
      
      const csvData = payments.map(p => ({
        projectId: p.projectId,
        projectName: p.project?.name || "",
        clientName: p.project?.clientName || "",
        region: p.project?.region || "",
        expectedAmount: p.expectedAmount,
        totalAmount: p.totalAmount,
        receivedAmount: p.receivedAmount || "0",
        paymentType: p.paymentType,
        status: p.status,
        narration: p.narration || "",
        invoiceDate: p.invoiceDate ? new Date(p.invoiceDate).toISOString().split('T')[0] : "",
        dueDate: p.dueDate ? new Date(p.dueDate).toISOString().split('T')[0] : "",
        receivedDate: p.receivedDate ? new Date(p.receivedDate).toISOString().split('T')[0] : "",
        month: p.month,
        year: p.year,
        isTarget: p.isTarget ? "true" : "false",
      }));

      const csv = Papa.unparse(csvData);
      
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=payments-export-${Date.now()}.csv`);
      res.send(csv);
    } catch (error) {
      console.error("Error exporting payments:", error);
      res.status(500).json({ message: "Failed to export payments" });
    }
  });

  // Bulk payment import (CSV validation/preview)
  app.post("/api/payments/import/validate", isAuthenticated, requirePermission("import_data"), async (req: any, res) => {
    try {
      const { csvContent } = req.body;
      if (!csvContent || typeof csvContent !== "string") {
        return res.status(400).json({ message: "CSV content is required" });
      }

      const parsed = Papa.parse(csvContent, { header: true, skipEmptyLines: true });
      
      if (parsed.errors.length > 0) {
        return res.status(400).json({ 
          message: "CSV parsing failed", 
          errors: parsed.errors.map(e => ({ row: e.row, message: e.message }))
        });
      }

      const projects = await storage.getAllProjects();
      const projectMap = new Map(projects.map(p => [p.id, p]));
      const projectNameMap = new Map(projects.map(p => [p.name.toLowerCase(), p]));

      const validatedRows: any[] = [];
      const errors: { row: number; field: string; message: string }[] = [];
      const unmatchedProjectsMap = new Map<string, { name: string; clientName: string; region: string; totalCost: number; rowIndices: number[] }>();

      for (let i = 0; i < parsed.data.length; i++) {
        const row = parsed.data[i] as Record<string, string>;
        const rowNum = i + 2; // Account for header row and 1-based indexing
        const rowErrors: { field: string; message: string }[] = [];
        let isUnmatchedProject = false;

        // Find project by ID or name
        let projectId = row.projectId?.trim();
        let project = projectId ? projectMap.get(projectId) : null;
        
        if (!project && row.projectName) {
          project = projectNameMap.get(row.projectName.toLowerCase().trim());
          if (project) projectId = project.id;
        }

        if (!projectId && !row.projectName) {
          rowErrors.push({ field: "projectId", message: "Project ID or name is required" });
        } else if (!project) {
          // Track unmatched project for user to create
          const projectNameKey = (row.projectName || projectId || "").toLowerCase().trim();
          const projectDisplayName = row.projectName?.trim() || projectId || "";
          isUnmatchedProject = true;
          
          // Get expected amount from this row to calculate total cost for the project
          const rowExpectedAmount = parseFloat((row.expectedAmount || "0").replace(/[,$]/g, "").trim()) || 0;
          
          if (projectNameKey && !unmatchedProjectsMap.has(projectNameKey)) {
            unmatchedProjectsMap.set(projectNameKey, {
              name: projectDisplayName,
              clientName: row.clientName?.trim() || "",
              region: row.region?.trim().toUpperCase() || "",
              totalCost: rowExpectedAmount,
              rowIndices: [i]
            });
          } else if (projectNameKey) {
            const existing = unmatchedProjectsMap.get(projectNameKey)!;
            existing.rowIndices.push(i);
            existing.totalCost += rowExpectedAmount;
            // Update clientName/region if not set and this row has them
            if (!existing.clientName && row.clientName?.trim()) {
              existing.clientName = row.clientName.trim();
            }
            if (!existing.region && row.region?.trim()) {
              existing.region = row.region.trim().toUpperCase();
            }
          }
          
          rowErrors.push({ field: "projectId", message: `Project not found: ${projectId || row.projectName}` });
        }

        // Validate amounts - sanitize currency formatting ($, commas)
        const sanitizeAmount = (val: string) => parseFloat((val || "0").replace(/[,$]/g, "").trim());
        const expectedAmount = sanitizeAmount(row.expectedAmount);
        const totalAmount = sanitizeAmount(row.totalAmount);
        const receivedAmount = sanitizeAmount(row.receivedAmount || "0");

        if (isNaN(expectedAmount) || expectedAmount < 0) {
          rowErrors.push({ field: "expectedAmount", message: "Invalid expected amount" });
        }
        if (isNaN(totalAmount) || totalAmount < 0) {
          rowErrors.push({ field: "totalAmount", message: "Invalid total amount" });
        }
        if (isNaN(receivedAmount) || receivedAmount < 0) {
          rowErrors.push({ field: "receivedAmount", message: "Invalid received amount" });
        }

        // Validate payment type (case-insensitive, map to correct value)
        const paymentTypeRaw = row.paymentType?.toLowerCase().trim();
        const paymentType = paymentTypes.find(pt => pt === paymentTypeRaw) || null;
        if (!paymentType) {
          rowErrors.push({ field: "paymentType", message: `Invalid payment type: ${row.paymentType}. Must be: ${paymentTypes.join(", ")}` });
        }

        // Validate status (case-insensitive, underscore handling)
        const statusRaw = row.status?.toLowerCase().trim().replace(/ /g, "_");
        const status = paymentStatuses.find(ps => ps === statusRaw) || null;
        if (!status) {
          rowErrors.push({ field: "status", message: `Invalid status: ${row.status}. Must be: ${paymentStatuses.join(", ")}` });
        }

        // Validate month/year
        const month = parseInt(row.month);
        const year = parseInt(row.year);
        if (isNaN(month) || month < 1 || month > 12) {
          rowErrors.push({ field: "month", message: "Month must be between 1-12" });
        }
        if (isNaN(year) || year < 2000 || year > 2100) {
          rowErrors.push({ field: "year", message: "Year must be between 2000-2100" });
        }

        // Validate dates (optional)
        const parseOptionalDate = (dateStr: string) => {
          if (!dateStr || dateStr.trim() === "") return null;
          const date = new Date(dateStr);
          return isNaN(date.getTime()) ? "invalid" : date.toISOString();
        };

        const invoiceDate = parseOptionalDate(row.invoiceDate);
        const dueDate = parseOptionalDate(row.dueDate);
        const receivedDate = parseOptionalDate(row.receivedDate);

        if (invoiceDate === "invalid") {
          rowErrors.push({ field: "invoiceDate", message: "Invalid invoice date format" });
        }
        if (dueDate === "invalid") {
          rowErrors.push({ field: "dueDate", message: "Invalid due date format" });
        }
        if (receivedDate === "invalid") {
          rowErrors.push({ field: "receivedDate", message: "Invalid received date format" });
        }

        if (rowErrors.length > 0) {
          errors.push(...rowErrors.map(e => ({ row: rowNum, ...e })));
        }

        validatedRows.push({
          projectId: projectId || "",
          projectName: project?.name || row.projectName || "",
          clientName: project?.clientName || row.clientName || "",
          region: project?.region || row.region || "",
          expectedAmount: isNaN(expectedAmount) ? 0 : expectedAmount,
          totalAmount: isNaN(totalAmount) ? 0 : totalAmount,
          receivedAmount: isNaN(receivedAmount) ? 0 : receivedAmount,
          paymentType: paymentType || "", // Only use validated enum value, empty if invalid
          status: status || "", // Only use validated enum value, empty if invalid
          narration: row.narration || "",
          invoiceDate: invoiceDate !== "invalid" ? invoiceDate : null,
          dueDate: dueDate !== "invalid" ? dueDate : null,
          receivedDate: receivedDate !== "invalid" ? receivedDate : null,
          month: isNaN(month) ? 0 : month,
          year: isNaN(year) ? 0 : year,
          isTarget: row.isTarget?.toLowerCase() === "true",
          hasErrors: rowErrors.length > 0,
        });
      }

      // Convert unmatched projects map to array
      const unmatchedProjects = Array.from(unmatchedProjectsMap.values()).map(p => ({
        name: p.name,
        clientName: p.clientName,
        region: p.region,
        totalCost: p.totalCost,
        affectedRows: p.rowIndices.length
      }));

      res.json({
        totalRows: parsed.data.length,
        validRows: validatedRows.filter(r => !r.hasErrors).length,
        errorCount: errors.length,
        errors,
        preview: validatedRows,
        unmatchedProjects,
      });
    } catch (error) {
      console.error("Error validating CSV:", error);
      res.status(500).json({ message: "Failed to validate CSV" });
    }
  });

  // Bulk payment import (actually create payments)
  app.post("/api/payments/import", isAuthenticated, requirePermission("import_data"), async (req: any, res) => {
    try {
      const { payments: paymentData } = req.body;
      if (!Array.isArray(paymentData) || paymentData.length === 0) {
        return res.status(400).json({ message: "No payment data provided" });
      }

      const userId = req.user?.claims?.sub;
      const created: any[] = [];
      const failed: { index: number; error: string }[] = [];

      // Filter out rows that have validation errors
      const validPayments = paymentData.filter((p: any) => !p.hasErrors);
      
      if (validPayments.length === 0) {
        return res.status(400).json({ message: "No valid payments to import. All rows have validation errors." });
      }

      // Get all projects to validate projectIds
      const projects = await storage.getAllProjects();
      const projectMap = new Map(projects.map(p => [p.id, p]));

      for (let i = 0; i < validPayments.length; i++) {
        const data = validPayments[i];
        try {
          // Validate projectId exists
          if (!data.projectId || data.projectId === "") {
            failed.push({ index: i, error: "Project ID is required" });
            continue;
          }

          // Verify project exists in database
          if (!projectMap.has(data.projectId)) {
            failed.push({ index: i, error: `Project not found: ${data.projectId}` });
            continue;
          }

          // Parse amounts as numbers and validate
          const expectedAmount = typeof data.expectedAmount === "number" ? data.expectedAmount : parseFloat(String(data.expectedAmount).replace(/[,$]/g, ""));
          const totalAmount = typeof data.totalAmount === "number" ? data.totalAmount : parseFloat(String(data.totalAmount).replace(/[,$]/g, ""));
          const receivedAmount = typeof data.receivedAmount === "number" ? data.receivedAmount : parseFloat(String(data.receivedAmount || "0").replace(/[,$]/g, ""));

          if (isNaN(expectedAmount) || isNaN(totalAmount) || isNaN(receivedAmount)) {
            failed.push({ index: i, error: "Invalid amount values" });
            continue;
          }

          // Validate payment type and status
          if (!data.paymentType || !paymentTypes.includes(data.paymentType as PaymentType)) {
            failed.push({ index: i, error: `Invalid payment type: ${data.paymentType}` });
            continue;
          }
          if (!data.status || !paymentStatuses.includes(data.status as PaymentStatus)) {
            failed.push({ index: i, error: `Invalid status: ${data.status}` });
            continue;
          }

          const paymentInsert = {
            projectId: data.projectId,
            expectedAmount: String(expectedAmount),
            totalAmount: String(totalAmount),
            receivedAmount: String(receivedAmount),
            paymentType: data.paymentType as PaymentType,
            status: data.status as PaymentStatus,
            narration: data.narration || null,
            invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : null,
            dueDate: data.dueDate ? new Date(data.dueDate) : null,
            receivedDate: data.receivedDate ? new Date(data.receivedDate) : null,
            month: data.month,
            year: data.year,
            isTarget: data.isTarget ?? true,
          };

          const parsed = insertPaymentSchema.safeParse(paymentInsert);
          if (!parsed.success) {
            failed.push({ index: i, error: parsed.error.errors.map(e => e.message).join(", ") });
            continue;
          }

          const payment = await storage.createPayment(parsed.data);
          // Fail-soft: imported payments that arrive already "received" get a receipt PDF.
          if (payment.status === "received") {
            void uploadReceiptPdfToDrive(payment.id);
          }
          created.push(payment);
        } catch (err: any) {
          failed.push({ index: i, error: err.message || "Unknown error" });
        }
      }

      if (created.length > 0) {
        await logActivityInternal(userId, "import", "payment", null, `Bulk imported ${created.length} payments`, req);
      }

      res.json({
        success: true,
        created: created.length,
        failed: failed.length,
        failedDetails: failed,
      });
    } catch (error) {
      console.error("Error importing payments:", error);
      res.status(500).json({ message: "Failed to import payments" });
    }
  });

  // Analytics endpoint - payment trends, PM performance, status distribution
  app.get("/api/analytics", isAuthenticated, async (req, res) => {
    try {
      const now = new Date();
      const selectedYear = parseInt(req.query.year as string) || now.getFullYear();
      const currentYear = selectedYear;
      const months = parseInt(req.query.months as string) || 12;

      // Get all payments for the analytics period
      const allPayments = await storage.getAllPayments({});
      const users = await storage.getAllUsers();
      const projects = await storage.getAllProjects();
      const allMonthlyPlans = await storage.getAllMonthlyPlans();
      
      // Build lookups
      const pmLookup = new Map(users.map(u => [u.id, u]));
      const projectLookup = new Map(projects.map(p => [p.id, p]));
      const projectPmLookup = new Map(projects.map(p => [p.id, p.pmId]));
      
      // Build monthly targets lookup from targeted payments (isTarget=true)
      const monthlyTargetLookup = new Map<string, number>();
      for (const p of allPayments) {
        if (p.isTarget) {
          const monthKey = `${p.year}-${p.month}`;
          const targetAmt = parseFloat(p.expectedAmount || "0") || 0;
          monthlyTargetLookup.set(monthKey, (monthlyTargetLookup.get(monthKey) || 0) + targetAmt);
        }
      }

      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

      // Calculate payment trends for last N months
      const paymentTrends: {
        month: number;
        year: number;
        monthLabel: string;
        received: number;
        target: number;
        upsells: number;
      }[] = [];

      const regionTrends: {
        month: number;
        year: number;
        monthLabel: string;
        CA: number;
        TX: number;
        AE: number;
      }[] = [];

      // Generate all 12 months for the selected year
      for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
        const m = monthIndex + 1;
        const y = selectedYear;

        const monthPayments = allPayments.filter(p => p.month === m && p.year === y);
        
        let received = 0;
        let upsells = 0;
        const regionAmounts = { CA: 0, TX: 0, AE: 0 };

        // Get target from monthlyPlans instead of payments
        const monthKey = `${y}-${m}`;
        const target = monthlyTargetLookup.get(monthKey) || 0;

        for (const p of monthPayments) {
          const amt = parseFloat(p.receivedAmount || "0") || 0;
          received += amt;
          
          if (p.paymentType === "upsell") {
            upsells += amt;
          }

          // Region breakdown - use defensive project lookup
          const project = p.project || projectLookup.get(p.projectId);
          const region = project?.region as "CA" | "TX" | "AE" | undefined;
          if (region && regionAmounts[region] !== undefined) {
            regionAmounts[region] += amt;
          }
        }

        paymentTrends.push({
          month: m,
          year: y,
          monthLabel: `${monthNames[m - 1]} ${y.toString().slice(-2)}`,
          received,
          target,
          upsells,
        });

        regionTrends.push({
          month: m,
          year: y,
          monthLabel: `${monthNames[m - 1]} ${y.toString().slice(-2)}`,
          ...regionAmounts,
        });
      }

      // PM Performance data - calculate from payments for the selected year
      // Target = sum of expectedAmount for payments with isTarget=true
      // Received = sum of receivedAmount for all payments
      const selectedYearPayments = allPayments.filter(p => p.year === selectedYear);
      
      const pmPaymentData = new Map<string, {
        target: number;
        received: number;
        upsells: number;
        paymentCount: number;
      }>();

      for (const p of selectedYearPayments) {
        const pmId = projectPmLookup.get(p.projectId);
        if (!pmId) continue;

        if (!pmPaymentData.has(pmId)) {
          pmPaymentData.set(pmId, { target: 0, received: 0, upsells: 0, paymentCount: 0 });
        }

        const pmData = pmPaymentData.get(pmId)!;
        
        // Calculate target from targeted payments
        if (p.isTarget) {
          pmData.target += parseFloat(p.expectedAmount || "0") || 0;
        }
        
        const receivedAmt = parseFloat(p.receivedAmount || "0") || 0;
        pmData.received += receivedAmt;
        pmData.paymentCount += 1;
        
        if (p.paymentType === "upsell") {
          pmData.upsells += receivedAmt;
        }
      }

      // Build PM performance from payment data
      const pmPerformance = Array.from(pmPaymentData.entries()).map(([pmId, data]) => {
        const pm = pmLookup.get(pmId);
        const pmName = pm ? `${pm.firstName || ""} ${pm.lastName || ""}`.trim() || pm.email || "Unknown" : "Unknown";
        
        const progressPercent = data.target > 0 ? Math.min(Math.round((data.received / data.target) * 100), 100) : 0;
        const avgPaymentSize = data.paymentCount > 0 ? Math.round(data.received / data.paymentCount) : 0;

        return {
          pmId,
          pmName,
          target: data.target,
          received: data.received,
          upsells: data.upsells,
          progressPercent,
          paymentCount: data.paymentCount,
          avgPaymentSize,
        };
      }).sort((a, b) => b.received - a.received);

      // Status distribution for the selected year
      const statusMap = new Map<string, { count: number; amount: number }>();
      for (const s of paymentStatuses) {
        statusMap.set(s, { count: 0, amount: 0 });
      }

      for (const p of selectedYearPayments) {
        const status = p.status;
        const entry = statusMap.get(status);
        if (entry) {
          entry.count += 1;
          entry.amount += parseFloat(p.expectedAmount) || 0;
        }
      }

      const statusDistribution = Array.from(statusMap.entries()).map(([status, data]) => ({
        status: status as PaymentStatus,
        count: data.count,
        amount: data.amount,
      }));

      // Year over year comparison
      const currentYearPayments = allPayments.filter(p => p.year === currentYear);
      const previousYearPayments = allPayments.filter(p => p.year === currentYear - 1);

      const currentYearTotal = currentYearPayments.reduce((sum, p) => sum + (parseFloat(p.receivedAmount || "0") || 0), 0);
      const previousYearTotal = previousYearPayments.reduce((sum, p) => sum + (parseFloat(p.receivedAmount || "0") || 0), 0);

      const growthPercent = previousYearTotal > 0 
        ? Math.round(((currentYearTotal - previousYearTotal) / previousYearTotal) * 100)
        : currentYearTotal > 0 ? 100 : 0;

      res.json({
        paymentTrends,
        regionTrends,
        pmPerformance,
        statusDistribution,
        yearOverYear: {
          currentYear,
          previousYear: currentYear - 1,
          currentYearTotal,
          previousYearTotal,
          growthPercent,
        },
      });
    } catch (error) {
      console.error("Error fetching analytics:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // Reports endpoint - generate reports with filters
  app.get("/api/reports", isAuthenticated, async (req, res) => {
    try {
      const now = new Date();
      const type = (req.query.type as string) || "monthly";
      const month = req.query.month ? parseInt(req.query.month as string) : now.getMonth() + 1;
      const year = req.query.year ? parseInt(req.query.year as string) : now.getFullYear();
      const region = req.query.region as string | undefined;
      const pmId = req.query.pmId as string | undefined;

      // Get all data
      const allPayments = await storage.getAllPayments({});
      const users = await storage.getAllUsers();
      const projects = await storage.getAllProjects();

      // Build lookups
      const pmLookup = new Map(users.map(u => [u.id, u]));
      const projectLookup = new Map(projects.map(p => [p.id, p]));

      // Filter payments based on report type and time period
      let filteredPayments = allPayments;

      if (type === "daily") {
        // Today's payments
        const today = new Date();
        filteredPayments = allPayments.filter(p => {
          if (p.receivedDate) {
            const receivedDate = new Date(p.receivedDate);
            return receivedDate.toDateString() === today.toDateString();
          }
          return false;
        });
      } else if (type === "weekly") {
        // This week's payments
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 7);

        filteredPayments = allPayments.filter(p => {
          if (p.receivedDate) {
            const receivedDate = new Date(p.receivedDate);
            return receivedDate >= startOfWeek && receivedDate < endOfWeek;
          }
          // Also include payments for this month/year that don't have received date
          return p.month === now.getMonth() + 1 && p.year === now.getFullYear();
        });
      } else if (type === "monthly") {
        // Specific month's payments
        filteredPayments = allPayments.filter(p => p.month === month && p.year === year);
      } else if (type === "yearly") {
        // Full year's payments
        filteredPayments = allPayments.filter(p => p.year === year);
      }

      // Apply region filter
      if (region) {
        filteredPayments = filteredPayments.filter(p => {
          const project = p.project || projectLookup.get(p.projectId);
          return project?.region === region;
        });
      }

      // Apply PM filter
      if (pmId) {
        filteredPayments = filteredPayments.filter(p => {
          const project = p.project || projectLookup.get(p.projectId);
          return project?.pmId === pmId;
        });
      }

      // Calculate summary totals based on status
      let totalReceived = 0;
      let totalPending = 0;
      let totalInvoiced = 0;
      let totalTarget = 0;

      const regionAmounts = new Map<string, number>();
      const pmAmounts = new Map<string, { amount: number; name: string }>();
      const statusCounts = new Map<string, { count: number; amount: number }>();

      for (const p of filteredPayments) {
        const amount = parseFloat(p.receivedAmount || "0") || 0;
        const expectedAmount = parseFloat(p.expectedAmount || "0") || 0;
        const project = p.project || projectLookup.get(p.projectId);

        // Add to total target
        totalTarget += expectedAmount;

        // Track by status
        const statusData = statusCounts.get(p.status) || { count: 0, amount: 0 };
        statusData.count += 1;
        statusData.amount += p.status === "received" ? amount : expectedAmount;
        statusCounts.set(p.status, statusData);

        // Totals by status
        if (p.status === "received") {
          totalReceived += amount;
        } else if (p.status === "pending_invoice" || p.status === "not_targeting") {
          totalPending += expectedAmount;
        } else if (p.status === "invoiced") {
          totalInvoiced += expectedAmount;
        }

        // Region breakdown (use received amount for received, expected for others)
        const regionKey = project?.region || "Unknown";
        const regionAmt = p.status === "received" ? amount : expectedAmount;
        regionAmounts.set(regionKey, (regionAmounts.get(regionKey) || 0) + regionAmt);

        // PM breakdown
        const pmIdKey = project?.pmId;
        if (pmIdKey) {
          const pm = pmLookup.get(pmIdKey);
          const pmName = pm ? `${pm.firstName || ""} ${pm.lastName || ""}`.trim() || pm.email || "Unknown" : "Unknown";
          const pmData = pmAmounts.get(pmIdKey) || { amount: 0, name: pmName };
          pmData.amount += p.status === "received" ? amount : expectedAmount;
          pmAmounts.set(pmIdKey, pmData);
        }
      }

      // Build response
      const byRegion = Array.from(regionAmounts.entries())
        .map(([region, amount]) => ({ region: region as Region, amount }))
        .sort((a, b) => b.amount - a.amount);

      const byPM = Array.from(pmAmounts.entries())
        .map(([pmId, data]) => ({ pmId, pmName: data.name, amount: data.amount }))
        .sort((a, b) => b.amount - a.amount);

      const byStatus = Array.from(statusCounts.entries())
        .map(([status, data]) => ({ status, count: data.count, amount: data.amount }));

      res.json({
        type,
        totalTarget,
        byStatus,
        summary: {
          totalReceived,
          totalPending,
          totalInvoiced,
          byRegion,
          byPM,
        },
      });
    } catch (error) {
      console.error("Error fetching reports:", error);
      res.status(500).json({ message: "Failed to fetch reports" });
    }
  });

  // Payments Report endpoint - Upsell and Recurring payments with date range
  app.get("/api/reports/payments", isAuthenticated, async (req, res) => {
    try {
      const { startDate, endDate, paymentType } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ message: "Start date and end date are required" });
      }
      
      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      end.setHours(23, 59, 59, 999); // Include the full end date
      
      // Get all payments and filter by date range
      const allPayments = await storage.getAllPayments({});
      const projects = await storage.getAllProjects();
      const users = await storage.getAllUsers();
      
      const projectLookup = new Map(projects.map(p => [p.id, p]));
      const pmLookup = new Map(users.map(u => [u.id, u]));
      
      // Filter by year/month within range - match Analytics module logic
      // Include payments that have receivedAmount > 0 (regardless of status)
      const startYear = start.getFullYear();
      const startMonth = start.getMonth() + 1;
      const endYear = end.getFullYear();
      const endMonth = end.getMonth() + 1;
      
      let filteredPayments = allPayments.filter(p => {
        // Check if payment has receivedAmount
        const receivedAmt = parseFloat(p.receivedAmount?.toString() || "0");
        if (receivedAmt <= 0) return false;
        
        // Check if payment falls within date range based on year/month
        const paymentYearMonth = p.year * 12 + p.month;
        const startYearMonth = startYear * 12 + startMonth;
        const endYearMonth = endYear * 12 + endMonth;
        
        return paymentYearMonth >= startYearMonth && paymentYearMonth <= endYearMonth;
      });
      
      // Filter by payment type
      // When "all" or not specified, include both upsell and recurring (the main types for this report)
      // When a specific type is selected, only show that type
      if (paymentType && paymentType !== "all") {
        filteredPayments = filteredPayments.filter(p => p.paymentType === paymentType);
      } else {
        // Default to both upsell and recurring for "all" option
        filteredPayments = filteredPayments.filter(p => 
          p.paymentType === "upsell" || p.paymentType === "recurring"
        );
      }
      
      // Build the payments list with project and PM details
      const paymentsWithDetails = filteredPayments.map(p => {
        const project = projectLookup.get(p.projectId);
        const pm = project?.pmId ? pmLookup.get(project.pmId) : null;
        return {
          ...p,
          projectName: project?.name || "Unknown",
          clientName: project?.clientName || "Unknown",
          region: project?.region || "Unknown",
          pmName: pm ? `${pm.firstName || ""} ${pm.lastName || ""}`.trim() || pm.email : "Unknown",
        };
      });
      
      // Calculate region-wise summary
      const regionSummary: Record<string, { upsell: number; recurring: number; total: number }> = {};
      
      paymentsWithDetails.forEach(p => {
        const region = p.region as string;
        if (!regionSummary[region]) {
          regionSummary[region] = { upsell: 0, recurring: 0, total: 0 };
        }
        // Use receivedAmount if it's a positive value, otherwise fall back to expectedAmount
        const receivedAmt = parseFloat(p.receivedAmount?.toString() || "0");
        const expectedAmt = parseFloat(p.expectedAmount?.toString() || "0");
        const amount = receivedAmt > 0 ? receivedAmt : expectedAmt;
        
        if (p.paymentType === "upsell") {
          regionSummary[region].upsell += amount;
        } else if (p.paymentType === "recurring") {
          regionSummary[region].recurring += amount;
        }
        regionSummary[region].total += amount;
      });
      
      // Calculate grand totals
      const grandTotal = {
        upsell: Object.values(regionSummary).reduce((sum, r) => sum + r.upsell, 0),
        recurring: Object.values(regionSummary).reduce((sum, r) => sum + r.recurring, 0),
        total: Object.values(regionSummary).reduce((sum, r) => sum + r.total, 0),
      };
      
      res.json({
        payments: paymentsWithDetails,
        regionSummary: Object.entries(regionSummary).map(([region, amounts]) => ({
          region,
          ...amounts,
        })),
        grandTotal,
        dateRange: { startDate: start, endDate: end },
        paymentCount: paymentsWithDetails.length,
      });
    } catch (error) {
      console.error("Error fetching payments report:", error);
      res.status(500).json({ message: "Failed to fetch payments report" });
    }
  });

  // Project Statement of Account (client-shareable ledger) endpoint.
  // Returns a chronological statement combining recurring payments, additional
  // services (upsell payments — never labelled "upsell" to clients), and
  // milestones marked paid directly. Each line carries Debit (amount charged),
  // Credit (amount received) and a running Balance.
  app.get("/api/reports/payments/ledger", isAuthenticated, async (req, res) => {
    try {
      const { projectId, startDate, endDate, type, status } = req.query;

      if (!projectId) {
        return res.status(400).json({ message: "Project ID is required" });
      }

      const project = await storage.getProject(projectId as string);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const allPayments = await storage.getPaymentsByProjectId(projectId as string);
      const allMilestones = await storage.getProjectMilestones(projectId as string);
      const projectChangeRequests = await storage.getProjectChangeRequests(projectId as string);
      const allInstallments = projectChangeRequests.flatMap(cr => cr.installments);
      const projectInvoices = await storage.getAllInvoices({ projectId: projectId as string });
      const users = await storage.getAllUsers();
      const pmLookup = new Map(users.map(u => [u.id, u]));
      const pm = project.pmId ? pmLookup.get(project.pmId) : null;

      // Map invoice records to the payment they were raised against so each
      // statement line can show its invoice reference + status. Project-level
      // invoices (no paymentId) act as a fallback when a line has no direct
      // invoice match.
      const invoiceByPaymentId = new Map<string, (typeof projectInvoices)[number]>();
      const projectFallbackInvoices: (typeof projectInvoices)[number][] = [];
      for (const inv of projectInvoices) {
        if (inv.paymentId) invoiceByPaymentId.set(inv.paymentId, inv);
        else projectFallbackInvoices.push(inv);
      }
      // Only use a project-level fallback when it is unambiguous (exactly one
      // project invoice with no payment link); otherwise leave the line without
      // an invoice rather than mis-associating one.
      const fallbackInvoice =
        projectFallbackInvoices.length === 1 ? projectFallbackInvoices[0] : undefined;

      // Resolve the invoice for a statement line: prefer the invoice raised
      // against its (linked) payment, otherwise fall back to the project invoice.
      const resolveInvoice = (paymentId: string | null | undefined) =>
        (paymentId ? invoiceByPaymentId.get(paymentId) : undefined) ?? fallbackInvoice;

      // A single statement line. type drives the client-facing label on the
      // frontend ("Recurring" / "Additional Services" / "Milestone").
      type StatementEntry = {
        id: string;
        source: "payment" | "milestone" | "installment";
        type: "recurring" | "upsell" | "milestone";
        description: string;
        invoiceNumber: string | null;
        invoiceStatus: string | null;
        status: string;
        date: Date | string | null; // primary (billing) date used for sort/range
        invoiceDate: Date | string | null;
        dueDate: Date | string | null;
        receivedDate: Date | string | null;
        debit: number; // amount charged / invoiced
        credit: number; // amount received
        balance: number; // running cumulative, filled after sort
      };

      // sanitizeClientText is imported from ./statementLedger.

      // Milestones shown on the statement: paid AND partially_paid. Both are
      // the canonical lines for their transactions, so any payment record linked
      // to them is suppressed below to avoid double counting.
      const shownMilestones = allMilestones.filter(
        m => m.status === "paid" || m.status === "partially_paid",
      );
      const shownMilestoneIds = new Set(shownMilestones.map(m => m.id));

      // A milestone is "linked" to a payment when projectMilestones.paymentId is
      // set OR a payment references it via payments.milestoneId. Collect every
      // payment id that is represented by a shown milestone so we can drop
      // those payment rows and keep only the milestone line.
      const suppressedPaymentIds = new Set<string>();
      // Reverse link: milestone id -> the payment that references it via
      // payments.milestoneId, so a milestone with no direct paymentId can still
      // resolve its linked payment (and that payment's invoice).
      const paymentByMilestoneId = new Map<string, (typeof allPayments)[number]>();
      for (const m of shownMilestones) {
        if (m.paymentId) suppressedPaymentIds.add(m.paymentId);
      }
      for (const p of allPayments) {
        if (p.milestoneId) {
          paymentByMilestoneId.set(p.milestoneId, p);
          if (shownMilestoneIds.has(p.milestoneId)) suppressedPaymentIds.add(p.id);
        }
      }

      // Change-request installments. Unlike milestones, a single Paid installment
      // may be settled by SEVERAL split payments, and the client should see each
      // payment as its own line. So we do NOT suppress installment payments here;
      // instead each linked payment is shown individually (described by its
      // change-request name) and the aggregate installment line is used only as a
      // fallback when an installment has no linked payment records — so nothing is
      // ever double counted.
      const paidInstallments = allInstallments.filter(i => i.status === "paid");
      const paidInstallmentIds = new Set(paidInstallments.map(i => i.id));

      // Change-request name (title) for each installment. This is what the client
      // sees as the line description, never the internal "Installment X of Y" name.
      const crTitleByInstallmentId = new Map<string, string>();
      for (const cr of projectChangeRequests) {
        for (const inst of cr.installments) {
          crTitleByInstallmentId.set(inst.id, sanitizeClientText(cr.title));
        }
      }

      // Payments linked to each installment, via either direction:
      //   payments.crInstallmentId === installment.id  OR  installment.paymentId.
      const paymentsByInstallmentId = new Map<string, (typeof allPayments)[number][]>();
      const linkInstallmentPayment = (
        installmentId: string,
        p: (typeof allPayments)[number],
      ) => {
        const list = paymentsByInstallmentId.get(installmentId) ?? [];
        if (!list.some(x => x.id === p.id)) list.push(p);
        paymentsByInstallmentId.set(installmentId, list);
      };
      for (const p of allPayments) {
        if (p.crInstallmentId) linkInstallmentPayment(p.crInstallmentId, p);
      }
      for (const i of allInstallments) {
        if (i.paymentId) {
          const p = allPayments.find(x => x.id === i.paymentId);
          if (p) linkInstallmentPayment(i.id, p);
        }
      }

      // Payment-backed rows (recurring + additional services), excluding any
      // payment already represented by a Paid milestone line.
      const paymentEntries: StatementEntry[] = allPayments
        .filter(p => !suppressedPaymentIds.has(p.id))
        .map(p => {
          const inv = resolveInvoice(p.id);
          const isUpsell = p.paymentType === "upsell";
          // A payment linked to a change-request installment is described by its
          // change-request name (never the raw "Installment X of Y" wording) and
          // is always presented as Additional Services.
          const crTitle = p.crInstallmentId
            ? crTitleByInstallmentId.get(p.crInstallmentId)
            : undefined;
          const descriptionBase =
            crTitle || p.narration || (isUpsell ? "Additional Services" : "Recurring Payment");
          const debit = parseFloat(p.expectedAmount?.toString() || "0");
          let credit = parseFloat(p.receivedAmount?.toString() || "0");
          // Preserve the financial equivalence of the previous aggregate
          // installment line: when a fully Paid installment is settled by this
          // payment but no received amount was recorded, the expected amount was
          // received in full.
          if (credit === 0 && p.crInstallmentId && paidInstallmentIds.has(p.crInstallmentId)) {
            credit = debit;
          }
          return {
            id: p.id,
            source: "payment" as const,
            type: crTitle || isUpsell ? ("upsell" as const) : ("recurring" as const),
            description: sanitizeClientText(descriptionBase),
            invoiceNumber: inv?.invoiceNumber ?? null,
            invoiceStatus: inv?.status ?? null,
            status: p.status,
            date: p.invoiceDate || p.dueDate || p.receivedDate || p.createdAt,
            invoiceDate: p.invoiceDate,
            dueDate: p.dueDate,
            receivedDate: p.receivedDate,
            debit,
            credit,
            balance: 0,
          };
        });

      // Milestone rows. buildMilestoneLedgerEntry (from ./statementLedger) handles
      // the financial rules: debit=expected, credit=received (never inflated for
      // partially_paid), status="partially_paid"|"received".
      const milestoneEntries: StatementEntry[] = shownMilestones.map(m => {
        const linkedPaymentId = m.paymentId || paymentByMilestoneId.get(m.id)?.id || null;
        const inv = resolveInvoice(linkedPaymentId);
        return buildMilestoneLedgerEntry(m, linkedPaymentId, inv) as StatementEntry;
      });

      // Aggregate installment rows — ONLY for Paid installments that have no
      // linked payment records (the per-payment lines above already represent the
      // rest, so this avoids any double counting). Described by the change-request
      // name and labeled as "Additional Services" (upsell type).
      const installmentEntries: StatementEntry[] = paidInstallments
        .filter(i => (paymentsByInstallmentId.get(i.id)?.length ?? 0) === 0)
        .map(i => {
          const expected = parseFloat(i.expectedAmount?.toString() || "0");
          const received = parseFloat(i.receivedAmount?.toString() || "0");
          const effectiveReceived = received === 0 ? expected : received;
          const inv = resolveInvoice(i.paymentId || null);
          return {
            id: `installment-${i.id}`,
            source: "installment" as const,
            type: "upsell" as const,
            description: crTitleByInstallmentId.get(i.id) || sanitizeClientText(i.name),
            invoiceNumber: inv?.invoiceNumber ?? null,
            invoiceStatus: inv?.status ?? null,
            status: "received",
            date: i.invoicedDate || i.dueDate || i.paidDate || i.createdAt,
            invoiceDate: i.invoicedDate,
            dueDate: i.dueDate,
            receivedDate: i.paidDate,
            debit: expected,
            credit: effectiveReceived,
            balance: 0,
          };
        });

      let combined = [...paymentEntries, ...milestoneEntries, ...installmentEntries];

      // This is a payment ledger (charges & payments made by the client), not a
      // general journal: drop any line that carries neither a charge (debit) nor a
      // payment (credit) so empty placeholder rows never appear on the statement.
      combined = combined.filter(
        e => Math.abs(e.debit) > 0.005 || Math.abs(e.credit) > 0.005,
      );

      // Type filter (recurring / upsell / milestone)
      if (type && type !== "all") {
        combined = combined.filter(e => e.type === type);
      }

      // Status filter: fully settled vs still outstanding
      // "Settled" = any credit has been received (credit > 0), including partial.
      // "Outstanding" = nothing received yet (credit === 0).
      if (status === "paid") {
        combined = combined.filter(e => e.credit > 0.005);
      } else if (status === "outstanding") {
        combined = combined.filter(e => e.credit <= 0.005);
      }

      // Date-range filter on the primary (billing) date
      const start = startDate ? new Date(startDate as string) : null;
      const end = endDate ? new Date(endDate as string) : null;
      if (end) end.setHours(23, 59, 59, 999);
      if (start || end) {
        combined = combined.filter(e => {
          if (!e.date) return false;
          const d = new Date(e.date);
          if (start && d < start) return false;
          if (end && d > end) return false;
          return true;
        });
      }

      // Sort chronologically (oldest first) so the running balance reads top-down.
      combined.sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());

      applyRunningBalance(combined);

      const totalCharged = combined.reduce((sum, e) => sum + e.debit, 0);
      const totalReceived = combined.reduce((sum, e) => sum + e.credit, 0);
      const outstanding = totalCharged - totalReceived;

      res.json({
        project: {
          id: project.id,
          name: project.name,
          clientName: project.clientName,
          clientBusinessName: project.clientBusinessName || "",
          clientEmail: project.clientEmail || "",
          clientAddress: project.clientAddress || "",
          region: project.region,
          pmName: pm ? `${pm.firstName || ""} ${pm.lastName || ""}`.trim() || pm.email : "Unassigned",
          pmEmail: pm?.email || "",
          totalCost: project.totalCost,
          billingType: project.billingType,
        },
        entries: combined,
        summary: {
          totalCharged,
          totalReceived,
          outstanding,
          entryCount: combined.length,
        },
      });
    } catch (error) {
      console.error("Error fetching project statement:", error);
      res.status(500).json({ message: "Failed to fetch project statement" });
    }
  });

  // Region Payments Report endpoint
  app.get("/api/reports/payments/region", isAuthenticated, async (req, res) => {
    try {
      const { region, startDate, endDate } = req.query;
      
      if (!region) {
        return res.status(400).json({ message: "Region is required" });
      }
      
      const start = startDate ? new Date(startDate as string) : new Date(new Date().getFullYear(), 0, 1);
      const end = endDate ? new Date(endDate as string) : new Date();
      end.setHours(23, 59, 59, 999);
      
      const allPayments = await storage.getAllPayments({});
      const projects = await storage.getAllProjects();
      const users = await storage.getAllUsers();
      
      const projectLookup = new Map(projects.map(p => [p.id, p]));
      const pmLookup = new Map(users.map(u => [u.id, u]));
      
      // Filter payments by region
      const regionPayments = allPayments.filter(p => {
        const project = projectLookup.get(p.projectId);
        return project?.region === region;
      });
      
      // Filter by date range based on payment dates
      const paymentsInRange = regionPayments.filter(p => {
        const paymentDate = p.receivedDate || p.dueDate || p.invoiceDate;
        if (!paymentDate) {
          // Include targeted payments for the month/year in range
          const paymentMonth = new Date(p.year, p.month - 1, 1);
          return paymentMonth >= start && paymentMonth <= end;
        }
        const date = new Date(paymentDate);
        return date >= start && date <= end;
      });
      
      // Categorize payments
      const receivedPayments = paymentsInRange.filter(p => p.status === "received" && p.receivedDate);
      const missedPayments = paymentsInRange.filter(p => {
        if (p.status === "received") return false;
        // Payment was targeted but not received
        if (!p.isTarget) return false;
        const dueDate = p.dueDate ? new Date(p.dueDate) : new Date(p.year, p.month - 1, 28);
        return dueDate < new Date() && (!p.receivedAmount || parseFloat(p.receivedAmount.toString()) === 0);
      });
      const recurringPayments = paymentsInRange.filter(p => p.paymentType === "recurring");
      const upsellPayments = paymentsInRange.filter(p => p.paymentType === "upsell");
      
      // Helper to add project details
      const addDetails = (p: typeof allPayments[0]) => {
        const project = projectLookup.get(p.projectId);
        const pm = project?.pmId ? pmLookup.get(project.pmId) : null;
        return {
          id: p.id,
          projectName: project?.name || "Unknown",
          clientName: project?.clientName || "Unknown",
          clientEmail: project?.clientEmail || "",
          pmName: pm ? `${pm.firstName || ""} ${pm.lastName || ""}`.trim() || pm.email : "Unknown",
          paymentType: p.paymentType,
          status: p.status,
          expectedAmount: p.expectedAmount,
          receivedAmount: p.receivedAmount,
          invoiceDate: p.invoiceDate,
          dueDate: p.dueDate,
          receivedDate: p.receivedDate,
          month: p.month,
          year: p.year,
          narration: p.narration,
        };
      };
      
      // Calculate totals
      const totalReceived = receivedPayments.reduce((sum, p) => sum + parseFloat(p.receivedAmount?.toString() || "0"), 0);
      const totalMissed = missedPayments.reduce((sum, p) => sum + parseFloat(p.expectedAmount?.toString() || "0"), 0);
      const totalRecurring = recurringPayments.filter(p => p.status === "received").reduce((sum, p) => sum + parseFloat(p.receivedAmount?.toString() || "0"), 0);
      const totalUpsell = upsellPayments.filter(p => p.status === "received").reduce((sum, p) => sum + parseFloat(p.receivedAmount?.toString() || "0"), 0);
      
      res.json({
        region,
        dateRange: { startDate: start, endDate: end },
        totals: {
          received: totalReceived,
          missed: totalMissed,
          recurring: totalRecurring,
          upsell: totalUpsell,
        },
        counts: {
          received: receivedPayments.length,
          missed: missedPayments.length,
          recurring: recurringPayments.length,
          upsell: upsellPayments.length,
        },
        paymentsReceived: receivedPayments.map(addDetails),
        paymentsMissed: missedPayments.map(addDetails),
        recurringBreakdown: recurringPayments.map(addDetails),
        upsellBreakdown: upsellPayments.map(addDetails),
      });
    } catch (error) {
      console.error("Error fetching region payments report:", error);
      res.status(500).json({ message: "Failed to fetch region payments report" });
    }
  });

  // Email notification routes
  app.get("/api/notifications/status", isAuthenticated, requirePermission("view_notifications"), async (req, res) => {
    try {
      const status = getEmailServiceStatus();
      const settings = await storage.getAppSettings();
      res.json({
        ...status,
        emailNotificationsEnabled: settings?.enableEmailNotifications || false,
        paymentReminderDays: settings?.paymentReminderDays || 7,
        dueDateWarningDays: settings?.dueDateWarningDays || 3,
      });
    } catch (error) {
      console.error("Error fetching notification status:", error);
      res.status(500).json({ message: "Failed to fetch notification status" });
    }
  });

  app.post("/api/notifications/send-email-reminders", isAuthenticated, requirePermission("send_notifications"), async (req: any, res) => {
    try {
      const result = await checkAndSendDueDateReminders();
      const userId = req.user?.claims?.sub;
      await logActivityInternal(userId, "export", "payment", undefined, `Sent ${result.sent} due date reminder emails (${result.errors} errors)`, req);
      res.json(result);
    } catch (error) {
      console.error("Error sending reminders:", error);
      res.status(500).json({ message: "Failed to send reminders" });
    }
  });

  app.post("/api/notifications/test", isAuthenticated, requirePermission("send_notifications"), async (req: any, res) => {
    try {
      const { email, type } = req.body;
      if (!email || !type) {
        return res.status(400).json({ message: "Email and type are required" });
      }

      // Try to get real payment data, otherwise use mock data for testing
      const payments = await storage.getAllPayments({});
      let payment: any;
      let project: any;
      let pm: any = null;

      if (payments.length > 0) {
        payment = payments[0];
        project = payment.project;
        pm = project.pmId ? await storage.getUser(project.pmId) : null;
      } else {
        // Create mock data for testing when no payments exist
        const settings = await storage.getAppSettings();
        const now = new Date();
        const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        project = {
          id: "test-project",
          name: "Test Project",
          clientName: settings?.companyName || "Test Client",
          clientEmail: email,
          region: "CA" as const,
          pmId: null,
          projectType: "Test",
          phase: "Active",
          totalCost: "10000.00",
          paymentTerms: "Net 30",
          createdAt: now,
          updatedAt: now,
        };
        payment = {
          id: "test-payment",
          projectId: "test-project",
          expectedAmount: "1000.00",
          totalAmount: "1000.00",
          receivedAmount: "1000.00",
          paymentType: "recurring" as const,
          status: "received" as const,
          narration: "Test payment notification",
          invoiceDate: now,
          dueDate: dueDate,
          receivedDate: now,
          month: now.getMonth() + 1,
          year: now.getFullYear(),
          isTarget: true,
          createdAt: now,
          updatedAt: now,
          project,
        };
      }

      const result = await sendNotification(type, {
        payment,
        project,
        pm,
        daysUntilDue: 3,
      }, email);

      res.json(result);
    } catch (error) {
      console.error("Error sending test notification:", error);
      res.status(500).json({ message: "Failed to send test notification" });
    }
  });

  // Upsell routes
  app.get("/api/upsells", isAuthenticated, async (req: any, res) => {
    try {
      const filters: { projectId?: string; status?: UpsellStatus; pmId?: string } = {};
      
      if (req.query.projectId) filters.projectId = req.query.projectId as string;
      if (req.query.status && upsellStatuses.includes(req.query.status as any)) {
        filters.status = req.query.status as UpsellStatus;
      }
      if (req.query.pmId) filters.pmId = req.query.pmId as string;

      const upsells = await storage.getAllUpsells(filters);
      res.json(upsells);
    } catch (error) {
      console.error("Error fetching upsells:", error);
      res.status(500).json({ message: "Failed to fetch upsells" });
    }
  });

  // ---- Upsell AI Analysis (Task #112, scoped in Task #170) ----
  // Deterministic aggregates computed from sold CRs (+ pipeline upsells when scope=combined).
  function parseAnalysisScope(raw: unknown): UpsellAnalysisScope {
    return raw === "sold" ? "sold" : "combined";
  }

  app.get("/api/upsells/ai/stats", isAuthenticated, requirePermission("view_upsells"), async (req, res) => {
    try {
      const scope = parseAnalysisScope(req.query.scope);
      const stats = await getUpsellAnalysisStats(scope);
      res.json(stats);
    } catch (error) {
      console.error("Error computing upsell AI stats:", error);
      res.status(500).json({ message: "Failed to compute upsell stats" });
    }
  });

  // The most recent stored AI analysis (so the dashboard persists between visits).
  app.get("/api/upsells/ai/analysis/latest", isAuthenticated, requirePermission("view_upsells"), async (req, res) => {
    try {
      const scope = parseAnalysisScope(req.query.scope);
      const latest = await storage.getLatestUpsellAiAnalysis(scope);
      res.json({
        analysis: latest ?? null,
        configuredProviders: await configuredProviders(),
      });
    } catch (error) {
      console.error("Error fetching latest upsell AI analysis:", error);
      res.status(500).json({ message: "Failed to fetch latest analysis" });
    }
  });

  // Run a fresh AI analysis with the chosen provider, then store + return it.
  app.post("/api/upsells/ai/analysis", isAuthenticated, requirePermission("view_upsells"), async (req: any, res) => {
    try {
      const parsed = z
        .object({ provider: z.enum(upsellAiProviders), scope: z.enum(upsellAnalysisScopes).optional() })
        .safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "A valid provider (anthropic or openai) is required" });
      }
      const provider = parsed.data.provider;
      const scope = parsed.data.scope ?? "combined";

      if (!(await isProviderConfigured(provider))) {
        return res.status(503).json({
          message: `The ${provider === "openai" ? "OpenAI" : "Claude (Anthropic)"} provider is not configured. Add the API key to enable it.`,
          code: "PROVIDER_NOT_CONFIGURED",
          provider,
        });
      }

      const stats = await getUpsellAnalysisStats(scope);
      if (totalDataPoints(stats) < 3) {
        return res.status(422).json({
          message:
            scope === "sold"
              ? "Not enough sold upsell data to analyze yet. Lock some change requests first."
              : "Not enough upsell data to analyze yet. Add more sold upsells or pipeline opportunities first.",
          code: "INSUFFICIENT_DATA",
        });
      }

      let generated;
      try {
        generated = await generateUpsellInsights(provider, stats);
      } catch (err) {
        if (err instanceof ProviderNotConfiguredError) {
          return res.status(503).json({ message: err.message, code: "PROVIDER_NOT_CONFIGURED", provider });
        }
        console.error(`AI analysis failed for provider ${provider}:`, err);
        return res.status(502).json({
          message: "The AI provider could not complete the analysis. Please try again.",
          code: "PROVIDER_ERROR",
        });
      }

      const userId = req.user?.claims?.sub ?? null;
      await storage.createUpsellAiAnalysis({
        provider,
        model: generated.model,
        scope,
        insights: generated.insights,
        statsSnapshot: stats,
        generatedBy: userId,
      });

      const saved = await storage.getLatestUpsellAiAnalysis(scope);
      res.json({ analysis: saved, configuredProviders: await configuredProviders() });
    } catch (error) {
      console.error("Error running upsell AI analysis:", error);
      res.status(500).json({ message: "Failed to run analysis" });
    }
  });

  app.get("/api/upsells/:id", isAuthenticated, async (req: any, res) => {
    try {
      const upsell = await storage.getUpsellWithDetails(req.params.id);
      if (!upsell) {
        return res.status(404).json({ message: "Upsell not found" });
      }
      res.json(upsell);
    } catch (error) {
      console.error("Error fetching upsell:", error);
      res.status(500).json({ message: "Failed to fetch upsell" });
    }
  });

  app.post("/api/upsells", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const data = { ...req.body, createdBy: userId };
      
      const parsed = insertUpsellSchema.safeParse(data);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid upsell data", errors: parsed.error.errors });
      }

      const upsell = await storage.createUpsell(parsed.data);
      await logActivityInternal(userId, "create", "upsell", upsell.id, `Created upsell: ${upsell.title}`, req);
      res.status(201).json(upsell);
    } catch (error) {
      console.error("Error creating upsell:", error);
      res.status(500).json({ message: "Failed to create upsell" });
    }
  });

  app.patch("/api/upsells/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      
      const parsed = updateUpsellSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid upsell data", errors: parsed.error.errors });
      }

      const upsell = await storage.updateUpsell(req.params.id, parsed.data);
      if (!upsell) {
        return res.status(404).json({ message: "Upsell not found" });
      }
      
      await logActivityInternal(userId, "update", "upsell", upsell.id, `Updated upsell: ${upsell.title}`, req);
      res.json(upsell);
    } catch (error) {
      console.error("Error updating upsell:", error);
      res.status(500).json({ message: "Failed to update upsell" });
    }
  });

  app.delete("/api/upsells/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const upsell = await storage.getUpsell(req.params.id);
      if (!upsell) {
        return res.status(404).json({ message: "Upsell not found" });
      }

      const deleted = await storage.deleteUpsell(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Upsell not found" });
      }
      
      await logActivityInternal(userId, "delete", "upsell", req.params.id, `Deleted upsell: ${upsell.title}`, req);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting upsell:", error);
      res.status(500).json({ message: "Failed to delete upsell" });
    }
  });

  // Convert upsell to payment
  app.post("/api/upsells/:id/convert", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const upsellId = req.params.id;
      const { receivedAmount, receivedDate, month, year } = req.body;

      const upsell = await storage.getUpsellWithDetails(upsellId);
      if (!upsell) {
        return res.status(404).json({ message: "Upsell not found" });
      }

      if (upsell.status === "converted") {
        return res.status(400).json({ message: "Upsell has already been converted" });
      }

      // Get project to use its totalCost for the payment's totalAmount
      const project = await storage.getProject(upsell.projectId);
      const projectTotalCost = project?.totalCost || upsell.amount;

      // Create payment from upsell
      const paymentData = {
        projectId: upsell.projectId,
        expectedAmount: upsell.amount,
        totalAmount: projectTotalCost,
        receivedAmount: receivedAmount || upsell.amount,
        paymentType: "upsell" as const,
        status: "received" as const,
        narration: `Converted from upsell: ${upsell.title}`,
        invoiceDate: null,
        dueDate: null,
        receivedDate: receivedDate ? new Date(receivedDate) : new Date(),
        month: month || new Date().getMonth() + 1,
        year: year || new Date().getFullYear(),
        isTarget: false,
      };

      const payment = await storage.createPayment(paymentData);
      // Fail-soft: auto-save a receipt PDF to Drive (upsell conversion = payment received).
      void uploadReceiptPdfToDrive(payment.id);

      // Mark upsell as converted
      await storage.convertUpsell(upsellId, payment.id);

      await logActivityInternal(userId, "update", "upsell", upsellId, `Converted upsell "${upsell.title}" to payment`, req);
      await logActivityInternal(userId, "create", "payment", payment.id, `Created payment from upsell: ${upsell.title}`, req);

      res.json({ success: true, payment, upsell: await storage.getUpsell(upsellId) });
    } catch (error) {
      console.error("Error converting upsell:", error);
      res.status(500).json({ message: "Failed to convert upsell to payment" });
    }
  });

  // Upsell activities routes
  app.get("/api/upsells/:id/activities", isAuthenticated, async (req: any, res) => {
    try {
      const activities = await storage.getUpsellActivities(req.params.id);
      res.json(activities);
    } catch (error) {
      console.error("Error fetching upsell activities:", error);
      res.status(500).json({ message: "Failed to fetch upsell activities" });
    }
  });

  app.post("/api/upsells/:id/activities", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const data = {
        ...req.body,
        upsellId: req.params.id,
        createdBy: userId,
      };

      const parsed = insertUpsellActivitySchema.safeParse(data);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid activity data", errors: parsed.error.errors });
      }

      const activity = await storage.createUpsellActivity(parsed.data);
      
      // Send email notification to PM
      try {
        const upsell = await storage.getUpsellWithDetails(req.params.id);
        if (upsell?.project?.pmId) {
          const pm = await storage.getUser(upsell.project.pmId);
          const creator = userId ? await storage.getUser(userId) : null;
          
          if (pm?.email) {
            // Escape HTML to prevent injection
            const escapeHtml = (str: string) => str
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;');
            
            const activityTypeName = escapeHtml((req.body.activityType || 'activity').replace(/_/g, ' '));
            const creatorName = creator ? escapeHtml(`${creator.firstName} ${creator.lastName}`) : 'A team member';
            const upsellTitle = escapeHtml(upsell.title || '');
            const projectName = escapeHtml(upsell.project.name || '');
            const pmFirstName = escapeHtml(pm.firstName || '');
            const activityDate = escapeHtml(req.body.activityDate || 'Not specified');
            const description = req.body.description ? escapeHtml(req.body.description) : '';
            
            await sendEmail({
              to: pm.email,
              subject: `New Upsell Activity: ${upsellTitle}`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #C22828;">New Activity on Upsell Opportunity</h2>
                  <p>Hello ${pmFirstName},</p>
                  <p>${creatorName} has added a new ${activityTypeName} to the upsell opportunity "<strong>${upsellTitle}</strong>" for project <strong>${projectName}</strong>.</p>
                  <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p><strong>Activity Type:</strong> ${activityTypeName}</p>
                    <p><strong>Date:</strong> ${activityDate}</p>
                    ${description ? `<p><strong>Description:</strong> ${description}</p>` : ''}
                  </div>
                  <p style="color: #666; font-size: 12px;">This is an automated notification from RevolRMO.</p>
                </div>
              `,
            });
          }
        }
      } catch (emailError) {
        console.error("Error sending upsell activity email notification:", emailError);
        // Don't fail the activity creation if email fails
      }
      
      res.status(201).json(activity);
    } catch (error) {
      console.error("Error creating upsell activity:", error);
      res.status(500).json({ message: "Failed to create upsell activity" });
    }
  });

  app.delete("/api/upsell-activities/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const deleted = await storage.deleteUpsellActivity(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Activity not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting upsell activity:", error);
      res.status(500).json({ message: "Failed to delete upsell activity" });
    }
  });

  // ========== DATA IMPORT ROUTES ==========
  
  // Get projects with milestones for import reference/template
  app.get("/api/import/reference-data", isAuthenticated, requirePermission("import_data"), async (req: any, res) => {
    try {
      const projectsWithMilestones = await storage.getProjectsWithMilestonesForImport();
      res.json(projectsWithMilestones);
    } catch (error) {
      console.error("Error fetching import reference data:", error);
      res.status(500).json({ message: "Failed to fetch reference data" });
    }
  });

  // Get import history
  app.get("/api/import/history", isAuthenticated, requirePermission("import_data"), async (req: any, res) => {
    try {
      const imports = await storage.getDataImports();
      res.json(imports);
    } catch (error) {
      console.error("Error fetching import history:", error);
      res.status(500).json({ message: "Failed to fetch import history" });
    }
  });

  // Process import data (preview and confirm)
  app.post("/api/import/process", isAuthenticated, requirePermission("import_data"), async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const { rows, month, year, fileName, confirm } = req.body;

      if (!rows || !Array.isArray(rows) || !month || !year) {
        return res.status(400).json({ message: "Invalid import data" });
      }

      // Get all projects and milestones for matching
      const projectsData = await storage.getProjectsWithMilestonesForImport();
      const projectMap = new Map<string, typeof projectsData[0]>();
      
      // Build lookup maps by project name (case-insensitive)
      for (const proj of projectsData) {
        projectMap.set(proj.name.toLowerCase().trim(), proj);
        // Also map by client name for easier matching
        if (proj.clientName) {
          projectMap.set(proj.clientName.toLowerCase().trim(), proj);
        }
      }

      // Process each row and match to projects/milestones
      const processedRows: Array<{
        rowIndex: number;
        projectName: string;
        clientName: string;
        phaseMilestone: string;
        expectedAmount: string;
        receivedAmount: string;
        status: string;
        paymentType: "recurring" | "upsell";
        isTarget: boolean;
        receivedDate: string | null;
        invoiceDate: string | null;
        notes: string;
        matched: boolean;
        projectId: string | null;
        milestoneId: string | null;
        paymentId: string | null;
        matchedProjectName: string | null;
        matchedMilestoneName: string | null;
        errors: string[];
      }> = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const paymentTypeRaw = (row.paymentType || "recurring").toString().toLowerCase();
        const isTargetValue = row.isTarget === false || row.isTarget === "false" || row.isTarget === "no" || row.isTarget === "No" ? false : true;
        const processed: typeof processedRows[0] = {
          rowIndex: i,
          projectName: row.projectName || "",
          clientName: row.clientName || "",
          phaseMilestone: row.phaseMilestone || row.phase || row.milestone || "",
          expectedAmount: row.expectedAmount || row.expected || "0",
          receivedAmount: row.receivedAmount || row.received || "0",
          status: row.status || "Unpaid",
          paymentType: paymentTypeRaw === "upsell" ? "upsell" : "recurring",
          isTarget: isTargetValue,
          receivedDate: row.receivedDate || null,
          invoiceDate: row.invoiceDate || null,
          notes: row.notes || row.narration || "",
          matched: false,
          projectId: row.projectId || null,
          milestoneId: row.milestoneId || null,
          paymentId: null,
          matchedProjectName: null,
          matchedMilestoneName: null,
          errors: [],
        };

        // Try to match project (skip if already provided from frontend edits)
        if (processed.projectId) {
          // Already matched from frontend, find project for milestone lookup
          const existingProject = projectsData.find((p: typeof projectsData[0]) => p.id === processed.projectId);
          if (existingProject) {
            processed.matchedProjectName = existingProject.name;
            processed.matched = true;
            // If milestoneId is already set, find milestone name
            if (processed.milestoneId && existingProject.milestones) {
              const existingMilestone = existingProject.milestones.find((m: typeof existingProject.milestones[0]) => m.id === processed.milestoneId);
              if (existingMilestone) {
                processed.matchedMilestoneName = existingMilestone.name;
              }
            }
          }
        } else {
          const projectKey = (processed.projectName || processed.clientName).toLowerCase().trim();
          const matchedProject = projectMap.get(projectKey);

          if (matchedProject) {
            processed.projectId = matchedProject.id;
            processed.matchedProjectName = matchedProject.name;
            processed.matched = true;

            // Try to match milestone
            if (processed.phaseMilestone && matchedProject.milestones) {
              const milestoneKey = processed.phaseMilestone.toLowerCase().trim();
              const matchedMilestone = matchedProject.milestones.find(
                m => m.name.toLowerCase().trim() === milestoneKey ||
                     m.name.toLowerCase().includes(milestoneKey) ||
                     milestoneKey.includes(m.name.toLowerCase())
              );
              if (matchedMilestone) {
                processed.milestoneId = matchedMilestone.id;
                processed.matchedMilestoneName = matchedMilestone.name;
              }
            }
          } else {
            processed.errors.push("Project not found in system");
          }
        }

        // Validate amounts
        const expectedNum = parseFloat(processed.expectedAmount.replace(/[^0-9.-]/g, ""));
        const receivedNum = parseFloat(processed.receivedAmount.replace(/[^0-9.-]/g, ""));
        if (isNaN(expectedNum)) {
          processed.errors.push("Invalid expected amount");
        }
        if (isNaN(receivedNum)) {
          processed.errors.push("Invalid received amount");
        }

        processedRows.push(processed);
      }

      // If confirm is true, actually save the data
      if (confirm === true) {
        // Map status strings to payment statuses
        const statusMap: Record<string, "not_targeting" | "pending_invoice" | "invoiced" | "received"> = {
          "paid": "received",
          "received": "received",
          "invoiced": "invoiced",
          "pending": "pending_invoice",
          "pending_invoice": "pending_invoice",
          "unpaid": "pending_invoice",
          "not_targeting": "not_targeting",
        };

        // Auto-create milestones for recurring payments that don't have a milestone match
        // Upsells are standalone and don't need milestones
        // Track newly created milestones per project to avoid duplicates and assign correct sequence numbers
        const createdMilestonesMap = new Map<string, Map<string, { id: string; name: string }>>();
        const projectMilestoneCounts = new Map<string, number>();
        
        for (const row of processedRows) {
          if (
            row.projectId &&
            row.errors.length === 0 &&
            !row.milestoneId &&
            row.paymentType === "recurring" &&
            row.phaseMilestone.trim() !== ""
          ) {
            try {
              const milestoneName = row.phaseMilestone.trim().toLowerCase();
              
              // Check if we already created this milestone in this import batch
              const projectCreatedMilestones = createdMilestonesMap.get(row.projectId);
              if (projectCreatedMilestones?.has(milestoneName)) {
                // Reuse the previously created milestone
                const existingCreated = projectCreatedMilestones.get(milestoneName)!;
                row.milestoneId = existingCreated.id;
                row.matchedMilestoneName = existingCreated.name;
                continue;
              }
              
              // Get existing milestones count (including ones we've created this session)
              if (!projectMilestoneCounts.has(row.projectId)) {
                const project = projectsData.find(p => p.id === row.projectId);
                projectMilestoneCounts.set(row.projectId, project?.milestones?.length || 0);
              }
              const currentCount = projectMilestoneCounts.get(row.projectId)!;
              
              // Create a new milestone for this recurring payment
              const newMilestone = await storage.createMilestone({
                projectId: row.projectId,
                name: row.phaseMilestone.trim(),
                sequenceNumber: currentCount + 1,
                billingMonth: parseInt(String(month)),
                billingYear: parseInt(String(year)),
                expectedAmount: row.expectedAmount.replace(/[^0-9.-]/g, "") || "0",
                probability: 100, // Default probability for imported milestones
                status: "planned",
              });
              
              // Track this newly created milestone
              if (!createdMilestonesMap.has(row.projectId)) {
                createdMilestonesMap.set(row.projectId, new Map());
              }
              createdMilestonesMap.get(row.projectId)!.set(milestoneName, { id: newMilestone.id, name: newMilestone.name });
              projectMilestoneCounts.set(row.projectId, currentCount + 1);
              
              // Bind the payment to the newly created milestone
              row.milestoneId = newMilestone.id;
              row.matchedMilestoneName = newMilestone.name;
            } catch (error) {
              console.error(`Error creating milestone for row ${row.rowIndex}:`, error);
              row.errors.push("Failed to auto-create milestone");
            }
          }
        }

        const updates = processedRows
          .filter(r => r.projectId && r.errors.length === 0)
          .map(r => ({
            paymentId: r.paymentId || undefined,
            milestoneId: r.milestoneId || undefined,
            projectId: r.projectId!,
            month: parseInt(String(month)),
            year: parseInt(String(year)),
            expectedAmount: r.expectedAmount.replace(/[^0-9.-]/g, ""),
            receivedAmount: r.receivedAmount.replace(/[^0-9.-]/g, ""),
            status: statusMap[r.status.toLowerCase()] || "pending_invoice",
            paymentType: r.paymentType,
            isTarget: r.isTarget,
            receivedDate: r.receivedDate ? new Date(r.receivedDate) : null,
            invoiceDate: r.invoiceDate ? new Date(r.invoiceDate) : null,
            narration: r.notes || r.phaseMilestone,
          }));

        const result = await storage.batchUpdatePaymentsFromImport(updates);

        // Create import audit record
        await storage.createDataImport({
          fileName: fileName || "import.csv",
          month: parseInt(String(month)),
          year: parseInt(String(year)),
          totalRows: rows.length,
          successRows: result.created + result.updated,
          failedRows: result.errors.length,
          status: "completed",
          uploadedBy: userId,
        });

        await logActivityInternal(userId, "create", "payment", "batch", `Imported ${result.created + result.updated} payment records for ${month}/${year}`, req);

        // Generate undo token and store for rollback (30 second window)
        let undoToken: string | undefined;
        const allCreatedMilestoneIds: string[] = [];
        for (const [_, projectMilestones] of createdMilestonesMap) {
          for (const [_, milestone] of projectMilestones) {
            allCreatedMilestoneIds.push(milestone.id);
          }
        }
        
        if (result.createdPaymentIds.length > 0 || allCreatedMilestoneIds.length > 0) {
          undoToken = `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          importUndoRegistry.set(undoToken, {
            createdPaymentIds: result.createdPaymentIds,
            createdMilestoneIds: allCreatedMilestoneIds,
            expiresAt: Date.now() + 30000, // 30 seconds
          });
        }

        return res.json({
          success: true,
          created: result.created,
          updated: result.updated,
          errors: result.errors,
          processedRows,
          undoToken,
        });
      }

      // Return preview data
      res.json({
        success: true,
        preview: true,
        processedRows,
        summary: {
          total: processedRows.length,
          matched: processedRows.filter(r => r.matched).length,
          unmatched: processedRows.filter(r => !r.matched).length,
          withErrors: processedRows.filter(r => r.errors.length > 0).length,
        },
      });
    } catch (error) {
      console.error("Error processing import:", error);
      res.status(500).json({ message: "Failed to process import" });
    }
  });

  // Undo import (within 30 second window)
  app.post("/api/import/undo", isAuthenticated, requirePermission("import_data"), async (req: any, res) => {
    try {
      const { token } = req.body;
      
      if (!token || typeof token !== "string") {
        return res.status(400).json({ message: "Invalid undo token" });
      }

      const undoEntry = importUndoRegistry.get(token);
      if (!undoEntry) {
        return res.status(404).json({ message: "Undo window expired or invalid token" });
      }

      if (undoEntry.expiresAt < Date.now()) {
        importUndoRegistry.delete(token);
        return res.status(410).json({ message: "Undo window has expired" });
      }

      let deletedPayments = 0;
      let deletedMilestones = 0;

      // Delete created payments
      for (const paymentId of undoEntry.createdPaymentIds) {
        try {
          await storage.deletePayment(paymentId);
          deletedPayments++;
        } catch (error) {
          console.error(`Failed to delete payment ${paymentId}:`, error);
        }
      }

      // Delete created milestones
      for (const milestoneId of undoEntry.createdMilestoneIds) {
        try {
          await storage.deleteMilestone(milestoneId);
          deletedMilestones++;
        } catch (error) {
          console.error(`Failed to delete milestone ${milestoneId}:`, error);
        }
      }

      // Remove from registry
      importUndoRegistry.delete(token);

      const userId = req.user?.claims?.sub;
      await logActivityInternal(userId, "delete", "payment", "batch", `Undid import: deleted ${deletedPayments} payments and ${deletedMilestones} milestones`, req);

      res.json({
        success: true,
        deleted: deletedPayments,
        deletedMilestones,
        message: `Successfully undid import: removed ${deletedPayments} payments and ${deletedMilestones} milestones`,
      });
    } catch (error) {
      console.error("Error undoing import:", error);
      res.status(500).json({ message: "Failed to undo import" });
    }
  });

  // ============================================================================
  // COST & MARGIN MODULE ROUTES
  // ============================================================================

  // Timesheet Routes
  app.get("/api/timesheets", isAuthenticated, requirePermission("view_timesheets"), async (req: any, res) => {
    try {
      const { month, year, projectId, userId, status } = req.query;
      const timesheets = await storage.getAllTimesheets({
        month: month ? parseInt(month) : undefined,
        year: year ? parseInt(year) : undefined,
        projectId: projectId as string | undefined,
        userId: userId as string | undefined,
        status: status as TimesheetStatus | undefined,
      });
      res.json(timesheets);
    } catch (error) {
      console.error("Error fetching timesheets:", error);
      res.status(500).json({ message: "Failed to fetch timesheets" });
    }
  });

  // Timesheets CSV Template Download - MUST be before :id route
  app.get("/api/timesheets/csv-template", isAuthenticated, requirePermission("view_timesheets"), async (req: any, res) => {
    try {
      const csvContent = "project_name,date,hours_logged,description\nProject Alpha,2025-01-15,8,Development work\nProject Beta,2025-01-16,6.5,Code review and testing";
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=timesheets_template.csv");
      res.send(csvContent);
    } catch (error) {
      console.error("Error generating timesheets CSV template:", error);
      res.status(500).json({ message: "Failed to generate template" });
    }
  });

  app.get("/api/timesheets/:id", isAuthenticated, requirePermission("view_timesheets"), async (req: any, res) => {
    try {
      const timesheet = await storage.getTimesheetWithDetails(req.params.id);
      if (!timesheet) {
        return res.status(404).json({ message: "Timesheet not found" });
      }
      res.json(timesheet);
    } catch (error) {
      console.error("Error fetching timesheet:", error);
      res.status(500).json({ message: "Failed to fetch timesheet" });
    }
  });

  app.get("/api/projects/:projectId/timesheets", isAuthenticated, requirePermission("view_timesheets"), async (req: any, res) => {
    try {
      const { month, year, userId, status } = req.query;
      const timesheets = await storage.getProjectTimesheets(req.params.projectId, {
        month: month ? parseInt(month) : undefined,
        year: year ? parseInt(year) : undefined,
        userId: userId as string | undefined,
        status: status as TimesheetStatus | undefined,
      });
      res.json(timesheets);
    } catch (error) {
      console.error("Error fetching project timesheets:", error);
      res.status(500).json({ message: "Failed to fetch project timesheets" });
    }
  });

  app.get("/api/users/:userId/timesheets", isAuthenticated, requirePermission("view_timesheets"), async (req: any, res) => {
    try {
      const { month, year, projectId } = req.query;
      const timesheets = await storage.getUserTimesheets(req.params.userId, {
        month: month ? parseInt(month) : undefined,
        year: year ? parseInt(year) : undefined,
        projectId: projectId as string | undefined,
      });
      res.json(timesheets);
    } catch (error) {
      console.error("Error fetching user timesheets:", error);
      res.status(500).json({ message: "Failed to fetch user timesheets" });
    }
  });

  app.post("/api/timesheets", isAuthenticated, requirePermission("create_timesheets"), async (req: any, res) => {
    try {
      const parsed = insertTimesheetSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
      }
      
      // Security: Force userId to be the authenticated session user - ignore client-provided userId
      const sessionUserId = req.user?.claims?.sub;
      if (!sessionUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      // Server-side rate enforcement: Compute rate from authenticated user's resource
      let enforcedhourlyRate = parsed.data.hourlyCostRate;
      const userResource = await storage.getResourceByUserId(sessionUserId);
      if (userResource) {
        const effectiveRate = await storage.getEffectiveHourlyRateForResource(userResource.id);
        if (effectiveRate && effectiveRate !== "0.00") {
          enforcedhourlyRate = effectiveRate;
        }
      }
      
      const timesheetData = {
        ...parsed.data,
        userId: sessionUserId, // Force to authenticated user
        hourlyCostRate: enforcedhourlyRate,
      };
      
      const timesheet = await storage.createTimesheet(timesheetData);
      await logActivityInternal(sessionUserId, "create", "timesheet" as any, timesheet.id, `Created timesheet entry`, req);
      res.status(201).json(timesheet);
    } catch (error) {
      console.error("Error creating timesheet:", error);
      res.status(500).json({ message: "Failed to create timesheet" });
    }
  });

  app.patch("/api/timesheets/:id", isAuthenticated, requirePermission("create_timesheets"), async (req: any, res) => {
    try {
      const parsed = updateTimesheetSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
      }
      
      const sessionUserId = req.user?.claims?.sub;
      if (!sessionUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      // Security: Verify the timesheet belongs to the authenticated user (or user is admin)
      const existingTimesheet = await storage.getTimesheet(req.params.id);
      if (!existingTimesheet) {
        return res.status(404).json({ message: "Timesheet not found" });
      }
      
      const sessionUser = await storage.getUser(sessionUserId);
      const isAdmin = sessionUser?.isAdmin ?? false;
      
      if (existingTimesheet.userId !== sessionUserId && !isAdmin) {
        return res.status(403).json({ message: "Not authorized to update this timesheet" });
      }
      
      // Server-side rate enforcement: Recalculate rate using timesheet owner's resource
      let updateData = { ...parsed.data };
      
      if (parsed.data.hourlyCostRate !== undefined) {
        const userResource = await storage.getResourceByUserId(existingTimesheet.userId);
        if (userResource) {
          const effectiveRate = await storage.getEffectiveHourlyRateForResource(userResource.id);
          if (effectiveRate && effectiveRate !== "0.00") {
            updateData.hourlyCostRate = effectiveRate;
          }
        }
      }
      
      // Prevent changing the userId
      delete updateData.userId;
      
      const timesheet = await storage.updateTimesheet(req.params.id, updateData);
      if (!timesheet) {
        return res.status(404).json({ message: "Timesheet not found" });
      }
      await logActivityInternal(sessionUserId, "update", "timesheet" as any, timesheet.id, `Updated timesheet entry`, req);
      res.json(timesheet);
    } catch (error) {
      console.error("Error updating timesheet:", error);
      res.status(500).json({ message: "Failed to update timesheet" });
    }
  });

  app.delete("/api/timesheets/:id", isAuthenticated, requirePermission("delete_timesheets"), async (req: any, res) => {
    try {
      const deleted = await storage.deleteTimesheet(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Timesheet not found" });
      }
      await logActivityInternal(req.user?.claims?.sub, "delete", "timesheet" as any, req.params.id, `Deleted timesheet entry`, req);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting timesheet:", error);
      res.status(500).json({ message: "Failed to delete timesheet" });
    }
  });

  app.post("/api/timesheets/:id/approve", isAuthenticated, requirePermission("create_timesheets"), async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const timesheet = await storage.approveTimesheet(req.params.id, userId);
      if (!timesheet) {
        return res.status(404).json({ message: "Timesheet not found" });
      }
      await logActivityInternal(userId, "update", "timesheet" as any, timesheet.id, `Approved timesheet`, req);
      
      // Send timesheet approval notification to PM (async, don't block response)
      if (timesheet.projectId) {
        (async () => {
          try {
            const project = await storage.getProject(timesheet.projectId!);
            if (project?.pmId) {
              const pm = await storage.getUser(project.pmId);
              if (pm) {
                // Get resource name if available
                let resource = null;
                if (timesheet.userId) {
                  const resourceData = await storage.getResourceByUserId(timesheet.userId);
                  resource = resourceData;
                }
                await sendTimesheetApprovalNotification({
                  timesheet: {
                    id: timesheet.id,
                    date: timesheet.date,
                    hoursLogged: timesheet.hoursLogged,
                    description: timesheet.description,
                  },
                  project,
                  pm,
                  resource,
                });
              }
            }
          } catch (emailError) {
            console.error("Error sending timesheet approval notification:", emailError);
          }
          
          // Check and notify bucket status change for this project only
          await checkAndNotifyBucketStatus(timesheet.projectId!);
        })();
      }
      
      res.json(timesheet);
    } catch (error) {
      console.error("Error approving timesheet:", error);
      res.status(500).json({ message: "Failed to approve timesheet" });
    }
  });

  app.post("/api/timesheets/:id/reject", isAuthenticated, requirePermission("create_timesheets"), async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const timesheet = await storage.rejectTimesheet(req.params.id, userId);
      if (!timesheet) {
        return res.status(404).json({ message: "Timesheet not found" });
      }
      await logActivityInternal(userId, "update", "timesheet" as any, timesheet.id, `Rejected timesheet`, req);
      res.json(timesheet);
    } catch (error) {
      console.error("Error rejecting timesheet:", error);
      res.status(500).json({ message: "Failed to reject timesheet" });
    }
  });

  // Estimated Costs Routes
  app.get("/api/estimated-costs", isAuthenticated, requirePermission("view_cost_margin"), async (req: any, res) => {
    try {
      const { projectId, month, year } = req.query;
      const costs = await storage.getAllProjectEstimatedCosts({
        projectId: projectId as string | undefined,
        month: month ? parseInt(month) : undefined,
        year: year ? parseInt(year) : undefined,
      });
      res.json(costs);
    } catch (error) {
      console.error("Error fetching estimated costs:", error);
      res.status(500).json({ message: "Failed to fetch estimated costs" });
    }
  });

  app.get("/api/estimated-costs/:id", isAuthenticated, requirePermission("view_cost_margin"), async (req: any, res) => {
    try {
      const cost = await storage.getProjectEstimatedCost(req.params.id);
      if (!cost) {
        return res.status(404).json({ message: "Estimated cost not found" });
      }
      res.json(cost);
    } catch (error) {
      console.error("Error fetching estimated cost:", error);
      res.status(500).json({ message: "Failed to fetch estimated cost" });
    }
  });

  app.post("/api/estimated-costs", isAuthenticated, requirePermission("view_cost_margin"), async (req: any, res) => {
    try {
      const parsed = insertProjectEstimatedCostSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
      }
      const cost = await storage.createProjectEstimatedCost(parsed.data);
      await logActivityInternal(req.user?.claims?.sub, "create", "project" as any, cost.projectId, `Created estimated cost for ${parsed.data.month}/${parsed.data.year}`, req);
      res.status(201).json(cost);
    } catch (error) {
      console.error("Error creating estimated cost:", error);
      res.status(500).json({ message: "Failed to create estimated cost" });
    }
  });

  app.patch("/api/estimated-costs/:id", isAuthenticated, requirePermission("view_cost_margin"), async (req: any, res) => {
    try {
      const parsed = updateProjectEstimatedCostSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
      }
      const cost = await storage.updateProjectEstimatedCost(req.params.id, parsed.data);
      if (!cost) {
        return res.status(404).json({ message: "Estimated cost not found" });
      }
      await logActivityInternal(req.user?.claims?.sub, "update", "project" as any, cost.projectId, `Updated estimated cost`, req);
      res.json(cost);
    } catch (error) {
      console.error("Error updating estimated cost:", error);
      res.status(500).json({ message: "Failed to update estimated cost" });
    }
  });

  app.delete("/api/estimated-costs/:id", isAuthenticated, requirePermission("view_cost_margin"), async (req: any, res) => {
    try {
      const deleted = await storage.deleteProjectEstimatedCost(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Estimated cost not found" });
      }
      await logActivityInternal(req.user?.claims?.sub, "delete", "project" as any, req.params.id, `Deleted estimated cost`, req);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting estimated cost:", error);
      res.status(500).json({ message: "Failed to delete estimated cost" });
    }
  });

  // Actual Costs Routes
  app.get("/api/actual-costs", isAuthenticated, requirePermission("view_cost_margin"), async (req: any, res) => {
    try {
      const { projectId, month, year } = req.query;
      const costs = await storage.getAllProjectActualCosts({
        projectId: projectId as string | undefined,
        month: month ? parseInt(month) : undefined,
        year: year ? parseInt(year) : undefined,
      });
      res.json(costs);
    } catch (error) {
      console.error("Error fetching actual costs:", error);
      res.status(500).json({ message: "Failed to fetch actual costs" });
    }
  });

  app.get("/api/actual-costs/:id", isAuthenticated, requirePermission("view_cost_margin"), async (req: any, res) => {
    try {
      const cost = await storage.getProjectActualCost(req.params.id);
      if (!cost) {
        return res.status(404).json({ message: "Actual cost not found" });
      }
      res.json(cost);
    } catch (error) {
      console.error("Error fetching actual cost:", error);
      res.status(500).json({ message: "Failed to fetch actual cost" });
    }
  });

  app.post("/api/actual-costs", isAuthenticated, requirePermission("view_cost_margin"), async (req: any, res) => {
    try {
      const parsed = insertProjectActualCostSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
      }
      const cost = await storage.createProjectActualCost(parsed.data);
      await logActivityInternal(req.user?.claims?.sub, "create", "project" as any, cost.projectId, `Created actual cost for ${parsed.data.month}/${parsed.data.year}`, req);
      res.status(201).json(cost);
    } catch (error) {
      console.error("Error creating actual cost:", error);
      res.status(500).json({ message: "Failed to create actual cost" });
    }
  });

  app.patch("/api/actual-costs/:id", isAuthenticated, requirePermission("view_cost_margin"), async (req: any, res) => {
    try {
      const parsed = updateProjectActualCostSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
      }
      const cost = await storage.updateProjectActualCost(req.params.id, parsed.data);
      if (!cost) {
        return res.status(404).json({ message: "Actual cost not found" });
      }
      await logActivityInternal(req.user?.claims?.sub, "update", "project" as any, cost.projectId, `Updated actual cost`, req);
      res.json(cost);
    } catch (error) {
      console.error("Error updating actual cost:", error);
      res.status(500).json({ message: "Failed to update actual cost" });
    }
  });

  app.delete("/api/actual-costs/:id", isAuthenticated, requirePermission("view_cost_margin"), async (req: any, res) => {
    try {
      const deleted = await storage.deleteProjectActualCost(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Actual cost not found" });
      }
      await logActivityInternal(req.user?.claims?.sub, "delete", "project" as any, req.params.id, `Deleted actual cost`, req);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting actual cost:", error);
      res.status(500).json({ message: "Failed to delete actual cost" });
    }
  });

  // Vendor Costs Routes
  app.get("/api/vendor-costs", isAuthenticated, requirePermission("view_cost_margin"), async (req: any, res) => {
    try {
      const { projectId, month, year } = req.query;
      const costs = await storage.getAllVendorCosts({
        projectId: projectId as string | undefined,
        month: month ? parseInt(month) : undefined,
        year: year ? parseInt(year) : undefined,
      });
      res.json(costs);
    } catch (error) {
      console.error("Error fetching vendor costs:", error);
      res.status(500).json({ message: "Failed to fetch vendor costs" });
    }
  });

  app.get("/api/vendor-costs/:id", isAuthenticated, requirePermission("view_cost_margin"), async (req: any, res) => {
    try {
      const cost = await storage.getVendorCost(req.params.id);
      if (!cost) {
        return res.status(404).json({ message: "Vendor cost not found" });
      }
      res.json(cost);
    } catch (error) {
      console.error("Error fetching vendor cost:", error);
      res.status(500).json({ message: "Failed to fetch vendor cost" });
    }
  });

  app.post("/api/vendor-costs", isAuthenticated, requirePermission("view_cost_margin"), async (req: any, res) => {
    try {
      const parsed = insertVendorCostSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
      }
      const cost = await storage.createVendorCost(parsed.data);
      await logActivityInternal(req.user?.claims?.sub, "create", "project" as any, cost.projectId, `Created vendor cost: ${parsed.data.vendorName}`, req);
      res.status(201).json(cost);
    } catch (error) {
      console.error("Error creating vendor cost:", error);
      res.status(500).json({ message: "Failed to create vendor cost" });
    }
  });

  app.patch("/api/vendor-costs/:id", isAuthenticated, requirePermission("view_cost_margin"), async (req: any, res) => {
    try {
      const parsed = updateVendorCostSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
      }
      const cost = await storage.updateVendorCost(req.params.id, parsed.data);
      if (!cost) {
        return res.status(404).json({ message: "Vendor cost not found" });
      }
      await logActivityInternal(req.user?.claims?.sub, "update", "project" as any, cost.projectId, `Updated vendor cost`, req);
      res.json(cost);
    } catch (error) {
      console.error("Error updating vendor cost:", error);
      res.status(500).json({ message: "Failed to update vendor cost" });
    }
  });

  app.delete("/api/vendor-costs/:id", isAuthenticated, requirePermission("view_cost_margin"), async (req: any, res) => {
    try {
      const deleted = await storage.deleteVendorCost(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Vendor cost not found" });
      }
      await logActivityInternal(req.user?.claims?.sub, "delete", "project" as any, req.params.id, `Deleted vendor cost`, req);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting vendor cost:", error);
      res.status(500).json({ message: "Failed to delete vendor cost" });
    }
  });

  // Tool Costs Routes
  app.get("/api/tool-costs", isAuthenticated, requirePermission("view_cost_margin"), async (req: any, res) => {
    try {
      const { projectId, month, year } = req.query;
      const costs = await storage.getAllToolCosts({
        projectId: projectId as string | undefined,
        month: month ? parseInt(month) : undefined,
        year: year ? parseInt(year) : undefined,
      });
      res.json(costs);
    } catch (error) {
      console.error("Error fetching tool costs:", error);
      res.status(500).json({ message: "Failed to fetch tool costs" });
    }
  });

  app.get("/api/tool-costs/:id", isAuthenticated, requirePermission("view_cost_margin"), async (req: any, res) => {
    try {
      const cost = await storage.getToolCost(req.params.id);
      if (!cost) {
        return res.status(404).json({ message: "Tool cost not found" });
      }
      res.json(cost);
    } catch (error) {
      console.error("Error fetching tool cost:", error);
      res.status(500).json({ message: "Failed to fetch tool cost" });
    }
  });

  app.post("/api/tool-costs", isAuthenticated, requirePermission("view_cost_margin"), async (req: any, res) => {
    try {
      const parsed = insertToolCostSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
      }
      const cost = await storage.createToolCost(parsed.data);
      await logActivityInternal(req.user?.claims?.sub, "create", "project" as any, cost.projectId, `Created tool cost: ${parsed.data.toolName}`, req);
      res.status(201).json(cost);
    } catch (error) {
      console.error("Error creating tool cost:", error);
      res.status(500).json({ message: "Failed to create tool cost" });
    }
  });

  app.patch("/api/tool-costs/:id", isAuthenticated, requirePermission("view_cost_margin"), async (req: any, res) => {
    try {
      const parsed = updateToolCostSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
      }
      const cost = await storage.updateToolCost(req.params.id, parsed.data);
      if (!cost) {
        return res.status(404).json({ message: "Tool cost not found" });
      }
      await logActivityInternal(req.user?.claims?.sub, "update", "project" as any, cost.projectId, `Updated tool cost`, req);
      res.json(cost);
    } catch (error) {
      console.error("Error updating tool cost:", error);
      res.status(500).json({ message: "Failed to update tool cost" });
    }
  });

  app.delete("/api/tool-costs/:id", isAuthenticated, requirePermission("view_cost_margin"), async (req: any, res) => {
    try {
      const deleted = await storage.deleteToolCost(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Tool cost not found" });
      }
      await logActivityInternal(req.user?.claims?.sub, "delete", "project" as any, req.params.id, `Deleted tool cost`, req);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting tool cost:", error);
      res.status(500).json({ message: "Failed to delete tool cost" });
    }
  });

  // Margin Settings Routes
  app.get("/api/margin-settings", isAuthenticated, requirePermission("view_cost_margin"), async (req: any, res) => {
    try {
      const settings = await storage.getMarginSettings();
      res.json(settings || {
        profitThreshold: "20",
        breakevenThreshold: "0",
      });
    } catch (error) {
      console.error("Error fetching margin settings:", error);
      res.status(500).json({ message: "Failed to fetch margin settings" });
    }
  });

  app.post("/api/margin-settings", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const parsed = insertMarginSettingsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
      }
      const settings = await storage.upsertMarginSettings(parsed.data);
      await logActivityInternal(req.user?.claims?.sub, "update", "setting" as any, settings.id, `Updated margin settings`, req);
      res.json(settings);
    } catch (error) {
      console.error("Error updating margin settings:", error);
      res.status(500).json({ message: "Failed to update margin settings" });
    }
  });

  // Cost & Margin Global Settings Routes (hourly rates, profitability %, variance)
  app.get("/api/cost-margin-settings", isAuthenticated, requirePermission("view_cost_margin"), async (req: any, res) => {
    try {
      const settings = await storage.getCostMarginGlobalSettings();
      res.json(settings || {
        hourlyRateCA: "20",
        hourlyRateTX: "18",
        hourlyRateAE: "15",
        globalProfitabilityPercent: "30",
        globalVarianceHours: "0",
      });
    } catch (error) {
      console.error("Error fetching cost margin global settings:", error);
      res.status(500).json({ message: "Failed to fetch cost margin global settings" });
    }
  });

  app.post("/api/cost-margin-settings", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const settings = await storage.upsertCostMarginGlobalSettings(req.body);
      await logActivityInternal(req.user?.claims?.sub, "update", "setting" as any, settings.id, `Updated cost margin global settings`, req);
      res.json(settings);
    } catch (error) {
      console.error("Error updating cost margin global settings:", error);
      res.status(500).json({ message: "Failed to update cost margin global settings" });
    }
  });

  // Hourly Bucket Analysis - Calculate available hours for each project based on settings
  app.get("/api/cost-margin/hourly-buckets", isAuthenticated, requirePermission("view_cost_margin"), async (req: any, res) => {
    try {
      const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
      const year = parseInt(req.query.year as string) || new Date().getFullYear();
      const includeUpsells = req.query.includeUpsells !== "false"; // Default to true
      
      // Get global settings
      const globalSettings = await storage.getCostMarginGlobalSettings();
      const hourlyRates = {
        CA: parseFloat(globalSettings?.hourlyRateCA || "20"),
        TX: parseFloat(globalSettings?.hourlyRateTX || "18"),
        AE: parseFloat(globalSettings?.hourlyRateAE || "15"),
      };
      const globalProfitabilityPercent = parseFloat(globalSettings?.globalProfitabilityPercent || "30");
      const globalVarianceHours = parseFloat(globalSettings?.globalVarianceHours || "0");

      // Get all projects and cumulative timesheets up to the selected month
      const projects = await storage.getAllProjects();
      const allTimesheets = await storage.getTimesheetsUpToMonth(month, year);
      
      // Get converted upsell totals by project if toggle is enabled
      const convertedUpsellTotals = includeUpsells 
        ? await storage.getConvertedUpsellTotalsByProject()
        : new Map<string, number>();

      const bucketAnalysis = projects.map(project => {
        const baseCost = parseFloat(project.totalCost || "0");
        const upsellAmount = includeUpsells ? (convertedUpsellTotals.get(project.id) || 0) : 0;
        const projectValue = baseCost + upsellAmount;
        const region = project.region as keyof typeof hourlyRates;
        
        // Determine which settings to use (project override or global)
        const hourlyRate = project.overrideHourlyRate 
          ? parseFloat(project.overrideHourlyRate) 
          : (hourlyRates[region] || hourlyRates.CA);
        const profitabilityPercent = project.overrideProfitabilityPercent 
          ? parseFloat(project.overrideProfitabilityPercent) 
          : globalProfitabilityPercent;
        const varianceHours = project.overrideVarianceHours 
          ? parseFloat(project.overrideVarianceHours) 
          : globalVarianceHours;

        // Calculate hourly buckets
        const totalHourBucket = hourlyRate > 0 ? projectValue / hourlyRate : 0;
        const profitReservedHours = totalHourBucket * (profitabilityPercent / 100);
        const implementationHours = totalHourBucket - profitReservedHours;
        const calculatedAvailableHours = implementationHours + varianceHours;
        
        // Check for manual override of available hours (for legacy projects)
        const isAvailableHoursOverridden = !!project.overrideAvailableHours;
        const finalAvailableHours = isAvailableHoursOverridden
          ? parseFloat(project.overrideAvailableHours!)
          : calculatedAvailableHours;

        // Calculate consumed hours from approved timesheets only
        const projectTimesheets = allTimesheets.filter(t => t.projectId === project.id);
        const approvedTimesheets = projectTimesheets.filter(t => t.approvalStatus === "approved");
        const consumedHours = approvedTimesheets.reduce((sum, t) => 
          sum + parseFloat(t.hoursLogged || "0"), 0);

        const remainingHours = finalAvailableHours - consumedHours;
        const utilizationPercent = finalAvailableHours > 0 
          ? (consumedHours / finalAvailableHours) * 100 
          : 0;
        
        // Calculate profitability margin = applicable profitability % + margin from remaining hours
        // Remaining hours margin = (remaining hours / final available hours) * profitability %
        const remainingHoursMargin = finalAvailableHours > 0 
          ? (remainingHours / finalAvailableHours) * profitabilityPercent 
          : 0;
        const effectiveProfitabilityMargin = profitabilityPercent + remainingHoursMargin;

        // Determine bucket status
        let bucketStatus: "on_track" | "warning" | "critical" = "on_track";
        if (utilizationPercent >= 100) {
          bucketStatus = "critical";
        } else if (utilizationPercent >= 80) {
          bucketStatus = "warning";
        }

        return {
          projectId: project.id,
          projectName: project.name,
          region: project.region,
          projectStatus: project.status || "active",
          projectValue,
          baseCost,
          upsellAmount,
          // Settings used (with override indicators)
          hourlyRate,
          isHourlyRateOverridden: !!project.overrideHourlyRate,
          profitabilityPercent,
          isProfitabilityOverridden: !!project.overrideProfitabilityPercent,
          varianceHours,
          isVarianceOverridden: !!project.overrideVarianceHours,
          isAvailableHoursOverridden,
          overrideAvailableHours: project.overrideAvailableHours ? parseFloat(project.overrideAvailableHours) : null,
          // Calculated values
          totalHourBucket,
          profitReservedHours,
          implementationHours,
          calculatedAvailableHours,
          finalAvailableHours,
          consumedHours,
          remainingHours,
          utilizationPercent,
          bucketStatus,
          // Profitability margin
          effectiveProfitabilityMargin,
          remainingHoursMargin,
          // Include project timesheet entries for detail view
          timesheetEntries: projectTimesheets.map(ts => ({
            id: ts.id,
            date: ts.date,
            hoursLogged: parseFloat(ts.hoursLogged || "0"),
            description: ts.description,
            userName: ts.user?.firstName || ts.user?.email || "Unknown",
            approvalStatus: ts.approvalStatus,
          })),
        };
      });

      // Calculate summary stats
      const totalProjects = bucketAnalysis.length;
      const onTrackCount = bucketAnalysis.filter(b => b.bucketStatus === "on_track").length;
      const warningCount = bucketAnalysis.filter(b => b.bucketStatus === "warning").length;
      const criticalCount = bucketAnalysis.filter(b => b.bucketStatus === "critical").length;
      const totalAvailableHours = bucketAnalysis.reduce((sum, b) => sum + b.finalAvailableHours, 0);
      const totalConsumedHours = bucketAnalysis.reduce((sum, b) => sum + b.consumedHours, 0);

      // Note: Bucket status notifications are now triggered only when timesheets are approved
      // or when project cost/hours fields change - not on every page view

      res.json({
        summary: {
          totalProjects,
          onTrackCount,
          warningCount,
          criticalCount,
          totalAvailableHours,
          totalConsumedHours,
          overallUtilization: totalAvailableHours > 0 ? (totalConsumedHours / totalAvailableHours) * 100 : 0,
        },
        projects: bucketAnalysis,
        globalSettings: {
          hourlyRateCA: hourlyRates.CA,
          hourlyRateTX: hourlyRates.TX,
          hourlyRateAE: hourlyRates.AE,
          profitabilityPercent: globalProfitabilityPercent,
          varianceHours: globalVarianceHours,
        },
        includeUpsells,
      });
    } catch (error) {
      console.error("Error fetching hourly bucket analysis:", error);
      res.status(500).json({ message: "Failed to fetch hourly bucket analysis" });
    }
  });

  // Cost & Margin Executive Summary
  app.get("/api/cost-margin/summary", isAuthenticated, requirePermission("view_cost_margin"), async (req: any, res) => {
    try {
      const { month, year, viewMode } = req.query;
      const m = month ? parseInt(month as string) : new Date().getMonth() + 1;
      const y = year ? parseInt(year as string) : new Date().getFullYear();
      const isProjectTotalMode = viewMode === "projectTotal";

      // Get margin settings for thresholds
      const settings = await storage.getMarginSettings();
      const profitThreshold = parseFloat(settings?.profitThreshold || "20");
      const breakevenThreshold = parseFloat(settings?.breakEvenLowerThreshold || "0");

      // Get global rate settings to check if we should override timesheet rates
      const globalRateSettings = await storage.getResourceRateSettings("global");
      const useGlobalRate = globalRateSettings?.useGlobalFixedRate ?? false;
      const globalRate = parseFloat(globalRateSettings?.globalFixedHourlyRate || "0");

      // Get all projects with their costs and payments
      // Always use total project values (lifetime) for revenue, costs, and margin calculations
      const projects = await storage.getAllProjects();
      const estimatedCosts = await storage.getAllProjectEstimatedCosts({});
      const actualCosts = await storage.getAllProjectActualCosts({});
      const vendorCosts = await storage.getAllVendorCosts({});
      const toolCosts = await storage.getAllToolCosts({});
      const allPayments = await storage.getAllPayments({});
      const allTimesheets = await storage.getAllTimesheets({ status: "approved" as any });

      let totalCashReceived = 0;
      let totalActualCost = 0;
      let profitProjectCount = 0;
      let breakevenProjectCount = 0;
      let lossProjectCount = 0;

      const projectSummaries = projects.map(project => {
        // Calculate revenue (received payments) - always use total project revenue
        const projectPayments = allPayments.filter(p => p.projectId === project.id && p.status === "received");
        const revenue = projectPayments.reduce((sum, p) => sum + parseFloat(p.receivedAmount || "0"), 0);

        // Calculate costs - aggregate all entries for this project
        const projectEstimatedAll = estimatedCosts.filter(c => c.projectId === project.id);
        const projectActualAll = actualCosts.filter(c => c.projectId === project.id);
        const projectVendor = vendorCosts.filter(c => c.projectId === project.id);
        const projectTool = toolCosts.filter(c => c.projectId === project.id);
        
        // Calculate human cost: prefer timesheet-derived costs, fallback to manual actual cost
        const projectTimesheets = allTimesheets.filter(t => t.projectId === project.id);
        
        // Check if project has any timesheets with hours logged
        const hasTimesheetEntries = projectTimesheets.some(t => parseFloat(t.hoursLogged || "0") > 0);
        
        // Calculate timesheet cost from hoursLogged * rate (use global rate if enabled, otherwise stored rate)
        const timesheetHumanCost = projectTimesheets.reduce((sum, t) => {
          const hours = parseFloat(t.hoursLogged || "0");
          // Use global rate when enabled, otherwise fall back to stored timesheet rate
          const rate = useGlobalRate && globalRate > 0 ? globalRate : parseFloat(t.hourlyCostRate || "0");
          return sum + (hours * rate);
        }, 0);
        
        // Use timesheet-derived cost if timesheets exist with hours, otherwise sum up manual actual cost entries
        const manualHumanCost = projectActualAll.reduce((sum, c) => sum + parseFloat(c.actualHumanCost || "0"), 0);
        const humanCost = hasTimesheetEntries ? timesheetHumanCost : manualHumanCost;
        
        const vendorTotal = projectVendor.reduce((sum, v) => sum + parseFloat(v.amount), 0);
        const toolTotal = projectTool.reduce((sum, t) => sum + parseFloat(t.amount), 0);
        const totalCost = humanCost + vendorTotal + toolTotal;

        // Calculate estimated cost (sum all entries)
        const estimatedCostTotal = projectEstimatedAll.reduce((sum, c) => sum + parseFloat(c.totalEstimatedCost || "0"), 0);

        // Calculate margin
        const margin = revenue > 0 ? ((revenue - totalCost) / revenue) * 100 : 0;
        
        // Determine bucket
        let bucket: "profit" | "breakeven" | "loss" = "loss";
        if (margin >= profitThreshold) {
          bucket = "profit";
          profitProjectCount++;
        } else if (margin >= breakevenThreshold) {
          bucket = "breakeven";
          breakevenProjectCount++;
        } else {
          lossProjectCount++;
        }

        totalCashReceived += revenue;
        totalActualCost += totalCost;

        return {
          projectId: project.id,
          projectName: project.name,
          region: project.region,
          revenue,
          estimatedCost: estimatedCostTotal,
          actualCost: totalCost,
          humanCost,
          humanCostSource: hasTimesheetEntries ? "timesheet" : "manual",
          vendorCost: vendorTotal,
          toolCost: toolTotal,
          margin,
          bucket,
        };
      });

      const totalMargin = totalCashReceived > 0 
        ? ((totalCashReceived - totalActualCost) / totalCashReceived) * 100 
        : 0;

      res.json({
        month: m,
        year: y,
        viewMode: isProjectTotalMode ? "projectTotal" : "monthly",
        summary: {
          totalCashReceived,
          totalActualCost,
          totalMargin,
          profitProjectCount,
          breakevenProjectCount,
          lossProjectCount,
        },
        projects: projectSummaries,
        thresholds: {
          profitThreshold,
          breakevenThreshold,
        },
      });
    } catch (error) {
      console.error("Error fetching cost margin summary:", error);
      res.status(500).json({ message: "Failed to fetch cost margin summary" });
    }
  });

  // Project cost history - monthly breakdown for a specific project
  app.get("/api/cost-margin/project/:projectId/history", isAuthenticated, requirePermission("view_cost_margin"), async (req: any, res) => {
    try {
      const { projectId } = req.params;
      const { resourceId } = req.query;
      
      // Get project details
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Get margin settings for thresholds
      const marginSettings = await storage.getMarginSettings();
      const profitThreshold = marginSettings?.profitThreshold ? parseFloat(marginSettings.profitThreshold) : 20;
      const breakevenThreshold = marginSettings?.breakEvenLowerThreshold ? parseFloat(marginSettings.breakEvenLowerThreshold) : 0;

      // Get global rate settings to check if we should override timesheet rates
      const globalRateSettings = await storage.getResourceRateSettings("global");
      const useGlobalRate = globalRateSettings?.useGlobalFixedRate ?? false;
      const globalRate = parseFloat(globalRateSettings?.globalFixedHourlyRate || "0");

      // Get all data for this project (no month/year filter)
      const allPayments = await storage.getAllPayments({ projectId });
      const allTimesheets = await storage.getAllTimesheets({ projectId, status: "approved" as any });
      const allVendorCosts = await storage.getAllVendorCosts({ projectId });
      const allToolCosts = await storage.getAllToolCosts({ projectId });
      const allActualCosts = await storage.getAllProjectActualCosts({ projectId });

      // Apply resource filter if provided
      const filteredTimesheets = resourceId 
        ? allTimesheets.filter(t => t.userId === resourceId)
        : allTimesheets;

      // Get unique months from all data sources
      const monthsSet = new Set<string>();
      allPayments.forEach(p => {
        if (p.createdAt) {
          const d = new Date(p.createdAt);
          monthsSet.add(`${d.getFullYear()}-${d.getMonth() + 1}`);
        }
      });
      filteredTimesheets.forEach(t => {
        if (t.date) {
          const d = new Date(t.date);
          monthsSet.add(`${d.getFullYear()}-${d.getMonth() + 1}`);
        }
      });
      allVendorCosts.forEach(c => monthsSet.add(`${c.year}-${c.month}`));
      allToolCosts.forEach(c => monthsSet.add(`${c.year}-${c.month}`));
      allActualCosts.forEach(c => monthsSet.add(`${c.year}-${c.month}`));

      // Build monthly history
      const monthlyHistory = Array.from(monthsSet).map(monthKey => {
        const [year, month] = monthKey.split('-').map(Number);
        
        // Revenue for this month
        const monthPayments = allPayments.filter(p => {
          if (!p.createdAt) return false;
          const d = new Date(p.createdAt);
          return d.getFullYear() === year && d.getMonth() + 1 === month && p.status === "received";
        });
        const revenue = monthPayments.reduce((sum, p) => sum + parseFloat(p.receivedAmount || "0"), 0);

        // Timesheet costs for this month
        const monthTimesheets = filteredTimesheets.filter(t => {
          if (!t.date) return false;
          const d = new Date(t.date);
          return d.getFullYear() === year && d.getMonth() + 1 === month;
        });
        
        // Check if month has any timesheets with hours logged
        const hasTimesheetEntries = monthTimesheets.some(t => parseFloat(t.hoursLogged || "0") > 0);
        
        const timesheetCost = monthTimesheets.reduce((sum, t) => {
          const hours = parseFloat(t.hoursLogged || "0");
          // Use global rate when enabled, otherwise fall back to stored timesheet rate
          const rate = useGlobalRate && globalRate > 0 ? globalRate : parseFloat(t.hourlyCostRate || "0");
          return sum + (hours * rate);
        }, 0);

        // Other costs for this month
        const vendorCost = allVendorCosts
          .filter(c => c.year === year && c.month === month)
          .reduce((sum, c) => sum + parseFloat(c.amount), 0);
        const toolCost = allToolCosts
          .filter(c => c.year === year && c.month === month)
          .reduce((sum, c) => sum + parseFloat(c.amount), 0);
        const manualHumanCost = allActualCosts
          .filter(c => c.year === year && c.month === month)
          .reduce((sum, c) => sum + parseFloat(c.actualHumanCost || "0"), 0);

        // Use timesheet-derived cost if timesheets exist with hours, otherwise sum up manual actual cost entries
        const humanCost = hasTimesheetEntries ? timesheetCost : manualHumanCost;
        const totalCost = humanCost + vendorCost + toolCost;
        const margin = revenue > 0 ? ((revenue - totalCost) / revenue) * 100 : (totalCost > 0 ? -100 : 0);

        // Determine bucket
        let bucket: "profit" | "breakeven" | "loss" = "loss";
        if (margin >= profitThreshold) bucket = "profit";
        else if (margin >= breakevenThreshold) bucket = "breakeven";

        return {
          year,
          month,
          monthLabel: new Date(year, month - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          revenue,
          humanCost,
          vendorCost,
          toolCost,
          totalCost,
          margin,
          bucket,
          timesheetCount: monthTimesheets.length,
        };
      }).sort((a, b) => a.year === b.year ? a.month - b.month : a.year - b.year);

      // Detect status changes
      const statusChanges: Array<{ date: string; fromBucket: string; toBucket: string; margin: number }> = [];
      for (let i = 1; i < monthlyHistory.length; i++) {
        if (monthlyHistory[i].bucket !== monthlyHistory[i - 1].bucket) {
          statusChanges.push({
            date: monthlyHistory[i].monthLabel,
            fromBucket: monthlyHistory[i - 1].bucket,
            toBucket: monthlyHistory[i].bucket,
            margin: monthlyHistory[i].margin,
          });
        }
      }

      // Timesheet entries with user info - use global rate when enabled
      const timesheetEntries = filteredTimesheets.map(t => {
        const hours = parseFloat(t.hoursLogged || "0");
        // Use global rate when enabled, otherwise fall back to stored timesheet rate
        const effectiveRate = useGlobalRate && globalRate > 0 ? globalRate : parseFloat(t.hourlyCostRate || "0");
        return {
          id: t.id,
          date: t.date,
          hoursLogged: hours,
          hourlyCostRate: effectiveRate,
          cost: hours * effectiveRate,
          description: t.description,
          userId: t.userId,
        };
      }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Get user info for timesheets
      const userIds = [...new Set(timesheetEntries.map(t => t.userId))];
      const users = await Promise.all(userIds.map(id => storage.getUser(id)));
      const userMap = new Map(users.filter(Boolean).map(u => [u!.id, { firstName: u!.firstName, lastName: u!.lastName }]));

      const enrichedTimesheets = timesheetEntries.map(t => ({
        ...t,
        userName: userMap.has(t.userId) 
          ? `${userMap.get(t.userId)?.firstName || ''} ${userMap.get(t.userId)?.lastName || ''}`.trim()
          : 'Unknown',
      }));

      // Calculate overall stats
      // Total revenue should be sum of ALL received payments for the project lifetime (not just from monthly breakdown)
      const totalRevenue = allPayments
        .filter(p => p.status === "received")
        .reduce((sum, p) => sum + parseFloat(p.receivedAmount || "0"), 0);
      const totalCost = monthlyHistory.reduce((sum, m) => sum + m.totalCost, 0);
      const totalHours = timesheetEntries.reduce((sum, t) => sum + t.hoursLogged, 0);
      const overallMargin = totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0;

      res.json({
        project: {
          id: project.id,
          name: project.name,
          region: project.region,
        },
        stats: {
          totalRevenue,
          totalCost,
          overallMargin,
          totalHours,
          timesheetCount: timesheetEntries.length,
          monthsActive: monthlyHistory.length,
        },
        monthlyHistory,
        statusChanges,
        timesheets: enrichedTimesheets,
        thresholds: {
          profitThreshold,
          breakevenThreshold,
        },
      });
    } catch (error) {
      console.error("Error fetching project cost history:", error);
      res.status(500).json({ message: "Failed to fetch project cost history" });
    }
  });

  // Resources Module Routes - Admin only for full access
  // Public endpoint for active resources (for timesheet dropdown) - any authenticated user
  app.get("/api/resources/active-list", isAuthenticated, async (req: any, res) => {
    try {
      const resources = await storage.getAllResources({ isActive: true });
      // Return only essential fields needed for dropdown selection
      const simplified = resources.map(r => ({
        id: r.id,
        name: r.name,
        designation: r.designation,
        effectiveHourlyRate: r.effectiveHourlyRate,
        employmentType: r.employmentType,
      }));
      res.json(simplified);
    } catch (error) {
      console.error("Error fetching active resources:", error);
      res.status(500).json({ message: "Failed to fetch resources" });
    }
  });

  app.get("/api/resources", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const isActive = req.query.isActive !== undefined ? req.query.isActive === "true" : undefined;
      const resources = await storage.getAllResources({ isActive });
      res.json(resources);
    } catch (error) {
      console.error("Error fetching resources:", error);
      res.status(500).json({ message: "Failed to fetch resources" });
    }
  });

  app.get("/api/resources/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const resource = await storage.getResource(req.params.id);
      if (!resource) {
        return res.status(404).json({ message: "Resource not found" });
      }
      res.json(resource);
    } catch (error) {
      console.error("Error fetching resource:", error);
      res.status(500).json({ message: "Failed to fetch resource" });
    }
  });

  // Allow users to get their own resource (for timesheet rate lookup)
  app.get("/api/resources/my-profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      const resource = await storage.getResourceByUserId(userId);
      if (!resource) {
        return res.json(null);
      }
      // Return only non-sensitive fields needed for timesheet
      res.json({
        id: resource.id,
        name: resource.name,
        effectiveHourlyRate: resource.effectiveHourlyRate,
        employmentType: resource.employmentType,
        userId: resource.userId,
      });
    } catch (error) {
      console.error("Error fetching my resource profile:", error);
      res.status(500).json({ message: "Failed to fetch resource" });
    }
  });

  // Admin-only route to get resource by user ID
  app.get("/api/resources/by-user/:userId", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const resource = await storage.getResourceByUserId(req.params.userId);
      res.json(resource || null);
    } catch (error) {
      console.error("Error fetching resource by user:", error);
      res.status(500).json({ message: "Failed to fetch resource" });
    }
  });

  // Allow users to get their own effective rate (for timesheet auto-population)
  app.get("/api/resources/my-effective-rate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      const resource = await storage.getResourceByUserId(userId);
      if (!resource) {
        return res.json({ rate: null, source: "none" });
      }
      const rate = await storage.getEffectiveHourlyRateForResource(resource.id);
      const globalSettings = await storage.getResourceRateSettings("global");
      const source = globalSettings?.useGlobalFixedRate ? "global_override" : "resource";
      res.json({ rate, source });
    } catch (error) {
      console.error("Error fetching my effective rate:", error);
      res.status(500).json({ message: "Failed to fetch effective rate" });
    }
  });

  // Admin-only route to get effective rate for any resource
  app.get("/api/resources/effective-rate/:resourceId", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const rate = await storage.getEffectiveHourlyRateForResource(req.params.resourceId);
      res.json({ rate });
    } catch (error) {
      console.error("Error fetching effective rate:", error);
      res.status(500).json({ message: "Failed to fetch effective rate" });
    }
  });

  app.post("/api/resources", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { insertResourceSchema } = await import("@shared/schema");
      const parsed = insertResourceSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
      }
      const resource = await storage.createResource(parsed.data);
      await logActivityInternal(req.user?.claims?.sub, "create", "user" as any, resource.id, `Created resource: ${resource.name}`, req);
      res.json(resource);
    } catch (error) {
      console.error("Error creating resource:", error);
      res.status(500).json({ message: "Failed to create resource" });
    }
  });

  app.patch("/api/resources/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { updateResourceSchema } = await import("@shared/schema");
      const parsed = updateResourceSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
      }
      const resource = await storage.updateResource(req.params.id, parsed.data);
      if (!resource) {
        return res.status(404).json({ message: "Resource not found" });
      }
      await logActivityInternal(req.user?.claims?.sub, "update", "user" as any, resource.id, `Updated resource: ${resource.name}`, req);
      res.json(resource);
    } catch (error) {
      console.error("Error updating resource:", error);
      res.status(500).json({ message: "Failed to update resource" });
    }
  });

  app.delete("/api/resources/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const deleted = await storage.deleteResource(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Resource not found" });
      }
      await logActivityInternal(req.user?.claims?.sub, "delete", "user" as any, req.params.id, `Deleted resource`, req);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting resource:", error);
      res.status(500).json({ message: "Failed to delete resource" });
    }
  });

  // Resource Rate Settings Routes
  app.get("/api/resource-rate-settings", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const settings = await storage.getAllResourceRateSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error fetching resource rate settings:", error);
      res.status(500).json({ message: "Failed to fetch resource rate settings" });
    }
  });

  app.get("/api/resource-rate-settings/:region", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const settings = await storage.getResourceRateSettings(req.params.region);
      res.json(settings || null);
    } catch (error) {
      console.error("Error fetching resource rate settings:", error);
      res.status(500).json({ message: "Failed to fetch resource rate settings" });
    }
  });

  app.post("/api/resource-rate-settings", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { insertResourceRateSettingsSchema } = await import("@shared/schema");
      const parsed = insertResourceRateSettingsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
      }
      const settings = await storage.upsertResourceRateSettings(parsed.data);
      await logActivityInternal(req.user?.claims?.sub, "update", "setting" as any, settings.id, `Updated resource rate settings`, req);
      res.json(settings);
    } catch (error) {
      console.error("Error updating resource rate settings:", error);
      res.status(500).json({ message: "Failed to update resource rate settings" });
    }
  });

  app.delete("/api/resource-rate-settings/:region", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const deleted = await storage.deleteResourceRateSettings(req.params.region);
      if (!deleted) {
        return res.status(404).json({ message: "Settings not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting resource rate settings:", error);
      res.status(500).json({ message: "Failed to delete resource rate settings" });
    }
  });

  // CSV Import/Export Routes

  // Resources CSV Template Download
  app.get("/api/resources/csv-template", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const csvContent = "name,email,designation,employment_type,monthly_salary,contractor_hourly_rate\nJohn Doe,john@example.com,Software Engineer,employee,5000,\nJane Smith,jane@example.com,Consultant,contractor,,75";
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=resources_template.csv");
      res.send(csvContent);
    } catch (error) {
      console.error("Error generating resources CSV template:", error);
      res.status(500).json({ message: "Failed to generate template" });
    }
  });

  // Resources CSV Bulk Import
  app.post("/api/resources/csv-import", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { resources: resourcesData } = req.body;
      if (!Array.isArray(resourcesData) || resourcesData.length === 0) {
        return res.status(400).json({ message: "No resources data provided" });
      }

      const { insertResourceSchema } = await import("@shared/schema");
      const results: { success: number; errors: Array<{ row: number; error: string }> } = {
        success: 0,
        errors: [],
      };

      for (let i = 0; i < resourcesData.length; i++) {
        const row = resourcesData[i];
        try {
          const resourceData = {
            name: row.name,
            email: row.email || undefined,
            designation: row.designation || undefined,
            employmentType: row.employment_type === "contractor" ? "contractor" : "employee",
            monthlySalary: row.monthly_salary ? String(row.monthly_salary) : undefined,
            contractorHourlyRate: row.contractor_hourly_rate ? String(row.contractor_hourly_rate) : undefined,
            isActive: true,
          };

          const parsed = insertResourceSchema.safeParse(resourceData);
          if (!parsed.success) {
            results.errors.push({ row: i + 2, error: parsed.error.errors[0]?.message || "Validation failed" });
            continue;
          }

          await storage.createResource(parsed.data);
          results.success++;
        } catch (err: any) {
          results.errors.push({ row: i + 2, error: err.message || "Unknown error" });
        }
      }

      await logActivityInternal(req.user?.claims?.sub, "create", "user" as any, "", `Bulk imported ${results.success} resources via CSV`, req);
      res.json(results);
    } catch (error) {
      console.error("Error importing resources from CSV:", error);
      res.status(500).json({ message: "Failed to import resources" });
    }
  });

  // Timesheets CSV Bulk Import (only for authenticated user's own timesheets)
  app.post("/api/timesheets/csv-import", isAuthenticated, requirePermission("create_timesheets"), async (req: any, res) => {
    try {
      const sessionUserId = req.user?.claims?.sub;
      if (!sessionUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const { timesheets: timesheetsData } = req.body;
      if (!Array.isArray(timesheetsData) || timesheetsData.length === 0) {
        return res.status(400).json({ message: "No timesheets data provided" });
      }

      // Get all projects for name matching
      const allProjects = await storage.getAllProjects();
      const projectMap = new Map(allProjects.map(p => [p.name.toLowerCase(), p]));

      // Get user's effective rate
      let effectiveRate = "0.00";
      const userResource = await storage.getResourceByUserId(sessionUserId);
      if (userResource) {
        const rate = await storage.getEffectiveHourlyRateForResource(userResource.id);
        if (rate && rate !== "0.00") {
          effectiveRate = rate;
        }
      }

      const { insertTimesheetSchema } = await import("@shared/schema");
      const results: { success: number; errors: Array<{ row: number; error: string }> } = {
        success: 0,
        errors: [],
      };

      for (let i = 0; i < timesheetsData.length; i++) {
        const row = timesheetsData[i];
        try {
          // Find project by name
          const project = projectMap.get(row.project_name?.toLowerCase());
          if (!project) {
            results.errors.push({ row: i + 2, error: `Project "${row.project_name}" not found` });
            continue;
          }

          const timesheetData = {
            userId: sessionUserId,
            projectId: project.id,
            date: new Date(row.date),
            hoursLogged: String(row.hours_logged),
            hourlyCostRate: effectiveRate,
            description: row.description || undefined,
            approvalStatus: "pending" as const,
          };

          const parsed = insertTimesheetSchema.safeParse(timesheetData);
          if (!parsed.success) {
            results.errors.push({ row: i + 2, error: parsed.error.errors[0]?.message || "Validation failed" });
            continue;
          }

          await storage.createTimesheet(parsed.data);
          results.success++;
        } catch (err: any) {
          results.errors.push({ row: i + 2, error: err.message || "Unknown error" });
        }
      }

      await logActivityInternal(sessionUserId, "create", "timesheet" as any, "", `Bulk imported ${results.success} timesheets via CSV`, req);
      res.json(results);
    } catch (error) {
      console.error("Error importing timesheets from CSV:", error);
      res.status(500).json({ message: "Failed to import timesheets" });
    }
  });

  // ============================================
  // JIRA INTEGRATION ROUTES
  // ============================================

  app.get("/api/jira/settings", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const settings = await storage.getJiraIntegrationSettings();
      if (!settings) {
        return res.json({
          serverUrl: "",
          username: "",
          isActive: false,
        });
      }
      res.json({
        ...settings,
        apiToken: settings.apiToken ? "***configured***" : "",
        webhookSecret: settings.webhookSecret ? "***configured***" : "",
      });
    } catch (error) {
      console.error("Error fetching Jira settings:", error);
      res.status(500).json({ message: "Failed to fetch Jira settings" });
    }
  });

  app.post("/api/jira/settings", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { serverUrl, username, apiToken, webhookSecret, syncIntervalMinutes, isActive } = req.body;
      
      const existingSettings = await storage.getJiraIntegrationSettings();
      
      const updateData: any = {
        serverUrl,
        username,
        isActive: !!isActive,
        syncIntervalMinutes: syncIntervalMinutes || 30,
      };
      
      // Only update apiToken if provided and not the placeholder
      if (apiToken && apiToken !== "" && apiToken !== "***configured***") {
        updateData.apiToken = apiToken;
      } else if (existingSettings?.apiToken) {
        updateData.apiToken = existingSettings.apiToken;
      }
      
      // Only update webhookSecret if provided and not the placeholder
      if (webhookSecret && webhookSecret !== "" && webhookSecret !== "***configured***") {
        updateData.webhookSecret = webhookSecret;
      } else if (existingSettings?.webhookSecret) {
        updateData.webhookSecret = existingSettings.webhookSecret;
      }
      
      const settings = await storage.upsertJiraIntegrationSettings(updateData);
      await logActivityInternal(req.user?.claims?.sub, "update", "settings" as any, settings.id, "Updated Jira integration settings", req);
      
      res.json({
        ...settings,
        apiToken: settings.apiToken ? "***configured***" : "",
        webhookSecret: settings.webhookSecret ? "***configured***" : "",
      });
    } catch (error) {
      console.error("Error updating Jira settings:", error);
      res.status(500).json({ message: "Failed to update Jira settings" });
    }
  });

  app.post("/api/jira/test-connection", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const settings = await storage.getJiraIntegrationSettings();
      if (!settings || !settings.serverUrl || !settings.apiToken) {
        return res.json({ success: false, error: "Jira settings not configured" });
      }

      const authHeader = "Basic " + Buffer.from(`${settings.username}:${settings.apiToken}`).toString("base64");
      
      const response = await fetch(`${settings.serverUrl}/rest/api/2/myself`, {
        method: "GET",
        headers: {
          "Authorization": authHeader,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const user = await response.json();
        res.json({ success: true, user: { name: user.displayName, email: user.emailAddress } });
      } else {
        const errorText = await response.text();
        res.json({ success: false, error: `Connection failed: ${response.status} - ${errorText}` });
      }
    } catch (error: any) {
      console.error("Error testing Jira connection:", error);
      res.json({ success: false, error: error.message || "Connection failed" });
    }
  });

  app.post("/api/jira/sync", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const settings = await storage.getJiraIntegrationSettings();
      if (!settings || !settings.isActive) {
        return res.status(400).json({ message: "Jira integration is not active" });
      }

      await storage.updateJiraIntegrationSyncStatus("in_progress");
      
      const mappings = await storage.getAllJiraProjectMappings();
      const activeMappings = mappings.filter(m => m.isActive);
      
      if (activeMappings.length === 0) {
        await storage.updateJiraIntegrationSyncStatus("success");
        return res.json({ syncedCount: 0, message: "No active project mappings" });
      }

      let syncedCount = 0;
      const errors: string[] = [];
      const authHeader = "Basic " + Buffer.from(`${settings.username}:${settings.apiToken}`).toString("base64");

      for (const mapping of activeMappings) {
        try {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 7);
          const startDate = yesterday.toISOString().split("T")[0];
          
          const jql = encodeURIComponent(`project = ${mapping.jiraProjectKey} AND worklogDate >= ${startDate}`);
          const searchResponse = await fetch(
            `${settings.serverUrl}/rest/api/2/search?jql=${jql}&fields=worklog,summary&maxResults=100`,
            {
              method: "GET",
              headers: { "Authorization": authHeader, "Content-Type": "application/json" },
            }
          );

          if (!searchResponse.ok) {
            errors.push(`Failed to fetch issues for ${mapping.jiraProjectKey}`);
            continue;
          }

          const searchData = await searchResponse.json();
          const issues = searchData.issues || [];

          for (const issue of issues) {
            if (issue.fields?.worklog?.worklogs) {
              for (const worklog of issue.fields.worklog.worklogs) {
                const existingSync = await storage.getJiraWorklogSyncByWorklogId(worklog.id);
                if (existingSync) continue;

                const hoursLogged = (worklog.timeSpentSeconds || 0) / 3600;
                const worklogDate = new Date(worklog.started);
                
                const timesheet = await storage.createTimesheet({
                  projectId: mapping.revolrmoProjectId,
                  userId: req.user?.claims?.sub || "system",
                  date: worklogDate,
                  hoursLogged: hoursLogged.toFixed(2),
                  hourlyCostRate: "0.00",
                  description: `[${issue.key}] ${worklog.comment || issue.fields?.summary || "Jira worklog"}`,
                  approvalStatus: "approved",
                });

                await storage.createJiraWorklogSync({
                  jiraWorklogId: String(worklog.id),
                  jiraIssueKey: issue.key,
                  jiraProjectKey: mapping.jiraProjectKey,
                  jiraAuthorAccountId: worklog.author?.accountId || worklog.author?.name || null,
                  jiraAuthorDisplayName: worklog.author?.displayName || null,
                  timesheetId: timesheet.id,
                  worklogDate: worklogDate,
                  hoursLogged: hoursLogged.toFixed(2),
                  syncStatus: "synced",
                });

                syncedCount++;
              }
            }
          }
        } catch (err: any) {
          errors.push(`Error syncing ${mapping.jiraProjectKey}: ${err.message}`);
        }
      }

      if (errors.length > 0) {
        await storage.updateJiraIntegrationSyncStatus("failed", errors.join("; "));
      } else {
        await storage.updateJiraIntegrationSyncStatus("success");
      }

      await logActivityInternal(req.user?.claims?.sub, "create", "timesheet" as any, "", `Synced ${syncedCount} worklogs from Jira`, req);
      res.json({ syncedCount, errors: errors.length > 0 ? errors : undefined });
    } catch (error: any) {
      console.error("Error syncing Jira worklogs:", error);
      await storage.updateJiraIntegrationSyncStatus("failed", error.message);
      res.status(500).json({ message: "Failed to sync worklogs" });
    }
  });

  app.get("/api/jira/mappings", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const mappings = await storage.getAllJiraProjectMappings();
      res.json(mappings);
    } catch (error) {
      console.error("Error fetching Jira mappings:", error);
      res.status(500).json({ message: "Failed to fetch project mappings" });
    }
  });

  app.post("/api/jira/mappings", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { jiraProjectKey, jiraProjectName, revolrmoProjectId, isActive } = req.body;
      
      const existingMapping = await storage.getJiraProjectMappingByKey(jiraProjectKey);
      if (existingMapping) {
        return res.status(400).json({ message: "A mapping for this Jira project already exists" });
      }

      const mapping = await storage.createJiraProjectMapping({
        jiraProjectKey,
        jiraProjectName: jiraProjectName || null,
        revolrmoProjectId,
        isActive: isActive !== false,
      });

      await logActivityInternal(req.user?.claims?.sub, "create", "settings" as any, mapping.id, `Created Jira mapping for ${jiraProjectKey}`, req);
      res.json(mapping);
    } catch (error) {
      console.error("Error creating Jira mapping:", error);
      res.status(500).json({ message: "Failed to create project mapping" });
    }
  });

  app.patch("/api/jira/mappings/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { jiraProjectKey, jiraProjectName, revolrmoProjectId, isActive } = req.body;

      const mapping = await storage.updateJiraProjectMapping(id, {
        jiraProjectKey,
        jiraProjectName: jiraProjectName || null,
        revolrmoProjectId,
        isActive,
      });

      if (!mapping) {
        return res.status(404).json({ message: "Mapping not found" });
      }

      await logActivityInternal(req.user?.claims?.sub, "update", "settings" as any, mapping.id, `Updated Jira mapping for ${jiraProjectKey}`, req);
      res.json(mapping);
    } catch (error) {
      console.error("Error updating Jira mapping:", error);
      res.status(500).json({ message: "Failed to update project mapping" });
    }
  });

  app.delete("/api/jira/mappings/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const mapping = await storage.getJiraProjectMapping(id);
      
      if (!mapping) {
        return res.status(404).json({ message: "Mapping not found" });
      }

      await storage.deleteJiraProjectMapping(id);
      await logActivityInternal(req.user?.claims?.sub, "delete", "settings" as any, id, `Deleted Jira mapping for ${mapping.jiraProjectKey}`, req);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting Jira mapping:", error);
      res.status(500).json({ message: "Failed to delete project mapping" });
    }
  });

  app.post("/api/jira/webhook", async (req: any, res) => {
    try {
      const settings = await storage.getJiraIntegrationSettings();
      if (!settings || !settings.isActive) {
        return res.status(400).json({ message: "Jira integration not active" });
      }

      if (settings.webhookSecret) {
        const signature = req.headers["x-atlassian-token"];
        if (signature !== settings.webhookSecret) {
          return res.status(401).json({ message: "Invalid webhook signature" });
        }
      }

      const event = req.body;
      if (event.webhookEvent === "worklog_created" || event.webhookEvent === "worklog_updated") {
        const worklog = event.worklog;
        const issueKey = event.issue?.key;
        const projectKey = issueKey?.split("-")[0];

        if (!worklog || !projectKey) {
          return res.status(400).json({ message: "Invalid webhook payload" });
        }

        const mapping = await storage.getJiraProjectMappingByKey(projectKey);
        if (!mapping || !mapping.isActive) {
          return res.json({ message: "Project not mapped or inactive" });
        }

        const existingSync = await storage.getJiraWorklogSyncByWorklogId(worklog.id);
        if (existingSync && event.webhookEvent === "worklog_created") {
          return res.json({ message: "Worklog already synced" });
        }

        const hoursLogged = (worklog.timeSpentSeconds || 0) / 3600;
        const worklogDate = new Date(worklog.started);

        if (existingSync) {
          if (existingSync.timesheetId) {
            await storage.updateTimesheet(existingSync.timesheetId, {
              hoursLogged: hoursLogged.toFixed(2),
              description: `[${issueKey}] ${worklog.comment || "Updated worklog"}`,
            });
          }
          await storage.updateJiraWorklogSync(existingSync.id, {
            hoursLogged: hoursLogged.toFixed(2),
            syncStatus: "synced",
          });
        } else {
          const timesheet = await storage.createTimesheet({
            projectId: mapping.revolrmoProjectId,
            userId: "system",
            date: worklogDate,
            hoursLogged: hoursLogged.toFixed(2),
            hourlyCostRate: "0.00",
            description: `[${issueKey}] ${worklog.comment || "Jira worklog"}`,
            approvalStatus: "approved",
          });

          await storage.createJiraWorklogSync({
            jiraWorklogId: String(worklog.id),
            jiraIssueKey: issueKey,
            jiraProjectKey: projectKey,
            jiraAuthorAccountId: worklog.author?.accountId || null,
            jiraAuthorDisplayName: worklog.author?.displayName || null,
            timesheetId: timesheet.id,
            worklogDate: worklogDate,
            hoursLogged: hoursLogged.toFixed(2),
            syncStatus: "synced",
          });
        }

        res.json({ success: true });
      } else {
        res.json({ message: "Webhook event not handled" });
      }
    } catch (error) {
      console.error("Error processing Jira webhook:", error);
      res.status(500).json({ message: "Failed to process webhook" });
    }
  });

  // ==================== QuickBooks Integration Routes ====================
  
  const {
    getQuickbooksSettings,
    getAuthorizationUrl,
    exchangeCodeForTokens,
    disconnectQuickbooks,
    syncInvoiceToQuickbooks,
    getQuickbooksInvoiceSyncStatus,
    verifyWebhookSignature,
    processWebhookEvent,
    getRecentWebhookEvents,
  } = await import("./quickbooksService");

  app.get("/api/quickbooks/settings", isAuthenticated, requirePermission("view_settings"), async (req: any, res) => {
    try {
      const settings = await getQuickbooksSettings();
      if (settings) {
        const { accessToken, refreshToken, ...safeSettings } = settings;
        res.json({
          ...safeSettings,
          hasTokens: !!accessToken && !!refreshToken,
        });
      } else {
        res.json({ isConnected: false });
      }
    } catch (error) {
      console.error("Error fetching QuickBooks settings:", error);
      res.status(500).json({ message: "Failed to fetch QuickBooks settings" });
    }
  });

  app.get("/api/quickbooks/auth-url", isAuthenticated, requirePermission("edit_settings"), async (req: any, res) => {
    try {
      const state = crypto.randomBytes(16).toString("hex");
      const url = getAuthorizationUrl(state);
      res.json({ url, state });
    } catch (error) {
      console.error("Error generating QuickBooks auth URL:", error);
      res.status(500).json({ message: "Failed to generate authorization URL" });
    }
  });

  app.get("/api/quickbooks/callback", async (req: any, res) => {
    try {
      const { code, realmId, state, error } = req.query;
      
      if (error) {
        console.error("QuickBooks OAuth error:", error);
        return res.redirect("/admin/settings?error=oauth_denied");
      }

      if (!code || !realmId) {
        return res.redirect("/admin/settings?error=missing_params");
      }

      await exchangeCodeForTokens(code as string, realmId as string);
      res.redirect("/admin/settings?success=connected");
    } catch (error) {
      console.error("Error handling QuickBooks callback:", error);
      res.redirect("/admin/settings?error=token_exchange");
    }
  });

  app.post("/api/quickbooks/disconnect", isAuthenticated, requirePermission("edit_settings"), async (req: any, res) => {
    try {
      await disconnectQuickbooks();
      
      const userId = req.user?.claims?.sub;
      await storage.createActivityLog({
        userId,
        action: "updated",
        entity: "settings",
        details: "Disconnected QuickBooks integration",
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error disconnecting QuickBooks:", error);
      res.status(500).json({ message: "Failed to disconnect QuickBooks" });
    }
  });

  app.post("/api/invoices/:id/sync-quickbooks", isAuthenticated, requirePermission("create_invoices"), async (req: any, res) => {
    try {
      const invoice = await storage.getInvoiceById(req.params.id);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      const lineItems = await storage.getInvoiceLineItems(invoice.id);
      const invoiceWithItems = { ...invoice, lineItems };

      const result = await syncInvoiceToQuickbooks(invoiceWithItems);
      
      if (result.success) {
        const userId = req.user?.claims?.sub;
        await storage.createActivityLog({
          userId,
          action: "synced",
          entity: "invoice",
          entityId: invoice.id,
          details: `Synced invoice ${invoice.invoiceNumber} to QuickBooks (QB ID: ${result.quickbooksInvoiceId})`,
        });
      }

      res.json(result);
    } catch (error: any) {
      console.error("Error syncing invoice to QuickBooks:", error);
      res.status(500).json({ message: error.message || "Failed to sync invoice" });
    }
  });

  app.get("/api/invoices/:id/quickbooks-status", isAuthenticated, requirePermission("view_invoices"), async (req: any, res) => {
    try {
      const status = await getQuickbooksInvoiceSyncStatus(req.params.id);
      res.json(status);
    } catch (error) {
      console.error("Error fetching QuickBooks sync status:", error);
      res.status(500).json({ message: "Failed to fetch sync status" });
    }
  });

  app.post("/api/quickbooks/webhook", express.raw({ type: "application/json" }), async (req: any, res) => {
    try {
      const signature = req.headers["intuit-signature"];
      const payload = req.body.toString();
      
      const settings = await getQuickbooksSettings();
      if (!settings?.webhookVerifierToken) {
        console.error("QuickBooks webhook received but no verifier token configured");
        return res.sendStatus(200);
      }

      if (!verifyWebhookSignature(payload, signature, settings.webhookVerifierToken)) {
        console.error("Invalid QuickBooks webhook signature");
        return res.status(401).send("Invalid signature");
      }

      const webhookData = JSON.parse(payload);

      for (const eventNotification of webhookData.eventNotifications || []) {
        const realmId = eventNotification.realmId;
        
        for (const entity of eventNotification.dataChangeEvent?.entities || []) {
          await processWebhookEvent(
            entity.name,
            entity.operation,
            entity.id,
            realmId,
            webhookData
          );
        }
      }

      res.sendStatus(200);
    } catch (error) {
      console.error("Error processing QuickBooks webhook:", error);
      res.sendStatus(200);
    }
  });

  app.get("/api/quickbooks/webhook-events", isAuthenticated, requirePermission("view_settings"), async (req: any, res) => {
    try {
      const events = await getRecentWebhookEvents(50);
      res.json(events);
    } catch (error) {
      console.error("Error fetching webhook events:", error);
      res.status(500).json({ message: "Failed to fetch webhook events" });
    }
  });

  // ==========================================
  // KPI Module Routes
  // ==========================================

  // KPI Parameters CRUD
  app.get("/api/kpi/parameters", isAuthenticated, requirePermission("view_kpis"), async (req: any, res) => {
    try {
      const activeOnly = req.query.activeOnly === "true";
      const params = await storage.getAllKpiParameters(activeOnly);
      res.json(params);
    } catch (error) {
      console.error("Error fetching KPI parameters:", error);
      res.status(500).json({ message: "Failed to fetch KPI parameters" });
    }
  });

  app.get("/api/kpi/parameters/:id", isAuthenticated, requirePermission("view_kpis"), async (req: any, res) => {
    try {
      const param = await storage.getKpiParameter(req.params.id);
      if (!param) return res.status(404).json({ message: "KPI parameter not found" });
      res.json(param);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch KPI parameter" });
    }
  });

  app.post("/api/kpi/parameters", isAuthenticated, requirePermission("manage_kpis"), async (req: any, res) => {
    try {
      const data = insertKpiParameterSchema.parse(req.body);
      const param = await storage.createKpiParameter(data);
      await storage.createActivityLog({
        action: "create",
        entity: "kpi_parameter",
        userId: req.user?.claims?.sub,
        details: `Created KPI parameter: ${data.name}`,
      });
      res.status(201).json(param);
    } catch (error: any) {
      console.error("Error creating KPI parameter:", error);
      res.status(400).json({ message: error.message || "Failed to create KPI parameter" });
    }
  });

  app.put("/api/kpi/parameters/:id", isAuthenticated, requirePermission("manage_kpis"), async (req: any, res) => {
    try {
      const param = await storage.updateKpiParameter(req.params.id, req.body);
      if (!param) return res.status(404).json({ message: "KPI parameter not found" });
      res.json(param);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Failed to update KPI parameter" });
    }
  });

  app.delete("/api/kpi/parameters/:id", isAuthenticated, requirePermission("manage_kpis"), async (req: any, res) => {
    try {
      const success = await storage.deleteKpiParameter(req.params.id);
      if (!success) return res.status(404).json({ message: "KPI parameter not found" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete KPI parameter" });
    }
  });

  // KPI Levels CRUD
  app.get("/api/kpi/levels", isAuthenticated, requirePermission("view_kpis"), async (req: any, res) => {
    try {
      const activeOnly = req.query.activeOnly === "true";
      const levels = await storage.getAllKpiLevels(activeOnly);
      res.json(levels);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch KPI levels" });
    }
  });

  app.get("/api/kpi/levels/:id", isAuthenticated, requirePermission("view_kpis"), async (req: any, res) => {
    try {
      const level = await storage.getKpiLevel(req.params.id);
      if (!level) return res.status(404).json({ message: "KPI level not found" });
      res.json(level);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch KPI level" });
    }
  });

  app.post("/api/kpi/levels", isAuthenticated, requirePermission("manage_kpis"), async (req: any, res) => {
    try {
      const data = insertKpiLevelSchema.parse(req.body);
      const level = await storage.createKpiLevel(data);
      await storage.createActivityLog({
        action: "create",
        entity: "kpi_level",
        userId: req.user?.claims?.sub,
        details: `Created KPI level: ${data.displayName}`,
      });
      res.status(201).json(level);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Failed to create KPI level" });
    }
  });

  app.put("/api/kpi/levels/:id", isAuthenticated, requirePermission("manage_kpis"), async (req: any, res) => {
    try {
      const level = await storage.updateKpiLevel(req.params.id, req.body);
      if (!level) return res.status(404).json({ message: "KPI level not found" });
      res.json(level);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Failed to update KPI level" });
    }
  });

  app.delete("/api/kpi/levels/:id", isAuthenticated, requirePermission("manage_kpis"), async (req: any, res) => {
    try {
      const success = await storage.deleteKpiLevel(req.params.id);
      if (!success) return res.status(404).json({ message: "KPI level not found" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete KPI level" });
    }
  });

  // KPI Level Scores (score mappings)
  app.get("/api/kpi/level-scores", isAuthenticated, requirePermission("view_kpis"), async (req: any, res) => {
    try {
      const { parameterId, levelId } = req.query;
      if (parameterId && levelId) {
        const scores = await storage.getKpiLevelScores(parameterId, levelId);
        res.json(scores);
      } else {
        const scores = await storage.getAllKpiLevelScores();
        res.json(scores);
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch KPI level scores" });
    }
  });

  app.post("/api/kpi/level-scores", isAuthenticated, requirePermission("manage_kpis"), async (req: any, res) => {
    try {
      const data = insertKpiLevelScoreSchema.parse(req.body);
      const score = await storage.upsertKpiLevelScore(data);
      res.status(201).json(score);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Failed to save KPI level score" });
    }
  });

  app.post("/api/kpi/level-scores/bulk", isAuthenticated, requirePermission("manage_kpis"), async (req: any, res) => {
    try {
      const { scores } = req.body;
      if (!Array.isArray(scores)) return res.status(400).json({ message: "scores must be an array" });
      const results = await storage.bulkUpsertKpiLevelScores(scores);
      res.json(results);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Failed to save KPI level scores" });
    }
  });

  app.delete("/api/kpi/level-scores/:id", isAuthenticated, requirePermission("manage_kpis"), async (req: any, res) => {
    try {
      const success = await storage.deleteKpiLevelScore(req.params.id);
      if (!success) return res.status(404).json({ message: "KPI level score not found" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete KPI level score" });
    }
  });

  // KPI Monthly Reviews
  app.get("/api/kpi/reviews", isAuthenticated, requirePermission("view_kpis"), async (req: any, res) => {
    try {
      const month = parseInt(req.query.month);
      const year = parseInt(req.query.year);
      if (isNaN(month) || isNaN(year)) {
        return res.status(400).json({ message: "month and year are required" });
      }
      const reviews = await storage.getKpiMonthlyReviews(month, year);
      res.json(reviews);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch KPI reviews" });
    }
  });

  app.get("/api/kpi/reviews/pm/:pmId", isAuthenticated, requirePermission("view_kpis"), async (req: any, res) => {
    try {
      const { pmId } = req.params;
      const month = req.query.month ? parseInt(req.query.month) : undefined;
      const year = req.query.year ? parseInt(req.query.year) : undefined;
      const reviews = await storage.getKpiMonthlyReviewsByPm(pmId, month, year);
      res.json(reviews);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch PM KPI reviews" });
    }
  });

  app.post("/api/kpi/reviews", isAuthenticated, requirePermission("manage_kpis"), async (req: any, res) => {
    try {
      // Stamp the PM's current kpiLevelId as a snapshot so historical score
      // recalculation can use the level at the time of entry, not the live level.
      let levelIdSnapshot = req.body.levelIdSnapshot ?? null;
      if (!levelIdSnapshot && req.body.pmId) {
        const pmUser = (await storage.getAllUsers()).find((u: any) => u.id === req.body.pmId);
        levelIdSnapshot = pmUser?.kpiLevelId ?? null;
      }
      const data = { ...req.body, reviewerId: req.user?.claims?.sub, levelIdSnapshot };
      const review = await storage.upsertKpiMonthlyReview(data);
      res.status(201).json(review);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Failed to save KPI review" });
    }
  });

  app.post("/api/kpi/reviews/bulk", isAuthenticated, requirePermission("manage_kpis"), async (req: any, res) => {
    try {
      const { reviews } = req.body;
      if (!Array.isArray(reviews)) return res.status(400).json({ message: "reviews must be an array" });

      const [parameters, allLevels, levelScores, allUsers] = await Promise.all([
        storage.getAllKpiParameters(true),
        storage.getAllKpiLevels(true),
        storage.getAllKpiLevelScores(),
        storage.getAllUsers(),
      ]);

      const reviewsWithScores = reviews.map((r: any) => {
        const pmUser = allUsers.find((u: any) => u.id === r.pmId);
        const pmLevelId = pmUser?.kpiLevelId || allLevels[0]?.id;
        const serverScore = calculateKpiScore(r.parameterId, r.value, pmLevelId, parameters, allLevels, levelScores);
        return {
          ...r,
          score: serverScore.toFixed(2),
          reviewerId: req.user?.claims?.sub,
          levelIdSnapshot: pmLevelId || null,
        };
      });

      const results = await storage.bulkUpsertKpiMonthlyReviews(reviewsWithScores);
      await storage.createActivityLog({
        action: "update",
        entity: "kpi_review",
        userId: req.user?.claims?.sub,
        details: `Submitted KPI reviews for ${reviews.length} parameters`,
      });
      res.json(results);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Failed to save KPI reviews" });
    }
  });

  app.delete("/api/kpi/reviews/:id", isAuthenticated, requirePermission("manage_kpis"), async (req: any, res) => {
    try {
      const success = await storage.deleteKpiMonthlyReview(req.params.id);
      if (!success) return res.status(404).json({ message: "KPI review not found" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete KPI review" });
    }
  });

  app.delete("/api/kpi/reviews/pm/:pmId", isAuthenticated, requirePermission("manage_kpis"), async (req: any, res) => {
    try {
      const month = parseInt(req.query.month as string);
      const year = parseInt(req.query.year as string);
      if (isNaN(month) || isNaN(year)) {
        return res.status(400).json({ message: "month and year are required" });
      }
      await storage.deleteKpiMonthlyReviewsByPmMonth(req.params.pmId, month, year);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete PM KPI reviews" });
    }
  });

  // Assign KPI level to a PM
  app.patch("/api/kpi/assign-level", isAuthenticated, requirePermission("manage_kpis"), async (req: any, res) => {
    try {
      const { userId, kpiLevelId } = req.body;
      if (!userId) return res.status(400).json({ message: "userId is required" });
      const user = await storage.updateUser(userId, { kpiLevelId: kpiLevelId || null });
      if (!user) return res.status(404).json({ message: "User not found" });
      const adminId = req.user?.claims?.sub;
      await storage.createActivityLog({
        action: "update",
        entity: "user",
        userId: adminId,
        details: `Assigned KPI level ${kpiLevelId || 'none'} to user ${user.email}`,
      });
      res.json(user);
    } catch (error) {
      console.error("Error assigning KPI level:", error);
      res.status(500).json({ message: "Failed to assign KPI level" });
    }
  });

  // Toggle KPI exclusion for a user
  app.patch("/api/kpi/toggle-excluded", isAuthenticated, requirePermission("manage_kpis"), async (req: any, res) => {
    try {
      const { userId, kpiExcluded } = req.body;
      if (!userId) return res.status(400).json({ message: "userId is required" });
      const user = await storage.updateUser(userId, { kpiExcluded: !!kpiExcluded });
      if (!user) return res.status(404).json({ message: "User not found" });
      const adminId = req.user?.claims?.sub;
      await storage.createActivityLog({
        action: "update",
        entity: "user",
        userId: adminId,
        details: `${kpiExcluded ? 'Excluded' : 'Included'} user ${user.email} ${kpiExcluded ? 'from' : 'in'} KPI reviews`,
      });
      res.json(user);
    } catch (error) {
      console.error("Error toggling KPI exclusion:", error);
      res.status(500).json({ message: "Failed to toggle KPI exclusion" });
    }
  });

  // KPI Target Achievement - calculates target achievement for all PMs
  app.get("/api/kpi/target-achievement", isAuthenticated, requirePermission("view_kpis"), async (req: any, res) => {
    try {
      const month = parseInt(req.query.month);
      const year = parseInt(req.query.year);
      if (isNaN(month) || isNaN(year)) {
        return res.status(400).json({ message: "month and year are required" });
      }

      const allPayments = await storage.getAllPayments({ month, year, status: "received" as const });
      const pmTargetsData = await storage.getPmTargets(month, year);

      const pmReceived = new Map<string, number>();
      for (const payment of allPayments) {
        const pmId = payment.project?.pmId;
        if (pmId) {
          const current = pmReceived.get(pmId) || 0;
          pmReceived.set(pmId, current + parseFloat(payment.receivedAmount || "0"));
        }
      }

      const achievements = pmTargetsData.map(target => {
        const received = pmReceived.get(target.pmId) || 0;
        const targetAmt = parseFloat(target.targetAmount || "0");
        const percentage = targetAmt > 0 ? Math.round((received / targetAmt) * 100) : (received > 0 ? 100 : 0);
        return {
          pmId: target.pmId,
          pmName: target.pm ? `${target.pm.firstName || ""} ${target.pm.lastName || ""}`.trim() : "Unknown",
          targetAmount: targetAmt,
          receivedAmount: received,
          achievementPercentage: percentage,
        };
      });

      res.json({ month, year, achievements });
    } catch (error) {
      console.error("Error calculating target achievement:", error);
      res.status(500).json({ message: "Failed to calculate target achievement" });
    }
  });

  // KPI Performance Summary - calculates efficiency scores for a given month
  app.get("/api/kpi/performance", isAuthenticated, requirePermission("view_kpis"), async (req: any, res) => {
    try {
      const month = parseInt(req.query.month);
      const year = parseInt(req.query.year);
      if (isNaN(month) || isNaN(year)) {
        return res.status(400).json({ message: "month and year are required" });
      }

      const [reviews, parameters, levelScores, allUsers, allLevels, graceScores] = await Promise.all([
        storage.getKpiMonthlyReviews(month, year),
        storage.getAllKpiParameters(true),
        storage.getAllKpiLevelScores(),
        storage.getAllUsers(),
        storage.getAllKpiLevels(true),
        storage.getKpiGraceScores(month, year),
      ]);

      const graceByPm = new Map<string, { total: number; entries: typeof graceScores }>();
      for (const g of graceScores) {
        const entry = graceByPm.get(g.pmId) || { total: 0, entries: [] };
        entry.total += parseFloat(g.points || "0");
        entry.entries.push(g);
        graceByPm.set(g.pmId, entry);
      }

      const autoCalcParams = parameters.filter(p => p.isAutoCalculated && p.autoCalcType === "target_achievement");
      const autoCalcData = new Map<string, { achievementPercentage: number; targetAmount: number; receivedAmount: number; projects: Array<{ id: string; name: string; amount: number }> }>();

      if (autoCalcParams.length > 0) {
        const receivedPayments = await storage.getAllPayments({ month, year, status: "received" as const });
        const pmTargetsData = await storage.getPmTargets(month, year);

        const pmReceived = new Map<string, number>();
        const pmReceivedProjects = new Map<string, Array<{ id: string; name: string; amount: number }>>();
        for (const payment of receivedPayments) {
          const pmId = payment.project?.pmId;
          if (pmId) {
            const current = pmReceived.get(pmId) || 0;
            pmReceived.set(pmId, current + parseFloat(payment.receivedAmount || "0"));
            if (payment.projectId && payment.project?.name) {
              const projectList = pmReceivedProjects.get(pmId) || [];
              const existing = projectList.find(p => p.id === payment.projectId);
              if (existing) {
                existing.amount += parseFloat(payment.receivedAmount || "0");
              } else {
                projectList.push({ id: payment.projectId, name: payment.project.name, amount: parseFloat(payment.receivedAmount || "0") });
              }
              pmReceivedProjects.set(pmId, projectList);
            }
          }
        }

        for (const target of pmTargetsData) {
          const received = pmReceived.get(target.pmId) || 0;
          const targetAmt = parseFloat(target.targetAmount || "0");
          const percentage = targetAmt > 0 ? Math.round((received / targetAmt) * 100) : (received > 0 ? 100 : 0);
          const projects = (pmReceivedProjects.get(target.pmId) || []).sort((a, b) => b.amount - a.amount);
          autoCalcData.set(target.pmId, { achievementPercentage: percentage, targetAmount: targetAmt, receivedAmount: received, projects });
        }

        const earlyExcludedIds = new Set(allUsers.filter(u => u.kpiExcluded).map(u => u.id));
        for (const [pmId, data] of autoCalcData) {
          if (earlyExcludedIds.has(pmId)) continue;
          for (const param of autoCalcParams) {
            const existing = reviews.find(r => r.pmId === pmId && r.parameterId === param.id);
            if (!existing) {
              const pm = allUsers.find(u => u.id === pmId);
              const pmLevelId = pm?.kpiLevelId;
              const pmLevel = pmLevelId ? allLevels.find(l => l.id === pmLevelId) : allLevels[0];
              const valueStr = `${data.achievementPercentage}%`;

              let score = 0;
              if (pmLevel) {
                const matchingScores = levelScores.filter(ls => ls.parameterId === param.id && ls.levelId === pmLevel.id);
                for (const ls of matchingScores) {
                  if (ls.value === valueStr) {
                    score = parseFloat(ls.scorePercentage || "0");
                    break;
                  }
                }
                if (score === 0 && data.achievementPercentage > 0) {
                  score = Math.min(parseFloat(param.weightage || "0"), parseFloat(param.weightage || "0") * data.achievementPercentage / 100);
                }
              }

              reviews.push({
                id: `auto_${pmId}_${param.id}`,
                pmId,
                reviewerId: "system",
                month,
                year,
                parameterId: param.id,
                value: valueStr,
                score: score.toFixed(2),
                notes: `Target: $${data.targetAmount.toLocaleString()} | Received: $${data.receivedAmount.toLocaleString()}`,
                createdAt: new Date(),
                updatedAt: new Date(),
              } as any);
            }
          }
        }
      }

      const excludedUserIds = new Set(allUsers.filter(u => u.kpiExcluded).map(u => u.id));

      const pmReviews = new Map<string, typeof reviews>();
      for (const review of reviews) {
        const pmId = review.pmId;
        if (excludedUserIds.has(pmId)) continue;
        if (!pmReviews.has(pmId)) pmReviews.set(pmId, []);
        pmReviews.get(pmId)!.push(review);
      }
      // Include PMs who only have grace adjustments (no parameter reviews) this month
      for (const pmId of graceByPm.keys()) {
        if (excludedUserIds.has(pmId)) continue;
        if (!pmReviews.has(pmId)) pmReviews.set(pmId, []);
      }

      const totalWeightage = parameters.reduce((sum, p) => sum + parseFloat(p.weightage || "0"), 0);

      const performances = Array.from(pmReviews.entries()).map(([pmId, pmRevs]) => {
        const pm = allUsers.find(u => u.id === pmId);
        const pmLevelId = pm?.kpiLevelId;
        const pmLevel = pmLevelId ? allLevels.find(l => l.id === pmLevelId) : allLevels[0];

        let totalScore = 0;
        const paramScores = pmRevs.map(rev => {
          const param = parameters.find(p => p.id === rev.parameterId);
          // Use the level snapshotted at review-entry time (if available) to
          // prevent a post-rollout level change from rescoring historical months.
          const revLevelId = (rev as any).levelIdSnapshot ?? pmLevelId;
          const recalculatedScore = calculateKpiScore(rev.parameterId, rev.value, revLevelId, parameters, allLevels, levelScores);
          totalScore += recalculatedScore;
          return {
            parameterId: rev.parameterId,
            parameterName: param?.name || "Unknown",
            value: rev.value,
            weightage: parseFloat(param?.weightage || "0"),
            score: recalculatedScore,
            notes: rev.notes,
          };
        });

        const graceInfo = graceByPm.get(pmId);
        const graceAdjustment = graceInfo?.total || 0;
        totalScore += graceAdjustment;

        const efficiency = totalWeightage > 0 ? Math.round((totalScore / totalWeightage) * 100) : 0;

        const targetInfo = autoCalcData.get(pmId);
        return {
          pmId,
          pmName: pm ? `${pm.firstName || ""} ${pm.lastName || ""}`.trim() : "Unknown",
          profileImageUrl: pm?.profileImageUrl,
          email: pm?.email || null,
          role: pm?.role || null,
          kpiLevelId: pmLevelId || null,
          kpiLevelName: pmLevel?.displayName || null,
          paramScores,
          totalScore,
          efficiency,
          reviewCount: pmRevs.length,
          graceAdjustment,
          graceScores: (graceInfo?.entries || []).map(g => ({
            id: g.id,
            points: parseFloat(g.points || "0"),
            reason: g.reason,
            reviewerName: g.reviewer ? `${g.reviewer.firstName || ""} ${g.reviewer.lastName || ""}`.trim() || g.reviewer.email : "Unknown",
            createdAt: g.createdAt,
          })),
          targetAchievement: targetInfo ? {
            targetAmount: targetInfo.targetAmount,
            receivedAmount: targetInfo.receivedAmount,
            achievementPercentage: targetInfo.achievementPercentage,
            projects: targetInfo.projects || [],
          } : null,
        };
      });

      performances.sort((a, b) => b.efficiency - a.efficiency);
      const topPerformer = performances.length > 0 ? performances[0] : null;

      res.json({
        month,
        year,
        performances,
        topPerformer,
        totalParameters: parameters.length,
        totalWeightage,
      });
    } catch (error) {
      console.error("Error calculating KPI performance:", error);
      res.status(500).json({ message: "Failed to calculate KPI performance" });
    }
  });

  app.get("/api/dashboard/my-performance", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      const currentUser = await storage.getUser(userId);
      if (!currentUser || currentUser.kpiExcluded) {
        return res.json({ available: false });
      }

      const [allReviews, parameters, myGraceScores] = await Promise.all([
        storage.getKpiMonthlyReviewsByPm(userId),
        storage.getAllKpiParameters(true),
        storage.getKpiGraceScoresByPm(userId),
      ]);

      if (allReviews.length === 0 && myGraceScores.length === 0) {
        return res.json({ available: false });
      }

      const allLevels = await storage.getAllKpiLevels(true);
      const levelScores = await storage.getAllKpiLevelScores();
      const graceByMonth = new Map<string, number>();
      for (const g of myGraceScores) {
        const key = `${g.year}-${g.month}`;
        graceByMonth.set(key, (graceByMonth.get(key) || 0) + parseFloat(g.points || "0"));
      }
      const totalWeightage = parameters.reduce((sum, p) => sum + parseFloat(p.weightage || "0"), 0);

      const monthlyData = new Map<string, typeof allReviews>();
      for (const review of allReviews) {
        const key = `${review.year}-${review.month}`;
        if (!monthlyData.has(key)) monthlyData.set(key, []);
        monthlyData.get(key)!.push(review);
      }
      // Include months that only have grace adjustments (no parameter reviews)
      for (const key of graceByMonth.keys()) {
        if (!monthlyData.has(key)) monthlyData.set(key, []);
      }

      const autoCalcParams = parameters.filter(p => p.isAutoCalculated && p.autoCalcType === "target_achievement");
      if (autoCalcParams.length > 0) {
        const uniqueMonths = new Set<string>();
        for (const review of allReviews) {
          uniqueMonths.add(`${review.year}-${review.month}`);
        }
        for (const key of graceByMonth.keys()) {
          uniqueMonths.add(key);
        }
        for (const key of uniqueMonths) {
          const [yr, mo] = key.split("-").map(Number);
          const receivedPayments = await storage.getAllPayments({ month: mo, year: yr, status: "received" as const });
          const pmTargetsData = await storage.getPmTargets(mo, yr);
          const pmTarget = pmTargetsData.find(t => t.pmId === userId);
          if (pmTarget) {
            let received = 0;
            for (const payment of receivedPayments) {
              if (payment.project?.pmId === userId) {
                received += parseFloat(payment.receivedAmount || "0");
              }
            }
            const targetAmt = parseFloat(pmTarget.targetAmount || "0");
            const percentage = targetAmt > 0 ? Math.round((received / targetAmt) * 100) : (received > 0 ? 100 : 0);
            for (const param of autoCalcParams) {
              if (!monthlyData.has(key)) monthlyData.set(key, []);
              const monthRevs = monthlyData.get(key)!;
              const existing = monthRevs.find(r => r.parameterId === param.id);
              if (!existing) {
                const pmLevelId = currentUser.kpiLevelId;
                const pmLevel = pmLevelId ? allLevels.find(l => l.id === pmLevelId) : allLevels[0];
                const valueStr = `${percentage}%`;
                let score = 0;
                if (pmLevel) {
                  const matchingScores = levelScores.filter(ls => ls.parameterId === param.id && ls.levelId === pmLevel.id);
                  for (const ls of matchingScores) {
                    if (ls.value === valueStr) { score = parseFloat(ls.scorePercentage || "0"); break; }
                  }
                  if (score === 0 && percentage > 0) {
                    score = Math.min(parseFloat(param.weightage || "0"), parseFloat(param.weightage || "0") * percentage / 100);
                  }
                }
                monthRevs.push({
                  id: `auto_${userId}_${param.id}_${mo}_${yr}`, pmId: userId, reviewerId: "system",
                  month: mo, year: yr, parameterId: param.id, value: valueStr,
                  score: score.toFixed(2), notes: null, createdAt: new Date(), updatedAt: new Date(),
                } as any);
              }
            }
          }
        }
      }

      const pmLevelId = currentUser.kpiLevelId;
      const months = Array.from(monthlyData.entries()).map(([key, reviews]) => {
        const [year, month] = key.split("-").map(Number);
        let totalScore = 0;
        const paramScores = reviews.map(rev => {
          const param = parameters.find(p => p.id === rev.parameterId);
          const recalculatedScore = calculateKpiScore(rev.parameterId, rev.value, pmLevelId, parameters, allLevels, levelScores);
          totalScore += recalculatedScore;
          return {
            parameterId: rev.parameterId,
            parameterName: param?.name || "Unknown",
            weightage: parseFloat(param?.weightage || "0"),
            score: recalculatedScore,
          };
        });
        const graceAdjustment = graceByMonth.get(key) || 0;
        totalScore += graceAdjustment;
        const efficiency = totalWeightage > 0 ? Math.round((totalScore / totalWeightage) * 100) : 0;
        return { month, year, efficiency, paramScores, totalScore, graceAdjustment };
      });

      months.sort((a, b) => b.year - a.year || b.month - a.month);
      const recentMonths = months.slice(0, 6);
      const avgEfficiency = months.length > 0
        ? Math.round(months.reduce((sum, m) => sum + m.efficiency, 0) / months.length)
        : 0;

      const trend = recentMonths.length >= 2
        ? recentMonths[0].efficiency - recentMonths[1].efficiency
        : 0;

      const latestParams = recentMonths.length > 0 ? recentMonths[0].paramScores : [];
      const sortedParams = [...latestParams].sort((a, b) => {
        const aRatio = a.weightage > 0 ? a.score / a.weightage : 0;
        const bRatio = b.weightage > 0 ? b.score / b.weightage : 0;
        return bRatio - aRatio;
      });

      res.json({
        available: true,
        averageEfficiency: avgEfficiency,
        trend,
        recentMonths: recentMonths.reverse().map(m => ({
          month: m.month,
          year: m.year,
          efficiency: m.efficiency,
        })),
        topParameters: sortedParams.slice(0, 3).map(p => ({ name: p.parameterName, score: p.score, weightage: p.weightage })),
        bottomParameters: sortedParams.slice(-3).reverse().map(p => ({ name: p.parameterName, score: p.score, weightage: p.weightage })),
        totalMonthsReviewed: months.length,
        latestEfficiency: recentMonths.length > 0 ? recentMonths[recentMonths.length - 1].efficiency : 0,
      });
    } catch (error) {
      console.error("Error fetching dashboard performance:", error);
      res.status(500).json({ message: "Failed to fetch performance data" });
    }
  });

  app.get("/api/dashboard/team-performance", isAuthenticated, requirePermission("manage_kpis"), async (req: any, res) => {
    try {
      const [allUsers, parameters, allLevels, levelScores] = await Promise.all([
        storage.getAllUsers(),
        storage.getAllKpiParameters(true),
        storage.getAllKpiLevels(true),
        storage.getAllKpiLevelScores(),
      ]);

      const eligiblePms = allUsers.filter(u => !u.kpiExcluded && u.status !== "inactive");
      const totalWeightage = parameters.reduce((sum, p) => sum + parseFloat(p.weightage || "0"), 0);

      const pmPerformances: Array<{ pmId: string; months: Array<{ month: number; year: number; efficiency: number; paramScores: Array<{ parameterId: string; parameterName: string; score: number; weightage: number }> }> }> = [];

      for (const pm of eligiblePms) {
        const reviews = await storage.getKpiMonthlyReviewsByPm(pm.id);
        if (reviews.length === 0) continue;

        const monthlyData = new Map<string, typeof reviews>();
        for (const review of reviews) {
          const key = `${review.year}-${review.month}`;
          if (!monthlyData.has(key)) monthlyData.set(key, []);
          monthlyData.get(key)!.push(review);
        }

        const pmLevelId = pm.kpiLevelId;
        const months = Array.from(monthlyData.entries()).map(([key, revs]) => {
          const [year, month] = key.split("-").map(Number);
          let totalScore = 0;
          const paramScores = revs.map(rev => {
            const param = parameters.find(p => p.id === rev.parameterId);
            const score = calculateKpiScore(rev.parameterId, rev.value, pmLevelId, parameters, allLevels, levelScores);
            totalScore += score;
            return { parameterId: rev.parameterId, parameterName: param?.name || "Unknown", score, weightage: parseFloat(param?.weightage || "0") };
          });
          const efficiency = totalWeightage > 0 ? Math.round((totalScore / totalWeightage) * 100) : 0;
          return { month, year, efficiency, paramScores };
        });

        pmPerformances.push({ pmId: pm.id, months });
      }

      if (pmPerformances.length === 0) {
        return res.json({ available: false });
      }

      const allMonthKeys = new Set<string>();
      for (const pm of pmPerformances) {
        for (const m of pm.months) {
          allMonthKeys.add(`${m.year}-${m.month}`);
        }
      }

      const monthlyTeamAvg = Array.from(allMonthKeys).map(key => {
        const [year, month] = key.split("-").map(Number);
        const pmMonths = pmPerformances
          .map(pm => pm.months.find(m => m.month === month && m.year === year))
          .filter(Boolean) as Array<{ efficiency: number }>;
        const avg = pmMonths.length > 0 ? Math.round(pmMonths.reduce((s, m) => s + m.efficiency, 0) / pmMonths.length) : 0;
        return { month, year, efficiency: avg };
      }).sort((a, b) => a.year - b.year || a.month - b.month);

      const recentMonths = monthlyTeamAvg.slice(-6);
      const overallAvg = monthlyTeamAvg.length > 0
        ? Math.round(monthlyTeamAvg.reduce((s, m) => s + m.efficiency, 0) / monthlyTeamAvg.length)
        : 0;
      const trend = recentMonths.length >= 2
        ? recentMonths[recentMonths.length - 1].efficiency - recentMonths[recentMonths.length - 2].efficiency
        : 0;

      const paramAggregates = new Map<string, { name: string; totalScore: number; totalWeightage: number; count: number }>();
      for (const pm of pmPerformances) {
        const latestMonth = [...pm.months].sort((a, b) => b.year - a.year || b.month - a.month)[0];
        if (latestMonth) {
          for (const ps of latestMonth.paramScores) {
            const existing = paramAggregates.get(ps.parameterId) || { name: ps.parameterName, totalScore: 0, totalWeightage: 0, count: 0 };
            existing.totalScore += ps.score;
            existing.totalWeightage += ps.weightage;
            existing.count += 1;
            paramAggregates.set(ps.parameterId, existing);
          }
        }
      }

      const sortedParams = Array.from(paramAggregates.values())
        .map(p => ({
          name: p.name,
          score: p.count > 0 ? p.totalScore / p.count : 0,
          weightage: p.count > 0 ? p.totalWeightage / p.count : 0,
        }))
        .sort((a, b) => {
          const aR = a.weightage > 0 ? a.score / a.weightage : 0;
          const bR = b.weightage > 0 ? b.score / b.weightage : 0;
          return bR - aR;
        });

      res.json({
        available: true,
        averageEfficiency: overallAvg,
        trend,
        recentMonths: recentMonths.map(m => ({ month: m.month, year: m.year, efficiency: m.efficiency })),
        topParameters: sortedParams.slice(0, 3).map(p => ({ name: p.name, score: Math.round(p.score * 100) / 100, weightage: Math.round(p.weightage * 100) / 100 })),
        bottomParameters: sortedParams.slice(-3).reverse().map(p => ({ name: p.name, score: Math.round(p.score * 100) / 100, weightage: Math.round(p.weightage * 100) / 100 })),
        totalMonthsReviewed: monthlyTeamAvg.length,
        latestEfficiency: recentMonths.length > 0 ? recentMonths[recentMonths.length - 1].efficiency : 0,
        totalPmsTracked: pmPerformances.length,
      });
    } catch (error) {
      console.error("Error fetching team performance:", error);
      res.status(500).json({ message: "Failed to fetch team performance data" });
    }
  });

  // KPI PM Report Card - all months for a specific PM
  app.get("/api/kpi/report-card/:pmId", isAuthenticated, requirePermission("view_kpis"), async (req: any, res) => {
    try {
      const { pmId } = req.params;
      const [allReviews, parameters, allUsers, pmGraceScores] = await Promise.all([
        storage.getKpiMonthlyReviewsByPm(pmId),
        storage.getAllKpiParameters(true),
        storage.getAllUsers(),
        storage.getKpiGraceScoresByPm(pmId),
      ]);

      const graceByMonth = new Map<string, { total: number; entries: typeof pmGraceScores }>();
      for (const g of pmGraceScores) {
        const key = `${g.year}-${g.month}`;
        const entry = graceByMonth.get(key) || { total: 0, entries: [] };
        entry.total += parseFloat(g.points || "0");
        entry.entries.push(g);
        graceByMonth.set(key, entry);
      }

      const autoCalcParams = parameters.filter(p => p.isAutoCalculated && p.autoCalcType === "target_achievement");
      const allLevels = await storage.getAllKpiLevels(true);
      const levelScores = await storage.getAllKpiLevelScores();

      const pm = allUsers.find(u => u.id === pmId);
      const totalWeightage = parameters.reduce((sum, p) => sum + parseFloat(p.weightage || "0"), 0);

      const monthlyData = new Map<string, typeof allReviews>();
      for (const review of allReviews) {
        const key = `${review.year}-${review.month}`;
        if (!monthlyData.has(key)) monthlyData.set(key, []);
        monthlyData.get(key)!.push(review);
      }
      // Include months that only have grace adjustments (no parameter reviews)
      for (const key of graceByMonth.keys()) {
        if (!monthlyData.has(key)) monthlyData.set(key, []);
      }

      if (autoCalcParams.length > 0) {
        const uniqueMonths = new Set<string>();
        for (const review of allReviews) {
          uniqueMonths.add(`${review.year}-${review.month}`);
        }
        for (const key of graceByMonth.keys()) {
          uniqueMonths.add(key);
        }

        for (const key of uniqueMonths) {
          const [yr, mo] = key.split("-").map(Number);
          const receivedPayments = await storage.getAllPayments({ month: mo, year: yr, status: "received" as const });
          const pmTargetsData = await storage.getPmTargets(mo, yr);

          const pmTarget = pmTargetsData.find(t => t.pmId === pmId);
          if (pmTarget) {
            let received = 0;
            for (const payment of receivedPayments) {
              if (payment.project?.pmId === pmId) {
                received += parseFloat(payment.receivedAmount || "0");
              }
            }

            const targetAmt = parseFloat(pmTarget.targetAmount || "0");
            const percentage = targetAmt > 0 ? Math.round((received / targetAmt) * 100) : (received > 0 ? 100 : 0);

            for (const param of autoCalcParams) {
              if (!monthlyData.has(key)) monthlyData.set(key, []);
              const monthRevs = monthlyData.get(key)!;
              const existing = monthRevs.find(r => r.parameterId === param.id);
              if (!existing) {
                const pmLevelId = pm?.kpiLevelId;
                const pmLevel = pmLevelId ? allLevels.find(l => l.id === pmLevelId) : allLevels[0];
                const valueStr = `${percentage}%`;

                let score = 0;
                if (pmLevel) {
                  const matchingScores = levelScores.filter(ls => ls.parameterId === param.id && ls.levelId === pmLevel.id);
                  for (const ls of matchingScores) {
                    if (ls.value === valueStr) {
                      score = parseFloat(ls.scorePercentage || "0");
                      break;
                    }
                  }
                  if (score === 0 && percentage > 0) {
                    score = Math.min(parseFloat(param.weightage || "0"), parseFloat(param.weightage || "0") * percentage / 100);
                  }
                }

                monthRevs.push({
                  id: `auto_${pmId}_${param.id}_${mo}_${yr}`,
                  pmId,
                  reviewerId: "system",
                  month: mo,
                  year: yr,
                  parameterId: param.id,
                  value: valueStr,
                  score: score.toFixed(2),
                  notes: `Target: $${targetAmt.toLocaleString()} | Received: $${received.toLocaleString()}`,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                } as any);
              }
            }
          }
        }
      }

      const pmLevelId = pm?.kpiLevelId;

      const months = Array.from(monthlyData.entries()).map(([key, reviews]) => {
        const [year, month] = key.split("-").map(Number);
        let totalScore = 0;
        const paramScores = reviews.map(rev => {
          const param = parameters.find(p => p.id === rev.parameterId);
          const recalculatedScore = calculateKpiScore(rev.parameterId, rev.value, pmLevelId, parameters, allLevels, levelScores);
          totalScore += recalculatedScore;
          return {
            parameterId: rev.parameterId,
            parameterName: param?.name || "Unknown",
            value: rev.value,
            weightage: parseFloat(param?.weightage || "0"),
            score: recalculatedScore,
            notes: rev.notes,
          };
        });

        const graceInfo = graceByMonth.get(key);
        const graceAdjustment = graceInfo?.total || 0;
        totalScore += graceAdjustment;

        const efficiency = totalWeightage > 0 ? Math.round((totalScore / totalWeightage) * 100) : 0;

        return {
          month,
          year,
          paramScores,
          totalScore,
          efficiency,
          graceAdjustment,
          graceScores: (graceInfo?.entries || []).map(g => ({
            id: g.id,
            points: parseFloat(g.points || "0"),
            reason: g.reason,
            reviewerName: g.reviewer ? `${g.reviewer.firstName || ""} ${g.reviewer.lastName || ""}`.trim() || g.reviewer.email : "Unknown",
            createdAt: g.createdAt,
          })),
        };
      });

      months.sort((a, b) => b.year - a.year || b.month - a.month);

      const avgEfficiency = months.length > 0 
        ? Math.round(months.reduce((sum, m) => sum + m.efficiency, 0) / months.length)
        : 0;

      res.json({
        pmId,
        pmName: pm ? `${pm.firstName || ""} ${pm.lastName || ""}`.trim() : "Unknown",
        profileImageUrl: pm?.profileImageUrl,
        email: pm?.email,
        months,
        averageEfficiency: avgEfficiency,
        totalMonthsReviewed: months.length,
        parameters,
      });
    } catch (error) {
      console.error("Error fetching PM report card:", error);
      res.status(500).json({ message: "Failed to fetch PM report card" });
    }
  });

  // KPI Grace Scores - manual positive/negative adjustments per PM/month
  app.get("/api/kpi/grace-scores", isAuthenticated, requirePermission("view_kpis"), async (req: any, res) => {
    try {
      const month = parseInt(req.query.month);
      const year = parseInt(req.query.year);
      if (isNaN(month) || isNaN(year)) {
        return res.status(400).json({ message: "month and year are required" });
      }
      const graceScores = await storage.getKpiGraceScores(month, year);
      res.json(graceScores);
    } catch (error) {
      console.error("Error fetching grace scores:", error);
      res.status(500).json({ message: "Failed to fetch grace scores" });
    }
  });

  app.post("/api/kpi/grace-scores", isAuthenticated, requirePermission("manage_kpis"), async (req: any, res) => {
    try {
      const reviewerId = req.user?.claims?.sub;
      if (!reviewerId) return res.status(401).json({ message: "Not authenticated" });

      const parsed = insertKpiGraceScoreSchema.safeParse({ ...req.body, reviewerId });
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid grace score", errors: parsed.error.flatten() });
      }

      const pmUser = await storage.getUser(parsed.data.pmId);
      if (!pmUser) return res.status(400).json({ message: "User not found" });

      const created = await storage.createKpiGraceScore(parsed.data);
      await logActivityInternal(
        reviewerId,
        "create",
        "kpi_grace_score",
        created.id,
        `Added ${parseFloat(created.points) >= 0 ? "+" : ""}${created.points} grace points for ${pmUser.email} (${created.month}/${created.year}): ${created.reason}`,
        req,
      );
      res.status(201).json(created);
    } catch (error) {
      console.error("Error creating grace score:", error);
      res.status(500).json({ message: "Failed to create grace score" });
    }
  });

  app.delete("/api/kpi/grace-scores/:id", isAuthenticated, requirePermission("manage_kpis"), async (req: any, res) => {
    try {
      const adminId = req.user?.claims?.sub;
      const deleted = await storage.deleteKpiGraceScore(req.params.id);
      if (!deleted) return res.status(404).json({ message: "Grace score not found" });
      await logActivityInternal(
        adminId,
        "delete",
        "kpi_grace_score",
        req.params.id,
        `Deleted grace score adjustment`,
        req,
      );
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting grace score:", error);
      res.status(500).json({ message: "Failed to delete grace score" });
    }
  });

  // ===== Appraisal Grades =====
  app.get("/api/kpi/grades", isAuthenticated, requirePermission("view_kpis"), async (_req: any, res) => {
    try {
      res.json(await storage.getAllGrades());
    } catch (error) {
      console.error("Error fetching grades:", error);
      res.status(500).json({ message: "Failed to fetch grades" });
    }
  });

  app.post("/api/kpi/grades", isAuthenticated, requirePermission("manage_kpis"), async (req: any, res) => {
    try {
      const parsed = insertGradeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid grade", errors: parsed.error.flatten() });
      }
      const created = await storage.createGrade(parsed.data);
      await logActivityInternal(req.user?.claims?.sub, "create", "grade", created.id, `Created grade: ${created.name}`, req);
      res.status(201).json(created);
    } catch (error) {
      console.error("Error creating grade:", error);
      res.status(500).json({ message: "Failed to create grade" });
    }
  });

  app.patch("/api/kpi/grades/:id", isAuthenticated, requirePermission("manage_kpis"), async (req: any, res) => {
    try {
      const parsed = insertGradeSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid grade", errors: parsed.error.flatten() });
      }
      const updated = await storage.updateGrade(req.params.id, parsed.data);
      if (!updated) return res.status(404).json({ message: "Grade not found" });
      await logActivityInternal(req.user?.claims?.sub, "update", "grade", updated.id, `Updated grade: ${updated.name}`, req);
      res.json(updated);
    } catch (error) {
      console.error("Error updating grade:", error);
      res.status(500).json({ message: "Failed to update grade" });
    }
  });

  app.delete("/api/kpi/grades/:id", isAuthenticated, requirePermission("manage_kpis"), async (req: any, res) => {
    try {
      const grade = await storage.getGrade(req.params.id);
      const deleted = await storage.deleteGrade(req.params.id);
      if (!deleted) return res.status(404).json({ message: "Grade not found" });
      await logActivityInternal(req.user?.claims?.sub, "delete", "grade", req.params.id, `Deleted grade: ${grade?.name || req.params.id}`, req);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting grade:", error);
      res.status(500).json({ message: "Failed to delete grade" });
    }
  });

  // ===== Salary Grade Bands (grade sheet) =====
  app.get("/api/kpi/grade-bands", isAuthenticated, requirePermission("view_kpis"), async (_req: any, res) => {
    try {
      res.json(await storage.getAllSalaryGradeBands());
    } catch (error) {
      console.error("Error fetching grade bands:", error);
      res.status(500).json({ message: "Failed to fetch grade bands" });
    }
  });

  app.put("/api/kpi/grade-bands", isAuthenticated, requirePermission("manage_kpis"), async (req: any, res) => {
    try {
      const bands = Array.isArray(req.body?.bands) ? req.body.bands : [];
      // Match each row's designation name to an existing Designation (grades table).
      const allGrades = await storage.getAllGrades();
      const gradeByName = new Map(allGrades.map((g) => [g.name.trim().toLowerCase(), g]));

      const parsed: any[] = [];
      const skipped: { designationName: string; gradeCode: string | null }[] = [];
      for (const b of bands) {
        const desigName = String(b?.designationName ?? "").trim();
        const designation = desigName ? gradeByName.get(desigName.toLowerCase()) : undefined;
        if (!designation) {
          skipped.push({ designationName: desigName || "(blank)", gradeCode: b?.gradeCode ?? null });
          continue;
        }
        const r = insertSalaryGradeBandSchema.safeParse({
          ...b,
          designationId: designation.id,
          designationName: designation.name,
        });
        if (!r.success) {
          return res.status(400).json({ message: "Invalid band row", errors: r.error.flatten() });
        }
        parsed.push(r.data);
      }
      const replaced = await storage.replaceSalaryGradeBands(parsed);
      await logActivityInternal(req.user?.claims?.sub, "update", "salary_grade_band", "bulk", `Replaced salary grade sheet with ${replaced.length} grades (${skipped.length} skipped)`, req);
      res.json({ bands: replaced, skipped });
    } catch (error) {
      console.error("Error replacing grade bands:", error);
      res.status(500).json({ message: "Failed to replace grade bands" });
    }
  });

  // ===== Appraisals =====
  app.get("/api/kpi/appraisals", isAuthenticated, requirePermission("view_kpis"), async (req: any, res) => {
    try {
      const periodMonths = parseInt(req.query.periodMonths);
      const periodEndMonth = parseInt(req.query.periodEndMonth);
      const periodEndYear = parseInt(req.query.periodEndYear);
      if (isNaN(periodMonths) || isNaN(periodEndMonth) || isNaN(periodEndYear)) {
        return res.status(400).json({ message: "periodMonths, periodEndMonth and periodEndYear are required" });
      }
      const all = await storage.getAppraisals(periodMonths, periodEndMonth, periodEndYear);
      // Only managers see the full cycle. Anyone else (e.g. a PM with view_kpis)
      // is restricted to their own appraisal, and only once it's finalized.
      const userId = req.user?.claims?.sub;
      const reqUser = await storage.getUser(userId);
      const perms = await storage.getUserPermissions(userId);
      const canManage = reqUser?.role === "admin" || reqUser?.role === "administrator" || perms.includes("manage_kpis");
      const result = canManage ? all : all.filter((a) => a.pmId === userId && (a.status === "finalized" || a.status === "rolled_out"));
      res.json(result);
    } catch (error) {
      console.error("Error fetching appraisals:", error);
      res.status(500).json({ message: "Failed to fetch appraisals" });
    }
  });

  // A project manager's own finalized appraisal history (all cycles). Available
  // to any authenticated user; returns only finalized records for that user.
  app.get("/api/kpi/appraisals/mine", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      res.json(await storage.getUserAppraisals(userId));
    } catch (error) {
      console.error("Error fetching own appraisals:", error);
      res.status(500).json({ message: "Failed to fetch appraisals" });
    }
  });

  app.post(
    "/api/kpi/appraisals/generate",
    isAuthenticated,
    requirePermission("manage_kpis"),
    makeGenerateAppraisalsHandler(storage, logActivityInternal),
  );

  app.patch("/api/kpi/appraisals/:id", isAuthenticated, requirePermission("manage_kpis"), async (req: any, res) => {
    try {
      const adminId = req.user?.claims?.sub;
      const appraisal = await storage.getAppraisal(req.params.id);
      if (!appraisal) return res.status(404).json({ message: "Appraisal not found" });

      // A rolled-out appraisal is locked: its verdict, grade and pay band are
      // already applied to the employee, so no further edits or status reverts
      // are allowed via this route.
      if (appraisal.status === "rolled_out") {
        return res.status(409).json({ message: "This appraisal has been rolled out and can no longer be edited." });
      }

      const update: any = {};

      // Status change only
      if (req.body.status === "finalized" || req.body.status === "draft") {
        update.status = req.body.status;
      }

      // Eligibility override toggle: admin can force an ineligible-by-service PM
      // to be eligible. Recomputes eligible + eligibilityReason inline.
      if (typeof req.body.eligibilityOverride === "boolean") {
        const override = req.body.eligibilityOverride;
        update.eligibilityOverride = override;
        if (override) {
          // Override ON: eligible if grade + grade band + score requirements are met
          const hasGrade = !!appraisal.gradeId;
          const hasGradeBand = !!appraisal.currentGradeBandId;
          const targetScoreNum = parseFloat(appraisal.targetScore || "0");
          const avgScoreNum = parseFloat(appraisal.averageScore || "0");
          const meetsScore = hasGrade && avgScoreNum > targetScoreNum;
          update.eligible = hasGrade && hasGradeBand && meetsScore;
          update.eligibilityReason = update.eligible
            ? "Eligibility override by admin"
            : appraisal.eligibilityReason?.replace(/Less than 1 year service[^;]*;?\s*/gi, "").trim() || null;
        } else {
          // Override OFF: restore service-based eligibility from stored servedMonths
          const servedMonths = appraisal.servedMonths;
          const hasService = servedMonths !== null && servedMonths >= 12;
          const hasGrade = !!appraisal.gradeId;
          const hasGradeBand = !!appraisal.currentGradeBandId;
          const targetScoreNum = parseFloat(appraisal.targetScore || "0");
          const avgScoreNum = parseFloat(appraisal.averageScore || "0");
          const meetsScore = hasGrade && avgScoreNum > targetScoreNum;
          update.eligible = hasService && hasGrade && hasGradeBand && meetsScore;
          const reasons: string[] = [];
          if (servedMonths === null) reasons.push("No joining date set");
          else if (servedMonths < 12) reasons.push(`Less than 1 year service (${servedMonths} mo)`);
          if (!hasGrade) reasons.push("No designation assigned");
          if (!hasGradeBand) reasons.push("No grade assigned");
          if (hasGrade && !meetsScore) reasons.push(`Avg score ${avgScoreNum.toFixed(1)} not above target ${targetScoreNum.toFixed(1)}`);
          update.eligibilityReason = reasons.length > 0 ? reasons.join("; ") : null;
        }
      }

      const hasFinancialOverride =
        req.body.baseIncrementPct !== undefined ||
        req.body.hpPct !== undefined ||
        req.body.currentSalary !== undefined ||
        req.body.assignedBandId !== undefined;

      if (hasFinancialOverride) {
        const allBands = await storage.getAllSalaryGradeBands();
        // Auto-snap (no explicit assignedBandId) still snaps only within the
        // appraisal's Designation, matching normal generation. But an
        // explicit assignedBandId is a manual override decision, so it must
        // be validated against the same ascending, cross-designation
        // candidate list the dropdown offers (current band onward) — not
        // just the current designation — or a promotion into a higher
        // designation would be rejected as "Band not found".
        const designationBands = appraisal.gradeId
          ? allBands.filter((b) => b.designationId === appraisal.gradeId)
          : [];
        // Any manual band decision — a new explicit pick, an explicit clear,
        // or simply keeping a previously-picked band while only editing
        // Base%/HP% — must be resolved against the full ascending,
        // cross-designation candidate list, or a cross-designation pick
        // would be rejected as "Band not found" (explicit pick) or silently
        // wiped to null (kept pick). Pure auto-snap (never overridden) still
        // stays within the current designation, matching normal generation.
        const isManualBandDecision = req.body.assignedBandId !== undefined || !!appraisal.bandOverridden;
        const validationBands = isManualBandDecision
          ? buildAscendingGradeCandidates(
              allBands,
              await storage.getAllGrades(),
              appraisal.currentGradeBandId,
              appraisal.gradeId,
            )
          : designationBands;
        const recomputed = recomputeOverride(appraisal, req.body, validationBands);
        Object.assign(update, recomputed);
        // Keep the assigned grade-code snapshot in sync with the chosen band.
        const assignedBand = recomputed.assignedBandId
          ? allBands.find((b) => b.id === recomputed.assignedBandId)
          : undefined;
        update.assignedGradeCode = assignedBand?.gradeCode ?? null;
      }

      const updated = await storage.updateAppraisal(req.params.id, update);
      await logActivityInternal(adminId, "update", "appraisal", req.params.id, `Updated appraisal${update.status ? ` (status: ${update.status})` : " (overrides)"}`, req);
      res.json(updated);
    } catch (error: any) {
      if (error instanceof AppraisalOverrideError || error?.message?.startsWith("Invalid ")) {
        return res.status(400).json({ message: error.message });
      }
      console.error("Error updating appraisal:", error);
      res.status(500).json({ message: "Failed to update appraisal" });
    }
  });

  // Derive a PM's KPI level from their new PKR salary after rollout. Uses three
  // brackets matching the displayName/name of kpi_levels rows:
  //   ≤100,000 PKR → Junior   |  ≤300,000 PKR → Mid   |  >300,000 PKR → Senior
  // Fails silently — never breaks the rollout itself.
  async function deriveAndApplyKpiLevel(pmId: string | null, assignedSalary: string | number | null) {
    try {
      if (!pmId || assignedSalary === null || assignedSalary === undefined || assignedSalary === "") return;
      const salary = typeof assignedSalary === "number" ? assignedSalary : parseFloat(assignedSalary as string);
      if (!isFinite(salary) || salary <= 0) return;

      const allLevels = await storage.getAllKpiLevels(true);
      if (!allLevels.length) return;

      const bracket = salary <= 100_000 ? "junior" : salary <= 300_000 ? "mid" : "senior";
      const matched = allLevels.find((l: any) =>
        (l.displayName || l.name || "").toLowerCase().startsWith(bracket),
      );
      if (!matched) return;
      if (matched.id) await storage.updateUser(pmId, { kpiLevelId: matched.id });
    } catch (levelErr) {
      console.error("deriveAndApplyKpiLevel failed (non-fatal):", levelErr);
    }
  }

  // Board "Rollout": the final, separate-from-Finalize step. The board confirms a
  // verdict + comment per employee, then the appraisal is locked as "rolled_out"
  // and the new designation + pay band are applied to the employee — atomically
  // (see storage.rollOutAppraisal). Idempotent: re-rolling an already rolled-out
  // appraisal is a no-op and never re-notifies. Notification + email are sent
  // after the transaction commits and are fail-soft (they never fail the rollout).
  // After a fresh rollout, the PM's KPI level is also derived from their new PKR
  // salary (fail-soft, does not block the response).
  app.post(
    "/api/kpi/appraisals/:id/rollout",
    isAuthenticated,
    requirePermission("manage_kpis"),
    async (req: any, res) => {
      try {
        const deps = {
          storage,
          logActivity: logActivityInternal,
          sendEmail: sendAppraisalRolloutEmail,
          generateToken: () => crypto.randomBytes(24).toString("base64url"),
        };
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
        // Derive KPI level from new salary after a fresh (non-idempotent) rollout.
        if (!result.alreadyRolledOut && result.appraisal?.pmId) {
          await deriveAndApplyKpiLevel(result.appraisal.pmId, result.appraisal.assignedSalary);
        }
        res.json(result.appraisal);
      } catch (error) {
        console.error("Error rolling out appraisal:", error);
        res.status(500).json({ message: "Failed to roll out appraisal" });
      }
    },
  );

  // Board "Full Roll Out" console batch endpoint: roll out many appraisals for a
  // cycle in one request. Each item carries the board's verdict/comment and any
  // inline final-grade / final-salary edit; we loop the shared performRollout
  // helper so locking, notifications, email, and idempotency stay identical to
  // the single-row route. One failing/already-rolled-out row never aborts the
  // rest — each result is reported back individually.
  app.post("/api/kpi/appraisals/rollout-batch", isAuthenticated, requirePermission("manage_kpis"), async (req: any, res) => {
    try {
      const adminId = req.user?.claims?.sub ?? null;
      const items = Array.isArray(req.body?.items) ? req.body.items : [];
      if (items.length === 0) return res.status(400).json({ message: "No appraisals to roll out." });

      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const deps = {
        storage,
        logActivity: logActivityInternal,
        sendEmail: sendAppraisalRolloutEmail,
        generateToken: () => crypto.randomBytes(24).toString("base64url"),
      };

      const results: { id: string | null; ok: boolean; alreadyRolledOut?: boolean; message?: string }[] = [];
      for (const item of items) {
        if (!item?.id || typeof item.id !== "string") {
          results.push({ id: item?.id ?? null, ok: false, message: "Missing appraisal id" });
          continue;
        }
        try {
          const r = await performRollout(deps, {
            id: item.id,
            finalVerdict: item.finalVerdict,
            boardComment: item.boardComment,
            assignedBandId: item.assignedBandId,
            assignedSalary: item.assignedSalary,
            adminId,
            baseUrl,
            req,
          });
          if (r.ok) {
            results.push({ id: item.id, ok: true, alreadyRolledOut: !!r.alreadyRolledOut });
            if (!r.alreadyRolledOut && r.appraisal?.pmId) {
              await deriveAndApplyKpiLevel(r.appraisal.pmId, r.appraisal.assignedSalary);
            }
          } else results.push({ id: item.id, ok: false, message: r.message });
        } catch (itemErr) {
          console.error(`Batch rollout failed for ${item.id}:`, itemErr);
          results.push({ id: item.id, ok: false, message: "Failed to roll out" });
        }
      }

      const rolledOut = results.filter((r) => r.ok && !r.alreadyRolledOut).length;
      const skipped = results.filter((r) => r.ok && r.alreadyRolledOut).length;
      const failed = results.filter((r) => !r.ok).length;
      res.json({ results, summary: { rolledOut, skipped, failed, total: results.length } });
    } catch (error) {
      console.error("Error in batch rollout:", error);
      res.status(500).json({ message: "Failed to roll out appraisals" });
    }
  });

  // Undo an accidental rollout: revert the appraisal to "finalized", clear the
  // board's verdict/comment + rollout metadata, and restore the employee's
  // pre-rollout grade/pay band (see storage.undoRollout). Idempotent: undoing an
  // appraisal that isn't currently rolled out is a no-op.
  app.post("/api/kpi/appraisals/:id/undo-rollout", isAuthenticated, requirePermission("manage_kpis"), async (req: any, res) => {
    try {
      const adminId = req.user?.claims?.sub;
      const appraisal = await storage.getAppraisalWithPm(req.params.id);
      if (!appraisal) return res.status(404).json({ message: "Appraisal not found" });

      // Not rolled out — nothing to undo. Return the current record idempotently.
      if (appraisal.status !== "rolled_out") {
        return res.json({ ...appraisal, alreadyUndone: true });
      }

      const updated = await storage.undoRollout(req.params.id);
      // 0 rows means a concurrent request already undid it — return current record.
      if (!updated) {
        const current = await storage.getAppraisalWithPm(req.params.id);
        return res.json({ ...current, alreadyUndone: true });
      }

      const personName = [appraisal.pm?.firstName, appraisal.pm?.lastName].filter(Boolean).join(" ").trim() || "employee";
      await logActivityInternal(adminId, "update", "appraisal", req.params.id, `Undid rollout for ${personName} (reverted to finalized, prior grade restored)`, req);
      res.json(updated);
    } catch (error) {
      console.error("Error undoing rollout:", error);
      res.status(500).json({ message: "Failed to undo rollout" });
    }
  });

  // Generate (or re-generate) an on-demand AI performance analysis for a single
  // appraisal and persist it on the record so it reloads and can be reused.
  app.post("/api/kpi/appraisals/:id/ai-analysis", isAuthenticated, requirePermission("manage_kpis"), async (req: any, res) => {
    try {
      const adminId = req.user?.claims?.sub;
      const appraisal = await storage.getAppraisal(req.params.id);
      if (!appraisal) return res.status(404).json({ message: "Appraisal not found" });

      // Optional provider override; otherwise the first configured one is used.
      let provider: "openai" | "anthropic" | undefined;
      if (req.body?.provider !== undefined) {
        const parsed = z.enum(upsellAiProviders).safeParse(req.body.provider);
        if (!parsed.success) {
          return res.status(400).json({ message: "provider must be 'openai' or 'anthropic'" });
        }
        provider = parsed.data;
      }

      if ((await configuredProviders()).length === 0) {
        return res.status(503).json({
          message: "No AI provider is configured. Add an OpenAI or Claude (Anthropic) API key in Settings to enable analysis.",
          code: "PROVIDER_NOT_CONFIGURED",
        });
      }

      const pm = await storage.getUser(appraisal.pmId);
      // Avoid sending PII (e.g. email) to the external AI provider; fall back to a
      // generic label when no display name is available.
      const personName = pm
        ? [pm.firstName, pm.lastName].filter(Boolean).join(" ").trim() || "This employee"
        : "This employee";

      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const periodLabel = `${appraisal.periodMonths}-month cycle ending ${monthNames[appraisal.periodEndMonth - 1]} ${appraisal.periodEndYear}`;

      const num = (v: string | null) => {
        if (v == null || v === "") return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      };
      const input: AppraisalAnalysisInput = {
        personName,
        designation: appraisal.gradeName ?? null,
        periodLabel,
        averageScore: num(appraisal.averageScore),
        targetScore: num(appraisal.targetScore),
        baseIncrementPct: num(appraisal.baseIncrementPct),
        hpPct: num(appraisal.hpPct),
        servedMonths: appraisal.servedMonths ?? null,
        eligible: appraisal.eligible,
        eligibilityReason: appraisal.eligibilityReason ?? null,
        currentGradeCode: appraisal.currentGradeCode ?? null,
        assignedGradeCode: appraisal.assignedGradeCode ?? null,
      };

      let generated;
      try {
        generated = await generateAppraisalAnalysis(input, provider);
      } catch (err) {
        if (err instanceof ProviderNotConfiguredError) {
          return res.status(503).json({ message: err.message, code: "PROVIDER_NOT_CONFIGURED" });
        }
        console.error(`Appraisal AI analysis failed for ${req.params.id}:`, err);
        return res.status(502).json({
          message: "The AI provider could not complete the analysis. Please try again.",
          code: "PROVIDER_ERROR",
        });
      }

      const updated = await storage.updateAppraisal(req.params.id, {
        aiAnalysis: generated.insights,
        aiAnalysisProvider: generated.provider,
        aiAnalysisModel: generated.model,
        aiAnalysisAt: new Date(),
      });
      await logActivityInternal(adminId, "update", "appraisal", req.params.id, `Generated AI performance analysis for ${personName}`, req);
      res.json(updated);
    } catch (error) {
      console.error("Error generating appraisal AI analysis:", error);
      res.status(500).json({ message: "Failed to generate AI analysis" });
    }
  });

  // Build the full, self-contained report payload for a single appraisal. Loads
  // the person's display name (never their email) and both pay-grade bands so the
  // report page — including the no-login public version — needs no other call.
  async function buildAppraisalReport(a: AppraisalWithPm): Promise<AppraisalReport> {
    const bands = await storage.getAllSalaryGradeBands();
    const findBand = (id: string | null): SalaryGradeBand | null =>
      id ? bands.find((b) => b.id === id) ?? null : null;
    const personName =
      [a.pm?.firstName, a.pm?.lastName].filter(Boolean).join(" ").trim() || "Employee";
    const avgN = a.averageScore == null || a.averageScore === "" ? null : Number(a.averageScore);
    return {
      id: a.id,
      personName,
      designation: a.gradeName ?? null,
      periodMonths: a.periodMonths,
      periodEndMonth: a.periodEndMonth,
      periodEndYear: a.periodEndYear,
      status: a.status,
      finalVerdict: a.finalVerdict ?? null,
      boardComment: a.boardComment ?? null,
      rolledOutAt: a.rolledOutAt ? a.rolledOutAt.toISOString() : null,
      overallPerformancePct: avgN != null && Number.isFinite(avgN) ? avgN : null,
      averageScore: a.averageScore ?? null,
      targetScore: a.targetScore ?? null,
      hpPct: a.hpPct ?? null,
      baseIncrementPct: a.baseIncrementPct ?? null,
      servedMonths: a.servedMonths ?? null,
      eligible: a.eligible,
      eligibilityReason: a.eligibilityReason ?? null,
      currentSalary: a.currentSalary ?? null,
      assignedSalary: a.assignedSalary ?? null,
      finalIncrement: a.finalIncrement ?? null,
      currentGradeCode: a.currentGradeCode ?? null,
      assignedGradeCode: a.assignedGradeCode ?? null,
      currentBand: findBand(a.currentGradeBandId),
      newBand: findBand(a.assignedBandId),
      aiAnalysis: a.aiAnalysis ?? null,
      aiAnalysisAt: a.aiAnalysisAt ? a.aiAnalysisAt.toISOString() : null,
    };
  }

  // Admin: create or rotate the private share token for an appraisal. Returns
  // the token and the relative report path the admin can copy and forward.
  app.post("/api/kpi/appraisals/:id/share-link", isAuthenticated, requirePermission("manage_kpis"), async (req: any, res) => {
    try {
      const adminId = req.user?.claims?.sub;
      const appraisal = await storage.getAppraisal(req.params.id);
      if (!appraisal) return res.status(404).json({ message: "Appraisal not found" });
      const token = crypto.randomBytes(24).toString("base64url");
      await storage.updateAppraisal(req.params.id, { shareToken: token });
      await logActivityInternal(adminId, "update", "appraisal", req.params.id, "Generated a performance report share link", req);
      res.json({ shareToken: token, path: `/r/appraisal/${token}` });
    } catch (error) {
      console.error("Error generating appraisal share link:", error);
      res.status(500).json({ message: "Failed to generate share link" });
    }
  });

  // Admin: revoke an appraisal's share token so the public link stops working.
  app.delete("/api/kpi/appraisals/:id/share-link", isAuthenticated, requirePermission("manage_kpis"), async (req: any, res) => {
    try {
      const adminId = req.user?.claims?.sub;
      const appraisal = await storage.getAppraisal(req.params.id);
      if (!appraisal) return res.status(404).json({ message: "Appraisal not found" });
      await storage.updateAppraisal(req.params.id, { shareToken: null });
      await logActivityInternal(adminId, "update", "appraisal", req.params.id, "Revoked a performance report share link", req);
      res.json({ ok: true });
    } catch (error) {
      console.error("Error revoking appraisal share link:", error);
      res.status(500).json({ message: "Failed to revoke share link" });
    }
  });

  // Authenticated report for a single appraisal. A manager can view any; anyone
  // else may only view their own (and only once it's finalized, matching the
  // self-service "My Appraisals" rule).
  app.get("/api/kpi/appraisals/:id/report", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const appraisal = await storage.getAppraisalWithPm(req.params.id);
      if (!appraisal) return res.status(404).json({ message: "Appraisal not found" });

      const reqUser = await storage.getUser(userId);
      const perms = await storage.getUserPermissions(userId);
      const canManage = reqUser?.role === "admin" || reqUser?.role === "administrator" || perms.includes("manage_kpis");
      const isOwner = appraisal.pmId === userId && (appraisal.status === "finalized" || appraisal.status === "rolled_out");
      if (!canManage && !isOwner) {
        return res.status(403).json({ message: "You don't have access to this report" });
      }
      res.json(await buildAppraisalReport(appraisal));
    } catch (error) {
      console.error("Error building appraisal report:", error);
      res.status(500).json({ message: "Failed to load report" });
    }
  });

  // Public, no-login report reached only via a valid, unguessable share token.
  // Authorizes strictly by token; never exposes any other appraisal.
  app.get("/api/public/appraisal-report/:token", async (req, res) => {
    try {
      const token = req.params.token;
      if (!token || token.length < 16) return res.status(404).json({ message: "Report not found" });
      const appraisal = await storage.getAppraisalByShareToken(token);
      if (!appraisal) return res.status(404).json({ message: "Report not found" });
      res.set("Cache-Control", "no-store");
      res.json(await buildAppraisalReport(appraisal));
    } catch (error) {
      console.error("Error building public appraisal report:", error);
      res.status(500).json({ message: "Failed to load report" });
    }
  });

  return httpServer;
}
