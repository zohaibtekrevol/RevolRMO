import {
  sessions,
  users,
  projects,
  payments,
  monthlyPlans,
  activityLogs,
  appSettings,
  smtpSettings,
  pmTargets,
  notifications,
  notificationResponses,
  dismissedAlerts,
  regionBankingDetails,
  upsells,
  upsellActivities,
  upsellTypeSettings,
  defaultUpsellTypes,
  defaultUpsellCategories,
  roles,
  rolePermissions,
  defaultRoles,
  projectMilestones,
  changeRequests,
  crTags,
  changeRequestTags,
  crInstallments,
  invoices,
  invoiceLineItems,
  dataImports,
  timesheets,
  projectEstimatedCosts,
  projectActualCosts,
  vendorCosts,
  toolCosts,
  marginSettings,
  forecastEntries,
  type User,
  type InsertUser,
  type UpsertUser,
  type Project,
  type InsertProject,
  type Payment,
  type InsertPayment,
  type MonthlyPlan,
  type InsertMonthlyPlan,
  type PaymentWithProject,
  type ProjectWithPM,
  type ProjectWithMilestones,
  type DashboardStats,
  type Region,
  type PaymentStatus,
  type PaymentType,
  type ActivityLog,
  type InsertActivityLog,
  type ActivityLogWithUser,
  type AppSettings,
  type UpdateAppSettings,
  type MonthlyPlanSummary,
  type PaymentWithDetails,
  type PmTarget,
  type InsertPmTarget,
  type PmTargetWithUser,
  type Notification,
  type InsertNotification,
  type NotificationWithDetails,
  type NotificationResponse,
  type InsertNotificationResponse,
  type NotificationResponseWithDetails,
  type RegionBankingDetails,
  type InsertRegionBankingDetails,
  type UpdateRegionBankingDetails,
  type Upsell,
  type InsertUpsell,
  type UpdateUpsell,
  type UpsellActivity,
  type InsertUpsellActivity,
  type UpsellWithDetails,
  type UpsellActivityWithUser,
  type UpsellStatus,
  type UpsellTypeSetting,
  type InsertUpsellTypeSetting,
  type UpdateUpsellTypeSetting,
  type Role,
  type InsertRole,
  type UpdateRole,
  type RolePermission,
  type InsertRolePermission,
  type RoleWithPermissions,
  type SystemPermission,
  type ProjectMilestone,
  type InsertMilestone,
  type UpdateMilestone,
  type MilestoneWithPayment,
  type ChangeRequest,
  type InsertChangeRequest,
  type UpdateChangeRequest,
  type ChangeRequestWithInstallments,
  type SoldUpsell,
  type CrTag,
  type InsertCrTag,
  upsellAiAnalyses,
  type UpsellAiAnalysis,
  type InsertUpsellAiAnalysis,
  type UpsellAiAnalysisWithUser,
  type UpsellAnalysisScope,
  aiProviderSettings,
  type AiProviderSettings,
  type InsertAiProviderSettings,
  type UpsellAiProvider,
  type CrInstallmentWithPayment,
  type CrInstallment,
  type InsertCrInstallment,
  type UpdateCrInstallment,
  projectDriveFolders,
  type ProjectDriveFolder,
  type InsertProjectDriveFolder,
  type MilestoneStatus,
  type Invoice,
  type InsertInvoice,
  type UpdateInvoice,
  type InvoiceLineItem,
  type InsertInvoiceLineItem,
  type DataImport,
  type InsertDataImport,
  type InvoiceWithDetails,
  type InvoiceListItem,
  type InvoiceStatus,
  type SMTPSettings,
  type InsertSMTPSettings,
  type UpdateSMTPSettings,
  type Timesheet,
  type InsertTimesheet,
  type UpdateTimesheet,
  type TimesheetWithDetails,
  type TimesheetStatus,
  type ProjectEstimatedCost,
  type InsertProjectEstimatedCost,
  type UpdateProjectEstimatedCost,
  type ProjectActualCost,
  type InsertProjectActualCost,
  type UpdateProjectActualCost,
  type VendorCost,
  type InsertVendorCost,
  type UpdateVendorCost,
  type ToolCost,
  type InsertToolCost,
  type UpdateToolCost,
  type MarginSettings,
  type InsertMarginSettings,
  type UpdateMarginSettings,
  costMarginGlobalSettings,
  type CostMarginGlobalSettings,
  type InsertCostMarginGlobalSettings,
  type UpdateCostMarginGlobalSettings,
  resources,
  resourceRateSettings,
  type Resource,
  type InsertResource,
  type UpdateResource,
  type ResourceWithUser,
  type ResourceRateSettings,
  type InsertResourceRateSettings,
  type UpdateResourceRateSettings,
  otpResets,
  jiraIntegrationSettings,
  jiraProjectMappings,
  jiraWorklogSync,
  type JiraIntegrationSettings,
  type InsertJiraIntegrationSettings,
  type UpdateJiraIntegrationSettings,
  type JiraProjectMapping,
  type InsertJiraProjectMapping,
  type UpdateJiraProjectMapping,
  type JiraWorklogSync,
  type InsertJiraWorklogSync,
  type UpdateJiraWorklogSync,
  projectMergeAudits,
  type ProjectMergeAudit,
  type InsertProjectMergeAudit,
  type ThemeSettings,
  apiMetrics,
  type ApiMetric,
  type InsertApiMetric,
  type ApiMetricsSummary,
  type SecurityDashboard,
  projectSignoffs,
  type ProjectSignoff,
  type InsertSignoff,
  type UpdateSignoff,
  kpiParameters,
  kpiLevels,
  kpiLevelScores,
  kpiMonthlyReviews,
  kpiGraceScores,
  type KpiGraceScore,
  type InsertKpiGraceScore,
  type KpiGraceScoreWithReviewer,
  type KpiParameter,
  type InsertKpiParameter,
  type KpiLevel,
  type InsertKpiLevel,
  type KpiLevelScore,
  type InsertKpiLevelScore,
  type KpiMonthlyReview,
  type InsertKpiMonthlyReview,
  type KpiMonthlyReviewWithDetails,
  grades,
  type Grade,
  type InsertGrade,
  salaryGradeBands,
  type SalaryGradeBand,
  type InsertSalaryGradeBand,
  appraisals,
  type Appraisal,
  type InsertAppraisal,
  type AppraisalWithPm,
  type ForecastEntry,
  type InsertForecastEntry,
  paymentComments,
  type PaymentComment,
  type InsertPaymentComment,
  type PaymentCommentWithUser,
  pods,
  podTargetOverrides,
  podMemberships,
  type PodMembership,
  type InsertPodMembership,
  type PodMoveStrategy,
  type Pod,
  type InsertPod,
  type UpdatePod,
  type PodTargetOverride,
  type InsertPodTargetOverride,
  type PodStats,
  type PodPmStats,
} from "@shared/schema";
import { db } from "./db";
import { computeInvoicePayment } from "./invoiceSettlement";
import { applyRollout } from "./appraisalRollout";
import { eq, and, sql, desc, asc, gte, lte, gt, or, lt, ne, inArray, notInArray, isNotNull } from "drizzle-orm";

// Order a milestone's linked payments for display: received first, then by
// creation date (oldest first), with id as a stable tiebreaker.
function sortLinkedPayments(list: Payment[]): Payment[] {
  return [...list].sort((a, b) => {
    const aReceived = a.status === "received" ? 1 : 0;
    const bReceived = b.status === "received" ? 1 : 0;
    if (aReceived !== bReceived) return bReceived - aReceived;
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (aTime !== bTime) return aTime - bTime;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

// Thrown when a POD membership history record fails validation (bad range or
// overlaps another record for the same PM). Routes translate this to HTTP 400.
export class PodMembershipValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PodMembershipValidationError";
  }
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  getProjectManagers(): Promise<Pick<User, "id" | "firstName" | "lastName" | "email" | "profileImageUrl" | "status" | "podId" | "isProjectManager">[]>;
  updateUser(id: string, data: Partial<User>): Promise<User | undefined>;
  getUserLinkedDataCounts(id: string): Promise<Record<string, number>>;
  reassignAndDeleteUser(id: string, replacementUserId: string): Promise<boolean>;
  deleteUser(id: string): Promise<boolean>;
  
  getProject(id: string): Promise<Project | undefined>;
  getProjectWithPM(id: string): Promise<ProjectWithPM | undefined>;
  getAllProjects(): Promise<ProjectWithPM[]>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, data: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: string): Promise<boolean>;
  getPaymentsByProjectId(projectId: string): Promise<Payment[]>;
  restoreProject(project: Project, projectPayments: Payment[]): Promise<Project>;
  
  getPayment(id: string): Promise<Payment | undefined>;
  getPaymentWithProject(id: string): Promise<PaymentWithProject | undefined>;
  getAllPayments(filters?: {
    month?: number;
    year?: number;
    region?: Region;
    status?: PaymentStatus;
    pmId?: string;
    paymentType?: PaymentType;
    projectId?: string;
  }): Promise<PaymentWithProject[]>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePayment(id: string, data: Partial<InsertPayment>): Promise<Payment | undefined>;
  deletePayment(id: string): Promise<boolean>;

  // Payment Comments
  getPaymentComments(paymentId: string): Promise<PaymentCommentWithUser[]>;
  getPaymentCommentCounts(paymentIds: string[]): Promise<Map<string, number>>;
  getLatestPaymentComments(paymentIds: string[]): Promise<Map<string, PaymentCommentWithUser>>;
  getPaymentComment(id: string): Promise<PaymentComment | undefined>;
  createPaymentComment(data: InsertPaymentComment): Promise<PaymentComment>;
  updatePaymentComment(id: string, comment: string): Promise<PaymentComment | undefined>;
  deletePaymentComment(id: string): Promise<boolean>;
  
  getMonthlyPlan(month: number, year: number): Promise<MonthlyPlan | undefined>;
  getMonthlyPlanById(id: string): Promise<MonthlyPlan | undefined>;
  getAllMonthlyPlans(year?: number): Promise<MonthlyPlanSummary[]>;
  createMonthlyPlan(plan: InsertMonthlyPlan): Promise<MonthlyPlan>;
  updateMonthlyPlan(id: string, data: Partial<InsertMonthlyPlan>): Promise<MonthlyPlan | undefined>;
  deleteMonthlyPlan(id: string): Promise<boolean>;
  getMonthlyPlanPayments(planId: string, filters?: { pmId?: string; region?: Region; paymentType?: PaymentType; status?: PaymentStatus }): Promise<PaymentWithDetails[]>;
  linkPaymentToMonthlyPlan(paymentId: string, monthlyPlanId: string): Promise<Payment | undefined>;
  
  getDashboardStats(month: number, year: number): Promise<DashboardStats>;
  
  getPmTargets(month: number, year: number): Promise<PmTargetWithUser[]>;
  getPmTarget(pmId: string, month: number, year: number): Promise<PmTarget | undefined>;
  upsertPmTarget(data: InsertPmTarget): Promise<PmTarget>;
  deletePmTarget(id: string): Promise<boolean>;
  
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;
  getActivityLogs(limit?: number, offset?: number): Promise<ActivityLogWithUser[]>;
  
  getAppSettings(): Promise<AppSettings | undefined>;
  initializeAppSettings(): Promise<AppSettings>;
  updateAppSettings(data: UpdateAppSettings, updatedBy?: string): Promise<AppSettings>;
  
  // Theme Settings
  updateUserTheme(userId: string, themeSettings: ThemeSettings | null): Promise<void>;
  updateGlobalTheme(themeSettings: ThemeSettings | null, updatedBy?: string): Promise<void>;
  
  // Notifications
  getNotifications(userId: string, limit?: number): Promise<NotificationWithDetails[]>;
  getUnreadNotificationCount(userId: string): Promise<number>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  createBulkNotifications(notifications: InsertNotification[]): Promise<Notification[]>;
  markNotificationAsRead(id: string): Promise<Notification | undefined>;
  markAllNotificationsAsRead(userId: string): Promise<void>;
  getDismissedAlertIds(userId: string): Promise<Set<string>>;
  dismissAlerts(userId: string, alertIds: string[]): Promise<void>;
  getPaymentsDueSoon(days: number): Promise<PaymentWithProject[]>;
  getOverduePayments(): Promise<PaymentWithProject[]>;
  dismissPaymentFromReminders(paymentId: string, dismissed: boolean): Promise<Payment | undefined>;
  getDismissedPayments(): Promise<PaymentWithProject[]>;
  
  // Banking Details
  getAllBankingDetails(): Promise<RegionBankingDetails[]>;
  getBankingDetailsByRegion(region: Region): Promise<RegionBankingDetails | undefined>;
  upsertBankingDetails(data: InsertRegionBankingDetails): Promise<RegionBankingDetails>;
  deleteBankingDetails(region: Region): Promise<boolean>;
  
  // Upsells
  getUpsell(id: string): Promise<Upsell | undefined>;
  getUpsellWithDetails(id: string): Promise<UpsellWithDetails | undefined>;
  getAllUpsells(filters?: { projectId?: string; status?: UpsellStatus; pmId?: string }): Promise<UpsellWithDetails[]>;
  getConvertedUpsellTotalsByProject(): Promise<Map<string, number>>;
  createUpsell(upsell: InsertUpsell): Promise<Upsell>;
  updateUpsell(id: string, data: UpdateUpsell): Promise<Upsell | undefined>;
  deleteUpsell(id: string): Promise<boolean>;
  convertUpsell(id: string, paymentId: string): Promise<Upsell | undefined>;
  
  // Upsell Activities
  getUpsellActivities(upsellId: string): Promise<UpsellActivityWithUser[]>;
  createUpsellActivity(activity: InsertUpsellActivity): Promise<UpsellActivity>;
  deleteUpsellActivity(id: string): Promise<boolean>;
  
  // Upsell Type Settings
  getAllUpsellTypes(): Promise<UpsellTypeSetting[]>;
  getActiveUpsellTypes(): Promise<UpsellTypeSetting[]>;
  getUpsellType(id: string): Promise<UpsellTypeSetting | undefined>;
  createUpsellType(data: InsertUpsellTypeSetting): Promise<UpsellTypeSetting>;
  updateUpsellType(id: string, data: UpdateUpsellTypeSetting): Promise<UpsellTypeSetting | undefined>;
  deleteUpsellType(id: string): Promise<boolean>;
  initializeDefaultUpsellTypes(): Promise<void>;
  ensureUpsellCategories(): Promise<void>;
  
  // Roles and Permissions
  getAllRoles(): Promise<RoleWithPermissions[]>;
  getRole(id: string): Promise<RoleWithPermissions | undefined>;
  getRoleByName(name: string): Promise<RoleWithPermissions | undefined>;
  createRole(data: InsertRole): Promise<Role>;
  updateRole(id: string, data: UpdateRole): Promise<Role | undefined>;
  deleteRole(id: string): Promise<boolean>;
  setRolePermissions(roleId: string, permissions: SystemPermission[]): Promise<void>;
  getUserPermissions(userId: string): Promise<SystemPermission[]>;
  assignRoleToUser(userId: string, roleId: string): Promise<User | undefined>;
  initializeDefaultRoles(): Promise<void>;
  
  // Project Milestones
  getMilestone(id: string): Promise<ProjectMilestone | undefined>;
  getMilestoneWithPayment(id: string): Promise<MilestoneWithPayment | undefined>;
  getProjectMilestones(projectId: string): Promise<MilestoneWithPayment[]>;
  getProjectWithMilestones(projectId: string): Promise<ProjectWithMilestones | undefined>;
  createMilestone(milestone: InsertMilestone): Promise<ProjectMilestone>;
  createBulkMilestones(milestones: InsertMilestone[]): Promise<ProjectMilestone[]>;
  updateMilestone(id: string, data: UpdateMilestone): Promise<ProjectMilestone | undefined>;
  deleteMilestone(id: string): Promise<boolean>;
  deleteProjectMilestones(projectId: string): Promise<boolean>;
  linkMilestoneToPayment(milestoneId: string, paymentId: string): Promise<ProjectMilestone | undefined>;
  unlinkMilestone(milestoneId: string): Promise<ProjectMilestone | undefined>;
  recomputeMilestoneFromPayments(milestoneId: string): Promise<ProjectMilestone | undefined>;
  updateMilestoneStatus(id: string, status: MilestoneStatus): Promise<ProjectMilestone | undefined>;
  getUnpaidMilestones(): Promise<Array<ProjectMilestone & { projectName: string; clientName: string }>>;
  getRecentPaymentsByProject(projectId: string, limit: number): Promise<Array<Payment & { milestoneName?: string }>>;

  // Change Requests
  getProjectChangeRequests(projectId: string): Promise<ChangeRequestWithInstallments[]>;
  getSoldUpsells(): Promise<SoldUpsell[]>;
  // CR Tags
  getCrTags(): Promise<CrTag[]>;
  createCrTag(tag: InsertCrTag): Promise<CrTag>;
  setChangeRequestTags(changeRequestId: string, tagIds: string[]): Promise<void>;
  getLatestUpsellAiAnalysis(scope?: UpsellAnalysisScope): Promise<UpsellAiAnalysisWithUser | undefined>;
  createUpsellAiAnalysis(analysis: InsertUpsellAiAnalysis): Promise<UpsellAiAnalysis>;
  getAiProviderSettings(): Promise<AiProviderSettings[]>;
  getAiProviderSetting(provider: UpsellAiProvider): Promise<AiProviderSettings | undefined>;
  upsertAiProviderSetting(data: InsertAiProviderSettings, updatedBy?: string): Promise<AiProviderSettings>;
  getChangeRequest(id: string): Promise<ChangeRequest | undefined>;
  createChangeRequest(changeRequest: InsertChangeRequest): Promise<ChangeRequest>;
  updateChangeRequest(id: string, data: UpdateChangeRequest): Promise<ChangeRequest | undefined>;
  deleteChangeRequest(id: string): Promise<boolean>;
  createBulkCrInstallments(installments: InsertCrInstallment[]): Promise<CrInstallment[]>;
  getCrInstallment(id: string): Promise<CrInstallment | undefined>;
  getProjectUnpaidCrInstallments(projectId: string): Promise<CrInstallment[]>;
  updateCrInstallment(id: string, data: UpdateCrInstallment): Promise<CrInstallment | undefined>;
  updateCrInstallmentStatus(id: string, status: MilestoneStatus, receivedAmount?: string): Promise<CrInstallment | undefined>;
  linkCrInstallmentToPayment(installmentId: string, paymentId: string): Promise<CrInstallment | undefined>;
  unlinkCrInstallment(installmentId: string): Promise<CrInstallment | undefined>;
  recomputeCrInstallmentFromPayments(installmentId: string): Promise<CrInstallment | undefined>;

  // Google Drive folder cache
  getProjectDriveFolders(projectId: string): Promise<ProjectDriveFolder | undefined>;
  getAllProjectDriveFolders(): Promise<Array<ProjectDriveFolder & { projectName: string; region: Region; status: string }>>;
  upsertProjectDriveFolders(data: InsertProjectDriveFolder): Promise<ProjectDriveFolder>;
  
  // Forecasting
  getAllProjectMilestones(): Promise<ProjectMilestone[]>;
  getMilestonesForForecasting(month: number, year: number): Promise<Array<{ milestone: ProjectMilestone; project: Project }>>;
  getPlanningPaymentsForForecasting(month: number, year: number): Promise<PaymentWithProject[]>;
  getForecastEntries(projectId?: string, month?: number, year?: number): Promise<(ForecastEntry & { project?: { id: string; name: string; region: string; billingType: string | null; totalCost: string; clientName: string; status: string; mrrMonthlyAmount: string | null; mrrDurationMonths: number | null; numberOfPhases: number | null } })[]>;
  createForecastEntry(entry: InsertForecastEntry): Promise<ForecastEntry>;
  updateForecastEntry(id: string, data: Partial<InsertForecastEntry>): Promise<ForecastEntry | undefined>;
  deleteForecastEntry(id: string): Promise<boolean>;
  deleteForecastEntriesByProject(projectId: string, month?: number, year?: number): Promise<number>;
  
  // Invoices
  getInvoice(id: string): Promise<Invoice | undefined>;
  getInvoiceWithDetails(id: string): Promise<InvoiceWithDetails | undefined>;
  getAllInvoices(filters?: { projectId?: string; status?: InvoiceStatus; region?: Region; startDate?: Date; endDate?: Date }): Promise<InvoiceListItem[]>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: string, data: UpdateInvoice): Promise<Invoice | undefined>;
  deleteInvoice(id: string): Promise<boolean>;
  markInvoicePaid(id: string, paidDate: Date, amountPaid: string): Promise<Invoice | undefined>;
  getNextInvoiceNumber(): Promise<string>;
  getInvoiceByPaymentId(paymentId: string): Promise<Invoice | undefined>;
  
  // Invoice Line Items
  getInvoiceLineItems(invoiceId: string): Promise<InvoiceLineItem[]>;
  createInvoiceLineItem(item: InsertInvoiceLineItem): Promise<InvoiceLineItem>;
  createBulkInvoiceLineItems(items: InsertInvoiceLineItem[]): Promise<InvoiceLineItem[]>;
  deleteInvoiceLineItems(invoiceId: string): Promise<boolean>;
  
  // SMTP Settings
  getSMTPSettings(): Promise<SMTPSettings | undefined>;
  upsertSMTPSettings(data: InsertSMTPSettings | UpdateSMTPSettings, updatedBy?: string): Promise<SMTPSettings>;
  
  // Cost & Margin Module - Timesheets
  getTimesheet(id: string): Promise<Timesheet | undefined>;
  getTimesheetWithDetails(id: string): Promise<TimesheetWithDetails | undefined>;
  getProjectTimesheets(projectId: string, filters?: { month?: number; year?: number; userId?: string; status?: TimesheetStatus }): Promise<TimesheetWithDetails[]>;
  getUserTimesheets(userId: string, filters?: { month?: number; year?: number; projectId?: string }): Promise<TimesheetWithDetails[]>;
  getAllTimesheets(filters?: { month?: number; year?: number; projectId?: string; userId?: string; status?: TimesheetStatus }): Promise<TimesheetWithDetails[]>;
  getTimesheetsUpToMonth(endMonth: number, endYear: number, projectId?: string): Promise<TimesheetWithDetails[]>;
  createTimesheet(data: InsertTimesheet): Promise<Timesheet>;
  updateTimesheet(id: string, data: UpdateTimesheet): Promise<Timesheet | undefined>;
  deleteTimesheet(id: string): Promise<boolean>;
  approveTimesheet(id: string, approverId: string): Promise<Timesheet | undefined>;
  rejectTimesheet(id: string, approverId: string): Promise<Timesheet | undefined>;
  
  // Cost & Margin Module - Estimated Costs
  getProjectEstimatedCost(id: string): Promise<ProjectEstimatedCost | undefined>;
  getProjectEstimatedCostByMonth(projectId: string, month: number, year: number): Promise<ProjectEstimatedCost | undefined>;
  getAllProjectEstimatedCosts(filters?: { projectId?: string; month?: number; year?: number }): Promise<ProjectEstimatedCost[]>;
  createProjectEstimatedCost(data: InsertProjectEstimatedCost): Promise<ProjectEstimatedCost>;
  updateProjectEstimatedCost(id: string, data: UpdateProjectEstimatedCost): Promise<ProjectEstimatedCost | undefined>;
  deleteProjectEstimatedCost(id: string): Promise<boolean>;
  
  // Cost & Margin Module - Actual Costs
  getProjectActualCost(id: string): Promise<ProjectActualCost | undefined>;
  getProjectActualCostByMonth(projectId: string, month: number, year: number): Promise<ProjectActualCost | undefined>;
  getAllProjectActualCosts(filters?: { projectId?: string; month?: number; year?: number }): Promise<ProjectActualCost[]>;
  createProjectActualCost(data: InsertProjectActualCost): Promise<ProjectActualCost>;
  updateProjectActualCost(id: string, data: UpdateProjectActualCost): Promise<ProjectActualCost | undefined>;
  deleteProjectActualCost(id: string): Promise<boolean>;
  
  // Cost & Margin Module - Vendor Costs
  getVendorCost(id: string): Promise<VendorCost | undefined>;
  getProjectVendorCosts(projectId: string, filters?: { month?: number; year?: number }): Promise<VendorCost[]>;
  getAllVendorCosts(filters?: { projectId?: string; month?: number; year?: number }): Promise<VendorCost[]>;
  createVendorCost(data: InsertVendorCost): Promise<VendorCost>;
  updateVendorCost(id: string, data: UpdateVendorCost): Promise<VendorCost | undefined>;
  deleteVendorCost(id: string): Promise<boolean>;
  
  // Cost & Margin Module - Tool Costs
  getToolCost(id: string): Promise<ToolCost | undefined>;
  getProjectToolCosts(projectId: string, filters?: { month?: number; year?: number }): Promise<ToolCost[]>;
  getAllToolCosts(filters?: { projectId?: string; month?: number; year?: number }): Promise<ToolCost[]>;
  createToolCost(data: InsertToolCost): Promise<ToolCost>;
  updateToolCost(id: string, data: UpdateToolCost): Promise<ToolCost | undefined>;
  deleteToolCost(id: string): Promise<boolean>;
  
  // Cost & Margin Module - Margin Settings
  getMarginSettings(): Promise<MarginSettings | undefined>;
  upsertMarginSettings(data: InsertMarginSettings | UpdateMarginSettings): Promise<MarginSettings>;
  
  // Cost & Margin Module - Global Settings (hourly rates, profitability %, variance)
  getCostMarginGlobalSettings(): Promise<CostMarginGlobalSettings | undefined>;
  upsertCostMarginGlobalSettings(data: InsertCostMarginGlobalSettings | UpdateCostMarginGlobalSettings): Promise<CostMarginGlobalSettings>;
  
  // Resources Module
  getResource(id: string): Promise<Resource | undefined>;
  getResourceByUserId(userId: string): Promise<Resource | undefined>;
  getResourceByEmail(email: string): Promise<Resource | undefined>;
  getAllResources(filters?: { isActive?: boolean }): Promise<ResourceWithUser[]>;
  createResource(data: InsertResource): Promise<Resource>;
  updateResource(id: string, data: UpdateResource): Promise<Resource | undefined>;
  deleteResource(id: string): Promise<boolean>;
  computeEffectiveHourlyRate(resource: { employmentType: string; monthlySalary?: string | null; contractorHourlyRate?: string | null }): string;
  
  // Resource Rate Settings
  getResourceRateSettings(region?: string): Promise<ResourceRateSettings | undefined>;
  getAllResourceRateSettings(): Promise<ResourceRateSettings[]>;
  upsertResourceRateSettings(data: InsertResourceRateSettings): Promise<ResourceRateSettings>;
  deleteResourceRateSettings(region?: string): Promise<boolean>;
  getEffectiveHourlyRateForResource(resourceId: string): Promise<string>;
  
  // Jira Integration
  getJiraIntegrationSettings(): Promise<JiraIntegrationSettings | undefined>;
  upsertJiraIntegrationSettings(data: InsertJiraIntegrationSettings | UpdateJiraIntegrationSettings): Promise<JiraIntegrationSettings>;
  updateJiraIntegrationSyncStatus(status: "success" | "failed" | "in_progress", error?: string): Promise<void>;
  
  // Jira Project Mappings
  getJiraProjectMapping(id: string): Promise<JiraProjectMapping | undefined>;
  getJiraProjectMappingByKey(jiraProjectKey: string): Promise<JiraProjectMapping | undefined>;
  getAllJiraProjectMappings(): Promise<JiraProjectMapping[]>;
  createJiraProjectMapping(data: InsertJiraProjectMapping): Promise<JiraProjectMapping>;
  updateJiraProjectMapping(id: string, data: UpdateJiraProjectMapping): Promise<JiraProjectMapping | undefined>;
  deleteJiraProjectMapping(id: string): Promise<boolean>;
  
  // Jira Worklog Sync
  getJiraWorklogSync(id: string): Promise<JiraWorklogSync | undefined>;
  getJiraWorklogSyncByWorklogId(jiraWorklogId: string): Promise<JiraWorklogSync | undefined>;
  getAllJiraWorklogSync(filters?: { jiraProjectKey?: string; syncStatus?: string }): Promise<JiraWorklogSync[]>;
  createJiraWorklogSync(data: InsertJiraWorklogSync): Promise<JiraWorklogSync>;
  updateJiraWorklogSync(id: string, data: UpdateJiraWorklogSync): Promise<JiraWorklogSync | undefined>;
  deleteJiraWorklogSync(id: string): Promise<boolean>;
  
  // Project Merge
  getProjectMergePreview(targetProjectId: string, sourceProjectIds: string[]): Promise<ProjectMergePreview>;
  mergeProjects(targetProjectId: string, sourceProjectIds: string[], mergedBy: string): Promise<ProjectMergeAudit>;
  getProjectMergeAudits(projectId?: string): Promise<ProjectMergeAudit[]>;
  
  // API Metrics (System Health Monitoring)
  recordApiMetric(metric: InsertApiMetric): Promise<ApiMetric>;
  getApiMetricsSummary(hours?: number): Promise<ApiMetricsSummary>;
  getApiMetrics(filters?: { endpoint?: string; startTime?: Date; endTime?: Date; statusCode?: number; limit?: number }): Promise<ApiMetric[]>;
  cleanupOldApiMetrics(daysToKeep?: number): Promise<number>;
  getSecurityDashboard(hours?: number): Promise<Omit<SecurityDashboard, "rateLimitConfig" | "securityHeaders">>;
  
  // Document Repository / Signoffs
  getSignoff(id: string): Promise<ProjectSignoff | undefined>;
  getAllSignoffs(filters?: { projectId?: string; status?: string; milestoneId?: string }): Promise<ProjectSignoff[]>;
  getSignoffsByProject(projectId: string): Promise<ProjectSignoff[]>;
  getSignoffByMilestone(milestoneId: string): Promise<ProjectSignoff | undefined>;
  createSignoff(data: InsertSignoff): Promise<ProjectSignoff>;
  updateSignoff(id: string, data: UpdateSignoff): Promise<ProjectSignoff | undefined>;
  deleteSignoff(id: string): Promise<boolean>;
  getMissingSignoffs(): Promise<{ projectId: string; projectName: string; milestoneId: string; milestoneName: string; pmId: string; pmEmail: string; paidDate: Date }[]>;
  updateSignoffReminder(id: string): Promise<ProjectSignoff | undefined>;
  
  // KPI Parameters
  getKpiParameter(id: string): Promise<KpiParameter | undefined>;
  getAllKpiParameters(activeOnly?: boolean): Promise<KpiParameter[]>;
  createKpiParameter(data: InsertKpiParameter): Promise<KpiParameter>;
  updateKpiParameter(id: string, data: Partial<InsertKpiParameter>): Promise<KpiParameter | undefined>;
  deleteKpiParameter(id: string): Promise<boolean>;
  
  // KPI Levels
  getKpiLevel(id: string): Promise<KpiLevel | undefined>;
  getAllKpiLevels(activeOnly?: boolean): Promise<KpiLevel[]>;
  createKpiLevel(data: InsertKpiLevel): Promise<KpiLevel>;
  updateKpiLevel(id: string, data: Partial<InsertKpiLevel>): Promise<KpiLevel | undefined>;
  deleteKpiLevel(id: string): Promise<boolean>;
  
  // KPI Level Scores
  getKpiLevelScores(parameterId: string, levelId: string): Promise<KpiLevelScore[]>;
  getAllKpiLevelScores(): Promise<KpiLevelScore[]>;
  upsertKpiLevelScore(data: InsertKpiLevelScore): Promise<KpiLevelScore>;
  deleteKpiLevelScore(id: string): Promise<boolean>;
  bulkUpsertKpiLevelScores(scores: InsertKpiLevelScore[]): Promise<KpiLevelScore[]>;
  
  // KPI Monthly Reviews
  getKpiMonthlyReviews(month: number, year: number): Promise<KpiMonthlyReviewWithDetails[]>;
  getKpiMonthlyReviewsByPm(pmId: string, month?: number, year?: number): Promise<KpiMonthlyReviewWithDetails[]>;
  upsertKpiMonthlyReview(data: InsertKpiMonthlyReview): Promise<KpiMonthlyReview>;
  bulkUpsertKpiMonthlyReviews(reviews: InsertKpiMonthlyReview[]): Promise<KpiMonthlyReview[]>;
  deleteKpiMonthlyReview(id: string): Promise<boolean>;
  deleteKpiMonthlyReviewsByPmMonth(pmId: string, month: number, year: number): Promise<boolean>;

  // KPI Grace Scores (manual adjustments)
  getKpiGraceScores(month: number, year: number): Promise<KpiGraceScoreWithReviewer[]>;
  getKpiGraceScoresByPm(pmId: string, month?: number, year?: number): Promise<KpiGraceScoreWithReviewer[]>;
  createKpiGraceScore(data: InsertKpiGraceScore): Promise<KpiGraceScore>;
  deleteKpiGraceScore(id: string): Promise<boolean>;

  // Appraisal grades
  getAllGrades(): Promise<Grade[]>;
  getGrade(id: string): Promise<Grade | undefined>;
  createGrade(data: InsertGrade): Promise<Grade>;
  updateGrade(id: string, data: Partial<InsertGrade>): Promise<Grade | undefined>;
  deleteGrade(id: string): Promise<boolean>;

  // Salary grade bands (grade sheet)
  getAllSalaryGradeBands(): Promise<SalaryGradeBand[]>;
  replaceSalaryGradeBands(bands: InsertSalaryGradeBand[]): Promise<SalaryGradeBand[]>;

  // Appraisals
  getAppraisals(periodMonths: number, periodEndMonth: number, periodEndYear: number): Promise<AppraisalWithPm[]>;
  getUserAppraisals(userId: string): Promise<AppraisalWithPm[]>;
  getAppraisal(id: string): Promise<Appraisal | undefined>;
  getAppraisalWithPm(id: string): Promise<AppraisalWithPm | undefined>;
  getAppraisalByShareToken(token: string): Promise<AppraisalWithPm | undefined>;
  replaceAppraisalsForPeriod(periodMonths: number, periodEndMonth: number, periodEndYear: number, rows: InsertAppraisal[]): Promise<Appraisal[]>;
  updateAppraisal(id: string, data: Partial<InsertAppraisal>): Promise<Appraisal | undefined>;
  rollOutAppraisal(id: string, data: { finalVerdict: string | null; boardComment: string | null; rolledOutBy: string | null }): Promise<Appraisal | undefined>;
  undoRollout(id: string): Promise<Appraisal | undefined>;

  // PODs
  getAllPods(): Promise<Pod[]>;
  getPod(id: string): Promise<Pod | undefined>;
  createPod(data: InsertPod): Promise<Pod>;
  updatePod(id: string, data: UpdatePod): Promise<Pod | undefined>;
  deletePod(id: string): Promise<boolean>;
  setPodMembers(podId: string, pmIds: string[], moveStrategy?: PodMoveStrategy): Promise<void>;
  addPodMember(podId: string, userId: string, moveStrategy?: PodMoveStrategy): Promise<void>;
  removePodMember(podId: string, userId: string): Promise<boolean>;
  getPodTargetOverrides(podId: string): Promise<PodTargetOverride[]>;
  upsertPodTargetOverride(data: InsertPodTargetOverride): Promise<PodTargetOverride>;
  deletePodTargetOverride(id: string): Promise<boolean>;
  getPodStats(startMonth: number, startYear: number, endMonth: number, endYear: number): Promise<PodStats[]>;
  // POD membership history (effective-dated PM→POD attribution overrides)
  getPodMembershipsForUser(userId: string): Promise<PodMembership[]>;
  createPodMembership(data: InsertPodMembership): Promise<PodMembership>;
  updatePodMembership(id: string, data: Partial<InsertPodMembership>): Promise<PodMembership | undefined>;
  deletePodMembership(id: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // Check if user exists to determine if this is a new user or needs a role
    const existingUser = await this.getUser(userData.id);
    const isNewUser = !existingUser;
    const needsRole = isNewUser || (existingUser && !existingUser.roleId);
    
    let roleIdToAssign: string | undefined;
    if (needsRole) {
      // Get the TR EMP role as default for new users (no permissions until admin assigns)
      const trEmpRole = await this.getRoleByName('tr_emp');
      if (trEmpRole) {
        roleIdToAssign = trEmpRole.id;
      }
    }
    
    const [user] = await db
      .insert(users)
      .values({
        ...userData,
        ...(roleIdToAssign ? { roleId: roleIdToAssign } : {}),
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          updatedAt: new Date(),
          // Also assign role if user doesn't have one
          ...(needsRole && roleIdToAssign ? { roleId: roleIdToAssign } : {}),
        },
      })
      .returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
    
    // Batch fetch all roles to enrich users with role display names
    const roleIds = [...new Set(allUsers.map(u => u.roleId).filter(Boolean))] as string[];
    
    if (roleIds.length === 0) {
      return allUsers;
    }
    
    const allRoles = await db.select().from(roles).where(inArray(roles.id, roleIds));
    const rolesMap = new Map(allRoles.map(r => [r.id, r]));
    
    // Enrich users with role display name for efficient frontend rendering
    return allUsers.map(user => {
      const role = user.roleId ? rolesMap.get(user.roleId) : null;
      return {
        ...user,
        roleDisplayName: role?.displayName || null,
      };
    });
  }

  async getProjectManagers(): Promise<Pick<User, "id" | "firstName" | "lastName" | "email" | "profileImageUrl" | "status" | "podId" | "isProjectManager">[]> {
    return db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        profileImageUrl: users.profileImageUrl,
        status: users.status,
        podId: users.podId,
        isProjectManager: users.isProjectManager,
      })
      .from(users)
      .where(and(eq(users.isProjectManager, true), eq(users.status, "active")))
      .orderBy(users.firstName, users.lastName);
  }

  async updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(userData: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }

  async getUserLinkedDataCounts(id: string): Promise<Record<string, number>> {
    const [projectCount] = await db.select({ count: sql<number>`count(*)::int` }).from(projects).where(eq(projects.pmId, id));
    const [kpiReviewPmCount] = await db.select({ count: sql<number>`count(*)::int` }).from(kpiMonthlyReviews).where(eq(kpiMonthlyReviews.pmId, id));
    const [kpiReviewerCount] = await db.select({ count: sql<number>`count(*)::int` }).from(kpiMonthlyReviews).where(eq(kpiMonthlyReviews.reviewerId, id));
    const [timesheetCount] = await db.select({ count: sql<number>`count(*)::int` }).from(timesheets).where(eq(timesheets.userId, id));
    const [pmTargetCount] = await db.select({ count: sql<number>`count(*)::int` }).from(pmTargets).where(eq(pmTargets.pmId, id));
    const [upsellCount] = await db.select({ count: sql<number>`count(*)::int` }).from(upsells).where(eq(upsells.createdBy, id));
    const [upsellActivityCount] = await db.select({ count: sql<number>`count(*)::int` }).from(upsellActivities).where(eq(upsellActivities.createdBy, id));
    const [invoiceCount] = await db.select({ count: sql<number>`count(*)::int` }).from(invoices).where(eq(invoices.createdBy, id));
    const [forecastCount] = await db.select({ count: sql<number>`count(*)::int` }).from(forecastEntries).where(eq(forecastEntries.createdBy, id));
    const [signoffCount] = await db.select({ count: sql<number>`count(*)::int` }).from(projectSignoffs).where(eq(projectSignoffs.createdBy, id));
    const [activityLogCount] = await db.select({ count: sql<number>`count(*)::int` }).from(activityLogs).where(eq(activityLogs.userId, id));
    const [notificationCount] = await db.select({ count: sql<number>`count(*)::int` }).from(notifications).where(or(eq(notifications.userId, id), eq(notifications.createdBy, id)));
    const [notificationResponseCount] = await db.select({ count: sql<number>`count(*)::int` }).from(notificationResponses).where(eq(notificationResponses.responderId, id));
    const [monthlyPlanCount] = await db.select({ count: sql<number>`count(*)::int` }).from(monthlyPlans).where(eq(monthlyPlans.createdBy, id));
    const [mergeAuditCount] = await db.select({ count: sql<number>`count(*)::int` }).from(projectMergeAudits).where(eq(projectMergeAudits.mergedBy, id));
    const [estimatedCostCount] = await db.select({ count: sql<number>`count(*)::int` }).from(projectEstimatedCosts).where(eq(projectEstimatedCosts.createdBy, id));
    const [vendorCostCount] = await db.select({ count: sql<number>`count(*)::int` }).from(vendorCosts).where(eq(vendorCosts.createdBy, id));
    const [toolCostCount] = await db.select({ count: sql<number>`count(*)::int` }).from(toolCosts).where(eq(toolCosts.createdBy, id));

    return {
      projects: projectCount.count,
      kpiReviews: kpiReviewPmCount.count + kpiReviewerCount.count,
      timesheets: timesheetCount.count,
      pmTargets: pmTargetCount.count,
      upsells: upsellCount.count + upsellActivityCount.count,
      invoices: invoiceCount.count,
      forecastEntries: forecastCount.count,
      signoffs: signoffCount.count,
      activityLogs: activityLogCount.count,
      notifications: notificationCount.count + notificationResponseCount.count,
      monthlyPlans: monthlyPlanCount.count,
      mergeAudits: mergeAuditCount.count,
      costRecords: estimatedCostCount.count + vendorCostCount.count + toolCostCount.count,
    };
  }

  async reassignAndDeleteUser(id: string, replacementUserId: string): Promise<boolean> {
    return await db.transaction(async (tx) => {
      await tx.update(projects).set({ pmId: replacementUserId }).where(eq(projects.pmId, id));
      await tx.update(kpiMonthlyReviews).set({ pmId: replacementUserId }).where(eq(kpiMonthlyReviews.pmId, id));
      await tx.update(kpiMonthlyReviews).set({ reviewerId: replacementUserId }).where(eq(kpiMonthlyReviews.reviewerId, id));
      await tx.update(kpiGraceScores).set({ pmId: replacementUserId }).where(eq(kpiGraceScores.pmId, id));
      await tx.update(kpiGraceScores).set({ reviewerId: replacementUserId }).where(eq(kpiGraceScores.reviewerId, id));
      await tx.update(appraisals).set({ pmId: replacementUserId }).where(eq(appraisals.pmId, id));
      await tx.update(appraisals).set({ createdBy: replacementUserId }).where(eq(appraisals.createdBy, id));
      await tx.update(timesheets).set({ userId: replacementUserId }).where(eq(timesheets.userId, id));
      await tx.update(pmTargets).set({ pmId: replacementUserId }).where(eq(pmTargets.pmId, id));
      await tx.update(activityLogs).set({ userId: replacementUserId }).where(eq(activityLogs.userId, id));
      await tx.update(notifications).set({ userId: replacementUserId }).where(eq(notifications.userId, id));
      await tx.update(notifications).set({ createdBy: replacementUserId }).where(eq(notifications.createdBy, id));
      await tx.update(notificationResponses).set({ responderId: replacementUserId }).where(eq(notificationResponses.responderId, id));
      await tx.delete(otpResets).where(eq(otpResets.userId, id));
      await tx.update(monthlyPlans).set({ createdBy: replacementUserId }).where(eq(monthlyPlans.createdBy, id));
      await tx.update(invoices).set({ createdBy: replacementUserId }).where(eq(invoices.createdBy, id));
      await tx.update(upsells).set({ createdBy: replacementUserId }).where(eq(upsells.createdBy, id));
      await tx.update(upsellActivities).set({ createdBy: replacementUserId }).where(eq(upsellActivities.createdBy, id));
      await tx.update(forecastEntries).set({ createdBy: replacementUserId }).where(eq(forecastEntries.createdBy, id));
      await tx.update(projectSignoffs).set({ createdBy: replacementUserId }).where(eq(projectSignoffs.createdBy, id));
      await tx.update(projectMergeAudits).set({ mergedBy: replacementUserId }).where(eq(projectMergeAudits.mergedBy, id));
      await tx.update(projectEstimatedCosts).set({ createdBy: replacementUserId }).where(eq(projectEstimatedCosts.createdBy, id));
      await tx.update(vendorCosts).set({ createdBy: replacementUserId }).where(eq(vendorCosts.createdBy, id));
      await tx.update(toolCosts).set({ createdBy: replacementUserId }).where(eq(toolCosts.createdBy, id));
      const result = await tx.delete(users).where(eq(users.id, id)).returning();
      return result.length > 0;
    });
  }

  async deleteUser(id: string): Promise<boolean> {
    await db.update(activityLogs).set({ userId: null }).where(eq(activityLogs.userId, id));
    await db.delete(notifications).where(eq(notifications.userId, id));
    await db.delete(notificationResponses).where(eq(notificationResponses.responderId, id));
    await db.delete(pmTargets).where(eq(pmTargets.pmId, id));
    await db.delete(otpResets).where(eq(otpResets.userId, id));
    await db.delete(kpiMonthlyReviews).where(eq(kpiMonthlyReviews.pmId, id));
    await db.delete(kpiMonthlyReviews).where(eq(kpiMonthlyReviews.reviewerId, id));
    await db.delete(kpiGraceScores).where(eq(kpiGraceScores.pmId, id));
    await db.delete(kpiGraceScores).where(eq(kpiGraceScores.reviewerId, id));
    await db.delete(appraisals).where(eq(appraisals.pmId, id));
    await db.update(appraisals).set({ createdBy: null }).where(eq(appraisals.createdBy, id));
    await db.delete(timesheets).where(eq(timesheets.userId, id));
    await db.update(projects).set({ pmId: null }).where(eq(projects.pmId, id));
    await db.update(monthlyPlans).set({ createdBy: null }).where(eq(monthlyPlans.createdBy, id));
    await db.update(invoices).set({ createdBy: null }).where(eq(invoices.createdBy, id));
    await db.update(upsells).set({ createdBy: null }).where(eq(upsells.createdBy, id));
    await db.update(upsellActivities).set({ createdBy: null }).where(eq(upsellActivities.createdBy, id));
    await db.update(forecastEntries).set({ createdBy: null }).where(eq(forecastEntries.createdBy, id));
    await db.update(projectSignoffs).set({ createdBy: null }).where(eq(projectSignoffs.createdBy, id));
    await db.delete(projectMergeAudits).where(eq(projectMergeAudits.mergedBy, id));
    await db.update(projectEstimatedCosts).set({ createdBy: null }).where(eq(projectEstimatedCosts.createdBy, id));
    await db.update(vendorCosts).set({ createdBy: null }).where(eq(vendorCosts.createdBy, id));
    await db.update(toolCosts).set({ createdBy: null }).where(eq(toolCosts.createdBy, id));
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    return result.length > 0;
  }

  async getProject(id: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project;
  }

  async getProjectWithPM(id: string): Promise<ProjectWithPM | undefined> {
    const result = await db
      .select({
        project: projects,
        pm: users,
        totalReceived: sql<string>`(
          COALESCE((SELECT SUM(${payments.receivedAmount}) FROM ${payments} WHERE ${payments.projectId} = ${projects.id} AND ${payments.paymentType} <> 'upsell'), 0)
          + COALESCE((SELECT CASE WHEN ${projectMilestones.status} = 'paid' AND NOT EXISTS (SELECT 1 FROM ${payments} p2 WHERE p2.milestone_id = ${projectMilestones.id} AND p2.payment_type <> 'upsell' AND p2.received_amount > 0) THEN ${projectMilestones.expectedAmount} ELSE 0 END FROM ${projectMilestones} WHERE ${projectMilestones.projectId} = ${projects.id} ORDER BY ${projectMilestones.sequenceNumber} ASC LIMIT 1), 0)
        )`,
        upsellReceived: sql<string>`COALESCE((SELECT SUM(${payments.receivedAmount}) FROM ${payments} WHERE ${payments.projectId} = ${projects.id} AND ${payments.paymentType} = 'upsell'), 0)`,
      })
      .from(projects)
      .leftJoin(users, eq(projects.pmId, users.id))
      .where(eq(projects.id, id));
    
    if (result.length === 0) return undefined;
    
    return {
      ...result[0].project,
      pm: result[0].pm,
      totalReceived: result[0].totalReceived ?? "0",
      upsellReceived: result[0].upsellReceived ?? "0",
    };
  }

  async getAllProjects(): Promise<ProjectWithPM[]> {
    const result = await db
      .select({
        project: projects,
        pm: users,
        totalReceived: sql<string>`(
          COALESCE((SELECT SUM(${payments.receivedAmount}) FROM ${payments} WHERE ${payments.projectId} = ${projects.id} AND ${payments.paymentType} <> 'upsell'), 0)
          + COALESCE((SELECT CASE WHEN ${projectMilestones.status} = 'paid' AND NOT EXISTS (SELECT 1 FROM ${payments} p2 WHERE p2.milestone_id = ${projectMilestones.id} AND p2.payment_type <> 'upsell' AND p2.received_amount > 0) THEN ${projectMilestones.expectedAmount} ELSE 0 END FROM ${projectMilestones} WHERE ${projectMilestones.projectId} = ${projects.id} ORDER BY ${projectMilestones.sequenceNumber} ASC LIMIT 1), 0)
        )`,
        upsellReceived: sql<string>`COALESCE((SELECT SUM(${payments.receivedAmount}) FROM ${payments} WHERE ${payments.projectId} = ${projects.id} AND ${payments.paymentType} = 'upsell'), 0)`,
      })
      .from(projects)
      .leftJoin(users, eq(projects.pmId, users.id))
      .orderBy(desc(projects.createdAt));
    
    return result.map((r) => ({
      ...r.project,
      pm: r.pm,
      totalReceived: r.totalReceived ?? "0",
      upsellReceived: r.upsellReceived ?? "0",
    }));
  }

  async createProject(project: InsertProject): Promise<Project> {
    const [newProject] = await db.insert(projects).values(project).returning();
    return newProject;
  }

  async updateProject(id: string, data: Partial<InsertProject>): Promise<Project | undefined> {
    const [project] = await db
      .update(projects)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    return project;
  }

  async deleteProject(id: string): Promise<boolean> {
    // Delete related payments first to handle foreign key constraints
    await db.delete(payments).where(eq(payments.projectId, id));
    
    // Now delete the project
    const result = await db.delete(projects).where(eq(projects.id, id)).returning();
    return result.length > 0;
  }

  async getPaymentsByProjectId(projectId: string): Promise<Payment[]> {
    return await db.select().from(payments).where(eq(payments.projectId, projectId));
  }

  async restoreProject(project: Project, projectPayments: Payment[]): Promise<Project> {
    // Re-insert the project
    const [restoredProject] = await db.insert(projects).values({
      id: project.id,
      name: project.name,
      clientName: project.clientName,
      clientEmail: project.clientEmail,
      region: project.region as "CA" | "TX" | "AE",
      pmId: project.pmId,
      projectType: project.projectType,
      clientBusinessName: project.clientBusinessName,
      clientAddress: project.clientAddress,
      phase: project.phase,
      totalCost: project.totalCost,
      paymentTerms: project.paymentTerms,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    }).returning();
    
    // Re-insert all payments
    if (projectPayments.length > 0) {
      for (const payment of projectPayments) {
        await db.insert(payments).values({
          id: payment.id,
          projectId: payment.projectId,
          monthlyPlanId: payment.monthlyPlanId,
          expectedAmount: payment.expectedAmount,
          totalAmount: payment.totalAmount,
          receivedAmount: payment.receivedAmount,
          paymentType: payment.paymentType as "recurring" | "upsell",
          status: payment.status as "not_targeting" | "pending_invoice" | "invoiced" | "received",
          narration: payment.narration,
          invoiceDate: payment.invoiceDate,
          dueDate: payment.dueDate,
          receivedDate: payment.receivedDate,
          month: payment.month,
          year: payment.year,
          isTarget: payment.isTarget,
          createdAt: payment.createdAt,
          updatedAt: payment.updatedAt,
        });
      }
    }
    
    return restoredProject;
  }

  async getPayment(id: string): Promise<Payment | undefined> {
    const [payment] = await db.select().from(payments).where(eq(payments.id, id));
    return payment;
  }

  async getPaymentWithProject(id: string): Promise<PaymentWithProject | undefined> {
    const result = await db
      .select({
        payment: payments,
        project: projects,
      })
      .from(payments)
      .innerJoin(projects, eq(payments.projectId, projects.id))
      .where(eq(payments.id, id));
    
    if (result.length === 0) return undefined;
    
    return {
      ...result[0].payment,
      project: result[0].project,
    };
  }

  async getAllPayments(filters?: {
    month?: number;
    year?: number;
    region?: Region;
    status?: PaymentStatus;
    pmId?: string;
    paymentType?: PaymentType;
    projectId?: string;
  }): Promise<PaymentWithProject[]> {
    let query = db
      .select({
        payment: payments,
        project: projects,
        pm: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          email: users.email,
        },
      })
      .from(payments)
      .innerJoin(projects, eq(payments.projectId, projects.id))
      .leftJoin(users, eq(projects.pmId, users.id));

    const conditions = [];
    
    if (filters?.projectId) {
      conditions.push(eq(payments.projectId, filters.projectId));
    }
    if (filters?.month !== undefined) {
      conditions.push(eq(payments.month, filters.month));
    }
    if (filters?.year !== undefined) {
      conditions.push(eq(payments.year, filters.year));
    }
    if (filters?.region) {
      conditions.push(eq(projects.region, filters.region));
    }
    if (filters?.status) {
      conditions.push(eq(payments.status, filters.status));
    }
    if (filters?.pmId) {
      conditions.push(eq(projects.pmId, filters.pmId));
    }
    if (filters?.paymentType) {
      conditions.push(eq(payments.paymentType, filters.paymentType));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const result = await query.orderBy(desc(payments.createdAt));
    
    return result.map((r) => ({
      ...r.payment,
      project: r.project,
      pm: r.pm?.id ? r.pm : null,
    }));
  }

  async createPayment(payment: InsertPayment): Promise<Payment> {
    const [newPayment] = await db.insert(payments).values(payment).returning();
    return newPayment;
  }

  async updatePayment(id: string, data: Partial<InsertPayment>): Promise<Payment | undefined> {
    const [payment] = await db
      .update(payments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(payments.id, id))
      .returning();
    return payment;
  }

  async deletePayment(id: string): Promise<boolean> {
    return await db.transaction(async (tx) => {
      // Clear foreign-key back-references that would otherwise block the delete.
      // Milestones, invoices and upsells keep a reference to the payment; null them
      // out (callers recompute milestone/installment totals afterwards). Notifications
      // tied to this payment are transient, so remove them.
      await tx.update(projectMilestones).set({ paymentId: null }).where(eq(projectMilestones.paymentId, id));
      await tx.update(invoices).set({ paymentId: null }).where(eq(invoices.paymentId, id));
      await tx.update(upsells).set({ convertedPaymentId: null, convertedAt: null }).where(eq(upsells.convertedPaymentId, id));
      await tx.delete(notifications).where(eq(notifications.paymentId, id));
      const result = await tx.delete(payments).where(eq(payments.id, id)).returning();
      return result.length > 0;
    });
  }

  async getMonthlyPlan(month: number, year: number): Promise<MonthlyPlan | undefined> {
    const [plan] = await db
      .select()
      .from(monthlyPlans)
      .where(and(eq(monthlyPlans.month, month), eq(monthlyPlans.year, year)));
    return plan;
  }

  async getMonthlyPlanById(id: string): Promise<MonthlyPlan | undefined> {
    const [plan] = await db.select().from(monthlyPlans).where(eq(monthlyPlans.id, id));
    return plan;
  }

  async getAllMonthlyPlans(year?: number): Promise<MonthlyPlanSummary[]> {
    const conditions = year ? [eq(monthlyPlans.year, year)] : [];
    
    const plans = await db
      .select()
      .from(monthlyPlans)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(monthlyPlans.year), desc(monthlyPlans.month));
    
    const summaries: MonthlyPlanSummary[] = [];
    
    for (const plan of plans) {
      const planPayments = await db
        .select({ payment: payments, project: projects })
        .from(payments)
        .innerJoin(projects, eq(payments.projectId, projects.id))
        .where(or(
          eq(payments.monthlyPlanId, plan.id),
          and(eq(payments.month, plan.month), eq(payments.year, plan.year), sql`${payments.monthlyPlanId} IS NULL`)
        ));
      
      let totalRecurringTarget = 0;
      let totalReceived = 0;
      let totalUpsells = 0;
      
      for (const { payment } of planPayments) {
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
      
      let creatorName = null;
      if (plan.createdBy) {
        const creator = await this.getUser(plan.createdBy);
        creatorName = creator ? `${creator.firstName || ""} ${creator.lastName || ""}`.trim() || creator.email || null : null;
      }
      
      summaries.push({
        id: plan.id,
        month: plan.month,
        year: plan.year,
        monthlyTarget: parseFloat(plan.monthlyTarget) || 0,
        totalRecurringTarget,
        totalReceived,
        totalRemaining: totalRecurringTarget - totalReceived,
        totalUpsells,
        paymentCount: planPayments.length,
        notes: plan.notes,
        createdBy: plan.createdBy,
        creatorName,
        createdAt: plan.createdAt,
      });
    }
    
    return summaries;
  }

  async createMonthlyPlan(plan: InsertMonthlyPlan): Promise<MonthlyPlan> {
    const [newPlan] = await db.insert(monthlyPlans).values(plan).returning();
    return newPlan;
  }

  async updateMonthlyPlan(id: string, data: Partial<InsertMonthlyPlan>): Promise<MonthlyPlan | undefined> {
    const [plan] = await db
      .update(monthlyPlans)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(monthlyPlans.id, id))
      .returning();
    return plan;
  }

  async deleteMonthlyPlan(id: string): Promise<boolean> {
    await db.update(payments).set({ monthlyPlanId: null }).where(eq(payments.monthlyPlanId, id));
    const result = await db.delete(monthlyPlans).where(eq(monthlyPlans.id, id)).returning();
    return result.length > 0;
  }

  async getMonthlyPlanPayments(planId: string, filters?: { pmId?: string; region?: Region; paymentType?: PaymentType; status?: PaymentStatus }): Promise<PaymentWithDetails[]> {
    const plan = await this.getMonthlyPlanById(planId);
    if (!plan) return [];
    
    const conditions = [
      or(
        eq(payments.monthlyPlanId, planId),
        and(eq(payments.month, plan.month), eq(payments.year, plan.year), sql`${payments.monthlyPlanId} IS NULL`)
      )
    ];
    
    if (filters?.pmId) conditions.push(eq(projects.pmId, filters.pmId));
    if (filters?.region) conditions.push(eq(projects.region, filters.region));
    if (filters?.paymentType) conditions.push(eq(payments.paymentType, filters.paymentType));
    if (filters?.status) conditions.push(eq(payments.status, filters.status));
    
    const result = await db
      .select({ payment: payments, project: projects, pm: users })
      .from(payments)
      .innerJoin(projects, eq(payments.projectId, projects.id))
      .leftJoin(users, eq(projects.pmId, users.id))
      .where(and(...conditions))
      .orderBy(desc(payments.createdAt));
    
    return result.map((r) => ({
      ...r.payment,
      project: {
        ...r.project,
        pm: r.pm,
      },
    }));
  }

  async linkPaymentToMonthlyPlan(paymentId: string, monthlyPlanId: string): Promise<Payment | undefined> {
    const [payment] = await db
      .update(payments)
      .set({ monthlyPlanId, updatedAt: new Date() })
      .where(eq(payments.id, paymentId))
      .returning();
    return payment;
  }

  async createActivityLog(log: InsertActivityLog): Promise<ActivityLog> {
    const [newLog] = await db.insert(activityLogs).values(log).returning();
    return newLog;
  }

  async getActivityLogs(limit: number = 100, offset: number = 0): Promise<ActivityLogWithUser[]> {
    const result = await db
      .select({
        log: activityLogs,
        user: users,
      })
      .from(activityLogs)
      .leftJoin(users, eq(activityLogs.userId, users.id))
      .orderBy(desc(activityLogs.createdAt))
      .limit(limit)
      .offset(offset);

    return result.map((r) => ({
      ...r.log,
      user: r.user,
    }));
  }

  async getDashboardStats(month: number, year: number): Promise<DashboardStats> {
    const allPayments = await this.getAllPayments({ month, year });
    const allUsers = await this.getAllUsers();
    // PMs are identified by the isProjectManager designation, independent of permission role
    const pmUsers = allUsers.filter(u => u.isProjectManager);
    
    let totalTarget = 0;
    let totalReceived = 0;
    let totalUpsells = 0;
    
    const regionMap = new Map<Region, { target: number; received: number; upsells: number }>();
    const pmMap = new Map<string, { pmName: string; profileImageUrl: string | null; target: number; received: number; upsells: number }>();
    
    // Initialize all PM users with zero values
    for (const pm of pmUsers) {
      const pmName = `${pm.firstName || ""} ${pm.lastName || ""}`.trim() || pm.email || "Unknown";
      pmMap.set(pm.id, { pmName, profileImageUrl: pm.profileImageUrl || null, target: 0, received: 0, upsells: 0 });
    }
    
    for (const payment of allPayments) {
      const expected = parseFloat(payment.expectedAmount) || 0;
      const received = parseFloat(payment.receivedAmount || "0") || 0;
      
      if (payment.isTarget) {
        totalTarget += expected;
      }
      totalReceived += received;
      
      if (payment.paymentType === "upsell") {
        totalUpsells += expected;
      }
      
      const region = payment.project.region as Region;
      if (!regionMap.has(region)) {
        regionMap.set(region, { target: 0, received: 0, upsells: 0 });
      }
      const regionStats = regionMap.get(region)!;
      if (payment.isTarget) {
        regionStats.target += expected;
      }
      regionStats.received += received;
      if (payment.paymentType === "upsell") {
        regionStats.upsells += expected;
      }
      
      const pmId = payment.project.pmId;
      if (pmId && pmMap.has(pmId)) {
        const pmStats = pmMap.get(pmId)!;
        if (payment.isTarget) {
          pmStats.target += expected;
        }
        pmStats.received += received;
        if (payment.paymentType === "upsell") {
          pmStats.upsells += expected;
        }
      }
    }
    
    return {
      totalTarget,
      totalReceived,
      totalRemaining: totalTarget - totalReceived,
      totalUpsells,
      regionBreakdown: Array.from(regionMap.entries()).map(([region, stats]) => ({
        region,
        ...stats,
      })),
      pmStats: Array.from(pmMap.entries()).map(([pmId, stats]) => ({
        pmId,
        ...stats,
      })),
    };
  }

  async getPmTargets(month: number, year: number): Promise<PmTargetWithUser[]> {
    const allUsers = await this.getAllUsers();
    const userMap = new Map(allUsers.map(u => [u.id, u]));
    
    const allTargets = await db
      .select()
      .from(pmTargets)
      .where(and(eq(pmTargets.month, month), eq(pmTargets.year, year)));
    
    const targetMap = new Map(allTargets.map(t => [t.pmId, t]));
    
    const allPayments = await this.getAllPayments({ month, year });
    
    // Derive PMs from payment activity rather than filtering by role
    // This handles cases where PM role might not be set correctly or duplicate accounts exist
    const pmIdsFromPayments = new Set<string>();
    for (const payment of allPayments) {
      if (payment.project.pmId) {
        pmIdsFromPayments.add(payment.project.pmId);
      }
    }
    
    // Also include users flagged as Project Managers (designation), for completeness
    const pmUsersFromDesignation = allUsers.filter(u => 
      u.isProjectManager && u.status === "active"
    );
    for (const pm of pmUsersFromDesignation) {
      pmIdsFromPayments.add(pm.id);
    }
    
    const result: PmTargetWithUser[] = [];
    
    for (const pmId of Array.from(pmIdsFromPayments)) {
      const pm = userMap.get(pmId);
      if (!pm) continue; // Skip if user doesn't exist
      if (pm.status !== "active") continue; // Skip inactive/blocked users
      
      const target = targetMap.get(pm.id);
      const pmPayments = allPayments.filter(p => p.project.pmId === pm.id);
      const actualReceived = pmPayments.reduce((sum, p) => sum + (parseFloat(p.receivedAmount || "0") || 0), 0);
      const upsellReceived = pmPayments
        .filter(p => p.paymentType === "upsell")
        .reduce((sum, p) => sum + (parseFloat(p.receivedAmount || "0") || 0), 0);
      const paymentCount = pmPayments.length;
      
      // Calculate target from payments marked as isTarget (targeted payments)
      const calculatedTarget = pmPayments
        .filter(p => p.isTarget)
        .reduce((sum, p) => sum + (parseFloat(p.expectedAmount || "0") || 0), 0);
      
      result.push({
        id: target?.id || "",
        pmId: pm.id,
        month,
        year,
        targetAmount: calculatedTarget.toString(),
        createdAt: target?.createdAt || null,
        updatedAt: target?.updatedAt || null,
        pm,
        actualReceived,
        upsellReceived,
        paymentCount,
      });
    }
    
    return result;
  }

  async getPmTarget(pmId: string, month: number, year: number): Promise<PmTarget | undefined> {
    const [target] = await db
      .select()
      .from(pmTargets)
      .where(and(eq(pmTargets.pmId, pmId), eq(pmTargets.month, month), eq(pmTargets.year, year)));
    return target;
  }

  async upsertPmTarget(data: InsertPmTarget): Promise<PmTarget> {
    const existing = await this.getPmTarget(data.pmId, data.month, data.year);
    
    if (existing) {
      const [updated] = await db
        .update(pmTargets)
        .set({ targetAmount: data.targetAmount, updatedAt: new Date() })
        .where(eq(pmTargets.id, existing.id))
        .returning();
      return updated;
    } else {
      const [newTarget] = await db.insert(pmTargets).values(data).returning();
      return newTarget;
    }
  }

  async deletePmTarget(id: string): Promise<boolean> {
    const result = await db.delete(pmTargets).where(eq(pmTargets.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getAppSettings(): Promise<AppSettings | undefined> {
    const [settings] = await db.select().from(appSettings).limit(1);
    return settings;
  }

  async initializeAppSettings(): Promise<AppSettings> {
    const [newSettings] = await db
      .insert(appSettings)
      .values({
        defaultCurrency: "USD",
        paymentReminderDays: 7,
        dueDateWarningDays: 3,
        enableEmailNotifications: false,
        companyName: "FinanceFlow",
        fiscalYearStartMonth: 1,
        defaultReportFormat: "pdf",
      })
      .returning();
    return newSettings;
  }

  async updateAppSettings(data: UpdateAppSettings, updatedBy?: string): Promise<AppSettings> {
    const existing = await this.getAppSettings();
    
    if (!existing) {
      throw new Error("Settings not initialized. Call initializeAppSettings first.");
    }
    
    const [updated] = await db
      .update(appSettings)
      .set({ ...data, updatedAt: new Date(), updatedBy: updatedBy || null })
      .where(eq(appSettings.id, existing.id))
      .returning();
    return updated;
  }

  async updateUserTheme(userId: string, themeSettings: ThemeSettings | null): Promise<void> {
    await db
      .update(users)
      .set({ themeSettings, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async updateGlobalTheme(themeSettings: ThemeSettings | null, updatedBy?: string): Promise<void> {
    const existing = await this.getAppSettings();
    
    if (!existing) {
      await this.initializeAppSettings();
    }
    
    const settings = await this.getAppSettings();
    if (settings) {
      await db
        .update(appSettings)
        .set({ globalThemeSettings: themeSettings, updatedAt: new Date(), updatedBy: updatedBy || null })
        .where(eq(appSettings.id, settings.id));
    }
  }

  async getNotifications(userId: string, limit: number = 50): Promise<NotificationWithDetails[]> {
    const result = await db
      .select({
        notification: notifications,
        payment: payments,
        project: projects,
      })
      .from(notifications)
      .leftJoin(payments, eq(notifications.paymentId, payments.id))
      .leftJoin(projects, eq(payments.projectId, projects.id))
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);

    return result.map((r) => ({
      ...r.notification,
      payment: r.payment ? { ...r.payment, project: r.project || undefined } : null,
    }));
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    return result[0]?.count || 0;
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [newNotification] = await db.insert(notifications).values(notification).returning();
    return newNotification;
  }

  async createBulkNotifications(notificationsList: InsertNotification[]): Promise<Notification[]> {
    if (notificationsList.length === 0) return [];
    const result = await db.insert(notifications).values(notificationsList).returning();
    return result;
  }

  async markNotificationAsRead(id: string): Promise<Notification | undefined> {
    const [notification] = await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id))
      .returning();
    return notification;
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  }

  async getDismissedAlertIds(userId: string): Promise<Set<string>> {
    const rows = await db
      .select({ alertId: dismissedAlerts.alertId })
      .from(dismissedAlerts)
      .where(eq(dismissedAlerts.userId, userId));
    return new Set(rows.map(r => r.alertId));
  }

  async dismissAlerts(userId: string, alertIds: string[]): Promise<void> {
    if (alertIds.length === 0) return;
    const existing = await this.getDismissedAlertIds(userId);
    const newIds = alertIds.filter(id => !existing.has(id));
    if (newIds.length === 0) return;
    await db.insert(dismissedAlerts).values(
      newIds.map(alertId => ({ userId, alertId }))
    );
  }

  // Notification Response methods
  async createNotificationResponse(response: InsertNotificationResponse): Promise<NotificationResponse> {
    const [newResponse] = await db.insert(notificationResponses).values(response).returning();
    return newResponse;
  }

  async getNotificationResponses(limit: number = 50): Promise<NotificationResponseWithDetails[]> {
    const result = await db
      .select({
        response: notificationResponses,
        responder: users,
        notification: notifications,
      })
      .from(notificationResponses)
      .leftJoin(users, eq(notificationResponses.responderId, users.id))
      .leftJoin(notifications, eq(notificationResponses.notificationId, notifications.id))
      .orderBy(desc(notificationResponses.createdAt))
      .limit(limit);

    return result.map((r) => ({
      ...r.response,
      responder: r.responder,
      notification: r.notification,
    }));
  }

  async getUnreadResponseCount(): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notificationResponses)
      .where(eq(notificationResponses.isRead, false));
    return result[0]?.count || 0;
  }

  async markResponseAsRead(id: string): Promise<NotificationResponse | undefined> {
    const [response] = await db
      .update(notificationResponses)
      .set({ isRead: true })
      .where(eq(notificationResponses.id, id))
      .returning();
    return response;
  }

  async markAllResponsesAsRead(): Promise<void> {
    await db
      .update(notificationResponses)
      .set({ isRead: true })
      .where(eq(notificationResponses.isRead, false));
  }

  async getNotificationsSentByAdmin(adminId: string, limit: number = 50): Promise<NotificationWithDetails[]> {
    const result = await db
      .select({
        notification: notifications,
        payment: payments,
        project: projects,
      })
      .from(notifications)
      .leftJoin(payments, eq(notifications.paymentId, payments.id))
      .leftJoin(projects, eq(payments.projectId, projects.id))
      .where(eq(notifications.createdBy, adminId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);

    return result.map((r) => ({
      ...r.notification,
      payment: r.payment ? { ...r.payment, project: r.project || undefined } : null,
    }));
  }

  async getAllSentNotifications(limit: number = 100): Promise<(NotificationWithDetails & { recipient?: User | null })[]> {
    const result = await db
      .select({
        notification: notifications,
        payment: payments,
        project: projects,
        recipient: users,
      })
      .from(notifications)
      .leftJoin(payments, eq(notifications.paymentId, payments.id))
      .leftJoin(projects, eq(payments.projectId, projects.id))
      .leftJoin(users, eq(notifications.userId, users.id))
      .where(isNotNull(notifications.createdBy))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);

    return result.map((r) => ({
      ...r.notification,
      payment: r.payment ? { ...r.payment, project: r.project || undefined } : null,
      recipient: r.recipient,
    }));
  }

  async getPaymentsDueSoon(days: number): Promise<PaymentWithProject[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + days);

    const result = await db
      .select({
        payment: payments,
        project: projects,
      })
      .from(payments)
      .innerJoin(projects, eq(payments.projectId, projects.id))
      .where(
        and(
          gte(payments.dueDate, today),
          lte(payments.dueDate, futureDate),
          ne(payments.status, "received"),
          eq(payments.dismissedFromReminders, false)
        )
      )
      .orderBy(payments.dueDate);

    return result.map((r) => ({
      ...r.payment,
      project: r.project,
    }));
  }

  async getOverduePayments(): Promise<PaymentWithProject[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await db
      .select({
        payment: payments,
        project: projects,
      })
      .from(payments)
      .innerJoin(projects, eq(payments.projectId, projects.id))
      .where(
        and(
          lt(payments.dueDate, today),
          ne(payments.status, "received"),
          eq(payments.dismissedFromReminders, false)
        )
      )
      .orderBy(payments.dueDate);

    return result.map((r) => ({
      ...r.payment,
      project: r.project,
    }));
  }

  async dismissPaymentFromReminders(paymentId: string, dismissed: boolean): Promise<Payment | undefined> {
    const [updated] = await db
      .update(payments)
      .set({ dismissedFromReminders: dismissed, updatedAt: new Date() })
      .where(eq(payments.id, paymentId))
      .returning();
    return updated;
  }

  async getDismissedPayments(): Promise<PaymentWithProject[]> {
    const result = await db
      .select({
        payment: payments,
        project: projects,
      })
      .from(payments)
      .innerJoin(projects, eq(payments.projectId, projects.id))
      .where(
        and(
          eq(payments.dismissedFromReminders, true),
          ne(payments.status, "received")
        )
      )
      .orderBy(desc(payments.updatedAt));

    return result.map((r) => ({
      ...r.payment,
      project: r.project,
    }));
  }

  // Banking Details methods
  async getAllBankingDetails(): Promise<RegionBankingDetails[]> {
    return await db.select().from(regionBankingDetails).orderBy(regionBankingDetails.region);
  }

  async getBankingDetailsByRegion(region: Region): Promise<RegionBankingDetails | undefined> {
    const [bankingDetails] = await db
      .select()
      .from(regionBankingDetails)
      .where(eq(regionBankingDetails.region, region));
    return bankingDetails;
  }

  async upsertBankingDetails(data: InsertRegionBankingDetails): Promise<RegionBankingDetails> {
    const [result] = await db
      .insert(regionBankingDetails)
      .values(data as any)
      .onConflictDoUpdate({
        target: regionBankingDetails.region,
        set: {
          companyName: data.companyName,
          companyAddress: data.companyAddress,
          bankName: data.bankName,
          accountName: data.accountName,
          accountNumber: data.accountNumber,
          routingNumber: data.routingNumber,
          swiftCode: data.swiftCode,
          iban: data.iban,
          bankAddress: data.bankAddress,
          beneficiaryAddress: data.beneficiaryAddress,
          additionalInstructions: data.additionalInstructions,
          currency: data.currency as any,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result;
  }

  async deleteBankingDetails(region: Region): Promise<boolean> {
    const result = await db
      .delete(regionBankingDetails)
      .where(eq(regionBankingDetails.region, region))
      .returning();
    return result.length > 0;
  }

  // Upsell methods
  async getUpsell(id: string): Promise<Upsell | undefined> {
    const [upsell] = await db.select().from(upsells).where(eq(upsells.id, id));
    return upsell;
  }

  async getUpsellWithDetails(id: string): Promise<UpsellWithDetails | undefined> {
    const result = await db
      .select({
        upsell: upsells,
        project: projects,
        pm: users,
        creator: users,
      })
      .from(upsells)
      .innerJoin(projects, eq(upsells.projectId, projects.id))
      .leftJoin(users, eq(projects.pmId, users.id))
      .where(eq(upsells.id, id));

    if (result.length === 0) return undefined;

    const activities = await this.getUpsellActivities(id);
    
    // Get creator separately
    let creator = null;
    if (result[0].upsell.createdBy) {
      creator = await this.getUser(result[0].upsell.createdBy);
    }

    return {
      ...result[0].upsell,
      project: {
        ...result[0].project,
        pm: result[0].pm,
      },
      creator: creator || null,
      activities,
    };
  }

  async getAllUpsells(filters?: { projectId?: string; status?: UpsellStatus; pmId?: string }): Promise<UpsellWithDetails[]> {
    const conditions = [];

    if (filters?.projectId) {
      conditions.push(eq(upsells.projectId, filters.projectId));
    }
    if (filters?.status) {
      conditions.push(eq(upsells.status, filters.status));
    }
    if (filters?.pmId) {
      conditions.push(eq(projects.pmId, filters.pmId));
    }

    let query = db
      .select({
        upsell: upsells,
        project: projects,
        pm: users,
      })
      .from(upsells)
      .innerJoin(projects, eq(upsells.projectId, projects.id))
      .leftJoin(users, eq(projects.pmId, users.id));

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const result = await query.orderBy(desc(upsells.createdAt));

    if (result.length === 0) return [];

    // Batch fetch all activities and creators to avoid N+1 queries
    const upsellIds = result.map(row => row.upsell.id);
    const creatorIds = [...new Set(result.map(row => row.upsell.createdBy).filter(Boolean))] as string[];

    // Batch fetch activities for all upsells
    const allActivities = await db
      .select({
        activity: upsellActivities,
        creator: users,
      })
      .from(upsellActivities)
      .leftJoin(users, eq(upsellActivities.createdBy, users.id))
      .where(inArray(upsellActivities.upsellId, upsellIds))
      .orderBy(desc(upsellActivities.activityDate));

    // Group activities by upsell ID
    const activitiesMap = new Map<string, typeof allActivities>();
    for (const row of allActivities) {
      const upsellId = row.activity.upsellId;
      if (!activitiesMap.has(upsellId)) {
        activitiesMap.set(upsellId, []);
      }
      activitiesMap.get(upsellId)!.push(row);
    }

    // Batch fetch all creators
    let creatorsMap = new Map<string, User>();
    if (creatorIds.length > 0) {
      const creators = await db.select().from(users).where(inArray(users.id, creatorIds));
      creatorsMap = new Map(creators.map(u => [u.id, u]));
    }

    // Map results with O(1) lookups
    return result.map(row => {
      const upsellActivitiesForRow = activitiesMap.get(row.upsell.id) || [];
      const creator = row.upsell.createdBy ? creatorsMap.get(row.upsell.createdBy) || null : null;
      
      return {
        ...row.upsell,
        project: {
          ...row.project,
          pm: row.pm,
        },
        creator,
        activities: upsellActivitiesForRow.map(a => ({
          ...a.activity,
          creator: a.creator,
        })),
      };
    });
  }

  async getConvertedUpsellTotalsByProject(): Promise<Map<string, number>> {
    // Query upsell payments from the payments table (not the upsells pipeline table)
    // Only include upsells that have been RECEIVED (not pending or invoiced)
    // Using receivedAmount for consistency with profitability calculations
    const result = await db
      .select({
        projectId: payments.projectId,
        amount: payments.receivedAmount,
      })
      .from(payments)
      .where(and(
        eq(payments.paymentType, "upsell"),
        eq(payments.status, "received")
      ));

    const totalsMap = new Map<string, number>();
    for (const row of result) {
      const projectId = row.projectId;
      const amount = parseFloat(row.amount || "0");
      totalsMap.set(projectId, (totalsMap.get(projectId) || 0) + amount);
    }
    return totalsMap;
  }

  async createUpsell(upsell: InsertUpsell): Promise<Upsell> {
    const [newUpsell] = await db.insert(upsells).values(upsell as any).returning();
    return newUpsell;
  }

  async updateUpsell(id: string, data: UpdateUpsell): Promise<Upsell | undefined> {
    const [upsell] = await db
      .update(upsells)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(eq(upsells.id, id))
      .returning();
    return upsell;
  }

  async deleteUpsell(id: string): Promise<boolean> {
    // Activities will be deleted automatically due to ON DELETE CASCADE
    const result = await db.delete(upsells).where(eq(upsells.id, id)).returning();
    return result.length > 0;
  }

  async convertUpsell(id: string, paymentId: string): Promise<Upsell | undefined> {
    const [upsell] = await db
      .update(upsells)
      .set({
        status: "converted" as any,
        convertedPaymentId: paymentId,
        convertedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(upsells.id, id))
      .returning();
    return upsell;
  }

  // Upsell Activity methods
  async getUpsellActivities(upsellId: string): Promise<UpsellActivityWithUser[]> {
    const result = await db
      .select({
        activity: upsellActivities,
        creator: users,
      })
      .from(upsellActivities)
      .leftJoin(users, eq(upsellActivities.createdBy, users.id))
      .where(eq(upsellActivities.upsellId, upsellId))
      .orderBy(desc(upsellActivities.activityDate));

    return result.map((r) => ({
      ...r.activity,
      creator: r.creator,
    }));
  }

  async createUpsellActivity(activity: InsertUpsellActivity): Promise<UpsellActivity> {
    const [newActivity] = await db.insert(upsellActivities).values(activity as any).returning();
    return newActivity;
  }

  async deleteUpsellActivity(id: string): Promise<boolean> {
    const result = await db.delete(upsellActivities).where(eq(upsellActivities.id, id)).returning();
    return result.length > 0;
  }

  // Upsell Type Settings methods
  async getAllUpsellTypes(): Promise<UpsellTypeSetting[]> {
    return await db.select().from(upsellTypeSettings).orderBy(upsellTypeSettings.sortOrder);
  }

  async getActiveUpsellTypes(): Promise<UpsellTypeSetting[]> {
    return await db
      .select()
      .from(upsellTypeSettings)
      .where(eq(upsellTypeSettings.isActive, true))
      .orderBy(upsellTypeSettings.sortOrder);
  }

  async getUpsellType(id: string): Promise<UpsellTypeSetting | undefined> {
    const [upsellType] = await db.select().from(upsellTypeSettings).where(eq(upsellTypeSettings.id, id));
    return upsellType;
  }

  async createUpsellType(data: InsertUpsellTypeSetting): Promise<UpsellTypeSetting> {
    const [upsellType] = await db.insert(upsellTypeSettings).values(data).returning();
    return upsellType;
  }

  async updateUpsellType(id: string, data: UpdateUpsellTypeSetting): Promise<UpsellTypeSetting | undefined> {
    const [upsellType] = await db
      .update(upsellTypeSettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(upsellTypeSettings.id, id))
      .returning();
    return upsellType;
  }

  async deleteUpsellType(id: string): Promise<boolean> {
    const result = await db.delete(upsellTypeSettings).where(eq(upsellTypeSettings.id, id)).returning();
    return result.length > 0;
  }

  async initializeDefaultUpsellTypes(): Promise<void> {
    const existing = await db.select().from(upsellTypeSettings);
    if (existing.length === 0) {
      const defaultTypes = defaultUpsellTypes.map((name, index) => ({
        name,
        displayName: name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        isActive: true,
        sortOrder: index,
      }));
      await db.insert(upsellTypeSettings).values(defaultTypes);
    }
  }

  async ensureUpsellCategories(): Promise<void> {
    // Additive, idempotent seed of the sold-upsell categories (Task #111).
    // Inserts only categories whose `name` is not already present; never deletes
    // or overwrites existing rows, so admin edits in settings are preserved.
    const existing = await db.select().from(upsellTypeSettings);
    const existingNames = new Set(existing.map((t) => t.name));
    const maxSort = existing.reduce((m, t) => Math.max(m, t.sortOrder ?? 0), 0);

    const toInsert = defaultUpsellCategories
      .filter((c) => !existingNames.has(c.name))
      .map((c, i) => ({
        name: c.name,
        displayName: c.displayName,
        isActive: true,
        sortOrder: maxSort + 1 + i,
      }));

    if (toInsert.length > 0) {
      await db.insert(upsellTypeSettings).values(toInsert).onConflictDoNothing();
    }
  }

  // Roles and Permissions methods
  async getAllRoles(): Promise<RoleWithPermissions[]> {
    const allRoles = await db.select().from(roles).orderBy(roles.sortOrder);
    
    if (allRoles.length === 0) return [];
    
    // Batch fetch all permissions for all roles (1 query instead of N)
    const roleIds = allRoles.map(r => r.id);
    const allPermissions = await db
      .select()
      .from(rolePermissions)
      .where(inArray(rolePermissions.roleId, roleIds));
    
    // Group permissions by role
    const permissionsByRole = new Map<string, typeof allPermissions>();
    for (const perm of allPermissions) {
      const rolePerms = permissionsByRole.get(perm.roleId) || [];
      rolePerms.push(perm);
      permissionsByRole.set(perm.roleId, rolePerms);
    }
    
    return allRoles.map(role => ({
      ...role,
      permissions: permissionsByRole.get(role.id) || [],
    }));
  }

  async getRole(id: string): Promise<RoleWithPermissions | undefined> {
    const [role] = await db.select().from(roles).where(eq(roles.id, id));
    if (!role) return undefined;
    
    const permissions = await db
      .select()
      .from(rolePermissions)
      .where(eq(rolePermissions.roleId, id));
    
    return { ...role, permissions };
  }

  async getRoleByName(name: string): Promise<RoleWithPermissions | undefined> {
    const [role] = await db.select().from(roles).where(eq(roles.name, name));
    if (!role) return undefined;
    
    const permissions = await db
      .select()
      .from(rolePermissions)
      .where(eq(rolePermissions.roleId, role.id));
    
    return { ...role, permissions };
  }

  async createRole(data: InsertRole): Promise<Role> {
    const [role] = await db.insert(roles).values(data).returning();
    return role;
  }

  async updateRole(id: string, data: UpdateRole): Promise<Role | undefined> {
    const [role] = await db
      .update(roles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(roles.id, id))
      .returning();
    return role;
  }

  async deleteRole(id: string): Promise<boolean> {
    // Don't delete system roles
    const [role] = await db.select().from(roles).where(eq(roles.id, id));
    if (role?.isSystem) return false;
    
    const result = await db.delete(roles).where(eq(roles.id, id)).returning();
    return result.length > 0;
  }

  async setRolePermissions(roleId: string, permissions: SystemPermission[]): Promise<void> {
    // Delete existing permissions
    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
    
    // Insert new permissions
    if (permissions.length > 0) {
      const permissionValues = permissions.map(permission => ({
        roleId,
        permission,
      }));
      await db.insert(rolePermissions).values(permissionValues);
    }
  }

  async getUserPermissions(userId: string): Promise<SystemPermission[]> {
    const user = await this.getUser(userId);
    if (!user) return [];
    
    // First check the new roleId field
    if (user.roleId) {
      const role = await this.getRole(user.roleId);
      if (role) {
        return role.permissions.map(p => p.permission as SystemPermission);
      }
    }
    
    // Fallback to legacy role field for backward compatibility
    if (user.role === 'admin') {
      const adminRole = await this.getRoleByName('administrator');
      if (adminRole) {
        return adminRole.permissions.map(p => p.permission as SystemPermission);
      }
    }
    
    // Default to production role permissions for pm users
    const prodRole = await this.getRoleByName('production');
    if (prodRole) {
      const perms = prodRole.permissions.map(p => p.permission as SystemPermission);
      // Ensure PM/team-lead legacy users can always view POD performance
      if (!perms.includes('view_pods' as SystemPermission)) {
        perms.push('view_pods' as SystemPermission);
      }
      return perms;
    }

    // Final fallback so legacy users still see POD performance
    return ['view_pods' as SystemPermission];
  }

  async assignRoleToUser(userId: string, roleId: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ roleId, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async initializeDefaultRoles(): Promise<void> {
    const existing = await db.select().from(roles);
    if (existing.length === 0) {
      // Create default roles if none exist
      for (let i = 0; i < defaultRoles.length; i++) {
        const roleData = defaultRoles[i];
        const [role] = await db.insert(roles).values({
          name: roleData.name,
          displayName: roleData.displayName,
          description: roleData.description,
          isSystem: roleData.isSystem,
          isActive: true,
          sortOrder: i,
        }).returning();
        
        // Add permissions for this role
        if (roleData.permissions.length > 0) {
          const permissionValues = roleData.permissions.map(permission => ({
            roleId: role.id,
            permission,
          }));
          await db.insert(rolePermissions).values(permissionValues);
        }
      }
    } else {
      // Sync permissions for existing system roles
      for (const roleData of defaultRoles) {
        const existingRole = existing.find(r => r.name === roleData.name && r.isSystem);
        if (existingRole) {
          // Get current permissions for this role
          const currentPerms = await db
            .select({ permission: rolePermissions.permission })
            .from(rolePermissions)
            .where(eq(rolePermissions.roleId, existingRole.id));
          const currentPermSet = new Set(currentPerms.map(p => p.permission));
          
          // Add any missing permissions
          const missingPerms = roleData.permissions.filter(p => !currentPermSet.has(p));
          if (missingPerms.length > 0) {
            const permissionValues = missingPerms.map(permission => ({
              roleId: existingRole.id,
              permission,
            }));
            await db.insert(rolePermissions).values(permissionValues);
            console.log(`Added ${missingPerms.length} missing permissions to ${roleData.name} role: ${missingPerms.join(', ')}`);
          }
        }
      }
    }
  }

  // Project Milestones
  async getMilestone(id: string): Promise<ProjectMilestone | undefined> {
    const [milestone] = await db.select().from(projectMilestones).where(eq(projectMilestones.id, id));
    return milestone;
  }

  async getMilestoneWithPayment(id: string): Promise<MilestoneWithPayment | undefined> {
    const result = await db
      .select({
        milestone: projectMilestones,
        payment: payments,
      })
      .from(projectMilestones)
      .leftJoin(payments, eq(projectMilestones.paymentId, payments.id))
      .where(eq(projectMilestones.id, id));
    
    if (result.length === 0) return undefined;

    const milestone = result[0].milestone;
    const primaryPayment = result[0].payment;

    // Collect ALL payments linked to this milestone (reverse link via
    // payments.milestoneId) plus the forward-linked primary payment.
    const reversePayments = await db
      .select()
      .from(payments)
      .where(eq(payments.milestoneId, milestone.id));

    const all = new Map<string, Payment>();
    if (primaryPayment) all.set(primaryPayment.id, primaryPayment);
    for (const p of reversePayments) all.set(p.id, p);
    const allPayments = sortLinkedPayments(Array.from(all.values()));

    return {
      ...milestone,
      payment: primaryPayment ?? allPayments[0] ?? null,
      payments: allPayments,
    };
  }

  async getProjectMilestones(projectId: string): Promise<MilestoneWithPayment[]> {
    const result = await db
      .select({
        milestone: projectMilestones,
        payment: payments,
      })
      .from(projectMilestones)
      .leftJoin(payments, eq(projectMilestones.paymentId, payments.id))
      .where(eq(projectMilestones.projectId, projectId))
      .orderBy(projectMilestones.sequenceNumber);
    
    const milestones: MilestoneWithPayment[] = result.map(r => ({
      ...r.milestone,
      payment: r.payment,
      payments: r.payment ? [r.payment] : [],
    }));

    // Collect ALL reverse-linked payments (payments.milestoneId -> milestone.id)
    // so a milestone paid across several split payments shows every linked record.
    const milestoneIds = milestones.map(m => m.id);

    if (milestoneIds.length > 0) {
      const reversePayments = await db
        .select()
        .from(payments)
        .where(inArray(payments.milestoneId, milestoneIds));

      const byMilestone = new Map<string, Payment[]>();
      for (const p of reversePayments) {
        if (!p.milestoneId) continue;
        const list = byMilestone.get(p.milestoneId) ?? [];
        list.push(p);
        byMilestone.set(p.milestoneId, list);
      }

      for (const m of milestones) {
        const reverse = byMilestone.get(m.id) ?? [];
        // Merge forward-linked primary payment with reverse-linked ones, de-duped.
        const all = new Map<string, Payment>();
        if (m.payment) all.set(m.payment.id, m.payment);
        for (const p of reverse) all.set(p.id, p);
        const allPayments = sortLinkedPayments(Array.from(all.values()));
        m.payments = allPayments;
        // Keep a single representative payment for legacy consumers.
        m.payment = m.payment ?? allPayments[0] ?? null;
      }
    }

    return milestones;
  }

  async getProjectWithMilestones(projectId: string): Promise<ProjectWithMilestones | undefined> {
    const projectResult = await db
      .select({
        project: projects,
        pm: users,
      })
      .from(projects)
      .leftJoin(users, eq(projects.pmId, users.id))
      .where(eq(projects.id, projectId));
    
    if (projectResult.length === 0) return undefined;
    
    const milestones = await this.getProjectMilestones(projectId);
    
    return {
      ...projectResult[0].project,
      pm: projectResult[0].pm,
      milestones,
    };
  }

  async createMilestone(milestone: InsertMilestone): Promise<ProjectMilestone> {
    const [created] = await db.insert(projectMilestones).values(milestone).returning();
    return created;
  }

  async createBulkMilestones(milestonesData: InsertMilestone[]): Promise<ProjectMilestone[]> {
    if (milestonesData.length === 0) return [];
    const created = await db.insert(projectMilestones).values(milestonesData).returning();
    return created;
  }

  async updateMilestone(id: string, data: UpdateMilestone): Promise<ProjectMilestone | undefined> {
    const [updated] = await db
      .update(projectMilestones)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(projectMilestones.id, id))
      .returning();
    return updated;
  }

  async deleteMilestone(id: string): Promise<boolean> {
    const result = await db.delete(projectMilestones).where(eq(projectMilestones.id, id)).returning();
    return result.length > 0;
  }

  async deleteProjectMilestones(projectId: string): Promise<boolean> {
    await db.delete(projectMilestones).where(eq(projectMilestones.projectId, projectId));
    return true;
  }

  async linkMilestoneToPayment(milestoneId: string, paymentId: string): Promise<ProjectMilestone | undefined> {
    const [updated] = await db
      .update(projectMilestones)
      .set({ paymentId, updatedAt: new Date() })
      .where(eq(projectMilestones.id, milestoneId))
      .returning();
    return updated;
  }

  // Clear a payment link from a milestone and reset it to an unpaid, relinkable state.
  // Mirrors unlinkCrInstallment; used when a linked payment is cleared or re-linked.
  async unlinkMilestone(milestoneId: string): Promise<ProjectMilestone | undefined> {
    const [milestone] = await db.select().from(projectMilestones).where(eq(projectMilestones.id, milestoneId));
    if (!milestone) return undefined;
    const updateData: Partial<ProjectMilestone> = {
      paymentId: null,
      receivedAmount: "0",
      paidDate: null,
      updatedAt: new Date(),
    };
    // Don't resurrect a cancelled milestone; otherwise return it to planned.
    if (milestone.status !== "cancelled") {
      updateData.status = "planned";
      updateData.invoicedDate = null;
    }
    const [updated] = await db
      .update(projectMilestones)
      .set(updateData)
      .where(eq(projectMilestones.id, milestoneId))
      .returning();
    return updated;
  }

  // Recompute a milestone's received amount, status and primary payment back-link
  // from the FULL set of payments linked to it (payments.milestoneId == milestoneId).
  // This supports a milestone being paid across several split payments: the received
  // amount is the SUM of all linked received payments and the status is derived from
  // that total versus the expected amount.
  async recomputeMilestoneFromPayments(milestoneId: string): Promise<ProjectMilestone | undefined> {
    const [milestone] = await db.select().from(projectMilestones).where(eq(projectMilestones.id, milestoneId));
    if (!milestone) return undefined;

    const linked = await db.select().from(payments).where(eq(payments.milestoneId, milestoneId));
    const receivedPayments = linked.filter(p => p.status === "received");
    const totalReceived = receivedPayments.reduce(
      (sum, p) => sum + parseFloat(p.receivedAmount?.toString() || p.expectedAmount?.toString() || "0"),
      0,
    );
    const expected = parseFloat(milestone.expectedAmount?.toString() || "0");

    // Primary back-reference: prefer a received payment, otherwise any linked payment.
    const primary = receivedPayments[0] || linked[0] || null;

    const updateData: Partial<ProjectMilestone> = {
      receivedAmount: totalReceived.toFixed(2),
      paymentId: primary ? primary.id : null,
      updatedAt: new Date(),
    };

    // Never resurrect a cancelled milestone.
    if (milestone.status !== "cancelled") {
      if (totalReceived <= 0) {
        // Nothing received yet: reflect the furthest-along linked payment status.
        const hasInvoiced = linked.some(p => p.status === "invoiced");
        const hasPending = linked.some(p => p.status === "pending_invoice");
        updateData.status = hasInvoiced ? "invoiced" : hasPending ? "ready_for_invoice" : "planned";
        updateData.paidDate = null;
      } else if (totalReceived + 0.005 >= expected) {
        updateData.status = "paid";
        updateData.paidDate = milestone.paidDate || new Date();
      } else {
        updateData.status = "partially_paid";
        updateData.paidDate = null;
      }
    }

    const [updated] = await db
      .update(projectMilestones)
      .set(updateData)
      .where(eq(projectMilestones.id, milestoneId))
      .returning();
    return updated;
  }

  async updateMilestoneStatus(id: string, status: MilestoneStatus): Promise<ProjectMilestone | undefined> {
    const updateData: Partial<ProjectMilestone> = { 
      status, 
      updatedAt: new Date() 
    };
    
    // Set appropriate dates based on status
    if (status === 'invoiced') {
      updateData.invoicedDate = new Date();
    } else if (status === 'paid') {
      updateData.paidDate = new Date();
    }
    
    const [updated] = await db
      .update(projectMilestones)
      .set(updateData)
      .where(eq(projectMilestones.id, id))
      .returning();
    return updated;
  }

  async getUnpaidMilestones(): Promise<Array<ProjectMilestone & { projectName: string; clientName: string }>> {
    // Fetch milestones that are not yet paid (planned, ready_for_invoice, invoiced, partially_paid)
    const unpaidStatuses = ['planned', 'ready_for_invoice', 'invoiced', 'partially_paid'];
    const result = await db
      .select({
        milestone: projectMilestones,
        projectName: projects.name,
        clientName: projects.clientName,
      })
      .from(projectMilestones)
      .innerJoin(projects, eq(projectMilestones.projectId, projects.id))
      .where(inArray(projectMilestones.status, unpaidStatuses))
      .orderBy(projects.name, projectMilestones.sequenceNumber);
    
    return result.map(row => ({
      ...row.milestone,
      projectName: row.projectName,
      clientName: row.clientName,
    }));
  }

  async getRecentPaymentsByProject(projectId: string, limit: number): Promise<Array<Payment & { milestoneName?: string }>> {
    const result = await db
      .select({
        payment: payments,
        milestoneName: projectMilestones.name,
      })
      .from(payments)
      .leftJoin(projectMilestones, eq(payments.milestoneId, projectMilestones.id))
      .where(eq(payments.projectId, projectId))
      .orderBy(desc(payments.createdAt))
      .limit(limit);
    
    return result.map(row => ({
      ...row.payment,
      milestoneName: row.milestoneName || undefined,
    }));
  }

  // Change Requests
  async getProjectChangeRequests(projectId: string): Promise<ChangeRequestWithInstallments[]> {
    const crs = await db
      .select()
      .from(changeRequests)
      .where(eq(changeRequests.projectId, projectId))
      .orderBy(desc(changeRequests.createdAt));

    if (crs.length === 0) return [];

    const crIds = crs.map(c => c.id);
    const installmentRows = await db
      .select({
        installment: crInstallments,
        payment: payments,
      })
      .from(crInstallments)
      .leftJoin(payments, eq(crInstallments.paymentId, payments.id))
      .where(inArray(crInstallments.changeRequestId, crIds))
      .orderBy(crInstallments.sequenceNumber);

    const byCr = new Map<string, CrInstallmentWithPayment[]>();
    for (const row of installmentRows) {
      const list = byCr.get(row.installment.changeRequestId) || [];
      list.push({ ...row.installment, payment: row.payment });
      byCr.set(row.installment.changeRequestId, list);
    }

    const tagsByCr = await this.getTagsByChangeRequestIds(crIds);

    return crs.map(cr => ({
      ...cr,
      installments: byCr.get(cr.id) || [],
      tags: tagsByCr.get(cr.id) || [],
    }));
  }

  // Returns a map of changeRequestId -> attached tags, ordered by tag name.
  private async getTagsByChangeRequestIds(crIds: string[]): Promise<Map<string, CrTag[]>> {
    const map = new Map<string, CrTag[]>();
    if (crIds.length === 0) return map;
    const rows = await db
      .select({ changeRequestId: changeRequestTags.changeRequestId, tag: crTags })
      .from(changeRequestTags)
      .innerJoin(crTags, eq(changeRequestTags.tagId, crTags.id))
      .where(inArray(changeRequestTags.changeRequestId, crIds))
      .orderBy(crTags.name);
    for (const row of rows) {
      const list = map.get(row.changeRequestId) || [];
      list.push(row.tag);
      map.set(row.changeRequestId, list);
    }
    return map;
  }

  async getCrTags(): Promise<CrTag[]> {
    return await db.select().from(crTags).orderBy(crTags.name);
  }

  async createCrTag(tag: InsertCrTag): Promise<CrTag> {
    const [created] = await db.insert(crTags).values(tag).returning();
    return created;
  }

  async setChangeRequestTags(changeRequestId: string, tagIds: string[]): Promise<void> {
    // Replace the full set of tags for a CR: drop existing links, then insert the
    // new selection (de-duplicated). Wrapped in a transaction so a failed insert
    // (e.g. a stale tagId) rolls back the delete instead of wiping all tags.
    const unique = [...new Set(tagIds)].filter(Boolean);
    await db.transaction(async (tx) => {
      await tx.delete(changeRequestTags).where(eq(changeRequestTags.changeRequestId, changeRequestId));
      if (unique.length === 0) return;
      await tx.insert(changeRequestTags).values(
        unique.map((tagId) => ({ changeRequestId, tagId })),
      );
    });
  }

  async getSoldUpsells(): Promise<SoldUpsell[]> {
    // All locked change requests across projects, surfaced as sold upsells.
    // A CR is "sold" once it has a dateLocked value.
    const rows = await db
      .select({
        cr: changeRequests,
        project: projects,
        pm: users,
      })
      .from(changeRequests)
      .innerJoin(projects, eq(changeRequests.projectId, projects.id))
      .leftJoin(users, eq(projects.pmId, users.id))
      .where(isNotNull(changeRequests.dateLocked))
      .orderBy(desc(changeRequests.dateLocked));

    if (rows.length === 0) return [];

    const crIds = rows.map((r) => r.cr.id);
    const installmentRows = await db
      .select({ installment: crInstallments, payment: payments })
      .from(crInstallments)
      .leftJoin(payments, eq(crInstallments.paymentId, payments.id))
      .where(inArray(crInstallments.changeRequestId, crIds))
      .orderBy(crInstallments.sequenceNumber);

    const byCr = new Map<string, CrInstallmentWithPayment[]>();
    for (const row of installmentRows) {
      const list = byCr.get(row.installment.changeRequestId) || [];
      list.push({ ...row.installment, payment: row.payment });
      byCr.set(row.installment.changeRequestId, list);
    }

    const creatorIds = [...new Set(rows.map((r) => r.cr.createdBy).filter(Boolean))] as string[];
    let creatorsMap = new Map<string, User>();
    if (creatorIds.length > 0) {
      const creators = await db.select().from(users).where(inArray(users.id, creatorIds));
      creatorsMap = new Map(creators.map((u) => [u.id, u]));
    }

    const tagsByCr = await this.getTagsByChangeRequestIds(crIds);

    return rows.map((row) => {
      const installments = byCr.get(row.cr.id) || [];
      const expectedAmount = installments.reduce(
        (sum, i) => sum + parseFloat(i.expectedAmount?.toString() || "0"),
        0,
      );
      const receivedAmount = installments.reduce(
        (sum, i) => sum + parseFloat(i.receivedAmount?.toString() || "0"),
        0,
      );
      return {
        ...row.cr,
        installments,
        project: { ...row.project, pm: row.pm },
        creator: row.cr.createdBy ? creatorsMap.get(row.cr.createdBy) || null : null,
        expectedAmount,
        receivedAmount,
        tags: tagsByCr.get(row.cr.id) || [],
      };
    });
  }

  async getLatestUpsellAiAnalysis(scope: UpsellAnalysisScope = "combined"): Promise<UpsellAiAnalysisWithUser | undefined> {
    const [row] = await db
      .select({ analysis: upsellAiAnalyses, generator: users })
      .from(upsellAiAnalyses)
      .leftJoin(users, eq(upsellAiAnalyses.generatedBy, users.id))
      .where(eq(upsellAiAnalyses.scope, scope))
      .orderBy(desc(upsellAiAnalyses.createdAt))
      .limit(1);
    if (!row) return undefined;
    return { ...row.analysis, generator: row.generator };
  }

  async createUpsellAiAnalysis(analysis: InsertUpsellAiAnalysis): Promise<UpsellAiAnalysis> {
    const [created] = await db.insert(upsellAiAnalyses).values(analysis).returning();
    return created;
  }

  async getAiProviderSettings(): Promise<AiProviderSettings[]> {
    return await db.select().from(aiProviderSettings);
  }

  async getAiProviderSetting(provider: UpsellAiProvider): Promise<AiProviderSettings | undefined> {
    const [row] = await db
      .select()
      .from(aiProviderSettings)
      .where(eq(aiProviderSettings.provider, provider))
      .limit(1);
    return row;
  }

  async upsertAiProviderSetting(data: InsertAiProviderSettings, updatedBy?: string): Promise<AiProviderSettings> {
    const existing = await this.getAiProviderSetting(data.provider as UpsellAiProvider);
    if (existing) {
      const updateData: any = { ...data, updatedAt: new Date() };
      if (updatedBy) updateData.updatedBy = updatedBy;
      // Keep the stored key when the caller didn't supply a new one.
      if (!updateData.apiKey) delete updateData.apiKey;
      const [updated] = await db
        .update(aiProviderSettings)
        .set(updateData)
        .where(eq(aiProviderSettings.id, existing.id))
        .returning();
      return updated;
    }
    const insertData: any = { ...data };
    if (updatedBy) insertData.updatedBy = updatedBy;
    const [created] = await db.insert(aiProviderSettings).values(insertData).returning();
    return created;
  }

  async getChangeRequest(id: string): Promise<ChangeRequest | undefined> {
    const [cr] = await db.select().from(changeRequests).where(eq(changeRequests.id, id));
    return cr;
  }

  async createChangeRequest(changeRequest: InsertChangeRequest): Promise<ChangeRequest> {
    const [created] = await db.insert(changeRequests).values(changeRequest).returning();
    return created;
  }

  async updateChangeRequest(id: string, data: UpdateChangeRequest): Promise<ChangeRequest | undefined> {
    const [updated] = await db
      .update(changeRequests)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(changeRequests.id, id))
      .returning();
    return updated;
  }

  async deleteChangeRequest(id: string): Promise<boolean> {
    const result = await db.delete(changeRequests).where(eq(changeRequests.id, id)).returning();
    return result.length > 0;
  }

  async createBulkCrInstallments(installments: InsertCrInstallment[]): Promise<CrInstallment[]> {
    if (installments.length === 0) return [];
    const created = await db.insert(crInstallments).values(installments as (typeof crInstallments.$inferInsert)[]).returning();
    return created;
  }

  async getCrInstallment(id: string): Promise<CrInstallment | undefined> {
    const [installment] = await db.select().from(crInstallments).where(eq(crInstallments.id, id));
    return installment;
  }

  async getProjectUnpaidCrInstallments(projectId: string): Promise<CrInstallment[]> {
    const unpaidStatuses: MilestoneStatus[] = ['planned', 'ready_for_invoice', 'invoiced', 'partially_paid'];
    return await db
      .select()
      .from(crInstallments)
      .where(and(
        eq(crInstallments.projectId, projectId),
        inArray(crInstallments.status, unpaidStatuses),
      ))
      .orderBy(crInstallments.sequenceNumber);
  }

  async updateCrInstallment(id: string, data: UpdateCrInstallment): Promise<CrInstallment | undefined> {
    const [updated] = await db
      .update(crInstallments)
      .set({ ...data, status: data.status as MilestoneStatus | undefined, updatedAt: new Date() })
      .where(eq(crInstallments.id, id))
      .returning();
    return updated;
  }

  async updateCrInstallmentStatus(id: string, status: MilestoneStatus, receivedAmount?: string): Promise<CrInstallment | undefined> {
    const updateData: Partial<CrInstallment> = {
      status,
      updatedAt: new Date(),
    };
    if (status === 'invoiced') {
      updateData.invoicedDate = new Date();
    } else if (status === 'paid') {
      updateData.paidDate = new Date();
    }
    if (receivedAmount !== undefined) {
      updateData.receivedAmount = receivedAmount;
    }
    const [updated] = await db
      .update(crInstallments)
      .set(updateData)
      .where(eq(crInstallments.id, id))
      .returning();
    return updated;
  }

  async linkCrInstallmentToPayment(installmentId: string, paymentId: string): Promise<CrInstallment | undefined> {
    const [updated] = await db
      .update(crInstallments)
      .set({ paymentId, updatedAt: new Date() })
      .where(eq(crInstallments.id, installmentId))
      .returning();
    return updated;
  }

  // Clear a payment link from an installment and reset it to an unpaid, relinkable state.
  // Used when a linked payment is deleted or re-linked to a different installment.
  async unlinkCrInstallment(installmentId: string): Promise<CrInstallment | undefined> {
    const [installment] = await db.select().from(crInstallments).where(eq(crInstallments.id, installmentId));
    if (!installment) return undefined;
    const updateData: Partial<CrInstallment> = {
      paymentId: null,
      receivedAmount: "0",
      paidDate: null,
      updatedAt: new Date(),
    };
    // Don't resurrect a cancelled installment; otherwise return it to planned.
    if (installment.status !== "cancelled") {
      updateData.status = "planned";
      updateData.invoicedDate = null;
    }
    const [updated] = await db
      .update(crInstallments)
      .set(updateData)
      .where(eq(crInstallments.id, installmentId))
      .returning();
    return updated;
  }

  // Recompute a CR installment's received amount, status and primary payment back-link
  // from the FULL set of payments linked to it (payments.crInstallmentId == installmentId).
  // Mirrors recomputeMilestoneFromPayments so an installment can be paid across several
  // split payments: received amount is the SUM of all linked received payments.
  async recomputeCrInstallmentFromPayments(installmentId: string): Promise<CrInstallment | undefined> {
    const [installment] = await db.select().from(crInstallments).where(eq(crInstallments.id, installmentId));
    if (!installment) return undefined;

    const linked = await db.select().from(payments).where(eq(payments.crInstallmentId, installmentId));
    const receivedPayments = linked.filter(p => p.status === "received");
    const totalReceived = receivedPayments.reduce(
      (sum, p) => sum + parseFloat(p.receivedAmount?.toString() || p.expectedAmount?.toString() || "0"),
      0,
    );
    const expected = parseFloat(installment.expectedAmount?.toString() || "0");

    const primary = receivedPayments[0] || linked[0] || null;

    const updateData: Partial<CrInstallment> = {
      receivedAmount: totalReceived.toFixed(2),
      paymentId: primary ? primary.id : null,
      updatedAt: new Date(),
    };

    if (installment.status !== "cancelled") {
      if (totalReceived <= 0) {
        const hasInvoiced = linked.some(p => p.status === "invoiced");
        const hasPending = linked.some(p => p.status === "pending_invoice");
        updateData.status = hasInvoiced ? "invoiced" : hasPending ? "ready_for_invoice" : "planned";
        updateData.paidDate = null;
      } else if (totalReceived + 0.005 >= expected) {
        updateData.status = "paid";
        updateData.paidDate = installment.paidDate || new Date();
      } else {
        updateData.status = "partially_paid";
        updateData.paidDate = null;
      }
    }

    const [updated] = await db
      .update(crInstallments)
      .set(updateData)
      .where(eq(crInstallments.id, installmentId))
      .returning();
    return updated;
  }

  // Google Drive folder cache
  async getProjectDriveFolders(projectId: string): Promise<ProjectDriveFolder | undefined> {
    const [row] = await db
      .select()
      .from(projectDriveFolders)
      .where(eq(projectDriveFolders.projectId, projectId));
    return row;
  }

  async getAllProjectDriveFolders(): Promise<Array<ProjectDriveFolder & { projectName: string; region: Region; status: string }>> {
    const rows = await db
      .select({
        id: projectDriveFolders.id,
        projectId: projectDriveFolders.projectId,
        projectFolderId: projectDriveFolders.projectFolderId,
        changeRequestsFolderId: projectDriveFolders.changeRequestsFolderId,
        invoicesFolderId: projectDriveFolders.invoicesFolderId,
        paymentReceiptsFolderId: projectDriveFolders.paymentReceiptsFolderId,
        createdAt: projectDriveFolders.createdAt,
        updatedAt: projectDriveFolders.updatedAt,
        projectName: projects.name,
        region: projects.region,
        status: projects.status,
      })
      .from(projectDriveFolders)
      .innerJoin(projects, eq(projectDriveFolders.projectId, projects.id))
      .orderBy(asc(projects.name));
    return rows as Array<ProjectDriveFolder & { projectName: string; region: Region; status: string }>;
  }

  async upsertProjectDriveFolders(data: InsertProjectDriveFolder): Promise<ProjectDriveFolder> {
    const [row] = await db
      .insert(projectDriveFolders)
      .values(data)
      .onConflictDoUpdate({
        target: projectDriveFolders.projectId,
        set: {
          projectFolderId: data.projectFolderId,
          changeRequestsFolderId: data.changeRequestsFolderId,
          invoicesFolderId: data.invoicesFolderId,
          paymentReceiptsFolderId: data.paymentReceiptsFolderId,
          updatedAt: new Date(),
        },
      })
      .returning();
    return row;
  }

  // Forecasting methods - CEO/CFO level
  // Get ALL unpaid milestones (status != paid && status != cancelled)
  async getAllUnpaidMilestones(): Promise<Array<{ milestone: ProjectMilestone; project: Project; pm: User | null }>> {
    const result = await db
      .select({
        milestone: projectMilestones,
        project: projects,
        pm: users,
      })
      .from(projectMilestones)
      .innerJoin(projects, eq(projectMilestones.projectId, projects.id))
      .leftJoin(users, eq(projects.pmId, users.id))
      .where(
        notInArray(projectMilestones.status, ['paid', 'cancelled'])
      )
      .orderBy(projectMilestones.dueDate);
    
    return result;
  }

  // Get ALL unpaid payments (status != received)
  async getAllUnpaidPayments(): Promise<Array<{ payment: Payment; project: Project; pm: User | null }>> {
    const result = await db
      .select({
        payment: payments,
        project: projects,
        pm: users,
      })
      .from(payments)
      .innerJoin(projects, eq(payments.projectId, projects.id))
      .leftJoin(users, eq(projects.pmId, users.id))
      .where(
        ne(payments.status, 'received')
      )
      .orderBy(payments.dueDate);
    
    return result;
  }

  // Get last received payment date for a project (for MRR/TBE due date calculation)
  async getLastReceivedPaymentDate(projectId: string): Promise<Date | null> {
    const result = await db
      .select({ receivedDate: payments.receivedDate })
      .from(payments)
      .where(
        and(
          eq(payments.projectId, projectId),
          eq(payments.status, 'received'),
          isNotNull(payments.receivedDate)
        )
      )
      .orderBy(desc(payments.receivedDate))
      .limit(1);
    
    return result[0]?.receivedDate || null;
  }

  // Get last received milestone paid date for a project
  async getLastPaidMilestoneDate(projectId: string): Promise<Date | null> {
    const result = await db
      .select({ paidDate: projectMilestones.paidDate })
      .from(projectMilestones)
      .where(
        and(
          eq(projectMilestones.projectId, projectId),
          eq(projectMilestones.status, 'paid'),
          isNotNull(projectMilestones.paidDate)
        )
      )
      .orderBy(desc(projectMilestones.paidDate))
      .limit(1);
    
    return result[0]?.paidDate || null;
  }

  // Legacy methods kept for backward compatibility
  async getAllProjectMilestones(): Promise<ProjectMilestone[]> {
    return await db.select().from(projectMilestones).orderBy(projectMilestones.projectId, projectMilestones.sequenceNumber);
  }

  async getMilestonesForForecasting(month: number, year: number): Promise<Array<{ milestone: ProjectMilestone; project: Project }>> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);
    
    const result = await db
      .select({
        milestone: projectMilestones,
        project: projects,
      })
      .from(projectMilestones)
      .innerJoin(projects, eq(projectMilestones.projectId, projects.id))
      .where(
        and(
          gte(projectMilestones.dueDate, startDate),
          lte(projectMilestones.dueDate, endDate),
          notInArray(projectMilestones.status, ['paid', 'cancelled'])
        )
      )
      .orderBy(projectMilestones.dueDate);
    
    return result;
  }

  async getPlanningPaymentsForForecasting(month: number, year: number): Promise<PaymentWithProject[]> {
    const result = await db
      .select({
        payment: payments,
        project: projects,
      })
      .from(payments)
      .innerJoin(projects, eq(payments.projectId, projects.id))
      .where(
        and(
          eq(payments.month, month),
          eq(payments.year, year),
          isNotNull(payments.monthlyPlanId),
          lt(payments.probability, 100),
          ne(payments.status, 'received')
        )
      )
      .orderBy(payments.dueDate);
    
    return result.map(row => ({
      ...row.payment,
      project: row.project,
    }));
  }

  // Invoice methods
  async getInvoice(id: string): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
    return invoice;
  }

  async getInvoiceWithDetails(id: string): Promise<InvoiceWithDetails | undefined> {
    const [result] = await db
      .select({
        invoice: invoices,
        project: projects,
        payment: payments,
        creator: users,
      })
      .from(invoices)
      .leftJoin(projects, eq(invoices.projectId, projects.id))
      .leftJoin(payments, eq(invoices.paymentId, payments.id))
      .leftJoin(users, eq(invoices.createdBy, users.id))
      .where(eq(invoices.id, id));

    if (!result) return undefined;

    const lineItems = await this.getInvoiceLineItems(id);

    return {
      ...result.invoice,
      project: result.project,
      payment: result.payment,
      creator: result.creator,
      lineItems,
    };
  }

  async getAllInvoices(filters?: { projectId?: string; status?: InvoiceStatus; region?: Region; startDate?: Date; endDate?: Date }): Promise<InvoiceListItem[]> {
    const conditions = [];
    
    if (filters?.projectId) {
      conditions.push(eq(invoices.projectId, filters.projectId));
    }
    if (filters?.status) {
      conditions.push(eq(invoices.status, filters.status));
    }
    if (filters?.region) {
      conditions.push(eq(invoices.region, filters.region));
    }
    if (filters?.startDate) {
      conditions.push(gte(invoices.issueDate, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(invoices.issueDate, filters.endDate));
    }

    const result = await db
      .select({
        invoice: invoices,
        projectName: projects.name,
        creatorFirstName: users.firstName,
        creatorLastName: users.lastName,
      })
      .from(invoices)
      .leftJoin(projects, eq(invoices.projectId, projects.id))
      .leftJoin(users, eq(invoices.createdBy, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(invoices.issueDate));

    return result.map(row => ({
      ...row.invoice,
      projectName: row.projectName,
      creatorName: row.creatorFirstName && row.creatorLastName 
        ? `${row.creatorFirstName} ${row.creatorLastName}` 
        : row.creatorFirstName || null,
    }));
  }

  async createInvoice(invoice: InsertInvoice): Promise<Invoice> {
    const [created] = await db.insert(invoices).values(invoice).returning();
    return created;
  }

  async updateInvoice(id: string, data: UpdateInvoice): Promise<Invoice | undefined> {
    const [updated] = await db
      .update(invoices)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(invoices.id, id))
      .returning();
    return updated;
  }

  async deleteInvoice(id: string): Promise<boolean> {
    await db.delete(invoiceLineItems).where(eq(invoiceLineItems.invoiceId, id));
    await db.delete(invoices).where(eq(invoices.id, id));
    return true;
  }

  async markInvoicePaid(id: string, paidDate: Date, amountPaid: string): Promise<Invoice | undefined> {
    const invoice = await this.getInvoice(id);
    if (!invoice) return undefined;

    const { amountPaid: totalPaid, balance, status } = computeInvoicePayment(invoice, amountPaid);

    const [updated] = await db
      .update(invoices)
      .set({ 
        paidDate, 
        amountPaid: totalPaid, 
        balance,
        status,
        updatedAt: new Date() 
      })
      .where(eq(invoices.id, id))
      .returning();
    return updated;
  }

  async getNextInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;
    
    const [lastInvoice] = await db
      .select({ invoiceNumber: invoices.invoiceNumber })
      .from(invoices)
      .where(sql`${invoices.invoiceNumber} LIKE ${prefix + '%'}`)
      .orderBy(desc(invoices.invoiceNumber))
      .limit(1);

    if (!lastInvoice) {
      return `${prefix}0001`;
    }

    const lastNumber = parseInt(lastInvoice.invoiceNumber.replace(prefix, ''), 10);
    const nextNumber = (lastNumber + 1).toString().padStart(4, '0');
    return `${prefix}${nextNumber}`;
  }

  async getInvoiceByPaymentId(paymentId: string): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.paymentId, paymentId));
    return invoice;
  }

  // Invoice Line Items
  async getInvoiceLineItems(invoiceId: string): Promise<InvoiceLineItem[]> {
    return await db
      .select()
      .from(invoiceLineItems)
      .where(eq(invoiceLineItems.invoiceId, invoiceId))
      .orderBy(invoiceLineItems.sortOrder);
  }

  async createInvoiceLineItem(item: InsertInvoiceLineItem): Promise<InvoiceLineItem> {
    const [created] = await db.insert(invoiceLineItems).values(item).returning();
    return created;
  }

  async createBulkInvoiceLineItems(items: InsertInvoiceLineItem[]): Promise<InvoiceLineItem[]> {
    if (items.length === 0) return [];
    return await db.insert(invoiceLineItems).values(items).returning();
  }

  async deleteInvoiceLineItems(invoiceId: string): Promise<boolean> {
    await db.delete(invoiceLineItems).where(eq(invoiceLineItems.invoiceId, invoiceId));
    return true;
  }

  // SMTP Settings
  async getSMTPSettings(): Promise<SMTPSettings | undefined> {
    const [settings] = await db.select().from(smtpSettings).where(eq(smtpSettings.isActive, true)).limit(1);
    return settings;
  }

  async upsertSMTPSettings(data: InsertSMTPSettings | UpdateSMTPSettings, updatedBy?: string): Promise<SMTPSettings> {
    // Check if settings exist
    const existing = await this.getSMTPSettings();
    
    if (existing) {
      // Update existing settings
      const updateData: any = { ...data, updatedAt: new Date() };
      if (updatedBy) updateData.updatedBy = updatedBy;
      
      // If password is empty/undefined, keep existing password
      if (!updateData.password) {
        delete updateData.password;
      }
      
      const [updated] = await db
        .update(smtpSettings)
        .set(updateData)
        .where(eq(smtpSettings.id, existing.id))
        .returning();
      return updated;
    } else {
      // Create new settings
      const insertData: any = { ...data };
      if (updatedBy) insertData.updatedBy = updatedBy;
      
      const [created] = await db.insert(smtpSettings).values(insertData).returning();
      return created;
    }
  }

  // Data Import methods
  async createDataImport(data: InsertDataImport): Promise<DataImport> {
    const [created] = await db.insert(dataImports).values(data).returning();
    return created;
  }

  async getDataImports(): Promise<DataImport[]> {
    return await db
      .select()
      .from(dataImports)
      .orderBy(desc(dataImports.createdAt));
  }

  async getDataImport(id: string): Promise<DataImport | undefined> {
    const [result] = await db.select().from(dataImports).where(eq(dataImports.id, id));
    return result;
  }

  async updateDataImport(id: string, data: Partial<InsertDataImport>): Promise<DataImport | undefined> {
    const [updated] = await db
      .update(dataImports)
      .set(data)
      .where(eq(dataImports.id, id))
      .returning();
    return updated;
  }

  // Get all projects with their milestones for import reference
  async getProjectsWithMilestonesForImport(): Promise<ProjectWithMilestones[]> {
    const projectList = await db
      .select()
      .from(projects)
      .where(eq(projects.status, "active"))
      .orderBy(projects.name);

    if (projectList.length === 0) return [];

    // Batch fetch all milestones for all projects (1 query instead of N)
    const projectIds = projectList.map(p => p.id);
    const allMilestones = await db
      .select()
      .from(projectMilestones)
      .where(inArray(projectMilestones.projectId, projectIds))
      .orderBy(projectMilestones.sequenceNumber);

    // Group milestones by project
    const milestonesByProject = new Map<string, typeof allMilestones>();
    for (const milestone of allMilestones) {
      const projectMilestonesList = milestonesByProject.get(milestone.projectId) || [];
      projectMilestonesList.push(milestone);
      milestonesByProject.set(milestone.projectId, projectMilestonesList);
    }

    return projectList.map(proj => ({
      ...proj,
      milestones: milestonesByProject.get(proj.id) || [],
    }));
  }

  // Batch update payments from import
  async batchUpdatePaymentsFromImport(
    updates: Array<{
      paymentId?: string;
      milestoneId?: string;
      projectId: string;
      month: number;
      year: number;
      expectedAmount: string;
      receivedAmount: string;
      status: PaymentStatus;
      paymentType?: "recurring" | "upsell";
      isTarget?: boolean;
      receivedDate?: Date | null;
      invoiceDate?: Date | null;
      narration?: string;
    }>
  ): Promise<{ created: number; updated: number; errors: string[]; createdPaymentIds: string[] }> {
    let created = 0;
    let updated = 0;
    const errors: string[] = [];
    const createdPaymentIds: string[] = [];

    for (const update of updates) {
      try {
        if (update.paymentId) {
          // Update existing payment - only include isTarget if explicitly provided
          const updateData: Record<string, any> = {
            receivedAmount: update.receivedAmount,
            status: update.status,
            paymentType: update.paymentType || "recurring",
            receivedDate: update.receivedDate,
            invoiceDate: update.invoiceDate,
            updatedAt: new Date(),
          };
          if (update.isTarget !== undefined) {
            updateData.isTarget = update.isTarget;
          }
          await db
            .update(payments)
            .set(updateData)
            .where(eq(payments.id, update.paymentId));
          updated++;
        } else {
          // Create new payment
          const [newPayment] = await db.insert(payments).values({
            projectId: update.projectId,
            milestoneId: update.milestoneId,
            expectedAmount: update.expectedAmount,
            totalAmount: update.expectedAmount,
            receivedAmount: update.receivedAmount,
            paymentType: update.paymentType || "recurring",
            status: update.status,
            narration: update.narration,
            month: update.month,
            year: update.year,
            isTarget: update.isTarget ?? true,
            probability: 100,
            receivedDate: update.receivedDate,
            invoiceDate: update.invoiceDate,
          }).returning();
          createdPaymentIds.push(newPayment.id);
          created++;
        }

        // Also update milestone status if milestoneId provided
        if (update.milestoneId) {
          const milestoneStatus: MilestoneStatus = update.status === "received" ? "paid" : 
            update.status === "invoiced" ? "invoiced" : 
            update.status === "pending_invoice" ? "ready_for_invoice" : "planned";
          
          await db
            .update(projectMilestones)
            .set({
              status: milestoneStatus,
              receivedAmount: update.receivedAmount,
              payedDate: update.receivedDate,
              updatedAt: new Date(),
            })
            .where(eq(projectMilestones.id, update.milestoneId));
        }
      } catch (error: any) {
        errors.push(`Row error: ${error.message}`);
      }
    }

    return { created, updated, errors, createdPaymentIds };
  }

  // ============================================================================
  // COST & MARGIN MODULE IMPLEMENTATIONS
  // ============================================================================

  // Timesheets
  async getTimesheet(id: string): Promise<Timesheet | undefined> {
    const [timesheet] = await db.select().from(timesheets).where(eq(timesheets.id, id));
    return timesheet;
  }

  async getTimesheetWithDetails(id: string): Promise<TimesheetWithDetails | undefined> {
    const [timesheet] = await db.select().from(timesheets).where(eq(timesheets.id, id));
    if (!timesheet) return undefined;

    const [user] = timesheet.userId ? await db.select().from(users).where(eq(users.id, timesheet.userId)) : [null];
    const [project] = timesheet.projectId ? await db.select().from(projects).where(eq(projects.id, timesheet.projectId)) : [null];
    const [approver] = timesheet.approvedBy ? await db.select().from(users).where(eq(users.id, timesheet.approvedBy)) : [null];

    return { ...timesheet, user, project, approver };
  }

  async getProjectTimesheets(projectId: string, filters?: { month?: number; year?: number; userId?: string; status?: TimesheetStatus }): Promise<TimesheetWithDetails[]> {
    const conditions = [eq(timesheets.projectId, projectId)];
    
    if (filters?.month !== undefined && filters?.year !== undefined) {
      const startDate = new Date(filters.year, filters.month - 1, 1);
      const endDate = new Date(filters.year, filters.month, 0, 23, 59, 59);
      conditions.push(gte(timesheets.date, startDate));
      conditions.push(lte(timesheets.date, endDate));
    }
    if (filters?.userId) conditions.push(eq(timesheets.userId, filters.userId));
    if (filters?.status) conditions.push(eq(timesheets.approvalStatus, filters.status));

    const timesheetList = await db.select().from(timesheets)
      .where(and(...conditions))
      .orderBy(desc(timesheets.date));

    return this.enrichTimesheetsWithDetails(timesheetList);
  }
  
  private async enrichTimesheetsWithDetails(timesheetList: Timesheet[]): Promise<TimesheetWithDetails[]> {
    if (timesheetList.length === 0) return [];
    
    // Collect all unique IDs
    const userIds = new Set<string>();
    const projectIds = new Set<string>();
    const approverIds = new Set<string>();
    
    for (const ts of timesheetList) {
      if (ts.userId) userIds.add(ts.userId);
      if (ts.projectId) projectIds.add(ts.projectId);
      if (ts.approvedBy) approverIds.add(ts.approvedBy);
    }
    
    // Batch fetch all related entities (3 queries instead of N*3)
    const [allUsers, allProjects] = await Promise.all([
      userIds.size > 0 ? db.select().from(users).where(inArray(users.id, Array.from(userIds))) : [],
      projectIds.size > 0 ? db.select().from(projects).where(inArray(projects.id, Array.from(projectIds))) : [],
    ]);
    
    // Approvers are also users, fetch separately if needed (may overlap with users)
    const approverOnlyIds = Array.from(approverIds).filter(id => !userIds.has(id));
    const additionalApprovers = approverOnlyIds.length > 0 
      ? await db.select().from(users).where(inArray(users.id, approverOnlyIds))
      : [];
    const allApprovers = [...allUsers, ...additionalApprovers];
    
    // Create lookup maps
    const userMap = new Map(allUsers.map(u => [u.id, u]));
    const projectMap = new Map(allProjects.map(p => [p.id, p]));
    const approverMap = new Map(allApprovers.map(a => [a.id, a]));
    
    // Build result with O(1) lookups
    return timesheetList.map(ts => ({
      ...ts,
      user: ts.userId ? userMap.get(ts.userId) || null : null,
      project: ts.projectId ? projectMap.get(ts.projectId) || null : null,
      approver: ts.approvedBy ? approverMap.get(ts.approvedBy) || null : null,
    }));
  }

  async getUserTimesheets(userId: string, filters?: { month?: number; year?: number; projectId?: string }): Promise<TimesheetWithDetails[]> {
    const conditions = [eq(timesheets.userId, userId)];
    
    if (filters?.month !== undefined && filters?.year !== undefined) {
      const startDate = new Date(filters.year, filters.month - 1, 1);
      const endDate = new Date(filters.year, filters.month, 0, 23, 59, 59);
      conditions.push(gte(timesheets.date, startDate));
      conditions.push(lte(timesheets.date, endDate));
    }
    if (filters?.projectId) conditions.push(eq(timesheets.projectId, filters.projectId));

    const timesheetList = await db.select().from(timesheets)
      .where(and(...conditions))
      .orderBy(desc(timesheets.date));

    return this.enrichTimesheetsWithDetails(timesheetList);
  }

  async getAllTimesheets(filters?: { month?: number; year?: number; projectId?: string; userId?: string; status?: TimesheetStatus }): Promise<TimesheetWithDetails[]> {
    const conditions: ReturnType<typeof eq>[] = [];
    
    if (filters?.month !== undefined && filters?.year !== undefined) {
      const startDate = new Date(filters.year, filters.month - 1, 1);
      const endDate = new Date(filters.year, filters.month, 0, 23, 59, 59);
      conditions.push(gte(timesheets.date, startDate) as any);
      conditions.push(lte(timesheets.date, endDate) as any);
    }
    if (filters?.projectId) conditions.push(eq(timesheets.projectId, filters.projectId));
    if (filters?.userId) conditions.push(eq(timesheets.userId, filters.userId));
    if (filters?.status) conditions.push(eq(timesheets.approvalStatus, filters.status));

    const timesheetList = conditions.length > 0
      ? await db.select().from(timesheets).where(and(...conditions)).orderBy(desc(timesheets.date))
      : await db.select().from(timesheets).orderBy(desc(timesheets.date));

    return this.enrichTimesheetsWithDetails(timesheetList);
  }

  async getTimesheetsUpToMonth(endMonth: number, endYear: number, projectId?: string): Promise<TimesheetWithDetails[]> {
    const endDate = new Date(endYear, endMonth, 0, 23, 59, 59);
    const conditions: ReturnType<typeof eq>[] = [lte(timesheets.date, endDate) as any];
    
    if (projectId) conditions.push(eq(timesheets.projectId, projectId));

    const timesheetList = await db.select().from(timesheets)
      .where(and(...conditions))
      .orderBy(desc(timesheets.date));

    return this.enrichTimesheetsWithDetails(timesheetList);
  }

  async createTimesheet(data: InsertTimesheet): Promise<Timesheet> {
    const [timesheet] = await db.insert(timesheets).values(data).returning();
    return timesheet;
  }

  async updateTimesheet(id: string, data: UpdateTimesheet): Promise<Timesheet | undefined> {
    const [timesheet] = await db.update(timesheets)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(timesheets.id, id))
      .returning();
    return timesheet;
  }

  async deleteTimesheet(id: string): Promise<boolean> {
    const result = await db.delete(timesheets).where(eq(timesheets.id, id));
    return !!result;
  }

  async approveTimesheet(id: string, approverId: string): Promise<Timesheet | undefined> {
    const [timesheet] = await db.update(timesheets)
      .set({ 
        approvalStatus: "approved" as TimesheetStatus, 
        approvedBy: approverId, 
        approvedAt: new Date(),
        updatedAt: new Date() 
      })
      .where(eq(timesheets.id, id))
      .returning();
    return timesheet;
  }

  async rejectTimesheet(id: string, approverId: string): Promise<Timesheet | undefined> {
    const [timesheet] = await db.update(timesheets)
      .set({ 
        approvalStatus: "rejected" as TimesheetStatus, 
        approvedBy: approverId, 
        approvedAt: new Date(),
        updatedAt: new Date() 
      })
      .where(eq(timesheets.id, id))
      .returning();
    return timesheet;
  }

  // Estimated Costs
  async getProjectEstimatedCost(id: string): Promise<ProjectEstimatedCost | undefined> {
    const [cost] = await db.select().from(projectEstimatedCosts).where(eq(projectEstimatedCosts.id, id));
    return cost;
  }

  async getProjectEstimatedCostByMonth(projectId: string, month: number, year: number): Promise<ProjectEstimatedCost | undefined> {
    const [cost] = await db.select().from(projectEstimatedCosts)
      .where(and(
        eq(projectEstimatedCosts.projectId, projectId),
        eq(projectEstimatedCosts.month, month),
        eq(projectEstimatedCosts.year, year)
      ));
    return cost;
  }

  async getAllProjectEstimatedCosts(filters?: { projectId?: string; month?: number; year?: number }): Promise<ProjectEstimatedCost[]> {
    const conditions: ReturnType<typeof eq>[] = [];
    if (filters?.projectId) conditions.push(eq(projectEstimatedCosts.projectId, filters.projectId));
    if (filters?.month !== undefined) conditions.push(eq(projectEstimatedCosts.month, filters.month));
    if (filters?.year !== undefined) conditions.push(eq(projectEstimatedCosts.year, filters.year));

    return conditions.length > 0
      ? await db.select().from(projectEstimatedCosts).where(and(...conditions))
      : await db.select().from(projectEstimatedCosts);
  }

  async createProjectEstimatedCost(data: InsertProjectEstimatedCost): Promise<ProjectEstimatedCost> {
    const [cost] = await db.insert(projectEstimatedCosts).values(data).returning();
    return cost;
  }

  async updateProjectEstimatedCost(id: string, data: UpdateProjectEstimatedCost): Promise<ProjectEstimatedCost | undefined> {
    const [cost] = await db.update(projectEstimatedCosts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(projectEstimatedCosts.id, id))
      .returning();
    return cost;
  }

  async deleteProjectEstimatedCost(id: string): Promise<boolean> {
    const result = await db.delete(projectEstimatedCosts).where(eq(projectEstimatedCosts.id, id));
    return !!result;
  }

  // Actual Costs
  async getProjectActualCost(id: string): Promise<ProjectActualCost | undefined> {
    const [cost] = await db.select().from(projectActualCosts).where(eq(projectActualCosts.id, id));
    return cost;
  }

  async getProjectActualCostByMonth(projectId: string, month: number, year: number): Promise<ProjectActualCost | undefined> {
    const [cost] = await db.select().from(projectActualCosts)
      .where(and(
        eq(projectActualCosts.projectId, projectId),
        eq(projectActualCosts.month, month),
        eq(projectActualCosts.year, year)
      ));
    return cost;
  }

  async getAllProjectActualCosts(filters?: { projectId?: string; month?: number; year?: number }): Promise<ProjectActualCost[]> {
    const conditions: ReturnType<typeof eq>[] = [];
    if (filters?.projectId) conditions.push(eq(projectActualCosts.projectId, filters.projectId));
    if (filters?.month !== undefined) conditions.push(eq(projectActualCosts.month, filters.month));
    if (filters?.year !== undefined) conditions.push(eq(projectActualCosts.year, filters.year));

    return conditions.length > 0
      ? await db.select().from(projectActualCosts).where(and(...conditions))
      : await db.select().from(projectActualCosts);
  }

  async createProjectActualCost(data: InsertProjectActualCost): Promise<ProjectActualCost> {
    const [cost] = await db.insert(projectActualCosts).values(data).returning();
    return cost;
  }

  async updateProjectActualCost(id: string, data: UpdateProjectActualCost): Promise<ProjectActualCost | undefined> {
    const [cost] = await db.update(projectActualCosts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(projectActualCosts.id, id))
      .returning();
    return cost;
  }

  async deleteProjectActualCost(id: string): Promise<boolean> {
    const result = await db.delete(projectActualCosts).where(eq(projectActualCosts.id, id));
    return !!result;
  }

  // Vendor Costs
  async getVendorCost(id: string): Promise<VendorCost | undefined> {
    const [cost] = await db.select().from(vendorCosts).where(eq(vendorCosts.id, id));
    return cost;
  }

  async getProjectVendorCosts(projectId: string, filters?: { month?: number; year?: number }): Promise<VendorCost[]> {
    const conditions = [eq(vendorCosts.projectId, projectId)];
    if (filters?.month !== undefined) conditions.push(eq(vendorCosts.month, filters.month));
    if (filters?.year !== undefined) conditions.push(eq(vendorCosts.year, filters.year));

    return await db.select().from(vendorCosts).where(and(...conditions)).orderBy(desc(vendorCosts.createdAt));
  }

  async getAllVendorCosts(filters?: { projectId?: string; month?: number; year?: number }): Promise<VendorCost[]> {
    const conditions: ReturnType<typeof eq>[] = [];
    if (filters?.projectId) conditions.push(eq(vendorCosts.projectId, filters.projectId));
    if (filters?.month !== undefined) conditions.push(eq(vendorCosts.month, filters.month));
    if (filters?.year !== undefined) conditions.push(eq(vendorCosts.year, filters.year));

    return conditions.length > 0
      ? await db.select().from(vendorCosts).where(and(...conditions)).orderBy(desc(vendorCosts.createdAt))
      : await db.select().from(vendorCosts).orderBy(desc(vendorCosts.createdAt));
  }

  async createVendorCost(data: InsertVendorCost): Promise<VendorCost> {
    const [cost] = await db.insert(vendorCosts).values(data).returning();
    return cost;
  }

  async updateVendorCost(id: string, data: UpdateVendorCost): Promise<VendorCost | undefined> {
    const [cost] = await db.update(vendorCosts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(vendorCosts.id, id))
      .returning();
    return cost;
  }

  async deleteVendorCost(id: string): Promise<boolean> {
    const result = await db.delete(vendorCosts).where(eq(vendorCosts.id, id));
    return !!result;
  }

  // Tool Costs
  async getToolCost(id: string): Promise<ToolCost | undefined> {
    const [cost] = await db.select().from(toolCosts).where(eq(toolCosts.id, id));
    return cost;
  }

  async getProjectToolCosts(projectId: string, filters?: { month?: number; year?: number }): Promise<ToolCost[]> {
    const conditions = [eq(toolCosts.projectId, projectId)];
    if (filters?.month !== undefined) conditions.push(eq(toolCosts.month, filters.month));
    if (filters?.year !== undefined) conditions.push(eq(toolCosts.year, filters.year));

    return await db.select().from(toolCosts).where(and(...conditions)).orderBy(desc(toolCosts.createdAt));
  }

  async getAllToolCosts(filters?: { projectId?: string; month?: number; year?: number }): Promise<ToolCost[]> {
    const conditions: ReturnType<typeof eq>[] = [];
    if (filters?.projectId) conditions.push(eq(toolCosts.projectId, filters.projectId));
    if (filters?.month !== undefined) conditions.push(eq(toolCosts.month, filters.month));
    if (filters?.year !== undefined) conditions.push(eq(toolCosts.year, filters.year));

    return conditions.length > 0
      ? await db.select().from(toolCosts).where(and(...conditions)).orderBy(desc(toolCosts.createdAt))
      : await db.select().from(toolCosts).orderBy(desc(toolCosts.createdAt));
  }

  async createToolCost(data: InsertToolCost): Promise<ToolCost> {
    const [cost] = await db.insert(toolCosts).values(data).returning();
    return cost;
  }

  async updateToolCost(id: string, data: UpdateToolCost): Promise<ToolCost | undefined> {
    const [cost] = await db.update(toolCosts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(toolCosts.id, id))
      .returning();
    return cost;
  }

  async deleteToolCost(id: string): Promise<boolean> {
    const result = await db.delete(toolCosts).where(eq(toolCosts.id, id));
    return !!result;
  }

  // Margin Settings
  async getMarginSettings(): Promise<MarginSettings | undefined> {
    const [settings] = await db.select().from(marginSettings).where(eq(marginSettings.isActive, true)).limit(1);
    return settings;
  }

  async upsertMarginSettings(data: InsertMarginSettings | UpdateMarginSettings): Promise<MarginSettings> {
    const existing = await this.getMarginSettings();
    
    if (existing) {
      const [updated] = await db.update(marginSettings)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(marginSettings.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(marginSettings).values({
        ...data,
        isActive: true,
      } as InsertMarginSettings).returning();
      return created;
    }
  }

  // Cost & Margin Global Settings
  async getCostMarginGlobalSettings(): Promise<CostMarginGlobalSettings | undefined> {
    const [settings] = await db.select().from(costMarginGlobalSettings).where(eq(costMarginGlobalSettings.isActive, true)).limit(1);
    return settings;
  }

  async upsertCostMarginGlobalSettings(data: InsertCostMarginGlobalSettings | UpdateCostMarginGlobalSettings): Promise<CostMarginGlobalSettings> {
    const existing = await this.getCostMarginGlobalSettings();
    
    if (existing) {
      const [updated] = await db.update(costMarginGlobalSettings)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(costMarginGlobalSettings.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(costMarginGlobalSettings).values({
        ...data,
        isActive: true,
      } as InsertCostMarginGlobalSettings).returning();
      return created;
    }
  }

  // Resources Module
  async getResource(id: string): Promise<Resource | undefined> {
    const [resource] = await db.select().from(resources).where(eq(resources.id, id));
    return resource;
  }

  async getResourceByUserId(userId: string): Promise<Resource | undefined> {
    const [resource] = await db.select().from(resources).where(eq(resources.userId, userId));
    return resource;
  }

  async getResourceByEmail(email: string): Promise<Resource | undefined> {
    const [resource] = await db.select().from(resources).where(eq(resources.email, email));
    return resource;
  }

  async getAllResources(filters?: { isActive?: boolean }): Promise<ResourceWithUser[]> {
    const conditions: ReturnType<typeof eq>[] = [];
    if (filters?.isActive !== undefined) conditions.push(eq(resources.isActive, filters.isActive));

    const resourceList = conditions.length > 0
      ? await db.select().from(resources).where(and(...conditions)).orderBy(desc(resources.createdAt))
      : await db.select().from(resources).orderBy(desc(resources.createdAt));

    if (resourceList.length === 0) return [];

    // Batch fetch all users for all resources (1 query instead of N)
    const userIds = resourceList.filter(r => r.userId).map(r => r.userId!);
    const allUsers = userIds.length > 0
      ? await db.select().from(users).where(inArray(users.id, userIds))
      : [];
    
    const userMap = new Map(allUsers.map(u => [u.id, u]));

    return resourceList.map(resource => ({
      ...resource,
      user: resource.userId ? userMap.get(resource.userId) || null : null,
    }));
  }

  computeEffectiveHourlyRate(resource: { employmentType: string; monthlySalary?: string | null; contractorHourlyRate?: string | null }): string {
    const MONTHLY_WORKING_HOURS = 176;
    if (resource.employmentType === "employee" && resource.monthlySalary) {
      const salary = parseFloat(resource.monthlySalary);
      return (salary / MONTHLY_WORKING_HOURS).toFixed(2);
    } else if (resource.employmentType === "contractor" && resource.contractorHourlyRate) {
      return resource.contractorHourlyRate;
    }
    return "0.00";
  }

  async createResource(data: InsertResource): Promise<Resource> {
    const effectiveHourlyRate = this.computeEffectiveHourlyRate(data);
    const [resource] = await db.insert(resources).values({
      ...data,
      effectiveHourlyRate,
    }).returning();
    return resource;
  }

  async updateResource(id: string, data: UpdateResource): Promise<Resource | undefined> {
    const existing = await this.getResource(id);
    if (!existing) return undefined;

    const merged = { ...existing, ...data };
    const effectiveHourlyRate = this.computeEffectiveHourlyRate(merged);

    const [resource] = await db.update(resources)
      .set({ ...data, effectiveHourlyRate, updatedAt: new Date() })
      .where(eq(resources.id, id))
      .returning();
    return resource;
  }

  async deleteResource(id: string): Promise<boolean> {
    const result = await db.delete(resources).where(eq(resources.id, id));
    return !!result;
  }

  // Resource Rate Settings
  async getResourceRateSettings(region?: string): Promise<ResourceRateSettings | undefined> {
    if (region) {
      const [settings] = await db.select().from(resourceRateSettings).where(eq(resourceRateSettings.region, region));
      return settings;
    } else {
      const [settings] = await db.select().from(resourceRateSettings).where(eq(resourceRateSettings.region, "global"));
      return settings;
    }
  }

  async getAllResourceRateSettings(): Promise<ResourceRateSettings[]> {
    return await db.select().from(resourceRateSettings).orderBy(resourceRateSettings.region);
  }

  async upsertResourceRateSettings(data: InsertResourceRateSettings): Promise<ResourceRateSettings> {
    const region = data.region || "global";
    const existing = await this.getResourceRateSettings(region);
    
    if (existing) {
      const [updated] = await db.update(resourceRateSettings)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(resourceRateSettings.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(resourceRateSettings).values({
        ...data,
        region,
      }).returning();
      return created;
    }
  }

  async deleteResourceRateSettings(region?: string): Promise<boolean> {
    const targetRegion = region || "global";
    const result = await db.delete(resourceRateSettings).where(eq(resourceRateSettings.region, targetRegion));
    return !!result;
  }

  async getEffectiveHourlyRateForResource(resourceId: string): Promise<string> {
    const resource = await this.getResource(resourceId);
    if (!resource) return "0.00";

    const globalSettings = await this.getResourceRateSettings("global");
    if (globalSettings?.useGlobalFixedRate && globalSettings.globalFixedHourlyRate) {
      return globalSettings.globalFixedHourlyRate;
    }

    return resource.effectiveHourlyRate || this.computeEffectiveHourlyRate(resource);
  }

  // Jira Integration Settings
  async getJiraIntegrationSettings(): Promise<JiraIntegrationSettings | undefined> {
    // Get the first settings record regardless of isActive status
    const [settings] = await db.select().from(jiraIntegrationSettings).limit(1);
    return settings;
  }

  async upsertJiraIntegrationSettings(data: InsertJiraIntegrationSettings | UpdateJiraIntegrationSettings): Promise<JiraIntegrationSettings> {
    // Get any existing settings (regardless of isActive)
    const [existing] = await db.select().from(jiraIntegrationSettings).limit(1);
    
    if (existing) {
      const [updated] = await db.update(jiraIntegrationSettings)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(jiraIntegrationSettings.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(jiraIntegrationSettings).values(data as InsertJiraIntegrationSettings).returning();
      return created;
    }
  }

  async updateJiraIntegrationSyncStatus(status: "success" | "failed" | "in_progress", error?: string): Promise<void> {
    const existing = await this.getJiraIntegrationSettings();
    if (existing) {
      await db.update(jiraIntegrationSettings)
        .set({
          lastSyncAt: new Date(),
          lastSyncStatus: status,
          lastSyncError: error || null,
          updatedAt: new Date(),
        })
        .where(eq(jiraIntegrationSettings.id, existing.id));
    }
  }

  // Jira Project Mappings
  async getJiraProjectMapping(id: string): Promise<JiraProjectMapping | undefined> {
    const [mapping] = await db.select().from(jiraProjectMappings).where(eq(jiraProjectMappings.id, id));
    return mapping;
  }

  async getJiraProjectMappingByKey(jiraProjectKey: string): Promise<JiraProjectMapping | undefined> {
    const [mapping] = await db.select().from(jiraProjectMappings)
      .where(and(
        eq(jiraProjectMappings.jiraProjectKey, jiraProjectKey),
        eq(jiraProjectMappings.isActive, true)
      ));
    return mapping;
  }

  async getAllJiraProjectMappings(): Promise<JiraProjectMapping[]> {
    return await db.select().from(jiraProjectMappings).orderBy(jiraProjectMappings.jiraProjectKey);
  }

  async createJiraProjectMapping(data: InsertJiraProjectMapping): Promise<JiraProjectMapping> {
    const [mapping] = await db.insert(jiraProjectMappings).values(data).returning();
    return mapping;
  }

  async updateJiraProjectMapping(id: string, data: UpdateJiraProjectMapping): Promise<JiraProjectMapping | undefined> {
    const [mapping] = await db.update(jiraProjectMappings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(jiraProjectMappings.id, id))
      .returning();
    return mapping;
  }

  async deleteJiraProjectMapping(id: string): Promise<boolean> {
    const result = await db.delete(jiraProjectMappings).where(eq(jiraProjectMappings.id, id));
    return !!result;
  }

  // Jira Worklog Sync
  async getJiraWorklogSync(id: string): Promise<JiraWorklogSync | undefined> {
    const [sync] = await db.select().from(jiraWorklogSync).where(eq(jiraWorklogSync.id, id));
    return sync;
  }

  async getJiraWorklogSyncByWorklogId(jiraWorklogId: string): Promise<JiraWorklogSync | undefined> {
    const [sync] = await db.select().from(jiraWorklogSync).where(eq(jiraWorklogSync.jiraWorklogId, jiraWorklogId));
    return sync;
  }

  async getAllJiraWorklogSync(filters?: { jiraProjectKey?: string; syncStatus?: string }): Promise<JiraWorklogSync[]> {
    const conditions: ReturnType<typeof eq>[] = [];
    if (filters?.jiraProjectKey) conditions.push(eq(jiraWorklogSync.jiraProjectKey, filters.jiraProjectKey));
    if (filters?.syncStatus) conditions.push(eq(jiraWorklogSync.syncStatus, filters.syncStatus as any));

    return conditions.length > 0
      ? await db.select().from(jiraWorklogSync).where(and(...conditions)).orderBy(desc(jiraWorklogSync.createdAt))
      : await db.select().from(jiraWorklogSync).orderBy(desc(jiraWorklogSync.createdAt));
  }

  async createJiraWorklogSync(data: InsertJiraWorklogSync): Promise<JiraWorklogSync> {
    const [sync] = await db.insert(jiraWorklogSync).values(data).returning();
    return sync;
  }

  async updateJiraWorklogSync(id: string, data: UpdateJiraWorklogSync): Promise<JiraWorklogSync | undefined> {
    const [sync] = await db.update(jiraWorklogSync)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(jiraWorklogSync.id, id))
      .returning();
    return sync;
  }

  async deleteJiraWorklogSync(id: string): Promise<boolean> {
    const result = await db.delete(jiraWorklogSync).where(eq(jiraWorklogSync.id, id));
    return !!result;
  }

  // Project Merge
  async getProjectMergePreview(targetProjectId: string, sourceProjectIds: string[]): Promise<ProjectMergePreview> {
    const targetProject = await this.getProject(targetProjectId);
    if (!targetProject) {
      throw new Error("Target project not found");
    }

    const sourceProjects = await Promise.all(
      sourceProjectIds.map(id => this.getProjectWithPM(id))
    );
    const validSourceProjects = sourceProjects.filter((p): p is ProjectWithPM => p !== undefined);

    if (validSourceProjects.length !== sourceProjectIds.length) {
      throw new Error("One or more source projects not found");
    }

    // Count all related entities for each source project
    const allSourceIds = sourceProjectIds;
    
    const [paymentsResult] = await db.select({ count: sql<number>`count(*)::int` })
      .from(payments)
      .where(inArray(payments.projectId, allSourceIds));
    
    const [milestonesResult] = await db.select({ count: sql<number>`count(*)::int` })
      .from(projectMilestones)
      .where(inArray(projectMilestones.projectId, allSourceIds));
    
    const [invoicesResult] = await db.select({ count: sql<number>`count(*)::int` })
      .from(invoices)
      .where(and(isNotNull(invoices.projectId), inArray(invoices.projectId, allSourceIds)));
    
    const [upsellsResult] = await db.select({ count: sql<number>`count(*)::int` })
      .from(upsells)
      .where(inArray(upsells.projectId, allSourceIds));
    
    const [timesheetsResult] = await db.select({ count: sql<number>`count(*)::int` })
      .from(timesheets)
      .where(inArray(timesheets.projectId, allSourceIds));
    
    const [estimatedCostsResult] = await db.select({ count: sql<number>`count(*)::int` })
      .from(projectEstimatedCosts)
      .where(inArray(projectEstimatedCosts.projectId, allSourceIds));
    
    const [vendorCostsResult] = await db.select({ count: sql<number>`count(*)::int` })
      .from(vendorCosts)
      .where(inArray(vendorCosts.projectId, allSourceIds));
    
    const [toolCostsResult] = await db.select({ count: sql<number>`count(*)::int` })
      .from(toolCosts)
      .where(inArray(toolCosts.projectId, allSourceIds));
    
    const [actualCostsResult] = await db.select({ count: sql<number>`count(*)::int` })
      .from(projectActualCosts)
      .where(inArray(projectActualCosts.projectId, allSourceIds));

    const totalCosts = 
      (estimatedCostsResult?.count || 0) +
      (vendorCostsResult?.count || 0) +
      (toolCostsResult?.count || 0) +
      (actualCostsResult?.count || 0);

    return {
      targetProject: targetProject,
      sourceProjects: validSourceProjects,
      counts: {
        payments: paymentsResult?.count || 0,
        milestones: milestonesResult?.count || 0,
        invoices: invoicesResult?.count || 0,
        upsells: upsellsResult?.count || 0,
        timesheets: timesheetsResult?.count || 0,
        costs: totalCosts,
      }
    };
  }

  async mergeProjects(targetProjectId: string, sourceProjectIds: string[], mergedBy: string): Promise<ProjectMergeAudit> {
    const preview = await this.getProjectMergePreview(targetProjectId, sourceProjectIds);
    const targetProject = preview.targetProject;
    const sourceProjectNames = preview.sourceProjects.map(p => p.name);

    // Perform all updates in a database transaction for atomicity
    return await db.transaction(async (tx) => {
      // Update payments to point to target project
      await tx.update(payments)
        .set({ projectId: targetProjectId })
        .where(inArray(payments.projectId, sourceProjectIds));

      // Update milestones to point to target project
      await tx.update(projectMilestones)
        .set({ projectId: targetProjectId })
        .where(inArray(projectMilestones.projectId, sourceProjectIds));

      // Update invoices to point to target project
      await tx.update(invoices)
        .set({ projectId: targetProjectId })
        .where(and(isNotNull(invoices.projectId), inArray(invoices.projectId, sourceProjectIds)));

      // Update upsells to point to target project
      await tx.update(upsells)
        .set({ projectId: targetProjectId })
        .where(inArray(upsells.projectId, sourceProjectIds));

      // Update timesheets to point to target project
      await tx.update(timesheets)
        .set({ projectId: targetProjectId })
        .where(inArray(timesheets.projectId, sourceProjectIds));

      // Update estimated costs to point to target project
      await tx.update(projectEstimatedCosts)
        .set({ projectId: targetProjectId })
        .where(inArray(projectEstimatedCosts.projectId, sourceProjectIds));

      // Update vendor costs to point to target project
      await tx.update(vendorCosts)
        .set({ projectId: targetProjectId })
        .where(inArray(vendorCosts.projectId, sourceProjectIds));

      // Update tool costs to point to target project
      await tx.update(toolCosts)
        .set({ projectId: targetProjectId })
        .where(inArray(toolCosts.projectId, sourceProjectIds));

      // Update actual costs to point to target project
      await tx.update(projectActualCosts)
        .set({ projectId: targetProjectId })
        .where(inArray(projectActualCosts.projectId, sourceProjectIds));

      // Update Jira project mappings to point to target project
      await tx.update(jiraProjectMappings)
        .set({ revolrmoProjectId: targetProjectId })
        .where(inArray(jiraProjectMappings.revolrmoProjectId, sourceProjectIds));

      // Delete the source projects
      for (const sourceId of sourceProjectIds) {
        await tx.delete(projects).where(eq(projects.id, sourceId));
      }

      // Create audit record
      const [audit] = await tx.insert(projectMergeAudits).values({
        targetProjectId,
        targetProjectName: targetProject.name,
        sourceProjectIds,
        sourceProjectNames,
        mergedPaymentsCount: preview.counts.payments,
        mergedMilestonesCount: preview.counts.milestones,
        mergedInvoicesCount: preview.counts.invoices,
        mergedUpsellsCount: preview.counts.upsells,
        mergedTimesheetsCount: preview.counts.timesheets,
        mergedCostsCount: preview.counts.costs,
        mergeDetails: {
          sourceProjects: preview.sourceProjects.map(p => ({
            id: p.id,
            name: p.name,
            region: p.region,
            pmName: p.pm ? `${p.pm.firstName} ${p.pm.lastName}` : null,
          })),
        },
        mergedBy,
      }).returning();

      // Log the merge activity
      await tx.insert(activityLogs).values({
        action: "merge",
        entity: "project",
        entityId: targetProjectId,
        details: `Merged ${sourceProjectIds.length} project(s) into "${targetProject.name}": ${sourceProjectNames.join(", ")}`,
        userId: mergedBy,
      });

      return audit;
    });
  }

  async getProjectMergeAudits(projectId?: string): Promise<ProjectMergeAudit[]> {
    if (projectId) {
      return await db.select().from(projectMergeAudits)
        .where(eq(projectMergeAudits.targetProjectId, projectId))
        .orderBy(desc(projectMergeAudits.mergedAt));
    }
    return await db.select().from(projectMergeAudits)
      .orderBy(desc(projectMergeAudits.mergedAt));
  }

  // API Metrics (System Health Monitoring)
  async recordApiMetric(metric: InsertApiMetric): Promise<ApiMetric> {
    const [result] = await db.insert(apiMetrics).values(metric).returning();
    return result;
  }

  async getApiMetricsSummary(hours: number = 24): Promise<ApiMetricsSummary> {
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    // Get all metrics in the time window
    const metrics = await db.select().from(apiMetrics)
      .where(gte(apiMetrics.timestamp, startTime))
      .orderBy(desc(apiMetrics.timestamp));
    
    // Calculate summary stats
    const totalRequests = metrics.length;
    const avgResponseTime = totalRequests > 0 
      ? Math.round(metrics.reduce((sum, m) => sum + m.responseTimeMs, 0) / totalRequests)
      : 0;
    const errorCount = metrics.filter(m => m.statusCode >= 400).length;
    const errorRate = totalRequests > 0 
      ? Math.round((errorCount / totalRequests) * 100 * 100) / 100
      : 0;
    
    // Group by endpoint for slow endpoints
    const endpointStats = new Map<string, { totalTime: number; count: number }>();
    for (const m of metrics) {
      const current = endpointStats.get(m.endpoint) || { totalTime: 0, count: 0 };
      current.totalTime += m.responseTimeMs;
      current.count += 1;
      endpointStats.set(m.endpoint, current);
    }
    
    const slowEndpoints = Array.from(endpointStats.entries())
      .map(([endpoint, stats]) => ({
        endpoint,
        avgResponseTime: Math.round(stats.totalTime / stats.count),
        requestCount: stats.count,
      }))
      .sort((a, b) => b.avgResponseTime - a.avgResponseTime)
      .slice(0, 10);
    
    // Group by endpoint for error endpoints
    const errorEndpointStats = new Map<string, { errorCount: number; lastError: string | null }>();
    for (const m of metrics.filter(m => m.statusCode >= 400)) {
      const current = errorEndpointStats.get(m.endpoint) || { errorCount: 0, lastError: null };
      current.errorCount += 1;
      if (!current.lastError && m.errorMessage) {
        current.lastError = m.errorMessage;
      }
      errorEndpointStats.set(m.endpoint, current);
    }
    
    const errorEndpoints = Array.from(errorEndpointStats.entries())
      .map(([endpoint, stats]) => ({
        endpoint,
        errorCount: stats.errorCount,
        lastError: stats.lastError,
      }))
      .sort((a, b) => b.errorCount - a.errorCount)
      .slice(0, 10);
    
    // Recent metrics (last 50)
    const recentMetrics = metrics.slice(0, 50);
    
    return {
      totalRequests,
      avgResponseTime,
      errorCount,
      errorRate,
      slowEndpoints,
      errorEndpoints,
      recentMetrics,
    };
  }

  async getApiMetrics(filters?: { endpoint?: string; startTime?: Date; endTime?: Date; statusCode?: number; limit?: number }): Promise<ApiMetric[]> {
    const conditions: ReturnType<typeof eq>[] = [];
    
    if (filters?.endpoint) conditions.push(eq(apiMetrics.endpoint, filters.endpoint));
    if (filters?.startTime) conditions.push(gte(apiMetrics.timestamp, filters.startTime) as any);
    if (filters?.endTime) conditions.push(lte(apiMetrics.timestamp, filters.endTime) as any);
    if (filters?.statusCode) conditions.push(eq(apiMetrics.statusCode, filters.statusCode));
    
    const limit = filters?.limit || 100;
    
    const query = db.select().from(apiMetrics).orderBy(desc(apiMetrics.timestamp)).limit(limit);
    
    return conditions.length > 0 
      ? await query.where(and(...conditions))
      : await query;
  }

  async cleanupOldApiMetrics(daysToKeep: number = 7): Promise<number> {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    const result = await db.delete(apiMetrics).where(lt(apiMetrics.timestamp, cutoffDate)).returning();
    return result.length;
  }

  async getSecurityDashboard(hours: number = 24): Promise<Omit<SecurityDashboard, "rateLimitConfig" | "securityHeaders">> {
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);

    // Pull all request metrics in the window and bucket by status code.
    const metrics = await db
      .select()
      .from(apiMetrics)
      .where(gte(apiMetrics.timestamp, startTime));

    let rateLimitHits = 0;
    let unauthorizedCount = 0;
    let forbiddenCount = 0;
    let clientErrors = 0;
    let serverErrors = 0;
    const authFailMap = new Map<string, { count: number; lastError: string | null }>();

    for (const m of metrics) {
      const s = m.statusCode;
      if (s === 429) rateLimitHits++;
      if (s === 401) unauthorizedCount++;
      if (s === 403) forbiddenCount++;
      if (s >= 400 && s < 500) clientErrors++;
      if (s >= 500) serverErrors++;
      // Track auth/abuse failures (401/403/429) by endpoint.
      if (s === 401 || s === 403 || s === 429) {
        const cur = authFailMap.get(m.endpoint) || { count: 0, lastError: null };
        cur.count += 1;
        if (!cur.lastError && m.errorMessage) cur.lastError = m.errorMessage;
        authFailMap.set(m.endpoint, cur);
      }
    }

    const totalRequests = metrics.length;
    const errorCount = clientErrors + serverErrors;
    const errorRate = totalRequests > 0
      ? Math.round((errorCount / totalRequests) * 100 * 100) / 100
      : 0;

    const authFailureEndpoints = Array.from(authFailMap.entries())
      .map(([endpoint, v]) => ({ endpoint, count: v.count, lastError: v.lastError }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // Active sessions = unexpired rows in the connect-pg-simple session store.
    const [sessionRow] = await db
      .select({ value: sql<number>`count(*)::int` })
      .from(sessions)
      .where(gt(sessions.expire, new Date()));
    const activeSessions = Number(sessionRow?.value ?? 0);

    // Total users.
    const [userCountRow] = await db
      .select({ value: sql<number>`count(*)::int` })
      .from(users);
    const totalUsers = Number(userCountRow?.value ?? 0);

    // Blocked users.
    const blocked = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(users)
      .where(eq(users.status, "blocked"));
    const blockedUsers = blocked.map((u) => ({
      id: u.id,
      name: [u.firstName, u.lastName].filter(Boolean).join(" ") || "Unknown",
      email: u.email ?? null,
    }));

    // Recent security-relevant events: logins/logouts and user block/unblock.
    const events = await db
      .select({
        id: activityLogs.id,
        action: activityLogs.action,
        entity: activityLogs.entity,
        details: activityLogs.details,
        ipAddress: activityLogs.ipAddress,
        createdAt: activityLogs.createdAt,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(activityLogs)
      .leftJoin(users, eq(activityLogs.userId, users.id))
      .where(
        or(
          inArray(activityLogs.action, ["login", "logout"]),
          and(eq(activityLogs.action, "status_change"), eq(activityLogs.entity, "user")),
        ),
      )
      .orderBy(desc(activityLogs.createdAt))
      .limit(15);
    const recentSecurityEvents = events.map((e) => ({
      id: e.id,
      action: e.action,
      entity: e.entity,
      details: e.details ?? null,
      ipAddress: e.ipAddress ?? null,
      createdAt: e.createdAt ? e.createdAt.toISOString() : null,
      userName: [e.firstName, e.lastName].filter(Boolean).join(" ") || null,
    }));

    return {
      windowHours: hours,
      totalRequests,
      rateLimitHits,
      unauthorizedCount,
      forbiddenCount,
      clientErrors,
      serverErrors,
      errorRate,
      authFailureEndpoints,
      activeSessions,
      totalUsers,
      blockedUsers,
      recentSecurityEvents,
    };
  }

  // Document Repository / Signoffs
  async getSignoff(id: string): Promise<ProjectSignoff | undefined> {
    const [signoff] = await db.select().from(projectSignoffs).where(eq(projectSignoffs.id, id));
    return signoff;
  }

  async getAllSignoffs(filters?: { projectId?: string; status?: string; milestoneId?: string }): Promise<ProjectSignoff[]> {
    let query = db.select().from(projectSignoffs);
    const conditions = [];

    if (filters?.projectId) {
      conditions.push(eq(projectSignoffs.projectId, filters.projectId));
    }
    if (filters?.status) {
      conditions.push(eq(projectSignoffs.status, filters.status as any));
    }
    if (filters?.milestoneId) {
      conditions.push(eq(projectSignoffs.milestoneId, filters.milestoneId));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    return query.orderBy(desc(projectSignoffs.createdAt));
  }

  async getSignoffsByProject(projectId: string): Promise<ProjectSignoff[]> {
    return db.select().from(projectSignoffs)
      .where(eq(projectSignoffs.projectId, projectId))
      .orderBy(projectSignoffs.phaseNumber);
  }

  async getSignoffByMilestone(milestoneId: string): Promise<ProjectSignoff | undefined> {
    const [signoff] = await db.select().from(projectSignoffs)
      .where(eq(projectSignoffs.milestoneId, milestoneId));
    return signoff;
  }

  async createSignoff(data: InsertSignoff): Promise<ProjectSignoff> {
    const [signoff] = await db.insert(projectSignoffs).values(data).returning();
    return signoff;
  }

  async updateSignoff(id: string, data: UpdateSignoff): Promise<ProjectSignoff | undefined> {
    const [signoff] = await db.update(projectSignoffs)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(projectSignoffs.id, id))
      .returning();
    return signoff;
  }

  async deleteSignoff(id: string): Promise<boolean> {
    const result = await db.delete(projectSignoffs).where(eq(projectSignoffs.id, id)).returning();
    return result.length > 0;
  }

  async getMissingSignoffs(): Promise<{ projectId: string; projectName: string; milestoneId: string; milestoneName: string; pmId: string; pmEmail: string; paidDate: Date }[]> {
    // Find milestones that are paid but don't have a signoff with status 'received'
    const paidMilestones = await db.select({
      milestoneId: projectMilestones.id,
      milestoneName: projectMilestones.name,
      paidDate: projectMilestones.paidDate,
      projectId: projects.id,
      projectName: projects.name,
      pmId: users.id,
      pmEmail: users.email,
    })
    .from(projectMilestones)
    .innerJoin(projects, eq(projectMilestones.projectId, projects.id))
    .innerJoin(users, eq(projects.pmId, users.id))
    .where(
      and(
        eq(projectMilestones.status, 'paid'),
        isNotNull(projectMilestones.paidDate)
      )
    );

    // Get all signoffs for these milestones
    const milestoneIds = paidMilestones.map(m => m.milestoneId);
    if (milestoneIds.length === 0) return [];

    const existingSignoffs = await db.select()
      .from(projectSignoffs)
      .where(
        and(
          inArray(projectSignoffs.milestoneId, milestoneIds),
          eq(projectSignoffs.status, 'received')
        )
      );

    const signedMilestoneIds = new Set(existingSignoffs.map(s => s.milestoneId));

    // Return milestones without received signoffs
    return paidMilestones
      .filter(m => !signedMilestoneIds.has(m.milestoneId))
      .map(m => ({
        projectId: m.projectId,
        projectName: m.projectName,
        milestoneId: m.milestoneId,
        milestoneName: m.milestoneName,
        pmId: m.pmId,
        pmEmail: m.pmEmail,
        paidDate: m.paidDate!,
      }));
  }

  async updateSignoffReminder(id: string): Promise<ProjectSignoff | undefined> {
    const [signoff] = await db.update(projectSignoffs)
      .set({
        lastReminderSentAt: new Date(),
        reminderCount: sql`${projectSignoffs.reminderCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(projectSignoffs.id, id))
      .returning();
    return signoff;
  }

  // KPI Parameters
  async getKpiParameter(id: string): Promise<KpiParameter | undefined> {
    const [param] = await db.select().from(kpiParameters).where(eq(kpiParameters.id, id));
    return param;
  }

  async getAllKpiParameters(activeOnly?: boolean): Promise<KpiParameter[]> {
    if (activeOnly) {
      return await db.select().from(kpiParameters).where(eq(kpiParameters.isActive, true)).orderBy(asc(kpiParameters.sortOrder));
    }
    return await db.select().from(kpiParameters).orderBy(asc(kpiParameters.sortOrder));
  }

  async createKpiParameter(data: InsertKpiParameter): Promise<KpiParameter> {
    const [param] = await db.insert(kpiParameters).values(data).returning();
    return param;
  }

  async updateKpiParameter(id: string, data: Partial<InsertKpiParameter>): Promise<KpiParameter | undefined> {
    const [param] = await db.update(kpiParameters).set({ ...data, updatedAt: new Date() }).where(eq(kpiParameters.id, id)).returning();
    return param;
  }

  async deleteKpiParameter(id: string): Promise<boolean> {
    const result = await db.delete(kpiParameters).where(eq(kpiParameters.id, id)).returning();
    return result.length > 0;
  }

  // KPI Levels
  async getKpiLevel(id: string): Promise<KpiLevel | undefined> {
    const [level] = await db.select().from(kpiLevels).where(eq(kpiLevels.id, id));
    return level;
  }

  async getAllKpiLevels(activeOnly?: boolean): Promise<KpiLevel[]> {
    if (activeOnly) {
      return await db.select().from(kpiLevels).where(eq(kpiLevels.isActive, true)).orderBy(asc(kpiLevels.sortOrder));
    }
    return await db.select().from(kpiLevels).orderBy(asc(kpiLevels.sortOrder));
  }

  async createKpiLevel(data: InsertKpiLevel): Promise<KpiLevel> {
    const [level] = await db.insert(kpiLevels).values(data).returning();
    return level;
  }

  async updateKpiLevel(id: string, data: Partial<InsertKpiLevel>): Promise<KpiLevel | undefined> {
    const [level] = await db.update(kpiLevels).set(data).where(eq(kpiLevels.id, id)).returning();
    return level;
  }

  async deleteKpiLevel(id: string): Promise<boolean> {
    const result = await db.delete(kpiLevels).where(eq(kpiLevels.id, id)).returning();
    return result.length > 0;
  }

  // KPI Level Scores
  async getKpiLevelScores(parameterId: string, levelId: string): Promise<KpiLevelScore[]> {
    return await db.select().from(kpiLevelScores).where(
      and(eq(kpiLevelScores.parameterId, parameterId), eq(kpiLevelScores.levelId, levelId))
    );
  }

  async getAllKpiLevelScores(): Promise<KpiLevelScore[]> {
    return await db.select().from(kpiLevelScores);
  }

  async upsertKpiLevelScore(data: InsertKpiLevelScore): Promise<KpiLevelScore> {
    const [existing] = await db.select().from(kpiLevelScores).where(
      and(
        eq(kpiLevelScores.parameterId, data.parameterId),
        eq(kpiLevelScores.levelId, data.levelId),
        eq(kpiLevelScores.value, data.value)
      )
    );
    if (existing) {
      const [updated] = await db.update(kpiLevelScores)
        .set({ scorePercentage: data.scorePercentage })
        .where(eq(kpiLevelScores.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(kpiLevelScores).values(data).returning();
    return created;
  }

  async deleteKpiLevelScore(id: string): Promise<boolean> {
    const result = await db.delete(kpiLevelScores).where(eq(kpiLevelScores.id, id)).returning();
    return result.length > 0;
  }

  async bulkUpsertKpiLevelScores(scores: InsertKpiLevelScore[]): Promise<KpiLevelScore[]> {
    const results: KpiLevelScore[] = [];
    for (const score of scores) {
      const result = await this.upsertKpiLevelScore(score);
      results.push(result);
    }
    return results;
  }

  // KPI Monthly Reviews
  async getKpiMonthlyReviews(month: number, year: number): Promise<KpiMonthlyReviewWithDetails[]> {
    const result = await db
      .select({
        review: kpiMonthlyReviews,
        parameter: kpiParameters,
        pm: users,
      })
      .from(kpiMonthlyReviews)
      .leftJoin(kpiParameters, eq(kpiMonthlyReviews.parameterId, kpiParameters.id))
      .leftJoin(users, eq(kpiMonthlyReviews.pmId, users.id))
      .where(and(
        eq(kpiMonthlyReviews.month, month),
        eq(kpiMonthlyReviews.year, year)
      ));

    return result.map(r => ({
      ...r.review,
      parameter: r.parameter || undefined,
      pm: r.pm || undefined,
    }));
  }

  async getKpiMonthlyReviewsByPm(pmId: string, month?: number, year?: number): Promise<KpiMonthlyReviewWithDetails[]> {
    const conditions = [eq(kpiMonthlyReviews.pmId, pmId)];
    if (month !== undefined) conditions.push(eq(kpiMonthlyReviews.month, month));
    if (year !== undefined) conditions.push(eq(kpiMonthlyReviews.year, year));

    const result = await db
      .select({
        review: kpiMonthlyReviews,
        parameter: kpiParameters,
        pm: users,
      })
      .from(kpiMonthlyReviews)
      .leftJoin(kpiParameters, eq(kpiMonthlyReviews.parameterId, kpiParameters.id))
      .leftJoin(users, eq(kpiMonthlyReviews.pmId, users.id))
      .where(and(...conditions))
      .orderBy(desc(kpiMonthlyReviews.year), desc(kpiMonthlyReviews.month));

    return result.map(r => ({
      ...r.review,
      parameter: r.parameter || undefined,
      pm: r.pm || undefined,
    }));
  }

  async upsertKpiMonthlyReview(data: InsertKpiMonthlyReview): Promise<KpiMonthlyReview> {
    const [existing] = await db.select().from(kpiMonthlyReviews).where(
      and(
        eq(kpiMonthlyReviews.pmId, data.pmId),
        eq(kpiMonthlyReviews.month, data.month),
        eq(kpiMonthlyReviews.year, data.year),
        eq(kpiMonthlyReviews.parameterId, data.parameterId)
      )
    );
    if (existing) {
      const [updated] = await db.update(kpiMonthlyReviews)
        .set({
          value: data.value,
          score: data.score,
          notes: data.notes,
          reviewerId: data.reviewerId,
          // Preserve levelIdSnapshot from the original write if the caller doesn't
          // supply a fresh one (backwards-compatible: null/undefined → keep existing).
          ...(data.levelIdSnapshot !== undefined && data.levelIdSnapshot !== null
            ? { levelIdSnapshot: data.levelIdSnapshot }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(kpiMonthlyReviews.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(kpiMonthlyReviews).values(data).returning();
    return created;
  }

  async bulkUpsertKpiMonthlyReviews(reviews: InsertKpiMonthlyReview[]): Promise<KpiMonthlyReview[]> {
    const results: KpiMonthlyReview[] = [];
    for (const review of reviews) {
      const result = await this.upsertKpiMonthlyReview(review);
      results.push(result);
    }
    return results;
  }

  async deleteKpiMonthlyReview(id: string): Promise<boolean> {
    const result = await db.delete(kpiMonthlyReviews).where(eq(kpiMonthlyReviews.id, id)).returning();
    return result.length > 0;
  }

  async deleteKpiMonthlyReviewsByPmMonth(pmId: string, month: number, year: number): Promise<boolean> {
    const result = await db.delete(kpiMonthlyReviews).where(
      and(
        eq(kpiMonthlyReviews.pmId, pmId),
        eq(kpiMonthlyReviews.month, month),
        eq(kpiMonthlyReviews.year, year)
      )
    ).returning();
    return result.length > 0;
  }

  async getKpiGraceScores(month: number, year: number): Promise<KpiGraceScoreWithReviewer[]> {
    const rows = await db
      .select({ grace: kpiGraceScores, reviewer: users })
      .from(kpiGraceScores)
      .leftJoin(users, eq(kpiGraceScores.reviewerId, users.id))
      .where(and(eq(kpiGraceScores.month, month), eq(kpiGraceScores.year, year)))
      .orderBy(desc(kpiGraceScores.createdAt));
    return rows.map((r) => ({ ...r.grace, reviewer: r.reviewer || undefined }));
  }

  async getKpiGraceScoresByPm(pmId: string, month?: number, year?: number): Promise<KpiGraceScoreWithReviewer[]> {
    const conditions = [eq(kpiGraceScores.pmId, pmId)];
    if (month !== undefined) conditions.push(eq(kpiGraceScores.month, month));
    if (year !== undefined) conditions.push(eq(kpiGraceScores.year, year));
    const rows = await db
      .select({ grace: kpiGraceScores, reviewer: users })
      .from(kpiGraceScores)
      .leftJoin(users, eq(kpiGraceScores.reviewerId, users.id))
      .where(and(...conditions))
      .orderBy(desc(kpiGraceScores.createdAt));
    return rows.map((r) => ({ ...r.grace, reviewer: r.reviewer || undefined }));
  }

  async createKpiGraceScore(data: InsertKpiGraceScore): Promise<KpiGraceScore> {
    const [created] = await db.insert(kpiGraceScores).values(data).returning();
    return created;
  }

  async deleteKpiGraceScore(id: string): Promise<boolean> {
    const result = await db.delete(kpiGraceScores).where(eq(kpiGraceScores.id, id)).returning();
    return result.length > 0;
  }

  // ===== Appraisal grades =====
  async getAllGrades(): Promise<Grade[]> {
    return db.select().from(grades).orderBy(asc(grades.sortOrder), asc(grades.name));
  }

  async getGrade(id: string): Promise<Grade | undefined> {
    const [row] = await db.select().from(grades).where(eq(grades.id, id));
    return row;
  }

  async createGrade(data: InsertGrade): Promise<Grade> {
    const [created] = await db.insert(grades).values(data).returning();
    return created;
  }

  async updateGrade(id: string, data: Partial<InsertGrade>): Promise<Grade | undefined> {
    const [updated] = await db.update(grades).set(data).where(eq(grades.id, id)).returning();
    return updated;
  }

  async deleteGrade(id: string): Promise<boolean> {
    await db.update(users).set({ gradeId: null }).where(eq(users.gradeId, id));
    const result = await db.delete(grades).where(eq(grades.id, id)).returning();
    return result.length > 0;
  }

  // ===== Salary grade bands =====
  async getAllSalaryGradeBands(): Promise<SalaryGradeBand[]> {
    return db
      .select()
      .from(salaryGradeBands)
      .orderBy(asc(salaryGradeBands.sortOrder), asc(salaryGradeBands.salaryAmount));
  }

  // Smart sync the grade sheet: match existing bands by (designationId, gradeCode)
  // and update them in place so their ids survive a re-upload (users reference a
  // band by id). Insert new ones, delete bands no longer present.
  async replaceSalaryGradeBands(bands: InsertSalaryGradeBand[]): Promise<SalaryGradeBand[]> {
    return db.transaction(async (tx) => {
      const existing = await tx.select().from(salaryGradeBands);
      const keyOf = (r: { designationId?: string | null; gradeCode?: string | null }) =>
        `${r.designationId ?? ""}::${(r.gradeCode ?? "").trim().toLowerCase()}`;
      const existingByKey = new Map<string, SalaryGradeBand>();
      for (const b of existing) {
        if (b.gradeCode) existingByKey.set(keyOf(b), b);
      }

      const keptIds = new Set<string>();
      const result: SalaryGradeBand[] = [];
      for (const row of bands) {
        const k = keyOf(row);
        const match = row.gradeCode ? existingByKey.get(k) : undefined;
        if (match) {
          const [upd] = await tx
            .update(salaryGradeBands)
            .set(row)
            .where(eq(salaryGradeBands.id, match.id))
            .returning();
          keptIds.add(match.id);
          result.push(upd);
        } else {
          const [ins] = await tx.insert(salaryGradeBands).values(row).returning();
          keptIds.add(ins.id);
          result.push(ins);
        }
      }

      // Only prune within designations that are actually present in this upload.
      // This makes the import non-destructive when rows are skipped (e.g. an
      // unmatched designation): a designation never referenced by the upload
      // keeps all of its existing grades, and a fully-skipped upload deletes
      // nothing.
      const incomingDesignationIds = new Set(
        bands.map((b) => b.designationId).filter((id): id is string => !!id),
      );
      const toDelete = existing
        .filter((b) => !keptIds.has(b.id) && b.designationId && incomingDesignationIds.has(b.designationId))
        .map((b) => b.id);
      if (toDelete.length > 0) {
        await tx.delete(salaryGradeBands).where(inArray(salaryGradeBands.id, toDelete));
      }
      return result;
    });
  }

  // ===== Appraisals =====
  async getAppraisals(periodMonths: number, periodEndMonth: number, periodEndYear: number): Promise<AppraisalWithPm[]> {
    const rows = await db
      .select({ appraisal: appraisals, pm: users })
      .from(appraisals)
      .leftJoin(users, eq(appraisals.pmId, users.id))
      .where(and(
        eq(appraisals.periodMonths, periodMonths),
        eq(appraisals.periodEndMonth, periodEndMonth),
        eq(appraisals.periodEndYear, periodEndYear),
      ))
      .orderBy(desc(appraisals.eligible), asc(appraisals.gradeName));
    return rows.map((r) => ({ ...r.appraisal, pm: r.pm || undefined }));
  }

  // A project manager's own appraisal history — only finalized records are
  // returned, so PMs never see drafts that are still being worked on.
  async getUserAppraisals(userId: string): Promise<AppraisalWithPm[]> {
    const rows = await db
      .select({ appraisal: appraisals, pm: users })
      .from(appraisals)
      .leftJoin(users, eq(appraisals.pmId, users.id))
      .where(and(
        eq(appraisals.pmId, userId),
        inArray(appraisals.status, ["finalized", "rolled_out"]),
      ))
      .orderBy(desc(appraisals.periodEndYear), desc(appraisals.periodEndMonth), desc(appraisals.periodMonths));
    return rows.map((r) => ({ ...r.appraisal, pm: r.pm || undefined }));
  }

  async getAppraisal(id: string): Promise<Appraisal | undefined> {
    const [row] = await db.select().from(appraisals).where(eq(appraisals.id, id));
    return row;
  }

  async getAppraisalWithPm(id: string): Promise<AppraisalWithPm | undefined> {
    const [row] = await db
      .select({ appraisal: appraisals, pm: users })
      .from(appraisals)
      .leftJoin(users, eq(appraisals.pmId, users.id))
      .where(eq(appraisals.id, id));
    return row ? { ...row.appraisal, pm: row.pm || undefined } : undefined;
  }

  async getAppraisalByShareToken(token: string): Promise<AppraisalWithPm | undefined> {
    const [row] = await db
      .select({ appraisal: appraisals, pm: users })
      .from(appraisals)
      .leftJoin(users, eq(appraisals.pmId, users.id))
      .where(eq(appraisals.shareToken, token));
    return row ? { ...row.appraisal, pm: row.pm || undefined } : undefined;
  }

  async replaceAppraisalsForPeriod(periodMonths: number, periodEndMonth: number, periodEndYear: number, rows: InsertAppraisal[]): Promise<Appraisal[]> {
    return db.transaction(async (tx) => {
      // Never wipe rolled-out appraisals on regen — the board's decision and the
      // grade already applied to the employee are locked. Only draft/finalized
      // rows for the period are replaced.
      await tx.delete(appraisals).where(and(
        eq(appraisals.periodMonths, periodMonths),
        eq(appraisals.periodEndMonth, periodEndMonth),
        eq(appraisals.periodEndYear, periodEndYear),
        ne(appraisals.status, "rolled_out"),
      ));
      if (rows.length === 0) return [];
      return tx.insert(appraisals).values(rows).returning();
    });
  }

  async updateAppraisal(id: string, data: Partial<InsertAppraisal>): Promise<Appraisal | undefined> {
    const [updated] = await db.update(appraisals).set({ ...data, updatedAt: new Date() }).where(eq(appraisals.id, id)).returning();
    return updated;
  }

  // Status-guarded update used for pay-affecting rollout edits: only writes when
  // the row is still "draft" or "finalized". Returns undefined if a concurrent
  // request already rolled it out, so a late override can't mutate a locked row.
  async updateAppraisalIfMutable(id: string, data: Partial<InsertAppraisal>): Promise<Appraisal | undefined> {
    const [updated] = await db
      .update(appraisals)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(appraisals.id, id), inArray(appraisals.status, ["draft", "finalized"])))
      .returning();
    return updated;
  }

  // Atomically roll out an appraisal: mark it "rolled_out" with the board's
  // verdict/comment AND apply the appraisal's designation + assigned pay band to
  // the employee, so future appraisals start from the new grade. Both writes
  // happen in one transaction — either both land or neither does. Idempotent:
  // re-applying the same grade values is a no-op, and a null assigned band/grade
  // leaves the employee's current value untouched (never wipes it).
  async rollOutAppraisal(
    id: string,
    data: { finalVerdict: string | null; boardComment: string | null; rolledOutBy: string | null },
  ): Promise<Appraisal | undefined> {
    return db.transaction(async (tx) => {
      // Delegate to the shared, unit-tested rollout logic. The transition gate
      // (only a "finalized" row flips to "rolled_out") makes this atomic and
      // idempotent: a concurrent second request matches 0 rows and returns
      // undefined, and a null grade/band leaves the employee's value untouched.
      return applyRollout(
        {
          transitionToRolledOut: async (rolloutId, d) => {
            const [updated] = await tx
              .update(appraisals)
              .set({
                status: "rolled_out",
                finalVerdict: d.finalVerdict,
                boardComment: d.boardComment,
                rolledOutAt: new Date(),
                rolledOutBy: d.rolledOutBy,
                updatedAt: new Date(),
              })
              .where(and(eq(appraisals.id, rolloutId), eq(appraisals.status, "finalized")))
              .returning();
            return updated;
          },
          applyUserGrade: async (userId, fields) => {
            // Snapshot the employee's current grade/band BEFORE overwriting them, so an
            // accidental rollout can be undone and the prior values restored. Return
            // the appraisal carrying that snapshot as the rollout's result.
            const [employee] = await tx.select().from(users).where(eq(users.id, userId));
            const priorGradeId = employee?.gradeId ?? null;
            const priorGradeBandId = employee?.gradeBandId ?? null;
            await tx.update(users).set({ ...fields, updatedAt: new Date() }).where(eq(users.id, userId));
            const [withPrior] = await tx
              .update(appraisals)
              .set({ priorGradeId, priorGradeBandId })
              .where(eq(appraisals.id, id))
              .returning();
            return withPrior;
          },
        },
        id,
        data,
      );
    });
  }

  // Reverse an accidental rollout: flip the appraisal back to "finalized", clear
  // the board's verdict/comment and rollout metadata, and restore the employee's
  // pre-rollout grade/pay band (only the fields the rollout actually applied).
  // Atomic-idempotent: only a "rolled_out" row flips back; a concurrent second
  // request matches 0 rows and returns undefined.
  async undoRollout(id: string): Promise<Appraisal | undefined> {
    return db.transaction(async (tx) => {
      const [appraisal] = await tx
        .select()
        .from(appraisals)
        .where(and(eq(appraisals.id, id), eq(appraisals.status, "rolled_out")));
      if (!appraisal) return undefined;

      // Restore the employee's prior grade/band, mirroring the fields the rollout
      // applied so we never clear a value the rollout never touched.
      if (appraisal.pmId) {
        const userUpdate: { gradeId?: string | null; gradeBandId?: string | null } = {};
        if (appraisal.gradeId) userUpdate.gradeId = appraisal.priorGradeId ?? null;
        if (appraisal.assignedBandId) userUpdate.gradeBandId = appraisal.priorGradeBandId ?? null;
        if (Object.keys(userUpdate).length > 0) {
          await tx.update(users).set({ ...userUpdate, updatedAt: new Date() }).where(eq(users.id, appraisal.pmId));
        }
      }

      const [updated] = await tx
        .update(appraisals)
        .set({
          status: "finalized",
          finalVerdict: null,
          boardComment: null,
          rolledOutAt: null,
          rolledOutBy: null,
          priorGradeId: null,
          priorGradeBandId: null,
          updatedAt: new Date(),
        })
        .where(and(eq(appraisals.id, id), eq(appraisals.status, "rolled_out")))
        .returning();
      return updated;
    });
  }

  async getForecastEntries(projectId?: string, month?: number, year?: number) {
    const conditions: any[] = [];
    if (projectId) conditions.push(eq(forecastEntries.projectId, projectId));
    if (month !== undefined) conditions.push(eq(forecastEntries.month, month));
    if (year !== undefined) conditions.push(eq(forecastEntries.year, year));
    
    const entries = conditions.length > 0
      ? await db.select().from(forecastEntries).where(and(...conditions)).orderBy(asc(forecastEntries.year), asc(forecastEntries.month))
      : await db.select().from(forecastEntries).orderBy(asc(forecastEntries.year), asc(forecastEntries.month));
    
    const projectIds = [...new Set(entries.map(e => e.projectId))];
    const projectsData = projectIds.length > 0
      ? await db.select().from(projects).where(inArray(projects.id, projectIds))
      : [];
    
    const projectMap = new Map(projectsData.map(p => [p.id, p]));
    
    return entries.map(e => ({
      ...e,
      project: projectMap.get(e.projectId) ? {
        id: projectMap.get(e.projectId)!.id,
        name: projectMap.get(e.projectId)!.name,
        region: projectMap.get(e.projectId)!.region,
        billingType: projectMap.get(e.projectId)!.billingType,
        totalCost: projectMap.get(e.projectId)!.totalCost,
        clientName: projectMap.get(e.projectId)!.clientName,
        status: projectMap.get(e.projectId)!.status,
        mrrMonthlyAmount: projectMap.get(e.projectId)!.mrrMonthlyAmount,
        mrrDurationMonths: projectMap.get(e.projectId)!.mrrDurationMonths,
        numberOfPhases: projectMap.get(e.projectId)!.numberOfPhases,
      } : undefined,
    }));
  }

  async createForecastEntry(entry: InsertForecastEntry) {
    const [created] = await db.insert(forecastEntries).values(entry).returning();
    return created;
  }

  async updateForecastEntry(id: string, data: Partial<InsertForecastEntry>) {
    const [updated] = await db.update(forecastEntries).set({ ...data, updatedAt: new Date() }).where(eq(forecastEntries.id, id)).returning();
    return updated;
  }

  async deleteForecastEntry(id: string) {
    const result = await db.delete(forecastEntries).where(eq(forecastEntries.id, id)).returning();
    return result.length > 0;
  }

  async deleteForecastEntriesByProject(projectId: string, month?: number, year?: number) {
    const conditions = [eq(forecastEntries.projectId, projectId)];
    if (month !== undefined) conditions.push(eq(forecastEntries.month, month));
    if (year !== undefined) conditions.push(eq(forecastEntries.year, year));
    const result = await db.delete(forecastEntries).where(and(...conditions)).returning();
    return result.length;
  }

  // Payment Comments
  async getPaymentComments(paymentId: string): Promise<PaymentCommentWithUser[]> {
    const rows = await db
      .select({ comment: paymentComments, user: users })
      .from(paymentComments)
      .leftJoin(users, eq(paymentComments.userId, users.id))
      .where(eq(paymentComments.paymentId, paymentId))
      .orderBy(asc(paymentComments.createdAt));
    return rows.map(r => ({
      ...r.comment,
      user: r.user ? {
        id: r.user.id,
        firstName: r.user.firstName,
        lastName: r.user.lastName,
        email: r.user.email,
        profileImageUrl: r.user.profileImageUrl,
      } : null,
    }));
  }

  async getPaymentCommentCounts(paymentIds: string[]): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (paymentIds.length === 0) return map;
    const rows = await db
      .select({ paymentId: paymentComments.paymentId, count: sql<number>`count(*)::int` })
      .from(paymentComments)
      .where(inArray(paymentComments.paymentId, paymentIds))
      .groupBy(paymentComments.paymentId);
    for (const r of rows) map.set(r.paymentId, r.count);
    return map;
  }

  async getLatestPaymentComments(paymentIds: string[]): Promise<Map<string, PaymentCommentWithUser>> {
    const map = new Map<string, PaymentCommentWithUser>();
    if (paymentIds.length === 0) return map;
    const rows = await db
      .select({ comment: paymentComments, user: users })
      .from(paymentComments)
      .leftJoin(users, eq(paymentComments.userId, users.id))
      .where(inArray(paymentComments.paymentId, paymentIds))
      .orderBy(desc(paymentComments.createdAt));
    for (const r of rows) {
      if (!map.has(r.comment.paymentId)) {
        map.set(r.comment.paymentId, {
          ...r.comment,
          user: r.user ? {
            id: r.user.id,
            firstName: r.user.firstName,
            lastName: r.user.lastName,
            email: r.user.email,
            profileImageUrl: r.user.profileImageUrl,
          } : null,
        });
      }
    }
    return map;
  }

  async getPaymentComment(id: string): Promise<PaymentComment | undefined> {
    const [row] = await db.select().from(paymentComments).where(eq(paymentComments.id, id));
    return row;
  }

  async createPaymentComment(data: InsertPaymentComment): Promise<PaymentComment> {
    const [row] = await db.insert(paymentComments).values(data).returning();
    return row;
  }

  async updatePaymentComment(id: string, comment: string): Promise<PaymentComment | undefined> {
    const [row] = await db
      .update(paymentComments)
      .set({ comment, updatedAt: new Date() })
      .where(eq(paymentComments.id, id))
      .returning();
    return row;
  }

  async deletePaymentComment(id: string): Promise<boolean> {
    const result = await db.delete(paymentComments).where(eq(paymentComments.id, id)).returning();
    return result.length > 0;
  }

  // ============================================================================
  // PODs
  // ============================================================================

  async getAllPods(): Promise<Pod[]> {
    return await db.select().from(pods).orderBy(asc(pods.name));
  }

  async getPod(id: string): Promise<Pod | undefined> {
    const [row] = await db.select().from(pods).where(eq(pods.id, id));
    return row;
  }

  async createPod(data: InsertPod): Promise<Pod> {
    const [row] = await db.insert(pods).values(data).returning();
    return row;
  }

  async updatePod(id: string, data: UpdatePod): Promise<Pod | undefined> {
    const [row] = await db
      .update(pods)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(pods.id, id))
      .returning();
    return row;
  }

  async deletePod(id: string): Promise<boolean> {
    // Detach members first (FK is logical only — we manage via UPDATE)
    await db.update(users).set({ podId: null }).where(eq(users.podId, id));
    const result = await db.delete(pods).where(eq(pods.id, id)).returning();
    return result.length > 0;
  }

  private monthBefore(month: number, year: number): { month: number; year: number } {
    return month === 1 ? { month: 12, year: year - 1 } : { month: month - 1, year };
  }

  private monthAfter(month: number, year: number): { month: number; year: number } {
    return month === 12 ? { month: 1, year: year + 1 } : { month: month + 1, year };
  }

  // Apply the chosen attribution strategy when a PM moves from `fromPodId` to a
  // new POD. Must run inside a transaction (tx). For "move_all" we clear the
  // PM's overrides so their entire history follows the new POD via the
  // current-pod fallback. For "keep_previous" we pin the months before the
  // effective cutoff to the old POD by inserting an override row; later months
  // fall through to the new (current) POD automatically.
  private async applyPodMove(
    tx: any,
    userId: string,
    fromPodId: string,
    strategy: PodMoveStrategy | undefined,
  ): Promise<void> {
    if (!strategy || strategy.mode === "move_all") {
      await tx.delete(podMemberships).where(eq(podMemberships.userId, userId));
      return;
    }

    const now = new Date();
    const effMonth = strategy.effMonth ?? now.getMonth() + 1;
    const effYear = strategy.effYear ?? now.getFullYear();
    // Last month that stays attributed to the old POD.
    const cutoff = this.monthBefore(effMonth, effYear);
    const cutoffKey = cutoff.year * 100 + cutoff.month;

    // Start the pin just after any existing pinned range so we never overlap.
    const existing = await tx
      .select()
      .from(podMemberships)
      .where(eq(podMemberships.userId, userId));
    let start: { month: number | null; year: number | null } = { month: null, year: null };
    let maxEndKey = -1;
    let maxEnd: { month: number; year: number } | null = null;
    for (const row of existing as PodMembership[]) {
      if (row.endMonth != null && row.endYear != null) {
        const k = row.endYear * 100 + row.endMonth;
        if (k > maxEndKey) {
          maxEndKey = k;
          maxEnd = { month: row.endMonth, year: row.endYear };
        }
      }
    }
    if (maxEnd) {
      const after = this.monthAfter(maxEnd.month, maxEnd.year);
      start = { month: after.month, year: after.year };
    }
    const startKey =
      start.month != null && start.year != null ? start.year * 100 + start.month : -1;
    // Nothing to pin if the pin range would be empty.
    if (startKey > cutoffKey) return;

    await tx.insert(podMemberships).values({
      userId,
      podId: fromPodId,
      startMonth: start.month,
      startYear: start.year,
      endMonth: cutoff.month,
      endYear: cutoff.year,
    });
  }

  async setPodMembers(podId: string, pmIds: string[], moveStrategy?: PodMoveStrategy): Promise<void> {
    await db.transaction(async (tx) => {
      const before = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.podId, podId));
      const beforeIds = new Set(before.map((u: { id: string }) => u.id));
      const newIds = new Set(pmIds);

      // Detach members removed from this POD (history overrides are left intact).
      const removed = Array.from(beforeIds).filter((id) => !newIds.has(id as string)) as string[];
      if (removed.length > 0) {
        await tx.update(users).set({ podId: null }).where(inArray(users.id, removed));
      }

      // Add or move each requested PM.
      for (const pmId of pmIds) {
        if (beforeIds.has(pmId)) continue;
        const [u] = await tx
          .select({ podId: users.podId })
          .from(users)
          .where(eq(users.id, pmId));
        const fromPodId = u?.podId ?? null;
        if (fromPodId && fromPodId !== podId) {
          await this.applyPodMove(tx, pmId, fromPodId, moveStrategy);
        }
        await tx.update(users).set({ podId }).where(eq(users.id, pmId));
      }
    });
  }

  async addPodMember(podId: string, userId: string, moveStrategy?: PodMoveStrategy): Promise<void> {
    // Moves PM to this POD even if they were in another POD (single-POD invariant)
    await db.transaction(async (tx) => {
      const [u] = await tx
        .select({ podId: users.podId })
        .from(users)
        .where(eq(users.id, userId));
      const fromPodId = u?.podId ?? null;
      if (fromPodId && fromPodId !== podId) {
        await this.applyPodMove(tx, userId, fromPodId, moveStrategy);
      }
      await tx.update(users).set({ podId }).where(eq(users.id, userId));
    });
  }

  async removePodMember(podId: string, userId: string): Promise<boolean> {
    const result = await db
      .update(users)
      .set({ podId: null })
      .where(and(eq(users.id, userId), eq(users.podId, podId)))
      .returning({ id: users.id });
    return result.length > 0;
  }

  async getPodTargetOverrides(podId: string): Promise<PodTargetOverride[]> {
    return await db
      .select()
      .from(podTargetOverrides)
      .where(eq(podTargetOverrides.podId, podId))
      .orderBy(asc(podTargetOverrides.year), asc(podTargetOverrides.month));
  }

  async upsertPodTargetOverride(data: InsertPodTargetOverride): Promise<PodTargetOverride> {
    const [existing] = await db
      .select()
      .from(podTargetOverrides)
      .where(
        and(
          eq(podTargetOverrides.podId, data.podId),
          eq(podTargetOverrides.month, data.month),
          eq(podTargetOverrides.year, data.year),
        ),
      );
    if (existing) {
      const [row] = await db
        .update(podTargetOverrides)
        .set({ t1: data.t1 ?? null, t2: data.t2 ?? null, updatedAt: new Date() })
        .where(eq(podTargetOverrides.id, existing.id))
        .returning();
      return row;
    }
    const [row] = await db.insert(podTargetOverrides).values(data).returning();
    return row;
  }

  async deletePodTargetOverride(id: string): Promise<boolean> {
    const result = await db.delete(podTargetOverrides).where(eq(podTargetOverrides.id, id)).returning();
    return result.length > 0;
  }

  // Validate a single membership record's range and ensure it does not overlap
  // any other record for the same PM. `excludeId` skips the row being edited.
  // Throws PodMembershipValidationError on any problem.
  private async validatePodMembership(
    userId: string,
    range: {
      startMonth: number | null;
      startYear: number | null;
      endMonth: number | null;
      endYear: number | null;
    },
    excludeId?: string,
  ): Promise<void> {
    const { startMonth, startYear, endMonth, endYear } = range;

    // Month/year must be supplied together (both null = open-ended boundary).
    if ((startMonth == null) !== (startYear == null)) {
      throw new PodMembershipValidationError(
        "Start month and year must both be set or both be empty.",
      );
    }
    if ((endMonth == null) !== (endYear == null)) {
      throw new PodMembershipValidationError(
        "End month and year must both be set or both be empty.",
      );
    }

    const checkBounds = (m: number | null, y: number | null) => {
      if (m != null && (!Number.isInteger(m) || m < 1 || m > 12)) {
        throw new PodMembershipValidationError("Month must be between 1 and 12.");
      }
      if (y != null && (!Number.isInteger(y) || y < 2000 || y > 2100)) {
        throw new PodMembershipValidationError("Year must be between 2000 and 2100.");
      }
    };
    checkBounds(startMonth, startYear);
    checkBounds(endMonth, endYear);

    const startKey =
      startMonth != null && startYear != null ? startYear * 100 + startMonth : -Infinity;
    const endKey =
      endMonth != null && endYear != null ? endYear * 100 + endMonth : Infinity;

    if (startKey > endKey) {
      throw new PodMembershipValidationError(
        "The start of the range must not be after the end.",
      );
    }

    // Overlap check against the PM's other history rows.
    const existing = await db
      .select()
      .from(podMemberships)
      .where(eq(podMemberships.userId, userId));
    for (const row of existing as PodMembership[]) {
      if (excludeId && row.id === excludeId) continue;
      const rStart =
        row.startMonth != null && row.startYear != null
          ? row.startYear * 100 + row.startMonth
          : -Infinity;
      const rEnd =
        row.endMonth != null && row.endYear != null
          ? row.endYear * 100 + row.endMonth
          : Infinity;
      // Two inclusive ranges overlap when each starts on/before the other ends.
      if (startKey <= rEnd && rStart <= endKey) {
        throw new PodMembershipValidationError(
          "This range overlaps another history record for the same PM. Adjust the dates so the ranges do not overlap.",
        );
      }
    }
  }

  async getPodMembershipsForUser(userId: string): Promise<PodMembership[]> {
    return await db
      .select()
      .from(podMemberships)
      .where(eq(podMemberships.userId, userId))
      .orderBy(asc(podMemberships.startYear), asc(podMemberships.startMonth));
  }

  async createPodMembership(data: InsertPodMembership): Promise<PodMembership> {
    const range = {
      startMonth: data.startMonth ?? null,
      startYear: data.startYear ?? null,
      endMonth: data.endMonth ?? null,
      endYear: data.endYear ?? null,
    };
    await this.validatePodMembership(data.userId, range);
    const [row] = await db
      .insert(podMemberships)
      .values({ ...data, ...range })
      .returning();
    return row;
  }

  async updatePodMembership(
    id: string,
    data: Partial<InsertPodMembership>,
  ): Promise<PodMembership | undefined> {
    const [current] = await db
      .select()
      .from(podMemberships)
      .where(eq(podMemberships.id, id));
    if (!current) return undefined;

    const range = {
      startMonth: data.startMonth !== undefined ? data.startMonth ?? null : current.startMonth,
      startYear: data.startYear !== undefined ? data.startYear ?? null : current.startYear,
      endMonth: data.endMonth !== undefined ? data.endMonth ?? null : current.endMonth,
      endYear: data.endYear !== undefined ? data.endYear ?? null : current.endYear,
    };
    const podId = data.podId ?? current.podId;
    await this.validatePodMembership(current.userId, range, id);

    const [row] = await db
      .update(podMemberships)
      .set({ ...range, podId, updatedAt: new Date() })
      .where(eq(podMemberships.id, id))
      .returning();
    return row;
  }

  async deletePodMembership(id: string): Promise<boolean> {
    const result = await db
      .delete(podMemberships)
      .where(eq(podMemberships.id, id))
      .returning();
    return result.length > 0;
  }

  async getPodStats(
    startMonth: number,
    startYear: number,
    endMonth: number,
    endYear: number,
  ): Promise<PodStats[]> {
    const allPods = await db.select().from(pods).orderBy(asc(pods.name));
    if (allPods.length === 0) return [];

    const podIds = allPods.map((p) => p.id);

    // Members per POD
    const allMembers = await db.select().from(users).where(inArray(users.podId, podIds));
    const membersByPod = new Map<string, User[]>();
    for (const m of allMembers) {
      if (!m.podId) continue;
      const arr = membersByPod.get(m.podId) ?? [];
      arr.push(m);
      membersByPod.set(m.podId, arr);
    }

    // Historical membership overrides (pin a PM's payments to a POD for a
    // month/year range). Only rows referencing our PODs matter.
    const membershipRows = await db
      .select()
      .from(podMemberships)
      .where(inArray(podMemberships.podId, podIds));
    const membershipByPm = new Map<string, PodMembership[]>();
    for (const r of membershipRows) {
      const arr = membershipByPm.get(r.userId) ?? [];
      arr.push(r);
      membershipByPm.set(r.userId, arr);
    }

    // Superset of PMs we must consider: current members of any POD, plus any PM
    // referenced by a membership override (they may have since left).
    const relevantPmIds = Array.from(
      new Set<string>([
        ...allMembers.map((u) => u.id),
        ...membershipRows.map((r) => r.userId),
      ]),
    );
    const pmUsers = relevantPmIds.length
      ? await db.select().from(users).where(inArray(users.id, relevantPmIds))
      : [];
    const userById = new Map(pmUsers.map((u) => [u.id, u]));
    const pmCurrentPod = new Map<string, string | null>(
      pmUsers.map((u) => [u.id, u.podId ?? null]),
    );

    // Resolve which POD a PM's payment in (month, year) belongs to: a covering
    // membership override wins; otherwise fall back to the PM's current POD.
    const podIdSet = new Set(podIds);
    const resolvePod = (pmId: string, month: number, year: number): string | null => {
      const key = year * 100 + month;
      const rows = membershipByPm.get(pmId);
      if (rows) {
        for (const r of rows) {
          const sKey =
            r.startMonth != null && r.startYear != null
              ? r.startYear * 100 + r.startMonth
              : -Infinity;
          const eKey =
            r.endMonth != null && r.endYear != null
              ? r.endYear * 100 + r.endMonth
              : Infinity;
          if (key >= sKey && key <= eKey) return r.podId;
        }
      }
      return pmCurrentPod.get(pmId) ?? null;
    };

    // Leads
    const leadIds = Array.from(new Set(allPods.map((p) => p.leadId).filter(Boolean))) as string[];
    const leadUsers = leadIds.length
      ? await db.select().from(users).where(inArray(users.id, leadIds))
      : [];
    const leadMap = new Map(leadUsers.map((u) => [u.id, u]));

    // Overrides in range
    const allOverrides = await db
      .select()
      .from(podTargetOverrides)
      .where(inArray(podTargetOverrides.podId, podIds));
    const overrideMap = new Map<string, PodTargetOverride>();
    for (const o of allOverrides) {
      overrideMap.set(`${o.podId}:${o.year}-${o.month}`, o);
    }

    // Build list of (month, year) tuples in inclusive range
    const months: { month: number; year: number }[] = [];
    let m = startMonth;
    let y = startYear;
    while (y < endYear || (y === endYear && m <= endMonth)) {
      months.push({ month: m, year: y });
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
      if (months.length > 240) break; // safety: 20 years
    }

    // Aggregate received payments per (podId, paymentType) for the range
    // Payment.month/year is the targeting month; only count received payments
    const startKey = startYear * 100 + startMonth;
    const endKey = endYear * 100 + endMonth;
    const periodFilter = sql`(${payments.year} * 100 + ${payments.month}) BETWEEN ${startKey} AND ${endKey}`;

    // Group by PM + paymentType + month/year so each bucket can be attributed
    // to the POD the PM belonged to during that specific month.
    type PmAgg = { recurring: number; upsell: number; count: number };
    const pmAggByPod = new Map<string, Map<string, PmAgg>>();
    if (relevantPmIds.length > 0) {
      const aggRows = await db
        .select({
          pmId: projects.pmId,
          paymentType: payments.paymentType,
          month: payments.month,
          year: payments.year,
          sumReceived: sql<string>`COALESCE(SUM(${payments.receivedAmount}), 0)`,
          cnt: sql<number>`COUNT(*)`,
        })
        .from(payments)
        .innerJoin(projects, eq(payments.projectId, projects.id))
        .where(
          and(
            eq(payments.status, "received"),
            inArray(projects.pmId, relevantPmIds),
            periodFilter,
          ),
        )
        .groupBy(projects.pmId, payments.paymentType, payments.month, payments.year);

      for (const r of aggRows) {
        if (!r.pmId) continue;
        const podId = resolvePod(r.pmId, r.month, r.year);
        if (!podId || !podIdSet.has(podId)) continue;
        const podPmMap = pmAggByPod.get(podId) ?? new Map<string, PmAgg>();
        const pmAgg = podPmMap.get(r.pmId) ?? { recurring: 0, upsell: 0, count: 0 };
        const amt = parseFloat(r.sumReceived || "0") || 0;
        if (r.paymentType === "upsell") pmAgg.upsell += amt;
        else pmAgg.recurring += amt;
        pmAgg.count += Number(r.cnt || 0);
        podPmMap.set(r.pmId, pmAgg);
        pmAggByPod.set(podId, podPmMap);
      }
    }

    const result: PodStats[] = [];
    for (const pod of allPods) {
      // Sum effective T1/T2 across the months in range
      let t1Sum = 0;
      let t2Sum = 0;
      const defaultT1 = parseFloat(pod.defaultT1 || "0") || 0;
      const defaultT2 = parseFloat(pod.defaultT2 || "0") || 0;
      for (const { month, year } of months) {
        const ov = overrideMap.get(`${pod.id}:${year}-${month}`);
        const t1 = ov?.t1 != null ? parseFloat(ov.t1) : defaultT1;
        const t2 = ov?.t2 != null ? parseFloat(ov.t2) : defaultT2;
        t1Sum += isNaN(t1) ? 0 : t1;
        t2Sum += isNaN(t2) ? 0 : t2;
      }

      const members = membersByPod.get(pod.id) ?? [];
      const pmAggMap = pmAggByPod.get(pod.id) ?? new Map<string, PmAgg>();
      // Include current members (even with zero) plus any PM attributed to this
      // POD via a membership override (e.g. they have since moved away).
      const pmIdsForPod = new Set<string>([
        ...members.map((pm) => pm.id),
        ...Array.from(pmAggMap.keys()),
      ]);
      const pmStats: PodPmStats[] = [];
      for (const pmId of Array.from(pmIdsForPod)) {
        const pm = userById.get(pmId) ?? members.find((mm) => mm.id === pmId);
        if (!pm) continue;
        const a = pmAggMap.get(pmId) ?? { recurring: 0, upsell: 0, count: 0 };
        pmStats.push({
          pm,
          recurringReceived: a.recurring,
          upsellReceived: a.upsell,
          totalReceived: a.recurring + a.upsell,
          paymentCount: a.count,
        });
      }
      // Sort PMs by total received desc
      pmStats.sort((a, b) => b.totalReceived - a.totalReceived);

      const recurringReceived = pmStats.reduce((s, p) => s + p.recurringReceived, 0);
      const upsellReceived = pmStats.reduce((s, p) => s + p.upsellReceived, 0);
      const totalReceived = recurringReceived + upsellReceived;

      result.push({
        pod,
        lead: pod.leadId ? leadMap.get(pod.leadId) ?? null : null,
        members,
        period: { startMonth, startYear, endMonth, endYear },
        t1: t1Sum,
        t2: t2Sum,
        recurringReceived,
        upsellReceived,
        totalReceived,
        achievedT1Percent: t1Sum > 0 ? (totalReceived / t1Sum) * 100 : 0,
        achievedT2Percent: t2Sum > 0 ? (totalReceived / t2Sum) * 100 : 0,
        remainingT1: t1Sum - totalReceived,
        remainingT2: t2Sum - totalReceived,
        pmStats,
      });
    }

    return result;
  }
}

// Type for merge preview
export type ProjectMergePreview = {
  targetProject: Project;
  sourceProjects: ProjectWithPM[];
  counts: {
    payments: number;
    milestones: number;
    invoices: number;
    upsells: number;
    timesheets: number;
    costs: number;
  };
};

export const storage = new DatabaseStorage();
