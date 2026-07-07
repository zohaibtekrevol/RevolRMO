import { sql, relations } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  decimal,
  timestamp,
  boolean,
  index,
  uniqueIndex,
  jsonb,
  unique,
  date,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Legacy user roles enum (kept for backward compatibility)
export const userRoles = ["admin", "pm"] as const;
export type UserRole = (typeof userRoles)[number];

// Permission categories for the system
export const permissionCategories = [
  "dashboard", "payments", "projects", "planning", "upsells", "forecasting",
  "analytics", "reports", "users", "settings", "notifications", "pods"
] as const;
export type PermissionCategory = typeof permissionCategories[number];

// System permissions - granular access control
export const systemPermissions = [
  // Dashboard
  "view_dashboard",
  // Payments
  "view_payments", "create_payments", "edit_payments", "delete_payments",
  // Projects
  "view_projects", "create_projects", "edit_projects", "delete_projects",
  // Monthly Planning
  "view_planning", "create_planning", "edit_planning", "delete_planning",
  // Upsells
  "view_upsells", "create_upsells", "edit_upsells", "delete_upsells",
  // Invoices
  "view_invoices", "create_invoices", "cancel_invoices", "record_payment_invoices", "delete_invoices",
  // Timesheets
  "view_timesheets", "create_timesheets", "delete_timesheets",
  // Document Repository / Signoffs
  "view_signoffs", "create_signoffs", "edit_signoffs", "delete_signoffs", "send_signoff_reminders",
  // KPI
  "view_kpis", "manage_kpis",
  // Forecasting
  "view_forecasting", "edit_forecasting",
  // Analytics
  "view_analytics",
  // Cost & Margin
  "view_cost_margin",
  // Calendar
  "view_calendar",
  // Reports
  "view_reports", "export_reports",
  // Users
  "view_users", "create_users", "edit_users", "delete_users",
  // Settings
  "view_settings", "edit_settings",
  // Notifications
  "view_notifications", "send_notifications",
  // Access Control
  "manage_roles",
  // Import Data
  "import_data",
  // PODs
  "view_pods", "manage_pods"
] as const;
export type SystemPermission = typeof systemPermissions[number];

// Roles table - stores role definitions
export const roles = pgTable("roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull().unique(),
  displayName: varchar("display_name").notNull(),
  description: text("description"),
  department: varchar("department"),
  isSystem: boolean("is_system").default(false).notNull(), // System roles cannot be deleted
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Role permissions table - maps roles to permissions
export const rolePermissions = pgTable("role_permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roleId: varchar("role_id").references(() => roles.id, { onDelete: "cascade" }).notNull(),
  permission: varchar("permission").$type<SystemPermission>().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("role_permissions_role_idx").on(table.roleId),
]);

// User status enum
export const userStatuses = ["active", "blocked"] as const;
export type UserStatus = (typeof userStatuses)[number];

// Theme settings type
export interface ThemeSettings {
  primaryColor?: string; // HSL format: "0 84% 47%" (blood red default)
  accentColor?: string; // HSL format
  sidebarColor?: string; // HSL format
  mode?: "light" | "dark" | "system";
}

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").$type<UserRole>().default("pm").notNull(), // Legacy field
  roleId: varchar("role_id").references(() => roles.id), // New dynamic role reference
  isProjectManager: boolean("is_project_manager").default(false).notNull(), // PM designation, independent of permission role
  kpiLevelId: varchar("kpi_level_id"), // PM level for KPI scoring (references kpi_levels.id)
  kpiExcluded: boolean("kpi_excluded").default(false).notNull(), // Exclude from KPI performance reviews
  joiningDate: date("joining_date"), // Date the user joined; used for appraisal eligibility (>= 1 year service)
  gradeId: varchar("grade_id"), // Appraisal Designation (references grades.id); separate concept from kpiLevelId
  gradeBandId: varchar("grade_band_id"), // Assigned pay Grade (references salary_grade_bands.id); drives current salary
  status: varchar("status").$type<UserStatus>().default("active").notNull(),
  lastLogin: timestamp("last_login"), // Track when user last logged in (null = never logged in)
  themeSettings: jsonb("theme_settings").$type<ThemeSettings>(), // User personalized theme
  podId: varchar("pod_id").references((): any => pods.id, { onDelete: "set null" }), // POD membership FK
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Employment type enum for resources
export const employmentTypes = ["employee", "contractor"] as const;
export type EmploymentType = (typeof employmentTypes)[number];

// Resources table - stores team members with salary/rate information
export const resources = pgTable("resources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id), // Optional link to users table
  name: varchar("name").notNull(),
  email: varchar("email"),
  designation: varchar("designation"),
  employmentType: varchar("employment_type").$type<EmploymentType>().default("employee").notNull(),
  monthlySalary: decimal("monthly_salary", { precision: 12, scale: 2 }), // For employees
  contractorHourlyRate: decimal("contractor_hourly_rate", { precision: 12, scale: 2 }), // For contractors
  effectiveHourlyRate: decimal("effective_hourly_rate", { precision: 12, scale: 2 }), // Computed: salary/176 for employees, or contractorHourlyRate for contractors
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("resource_user_idx").on(table.userId),
  index("resource_email_idx").on(table.email),
]);

// Resource Rate Settings table - global and region-specific rate overrides
export const resourceRateSettings = pgTable("resource_rate_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  region: varchar("region").$type<Region | "global">(), // null or 'global' for company-wide, or specific region
  useGlobalFixedRate: boolean("use_global_fixed_rate").default(false).notNull(),
  globalFixedHourlyRate: decimal("global_fixed_hourly_rate", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Regions enum
export const regions = ["CA", "TX", "AE"] as const;
export type Region = (typeof regions)[number];

// Payment types enum
export const paymentTypes = ["recurring", "upsell"] as const;
export type PaymentType = (typeof paymentTypes)[number];

// Payment status enum
export const paymentStatuses = ["not_targeting", "pending_invoice", "invoiced", "received"] as const;
export type PaymentStatus = (typeof paymentStatuses)[number];

// Project billing types enum
export const projectBillingTypes = ["ftfc", "tbe", "mrr"] as const;
export type ProjectBillingType = (typeof projectBillingTypes)[number];

// Project status enum
export const projectStatuses = ["active", "on_hold", "complete"] as const;
export type ProjectStatus = (typeof projectStatuses)[number];

// Project lifecycle phase enum (ordered)
export const projectPhases = ["scope", "design", "alpha", "beta", "uat", "deployment", "support", "maintenance"] as const;
export type ProjectPhase = (typeof projectPhases)[number];

// Delivery status enum (Green/Amber/Red gating criteria)
export const deliveryStatuses = ["green", "amber", "red"] as const;
export type DeliveryStatus = (typeof deliveryStatuses)[number];

// Milestone status enum
export const milestoneStatuses = ["planned", "ready_for_invoice", "invoiced", "partially_paid", "paid", "cancelled"] as const;
export type MilestoneStatus = (typeof milestoneStatuses)[number];

// Projects table
export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  clientName: varchar("client_name").notNull(),
  clientEmail: varchar("client_email"),
  region: varchar("region").$type<Region>().notNull(),
  pmId: varchar("pm_id").references(() => users.id),
  projectType: varchar("project_type"),
  // AE (UAE) region-specific fields (nullable; only populated for AE projects)
  placeOfSupply: varchar("place_of_supply").$type<"inside_uae" | "outside_uae">(),
  supplyCountry: varchar("supply_country"),
  supplyCity: varchar("supply_city"),
  serviceType: varchar("service_type"),
  clientTrn: varchar("client_trn"),
  clientBusinessName: varchar("client_business_name"),
  clientAddress: text("client_address"),
  vat: decimal("vat", { precision: 5, scale: 2 }),
  phase: varchar("phase"),
  status: varchar("status").$type<ProjectStatus>().default("active").notNull(),
  totalCost: decimal("total_cost", { precision: 12, scale: 2 }).notNull(),
  paymentTerms: text("payment_terms"),
  // Billing configuration
  billingType: varchar("billing_type").$type<ProjectBillingType>(),
  contractStartDate: timestamp("contract_start_date"),
  contractEndDate: timestamp("contract_end_date"),
  // FTFC specific: number of phases
  numberOfPhases: integer("number_of_phases"),
  // TBE specific: hours per month and hourly rate
  tbeHoursPerMonth: integer("tbe_hours_per_month"),
  tbeHourlyRate: decimal("tbe_hourly_rate", { precision: 12, scale: 2 }),
  // MRR specific: monthly amount and duration
  mrrMonthlyAmount: decimal("mrr_monthly_amount", { precision: 12, scale: 2 }),
  mrrDurationMonths: integer("mrr_duration_months"),
  // Delivery gating status (green/amber/red)
  deliveryStatus: varchar("delivery_status").$type<DeliveryStatus>().default("green"),
  // Cost & Margin project-level overrides (optional - fallback to global settings if null)
  overrideHourlyRate: decimal("override_hourly_rate", { precision: 12, scale: 2 }), // Project-specific hourly rate
  overrideProfitabilityPercent: decimal("override_profitability_percent", { precision: 5, scale: 2 }), // Project-specific profitability %
  overrideVarianceHours: decimal("override_variance_hours", { precision: 10, scale: 2 }), // Project-specific variance buffer
  overrideAvailableHours: decimal("override_available_hours", { precision: 10, scale: 2 }), // Manual override for available bucket hours (legacy projects)
  // Hourly bucket status tracking for notifications
  lastBucketStatus: varchar("last_bucket_status").$type<"on_track" | "warning" | "critical">(),
  isNewProject: boolean("is_new_project").default(true),
  isFullyPaid: boolean("is_fully_paid").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Payments table
export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id).notNull(),
  monthlyPlanId: varchar("monthly_plan_id").references(() => monthlyPlans.id),
  milestoneId: varchar("milestone_id"), // Link to project milestone for recurring payments
  changeRequestId: varchar("change_request_id"), // Link to change request (for upsell payments)
  crInstallmentId: varchar("cr_installment_id"), // Link to change request installment (for upsell payments)
  expectedAmount: decimal("expected_amount", { precision: 12, scale: 2 }).notNull(),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  receivedAmount: decimal("received_amount", { precision: 12, scale: 2 }).default("0"),
  paymentType: varchar("payment_type").$type<PaymentType>().notNull(),
  status: varchar("status").$type<PaymentStatus>().default("not_targeting").notNull(),
  narration: varchar("narration"),
  invoiceDate: timestamp("invoice_date"),
  dueDate: timestamp("due_date"),
  receivedDate: timestamp("received_date"),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  isTarget: boolean("is_target").default(true),
  probability: integer("probability").default(100).notNull(), // 0-100% confidence level for forecasting
  dismissedFromReminders: boolean("dismissed_from_reminders").default(false), // Dismiss from notification reminders without changing status
  isNewUpsell: boolean("is_new_upsell").default(false), // Tag upsell as newly locked in this month vs recurring from previous month
  isConfirmed: boolean("is_confirmed").default(false), // Tag payment as 100% confirmed vs uncertain
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Project Milestones table
export const projectMilestones = pgTable("project_milestones", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name").notNull(),
  description: text("description"),
  sequenceNumber: integer("sequence_number").notNull(),
  // Billing period (month/year for TBE/MRR)
  billingMonth: integer("billing_month"),
  billingYear: integer("billing_year"),
  // For FTFC: phase number, for MRR: installment number
  phaseNumber: integer("phase_number"),
  // Financial details
  expectedAmount: decimal("expected_amount", { precision: 12, scale: 2 }).notNull(),
  receivedAmount: decimal("received_amount", { precision: 12, scale: 2 }).default("0"),
  // Probability for forecasting (0-100%)
  probability: integer("probability").default(100).notNull(),
  // TBE specific
  hoursCommitted: integer("hours_committed"),
  hourlyRate: decimal("hourly_rate", { precision: 12, scale: 2 }),
  // Status and dates
  status: varchar("status").$type<MilestoneStatus>().default("planned").notNull(),
  dueDate: timestamp("due_date"),
  invoicedDate: timestamp("invoiced_date"),
  paidDate: timestamp("paid_date"),
  // Link to payment when created
  paymentId: varchar("payment_id").references(() => payments.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("project_milestones_project_idx").on(table.projectId),
  index("project_milestones_status_idx").on(table.status),
]);

// Change Requests table - locked upsells managed with installments
export const changeRequests = pgTable("change_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  title: varchar("title").notNull(),
  description: text("description"),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  dateLocked: timestamp("date_locked"),
  numberOfInstallments: integer("number_of_installments").default(1).notNull(),
  // CR lifecycle status (Task #117): open (default), won, or lost.
  status: varchar("status").default("open").notNull(),
  // Upsell enrichment fields (Task #111). A locked CR is treated as a sold upsell.
  category: varchar("category"), // References upsellTypeSettings.name (admin-editable category)
  whatWasSold: text("what_was_sold"),
  outcome: varchar("outcome"),
  attachmentPath: varchar("attachment_path"), // Legacy object storage path, e.g. /objects/uploads/<id>
  attachmentName: varchar("attachment_name"), // Original filename for display/download
  attachmentDriveId: varchar("attachment_drive_id"), // Google Drive file id (current storage)
  attachmentDriveLink: varchar("attachment_drive_link"), // Drive webViewLink for opening in Drive
  pandadocLink: varchar("pandadoc_link"), // Optional PandaDoc URL
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("change_requests_project_idx").on(table.projectId),
]);

// Reusable colored tags for change requests (Task #122). Tags are created inline
// from the CR forms and shared across all CRs. Color is auto-assigned at creation.
export const crTags = pgTable("cr_tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  color: varchar("color").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  // Case-insensitive uniqueness so "Urgent" and "urgent" can't both exist.
  uniqueIndex("cr_tags_name_lower_unique").on(sql`lower(${table.name})`),
]);

// Join table: many-to-many between change requests and tags.
export const changeRequestTags = pgTable("change_request_tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  changeRequestId: varchar("change_request_id").references(() => changeRequests.id, { onDelete: "cascade" }).notNull(),
  tagId: varchar("tag_id").references(() => crTags.id, { onDelete: "cascade" }).notNull(),
}, (table) => [
  unique("change_request_tags_cr_tag_unique").on(table.changeRequestId, table.tagId),
  index("change_request_tags_cr_idx").on(table.changeRequestId),
]);

// Change Request Installments table - mirrors projectMilestones for CRs
export const crInstallments = pgTable("cr_installments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  changeRequestId: varchar("change_request_id").references(() => changeRequests.id, { onDelete: "cascade" }).notNull(),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name").notNull(),
  sequenceNumber: integer("sequence_number").notNull(),
  expectedAmount: decimal("expected_amount", { precision: 12, scale: 2 }).notNull(),
  receivedAmount: decimal("received_amount", { precision: 12, scale: 2 }).default("0"),
  status: varchar("status").$type<MilestoneStatus>().default("planned").notNull(),
  dueDate: timestamp("due_date"),
  invoicedDate: timestamp("invoiced_date"),
  paidDate: timestamp("paid_date"),
  paymentId: varchar("payment_id"), // Link to payment when received (non-FK, mirrors payments.milestoneId pattern)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("cr_installments_cr_idx").on(table.changeRequestId),
  index("cr_installments_project_idx").on(table.projectId),
  index("cr_installments_status_idx").on(table.status),
]);

// Caches the Google Drive folder ids for each project so we don't re-query/recreate
// the per-project folder + its three subfolders on every upload.
export const projectDriveFolders = pgTable("project_drive_folders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull().unique(),
  projectFolderId: varchar("project_folder_id").notNull(),
  changeRequestsFolderId: varchar("change_requests_folder_id").notNull(),
  invoicesFolderId: varchar("invoices_folder_id").notNull(),
  paymentReceiptsFolderId: varchar("payment_receipts_folder_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("project_drive_folders_project_idx").on(table.projectId),
]);

// Monthly Plan table
export const monthlyPlans = pgTable("monthly_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  monthlyTarget: decimal("monthly_target", { precision: 12, scale: 2 }).default("0").notNull(),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("monthly_plan_month_year_idx").on(table.month, table.year),
]);

// PM Targets table - per-PM monthly targets
export const pmTargets = pgTable("pm_targets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pmId: varchar("pm_id").references(() => users.id).notNull(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  targetAmount: decimal("target_amount", { precision: 12, scale: 2 }).default("0").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("pm_target_pm_month_year_idx").on(table.pmId, table.month, table.year),
]);

// OTP Reset table
export const otpResets = pgTable("otp_resets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  otp: varchar("otp").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false),
});

// Notification types
export const notificationTypes = ["payment_reminder", "payment_overdue", "payment_due_soon", "manual_reminder", "appraisal_rollout"] as const;
export type NotificationType = (typeof notificationTypes)[number];

// Notifications table
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  type: varchar("type").$type<NotificationType>().notNull(),
  title: varchar("title").notNull(),
  message: text("message").notNull(),
  paymentId: varchar("payment_id").references(() => payments.id),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id),
});

// Dismissed alerts - tracks which virtual payment alerts a user has dismissed
export const dismissedAlerts = pgTable("dismissed_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  alertId: varchar("alert_id").notNull(),
  dismissedAt: timestamp("dismissed_at").defaultNow(),
}, (table) => [
  index("dismissed_alerts_user_idx").on(table.userId),
  index("dismissed_alerts_user_alert_idx").on(table.userId, table.alertId),
]);

// Notification responses - allows PMs to respond to notifications
export const notificationResponses = pgTable("notification_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  notificationId: varchar("notification_id").references(() => notifications.id).notNull(),
  responderId: varchar("responder_id").references(() => users.id).notNull(),
  responseMessage: text("response_message").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Activity types
export const activityActions = ["create", "update", "delete", "login", "logout", "export", "import", "status_change", "created", "updated", "deleted", "sent_reminder"] as const;
export type ActivityAction = typeof activityActions[number];

export const activityEntities = ["user", "project", "payment", "monthly_plan", "settings", "report", "notification", "upsell", "signoff", "pod"] as const;
export type ActivityEntity = typeof activityEntities[number];

// Currency options
export const currencyOptions = ["USD", "EUR", "GBP", "AED", "CAD"] as const;
export type Currency = (typeof currencyOptions)[number];

// Upsell status enum
export const upsellStatuses = ["identified", "in_discussion", "proposal_sent", "negotiating", "converted", "lost"] as const;
export type UpsellStatus = (typeof upsellStatuses)[number];

// Default upsell types (for initial seeding)
export const defaultUpsellTypes = ["additional_service", "scope_expansion", "renewal", "cross_sell", "upgrade", "other"] as const;

// Default upsell categories for sold upsells / change requests (Task #111).
// Seeded additively into upsellTypeSettings (the shared admin-editable list) and
// never removed, so admins can edit/add more from settings.
export const defaultUpsellCategories = [
  { name: "marketing", displayName: "Marketing" },
  { name: "feature_expansion", displayName: "Feature Expansion" },
  { name: "new_platform", displayName: "New Platform" },
  { name: "support_maintenance", displayName: "Support & Maintenance" },
] as const;

// Upsell Type Settings table - for dynamic upsell type management
export const upsellTypeSettings = pgTable("upsell_type_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull().unique(),
  displayName: varchar("display_name").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// App Settings table (singleton - one row for global settings)
export const appSettings = pgTable("app_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  defaultCurrency: varchar("default_currency").$type<Currency>().default("USD").notNull(),
  paymentReminderDays: integer("payment_reminder_days").default(7).notNull(),
  dueDateWarningDays: integer("due_date_warning_days").default(3).notNull(),
  enableEmailNotifications: boolean("enable_email_notifications").default(false).notNull(),
  companyName: varchar("company_name").default("FinanceFlow").notNull(),
  fiscalYearStartMonth: integer("fiscal_year_start_month").default(1).notNull(),
  defaultReportFormat: varchar("default_report_format").default("pdf").notNull(),
  globalThemeSettings: jsonb("global_theme_settings").$type<ThemeSettings>(), // Admin-set default theme for all users
  reminderCcEmail: varchar("reminder_cc_email"), // CC email for client payment reminders
  // Cost & Margin / Hourly Buckets notifications
  enableBucketWarningNotifications: boolean("enable_bucket_warning_notifications").default(true).notNull(),
  enableBucketCriticalNotifications: boolean("enable_bucket_critical_notifications").default(true).notNull(),
  // Timesheet approval notifications
  enableTimesheetApprovalNotifications: boolean("enable_timesheet_approval_notifications").default(true).notNull(),
  // Milestone sync prompt - when payment is received, prompt to link to a milestone
  enableMilestoneSyncPrompt: boolean("enable_milestone_sync_prompt").default(true).notNull(),
  // Navigation modules hidden by admins (keys). Hidden modules are removed from the
  // sidebar for ALL users regardless of their RBAC permissions.
  hiddenModules: text("hidden_modules").array().default(sql`'{}'::text[]`).notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: varchar("updated_by").references(() => users.id),
});

// SMTP encryption types
export const smtpEncryptionTypes = ["none", "ssl", "starttls"] as const;
export type SMTPEncryptionType = (typeof smtpEncryptionTypes)[number];

// SMTP Settings table - stores email configuration
export const smtpSettings = pgTable("smtp_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  host: varchar("host").notNull(),
  port: integer("port").notNull().default(587),
  username: varchar("username").notNull(),
  password: varchar("password").notNull(), // Stored encrypted
  fromEmail: varchar("from_email").notNull(),
  fromName: varchar("from_name").notNull(),
  encryption: varchar("encryption").$type<SMTPEncryptionType>().default("starttls").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: varchar("updated_by").references(() => users.id),
});

// Activity Log table
export const activityLogs = pgTable("activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  action: varchar("action").$type<ActivityAction>().notNull(),
  entity: varchar("entity").$type<ActivityEntity>().notNull(),
  entityId: varchar("entity_id"),
  details: text("details"),
  ipAddress: varchar("ip_address"),
  userAgent: varchar("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Region Banking Details table - for ACH wire transfer invoices
export const regionBankingDetails = pgTable("region_banking_details", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  region: varchar("region").$type<Region>().notNull().unique(),
  companyName: varchar("company_name"),
  companyAddress: text("company_address"),
  bankName: varchar("bank_name").notNull(),
  accountName: varchar("account_name").notNull(),
  accountNumber: varchar("account_number").notNull(),
  routingNumber: varchar("routing_number"),
  swiftCode: varchar("swift_code"),
  iban: varchar("iban"),
  bankAddress: text("bank_address"),
  beneficiaryAddress: text("beneficiary_address"),
  additionalInstructions: text("additional_instructions"),
  currency: varchar("currency").$type<Currency>().default("USD").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Invoice status enum
export const invoiceStatuses = ["draft", "sent", "paid", "cancelled", "overdue"] as const;
export type InvoiceStatus = (typeof invoiceStatuses)[number];

// Invoice source - how the invoice was created
export const invoiceSources = ["payment", "manual"] as const;
export type InvoiceSource = (typeof invoiceSources)[number];

// Invoices table - central tracking for all invoices
export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceNumber: varchar("invoice_number").notNull().unique(),
  projectId: varchar("project_id").references(() => projects.id),
  paymentId: varchar("payment_id").references(() => payments.id),
  source: varchar("source").$type<InvoiceSource>().default("manual").notNull(),
  clientName: varchar("client_name").notNull(),
  clientEmail: varchar("client_email"),
  clientAddress: text("client_address"),
  issueDate: timestamp("issue_date").defaultNow().notNull(),
  dueDate: timestamp("due_date"),
  sentDate: timestamp("sent_date"),
  paidDate: timestamp("paid_date"),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).default("0").notNull(),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).default("0"),
  taxAmount: decimal("tax_amount", { precision: 12, scale: 2 }).default("0"),
  total: decimal("total", { precision: 12, scale: 2 }).notNull(),
  amountPaid: decimal("amount_paid", { precision: 12, scale: 2 }).default("0"),
  balance: decimal("balance", { precision: 12, scale: 2 }).notNull(),
  status: varchar("status").$type<InvoiceStatus>().default("draft").notNull(),
  notes: text("notes"),
  region: varchar("region").$type<Region>(),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("invoices_project_idx").on(table.projectId),
  index("invoices_payment_idx").on(table.paymentId),
  index("invoices_status_idx").on(table.status),
  index("invoices_issue_date_idx").on(table.issueDate),
]);

// Invoice Line Items table - for manual invoices with multiple items
export const invoiceLineItems = pgTable("invoice_line_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").references(() => invoices.id, { onDelete: "cascade" }).notNull(),
  description: text("description").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).default("1").notNull(),
  unitPrice: decimal("unit_price", { precision: 12, scale: 2 }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("invoice_line_items_invoice_idx").on(table.invoiceId),
]);

// Upsells table - for tracking upsell opportunities
export const upsells = pgTable("upsells", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id).notNull(),
  title: varchar("title"), // Optional
  description: text("description"),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  probability: integer("probability").default(50).notNull(), // 0-100%
  status: varchar("status").$type<UpsellStatus>().default("identified").notNull(),
  upsellType: varchar("upsell_type").default("other").notNull(), // References upsellTypeSettings.name
  expectedCloseDate: timestamp("expected_close_date"),
  convertedPaymentId: varchar("converted_payment_id").references(() => payments.id),
  convertedAt: timestamp("converted_at"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("upsell_project_idx").on(table.projectId),
  index("upsell_status_idx").on(table.status),
]);

// Activity types for upsells
export const upsellActivityTypes = ["call", "email", "meeting", "proposal", "negotiation", "follow_up", "other"] as const;
export type UpsellActivityType = typeof upsellActivityTypes[number];

// Upsell Activities table - for tracking actions on upsells
export const upsellActivities = pgTable("upsell_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  upsellId: varchar("upsell_id").references(() => upsells.id, { onDelete: "cascade" }).notNull(),
  activityType: varchar("activity_type").$type<UpsellActivityType>().default("other").notNull(),
  activityDate: timestamp("activity_date").defaultNow().notNull(),
  description: text("description").notNull(),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("upsell_activity_upsell_idx").on(table.upsellId),
]);

// Import audit table for tracking uploaded data
export const dataImports = pgTable("data_imports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fileName: varchar("file_name").notNull(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  totalRows: integer("total_rows").default(0).notNull(),
  successRows: integer("success_rows").default(0).notNull(),
  failedRows: integer("failed_rows").default(0).notNull(),
  status: varchar("status").$type<"pending" | "processing" | "completed" | "failed">().default("pending").notNull(),
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("data_import_month_year_idx").on(table.month, table.year),
]);

// ============================================================================
// COST & MARGIN MODULE
// ============================================================================

// Timesheet approval status enum
export const timesheetStatuses = ["pending", "approved", "rejected"] as const;
export type TimesheetStatus = (typeof timesheetStatuses)[number];

// Cost source enum - tracks where actual cost data came from
export const costSources = ["timesheet", "manual"] as const;
export type CostSource = (typeof costSources)[number];

// Margin bucket enum
export const marginBuckets = ["profit", "breakeven", "loss"] as const;
export type MarginBucket = (typeof marginBuckets)[number];

// Timesheets table - tracks time entries per user/project
export const timesheets = pgTable("timesheets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  date: timestamp("date").notNull(),
  hoursLogged: decimal("hours_logged", { precision: 6, scale: 2 }).notNull(),
  hourlyCostRate: decimal("hourly_cost_rate", { precision: 12, scale: 2 }).notNull(),
  description: text("description"),
  approvalStatus: varchar("approval_status").$type<TimesheetStatus>().default("pending").notNull(),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("timesheet_user_project_idx").on(table.userId, table.projectId),
  index("timesheet_date_idx").on(table.date),
  index("timesheet_project_idx").on(table.projectId),
]);

// Project Estimated Costs table - monthly planned costs per project
export const projectEstimatedCosts = pgTable("project_estimated_costs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  estimatedHumanCost: decimal("estimated_human_cost", { precision: 12, scale: 2 }).default("0").notNull(),
  estimatedVendorCost: decimal("estimated_vendor_cost", { precision: 12, scale: 2 }).default("0").notNull(),
  estimatedToolCost: decimal("estimated_tool_cost", { precision: 12, scale: 2 }).default("0").notNull(),
  totalEstimatedCost: decimal("total_estimated_cost", { precision: 12, scale: 2 }).default("0").notNull(),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("estimated_cost_project_month_idx").on(table.projectId, table.month, table.year),
]);

// Vendor Costs table - monthly vendor invoices per project
export const vendorCosts = pgTable("vendor_costs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  vendorName: varchar("vendor_name").notNull(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  invoiceNumber: varchar("invoice_number"),
  invoiceDate: timestamp("invoice_date"),
  description: text("description"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("vendor_cost_project_month_idx").on(table.projectId, table.month, table.year),
]);

// Tool Costs table - monthly tool/license allocations per project
export const toolCosts = pgTable("tool_costs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  toolName: varchar("tool_name").notNull(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  description: text("description"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("tool_cost_project_month_idx").on(table.projectId, table.month, table.year),
]);

// Project Actual Costs table - derived/stored actual costs with source tracking
export const projectActualCosts = pgTable("project_actual_costs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  actualHumanCost: decimal("actual_human_cost", { precision: 12, scale: 2 }).default("0").notNull(),
  actualVendorCost: decimal("actual_vendor_cost", { precision: 12, scale: 2 }).default("0").notNull(),
  actualToolCost: decimal("actual_tool_cost", { precision: 12, scale: 2 }).default("0").notNull(),
  totalActualCost: decimal("total_actual_cost", { precision: 12, scale: 2 }).default("0").notNull(),
  costSource: varchar("cost_source").$type<CostSource>().default("timesheet").notNull(),
  manualHumanCost: decimal("manual_human_cost", { precision: 12, scale: 2 }), // Manual override when no timesheets
  notes: text("notes"),
  calculatedAt: timestamp("calculated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("actual_cost_project_month_idx").on(table.projectId, table.month, table.year),
]);

// Margin Settings table - configurable thresholds for margin bucketing
export const marginSettings = pgTable("margin_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  profitThreshold: decimal("profit_threshold", { precision: 5, scale: 2 }).default("10").notNull(), // Margin > this = Profit
  breakEvenLowerThreshold: decimal("break_even_lower_threshold", { precision: 5, scale: 2 }).default("-5").notNull(), // Margin >= this = Breakeven
  // Loss: Margin < breakEvenLowerThreshold
  isActive: boolean("is_active").default(true).notNull(),
  updatedBy: varchar("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Cost & Margin Global Settings - hourly rates per region, profitability %, variance
export const costMarginGlobalSettings = pgTable("cost_margin_global_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Hourly rates per region
  hourlyRateCA: decimal("hourly_rate_ca", { precision: 12, scale: 2 }).default("20").notNull(),
  hourlyRateTX: decimal("hourly_rate_tx", { precision: 12, scale: 2 }).default("18").notNull(),
  hourlyRateAE: decimal("hourly_rate_ae", { precision: 12, scale: 2 }).default("15").notNull(),
  // Global profitability margin percentage (reserved as profit)
  globalProfitabilityPercent: decimal("global_profitability_percent", { precision: 5, scale: 2 }).default("30").notNull(),
  // Global variance hours (buffer - can be positive or negative)
  globalVarianceHours: decimal("global_variance_hours", { precision: 10, scale: 2 }).default("0").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  updatedBy: varchar("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Jira Integration Settings - stores Jira server connection details
export const jiraIntegrationSettings = pgTable("jira_integration_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serverUrl: varchar("server_url").notNull(), // e.g., http://10.10.30.35:8080
  username: varchar("username"), // Service account username
  apiToken: varchar("api_token"), // Personal Access Token or password (encrypted at app level)
  webhookSecret: varchar("webhook_secret"), // For validating incoming webhooks
  isActive: boolean("is_active").default(true).notNull(),
  lastSyncAt: timestamp("last_sync_at"),
  lastSyncStatus: varchar("last_sync_status").$type<"success" | "failed" | "in_progress">(),
  lastSyncError: text("last_sync_error"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Jira Project Mappings - maps Jira projects to RevolRMO projects
export const jiraProjectMappings = pgTable("jira_project_mappings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jiraProjectKey: varchar("jira_project_key").notNull(), // e.g., "PROJ"
  jiraProjectName: varchar("jira_project_name"),
  revolrmoProjectId: varchar("revolrmo_project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  syncEnabled: boolean("sync_enabled").default(true).notNull(),
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("jira_mapping_project_key_idx").on(table.jiraProjectKey),
]);

// Project Merge Audit - tracks project merge history
export const projectMergeAudits = pgTable("project_merge_audits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  targetProjectId: varchar("target_project_id").references(() => projects.id).notNull(),
  targetProjectName: varchar("target_project_name").notNull(),
  sourceProjectIds: text("source_project_ids").array().notNull(), // Array of merged project IDs
  sourceProjectNames: text("source_project_names").array().notNull(), // Array of merged project names
  mergedPaymentsCount: integer("merged_payments_count").default(0).notNull(),
  mergedMilestonesCount: integer("merged_milestones_count").default(0).notNull(),
  mergedInvoicesCount: integer("merged_invoices_count").default(0).notNull(),
  mergedUpsellsCount: integer("merged_upsells_count").default(0).notNull(),
  mergedTimesheetsCount: integer("merged_timesheets_count").default(0).notNull(),
  mergedCostsCount: integer("merged_costs_count").default(0).notNull(),
  mergeDetails: jsonb("merge_details"), // Detailed breakdown of what was merged
  mergedBy: varchar("merged_by").references(() => users.id).notNull(),
  mergedAt: timestamp("merged_at").defaultNow().notNull(),
}, (table) => [
  index("merge_audit_target_idx").on(table.targetProjectId),
  index("merge_audit_date_idx").on(table.mergedAt),
]);

// Jira Worklog Sync - tracks synced worklogs to avoid duplicates
export const jiraWorklogSync = pgTable("jira_worklog_sync", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jiraWorklogId: varchar("jira_worklog_id").notNull().unique(), // Jira's worklog ID
  jiraIssueKey: varchar("jira_issue_key").notNull(), // e.g., "PROJ-123"
  jiraProjectKey: varchar("jira_project_key").notNull(),
  jiraAuthorAccountId: varchar("jira_author_account_id"), // Jira user who logged the time
  jiraAuthorDisplayName: varchar("jira_author_display_name"),
  timesheetId: varchar("timesheet_id").references(() => timesheets.id, { onDelete: "set null" }), // Linked RevolRMO timesheet
  hoursLogged: decimal("hours_logged", { precision: 6, scale: 2 }).notNull(),
  worklogDate: timestamp("worklog_date").notNull(),
  description: text("description"),
  syncStatus: varchar("sync_status").$type<"pending" | "synced" | "failed" | "skipped">().default("pending").notNull(),
  syncError: text("sync_error"),
  rawData: jsonb("raw_data"), // Store original Jira payload
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("jira_worklog_issue_idx").on(table.jiraIssueKey),
  index("jira_worklog_project_idx").on(table.jiraProjectKey),
]);

// Signoff status types
export const signoffStatuses = ["pending", "received", "missing", "not_required"] as const;
export type SignoffStatus = typeof signoffStatuses[number];

// Signoff types
export const signoffTypes = ["pandadoc_link", "uploaded_document", "external_link"] as const;
export type SignoffType = typeof signoffTypes[number];

// Project Signoffs - tracks signoffs for each project milestone/phase
export const projectSignoffs = pgTable("project_signoffs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  milestoneId: varchar("milestone_id").references(() => projectMilestones.id, { onDelete: "cascade" }),
  // Phase info (for display when milestone is deleted)
  phaseName: varchar("phase_name").notNull(),
  phaseNumber: integer("phase_number"),
  // Signoff details
  signoffType: varchar("signoff_type").$type<SignoffType>().default("pandadoc_link").notNull(),
  pandadocUrl: text("pandadoc_url"), // URL to PandaDoc document
  externalUrl: text("external_url"), // Any external document link
  documentPath: text("document_path"), // Local/cloud stored document path
  documentName: varchar("document_name"), // Original filename
  // Status tracking
  status: varchar("status").$type<SignoffStatus>().default("pending").notNull(),
  signedDate: timestamp("signed_date"),
  signedBy: varchar("signed_by"), // Customer name/email who signed
  // Reminder tracking
  lastReminderSentAt: timestamp("last_reminder_sent_at"),
  reminderCount: integer("reminder_count").default(0).notNull(),
  // Notes
  notes: text("notes"),
  // Audit
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("signoffs_project_idx").on(table.projectId),
  index("signoffs_milestone_idx").on(table.milestoneId),
  index("signoffs_status_idx").on(table.status),
]);

// ============================================================================
// PODs MODULE
// ============================================================================

// PODs - named teams with a lead, members (PMs), and T1/T2 monthly targets
export const pods = pgTable("pods", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull().unique(),
  description: text("description"),
  leadId: varchar("lead_id").references(() => users.id, { onDelete: "set null" }),
  defaultT1: decimal("default_t1", { precision: 12, scale: 2 }).default("0").notNull(),
  defaultT2: decimal("default_t2", { precision: 12, scale: 2 }).default("0").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// POD target overrides - optional per-month T1/T2 override per POD
export const podTargetOverrides = pgTable("pod_target_overrides", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  podId: varchar("pod_id").references(() => pods.id, { onDelete: "cascade" }).notNull(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  t1: decimal("t1", { precision: 12, scale: 2 }),
  t2: decimal("t2", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("pod_target_override_pod_month_idx").on(table.podId, table.month, table.year),
  unique("pod_target_override_unique").on(table.podId, table.month, table.year),
]);

// POD membership history (effective-dated attribution overrides).
// A PM's "current" POD is still users.podId. A membership row pins a PM's
// received payments to a specific POD for the inclusive month/year range
// [start, end]. A null start means "open start" (all earlier months); a null
// end means "open end" (all later months). When no row covers a given month,
// stats fall back to the PM's current users.podId — so PMs with no rows behave
// exactly as before (no backfill required). Rows are only created on a
// "keep previous" move so historical months stay with the prior POD.
export const podMemberships = pgTable("pod_memberships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  podId: varchar("pod_id").references(() => pods.id, { onDelete: "cascade" }).notNull(),
  startMonth: integer("start_month"),
  startYear: integer("start_year"),
  endMonth: integer("end_month"),
  endYear: integer("end_year"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("pod_membership_user_idx").on(table.userId),
  index("pod_membership_pod_idx").on(table.podId),
]);

// Relations
export const rolesRelations = relations(roles, ({ many }) => ({
  permissions: many(rolePermissions),
  users: many(users),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, {
    fields: [rolePermissions.roleId],
    references: [roles.id],
  }),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  projects: many(projects),
  monthlyPlans: many(monthlyPlans),
  assignedRole: one(roles, {
    fields: [users.roleId],
    references: [roles.id],
  }),
  pod: one(pods, {
    fields: [users.podId],
    references: [pods.id],
  }),
  podsLed: many(pods, { relationName: "pod_lead" }),
}));

export const podsRelations = relations(pods, ({ one, many }) => ({
  lead: one(users, {
    fields: [pods.leadId],
    references: [users.id],
    relationName: "pod_lead",
  }),
  members: many(users),
  overrides: many(podTargetOverrides),
}));

export const podTargetOverridesRelations = relations(podTargetOverrides, ({ one }) => ({
  pod: one(pods, {
    fields: [podTargetOverrides.podId],
    references: [pods.id],
  }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  pm: one(users, {
    fields: [projects.pmId],
    references: [users.id],
  }),
  payments: many(payments),
  milestones: many(projectMilestones),
}));

export const projectMilestonesRelations = relations(projectMilestones, ({ one }) => ({
  project: one(projects, {
    fields: [projectMilestones.projectId],
    references: [projects.id],
  }),
  payment: one(payments, {
    fields: [projectMilestones.paymentId],
    references: [payments.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one, many }) => ({
  project: one(projects, {
    fields: [payments.projectId],
    references: [projects.id],
  }),
  monthlyPlan: one(monthlyPlans, {
    fields: [payments.monthlyPlanId],
    references: [monthlyPlans.id],
  }),
  invoices: many(invoices),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  project: one(projects, {
    fields: [invoices.projectId],
    references: [projects.id],
  }),
  payment: one(payments, {
    fields: [invoices.paymentId],
    references: [payments.id],
  }),
  creator: one(users, {
    fields: [invoices.createdBy],
    references: [users.id],
  }),
  lineItems: many(invoiceLineItems),
}));

export const invoiceLineItemsRelations = relations(invoiceLineItems, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceLineItems.invoiceId],
    references: [invoices.id],
  }),
}));

export const monthlyPlansRelations = relations(monthlyPlans, ({ one, many }) => ({
  creator: one(users, {
    fields: [monthlyPlans.createdBy],
    references: [users.id],
  }),
  payments: many(payments),
}));

export const pmTargetsRelations = relations(pmTargets, ({ one }) => ({
  pm: one(users, {
    fields: [pmTargets.pmId],
    references: [users.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  payment: one(payments, {
    fields: [notifications.paymentId],
    references: [payments.id],
  }),
  creator: one(users, {
    fields: [notifications.createdBy],
    references: [users.id],
  }),
}));

export const upsellsRelations = relations(upsells, ({ one, many }) => ({
  project: one(projects, {
    fields: [upsells.projectId],
    references: [projects.id],
  }),
  convertedPayment: one(payments, {
    fields: [upsells.convertedPaymentId],
    references: [payments.id],
  }),
  creator: one(users, {
    fields: [upsells.createdBy],
    references: [users.id],
  }),
  activities: many(upsellActivities),
}));

export const upsellActivitiesRelations = relations(upsellActivities, ({ one }) => ({
  upsell: one(upsells, {
    fields: [upsellActivities.upsellId],
    references: [upsells.id],
  }),
  creator: one(users, {
    fields: [upsellActivities.createdBy],
    references: [users.id],
  }),
}));

// Cost & Margin module relations
export const timesheetsRelations = relations(timesheets, ({ one }) => ({
  user: one(users, {
    fields: [timesheets.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [timesheets.projectId],
    references: [projects.id],
  }),
  approver: one(users, {
    fields: [timesheets.approvedBy],
    references: [users.id],
  }),
}));

export const projectEstimatedCostsRelations = relations(projectEstimatedCosts, ({ one }) => ({
  project: one(projects, {
    fields: [projectEstimatedCosts.projectId],
    references: [projects.id],
  }),
  creator: one(users, {
    fields: [projectEstimatedCosts.createdBy],
    references: [users.id],
  }),
}));

export const vendorCostsRelations = relations(vendorCosts, ({ one }) => ({
  project: one(projects, {
    fields: [vendorCosts.projectId],
    references: [projects.id],
  }),
  creator: one(users, {
    fields: [vendorCosts.createdBy],
    references: [users.id],
  }),
}));

export const toolCostsRelations = relations(toolCosts, ({ one }) => ({
  project: one(projects, {
    fields: [toolCosts.projectId],
    references: [projects.id],
  }),
  creator: one(users, {
    fields: [toolCosts.createdBy],
    references: [users.id],
  }),
}));

export const projectActualCostsRelations = relations(projectActualCosts, ({ one }) => ({
  project: one(projects, {
    fields: [projectActualCosts.projectId],
    references: [projects.id],
  }),
}));

// Payment Comments - per-payment threaded comments visible to all users
export const paymentComments = pgTable("payment_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  paymentId: varchar("payment_id").references(() => payments.id, { onDelete: "cascade" }).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  comment: text("comment").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("payment_comments_payment_idx").on(table.paymentId),
]);

export const insertPaymentCommentSchema = createInsertSchema(paymentComments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type PaymentComment = typeof paymentComments.$inferSelect;
export type InsertPaymentComment = z.infer<typeof insertPaymentCommentSchema>;
export type PaymentCommentWithUser = PaymentComment & {
  user: Pick<User, "id" | "firstName" | "lastName" | "email" | "profileImageUrl"> | null;
};

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProjectSchema = createInsertSchema(projects, {
  contractStartDate: z.union([z.string(), z.date(), z.null()]).optional().transform(val => {
    if (!val) return null;
    if (val instanceof Date) return val;
    return new Date(val);
  }),
  contractEndDate: z.union([z.string(), z.date(), z.null()]).optional().transform(val => {
    if (!val) return null;
    if (val instanceof Date) return val;
    return new Date(val);
  }),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPaymentSchema = createInsertSchema(payments, {
  dueDate: z.union([z.string(), z.date(), z.null()]).optional().transform(val => {
    if (!val) return null;
    if (val instanceof Date) return val;
    return new Date(val);
  }),
  invoiceDate: z.union([z.string(), z.date(), z.null()]).optional().transform(val => {
    if (!val) return null;
    if (val instanceof Date) return val;
    return new Date(val);
  }),
  receivedDate: z.union([z.string(), z.date(), z.null()]).optional().transform(val => {
    if (!val) return null;
    if (val instanceof Date) return val;
    return new Date(val);
  }),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMilestoneSchema = createInsertSchema(projectMilestones, {
  dueDate: z.union([z.string(), z.date(), z.null()]).optional().transform(val => {
    if (!val) return null;
    if (val instanceof Date) return val;
    return new Date(val);
  }),
  invoicedDate: z.union([z.string(), z.date(), z.null()]).optional().transform(val => {
    if (!val) return null;
    if (val instanceof Date) return val;
    return new Date(val);
  }),
  paidDate: z.union([z.string(), z.date(), z.null()]).optional().transform(val => {
    if (!val) return null;
    if (val instanceof Date) return val;
    return new Date(val);
  }),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateMilestoneSchema = insertMilestoneSchema.partial();

export const insertChangeRequestSchema = createInsertSchema(changeRequests, {
  status: z.enum(["open", "won", "lost"]).default("open"),
  dateLocked: z.union([z.string(), z.date(), z.null()]).optional().transform(val => {
    if (!val) return null;
    if (val instanceof Date) return val;
    return new Date(val);
  }),
  // Optional PandaDoc link: when provided, must be a valid http(s) URL (blocks
  // unsafe schemes like javascript: that could be injected into <a href>).
  pandadocLink: z
    .string()
    .trim()
    .url("PandaDoc link must be a valid URL")
    .refine((v) => /^https?:\/\//i.test(v), "PandaDoc link must start with http:// or https://")
    .nullish()
    .or(z.literal("").transform(() => null)),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateChangeRequestSchema = insertChangeRequestSchema.partial();

export const insertCrTagSchema = createInsertSchema(crTags, {
  name: z.string().trim().min(1, "Tag name is required").max(40, "Tag name is too long"),
}).omit({
  id: true,
  createdAt: true,
});

export const insertCrInstallmentSchema = createInsertSchema(crInstallments, {
  dueDate: z.union([z.string(), z.date(), z.null()]).optional().transform(val => {
    if (!val) return null;
    if (val instanceof Date) return val;
    return new Date(val);
  }),
  invoicedDate: z.union([z.string(), z.date(), z.null()]).optional().transform(val => {
    if (!val) return null;
    if (val instanceof Date) return val;
    return new Date(val);
  }),
  paidDate: z.union([z.string(), z.date(), z.null()]).optional().transform(val => {
    if (!val) return null;
    if (val instanceof Date) return val;
    return new Date(val);
  }),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateCrInstallmentSchema = insertCrInstallmentSchema.partial();

export const insertProjectDriveFolderSchema = createInsertSchema(projectDriveFolders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMonthlyPlanSchema = createInsertSchema(monthlyPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPmTargetSchema = createInsertSchema(pmTargets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// POD schemas
export const insertPodSchema = createInsertSchema(pods, {
  name: z.string().trim().min(1, "POD name is required"),
  defaultT1: z.union([z.string(), z.number()]).transform(v => v.toString()),
  defaultT2: z.union([z.string(), z.number()]).transform(v => v.toString()),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updatePodSchema = insertPodSchema.partial();

export const insertPodTargetOverrideSchema = createInsertSchema(podTargetOverrides, {
  t1: z.union([z.string(), z.number(), z.null()]).optional().transform(v => v == null ? null : v.toString()),
  t2: z.union([z.string(), z.number(), z.null()]).optional().transform(v => v == null ? null : v.toString()),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOtpResetSchema = createInsertSchema(otpResets).omit({
  id: true,
  createdAt: true,
});

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({
  id: true,
  createdAt: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export const insertNotificationResponseSchema = createInsertSchema(notificationResponses).omit({
  id: true,
  createdAt: true,
});

export const insertAppSettingsSchema = createInsertSchema(appSettings).omit({
  id: true,
  updatedAt: true,
});

export const updateAppSettingsSchema = insertAppSettingsSchema.partial();

export const insertSMTPSettingsSchema = createInsertSchema(smtpSettings).omit({
  id: true,
  updatedAt: true,
});

export const updateSMTPSettingsSchema = insertSMTPSettingsSchema.partial();

export const insertRegionBankingDetailsSchema = createInsertSchema(regionBankingDetails).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateRegionBankingDetailsSchema = insertRegionBankingDetailsSchema.partial();

export const insertInvoiceSchema = createInsertSchema(invoices, {
  issueDate: z.union([z.string(), z.date()]).transform(val => {
    if (val instanceof Date) return val;
    return new Date(val);
  }),
  dueDate: z.union([z.string(), z.date(), z.null()]).optional().transform(val => {
    if (!val) return null;
    if (val instanceof Date) return val;
    return new Date(val);
  }),
  paidDate: z.union([z.string(), z.date(), z.null()]).optional().transform(val => {
    if (!val) return null;
    if (val instanceof Date) return val;
    return new Date(val);
  }),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateInvoiceSchema = insertInvoiceSchema.partial();

export const insertInvoiceLineItemSchema = createInsertSchema(invoiceLineItems).omit({
  id: true,
  createdAt: true,
});

export const insertUpsellSchema = createInsertSchema(upsells, {
  expectedCloseDate: z.union([z.string(), z.date(), z.null()]).optional().transform(val => {
    if (!val) return null;
    if (val instanceof Date) return val;
    return new Date(val);
  }),
}).omit({
  id: true,
  convertedPaymentId: true,
  convertedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const updateUpsellSchema = insertUpsellSchema.partial();

export const insertUpsellActivitySchema = createInsertSchema(upsellActivities, {
  activityDate: z.union([z.string(), z.date()]).transform(val => {
    if (val instanceof Date) return val;
    return new Date(val);
  }),
}).omit({
  id: true,
  createdAt: true,
});

export const insertUpsellTypeSettingSchema = createInsertSchema(upsellTypeSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateUpsellTypeSettingSchema = insertUpsellTypeSettingSchema.partial();

// Cost & Margin module insert schemas
export const insertTimesheetSchema = createInsertSchema(timesheets, {
  date: z.union([z.string(), z.date()]).transform(val => {
    if (val instanceof Date) return val;
    return new Date(val);
  }),
}).omit({
  id: true,
  approvedBy: true,
  approvedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const updateTimesheetSchema = insertTimesheetSchema.partial();

export const insertProjectEstimatedCostSchema = createInsertSchema(projectEstimatedCosts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateProjectEstimatedCostSchema = insertProjectEstimatedCostSchema.partial();

export const insertVendorCostSchema = createInsertSchema(vendorCosts, {
  invoiceDate: z.union([z.string(), z.date(), z.null()]).optional().transform(val => {
    if (!val) return null;
    if (val instanceof Date) return val;
    return new Date(val);
  }),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateVendorCostSchema = insertVendorCostSchema.partial();

export const insertToolCostSchema = createInsertSchema(toolCosts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateToolCostSchema = insertToolCostSchema.partial();

export const insertProjectActualCostSchema = createInsertSchema(projectActualCosts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateProjectActualCostSchema = insertProjectActualCostSchema.partial();

export const insertMarginSettingsSchema = createInsertSchema(marginSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateMarginSettingsSchema = insertMarginSettingsSchema.partial();

// Cost & Margin Global Settings schemas
export const insertCostMarginGlobalSettingsSchema = createInsertSchema(costMarginGlobalSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateCostMarginGlobalSettingsSchema = insertCostMarginGlobalSettingsSchema.partial();

// Jira Integration schemas
export const insertJiraIntegrationSettingsSchema = createInsertSchema(jiraIntegrationSettings).omit({
  id: true,
  lastSyncAt: true,
  lastSyncStatus: true,
  lastSyncError: true,
  createdAt: true,
  updatedAt: true,
});

export const updateJiraIntegrationSettingsSchema = insertJiraIntegrationSettingsSchema.partial();

export const insertJiraProjectMappingSchema = createInsertSchema(jiraProjectMappings).omit({
  id: true,
  lastSyncAt: true,
  createdAt: true,
  updatedAt: true,
});

export const updateJiraProjectMappingSchema = insertJiraProjectMappingSchema.partial();

export const insertJiraWorklogSyncSchema = createInsertSchema(jiraWorklogSync).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateJiraWorklogSyncSchema = insertJiraWorklogSyncSchema.partial();

// Project Merge Audit schemas
export const insertProjectMergeAuditSchema = createInsertSchema(projectMergeAudits).omit({
  id: true,
  mergedAt: true,
});

// Signoff schemas
export const insertSignoffSchema = createInsertSchema(projectSignoffs, {
  signedDate: z.union([z.string(), z.date(), z.null()]).optional().transform(val => {
    if (!val) return null;
    if (val instanceof Date) return val;
    return new Date(val);
  }),
}).omit({
  id: true,
  lastReminderSentAt: true,
  reminderCount: true,
  createdAt: true,
  updatedAt: true,
});

export const updateSignoffSchema = insertSignoffSchema.partial();

// Resource schemas
export const insertResourceSchema = createInsertSchema(resources).omit({
  id: true,
  effectiveHourlyRate: true, // Computed on backend
  createdAt: true,
  updatedAt: true,
});

export const updateResourceSchema = insertResourceSchema.partial();

// Resource Rate Settings schemas
export const insertResourceRateSettingsSchema = createInsertSchema(resourceRateSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateResourceRateSettingsSchema = insertResourceRateSettingsSchema.partial();

// Role schemas
export const insertRoleSchema = createInsertSchema(roles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateRoleSchema = insertRoleSchema.partial();

export const insertRolePermissionSchema = createInsertSchema(rolePermissions).omit({
  id: true,
  createdAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpsertUser = typeof users.$inferInsert;

export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;

export type ProjectMilestone = typeof projectMilestones.$inferSelect;
export type InsertMilestone = z.infer<typeof insertMilestoneSchema>;
export type UpdateMilestone = z.infer<typeof updateMilestoneSchema>;

export type ChangeRequest = typeof changeRequests.$inferSelect;
export type InsertChangeRequest = z.infer<typeof insertChangeRequestSchema>;
export type UpdateChangeRequest = z.infer<typeof updateChangeRequestSchema>;
export type ChangeRequestStatus = "open" | "won" | "lost";

export type CrInstallment = typeof crInstallments.$inferSelect;
export type InsertCrInstallment = z.infer<typeof insertCrInstallmentSchema>;
export type UpdateCrInstallment = z.infer<typeof updateCrInstallmentSchema>;

export type ProjectDriveFolder = typeof projectDriveFolders.$inferSelect;
export type InsertProjectDriveFolder = z.infer<typeof insertProjectDriveFolderSchema>;

export type MonthlyPlan = typeof monthlyPlans.$inferSelect;
export type InsertMonthlyPlan = z.infer<typeof insertMonthlyPlanSchema>;

export type PmTarget = typeof pmTargets.$inferSelect;
export type InsertPmTarget = z.infer<typeof insertPmTargetSchema>;

export type Pod = typeof pods.$inferSelect;
export type InsertPod = z.infer<typeof insertPodSchema>;
export type UpdatePod = z.infer<typeof updatePodSchema>;

export type PodTargetOverride = typeof podTargetOverrides.$inferSelect;
export type InsertPodTargetOverride = z.infer<typeof insertPodTargetOverrideSchema>;

export const insertPodMembershipSchema = createInsertSchema(podMemberships).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type PodMembership = typeof podMemberships.$inferSelect;
export type InsertPodMembership = z.infer<typeof insertPodMembershipSchema>;

// Strategy for how to attribute a moved PM's historical data when they are
// reassigned from one POD to another.
// - "move_all": clear the PM's overrides so their full history follows the new POD.
// - "keep_previous": pin months before `effMonth/effYear` to the old POD; the
//   new POD only counts data from the effective month forward.
export type PodMoveStrategy = {
  mode: "move_all" | "keep_previous";
  effMonth?: number;
  effYear?: number;
};

// PM-level breakdown inside a POD
export type PodPmStats = {
  pm: User;
  recurringReceived: number;
  upsellReceived: number;
  totalReceived: number;
  paymentCount: number;
};

// Effective target for a given period (resolved from defaults + overrides)
export type PodStats = {
  pod: Pod;
  lead: User | null;
  members: User[];
  // Period this stats covers (single month or range start/end)
  period: { startMonth: number; startYear: number; endMonth: number; endYear: number };
  t1: number; // Sum of effective T1 across months in range
  t2: number; // Sum of effective T2 across months in range
  recurringReceived: number;
  upsellReceived: number;
  totalReceived: number;
  achievedT1Percent: number; // 0 when t1 == 0
  achievedT2Percent: number; // 0 when t2 == 0
  remainingT1: number; // max(t1 - totalReceived, 0)
  remainingT2: number; // max(t2 - totalReceived, 0)
  pmStats: PodPmStats[];
};

export type OtpReset = typeof otpResets.$inferSelect;
export type InsertOtpReset = z.infer<typeof insertOtpResetSchema>;

export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;

export type AppSettings = typeof appSettings.$inferSelect;
export type InsertAppSettings = z.infer<typeof insertAppSettingsSchema>;
export type UpdateAppSettings = z.infer<typeof updateAppSettingsSchema>;

export type SMTPSettings = typeof smtpSettings.$inferSelect;
export type InsertSMTPSettings = z.infer<typeof insertSMTPSettingsSchema>;
export type UpdateSMTPSettings = z.infer<typeof updateSMTPSettingsSchema>;

export type RegionBankingDetails = typeof regionBankingDetails.$inferSelect;
export type InsertRegionBankingDetails = z.infer<typeof insertRegionBankingDetailsSchema>;
export type UpdateRegionBankingDetails = z.infer<typeof updateRegionBankingDetailsSchema>;

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type UpdateInvoice = z.infer<typeof updateInvoiceSchema>;

export type InvoiceLineItem = typeof invoiceLineItems.$inferSelect;
export type InsertInvoiceLineItem = z.infer<typeof insertInvoiceLineItemSchema>;

export type Upsell = typeof upsells.$inferSelect;
export type InsertUpsell = z.infer<typeof insertUpsellSchema>;
export type UpdateUpsell = z.infer<typeof updateUpsellSchema>;

export type UpsellActivity = typeof upsellActivities.$inferSelect;
export type InsertUpsellActivity = z.infer<typeof insertUpsellActivitySchema>;

export type UpsellTypeSetting = typeof upsellTypeSettings.$inferSelect;
export type InsertUpsellTypeSetting = z.infer<typeof insertUpsellTypeSettingSchema>;
export type UpdateUpsellTypeSetting = z.infer<typeof updateUpsellTypeSettingSchema>;

export type DataImport = typeof dataImports.$inferSelect;
export const insertDataImportSchema = createInsertSchema(dataImports).omit({
  id: true,
  createdAt: true,
});
export type InsertDataImport = z.infer<typeof insertDataImportSchema>;

// Cost & Margin module types
export type Timesheet = typeof timesheets.$inferSelect;
export type InsertTimesheet = z.infer<typeof insertTimesheetSchema>;
export type UpdateTimesheet = z.infer<typeof updateTimesheetSchema>;

export type ProjectEstimatedCost = typeof projectEstimatedCosts.$inferSelect;
export type InsertProjectEstimatedCost = z.infer<typeof insertProjectEstimatedCostSchema>;
export type UpdateProjectEstimatedCost = z.infer<typeof updateProjectEstimatedCostSchema>;

export type VendorCost = typeof vendorCosts.$inferSelect;
export type InsertVendorCost = z.infer<typeof insertVendorCostSchema>;
export type UpdateVendorCost = z.infer<typeof updateVendorCostSchema>;

export type ToolCost = typeof toolCosts.$inferSelect;
export type InsertToolCost = z.infer<typeof insertToolCostSchema>;
export type UpdateToolCost = z.infer<typeof updateToolCostSchema>;

export type ProjectActualCost = typeof projectActualCosts.$inferSelect;
export type InsertProjectActualCost = z.infer<typeof insertProjectActualCostSchema>;
export type UpdateProjectActualCost = z.infer<typeof updateProjectActualCostSchema>;

export type MarginSettings = typeof marginSettings.$inferSelect;
export type InsertMarginSettings = z.infer<typeof insertMarginSettingsSchema>;
export type UpdateMarginSettings = z.infer<typeof updateMarginSettingsSchema>;

export type CostMarginGlobalSettings = typeof costMarginGlobalSettings.$inferSelect;
export type InsertCostMarginGlobalSettings = z.infer<typeof insertCostMarginGlobalSettingsSchema>;
export type UpdateCostMarginGlobalSettings = z.infer<typeof updateCostMarginGlobalSettingsSchema>;

export type JiraIntegrationSettings = typeof jiraIntegrationSettings.$inferSelect;
export type InsertJiraIntegrationSettings = z.infer<typeof insertJiraIntegrationSettingsSchema>;
export type UpdateJiraIntegrationSettings = z.infer<typeof updateJiraIntegrationSettingsSchema>;

export type JiraProjectMapping = typeof jiraProjectMappings.$inferSelect;
export type InsertJiraProjectMapping = z.infer<typeof insertJiraProjectMappingSchema>;
export type UpdateJiraProjectMapping = z.infer<typeof updateJiraProjectMappingSchema>;

export type JiraWorklogSync = typeof jiraWorklogSync.$inferSelect;
export type InsertJiraWorklogSync = z.infer<typeof insertJiraWorklogSyncSchema>;
export type UpdateJiraWorklogSync = z.infer<typeof updateJiraWorklogSyncSchema>;

export type ProjectMergeAudit = typeof projectMergeAudits.$inferSelect;
export type InsertProjectMergeAudit = z.infer<typeof insertProjectMergeAuditSchema>;

export type ProjectSignoff = typeof projectSignoffs.$inferSelect;
export type InsertSignoff = z.infer<typeof insertSignoffSchema>;
export type UpdateSignoff = z.infer<typeof updateSignoffSchema>;

export type Resource = typeof resources.$inferSelect;
export type InsertResource = z.infer<typeof insertResourceSchema>;
export type UpdateResource = z.infer<typeof updateResourceSchema>;

export type ResourceRateSettings = typeof resourceRateSettings.$inferSelect;
export type InsertResourceRateSettings = z.infer<typeof insertResourceRateSettingsSchema>;
export type UpdateResourceRateSettings = z.infer<typeof updateResourceRateSettingsSchema>;

// Resource with computed data
export type ResourceWithUser = Resource & {
  user: User | null;
};

// Timesheet with related data
export type TimesheetWithDetails = Timesheet & {
  user: User | null;
  project: Project | null;
  approver: User | null;
};

// Project cost and margin summary for the executive view
export type ProjectCostMarginSummary = {
  projectId: string;
  projectName: string;
  clientName: string;
  pmName: string;
  month: number;
  year: number;
  cashReceived: number;
  estimatedCost: number;
  actualCost: number;
  costVariance: number;
  grossMarginPercent: number | null; // null when cash received = 0
  marginBucket: MarginBucket | 'not_applicable';
  costSource: CostSource;
};

// Executive summary for CEO/CFO
export type CostMarginExecutiveSummary = {
  period: { startMonth: number; startYear: number; endMonth: number; endYear: number };
  totalCashReceived: number;
  totalActualCost: number;
  overallGrossMarginPercent: number | null;
  projectCounts: {
    profit: number;
    breakeven: number;
    loss: number;
    notApplicable: number;
  };
  projects: ProjectCostMarginSummary[];
};

export type Role = typeof roles.$inferSelect;
export type InsertRole = z.infer<typeof insertRoleSchema>;
export type UpdateRole = z.infer<typeof updateRoleSchema>;

export type RolePermission = typeof rolePermissions.$inferSelect;
export type InsertRolePermission = z.infer<typeof insertRolePermissionSchema>;

export type RoleWithPermissions = Role & {
  permissions: RolePermission[];
};

export type UserWithRole = User & {
  assignedRole: Role | null;
};

// Default roles to seed
export const defaultRoles: { name: string; displayName: string; description: string; isSystem: boolean; permissions: SystemPermission[] }[] = [
  {
    name: "administrator",
    displayName: "Administrator",
    description: "Full system access with all permissions",
    isSystem: true,
    permissions: [...systemPermissions], // All permissions
  },
  {
    name: "c_suite",
    displayName: "C-Suite",
    description: "Executive access with view-only permissions for strategic oversight",
    isSystem: true,
    permissions: ["view_dashboard", "view_payments", "view_projects", "view_planning", "view_upsells", "view_invoices", "view_forecasting", "view_analytics", "view_cost_margin", "view_timesheets", "view_reports", "export_reports", "view_users", "view_settings", "view_notifications", "view_signoffs", "view_kpis", "view_pods"],
  },
  {
    name: "finance",
    displayName: "Finance Department",
    description: "Full access to payments, invoices, reports, and banking settings",
    isSystem: true,
    permissions: ["view_dashboard", "view_payments", "create_payments", "edit_payments", "delete_payments", "view_projects", "view_planning", "create_planning", "edit_planning", "view_upsells", "view_invoices", "create_invoices", "cancel_invoices", "record_payment_invoices", "delete_invoices", "view_timesheets", "create_timesheets", "view_cost_margin", "view_analytics", "view_reports", "export_reports", "view_settings", "edit_settings", "view_notifications", "view_signoffs", "create_signoffs", "edit_signoffs", "delete_signoffs", "send_signoff_reminders", "view_kpis", "manage_kpis"],
  },
  {
    name: "business_development",
    displayName: "Business Development",
    description: "Full access to projects, upsells, and client management",
    isSystem: true,
    permissions: ["view_dashboard", "view_payments", "view_projects", "create_projects", "edit_projects", "view_planning", "view_upsells", "create_upsells", "edit_upsells", "delete_upsells", "view_analytics", "view_reports", "view_notifications", "view_signoffs", "view_kpis"],
  },
  {
    name: "production",
    displayName: "Production Department",
    description: "Access to projects and planning for operational management",
    isSystem: true,
    permissions: ["view_dashboard", "view_payments", "view_projects", "view_planning", "view_upsells", "view_analytics", "view_notifications", "view_signoffs", "view_kpis"],
  },
  {
    name: "project_manager",
    displayName: "Project Manager",
    description: "Project managers with limited access to assigned projects",
    isSystem: true,
    permissions: ["view_dashboard", "view_payments", "view_projects", "edit_projects", "view_planning", "view_upsells", "view_notifications", "view_signoffs", "create_signoffs", "edit_signoffs", "view_kpis", "view_pods"],
  },
  {
    name: "tr_emp",
    displayName: "TR EMP",
    description: "Default role for new TekRevol employees with no permissions",
    isSystem: true,
    permissions: [], // No permissions - admin must assign appropriate role
  },
];

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

export type NotificationResponse = typeof notificationResponses.$inferSelect;
export type InsertNotificationResponse = z.infer<typeof insertNotificationResponseSchema>;

export type NotificationResponseWithDetails = NotificationResponse & {
  responder?: User | null;
  notification?: Notification | null;
};

export type NotificationWithDetails = Notification & {
  payment?: Payment & { project?: Project } | null;
  responses?: NotificationResponse[];
};

export type ActivityLogWithUser = ActivityLog & {
  user: User | null;
};

// Extended types for frontend
export type PaymentWithProject = Payment & {
  project: Project;
  pm?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
    email: string | null;
  } | null;
};

export type ProjectWithPM = Project & {
  pm: User | null;
  totalReceived: string;
  upsellReceived: string;
};

export type MilestoneWithPayment = ProjectMilestone & {
  payment: Payment | null;
  payments: Payment[];
};

export type ProjectWithMilestones = Project & {
  pm: User | null;
  milestones: MilestoneWithPayment[];
};

export type CrInstallmentWithPayment = CrInstallment & {
  payment: Payment | null;
};

export type CrTag = typeof crTags.$inferSelect;
export type InsertCrTag = z.infer<typeof insertCrTagSchema>;

export type ChangeRequestWithInstallments = ChangeRequest & {
  installments: CrInstallmentWithPayment[];
  tags: CrTag[];
};

// A locked Change Request surfaced as a "sold upsell" (Task #111). Enriched with
// project, PM, creator, installments and rolled-up amounts for the unified Upsell
// module. Read directly from change_requests (single source of truth).
export type SoldUpsell = ChangeRequest & {
  installments: CrInstallmentWithPayment[];
  project: (Project & { pm: User | null }) | null;
  creator: User | null;
  receivedAmount: number;
  expectedAmount: number;
  tags: CrTag[];
};

export type UpsellActivityWithUser = UpsellActivity & {
  creator: User | null;
};

export type UpsellWithDetails = Upsell & {
  project: Project & { pm: User | null };
  creator: User | null;
  activities: UpsellActivityWithUser[];
};

export type InvoiceWithDetails = Invoice & {
  project: Project | null;
  payment: Payment | null;
  creator: User | null;
  lineItems: InvoiceLineItem[];
};

export type InvoiceListItem = Invoice & {
  projectName: string | null;
  creatorName: string | null;
};

export type PmTargetWithUser = PmTarget & {
  pm: User;
  actualReceived: number;
  upsellReceived: number;
  paymentCount: number;
};

export type PmLeaders = {
  topPerformer: { pm: User; progress: number; actualReceived: number; targetAmount: number } | null;
  topValuePerformer: { pm: User; totalCashIn: number } | null;
  topUpseller: { pm: User; upsellAmount: number } | null;
};

export type DashboardStats = {
  totalTarget: number;
  totalReceived: number;
  totalRemaining: number;
  totalUpsells: number;
  regionBreakdown: {
    region: Region;
    target: number;
    received: number;
    upsells: number;
  }[];
  pmStats: {
    pmId: string;
    pmName: string;
    profileImageUrl: string | null;
    target: number;
    received: number;
    upsells: number;
  }[];
};

export type ReportData = {
  type: "daily" | "weekly" | "monthly" | "yearly";
  receivedToday?: number;
  pending?: number;
  invoiced?: number;
  summary: {
    totalReceived: number;
    totalPending: number;
    totalInvoiced: number;
    byRegion: { region: Region; amount: number }[];
    byPM: { pmId: string; pmName: string; amount: number }[];
  };
};

// Analytics types
export type PaymentTrendPoint = {
  month: number;
  year: number;
  monthLabel: string;
  received: number;
  target: number;
  upsells: number;
};

export type PMPerformanceData = {
  pmId: string;
  pmName: string;
  target: number;
  received: number;
  upsells: number;
  progressPercent: number;
  paymentCount: number;
  avgPaymentSize: number;
};

export type StatusDistribution = {
  status: PaymentStatus;
  count: number;
  amount: number;
};

export type RegionTrendPoint = {
  month: number;
  year: number;
  monthLabel: string;
  CA: number;
  TX: number;
  AE: number;
};

export type AnalyticsData = {
  paymentTrends: PaymentTrendPoint[];
  regionTrends: RegionTrendPoint[];
  pmPerformance: PMPerformanceData[];
  statusDistribution: StatusDistribution[];
  yearOverYear: {
    currentYear: number;
    previousYear: number;
    currentYearTotal: number;
    previousYearTotal: number;
    growthPercent: number;
  };
};

// Monthly Planning types
export type PaymentWithDetails = Payment & {
  project: Project & {
    pm: User | null;
  };
};

export type MonthlyPlanWithPayments = MonthlyPlan & {
  payments: PaymentWithDetails[];
  creator: User | null;
};

export type MonthlyPlanSummary = {
  id: string;
  month: number;
  year: number;
  monthlyTarget: number;
  totalRecurringTarget: number;
  totalReceived: number;
  totalRemaining: number;
  totalUpsells: number;
  paymentCount: number;
  notes: string | null;
  createdBy: string | null;
  creatorName: string | null;
  createdAt: Date | null;
};

// System Health Monitoring - API Metrics
export const apiMetrics = pgTable("api_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  endpoint: varchar("endpoint", { length: 255 }).notNull(),
  method: varchar("method", { length: 10 }).notNull(),
  statusCode: integer("status_code").notNull(),
  responseTimeMs: integer("response_time_ms").notNull(),
  errorMessage: text("error_message"),
  userId: varchar("user_id").references(() => users.id),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => [
  index("api_metrics_endpoint_idx").on(table.endpoint),
  index("api_metrics_timestamp_idx").on(table.timestamp),
  index("api_metrics_status_code_idx").on(table.statusCode),
]);

export const insertApiMetricsSchema = createInsertSchema(apiMetrics);
export type ApiMetric = typeof apiMetrics.$inferSelect;
export type InsertApiMetric = z.infer<typeof insertApiMetricsSchema>;

// Aggregated metrics summary for dashboard
export type ApiMetricsSummary = {
  totalRequests: number;
  avgResponseTime: number;
  errorCount: number;
  errorRate: number;
  slowEndpoints: {
    endpoint: string;
    avgResponseTime: number;
    requestCount: number;
  }[];
  errorEndpoints: {
    endpoint: string;
    errorCount: number;
    lastError: string | null;
  }[];
  recentMetrics: ApiMetric[];
};

// Aggregated cyber-security stats for the Security dashboard
export type SecurityDashboard = {
  windowHours: number;
  totalRequests: number;
  rateLimitHits: number; // HTTP 429 responses (rate-limit blocks)
  unauthorizedCount: number; // HTTP 401
  forbiddenCount: number; // HTTP 403
  clientErrors: number; // 4xx
  serverErrors: number; // 5xx
  errorRate: number; // percentage
  authFailureEndpoints: {
    endpoint: string;
    count: number;
    lastError: string | null;
  }[];
  activeSessions: number;
  totalUsers: number;
  blockedUsers: {
    id: string;
    name: string;
    email: string | null;
  }[];
  recentSecurityEvents: {
    id: string;
    action: string;
    entity: string;
    details: string | null;
    ipAddress: string | null;
    createdAt: string | null;
    userName: string | null;
  }[];
  rateLimitConfig: {
    auth: { windowMinutes: number; max: number; paths: string[] };
    api: { windowMinutes: number; max: number; paths: string[] };
  };
  securityHeaders: {
    name: string;
    enabled: boolean;
    detail: string;
  }[];
};

// QuickBooks Integration - OAuth Credentials
export const quickbooksSettings = pgTable("quickbooks_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  isConnected: boolean("is_connected").default(false).notNull(),
  realmId: varchar("realm_id"), // QuickBooks Company ID
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  webhookVerifierToken: varchar("webhook_verifier_token"),
  lastSyncAt: timestamp("last_sync_at"),
  syncEnabled: boolean("sync_enabled").default(true).notNull(),
  autoSyncInvoices: boolean("auto_sync_invoices").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertQuickbooksSettingsSchema = createInsertSchema(quickbooksSettings);
export type QuickbooksSettings = typeof quickbooksSettings.$inferSelect;
export type InsertQuickbooksSettings = z.infer<typeof insertQuickbooksSettingsSchema>;

// QuickBooks Customer Mapping - Maps RevolRMO projects/clients to QuickBooks customers
export const quickbooksCustomerMapping = pgTable("quickbooks_customer_mapping", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: "cascade" }),
  clientName: varchar("client_name").notNull(),
  quickbooksCustomerId: varchar("quickbooks_customer_id").notNull(),
  quickbooksCustomerName: varchar("quickbooks_customer_name"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("qb_customer_mapping_project_idx").on(table.projectId),
  index("qb_customer_mapping_qb_customer_idx").on(table.quickbooksCustomerId),
]);

export const insertQuickbooksCustomerMappingSchema = createInsertSchema(quickbooksCustomerMapping);
export type QuickbooksCustomerMapping = typeof quickbooksCustomerMapping.$inferSelect;
export type InsertQuickbooksCustomerMapping = z.infer<typeof insertQuickbooksCustomerMappingSchema>;

// QuickBooks Invoice Sync - Tracks synced invoices between systems
export const quickbooksInvoiceSync = pgTable("quickbooks_invoice_sync", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").references(() => invoices.id, { onDelete: "cascade" }).notNull(),
  quickbooksInvoiceId: varchar("quickbooks_invoice_id").notNull(),
  quickbooksDocNumber: varchar("quickbooks_doc_number"),
  syncStatus: varchar("sync_status").$type<"synced" | "pending" | "error">().default("pending").notNull(),
  lastSyncAt: timestamp("last_sync_at").defaultNow(),
  lastError: text("last_error"),
  quickbooksData: jsonb("quickbooks_data"), // Store full QB invoice data for reference
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("qb_invoice_sync_invoice_idx").on(table.invoiceId),
  index("qb_invoice_sync_qb_invoice_idx").on(table.quickbooksInvoiceId),
  index("qb_invoice_sync_status_idx").on(table.syncStatus),
]);

export const insertQuickbooksInvoiceSyncSchema = createInsertSchema(quickbooksInvoiceSync);
export type QuickbooksInvoiceSync = typeof quickbooksInvoiceSync.$inferSelect;
export type InsertQuickbooksInvoiceSync = z.infer<typeof insertQuickbooksInvoiceSyncSchema>;

// QuickBooks Payment Sync - Tracks payments received via QuickBooks
export const quickbooksPaymentSync = pgTable("quickbooks_payment_sync", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").references(() => invoices.id, { onDelete: "cascade" }),
  quickbooksPaymentId: varchar("quickbooks_payment_id").notNull().unique(),
  quickbooksInvoiceId: varchar("quickbooks_invoice_id"),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  paymentDate: timestamp("payment_date"),
  paymentMethod: varchar("payment_method"),
  processed: boolean("processed").default(false).notNull(), // Whether we've updated local records
  processedAt: timestamp("processed_at"),
  rawData: jsonb("raw_data"), // Full webhook payload for debugging
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("qb_payment_sync_invoice_idx").on(table.invoiceId),
  index("qb_payment_sync_qb_payment_idx").on(table.quickbooksPaymentId),
  index("qb_payment_sync_processed_idx").on(table.processed),
]);

export const insertQuickbooksPaymentSyncSchema = createInsertSchema(quickbooksPaymentSync);
export type QuickbooksPaymentSync = typeof quickbooksPaymentSync.$inferSelect;
export type InsertQuickbooksPaymentSync = z.infer<typeof insertQuickbooksPaymentSyncSchema>;

// QuickBooks Webhook Events - Log all incoming webhook events
export const quickbooksWebhookEvents = pgTable("quickbooks_webhook_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventType: varchar("event_type").notNull(), // "Payment", "Invoice", etc.
  operation: varchar("operation").notNull(), // "Create", "Update", "Delete"
  entityId: varchar("entity_id").notNull(),
  realmId: varchar("realm_id").notNull(),
  processed: boolean("processed").default(false).notNull(),
  processedAt: timestamp("processed_at"),
  error: text("error"),
  rawPayload: jsonb("raw_payload"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("qb_webhook_events_type_idx").on(table.eventType),
  index("qb_webhook_events_processed_idx").on(table.processed),
  index("qb_webhook_events_created_idx").on(table.createdAt),
]);

// ============================================================================
// PMO KPI MODULE
// ============================================================================

// KPI value types
export const kpiValueTypes = ["number", "rating", "boolean", "percentage"] as const;
export type KpiValueType = (typeof kpiValueTypes)[number];

// Auto-calculation types for KPI parameters linked to system data
export const kpiAutoCalcTypes = ["target_achievement"] as const;
export type KpiAutoCalcType = (typeof kpiAutoCalcTypes)[number];

// KPI Parameters table - defines KPI parameter definitions
export const kpiParameters = pgTable("kpi_parameters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: text("description"),
  valueType: varchar("value_type").$type<KpiValueType>().notNull(),
  weightage: decimal("weightage", { precision: 5, scale: 2 }).notNull(),
  isInverse: boolean("is_inverse").default(false),
  isAutoCalculated: boolean("is_auto_calculated").default(false),
  autoCalcType: varchar("auto_calc_type").$type<KpiAutoCalcType>(),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertKpiParameterSchema = createInsertSchema(kpiParameters).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertKpiParameter = z.infer<typeof insertKpiParameterSchema>;
export type KpiParameter = typeof kpiParameters.$inferSelect;

// KPI Levels table - PM experience levels
export const kpiLevels = pgTable("kpi_levels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull().unique(),
  displayName: varchar("display_name").notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertKpiLevelSchema = createInsertSchema(kpiLevels).omit({ id: true, createdAt: true });
export type InsertKpiLevel = z.infer<typeof insertKpiLevelSchema>;
export type KpiLevel = typeof kpiLevels.$inferSelect;

// KPI Level Scores table - score mapping per parameter/level/value
export const kpiLevelScores = pgTable("kpi_level_scores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  parameterId: varchar("parameter_id").references(() => kpiParameters.id, { onDelete: "cascade" }).notNull(),
  levelId: varchar("level_id").references(() => kpiLevels.id, { onDelete: "cascade" }).notNull(),
  value: varchar("value").notNull(),
  scorePercentage: decimal("score_percentage", { precision: 5, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("kpi_level_scores_param_level_value_idx").on(table.parameterId, table.levelId, table.value),
]);

export const insertKpiLevelScoreSchema = createInsertSchema(kpiLevelScores).omit({ id: true, createdAt: true });
export type InsertKpiLevelScore = z.infer<typeof insertKpiLevelScoreSchema>;
export type KpiLevelScore = typeof kpiLevelScores.$inferSelect;

// KPI Monthly Reviews table - monthly performance scores for each PM
export const kpiMonthlyReviews = pgTable("kpi_monthly_reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pmId: varchar("pm_id").references(() => users.id).notNull(),
  reviewerId: varchar("reviewer_id").references(() => users.id).notNull(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  parameterId: varchar("parameter_id").references(() => kpiParameters.id, { onDelete: "cascade" }).notNull(),
  value: varchar("value").notNull(),
  score: decimal("score", { precision: 5, scale: 2 }),
  notes: text("notes"),
  levelIdSnapshot: varchar("level_id_snapshot"), // PM's kpiLevelId at time of review entry; used for historical score isolation
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("kpi_monthly_reviews_pm_month_year_idx").on(table.pmId, table.month, table.year),
  index("kpi_monthly_reviews_month_year_idx").on(table.month, table.year),
]);

export const insertKpiMonthlyReviewSchema = createInsertSchema(kpiMonthlyReviews).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertKpiMonthlyReview = z.infer<typeof insertKpiMonthlyReviewSchema>;
export type KpiMonthlyReview = typeof kpiMonthlyReviews.$inferSelect;

// KPI Grace Scores table - manual positive/negative point adjustments per PM/month
export const kpiGraceScores = pgTable("kpi_grace_scores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pmId: varchar("pm_id").references(() => users.id).notNull(),
  reviewerId: varchar("reviewer_id").references(() => users.id).notNull(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  points: decimal("points", { precision: 6, scale: 2 }).notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("kpi_grace_scores_pm_month_year_idx").on(table.pmId, table.month, table.year),
  index("kpi_grace_scores_month_year_idx").on(table.month, table.year),
]);

export const insertKpiGraceScoreSchema = createInsertSchema(kpiGraceScores, {
  points: z.coerce.number().refine((n) => n !== 0, "Points must not be zero").transform((n) => n.toString()),
  reason: z.string().trim().min(1, "Reason is required"),
}).omit({ id: true, createdAt: true });
export type InsertKpiGraceScore = z.infer<typeof insertKpiGraceScoreSchema>;
export type KpiGraceScore = typeof kpiGraceScores.$inferSelect;

export type KpiGraceScoreWithReviewer = KpiGraceScore & {
  reviewer?: User;
};

// Compound types for KPI module
export type KpiParameterWithScores = KpiParameter & {
  levelScores?: KpiLevelScore[];
};

export type KpiMonthlyReviewWithDetails = KpiMonthlyReview & {
  parameter?: KpiParameter;
  pm?: User;
  reviewer?: User;
};

// ===== Performance Appraisals =====

// Grades table - appraisal grades (separate concept from KPI/PM levels)
export const grades = pgTable("grades", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(), // e.g. "Assistant Vice President"
  code: varchar("code"), // optional short code, e.g. "AVP"
  targetScore: decimal("target_score", { precision: 6, scale: 2 }).notNull(), // avg KPI score required to be eligible, e.g. 80
  baseIncrementPct: decimal("base_increment_pct", { precision: 6, scale: 2 }).notNull(), // base increment %, e.g. 15
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertGradeSchema = createInsertSchema(grades, {
  name: z.string().trim().min(1, "Name is required"),
  targetScore: z.coerce.number().min(0).transform((n) => n.toString()),
  baseIncrementPct: z.coerce.number().min(0).transform((n) => n.toString()),
  code: z.string().trim().optional().nullable(),
  sortOrder: z.coerce.number().optional(),
}).omit({ id: true, createdAt: true });
export type InsertGrade = z.infer<typeof insertGradeSchema>;
export type Grade = typeof grades.$inferSelect;

// Salary grade bands table - the pay GRADE level (e.g. P-01..P-36). Each grade
// belongs to a Designation (grades table) and holds the Basic salary plus the
// benefit columns from the uploaded grade sheet. New salaries snap to a band
// within the same designation.
export const salaryGradeBands = pgTable("salary_grade_bands", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  designationId: varchar("designation_id").references(() => grades.id, { onDelete: "set null" }), // parent Designation
  designationName: varchar("designation_name"), // snapshot of the designation name from the sheet
  gradeCode: varchar("grade_code"), // e.g. "P-36"
  label: varchar("label"), // optional band label (legacy / display)
  salaryAmount: decimal("salary_amount", { precision: 12, scale: 2 }).notNull(), // Basic salary (the math column)
  details: jsonb("details").$type<Record<string, string | number | null>>(), // remaining sheet columns (Fuel, Gross, PF, IPD, OPD, Vehicle, Package, Maternity, ...)
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("salary_grade_bands_amount_idx").on(table.salaryAmount),
  index("salary_grade_bands_designation_idx").on(table.designationId),
]);

export const insertSalaryGradeBandSchema = createInsertSchema(salaryGradeBands, {
  designationId: z.string().optional().nullable(),
  designationName: z.string().trim().optional().nullable(),
  gradeCode: z.string().trim().optional().nullable(),
  label: z.string().trim().optional().nullable(),
  salaryAmount: z.coerce.number().min(0).transform((n) => n.toString()),
  details: z.record(z.any()).optional().nullable(),
  sortOrder: z.coerce.number().optional(),
}).omit({ id: true, createdAt: true });
export type InsertSalaryGradeBand = z.infer<typeof insertSalaryGradeBandSchema>;
export type SalaryGradeBand = typeof salaryGradeBands.$inferSelect;

// Structured AI performance analysis stored on an appraisal. Generated on demand
// by an admin and reused across surfaces (dropdown, report page, rollout email).
export type AppraisalAiAnalysis = {
  summary: string;
  strengths: string[];
  improvements: string[];
  actionItems: string[];
  plan: string[];
};

// Appraisals table - computed appraisal per PM per cycle (latest snapshot; regenerating replaces drafts)
export const appraisals = pgTable("appraisals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pmId: varchar("pm_id").references(() => users.id).notNull(),
  periodMonths: integer("period_months").notNull(), // 6 or 12
  periodEndMonth: integer("period_end_month").notNull(), // 1-12
  periodEndYear: integer("period_end_year").notNull(),
  // Snapshots of inputs at generation time
  gradeId: varchar("grade_id").references(() => grades.id, { onDelete: "set null" }), // Designation
  gradeName: varchar("grade_name"), // Designation name snapshot
  currentGradeBandId: varchar("current_grade_band_id").references(() => salaryGradeBands.id, { onDelete: "set null" }), // PM's pay Grade at generation
  currentGradeCode: varchar("current_grade_code"), // Grade code snapshot (e.g. P-12)
  assignedGradeCode: varchar("assigned_grade_code"), // snapped new Grade code snapshot
  targetScore: decimal("target_score", { precision: 6, scale: 2 }),
  averageScore: decimal("average_score", { precision: 6, scale: 2 }),
  servedMonths: integer("served_months"), // months of service at period end (null if no joining date)
  eligible: boolean("eligible").default(false).notNull(),
  eligibilityOverride: boolean("eligibility_override").default(false).notNull(), // admin bypass for 1-year service requirement
  eligibilityReason: text("eligibility_reason"),
  // Increment computation (base/hp may be overridden by admin)
  baseIncrementPct: decimal("base_increment_pct", { precision: 6, scale: 2 }),
  hpPct: decimal("hp_pct", { precision: 6, scale: 2 }),
  currentSalary: decimal("current_salary", { precision: 12, scale: 2 }),
  rawNewSalary: decimal("raw_new_salary", { precision: 12, scale: 2 }), // salary + (base+hp) * salary, before band snap
  assignedBandId: varchar("assigned_band_id").references(() => salaryGradeBands.id, { onDelete: "set null" }),
  assignedSalary: decimal("assigned_salary", { precision: 12, scale: 2 }), // snapped band salary (final new salary)
  finalIncrement: decimal("final_increment", { precision: 12, scale: 2 }), // assignedSalary - currentSalary
  // Override tracking
  baseOverridden: boolean("base_overridden").default(false).notNull(),
  hpOverridden: boolean("hp_overridden").default(false).notNull(),
  bandOverridden: boolean("band_overridden").default(false).notNull(),
  salaryOverridden: boolean("salary_overridden").default(false).notNull(),
  status: varchar("status").default("draft").notNull(), // draft | finalized | rolled_out
  // Board "Rollout" decision: captured when an admin/board rolls out an appraisal.
  // finalVerdict is the board's decision label; boardComment is their note shown
  // to the employee. rolledOutAt/By record when and by whom the rollout happened.
  finalVerdict: varchar("final_verdict"),
  boardComment: text("board_comment"),
  rolledOutAt: timestamp("rolled_out_at"),
  rolledOutBy: varchar("rolled_out_by").references(() => users.id),
  // Snapshot of the employee's grade/pay band immediately before this appraisal
  // was rolled out. Captured at rollout time so an accidental rollout can be
  // undone and the employee's prior values restored. Cleared on undo.
  priorGradeId: varchar("prior_grade_id").references(() => grades.id, { onDelete: "set null" }),
  priorGradeBandId: varchar("prior_grade_band_id").references(() => salaryGradeBands.id, { onDelete: "set null" }),
  // Unguessable token for a private, no-login share link to the report page.
  // Null until an admin generates one; rotating/revoking replaces or clears it.
  shareToken: varchar("share_token").unique(),
  // On-demand AI performance analysis (nullable until an admin generates it)
  aiAnalysis: jsonb("ai_analysis").$type<AppraisalAiAnalysis>(),
  aiAnalysisProvider: varchar("ai_analysis_provider"),
  aiAnalysisModel: varchar("ai_analysis_model"),
  aiAnalysisAt: timestamp("ai_analysis_at"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("appraisals_pm_idx").on(table.pmId),
  index("appraisals_period_idx").on(table.periodMonths, table.periodEndMonth, table.periodEndYear),
]);

export const insertAppraisalSchema = createInsertSchema(appraisals).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAppraisal = z.infer<typeof insertAppraisalSchema>;
export type Appraisal = typeof appraisals.$inferSelect;

export type AppraisalWithPm = Appraisal & {
  pm?: User;
};

// The full, self-contained payload rendered by the performance report page.
// Built server-side so the public (no-login) report needs no other authed call
// (e.g. to fetch grade bands). Never includes PII like email.
export type AppraisalReport = {
  id: string;
  personName: string;
  designation: string | null;
  periodMonths: number;
  periodEndMonth: number;
  periodEndYear: number;
  status: string;
  // Board rollout decision (null until an admin rolls the appraisal out)
  finalVerdict: string | null;
  boardComment: string | null;
  rolledOutAt: string | null;
  // Performance
  overallPerformancePct: number | null; // average score expressed as a percentage
  averageScore: string | null;
  targetScore: string | null;
  hpPct: string | null;
  baseIncrementPct: string | null;
  servedMonths: number | null;
  // Eligibility
  eligible: boolean;
  eligibilityReason: string | null;
  // Package
  currentSalary: string | null;
  assignedSalary: string | null;
  finalIncrement: string | null;
  currentGradeCode: string | null;
  assignedGradeCode: string | null;
  currentBand: SalaryGradeBand | null;
  newBand: SalaryGradeBand | null;
  // AI analysis (nullable until generated by an admin)
  aiAnalysis: AppraisalAiAnalysis | null;
  aiAnalysisAt: string | null;
};

// Forecast entries table - stores monthly payment forecasting per project
export const forecastEntries = pgTable("forecast_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  paymentType: varchar("payment_type").$type<PaymentType>().default("recurring").notNull(),
  probability: integer("probability").default(100),
  phase: varchar("phase"),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("forecast_entries_project_idx").on(table.projectId),
  index("forecast_entries_month_year_idx").on(table.month, table.year),
]);

export const insertForecastEntrySchema = createInsertSchema(forecastEntries).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertForecastEntry = z.infer<typeof insertForecastEntrySchema>;
export type ForecastEntry = typeof forecastEntries.$inferSelect;

// Upsell AI Analyses table (Task #112) - stores the most recent AI-generated
// analysis of the upsell dataset (sold CRs + pipeline upsells). The deterministic
// stats snapshot used for the run is stored alongside the AI insights so the
// dashboard can render a coherent historical view without re-running.
export const upsellAiProviders = ["anthropic", "openai"] as const;
export type UpsellAiProvider = (typeof upsellAiProviders)[number];

// Which dataset an analysis run/stats snapshot covers: the combined
// Pipeline + Sold Upsells view, or Sold Upsells only.
export const upsellAnalysisScopes = ["combined", "sold"] as const;
export type UpsellAnalysisScope = (typeof upsellAnalysisScopes)[number];

// Shape of the structured insights returned by the AI provider.
export type UpsellAiInsights = {
  summary: string;
  trends: string[];
  easyToUpsell: string[];
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
};

export const upsellAiAnalyses = pgTable("upsell_ai_analyses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  provider: varchar("provider").$type<UpsellAiProvider>().notNull(),
  model: varchar("model").notNull(),
  scope: varchar("scope").$type<UpsellAnalysisScope>().default("combined").notNull(),
  insights: jsonb("insights").$type<UpsellAiInsights>().notNull(),
  statsSnapshot: jsonb("stats_snapshot").notNull(),
  generatedBy: varchar("generated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("upsell_ai_analyses_created_idx").on(table.createdAt),
  index("upsell_ai_analyses_scope_idx").on(table.scope),
]);

export const insertUpsellAiAnalysisSchema = createInsertSchema(upsellAiAnalyses).omit({ id: true, createdAt: true });
export type InsertUpsellAiAnalysis = z.infer<typeof insertUpsellAiAnalysisSchema>;
export type UpsellAiAnalysis = typeof upsellAiAnalyses.$inferSelect;

export type UpsellAiAnalysisWithUser = UpsellAiAnalysis & {
  generator: User | null;
};

// AI provider credentials managed in-app (Settings > AI Providers). One row per
// provider. The apiKey is write-only from the UI and never returned in API
// responses (mirrors the SMTP password pattern).
export const aiProviderSettings = pgTable("ai_provider_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  provider: varchar("provider").$type<UpsellAiProvider>().notNull().unique(),
  apiKey: varchar("api_key").notNull(),
  model: varchar("model"),
  isActive: boolean("is_active").default(true).notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: varchar("updated_by").references(() => users.id),
});

export const insertAiProviderSettingsSchema = createInsertSchema(aiProviderSettings).omit({ id: true, updatedAt: true });
export type InsertAiProviderSettings = z.infer<typeof insertAiProviderSettingsSchema>;
export type AiProviderSettings = typeof aiProviderSettings.$inferSelect;
