import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { RegionBadge } from "@/components/region-badge";
import { MilestoneSyncDialog } from "@/components/milestone-sync-dialog";
import {
  Calendar,
  FileText,
  RefreshCw,
  Plus,
  Pencil,
  Trash2,
  Wallet,
  CheckCircle,
  X,
  TrendingUp,
  CircleDollarSign,
  Sparkles,
  Building2,
  Receipt,
  MapPin,
  Link2,
  ArrowUpRight,
  Paperclip,
  Upload,
} from "lucide-react";
import { DriveFileUploader } from "@/components/DriveFileUploader";
import { TagSelector, TagBadge } from "@/components/tag-selector";
import type {
  ProjectWithPM,
  ProjectWithMilestones,
  MilestoneWithPayment,
  ChangeRequestWithInstallments,
  ChangeRequestStatus,
  CrInstallmentWithPayment,
  PaymentWithProject,
  UpsellTypeSetting,
} from "@shared/schema";

const milestoneStatusColors: Record<string, string> = {
  planned: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  ready_for_invoice: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  invoiced: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  partially_paid: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  paid: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

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

const milestoneStatusItems = [
  { value: "planned", label: "Planned" },
  { value: "ready_for_invoice", label: "Ready for Invoice" },
  { value: "invoiced", label: "Invoiced" },
  { value: "partially_paid", label: "Partially Paid" },
  { value: "paid", label: "Paid" },
  { value: "cancelled", label: "Cancelled" },
];

const paymentStatusItems = [
  { value: "pending_invoice", label: "Pending" },
  { value: "invoiced", label: "Invoiced" },
  { value: "received", label: "Received" },
  { value: "not_targeting", label: "Not Targeting" },
];

function formatCurrency(value: number | string | null | undefined) {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (num === null || num === undefined || isNaN(num as number)) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(num as number);
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "Not set";
  try {
    return format(new Date(value), "MMM d, yyyy");
  } catch {
    return "Not set";
  }
}

interface ProjectWorkspacePanelProps {
  projectId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  month: number;
  year: number;
  payments: PaymentWithProject[];
  canEditProject: boolean;
  canCreatePayment: boolean;
  canEditPayment: boolean;
  autoOpenAddPayment?: boolean;
  onAutoAddPaymentHandled?: () => void;
}

export function ProjectWorkspacePanel({
  projectId,
  open,
  onOpenChange,
  month,
  year,
  payments,
  canEditProject,
  canCreatePayment,
  canEditPayment,
  autoOpenAddPayment,
  onAutoAddPaymentHandled,
}: ProjectWorkspacePanelProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const openLinkedPayment = (payment: NonNullable<MilestoneWithPayment["payment"]>) => {
    const params = new URLSearchParams();
    params.set("highlight", payment.id);
    if (payment.month) params.set("month", String(payment.month));
    if (payment.year) params.set("year", String(payment.year));
    if (payment.paymentType) params.set("paymentType", payment.paymentType);
    setLocation(`/payments?${params.toString()}`);
  };

  const { data: projects } = useQuery<ProjectWithPM[]>({
    queryKey: ["/api/projects"],
  });
  const project = projects?.find((p) => p.id === projectId) || null;

  const { data: projectWithMilestones, isLoading: milestonesLoading } =
    useQuery<ProjectWithMilestones>({
      queryKey: [`/api/projects/${projectId}/with-milestones`],
      enabled: !!projectId && open,
    });

  const { data: changeRequests } = useQuery<ChangeRequestWithInstallments[]>({
    queryKey: [`/api/projects/${projectId}/change-requests`],
    enabled: !!projectId && open,
  });

  const { data: upsellTypeOptions } = useQuery<UpsellTypeSetting[]>({
    queryKey: ["/api/settings/upsell-types"],
    enabled: open,
  });
  const activeUpsellCategories = (upsellTypeOptions || []).filter((t) => t.isActive);

  const projectPayments = payments.filter((p) => p.projectId === projectId);

  const refetchProjectData = () => {
    queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/with-milestones`] });
    queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/change-requests`] });
    queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
  };

  const invalidatePayments = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    queryClient.invalidateQueries({ queryKey: ["/api/pm-targets"] });
    queryClient.invalidateQueries({ queryKey: ["/api/cost-margin/summary"], exact: false });
    queryClient.invalidateQueries({ queryKey: ["/api/cost-margin/hourly-buckets"], exact: false });
  };

  const handleError = (error: unknown, fallback: string) => {
    const message = error instanceof Error ? error.message : fallback;
    toast({ title: "Error", description: message, variant: "destructive" });
  };

  const generateMilestonesMutation = useMutation({
    mutationFn: async () => {
      if (!project) throw new Error("No project");
      let phases: Array<{ name: string; percentage: number; cost: number; dueDate?: string }> | undefined;
      if (project.billingType === "ftfc") {
        const numPhases = project.numberOfPhases || 1;
        const totalCost = parseFloat(project.totalCost?.toString() || "0");
        phases = Array.from({ length: numPhases }, (_, i) => ({
          name: `Phase ${i + 1}`,
          percentage: Math.round((100 / numPhases) * 100) / 100,
          cost: Math.round((totalCost / numPhases) * 100) / 100,
          dueDate: "",
        }));
      }
      const response = await apiRequest("POST", `/api/projects/${project.id}/milestones/generate`, { phases });
      return response.json();
    },
    onSuccess: (data) => {
      refetchProjectData();
      toast({ title: "Milestones Generated", description: `Created ${data.milestones?.length || 0} milestones.` });
    },
    onError: (error) => handleError(error, "Failed to generate milestones."),
  });

  const updateMilestoneStatusMutation = useMutation({
    mutationFn: async ({ milestoneId, status }: { milestoneId: string; status: string }) => {
      const response = await apiRequest("PATCH", `/api/milestones/${milestoneId}/status`, { status });
      return response.json();
    },
    onSuccess: () => {
      refetchProjectData();
      toast({ title: "Status Updated", description: "Milestone status has been updated." });
    },
    onError: (error) => handleError(error, "Failed to update milestone status."),
  });

  const updateMilestoneDueDateMutation = useMutation({
    mutationFn: async ({ milestoneId, dueDate }: { milestoneId: string; dueDate: string }) => {
      const response = await apiRequest("PATCH", `/api/milestones/${milestoneId}`, { dueDate });
      return response.json();
    },
    onSuccess: () => {
      refetchProjectData();
      setEditingDueDateId(null);
      toast({ title: "Due Date Updated", description: "Milestone due date has been updated." });
    },
    onError: (error) => handleError(error, "Failed to update due date."),
  });

  const createChangeRequestMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const response = await apiRequest("POST", `/api/projects/${projectId}/change-requests`, data);
      return response.json();
    },
    onSuccess: () => {
      refetchProjectData();
      resetCrForm();
      toast({ title: "Change Request Created", description: "The change request and its installments have been created." });
    },
    onError: (error) => handleError(error, "Failed to create change request."),
  });

  const updateChangeRequestMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const response = await apiRequest("PATCH", `/api/change-requests/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      refetchProjectData();
      resetEditCrForm();
      toast({ title: "Change Request Updated", description: "The change request has been updated." });
    },
    onError: (error) => handleError(error, "Failed to update change request."),
  });

  const deleteChangeRequestMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/change-requests/${id}`);
      return response.json();
    },
    onSuccess: () => {
      refetchProjectData();
      setDeleteCrId(null);
      toast({ title: "Change Request Deleted", description: "The change request has been deleted." });
    },
    onError: (error) => handleError(error, "Failed to delete change request."),
  });

  const updateCrInstallmentStatusMutation = useMutation({
    mutationFn: async ({ installmentId, status }: { installmentId: string; status: string }) => {
      const response = await apiRequest("PATCH", `/api/cr-installments/${installmentId}/status`, { status });
      return response.json();
    },
    onSuccess: () => {
      refetchProjectData();
      toast({ title: "Status Updated", description: "Installment status has been updated." });
    },
    onError: (error) => handleError(error, "Failed to update installment status."),
  });

  const updateCrInstallmentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const response = await apiRequest("PATCH", `/api/cr-installments/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      refetchProjectData();
      resetEditInstForm();
      toast({ title: "Installment Updated", description: "The installment has been updated." });
    },
    onError: (error) => handleError(error, "Failed to update installment."),
  });

  const createPaymentMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      return apiRequest("POST", "/api/payments", {
        ...data,
        month,
        year,
        isTarget: data.paymentType === "upsell" ? false : true,
      });
    },
    onSuccess: () => {
      invalidatePayments();
      refetchProjectData();
      resetPaymentForm();
      toast({ title: "Payment Added", description: "The payment has been added successfully." });
    },
    onError: (error) => handleError(error, "Failed to add payment."),
  });

  const updatePaymentStatusMutation = useMutation({
    mutationFn: async ({ id, status, receivedAmount }: { id: string; status: string; receivedAmount?: string }) => {
      const body: Record<string, unknown> = { status };
      if (status === "received") {
        body.receivedAmount = receivedAmount;
        body.receivedDate = new Date().toISOString();
      }
      const response = await apiRequest("PATCH", `/api/payments/${id}`, body);
      return response.json();
    },
    onSuccess: (data: any, variables: { id: string; status: string; receivedAmount?: string }) => {
      invalidatePayments();
      refetchProjectData();
      queryClient.invalidateQueries({ queryKey: ["/api/milestones"] });
      setReceivedPayment(null);
      setReceivedAmount("");
      toast({ title: "Status Updated", description: "Payment status has been updated." });
      if (data?.milestoneSyncSuggestion) {
        setMilestoneSyncData(data.milestoneSyncSuggestion);
        setMilestoneSyncPaymentId(variables.id);
      }
    },
    onError: (error) => handleError(error, "Failed to update payment."),
  });

  const [editingDueDateId, setEditingDueDateId] = useState<string | null>(null);
  const [editingDueDateValue, setEditingDueDateValue] = useState("");

  const [editInstId, setEditInstId] = useState<string | null>(null);
  const [editInstName, setEditInstName] = useState("");
  const [editInstAmount, setEditInstAmount] = useState("");
  const [editInstDueDate, setEditInstDueDate] = useState("");

  const [milestoneSyncData, setMilestoneSyncData] = useState<{ autoLinked: boolean; milestone?: any; availableMilestones?: any[] } | null>(null);
  const [milestoneSyncPaymentId, setMilestoneSyncPaymentId] = useState("");

  const [isAddCrOpen, setIsAddCrOpen] = useState(false);
  const [crTitle, setCrTitle] = useState("");
  const [crDescription, setCrDescription] = useState("");
  const [crTotalAmount, setCrTotalAmount] = useState("");
  const [crDateLocked, setCrDateLocked] = useState("");
  const [crNumberOfInstallments, setCrNumberOfInstallments] = useState("1");
  const [crStatus, setCrStatus] = useState<ChangeRequestStatus>("open");
  const [crCategory, setCrCategory] = useState("");
  const [crWhatWasSold, setCrWhatWasSold] = useState("");
  const [crOutcome, setCrOutcome] = useState("");
  const [crPandadocLink, setCrPandadocLink] = useState("");
  const [crAttachmentPath, setCrAttachmentPath] = useState("");
  const [crAttachmentName, setCrAttachmentName] = useState("");
  const [crAttachmentDriveId, setCrAttachmentDriveId] = useState("");
  const [crAttachmentDriveLink, setCrAttachmentDriveLink] = useState("");
  const [crTagIds, setCrTagIds] = useState<string[]>([]);

  const [editCrId, setEditCrId] = useState<string | null>(null);
  const [editCrTitle, setEditCrTitle] = useState("");
  const [editCrDescription, setEditCrDescription] = useState("");
  const [editCrTotalAmount, setEditCrTotalAmount] = useState("");
  const [editCrDateLocked, setEditCrDateLocked] = useState("");
  const [editCrStatus, setEditCrStatus] = useState<ChangeRequestStatus>("open");
  const [editCrCategory, setEditCrCategory] = useState("");
  const [editCrWhatWasSold, setEditCrWhatWasSold] = useState("");
  const [editCrOutcome, setEditCrOutcome] = useState("");
  const [editCrPandadocLink, setEditCrPandadocLink] = useState("");
  const [editCrAttachmentPath, setEditCrAttachmentPath] = useState("");
  const [editCrAttachmentName, setEditCrAttachmentName] = useState("");
  const [editCrAttachmentDriveId, setEditCrAttachmentDriveId] = useState("");
  const [editCrAttachmentDriveLink, setEditCrAttachmentDriveLink] = useState("");
  const [editCrTagIds, setEditCrTagIds] = useState<string[]>([]);

  const [deleteCrId, setDeleteCrId] = useState<string | null>(null);

  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);
  const [paymentType, setPaymentType] = useState<"recurring" | "upsell">("recurring");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("pending_invoice");
  const [paymentNarration, setPaymentNarration] = useState("");
  const [paymentDueDate, setPaymentDueDate] = useState("");
  const [selectedMilestoneId, setSelectedMilestoneId] = useState("");
  const [selectedChangeRequestId, setSelectedChangeRequestId] = useState("");
  const [selectedCrInstallmentId, setSelectedCrInstallmentId] = useState("");

  const [receivedPayment, setReceivedPayment] = useState<PaymentWithProject | null>(null);
  const [receivedAmount, setReceivedAmount] = useState("");

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

  const resetCrForm = () => {
    setIsAddCrOpen(false);
    setCrTitle("");
    setCrDescription("");
    setCrTotalAmount("");
    setCrDateLocked("");
    setCrNumberOfInstallments("1");
    setCrStatus("open");
    setCrCategory("");
    setCrWhatWasSold("");
    setCrOutcome("");
    setCrPandadocLink("");
    setCrAttachmentPath("");
    setCrAttachmentName("");
    setCrAttachmentDriveId("");
    setCrAttachmentDriveLink("");
    setCrTagIds([]);
  };

  const resetEditCrForm = () => {
    setEditCrId(null);
    setEditCrTitle("");
    setEditCrDescription("");
    setEditCrTotalAmount("");
    setEditCrDateLocked("");
    setEditCrStatus("open");
    setEditCrCategory("");
    setEditCrWhatWasSold("");
    setEditCrOutcome("");
    setEditCrPandadocLink("");
    setEditCrAttachmentPath("");
    setEditCrAttachmentName("");
    setEditCrAttachmentDriveId("");
    setEditCrAttachmentDriveLink("");
    setEditCrTagIds([]);
  };

  const openEditCr = (cr: ChangeRequestWithInstallments) => {
    setEditCrId(cr.id);
    setEditCrTitle(cr.title);
    setEditCrDescription(cr.description || "");
    setEditCrTotalAmount(cr.totalAmount?.toString() || "");
    setEditCrDateLocked(cr.dateLocked ? new Date(cr.dateLocked).toISOString().split("T")[0] : "");
    setEditCrStatus((cr.status as ChangeRequestStatus) || "open");
    setEditCrCategory(cr.category || "");
    setEditCrWhatWasSold(cr.whatWasSold || "");
    setEditCrOutcome(cr.outcome || "");
    setEditCrPandadocLink(cr.pandadocLink || "");
    setEditCrAttachmentPath(cr.attachmentPath || "");
    setEditCrAttachmentName(cr.attachmentName || "");
    setEditCrAttachmentDriveId(cr.attachmentDriveId || "");
    setEditCrAttachmentDriveLink(cr.attachmentDriveLink || "");
    setEditCrTagIds((cr.tags || []).map((t) => t.id));
  };

  const resetPaymentForm = () => {
    setIsAddPaymentOpen(false);
    setPaymentType("recurring");
    setPaymentAmount("");
    setPaymentStatus("pending_invoice");
    setPaymentNarration("");
    setPaymentDueDate("");
    setSelectedMilestoneId("");
    setSelectedChangeRequestId("");
    setSelectedCrInstallmentId("");
  };

  const unpaidMilestones = (projectWithMilestones?.milestones || []).filter(
    (m) => m.status !== "paid" && m.status !== "cancelled" && !m.payment,
  );
  const selectedCr = changeRequests?.find((cr) => cr.id === selectedChangeRequestId);
  const selectedCrInstallments = selectedCr?.installments || [];

  const handleSubmitPayment = () => {
    if (!project || !paymentAmount) {
      toast({ title: "Error", description: "Please enter an amount.", variant: "destructive" });
      return;
    }
    let finalNarration = paymentNarration;
    if (paymentType === "recurring" && selectedMilestoneId && !paymentNarration) {
      const m = unpaidMilestones.find((x) => x.id === selectedMilestoneId);
      if (m) finalNarration = m.name;
    }
    if (paymentType === "upsell" && selectedCrInstallmentId && !paymentNarration) {
      const inst = selectedCrInstallments.find((i) => i.id === selectedCrInstallmentId);
      if (inst) finalNarration = selectedCr ? `${selectedCr.title} - ${inst.name}` : inst.name;
    }
    createPaymentMutation.mutate({
      projectId: project.id,
      expectedAmount: paymentAmount,
      totalAmount: project.totalCost || paymentAmount,
      paymentType,
      status: paymentStatus,
      narration: finalNarration,
      dueDate: paymentDueDate || null,
      milestoneId: paymentType === "recurring" && selectedMilestoneId ? selectedMilestoneId : null,
      changeRequestId: paymentType === "upsell" && selectedChangeRequestId ? selectedChangeRequestId : null,
      crInstallmentId: paymentType === "upsell" && selectedCrInstallmentId ? selectedCrInstallmentId : null,
      probability: 100,
      isNewUpsell: false,
      isConfirmed: false,
    });
  };

  const handlePaymentStatusChange = (payment: PaymentWithProject, newStatus: string) => {
    if (newStatus === "received") {
      setReceivedPayment(payment);
      setReceivedAmount(payment.expectedAmount?.toString() || "");
      return;
    }
    updatePaymentStatusMutation.mutate({ id: payment.id, status: newStatus });
  };

  const detailTotalCost = parseFloat(project?.totalCost?.toString() || "0");
  const detailReceived = parseFloat(project?.totalReceived?.toString() || "0");
  const detailUpsellReceived = parseFloat(project?.upsellReceived?.toString() || "0");
  const detailRemaining = detailTotalCost - detailReceived;
  const detailPct = detailTotalCost > 0 ? Math.min(100, Math.round((detailReceived / detailTotalCost) * 100)) : 0;

  useEffect(() => {
    if (open && project && autoOpenAddPayment && canCreatePayment) {
      setIsAddPaymentOpen(true);
      onAutoAddPaymentHandled?.();
    }
  }, [open, project, autoOpenAddPayment, canCreatePayment, onAutoAddPaymentHandled]);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto" data-testid="sheet-project-workspace">
          <SheetHeader>
            <div className="flex items-start justify-between gap-3 pr-6">
              <div className="min-w-0">
                <SheetTitle className="truncate" data-testid="text-workspace-project-name">
                  {project?.name || "Project"}
                </SheetTitle>
                <SheetDescription className="flex items-center gap-2 mt-1">
                  <span className="truncate">{project?.clientName}</span>
                  {project?.region && <RegionBadge region={project.region} />}
                </SheetDescription>
              </div>
              {project && (
                <Badge className={`${projectStatusColors[project.status || "active"]} shrink-0`} data-testid="badge-workspace-status">
                  {projectStatusLabels[project.status || "active"]}
                </Badge>
              )}
            </div>
          </SheetHeader>

          {!project ? (
            <div className="mt-6 space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              {/* Financial summary */}
              <div className="space-y-4" data-testid="workspace-financial-summary">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100/40 p-3 space-y-1 dark:border-blue-900/50 dark:from-blue-950/40 dark:to-blue-900/10">
                    <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                      <Wallet className="h-3.5 w-3.5" />
                      <p className="text-[11px] font-semibold uppercase tracking-wide">Total Cost</p>
                    </div>
                    <p className="text-lg font-bold tabular-nums text-blue-700 dark:text-blue-300" data-testid="text-workspace-total-cost">{formatCurrency(detailTotalCost)}</p>
                  </div>
                  <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100/40 p-3 space-y-1 dark:border-emerald-900/50 dark:from-emerald-950/40 dark:to-emerald-900/10">
                    <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                      <TrendingUp className="h-3.5 w-3.5" />
                      <p className="text-[11px] font-semibold uppercase tracking-wide">Received</p>
                    </div>
                    <p className="text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-300" data-testid="text-workspace-received">{formatCurrency(detailReceived)}</p>
                  </div>
                  <div className={`rounded-xl border p-3 space-y-1 ${detailRemaining > 0 ? "border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100/40 dark:border-amber-900/50 dark:from-amber-950/40 dark:to-amber-900/10" : "border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100/40 dark:border-emerald-900/50 dark:from-emerald-950/40 dark:to-emerald-900/10"}`}>
                    <div className={`flex items-center gap-1.5 ${detailRemaining > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                      <CircleDollarSign className="h-3.5 w-3.5" />
                      <p className="text-[11px] font-semibold uppercase tracking-wide">Remaining</p>
                    </div>
                    <p className={`text-lg font-bold tabular-nums ${detailRemaining > 0 ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"}`} data-testid="text-workspace-remaining">{formatCurrency(detailRemaining > 0 ? detailRemaining : 0)}</p>
                  </div>
                </div>
                <div className="rounded-xl border bg-card p-4 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium">Collection Progress</span>
                    <span className={`font-bold ${detailPct >= 100 ? "text-emerald-600 dark:text-emerald-400" : "text-primary"}`} data-testid="text-workspace-collection-pct">{detailPct}%</span>
                  </div>
                  <Progress value={detailPct} className="h-2" />
                  <p className="text-[11px] text-muted-foreground pt-0.5">Base project collection only — upsells are tracked separately below.</p>
                </div>
                <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-violet-100/40 p-3 flex items-center justify-between dark:border-violet-900/50 dark:from-violet-950/40 dark:to-violet-900/10">
                  <div className="flex items-center gap-1.5 text-violet-600 dark:text-violet-400">
                    <Sparkles className="h-3.5 w-3.5" />
                    <p className="text-[11px] font-semibold uppercase tracking-wide">Upsells Received</p>
                  </div>
                  <p className="text-base font-bold tabular-nums text-violet-700 dark:text-violet-300" data-testid="text-workspace-upsell-received">{formatCurrency(detailUpsellReceived)}</p>
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
                    {project.billingType ? (
                      <Badge variant="outline" className={`font-medium ${billingTypeColors[project.billingType] || ""}`}>
                        {billingTypeLabels[project.billingType]}
                      </Badge>
                    ) : (
                      <p className="font-medium text-muted-foreground">Not Set</p>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Assigned PM</p>
                    <p className="font-medium">
                      {project.pm ? `${project.pm.firstName} ${project.pm.lastName}` : "-"}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Contract Start</p>
                    <p className="font-medium flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-sky-500" />{formatDate(project.contractStartDate)}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Contract End</p>
                    <p className="font-medium flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-rose-500" />{formatDate(project.contractEndDate)}</p>
                  </div>
                  {project.billingType === "tbe" && (
                    <>
                      <div className="space-y-0.5">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Hours/Month</p>
                        <p className="font-medium">{project.tbeHoursPerMonth || "-"}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Hourly Rate</p>
                        <p className="font-medium">{project.tbeHourlyRate ? `$${project.tbeHourlyRate}` : "-"}</p>
                      </div>
                    </>
                  )}
                  {project.billingType === "mrr" && (
                    <>
                      <div className="space-y-0.5">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Monthly Amount</p>
                        <p className="font-medium">{project.mrrMonthlyAmount ? formatCurrency(project.mrrMonthlyAmount) : "-"}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Duration</p>
                        <p className="font-medium">{project.mrrDurationMonths ? `${project.mrrDurationMonths} months` : "-"}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* AE (UAE) Tax & Supply details */}
              {project.region === "AE" && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/40 overflow-hidden dark:border-amber-900/50 dark:bg-amber-950/20" data-testid="workspace-ae-tax-supply">
                  <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-100/60 px-4 py-2.5 dark:border-amber-900/50 dark:bg-amber-900/30">
                    <Receipt className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300">Tax &amp; Supply (UAE)</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4 p-4 text-sm">
                    <div className="space-y-0.5">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Project Type</p>
                      <p className="font-medium">{project.projectType || "-"}</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Service Type</p>
                      <p className="font-medium">{project.serviceType || "-"}</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Place of Supply</p>
                      <p className="font-medium">
                        {project.placeOfSupply === "inside_uae" ? "Inside UAE" : project.placeOfSupply === "outside_uae" ? "Outside UAE" : "-"}
                      </p>
                    </div>
                    {project.placeOfSupply === "inside_uae" && (
                      <div className="space-y-0.5">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">City</p>
                        <p className="font-medium flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />{project.supplyCity || "-"}</p>
                      </div>
                    )}
                    {project.placeOfSupply === "outside_uae" && (
                      <div className="space-y-0.5">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Country</p>
                        <p className="font-medium flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />{project.supplyCountry || "-"}</p>
                      </div>
                    )}
                    <div className="space-y-0.5">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Client TRN</p>
                      <p className="font-medium tabular-nums">{project.clientTrn || "-"}</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Client Business Name</p>
                      <p className="font-medium">{project.clientBusinessName || "-"}</p>
                    </div>
                    <div className="space-y-0.5 col-span-2">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Client Address</p>
                      <p className="font-medium whitespace-pre-wrap">{project.clientAddress || "-"}</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">VAT</p>
                      <p className="font-medium tabular-nums">{project.vat != null && project.vat !== "" ? `${project.vat}%` : "-"}</p>
                    </div>
                  </div>
                </div>
              )}

              <Separator />

              {/* Milestones */}
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg font-medium">Payment Milestones</h3>
                  {canEditProject && project.billingType && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => generateMilestonesMutation.mutate()}
                      disabled={generateMilestonesMutation.isPending}
                      data-testid="button-workspace-generate-milestones"
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${generateMilestonesMutation.isPending ? "animate-spin" : ""}`} />
                      Generate Milestones
                    </Button>
                  )}
                </div>

                {milestonesLoading ? (
                  <Skeleton className="h-24 w-full" />
                ) : projectWithMilestones?.milestones && projectWithMilestones.milestones.length > 0 ? (
                  <div className="space-y-2">
                    {projectWithMilestones.milestones.map((milestone: MilestoneWithPayment) => (
                      <div
                        key={milestone.id}
                        className="flex items-center justify-between gap-4 p-3 border rounded-md"
                        data-testid={`workspace-milestone-${milestone.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">{milestone.name}</p>
                            <Badge variant="secondary" className={`text-xs ${milestoneStatusColors[milestone.status] || ""}`}>
                              {milestone.status.replace(/_/g, " ")}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            {editingDueDateId === milestone.id ? (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                <Input
                                  type="date"
                                  value={editingDueDateValue}
                                  onChange={(e) => setEditingDueDateValue(e.target.value)}
                                  className="h-6 text-xs w-36 px-1"
                                  data-testid={`input-workspace-milestone-due-date-${milestone.id}`}
                                  autoFocus
                                />
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-5 w-5"
                                  onClick={() => editingDueDateValue && updateMilestoneDueDateMutation.mutate({ milestoneId: milestone.id, dueDate: editingDueDateValue })}
                                  disabled={!editingDueDateValue || updateMilestoneDueDateMutation.isPending}
                                  data-testid={`button-workspace-save-due-date-${milestone.id}`}
                                >
                                  <CheckCircle className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-5 w-5"
                                  onClick={() => setEditingDueDateId(null)}
                                  data-testid={`button-workspace-cancel-due-date-${milestone.id}`}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </span>
                            ) : (
                              <span
                                className={`flex items-center gap-1 ${canEditProject && milestone.status !== "paid" && milestone.status !== "cancelled" ? "cursor-pointer hover:text-foreground transition-colors" : ""}`}
                                onClick={() => {
                                  if (canEditProject && milestone.status !== "paid" && milestone.status !== "cancelled") {
                                    setEditingDueDateId(milestone.id);
                                    setEditingDueDateValue(milestone.dueDate ? new Date(milestone.dueDate).toISOString().split("T")[0] : "");
                                  }
                                }}
                                data-testid={`text-workspace-milestone-due-date-${milestone.id}`}
                              >
                                <Calendar className="h-3 w-3" />
                                Due: {formatDate(milestone.dueDate)}
                                {canEditProject && milestone.status !== "paid" && milestone.status !== "cancelled" && (
                                  <Pencil className="h-3 w-3 ml-1 opacity-50" />
                                )}
                              </span>
                            )}
                          </div>
                          {(milestone.payments?.length ?? 0) > 0 && (
                            <div className="mt-2 space-y-1.5">
                              {(milestone.payments.length > 1) && (
                                <p className="text-[11px] font-medium text-muted-foreground" data-testid={`workspace-linked-payment-count-${milestone.id}`}>
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
                                  data-testid={`button-workspace-open-payment-${milestone.id}-${payment.id}`}
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
                                    <span className="capitalize" data-testid={`workspace-linked-payment-type-${milestone.id}-${payment.id}`}>
                                      {payment.paymentType?.replace(/_/g, " ")}
                                    </span>
                                    <span>·</span>
                                    <span className="capitalize" data-testid={`workspace-linked-payment-status-${milestone.id}-${payment.id}`}>
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
                                    <span data-testid={`workspace-linked-payment-expected-${milestone.id}-${payment.id}`}>
                                      Expected: <span className="text-foreground">{formatCurrency(payment.expectedAmount)}</span>
                                    </span>
                                    <span data-testid={`workspace-linked-payment-received-${milestone.id}-${payment.id}`}>
                                      Received: <span className="text-foreground">{formatCurrency(payment.receivedAmount)}</span>
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="text-right flex flex-col items-end gap-1">
                          <p className="font-medium">{formatCurrency(milestone.expectedAmount)}</p>
                          {canEditProject && milestone.status !== "paid" && milestone.status !== "cancelled" ? (
                            <Select
                              value={milestone.status}
                              onValueChange={(newStatus) => updateMilestoneStatusMutation.mutate({ milestoneId: milestone.id, status: newStatus })}
                            >
                              <SelectTrigger className="h-7 text-xs w-36" data-testid={`select-workspace-milestone-status-${milestone.id}`}>
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                              <SelectContent>
                                {milestoneStatusItems.map((s) => (
                                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-xs text-muted-foreground capitalize">{milestone.status.replace(/_/g, " ")}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground border rounded-md">
                    <Calendar className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p>No milestones yet</p>
                    <p className="text-sm">Click "Generate Milestones" to create them</p>
                  </div>
                )}
              </div>

              <Separator />

              {/* Change Requests */}
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg font-medium">Change Requests</h3>
                  {canEditProject && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsAddCrOpen(true)}
                      data-testid="button-workspace-add-change-request"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Change Request
                    </Button>
                  )}
                </div>

                {changeRequests && changeRequests.length > 0 ? (
                  <div className="space-y-4">
                    {changeRequests.map((cr) => (
                      <div key={cr.id} className="border rounded-md p-3 space-y-3" data-testid={`workspace-change-request-${cr.id}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium truncate">{cr.title}</p>
                              {cr.category && (
                                <Badge variant="secondary" className="text-xs" data-testid={`badge-workspace-cr-category-${cr.id}`}>{cr.category}</Badge>
                              )}
                            </div>
                            {cr.whatWasSold && <p className="text-sm text-muted-foreground"><span className="font-medium">Sold:</span> {cr.whatWasSold}</p>}
                            {cr.description && <p className="text-sm text-muted-foreground">{cr.description}</p>}
                            {cr.outcome && <p className="text-sm text-muted-foreground"><span className="font-medium">Outcome:</span> {cr.outcome}</p>}
                            <p className="text-xs text-muted-foreground mt-1">
                              {cr.numberOfInstallments} installment{cr.numberOfInstallments === 1 ? "" : "s"}
                              {cr.dateLocked ? ` · Locked: ${formatDate(cr.dateLocked)}` : ""}
                            </p>
                            <div className="flex items-center gap-3 mt-1 flex-wrap">
                              {(cr.attachmentDriveId || cr.attachmentPath) && (
                                <a
                                  href={cr.attachmentDriveId ? `/api/change-requests/${cr.id}/attachment` : cr.attachmentPath!}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                                  data-testid={`link-workspace-cr-attachment-${cr.id}`}
                                >
                                  <Paperclip className="h-3.5 w-3.5" /> {cr.attachmentName || "Attachment"}
                                </a>
                              )}
                              {cr.pandadocLink && (
                                <a
                                  href={cr.pandadocLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                                  data-testid={`link-workspace-cr-pandadoc-${cr.id}`}
                                >
                                  <Link2 className="h-3.5 w-3.5" /> PandaDoc
                                </a>
                              )}
                            </div>
                            {cr.tags && cr.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2" data-testid={`tags-workspace-cr-${cr.id}`}>
                                {cr.tags.map((tag) => (
                                  <TagBadge key={tag.id} tag={tag} />
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{formatCurrency(cr.totalAmount)}</span>
                            {canEditProject && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditCr(cr)} data-testid={`button-workspace-edit-cr-${cr.id}`}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            {canEditProject && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteCrId(cr.id)} data-testid={`button-workspace-delete-cr-${cr.id}`}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2">
                          {cr.installments.map((inst: CrInstallmentWithPayment) => (
                            <div key={inst.id} className="flex items-center justify-between gap-4 p-2 border rounded-md bg-muted/30" data-testid={`workspace-cr-installment-${inst.id}`}>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-medium truncate">{inst.name}</p>
                                  <Badge variant="secondary" className={`text-xs ${milestoneStatusColors[inst.status] || ""}`}>
                                    {inst.status.replace(/_/g, " ")}
                                  </Badge>
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
                                  {canEditProject && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={() => openEditInstallment(inst)}
                                      data-testid={`button-workspace-edit-cr-installment-${inst.id}`}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                </div>
                                {canEditProject && inst.status !== "paid" && inst.status !== "cancelled" ? (
                                  <Select
                                    value={inst.status}
                                    onValueChange={(newStatus) => updateCrInstallmentStatusMutation.mutate({ installmentId: inst.id, status: newStatus })}
                                  >
                                    <SelectTrigger className="h-7 text-xs w-36" data-testid={`select-workspace-cr-installment-status-${inst.id}`}>
                                      <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {milestoneStatusItems.map((s) => (
                                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <span className="text-xs text-muted-foreground capitalize">{inst.status.replace(/_/g, " ")}</span>
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
                    <p className="text-sm">Add a change request to track extra locked-in work</p>
                  </div>
                )}
              </div>

              <Separator />

              {/* Payments for this month */}
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg font-medium">Payments This Month</h3>
                  {canCreatePayment && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsAddPaymentOpen(true)}
                      data-testid="button-workspace-add-payment"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Payment
                    </Button>
                  )}
                </div>

                {projectPayments.length > 0 ? (
                  <div className="space-y-2">
                    {projectPayments.map((payment) => (
                      <div key={payment.id} className="flex items-center justify-between gap-4 p-3 border rounded-md" data-testid={`workspace-payment-${payment.id}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">{payment.narration || "Payment"}</p>
                            <Badge variant="outline" className="text-xs capitalize">{payment.paymentType?.replace(/_/g, " ")}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Expected: {formatCurrency(payment.expectedAmount)}
                            {payment.status === "received" ? ` · Received: ${formatCurrency(payment.receivedAmount)}` : ""}
                          </p>
                        </div>
                        <div className="text-right">
                          {canEditPayment ? (
                            <Select value={payment.status} onValueChange={(newStatus) => handlePaymentStatusChange(payment, newStatus)}>
                              <SelectTrigger className="h-7 text-xs w-36" data-testid={`select-workspace-payment-status-${payment.id}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {paymentStatusItems.map((s) => (
                                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-xs text-muted-foreground capitalize">{payment.status?.replace(/_/g, " ")}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground border rounded-md">
                    <Wallet className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p>No payments for this month</p>
                    <p className="text-sm">Click "Add Payment" to create one</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Add Change Request dialog */}
      <Dialog open={isAddCrOpen} onOpenChange={(o) => { if (!o) resetCrForm(); else setIsAddCrOpen(true); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Change Request</DialogTitle>
            <DialogDescription>Create a change request and split it into installments.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input placeholder="Change request title" value={crTitle} onChange={(e) => setCrTitle(e.target.value)} data-testid="input-workspace-cr-title" />
            </div>
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select value={crCategory} onValueChange={setCrCategory}>
                <SelectTrigger data-testid="select-workspace-cr-category">
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
                <SelectTrigger data-testid="select-workspace-cr-status">
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
              <Textarea placeholder="Describe what was sold" value={crWhatWasSold} onChange={(e) => setCrWhatWasSold(e.target.value)} data-testid="input-workspace-cr-what-was-sold" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea placeholder="Optional description" value={crDescription} onChange={(e) => setCrDescription(e.target.value)} data-testid="input-workspace-cr-description" />
            </div>
            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2">
                <Label>Total Amount *</Label>
                <Input type="number" placeholder="0.00" value={crTotalAmount} onChange={(e) => setCrTotalAmount(e.target.value)} data-testid="input-workspace-cr-total-amount" />
              </div>
              <div className="space-y-2">
                <Label># Installments *</Label>
                <Input type="number" min="1" value={crNumberOfInstallments} onChange={(e) => setCrNumberOfInstallments(e.target.value)} data-testid="input-workspace-cr-installments" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Date Locked</Label>
              <Input type="date" value={crDateLocked} onChange={(e) => setCrDateLocked(e.target.value)} data-testid="input-workspace-cr-date-locked" />
            </div>
            <div className="space-y-2">
              <Label>Outcome</Label>
              <Textarea placeholder="Optional outcome / result" value={crOutcome} onChange={(e) => setCrOutcome(e.target.value)} data-testid="input-workspace-cr-outcome" />
            </div>
            <div className="space-y-2">
              <Label>PandaDoc Link</Label>
              <Input placeholder="https://app.pandadoc.com/..." value={crPandadocLink} onChange={(e) => setCrPandadocLink(e.target.value)} data-testid="input-workspace-cr-pandadoc" />
            </div>
            <div className="space-y-2">
              <Label>Attachment *</Label>
              <div className="flex items-center gap-2 flex-wrap">
                <DriveFileUploader
                  projectId={projectId ?? ""}
                  buttonClassName="h-9"
                  data-testid="button-workspace-cr-upload"
                  onUploaded={(result) => {
                    setCrAttachmentDriveId(result.driveId);
                    setCrAttachmentDriveLink(result.link || "");
                    setCrAttachmentName(result.name);
                  }}
                >
                  <span className="flex items-center gap-2"><Upload className="h-4 w-4" /> Upload File</span>
                </DriveFileUploader>
                {crAttachmentDriveId && (
                  <span className="flex items-center gap-1 text-sm text-muted-foreground truncate max-w-[12rem]" data-testid="text-workspace-cr-attachment-name">
                    <Paperclip className="h-3.5 w-3.5" /> {crAttachmentName || "Attached"}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">A file attachment is required for new upsells.</p>
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
                  toast({ title: "Error", description: "Please upload a file attachment.", variant: "destructive" });
                  return;
                }
                createChangeRequestMutation.mutate({
                  title: crTitle,
                  description: crDescription || null,
                  totalAmount: crTotalAmount,
                  dateLocked: crDateLocked || null,
                  numberOfInstallments: parseInt(crNumberOfInstallments, 10) || 1,
                  status: crStatus,
                  category: crCategory,
                  whatWasSold: crWhatWasSold,
                  outcome: crOutcome || null,
                  pandadocLink: crPandadocLink || null,
                  attachmentDriveId: crAttachmentDriveId,
                  attachmentDriveLink: crAttachmentDriveLink || null,
                  attachmentName: crAttachmentName || null,
                  tagIds: crTagIds,
                });
              }}
              disabled={createChangeRequestMutation.isPending}
              data-testid="button-workspace-submit-change-request"
            >
              {createChangeRequestMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Change Request dialog */}
      <Dialog open={!!editCrId} onOpenChange={(o) => { if (!o) resetEditCrForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Change Request</DialogTitle>
            <DialogDescription>Update the change request details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input value={editCrTitle} onChange={(e) => setEditCrTitle(e.target.value)} data-testid="input-workspace-edit-cr-title" />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={editCrCategory} onValueChange={setEditCrCategory}>
                <SelectTrigger data-testid="select-workspace-edit-cr-category">
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
              <Select value={editCrStatus} onValueChange={(v) => setEditCrStatus(v as ChangeRequestStatus)}>
                <SelectTrigger data-testid="select-workspace-edit-cr-status">
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
              <Label>What was sold</Label>
              <Textarea value={editCrWhatWasSold} onChange={(e) => setEditCrWhatWasSold(e.target.value)} data-testid="input-workspace-edit-cr-what-was-sold" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={editCrDescription} onChange={(e) => setEditCrDescription(e.target.value)} data-testid="input-workspace-edit-cr-description" />
            </div>
            <div className="space-y-2">
              <Label>Total Amount *</Label>
              <Input type="number" value={editCrTotalAmount} onChange={(e) => setEditCrTotalAmount(e.target.value)} data-testid="input-workspace-edit-cr-total-amount" />
            </div>
            <div className="space-y-2">
              <Label>Date Locked</Label>
              <Input type="date" value={editCrDateLocked} onChange={(e) => setEditCrDateLocked(e.target.value)} data-testid="input-workspace-edit-cr-date-locked" />
            </div>
            <div className="space-y-2">
              <Label>Outcome</Label>
              <Textarea value={editCrOutcome} onChange={(e) => setEditCrOutcome(e.target.value)} data-testid="input-workspace-edit-cr-outcome" />
            </div>
            <div className="space-y-2">
              <Label>PandaDoc Link</Label>
              <Input placeholder="https://app.pandadoc.com/..." value={editCrPandadocLink} onChange={(e) => setEditCrPandadocLink(e.target.value)} data-testid="input-workspace-edit-cr-pandadoc" />
            </div>
            <div className="space-y-2">
              <Label>Attachment</Label>
              <div className="flex items-center gap-2 flex-wrap">
                <DriveFileUploader
                  projectId={projectId ?? ""}
                  buttonClassName="h-9"
                  data-testid="button-workspace-edit-cr-upload"
                  onUploaded={(result) => {
                    setEditCrAttachmentDriveId(result.driveId);
                    setEditCrAttachmentDriveLink(result.link || "");
                    setEditCrAttachmentName(result.name);
                  }}
                >
                  <span className="flex items-center gap-2"><Upload className="h-4 w-4" /> {(editCrAttachmentDriveId || editCrAttachmentPath) ? "Replace File" : "Upload File"}</span>
                </DriveFileUploader>
                {(editCrAttachmentDriveId || editCrAttachmentPath) && (
                  <span className="flex items-center gap-1 text-sm text-muted-foreground truncate max-w-[12rem]" data-testid="text-workspace-edit-cr-attachment-name">
                    <Paperclip className="h-3.5 w-3.5" /> {editCrAttachmentName || "Attached"}
                  </span>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tags</Label>
              <TagSelector selectedTagIds={editCrTagIds} onChange={setEditCrTagIds} />
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
                    status: editCrStatus,
                    category: editCrCategory || null,
                    whatWasSold: editCrWhatWasSold || null,
                    outcome: editCrOutcome || null,
                    pandadocLink: editCrPandadocLink || null,
                    attachmentPath: editCrAttachmentPath || null,
                    attachmentName: editCrAttachmentName || null,
                    attachmentDriveId: editCrAttachmentDriveId || null,
                    attachmentDriveLink: editCrAttachmentDriveLink || null,
                    tagIds: editCrTagIds,
                  },
                });
              }}
              disabled={updateChangeRequestMutation.isPending}
              data-testid="button-workspace-submit-edit-change-request"
            >
              {updateChangeRequestMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Change Request confirm */}
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
              data-testid="button-workspace-confirm-delete-cr"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Payment dialog */}
      <Dialog open={isAddPaymentOpen} onOpenChange={(o) => { if (!o) resetPaymentForm(); else setIsAddPaymentOpen(true); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Payment</DialogTitle>
            <DialogDescription>Add a payment for {project?.name}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={paymentType} onValueChange={(v) => { setPaymentType(v as "recurring" | "upsell"); setSelectedMilestoneId(""); setSelectedChangeRequestId(""); setSelectedCrInstallmentId(""); }}>
                <SelectTrigger data-testid="select-workspace-payment-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recurring">Recurring</SelectItem>
                  <SelectItem value="upsell">Upsell</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {paymentType === "recurring" && unpaidMilestones.length > 0 && (
              <div className="space-y-2">
                <Label>Link Milestone (optional)</Label>
                <Select value={selectedMilestoneId || "none"} onValueChange={(v) => {
                  const id = v === "none" ? "" : v;
                  setSelectedMilestoneId(id);
                  const m = unpaidMilestones.find((x) => x.id === id);
                  if (m) {
                    setPaymentAmount(m.expectedAmount?.toString() || "");
                    setPaymentNarration(m.name);
                  }
                }}>
                  <SelectTrigger data-testid="select-workspace-payment-milestone">
                    <SelectValue placeholder="No milestone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No milestone</SelectItem>
                    {unpaidMilestones.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name} ({formatCurrency(m.expectedAmount)})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {paymentType === "upsell" && changeRequests && changeRequests.length > 0 && (
              <>
                <div className="space-y-2">
                  <Label>Change Request (optional)</Label>
                  <Select value={selectedChangeRequestId || "none"} onValueChange={(v) => { setSelectedChangeRequestId(v === "none" ? "" : v); setSelectedCrInstallmentId(""); }}>
                    <SelectTrigger data-testid="select-workspace-payment-cr">
                      <SelectValue placeholder="No change request" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No change request</SelectItem>
                      {changeRequests.map((cr) => (
                        <SelectItem key={cr.id} value={cr.id}>{cr.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedCrInstallments.length > 0 && (
                  <div className="space-y-2">
                    <Label>Installment (optional)</Label>
                    <Select value={selectedCrInstallmentId || "none"} onValueChange={(v) => {
                      const id = v === "none" ? "" : v;
                      setSelectedCrInstallmentId(id);
                      const inst = selectedCrInstallments.find((x) => x.id === id);
                      if (inst) {
                        setPaymentAmount(inst.expectedAmount?.toString() || "");
                        setPaymentNarration(selectedCr ? `${selectedCr.title} - ${inst.name}` : inst.name);
                      }
                    }}>
                      <SelectTrigger data-testid="select-workspace-payment-cr-installment">
                        <SelectValue placeholder="No installment" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No installment</SelectItem>
                        {selectedCrInstallments.map((inst) => (
                          <SelectItem key={inst.id} value={inst.id}>{inst.name} ({formatCurrency(inst.expectedAmount)})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}

            <div className="space-y-2">
              <Label>Amount *</Label>
              <Input type="number" placeholder="0.00" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} data-testid="input-workspace-payment-amount" />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                <SelectTrigger data-testid="select-workspace-payment-new-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {paymentStatusItems.filter((s) => s.value !== "received").map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Narration</Label>
              <Input placeholder="Optional note" value={paymentNarration} onChange={(e) => setPaymentNarration(e.target.value)} data-testid="input-workspace-payment-narration" />
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input type="date" value={paymentDueDate} onChange={(e) => setPaymentDueDate(e.target.value)} data-testid="input-workspace-payment-due-date" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetPaymentForm}>Cancel</Button>
            <Button onClick={handleSubmitPayment} disabled={createPaymentMutation.isPending} data-testid="button-workspace-submit-payment">
              {createPaymentMutation.isPending ? "Adding..." : "Add Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark received dialog */}
      <Dialog open={!!receivedPayment} onOpenChange={(o) => { if (!o) { setReceivedPayment(null); setReceivedAmount(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Payment as Received</DialogTitle>
            <DialogDescription>
              Enter the amount received for {receivedPayment?.narration || project?.name || "this payment"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="workspace-received-amount">Received Amount</Label>
              <Input
                id="workspace-received-amount"
                type="number"
                value={receivedAmount}
                onChange={(e) => setReceivedAmount(e.target.value)}
                placeholder="Enter amount received"
                data-testid="input-workspace-received-amount"
              />
              <p className="text-xs text-muted-foreground">
                Expected: {formatCurrency(receivedPayment?.expectedAmount || 0)}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setReceivedPayment(null); setReceivedAmount(""); }}>Cancel</Button>
            <Button
              onClick={() => { if (receivedPayment) updatePaymentStatusMutation.mutate({ id: receivedPayment.id, status: "received", receivedAmount }); }}
              disabled={updatePaymentStatusMutation.isPending || !receivedAmount}
              data-testid="button-workspace-confirm-received"
            >
              {updatePaymentStatusMutation.isPending ? "Saving..." : "Confirm Received"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Installment dialog */}
      <Dialog open={!!editInstId} onOpenChange={(o) => { if (!o) resetEditInstForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Installment</DialogTitle>
            <DialogDescription>Update the installment details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={editInstName} onChange={(e) => setEditInstName(e.target.value)} data-testid="input-workspace-edit-installment-name" />
            </div>
            <div className="space-y-2">
              <Label>Expected Amount *</Label>
              <Input type="number" value={editInstAmount} onChange={(e) => setEditInstAmount(e.target.value)} data-testid="input-workspace-edit-installment-amount" />
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input type="date" value={editInstDueDate} onChange={(e) => setEditInstDueDate(e.target.value)} data-testid="input-workspace-edit-installment-due-date" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetEditInstForm}>Cancel</Button>
            <Button
              onClick={() => {
                if (!editInstId) return;
                if (!editInstName || !editInstAmount) {
                  toast({ title: "Error", description: "Please enter a name and amount.", variant: "destructive" });
                  return;
                }
                updateCrInstallmentMutation.mutate({
                  id: editInstId,
                  data: {
                    name: editInstName,
                    expectedAmount: editInstAmount,
                    dueDate: editInstDueDate || null,
                  },
                });
              }}
              disabled={updateCrInstallmentMutation.isPending}
              data-testid="button-workspace-submit-edit-installment"
            >
              {updateCrInstallmentMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MilestoneSyncDialog
        open={milestoneSyncData !== null}
        onOpenChange={(o) => { if (!o) setMilestoneSyncData(null); }}
        syncData={milestoneSyncData}
        paymentId={milestoneSyncPaymentId}
      />
    </>
  );
}
