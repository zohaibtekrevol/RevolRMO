import { jsPDF } from "jspdf";
import "jspdf-autotable";
import { format } from "date-fns";
import type { PaymentWithProject, RegionBankingDetails, InvoiceWithDetails } from "@shared/schema";
import { TEKREVOL_LOGO_BASE64 } from "./tekrevol-logo";

interface InvoiceParams {
  payment: PaymentWithProject;
  banking: RegionBankingDetails;
  invoiceNumber: string;
  invoiceDate: string;
  description: string;
  notes: string;
  conversionRate?: number;
  isReceipt?: boolean;
  receivedDate?: string | Date | null;
}

interface InvoiceRecordParams {
  invoice: InvoiceWithDetails;
  banking: RegionBankingDetails;
}

const currencySymbolMap: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  AED: "AED ",
  CAD: "C$",
};

// USD to AED conversion rate (approximate fixed rate)
const USD_TO_AED_RATE = 3.67;

const formatCurrencyWithSymbol = (value: number | string | null, currency: string, decimals: boolean = true): string => {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (num === null || isNaN(num as number)) return `${currencySymbolMap[currency] || "$"}0.00`;
  const symbol = currencySymbolMap[currency] || "$";
  return `${symbol}${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  }).format(num as number)}`;
};

// ============ SHARED LETTERHEAD HELPERS ============
// Brand colors taken from the TEKREVOL letterhead.
const LETTERHEAD_DARK: [number, number, number] = [24, 24, 27];
const LETTERHEAD_RED: [number, number, number] = [227, 39, 32];
const LETTERHEAD_BAND_HEIGHT = 16;

// Lowest y body content may use before it would collide with the footer band.
function letterheadContentBottom(doc: jsPDF): number {
  return doc.internal.pageSize.getHeight() - LETTERHEAD_BAND_HEIGHT - 6;
}

// Returns a y position that has room for `neededHeight`; starts a new page if not.
function ensureLetterheadSpace(doc: jsPDF, yPos: number, neededHeight: number, topMargin = 15): number {
  if (yPos + neededHeight > letterheadContentBottom(doc)) {
    doc.addPage();
    return topMargin;
  }
  return yPos;
}

function drawLetterheadLogo(doc: jsPDF, margin: number, yPos: number, fallbackName?: string | null) {
  try {
    doc.addImage(TEKREVOL_LOGO_BASE64, "PNG", margin, yPos, 40, 20);
  } catch (e) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(100, 100, 100);
    doc.text(fallbackName || "TekRevol", margin, yPos + 10);
  }
}

function drawLetterheadFooter(doc: jsPDF) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const bandTop = pageHeight - LETTERHEAD_BAND_HEIGHT;

  // "Generated on" line sits just above the slim band in light grey.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`Generated on ${format(new Date(), "MMMM d, yyyy")}`, pageWidth / 2, bandTop - 4, { align: "center" });

  // Slim dark band across the bottom.
  doc.setFillColor(...LETTERHEAD_DARK);
  doc.rect(0, bandTop, pageWidth, LETTERHEAD_BAND_HEIGHT, "F");

  // Red diagonal accent in the bottom-right corner (letterhead look).
  doc.setFillColor(...LETTERHEAD_RED);
  doc.triangle(pageWidth - 34, pageHeight, pageWidth, pageHeight - LETTERHEAD_BAND_HEIGHT + 2, pageWidth, pageHeight, "F");

  // Billing query note centered in the band.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(235, 235, 235);
  doc.text("For any queries, please reach out to billing@tekrevol.com", pageWidth / 2, bandTop + LETTERHEAD_BAND_HEIGHT / 2 + 1.2, { align: "center" });
}

export function buildInvoiceDoc(params: InvoiceParams): jsPDF {
  const { payment, banking, invoiceNumber, invoiceDate, description, notes, isReceipt, receivedDate } = params;
  const usdToAedRate = params.conversionRate && params.conversionRate > 0 ? params.conversionRate : USD_TO_AED_RATE;
  
  const currency = banking.currency || "USD";
  const formatAmount = (value: number | string | null) => formatCurrencyWithSymbol(value, currency);
  
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const rightColX = pageWidth - margin - 70;
  let yPos = margin;

  // ============ HEADER SECTION ============
  // Check if this is an AE region invoice (for dual currency display)
  const isAERegion = payment.project?.region === "AE";
  
  // Add TekRevol logo on top left
  drawLetterheadLogo(doc, margin, yPos, banking.companyName);

  // Title - on right (PAYMENT RECEIPT in receipt mode, otherwise TAX INVOICE for AE region)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(33, 37, 41);
  doc.text(isReceipt ? "PAYMENT RECEIPT" : (isAERegion ? "TAX INVOICE" : "INVOICE"), pageWidth - margin, yPos + 10, { align: "right" });

  yPos += 22;
  
  // Invoice number on right
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(33, 37, 41);
  doc.text(`# ${invoiceNumber}`, pageWidth - margin, yPos, { align: "right" });

  // PAID badge + payment received line (receipt mode only)
  if (isReceipt) {
    const badgeText = "PAID";
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    const badgeTextWidth = doc.getTextWidth(badgeText);
    const badgePaddingX = 4;
    const badgeWidth = badgeTextWidth + badgePaddingX * 2;
    const badgeHeight = 7;
    const badgeY = yPos + 4;
    const badgeX = pageWidth - margin - badgeWidth;
    doc.setFillColor(34, 197, 94);
    doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 1.5, 1.5, "F");
    doc.setTextColor(255, 255, 255);
    doc.text(badgeText, badgeX + badgePaddingX, badgeY + 5);

    if (receivedDate) {
      const receivedFormatted = format(new Date(receivedDate), "MMMM d, yyyy 'at' h:mm a");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(34, 139, 70);
      doc.text(`Payment Received: ${receivedFormatted}`, pageWidth - margin, badgeY + badgeHeight + 6, { align: "right" });
      yPos += 8;
    } else {
      yPos += 6;
    }
  }

  yPos += 14;

  // ============ TWO COLUMN INFO SECTION ============
  // Left column: Invoice From
  const leftColStartY = yPos;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text("Invoice From:", margin, yPos);
  
  yPos += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(33, 37, 41);
  doc.text(banking.companyName || "FinanceFlow", margin, yPos);
  
  yPos += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  if (banking.companyAddress) {
    const addressLines = doc.splitTextToSize(banking.companyAddress, 85);
    doc.text(addressLines, margin, yPos);
    yPos += addressLines.length * 4.5;
  }

  // Right column: Invoice details
  let rightY = leftColStartY;
  const labelX = rightColX;
  const valueX = pageWidth - margin;
  
  const invoiceDateFormatted = invoiceDate ? format(new Date(invoiceDate), "EEEE, MMMM d, yyyy") : "-";
  const dueDate = payment.dueDate ? format(new Date(payment.dueDate), "EEEE, MMMM d, yyyy") : "-";
  
  // For AE region, show both USD and AED values
  const usdAmount = typeof payment.expectedAmount === "string" ? parseFloat(payment.expectedAmount) : (payment.expectedAmount || 0);
  const aedAmount = usdAmount * usdToAedRate;
  
  // VAT applies to AE region only (subtotal is the base amount, total includes VAT)
  const vatRate = isAERegion ? (parseFloat(payment.project?.vat || "0") || 0) : 0;
  const vatAmountUsd = usdAmount * vatRate / 100;
  const vatAmountAed = vatAmountUsd * usdToAedRate;
  const totalUsd = usdAmount + vatAmountUsd;
  const totalAed = totalUsd * usdToAedRate;
  
  const zeroBalance = isAERegion
    ? `${formatCurrencyWithSymbol(0, "USD")} / ${formatCurrencyWithSymbol(0, "AED")}`
    : formatAmount(0);
  const balanceDue = isReceipt
    ? zeroBalance
    : (isAERegion
      ? `${formatCurrencyWithSymbol(totalUsd, "USD")} / ${formatCurrencyWithSymbol(totalAed, "AED")}`
      : formatAmount(payment.expectedAmount));
  
  const rightDetails = isReceipt
    ? [
        { label: "Receipt Date:", value: invoiceDateFormatted },
        { label: "Payment Terms:", value: "100%" },
        { label: "Document Type:", value: "Payment Receipt" },
        { label: "Balance Due:", value: balanceDue, bold: true },
      ]
    : [
        { label: "Invoice Date:", value: invoiceDateFormatted },
        { label: "Payment Terms:", value: "100%" },
        { label: "Due Date:", value: dueDate },
        { label: "Invoice Type:", value: "ACH Wire Invoice" },
        { label: "Balance Due:", value: balanceDue, bold: true },
      ];

  doc.setFontSize(9);
  rightDetails.forEach((item) => {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(item.label, labelX, rightY);
    
    doc.setFont("helvetica", item.bold ? "bold" : "normal");
    doc.setTextColor(33, 37, 41);
    doc.text(item.value, valueX, rightY, { align: "right" });
    rightY += 7;
  });

  yPos = Math.max(yPos, rightY) + 8;

  // ============ INVOICE TO SECTION ============
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text("Invoice To:", margin, yPos);

  yPos += 6;

  if (isAERegion) {
    // ----- AE region: two-column "Invoice To" layout -----
    // Left = prominent client details panel, Right = tax / compliance details.
    const proj = payment.project;
    const businessName = proj?.clientBusinessName?.trim();
    const projectName = proj?.name || "Project";

    const sectionTop = yPos;

    // Column geometry
    const leftColX = margin;
    const rightColX = pageWidth / 2 + 5;
    const leftColWidth = rightColX - margin - 8;
    const rightColWidth = pageWidth - margin - rightColX;
    const padX = 4;
    const padY = 4;
    const innerLabelW = 33;

    // Build left-column detail rows (label/value), honoring hide & fallback rules.
    const leftRows: { label: string; value: string }[] = [];
    if (proj?.clientName) leftRows.push({ label: "Client Name:", value: proj.clientName });
    const clientAddress = proj?.clientAddress?.trim();
    if (clientAddress) leftRows.push({ label: "Client Address:", value: clientAddress });
    // Show Project Name separately only when the business name occupies the top
    // line, so we never duplicate the project name.
    if (businessName) leftRows.push({ label: "Project Name:", value: projectName });
    if (proj?.clientEmail) leftRows.push({ label: "Client Email:", value: proj.clientEmail });
    if (proj?.clientTrn) leftRows.push({ label: "Client TRN Number:", value: proj.clientTrn });

    // Render (or measure) the left client column; returns the ending y.
    const renderClientColumn = (startY: number, measureOnly: boolean): number => {
      let cy = startY + padY;
      const textX = leftColX + padX + 2; // +2 clears the accent bar
      // Prominent business name (falls back to project name when missing).
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      const bnLines = doc.splitTextToSize(businessName || projectName, leftColWidth - 2 * padX - 2);
      if (!measureOnly) {
        doc.setTextColor(33, 37, 41);
        doc.text(bnLines, textX, cy + 3.5);
      }
      cy += bnLines.length * 5.5 + 3;
      // Detail rows
      doc.setFontSize(9);
      for (const row of leftRows) {
        const vLines = doc.splitTextToSize(row.value, leftColWidth - 2 * padX - innerLabelW - 2);
        if (!measureOnly) {
          doc.setFont("helvetica", "bold");
          doc.setTextColor(110, 110, 110);
          doc.text(row.label, textX, cy);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(40, 40, 40);
          doc.text(vLines, textX + innerLabelW, cy);
        }
        cy += Math.max(1, vLines.length) * 4.6;
      }
      return cy + padY;
    };

    // Measure first so the background panel exactly fits the content.
    const leftEndY = renderClientColumn(sectionTop, true);
    const leftHeight = leftEndY - sectionTop;
    doc.setFillColor(247, 248, 250);
    doc.roundedRect(leftColX, sectionTop, leftColWidth, leftHeight, 1.5, 1.5, "F");
    doc.setFillColor(60, 64, 72);
    doc.rect(leftColX, sectionTop, 1.5, leftHeight, "F");
    renderClientColumn(sectionTop, false);

    // Right column: tax / compliance details.
    const aeRows: { label: string; value: string }[] = [];
    if (proj?.projectType) aeRows.push({ label: "Project Type:", value: proj.projectType });
    if (proj?.serviceType) aeRows.push({ label: "Service Type:", value: proj.serviceType });
    if (proj?.placeOfSupply) aeRows.push({ label: "Place of Supply:", value: proj.placeOfSupply === "inside_uae" ? "Inside UAE" : "Outside UAE" });
    if (proj?.placeOfSupply === "outside_uae" && proj?.supplyCountry) aeRows.push({ label: "Country:", value: proj.supplyCountry });
    if (proj?.placeOfSupply === "inside_uae" && proj?.supplyCity) aeRows.push({ label: "City:", value: proj.supplyCity });

    let ry = sectionTop + padY + 3.5;
    const rightLabelW = 33;
    doc.setFontSize(9);
    for (const row of aeRows) {
      const vLines = doc.splitTextToSize(row.value, rightColWidth - rightLabelW);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(110, 110, 110);
      doc.text(row.label, rightColX, ry);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(40, 40, 40);
      doc.text(vLines, rightColX + rightLabelW, ry);
      ry += Math.max(1, vLines.length) * 4.6;
    }

    yPos = Math.max(leftEndY, ry);
  } else {
    // ----- Non-AE region: original client details layout (unchanged) -----
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(33, 37, 41);
    doc.text(payment.project?.name || "Project", margin, yPos);

    yPos += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    if (payment.project?.clientName) {
      doc.text(`Client Details:    ${payment.project.clientName}`, margin, yPos);
      yPos += 4.5;
    }
    if (payment.project?.clientEmail) {
      doc.text(`Client Email:      ${payment.project.clientEmail}`, margin, yPos);
      yPos += 4.5;
    }
  }

  yPos += 10;

  // ============ LINE ITEMS TABLE ============
  // Table header
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, yPos - 3, pageWidth - 2 * margin, 10, "F");
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  
  const col1 = margin + 5;
  const col2 = margin + 90;
  const col3 = margin + 115;
  const col4 = pageWidth - margin - 5;
  
  doc.text("Milestone", col1, yPos + 4);
  doc.text("Quantity", col2, yPos + 4);
  doc.text("Rate", col3, yPos + 4);
  doc.text("Total", col4, yPos + 4, { align: "right" });
  
  yPos += 12;

  // Table row
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(33, 37, 41);
  
  // Description/Milestone - wrap text if needed
  const milestoneText = description || payment.project?.phase || "Services";
  const milestoneLines = doc.splitTextToSize(milestoneText, 80);
  doc.text(milestoneLines, col1, yPos);
  
  doc.text("1", col2, yPos);
  
  // For AE region, show both USD and AED in rate and total columns
  let extraRowHeight = 0;
  if (isAERegion) {
    doc.text(formatCurrencyWithSymbol(usdAmount, "USD"), col3, yPos);
    doc.text(formatCurrencyWithSymbol(usdAmount, "USD"), col4, yPos, { align: "right" });
    yPos += 5;
    extraRowHeight = 5;
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`(${formatCurrencyWithSymbol(aedAmount, "AED")})`, col3, yPos);
    doc.text(`(${formatCurrencyWithSymbol(aedAmount, "AED")})`, col4, yPos, { align: "right" });
    doc.setFontSize(9);
    doc.setTextColor(33, 37, 41);
  } else {
    doc.text(formatAmount(payment.expectedAmount), col3, yPos);
    doc.text(formatAmount(payment.expectedAmount), col4, yPos, { align: "right" });
  }
  
  yPos += milestoneLines.length * 5 + 10 + extraRowHeight;

  // ============ BANKING DETAILS & TOTALS SECTION ============
  // Draw separator line
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(margin, yPos - 5, pageWidth - margin, yPos - 5);
  
  // Banking Details on left
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(33, 37, 41);
  doc.text("Banking Details:", margin, yPos);
  
  yPos += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  
  const bankingStartY = yPos;
  const bankingDetails = [
    { label: "Title:", value: banking.accountName || banking.companyName || "-" },
    { label: "Bank:", value: banking.bankName || "-" },
  ];
  
  // Add Account/IBAN fields based on region
  // For AE region: accountNumber = AED IBAN, iban = USD IBAN
  // For TX/CA regions: accountNumber = actual account number, iban = standard IBAN
  if (isAERegion) {
    if (banking.iban) {
      bankingDetails.push({ label: "IBAN (USD):", value: banking.iban });
    }
    if (banking.accountNumber) {
      bankingDetails.push({ label: "IBAN (AED):", value: banking.accountNumber });
    }
  } else {
    if (banking.accountNumber) {
      bankingDetails.push({ label: "Account:", value: banking.accountNumber });
    }
    if (banking.iban) {
      bankingDetails.push({ label: "IBAN:", value: banking.iban });
    }
  }
  
  if (banking.swiftCode) {
    bankingDetails.push({ label: "Swift Code:", value: banking.swiftCode });
  }
  if (banking.routingNumber) {
    bankingDetails.push({ label: "Routing:", value: banking.routingNumber });
  }
  
  bankingDetails.forEach((item) => {
    doc.setFont("helvetica", "bold");
    doc.text(item.label, margin, yPos);
    doc.setFont("helvetica", "normal");
    // Use wider text area for banking values - render ALL lines
    const valueLines = doc.splitTextToSize(item.value, 70);
    valueLines.forEach((line: string, idx: number) => {
      doc.text(line, margin + 30, yPos + (idx * 4));
    });
    yPos += Math.max(valueLines.length * 4, 5.5);
  });
  
  // Add bank address if available
  if (banking.bankAddress) {
    yPos += 3;
    doc.setFont("helvetica", "bold");
    doc.text("Address:", margin, yPos);
    doc.setFont("helvetica", "normal");
    const addrLines = doc.splitTextToSize(banking.bankAddress, 70);
    doc.text(addrLines, margin + 30, yPos);
    yPos += addrLines.length * 4.5;
  }

  // Totals on right side
  const totalsX = pageWidth - margin - 60;
  const totalsValueX = pageWidth - margin;
  let totalsY = bankingStartY - 14;
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text("Subtotal:", totalsX, totalsY);
  doc.setTextColor(33, 37, 41);
  
  if (isAERegion) {
    doc.text(formatCurrencyWithSymbol(usdAmount, "USD"), totalsValueX, totalsY, { align: "right" });
    totalsY += 5;
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`(${formatCurrencyWithSymbol(aedAmount, "AED")})`, totalsValueX, totalsY, { align: "right" });
    doc.setFontSize(9);
  } else {
    doc.text(formatAmount(payment.expectedAmount), totalsValueX, totalsY, { align: "right" });
  }
  
  totalsY += 6;
  doc.setTextColor(100, 100, 100);
  doc.text(isAERegion ? "VAT (%):" : "Tax (%):", totalsX, totalsY);
  doc.setTextColor(33, 37, 41);
  doc.text(isAERegion ? `${vatRate}%` : "0%", totalsValueX, totalsY, { align: "right" });
  
  totalsY += 6;
  doc.setTextColor(100, 100, 100);
  doc.text(isAERegion ? "VAT Amount:" : "Tax Amount:", totalsX, totalsY);
  doc.setTextColor(33, 37, 41);
  if (isAERegion) {
    doc.text(formatCurrencyWithSymbol(vatAmountUsd, "USD"), totalsValueX, totalsY, { align: "right" });
    totalsY += 5;
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`(${formatCurrencyWithSymbol(vatAmountAed, "AED")})`, totalsValueX, totalsY, { align: "right" });
    doc.setFontSize(9);
  } else {
    doc.text("$0.00", totalsValueX, totalsY, { align: "right" });
  }
  
  totalsY += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(33, 37, 41);
  doc.text("Total:", totalsX, totalsY);
  
  if (isAERegion) {
    doc.text(formatCurrencyWithSymbol(totalUsd, "USD"), totalsValueX, totalsY, { align: "right" });
    totalsY += 5;
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(`(${formatCurrencyWithSymbol(totalAed, "AED")})`, totalsValueX, totalsY, { align: "right" });
    totalsY += 4.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    const rateLabel = parseFloat(usdToAedRate.toFixed(4)).toString();
    doc.text(`Conversion Rate: 1 USD = ${rateLabel} AED`, totalsValueX, totalsY, { align: "right" });
  } else {
    doc.text(formatAmount(payment.expectedAmount), totalsValueX, totalsY, { align: "right" });
  }

  // Receipt mode: show Amount Paid (full total) and a zeroed Balance Due
  if (isReceipt) {
    totalsY += 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(34, 139, 70);
    doc.text("Amount Paid:", totalsX, totalsY);
    if (isAERegion) {
      doc.text(formatCurrencyWithSymbol(totalUsd, "USD"), totalsValueX, totalsY, { align: "right" });
      totalsY += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(80, 80, 80);
      doc.text(`(${formatCurrencyWithSymbol(totalAed, "AED")})`, totalsValueX, totalsY, { align: "right" });
    } else {
      doc.text(formatAmount(payment.expectedAmount), totalsValueX, totalsY, { align: "right" });
    }

    totalsY += 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(33, 37, 41);
    doc.text("Balance Due:", totalsX, totalsY);
    if (isAERegion) {
      doc.text(formatCurrencyWithSymbol(0, "USD"), totalsValueX, totalsY, { align: "right" });
      totalsY += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(80, 80, 80);
      doc.text(`(${formatCurrencyWithSymbol(0, "AED")})`, totalsValueX, totalsY, { align: "right" });
    } else {
      doc.text(formatAmount(0), totalsValueX, totalsY, { align: "right" });
    }
  }

  yPos = Math.max(yPos, totalsY) + 8;

  // ============ PAYMENT TERMS FOOTER ============
  const defaultTerms = isReceipt
    ? "This receipt confirms that payment has been received in full. Thank you for your business."
    : "The invoice is due upon receipt.";
  const termsText = notes || defaultTerms;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const termsLines = doc.splitTextToSize(termsText, pageWidth - 2 * margin);
  // Keep the closing block above the letterhead footer band.
  yPos = ensureLetterheadSpace(doc, yPos, 6 + termsLines.length * 4.5 + 4, margin);

  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(margin, yPos - 5, pageWidth - margin, yPos - 5);
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(33, 37, 41);
  doc.text(isReceipt ? "Notes:" : "Payment Terms:", margin, yPos);
  
  yPos += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(termsLines, margin, yPos);

  // ============ LETTERHEAD FOOTER ============
  drawLetterheadFooter(doc);

  return doc;
}

export function invoiceFileName(params: Pick<InvoiceParams, "invoiceNumber" | "isReceipt">): string {
  return params.isReceipt ? `Receipt-${params.invoiceNumber}.pdf` : `${params.invoiceNumber}.pdf`;
}

export function generateInvoicePDF(params: InvoiceParams): void {
  const doc = buildInvoiceDoc(params);
  doc.save(invoiceFileName(params));
}

export function generateInvoicePDFBase64(params: InvoiceParams): string {
  const doc = buildInvoiceDoc(params);
  const dataUri = doc.output("datauristring");
  return dataUri.substring(dataUri.indexOf(",") + 1);
}

export function generateInvoiceFromRecord(params: InvoiceRecordParams): void {
  const { invoice, banking } = params;
  
  const currency = banking.currency || "USD";
  const formatAmount = (value: number | string | null) => formatCurrencyWithSymbol(value, currency);
  
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const rightColX = pageWidth - margin - 70;
  let yPos = margin;

  const isAERegion = invoice.region === "AE";
  
  drawLetterheadLogo(doc, margin, yPos, banking.companyName);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(33, 37, 41);
  doc.text(isAERegion ? "TAX INVOICE" : "INVOICE", pageWidth - margin, yPos + 10, { align: "right" });

  yPos += 22;
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(33, 37, 41);
  doc.text(`# ${invoice.invoiceNumber}`, pageWidth - margin, yPos, { align: "right" });

  yPos += 14;

  const leftColStartY = yPos;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text("Invoice From:", margin, yPos);
  
  yPos += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(33, 37, 41);
  doc.text(banking.companyName || "FinanceFlow", margin, yPos);
  
  yPos += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  if (banking.companyAddress) {
    const addressLines = doc.splitTextToSize(banking.companyAddress, 85);
    doc.text(addressLines, margin, yPos);
    yPos += addressLines.length * 4.5;
  }

  let rightY = leftColStartY;
  const labelX = rightColX;
  const valueX = pageWidth - margin;
  
  const invoiceDateFormatted = invoice.issueDate ? format(new Date(invoice.issueDate), "EEEE, MMMM d, yyyy") : "-";
  const dueDate = invoice.dueDate ? format(new Date(invoice.dueDate), "EEEE, MMMM d, yyyy") : "-";
  
  const usdAmount = typeof invoice.total === "string" ? parseFloat(invoice.total) : (invoice.total || 0);
  const aedAmount = usdAmount * USD_TO_AED_RATE;
  
  // For AE: subtotal is the base amount, total includes VAT
  const subtotalUsd = typeof invoice.subtotal === "string" ? parseFloat(invoice.subtotal) : (invoice.subtotal || 0);
  const subtotalAed = subtotalUsd * USD_TO_AED_RATE;
  const taxAmountUsd = typeof invoice.taxAmount === "string" ? parseFloat(invoice.taxAmount) : (invoice.taxAmount || 0);
  const taxAmountAed = taxAmountUsd * USD_TO_AED_RATE;
  
  const balanceDue = isAERegion 
    ? `${formatCurrencyWithSymbol(usdAmount, "USD")} / ${formatCurrencyWithSymbol(aedAmount, "AED")}`
    : formatAmount(invoice.total);
  
  const rightDetails = [
    { label: "Invoice Date:", value: invoiceDateFormatted },
    { label: "Payment Terms:", value: "100%" },
    { label: "Due Date:", value: dueDate },
    { label: "Invoice Type:", value: "ACH Wire Invoice" },
    { label: "Balance Due:", value: balanceDue, bold: true },
  ];
  
  for (const item of rightDetails) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(item.label, labelX, rightY);
    
    doc.setFont("helvetica", item.bold ? "bold" : "normal");
    doc.setFontSize(item.bold ? 10 : 9);
    doc.setTextColor(33, 37, 41);
    doc.text(item.value, valueX, rightY, { align: "right" });
    
    rightY += 6;
  }

  yPos = Math.max(yPos, rightY) + 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text("Invoice To:", margin, yPos);
  
  yPos += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(33, 37, 41);
  doc.text(invoice.clientName, margin, yPos);
  
  if (invoice.clientAddress) {
    yPos += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    const billToLines = doc.splitTextToSize(invoice.clientAddress, 85);
    doc.text(billToLines, margin, yPos);
    yPos += billToLines.length * 4.5;
  }

  // AE region tax details
  if (isAERegion) {
    const proj = invoice.project;
    const aeRows: { label: string; value: string }[] = [];
    if (proj?.projectType) aeRows.push({ label: "Project Type:", value: proj.projectType });
    if (proj?.serviceType) aeRows.push({ label: "Service Type:", value: proj.serviceType });
    if (proj?.placeOfSupply) aeRows.push({ label: "Place of Supply:", value: proj.placeOfSupply === "inside_uae" ? "Inside UAE" : "Outside UAE" });
    if (proj?.clientTrn) aeRows.push({ label: "Client TRN Number:", value: proj.clientTrn });
    if (proj?.placeOfSupply === "outside_uae" && proj?.supplyCountry) aeRows.push({ label: "Country:", value: proj.supplyCountry });
    if (proj?.placeOfSupply === "inside_uae" && proj?.supplyCity) aeRows.push({ label: "City:", value: proj.supplyCity });
    if (aeRows.length > 0) {
      yPos += 6;
      doc.setFontSize(9);
      aeRows.forEach((row) => {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(80, 80, 80);
        doc.text(row.label, margin, yPos);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(33, 37, 41);
        doc.text(row.value, margin + 35, yPos);
        yPos += 4.5;
      });
    }
  }

  yPos += 10;

  doc.setFillColor(245, 245, 245);
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 12, 2, 2, "FD");
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text("Description", margin + 5, yPos + 8);
  doc.text("Amount", pageWidth - margin - 5, yPos + 8, { align: "right" });
  
  yPos += 18;

  const lineItems = invoice.lineItems || [];
  if (lineItems.length > 0) {
    for (const item of lineItems) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(33, 37, 41);
      
      const descLines = doc.splitTextToSize(item.description, pageWidth - 2 * margin - 60);
      doc.text(descLines, margin + 5, yPos);
      
      const itemAmount = typeof item.amount === "string" ? parseFloat(item.amount) : item.amount;
      if (isAERegion) {
        const itemAed = itemAmount * USD_TO_AED_RATE;
        doc.text(`${formatCurrencyWithSymbol(itemAmount, "USD")} / ${formatCurrencyWithSymbol(itemAed, "AED")}`, pageWidth - margin - 5, yPos, { align: "right" });
      } else {
        doc.text(formatAmount(item.amount), pageWidth - margin - 5, yPos, { align: "right" });
      }
      
      yPos += Math.max(descLines.length * 5, 8);
    }
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(33, 37, 41);
    doc.text(invoice.project?.name || "Invoice for services", margin + 5, yPos);
    
    if (isAERegion) {
      doc.text(`${formatCurrencyWithSymbol(usdAmount, "USD")} / ${formatCurrencyWithSymbol(aedAmount, "AED")}`, pageWidth - margin - 5, yPos, { align: "right" });
    } else {
      doc.text(formatAmount(invoice.total), pageWidth - margin - 5, yPos, { align: "right" });
    }
    
    yPos += 8;
  }

  yPos += 10;
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(margin, yPos, pageWidth - margin, yPos);

  yPos += 12;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text("Bank Details:", margin, yPos);
  
  yPos += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(33, 37, 41);
  
  const bankDetails = [
    { label: "Account Name:", value: banking.accountName || "-" },
    { label: "Bank Name:", value: banking.bankName || "-" },
    { label: "Routing Number:", value: banking.routingNumber || "-" },
    { label: "Account Number:", value: banking.accountNumber || "-" },
    { label: "SWIFT Code:", value: banking.swiftCode || "-" },
  ];
  
  for (const detail of bankDetails) {
    if (detail.value && detail.value !== "-") {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(detail.label, margin + 5, yPos);
      doc.setTextColor(33, 37, 41);
      doc.text(detail.value, margin + 45, yPos);
      yPos += 5;
    }
  }

  const totalsX = pageWidth - margin - 60;
  const totalsValueX = pageWidth - margin;
  let totalsY = yPos - 35;
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text("Sub-Total:", totalsX, totalsY);
  doc.setTextColor(33, 37, 41);
  
  if (isAERegion) {
    doc.text(formatCurrencyWithSymbol(subtotalUsd, "USD"), totalsValueX, totalsY, { align: "right" });
    totalsY += 5;
    doc.setTextColor(80, 80, 80);
    doc.text(`(${formatCurrencyWithSymbol(subtotalAed, "AED")})`, totalsValueX, totalsY, { align: "right" });
    totalsY += 5;
  } else {
    doc.text(formatAmount(invoice.subtotal), totalsValueX, totalsY, { align: "right" });
  }
  
  totalsY += 7;
  doc.setTextColor(100, 100, 100);
  doc.text(isAERegion ? "VAT (%):" : "Tax (%):", totalsX, totalsY);
  doc.setTextColor(33, 37, 41);
  doc.text(`${invoice.taxRate || 0}%`, totalsValueX, totalsY, { align: "right" });
  
  totalsY += 7;
  doc.setTextColor(100, 100, 100);
  doc.text(isAERegion ? "VAT Amount:" : "Tax Amount:", totalsX, totalsY);
  doc.setTextColor(33, 37, 41);
  if (isAERegion) {
    doc.text(formatCurrencyWithSymbol(taxAmountUsd, "USD"), totalsValueX, totalsY, { align: "right" });
    totalsY += 5;
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`(${formatCurrencyWithSymbol(taxAmountAed, "AED")})`, totalsValueX, totalsY, { align: "right" });
    doc.setFontSize(9);
  } else {
    doc.text(formatAmount(invoice.taxAmount), totalsValueX, totalsY, { align: "right" });
  }
  
  totalsY += 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(33, 37, 41);
  doc.text("Total:", totalsX, totalsY);
  
  if (isAERegion) {
    doc.text(formatCurrencyWithSymbol(usdAmount, "USD"), totalsValueX, totalsY, { align: "right" });
    totalsY += 6;
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(`(${formatCurrencyWithSymbol(aedAmount, "AED")})`, totalsValueX, totalsY, { align: "right" });
  } else {
    doc.text(formatAmount(invoice.total), totalsValueX, totalsY, { align: "right" });
  }

  yPos = Math.max(yPos, totalsY) + 12;

  const termsText = invoice.notes || "The invoice is due upon receipt.";
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const termsLines = doc.splitTextToSize(termsText, pageWidth - 2 * margin);
  // Keep the closing block above the letterhead footer band.
  yPos = ensureLetterheadSpace(doc, yPos, 6 + termsLines.length * 4.5 + 4, margin);

  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(margin, yPos - 5, pageWidth - margin, yPos - 5);
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(33, 37, 41);
  doc.text("Payment Terms:", margin, yPos);
  
  yPos += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(termsLines, margin, yPos);

  drawLetterheadFooter(doc);

  doc.save(`${invoice.invoiceNumber}.pdf`);
}

export function generateReceiptPDF(params: InvoiceRecordParams): void {
  const { invoice, banking } = params;
  
  const currency = banking.currency || "USD";
  const formatAmount = (value: number | string | null) => formatCurrencyWithSymbol(value, currency);
  
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const rightColX = pageWidth - margin - 70;
  let yPos = margin;

  const isAERegion = invoice.region === "AE";
  
  // Add TekRevol logo
  drawLetterheadLogo(doc, margin, yPos, banking.companyName);

  // PAYMENT RECEIPT title - on right
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(33, 37, 41);
  doc.text("PAYMENT RECEIPT", pageWidth - margin, yPos + 10, { align: "right" });

  yPos += 22;
  
  // Invoice/Receipt number
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(33, 37, 41);
  doc.text(`# ${invoice.invoiceNumber}`, pageWidth - margin, yPos, { align: "right" });

  // PAID badge next to receipt number
  yPos += 6;
  doc.setFillColor(34, 197, 94); // Green background
  const paidBadgeWidth = 40;
  const paidBadgeHeight = 12;
  doc.roundedRect(pageWidth - margin - paidBadgeWidth, yPos - 3, paidBadgeWidth, paidBadgeHeight, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text("PAID", pageWidth - margin - paidBadgeWidth / 2, yPos + 5, { align: "center" });

  yPos += 14;

  // Two Column Info Section
  const leftColStartY = yPos;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text("Receipt From:", margin, yPos);
  
  yPos += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(33, 37, 41);
  doc.text(banking.companyName || "FinanceFlow", margin, yPos);
  
  yPos += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  if (banking.companyAddress) {
    const addressLines = doc.splitTextToSize(banking.companyAddress, 85);
    doc.text(addressLines, margin, yPos);
    yPos += addressLines.length * 4.5;
  }

  // Right column: Receipt details
  let rightY = leftColStartY;
  const labelX = rightColX;
  const valueX = pageWidth - margin;
  
  const invoiceDateFormatted = invoice.issueDate ? format(new Date(invoice.issueDate), "EEEE, MMMM d, yyyy") : "-";
  const paidDateFormatted = invoice.paidDate ? format(new Date(invoice.paidDate), "EEEE, MMMM d, yyyy") : format(new Date(), "EEEE, MMMM d, yyyy");
  
  const usdAmount = typeof invoice.total === "string" ? parseFloat(invoice.total) : (invoice.total || 0);
  const aedAmount = usdAmount * USD_TO_AED_RATE;
  
  const amountPaid = isAERegion 
    ? `${formatCurrencyWithSymbol(usdAmount, "USD")} / ${formatCurrencyWithSymbol(aedAmount, "AED")}`
    : formatAmount(invoice.total);
  
  const rightDetails = [
    { label: "Invoice Date:", value: invoiceDateFormatted },
    { label: "Payment Date:", value: paidDateFormatted },
    { label: "Payment Method:", value: "ACH Wire Transfer" },
    { label: "Amount Paid:", value: amountPaid, bold: true },
    { label: "Balance Due:", value: "$0.00", bold: true },
  ];
  
  for (const item of rightDetails) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(item.label, labelX, rightY);
    
    doc.setFont("helvetica", item.bold ? "bold" : "normal");
    doc.setFontSize(item.bold ? 10 : 9);
    if (item.label === "Balance Due:") {
      doc.setTextColor(34, 197, 94); // Green for $0.00 balance
    } else {
      doc.setTextColor(33, 37, 41);
    }
    doc.text(item.value, valueX, rightY, { align: "right" });
    
    rightY += 6;
  }

  yPos = Math.max(yPos, rightY) + 10;

  // Receipt To Section
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text("Receipt To:", margin, yPos);
  
  yPos += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(33, 37, 41);
  doc.text(invoice.clientName, margin, yPos);
  
  if (invoice.clientAddress) {
    yPos += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    const billToLines = doc.splitTextToSize(invoice.clientAddress, 85);
    doc.text(billToLines, margin, yPos);
    yPos += billToLines.length * 4.5;
  }

  yPos += 10;

  // Line Items Table Header
  doc.setFillColor(245, 245, 245);
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 12, 2, 2, "FD");
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text("Description", margin + 5, yPos + 8);
  doc.text("Amount", pageWidth - margin - 5, yPos + 8, { align: "right" });
  
  yPos += 18;

  // Line Items
  const lineItems = invoice.lineItems || [];
  if (lineItems.length > 0) {
    for (const item of lineItems) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(33, 37, 41);
      
      const descLines = doc.splitTextToSize(item.description, pageWidth - 2 * margin - 60);
      doc.text(descLines, margin + 5, yPos);
      
      const itemAmount = typeof item.amount === "string" ? parseFloat(item.amount) : item.amount;
      if (isAERegion) {
        const itemAed = itemAmount * USD_TO_AED_RATE;
        doc.text(`${formatCurrencyWithSymbol(itemAmount, "USD")} / ${formatCurrencyWithSymbol(itemAed, "AED")}`, pageWidth - margin - 5, yPos, { align: "right" });
      } else {
        doc.text(formatAmount(item.amount), pageWidth - margin - 5, yPos, { align: "right" });
      }
      
      yPos += Math.max(descLines.length * 5, 8);
    }
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(33, 37, 41);
    doc.text(invoice.project?.name || "Payment for services", margin + 5, yPos);
    
    if (isAERegion) {
      doc.text(`${formatCurrencyWithSymbol(usdAmount, "USD")} / ${formatCurrencyWithSymbol(aedAmount, "AED")}`, pageWidth - margin - 5, yPos, { align: "right" });
    } else {
      doc.text(formatAmount(invoice.total), pageWidth - margin - 5, yPos, { align: "right" });
    }
    
    yPos += 8;
  }

  yPos += 10;
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(margin, yPos, pageWidth - margin, yPos);

  yPos += 12;

  // Bank Details section (left side)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text("Payment Details:", margin, yPos);
  
  yPos += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(33, 37, 41);
  
  const bankDetails = [
    { label: "Account Name:", value: banking.accountName || "-" },
    { label: "Bank Name:", value: banking.bankName || "-" },
    { label: "Routing Number:", value: banking.routingNumber || "-" },
    { label: "Account Number:", value: banking.accountNumber || "-" },
    { label: "SWIFT Code:", value: banking.swiftCode || "-" },
  ];
  
  for (const detail of bankDetails) {
    if (detail.value && detail.value !== "-") {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(detail.label, margin + 5, yPos);
      doc.setTextColor(33, 37, 41);
      doc.text(detail.value, margin + 45, yPos);
      yPos += 5;
    }
  }

  // Totals on right side
  const totalsX = pageWidth - margin - 60;
  const totalsValueX = pageWidth - margin;
  let totalsY = yPos - 35;
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text("Sub-Total:", totalsX, totalsY);
  doc.setTextColor(33, 37, 41);
  
  if (isAERegion) {
    doc.text(formatCurrencyWithSymbol(usdAmount, "USD"), totalsValueX, totalsY, { align: "right" });
    totalsY += 5;
    doc.setTextColor(80, 80, 80);
    doc.text(`(${formatCurrencyWithSymbol(aedAmount, "AED")})`, totalsValueX, totalsY, { align: "right" });
    totalsY += 5;
  } else {
    doc.text(formatAmount(invoice.subtotal), totalsValueX, totalsY, { align: "right" });
  }
  
  totalsY += 7;
  doc.setTextColor(100, 100, 100);
  doc.text("Tax (%):", totalsX, totalsY);
  doc.setTextColor(33, 37, 41);
  doc.text(`${invoice.taxRate || 0}%`, totalsValueX, totalsY, { align: "right" });
  
  totalsY += 7;
  doc.setTextColor(100, 100, 100);
  doc.text("Tax Amount:", totalsX, totalsY);
  doc.setTextColor(33, 37, 41);
  doc.text(formatAmount(invoice.taxAmount), totalsValueX, totalsY, { align: "right" });
  
  totalsY += 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(33, 37, 41);
  doc.text("Total Paid:", totalsX, totalsY);
  
  if (isAERegion) {
    doc.text(formatCurrencyWithSymbol(usdAmount, "USD"), totalsValueX, totalsY, { align: "right" });
    totalsY += 6;
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(`(${formatCurrencyWithSymbol(aedAmount, "AED")})`, totalsValueX, totalsY, { align: "right" });
  } else {
    doc.text(formatAmount(invoice.total), totalsValueX, totalsY, { align: "right" });
  }

  totalsY += 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(34, 197, 94); // Green
  doc.text("Balance Due:", totalsX, totalsY);
  doc.text("$0.00", totalsValueX, totalsY, { align: "right" });

  yPos = Math.max(yPos, totalsY) + 12;

  // Payment confirmation message
  const confirmText = `This receipt confirms that full payment of ${amountPaid} has been received for invoice ${invoice.invoiceNumber}. Thank you for your payment.`;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const confirmLines = doc.splitTextToSize(confirmText, pageWidth - 2 * margin);
  // Keep the closing block above the letterhead footer band.
  yPos = ensureLetterheadSpace(doc, yPos, 6 + confirmLines.length * 4.5 + 4, margin);

  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(margin, yPos - 5, pageWidth - margin, yPos - 5);
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(34, 197, 94);
  doc.text("Payment Confirmed", margin, yPos);
  
  yPos += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(confirmLines, margin, yPos);

  // Letterhead footer
  drawLetterheadFooter(doc);

  doc.save(`Receipt-${invoice.invoiceNumber}.pdf`);
}
