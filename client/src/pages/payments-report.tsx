import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { RegionBadge } from "@/components/region-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { 
  Download, FileText, FileSpreadsheet, CalendarIcon, TrendingUp, 
  DollarSign, Target, MapPin, CheckCircle, XCircle, AlertTriangle,
  ChevronsUpDown, Check, Receipt, X
} from "lucide-react";
import { exportToCSV, formatCurrencyForExport, formatDateForExport } from "@/lib/export-utils";
import { generatePaymentsReportPDF } from "@/lib/payments-report-pdf";
import { generatePaymentStatementPDF } from "@/lib/payment-statement-pdf";
import { generateRegionReportPDF } from "@/lib/region-report-pdf";
import type { Project } from "@shared/schema";

interface PaymentReportItem {
  id: string;
  projectName: string;
  clientName: string;
  region: string;
  pmName: string;
  paymentType: string;
  expectedAmount: string;
  receivedAmount: string;
  receivedDate: string;
  narration?: string;
}

interface RegionSummaryItem {
  region: string;
  upsell: number;
  recurring: number;
  total: number;
}

interface PaymentsReportData {
  payments: PaymentReportItem[];
  regionSummary: RegionSummaryItem[];
  grandTotal: {
    upsell: number;
    recurring: number;
    total: number;
  };
  dateRange: {
    startDate: string;
    endDate: string;
  };
  paymentCount: number;
}

interface StatementData {
  project: {
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
  };
  entries: Array<{
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
  }>;
  summary: {
    totalCharged: number;
    totalReceived: number;
    outstanding: number;
    entryCount: number;
  };
}

interface RegionReportData {
  region: string;
  dateRange: { startDate: string; endDate: string };
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
  paymentsReceived: Array<{
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
  }>;
  paymentsMissed: Array<{
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
  }>;
}

export default function PaymentsReport() {
  const today = new Date();
  const defaultStart = startOfMonth(subMonths(today, 2));
  const defaultEnd = endOfMonth(today);
  
  const [activeTab, setActiveTab] = useState("summary");
  
  // Summary tab state
  const [startDate, setStartDate] = useState<Date>(defaultStart);
  const [endDate, setEndDate] = useState<Date>(defaultEnd);
  const [paymentType, setPaymentType] = useState<string>("all");
  
  // Statement of Account tab state
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [projectPickerOpen, setProjectPickerOpen] = useState<boolean>(false);
  const [ledgerStart, setLedgerStart] = useState<Date | undefined>(undefined);
  const [ledgerEnd, setLedgerEnd] = useState<Date | undefined>(undefined);
  const [ledgerType, setLedgerType] = useState<string>("all");
  const [ledgerStatus, setLedgerStatus] = useState<string>("all");
  
  // Region tab state
  const [selectedRegion, setSelectedRegion] = useState<string>("CA");
  const [regionStartDate, setRegionStartDate] = useState<Date>(defaultStart);
  const [regionEndDate, setRegionEndDate] = useState<Date>(defaultEnd);

  // Fetch projects for selector
  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  // Summary report query
  const queryParams = new URLSearchParams();
  queryParams.set("startDate", format(startDate, "yyyy-MM-dd"));
  queryParams.set("endDate", format(endDate, "yyyy-MM-dd"));
  if (paymentType !== "all") {
    queryParams.set("paymentType", paymentType);
  }
  const reportUrl = `/api/reports/payments?${queryParams.toString()}`;
  
  const { data: report, isLoading: isLoadingReport } = useQuery<PaymentsReportData>({
    queryKey: ["/api/reports/payments", startDate.toISOString(), endDate.toISOString(), paymentType],
    queryFn: async () => {
      const response = await fetch(reportUrl);
      if (!response.ok) throw new Error("Failed to fetch report");
      return response.json();
    },
    enabled: activeTab === "summary",
  });

  // Statement of Account query
  const selectedProject = projects?.find(p => p.id === selectedProjectId);
  const { data: ledger, isLoading: isLoadingLedger } = useQuery<StatementData>({
    queryKey: [
      "/api/reports/payments/ledger",
      selectedProjectId,
      ledgerStart?.toISOString() ?? "",
      ledgerEnd?.toISOString() ?? "",
      ledgerType,
      ledgerStatus,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("projectId", selectedProjectId);
      if (ledgerStart) params.set("startDate", format(ledgerStart, "yyyy-MM-dd"));
      if (ledgerEnd) params.set("endDate", format(ledgerEnd, "yyyy-MM-dd"));
      if (ledgerType !== "all") params.set("type", ledgerType);
      if (ledgerStatus !== "all") params.set("status", ledgerStatus);
      const response = await fetch(`/api/reports/payments/ledger?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch statement");
      return response.json();
    },
    enabled: activeTab === "ledger" && !!selectedProjectId,
  });

  // Region report query
  const regionQueryParams = new URLSearchParams();
  regionQueryParams.set("region", selectedRegion);
  regionQueryParams.set("startDate", format(regionStartDate, "yyyy-MM-dd"));
  regionQueryParams.set("endDate", format(regionEndDate, "yyyy-MM-dd"));
  
  const { data: regionReport, isLoading: isLoadingRegion } = useQuery<RegionReportData>({
    queryKey: ["/api/reports/payments/region", selectedRegion, regionStartDate.toISOString(), regionEndDate.toISOString()],
    queryFn: async () => {
      const response = await fetch(`/api/reports/payments/region?${regionQueryParams.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch region report");
      return response.json();
    },
    enabled: activeTab === "region",
  });

  const formatCurrency = (value: number | string | undefined | null) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    if (num === undefined || num === null || isNaN(num)) return "$0";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(num);
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "-";
    try {
      return format(new Date(dateStr), "MMM dd, yyyy");
    } catch {
      return "-";
    }
  };

  const getPaymentTypeLabel = (type: string) => {
    const labels: Record<string, string> = { upsell: "Upsell", recurring: "Recurring", milestone: "Milestone" };
    return labels[type] || type;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      not_targeting: "Not Targeting",
      pending_invoice: "Pending Invoice",
      invoiced: "Invoiced",
      received: "Received",
      paid: "Paid",
      partially_paid: "Partially Paid",
    };
    return labels[status] || status;
  };

  // Export handlers
  const handleExportSummaryCSV = () => {
    if (!report?.payments) return;
    const data = report.payments.map(p => ({
      date: formatDateForExport(p.receivedDate),
      project: p.projectName,
      client: p.clientName,
      region: p.region,
      pm: p.pmName,
      type: getPaymentTypeLabel(p.paymentType),
      amount: formatCurrencyForExport(p.receivedAmount || p.expectedAmount),
      narration: p.narration || "",
    }));
    const columns = [
      { header: "Received Date", accessor: "date" },
      { header: "Project", accessor: "project" },
      { header: "Client", accessor: "client" },
      { header: "Region", accessor: "region" },
      { header: "Project Manager", accessor: "pm" },
      { header: "Payment Type", accessor: "type" },
      { header: "Amount", accessor: "amount" },
      { header: "Narration", accessor: "narration" },
    ];
    exportToCSV(data, columns, `payments-report-${format(startDate, "yyyy-MM-dd")}-to-${format(endDate, "yyyy-MM-dd")}`);
  };

  const handleExportSummaryPDF = () => {
    if (!report) return;
    generatePaymentsReportPDF({
      startDate,
      endDate,
      paymentType,
      payments: report.payments,
      regionSummary: report.regionSummary,
      grandTotal: report.grandTotal,
      generatedAt: new Date(),
    });
  };

  // Client-facing labels for the statement. Upsell payments are always shown as
  // "Additional Services" — the word "Upsell" is never surfaced to clients.
  const getStatementTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      recurring: "Recurring",
      upsell: "Additional Services",
      milestone: "Milestone",
    };
    return labels[type] || type;
  };

  const getStatementStatusLabel = (entry: { invoiceStatus: string | null; status: string }) => {
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
  };

  const handleExportLedgerCSV = () => {
    if (!ledger) return;
    const data = ledger.entries.map(e => ({
      date: formatDateForExport(e.date),
      description: e.description,
      type: getStatementTypeLabel(e.type),
      invoice: e.invoiceNumber || "",
      due: formatDateForExport(e.dueDate),
      received: formatDateForExport(e.receivedDate),
      status: getStatementStatusLabel(e),
      debit: e.debit ? formatCurrencyForExport(e.debit) : "",
      credit: e.credit ? formatCurrencyForExport(e.credit) : "",
      balance: formatCurrencyForExport(e.balance),
    }));
    const columns = [
      { header: "Date", accessor: "date" },
      { header: "Description", accessor: "description" },
      { header: "Type", accessor: "type" },
      { header: "Invoice #", accessor: "invoice" },
      { header: "Due Date", accessor: "due" },
      { header: "Received Date", accessor: "received" },
      { header: "Status", accessor: "status" },
      { header: "Debit (Charged)", accessor: "debit" },
      { header: "Credit (Received)", accessor: "credit" },
      { header: "Balance", accessor: "balance" },
    ];
    // Append a totals row so the CSV mirrors the on-screen table and PDF footer.
    data.push({
      date: "",
      description: "TOTALS",
      type: "",
      invoice: "",
      due: "",
      received: "",
      status: "",
      debit: formatCurrencyForExport(ledger.summary.totalCharged),
      credit: formatCurrencyForExport(ledger.summary.totalReceived),
      balance: formatCurrencyForExport(ledger.summary.outstanding),
    });
    const projectName = (ledger.project.clientBusinessName || ledger.project.name).replace(/[^a-zA-Z0-9]/g, "-").substring(0, 24);
    exportToCSV(data, columns, `statement-of-account-${projectName}`);
  };

  const handleExportLedgerPDF = () => {
    if (!ledger) return;
    generatePaymentStatementPDF({
      project: ledger.project,
      entries: ledger.entries,
      summary: ledger.summary,
      dateRange: {
        start: ledgerStart ? format(ledgerStart, "yyyy-MM-dd") : null,
        end: ledgerEnd ? format(ledgerEnd, "yyyy-MM-dd") : null,
      },
      generatedAt: new Date(),
    });
  };

  const handleExportRegionCSV = () => {
    if (!regionReport) return;
    const allPayments = [...regionReport.paymentsReceived, ...regionReport.paymentsMissed];
    const data = allPayments.map(p => ({
      project: p.projectName,
      client: p.clientName,
      email: p.clientEmail,
      pm: p.pmName,
      type: getPaymentTypeLabel(p.paymentType),
      status: getStatusLabel(p.status),
      dueDate: formatDateForExport(p.dueDate),
      receivedDate: formatDateForExport(p.receivedDate),
      expected: formatCurrencyForExport(p.expectedAmount),
      received: formatCurrencyForExport(p.receivedAmount),
    }));
    const columns = [
      { header: "Project", accessor: "project" },
      { header: "Client", accessor: "client" },
      { header: "Email", accessor: "email" },
      { header: "PM", accessor: "pm" },
      { header: "Type", accessor: "type" },
      { header: "Status", accessor: "status" },
      { header: "Due Date", accessor: "dueDate" },
      { header: "Received Date", accessor: "receivedDate" },
      { header: "Expected", accessor: "expected" },
      { header: "Received", accessor: "received" },
    ];
    exportToCSV(data, columns, `region-report-${selectedRegion}-${format(regionStartDate, "yyyy-MM-dd")}`);
  };

  const handleExportRegionPDF = () => {
    if (!regionReport) return;
    generateRegionReportPDF({
      region: selectedRegion,
      startDate: regionStartDate,
      endDate: regionEndDate,
      totals: regionReport.totals,
      counts: regionReport.counts,
      paymentsReceived: regionReport.paymentsReceived,
      paymentsMissed: regionReport.paymentsMissed,
      generatedAt: new Date(),
    });
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Payments Report</h1>
          <p className="text-muted-foreground">Generate reports for payments, projects, and regions</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="summary" className="gap-2" data-testid="tab-summary">
            <DollarSign className="h-4 w-4" />
            Summary
          </TabsTrigger>
          <TabsTrigger value="ledger" className="gap-2" data-testid="tab-ledger">
            <Receipt className="h-4 w-4" />
            Statement of Account
          </TabsTrigger>
          <TabsTrigger value="region" className="gap-2" data-testid="tab-region">
            <MapPin className="h-4 w-4" />
            Region Insights
          </TabsTrigger>
        </TabsList>

        {/* Summary Tab */}
        <TabsContent value="summary" className="space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <Card className="flex-1">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  Date Range & Filters
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Start Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}
                          data-testid="input-start-date"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {startDate ? format(startDate, "MMM dd, yyyy") : "Select start date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={startDate} onSelect={(date) => date && setStartDate(date)} initialFocus />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">End Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn("w-full justify-start text-left font-normal", !endDate && "text-muted-foreground")}
                          data-testid="input-end-date"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {endDate ? format(endDate, "MMM dd, yyyy") : "Select end date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={endDate} onSelect={(date) => date && setEndDate(date)} initialFocus />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Payment Type</Label>
                    <Select value={paymentType} onValueChange={setPaymentType}>
                      <SelectTrigger data-testid="filter-payment-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All (Upsell & Recurring)</SelectItem>
                        <SelectItem value="upsell">Upsell Only</SelectItem>
                        <SelectItem value="recurring">Recurring Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={!report?.payments?.length} data-testid="button-export-summary">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportSummaryCSV}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Export CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportSummaryPDF}>
                  <FileText className="h-4 w-4 mr-2" />
                  Export PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Total Upsells
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingReport ? (
                  <Skeleton className="h-8 w-32" />
                ) : (
                  <div className="text-3xl font-semibold text-orange-600" data-testid="text-total-upsells">
                    {formatCurrency(report?.grandTotal?.upsell)}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Total Recurring
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingReport ? (
                  <Skeleton className="h-8 w-32" />
                ) : (
                  <div className="text-3xl font-semibold text-blue-600" data-testid="text-total-recurring">
                    {formatCurrency(report?.grandTotal?.recurring)}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Grand Total
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingReport ? (
                  <Skeleton className="h-8 w-32" />
                ) : (
                  <div className="text-3xl font-semibold text-green-600" data-testid="text-grand-total">
                    {formatCurrency(report?.grandTotal?.total)}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Region-wise Summary</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingReport ? (
                <div className="p-6 space-y-3">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12" />)}
                </div>
              ) : report?.regionSummary && report.regionSummary.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Region</TableHead>
                      <TableHead className="text-right">Upsells</TableHead>
                      <TableHead className="text-right">Recurring</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.regionSummary.map((item) => (
                      <TableRow key={item.region}>
                        <TableCell><RegionBadge region={item.region as "CA" | "TX" | "AE"} /></TableCell>
                        <TableCell className="text-right text-orange-600 font-medium">{formatCurrency(item.upsell)}</TableCell>
                        <TableCell className="text-right text-blue-600 font-medium">{formatCurrency(item.recurring)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(item.total)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell>Grand Total</TableCell>
                      <TableCell className="text-right text-orange-600">{formatCurrency(report.grandTotal.upsell)}</TableCell>
                      <TableCell className="text-right text-blue-600">{formatCurrency(report.grandTotal.recurring)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(report.grandTotal.total)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">No payments found for the selected date range.</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                Payment Details
                {report?.paymentCount && <Badge variant="secondary" className="ml-2">{report.paymentCount} payments</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingReport ? (
                <div className="p-6 space-y-3">
                  {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}
                </div>
              ) : report?.payments && report.payments.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Project</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Region</TableHead>
                        <TableHead>PM</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.payments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell className="whitespace-nowrap">{formatDate(payment.receivedDate)}</TableCell>
                          <TableCell className="font-medium max-w-[200px] truncate" title={payment.projectName}>{payment.projectName}</TableCell>
                          <TableCell className="max-w-[150px] truncate" title={payment.clientName}>{payment.clientName}</TableCell>
                          <TableCell><RegionBadge region={payment.region as "CA" | "TX" | "AE"} /></TableCell>
                          <TableCell className="max-w-[120px] truncate" title={payment.pmName}>{payment.pmName}</TableCell>
                          <TableCell>
                            <Badge 
                              variant={payment.paymentType === "upsell" ? "default" : "secondary"}
                              className={payment.paymentType === "upsell" ? "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300" : "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"}
                            >
                              {getPaymentTypeLabel(payment.paymentType)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(payment.receivedAmount || payment.expectedAmount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">No payments found for the selected date range.</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Statement of Account Tab */}
        <TabsContent value="ledger" className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Statement of Account
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                    <Label className="text-xs">Project</Label>
                    <Popover open={projectPickerOpen} onOpenChange={setProjectPickerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={projectPickerOpen}
                          className="w-full justify-between font-normal"
                          data-testid="button-select-project"
                        >
                          <span className="truncate">
                            {selectedProject
                              ? `${selectedProject.name} — ${selectedProject.clientName}`
                              : "Choose a project..."}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[320px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search projects..." data-testid="input-search-project" />
                          <CommandList>
                            <CommandEmpty>No projects found.</CommandEmpty>
                            <CommandGroup>
                              {projects?.map((project) => (
                                <CommandItem
                                  key={project.id}
                                  value={`${project.name} ${project.clientName}`}
                                  onSelect={() => {
                                    setSelectedProjectId(project.id);
                                    setProjectPickerOpen(false);
                                  }}
                                  data-testid={`option-project-${project.id}`}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedProjectId === project.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <div className="flex flex-col">
                                    <span className="font-medium">{project.name}</span>
                                    <span className="text-xs text-muted-foreground">{project.clientName}</span>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">From</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn("w-full justify-start text-left font-normal", !ledgerStart && "text-muted-foreground")}
                          data-testid="input-ledger-start"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {ledgerStart ? format(ledgerStart, "MMM dd, yyyy") : "Any"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={ledgerStart} onSelect={setLedgerStart} initialFocus />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">To</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn("w-full justify-start text-left font-normal", !ledgerEnd && "text-muted-foreground")}
                          data-testid="input-ledger-end"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {ledgerEnd ? format(ledgerEnd, "MMM dd, yyyy") : "Any"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={ledgerEnd} onSelect={setLedgerEnd} initialFocus />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Type</Label>
                    <Select value={ledgerType} onValueChange={setLedgerType}>
                      <SelectTrigger data-testid="select-ledger-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="recurring">Recurring</SelectItem>
                        <SelectItem value="upsell">Additional Services</SelectItem>
                        <SelectItem value="milestone">Milestone</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Status</Label>
                    <Select value={ledgerStatus} onValueChange={setLedgerStatus}>
                      <SelectTrigger data-testid="select-ledger-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="paid">Settled</SelectItem>
                        <SelectItem value="outstanding">Outstanding</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {(ledgerStart || ledgerEnd || ledgerType !== "all" || ledgerStatus !== "all") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setLedgerStart(undefined);
                        setLedgerEnd(undefined);
                        setLedgerType("all");
                        setLedgerStatus("all");
                      }}
                      data-testid="button-clear-ledger-filters"
                    >
                      <X className="h-4 w-4 mr-1" /> Clear
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" disabled={!ledger} data-testid="button-export-ledger">
                        <Download className="h-4 w-4 mr-2" />
                        Export
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={handleExportLedgerCSV}>
                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                        Export CSV
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleExportLedgerPDF}>
                        <FileText className="h-4 w-4 mr-2" />
                        Export PDF
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardContent>
          </Card>

          {!selectedProjectId ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a project to view its statement of account</p>
              </CardContent>
            </Card>
          ) : isLoadingLedger ? (
            <div className="space-y-4">
              <Skeleton className="h-32" />
              <Skeleton className="h-48" />
            </div>
          ) : ledger ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    {ledger.project.clientBusinessName || ledger.project.clientName}
                    <RegionBadge region={ledger.project.region as "CA" | "TX" | "AE"} />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Project</p>
                      <p className="font-medium" data-testid="text-statement-project">{ledger.project.name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Contact</p>
                      <p className="font-medium">{ledger.project.clientName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Email</p>
                      <p className="font-medium">{ledger.project.clientEmail || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Contract Value</p>
                      <p className="font-medium">{formatCurrency(ledger.project.totalCost)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total Charged</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-semibold">{formatCurrency(ledger.summary.totalCharged)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total Received</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-semibold text-green-600">{formatCurrency(ledger.summary.totalReceived)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Balance Due</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div
                      className={cn("text-2xl font-semibold", ledger.summary.outstanding > 0 ? "text-red-600" : "text-green-600")}
                      data-testid="text-statement-balance"
                    >
                      {formatCurrency(ledger.summary.outstanding)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Transactions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-semibold" data-testid="text-ledger-entry-count">{ledger.summary.entryCount}</div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Transactions</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {ledger.entries.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50 hover:bg-muted/50">
                            <TableHead>Date</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Invoice #</TableHead>
                            <TableHead>Received</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Debit</TableHead>
                            <TableHead className="text-right">Credit</TableHead>
                            <TableHead className="text-right">Balance</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {ledger.entries.map((entry) => (
                            <TableRow key={entry.id} data-testid={`row-statement-${entry.id}`}>
                              <TableCell className="whitespace-nowrap">{formatDate(entry.date)}</TableCell>
                              <TableCell>
                                <span className="block max-w-[280px] truncate" data-testid={`text-statement-desc-${entry.id}`}>{entry.description}</span>
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-muted-foreground">{getStatementTypeLabel(entry.type)}</TableCell>
                              <TableCell className="whitespace-nowrap text-muted-foreground">{entry.invoiceNumber || "-"}</TableCell>
                              <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(entry.receivedDate)}</TableCell>
                              <TableCell>
                                <Badge
                                  variant={["received", "paid"].includes(entry.status) ? "default" : "secondary"}
                                  className={entry.status === "partially_paid" ? "bg-amber-500 text-white hover:bg-amber-600 border-transparent" : undefined}
                                >
                                  {getStatementStatusLabel(entry)}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right tabular-nums">{entry.debit ? formatCurrency(entry.debit) : "-"}</TableCell>
                              <TableCell className="text-right tabular-nums text-green-600">{entry.credit ? formatCurrency(entry.credit) : "-"}</TableCell>
                              <TableCell className="text-right tabular-nums font-medium">{formatCurrency(entry.balance)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                        <TableFooter>
                          <TableRow className="bg-muted/60 font-semibold hover:bg-muted/60">
                            <TableCell colSpan={6}>Totals</TableCell>
                            <TableCell className="text-right tabular-nums">{formatCurrency(ledger.summary.totalCharged)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatCurrency(ledger.summary.totalReceived)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatCurrency(ledger.summary.outstanding)}</TableCell>
                          </TableRow>
                        </TableFooter>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">No transactions found for the selected filters.</div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : null}
        </TabsContent>

        {/* Region Insights Tab */}
        <TabsContent value="region" className="space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <Card className="flex-1">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Region & Date Range
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Region</Label>
                    <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                      <SelectTrigger data-testid="select-region">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CA">California (CA)</SelectItem>
                        <SelectItem value="TX">Texas (TX)</SelectItem>
                        <SelectItem value="AE">UAE (AE)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Start Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !regionStartDate && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {regionStartDate ? format(regionStartDate, "MMM dd, yyyy") : "Select start date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={regionStartDate} onSelect={(date) => date && setRegionStartDate(date)} initialFocus />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">End Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !regionEndDate && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {regionEndDate ? format(regionEndDate, "MMM dd, yyyy") : "Select end date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={regionEndDate} onSelect={(date) => date && setRegionEndDate(date)} initialFocus />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </CardContent>
            </Card>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={!regionReport} data-testid="button-export-region">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportRegionCSV}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Export CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportRegionPDF}>
                  <FileText className="h-4 w-4 mr-2" />
                  Export PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {isLoadingRegion ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
              </div>
              <Skeleton className="h-48" />
            </div>
          ) : regionReport ? (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      Received
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-semibold text-green-600">{formatCurrency(regionReport.totals.received)}</div>
                    <p className="text-xs text-muted-foreground">{regionReport.counts.received} payments</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-600" />
                      Missed
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-semibold text-red-600">{formatCurrency(regionReport.totals.missed)}</div>
                    <p className="text-xs text-muted-foreground">{regionReport.counts.missed} payments</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-blue-600" />
                      Recurring
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-semibold text-blue-600">{formatCurrency(regionReport.totals.recurring)}</div>
                    <p className="text-xs text-muted-foreground">{regionReport.counts.recurring} payments</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Target className="h-4 w-4 text-orange-600" />
                      Upsells
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-semibold text-orange-600">{formatCurrency(regionReport.totals.upsell)}</div>
                    <p className="text-xs text-muted-foreground">{regionReport.counts.upsell} payments</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    Payments Received
                    <Badge variant="secondary">{regionReport.counts.received}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {regionReport.paymentsReceived.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Received Date</TableHead>
                            <TableHead>Project</TableHead>
                            <TableHead>Client</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {regionReport.paymentsReceived.slice(0, 10).map((payment) => (
                            <TableRow key={payment.id}>
                              <TableCell>{formatDate(payment.receivedDate)}</TableCell>
                              <TableCell className="font-medium max-w-[200px] truncate">{payment.projectName}</TableCell>
                              <TableCell className="max-w-[150px] truncate">{payment.clientName}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{getPaymentTypeLabel(payment.paymentType)}</Badge>
                              </TableCell>
                              <TableCell className="text-right font-medium text-green-600">{formatCurrency(payment.receivedAmount)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">No received payments in this period.</div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                    Missed Payments
                    <Badge variant="destructive">{regionReport.counts.missed}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {regionReport.paymentsMissed.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Due Date</TableHead>
                            <TableHead>Project</TableHead>
                            <TableHead>Client</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead className="text-right">Expected</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {regionReport.paymentsMissed.slice(0, 10).map((payment) => (
                            <TableRow key={payment.id}>
                              <TableCell>{formatDate(payment.dueDate)}</TableCell>
                              <TableCell className="font-medium max-w-[200px] truncate">{payment.projectName}</TableCell>
                              <TableCell className="max-w-[150px] truncate">{payment.clientName}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{getPaymentTypeLabel(payment.paymentType)}</Badge>
                              </TableCell>
                              <TableCell className="text-right font-medium text-red-600">{formatCurrency(payment.expectedAmount)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">No missed payments in this period.</div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
