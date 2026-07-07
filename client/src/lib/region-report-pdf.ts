import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface PaymentItem {
  id: string;
  projectName: string;
  clientName: string;
  clientEmail: string;
  pmName: string;
  paymentType: string;
  status: string;
  expectedAmount: string;
  receivedAmount: string;
  invoiceDate: string | null;
  dueDate: string | null;
  receivedDate: string | null;
  month: number;
  year: number;
  narration?: string;
}

interface RegionReportPDFOptions {
  region: string;
  startDate: Date;
  endDate: Date;
  totals: {
    received: number;
    missed: number;
    recurring: number;
    upsell: number;
  };
  counts: {
    received: number;
    missed: number;
    recurring: number;
    upsell: number;
  };
  paymentsReceived: PaymentItem[];
  paymentsMissed: PaymentItem[];
  generatedAt: Date;
}

const COLORS = {
  primary: [0, 0, 0] as [number, number, number],
  primaryDark: [30, 30, 30] as [number, number, number],
  orange: [240, 90, 40] as [number, number, number],
  orangeLight: [255, 237, 227] as [number, number, number],
  red: [200, 50, 50] as [number, number, number],
  redLight: [255, 235, 238] as [number, number, number],
  gray: [100, 100, 100] as [number, number, number],
  grayLight: [245, 245, 245] as [number, number, number],
  grayMedium: [200, 200, 200] as [number, number, number],
  dark: [40, 40, 40] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  footerBg: [45, 45, 45] as [number, number, number],
};

function formatCurrency(value: number | string | null | undefined): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (num === null || num === undefined || isNaN(num as number)) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num as number);
}

function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "-";
  try {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "-";
  }
}

function formatMonthYear(date: Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function getRegionFullName(region: string): string {
  const regionNames: Record<string, string> = {
    CA: "California",
    TX: "Texas",
    AE: "UAE",
  };
  return regionNames[region] || region;
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    not_targeting: "Not Targeting",
    pending_invoice: "Pending Invoice",
    invoiced: "Invoiced",
    received: "Received",
  };
  return labels[status] || status;
}

export function generateRegionReportPDF(options: RegionReportPDFOptions): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let currentY = margin;

  const drawHeader = () => {
    doc.setTextColor(...COLORS.orange);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("TekRevol", margin, currentY);
    
    currentY += 15;
    
    doc.setTextColor(...COLORS.primary);
    doc.setFontSize(28);
    doc.setFont("helvetica", "bold");
    doc.text("Region Insights", margin, currentY);
    
    currentY += 8;
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.gray);
    doc.text("R E P O R T", margin, currentY);
    
    currentY += 12;
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.dark);
    doc.text(`Region: ${getRegionFullName(options.region)}`, margin, currentY);
    currentY += 5;
    doc.text(`Period: ${formatMonthYear(options.startDate)} - ${formatMonthYear(options.endDate)}`, margin, currentY);
    
    currentY += 12;
  };

  const drawSummaryMetrics = () => {
    doc.setTextColor(...COLORS.primary);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Key Metrics", margin, currentY);
    currentY += 10;
    
    const cardWidth = (pageWidth - margin * 2 - 15) / 4;
    const cardHeight = 40;
    
    const metrics = [
      { 
        label: "Total Received", 
        value: formatCurrency(options.totals.received), 
        subValue: `${options.counts.received} payments`,
        color: COLORS.primary, 
        bg: COLORS.grayLight 
      },
      { 
        label: "Missed Payments", 
        value: formatCurrency(options.totals.missed), 
        subValue: `${options.counts.missed} payments`,
        color: COLORS.red, 
        bg: COLORS.redLight 
      },
      { 
        label: "Recurring", 
        value: formatCurrency(options.totals.recurring), 
        subValue: `${options.counts.recurring} payments`,
        color: COLORS.orange, 
        bg: COLORS.orangeLight 
      },
      { 
        label: "Upsells", 
        value: formatCurrency(options.totals.upsell), 
        subValue: `${options.counts.upsell} payments`,
        color: COLORS.red, 
        bg: COLORS.redLight 
      },
    ];
    
    metrics.forEach((metric, index) => {
      const x = margin + index * (cardWidth + 5);
      
      doc.setFillColor(...metric.bg);
      doc.roundedRect(x, currentY, cardWidth, cardHeight, 2, 2, "F");
      
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.gray);
      doc.text(metric.label, x + 6, currentY + 10);
      
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...metric.color);
      doc.text(metric.value, x + 6, currentY + 23);
      
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.gray);
      doc.text(metric.subValue, x + 6, currentY + 33);
    });
    
    currentY += cardHeight + 15;
  };

  const drawBreakdownChart = () => {
    doc.setTextColor(...COLORS.primary);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Revenue Breakdown", margin, currentY);
    currentY += 10;
    
    const total = options.totals.received + options.totals.missed;
    if (total === 0) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(...COLORS.gray);
      doc.text("No payment data available for this period.", margin, currentY);
      currentY += 15;
      return;
    }
    
    const barHeight = 16;
    const barWidth = pageWidth - margin * 2;
    
    const categories = [
      { label: "Received", value: options.totals.received, color: COLORS.orange },
      { label: "Missed", value: options.totals.missed, color: COLORS.red },
    ];
    
    categories.forEach((cat) => {
      const percentage = Math.round((cat.value / total) * 100);
      const fillWidth = (cat.value / total) * (barWidth - 90);
      
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.dark);
      doc.text(cat.label, margin, currentY + 10);
      
      doc.setFillColor(...COLORS.grayLight);
      doc.roundedRect(margin + 40, currentY + 2, barWidth - 130, barHeight, 2, 2, "F");
      
      if (fillWidth > 0) {
        doc.setFillColor(...cat.color);
        doc.roundedRect(margin + 40, currentY + 2, fillWidth, barHeight, 2, 2, "F");
      }
      
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.gray);
      doc.text(`${percentage}%`, margin + barWidth - 85, currentY + 12);
      doc.text(formatCurrency(cat.value), margin + barWidth - 55, currentY + 12);
      
      currentY += barHeight + 8;
    });
    
    currentY += 8;
  };

  const drawReceivedTable = () => {
    if (options.paymentsReceived.length === 0) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(...COLORS.gray);
      doc.text("No payments received in this period.", margin, currentY);
      currentY += 15;
      return;
    }
    
    doc.setTextColor(...COLORS.primary);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`Payments Received (${options.paymentsReceived.length})`, margin, currentY);
    currentY += 10;
    
    const rows = options.paymentsReceived.slice(0, 10).map(p => [
      formatDate(p.receivedDate),
      p.projectName.length > 22 ? p.projectName.substring(0, 19) + "..." : p.projectName,
      p.paymentType === "upsell" ? "Upsell" : "Recurring",
      formatCurrency(p.expectedAmount),
      formatCurrency(p.receivedAmount),
    ]);
    
    autoTable(doc, {
      startY: currentY,
      head: [["Date", "Project", "Type", "Expected", "Received"]],
      body: rows,
      theme: "plain",
      headStyles: {
        fillColor: COLORS.orange,
        textColor: COLORS.white,
        fontStyle: "bold",
        fontSize: 9,
        cellPadding: 4,
        halign: "center",
      },
      bodyStyles: {
        fontSize: 8,
        textColor: COLORS.dark,
        cellPadding: 3,
        halign: "center",
      },
      alternateRowStyles: {
        fillColor: COLORS.grayLight,
      },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 55, halign: "left" },
        2: { cellWidth: 25 },
        3: { cellWidth: 30, halign: "right" },
        4: { cellWidth: 30, halign: "right", fontStyle: "bold" },
      },
      margin: { left: margin, right: margin },
    });
    
    currentY = (doc as any).lastAutoTable.finalY + 8;
    
    if (options.paymentsReceived.length > 10) {
      doc.setFontSize(8);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(...COLORS.gray);
      doc.text(`+ ${options.paymentsReceived.length - 10} more received payments`, margin, currentY);
      currentY += 8;
    }
  };

  const drawMissedTable = () => {
    if (options.paymentsMissed.length === 0) {
      return;
    }
    
    if (currentY > pageHeight - 60) {
      doc.addPage();
      currentY = margin;
    }
    
    doc.setTextColor(...COLORS.primary);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`Outstanding Payments (${options.paymentsMissed.length})`, margin, currentY);
    currentY += 10;
    
    const rows = options.paymentsMissed.slice(0, 10).map(p => [
      formatDate(p.dueDate),
      p.projectName.length > 20 ? p.projectName.substring(0, 17) + "..." : p.projectName,
      getStatusLabel(p.status),
      p.paymentType === "upsell" ? "Upsell" : "Recurring",
      formatCurrency(p.expectedAmount),
    ]);
    
    autoTable(doc, {
      startY: currentY,
      head: [["Due Date", "Project", "Status", "Type", "Expected"]],
      body: rows,
      theme: "plain",
      headStyles: {
        fillColor: COLORS.red,
        textColor: COLORS.white,
        fontStyle: "bold",
        fontSize: 9,
        cellPadding: 4,
        halign: "center",
      },
      bodyStyles: {
        fontSize: 8,
        textColor: COLORS.dark,
        cellPadding: 3,
        halign: "center",
      },
      alternateRowStyles: {
        fillColor: COLORS.redLight,
      },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 50, halign: "left" },
        2: { cellWidth: 35 },
        3: { cellWidth: 25 },
        4: { cellWidth: 30, halign: "right", fontStyle: "bold" },
      },
      margin: { left: margin, right: margin },
    });
    
    currentY = (doc as any).lastAutoTable.finalY + 10;
  };

  const drawSummarySection = () => {
    if (currentY > pageHeight - 55) {
      doc.addPage();
      currentY = margin;
    }
    
    const halfWidth = (pageWidth - margin * 2 - 10) / 2;
    
    doc.setFillColor(...COLORS.orangeLight);
    doc.roundedRect(margin, currentY, halfWidth, 40, 3, 3, "F");
    
    doc.setFillColor(...COLORS.orange);
    doc.circle(margin + 12, currentY + 14, 5, "F");
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.orange);
    doc.text("Collection Rate", margin + 22, currentY + 16);
    
    const collectionRate = options.totals.received + options.totals.missed > 0
      ? Math.round((options.totals.received / (options.totals.received + options.totals.missed)) * 100)
      : 0;
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.gray);
    const rateText = `${collectionRate}% of expected payments were collected.`;
    doc.text(rateText, margin + 10, currentY + 30);
    
    doc.setFillColor(...COLORS.redLight);
    doc.roundedRect(margin + halfWidth + 10, currentY, halfWidth, 40, 3, 3, "F");
    
    doc.setFillColor(...COLORS.red);
    doc.circle(margin + halfWidth + 22, currentY + 14, 5, "F");
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.red);
    doc.text("Upsell Performance", margin + halfWidth + 32, currentY + 16);
    
    const upsellRate = options.counts.received > 0
      ? Math.round((options.counts.upsell / options.counts.received) * 100)
      : 0;
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.gray);
    const upsellText = `${upsellRate}% were upsells (${formatCurrency(options.totals.upsell)})`;
    doc.text(upsellText, margin + halfWidth + 20, currentY + 30);
    
    currentY += 50;
  };

  const drawConclusion = () => {
    if (currentY > pageHeight - 50) {
      doc.addPage();
      currentY = margin;
    }
    
    doc.setTextColor(...COLORS.primary);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Conclusion", margin, currentY);
    currentY += 8;
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.gray);
    
    const conclusionText = `${formatMonthYear(options.startDate)} was a productive period for the ${getRegionFullName(options.region)} region, with ${formatCurrency(options.totals.received)} in total collections. Continued focus on reducing outstanding payments and driving upsell opportunities will be crucial for sustaining growth.`;
    
    const lines = doc.splitTextToSize(conclusionText, pageWidth - margin * 2);
    doc.text(lines, margin, currentY);
    currentY += lines.length * 5 + 10;
  };

  const drawFooter = () => {
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      
      doc.setFillColor(...COLORS.footerBg);
      doc.rect(0, pageHeight - 18, pageWidth, 18, "F");
      
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...COLORS.white);
      doc.text("TekRevol", margin, pageHeight - 7);
      
      doc.setFont("helvetica", "normal");
      const regionText = ` | RevolRMO`;
      doc.text(regionText, margin + doc.getTextWidth("TekRevol"), pageHeight - 7);
      
      const pageText = `Page ${i} of ${totalPages}`;
      doc.text(pageText, pageWidth - margin - doc.getTextWidth(pageText), pageHeight - 7);
      
      const dateText = `${formatDate(options.startDate)} - ${formatDate(options.endDate)}`;
      doc.text(dateText, pageWidth / 2 - doc.getTextWidth(dateText) / 2, pageHeight - 7);
    }
  };

  drawHeader();
  drawSummaryMetrics();
  drawBreakdownChart();
  drawReceivedTable();
  drawMissedTable();
  drawSummarySection();
  drawConclusion();
  drawFooter();

  const startStr = options.startDate.toISOString().split("T")[0];
  const endStr = options.endDate.toISOString().split("T")[0];
  const filename = `RevolRMO-Region-Report-${options.region}-${startStr}-to-${endStr}`;
  doc.save(`${filename}.pdf`);
}
