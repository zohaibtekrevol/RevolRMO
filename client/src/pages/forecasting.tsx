import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { ProjectDetailSheet } from "@/components/project-detail-sheet";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import {
  TrendingUp,
  Calendar,
  DollarSign,
  BarChart3,
  Plus,
  Trash2,
  Edit2,
  Wand2,
  Eye,
  Pencil,
  Building2,
  ChevronDown,
  ChevronRight,
  Save,
  X,
  Milestone,
  ChevronsUpDown,
  Check,
  Download,
} from "lucide-react";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const FULL_MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

interface ForecastEntry_Grid {
  amount: number;
  paymentType: string;
  phase: string | null;
  entryId: string;
  source: string;
  milestoneName: string | null;
  milestoneStatus: string | null;
  month: number;
  year: number;
  notes: string | null;
  probability: number | null;
}

interface ForecastProject {
  id: string;
  name: string;
  clientName: string;
  region: string;
  billingType: string;
  status: string;
  isNewProject: boolean;
  isFullyPaid: boolean;
  totalCost: number;
  totalPaid: number;
  recurringPaid: number;
  upsellPaid: number;
  totalPending: number;
  pmId: string | null;
  pmName: string | null;
  mrrMonthlyAmount: number | null;
  mrrDurationMonths: number | null;
  numberOfPhases: number | null;
  monthlyForecasts: Record<string, ForecastEntry_Grid[]>;
}

interface ForecastOverview {
  months: { month: number; year: number; label: string }[];
  projects: ForecastProject[];
  monthlyTotals: Record<string, number>;
}

interface ForecastEntry {
  id: string;
  projectId: string;
  month: number;
  year: number;
  amount: string;
  paymentType: string;
  probability: number | null;
  phase: string | null;
  notes: string | null;
  createdBy: string | null;
  project?: {
    id: string;
    name: string;
    region: string;
    billingType: string | null;
    totalCost: string;
    clientName: string;
    status: string;
  };
}

interface BatchRow {
  key: string;
  month: number;
  year: number;
  paymentType: "recurring" | "upsell";
  amount: string;
  probability: string;
  phase: string;
  notes: string;
}

interface Project {
  id: string;
  name: string;
  clientName: string;
  region: string;
  billingType: string | null;
  status: string;
  totalCost: string;
  mrrMonthlyAmount: string | null;
  mrrDurationMonths: number | null;
  numberOfPhases: number | null;
  pm?: { id: string; firstName: string | null; lastName: string | null } | null;
}

const formatCurrency = (value: number | string | null) => {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (num === null || num === undefined || isNaN(num)) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
};

const getBillingTypeBadge = (billingType: string) => {
  const typeMap: Record<string, { label: string; className: string }> = {
    ftfc: { label: "FTFC", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
    mrr: { label: "MRR", className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
    tbe: { label: "TBE", className: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400" },
  };
  const config = typeMap[billingType] || { label: billingType?.toUpperCase() || "N/A", className: "bg-gray-100 text-gray-700" };
  return <Badge variant="outline" className={`text-xs ${config.className}`}>{config.label}</Badge>;
};

const getStatusBadge = (status: string) => {
  const map: Record<string, { label: string; className: string }> = {
    active: { label: "Active", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
    on_hold: { label: "On Hold", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
    complete: { label: "Complete", className: "bg-gray-100 text-gray-600 dark:bg-gray-800/40 dark:text-gray-400" },
  };
  const config = map[status] || { label: status, className: "" };
  return <Badge variant="outline" className={`text-xs ${config.className}`}>{config.label}</Badge>;
};

const getMilestoneStatusBadge = (status: string) => {
  const map: Record<string, { label: string; className: string }> = {
    planned: { label: "Planned", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
    ready_for_invoice: { label: "Ready", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
    invoiced: { label: "Invoiced", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
    partially_paid: { label: "Partial", className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
    paid: { label: "Paid", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  };
  const config = map[status] || { label: status, className: "" };
  return <Badge variant="outline" className={`text-[10px] ${config.className}`}>{config.label}</Badge>;
};

export default function Forecasting() {
  const currentDate = new Date();
  const [activeTab, setActiveTab] = useState<"monthly" | "project">("monthly");
  const [editMode, setEditMode] = useState(false);
  const [startMonth, setStartMonth] = useState(currentDate.getMonth() + 1);
  const [startYear, setStartYear] = useState(currentDate.getFullYear());
  const [monthsToShow, setMonthsToShow] = useState(12);

  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [detailProjectId, setDetailProjectId] = useState<string | null>(null);
  const [projectDetailOpen, setProjectDetailOpen] = useState(false);
  const [filterRegion, setFilterRegion] = useState<string>("");
  const [filterBillingType, setFilterBillingType] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("active");
  const [showPaidProjects, setShowPaidProjects] = useState(false);


  const [monthlyBatchOpen, setMonthlyBatchOpen] = useState(false);
  const [monthlyBatchProjectId, setMonthlyBatchProjectId] = useState("");
  const [monthlyProjectPopoverOpen, setMonthlyProjectPopoverOpen] = useState(false);
  const [projectPlanPopoverOpen, setProjectPlanPopoverOpen] = useState(false);
  const [monthlyBatchRows, setMonthlyBatchRows] = useState<BatchRow[]>([]);

  const [editEntryId, setEditEntryId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editPhase, setEditPhase] = useState("");
  const [editPaymentType, setEditPaymentType] = useState<"recurring" | "upsell">("recurring");
  const [editMonth, setEditMonth] = useState(currentDate.getMonth() + 1);
  const [editYear, setEditYear] = useState(currentDate.getFullYear());
  const [editNotes, setEditNotes] = useState("");
  const [editProbability, setEditProbability] = useState("100");

  const createEmptyBatchRow = (): BatchRow => ({
    key: Math.random().toString(36).slice(2),
    month: currentDate.getMonth() + 1,
    year: currentDate.getFullYear(),
    paymentType: "recurring",
    amount: "",
    probability: "100",
    phase: "",
    notes: "",
  });

  const [batchRows, setBatchRows] = useState<BatchRow[]>([createEmptyBatchRow()]);

  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  const { toast } = useToast();

  const years = Array.from({ length: 4 }, (_, i) => currentDate.getFullYear() - 1 + i);

  const queryString = new URLSearchParams({
    startMonth: startMonth.toString(),
    startYear: startYear.toString(),
    months: monthsToShow.toString(),
  }).toString();

  const { data: overview, isLoading: overviewLoading } = useQuery<ForecastOverview>({
    queryKey: ["/api/forecasting/overview", startMonth, startYear, monthsToShow],
    queryFn: () => fetch(`/api/forecasting/overview?${queryString}`, { credentials: "include" }).then(r => r.json()),
    refetchOnMount: "always",
  });

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    refetchOnMount: "always",
  });

  const { data: projectEntries, isLoading: entriesLoading } = useQuery<ForecastEntry[]>({
    queryKey: ["/api/forecasting/entries", selectedProjectId],
    queryFn: () => fetch(`/api/forecasting/entries?projectId=${selectedProjectId}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!selectedProjectId && activeTab === "project",
    refetchOnMount: "always",
  });

  const { data: monthlyBatchEntries } = useQuery<ForecastEntry[]>({
    queryKey: ["/api/forecasting/entries", monthlyBatchProjectId],
    queryFn: () => fetch(`/api/forecasting/entries?projectId=${monthlyBatchProjectId}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!monthlyBatchProjectId && activeTab === "monthly",
    refetchOnMount: "always",
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/forecasting/entries", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forecasting/overview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/forecasting/entries"] });
      resetNewRow();
      toast({ title: "Forecast entry added" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PATCH", `/api/forecasting/entries/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forecasting/overview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/forecasting/entries"] });
      setEditEntryId(null);
      toast({ title: "Forecast entry updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/forecasting/entries/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forecasting/overview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/forecasting/entries"] });
      toast({ title: "Forecast entry deleted" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const autoPopulateMutation = useMutation({
    mutationFn: (projectId: string) =>
      apiRequest("POST", `/api/forecasting/auto-populate/${projectId}`, {
        startMonth,
        startYear,
      }),
    onSuccess: (_, projectId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/forecasting/overview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/forecasting/entries"] });
      const proj = projects?.find(p => p.id === projectId);
      toast({ title: "Auto-populated", description: `MRR entries created for ${proj?.name || "project"}` });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const resetNewRow = () => {
    setBatchRows([createEmptyBatchRow()]);
  };

  const updateBatchRow = (key: string, field: keyof BatchRow, value: any) => {
    setBatchRows(prev => prev.map(r => r.key === key ? { ...r, [field]: value } : r));
  };

  const addBatchRow = () => {
    setBatchRows(prev => [...prev, createEmptyBatchRow()]);
  };

  const removeBatchRow = (key: string) => {
    setBatchRows(prev => prev.length <= 1 ? prev : prev.filter(r => r.key !== key));
  };

  const batchCreateMutation = useMutation({
    mutationFn: (data: { entries: any[] }) => apiRequest("POST", "/api/forecasting/entries/bulk", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forecasting/overview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/forecasting/entries"] });
      resetNewRow();
      toast({ title: "Forecast entries added" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleSaveBatchRows = () => {
    const validRows = batchRows.filter(r => r.amount && parseFloat(r.amount) > 0);
    if (!selectedProjectId || validRows.length === 0) {
      toast({ title: "Missing fields", description: "At least one row with an amount is required", variant: "destructive" });
      return;
    }
    const entries = validRows.map(r => ({
      projectId: selectedProjectId,
      month: r.month,
      year: r.year,
      amount: r.amount,
      paymentType: r.paymentType,
      probability: parseInt(r.probability) || 100,
      phase: r.phase || null,
      notes: r.notes || null,
    }));
    batchCreateMutation.mutate({ entries });
  };

  const openMonthlyBatch = () => {
    setMonthlyBatchOpen(true);
    setMonthlyBatchProjectId("");
    setMonthlyBatchRows([createEmptyBatchRow()]);
  };

  const closeMonthlyBatch = () => {
    setMonthlyBatchOpen(false);
    setMonthlyBatchProjectId("");
    setMonthlyBatchRows([]);
  };

  const updateMonthlyBatchRow = (key: string, field: keyof BatchRow, value: any) => {
    setMonthlyBatchRows(prev => prev.map(r => r.key === key ? { ...r, [field]: value } : r));
  };

  const addMonthlyBatchRow = () => {
    setMonthlyBatchRows(prev => [...prev, createEmptyBatchRow()]);
  };

  const removeMonthlyBatchRow = (key: string) => {
    setMonthlyBatchRows(prev => prev.length <= 1 ? prev : prev.filter(r => r.key !== key));
  };

  const monthlyBatchCreateMutation = useMutation({
    mutationFn: (data: { entries: any[] }) => apiRequest("POST", "/api/forecasting/entries/bulk", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forecasting/overview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/forecasting/entries"] });
      closeMonthlyBatch();
      toast({ title: "Forecast entries added" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleSaveMonthlyBatch = () => {
    const validRows = monthlyBatchRows.filter(r => r.amount && parseFloat(r.amount) > 0);
    if (!monthlyBatchProjectId || validRows.length === 0) {
      toast({ title: "Missing fields", description: "Select a project and add at least one row with an amount", variant: "destructive" });
      return;
    }
    const entries = validRows.map(r => ({
      projectId: monthlyBatchProjectId,
      month: r.month,
      year: r.year,
      amount: r.amount,
      paymentType: r.paymentType,
      probability: parseInt(r.probability) || 100,
      phase: r.phase || null,
      notes: r.notes || null,
    }));
    monthlyBatchCreateMutation.mutate({ entries });
  };

  const monthlyBatchProject = useMemo(() => {
    if (!monthlyBatchProjectId || !projects) return null;
    return projects.find(p => p.id === monthlyBatchProjectId) || null;
  }, [monthlyBatchProjectId, projects]);

  const startEditEntry = (entry: { id: string; month: number; year: number; amount: string; paymentType: string; phase: string | null; notes: string | null; probability: number | null }) => {
    setEditEntryId(entry.id);
    setEditMonth(entry.month);
    setEditYear(entry.year);
    setEditAmount(entry.amount);
    setEditPaymentType(entry.paymentType as "recurring" | "upsell");
    setEditPhase(entry.phase || "");
    setEditNotes(entry.notes || "");
    setEditProbability(String(entry.probability ?? 100));
  };

  const handleSaveEdit = (entryId: string) => {
    updateMutation.mutate({
      id: entryId,
      data: {
        month: editMonth,
        year: editYear,
        amount: editAmount,
        paymentType: editPaymentType,
        probability: parseInt(editProbability) || 100,
        phase: editPhase || null,
        notes: editNotes || null,
      },
    });
  };

  const toggleProjectExpanded = (projectId: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };

  const filteredProjects = useMemo(() => {
    if (!overview?.projects) return [];
    return overview.projects.filter(p => {
      if (!showPaidProjects && p.isFullyPaid) return false;
      if (filterRegion && filterRegion !== "all" && p.region !== filterRegion) return false;
      if (filterBillingType && filterBillingType !== "all" && p.billingType !== filterBillingType) return false;
      if (filterStatus && filterStatus !== "all" && p.status !== filterStatus) return false;
      return true;
    });
  }, [overview?.projects, filterRegion, filterBillingType, filterStatus, showPaidProjects]);

  const monthColumns = overview?.months || [];

  const grandTotals = useMemo(() => {
    if (!overview) return {};
    const totals: Record<string, number> = {};
    for (const month of monthColumns) {
      const key = `${month.month}-${month.year}`;
      totals[key] = filteredProjects.reduce((sum, p) => {
        const entries = p.monthlyForecasts[key] || [];
        return sum + entries.reduce((s, e) => s + e.amount, 0);
      }, 0);
    }
    return totals;
  }, [filteredProjects, monthColumns, overview]);

  const overallForecastTotal = useMemo(() => {
    return Object.values(grandTotals).reduce((sum, v) => sum + v, 0);
  }, [grandTotals]);

  const selectedProject = useMemo(() => {
    if (!selectedProjectId || !projects) return null;
    return projects.find(p => p.id === selectedProjectId) || null;
  }, [selectedProjectId, projects]);

  const selectedOverviewProject = useMemo(() => {
    if (!selectedProjectId || !overview?.projects) return null;
    return overview.projects.find(p => p.id === selectedProjectId) || null;
  }, [selectedProjectId, overview?.projects]);

  const combinedProjectEntries = useMemo(() => {
    if (!selectedOverviewProject) return [];
    const entries: Array<{
      id: string;
      source: string;
      month: number;
      year: number;
      amount: string;
      paymentType: string;
      probability: number | null;
      phase: string | null;
      notes: string | null;
      milestoneName: string | null;
      milestoneStatus: string | null;
    }> = [];
    for (const [, gridEntries] of Object.entries(selectedOverviewProject.monthlyForecasts)) {
      for (const ge of gridEntries) {
        entries.push({
          id: ge.entryId,
          source: ge.source,
          month: ge.month,
          year: ge.year,
          amount: ge.amount.toString(),
          paymentType: ge.paymentType,
          probability: ge.probability,
          phase: ge.phase,
          notes: ge.notes,
          milestoneName: ge.milestoneName,
          milestoneStatus: ge.milestoneStatus,
        });
      }
    }
    entries.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });
    return entries;
  }, [selectedOverviewProject]);

  const activeProjects = useMemo(() => {
    return (projects || []).filter(p => p.status === "active" || p.status === "on_hold");
  }, [projects]);

  const hasActiveFilters = (filterRegion && filterRegion !== "all") ||
    (filterBillingType && filterBillingType !== "all") ||
    (filterStatus && filterStatus !== "all" && filterStatus !== "active");

  const exportToExcel = () => {
    if (!overview || filteredProjects.length === 0) {
      toast({ title: "No Data", description: "No forecast data available to export.", variant: "destructive" });
      return;
    }

    const wb = XLSX.utils.book_new();

    const summaryHeaders = [
      "Project Name", "Client", "Region", "Category", "Billing Type", "Status",
      "PM", "Total Cost", "Total Paid", "Total Pending",
      ...monthColumns.map(mc => mc.label),
      "Forecast Total"
    ];

    const summaryData = filteredProjects.map(project => {
      const rowTotal = monthColumns.reduce((sum, mc) => {
        const key = `${mc.month}-${mc.year}`;
        const entries = project.monthlyForecasts[key] || [];
        return sum + entries.reduce((s, e) => s + e.amount, 0);
      }, 0);

      const billingLabels: Record<string, string> = { ftfc: "FTFC", tbe: "TBE", mrr: "MRR" };

      return [
        project.name,
        project.clientName,
        project.region,
        project.isNewProject ? "New" : "Old",
        billingLabels[project.billingType] || project.billingType,
        project.status,
        project.pmName || "-",
        project.totalCost,
        project.totalPaid,
        project.totalPending,
        ...monthColumns.map(mc => {
          const key = `${mc.month}-${mc.year}`;
          const entries = project.monthlyForecasts[key] || [];
          return entries.reduce((s, e) => s + e.amount, 0);
        }),
        rowTotal,
      ];
    });

    const grandTotalRow = [
      "Grand Total", "", "", "", "", "", "",
      filteredProjects.reduce((s, p) => s + p.totalCost, 0),
      filteredProjects.reduce((s, p) => s + p.totalPaid, 0),
      filteredProjects.reduce((s, p) => s + p.totalPending, 0),
      ...monthColumns.map(mc => {
        const key = `${mc.month}-${mc.year}`;
        return grandTotals[key] || 0;
      }),
      overallForecastTotal,
    ];

    const summarySheet = XLSX.utils.aoa_to_sheet([summaryHeaders, ...summaryData, [], grandTotalRow]);

    const colWidths = summaryHeaders.map((h, i) => {
      if (i === 0) return { wch: 30 };
      if (i === 1) return { wch: 20 };
      if (i >= 7) return { wch: 15 };
      return { wch: 14 };
    });
    summarySheet["!cols"] = colWidths;

    XLSX.utils.book_append_sheet(wb, summarySheet, "Forecast Summary");

    const detailHeaders = [
      "Project Name", "Client", "Region", "Category", "Billing Type", "Status", "PM",
      "Month", "Year", "Amount", "Payment Type", "Phase/Note", "Source", "Probability"
    ];

    const detailRows: any[][] = [];
    const billingLabels: Record<string, string> = { ftfc: "FTFC", tbe: "TBE", mrr: "MRR" };
    for (const project of filteredProjects) {
      for (const mc of monthColumns) {
        const key = `${mc.month}-${mc.year}`;
        const entries = project.monthlyForecasts[key] || [];
        for (const entry of entries) {
          detailRows.push([
            project.name,
            project.clientName,
            project.region,
            project.isNewProject ? "New" : "Old",
            billingLabels[project.billingType] || project.billingType,
            project.status,
            project.pmName || "-",
            mc.label,
            mc.year,
            entry.amount,
            entry.paymentType,
            entry.phase || entry.notes || "-",
            entry.source === "milestone" ? "Milestone" : "Manual",
            entry.probability != null ? `${entry.probability}%` : "-",
          ]);
        }
      }
    }

    const detailSheet = XLSX.utils.aoa_to_sheet([detailHeaders, ...detailRows]);
    detailSheet["!cols"] = detailHeaders.map((_, i) => {
      if (i === 0) return { wch: 30 };
      if (i === 1) return { wch: 20 };
      if (i === 7) return { wch: 12 };
      if (i === 9) return { wch: 15 };
      if (i === 11) return { wch: 25 };
      return { wch: 14 };
    });
    XLSX.utils.book_append_sheet(wb, detailSheet, "Forecast Details");

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    XLSX.writeFile(wb, `Forecast_Report_${dateStr}.xlsx`);

    toast({ title: "Report Exported", description: "Forecast report has been downloaded as an Excel file." });
  };

  if (overviewLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-64" />
        </div>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="heading-forecasting">
            <TrendingUp className="h-6 w-6" />
            Revenue Forecasting
          </h1>
          <p className="text-sm text-muted-foreground">
            Plan and forecast recurring & upsell payments across future months
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={editMode ? "default" : "outline"}
            size="sm"
            onClick={() => setEditMode(!editMode)}
            data-testid="button-toggle-edit-mode"
          >
            {editMode ? <><Pencil className="h-4 w-4 mr-1" /> Editing</> : <><Eye className="h-4 w-4 mr-1" /> View Only</>}
          </Button>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-50 dark:bg-green-950/40">
                <DollarSign className="h-5 w-5 text-green-600 dark:text-green-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Forecast</p>
                <p className="text-xl font-bold" data-testid="text-total-forecast">
                  {formatCurrency(overallForecastTotal)}
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Next {monthsToShow} months from {MONTH_NAMES[startMonth - 1]} {startYear}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950/40">
                <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Projects Shown</p>
                <p className="text-xl font-bold" data-testid="text-active-projects">
                  {filteredProjects.length}
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Filtered projects
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-50 dark:bg-purple-950/40">
                <Calendar className="h-5 w-5 text-purple-600 dark:text-purple-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg Monthly</p>
                <p className="text-xl font-bold" data-testid="text-avg-monthly">
                  {formatCurrency(monthsToShow > 0 ? overallForecastTotal / monthsToShow : 0)}
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Average per month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Date Range & Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Calendar className="h-4 w-4" />
              Range:
            </div>

            <Select value={startMonth.toString()} onValueChange={(v) => setStartMonth(parseInt(v))}>
              <SelectTrigger className="w-[130px]" data-testid="select-start-month">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FULL_MONTH_NAMES.map((name, i) => (
                  <SelectItem key={i} value={(i + 1).toString()}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={startYear.toString()} onValueChange={(v) => setStartYear(parseInt(v))}>
              <SelectTrigger className="w-[90px]" data-testid="select-start-year">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map(y => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <span className="text-sm text-muted-foreground">showing</span>

            <Select value={monthsToShow.toString()} onValueChange={(v) => setMonthsToShow(parseInt(v))}>
              <SelectTrigger className="w-[80px]" data-testid="select-months-count">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="6">6</SelectItem>
                <SelectItem value="12">12</SelectItem>
                <SelectItem value="18">18</SelectItem>
                <SelectItem value="24">24</SelectItem>
              </SelectContent>
            </Select>

            <span className="text-sm text-muted-foreground">months</span>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={() => { setFilterRegion(""); setFilterBillingType(""); setFilterStatus("active"); }} data-testid="button-clear-filters">
                Clear Filters
              </Button>
            )}

            <div className="ml-auto flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch
                  id="show-paid-projects"
                  checked={showPaidProjects}
                  onCheckedChange={setShowPaidProjects}
                  data-testid="toggle-show-paid-projects"
                />
                <Label htmlFor="show-paid-projects" className="text-xs text-muted-foreground whitespace-nowrap cursor-pointer">
                  Show Paid
                </Label>
              </div>

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[120px]" data-testid="filter-status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="complete">Complete</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterRegion} onValueChange={setFilterRegion}>
                <SelectTrigger className="w-[110px]" data-testid="filter-region">
                  <SelectValue placeholder="Region" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Regions</SelectItem>
                  <SelectItem value="CA">CA</SelectItem>
                  <SelectItem value="TX">TX</SelectItem>
                  <SelectItem value="AE">AE</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterBillingType} onValueChange={setFilterBillingType}>
                <SelectTrigger className="w-[110px]" data-testid="filter-billing-type">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="ftfc">FTFC</SelectItem>
                  <SelectItem value="mrr">MRR</SelectItem>
                  <SelectItem value="tbe">TBE</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "monthly" | "project")}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <TabsList>
            <TabsTrigger value="monthly" className="flex items-center gap-2" data-testid="tab-monthly-plan">
              <Calendar className="h-4 w-4" />
              Monthly Plan
            </TabsTrigger>
            <TabsTrigger value="project" className="flex items-center gap-2" data-testid="tab-project-plan">
              <BarChart3 className="h-4 w-4" />
              Project Plan
            </TabsTrigger>
          </TabsList>
          <Button
            variant="outline"
            size="sm"
            onClick={exportToExcel}
            disabled={!overview || filteredProjects.length === 0}
            data-testid="button-export-forecast"
          >
            <Download className="h-4 w-4 mr-1" />
            Export Report
          </Button>
        </div>

        {/* Monthly Plan Tab */}
        <TabsContent value="monthly" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-5 w-5" />
                All Projects - Monthly Forecast Grid
              </CardTitle>
              <div className="flex items-center gap-2">
                {editMode && (
                  <Button
                    size="sm"
                    variant={monthlyBatchOpen ? "default" : "outline"}
                    onClick={() => monthlyBatchOpen ? closeMonthlyBatch() : openMonthlyBatch()}
                    data-testid="button-add-entry"
                  >
                    {monthlyBatchOpen ? <X className="h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                    {monthlyBatchOpen ? "Close" : "Add Entry"}
                  </Button>
                )}
                <Badge variant="secondary">{filteredProjects.length} projects</Badge>
              </div>
            </CardHeader>

            {/* Inline Batch Entry Form */}
            {monthlyBatchOpen && editMode && (
              <CardContent className="border-b pb-4">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <Label className="text-sm font-medium">Select Project:</Label>
                    <Popover open={monthlyProjectPopoverOpen} onOpenChange={setMonthlyProjectPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={monthlyProjectPopoverOpen}
                          className="w-[300px] justify-between font-normal"
                          data-testid="monthly-batch-select-project"
                        >
                          {monthlyBatchProjectId
                            ? (() => { const p = activeProjects.find(p => p.id === monthlyBatchProjectId); return p ? `${p.name} (${p.clientName})` : "Choose a project..."; })()
                            : "Choose a project..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[300px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search projects..." />
                          <CommandList>
                            <CommandEmpty>No project found.</CommandEmpty>
                            <CommandGroup>
                              {activeProjects.map(p => (
                                <CommandItem
                                  key={p.id}
                                  value={`${p.name} ${p.clientName}`}
                                  onSelect={() => {
                                    setMonthlyBatchProjectId(p.id);
                                    setMonthlyBatchRows([createEmptyBatchRow()]);
                                    setMonthlyProjectPopoverOpen(false);
                                  }}
                                >
                                  <Check className={cn("mr-2 h-4 w-4", monthlyBatchProjectId === p.id ? "opacity-100" : "opacity-0")} />
                                  {p.name} ({p.clientName})
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {monthlyBatchProject && (() => {
                    const totalCost = parseFloat(monthlyBatchProject.totalCost || "0");
                    const forecastedAmount = monthlyBatchEntries?.reduce((sum, e) => sum + parseFloat(e.amount || "0"), 0) || 0;
                    const batchTotal = monthlyBatchRows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
                    const remainingBalance = totalCost - forecastedAmount - batchTotal;
                    return (
                      <div className="grid gap-3 grid-cols-2 sm:grid-cols-5">
                        <Card>
                          <CardContent className="p-3">
                            <p className="text-xs text-muted-foreground">Total Project Cost</p>
                            <p className="text-base font-bold">{formatCurrency(totalCost)}</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-3">
                            <p className="text-xs text-muted-foreground">Amount Forecasted</p>
                            <p className="text-base font-bold text-blue-600 dark:text-blue-400">{formatCurrency(forecastedAmount)}</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-3">
                            <p className="text-xs text-muted-foreground">New Entries Total</p>
                            <p className="text-base font-bold text-green-600 dark:text-green-400">{formatCurrency(batchTotal)}</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-3">
                            <p className="text-xs text-muted-foreground">Remaining Balance</p>
                            <p className={`text-base font-bold ${remainingBalance < 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
                              {formatCurrency(remainingBalance)}
                            </p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-3">
                            <p className="text-xs text-muted-foreground">Billing Type</p>
                            <div className="mt-1">{getBillingTypeBadge(monthlyBatchProject.billingType || "")}</div>
                          </CardContent>
                        </Card>
                      </div>
                    );
                  })()}

                  {monthlyBatchProjectId && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium flex items-center gap-2">
                          <Plus className="h-4 w-4" />
                          Add Forecast Entries
                        </p>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{monthlyBatchRows.filter(r => r.amount && parseFloat(r.amount) > 0).length} rows</Badge>
                          <Button
                            size="sm"
                            onClick={handleSaveMonthlyBatch}
                            disabled={monthlyBatchCreateMutation.isPending || monthlyBatchRows.every(r => !r.amount)}
                            data-testid="monthly-batch-save-all"
                          >
                            <Save className="h-4 w-4 mr-1" />
                            {monthlyBatchCreateMutation.isPending ? "Saving..." : "Save All"}
                          </Button>
                        </div>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[160px]">Month</TableHead>
                            <TableHead className="min-w-[120px]">Type</TableHead>
                            <TableHead className="text-right min-w-[110px]">Amount ($)</TableHead>
                            <TableHead className="text-center min-w-[90px]">Probability %</TableHead>
                            <TableHead className="min-w-[130px]">Phase</TableHead>
                            <TableHead className="min-w-[140px]">Notes</TableHead>
                            <TableHead className="w-[70px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {monthlyBatchRows.map((row, idx) => (
                            <TableRow key={row.key} className="bg-muted/20" data-testid={`monthly-batch-row-${idx}`}>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Select value={row.month.toString()} onValueChange={(v) => updateMonthlyBatchRow(row.key, "month", parseInt(v))}>
                                    <SelectTrigger className="h-8 w-[90px] text-xs" data-testid={`monthly-batch-month-${idx}`}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {MONTH_NAMES.map((name, i) => (
                                        <SelectItem key={i} value={(i + 1).toString()}>{name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Select value={row.year.toString()} onValueChange={(v) => updateMonthlyBatchRow(row.key, "year", parseInt(v))}>
                                    <SelectTrigger className="h-8 w-[75px] text-xs" data-testid={`monthly-batch-year-${idx}`}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {years.map(y => (
                                        <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Select value={row.paymentType} onValueChange={(v) => updateMonthlyBatchRow(row.key, "paymentType", v)}>
                                  <SelectTrigger className="h-8 text-xs" data-testid={`monthly-batch-type-${idx}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="recurring">Recurring</SelectItem>
                                    <SelectItem value="upsell">Upsell</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={row.amount}
                                  onChange={e => updateMonthlyBatchRow(row.key, "amount", e.target.value)}
                                  className="h-8 text-xs text-right"
                                  type="number"
                                  placeholder="0.00"
                                  data-testid={`monthly-batch-amount-${idx}`}
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={row.probability}
                                  onChange={e => updateMonthlyBatchRow(row.key, "probability", e.target.value)}
                                  className="h-8 text-xs text-center"
                                  type="number"
                                  min="0"
                                  max="100"
                                  placeholder="100"
                                  data-testid={`monthly-batch-probability-${idx}`}
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={row.phase}
                                  onChange={e => updateMonthlyBatchRow(row.key, "phase", e.target.value)}
                                  className="h-8 text-xs"
                                  placeholder="Phase"
                                  data-testid={`monthly-batch-phase-${idx}`}
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={row.notes}
                                  onChange={e => updateMonthlyBatchRow(row.key, "notes", e.target.value)}
                                  className="h-8 text-xs"
                                  placeholder="Notes"
                                  data-testid={`monthly-batch-notes-${idx}`}
                                />
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={addMonthlyBatchRow}
                                    data-testid={`monthly-batch-add-row-${idx}`}
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                  {monthlyBatchRows.length > 1 && (
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => removeMonthlyBatchRow(row.key)}
                                      data-testid={`monthly-batch-remove-row-${idx}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-muted/50 font-medium border-t">
                            <TableCell colSpan={2} className="text-right text-sm font-bold">Batch Total:</TableCell>
                            <TableCell className="text-right font-bold text-sm">
                              {formatCurrency(monthlyBatchRows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0))}
                            </TableCell>
                            <TableCell colSpan={4} />
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </CardContent>
            )}

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 z-10 bg-background min-w-[220px]">Project</TableHead>
                      <TableHead className="min-w-[80px]">Type</TableHead>
                      <TableHead className="min-w-[70px]">Status</TableHead>
                      <TableHead className="text-right min-w-[100px]">Total Cost</TableHead>
                      <TableHead className="text-right min-w-[80px]">Paid</TableHead>
                      <TableHead className="text-right min-w-[80px]">Pending</TableHead>
                      {monthColumns.map(mc => (
                        <TableHead key={`${mc.month}-${mc.year}`} className="text-right min-w-[100px]">
                          {mc.label}
                        </TableHead>
                      ))}
                      <TableHead className="text-right min-w-[100px] font-bold">Row Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProjects.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7 + monthColumns.length} className="text-center text-muted-foreground py-8">
                          No projects found matching filters. {editMode && "Click 'Add Entry' to start forecasting."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      <>
                        {/* Grand Total Row at Top */}
                        <TableRow className="bg-muted/50 font-bold border-b-2">
                          <TableCell className="sticky left-0 z-10 bg-muted/50 font-bold">Grand Total</TableCell>
                          <TableCell className="bg-muted/50" />
                          <TableCell className="bg-muted/50" />
                          <TableCell className="text-right bg-muted/50">
                            {formatCurrency(filteredProjects.reduce((s, p) => s + p.totalCost, 0))}
                          </TableCell>
                          <TableCell className="text-right text-green-600 dark:text-green-400 bg-muted/50">
                            {formatCurrency(filteredProjects.reduce((s, p) => s + p.totalPaid, 0))}
                          </TableCell>
                          <TableCell className="text-right bg-muted/50">
                            {formatCurrency(filteredProjects.reduce((s, p) => s + p.totalPending, 0))}
                          </TableCell>
                          {monthColumns.map(mc => {
                            const key = `${mc.month}-${mc.year}`;
                            const total = grandTotals[key] || 0;
                            return (
                              <TableCell key={key} className="text-right bg-muted/50">
                                <span className={total > 0 ? "" : "text-muted-foreground"}>
                                  {total > 0 ? formatCurrency(total) : "-"}
                                </span>
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-right bg-muted/50">
                            {formatCurrency(overallForecastTotal)}
                          </TableCell>
                        </TableRow>

                        {filteredProjects.map(project => {
                          const isExpanded = expandedProjects.has(project.id);
                          const rowTotal = monthColumns.reduce((sum, mc) => {
                            const key = `${mc.month}-${mc.year}`;
                            const entries = project.monthlyForecasts[key] || [];
                            return sum + entries.reduce((s, e) => s + e.amount, 0);
                          }, 0);

                          return (
                            <TableRow
                              key={project.id}
                              data-testid={`row-project-${project.id}`}
                            >
                              <TableCell className="sticky left-0 z-10 bg-background">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => toggleProjectExpanded(project.id)}
                                    className="p-0.5 rounded"
                                    data-testid={`button-expand-${project.id}`}
                                  >
                                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                  </button>
                                  <div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <button
                                        className="font-medium text-sm hover:underline hover:text-primary transition-colors text-left"
                                        onClick={() => { setDetailProjectId(project.id); setProjectDetailOpen(true); }}
                                        data-testid={`link-project-forecast-${project.id}`}
                                      >
                                        {project.name}
                                      </button>
                                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 leading-4 ${project.isNewProject ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400"}`}>
                                        {project.isNewProject ? "New" : "Old"}
                                      </Badge>
                                    </div>
                                    <div className="text-xs text-muted-foreground">{project.clientName}</div>
                                    {project.pmName && <div className="text-xs text-muted-foreground">{project.pmName}</div>}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>{getBillingTypeBadge(project.billingType)}</TableCell>
                              <TableCell>{getStatusBadge(project.status)}</TableCell>
                              <TableCell className="text-right text-sm">{formatCurrency(project.totalCost)}</TableCell>
                              <TableCell className="text-right text-sm text-green-600 dark:text-green-400">{formatCurrency(project.totalPaid)}</TableCell>
                              <TableCell className="text-right text-sm">{formatCurrency(project.totalPending)}</TableCell>
                              {monthColumns.map(mc => {
                                const key = `${mc.month}-${mc.year}`;
                                const entries = project.monthlyForecasts[key] || [];
                                const monthTotal = entries.reduce((s, e) => s + e.amount, 0);

                                return (
                                  <TableCell key={key} className="text-right">
                                    {isExpanded ? (
                                      <div className="space-y-1">
                                        {entries.map((entry) => (
                                          <div key={entry.entryId} className="flex items-center justify-end gap-1">
                                            {editMode && editEntryId === entry.entryId && entry.source === "manual" ? (
                                              <div className="flex flex-col gap-1 items-end">
                                                <div className="flex items-center gap-1">
                                                  <Input
                                                    value={editAmount}
                                                    onChange={e => setEditAmount(e.target.value)}
                                                    className="w-20 h-7 text-xs text-right"
                                                    type="number"
                                                    placeholder="Amount"
                                                    onKeyDown={e => { if (e.key === "Enter") handleSaveEdit(entry.entryId); if (e.key === "Escape") setEditEntryId(null); }}
                                                    autoFocus
                                                    data-testid={`input-edit-amount-${entry.entryId}`}
                                                  />
                                                  <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    onClick={() => handleSaveEdit(entry.entryId)}
                                                    data-testid={`button-save-${entry.entryId}`}
                                                  >
                                                    <Save className="h-3 w-3" />
                                                  </Button>
                                                  <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    onClick={() => setEditEntryId(null)}
                                                  >
                                                    <X className="h-3 w-3" />
                                                  </Button>
                                                </div>
                                                <Input
                                                  value={editPhase}
                                                  onChange={e => setEditPhase(e.target.value)}
                                                  className="w-28 h-6 text-[10px]"
                                                  placeholder="Phase / note"
                                                  onKeyDown={e => { if (e.key === "Enter") handleSaveEdit(entry.entryId); if (e.key === "Escape") setEditEntryId(null); }}
                                                  data-testid={`input-edit-phase-${entry.entryId}`}
                                                />
                                              </div>
                                            ) : (
                                              <>
                                                {entry.source === "milestone" && (
                                                  <Milestone className="h-3 w-3 text-blue-500 flex-shrink-0" />
                                                )}
                                                <span className={`text-xs ${entry.paymentType === "upsell" ? "text-purple-600 dark:text-purple-400" : ""}`}>
                                                  {formatCurrency(entry.amount)}
                                                </span>
                                                {entry.phase && (
                                                  <span className="text-[10px] text-muted-foreground ml-0.5">({entry.phase})</span>
                                                )}
                                                {entry.milestoneStatus && (
                                                  <span className="ml-0.5">{getMilestoneStatusBadge(entry.milestoneStatus)}</span>
                                                )}
                                                {editMode && entry.source === "manual" && (
                                                  <div className="flex items-center gap-0.5" style={{ visibility: "visible" }}>
                                                    <button
                                                      onClick={() => {
                                                        setEditEntryId(entry.entryId);
                                                        setEditAmount(entry.amount.toString());
                                                        setEditPhase(entry.phase || "");
                                                        setEditMonth(entry.month);
                                                        setEditYear(entry.year);
                                                        setEditPaymentType((entry.paymentType as "recurring" | "upsell") || "recurring");
                                                        setEditNotes(entry.notes || "");
                                                        setEditProbability(String(entry.probability ?? 100));
                                                      }}
                                                      className="p-0.5 rounded opacity-50 hover:opacity-100"
                                                      data-testid={`button-edit-${entry.entryId}`}
                                                    >
                                                      <Edit2 className="h-3 w-3" />
                                                    </button>
                                                    <button
                                                      onClick={() => deleteMutation.mutate(entry.entryId)}
                                                      className="p-0.5 rounded opacity-50 hover:opacity-100 text-destructive"
                                                      data-testid={`button-delete-${entry.entryId}`}
                                                    >
                                                      <Trash2 className="h-3 w-3" />
                                                    </button>
                                                  </div>
                                                )}
                                              </>
                                            )}
                                          </div>
                                        ))}
                                        {entries.length > 1 && (
                                          <div className="text-xs font-semibold border-t pt-1 text-right">
                                            {formatCurrency(monthTotal)}
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <span className={`text-sm ${monthTotal > 0 ? "font-medium" : "text-muted-foreground"}`}>
                                        {monthTotal > 0 ? formatCurrency(monthTotal) : "-"}
                                      </span>
                                    )}
                                  </TableCell>
                                );
                              })}
                              <TableCell className="text-right font-bold text-sm">
                                {formatCurrency(rowTotal)}
                              </TableCell>
                            </TableRow>
                          );
                        })}

                      </>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {editMode && (
            <Card className="mt-4">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wand2 className="h-5 w-5" />
                  Auto-Populate Forecasts
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-1">MRR Projects</h4>
                  <p className="text-xs text-muted-foreground mb-2">
                    Create monthly forecast entries based on configured monthly amount and remaining installments.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {activeProjects
                      .filter(p => p.billingType === "mrr")
                      .map(project => (
                        <Button
                          key={project.id}
                          variant="outline"
                          size="sm"
                          onClick={() => autoPopulateMutation.mutate(project.id)}
                          disabled={autoPopulateMutation.isPending}
                          data-testid={`button-auto-populate-${project.id}`}
                        >
                          <Wand2 className="h-3 w-3 mr-1" />
                          {project.name}
                        </Button>
                      ))}
                    {activeProjects.filter(p => p.billingType === "mrr").length === 0 && (
                      <p className="text-sm text-muted-foreground">No MRR projects found.</p>
                    )}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-1">FTFC / TBE Projects</h4>
                  <p className="text-xs text-muted-foreground mb-2">
                    Create forecast entries from unpaid milestones, mapped to their due dates. Replaces existing entries for the project.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {activeProjects
                      .filter(p => p.billingType === "ftfc" || p.billingType === "tbe")
                      .map(project => (
                        <Button
                          key={project.id}
                          variant="outline"
                          size="sm"
                          onClick={() => autoPopulateMutation.mutate(project.id)}
                          disabled={autoPopulateMutation.isPending}
                          data-testid={`button-auto-populate-ftfc-${project.id}`}
                        >
                          <Wand2 className="h-3 w-3 mr-1" />
                          {project.name}
                          <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0">
                            {(project.billingType || "").toUpperCase()}
                          </Badge>
                        </Button>
                      ))}
                    {activeProjects.filter(p => p.billingType === "ftfc" || p.billingType === "tbe").length === 0 && (
                      <p className="text-sm text-muted-foreground">No FTFC/TBE projects found.</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Project Plan Tab */}
        <TabsContent value="project" className="mt-4">
          <div className="space-y-4">
            {/* Project Selector */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Label className="text-sm font-medium">Select Project:</Label>
                  <Popover open={projectPlanPopoverOpen} onOpenChange={setProjectPlanPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={projectPlanPopoverOpen}
                        className="w-[300px] justify-between font-normal"
                        data-testid="select-project"
                      >
                        {selectedProjectId
                          ? (() => { const p = activeProjects.find(p => p.id === selectedProjectId); return p ? `${p.name} (${p.clientName})` : "Choose a project..."; })()
                          : "Choose a project..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search projects..." />
                        <CommandList>
                          <CommandEmpty>No project found.</CommandEmpty>
                          <CommandGroup>
                            {activeProjects.map(p => (
                              <CommandItem
                                key={p.id}
                                value={`${p.name} ${p.clientName}`}
                                onSelect={() => {
                                  setSelectedProjectId(p.id);
                                  resetNewRow();
                                  setProjectPlanPopoverOpen(false);
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", selectedProjectId === p.id ? "opacity-100" : "opacity-0")} />
                                {p.name} ({p.clientName})
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>

                  {selectedProject && selectedProject.billingType === "mrr" && editMode && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => autoPopulateMutation.mutate(selectedProjectId)}
                      disabled={autoPopulateMutation.isPending}
                      data-testid="button-auto-populate-project"
                    >
                      <Wand2 className="h-4 w-4 mr-1" />
                      Auto-Populate MRR
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {!selectedProjectId ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium mb-1">Select a project to view its forecast plan</p>
                  <p className="text-sm">Choose a project from the dropdown above to see detailed forecast entries</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Project Financial Summary */}
                {selectedProject && (() => {
                  const totalCost = selectedOverviewProject ? selectedOverviewProject.totalCost : parseFloat(selectedProject.totalCost || "0");
                  const forecastedAmount = combinedProjectEntries.reduce((sum, e) => sum + parseFloat(e.amount || "0"), 0);
                  const batchTotal = batchRows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
                  const remainingBalance = totalCost - forecastedAmount - batchTotal;
                  return (
                    <div className="grid gap-4 grid-cols-2 sm:grid-cols-5">
                      <Card>
                        <CardContent className="p-4">
                          <p className="text-xs text-muted-foreground">Total Project Cost</p>
                          <p className="text-lg font-bold">{formatCurrency(totalCost)}</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <p className="text-xs text-muted-foreground">Amount Forecasted</p>
                          <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{formatCurrency(forecastedAmount)}</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <p className="text-xs text-muted-foreground">New Entries Total</p>
                          <p className="text-lg font-bold text-green-600 dark:text-green-400">{formatCurrency(batchTotal)}</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <p className="text-xs text-muted-foreground">Remaining Balance</p>
                          <p className={`text-lg font-bold ${remainingBalance < 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
                            {formatCurrency(remainingBalance)}
                          </p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <p className="text-xs text-muted-foreground">Billing Type</p>
                          <div className="mt-1">{getBillingTypeBadge(selectedProject.billingType || "")}</div>
                        </CardContent>
                      </Card>
                    </div>
                  );
                })()}

                {/* Batch Entry Form - visible in edit mode */}
                {editMode && (
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Plus className="h-4 w-4" />
                        Add Forecast Entries
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{batchRows.filter(r => r.amount && parseFloat(r.amount) > 0).length} rows</Badge>
                        <Button
                          size="sm"
                          onClick={handleSaveBatchRows}
                          disabled={batchCreateMutation.isPending || batchRows.every(r => !r.amount)}
                          data-testid="button-save-batch"
                        >
                          <Save className="h-4 w-4 mr-1" />
                          {batchCreateMutation.isPending ? "Saving..." : "Save All"}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[160px]">Month</TableHead>
                            <TableHead className="min-w-[120px]">Type</TableHead>
                            <TableHead className="text-right min-w-[110px]">Amount ($)</TableHead>
                            <TableHead className="text-center min-w-[90px]">Probability %</TableHead>
                            <TableHead className="min-w-[130px]">Phase</TableHead>
                            <TableHead className="min-w-[140px]">Notes</TableHead>
                            <TableHead className="w-[70px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {batchRows.map((row, idx) => (
                            <TableRow key={row.key} className="bg-muted/20" data-testid={`batch-row-${idx}`}>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Select value={row.month.toString()} onValueChange={(v) => updateBatchRow(row.key, "month", parseInt(v))}>
                                    <SelectTrigger className="h-8 w-[90px] text-xs" data-testid={`batch-month-${idx}`}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {MONTH_NAMES.map((name, i) => (
                                        <SelectItem key={i} value={(i + 1).toString()}>{name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Select value={row.year.toString()} onValueChange={(v) => updateBatchRow(row.key, "year", parseInt(v))}>
                                    <SelectTrigger className="h-8 w-[75px] text-xs" data-testid={`batch-year-${idx}`}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {years.map(y => (
                                        <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Select value={row.paymentType} onValueChange={(v) => updateBatchRow(row.key, "paymentType", v)}>
                                  <SelectTrigger className="h-8 text-xs" data-testid={`batch-type-${idx}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="recurring">Recurring</SelectItem>
                                    <SelectItem value="upsell">Upsell</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={row.amount}
                                  onChange={e => updateBatchRow(row.key, "amount", e.target.value)}
                                  className="h-8 text-xs text-right"
                                  type="number"
                                  placeholder="0.00"
                                  data-testid={`batch-amount-${idx}`}
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={row.probability}
                                  onChange={e => updateBatchRow(row.key, "probability", e.target.value)}
                                  className="h-8 text-xs text-center"
                                  type="number"
                                  min="0"
                                  max="100"
                                  placeholder="100"
                                  data-testid={`batch-probability-${idx}`}
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={row.phase}
                                  onChange={e => updateBatchRow(row.key, "phase", e.target.value)}
                                  className="h-8 text-xs"
                                  placeholder="Phase"
                                  data-testid={`batch-phase-${idx}`}
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={row.notes}
                                  onChange={e => updateBatchRow(row.key, "notes", e.target.value)}
                                  className="h-8 text-xs"
                                  placeholder="Notes"
                                  data-testid={`batch-notes-${idx}`}
                                />
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={addBatchRow}
                                    data-testid={`batch-add-row-${idx}`}
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                  {batchRows.length > 1 && (
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => removeBatchRow(row.key)}
                                      data-testid={`batch-remove-row-${idx}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-muted/50 font-medium border-t">
                            <TableCell colSpan={2} className="text-right text-sm font-bold">Batch Total:</TableCell>
                            <TableCell className="text-right font-bold text-sm">
                              {formatCurrency(batchRows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0))}
                            </TableCell>
                            <TableCell colSpan={4} />
                          </TableRow>
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}

                {/* Existing Entries Table */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      Existing Forecast Entries
                    </CardTitle>
                    <Badge variant="secondary">{combinedProjectEntries.length} entries</Badge>
                  </CardHeader>
                  <CardContent className="p-0">
                    {overviewLoading ? (
                      <div className="p-6">
                        <Skeleton className="h-48" />
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[140px]">Month</TableHead>
                            <TableHead className="min-w-[110px]">Type</TableHead>
                            <TableHead className="min-w-[110px]">Source</TableHead>
                            <TableHead className="text-right min-w-[110px]">Amount</TableHead>
                            <TableHead className="text-center min-w-[90px]">Probability</TableHead>
                            <TableHead className="min-w-[100px]">Phase</TableHead>
                            <TableHead className="min-w-[140px]">Notes</TableHead>
                            <TableHead className="w-[100px]">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {combinedProjectEntries.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                                No forecast entries for this project yet.
                              </TableCell>
                            </TableRow>
                          )}

                          {combinedProjectEntries.map(entry => (
                            <TableRow key={entry.id} data-testid={`row-entry-${entry.id}`}>
                              {editEntryId === entry.id && entry.source === "manual" ? (
                                <>
                                  <TableCell>
                                    <div className="flex items-center gap-1">
                                      <Select value={editMonth.toString()} onValueChange={(v) => setEditMonth(parseInt(v))}>
                                        <SelectTrigger className="h-8 w-[90px] text-xs" data-testid={`edit-month-${entry.id}`}>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {MONTH_NAMES.map((name, i) => (
                                            <SelectItem key={i} value={(i + 1).toString()}>{name}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <Select value={editYear.toString()} onValueChange={(v) => setEditYear(parseInt(v))}>
                                        <SelectTrigger className="h-8 w-[75px] text-xs" data-testid={`edit-year-${entry.id}`}>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {years.map(y => (
                                            <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Select value={editPaymentType} onValueChange={(v) => setEditPaymentType(v as "recurring" | "upsell")}>
                                      <SelectTrigger className="h-8 text-xs" data-testid={`edit-type-${entry.id}`}>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="recurring">Recurring</SelectItem>
                                        <SelectItem value="upsell">Upsell</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className="text-xs">Manual</Badge>
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      value={editAmount}
                                      onChange={e => setEditAmount(e.target.value)}
                                      className="h-8 text-xs text-right"
                                      type="number"
                                      placeholder="Amount"
                                      data-testid={`edit-amount-${entry.id}`}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      value={editProbability}
                                      onChange={e => setEditProbability(e.target.value)}
                                      className="h-8 text-xs text-center"
                                      type="number"
                                      min="0"
                                      max="100"
                                      data-testid={`edit-probability-${entry.id}`}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      value={editPhase}
                                      onChange={e => setEditPhase(e.target.value)}
                                      className="h-8 text-xs"
                                      placeholder="Phase"
                                      data-testid={`edit-phase-${entry.id}`}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      value={editNotes}
                                      onChange={e => setEditNotes(e.target.value)}
                                      className="h-8 text-xs"
                                      placeholder="Notes"
                                      data-testid={`edit-notes-${entry.id}`}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => handleSaveEdit(entry.id)}
                                        disabled={updateMutation.isPending}
                                        data-testid={`button-save-project-${entry.id}`}
                                      >
                                        <Save className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => setEditEntryId(null)}
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </>
                              ) : (
                                <>
                                  <TableCell className="font-medium text-sm">
                                    {FULL_MONTH_NAMES[entry.month - 1]} {entry.year}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant={entry.paymentType === "upsell" ? "outline" : "secondary"} className="text-xs">
                                      {entry.paymentType === "recurring" ? "Recurring" : "Upsell"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className={`text-xs ${
                                      entry.source === "milestone"
                                        ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                                        : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                    }`}>
                                      {entry.source === "milestone" ? "Milestone" : "Manual"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right font-medium text-sm">
                                    {formatCurrency(entry.amount)}
                                  </TableCell>
                                  <TableCell className="text-center text-sm">
                                    <Badge variant="outline" className={`text-xs ${
                                      (entry.probability ?? 100) >= 80 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                                      (entry.probability ?? 100) >= 50 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" :
                                      "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                    }`}>
                                      {entry.probability ?? 100}%
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-sm text-muted-foreground">
                                    {entry.source === "milestone" && entry.milestoneName ? entry.milestoneName : (entry.phase || "-")}
                                  </TableCell>
                                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                                    {entry.source === "milestone" && entry.milestoneStatus ? (
                                      <Badge variant="outline" className="text-xs">{entry.milestoneStatus}</Badge>
                                    ) : (entry.notes || "-")}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1">
                                      {editMode && entry.source === "manual" && (
                                        <>
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={() => startEditEntry(entry)}
                                            data-testid={`button-edit-project-${entry.id}`}
                                          >
                                            <Edit2 className="h-4 w-4" />
                                          </Button>
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={() => deleteMutation.mutate(entry.id)}
                                            data-testid={`button-delete-project-${entry.id}`}
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </>
                                      )}
                                    </div>
                                  </TableCell>
                                </>
                              )}
                            </TableRow>
                          ))}

                          {/* Total row */}
                          {combinedProjectEntries.length > 0 && (
                            <TableRow className="bg-muted/50 font-bold border-t-2">
                              <TableCell colSpan={3} className="font-bold text-right">Total Forecasted:</TableCell>
                              <TableCell className="text-right font-bold">
                                {formatCurrency(
                                  combinedProjectEntries.reduce((sum, e) => sum + parseFloat(e.amount || "0"), 0)
                                )}
                              </TableCell>
                              <TableCell colSpan={4} />
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <ProjectDetailSheet
        projectId={detailProjectId}
        open={projectDetailOpen}
        onOpenChange={setProjectDetailOpen}
      />
    </div>
  );
}
