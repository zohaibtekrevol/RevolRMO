import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, getErrorMessage } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { RegionBadge } from "@/components/region-badge";
import { DriveFileUploader } from "@/components/DriveFileUploader";
import { TagSelector } from "@/components/tag-selector";
import {
  Calendar,
  RefreshCw,
  Wallet,
  TrendingUp,
  CircleDollarSign,
  Building2,
  Receipt,
  MapPin,
  Sparkles,
  Link2,
  ArrowUpRight,
  AlertTriangle,
  Scale,
  FileText,
  Plus,
  Pencil,
  Trash2,
  CheckCircle,
  X,
  Upload,
  Paperclip,
} from "lucide-react";
import type {
  ProjectWithPM,
  SystemPermission,
  MilestoneWithPayment,
  ProjectWithMilestones,
  ChangeRequestWithInstallments,
  CrInstallmentWithPayment,
  UpsellTypeSetting,
  ChangeRequestStatus,
} from "@shared/schema";

const billingTypeLabels: Record<string, string> = {
  ftfc: "Fixed Time Fixed Cost",
  tbe: "Team Based Engagement",
  mrr: "Monthly Recurring Revenue",
};

const billingTypeColors: Record<string, string> = {
  ftfc: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800",
  tbe: "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800",
  mrr: "bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-800",
};

const projectStatusLabels: Record<string, string> = {
  active: "Active",
  on_hold: "On Hold",
  complete: "Complete",
};

const projectStatusColors: Record<string, string> = {
  active: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  on_hold: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  complete: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
};

const milestoneStatusColors: Record<string, string> = {
  planned: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  ready_for_invoice: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  invoiced: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  partially_paid: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  paid: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

function formatCurrency(value: string | number | null) {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (num === null || isNaN(num as number)) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num as number);
}

function formatDate(date: Date | string | null) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString();
}

interface ProjectDetailSheetProps {
  projectId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProjectDetailSheet({ projectId, open, onOpenChange }: ProjectDetailSheetProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: selectedProject } = useQuery<ProjectWithPM>({
    queryKey: [`/api/projects/${projectId}`],
    enabled: !!projectId && open,
  });

  const { data: projectWithMilestones, refetch: refetchMilestones } = useQuery<ProjectWithMilestones>({
    queryKey: [`/api/projects/${projectId}/with-milestones`],
    enabled: !!projectId && open,
  });

  const { data: changeRequests, refetch: refetchChangeRequests } = useQuery<ChangeRequestWithInstallments[]>({
    queryKey: [`/api/projects/${projectId}/change-requests`],
    enabled: !!projectId && open,
  });

  const { data: userPermissions } = useQuery<SystemPermission[]>({
    queryKey: ["/api/access/my-permissions"],
  });

  const { data: upsellTypeOptions } = useQuery<UpsellTypeSetting[]>({
    queryKey: ["/api/settings/upsell-types"],
    enabled: open,
  });

  const canEditProjects = userPermissions?.includes("edit_projects") ?? false;
  const activeUpsellCategories = (upsellTypeOptions || []).filter((t) => t.isActive);

  // Milestone editing state
  const [editingDueDateId, setEditingDueDateId] = useState<string | null>(null);
  const [editingDueDateValue, setEditingDueDateValue] = useState<string>("");

  // Add CR state
  const [isAddCrOpen, setIsAddCrOpen] = useState(false);
  const [crTitle, setCrTitle] = useState("");
  const [crDescription, setCrDescription] = useState("");
  const [crTotalAmount, setCrTotalAmount] = useState("");
  const [crDateLocked, setCrDateLocked] = useState("");
  const [crNumberOfInstallments, setCrNumberOfInstallments] = useState("1");
  const [crCategory, setCrCategory] = useState("");
  const [crStatus, setCrStatus] = useState<ChangeRequestStatus>("open");
  const [crWhatWasSold, setCrWhatWasSold] = useState("");
  const [crOutcome, setCrOutcome] = useState("");
  const [crPandadocLink, setCrPandadocLink] = useState("");
  const [crAttachmentDriveId, setCrAttachmentDriveId] = useState("");
  const [crAttachmentDriveLink, setCrAttachmentDriveLink] = useState("");
  const [crAttachmentName, setCrAttachmentName] = useState("");
  const [crTagIds, setCrTagIds] = useState<string[]>([]);

  // Edit CR state
  const [deleteCrId, setDeleteCrId] = useState<string | null>(null);
  const [editCrId, setEditCrId] = useState<string | null>(null);
  const [editCrTitle, setEditCrTitle] = useState("");
  const [editCrDescription, setEditCrDescription] = useState("");
  const [editCrTotalAmount, setEditCrTotalAmount] = useState("");
  const [editCrDateLocked, setEditCrDateLocked] = useState("");

  // Edit installment state
  const [editInstId, setEditInstId] = useState<string | null>(null);
  const [editInstName, setEditInstName] = useState("");
  const [editInstAmount, setEditInstAmount] = useState("");
  const [editInstDueDate, setEditInstDueDate] = useState("");

  const openLinkedPayment = (payment: NonNullable<MilestoneWithPayment["payment"]>) => {
    const params = new URLSearchParams();
    params.set("highlight", payment.id);
    if (payment.month) params.set("month", String(payment.month));
    if (payment.year) params.set("year", String(payment.year));
    if (payment.paymentType) params.set("paymentType", payment.paymentType);
    setLocation(`/payments?${params.toString()}`);
  };

  const generateMilestonesMutation = useMutation({
    mutationFn: async ({ projectId: pid, phases }: { projectId: string; phases?: Array<{ name: string; percentage: number; cost: number; dueDate?: string }> }) => {
      const response = await apiRequest("POST", `/api/projects/${pid}/milestones/generate`, { phases });
      return response.json();
    },
    onSuccess: (data) => {
      refetchMilestones();
      toast({ title: "Milestones Generated", description: `Successfully generated ${data.milestones?.length || 0} milestones.` });
    },
    onError: (error) => {
      toast({ title: "Error", description: getErrorMessage(error, "Failed to generate milestones."), variant: "destructive" });
    },
  });

  const updateMilestoneStatusMutation = useMutation({
    mutationFn: async ({ milestoneId, status }: { milestoneId: string; status: string }) => {
      const response = await apiRequest("PATCH", `/api/milestones/${milestoneId}/status`, { status });
      return response.json();
    },
    onSuccess: () => {
      refetchMilestones();
      toast({ title: "Status Updated", description: "Milestone status has been updated." });
    },
    onError: (error) => {
      toast({ title: "Error", description: getErrorMessage(error, "Failed to update milestone status."), variant: "destructive" });
    },
  });

  const updateMilestoneDueDateMutation = useMutation({
    mutationFn: async ({ milestoneId, dueDate }: { milestoneId: string; dueDate: string }) => {
      const response = await apiRequest("PATCH", `/api/milestones/${milestoneId}`, { dueDate });
      return response.json();
    },
    onSuccess: () => {
      refetchMilestones();
      setEditingDueDateId(null);
      toast({ title: "Due Date Updated", description: "Milestone due date has been updated." });
    },
    onError: (error) => {
      toast({ title: "Error", description: getErrorMessage(error, "Failed to update due date."), variant: "destructive" });
    },
  });

  const resetCrForm = () => {
    setIsAddCrOpen(false);
    setCrTitle("");
    setCrDescription("");
    setCrTotalAmount("");
    setCrDateLocked("");
    setCrNumberOfInstallments("1");
    setCrCategory("");
    setCrStatus("open");
    setCrWhatWasSold("");
    setCrOutcome("");
    setCrPandadocLink("");
    setCrAttachmentDriveId("");
    setCrAttachmentDriveLink("");
    setCrAttachmentName("");
    setCrTagIds([]);
  };

  const createChangeRequestMutation = useMutation({
    mutationFn: async ({ projectId: pid, data }: { projectId: string; data: Record<string, unknown> }) => {
      const response = await apiRequest("POST", `/api/projects/${pid}/change-requests`, data);
      return response.json();
    },
    onSuccess: () => {
      refetchChangeRequests();
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      resetCrForm();
      toast({ title: "Change Request Created", description: "The change request and its installments have been created." });
    },
    onError: (error) => {
      toast({ title: "Error", description: getErrorMessage(error, "Failed to create change request."), variant: "destructive" });
    },
  });

  const deleteChangeRequestMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/change-requests/${id}`);
      return response.json();
    },
    onSuccess: () => {
      refetchChangeRequests();
      setDeleteCrId(null);
      toast({ title: "Change Request Deleted", description: "The change request has been deleted." });
    },
    onError: (error) => {
      toast({ title: "Error", description: getErrorMessage(error, "Failed to delete change request."), variant: "destructive" });
    },
  });

  const updateCrInstallmentStatusMutation = useMutation({
    mutationFn: async ({ installmentId, status }: { installmentId: string; status: string }) => {
      const response = await apiRequest("PATCH", `/api/cr-installments/${installmentId}/status`, { status });
      return response.json();
    },
    onSuccess: () => {
      refetchChangeRequests();
      toast({ title: "Status Updated", description: "Installment status has been updated." });
    },
    onError: (error) => {
      toast({ title: "Error", description: getErrorMessage(error, "Failed to update installment status."), variant: "destructive" });
    },
  });

  const openEditCr = (cr: ChangeRequestWithInstallments) => {
    setEditCrId(cr.id);
    setEditCrTitle(cr.title);
    setEditCrDescription(cr.description || "");
    setEditCrTotalAmount(cr.totalAmount?.toString() || "");
    setEditCrDateLocked(cr.dateLocked ? new Date(cr.dateLocked).toISOString().split("T")[0] : "");
  };

  const resetEditCrForm = () => {
    setEditCrId(null);
    setEditCrTitle("");
    setEditCrDescription("");
    setEditCrTotalAmount("");
    setEditCrDateLocked("");
  };

  const updateChangeRequestMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const response = await apiRequest("PATCH", `/api/change-requests/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      refetchChangeRequests();
      resetEditCrForm();
      toast({ title: "Change Request Updated", description: "The change request has been updated." });
    },
    onError: (error) => {
      toast({ title: "Error", description: getErrorMessage(error, "Failed to update change request."), variant: "destructive" });
    },
  });

  const openEditInstallment = (inst: CrInstallmentWithPayment) => {
    setEditInstId(inst.id);
    setEditInstName(inst.name);
    setEditInstAmount(inst.expectedAmount?.toString() || "");
    setEditInstDueDate(inst.dueDate ? new Date(inst.dueDate).toISOString().split("T")[0] : "");
  };

  const resetEditInstForm = () => {
    setEditInstId(null);
    setEditInstName("");
    setEditInstAmount("");
    setEditInstDueDate("");
  };

  const updateCrInstallmentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const response = await apiRequest("PATCH", `/api/cr-installments/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      refetchChangeRequests();
      resetEditInstForm();
      toast({ title: "Installment Updated", description: "The installment has been updated." });
    },
    onError: (error) => {
      toast({ title: "Error", description: getErrorMessage(error, "Failed to update installment."), variant: "destructive" });
    },
  });

  const reconcileCrMutation = useMutation({
    mutationFn: async ({ mode, cr }: { mode: "match-total" | "redistribute"; cr: ChangeRequestWithInstallments }) => {
      if (mode === "match-total") {
        const planned = cr.installments.reduce((sum, inst) => sum + parseFloat(inst.expectedAmount?.toString() || "0"), 0);
        const response = await apiRequest("PATCH", `/api/change-requests/${cr.id}`, { totalAmount: planned.toFixed(2) });
        return response.json();
      }
      const total = parseFloat(cr.totalAmount?.toString() || "0");
      const count = cr.installments.length;
      if (count === 0) return null;
      const totalCents = Math.round(total * 100);
      const baseCents = Math.floor(totalCents / count);
      const remainder = totalCents - baseCents * count;
      await Promise.all(
        cr.installments.map((inst, idx) => {
          const cents = baseCents + (idx < remainder ? 1 : 0);
          return apiRequest("PATCH", `/api/cr-installments/${inst.id}`, { expectedAmount: (cents / 100).toFixed(2) });
        }),
      );
      return null;
    },
    onSuccess: (_data, variables) => {
      refetchChangeRequests();
      toast({
        title: variables.mode === "match-total" ? "Total Updated" : "Installments Redistributed",
        description: variables.mode === "match-total"
          ? "The change request total now matches its installments."
          : "The total has been split evenly across installments.",
      });
    },
    onError: (error) => {
      toast({ title: "Error", description: getErrorMessage(error, "Failed to reconcile change request."), variant: "destructive" });
    },
  });

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <div className="flex items-start justify-between gap-3 pr-6">
              <div className="min-w-0">
                <SheetTitle className="truncate">{selectedProject?.name}</SheetTitle>
                <SheetDescription className="flex items-center gap-2 mt-1">
                  <span className="truncate">{selectedProject?.clientName}</span>
                  <RegionBadge region={selectedProject?.region || "CA"} />
                </SheetDescription>
              </div>
              {selectedProject && (
                <Badge className={`${projectStatusColors[selectedProject.status || "active"]} shrink-0`}>
                  {projectStatusLabels[selectedProject.status || "active"]}
                </Badge>
              )}
            </div>
          </SheetHeader>

          {selectedProject && (() => {
            const detailTotalCost = parseFloat(selectedProject.totalCost?.toString() || "0");
            const detailReceived = parseFloat(selectedProject.totalReceived?.toString() || "0");
            const detailUpsellReceived = parseFloat(selectedProject.upsellReceived?.toString() || "0");
            const detailRemaining = detailTotalCost - detailReceived;
            const detailPct = detailTotalCost > 0 ? Math.min(100, Math.round((detailReceived / detailTotalCost) * 100)) : 0;
            return (
              <div className="mt-6 space-y-6">
                {/* Financial summary */}
                <div className="space-y-4" data-testid="detail-financial-summary">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100/40 p-3 space-y-1 dark:border-blue-900/50 dark:from-blue-950/40 dark:to-blue-900/10">
                      <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                        <Wallet className="h-3.5 w-3.5" />
                        <p className="text-[11px] font-semibold uppercase tracking-wide">Total Cost</p>
                      </div>
                      <p className="text-lg font-bold tabular-nums text-blue-700 dark:text-blue-300" data-testid="detail-total-cost">{formatCurrency(detailTotalCost)}</p>
                    </div>
                    <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100/40 p-3 space-y-1 dark:border-emerald-900/50 dark:from-emerald-950/40 dark:to-emerald-900/10">
                      <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                        <TrendingUp className="h-3.5 w-3.5" />
                        <p className="text-[11px] font-semibold uppercase tracking-wide">Received</p>
                      </div>
                      <p className="text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-300" data-testid="detail-total-received">{formatCurrency(detailReceived)}</p>
                    </div>
                    <div className={`rounded-xl border p-3 space-y-1 ${detailRemaining > 0 ? "border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100/40 dark:border-amber-900/50 dark:from-amber-950/40 dark:to-amber-900/10" : "border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100/40 dark:border-emerald-900/50 dark:from-emerald-950/40 dark:to-emerald-900/10"}`}>
                      <div className={`flex items-center gap-1.5 ${detailRemaining > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                        <CircleDollarSign className="h-3.5 w-3.5" />
                        <p className="text-[11px] font-semibold uppercase tracking-wide">Remaining</p>
                      </div>
                      <p className={`text-lg font-bold tabular-nums ${detailRemaining > 0 ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"}`} data-testid="detail-remaining">{formatCurrency(detailRemaining > 0 ? detailRemaining : 0)}</p>
                    </div>
                  </div>
                  <div className="rounded-xl border bg-card p-4 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground font-medium">Collection Progress</span>
                      <span className={`font-bold ${detailPct >= 100 ? "text-emerald-600 dark:text-emerald-400" : "text-primary"}`} data-testid="detail-collection-pct">{detailPct}%</span>
                    </div>
                    <Progress value={detailPct} className="h-2" />
                    <p className="text-[11px] text-muted-foreground pt-0.5">Base project collection only — upsells are tracked separately below.</p>
                  </div>
                  <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-violet-100/40 p-3 flex items-center justify-between dark:border-violet-900/50 dark:from-violet-950/40 dark:to-violet-900/10">
                    <div className="flex items-center gap-1.5 text-violet-600 dark:text-violet-400">
                      <Sparkles className="h-3.5 w-3.5" />
                      <p className="text-[11px] font-semibold uppercase tracking-wide">Upsells Received</p>
                    </div>
                    <p className="text-base font-bold tabular-nums text-violet-700 dark:text-violet-300" data-testid="detail-upsell-received">{formatCurrency(detailUpsellReceived)}</p>
                  </div>
                </div>

                {/* Project details */}
                <div className="rounded-xl border bg-card overflow-hidden">
                  <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2.5">
                    <Building2 className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">Project Details</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4 p-4 text-sm">
                    <div className="space-y-0.5">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Billing Type</p>
                      {selectedProject.billingType ? (
                        <Badge variant="outline" className={`font-medium ${billingTypeColors[selectedProject.billingType] || ""}`}>
                          {billingTypeLabels[selectedProject.billingType]}
                        </Badge>
                      ) : (
                        <p className="font-medium text-muted-foreground">Not Set</p>
                      )}
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Assigned PM</p>
                      <p className="font-medium">
                        {selectedProject.pm ? `${selectedProject.pm.firstName} ${selectedProject.pm.lastName}` : "-"}
                      </p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Contract Start</p>
                      <p className="font-medium flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-sky-500" />{formatDate(selectedProject.contractStartDate)}</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Contract End</p>
                      <p className="font-medium flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-rose-500" />{formatDate(selectedProject.contractEndDate)}</p>
                    </div>
                    {selectedProject.billingType === "tbe" && (
                      <>
                        <div className="space-y-0.5">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Hours/Month</p>
                          <p className="font-medium">{selectedProject.tbeHoursPerMonth || "-"}</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Hourly Rate</p>
                          <p className="font-medium">{selectedProject.tbeHourlyRate ? `$${selectedProject.tbeHourlyRate}` : "-"}</p>
                        </div>
                      </>
                    )}
                    {selectedProject.billingType === "mrr" && (
                      <>
                        <div className="space-y-0.5">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Monthly Amount</p>
                          <p className="font-medium">{selectedProject.mrrMonthlyAmount ? formatCurrency(selectedProject.mrrMonthlyAmount) : "-"}</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Duration</p>
                          <p className="font-medium">{selectedProject.mrrDurationMonths ? `${selectedProject.mrrDurationMonths} months` : "-"}</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* AE (UAE) Tax & Supply details */}
                {selectedProject.region === "AE" && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/40 overflow-hidden dark:border-amber-900/50 dark:bg-amber-950/20" data-testid="detail-ae-tax-supply">
                    <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-100/60 px-4 py-2.5 dark:border-amber-900/50 dark:bg-amber-900/30">
                      <Receipt className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300">Tax &amp; Supply (UAE)</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4 p-4 text-sm">
                      <div className="space-y-0.5">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Project Type</p>
                        <p className="font-medium" data-testid="detail-ae-project-type">{selectedProject.projectType || "-"}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Service Type</p>
                        <p className="font-medium" data-testid="detail-ae-service-type">{selectedProject.serviceType || "-"}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Place of Supply</p>
                        <p className="font-medium" data-testid="detail-ae-place-of-supply">
                          {selectedProject.placeOfSupply === "inside_uae" ? "Inside UAE" : selectedProject.placeOfSupply === "outside_uae" ? "Outside UAE" : "-"}
                        </p>
                      </div>
                      {selectedProject.placeOfSupply === "inside_uae" && (
                        <div className="space-y-0.5">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">City</p>
                          <p className="font-medium flex items-center gap-1.5" data-testid="detail-ae-supply-city"><MapPin className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />{selectedProject.supplyCity || "-"}</p>
                        </div>
                      )}
                      {selectedProject.placeOfSupply === "outside_uae" && (
                        <div className="space-y-0.5">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Country</p>
                          <p className="font-medium flex items-center gap-1.5" data-testid="detail-ae-supply-country"><MapPin className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />{selectedProject.supplyCountry || "-"}</p>
                        </div>
                      )}
                      <div className="space-y-0.5">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Client TRN</p>
                        <p className="font-medium tabular-nums" data-testid="detail-ae-client-trn">{selectedProject.clientTrn || "-"}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Client Business Name</p>
                        <p className="font-medium" data-testid="detail-ae-client-business-name">{selectedProject.clientBusinessName || "-"}</p>
                      </div>
                      <div className="space-y-0.5 col-span-2">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Client Address</p>
                        <p className="font-medium whitespace-pre-wrap" data-testid="detail-ae-client-address">{selectedProject.clientAddress || "-"}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">VAT</p>
                        <p className="font-medium tabular-nums" data-testid="detail-ae-vat">{selectedProject.vat != null && selectedProject.vat !== "" ? `${selectedProject.vat}%` : "-"}</p>
                      </div>
                    </div>
                  </div>
                )}

                <Separator />

                {/* Milestones */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-lg font-medium">Payment Milestones</h3>
                    {canEditProjects && selectedProject.billingType && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (selectedProject.billingType === "ftfc") {
                            const numPhases = selectedProject.numberOfPhases || 1;
                            const totalCost = parseFloat(selectedProject.totalCost?.toString() || "0");
                            const phases = Array.from({ length: numPhases }, (_, i) => ({
                              name: `Phase ${i + 1}`,
                              percentage: Math.round((100 / numPhases) * 100) / 100,
                              cost: Math.round((totalCost / numPhases) * 100) / 100,
                              dueDate: "",
                            }));
                            generateMilestonesMutation.mutate({ projectId: selectedProject.id, phases });
                          } else {
                            generateMilestonesMutation.mutate({ projectId: selectedProject.id });
                          }
                        }}
                        disabled={generateMilestonesMutation.isPending}
                        data-testid="button-generate-milestones"
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${generateMilestonesMutation.isPending ? "animate-spin" : ""}`} />
                        Generate Milestones
                      </Button>
                    )}
                  </div>

                  {!selectedProject.billingType ? (
                    <div className="text-center py-8 text-muted-foreground border rounded-md">
                      <Calendar className="h-10 w-10 mx-auto mb-2 opacity-50" />
                      <p>No billing type configured</p>
                      <p className="text-sm">Edit the project to set a billing type and generate milestones</p>
                    </div>
                  ) : projectWithMilestones?.milestones && projectWithMilestones.milestones.length > 0 ? (
                    <div className="space-y-2">
                      {projectWithMilestones.milestones.map((milestone: MilestoneWithPayment) => (
                        <div
                          key={milestone.id}
                          className="flex items-center justify-between gap-4 p-3 border rounded-md"
                          data-testid={`milestone-${milestone.id}`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium truncate">{milestone.name}</p>
                              <Badge variant="secondary" className={`text-xs ${milestoneStatusColors[milestone.status] || ""}`}>
                                {milestone.status.replace(/_/g, " ")}
                              </Badge>
                              {milestone.payment && (
                                <Badge
                                  variant="outline"
                                  className="text-xs border-emerald-500/40 text-emerald-600 dark:text-emerald-400 gap-1"
                                  data-testid={`badge-milestone-linked-${milestone.id}`}
                                >
                                  <Link2 className="h-3 w-3" />
                                  Linked
                                </Badge>
                              )}
                            </div>
                            {milestone.description && (
                              <p className="text-sm text-muted-foreground truncate">{milestone.description}</p>
                            )}
                            {(milestone.payments?.length ?? 0) > 0 && (
                              <div className="mt-2 space-y-1.5">
                                {milestone.payments.length > 1 && (
                                  <p className="text-[11px] font-medium text-muted-foreground" data-testid={`linked-payment-count-${milestone.id}`}>
                                    {milestone.payments.length} linked payments
                                  </p>
                                )}
                                {milestone.payments.map((payment) => (
                                  <div
                                    key={payment.id}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => openLinkedPayment(payment)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        openLinkedPayment(payment);
                                      }
                                    }}
                                    title="Open this payment record"
                                    className="group w-full cursor-pointer rounded-md border border-emerald-500/20 bg-emerald-500/5 p-2 text-left text-xs transition-colors hover:bg-emerald-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                                    data-testid={`button-open-payment-${milestone.id}-${payment.id}`}
                                  >
                                    <div className="flex items-center justify-between gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
                                      <span className="flex items-center gap-1.5">
                                        <Link2 className="h-3 w-3" />
                                        Linked payment record
                                      </span>
                                      <span className="flex items-center gap-0.5 text-[11px] opacity-70 transition-opacity group-hover:opacity-100">
                                        Open
                                        <ArrowUpRight className="h-3 w-3" />
                                      </span>
                                    </div>
                                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
                                      <span className="capitalize" data-testid={`linked-payment-type-${milestone.id}-${payment.id}`}>
                                        {payment.paymentType?.replace(/_/g, " ")}
                                      </span>
                                      <span>·</span>
                                      <span className="capitalize" data-testid={`linked-payment-status-${milestone.id}-${payment.id}`}>
                                        {payment.status?.replace(/_/g, " ")}
                                      </span>
                                      {payment.narration && (
                                        <>
                                          <span>·</span>
                                          <span className="truncate max-w-[200px]" title={payment.narration}>
                                            {payment.narration}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
                                      <span data-testid={`linked-payment-expected-${milestone.id}-${payment.id}`}>
                                        Expected: <span className="text-foreground">{formatCurrency(payment.expectedAmount)}</span>
                                      </span>
                                      <span data-testid={`linked-payment-received-${milestone.id}-${payment.id}`}>
                                        Received: <span className="text-foreground">{formatCurrency(payment.receivedAmount)}</span>
                                      </span>
                                      {payment.receivedDate && (
                                        <span>
                                          on <span className="text-foreground">{formatDate(payment.receivedDate)}</span>
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
                              {editingDueDateId === milestone.id ? (
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  <Input
                                    type="date"
                                    value={editingDueDateValue}
                                    onChange={(e) => setEditingDueDateValue(e.target.value)}
                                    className="h-6 text-xs w-36 px-1"
                                    data-testid={`input-milestone-due-date-${milestone.id}`}
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" && editingDueDateValue) {
                                        updateMilestoneDueDateMutation.mutate({ milestoneId: milestone.id, dueDate: editingDueDateValue });
                                      } else if (e.key === "Escape") {
                                        setEditingDueDateId(null);
                                      }
                                    }}
                                  />
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-5 w-5"
                                    onClick={() => {
                                      if (editingDueDateValue) {
                                        updateMilestoneDueDateMutation.mutate({ milestoneId: milestone.id, dueDate: editingDueDateValue });
                                      }
                                    }}
                                    disabled={!editingDueDateValue || updateMilestoneDueDateMutation.isPending}
                                    data-testid={`button-save-due-date-${milestone.id}`}
                                  >
                                    <CheckCircle className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-5 w-5"
                                    onClick={() => setEditingDueDateId(null)}
                                    data-testid={`button-cancel-due-date-${milestone.id}`}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </span>
                              ) : (
                                <span
                                  className={`flex items-center gap-1 ${canEditProjects && milestone.status !== "paid" && milestone.status !== "cancelled" ? "cursor-pointer hover:text-foreground transition-colors" : ""}`}
                                  onClick={() => {
                                    if (canEditProjects && milestone.status !== "paid" && milestone.status !== "cancelled") {
                                      setEditingDueDateId(milestone.id);
                                      setEditingDueDateValue(
                                        milestone.dueDate ? new Date(milestone.dueDate).toISOString().split("T")[0] : ""
                                      );
                                    }
                                  }}
                                  data-testid={`text-milestone-due-date-${milestone.id}`}
                                >
                                  <Calendar className="h-3 w-3" />
                                  Expected Due: {milestone.dueDate ? formatDate(milestone.dueDate) : "Not set"}
                                  {canEditProjects && milestone.status !== "paid" && milestone.status !== "cancelled" && (
                                    <Pencil className="h-3 w-3 ml-1 opacity-50" />
                                  )}
                                </span>
                              )}
                              {milestone.hoursCommitted && (
                                <span>{milestone.hoursCommitted} hrs</span>
                              )}
                            </div>
                          </div>
                          <div className="text-right flex flex-col items-end gap-1">
                            <p className="font-medium">{formatCurrency(milestone.expectedAmount)}</p>
                            {canEditProjects && milestone.status !== "paid" && milestone.status !== "cancelled" ? (
                              <Select
                                value={milestone.status}
                                onValueChange={(newStatus) => {
                                  updateMilestoneStatusMutation.mutate({ milestoneId: milestone.id, status: newStatus });
                                }}
                              >
                                <SelectTrigger className="h-7 text-xs w-36" data-testid={`select-milestone-status-${milestone.id}`}>
                                  <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="planned">Planned</SelectItem>
                                  <SelectItem value="ready_for_invoice">Ready for Invoice</SelectItem>
                                  <SelectItem value="invoiced">Invoiced</SelectItem>
                                  <SelectItem value="partially_paid">Partially Paid</SelectItem>
                                  <SelectItem value="paid">Paid</SelectItem>
                                  <SelectItem value="cancelled">Cancelled</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className="text-xs text-muted-foreground capitalize">
                                {milestone.status.replace(/_/g, " ")}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}

                      <div className="flex justify-between items-center p-3 bg-muted/50 rounded-md mt-4">
                        <span className="font-medium">Total Expected</span>
                        <span className="font-bold">
                          {formatCurrency(
                            projectWithMilestones.milestones
                              .filter((m: MilestoneWithPayment) => m.status !== "cancelled")
                              .reduce((sum: number, m: MilestoneWithPayment) => sum + parseFloat(m.expectedAmount || "0"), 0)
                          )}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground border rounded-md">
                      <Calendar className="h-10 w-10 mx-auto mb-2 opacity-50" />
                      <p>No milestones yet</p>
                      <p className="text-sm">Click "Generate Milestones" to create payment milestones based on the billing configuration</p>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Change Requests */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-lg font-medium">Change Requests</h3>
                    {canEditProjects && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsAddCrOpen(true)}
                        data-testid="button-add-change-request"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Change Request
                      </Button>
                    )}
                  </div>

                  {changeRequests && changeRequests.length > 0 ? (
                    <div className="space-y-4">
                      {changeRequests.map((cr) => (
                        <div key={cr.id} className="border rounded-md p-3 space-y-3" data-testid={`change-request-${cr.id}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate" data-testid={`text-cr-title-${cr.id}`}>{cr.title}</p>
                              {cr.description && (
                                <p className="text-sm text-muted-foreground">{cr.description}</p>
                              )}
                              <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
                                <span>{cr.numberOfInstallments} installment{cr.numberOfInstallments === 1 ? "" : "s"}</span>
                                {cr.dateLocked && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    Locked: {formatDate(cr.dateLocked)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium" data-testid={`text-cr-total-${cr.id}`}>{formatCurrency(cr.totalAmount)}</span>
                              {canEditProjects && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => openEditCr(cr)}
                                  data-testid={`button-edit-cr-${cr.id}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              )}
                              {canEditProjects && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive"
                                  onClick={() => setDeleteCrId(cr.id)}
                                  data-testid={`button-delete-cr-${cr.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>

                          {(() => {
                            const received = cr.installments.reduce((sum: number, inst: CrInstallmentWithPayment) => sum + parseFloat(inst.receivedAmount?.toString() || "0"), 0);
                            const planned = cr.installments.reduce((sum: number, inst: CrInstallmentWithPayment) => sum + parseFloat(inst.expectedAmount?.toString() || "0"), 0);
                            const total = parseFloat(cr.totalAmount?.toString() || "0");
                            const difference = planned - total;
                            const inSync = Math.abs(difference) < 0.01;
                            const isReconciling = reconcileCrMutation.isPending && reconcileCrMutation.variables?.cr.id === cr.id;
                            return (
                              <div className="space-y-2">
                                <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap" data-testid={`cr-summary-${cr.id}`}>
                                  <span>Planned: <span className="text-foreground font-medium">{formatCurrency(planned.toString())}</span></span>
                                  <span>Received: <span className="text-emerald-600 dark:text-emerald-400 font-medium">{formatCurrency(received.toString())}</span></span>
                                  <span>Outstanding: <span className="text-foreground font-medium">{formatCurrency(Math.max(planned - received, 0).toString())}</span></span>
                                  {inSync ? (
                                    <Badge variant="outline" className="text-xs border-emerald-500/40 text-emerald-600 dark:text-emerald-400 gap-1" data-testid={`badge-cr-sync-ok-${cr.id}`}>
                                      <CheckCircle className="h-3 w-3" />
                                      In sync
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-xs border-amber-500/40 text-amber-600 dark:text-amber-400 gap-1" data-testid={`badge-cr-sync-warning-${cr.id}`}>
                                      <AlertTriangle className="h-3 w-3" />
                                      {difference > 0 ? "Over" : "Under"} total by {formatCurrency(Math.abs(difference).toString())}
                                    </Badge>
                                  )}
                                </div>
                                {!inSync && canEditProjects && (
                                  <div className="flex items-center gap-2 flex-wrap" data-testid={`cr-reconcile-${cr.id}`}>
                                    <span className="text-xs text-muted-foreground">Installments don't add up to the {formatCurrency(cr.totalAmount)} total.</span>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 text-xs gap-1"
                                      disabled={isReconciling}
                                      onClick={() => reconcileCrMutation.mutate({ mode: "redistribute", cr })}
                                      data-testid={`button-cr-redistribute-${cr.id}`}
                                    >
                                      <Scale className="h-3 w-3" />
                                      Split total evenly
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 text-xs gap-1"
                                      disabled={isReconciling}
                                      onClick={() => reconcileCrMutation.mutate({ mode: "match-total", cr })}
                                      data-testid={`button-cr-match-total-${cr.id}`}
                                    >
                                      <RefreshCw className="h-3 w-3" />
                                      Set total to {formatCurrency(planned.toString())}
                                    </Button>
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          <div className="space-y-2">
                            {cr.installments.map((inst: CrInstallmentWithPayment) => (
                              <div
                                key={inst.id}
                                className="flex items-center justify-between gap-4 p-2 border rounded-md bg-muted/30"
                                data-testid={`cr-installment-${inst.id}`}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-sm font-medium truncate">{inst.name}</p>
                                    <Badge variant="secondary" className={`text-xs ${milestoneStatusColors[inst.status] || ""}`}>
                                      {inst.status.replace(/_/g, " ")}
                                    </Badge>
                                    {inst.payment && (
                                      <Badge
                                        variant="outline"
                                        className="text-xs border-emerald-500/40 text-emerald-600 dark:text-emerald-400 gap-1"
                                        data-testid={`badge-cr-installment-linked-${inst.id}`}
                                      >
                                        <Link2 className="h-3 w-3" />
                                        Linked
                                      </Badge>
                                    )}
                                  </div>
                                  {inst.dueDate && (
                                    <span className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                      <Calendar className="h-3 w-3" />
                                      Due: {formatDate(inst.dueDate)}
                                    </span>
                                  )}
                                </div>
                                <div className="text-right flex flex-col items-end gap-1">
                                  <div className="flex items-center gap-1">
                                    <span className="text-sm font-medium">{formatCurrency(inst.expectedAmount)}</span>
                                    {canEditProjects && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() => openEditInstallment(inst)}
                                        data-testid={`button-edit-cr-installment-${inst.id}`}
                                      >
                                        <Pencil className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </div>
                                  {canEditProjects && inst.status !== "paid" && inst.status !== "cancelled" ? (
                                    <Select
                                      value={inst.status}
                                      onValueChange={(newStatus) => {
                                        updateCrInstallmentStatusMutation.mutate({ installmentId: inst.id, status: newStatus });
                                      }}
                                    >
                                      <SelectTrigger className="h-7 text-xs w-36" data-testid={`select-cr-installment-status-${inst.id}`}>
                                        <SelectValue placeholder="Select status" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="planned">Planned</SelectItem>
                                        <SelectItem value="ready_for_invoice">Ready for Invoice</SelectItem>
                                        <SelectItem value="invoiced">Invoiced</SelectItem>
                                        <SelectItem value="partially_paid">Partially Paid</SelectItem>
                                        <SelectItem value="paid">Paid</SelectItem>
                                        <SelectItem value="cancelled">Cancelled</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <span className="text-xs text-muted-foreground capitalize">
                                      {inst.status.replace(/_/g, " ")}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground border rounded-md">
                      <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
                      <p>No change requests yet</p>
                      <p className="text-sm">Add a change request to track additional locked-in work with installments</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* Add Change Request Dialog */}
      <Dialog open={isAddCrOpen} onOpenChange={(o) => { if (!o) resetCrForm(); else setIsAddCrOpen(true); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Change Request</DialogTitle>
            <DialogDescription>Create a change request and automatically split it into installments.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input placeholder="Change request title" value={crTitle} onChange={(e) => setCrTitle(e.target.value)} data-testid="input-cr-title" />
            </div>
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select value={crCategory} onValueChange={setCrCategory}>
                <SelectTrigger data-testid="select-cr-category">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {activeUpsellCategories.map((c) => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={crStatus} onValueChange={(v) => setCrStatus(v as ChangeRequestStatus)}>
                <SelectTrigger data-testid="select-cr-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="won">Won</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>What was sold *</Label>
              <Textarea placeholder="Describe what was sold" value={crWhatWasSold} onChange={(e) => setCrWhatWasSold(e.target.value)} data-testid="input-cr-what-was-sold" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea placeholder="Optional description" value={crDescription} onChange={(e) => setCrDescription(e.target.value)} data-testid="input-cr-description" />
            </div>
            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2">
                <Label>Total Amount *</Label>
                <Input type="number" placeholder="0.00" value={crTotalAmount} onChange={(e) => setCrTotalAmount(e.target.value)} data-testid="input-cr-total-amount" />
              </div>
              <div className="space-y-2">
                <Label># Installments *</Label>
                <Input type="number" min="1" value={crNumberOfInstallments} onChange={(e) => setCrNumberOfInstallments(e.target.value)} data-testid="input-cr-installments" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Date Locked</Label>
              <Input type="date" value={crDateLocked} onChange={(e) => setCrDateLocked(e.target.value)} data-testid="input-cr-date-locked" />
            </div>
            <div className="space-y-2">
              <Label>Outcome</Label>
              <Textarea placeholder="Optional outcome / result" value={crOutcome} onChange={(e) => setCrOutcome(e.target.value)} data-testid="input-cr-outcome" />
            </div>
            <div className="space-y-2">
              <Label>PandaDoc Link</Label>
              <Input placeholder="https://app.pandadoc.com/..." value={crPandadocLink} onChange={(e) => setCrPandadocLink(e.target.value)} data-testid="input-cr-pandadoc" />
            </div>
            <div className="space-y-2">
              <Label>Attachment *</Label>
              <div className="flex items-center gap-2 flex-wrap">
                <DriveFileUploader
                  projectId={projectId ?? ""}
                  buttonClassName="h-9"
                  onUploaded={(result) => {
                    setCrAttachmentDriveId(result.driveId);
                    setCrAttachmentDriveLink(result.link || "");
                    setCrAttachmentName(result.name);
                  }}
                >
                  <span className="flex items-center gap-2"><Upload className="h-4 w-4" /> Upload File</span>
                </DriveFileUploader>
                {crAttachmentDriveId && (
                  <span className="flex items-center gap-1 text-sm text-muted-foreground truncate max-w-[12rem]" data-testid="text-cr-attachment-name">
                    <Paperclip className="h-3.5 w-3.5" /> {crAttachmentName || "Attached"}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">A file attachment is required for new change requests.</p>
            </div>
            <div className="space-y-2">
              <Label>Tags</Label>
              <TagSelector selectedTagIds={crTagIds} onChange={setCrTagIds} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetCrForm}>Cancel</Button>
            <Button
              onClick={() => {
                if (!projectId) return;
                if (!crTitle || !crTotalAmount) {
                  toast({ title: "Error", description: "Please enter a title and total amount.", variant: "destructive" });
                  return;
                }
                if (!crCategory) {
                  toast({ title: "Error", description: "Please select a category.", variant: "destructive" });
                  return;
                }
                if (!crWhatWasSold.trim()) {
                  toast({ title: "Error", description: "Please enter what was sold.", variant: "destructive" });
                  return;
                }
                if (!crAttachmentDriveId) {
                  toast({ title: "Error", description: "Please attach a file.", variant: "destructive" });
                  return;
                }
                createChangeRequestMutation.mutate({
                  projectId,
                  data: {
                    title: crTitle,
                    description: crDescription || null,
                    totalAmount: crTotalAmount,
                    numberOfInstallments: parseInt(crNumberOfInstallments, 10),
                    dateLocked: crDateLocked || null,
                    category: crCategory,
                    status: crStatus,
                    whatWasSold: crWhatWasSold,
                    outcome: crOutcome || null,
                    pandadocLink: crPandadocLink || null,
                    attachmentDriveId: crAttachmentDriveId || null,
                    attachmentDriveLink: crAttachmentDriveLink || null,
                    attachmentName: crAttachmentName || null,
                    tagIds: crTagIds,
                  },
                });
              }}
              disabled={createChangeRequestMutation.isPending}
              data-testid="button-submit-change-request"
            >
              {createChangeRequestMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Change Request Dialog */}
      <Dialog open={!!editCrId} onOpenChange={(o) => { if (!o) resetEditCrForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Change Request</DialogTitle>
            <DialogDescription>Update the change request details. Installment amounts are edited separately.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                placeholder="Change request title"
                value={editCrTitle}
                onChange={(e) => setEditCrTitle(e.target.value)}
                data-testid="input-edit-cr-title"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Optional description"
                value={editCrDescription}
                onChange={(e) => setEditCrDescription(e.target.value)}
                data-testid="input-edit-cr-description"
              />
            </div>
            <div className="space-y-2">
              <Label>Total Amount *</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={editCrTotalAmount}
                onChange={(e) => setEditCrTotalAmount(e.target.value)}
                data-testid="input-edit-cr-total-amount"
              />
              {(() => {
                const cr = changeRequests?.find((c) => c.id === editCrId);
                if (!cr) return null;
                const planned = cr.installments.reduce((sum, inst) => sum + parseFloat(inst.expectedAmount?.toString() || "0"), 0);
                const total = parseFloat(editCrTotalAmount || "0");
                const inSync = Math.abs(planned - total) < 0.01;
                return (
                  <p className={`text-xs ${inSync ? "text-muted-foreground" : "text-amber-600 dark:text-amber-400"}`} data-testid="text-edit-cr-sync-hint">
                    {inSync
                      ? `Matches installments total (${formatCurrency(planned.toString())}).`
                      : `Installments add up to ${formatCurrency(planned.toString())}. Saving will leave them out of sync.`}
                  </p>
                );
              })()}
            </div>
            <div className="space-y-2">
              <Label>Date Locked</Label>
              <Input
                type="date"
                value={editCrDateLocked}
                onChange={(e) => setEditCrDateLocked(e.target.value)}
                data-testid="input-edit-cr-date-locked"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetEditCrForm}>Cancel</Button>
            <Button
              onClick={() => {
                if (!editCrId) return;
                if (!editCrTitle || !editCrTotalAmount) {
                  toast({ title: "Error", description: "Please enter a title and total amount.", variant: "destructive" });
                  return;
                }
                updateChangeRequestMutation.mutate({
                  id: editCrId,
                  data: {
                    title: editCrTitle,
                    description: editCrDescription || null,
                    totalAmount: editCrTotalAmount,
                    dateLocked: editCrDateLocked || null,
                  },
                });
              }}
              disabled={updateChangeRequestMutation.isPending}
              data-testid="button-submit-edit-change-request"
            >
              {updateChangeRequestMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Installment Dialog */}
      <Dialog open={!!editInstId} onOpenChange={(o) => { if (!o) resetEditInstForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Installment</DialogTitle>
            <DialogDescription>{editInstName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Amount *</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={editInstAmount}
                onChange={(e) => setEditInstAmount(e.target.value)}
                data-testid="input-edit-cr-installment-amount"
              />
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={editInstDueDate}
                onChange={(e) => setEditInstDueDate(e.target.value)}
                data-testid="input-edit-cr-installment-due-date"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetEditInstForm}>Cancel</Button>
            <Button
              onClick={() => {
                if (!editInstId) return;
                if (!editInstAmount) {
                  toast({ title: "Error", description: "Please enter an amount.", variant: "destructive" });
                  return;
                }
                updateCrInstallmentMutation.mutate({
                  id: editInstId,
                  data: {
                    expectedAmount: editInstAmount,
                    dueDate: editInstDueDate || null,
                  },
                });
              }}
              disabled={updateCrInstallmentMutation.isPending}
              data-testid="button-submit-edit-cr-installment"
            >
              {updateCrInstallmentMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete CR AlertDialog */}
      <AlertDialog open={!!deleteCrId} onOpenChange={(o) => { if (!o) setDeleteCrId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete change request?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the change request and all its installments. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (deleteCrId) deleteChangeRequestMutation.mutate(deleteCrId); }}
              data-testid="button-confirm-delete-cr"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
