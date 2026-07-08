import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest, getErrorMessage } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { RegionBadge } from "@/components/region-badge";
import { Plus, Trash2, Copy, Loader2, AlertCircle, Sparkles, ArrowRight, ListPlus } from "lucide-react";
import type { PaymentWithProject, Project } from "@shared/schema";

type PlanRowData = {
  tempId: string;
  projectId: string;
  projectName: string;
  region: string;
  expectedAmount: string;
  status: "not_targeting" | "pending_invoice" | "invoiced" | "received";
  paymentType: "recurring" | "upsell";
  narration: string;
  dueDate: string;
  isNew?: boolean;
  milestoneHint?: string;
  prevStatus?: string;
};

type MilestoneData = {
  id: string;
  name: string;
  expectedAmount: string;
  status: string;
  sequenceNumber: number;
  dueDate: string | null;
};

const statusOptions = [
  { value: "pending_invoice", label: "Pending Invoice" },
  { value: "invoiced", label: "Invoiced" },
  { value: "received", label: "Received" },
  { value: "not_targeting", label: "Not Targeting" },
];

const paymentTypeOptions = [
  { value: "recurring", label: "Recurring" },
  { value: "upsell", label: "Upsell" },
];

interface BulkPlanGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetMonth: number;
  targetYear: number;
  previousMonthPayments: PaymentWithProject[];
  prevMonthLabel: string;
  prevYear: number;
}

function formatDateForInput(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toISOString().split("T")[0];
  } catch {
    return "";
  }
}

export function BulkPlanGenerator({
  open,
  onOpenChange,
  targetMonth: initialTargetMonth,
  targetYear: initialTargetYear,
  previousMonthPayments,
  prevMonthLabel,
  prevYear,
}: BulkPlanGeneratorProps) {
  const { toast } = useToast();
  const [rows, setRows] = useState<PlanRowData[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(initialTargetMonth);
  const [selectedYear, setSelectedYear] = useState(initialTargetYear);
  const [milestonesLoading, setMilestonesLoading] = useState(false);

  const [confirmMissingOpen, setConfirmMissingOpen] = useState(false);

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    enabled: open,
  });

  const { data: existingPayments, isFetching: existingPaymentsFetching } = useQuery<PaymentWithProject[]>({
    queryKey: ["/api/payments", { month: selectedMonth, year: selectedYear }],
    queryFn: async () => {
      const res = await fetch(`/api/payments?month=${selectedMonth}&year=${selectedYear}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch payments");
      return res.json();
    },
    enabled: open,
  });

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const targetMonthLabel = months[selectedMonth - 1];
  
  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

  useEffect(() => {
    if (open) {
      setSelectedMonth(initialTargetMonth);
      setSelectedYear(initialTargetYear);
      setConfirmMissingOpen(false);
      if (previousMonthPayments) {
        buildRowsFromPreviousMonth(previousMonthPayments);
      }
    }
  }, [open, previousMonthPayments, initialTargetMonth, initialTargetYear]);

  async function fetchProjectMilestones(projectId: string): Promise<MilestoneData[]> {
    try {
      const res = await fetch(`/api/projects/${projectId}/milestones`, { credentials: "include" });
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  }

  async function buildRowsFromPreviousMonth(payments: PaymentWithProject[]) {
    setMilestonesLoading(true);
    try {
    const eligible = payments.filter(p => p.paymentType === "recurring" || p.paymentType === "upsell");
    const rest = eligible.filter(p => !(p.paymentType === "upsell" && p.status === "received"));

    const projectMilestonesCache: Record<string, MilestoneData[]> = {};

    const initialRows: PlanRowData[] = [];

    for (const p of rest) {
      const wasReceived = p.status === "received";

      if (wasReceived && p.paymentType === "recurring") {
        if (!projectMilestonesCache[p.projectId]) {
          projectMilestonesCache[p.projectId] = await fetchProjectMilestones(p.projectId);
        }
        const milestones = projectMilestonesCache[p.projectId];
        const unpaidMilestones = milestones
          .filter(m => m.status !== "paid" && m.status !== "cancelled")
          .sort((a, b) => a.sequenceNumber - b.sequenceNumber);

        if (unpaidMilestones.length > 0) {
          const next = unpaidMilestones[0];
          initialRows.push({
            tempId: `prev-${p.id}`,
            projectId: p.projectId,
            projectName: p.project?.name || "Unknown",
            region: p.project?.region || "",
            expectedAmount: next.expectedAmount?.toString() || p.expectedAmount?.toString() || "0",
            status: "pending_invoice",
            paymentType: "recurring",
            narration: next.name || p.narration || "",
            dueDate: formatDateForInput(next.dueDate) || formatDateForInput(p.dueDate),
            isNew: false,
            milestoneHint: `Next milestone: ${next.name}`,
            prevStatus: "received",
          });
        } else {
          initialRows.push({
            tempId: `prev-${p.id}`,
            projectId: p.projectId,
            projectName: p.project?.name || "Unknown",
            region: p.project?.region || "",
            expectedAmount: p.expectedAmount?.toString() || "0",
            status: "not_targeting",
            paymentType: "recurring",
            narration: p.narration || "",
            dueDate: formatDateForInput(p.dueDate),
            isNew: false,
            milestoneHint: "No unpaid milestones remaining — set to Not Targeting",
            prevStatus: "received",
          });
        }
      } else {
        initialRows.push({
          tempId: `prev-${p.id}`,
          projectId: p.projectId,
          projectName: p.project?.name || "Unknown",
          region: p.project?.region || "",
          expectedAmount: p.expectedAmount?.toString() || "0",
          status: (p.status as PlanRowData["status"]) || "pending_invoice",
          paymentType: (p.paymentType === "upsell" ? "upsell" : "recurring") as "recurring" | "upsell",
          narration: p.narration || "",
          dueDate: formatDateForInput(p.dueDate),
          isNew: false,
          prevStatus: p.status,
        });
      }
    }

    setRows(initialRows);
    } finally {
      setMilestonesLoading(false);
    }
  }

  const updateRow = (tempId: string, field: keyof PlanRowData, value: string) => {
    setRows(prev => prev.map(row => {
      if (row.tempId !== tempId) return row;
      
      if (field === "projectId") {
        const project = projects?.find(p => p.id === value);
        return {
          ...row,
          projectId: value,
          projectName: project?.name || "",
          region: project?.region || "",
        };
      }
      
      return { ...row, [field]: value };
    }));
  };

  const removeRow = (tempId: string) => {
    setRows(prev => prev.filter(row => row.tempId !== tempId));
  };

  const addNewRow = () => {
    const newRow: PlanRowData = {
      tempId: `new-${Date.now()}`,
      projectId: "",
      projectName: "",
      region: "",
      expectedAmount: "0",
      status: "pending_invoice",
      paymentType: "recurring",
      narration: "",
      dueDate: "",
      isNew: true,
    };
    setRows(prev => [...prev, newRow]);
  };

  // Active, billable projects that are not yet represented in this plan (no staged row
  // and no existing payment for the selected month/year).
  // A project is "covered" only when it has a recurring payment (staged or already saved)
  // for the selected month/year — upsell-only activity does not count.
  const stagedRecurringProjectIds = new Set(
    rows.filter(r => r.paymentType === "recurring").map(r => r.projectId).filter(Boolean)
  );
  const existingRecurringProjectIds = new Set(
    (existingPayments || []).filter(p => p.paymentType === "recurring").map(p => p.projectId)
  );
  // Only compute once the target-month payments have loaded, to avoid transient false prompts
  // while switching months inside the dialog.
  const missingDataReady = !!projects && existingPayments !== undefined && !existingPaymentsFetching;
  const missingProjects = !missingDataReady
    ? []
    : (projects || []).filter(p =>
        p.status === "active" &&
        !!p.billingType &&
        !p.isFullyPaid &&
        !stagedRecurringProjectIds.has(p.id) &&
        !existingRecurringProjectIds.has(p.id)
      );

  const buildRowForProject = (project: Project): PlanRowData => ({
    tempId: `missing-${project.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    projectId: project.id,
    projectName: project.name,
    region: project.region,
    expectedAmount: project.mrrMonthlyAmount?.toString() || "0",
    status: "pending_invoice",
    paymentType: "recurring",
    narration: "",
    dueDate: "",
    isNew: true,
  });

  const addMissingProject = (project: Project) => {
    setRows(prev => [...prev, buildRowForProject(project)]);
  };

  const addAllMissingProjects = () => {
    const newRows = missingProjects.map(buildRowForProject);
    setRows(prev => [...prev, ...newRows]);
  };

  const bulkCreateMutation = useMutation({
    mutationFn: async (payments: Array<{
      projectId: string;
      expectedAmount: string;
      totalAmount: string;
      paymentType: string;
      status: string;
      narration: string;
      dueDate: string | null;
      month: number;
      year: number;
      isTarget: boolean;
    }>): Promise<{ created: number; errors: string[] }> => {
      const response = await apiRequest("POST", "/api/payments/bulk", { payments });
      return response as unknown as { created: number; errors: string[] };
    },
    onSuccess: (data: { created: number; errors: string[] }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pm-targets"] });
      
      if (data.errors && data.errors.length > 0) {
        toast({
          title: "Partial Success",
          description: `Created ${data.created} payments. ${data.errors.length} failed.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Plan Generated",
          description: `Successfully created ${data.created} payments for ${targetMonthLabel} ${selectedYear}.`,
        });
        onOpenChange(false);
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to generate plan."),
        variant: "destructive",
      });
    },
  });

  const handleGenerate = () => {
    const validRows = rows.filter(row => row.projectId && parseFloat(row.expectedAmount) > 0);

    if (validRows.length === 0) {
      toast({
        title: "No Valid Payments",
        description: "Please add at least one payment with a project and amount.",
        variant: "destructive",
      });
      return;
    }

    if (missingProjects.length > 0) {
      setConfirmMissingOpen(true);
      return;
    }

    performGenerate();
  };

  const performGenerate = () => {
    const validRows = rows.filter(row => row.projectId && parseFloat(row.expectedAmount) > 0);

    if (validRows.length === 0) {
      return;
    }

    const payments = validRows.map(row => {
      const project = projects?.find(p => p.id === row.projectId);
      const isTarget = row.paymentType === "recurring" && row.status !== "not_targeting";
      return {
        projectId: row.projectId,
        expectedAmount: row.expectedAmount,
        totalAmount: project?.totalCost?.toString() || row.expectedAmount,
        paymentType: row.paymentType,
        status: row.status,
        narration: row.narration,
        dueDate: row.dueDate || null,
        month: selectedMonth,
        year: selectedYear,
        isTarget,
      };
    });

    bulkCreateMutation.mutate(payments);
  };

  const totalAmount = rows.reduce((sum, row) => sum + parseFloat(row.expectedAmount || "0"), 0);
  const validRowCount = rows.filter(row => row.projectId && parseFloat(row.expectedAmount) > 0).length;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "received": return "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400";
      case "invoiced": return "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400";
      case "pending_invoice": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-400";
      case "not_targeting": return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
      default: return "bg-gray-100 text-gray-600";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] !grid-rows-none !flex !flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Copy className="h-5 w-5" />
            Generate Plan from {prevMonthLabel} {prevYear}
          </DialogTitle>
          <DialogDescription>
            Review and edit payments from last month. Statuses, due dates, and next milestones are pre-filled.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-4 px-6 pb-4 border-b">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Generate for:</span>
            <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
              <SelectTrigger className="w-[140px]" data-testid="select-target-month">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((m, i) => (
                  <SelectItem key={i} value={(i + 1).toString()}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
              <SelectTrigger className="w-[100px]" data-testid="select-target-year">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map(y => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">{validRowCount} valid payments</span>
            <span className="font-bold text-base">{formatCurrency(totalAmount)}</span>
          </div>
        </div>

        {missingProjects.length > 0 && (
          <div
            className="mx-6 mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/40"
            data-testid="banner-missing-projects"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-300">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span data-testid="text-missing-projects-count">
                  {missingProjects.length} active {missingProjects.length === 1 ? "project is" : "projects are"} not in this plan
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 border-amber-400 bg-white text-amber-800 hover:bg-amber-100 dark:bg-transparent dark:text-amber-300 dark:hover:bg-amber-900"
                onClick={addAllMissingProjects}
                data-testid="button-add-all-missing"
              >
                <ListPlus className="mr-1 h-3.5 w-3.5" />
                Add all
              </Button>
            </div>
            <div className="flex max-h-24 flex-wrap gap-2 overflow-y-auto">
              {missingProjects.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addMissingProject(p)}
                  className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-white px-2.5 py-1 text-xs text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-700 dark:bg-transparent dark:text-amber-300 dark:hover:bg-amber-900"
                  data-testid={`button-add-missing-${p.id}`}
                >
                  <Plus className="h-3 w-3" />
                  <span className="font-medium">{p.name}</span>
                  <span className="opacity-70">({p.region})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="px-6 py-4 space-y-3">
              {milestonesLoading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin mr-3" />
                  <span>Loading milestones and preparing plan...</span>
                </div>
              ) : rows.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No payments from previous month.</p>
                  <p className="text-sm">Click "Add Row" to start building your plan.</p>
                </div>
              ) : (
                rows.map((row, index) => (
                  <div
                    key={row.tempId}
                    className="border rounded-lg p-4 bg-card hover:shadow-sm transition-shadow"
                    data-testid={`row-bulk-${row.tempId}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-muted-foreground bg-muted rounded-full w-6 h-6 flex items-center justify-center">
                          {index + 1}
                        </span>
                        {row.isNew ? (
                          <Select value={row.projectId || ""} onValueChange={(v) => updateRow(row.tempId, "projectId", v)}>
                            <SelectTrigger className="w-[280px]" data-testid={`select-project-${row.tempId}`}>
                              <SelectValue placeholder="Select project" />
                            </SelectTrigger>
                            <SelectContent>
                              {projects && projects.length > 0 ? (
                                projects.map(p => (
                                  <SelectItem key={p.id} value={p.id}>{p.name} ({p.region})</SelectItem>
                                ))
                              ) : (
                                <div className="px-2 py-1 text-sm text-muted-foreground">No projects available</div>
                              )}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="font-semibold text-sm">{row.projectName}</span>
                        )}
                        {row.region && <RegionBadge region={row.region as "CA" | "TX" | "AE"} />}
                        {row.paymentType === "upsell" && (
                          <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-800 text-xs">
                            Upsell
                          </Badge>
                        )}
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => removeRow(row.tempId)}
                        data-testid={`button-remove-${row.tempId}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>

                    {row.milestoneHint && (
                      <div className="mb-3 flex items-center gap-2 text-xs px-2 py-1.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400">
                        <Sparkles className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>{row.milestoneHint}</span>
                      </div>
                    )}

                    {row.prevStatus && !row.isNew && (
                      <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Previous status:</span>
                        <Badge variant="secondary" className={`text-[10px] py-0 px-1.5 ${getStatusColor(row.prevStatus)}`}>
                          {statusOptions.find(s => s.value === row.prevStatus)?.label || row.prevStatus}
                        </Badge>
                        <ArrowRight className="h-3 w-3" />
                        <Badge variant="secondary" className={`text-[10px] py-0 px-1.5 ${getStatusColor(row.status)}`}>
                          {statusOptions.find(s => s.value === row.status)?.label || row.status}
                        </Badge>
                      </div>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">Amount</Label>
                        <Input
                          type="number"
                          value={row.expectedAmount}
                          onChange={(e) => updateRow(row.tempId, "expectedAmount", e.target.value)}
                          className="h-9"
                          data-testid={`input-amount-${row.tempId}`}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">Status</Label>
                        <Select 
                          value={row.status} 
                          onValueChange={(v) => updateRow(row.tempId, "status", v)}
                        >
                          <SelectTrigger className="h-9" data-testid={`select-status-${row.tempId}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {statusOptions.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">Type</Label>
                        <Select 
                          value={row.paymentType} 
                          onValueChange={(v) => updateRow(row.tempId, "paymentType", v)}
                        >
                          <SelectTrigger className="h-9" data-testid={`select-type-${row.tempId}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {paymentTypeOptions.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">Narration</Label>
                        <Input
                          value={row.narration}
                          onChange={(e) => updateRow(row.tempId, "narration", e.target.value)}
                          placeholder="Optional"
                          className="h-9"
                          data-testid={`input-narration-${row.tempId}`}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">Due Date</Label>
                        <Input
                          type="date"
                          value={row.dueDate}
                          onChange={(e) => updateRow(row.tempId, "dueDate", e.target.value)}
                          className="h-9"
                          data-testid={`input-duedate-${row.tempId}`}
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        <Separator />

        <div className="flex items-center justify-between px-6 py-4">
          <Button variant="outline" size="sm" onClick={addNewRow} data-testid="button-add-row">
            <Plus className="h-4 w-4 mr-2" />
            Add Row
          </Button>
          
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleGenerate} 
              disabled={bulkCreateMutation.isPending || validRowCount === 0}
              data-testid="button-generate-plan"
            >
              {bulkCreateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Generate {validRowCount} Payments
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>

      <AlertDialog open={confirmMissingOpen} onOpenChange={setConfirmMissingOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Some active projects aren't included</AlertDialogTitle>
            <AlertDialogDescription>
              {missingProjects.length} active {missingProjects.length === 1 ? "project has" : "projects have"} no payment in this plan
              {" "}for {targetMonthLabel} {selectedYear}. You can go back and add them, or generate the plan without them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-generate-missing">Go back &amp; add</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmMissingOpen(false);
                performGenerate();
              }}
              data-testid="button-confirm-generate-missing"
            >
              Generate anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
