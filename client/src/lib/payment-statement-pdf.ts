import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { TEKREVOL_LOGO_BASE64 } from "@shared/tekrevol-logo";

// ============ TYPES ============
export interface StatementProject {
  id: string;
  name: string;
  clientName: string;
  clientBusinessName: string;
  clientEmail: string;
  clientAddress: string;
  region: string;
  pmName: string;
  pmEmail: string;
  totalCost: string;
  billingType: string | null;
}

export interface StatementEntry {
  id: string;
  source: "payment" | "milestone" | "installment";
  type: "recurring" | "upsell" | "milestone";
  description: string;
  invoiceNumber: string | null;
  invoiceStatus: string | null;
  status: string;
  date: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  receivedDate: string | null;
  debit: number;
  credit: number;
  balance: number;
}

export interface StatementSummary {
  totalCharged: number;
  totalReceived: number;
  outstanding: number;
  entryCount: number;
}

export interface PaymentStatementPDFOptions {
  project: StatementProject;
  entries: StatementEntry[];
  summary: StatementSummary;
  dateRange?: { start: string | null; end: string | null };
  generatedAt: Date;
}

// ============ BRAND CONSTANTS (matched to the TEKREVOL letterhead) ============
const LETTERHEAD_DARK: [number, number, number] = [24, 24, 27];
const LETTERHEAD_RED: [number, number, number] = [227, 39, 32];
const LETTERHEAD_BAND_HEIGHT = 16;
const INK: [number, number, number] = [33, 37, 41];
const SLATE: [number, number, number] = [100, 100, 100];
const LINE: [number, number, number] = [224, 226, 230];
const PANEL: [number, number, number] = [247, 248, 250];
const GREEN: [number, number, number] = [22, 130, 86];
const RED: [number, number, number] = [196, 55, 55];
const AMBER: [number, number, number] = [180, 83, 9];

// Public-facing label for each statement line type. Upsell payments are always
// presented as "Additional Services" — clients never see the word "Upsell".
const TYPE_LABELS: Record<StatementEntry["type"], string> = {
  recurring: "Recurring",
  upsell: "Additional Services",
  milestone: "Milestone",
};

function formatCurrency(value: number | string | null | undefined): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (num === null || num === undefined || isNaN(num as number)) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num as number);
}

function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "-";
  try {
    return format(new Date(date), "MMM d, yyyy");
  } catch {
    return "-";
  }
}

function getRegionFullName(region: string): string {
  const names: Record<string, string> = { CA: "California", TX: "Texas", AE: "UAE" };
  return names[region] || region;
}

// Friendly, client-appropriate status label. Prefers the invoice status when an
// invoice exists; otherwise falls back to the internal payment/milestone status.
function statusLabel(entry: StatementEntry): string {
  const raw = entry.invoiceStatus || entry.status;
  const labels: Record<string, string> = {
    draft: "Draft",
    sent: "Sent",
    paid: "Paid",
    overdue: "Overdue",
    cancelled: "Cancelled",
    partial: "Partially Paid",
    not_targeting: "Not Invoiced",
    pending_invoice: "Pending Invoice",
    invoiced: "Invoiced",
    received: "Paid",
    partially_paid: "Partially Paid",
  };
  return labels[raw] || raw;
}

function drawLetterheadFooter(doc: jsPDF) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const bandTop = pageHeight - LETTERHEAD_BAND_HEIGHT;

  doc.setFillColor(...LETTERHEAD_DARK);
  doc.rect(0, bandTop, pageWidth, LETTERHEAD_BAND_HEIGHT, "F");

  doc.setFillColor(...LETTERHEAD_RED);
  doc.triangle(
    pageWidth - 34,
    pageHeight,
    pageWidth,
    pageHeight - LETTERHEAD_BAND_HEIGHT + 2,
    pageWidth,
    pageHeight,
    "F",
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(235, 235, 235);
  doc.text(
    "For any queries, please reach out to billing@tekrevol.com",
    pageWidth / 2,
    bandTop + LETTERHEAD_BAND_HEIGHT / 2 + 1.2,
    { align: "center" },
  );
}

export function generatePaymentStatementPDF(options: PaymentStatementPDFOptions): void {
  const { project, entries, summary } = options;
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let yPos = margin;

  // ============ HEADER ============
  try {
    doc.addImage(TEKREVOL_LOGO_BASE64, "PNG", margin, yPos, 40, 20);
  } catch {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...SLATE);
    doc.text("TekRevol", margin, yPos + 12);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...INK);
  doc.text("STATEMENT OF ACCOUNT", pageWidth - margin, yPos + 9, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...SLATE);
  doc.text(`Statement Date: ${formatDate(options.generatedAt)}`, pageWidth - margin, yPos + 16, {
    align: "right",
  });
  if (options.dateRange?.start || options.dateRange?.end) {
    const rangeText = `Period: ${formatDate(options.dateRange.start)} – ${formatDate(options.dateRange.end)}`;
    doc.text(rangeText, pageWidth - margin, yPos + 21, { align: "right" });
    yPos += 5;
  }

  yPos += 30;

  // ============ BILL TO / PROJECT META ============
  const sectionTop = yPos;
  const colGap = 8;
  const colW = (pageWidth - margin * 2 - colGap) / 2;

  // Left: Bill To panel
  const billLines: { label: string; value: string }[] = [];
  if (project.clientName) billLines.push({ label: "Attn:", value: project.clientName });
  if (project.clientAddress) billLines.push({ label: "Address:", value: project.clientAddress });
  if (project.clientEmail) billLines.push({ label: "Email:", value: project.clientEmail });

  const renderBillTo = (measureOnly: boolean): number => {
    const padX = 5;
    const padY = 5;
    let cy = sectionTop + padY;
    const textX = margin + padX + 2;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    if (!measureOnly) {
      doc.setTextColor(...SLATE);
      doc.text("BILL TO", textX, cy + 2);
    }
    cy += 6;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    const headLines = doc.splitTextToSize(project.clientBusinessName || project.clientName || "Client", colW - 2 * padX - 2);
    if (!measureOnly) {
      doc.setTextColor(...INK);
      doc.text(headLines, textX, cy + 3.5);
    }
    cy += headLines.length * 5 + 2;

    doc.setFontSize(8.5);
    for (const row of billLines) {
      const vLines = doc.splitTextToSize(row.value, colW - 2 * padX - 18 - 2);
      if (!measureOnly) {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...SLATE);
        doc.text(row.label, textX, cy);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(60, 60, 60);
        doc.text(vLines, textX + 18, cy);
      }
      cy += Math.max(1, vLines.length) * 4.4;
    }
    return cy + padY;
  };

  const billEndY = renderBillTo(true);

  // Right: project meta rows
  const metaRows: { label: string; value: string }[] = [
    { label: "Project:", value: project.name },
    { label: "Region:", value: getRegionFullName(project.region) },
    { label: "Account Manager:", value: project.pmName },
    { label: "Contract Value:", value: formatCurrency(project.totalCost) },
  ];
  let metaY = sectionTop + 5 + 3.5;
  const metaEndYStart = metaY;
  for (const row of metaRows) {
    metaY += 5.4;
  }
  const metaEndY = metaY;

  const panelHeight = Math.max(billEndY, metaEndY + 2) - sectionTop;

  // Draw the Bill To background + accent, then the text on top.
  doc.setFillColor(...PANEL);
  doc.roundedRect(margin, sectionTop, colW, panelHeight, 1.5, 1.5, "F");
  doc.setFillColor(...LETTERHEAD_DARK);
  doc.rect(margin, sectionTop, 1.6, panelHeight, "F");
  renderBillTo(false);

  // Right-column meta text
  const metaX = margin + colW + colGap;
  let ry = metaEndYStart;
  doc.setFontSize(9);
  for (const row of metaRows) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...SLATE);
    doc.text(row.label, metaX, ry);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...INK);
    const vLines = doc.splitTextToSize(row.value, colW - 36);
    doc.text(vLines[0] || row.value, metaX + 34, ry);
    ry += 5.4;
  }

  yPos = sectionTop + panelHeight + 10;

  // ============ SUMMARY CHIPS ============
  const chipGap = 5;
  const chipW = (pageWidth - margin * 2 - chipGap * 2) / 3;
  const chipH = 18;
  const chips = [
    { label: "TOTAL CHARGED", value: formatCurrency(summary.totalCharged), color: INK },
    { label: "TOTAL RECEIVED", value: formatCurrency(summary.totalReceived), color: GREEN },
    { label: "BALANCE DUE", value: formatCurrency(summary.outstanding), color: summary.outstanding > 0.005 ? RED : GREEN },
  ];
  chips.forEach((chip, i) => {
    const x = margin + i * (chipW + chipGap);
    doc.setDrawColor(...LINE);
    doc.setFillColor(...PANEL);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, yPos, chipW, chipH, 1.5, 1.5, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...SLATE);
    doc.text(chip.label, x + 5, yPos + 6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...chip.color);
    doc.text(chip.value, x + 5, yPos + 14);
  });

  yPos += chipH + 10;

  // ============ STATEMENT TABLE ============
  const body = entries.map(e => [
    formatDate(e.date),
    e.description || TYPE_LABELS[e.type],
    e.invoiceNumber || "-",
    formatDate(e.receivedDate),
    statusLabel(e),
    e.debit ? formatCurrency(e.debit) : "-",
    e.credit ? formatCurrency(e.credit) : "-",
    formatCurrency(e.balance),
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [["Date", "Description", "Invoice #", "Received", "Status", "Debit", "Credit", "Balance"]],
    body: body.length > 0 ? body : [["-", "No transactions for the selected filters.", "", "", "", "", "", ""]],
    foot: [[
      "",
      "Totals",
      "",
      "",
      "",
      formatCurrency(summary.totalCharged),
      formatCurrency(summary.totalReceived),
      formatCurrency(summary.outstanding),
    ]],
    theme: "grid",
    styles: { font: "helvetica", lineColor: LINE, lineWidth: 0.2, fontSize: 8, cellPadding: 2.5 },
    headStyles: {
      fillColor: LETTERHEAD_DARK,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
      cellPadding: 3,
      lineColor: LETTERHEAD_DARK,
    },
    bodyStyles: { textColor: INK, valign: "middle" },
    footStyles: {
      fillColor: PANEL,
      textColor: INK,
      fontStyle: "bold",
      fontSize: 8.5,
      lineColor: LINE,
    },
    alternateRowStyles: { fillColor: [251, 251, 252] },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: "auto" },
      2: { cellWidth: 24 },
      3: { cellWidth: 22 },
      4: { cellWidth: 22 },
      5: { cellWidth: 22, halign: "right" },
      6: { cellWidth: 22, halign: "right" },
      7: { cellWidth: 24, halign: "right", fontStyle: "bold" },
    },
    margin: { left: margin, right: margin, bottom: LETTERHEAD_BAND_HEIGHT + 8 },
    didParseCell: (data) => {
      if (data.section === "foot" && data.column.index >= 5) {
        data.cell.styles.halign = "right";
      }
      if (data.section === "body") {
        const item = entries[data.row.index];
        if (!item) return;
        if (data.column.index === 6 && item.credit > 0) {
          data.cell.styles.textColor = GREEN;
        }
        if (data.column.index === 4) {
          const raw = item.invoiceStatus || item.status;
          if (raw === "partially_paid" || raw === "partial") {
            data.cell.styles.textColor = AMBER;
            data.cell.styles.fontStyle = "bold";
          }
        }
      }
    },
  });

  // ============ FOOTER ON EVERY PAGE ============
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Page ${i} of ${totalPages}`,
      pageWidth - margin,
      pageHeight - LETTERHEAD_BAND_HEIGHT - 4,
      { align: "right" },
    );
    doc.text(
      "RevolRMO · Confidential",
      margin,
      pageHeight - LETTERHEAD_BAND_HEIGHT - 4,
    );
    drawLetterheadFooter(doc);
  }

  const safeName = (project.clientBusinessName || project.name).replace(/[^a-zA-Z0-9]/g, "-").substring(0, 30);
  const dateStr = new Date().toISOString().split("T")[0];
  doc.save(`Statement-of-Account-${safeName}-${dateStr}.pdf`);
}
