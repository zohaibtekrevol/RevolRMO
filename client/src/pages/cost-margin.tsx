import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { DollarSign, TrendingUp, TrendingDown, Target, AlertTriangle, CheckCircle2, MinusCircle, ChevronLeft, ChevronRight, Plus, Users, Briefcase, Wrench, Eye, Filter, X, Clock, Gauge, Settings2, MoreHorizontal, Check, Trash2, Download, FileSpreadsheet, FileText } from "lucide-react";
import jsPDF from "jspdf";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Tooltip as TooltipUI, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ProjectCostDetailSheet } from "@/components/project-cost-detail-sheet";
import type { Project } from "@shared/schema";

interface ProjectMarginSummary {
  projectId: string;
  projectName: string;
  region: string;
  revenue: number;
  estimatedCost: number;
  actualCost: number;
  humanCost: number;
  vendorCost: number;
  toolCost: number;
  margin: number;
  bucket: "profit" | "breakeven" | "loss";
}

interface CostMarginSummaryData {
  month: number;
  year: number;
  summary: {
    totalCashReceived: number;
    totalActualCost: number;
    totalMargin: number;
    profitProjectCount: number;
    breakevenProjectCount: number;
    lossProjectCount: number;
  };
  projects: ProjectMarginSummary[];
  thresholds: {
    profitThreshold: number;
    breakevenThreshold: number;
  };
}

interface TimesheetEntry {
  id: string;
  date: string;
  hoursLogged: number;
  description: string | null;
  userName: string;
  approvalStatus: string;
}

interface HourlyBucketProject {
  projectId: string;
  projectName: string;
  region: string;
  projectStatus: string;
  projectValue: number;
  baseCost: number;
  upsellAmount: number;
  hourlyRate: number;
  isHourlyRateOverridden: boolean;
  profitabilityPercent: number;
  isProfitabilityOverridden: boolean;
  varianceHours: number;
  isVarianceOverridden: boolean;
  isAvailableHoursOverridden: boolean;
  overrideAvailableHours: number | null;
  totalHourBucket: number;
  profitReservedHours: number;
  implementationHours: number;
  calculatedAvailableHours: number;
  finalAvailableHours: number;
  consumedHours: number;
  remainingHours: number;
  utilizationPercent: number;
  bucketStatus: "on_track" | "warning" | "critical";
  effectiveProfitabilityMargin: number;
  remainingHoursMargin: number;
  timesheetEntries: TimesheetEntry[];
}

interface HourlyBucketData {
  summary: {
    totalProjects: number;
    onTrackCount: number;
    warningCount: number;
    criticalCount: number;
    totalAvailableHours: number;
    totalConsumedHours: number;
    overallUtilization: number;
  };
  projects: HourlyBucketProject[];
  globalSettings: {
    hourlyRateCA: number;
    hourlyRateTX: number;
    hourlyRateAE: number;
    profitabilityPercent: number;
    varianceHours: number;
  };
  includeUpsells: boolean;
}

const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

const vendorCostSchema = z.object({
  projectId: z.string().min(1, "Project is required"),
  vendorName: z.string().min(1, "Vendor name is required"),
  month: z.number().min(1).max(12),
  year: z.number().min(2020).max(2030),
  amount: z.string().min(1, "Amount is required"),
  invoiceNumber: z.string().optional(),
  description: z.string().optional(),
});

const toolCostSchema = z.object({
  projectId: z.string().min(1, "Project is required"),
  toolName: z.string().min(1, "Tool name is required"),
  month: z.number().min(1).max(12),
  year: z.number().min(2020).max(2030),
  amount: z.string().min(1, "Amount is required"),
  description: z.string().optional(),
});

const humanCostSchema = z.object({
  projectId: z.string().min(1, "Project is required"),
  month: z.number().min(1).max(12),
  year: z.number().min(2020).max(2030),
  actualHumanCost: z.string().min(1, "Human cost is required"),
  notes: z.string().optional(),
});

const timesheetEntrySchema = z.object({
  projectId: z.string().min(1, "Project is required"),
  date: z.string().min(1, "Date is required"),
  hoursLogged: z.string().min(1, "Hours is required").refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    "Must be a positive number"
  ),
  hourlyCostRate: z.string().min(1, "Hourly rate is required").refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    "Must be a positive number"
  ),
  description: z.string().optional(),
});

type VendorCostFormData = z.infer<typeof vendorCostSchema>;
type ToolCostFormData = z.infer<typeof toolCostSchema>;
type HumanCostFormData = z.infer<typeof humanCostSchema>;
type TimesheetEntryFormData = z.infer<typeof timesheetEntrySchema>;

const prepareHumanCostPayload = (data: HumanCostFormData) => ({
  projectId: data.projectId,
  month: data.month,
  year: data.year,
  actualHumanCost: data.actualHumanCost,
  actualVendorCost: "0",
  actualToolCost: "0",
  totalActualCost: data.actualHumanCost,
  costSource: "manual",
  notes: data.notes || null,
});

type ViewMode = "monthly" | "projectTotal";

export default function CostMargin() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [viewMode, setViewMode] = useState<ViewMode>("monthly");
  const [vendorDialogOpen, setVendorDialogOpen] = useState(false);
  const [toolDialogOpen, setToolDialogOpen] = useState(false);
  const [humanCostDialogOpen, setHumanCostDialogOpen] = useState(false);
  const [timesheetDialogOpen, setTimesheetDialogOpen] = useState(false);
  const { user: currentUser } = useAuth();
  const [selectedProject, setSelectedProject] = useState<{ id: string; name: string } | null>(null);
  const [projectFilter, setProjectFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [activeTab, setActiveTab] = useState("profit-analysis");
  const [selectedBucketProject, setSelectedBucketProject] = useState<HourlyBucketProject | null>(null);
  const [useOverrideRate, setUseOverrideRate] = useState(false);
  const [useOverrideProfitability, setUseOverrideProfitability] = useState(false);
  const [useOverrideVariance, setUseOverrideVariance] = useState(false);
  const [useOverrideAvailableHours, setUseOverrideAvailableHours] = useState(false);
  const [overrideHourlyRate, setOverrideHourlyRate] = useState("");
  const [overrideProfitability, setOverrideProfitability] = useState("");
  const [overrideVariance, setOverrideVariance] = useState("");
  const [overrideAvailableHours, setOverrideAvailableHours] = useState("");
  const [bucketStatusFilter, setBucketStatusFilter] = useState<string>("all");
  const [bucketProjectFilter, setBucketProjectFilter] = useState<string>("");
  const [bucketProjectStatusFilter, setBucketProjectStatusFilter] = useState<string>("active");
  const [includeUpsells, setIncludeUpsells] = useState<boolean>(true);
  const { toast } = useToast();

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const vendorForm = useForm<VendorCostFormData>({
    resolver: zodResolver(vendorCostSchema),
    defaultValues: {
      projectId: "",
      vendorName: "",
      month: selectedMonth,
      year: selectedYear,
      amount: "",
      invoiceNumber: "",
      description: "",
    },
  });

  const toolForm = useForm<ToolCostFormData>({
    resolver: zodResolver(toolCostSchema),
    defaultValues: {
      projectId: "",
      toolName: "",
      month: selectedMonth,
      year: selectedYear,
      amount: "",
      description: "",
    },
  });

  const humanCostForm = useForm<HumanCostFormData>({
    resolver: zodResolver(humanCostSchema),
    defaultValues: {
      projectId: "",
      month: selectedMonth,
      year: selectedYear,
      actualHumanCost: "",
      notes: "",
    },
  });

  const vendorMutation = useMutation({
    mutationFn: async (data: VendorCostFormData) => {
      return apiRequest("POST", "/api/vendor-costs", data);
    },
    onSuccess: () => {
      toast({ title: "Vendor cost added successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/cost-margin/summary"] });
      setVendorDialogOpen(false);
      vendorForm.reset({ projectId: "", vendorName: "", month: selectedMonth, year: selectedYear, amount: "", invoiceNumber: "", description: "" });
    },
    onError: () => {
      toast({ title: "Failed to add vendor cost", variant: "destructive" });
    },
  });

  const toolMutation = useMutation({
    mutationFn: async (data: ToolCostFormData) => {
      return apiRequest("POST", "/api/tool-costs", data);
    },
    onSuccess: () => {
      toast({ title: "Tool cost added successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/cost-margin/summary"] });
      setToolDialogOpen(false);
      toolForm.reset({ projectId: "", toolName: "", month: selectedMonth, year: selectedYear, amount: "", description: "" });
    },
    onError: () => {
      toast({ title: "Failed to add tool cost", variant: "destructive" });
    },
  });

  const humanCostMutation = useMutation({
    mutationFn: async (data: HumanCostFormData) => {
      const payload = prepareHumanCostPayload(data);
      return apiRequest("POST", "/api/actual-costs", payload);
    },
    onSuccess: () => {
      toast({ title: "Human cost added successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/cost-margin/summary"] });
      setHumanCostDialogOpen(false);
      humanCostForm.reset({ projectId: "", month: selectedMonth, year: selectedYear, actualHumanCost: "", notes: "" });
    },
    onError: () => {
      toast({ title: "Failed to add human cost", variant: "destructive" });
    },
  });

  const timesheetForm = useForm<TimesheetEntryFormData>({
    resolver: zodResolver(timesheetEntrySchema),
    defaultValues: {
      projectId: "",
      date: format(new Date(), "yyyy-MM-dd"),
      hoursLogged: "",
      hourlyCostRate: "22",
      description: "",
    },
  });

  const timesheetMutation = useMutation({
    mutationFn: async (data: TimesheetEntryFormData) => {
      return apiRequest("POST", "/api/timesheets", {
        ...data,
        userId: currentUser?.id || "session-user",
        date: new Date(data.date),
      });
    },
    onSuccess: () => {
      toast({ title: "Timesheet entry created" });
      queryClient.invalidateQueries({ queryKey: ["/api/timesheets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cost-margin/summary"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/cost-margin/hourly-buckets"], exact: false });
      setTimesheetDialogOpen(false);
      timesheetForm.reset({
        projectId: "",
        date: format(new Date(), "yyyy-MM-dd"),
        hoursLogged: "",
        hourlyCostRate: "22",
        description: "",
      });
    },
    onError: () => {
      toast({ title: "Failed to create timesheet entry", variant: "destructive" });
    },
  });

  const refreshSelectedProject = async () => {
    if (selectedBucketProject) {
      const queryKey = ["/api/cost-margin/hourly-buckets", selectedMonth, selectedYear, includeUpsells];
      await queryClient.refetchQueries({ queryKey });
      const updatedData = queryClient.getQueryData<HourlyBucketData>(queryKey);
      if (updatedData?.projects) {
        const updatedProject = updatedData.projects.find(p => p.projectId === selectedBucketProject.projectId);
        if (updatedProject) {
          setSelectedBucketProject(updatedProject);
        }
      }
    }
  };

  const approveTimesheetMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/timesheets/${id}/approve`, {});
    },
    onSuccess: async () => {
      toast({ title: "Timesheet approved" });
      queryClient.invalidateQueries({ queryKey: ["/api/timesheets"] });
      await refreshSelectedProject();
    },
    onError: () => {
      toast({ title: "Failed to approve timesheet", variant: "destructive" });
    },
  });

  const rejectTimesheetMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/timesheets/${id}/reject`, {});
    },
    onSuccess: async () => {
      toast({ title: "Timesheet rejected" });
      queryClient.invalidateQueries({ queryKey: ["/api/timesheets"] });
      await refreshSelectedProject();
    },
    onError: () => {
      toast({ title: "Failed to reject timesheet", variant: "destructive" });
    },
  });

  const deleteTimesheetMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/timesheets/${id}`, undefined);
    },
    onSuccess: async () => {
      toast({ title: "Timesheet deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/timesheets"] });
      await refreshSelectedProject();
    },
    onError: () => {
      toast({ title: "Failed to delete timesheet", variant: "destructive" });
    },
  });

  const { data, isLoading } = useQuery<CostMarginSummaryData>({
    queryKey: ["/api/cost-margin/summary", selectedMonth, selectedYear, viewMode],
    queryFn: async () => {
      const params = new URLSearchParams({
        month: String(selectedMonth),
        year: String(selectedYear),
      });
      if (viewMode === "projectTotal") {
        params.set("viewMode", "projectTotal");
      }
      const res = await fetch(`/api/cost-margin/summary?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch cost margin summary");
      return res.json();
    },
  });

  const { data: hourlyBuckets, isLoading: hourlyBucketsLoading } = useQuery<HourlyBucketData>({
    queryKey: ["/api/cost-margin/hourly-buckets", selectedMonth, selectedYear, includeUpsells],
    queryFn: async () => {
      const response = await fetch(`/api/cost-margin/hourly-buckets?month=${selectedMonth}&year=${selectedYear}&includeUpsells=${includeUpsells}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch hourly buckets");
      return response.json();
    },
  });

  const updateProjectOverridesMutation = useMutation({
    mutationFn: async (data: { projectId: string; overrideHourlyRate: string | null; overrideProfitabilityPercent: string | null; overrideVarianceHours: string | null; overrideAvailableHours: string | null }) => {
      return apiRequest("PATCH", `/api/projects/${data.projectId}/cost-overrides`, data);
    },
    onSuccess: () => {
      toast({ title: "Project settings updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/cost-margin/hourly-buckets", selectedMonth, selectedYear, includeUpsells] });
      setSelectedBucketProject(null);
    },
    onError: () => {
      toast({ title: "Failed to update project settings", variant: "destructive" });
    },
  });

  const handleOpenBucketProject = (project: HourlyBucketProject) => {
    setSelectedBucketProject(project);
    setUseOverrideRate(project.isHourlyRateOverridden);
    setUseOverrideProfitability(project.isProfitabilityOverridden);
    setUseOverrideVariance(project.isVarianceOverridden);
    setUseOverrideAvailableHours(project.isAvailableHoursOverridden);
    setOverrideHourlyRate(project.isHourlyRateOverridden ? String(project.hourlyRate) : "");
    setOverrideProfitability(project.isProfitabilityOverridden ? String(project.profitabilityPercent) : "");
    setOverrideVariance(project.isVarianceOverridden ? String(project.varianceHours) : "");
    setOverrideAvailableHours(project.isAvailableHoursOverridden && project.overrideAvailableHours ? String(project.overrideAvailableHours) : "");
  };

  const handleSaveOverrides = () => {
    if (!selectedBucketProject) return;
    updateProjectOverridesMutation.mutate({
      projectId: selectedBucketProject.projectId,
      overrideHourlyRate: useOverrideRate && overrideHourlyRate ? overrideHourlyRate : null,
      overrideProfitabilityPercent: useOverrideProfitability && overrideProfitability ? overrideProfitability : null,
      overrideVarianceHours: useOverrideVariance && overrideVariance ? overrideVariance : null,
      overrideAvailableHours: useOverrideAvailableHours && overrideAvailableHours ? overrideAvailableHours : null,
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
  };

  const formatHours = (value: number) => {
    return value.toFixed(1) + "h";
  };

  const HoursBucketStatusBadge = ({ status }: { status: "on_track" | "warning" | "critical" }) => {
    if (status === "on_track") {
      return (
        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
          <CheckCircle2 className="w-3 h-3 mr-1" /> On Track
        </Badge>
      );
    }
    if (status === "warning") {
      return (
        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
          <AlertTriangle className="w-3 h-3 mr-1" /> Warning
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">
        <AlertTriangle className="w-3 h-3 mr-1" /> Critical
      </Badge>
    );
  };

  const OverrideIndicator = ({ isOverridden }: { isOverridden: boolean }) => {
    if (!isOverridden) return null;
    return (
      <TooltipUI>
        <TooltipTrigger>
          <Settings2 className="w-3 h-3 text-blue-500 ml-1" />
        </TooltipTrigger>
        <TooltipContent>
          <p>Project override (not using global setting)</p>
        </TooltipContent>
      </TooltipUI>
    );
  };

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  // Export hourly buckets to CSV with all visible and hidden data
  const exportHourlyBucketsCSV = () => {
    if (!hourlyBuckets?.projects) return;

    const filteredProjects = hourlyBuckets.projects
      .filter(p => p.projectValue > 0)
      .filter(p => bucketProjectStatusFilter === "all" || p.projectStatus === bucketProjectStatusFilter)
      .filter(p => bucketStatusFilter === "all" || p.bucketStatus === bucketStatusFilter)
      .filter(p => !bucketProjectFilter || p.projectId === bucketProjectFilter);

    const headers = [
      "Project ID",
      "Project Name",
      "Region",
      "Project Status",
      "Project Value",
      "Base Cost",
      "Upsell Amount",
      "Hourly Rate",
      "Hourly Rate Overridden",
      "Total Hour Bucket",
      "Profitability %",
      "Profitability Overridden",
      "Variance Hours",
      "Variance Overridden",
      "Profit Reserved Hours",
      "Implementation Hours",
      "Calculated Available Hours",
      "Available Hours Overridden",
      "Override Available Hours",
      "Final Available Hours",
      "Consumed Hours",
      "Remaining Hours",
      "Utilization %",
      "Effective Profit Margin %",
      "Remaining Hours Margin",
      "Bucket Status",
      "Timesheet Entry Count"
    ];

    const rows = filteredProjects.map(p => [
      p.projectId,
      `"${p.projectName.replace(/"/g, '""')}"`,
      p.region,
      p.projectStatus,
      p.projectValue.toFixed(2),
      p.baseCost.toFixed(2),
      p.upsellAmount.toFixed(2),
      p.hourlyRate.toFixed(2),
      p.isHourlyRateOverridden ? "Yes" : "No",
      p.totalHourBucket.toFixed(1),
      p.profitabilityPercent.toFixed(1),
      p.isProfitabilityOverridden ? "Yes" : "No",
      p.varianceHours.toFixed(1),
      p.isVarianceOverridden ? "Yes" : "No",
      p.profitReservedHours.toFixed(1),
      p.implementationHours.toFixed(1),
      p.calculatedAvailableHours.toFixed(1),
      p.isAvailableHoursOverridden ? "Yes" : "No",
      p.overrideAvailableHours !== null ? p.overrideAvailableHours.toFixed(1) : "",
      p.finalAvailableHours.toFixed(1),
      p.consumedHours.toFixed(1),
      p.remainingHours.toFixed(1),
      p.utilizationPercent.toFixed(1),
      p.effectiveProfitabilityMargin.toFixed(1),
      p.remainingHoursMargin.toFixed(1),
      p.bucketStatus,
      p.timesheetEntries?.length || 0
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `hourly_buckets_${selectedYear}_${String(selectedMonth).padStart(2, "0")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export hourly buckets to PDF with comprehensive report
  const exportHourlyBucketsPDF = () => {
    if (!hourlyBuckets?.projects) return;

    const filteredProjects = hourlyBuckets.projects
      .filter(p => p.projectValue > 0)
      .filter(p => bucketProjectStatusFilter === "all" || p.projectStatus === bucketProjectStatusFilter)
      .filter(p => bucketStatusFilter === "all" || p.bucketStatus === bucketStatusFilter)
      .filter(p => !bucketProjectFilter || p.projectId === bucketProjectFilter);

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    let yPos = margin;

    // Helper for page break
    const checkPageBreak = (height: number) => {
      if (yPos + height > pageHeight - margin) {
        doc.addPage();
        yPos = margin;
        return true;
      }
      return false;
    };

    // Title
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Hourly Bucket Analysis Report", margin, yPos);
    yPos += 8;

    // Report date and filters
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const monthName = new Date(selectedYear, selectedMonth - 1).toLocaleString("default", { month: "long" });
    doc.text(`Period: ${monthName} ${selectedYear}`, margin, yPos);
    yPos += 5;
    doc.text(`Generated: ${format(new Date(), "MMM d, yyyy h:mm a")}`, margin, yPos);
    yPos += 5;
    doc.text(`Include Upsells: ${includeUpsells ? "Yes" : "No"}`, margin, yPos);
    yPos += 8;

    // Summary section
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Summary", margin, yPos);
    yPos += 6;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const summary = hourlyBuckets.summary;
    doc.text(`Total Projects: ${summary.totalProjects}`, margin, yPos);
    doc.text(`On Track: ${summary.onTrackCount}`, margin + 50, yPos);
    doc.text(`Warning: ${summary.warningCount}`, margin + 90, yPos);
    doc.text(`Critical: ${summary.criticalCount}`, margin + 130, yPos);
    yPos += 5;
    doc.text(`Total Available Hours: ${summary.totalAvailableHours.toFixed(1)}h`, margin, yPos);
    doc.text(`Total Consumed Hours: ${summary.totalConsumedHours.toFixed(1)}h`, margin + 70, yPos);
    doc.text(`Overall Utilization: ${summary.overallUtilization.toFixed(1)}%`, margin + 140, yPos);
    yPos += 5;

    // Global settings
    const settings = hourlyBuckets.globalSettings;
    doc.text(`Global Rates - CA: $${settings.hourlyRateCA}/h, TX: $${settings.hourlyRateTX}/h, AE: $${settings.hourlyRateAE}/h`, margin, yPos);
    doc.text(`Profit Margin: ${settings.profitabilityPercent}%`, margin + 140, yPos);
    doc.text(`Variance: ${settings.varianceHours}h`, margin + 200, yPos);
    yPos += 10;

    // Table header
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Project Details", margin, yPos);
    yPos += 6;

    // Table columns
    const colWidths = [55, 18, 25, 20, 22, 22, 22, 22, 25, 22, 20];
    const headers = ["Project", "Region", "Value", "Rate", "Bucket", "Avail", "Used", "Left", "Margin", "Util %", "Status"];

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    let xPos = margin;
    headers.forEach((header, i) => {
      doc.text(header, xPos, yPos);
      xPos += colWidths[i];
    });
    yPos += 1;
    doc.setLineWidth(0.3);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 4;

    // Table rows
    doc.setFont("helvetica", "normal");
    filteredProjects.forEach((p) => {
      checkPageBreak(12);

      xPos = margin;
      const projectName = p.projectName.length > 25 ? p.projectName.substring(0, 22) + "..." : p.projectName;
      doc.text(projectName, xPos, yPos);
      xPos += colWidths[0];

      doc.text(p.region, xPos, yPos);
      xPos += colWidths[1];

      doc.text(`$${(p.projectValue / 1000).toFixed(1)}k`, xPos, yPos);
      xPos += colWidths[2];

      doc.text(`$${p.hourlyRate}${p.isHourlyRateOverridden ? "*" : ""}`, xPos, yPos);
      xPos += colWidths[3];

      doc.text(`${p.totalHourBucket.toFixed(0)}h`, xPos, yPos);
      xPos += colWidths[4];

      const availLabel = p.isAvailableHoursOverridden || p.isProfitabilityOverridden || p.isVarianceOverridden ? "*" : "";
      doc.text(`${p.finalAvailableHours.toFixed(0)}h${availLabel}`, xPos, yPos);
      xPos += colWidths[5];

      doc.text(`${p.consumedHours.toFixed(0)}h`, xPos, yPos);
      xPos += colWidths[6];

      doc.text(`${p.remainingHours.toFixed(0)}h`, xPos, yPos);
      xPos += colWidths[7];

      doc.text(`${p.effectiveProfitabilityMargin.toFixed(1)}%`, xPos, yPos);
      xPos += colWidths[8];

      doc.text(`${p.utilizationPercent.toFixed(0)}%`, xPos, yPos);
      xPos += colWidths[9];

      doc.text(p.bucketStatus.replace("_", " "), xPos, yPos);
      yPos += 5;

      // Second row with additional details
      doc.setFontSize(7);
      doc.setTextColor(100);
      xPos = margin + 5;
      doc.text(`ID: ${p.projectId} | Status: ${p.projectStatus} | Base: $${p.baseCost.toFixed(0)}`, xPos, yPos);
      if (p.upsellAmount > 0) {
        doc.text(`| Upsells: $${p.upsellAmount.toFixed(0)}`, xPos + 100, yPos);
      }
      doc.text(`| Entries: ${p.timesheetEntries?.length || 0}`, xPos + 140, yPos);
      doc.setTextColor(0);
      doc.setFontSize(8);
      yPos += 6;
    });

    // Footer with legend
    checkPageBreak(15);
    yPos += 5;
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.text("* indicates project-level override (not using global setting)", margin, yPos);
    yPos += 4;
    doc.text("Status: on track (>20% margin), warning (10-20% margin), critical (<10% margin or negative hours)", margin, yPos);

    // Save PDF
    doc.save(`hourly_buckets_${selectedYear}_${String(selectedMonth).padStart(2, "0")}.pdf`);
  };

  const bucketColors = {
    profit: "#22c55e",
    breakeven: "#f59e0b",
    loss: "#ef4444",
  };

  const BucketBadge = ({ bucket }: { bucket: "profit" | "breakeven" | "loss" }) => {
    if (bucket === "profit") {
      return (
        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
          <CheckCircle2 className="w-3 h-3 mr-1" /> Profit
        </Badge>
      );
    }
    if (bucket === "breakeven") {
      return (
        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
          <MinusCircle className="w-3 h-3 mr-1" /> Breakeven
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">
        <AlertTriangle className="w-3 h-3 mr-1" /> Loss
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div className="space-y-1">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  const pieData = [
    { name: "Profit", value: data?.summary.profitProjectCount || 0, color: bucketColors.profit },
    { name: "Breakeven", value: data?.summary.breakevenProjectCount || 0, color: bucketColors.breakeven },
    { name: "Loss", value: data?.summary.lossProjectCount || 0, color: bucketColors.loss },
  ].filter(d => d.value > 0);

  const activeProjects = data?.projects.filter(p => {
    const hasActivity = p.revenue > 0 || p.actualCost > 0;
    const matchesFilter = !projectFilter || p.projectId === projectFilter;
    const project = projects?.find(proj => proj.id === p.projectId);
    const matchesStatus = !statusFilter || statusFilter === "all" || project?.status === statusFilter;
    return hasActivity && matchesFilter && matchesStatus;
  }) || [];

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight" data-testid="text-cost-margin-title">
            Cost & Margin
          </h1>
          <p className="text-muted-foreground">
            {viewMode === "projectTotal" 
              ? "Project lifetime profitability (all payments & costs)" 
              : `Project profitability for ${MONTHS.find(m => m.value === selectedMonth)?.label} ${selectedYear}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handlePrevMonth}
            data-testid="button-prev-month"
            disabled={activeTab === "profit-analysis" && viewMode === "projectTotal"}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Select
            value={String(selectedMonth)}
            onValueChange={(val) => setSelectedMonth(parseInt(val))}
            disabled={activeTab === "profit-analysis" && viewMode === "projectTotal"}
          >
            <SelectTrigger className="w-[130px]" data-testid="select-month">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m) => (
                <SelectItem key={m.value} value={String(m.value)}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={String(selectedYear)}
            onValueChange={(val) => setSelectedYear(parseInt(val))}
            disabled={activeTab === "profit-analysis" && viewMode === "projectTotal"}
          >
            <SelectTrigger className="w-[100px]" data-testid="select-year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2023, 2024, 2025, 2026, 2027].map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon"
            onClick={handleNextMonth}
            data-testid="button-next-month"
            disabled={activeTab === "profit-analysis" && viewMode === "projectTotal"}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          {activeTab === "profit-analysis" ? (
            <>
              <div className="flex items-center gap-1 ml-4 p-1 bg-muted rounded-md">
                <Button
                  variant={viewMode === "monthly" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("monthly")}
                  data-testid="button-view-monthly"
                >
                  Monthly
                </Button>
                <Button
                  variant={viewMode === "projectTotal" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("projectTotal")}
                  data-testid="button-view-project-total"
                >
                  Project Total
                </Button>
              </div>

              <div className="flex items-center gap-2 ml-4">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select
                  value={statusFilter || "all"}
                  onValueChange={(val) => setStatusFilter(val)}
                >
                  <SelectTrigger className="w-[130px]" data-testid="select-status-filter">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="on_hold">On Hold</SelectItem>
                    <SelectItem value="complete">Complete</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={projectFilter || "all"}
                  onValueChange={(val) => setProjectFilter(val === "all" ? "" : val)}
                >
                  <SelectTrigger className="w-[200px]" data-testid="select-project-filter">
                    <SelectValue placeholder="All Projects" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Projects</SelectItem>
                    {projects?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(projectFilter || statusFilter !== "active") && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => { setProjectFilter(""); setStatusFilter("active"); }}
                    data-testid="button-clear-filters"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </>
          ) : null}

          {activeTab === "profit-analysis" ? (
            <div className="flex items-center gap-2 ml-4">
              <Dialog open={vendorDialogOpen} onOpenChange={setVendorDialogOpen}>
                <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-add-vendor-cost">
                  <Briefcase className="h-4 w-4 mr-2" />
                  Vendor Cost
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add Vendor Cost</DialogTitle>
                  <DialogDescription>
                    Record a vendor invoice or expense for a project
                  </DialogDescription>
                </DialogHeader>
                <Form {...vendorForm}>
                  <form onSubmit={vendorForm.handleSubmit((data) => vendorMutation.mutate(data))} className="space-y-4">
                    <FormField
                      control={vendorForm.control}
                      name="projectId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Project</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-vendor-project">
                                <SelectValue placeholder="Select project" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {projects?.map((p) => (
                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={vendorForm.control}
                      name="vendorName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vendor Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., AWS, Google Cloud" {...field} data-testid="input-vendor-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={vendorForm.control}
                        name="month"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Month</FormLabel>
                            <Select onValueChange={(v) => field.onChange(parseInt(v))} value={String(field.value)}>
                              <FormControl>
                                <SelectTrigger data-testid="select-vendor-month">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {MONTHS.map((m) => (
                                  <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={vendorForm.control}
                        name="year"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Year</FormLabel>
                            <Select onValueChange={(v) => field.onChange(parseInt(v))} value={String(field.value)}>
                              <FormControl>
                                <SelectTrigger data-testid="select-vendor-year">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {[2023, 2024, 2025, 2026].map((y) => (
                                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={vendorForm.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Amount ($)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder="0.00" {...field} data-testid="input-vendor-amount" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={vendorForm.control}
                      name="invoiceNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Invoice Number (optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="INV-001" {...field} data-testid="input-vendor-invoice" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={vendorForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description (optional)</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Cost details..." {...field} data-testid="input-vendor-description" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full" disabled={vendorMutation.isPending} data-testid="button-submit-vendor">
                      {vendorMutation.isPending ? "Adding..." : "Add Vendor Cost"}
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>

            <Dialog open={toolDialogOpen} onOpenChange={setToolDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-add-tool-cost">
                  <Wrench className="h-4 w-4 mr-2" />
                  Tool Cost
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add Tool Cost</DialogTitle>
                  <DialogDescription>
                    Record software or tool expenses for a project
                  </DialogDescription>
                </DialogHeader>
                <Form {...toolForm}>
                  <form onSubmit={toolForm.handleSubmit((data) => toolMutation.mutate(data))} className="space-y-4">
                    <FormField
                      control={toolForm.control}
                      name="projectId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Project</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-tool-project">
                                <SelectValue placeholder="Select project" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {projects?.map((p) => (
                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={toolForm.control}
                      name="toolName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tool Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Jira, GitHub, Figma" {...field} data-testid="input-tool-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={toolForm.control}
                        name="month"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Month</FormLabel>
                            <Select onValueChange={(v) => field.onChange(parseInt(v))} value={String(field.value)}>
                              <FormControl>
                                <SelectTrigger data-testid="select-tool-month">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {MONTHS.map((m) => (
                                  <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={toolForm.control}
                        name="year"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Year</FormLabel>
                            <Select onValueChange={(v) => field.onChange(parseInt(v))} value={String(field.value)}>
                              <FormControl>
                                <SelectTrigger data-testid="select-tool-year">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {[2023, 2024, 2025, 2026].map((y) => (
                                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={toolForm.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Amount ($)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder="0.00" {...field} data-testid="input-tool-amount" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={toolForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description (optional)</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Tool usage details..." {...field} data-testid="input-tool-description" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full" disabled={toolMutation.isPending} data-testid="button-submit-tool">
                      {toolMutation.isPending ? "Adding..." : "Add Tool Cost"}
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>

            <Dialog open={humanCostDialogOpen} onOpenChange={setHumanCostDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-add-human-cost">
                  <Users className="h-4 w-4 mr-2" />
                  Human Cost
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add Human Cost</DialogTitle>
                  <DialogDescription>
                    Manually record human resource costs (use when not using timesheets)
                  </DialogDescription>
                </DialogHeader>
                <Form {...humanCostForm}>
                  <form onSubmit={humanCostForm.handleSubmit((data) => humanCostMutation.mutate(data))} className="space-y-4">
                    <FormField
                      control={humanCostForm.control}
                      name="projectId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Project</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-human-project">
                                <SelectValue placeholder="Select project" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {projects?.map((p) => (
                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={humanCostForm.control}
                        name="month"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Month</FormLabel>
                            <Select onValueChange={(v) => field.onChange(parseInt(v))} value={String(field.value)}>
                              <FormControl>
                                <SelectTrigger data-testid="select-human-month">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {MONTHS.map((m) => (
                                  <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={humanCostForm.control}
                        name="year"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Year</FormLabel>
                            <Select onValueChange={(v) => field.onChange(parseInt(v))} value={String(field.value)}>
                              <FormControl>
                                <SelectTrigger data-testid="select-human-year">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {[2023, 2024, 2025, 2026].map((y) => (
                                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={humanCostForm.control}
                      name="actualHumanCost"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Human Cost ($)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder="0.00" {...field} data-testid="input-human-cost" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={humanCostForm.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes (optional)</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Cost breakdown details..." {...field} data-testid="input-human-notes" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full" disabled={humanCostMutation.isPending} data-testid="button-submit-human">
                      {humanCostMutation.isPending ? "Adding..." : "Add Human Cost"}
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
            </div>
          ) : (
            <Dialog open={timesheetDialogOpen} onOpenChange={setTimesheetDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-log-timesheet">
                  <Clock className="h-4 w-4 mr-2" />
                  Log Timesheet
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add Timesheet Entry</DialogTitle>
                  <DialogDescription>
                    Log hours worked on a project
                  </DialogDescription>
                </DialogHeader>
                <Form {...timesheetForm}>
                  <form onSubmit={timesheetForm.handleSubmit((data) => timesheetMutation.mutate(data))} className="space-y-4">
                    <FormField
                      control={timesheetForm.control}
                      name="projectId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Project</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-timesheet-project">
                                <SelectValue placeholder="Select project" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {projects?.map((p) => (
                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={timesheetForm.control}
                      name="date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} data-testid="input-timesheet-date" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={timesheetForm.control}
                      name="hoursLogged"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Hours</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.5"
                              min="0.5"
                              placeholder="8.0"
                              {...field}
                              data-testid="input-timesheet-hours"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={timesheetForm.control}
                      name="hourlyCostRate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Hourly Rate ($)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="22.00"
                              {...field}
                              data-testid="input-timesheet-rate"
                            />
                          </FormControl>
                          <p className="text-xs text-muted-foreground">
                            Default rate based on global settings
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={timesheetForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description (optional)</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="What did you work on?"
                              {...field}
                              data-testid="input-timesheet-description"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setTimesheetDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={timesheetMutation.isPending} data-testid="button-submit-timesheet">
                        {timesheetMutation.isPending ? "Saving..." : "Save Entry"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="profit-analysis" data-testid="tab-profit-analysis">
            <DollarSign className="h-4 w-4 mr-2" />
            Profit Analysis
          </TabsTrigger>
          <TabsTrigger value="hourly-buckets" data-testid="tab-hourly-buckets">
            <Clock className="h-4 w-4 mr-2" />
            Hourly Buckets
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profit-analysis" className="space-y-6">
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold" data-testid="text-total-revenue">
              {formatCurrency(data?.summary.totalCashReceived || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {viewMode === "projectTotal" ? "Total cash received" : "Cash received this month"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4" />
              Total Cost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold" data-testid="text-total-cost">
              {formatCurrency(data?.summary.totalActualCost || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {viewMode === "projectTotal" ? "Total project costs" : "Human + vendor + tool costs"}
            </p>
          </CardContent>
        </Card>

        <Card className={`border-l-4 ${(data?.summary.totalMargin || 0) >= 0 ? "border-l-green-500" : "border-l-red-500"}`}>
          <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              {(data?.summary.totalMargin || 0) >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
              Total Margin
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold" data-testid="text-total-margin">
              {formatPercent(data?.summary.totalMargin || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {viewMode === "projectTotal" ? "Lifetime profitability" : "Monthly profitability"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Project Health</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-4 items-center">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-sm font-medium" data-testid="text-profit-count">{data?.summary.profitProjectCount || 0}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="text-sm font-medium" data-testid="text-breakeven-count">{data?.summary.breakevenProjectCount || 0}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-sm font-medium" data-testid="text-loss-count">{data?.summary.lossProjectCount || 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Project Margins</CardTitle>
          </CardHeader>
          <CardContent>
            {activeProjects.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={activeProjects.slice(0, 10)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(v) => `${v}%`} domain={[-100, 100]} />
                  <YAxis type="category" dataKey="projectName" width={150} tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: number) => [`${value.toFixed(1)}%`, "Margin"]}
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                  />
                  <Bar
                    dataKey="margin"
                    fill="hsl(var(--primary))"
                    radius={[0, 4, 4, 0]}
                  >
                    {activeProjects.slice(0, 10).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={bucketColors[entry.bucket]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                No project data for this period
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                No project data
              </div>
            )}
            <div className="flex justify-center gap-4 mt-4">
              {pieData.map((d) => (
                <div key={d.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-sm">{d.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Project Details</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Region</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Human Cost</TableHead>
                <TableHead className="text-right">Vendor Cost</TableHead>
                <TableHead className="text-right">Tool Cost</TableHead>
                <TableHead className="text-right">Total Cost</TableHead>
                <TableHead className="text-right">Margin</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeProjects.map((project) => (
                  <TableRow 
                    key={project.projectId} 
                    data-testid={`row-project-${project.projectId}`}
                    className="cursor-pointer hover-elevate"
                    onClick={() => setSelectedProject({ id: project.projectId, name: project.projectName })}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Eye className="h-4 w-4 text-muted-foreground" />
                        {project.projectName}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{project.region}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(project.revenue)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(project.humanCost)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(project.vendorCost)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(project.toolCost)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(project.actualCost)}</TableCell>
                    <TableCell className={`text-right font-medium ${project.margin >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatPercent(project.margin)}
                    </TableCell>
                    <TableCell>
                      <BucketBadge bucket={project.bucket} />
                    </TableCell>
                  </TableRow>
                ))}
              {activeProjects.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    {projectFilter 
                      ? "No cost data for selected project" 
                      : `No project cost data for ${MONTHS[selectedMonth - 1].label} ${selectedYear}`}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="text-sm text-muted-foreground">
        <p>
          Thresholds: Profit margins at or above {data?.thresholds.profitThreshold || 20}% are considered profitable.
          Margins between {data?.thresholds.breakevenThreshold || 0}% and {data?.thresholds.profitThreshold || 20}% are breakeven.
          Below {data?.thresholds.breakevenThreshold || 0}% indicates a loss.
        </p>
      </div>
        </TabsContent>

        <TabsContent value="hourly-buckets" className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Hourly Bucket Analysis
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Available implementation hours based on project value and configured rates
              </p>
            </div>
            {hourlyBuckets?.globalSettings && (
              <div className="text-xs text-muted-foreground text-right">
                <p>Global Rates: CA ${hourlyBuckets.globalSettings.hourlyRateCA}/h • TX ${hourlyBuckets.globalSettings.hourlyRateTX}/h • AE ${hourlyBuckets.globalSettings.hourlyRateAE}/h</p>
                <p>Profit Margin: {hourlyBuckets.globalSettings.profitabilityPercent}% • Variance: {hourlyBuckets.globalSettings.varianceHours}h</p>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {hourlyBucketsLoading ? (
            <Skeleton className="h-64" />
          ) : (
            <>
              <div className="flex items-center gap-4 mb-6 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Select
                    value={bucketProjectStatusFilter}
                    onValueChange={(val) => setBucketProjectStatusFilter(val)}
                  >
                    <SelectTrigger className="w-[130px]" data-testid="select-bucket-project-status-filter">
                      <SelectValue placeholder="Active" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Projects</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="on_hold">On Hold</SelectItem>
                      <SelectItem value="complete">Complete</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={bucketStatusFilter}
                    onValueChange={(val) => setBucketStatusFilter(val)}
                  >
                    <SelectTrigger className="w-[140px]" data-testid="select-bucket-status-filter">
                      <SelectValue placeholder="All Buckets" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Buckets</SelectItem>
                      <SelectItem value="on_track">On Track</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={bucketProjectFilter || "all"}
                    onValueChange={(val) => setBucketProjectFilter(val === "all" ? "" : val)}
                  >
                    <SelectTrigger className="w-[200px]" data-testid="select-bucket-project-filter">
                      <SelectValue placeholder="Select Project" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Select Project</SelectItem>
                      {hourlyBuckets?.projects
                        .filter(p => p.projectValue > 0)
                        .filter(p => bucketProjectStatusFilter === "all" || p.projectStatus === bucketProjectStatusFilter)
                        .map((p) => (
                          <SelectItem key={p.projectId} value={p.projectId}>
                            {p.projectName}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {(bucketProjectFilter || bucketStatusFilter !== "all" || bucketProjectStatusFilter !== "active") && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => { setBucketProjectFilter(""); setBucketStatusFilter("all"); setBucketProjectStatusFilter("active"); }}
                      data-testid="button-clear-bucket-filters"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-4 ml-auto">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="include-upsells"
                      checked={includeUpsells}
                      onCheckedChange={setIncludeUpsells}
                      data-testid="switch-include-upsells"
                    />
                    <Label htmlFor="include-upsells" className="text-sm cursor-pointer">
                      Include Upsells
                    </Label>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" data-testid="button-export-hourly-buckets">
                        <Download className="h-4 w-4 mr-2" />
                        Export
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={exportHourlyBucketsCSV} data-testid="menu-item-export-csv">
                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                        Export as CSV
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={exportHourlyBucketsPDF} data-testid="menu-item-export-pdf">
                        <FileText className="h-4 w-4 mr-2" />
                        Export as PDF
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-6">
                <div className="bg-muted/50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold">{formatHours(hourlyBuckets?.summary.totalAvailableHours || 0)}</div>
                  <p className="text-xs text-muted-foreground">Total Available</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold">{formatHours(hourlyBuckets?.summary.totalConsumedHours || 0)}</div>
                  <p className="text-xs text-muted-foreground">Consumed Hours</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold">{(hourlyBuckets?.summary.overallUtilization || 0).toFixed(1)}%</div>
                  <p className="text-xs text-muted-foreground">Overall Utilization</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="flex items-center justify-center gap-4">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                      <span className="text-sm font-medium">{hourlyBuckets?.summary.onTrackCount || 0}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-amber-500" />
                      <span className="text-sm font-medium">{hourlyBuckets?.summary.warningCount || 0}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <span className="text-sm font-medium">{hourlyBuckets?.summary.criticalCount || 0}</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground text-center mt-1">Project Status</p>
                </div>
              </div>

              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Total Bucket</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                    <TableHead className="text-right">Consumed</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                    <TableHead className="text-right">Profit Margin</TableHead>
                    <TableHead>Utilization</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hourlyBuckets?.projects
                    .filter(p => p.projectValue > 0)
                    .filter(p => bucketProjectStatusFilter === "all" || p.projectStatus === bucketProjectStatusFilter)
                    .filter(p => bucketStatusFilter === "all" || p.bucketStatus === bucketStatusFilter)
                    .filter(p => !bucketProjectFilter || p.projectId === bucketProjectFilter)
                    .map((project) => (
                    <TableRow 
                      key={project.projectId} 
                      data-testid={`row-bucket-${project.projectId}`}
                      className="cursor-pointer hover-elevate"
                      onClick={() => handleOpenBucketProject(project)}
                    >
                      <TableCell className="font-medium">{project.projectName}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{project.region}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                          <span>{formatCurrency(project.projectValue)}</span>
                          {includeUpsells && project.upsellAmount > 0 && (
                            <span className="text-xs text-muted-foreground">
                              +{formatCurrency(project.upsellAmount)} upsells
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end">
                          ${project.hourlyRate}/h
                          <OverrideIndicator isOverridden={project.isHourlyRateOverridden} />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{formatHours(project.totalHourBucket)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end">
                          {formatHours(project.finalAvailableHours)}
                          {(project.isProfitabilityOverridden || project.isVarianceOverridden || project.isAvailableHoursOverridden) && (
                            <OverrideIndicator isOverridden={true} />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{formatHours(project.consumedHours)}</TableCell>
                      <TableCell className={`text-right font-medium ${project.remainingHours < 0 ? "text-red-600" : ""}`}>
                        {formatHours(project.remainingHours)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end">
                          <span className={`font-medium ${project.effectiveProfitabilityMargin >= project.profitabilityPercent ? "text-green-600" : "text-red-600"}`}>
                            {project.effectiveProfitabilityMargin.toFixed(1)}%
                          </span>
                          {(project.isProfitabilityOverridden) && (
                            <OverrideIndicator isOverridden={true} />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="w-24">
                          <Progress 
                            value={Math.min(project.utilizationPercent, 100)} 
                            className={`h-2 ${
                              project.bucketStatus === "critical" ? "[&>div]:bg-red-500" :
                              project.bucketStatus === "warning" ? "[&>div]:bg-amber-500" : "[&>div]:bg-green-500"
                            }`}
                          />
                          <span className="text-xs text-muted-foreground">{project.utilizationPercent.toFixed(0)}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <HoursBucketStatusBadge status={project.bucketStatus} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {hourlyBuckets?.projects
                    .filter(p => p.projectValue > 0)
                    .filter(p => bucketProjectStatusFilter === "all" || p.projectStatus === bucketProjectStatusFilter)
                    .filter(p => bucketStatusFilter === "all" || p.bucketStatus === bucketStatusFilter)
                    .filter(p => !bucketProjectFilter || p.projectId === bucketProjectFilter)
                    .length === 0 && (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                        {bucketProjectFilter || bucketStatusFilter !== "all" || bucketProjectStatusFilter !== "all"
                          ? "No projects match the selected filters"
                          : "No projects with assigned values found"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>

      <ProjectCostDetailSheet
        projectId={selectedProject?.id || null}
        projectName={selectedProject?.name || ""}
        onClose={() => setSelectedProject(null)}
      />

      <Sheet open={!!selectedBucketProject} onOpenChange={(open) => !open && setSelectedBucketProject(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selectedBucketProject?.projectName}</SheetTitle>
            <SheetDescription>
              Configure project-specific cost & margin overrides
            </SheetDescription>
          </SheetHeader>

          {selectedBucketProject && (
            <div className="space-y-6 mt-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Current Calculations</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Project Value</span>
                    <div className="text-right">
                      <span className="font-medium">{formatCurrency(selectedBucketProject.projectValue)}</span>
                      {includeUpsells && selectedBucketProject.upsellAmount > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Base: {formatCurrency(selectedBucketProject.baseCost)} + Upsells: {formatCurrency(selectedBucketProject.upsellAmount)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Hour Bucket</span>
                    <span className="font-medium">{formatHours(selectedBucketProject.totalHourBucket)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Profit Reserved</span>
                    <span className="font-medium">{formatHours(selectedBucketProject.profitReservedHours)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Implementation Hours</span>
                    <span className="font-medium">{formatHours(selectedBucketProject.implementationHours)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Available Hours</span>
                    <span className="font-medium">{formatHours(selectedBucketProject.finalAvailableHours)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Consumed Hours</span>
                    <span className="font-medium">{formatHours(selectedBucketProject.consumedHours)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-muted-foreground">Remaining Hours</span>
                    <span className={`font-bold ${selectedBucketProject.remainingHours < 0 ? "text-red-600" : "text-green-600"}`}>
                      {formatHours(selectedBucketProject.remainingHours)}
                    </span>
                  </div>
                  <div className="pt-2">
                    <div className="flex justify-between mb-1">
                      <span className="text-muted-foreground">Utilization</span>
                      <span className="font-medium">{selectedBucketProject.utilizationPercent.toFixed(1)}%</span>
                    </div>
                    <Progress 
                      value={Math.min(selectedBucketProject.utilizationPercent, 100)} 
                      className={`h-2 ${
                        selectedBucketProject.bucketStatus === "critical" ? "[&>div]:bg-red-500" :
                        selectedBucketProject.bucketStatus === "warning" ? "[&>div]:bg-amber-500" : "[&>div]:bg-green-500"
                      }`}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Project Overrides</CardTitle>
                  <p className="text-xs text-muted-foreground">Override global settings for this project only</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="override-rate">Custom Hourly Rate</Label>
                      <Switch 
                        id="override-rate" 
                        checked={useOverrideRate} 
                        onCheckedChange={setUseOverrideRate}
                        data-testid="switch-override-rate"
                      />
                    </div>
                    {useOverrideRate && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">$</span>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder={`Global: $${hourlyBuckets?.globalSettings?.hourlyRateCA || 20}/h`}
                          value={overrideHourlyRate}
                          onChange={(e) => setOverrideHourlyRate(e.target.value)}
                          data-testid="input-override-rate"
                        />
                        <span className="text-sm text-muted-foreground">/h</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="override-profit">Custom Profitability %</Label>
                      <Switch 
                        id="override-profit" 
                        checked={useOverrideProfitability} 
                        onCheckedChange={setUseOverrideProfitability}
                        data-testid="switch-override-profit"
                      />
                    </div>
                    {useOverrideProfitability && (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          step="0.1"
                          placeholder={`Global: ${hourlyBuckets?.globalSettings?.profitabilityPercent || 30}%`}
                          value={overrideProfitability}
                          onChange={(e) => setOverrideProfitability(e.target.value)}
                          data-testid="input-override-profit"
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="override-variance">Custom Variance Hours</Label>
                      <Switch 
                        id="override-variance" 
                        checked={useOverrideVariance} 
                        onCheckedChange={setUseOverrideVariance}
                        data-testid="switch-override-variance"
                      />
                    </div>
                    {useOverrideVariance && (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          step="1"
                          placeholder={`Global: ${hourlyBuckets?.globalSettings?.varianceHours || 0}h`}
                          value={overrideVariance}
                          onChange={(e) => setOverrideVariance(e.target.value)}
                          data-testid="input-override-variance"
                        />
                        <span className="text-sm text-muted-foreground">hours</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 border-t pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="override-available">Manual Available Hours</Label>
                        <p className="text-xs text-muted-foreground mt-0.5">For legacy projects not previously tracked</p>
                      </div>
                      <Switch 
                        id="override-available" 
                        checked={useOverrideAvailableHours} 
                        onCheckedChange={setUseOverrideAvailableHours}
                        data-testid="switch-override-available"
                      />
                    </div>
                    {useOverrideAvailableHours && (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          step="1"
                          placeholder={`Calculated: ${selectedBucketProject?.calculatedAvailableHours?.toFixed(1) || 0}h`}
                          value={overrideAvailableHours}
                          onChange={(e) => setOverrideAvailableHours(e.target.value)}
                          data-testid="input-override-available"
                        />
                        <span className="text-sm text-muted-foreground">hours</span>
                      </div>
                    )}
                  </div>

                  <Button 
                    className="w-full mt-4" 
                    onClick={handleSaveOverrides}
                    disabled={updateProjectOverridesMutation.isPending}
                    data-testid="button-save-overrides"
                  >
                    {updateProjectOverridesMutation.isPending ? "Saving..." : "Save Overrides"}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Timesheet Entries</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    All hours logged up to {MONTHS.find(m => m.value === selectedMonth)?.label} {selectedYear}
                  </p>
                </CardHeader>
                <CardContent>
                  {selectedBucketProject.timesheetEntries && selectedBucketProject.timesheetEntries.length > 0 ? (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {selectedBucketProject.timesheetEntries.map((entry) => (
                        <div key={entry.id} className="flex items-center justify-between py-2 border-b last:border-b-0 gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium truncate">{entry.userName}</span>
                              <Badge variant={entry.approvalStatus === "approved" ? "default" : entry.approvalStatus === "rejected" ? "destructive" : "secondary"} className="text-xs flex-shrink-0">
                                {entry.approvalStatus}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {new Date(entry.date).toLocaleDateString()}
                              {entry.description && ` - ${entry.description}`}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <span className="font-medium">{entry.hoursLogged.toFixed(1)}h</span>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" data-testid={`button-timesheet-actions-${entry.id}`}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {entry.approvalStatus !== "approved" && (
                                <DropdownMenuItem
                                  onClick={() => approveTimesheetMutation.mutate(entry.id)}
                                  disabled={approveTimesheetMutation.isPending}
                                  data-testid={`button-approve-timesheet-${entry.id}`}
                                >
                                  <Check className="h-4 w-4 mr-2 text-green-600" />
                                  Approve
                                </DropdownMenuItem>
                              )}
                              {entry.approvalStatus !== "rejected" && (
                                <DropdownMenuItem
                                  onClick={() => rejectTimesheetMutation.mutate(entry.id)}
                                  disabled={rejectTimesheetMutation.isPending}
                                  data-testid={`button-reject-timesheet-${entry.id}`}
                                >
                                  <X className="h-4 w-4 mr-2 text-orange-600" />
                                  Reject
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => deleteTimesheetMutation.mutate(entry.id)}
                                disabled={deleteTimesheetMutation.isPending}
                                className="text-destructive focus:text-destructive"
                                data-testid={`button-delete-timesheet-${entry.id}`}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No timesheet entries found</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
