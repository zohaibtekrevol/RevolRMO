import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { storage } from "./storage";
import type { Payment, Project, User, SMTPSettings } from "@shared/schema";

let cachedTransporter: Transporter | null = null;
let cachedSettingsId: string | null = null;

async function getTransporter(): Promise<Transporter | null> {
  const settings = await storage.getSMTPSettings();
  
  if (!settings) {
    console.log("No SMTP settings configured");
    return null;
  }
  
  if (cachedTransporter && cachedSettingsId === settings.id) {
    return cachedTransporter;
  }
  
  const transportConfig: any = {
    host: settings.host,
    port: settings.port,
    auth: {
      user: settings.username,
      pass: settings.password,
    },
  };
  
  if (settings.encryption === "ssl") {
    transportConfig.secure = true;
  } else if (settings.encryption === "starttls") {
    transportConfig.secure = false;
    transportConfig.requireTLS = true;
  } else {
    transportConfig.secure = false;
  }
  
  cachedTransporter = nodemailer.createTransport(transportConfig);
  cachedSettingsId = settings.id;
  
  return cachedTransporter;
}

export function clearTransporterCache(): void {
  cachedTransporter = null;
  cachedSettingsId = null;
}

export type EmailNotificationType = 
  | "payment_received"
  | "invoice_pending"
  | "due_date_reminder"
  | "manual_reminder"
  | "milestone_ready"
  | "password_reset";

interface NotificationContext {
  payment: Payment;
  project: Project;
  pm?: User | null;
  daysUntilDue?: number;
  customMessage?: string;
  milestoneName?: string;
  milestoneAmount?: string;
}

interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  encoding?: string;
  contentType?: string;
}

interface SendEmailOptions {
  to: string;
  cc?: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: EmailAttachment[];
}

interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

async function isEmailEnabled(): Promise<boolean> {
  try {
    const settings = await storage.getAppSettings();
    return settings?.enableEmailNotifications === true;
  } catch {
    return false;
  }
}

function formatCurrency(amount: string | number): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(num || 0);
}

function formatDate(date: Date | string | null): string {
  if (!date) return "N/A";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  try {
    const transporter = await getTransporter();
    
    if (!transporter) {
      return {
        success: false,
        error: "SMTP settings not configured. Please configure email settings in Admin Settings.",
      };
    }
    
    const settings = await storage.getSMTPSettings();
    if (!settings) {
      return {
        success: false,
        error: "SMTP settings not found.",
      };
    }
    
    const mailOptions: Record<string, unknown> = {
      from: `"${settings.fromName}" <${settings.fromEmail}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    };
    
    if (options.cc) {
      mailOptions.cc = options.cc;
    }

    if (options.attachments && options.attachments.length > 0) {
      mailOptions.attachments = options.attachments;
    }
    
    const info = await transporter.sendMail(mailOptions);
    
    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error: any) {
    console.error("Email send error:", error);
    return {
      success: false,
      error: error.message || "Failed to send email",
    };
  }
}

export async function testSMTPConnection(settings: Partial<SMTPSettings> & { password?: string }): Promise<{ success: boolean; error?: string }> {
  try {
    const transportConfig: any = {
      host: settings.host,
      port: settings.port,
      auth: {
        user: settings.username,
        pass: settings.password,
      },
    };
    
    if (settings.encryption === "ssl") {
      transportConfig.secure = true;
    } else if (settings.encryption === "starttls") {
      transportConfig.secure = false;
      transportConfig.requireTLS = true;
    } else {
      transportConfig.secure = false;
    }
    
    const testTransporter = nodemailer.createTransport(transportConfig);
    await testTransporter.verify();
    
    return { success: true };
  } catch (error: any) {
    console.error("SMTP connection test failed:", error);
    return {
      success: false,
      error: error.message || "Failed to connect to SMTP server",
    };
  }
}

export async function sendTestEmail(toEmail: string): Promise<SendEmailResult> {
  return sendEmail({
    to: toEmail,
    subject: "RevolRMO - Test Email",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #C22828;">RevolRMO Email Test</h2>
        <p>This is a test email from your RevolRMO system.</p>
        <p>If you received this email, your SMTP configuration is working correctly.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">
          This email was sent automatically by RevolRMO - Recurring Management Office
        </p>
      </div>
    `,
    text: "This is a test email from your RevolRMO system. If you received this email, your SMTP configuration is working correctly.",
  });
}

function getPaymentReceivedTemplate(context: NotificationContext): { subject: string; html: string } {
  const { payment, project, pm } = context;
  const pmName = pm ? `${pm.firstName || ""} ${pm.lastName || ""}`.trim() || pm.email : "Unknown";
  
  return {
    subject: `Payment Received - ${project.name}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          .amount { font-size: 24px; font-weight: bold; color: #10b981; }
          .details { margin: 20px 0; }
          .details-row { display: flex; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
          .label { font-weight: 600; width: 150px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Payment Received</h1>
          </div>
          <div class="content">
            <p>Great news! A payment has been received.</p>
            <p class="amount">${formatCurrency(payment.receivedAmount || "0")}</p>
            <div class="details">
              <div class="details-row">
                <span class="label">Project:</span>
                <span>${project.name}</span>
              </div>
              <div class="details-row">
                <span class="label">Client:</span>
                <span>${project.clientName}</span>
              </div>
              <div class="details-row">
                <span class="label">Region:</span>
                <span>${project.region}</span>
              </div>
              <div class="details-row">
                <span class="label">Project Manager:</span>
                <span>${pmName}</span>
              </div>
              <div class="details-row">
                <span class="label">Expected Amount:</span>
                <span>${formatCurrency(payment.expectedAmount)}</span>
              </div>
              <div class="details-row">
                <span class="label">Received Amount:</span>
                <span>${formatCurrency(payment.receivedAmount || "0")}</span>
              </div>
              <div class="details-row">
                <span class="label">Received Date:</span>
                <span>${formatDate(payment.receivedDate)}</span>
              </div>
              <div class="details-row">
                <span class="label">Payment Type:</span>
                <span>${payment.paymentType}</span>
              </div>
            </div>
          </div>
          <div class="footer">
            <p>RevolRMO - Recurring Management Office</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };
}

function getInvoicePendingTemplate(context: NotificationContext): { subject: string; html: string } {
  const { payment, project, pm } = context;
  const pmName = pm ? `${pm.firstName || ""} ${pm.lastName || ""}`.trim() || pm.email : "Unknown";
  
  return {
    subject: `Invoice Pending Action - ${project.name}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f59e0b; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          .amount { font-size: 24px; font-weight: bold; color: #f59e0b; }
          .details { margin: 20px 0; }
          .details-row { display: flex; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
          .label { font-weight: 600; width: 150px; }
          .action { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 8px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Invoice Pending</h1>
          </div>
          <div class="content">
            <p>An invoice is pending and requires attention.</p>
            <p class="amount">${formatCurrency(payment.expectedAmount)}</p>
            <div class="action">
              <strong>Action Required:</strong> Please review and process this invoice.
            </div>
            <div class="details">
              <div class="details-row">
                <span class="label">Project:</span>
                <span>${project.name}</span>
              </div>
              <div class="details-row">
                <span class="label">Client:</span>
                <span>${project.clientName}</span>
              </div>
              <div class="details-row">
                <span class="label">Client Email:</span>
                <span>${project.clientEmail || "N/A"}</span>
              </div>
              <div class="details-row">
                <span class="label">Region:</span>
                <span>${project.region}</span>
              </div>
              <div class="details-row">
                <span class="label">Project Manager:</span>
                <span>${pmName}</span>
              </div>
              <div class="details-row">
                <span class="label">Expected Amount:</span>
                <span>${formatCurrency(payment.expectedAmount)}</span>
              </div>
              <div class="details-row">
                <span class="label">Payment Type:</span>
                <span>${payment.paymentType}</span>
              </div>
              <div class="details-row">
                <span class="label">Period:</span>
                <span>${payment.month}/${payment.year}</span>
              </div>
            </div>
          </div>
          <div class="footer">
            <p>RevolRMO - Recurring Management Office</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };
}

function getDueDateReminderTemplate(context: NotificationContext): { subject: string; html: string } {
  const { payment, project, pm, daysUntilDue } = context;
  const pmName = pm ? `${pm.firstName || ""} ${pm.lastName || ""}`.trim() || pm.email : "Unknown";
  const urgency = daysUntilDue !== undefined && daysUntilDue <= 0 ? "Overdue" : `Due in ${daysUntilDue} days`;
  const headerColor = daysUntilDue !== undefined && daysUntilDue <= 0 ? "#ef4444" : "#3b82f6";
  
  return {
    subject: `Payment Due Reminder - ${project.name} (${urgency})`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: ${headerColor}; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          .amount { font-size: 24px; font-weight: bold; color: ${headerColor}; }
          .urgency { font-size: 18px; font-weight: bold; color: ${headerColor}; margin: 10px 0; }
          .details { margin: 20px 0; }
          .details-row { display: flex; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
          .label { font-weight: 600; width: 150px; }
          .warning { background: ${daysUntilDue !== undefined && daysUntilDue <= 0 ? "#fee2e2" : "#dbeafe"}; border: 1px solid ${headerColor}; padding: 15px; border-radius: 8px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Payment Due Reminder</h1>
          </div>
          <div class="content">
            <p class="urgency">${urgency}</p>
            <p class="amount">${formatCurrency(payment.expectedAmount)}</p>
            <div class="warning">
              <strong>Due Date:</strong> ${formatDate(payment.dueDate)}
            </div>
            <div class="details">
              <div class="details-row">
                <span class="label">Project:</span>
                <span>${project.name}</span>
              </div>
              <div class="details-row">
                <span class="label">Client:</span>
                <span>${project.clientName}</span>
              </div>
              <div class="details-row">
                <span class="label">Client Email:</span>
                <span>${project.clientEmail || "N/A"}</span>
              </div>
              <div class="details-row">
                <span class="label">Region:</span>
                <span>${project.region}</span>
              </div>
              <div class="details-row">
                <span class="label">Project Manager:</span>
                <span>${pmName}</span>
              </div>
              <div class="details-row">
                <span class="label">Invoice Date:</span>
                <span>${formatDate(payment.invoiceDate)}</span>
              </div>
              <div class="details-row">
                <span class="label">Due Date:</span>
                <span>${formatDate(payment.dueDate)}</span>
              </div>
              <div class="details-row">
                <span class="label">Status:</span>
                <span>${payment.status}</span>
              </div>
            </div>
          </div>
          <div class="footer">
            <p>RevolRMO - Recurring Management Office</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };
}

function getManualReminderTemplate(context: NotificationContext): { subject: string; html: string } {
  const { payment, project, pm, customMessage } = context;
  const pmName = pm ? `${pm.firstName || ""} ${pm.lastName || ""}`.trim() || pm.email : "Unknown";
  
  return {
    subject: `Payment Reminder - ${project.name}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #C22828; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          .amount { font-size: 24px; font-weight: bold; color: #C22828; }
          .details { margin: 20px 0; }
          .details-row { display: flex; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
          .label { font-weight: 600; width: 150px; }
          .message { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 8px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Payment Reminder</h1>
          </div>
          <div class="content">
            ${customMessage ? `<div class="message"><strong>Message:</strong> ${customMessage}</div>` : ""}
            <p>This is a reminder about a payment that needs your attention.</p>
            <p class="amount">${formatCurrency(payment.expectedAmount)}</p>
            <div class="details">
              <div class="details-row">
                <span class="label">Project:</span>
                <span>${project.name}</span>
              </div>
              <div class="details-row">
                <span class="label">Client:</span>
                <span>${project.clientName}</span>
              </div>
              <div class="details-row">
                <span class="label">Region:</span>
                <span>${project.region}</span>
              </div>
              <div class="details-row">
                <span class="label">Project Manager:</span>
                <span>${pmName}</span>
              </div>
              <div class="details-row">
                <span class="label">Due Date:</span>
                <span>${formatDate(payment.dueDate)}</span>
              </div>
              <div class="details-row">
                <span class="label">Status:</span>
                <span>${payment.status}</span>
              </div>
              <div class="details-row">
                <span class="label">Payment Type:</span>
                <span>${payment.paymentType}</span>
              </div>
            </div>
          </div>
          <div class="footer">
            <p>RevolRMO - Recurring Management Office</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };
}

function getMilestoneReadyTemplate(context: NotificationContext): { subject: string; html: string } {
  const { payment, project, pm, milestoneName, milestoneAmount } = context;
  const pmName = pm ? `${pm.firstName || ""} ${pm.lastName || ""}`.trim() || pm.email : "Unknown";
  
  return {
    subject: `Milestone Ready for Invoice - ${project.name}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #8b5cf6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          .amount { font-size: 24px; font-weight: bold; color: #8b5cf6; }
          .details { margin: 20px 0; }
          .details-row { display: flex; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
          .label { font-weight: 600; width: 150px; }
          .action { background: #ede9fe; border: 1px solid #8b5cf6; padding: 15px; border-radius: 8px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Milestone Ready for Invoice</h1>
          </div>
          <div class="content">
            <p>A project milestone is ready for invoicing.</p>
            <p class="amount">${formatCurrency(milestoneAmount || payment.expectedAmount)}</p>
            <div class="action">
              <strong>Action Required:</strong> Please create an invoice for this milestone.
            </div>
            <div class="details">
              <div class="details-row">
                <span class="label">Milestone:</span>
                <span>${milestoneName || "N/A"}</span>
              </div>
              <div class="details-row">
                <span class="label">Project:</span>
                <span>${project.name}</span>
              </div>
              <div class="details-row">
                <span class="label">Client:</span>
                <span>${project.clientName}</span>
              </div>
              <div class="details-row">
                <span class="label">Client Email:</span>
                <span>${project.clientEmail || "N/A"}</span>
              </div>
              <div class="details-row">
                <span class="label">Region:</span>
                <span>${project.region}</span>
              </div>
              <div class="details-row">
                <span class="label">Project Manager:</span>
                <span>${pmName}</span>
              </div>
              <div class="details-row">
                <span class="label">Amount:</span>
                <span>${formatCurrency(milestoneAmount || payment.expectedAmount)}</span>
              </div>
            </div>
          </div>
          <div class="footer">
            <p>RevolRMO - Recurring Management Office</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };
}

export async function sendNotification(
  type: EmailNotificationType,
  context: NotificationContext,
  recipientEmail?: string
): Promise<{ success: boolean; error?: string }> {
  const enabled = await isEmailEnabled();
  if (!enabled) {
    return { success: false, error: "Email notifications are disabled" };
  }

  let template: { subject: string; html: string };
  switch (type) {
    case "payment_received":
      template = getPaymentReceivedTemplate(context);
      break;
    case "invoice_pending":
      template = getInvoicePendingTemplate(context);
      break;
    case "due_date_reminder":
      template = getDueDateReminderTemplate(context);
      break;
    case "manual_reminder":
      template = getManualReminderTemplate(context);
      break;
    case "milestone_ready":
      template = getMilestoneReadyTemplate(context);
      break;
    default:
      return { success: false, error: "Unknown notification type" };
  }

  const toEmail = recipientEmail || context.pm?.email || context.project.clientEmail;

  if (!toEmail) {
    return { success: false, error: "No recipient email address available" };
  }

  const result = await sendEmail({
    to: toEmail,
    subject: template.subject,
    html: template.html,
  });

  if (result.success) {
    console.log(`[Email] Sent ${type} notification to ${toEmail}`);
  } else {
    console.error(`[Email] Failed to send ${type} notification:`, result.error);
  }

  return result;
}

export async function triggerPaymentReceivedNotification(paymentId: string): Promise<void> {
  try {
    const payment = await storage.getPaymentWithProject(paymentId);
    if (!payment) return;

    const pm = payment.project.pmId ? await storage.getUser(payment.project.pmId) : null;

    await sendNotification("payment_received", {
      payment,
      project: payment.project,
      pm,
    });
  } catch (error) {
    console.error("[Email] Error triggering payment received notification:", error);
  }
}

export async function triggerInvoicePendingNotification(paymentId: string): Promise<void> {
  try {
    const payment = await storage.getPaymentWithProject(paymentId);
    if (!payment) return;

    const pm = payment.project.pmId ? await storage.getUser(payment.project.pmId) : null;

    await sendNotification("invoice_pending", {
      payment,
      project: payment.project,
      pm,
    });
  } catch (error) {
    console.error("[Email] Error triggering invoice pending notification:", error);
  }
}

export async function triggerMilestoneReadyNotification(
  milestoneId: string, 
  paymentId?: string
): Promise<void> {
  try {
    const enabled = await isEmailEnabled();
    if (!enabled) return;

    const milestone = await storage.getMilestone(milestoneId);
    if (!milestone) return;

    const project = await storage.getProject(milestone.projectId);
    if (!project) return;

    const pm = project.pmId ? await storage.getUser(project.pmId) : null;

    // If there's a linked payment, use it; otherwise use milestone data directly
    let payment: any;
    if (paymentId) {
      payment = await storage.getPaymentWithProject(paymentId);
      if (!payment) return;
    } else {
      // Create minimal payment-like object with only fields the template actually uses
      payment = {
        expectedAmount: milestone.expectedAmount?.toString() || "0",
        projectId: milestone.projectId,
      };
    }

    await sendNotification("milestone_ready", {
      payment,
      project,
      pm,
      milestoneName: milestone.name,
      milestoneAmount: milestone.expectedAmount?.toString(),
    });
  } catch (error) {
    console.error("[Email] Error triggering milestone ready notification:", error);
  }
}

export async function checkAndSendDueDateReminders(): Promise<{ sent: number; errors: number }> {
  let sent = 0;
  let errors = 0;

  try {
    const enabled = await isEmailEnabled();
    if (!enabled) {
      return { sent: 0, errors: 0 };
    }

    const settings = await storage.getAppSettings();
    const reminderDays = settings?.paymentReminderDays || 7;

    const now = new Date();
    const payments = await storage.getAllPayments({});

    for (const payment of payments) {
      if (payment.status === "received" || !payment.dueDate) continue;

      const dueDate = new Date(payment.dueDate);
      const diffTime = dueDate.getTime() - now.getTime();
      const daysUntilDue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (daysUntilDue <= reminderDays && daysUntilDue > 0) {
        const pm = payment.project.pmId ? await storage.getUser(payment.project.pmId) : null;

        const result = await sendNotification("due_date_reminder", {
          payment,
          project: payment.project,
          pm,
          daysUntilDue,
        });

        if (result.success) {
          sent++;
        } else {
          errors++;
        }
      } else if (daysUntilDue <= 0) {
        const pm = payment.project.pmId ? await storage.getUser(payment.project.pmId) : null;

        const result = await sendNotification("due_date_reminder", {
          payment,
          project: payment.project,
          pm,
          daysUntilDue,
        });

        if (result.success) {
          sent++;
        } else {
          errors++;
        }
      }
    }
  } catch (error) {
    console.error("[Email] Error checking due date reminders:", error);
  }

  return { sent, errors };
}

export async function getEmailServiceStatus(): Promise<{ configured: boolean; smtpConfigured: boolean }> {
  const smtpSettings = await storage.getSMTPSettings();
  return {
    configured: !!smtpSettings,
    smtpConfigured: !!smtpSettings,
  };
}

function getPasswordResetTemplate(user: User, resetUrl: string): { subject: string; html: string } {
  const userName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email || "User";
  
  return {
    subject: "Password Reset Request - RevolRMO",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #C22828; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          .button { display: inline-block; background: #C22828; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .warning { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 8px; margin: 20px 0; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <p>Hello ${userName},</p>
            <p>An administrator has requested a password reset for your RevolRMO account.</p>
            <p>Since you sign in using Google, please use Google's password recovery if needed:</p>
            <p style="text-align: center;">
              <a href="${resetUrl}" class="button" style="color: white;">Reset Your Password</a>
            </p>
            <div class="warning">
              <strong>Note:</strong> This will redirect you to Google's password reset page. If you did not expect this email, you can safely ignore it.
            </div>
            <p>If the button above doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #C22828;">${resetUrl}</p>
          </div>
          <div class="footer">
            <p>RevolRMO - Recurring Management Office</p>
            <p>This email was sent because an administrator requested a password reset for your account.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };
}

export async function sendPasswordResetEmail(
  user: User
): Promise<{ success: boolean; error?: string }> {
  if (!user.email) {
    return { success: false, error: "User has no email address" };
  }

  const resetUrl = "https://accounts.google.com/signin/recovery";
  const template = getPasswordResetTemplate(user, resetUrl);

  const result = await sendEmail({
    to: user.email,
    subject: template.subject,
    html: template.html,
  });

  if (result.success) {
    console.log(`[Email] Sent password reset email to ${user.email}`);
  } else {
    console.error(`[Email] Failed to send password reset to ${user.email}:`, result.error);
  }

  return result;
}

function getUserInviteTemplate(user: { email: string; firstName?: string | null; lastName?: string | null }, systemUrl: string): { subject: string; html: string } {
  const userName = user.firstName 
    ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`
    : user.email;
  
  return {
    subject: "Welcome to RevolRMO - You've Been Invited!",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #C22828; color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .header h1 { margin: 0; font-size: 28px; }
          .header p { margin: 10px 0 0; opacity: 0.9; }
          .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; background: #f3f4f6; }
          .button { display: inline-block; background: #C22828; color: white !important; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
          .button:hover { background: #a11f1f; }
          .welcome-box { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .feature-list { margin: 20px 0; padding-left: 20px; }
          .feature-list li { margin: 10px 0; color: #4b5563; }
          .highlight { color: #C22828; font-weight: 600; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to RevolRMO</h1>
            <p>Recurring Management Office</p>
          </div>
          <div class="content">
            <p>Hello <span class="highlight">${userName}</span>,</p>
            
            <div class="welcome-box">
              <p>You've been invited to join <strong>RevolRMO</strong> - a comprehensive finance management platform designed for tracking recurring payments, managing projects, and streamlining financial oversight.</p>
            </div>
            
            <p>With RevolRMO, you'll be able to:</p>
            <ul class="feature-list">
              <li>Track and manage recurring payments across projects</li>
              <li>View dashboard analytics and financial insights</li>
              <li>Monitor project milestones and invoices</li>
              <li>Collaborate with your team on financial planning</li>
            </ul>
            
            <p style="text-align: center;">
              <a href="${systemUrl}" class="button" style="color: white;">Access RevolRMO</a>
            </p>
            
            <p><strong>How to get started:</strong></p>
            <ol style="color: #4b5563;">
              <li>Click the button above to open RevolRMO</li>
              <li>Sign in using your Google account (<span class="highlight">${user.email}</span>)</li>
              <li>Your account has been pre-configured with the appropriate permissions</li>
            </ol>
            
            <p style="margin-top: 20px; padding: 15px; background: #fef3c7; border-radius: 6px; border-left: 4px solid #f59e0b;">
              <strong>Note:</strong> Please sign in using the same email address this invitation was sent to. Access is restricted to authorized accounts only.
            </p>
          </div>
          <div class="footer">
            <p>RevolRMO - Recurring Management Office</p>
            <p>This invitation was sent because an administrator added you to the system.</p>
            <p>If you did not expect this email, please contact your system administrator.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };
}

export async function sendUserInviteEmail(
  user: { email: string; firstName?: string | null; lastName?: string | null },
  systemUrl: string
): Promise<{ success: boolean; error?: string }> {
  if (!user.email) {
    return { success: false, error: "User has no email address" };
  }

  const template = getUserInviteTemplate(user, systemUrl);

  const result = await sendEmail({
    to: user.email,
    subject: template.subject,
    html: template.html,
  });

  if (result.success) {
    console.log(`[Email] Sent invite email to ${user.email}`);
  } else {
    console.error(`[Email] Failed to send invite to ${user.email}:`, result.error);
  }

  return result;
}

// Sent when the board "rolls out" an employee's appraisal — the final decision.
// Carries a link to their performance report (a no-login share link when one is
// supplied) plus the board's verdict and comment. Fail-soft: a missing/failed
// SMTP setup never blocks the rollout itself.
export async function sendAppraisalRolloutEmail(
  user: { email?: string | null; firstName?: string | null; lastName?: string | null },
  ctx: { reportUrl: string; cycleLabel: string; finalVerdict?: string | null; boardComment?: string | null; eligible: boolean },
): Promise<SendEmailResult> {
  if (!user.email) {
    return { success: false, error: "User has no email address" };
  }

  // Escape board-supplied text before interpolating into HTML so a stray "<" or
  // markup in a verdict/comment can't break the email or inject content.
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || "there";
  const safeName = esc(name);
  const verdictRow = ctx.finalVerdict
    ? `<div class="row"><span class="label">Board decision</span><span class="value">${esc(ctx.finalVerdict)}</span></div>`
    : "";
  const commentBlock = ctx.boardComment
    ? `<div class="comment"><div class="comment-label">Comment from the board</div><p>${esc(ctx.boardComment).replace(/\n/g, "<br/>")}</p></div>`
    : "";

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #C22828; color: white; padding: 25px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; }
        .footer { text-align: center; padding: 20px; background: #f9fafb; color: #6b7280; font-size: 12px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none; }
        .button { display: inline-block; background: #C22828; color: white !important; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
        .row { padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
        .label { font-weight: 600; color: #374151; display: inline-block; min-width: 140px; }
        .value { color: #111827; }
        .comment { background: #f9fafb; border-left: 4px solid #C22828; padding: 14px 16px; margin: 18px 0; border-radius: 4px; }
        .comment-label { font-weight: 600; color: #374151; margin-bottom: 6px; }
        .comment p { margin: 0; color: #374151; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header"><h2 style="margin:0;">Your appraisal is final</h2></div>
        <div class="content">
          <p>Hi ${safeName},</p>
          <p>The board has completed and rolled out your performance appraisal for the <strong>${esc(ctx.cycleLabel)}</strong>. ${ctx.eligible ? "You are eligible for an increment this cycle." : "There is no increment this cycle."}</p>
          ${verdictRow}
          ${commentBlock}
          <p style="text-align:center;"><a class="button" href="${ctx.reportUrl}">View your performance report</a></p>
          <p style="font-size:13px;color:#6b7280;">If the button doesn't work, copy and paste this link into your browser:<br/><span style="word-break:break-all;color:#C22828;">${ctx.reportUrl}</span></p>
        </div>
        <div class="footer">RevolRMO · This is an automated message about your appraisal.</div>
      </div>
    </body>
    </html>`;

  const text = `Hi ${name},\n\nThe board has rolled out your performance appraisal for the ${ctx.cycleLabel}.\n${ctx.finalVerdict ? `Board decision: ${ctx.finalVerdict}\n` : ""}${ctx.boardComment ? `Comment from the board: ${ctx.boardComment}\n` : ""}\nView your report: ${ctx.reportUrl}\n\nRevolRMO`;

  const result = await sendEmail({ to: user.email, subject: "Your performance appraisal is final", html, text });
  if (result.success) {
    console.log(`[Email] Sent appraisal rollout email to ${user.email}`);
  } else {
    console.error(`[Email] Failed to send appraisal rollout email to ${user.email}:`, result.error);
  }
  return result;
}

// Client Payment Reminder Types
type ClientReminderType = "soft_reminder" | "due_soon" | "overdue" | "final_warning";

interface ClientReminderContext {
  payment: Payment;
  project: Project;
  reminderType: ClientReminderType;
  daysUntilDue: number;
}

function formatCurrencyForClient(amount: string | number): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(num || 0);
}

function formatDateForClient(date: Date | string | null | undefined): string {
  if (!date) return "N/A";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getSoftReminderTemplate(context: ClientReminderContext): { subject: string; html: string } {
  const { payment, project, daysUntilDue } = context;
  
  return {
    subject: `Friendly Reminder: Payment Due in ${daysUntilDue} Days - ${project.name}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #3b82f6; color: white; padding: 25px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; }
          .footer { text-align: center; padding: 20px; background: #f9fafb; color: #6b7280; font-size: 12px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none; }
          .amount-box { background: #eff6ff; border: 2px solid #3b82f6; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
          .amount { font-size: 28px; font-weight: bold; color: #1d4ed8; }
          .due-date { font-size: 14px; color: #6b7280; margin-top: 5px; }
          .details { margin: 25px 0; }
          .details-row { padding: 12px 0; border-bottom: 1px solid #e5e7eb; display: flex; }
          .details-row:last-child { border-bottom: none; }
          .label { font-weight: 600; color: #374151; min-width: 140px; }
          .value { color: #4b5563; }
          .notice { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 0 6px 6px 0; }
          .automated-note { background: #f3f4f6; padding: 12px; border-radius: 6px; margin-top: 20px; font-size: 12px; color: #6b7280; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 24px;">Payment Reminder</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Friendly reminder about your upcoming payment</p>
          </div>
          <div class="content">
            <p>Dear Valued Client,</p>
            <p>This is a friendly reminder that your payment for <strong>${project.name}</strong> will be due in <strong>${daysUntilDue} days</strong>.</p>
            
            <div class="amount-box">
              <div class="amount">${formatCurrencyForClient(payment.expectedAmount)}</div>
              <div class="due-date">Due Date: ${formatDateForClient(payment.dueDate)}</div>
            </div>
            
            <div class="details">
              <div class="details-row">
                <span class="label">Project:</span>
                <span class="value">${project.name}</span>
              </div>
              <div class="details-row">
                <span class="label">Payment Period:</span>
                <span class="value">${payment.month}/${payment.year}</span>
              </div>
              <div class="details-row">
                <span class="label">Payment Type:</span>
                <span class="value">${payment.paymentType === "recurring" ? "Recurring Payment" : "Upsell Payment"}</span>
              </div>
            </div>
            
            <div class="notice">
              <strong>Note:</strong> Please ensure that your payment is processed before the due date to avoid any service interruptions.
            </div>
            
            <div class="automated-note">
              This is an automated reminder. If you have already made this payment, please disregard this email.
            </div>
          </div>
          <div class="footer">
            <p><strong>TekRevol</strong></p>
            <p>Thank you for your continued partnership.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };
}

function getDueSoonReminderTemplate(context: ClientReminderContext): { subject: string; html: string } {
  const { payment, project, daysUntilDue } = context;
  const dueText = daysUntilDue === 0 ? "Today" : daysUntilDue === 1 ? "Tomorrow" : `in ${daysUntilDue} Days`;
  
  return {
    subject: `Urgent: Payment Due ${dueText} - ${project.name}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f59e0b; color: white; padding: 25px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; }
          .footer { text-align: center; padding: 20px; background: #f9fafb; color: #6b7280; font-size: 12px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none; }
          .amount-box { background: #fef3c7; border: 2px solid #f59e0b; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
          .amount { font-size: 28px; font-weight: bold; color: #b45309; }
          .due-date { font-size: 16px; color: #92400e; margin-top: 8px; font-weight: 600; }
          .details { margin: 25px 0; }
          .details-row { padding: 12px 0; border-bottom: 1px solid #e5e7eb; display: flex; }
          .details-row:last-child { border-bottom: none; }
          .label { font-weight: 600; color: #374151; min-width: 140px; }
          .value { color: #4b5563; }
          .urgent-notice { background: #fef3c7; border: 2px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 6px; text-align: center; }
          .automated-note { background: #f3f4f6; padding: 12px; border-radius: 6px; margin-top: 20px; font-size: 12px; color: #6b7280; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 24px;">Payment Due ${dueText}</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Please ensure timely payment</p>
          </div>
          <div class="content">
            <p>Dear Valued Client,</p>
            <p>This is an important reminder that your payment for <strong>${project.name}</strong> is due <strong>${dueText.toLowerCase()}</strong>.</p>
            
            <div class="amount-box">
              <div class="amount">${formatCurrencyForClient(payment.expectedAmount)}</div>
              <div class="due-date">Due: ${formatDateForClient(payment.dueDate)}</div>
            </div>
            
            <div class="urgent-notice">
              <strong>Action Required:</strong> Please ensure that your payment is made by the due date to avoid any delays or interruptions to your services.
            </div>
            
            <div class="details">
              <div class="details-row">
                <span class="label">Project:</span>
                <span class="value">${project.name}</span>
              </div>
              <div class="details-row">
                <span class="label">Payment Period:</span>
                <span class="value">${payment.month}/${payment.year}</span>
              </div>
              <div class="details-row">
                <span class="label">Payment Type:</span>
                <span class="value">${payment.paymentType === "recurring" ? "Recurring Payment" : "Upsell Payment"}</span>
              </div>
            </div>
            
            <div class="automated-note">
              This is an automated reminder. If you have already made this payment, please disregard this email.
            </div>
          </div>
          <div class="footer">
            <p><strong>TekRevol</strong></p>
            <p>Thank you for your prompt attention to this matter.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };
}

function getOverdueReminderTemplate(context: ClientReminderContext): { subject: string; html: string } {
  const { payment, project, daysUntilDue } = context;
  const daysOverdue = Math.abs(daysUntilDue);
  
  return {
    subject: `Overdue Payment Notice - ${project.name} (${daysOverdue} Days Overdue)`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc2626; color: white; padding: 25px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; }
          .footer { text-align: center; padding: 20px; background: #f9fafb; color: #6b7280; font-size: 12px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none; }
          .amount-box { background: #fef2f2; border: 2px solid #dc2626; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
          .amount { font-size: 28px; font-weight: bold; color: #b91c1c; }
          .overdue-badge { background: #dc2626; color: white; padding: 5px 15px; border-radius: 20px; font-size: 14px; font-weight: 600; display: inline-block; margin-top: 10px; }
          .details { margin: 25px 0; }
          .details-row { padding: 12px 0; border-bottom: 1px solid #e5e7eb; display: flex; }
          .details-row:last-child { border-bottom: none; }
          .label { font-weight: 600; color: #374151; min-width: 140px; }
          .value { color: #4b5563; }
          .warning-notice { background: #fef2f2; border: 2px solid #dc2626; padding: 15px; margin: 20px 0; border-radius: 6px; }
          .automated-note { background: #f3f4f6; padding: 12px; border-radius: 6px; margin-top: 20px; font-size: 12px; color: #6b7280; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 24px;">Payment Overdue</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Immediate action required</p>
          </div>
          <div class="content">
            <p>Dear Valued Client,</p>
            <p>Our records indicate that your payment for <strong>${project.name}</strong> is now <strong>${daysOverdue} days overdue</strong>.</p>
            
            <div class="amount-box">
              <div class="amount">${formatCurrencyForClient(payment.expectedAmount)}</div>
              <span class="overdue-badge">${daysOverdue} Days Overdue</span>
            </div>
            
            <div class="warning-notice">
              <strong>Important:</strong> Please clear this outstanding payment as soon as possible to ensure continued services and avoid any potential disruptions to your project.
            </div>
            
            <div class="details">
              <div class="details-row">
                <span class="label">Project:</span>
                <span class="value">${project.name}</span>
              </div>
              <div class="details-row">
                <span class="label">Original Due Date:</span>
                <span class="value">${formatDateForClient(payment.dueDate)}</span>
              </div>
              <div class="details-row">
                <span class="label">Payment Period:</span>
                <span class="value">${payment.month}/${payment.year}</span>
              </div>
              <div class="details-row">
                <span class="label">Payment Type:</span>
                <span class="value">${payment.paymentType === "recurring" ? "Recurring Payment" : "Upsell Payment"}</span>
              </div>
            </div>
            
            <div class="automated-note">
              This is an automated reminder. If you have already made this payment, please disregard this email.
            </div>
          </div>
          <div class="footer">
            <p><strong>TekRevol</strong></p>
            <p>Please contact us if you have any questions regarding this payment.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };
}

function getFinalWarningTemplate(context: ClientReminderContext): { subject: string; html: string } {
  const { payment, project, daysUntilDue } = context;
  const daysOverdue = Math.abs(daysUntilDue);
  
  return {
    subject: `FINAL NOTICE: Immediate Payment Required - ${project.name}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #7f1d1d; color: white; padding: 25px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; }
          .footer { text-align: center; padding: 20px; background: #f9fafb; color: #6b7280; font-size: 12px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none; }
          .amount-box { background: #fef2f2; border: 3px solid #7f1d1d; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
          .amount { font-size: 28px; font-weight: bold; color: #7f1d1d; }
          .overdue-badge { background: #7f1d1d; color: white; padding: 5px 15px; border-radius: 20px; font-size: 14px; font-weight: 600; display: inline-block; margin-top: 10px; }
          .details { margin: 25px 0; }
          .details-row { padding: 12px 0; border-bottom: 1px solid #e5e7eb; display: flex; }
          .details-row:last-child { border-bottom: none; }
          .label { font-weight: 600; color: #374151; min-width: 140px; }
          .value { color: #4b5563; }
          .final-warning { background: #7f1d1d; color: white; padding: 20px; margin: 20px 0; border-radius: 6px; text-align: center; }
          .deadline { font-size: 18px; font-weight: bold; margin-top: 10px; }
          .automated-note { background: #f3f4f6; padding: 12px; border-radius: 6px; margin-top: 20px; font-size: 12px; color: #6b7280; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 24px;">FINAL PAYMENT NOTICE</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Immediate action required to avoid service suspension</p>
          </div>
          <div class="content">
            <p>Dear Valued Client,</p>
            <p>Despite our previous reminders, your payment for <strong>${project.name}</strong> remains outstanding and is now <strong>${daysOverdue} days overdue</strong>.</p>
            
            <div class="amount-box">
              <div class="amount">${formatCurrencyForClient(payment.expectedAmount)}</div>
              <span class="overdue-badge">${daysOverdue} Days Overdue</span>
            </div>
            
            <div class="final-warning">
              <strong>FINAL NOTICE</strong>
              <p style="margin: 10px 0 0 0;">Payment must be made within <strong>24 hours</strong> to avoid suspension of development activities on your project.</p>
              <div class="deadline">Deadline: Immediate Payment Required</div>
            </div>
            
            <div class="details">
              <div class="details-row">
                <span class="label">Project:</span>
                <span class="value">${project.name}</span>
              </div>
              <div class="details-row">
                <span class="label">Original Due Date:</span>
                <span class="value">${formatDateForClient(payment.dueDate)}</span>
              </div>
              <div class="details-row">
                <span class="label">Days Overdue:</span>
                <span class="value" style="color: #7f1d1d; font-weight: 600;">${daysOverdue} days</span>
              </div>
              <div class="details-row">
                <span class="label">Payment Period:</span>
                <span class="value">${payment.month}/${payment.year}</span>
              </div>
            </div>
            
            <p style="margin-top: 20px;">Please treat this matter with utmost urgency. If payment is not received within 24 hours, we may have to temporarily suspend all development activities until the outstanding balance is cleared.</p>
            
            <div class="automated-note">
              This is an automated reminder. If you have already made this payment, please disregard this email.
            </div>
          </div>
          <div class="footer">
            <p><strong>TekRevol</strong></p>
            <p>For immediate assistance, please contact your account manager.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };
}

function determineReminderType(daysUntilDue: number): ClientReminderType {
  if (daysUntilDue > 2) {
    return "soft_reminder";
  } else if (daysUntilDue >= 0 && daysUntilDue <= 2) {
    return "due_soon";
  } else if (daysUntilDue < 0 && daysUntilDue >= -10) {
    return "overdue";
  } else {
    return "final_warning";
  }
}

export async function sendClientPaymentReminder(
  payment: Payment,
  project: Project,
  ccEmail?: string | null
): Promise<{ success: boolean; error?: string; reminderType?: ClientReminderType }> {
  if (!project.clientEmail) {
    return { success: false, error: "Client email not configured for this project" };
  }

  const dueDate = payment.dueDate ? new Date(payment.dueDate) : null;
  if (!dueDate) {
    return { success: false, error: "Payment has no due date configured" };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);
  
  const diffTime = dueDate.getTime() - today.getTime();
  const daysUntilDue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  const reminderType = determineReminderType(daysUntilDue);

  const context: ClientReminderContext = {
    payment,
    project,
    reminderType,
    daysUntilDue,
  };

  let template: { subject: string; html: string };
  
  switch (reminderType) {
    case "soft_reminder":
      template = getSoftReminderTemplate(context);
      break;
    case "due_soon":
      template = getDueSoonReminderTemplate(context);
      break;
    case "overdue":
      template = getOverdueReminderTemplate(context);
      break;
    case "final_warning":
      template = getFinalWarningTemplate(context);
      break;
  }

  const result = await sendEmail({
    to: project.clientEmail,
    cc: ccEmail || undefined,
    subject: template.subject,
    html: template.html,
  });

  if (result.success) {
    const ccInfo = ccEmail ? ` (CC: ${ccEmail})` : "";
    console.log(`[Email] Sent ${reminderType} reminder to ${project.clientEmail}${ccInfo} for payment ${payment.id}`);
    return { success: true, reminderType };
  } else {
    console.error(`[Email] Failed to send reminder to ${project.clientEmail}:`, result.error);
    return { success: false, error: result.error };
  }
}

interface PaymentReceiptContext {
  payment: Payment;
  project: Project;
  companyName: string;
}

function getPaymentReceiptTemplate(context: PaymentReceiptContext): { subject: string; html: string } {
  const { payment, project, companyName } = context;
  const formattedAmount = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(payment.receivedAmount || payment.expectedAmount));
  const receivedDate = payment.receivedDate 
    ? new Date(payment.receivedDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return {
    subject: `Payment Receipt Confirmation - ${project.name}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f3f4f6; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .card { background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden; }
          .header { background: linear-gradient(135deg, #059669 0%, #047857 100%); color: white; padding: 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
          .header .icon { font-size: 48px; margin-bottom: 15px; }
          .content { padding: 30px; }
          .success-badge { background: #d1fae5; color: #065f46; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: 600; display: inline-block; margin-bottom: 20px; }
          .receipt-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .receipt-table { width: 100%; border-collapse: collapse; }
          .receipt-table td { padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
          .receipt-table tr:last-child td { border-bottom: none; font-weight: 600; }
          .receipt-label { color: #6b7280; padding-right: 15px; }
          .receipt-value { color: #1f2937; font-weight: 500; text-align: right; }
          .amount-highlight { font-size: 28px; font-weight: 700; color: #059669; text-align: center; margin: 20px 0; }
          .stamp-container { text-align: center; margin: 25px 0; }
          .payment-stamp { display: inline-block; border: 4px solid #059669; border-radius: 12px; padding: 15px 25px; transform: rotate(-5deg); }
          .stamp-text { color: #059669; font-size: 18px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; }
          .stamp-company { color: #047857; font-size: 12px; font-weight: 600; margin-top: 5px; }
          .footer { padding: 20px 30px; background: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 14px; }
          p { margin: 0 0 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <div class="header">
              <div class="icon">✓</div>
              <h1>Payment Received</h1>
            </div>
            <div class="content">
              <span class="success-badge">Payment Confirmed</span>
              
              <p>Dear ${project.clientName || 'Valued Customer'},</p>
              
              <p>We are pleased to confirm that we have received your payment for <strong>${project.name}</strong>. Thank you for your prompt payment!</p>
              
              <div class="amount-highlight">${formattedAmount}</div>
              
              <div class="receipt-box">
                <table class="receipt-table">
                  <tr>
                    <td class="receipt-label">Project:</td>
                    <td class="receipt-value">${project.name}</td>
                  </tr>
                  <tr>
                    <td class="receipt-label">Payment Date:</td>
                    <td class="receipt-value">${receivedDate}</td>
                  </tr>
                  ${payment.narration ? `
                  <tr>
                    <td class="receipt-label">Description:</td>
                    <td class="receipt-value">${payment.narration}</td>
                  </tr>
                  ` : ''}
                  <tr>
                    <td class="receipt-label">Amount Received:</td>
                    <td class="receipt-value">${formattedAmount}</td>
                  </tr>
                </table>
              </div>
              
              <div class="stamp-container">
                <div class="payment-stamp">
                  <div class="stamp-text">Payment Received</div>
                  <div class="stamp-company">TekRevol</div>
                </div>
              </div>
              
              <p>This email serves as your official payment receipt confirmation. Please keep this for your records.</p>
              
              <p>If you have any questions about this payment or your account, please don't hesitate to contact us.</p>
              
              <p>Thank you for your continued partnership!</p>
            </div>
            <div class="footer">
              <p>This is an automated confirmation from TekRevol RMO.</p>
              <p>Please retain this email for your records.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
  };
}

export async function sendPaymentReceiptConfirmation(
  payment: Payment,
  project: Project,
  companyName: string,
  ccEmail?: string | null,
  receiptPdf?: { base64: string; fileName: string } | null
): Promise<{ success: boolean; error?: string }> {
  if (!project.clientEmail) {
    return { success: false, error: "Client email not configured for this project" };
  }

  const template = getPaymentReceiptTemplate({
    payment,
    project,
    companyName,
  });

  const attachments: EmailAttachment[] | undefined = receiptPdf?.base64
    ? [
        {
          filename: receiptPdf.fileName || "Payment-Receipt.pdf",
          content: receiptPdf.base64,
          encoding: "base64",
          contentType: "application/pdf",
        },
      ]
    : undefined;

  const result = await sendEmail({
    to: project.clientEmail,
    cc: ccEmail || undefined,
    subject: template.subject,
    html: template.html,
    attachments,
  });

  if (result.success) {
    const ccInfo = ccEmail ? ` (CC: ${ccEmail})` : "";
    console.log(`[Email] Sent payment receipt confirmation to ${project.clientEmail}${ccInfo} for payment ${payment.id}`);
    return { success: true };
  } else {
    console.error(`[Email] Failed to send receipt confirmation to ${project.clientEmail}:`, result.error);
    return { success: false, error: result.error };
  }
}

// ============== BUCKET STATUS NOTIFICATIONS ==============

interface BucketStatusNotificationContext {
  project: Project;
  pm: User;
  status: "warning" | "critical";
  utilizationPercent: number;
  consumedHours: number;
  availableHours: number;
  remainingHours: number;
}

function getBucketStatusEmailTemplate(context: BucketStatusNotificationContext): { subject: string; html: string } {
  const { project, pm, status, utilizationPercent, consumedHours, availableHours, remainingHours } = context;
  
  const statusColor = status === "critical" ? "#dc2626" : "#f59e0b";
  const statusLabel = status === "critical" ? "Critical" : "Warning";
  const statusIcon = status === "critical" ? "🚨" : "⚠️";
  
  const pmName = `${pm.firstName || ""} ${pm.lastName || ""}`.trim() || pm.email || "Project Manager";
  
  return {
    subject: `${statusIcon} Hourly Bucket ${statusLabel}: ${project.name}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Hourly Bucket ${statusLabel} Alert</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .card { background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow: hidden; }
          .header { background: ${statusColor}; color: white; padding: 24px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; }
          .content { padding: 24px; }
          .alert-badge { display: inline-block; background: ${statusColor}; color: white; padding: 6px 16px; border-radius: 20px; font-weight: 600; font-size: 14px; margin-bottom: 16px; }
          .project-name { font-size: 20px; font-weight: 600; color: #111; margin: 16px 0 8px; }
          .stats-grid { display: table; width: 100%; border-collapse: collapse; margin: 20px 0; }
          .stat-row { display: table-row; }
          .stat-label { display: table-cell; padding: 12px; border-bottom: 1px solid #eee; color: #666; font-size: 14px; width: 50%; }
          .stat-value { display: table-cell; padding: 12px; border-bottom: 1px solid #eee; font-weight: 600; text-align: right; font-size: 14px; }
          .utilization-bar { height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden; margin: 8px 0; }
          .utilization-fill { height: 100%; background: ${statusColor}; border-radius: 4px; }
          .footer { padding: 16px 24px; background: #f9fafb; border-top: 1px solid #eee; font-size: 12px; color: #666; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <div class="header">
              <h1>${statusIcon} Hourly Bucket ${statusLabel}</h1>
            </div>
            <div class="content">
              <p>Hi ${pmName},</p>
              
              <p>Your project has reached a <strong>${statusLabel.toLowerCase()}</strong> status in the Hourly Buckets module:</p>
              
              <div class="project-name">${project.name}</div>
              <span class="alert-badge">${statusLabel.toUpperCase()}</span>
              
              <div class="utilization-bar">
                <div class="utilization-fill" style="width: ${Math.min(utilizationPercent, 100)}%"></div>
              </div>
              
              <table class="stats-grid">
                <tr class="stat-row">
                  <td class="stat-label">Utilization</td>
                  <td class="stat-value">${utilizationPercent.toFixed(1)}%</td>
                </tr>
                <tr class="stat-row">
                  <td class="stat-label">Hours Consumed</td>
                  <td class="stat-value">${consumedHours.toFixed(1)} hrs</td>
                </tr>
                <tr class="stat-row">
                  <td class="stat-label">Total Available</td>
                  <td class="stat-value">${availableHours.toFixed(1)} hrs</td>
                </tr>
                <tr class="stat-row">
                  <td class="stat-label">Remaining Hours</td>
                  <td class="stat-value" style="color: ${remainingHours < 0 ? '#dc2626' : '#059669'}">${remainingHours.toFixed(1)} hrs</td>
                </tr>
              </table>
              
              <p>${status === "critical" 
                ? "This project has exceeded or is very close to exceeding its allocated hours. Immediate attention is required to prevent budget overruns." 
                : "This project is approaching its hour allocation limit. Please review the remaining hours and consider discussing with stakeholders."}</p>
              
              <p>Please review this project in the <a href="#" style="color: ${statusColor};">Cost & Margin</a> module and take appropriate action.</p>
            </div>
            <div class="footer">
              <p>This is an automated notification from TekRevol RMO.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
  };
}

export async function sendBucketStatusNotification(
  context: BucketStatusNotificationContext
): Promise<{ success: boolean; error?: string }> {
  // Check if email notifications are enabled
  const appSettingsData = await storage.getAppSettings();
  if (!appSettingsData?.enableEmailNotifications) {
    return { success: false, error: "Email notifications are disabled" };
  }
  
  // Check if specific bucket notifications are enabled
  if (context.status === "warning" && !appSettingsData.enableBucketWarningNotifications) {
    return { success: false, error: "Bucket warning notifications are disabled" };
  }
  if (context.status === "critical" && !appSettingsData.enableBucketCriticalNotifications) {
    return { success: false, error: "Bucket critical notifications are disabled" };
  }
  
  if (!context.pm.email) {
    return { success: false, error: "Project manager email not available" };
  }
  
  const template = getBucketStatusEmailTemplate(context);
  
  const result = await sendEmail({
    to: context.pm.email,
    subject: template.subject,
    html: template.html,
  });
  
  if (result.success) {
    console.log(`[Email] Sent bucket ${context.status} notification to ${context.pm.email} for project ${context.project.name}`);
    return { success: true };
  } else {
    console.error(`[Email] Failed to send bucket notification:`, result.error);
    return { success: false, error: result.error };
  }
}

// ============== TIMESHEET APPROVAL NOTIFICATIONS ==============

interface TimesheetApprovalNotificationContext {
  timesheet: {
    id: string;
    date: string | Date | null;
    hoursLogged: string;
    description: string | null;
  };
  project: Project;
  pm: User;
  resource?: { name: string } | null;
}

function getTimesheetApprovalEmailTemplate(context: TimesheetApprovalNotificationContext): { subject: string; html: string } {
  const { timesheet, project, pm, resource } = context;
  
  const pmName = `${pm.firstName || ""} ${pm.lastName || ""}`.trim() || pm.email || "Project Manager";
  const entryDate = timesheet.date ? formatDate(timesheet.date) : "N/A";
  const resourceName = resource?.name || "Team member";
  
  return {
    subject: `✅ Timesheet Approved: ${project.name} - ${entryDate}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Timesheet Entry Approved</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .card { background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow: hidden; }
          .header { background: #059669; color: white; padding: 24px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; }
          .content { padding: 24px; }
          .approved-badge { display: inline-block; background: #059669; color: white; padding: 6px 16px; border-radius: 20px; font-weight: 600; font-size: 14px; margin-bottom: 16px; }
          .project-name { font-size: 20px; font-weight: 600; color: #111; margin: 16px 0 8px; }
          .details-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          .details-table td { padding: 12px; border-bottom: 1px solid #eee; }
          .details-table .label { color: #666; font-size: 14px; width: 40%; }
          .details-table .value { font-weight: 600; text-align: right; font-size: 14px; }
          .footer { padding: 16px 24px; background: #f9fafb; border-top: 1px solid #eee; font-size: 12px; color: #666; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <div class="header">
              <h1>✅ Timesheet Entry Approved</h1>
            </div>
            <div class="content">
              <p>Hi ${pmName},</p>
              
              <p>A timesheet entry has been approved for your project:</p>
              
              <div class="project-name">${project.name}</div>
              <span class="approved-badge">APPROVED</span>
              
              <table class="details-table">
                <tr>
                  <td class="label">Date</td>
                  <td class="value">${entryDate}</td>
                </tr>
                <tr>
                  <td class="label">Resource</td>
                  <td class="value">${resourceName}</td>
                </tr>
                <tr>
                  <td class="label">Hours Logged</td>
                  <td class="value">${parseFloat(timesheet.hoursLogged).toFixed(1)} hrs</td>
                </tr>
                ${timesheet.description ? `
                <tr>
                  <td class="label">Description</td>
                  <td class="value">${timesheet.description}</td>
                </tr>
                ` : ""}
              </table>
              
              <p>This entry has been added to the project's hourly bucket calculations.</p>
            </div>
            <div class="footer">
              <p>This is an automated notification from TekRevol RMO.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
  };
}

export async function sendTimesheetApprovalNotification(
  context: TimesheetApprovalNotificationContext
): Promise<{ success: boolean; error?: string }> {
  // Check if email notifications are enabled
  const appSettingsData = await storage.getAppSettings();
  if (!appSettingsData?.enableEmailNotifications) {
    return { success: false, error: "Email notifications are disabled" };
  }
  
  if (!appSettingsData.enableTimesheetApprovalNotifications) {
    return { success: false, error: "Timesheet approval notifications are disabled" };
  }
  
  if (!context.pm.email) {
    return { success: false, error: "Project manager email not available" };
  }
  
  const template = getTimesheetApprovalEmailTemplate(context);
  
  const result = await sendEmail({
    to: context.pm.email,
    subject: template.subject,
    html: template.html,
  });
  
  if (result.success) {
    console.log(`[Email] Sent timesheet approval notification to ${context.pm.email} for project ${context.project.name}`);
    return { success: true };
  } else {
    console.error(`[Email] Failed to send timesheet approval notification:`, result.error);
    return { success: false, error: result.error };
  }
}

// Send missing signoff reminder to PM
export async function sendMissingSignoffReminder(
  pmEmail: string,
  pmName: string,
  projectName: string,
  phaseName: string
): Promise<EmailResult> {
  const template = {
    subject: `Action Required: Missing Signoff for ${projectName} - ${phaseName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f3f4f6; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .card { background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden; }
          .header { background: linear-gradient(135deg, #C22828 0%, #991b1b 100%); color: white; padding: 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
          .header .icon { font-size: 48px; margin-bottom: 15px; }
          .content { padding: 30px; }
          .alert-badge { background: #fef2f2; color: #991b1b; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: 600; display: inline-block; margin-bottom: 20px; }
          .info-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .info-table { width: 100%; border-collapse: collapse; }
          .info-table td { padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
          .info-table tr:last-child td { border-bottom: none; }
          .info-label { color: #6b7280; padding-right: 15px; }
          .info-value { color: #1f2937; font-weight: 500; text-align: right; }
          .cta-button { display: inline-block; background: #C22828; color: white !important; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 15px; }
          .footer { padding: 20px 30px; background: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 14px; }
          p { margin: 0 0 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <div class="header">
              <div class="icon">⚠️</div>
              <h1>Missing Signoff Reminder</h1>
            </div>
            <div class="content">
              <span class="alert-badge">Action Required</span>
              
              <p>Dear ${pmName},</p>
              
              <p>This is a reminder that the signoff for the following project phase is still pending. Payment has been received, but the customer signoff document has not been uploaded to the system.</p>
              
              <div class="info-box">
                <table class="info-table">
                  <tr>
                    <td class="info-label">Project:</td>
                    <td class="info-value">${projectName}</td>
                  </tr>
                  <tr>
                    <td class="info-label">Phase/Milestone:</td>
                    <td class="info-value">${phaseName}</td>
                  </tr>
                  <tr>
                    <td class="info-label">Status:</td>
                    <td class="info-value" style="color: #C22828;">Signoff Missing</td>
                  </tr>
                </table>
              </div>
              
              <p>Please ensure the signoff document is obtained from the customer and uploaded to the Document Repository as soon as possible.</p>
              
              <p>If you have already submitted the signoff or have any questions, please disregard this reminder.</p>
            </div>
            <div class="footer">
              <p>This is an automated reminder from RevolRMO.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  const result = await sendEmail({
    to: pmEmail,
    subject: template.subject,
    html: template.html,
  });

  if (result.success) {
    console.log(`[Email] Sent missing signoff reminder to ${pmEmail} for project ${projectName} - ${phaseName}`);
    return { success: true };
  } else {
    console.error(`[Email] Failed to send missing signoff reminder:`, result.error);
    return { success: false, error: result.error };
  }
}
