import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface PaymentReportData {
  id: string;
  projectName: string;
  clientName: string;
  region: string;
  pmName: string;
  paymentType: string;
  expectedAmount: string | number;
  receivedAmount: string | number;
  receivedDate: string | Date;
  narration?: string;
}

interface RegionSummary {
  region: string;
  upsell: number;
  recurring: number;
  total: number;
}

interface GrandTotal {
  upsell: number;
  recurring: number;
  total: number;
}

interface PaymentsReportPDFOptions {
  startDate: Date;
  endDate: Date;
  paymentType: string;
  payments: PaymentReportData[];
  regionSummary: RegionSummary[];
  grandTotal: GrandTotal;
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

function getPaymentTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    upsell: "Upsell",
    recurring: "Recurring",
  };
  return labels[type] || type;
}

export function generatePaymentsReportPDF(options: PaymentsReportPDFOptions): void {
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
    doc.setFontSize(32);
    doc.setFont("helvetica", "bold");
    doc.text("Monthly Financial", margin, currentY);
    
    currentY += 10;
    doc.setFontSize(14);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.gray);
    doc.text("R E P O R T", margin, currentY);
    
    currentY += 15;
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.dark);
    doc.text(`Reporting Period: ${formatMonthYear(options.startDate)} - ${formatMonthYear(options.endDate)}`, margin, currentY);
    currentY += 5;
    doc.text(`Date: ${formatDate(options.generatedAt)}`, margin, currentY);
    
    currentY += 15;
  };

  const drawExecutiveSummary = () => {
    doc.setTextColor(...COLORS.primary);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Executive Summary", margin, currentY);
    
    currentY += 8;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.gray);
    
    const paymentTypeLabel = options.paymentType === "all" 
      ? "upsell and recurring payments" 
      : `${getPaymentTypeLabel(options.paymentType).toLowerCase()} payments`;
    
    const summaryText = `In ${formatMonthYear(options.startDate)}, RevolRMO demonstrated robust financial performance with ${paymentTypeLabel} collected totaling ${formatCurrency(options.grandTotal.total)}. This report provides an in-depth analysis of payment metrics, regional categories, and collection performance across ${options.payments.length} transactions.`;
    
    const lines = doc.splitTextToSize(summaryText, pageWidth - margin * 2);
    doc.text(lines, margin, currentY);
    currentY += lines.length * 5 + 10;
  };

  const drawRegionBreakdown = () => {
    doc.setTextColor(...COLORS.primary);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Key Revenue Breakdown", margin, currentY);
    currentY += 10;
    
    if (options.regionSummary.length === 0) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(...COLORS.gray);
      doc.text("No regional data available for this period.", margin, currentY);
      currentY += 15;
      return;
    }
    
    const maxTotal = Math.max(...options.regionSummary.map(r => r.total));
    const barMaxWidth = 100;
    const barHeight = 14;
    const barSpacing = 20;
    
    options.regionSummary.forEach((region) => {
      const barWidth = maxTotal > 0 ? (region.total / maxTotal) * barMaxWidth : 0;
      const percentage = options.grandTotal.total > 0 
        ? Math.round((region.total / options.grandTotal.total) * 100) 
        : 0;
      
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.dark);
      doc.text(getRegionFullName(region.region), margin, currentY + 9);
      
      doc.setFillColor(...COLORS.red);
      doc.roundedRect(margin + 40, currentY + 2, barWidth, barHeight, 1, 1, "F");
      
      doc.setFontSize(9);
      doc.setTextColor(...COLORS.white);
      if (barWidth > 30) {
        doc.text(formatCurrency(region.total), margin + 43, currentY + 11);
      }
      
      doc.setTextColor(...COLORS.gray);
      doc.text(`${percentage}%`, margin + 40 + barWidth + 5, currentY + 11);
      
      currentY += barSpacing;
    });
    
    currentY += 5;
  };

  const drawPerformanceTable = () => {
    doc.setTextColor(...COLORS.primary);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Sales Performance by Region", margin, currentY);
    currentY += 8;
    
    const tableData = options.regionSummary.map(region => [
      getRegionFullName(region.region),
      formatCurrency(region.recurring),
      formatCurrency(region.upsell),
      formatCurrency(region.total),
    ]);
    
    tableData.push([
      "Total",
      formatCurrency(options.grandTotal.recurring),
      formatCurrency(options.grandTotal.upsell),
      formatCurrency(options.grandTotal.total),
    ]);
    
    autoTable(doc, {
      startY: currentY,
      head: [["Category", "Recurring", "Upsell", "Total"]],
      body: tableData,
      theme: "plain",
      headStyles: {
        fillColor: COLORS.orange,
        textColor: COLORS.white,
        fontStyle: "bold",
        fontSize: 9,
        cellPadding: 5,
        halign: "center",
      },
      bodyStyles: {
        fontSize: 9,
        textColor: COLORS.dark,
        cellPadding: 4,
        halign: "center",
      },
      alternateRowStyles: {
        fillColor: COLORS.grayLight,
      },
      columnStyles: {
        0: { halign: "left", cellWidth: 50 },
        1: { halign: "right", cellWidth: 40 },
        2: { halign: "right", cellWidth: 40 },
        3: { halign: "right", cellWidth: 40, fontStyle: "bold" },
      },
      margin: { left: margin, right: margin },
      didParseCell: (data) => {
        if (data.row.index === tableData.length - 1 && data.section === "body") {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = COLORS.orangeLight;
        }
      },
    });
    
    currentY = (doc as any).lastAutoTable.finalY + 15;
  };

  const drawFinancialHighlights = () => {
    if (currentY > pageHeight - 80) {
      doc.addPage();
      currentY = margin;
    }
    
    doc.setTextColor(...COLORS.primary);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Financial Highlights", margin, currentY);
    currentY += 12;
    
    const highlights = [
      {
        title: `${formatCurrency(options.grandTotal.total)} collected`,
        description: `in total revenue from ${options.payments.length} payments during the reporting period`,
        color: COLORS.orange,
      },
      {
        title: `${formatCurrency(options.grandTotal.upsell)} in upsells`,
        description: "from project expansions and additional services driving growth",
        color: COLORS.red,
      },
      {
        title: `${formatCurrency(options.grandTotal.recurring)} recurring`,
        description: "stable monthly revenue from ongoing contracts and retainers",
        color: COLORS.orange,
      },
    ];
    
    highlights.forEach((highlight) => {
      doc.setFillColor(...highlight.color);
      doc.circle(margin + 6, currentY - 2, 5, "F");
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...highlight.color);
      doc.text(highlight.title, margin + 16, currentY);
      
      currentY += 5;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.gray);
      doc.text(highlight.description, margin + 16, currentY);
      
      currentY += 12;
    });
    
    currentY += 5;
  };

  const drawConclusion = () => {
    if (currentY > pageHeight - 60) {
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
    
    const conclusionText = `${formatMonthYear(options.startDate)} was a strong period for RevolRMO, marked by significant revenue collection, improved payment performance, and effective regional management. Continued focus on upsell opportunities and recurring revenue will be crucial for sustaining this positive trajectory.`;
    
    const lines = doc.splitTextToSize(conclusionText, pageWidth - margin * 2);
    doc.text(lines, margin, currentY);
    currentY += lines.length * 5 + 10;
  };

  const drawPaymentDetailsTable = () => {
    if (options.payments.length === 0) {
      return;
    }
    
    if (currentY > pageHeight - 60) {
      doc.addPage();
      currentY = margin;
    }
    
    doc.setTextColor(...COLORS.primary);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`Payment Details (${options.payments.length} records)`, margin, currentY);
    currentY += 8;
    
    const paymentRows = options.payments.slice(0, 15).map(p => [
      formatDate(p.receivedDate),
      p.projectName.length > 25 ? p.projectName.substring(0, 22) + "..." : p.projectName,
      p.region,
      getPaymentTypeLabel(p.paymentType),
      formatCurrency(p.receivedAmount || p.expectedAmount),
    ]);
    
    autoTable(doc, {
      startY: currentY,
      head: [["Date", "Project", "Region", "Type", "Amount"]],
      body: paymentRows,
      theme: "plain",
      headStyles: {
        fillColor: COLORS.orange,
        textColor: COLORS.white,
        fontStyle: "bold",
        fontSize: 9,
        cellPadding: 5,
        halign: "center",
      },
      bodyStyles: {
        fontSize: 8,
        textColor: COLORS.dark,
        cellPadding: 4,
      },
      alternateRowStyles: {
        fillColor: COLORS.grayLight,
      },
      columnStyles: {
        0: { cellWidth: 28, halign: "center" },
        1: { cellWidth: 70 },
        2: { cellWidth: 22, halign: "center" },
        3: { cellWidth: 25, halign: "center" },
        4: { cellWidth: 30, halign: "right", fontStyle: "bold" },
      },
      margin: { left: margin, right: margin },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 3) {
          const type = options.payments[data.row.index]?.paymentType;
          if (type === "upsell") {
            data.cell.styles.textColor = COLORS.orange;
          } else if (type === "recurring") {
            data.cell.styles.textColor = COLORS.red;
          }
        }
      },
    });
    
    currentY = (doc as any).lastAutoTable.finalY + 10;
    
    if (options.payments.length > 15) {
      doc.setFontSize(8);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(...COLORS.gray);
      doc.text(`+ ${options.payments.length - 15} more payment records`, margin, currentY);
    }
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
      doc.text(" | RevolRMO", margin + doc.getTextWidth("TekRevol"), pageHeight - 7);
      
      const pageText = `Page ${i} of ${totalPages}`;
      doc.text(pageText, pageWidth - margin - doc.getTextWidth(pageText), pageHeight - 7);
      
      const genText = formatDate(options.generatedAt);
      doc.text(genText, pageWidth / 2 - doc.getTextWidth(genText) / 2, pageHeight - 7);
    }
  };

  drawHeader();
  drawExecutiveSummary();
  drawRegionBreakdown();
  drawPerformanceTable();
  drawFinancialHighlights();
  drawConclusion();
  drawPaymentDetailsTable();
  drawFooter();

  const startStr = options.startDate.toISOString().split("T")[0];
  const endStr = options.endDate.toISOString().split("T")[0];
  const filename = `RevolRMO-Payments-Report-${startStr}-to-${endStr}`;
  doc.save(`${filename}.pdf`);
}
