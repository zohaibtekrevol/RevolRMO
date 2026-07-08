import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import Papa from "papaparse";

export interface ExportColumn {
  header: string;
  accessor: string | ((row: any) => string | number);
}

export function exportToCSV(data: any[], columns: ExportColumn[], filename: string) {
  const headers = columns.map(col => col.header);
  const rows = data.map(row =>
    columns.map(col =>
      typeof col.accessor === "function"
        ? col.accessor(row)
        : row[col.accessor] ?? ""
    )
  );

  const csv = Papa.unparse({
    fields: headers,
    data: rows,
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportToPDF(
  data: any[],
  columns: ExportColumn[],
  filename: string,
  title?: string
) {
  const doc = new jsPDF();

  if (title) {
    doc.setFontSize(16);
    doc.text(title, 14, 20);
  }

  const headers = columns.map(col => col.header);
  const rows = data.map(row =>
    columns.map(col =>
      typeof col.accessor === "function"
        ? String(col.accessor(row))
        : String(row[col.accessor] ?? "")
    )
  );

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: title ? 30 : 20,
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
  });

  doc.save(`${filename}.pdf`);
}

export function formatCurrencyForExport(value: number | string | null): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (num === null || isNaN(num as number)) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(num as number);
}

export function formatDateForExport(date: string | Date | null): string {
  if (!date) return "";
  try {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

// Project CSV Import Template
export const PROJECT_CSV_TEMPLATE_HEADERS = [
  "name",
  "clientName", 
  "clientEmail",
  "region",
  "pmId",
  "projectType",
  "totalCost",
  "billingType",
  "contractStartDate",
  "contractEndDate",
  "numberOfPhases",
  "tbeHoursPerMonth",
  "tbeHourlyRate",
  "mrrMonthlyAmount",
  "mrrDurationMonths",
  "paymentTerms"
];

export const PROJECT_CSV_TEMPLATE_EXAMPLE = [
  "Project Name",
  "Client Company Name",
  "client@example.com",
  "CA",
  "",
  "Web Development",
  "50000",
  "ftfc",
  "2025-01-01",
  "2025-06-30",
  "3",
  "",
  "",
  "",
  "",
  "Net 30"
];

export function downloadProjectTemplate() {
  const headers = PROJECT_CSV_TEMPLATE_HEADERS;
  const exampleRow = PROJECT_CSV_TEMPLATE_EXAMPLE;
  
  // Create instructions as comments
  const instructions = [
    "# RevolRMO Project Import Template",
    "# Instructions:",
    "# - name: Project name (required)",
    "# - clientName: Client company name (required)",
    "# - clientEmail: Client email address (optional)",
    "# - region: Must be CA, TX, or AE (required)",
    "# - pmId: Project Manager ID from the system (optional, leave blank to assign later)",
    "# - projectType: Type of project (optional)",
    "# - totalCost: Total project cost in USD without currency symbols (required)",
    "# - billingType: Must be ftfc, tbe, or mrr (optional)",
    "# - contractStartDate: Start date in YYYY-MM-DD format (optional)",
    "# - contractEndDate: End date in YYYY-MM-DD format (optional)",
    "# - numberOfPhases: Number of phases for FTFC projects (optional)",
    "# - tbeHoursPerMonth: Hours per month for TBE projects (optional)",
    "# - tbeHourlyRate: Hourly rate for TBE projects (optional)",
    "# - mrrMonthlyAmount: Monthly amount for MRR projects (optional)",
    "# - mrrDurationMonths: Duration in months for MRR projects (optional)",
    "# - paymentTerms: Payment terms description (optional)",
    "# Delete these instruction lines before importing",
    ""
  ];
  
  const csv = Papa.unparse({
    fields: headers,
    data: [exampleRow],
  });
  
  const fullCsv = instructions.join("\n") + csv;
  
  const blob = new Blob([fullCsv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", "revolrmo_project_import_template.csv");
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export interface ParsedProjectRow {
  name: string;
  clientName: string;
  clientEmail?: string;
  region: string;
  pmId?: string;
  projectType?: string;
  totalCost: string;
  billingType?: string;
  contractStartDate?: string;
  contractEndDate?: string;
  numberOfPhases?: number;
  tbeHoursPerMonth?: number;
  tbeHourlyRate?: string;
  mrrMonthlyAmount?: string;
  mrrDurationMonths?: number;
  paymentTerms?: string;
}

export interface ProjectImportResult {
  valid: ParsedProjectRow[];
  errors: { row: number; message: string }[];
}

export function parseProjectCSV(file: File): Promise<ProjectImportResult> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      comments: "#",
      complete: (results) => {
        const valid: ParsedProjectRow[] = [];
        const errors: { row: number; message: string }[] = [];
        
        results.data.forEach((row: any, index: number) => {
          const rowNumber = index + 2; // +2 for header row and 1-based indexing
          
          // Skip empty rows
          if (!row.name && !row.clientName && !row.totalCost) {
            return;
          }
          
          // Validate required fields
          if (!row.name || row.name.trim() === "") {
            errors.push({ row: rowNumber, message: "Project name is required" });
            return;
          }
          
          if (!row.clientName || row.clientName.trim() === "") {
            errors.push({ row: rowNumber, message: "Client name is required" });
            return;
          }
          
          if (!row.region || !["CA", "TX", "AE"].includes(row.region.toUpperCase())) {
            errors.push({ row: rowNumber, message: "Region must be CA, TX, or AE" });
            return;
          }
          
          if (!row.totalCost || isNaN(parseFloat(row.totalCost))) {
            errors.push({ row: rowNumber, message: "Total cost must be a valid number" });
            return;
          }
          
          // Validate billing type if provided
          if (row.billingType && !["ftfc", "tbe", "mrr"].includes(row.billingType.toLowerCase())) {
            errors.push({ row: rowNumber, message: "Billing type must be ftfc, tbe, or mrr" });
            return;
          }
          
          // Build valid project row
          const projectRow: ParsedProjectRow = {
            name: row.name.trim(),
            clientName: row.clientName.trim(),
            clientEmail: row.clientEmail?.trim() || undefined,
            region: row.region.toUpperCase(),
            pmId: row.pmId?.trim() || undefined,
            projectType: row.projectType?.trim() || undefined,
            totalCost: row.totalCost.toString(),
            billingType: row.billingType?.toLowerCase() || undefined,
            contractStartDate: row.contractStartDate?.trim() || undefined,
            contractEndDate: row.contractEndDate?.trim() || undefined,
            numberOfPhases: row.numberOfPhases ? parseInt(row.numberOfPhases) : undefined,
            tbeHoursPerMonth: row.tbeHoursPerMonth ? parseInt(row.tbeHoursPerMonth) : undefined,
            tbeHourlyRate: row.tbeHourlyRate?.trim() || undefined,
            mrrMonthlyAmount: row.mrrMonthlyAmount?.trim() || undefined,
            mrrDurationMonths: row.mrrDurationMonths ? parseInt(row.mrrDurationMonths) : undefined,
            paymentTerms: row.paymentTerms?.trim() || undefined,
          };
          
          valid.push(projectRow);
        });
        
        resolve({ valid, errors });
      },
      error: (error) => {
        reject(error);
      },
    });
  });
}
