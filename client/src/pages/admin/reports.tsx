import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { RegionBadge } from "@/components/region-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileText, Calendar, TrendingUp, DollarSign, FileSpreadsheet } from "lucide-react";
import { exportToCSV, formatCurrencyForExport } from "@/lib/export-utils";
import { generateReportPDF } from "@/lib/report-pdf-generator";
import type { ReportData, User, Region } from "@shared/schema";

interface ExtendedReportData extends ReportData {
  byStatus?: { status: string; count: number; amount: number }[];
  totalTarget?: number;
}

const months = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

const regions: { value: Region | "all"; label: string }[] = [
  { value: "all", label: "All Regions" },
  { value: "CA", label: "California" },
  { value: "TX", label: "Texas" },
  { value: "AE", label: "UAE" },
];

export default function AdminReports() {
  const currentDate = new Date();
  const [reportType, setReportType] = useState<"daily" | "weekly" | "monthly" | "yearly">("monthly");
  const [selectedMonth, setSelectedMonth] = useState(String(currentDate.getMonth() + 1));
  const [selectedYear, setSelectedYear] = useState(String(currentDate.getFullYear()));
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedPm, setSelectedPm] = useState("");

  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const queryParams = new URLSearchParams();
  queryParams.set("type", reportType);
  if (reportType === "monthly") queryParams.set("month", selectedMonth);
  queryParams.set("year", selectedYear);
  if (selectedRegion) queryParams.set("region", selectedRegion);
  if (selectedPm) queryParams.set("pmId", selectedPm);

  const reportUrl = `/api/reports?${queryParams.toString()}`;
  
  const { data: report, isLoading } = useQuery<ExtendedReportData>({
    queryKey: [reportUrl],
  });

  const pmUsers = users?.filter(u => u.isProjectManager) || [];

  const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null) return "$0";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getReportTitle = () => {
    switch (reportType) {
      case "daily":
        return "Daily Report";
      case "weekly":
        return "Weekly Report";
      case "monthly":
        return `${months.find(m => m.value === selectedMonth)?.label} ${selectedYear} Report`;
      case "yearly":
        return `${selectedYear} Annual Report`;
    }
  };

  const handleExportCSV = () => {
    if (!report?.summary) return;
    
    const regionData = report.summary.byRegion.map(item => ({
      category: "Region",
      name: item.region,
      amount: formatCurrencyForExport(item.amount),
    }));
    
    const pmData = report.summary.byPM.map(item => ({
      category: "Project Manager",
      name: item.pmName,
      amount: formatCurrencyForExport(item.amount),
    }));
    
    const summaryData = [
      { category: "Summary", name: "Total Received", amount: formatCurrencyForExport(report.summary.totalReceived) },
      { category: "Summary", name: "Total Pending", amount: formatCurrencyForExport(report.summary.totalPending) },
      { category: "Summary", name: "Total Invoiced", amount: formatCurrencyForExport(report.summary.totalInvoiced) },
    ];
    
    const allData = [...summaryData, ...regionData, ...pmData];
    
    const columns = [
      { header: "Category", accessor: "category" },
      { header: "Name", accessor: "name" },
      { header: "Amount", accessor: "amount" },
    ];
    
    const filename = `report-${reportType}-${selectedYear}${reportType === "monthly" ? `-${selectedMonth}` : ""}`;
    exportToCSV(allData, columns, filename);
  };

  const handleExportPDF = () => {
    if (!report?.summary) return;
    
    const selectedPmName = selectedPm 
      ? pmUsers.find(u => u.id === selectedPm)?.firstName + " " + pmUsers.find(u => u.id === selectedPm)?.lastName
      : undefined;
    
    const selectedRegionLabel = selectedRegion 
      ? regions.find(r => r.value === selectedRegion)?.label
      : undefined;
    
    generateReportPDF(
      {
        ...report,
        totalTarget: report.totalTarget || 0,
        byStatus: report.byStatus || [],
      },
      {
        title: getReportTitle(),
        reportType,
        month: reportType === "monthly" ? selectedMonth : undefined,
        year: selectedYear,
        generatedAt: new Date(),
        filters: {
          region: selectedRegionLabel,
          pmName: selectedPmName?.trim(),
        },
      }
    );
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">Generate and view financial reports</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" data-testid="button-export-report">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => handleExportCSV()}
              data-testid="button-export-csv"
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export CSV
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleExportPDF()}
              data-testid="button-export-pdf"
            >
              <FileText className="h-4 w-4 mr-2" />
              Export PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Tabs value={reportType} onValueChange={(v) => setReportType(v as typeof reportType)}>
        <TabsList className="grid w-full grid-cols-4 max-w-md">
          <TabsTrigger value="daily" data-testid="tab-daily">Daily</TabsTrigger>
          <TabsTrigger value="weekly" data-testid="tab-weekly">Weekly</TabsTrigger>
          <TabsTrigger value="monthly" data-testid="tab-monthly">Monthly</TabsTrigger>
          <TabsTrigger value="yearly" data-testid="tab-yearly">Yearly</TabsTrigger>
        </TabsList>

        <Card className="mt-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              {(reportType === "monthly") && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Month</Label>
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger data-testid="filter-report-month">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {months.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs">Year</Label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger data-testid="filter-report-year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2023, 2024, 2025].map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Region</Label>
                <Select value={selectedRegion || "all"} onValueChange={(val) => setSelectedRegion(val === "all" ? "" : val)}>
                  <SelectTrigger data-testid="filter-report-region">
                    <SelectValue placeholder="All Regions" />
                  </SelectTrigger>
                  <SelectContent>
                    {regions.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Project Manager</Label>
                <Select value={selectedPm || "all"} onValueChange={(val) => setSelectedPm(val === "all" ? "" : val)}>
                  <SelectTrigger data-testid="filter-report-pm">
                    <SelectValue placeholder="All PMs" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All PMs</SelectItem>
                    {pmUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <TabsContent value={reportType} className="mt-6 space-y-6">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Total Received
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-8 w-32" />
                ) : (
                  <div className="text-3xl font-semibold" data-testid="text-report-received">
                    {formatCurrency(report?.summary?.totalReceived)}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Total Pending
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-8 w-32" />
                ) : (
                  <div className="text-3xl font-semibold" data-testid="text-report-pending">
                    {formatCurrency(report?.summary?.totalPending)}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Total Invoiced
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-8 w-32" />
                ) : (
                  <div className="text-3xl font-semibold" data-testid="text-report-invoiced">
                    {formatCurrency(report?.summary?.totalInvoiced)}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{getReportTitle()} - By Region</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-6 space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : report?.summary?.byRegion && report.summary.byRegion.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Region</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.summary.byRegion.map((item) => (
                      <TableRow key={item.region} data-testid={`row-region-${item.region}`}>
                        <TableCell><RegionBadge region={item.region} /></TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(item.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No data available for the selected filters.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{getReportTitle()} - By Project Manager</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-6 space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : report?.summary?.byPM && report.summary.byPM.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project Manager</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.summary.byPM.map((item) => (
                      <TableRow key={item.pmId} data-testid={`row-pm-report-${item.pmId}`}>
                        <TableCell className="font-medium">{item.pmName}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No data available for the selected filters.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
