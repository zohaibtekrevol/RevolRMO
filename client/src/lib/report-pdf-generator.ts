import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ReportData, Region } from "@shared/schema";

interface ReportPDFOptions {
  title: string;
  reportType: "daily" | "weekly" | "monthly" | "yearly";
  month?: string;
  year: string;
  generatedAt: Date;
  filters?: {
    region?: string;
    pmName?: string;
  };
}

interface ExtendedReportData extends ReportData {
  byStatus?: { status: string; count: number; amount: number }[];
  totalTarget?: number;
  collectionRate?: number;
  monthlyTrend?: { month: string; received: number; target: number }[];
}

const COLORS = {
  primary: [37, 99, 235] as [number, number, number],
  primaryLight: [219, 234, 254] as [number, number, number],
  success: [22, 163, 74] as [number, number, number],
  successLight: [220, 252, 231] as [number, number, number],
  warning: [234, 179, 8] as [number, number, number],
  warningLight: [254, 249, 195] as [number, number, number],
  danger: [220, 38, 38] as [number, number, number],
  dangerLight: [254, 226, 226] as [number, number, number],
  gray: [107, 114, 128] as [number, number, number],
  grayLight: [243, 244, 246] as [number, number, number],
  dark: [31, 41, 55] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return "0%";
  return `${value.toFixed(1)}%`;
}

function getRegionFullName(region: Region): string {
  const regionNames: Record<Region, string> = {
    CA: "California",
    TX: "Texas",
    AE: "UAE",
  };
  return regionNames[region] || region;
}

export function generateReportPDF(
  data: ExtendedReportData,
  options: ReportPDFOptions
): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let currentY = margin;

  const drawHeader = () => {
    doc.setFillColor(...COLORS.primary);
    doc.rect(0, 0, pageWidth, 40, "F");

    doc.setTextColor(...COLORS.white);
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("FinanceFlow", margin, 18);

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("Financial Report", margin, 28);

    doc.setFontSize(10);
    const dateText = `Generated: ${options.generatedAt.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })}`;
    const dateWidth = doc.getTextWidth(dateText);
    doc.text(dateText, pageWidth - margin - dateWidth, 18);

    doc.setTextColor(...COLORS.dark);
    currentY = 50;
  };

  const drawReportTitle = () => {
    doc.setFillColor(...COLORS.grayLight);
    doc.roundedRect(margin, currentY, pageWidth - margin * 2, 24, 3, 3, "F");

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.dark);
    doc.text(options.title, margin + 8, currentY + 15);

    if (options.filters?.region || options.filters?.pmName) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.gray);
      const filters: string[] = [];
      if (options.filters.region) filters.push(`Region: ${options.filters.region}`);
      if (options.filters.pmName) filters.push(`PM: ${options.filters.pmName}`);
      const filterText = filters.join(" | ");
      const filterWidth = doc.getTextWidth(filterText);
      doc.text(filterText, pageWidth - margin - 8 - filterWidth, currentY + 15);
    }

    currentY += 32;
  };

  const drawKPICards = () => {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.dark);
    doc.text("Executive Summary", margin, currentY);
    currentY += 8;

    const cardWidth = (pageWidth - margin * 2 - 12) / 3;
    const cardHeight = 38;

    const totalTarget = data.totalTarget || 0;
    const totalReceived = data.summary.totalReceived || 0;
    const collectionRate = totalTarget > 0 ? (totalReceived / totalTarget) * 100 : 0;

    const kpiData = [
      {
        label: "Total Received",
        value: formatCurrency(totalReceived),
        color: COLORS.success,
        bgColor: COLORS.successLight,
      },
      {
        label: "Total Pending",
        value: formatCurrency(data.summary.totalPending),
        color: COLORS.warning,
        bgColor: COLORS.warningLight,
      },
      {
        label: "Total Invoiced",
        value: formatCurrency(data.summary.totalInvoiced),
        color: COLORS.primary,
        bgColor: COLORS.primaryLight,
      },
    ];

    kpiData.forEach((kpi, index) => {
      const x = margin + index * (cardWidth + 6);

      doc.setFillColor(...kpi.bgColor);
      doc.roundedRect(x, currentY, cardWidth, cardHeight, 3, 3, "F");

      doc.setFillColor(...kpi.color);
      doc.rect(x, currentY, 4, cardHeight, "F");

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.gray);
      doc.text(kpi.label, x + 10, currentY + 12);

      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...kpi.color);
      doc.text(kpi.value, x + 10, currentY + 28);
    });

    currentY += cardHeight + 8;

    const secondRowKPI = [
      {
        label: "Collection Rate",
        value: formatPercent(collectionRate),
        color: collectionRate >= 80 ? COLORS.success : collectionRate >= 50 ? COLORS.warning : COLORS.danger,
        bgColor: collectionRate >= 80 ? COLORS.successLight : collectionRate >= 50 ? COLORS.warningLight : COLORS.dangerLight,
      },
      {
        label: "Total Target",
        value: formatCurrency(totalTarget),
        color: COLORS.primary,
        bgColor: COLORS.primaryLight,
      },
      {
        label: "Outstanding",
        value: formatCurrency((data.summary.totalPending || 0) + (data.summary.totalInvoiced || 0)),
        color: COLORS.warning,
        bgColor: COLORS.warningLight,
      },
    ];

    secondRowKPI.forEach((kpi, index) => {
      const x = margin + index * (cardWidth + 6);

      doc.setFillColor(...kpi.bgColor);
      doc.roundedRect(x, currentY, cardWidth, cardHeight, 3, 3, "F");

      doc.setFillColor(...kpi.color);
      doc.rect(x, currentY, 4, cardHeight, "F");

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.gray);
      doc.text(kpi.label, x + 10, currentY + 12);

      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...kpi.color);
      doc.text(kpi.value, x + 10, currentY + 28);
    });

    currentY += cardHeight + 16;
  };

  const drawRegionalBreakdown = () => {
    if (!data.summary.byRegion || data.summary.byRegion.length === 0) return;

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.dark);
    doc.text("Regional Breakdown", margin, currentY);
    currentY += 6;

    const totalAmount = data.summary.byRegion.reduce((sum, r) => sum + r.amount, 0);

    const regionRows = data.summary.byRegion.map((region) => {
      const percentage = totalAmount > 0 ? (region.amount / totalAmount) * 100 : 0;
      return [
        getRegionFullName(region.region),
        region.region,
        formatCurrency(region.amount),
        formatPercent(percentage),
      ];
    });

    regionRows.push([
      "Total",
      "",
      formatCurrency(totalAmount),
      "100%",
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [["Region", "Code", "Amount", "% of Total"]],
      body: regionRows,
      theme: "striped",
      headStyles: {
        fillColor: COLORS.primary,
        textColor: COLORS.white,
        fontStyle: "bold",
        fontSize: 9,
      },
      bodyStyles: {
        fontSize: 9,
        textColor: COLORS.dark,
      },
      alternateRowStyles: {
        fillColor: COLORS.grayLight,
      },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 25, halign: "center" },
        2: { cellWidth: 45, halign: "right" },
        3: { cellWidth: 35, halign: "right" },
      },
      margin: { left: margin, right: margin },
      didParseCell: (data) => {
        if (data.row.index === regionRows.length - 1) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = COLORS.primaryLight;
        }
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 16;
  };

  const drawPMPerformance = () => {
    if (!data.summary.byPM || data.summary.byPM.length === 0) return;

    if (currentY > pageHeight - 80) {
      doc.addPage();
      currentY = margin;
    }

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.dark);
    doc.text("Project Manager Performance", margin, currentY);
    currentY += 6;

    const totalAmount = data.summary.byPM.reduce((sum, pm) => sum + pm.amount, 0);

    const pmRows = data.summary.byPM
      .sort((a, b) => b.amount - a.amount)
      .map((pm, index) => {
        const percentage = totalAmount > 0 ? (pm.amount / totalAmount) * 100 : 0;
        return [
          String(index + 1),
          pm.pmName,
          formatCurrency(pm.amount),
          formatPercent(percentage),
        ];
      });

    pmRows.push([
      "",
      "Total",
      formatCurrency(totalAmount),
      "100%",
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [["Rank", "Project Manager", "Amount Received", "% of Total"]],
      body: pmRows,
      theme: "striped",
      headStyles: {
        fillColor: COLORS.primary,
        textColor: COLORS.white,
        fontStyle: "bold",
        fontSize: 9,
      },
      bodyStyles: {
        fontSize: 9,
        textColor: COLORS.dark,
      },
      alternateRowStyles: {
        fillColor: COLORS.grayLight,
      },
      columnStyles: {
        0: { cellWidth: 20, halign: "center" },
        1: { cellWidth: 70 },
        2: { cellWidth: 45, halign: "right" },
        3: { cellWidth: 35, halign: "right" },
      },
      margin: { left: margin, right: margin },
      didParseCell: (data) => {
        if (data.row.index === pmRows.length - 1) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = COLORS.primaryLight;
        }
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 16;
  };

  const drawStatusBreakdown = () => {
    if (!data.byStatus || data.byStatus.length === 0) return;

    if (currentY > pageHeight - 80) {
      doc.addPage();
      currentY = margin;
    }

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.dark);
    doc.text("Payment Status Breakdown", margin, currentY);
    currentY += 6;

    const statusLabels: Record<string, string> = {
      not_targeting: "Not Targeting",
      pending_invoice: "Pending Invoice",
      invoiced: "Invoiced",
      received: "Received",
    };

    const statusColors: Record<string, [number, number, number]> = {
      not_targeting: COLORS.gray,
      pending_invoice: COLORS.warning,
      invoiced: COLORS.primary,
      received: COLORS.success,
    };

    const totalCount = data.byStatus.reduce((sum, s) => sum + s.count, 0);
    const totalAmount = data.byStatus.reduce((sum, s) => sum + s.amount, 0);

    const statusRows = data.byStatus.map((status) => {
      const countPercent = totalCount > 0 ? (status.count / totalCount) * 100 : 0;
      return [
        statusLabels[status.status] || status.status,
        String(status.count),
        formatPercent(countPercent),
        formatCurrency(status.amount),
      ];
    });

    statusRows.push([
      "Total",
      String(totalCount),
      "100%",
      formatCurrency(totalAmount),
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [["Status", "Count", "% of Payments", "Amount"]],
      body: statusRows,
      theme: "striped",
      headStyles: {
        fillColor: COLORS.primary,
        textColor: COLORS.white,
        fontStyle: "bold",
        fontSize: 9,
      },
      bodyStyles: {
        fontSize: 9,
        textColor: COLORS.dark,
      },
      alternateRowStyles: {
        fillColor: COLORS.grayLight,
      },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 30, halign: "center" },
        2: { cellWidth: 40, halign: "right" },
        3: { cellWidth: 45, halign: "right" },
      },
      margin: { left: margin, right: margin },
      didParseCell: (cellData) => {
        if (cellData.row.index === statusRows.length - 1) {
          cellData.cell.styles.fontStyle = "bold";
          cellData.cell.styles.fillColor = COLORS.primaryLight;
        }
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 16;
  };

  const drawFooter = () => {
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);

      doc.setDrawColor(...COLORS.grayLight);
      doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.gray);

      doc.text("FinanceFlow Report", margin, pageHeight - 8);

      const pageText = `Page ${i} of ${totalPages}`;
      const pageTextWidth = doc.getTextWidth(pageText);
      doc.text(pageText, pageWidth - margin - pageTextWidth, pageHeight - 8);

      const centerText = `${options.reportType.charAt(0).toUpperCase() + options.reportType.slice(1)} Report - ${options.year}`;
      const centerTextWidth = doc.getTextWidth(centerText);
      doc.text(centerText, (pageWidth - centerTextWidth) / 2, pageHeight - 8);
    }
  };

  drawHeader();
  drawReportTitle();
  drawKPICards();
  drawRegionalBreakdown();
  drawPMPerformance();
  drawStatusBreakdown();
  drawFooter();

  const filename = `FinanceFlow-Report-${options.reportType}-${options.year}${options.month ? `-${options.month}` : ""}`;
  doc.save(`${filename}.pdf`);
}
