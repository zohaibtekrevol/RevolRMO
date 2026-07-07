import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, getErrorMessage } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { RegionBadge } from "@/components/region-badge";
import { DeliveryStatusIndicator } from "@/components/delivery-status-indicator";
import { ProjectDetailSheet } from "@/components/project-detail-sheet";
import { useToast } from "@/hooks/use-toast";
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
import { Plus, Target, Calendar, DollarSign, Pencil, Trash2, Copy, History, CheckCircle, Clock, TrendingUp, Users, FileSpreadsheet, Trophy, ChevronsUpDown, Check, Search, AlertCircle } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { BulkPlanGenerator } from "@/components/bulk-plan-generator";
import type { MonthlyPlan, PaymentWithProject, Project, PmTargetWithUser, SystemPermission, ProjectMilestone, Payment, PmLeaders, ChangeRequestWithInstallments } from "@shared/schema";
import { PmLeaderCards } from "@/components/pm-leader-cards";

const months = [
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

export default function Planning() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);
  const [targetAmount, setTargetAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [editingPmTarget, setEditingPmTarget] = useState<{pmId: string; pmName: string; currentTarget: string} | null>(null);
  const [newPmTargetAmount, setNewPmTargetAmount] = useState("");
  
  // Add Payment form state
  const [paymentProjectId, setPaymentProjectId] = useState("");
  const [projectSearchOpen, setProjectSearchOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentType, setPaymentType] = useState<"recurring" | "upsell">("recurring");
  const [paymentStatus, setPaymentStatus] = useState<"not_targeting" | "pending_invoice" | "invoiced" | "received">("pending_invoice");
  const [paymentNarration, setPaymentNarration] = useState("");
  const [paymentDueDate, setPaymentDueDate] = useState("");
  const [paymentProbability, setPaymentProbability] = useState<number>(100);
  const [isNewUpsell, setIsNewUpsell] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [editingPayment, setEditingPayment] = useState<PaymentWithProject | null>(null);
  const [deletePaymentId, setDeletePaymentId] = useState<string | null>(null);
  const [selectedCarryForward, setSelectedCarryForward] = useState<Set<string>>(new Set());
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string>("");
  const [selectedChangeRequestId, setSelectedChangeRequestId] = useState<string>("");
  const [selectedCrInstallmentId, setSelectedCrInstallmentId] = useState<string>("");
  const [isBulkGeneratorOpen, setIsBulkGeneratorOpen] = useState(false);
  const [isDeletePlanOpen, setIsDeletePlanOpen] = useState(false);
  const [detailProjectId, setDetailProjectId] = useState<string | null>(null);
  const [projectDetailOpen, setProjectDetailOpen] = useState(false);

  // Calculate previous month
  const getPreviousMonth = (month: number, year: number) => {
    if (month === 1) {
      return { month: 12, year: year - 1 };
    }
    return { month: month - 1, year };
  };
  const prevMonth = getPreviousMonth(selectedMonth, selectedYear);

  // Fetch plan by month and year using the dedicated endpoint
  const planQueryKey = ["/api/monthly-plans/by-date", { month: selectedMonth, year: selectedYear }];
  const { data: plan, isLoading: planLoading, isFetching: planFetching } = useQuery<MonthlyPlan | null>({
    queryKey: planQueryKey,
    queryFn: async () => {
      const res = await fetch(`/api/monthly-plans/by-date?month=${selectedMonth}&year=${selectedYear}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch plan");
      return res.json();
    },
  });

  // Sync form state when plan loads
  useEffect(() => {
    if (plan) {
      setTargetAmount(plan.monthlyTarget?.toString() || "");
      setNotes(plan.notes || "");
    } else {
      setTargetAmount("");
      setNotes("");
    }
  }, [plan]);

  const { data: payments, isLoading: paymentsLoading } = useQuery<PaymentWithProject[]>({
    queryKey: ["/api/payments", { month: selectedMonth, year: selectedYear }],
    queryFn: async () => {
      const res = await fetch(`/api/payments?month=${selectedMonth}&year=${selectedYear}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch payments");
      return res.json();
    },
  });

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: userPermissions } = useQuery<SystemPermission[]>({
    queryKey: ["/api/access/my-permissions"],
  });

  const canCreatePayments = userPermissions?.includes("create_payments") ?? false;
  const canEditPayments = userPermissions?.includes("edit_payments") ?? false;
  const canDeletePayments = userPermissions?.includes("delete_payments") ?? false;

  // Type for unpaid milestones with project info
  type UnpaidMilestone = ProjectMilestone & { projectName: string; clientName: string };

  // Fetch unpaid milestones for recurring payment dropdown
  const { data: unpaidMilestones } = useQuery<UnpaidMilestone[]>({
    queryKey: ["/api/milestones/unpaid"],
    queryFn: async () => {
      const res = await fetch("/api/milestones/unpaid", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch unpaid milestones");
      return res.json();
    },
    enabled: isAddPaymentOpen && paymentType === "recurring",
  });

  // Type for recent payments with milestone info
  type RecentPaymentWithMilestone = Payment & { milestoneName?: string };

  // Fetch recent payments for the selected project
  const { data: recentPayments } = useQuery<RecentPaymentWithMilestone[]>({
    queryKey: ["/api/projects", paymentProjectId, "recent-payments"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${paymentProjectId}/recent-payments?limit=3`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch recent payments");
      return res.json();
    },
    enabled: !!paymentProjectId && isAddPaymentOpen,
  });

  // Filter unpaid milestones for the selected project
  const projectUnpaidMilestones = unpaidMilestones?.filter(m => m.projectId === paymentProjectId) || [];

  // Fetch change requests for the selected project (upsell payment linking)
  const { data: projectChangeRequests } = useQuery<ChangeRequestWithInstallments[]>({
    queryKey: ["/api/projects", paymentProjectId, "change-requests"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${paymentProjectId}/change-requests`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch change requests");
      return res.json();
    },
    enabled: !!paymentProjectId && isAddPaymentOpen && paymentType === "upsell",
  });

  // Installments for the selected change request that are still unpaid
  const selectedCrInstallments = (projectChangeRequests?.find(cr => cr.id === selectedChangeRequestId)?.installments || [])
    .filter(inst => inst.status !== "paid" && inst.status !== "cancelled");

  // Fetch PM Targets for the selected month/year
  const pmTargetsQueryKey = ["/api/pm-targets", { month: selectedMonth, year: selectedYear }];
  const { data: pmTargets, isLoading: pmTargetsLoading } = useQuery<PmTargetWithUser[]>({
    queryKey: pmTargetsQueryKey,
    queryFn: async () => {
      const res = await fetch(`/api/pm-targets?month=${selectedMonth}&year=${selectedYear}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch PM targets");
      return res.json();
    },
  });

  // Fetch PM Leaders for the selected month/year
  const { data: pmLeaders } = useQuery<PmLeaders>({
    queryKey: ["/api/dashboard/pm-leaders", { month: selectedMonth, year: selectedYear }],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/pm-leaders?month=${selectedMonth}&year=${selectedYear}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch PM leaders");
      return res.json();
    },
  });

  // PM Target mutation
  const savePmTargetMutation = useMutation({
    mutationFn: async (data: { pmId: string; targetAmount: string }) => {
      return apiRequest("POST", "/api/pm-targets", {
        pmId: data.pmId,
        month: selectedMonth,
        year: selectedYear,
        targetAmount: data.targetAmount,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pmTargetsQueryKey });
      setEditingPmTarget(null);
      setNewPmTargetAmount("");
      toast({ title: "PM Target Saved", description: "PM target has been updated." });
    },
    onError: (error) => {
      toast({ title: "Error", description: getErrorMessage(error, "Failed to save PM target."), variant: "destructive" });
    },
  });

  // Fetch previous month's payments
  const { data: previousMonthPayments, isLoading: prevPaymentsLoading } = useQuery<PaymentWithProject[]>({
    queryKey: ["/api/payments", { month: prevMonth.month, year: prevMonth.year }],
    queryFn: async () => {
      const res = await fetch(`/api/payments?month=${prevMonth.month}&year=${prevMonth.year}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch previous month payments");
      return res.json();
    },
  });

  // Create or update plan mutation - planId is passed at call time to avoid stale state
  const savePlanMutation = useMutation({
    mutationFn: async (data: { monthlyTarget: string; notes: string; planId: string | null }): Promise<{ plan: MonthlyPlan; wasUpdate: boolean }> => {
      const { planId, ...payload } = data;
      if (planId) {
        // Update existing plan
        const plan = await apiRequest("PATCH", `/api/monthly-plans/${planId}`, payload);
        return { plan, wasUpdate: true };
      } else {
        // Create new plan
        const plan = await apiRequest("POST", "/api/monthly-plans", {
          month: selectedMonth,
          year: selectedYear,
          ...payload,
        });
        return { plan, wasUpdate: false };
      }
    },
    onSuccess: ({ plan, wasUpdate }) => {
      // Eagerly update cache with new plan data so subsequent saves use correct ID
      queryClient.setQueryData(planQueryKey, plan);
      queryClient.invalidateQueries({ queryKey: ["/api/monthly-plans"] });
      toast({ title: "Plan Saved", description: wasUpdate ? "Monthly plan updated." : "Monthly plan created." });
    },
    onError: (error) => {
      toast({ title: "Error", description: getErrorMessage(error, "Failed to save plan."), variant: "destructive" });
    },
  });

  const toggleTargetMutation = useMutation({
    mutationFn: async (data: { id: string; isTarget: boolean }) => {
      return apiRequest("PATCH", `/api/payments/${data.id}`, { isTarget: data.isTarget });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pm-targets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cost-margin/summary"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/cost-margin/hourly-buckets"], exact: false });
    },
    onError: (error) => {
      toast({ title: "Error", description: getErrorMessage(error, "Failed to update payment."), variant: "destructive" });
    },
  });

  const toggleConfirmedMutation = useMutation({
    mutationFn: async (data: { id: string; isConfirmed: boolean }) => {
      return apiRequest("PATCH", `/api/payments/${data.id}`, { isConfirmed: data.isConfirmed });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cost-margin/summary"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/cost-margin/hourly-buckets"], exact: false });
    },
    onError: (error) => {
      toast({ title: "Error", description: getErrorMessage(error, "Failed to update confirmation status."), variant: "destructive" });
    },
  });

  const createPaymentMutation = useMutation({
    mutationFn: async (data: { projectId: string; expectedAmount: string; totalAmount: string; paymentType: string; status: string; narration: string; dueDate: string | null; milestoneId: string | null; changeRequestId: string | null; crInstallmentId: string | null; probability: number; isNewUpsell: boolean; isConfirmed: boolean }) => {
      return apiRequest("POST", "/api/payments", {
        ...data,
        dueDate: data.dueDate ? data.dueDate : null,
        month: selectedMonth,
        year: selectedYear,
        isTarget: data.paymentType === "upsell" ? false : true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pm-targets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cost-margin/summary"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/cost-margin/hourly-buckets"], exact: false });
      resetPaymentForm();
      toast({ title: "Payment Added", description: "The payment has been added successfully." });
    },
    onError: (error) => {
      toast({ title: "Error", description: getErrorMessage(error, "Failed to add payment."), variant: "destructive" });
    },
  });

  const updatePaymentMutation = useMutation({
    mutationFn: async (data: { id: string; projectId: string; expectedAmount: string; totalAmount: string; paymentType: string; status: string; narration: string; dueDate: string | null; milestoneId: string | null; changeRequestId: string | null; crInstallmentId: string | null; probability: number; isNewUpsell: boolean; isConfirmed: boolean }) => {
      const { id, ...payload } = data;
      return apiRequest("PATCH", `/api/payments/${id}`, {
        ...payload,
        dueDate: payload.dueDate ? payload.dueDate : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pm-targets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cost-margin/summary"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/cost-margin/hourly-buckets"], exact: false });
      resetPaymentForm();
      toast({ title: "Payment Updated", description: "The payment has been updated successfully." });
    },
    onError: (error) => {
      toast({ title: "Error", description: getErrorMessage(error, "Failed to update payment."), variant: "destructive" });
    },
  });

  const deletePaymentMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/payments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pm-targets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cost-margin/summary"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/cost-margin/hourly-buckets"], exact: false });
      setDeletePaymentId(null);
      toast({ title: "Payment Deleted", description: "The payment has been deleted." });
    },
    onError: (error) => {
      toast({ title: "Error", description: getErrorMessage(error, "Failed to delete payment."), variant: "destructive" });
    },
  });

  const carryForwardMutation = useMutation({
    mutationFn: async (paymentIds: string[]) => {
      return apiRequest("POST", "/api/payments/carry-forward", {
        paymentIds,
        targetMonth: selectedMonth,
        targetYear: selectedYear,
      });
    },
    onSuccess: () => {
      // Invalidate both current and previous month payment queries
      queryClient.invalidateQueries({ queryKey: ["/api/payments", { month: selectedMonth, year: selectedYear }] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments", { month: prevMonth.month, year: prevMonth.year }] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pm-targets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cost-margin/summary"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/cost-margin/hourly-buckets"], exact: false });
      setSelectedCarryForward(new Set());
      toast({ title: "Payments Carried Forward", description: "Selected payments have been duplicated for this month." });
    },
    onError: (error) => {
      toast({ title: "Error", description: getErrorMessage(error, "Failed to carry forward payments."), variant: "destructive" });
    },
  });

  const deleteEntirePlanMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/payments/bulk?month=${selectedMonth}&year=${selectedYear}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to delete monthly plan");
      }
      return response.json();
    },
    onSuccess: (data: { deleted: number }) => {
      // Invalidate the specific month/year query to refresh the planning table
      queryClient.invalidateQueries({ queryKey: ["/api/payments", { month: selectedMonth, year: selectedYear }] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pm-targets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cost-margin/summary"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/cost-margin/hourly-buckets"], exact: false });
      // Also invalidate the monthly plan query to sync target/notes state
      queryClient.invalidateQueries({ queryKey: planQueryKey });
      setIsDeletePlanOpen(false);
      toast({ 
        title: "Monthly Plan Deleted", 
        description: `Successfully deleted ${data.deleted} payments for ${monthLabel} ${selectedYear}.` 
      });
    },
    onError: (error) => {
      toast({ title: "Error", description: getErrorMessage(error, "Failed to delete monthly plan."), variant: "destructive" });
    },
  });

  const resetPaymentForm = () => {
    setIsAddPaymentOpen(false);
    setEditingPayment(null);
    setPaymentProjectId("");
    setPaymentAmount("");
    setPaymentType("recurring");
    setPaymentStatus("pending_invoice");
    setPaymentNarration("");
    setPaymentDueDate("");
    setPaymentProbability(100);
    setSelectedMilestoneId("");
    setSelectedChangeRequestId("");
    setSelectedCrInstallmentId("");
    setIsNewUpsell(false);
    setIsConfirmed(false);
  };

  const openEditPayment = (payment: PaymentWithProject) => {
    setEditingPayment(payment);
    setPaymentProjectId(payment.projectId);
    setPaymentAmount(payment.expectedAmount?.toString() || "");
    setPaymentType(payment.paymentType as "recurring" | "upsell");
    setPaymentStatus(payment.status as "not_targeting" | "pending_invoice" | "invoiced" | "received");
    setPaymentNarration(payment.narration || "");
    setPaymentDueDate(payment.dueDate ? new Date(payment.dueDate).toISOString().split('T')[0] : "");
    setPaymentProbability((payment as any).probability ?? 100);
    setSelectedMilestoneId((payment as any).milestoneId || "");
    setSelectedChangeRequestId((payment as any).changeRequestId || "");
    setSelectedCrInstallmentId((payment as any).crInstallmentId || "");
    setIsNewUpsell((payment as any).isNewUpsell ?? false);
    setIsConfirmed((payment as any).isConfirmed ?? false);
    setIsAddPaymentOpen(true);
  };

  const handleSubmitPayment = () => {
    if (!paymentProjectId || !paymentAmount) {
      toast({ title: "Error", description: "Please select a project and enter an amount.", variant: "destructive" });
      return;
    }
    const selectedProject = projects?.find(p => p.id === paymentProjectId);
    const projectTotalCost = selectedProject?.totalCost || paymentAmount;
    
    // For recurring payments, use milestone name as narration if milestone selected.
    // When editing and the milestone is changed, refresh the narration to the new
    // milestone name (so the visible label actually updates), unless the narration
    // was manually customised (differs from the original milestone name).
    let finalNarration = paymentNarration;
    if (paymentType === "recurring" && selectedMilestoneId) {
      const selectedMilestone = projectUnpaidMilestones.find(m => m.id === selectedMilestoneId);
      if (selectedMilestone) {
        const originalMilestoneId = editingPayment ? (editingPayment as any).milestoneId : null;
        const milestoneChanged = !!editingPayment && selectedMilestoneId !== originalMilestoneId;
        const originalMilestone = originalMilestoneId
          ? unpaidMilestones?.find(m => m.id === originalMilestoneId)
          : null;
        const narrationMatchesOldMilestone =
          !paymentNarration || (originalMilestone ? paymentNarration === originalMilestone.name : false);
        if (milestoneChanged && narrationMatchesOldMilestone) {
          finalNarration = selectedMilestone.name;
        } else if (!paymentNarration) {
          finalNarration = selectedMilestone.name;
        }
      }
    }
    // For upsell payments linked to a change request installment, default the
    // narration to the installment name (prefixed with the CR title) when empty.
    if (paymentType === "upsell" && selectedCrInstallmentId && !paymentNarration) {
      const selectedInstallment = selectedCrInstallments.find(i => i.id === selectedCrInstallmentId);
      const selectedCr = projectChangeRequests?.find(cr => cr.id === selectedChangeRequestId);
      if (selectedInstallment) {
        finalNarration = selectedCr ? `${selectedCr.title} - ${selectedInstallment.name}` : selectedInstallment.name;
      }
    }
    
    const data = {
      projectId: paymentProjectId,
      expectedAmount: paymentAmount,
      totalAmount: projectTotalCost,
      paymentType: paymentType,
      status: paymentStatus,
      narration: finalNarration,
      dueDate: paymentDueDate || null,
      milestoneId: paymentType === "recurring" && selectedMilestoneId ? selectedMilestoneId : null,
      changeRequestId: paymentType === "upsell" && selectedChangeRequestId ? selectedChangeRequestId : null,
      crInstallmentId: paymentType === "upsell" && selectedCrInstallmentId ? selectedCrInstallmentId : null,
      probability: paymentProbability,
      isNewUpsell: paymentType === "upsell" ? isNewUpsell : false,
      isConfirmed: isConfirmed,
    };
    if (editingPayment) {
      updatePaymentMutation.mutate({ id: editingPayment.id, ...data });
    } else {
      createPaymentMutation.mutate(data);
    }
  };

  const formatCurrency = (value: number | string | null) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    if (num === null || isNaN(num as number)) return "$0";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(num as number);
  };

  const recurringPayments = payments?.filter(p => p.paymentType === "recurring") || [];
  const upsellPayments = payments?.filter(p => p.paymentType === "upsell") || [];
  const targetedPayments = recurringPayments.filter(p => p.isTarget);
  const totalTargeted = targetedPayments.reduce((sum, p) => sum + parseFloat(p.expectedAmount?.toString() || "0"), 0);
  
  // Calculate confirmed payments total (all payment types)
  const confirmedPayments = payments?.filter(p => (p as any).isConfirmed) || [];
  const totalConfirmed = confirmedPayments.reduce((sum, p) => sum + parseFloat(p.expectedAmount?.toString() || "0"), 0);
  
  // Calculate total received for current month
  const receivedPayments = payments?.filter(p => p.status === "received") || [];
  const totalReceived = receivedPayments.reduce((sum, p) => sum + parseFloat(p.receivedAmount?.toString() || p.expectedAmount?.toString() || "0"), 0);

  const monthLabel = months.find(m => m.value === selectedMonth)?.label || "";
  const prevMonthLabel = months.find(m => m.value === prevMonth.month)?.label || "";

  // Active, billable projects with no recurring payment in the selected month — likely missed
  // from the plan. Upsell-only activity does not count as covered.
  const recurringProjectIds = new Set(
    (payments || []).filter(p => p.paymentType === "recurring").map(p => p.projectId)
  );
  const missingPlanProjects = (projects || []).filter(p =>
    p.status === "active" &&
    !!p.billingType &&
    !p.isFullyPaid &&
    !recurringProjectIds.has(p.id)
  );

  // Previous month payment categorization
  const prevRecurringPayments = previousMonthPayments?.filter(p => p.paymentType === "recurring") || [];
  const prevUpsellPayments = previousMonthPayments?.filter(p => p.paymentType === "upsell") || [];
  const prevPlannedPayments = prevRecurringPayments.filter(p => p.isTarget);
  const prevReceivedPayments = previousMonthPayments?.filter(p => p.status === "received") || [];
  const prevUnreceivedPayments = prevPlannedPayments.filter(p => p.status !== "received");

  const prevTotalPlanned = prevPlannedPayments.reduce((sum, p) => sum + parseFloat(p.expectedAmount?.toString() || "0"), 0);
  const prevTotalReceived = prevReceivedPayments.reduce((sum, p) => sum + parseFloat(p.receivedAmount?.toString() || p.expectedAmount?.toString() || "0"), 0);
  const prevTotalUpsells = prevUpsellPayments.filter(p => p.status === "received").reduce((sum, p) => sum + parseFloat(p.receivedAmount?.toString() || "0"), 0);
  const prevTotalUnreceived = prevUnreceivedPayments.reduce((sum, p) => sum + parseFloat(p.expectedAmount?.toString() || "0"), 0);

  const toggleCarryForward = (paymentId: string) => {
    const newSet = new Set(selectedCarryForward);
    if (newSet.has(paymentId)) {
      newSet.delete(paymentId);
    } else {
      newSet.add(paymentId);
    }
    setSelectedCarryForward(newSet);
  };

  const toggleAllCarryForward = () => {
    if (selectedCarryForward.size === prevUnreceivedPayments.length) {
      setSelectedCarryForward(new Set());
    } else {
      setSelectedCarryForward(new Set(prevUnreceivedPayments.map(p => p.id)));
    }
  };

  const handleCarryForward = () => {
    if (selectedCarryForward.size === 0) {
      toast({ title: "No Payments Selected", description: "Please select at least one payment to carry forward.", variant: "destructive" });
      return;
    }
    carryForwardMutation.mutate(Array.from(selectedCarryForward));
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Monthly Planning</h1>
          <p className="text-muted-foreground">Plan and manage monthly targets</p>
        </div>
        <div className="flex items-center gap-3">
          {canCreatePayments && (
            <Button 
              variant="outline" 
              onClick={() => setIsBulkGeneratorOpen(true)}
              data-testid="button-generate-from-prev"
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Generate from {prevMonthLabel}
            </Button>
          )}
          {canDeletePayments && payments && payments.length > 0 && (
            <Button 
              variant="outline" 
              onClick={() => setIsDeletePlanOpen(true)}
              className="text-destructive hover:text-destructive"
              data-testid="button-delete-entire-plan"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Entire Plan
            </Button>
          )}
          <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
            <SelectTrigger className="w-36" data-testid="select-plan-month">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(parseInt(v))}>
            <SelectTrigger className="w-24" data-testid="select-plan-year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {canCreatePayments && missingPlanProjects.length > 0 && (
        <div
          className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40"
          data-testid="banner-missing-plan-projects"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900">
              <AlertCircle className="h-4 w-4 text-amber-700 dark:text-amber-300" />
            </div>
            <div>
              <p className="text-sm font-medium text-amber-900 dark:text-amber-200" data-testid="text-missing-plan-count">
                {missingPlanProjects.length} active {missingPlanProjects.length === 1 ? "project is" : "projects are"} missing from {monthLabel}'s plan
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400">
                These projects have no payment this month. Review and add them so nothing is missed.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsBulkGeneratorOpen(true)}
            className="border-amber-400 bg-white text-amber-800 hover:bg-amber-100 dark:bg-transparent dark:text-amber-300 dark:hover:bg-amber-900"
            data-testid="button-review-missing-projects"
          >
            <Plus className="mr-2 h-4 w-4" />
            Review &amp; add
          </Button>
        </div>
      )}

      <div className="grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-br from-card via-card to-primary/5 shadow-sm group hover:shadow-md transition-all duration-300">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -translate-y-8 translate-x-8" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl translate-y-6 -translate-x-6" />
          <div className="relative z-10 p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20">
                <Target className="h-4 w-4 text-primary" />
              </div>
              <p className="text-[10px] font-semibold text-primary uppercase tracking-wider">Monthly Target</p>
            </div>
            <div className="text-3xl font-extrabold text-primary" data-testid="text-targeted-total">
              {formatCurrency(totalTargeted)}
            </div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-1">{targetedPayments.length} payments in {monthLabel}</p>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-br from-card via-card to-green-500/5 shadow-sm group hover:shadow-md transition-all duration-300">
          <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 rounded-full blur-3xl -translate-y-8 translate-x-8" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-green-500/5 rounded-full blur-2xl translate-y-6 -translate-x-6" />
          <div className="relative z-10 p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-500/10 ring-1 ring-green-500/20">
                <DollarSign className="h-4 w-4 text-green-600 dark:text-green-500" />
              </div>
              <p className="text-[10px] font-semibold text-green-600 dark:text-green-500 uppercase tracking-wider">Total Received</p>
            </div>
            <div className="text-3xl font-extrabold text-green-600 dark:text-green-500" data-testid="text-received-total">
              {formatCurrency(totalReceived)}
            </div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-1">{receivedPayments.length} payments received</p>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-br from-card via-card to-blue-500/5 shadow-sm group hover:shadow-md transition-all duration-300">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -translate-y-8 translate-x-8" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl translate-y-6 -translate-x-6" />
          <div className="relative z-10 p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500/10 ring-1 ring-blue-500/20">
                <CheckCircle className="h-4 w-4 text-blue-600 dark:text-blue-500" />
              </div>
              <p className="text-[10px] font-semibold text-blue-600 dark:text-blue-500 uppercase tracking-wider">Confirmed Payments</p>
            </div>
            <div className="text-3xl font-extrabold text-blue-600 dark:text-blue-500" data-testid="text-confirmed-total">
              {formatCurrency(totalConfirmed)}
            </div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-1">{confirmedPayments.length} payments 100% confirmed</p>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-br from-card via-card to-orange-500/5 shadow-sm group hover:shadow-md transition-all duration-300">
          <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full blur-3xl -translate-y-8 translate-x-8" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-orange-500/5 rounded-full blur-2xl translate-y-6 -translate-x-6" />
          <div className="relative z-10 p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-500/10 ring-1 ring-orange-500/20">
                <TrendingUp className="h-4 w-4 text-orange-600 dark:text-orange-500" />
              </div>
              <p className="text-[10px] font-semibold text-orange-600 dark:text-orange-500 uppercase tracking-wider">Total Upsells</p>
            </div>
            <div className="text-3xl font-extrabold text-orange-600 dark:text-orange-500" data-testid="text-upsells-total">
              {formatCurrency(upsellPayments.filter(p => p.status === "received").reduce((sum, p) => sum + parseFloat(p.receivedAmount?.toString() || "0"), 0))}
            </div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-1">{upsellPayments.filter(p => p.status === "received").length} received upsell payments</p>
          </div>
        </div>
      </div>

      <PmLeaderCards 
        leaders={pmLeaders} 
        currentMonth={monthLabel} 
        formatCurrency={formatCurrency} 
      />

      {/* Plan Settings section hidden for now */}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            PM Targets
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {pmTargetsLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : (() => {
            const pmsWithTargets = pmTargets?.filter(pt => parseFloat(pt.targetAmount) > 0) || [];
            const pmsWithoutTargets = pmTargets?.filter(pt => parseFloat(pt.targetAmount) === 0) || [];
            
            // Find top performer by progress percentage
            const topPerformerId = pmsWithTargets.length > 0 
              ? pmsWithTargets.reduce((topId, pm) => {
                  const target = parseFloat(pm.targetAmount) || 0;
                  const received = pm.actualReceived || 0;
                  const progress = target > 0 ? (received / target) * 100 : 0;
                  
                  const topPm = pmsWithTargets.find(p => p.pmId === topId);
                  const topTarget = topPm ? parseFloat(topPm.targetAmount) || 0 : 0;
                  const topReceived = topPm ? topPm.actualReceived || 0 : 0;
                  const topProgress = topTarget > 0 ? (topReceived / topTarget) * 100 : 0;
                  
                  return progress > topProgress ? pm.pmId : topId;
                }, pmsWithTargets[0]?.pmId)
              : null;
            
            return (
              <div className="divide-y">
                {pmsWithTargets.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Project Manager</TableHead>
                        <TableHead className="text-right">Target</TableHead>
                        <TableHead className="text-right">Received</TableHead>
                        <TableHead className="text-right">Remaining</TableHead>
                        <TableHead className="w-32">Progress</TableHead>
                        <TableHead className="text-center">Payments</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pmsWithTargets.map((pmTarget) => {
                        const target = parseFloat(pmTarget.targetAmount) || 0;
                        const received = pmTarget.actualReceived || 0;
                        const remaining = target - received;
                        const progressPercent = target > 0 ? Math.min((received / target) * 100, 100) : 0;
                        const pmName = `${pmTarget.pm.firstName || ""} ${pmTarget.pm.lastName || ""}`.trim() || pmTarget.pm.email || "Unknown";
                        const isTopPerformer = pmTarget.pmId === topPerformerId && pmsWithTargets.length >= 1;
                        return (
                          <TableRow key={pmTarget.pmId} data-testid={`row-pm-target-${pmTarget.pmId}`} className={isTopPerformer ? "bg-amber-50 dark:bg-amber-950/20" : ""}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {isTopPerformer && (
                                  <Trophy className="h-4 w-4 text-amber-500" data-testid={`icon-trophy-${pmTarget.pmId}`} />
                                )}
                                {pmName}
                                {isTopPerformer && (
                                  <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 text-xs">
                                    Top Performer
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(target)}</TableCell>
                            <TableCell className="text-right text-green-600">{formatCurrency(received)}</TableCell>
                            <TableCell className={`text-right ${remaining > 0 ? "text-amber-600" : "text-green-600"}`}>
                              {formatCurrency(remaining)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Progress value={progressPercent} className="w-16" />
                                <span className="text-xs text-muted-foreground w-10 text-right">
                                  {progressPercent.toFixed(0)}%
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">{pmTarget.paymentCount}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="p-6 text-center text-muted-foreground">
                    No targeted payments for PMs this month. Mark payments as targeted in the Recurring Payments section below.
                  </div>
                )}
              </div>
            );
          })()}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-lg">Recurring Payments</CardTitle>
          {canCreatePayments && (
            <Button size="sm" onClick={() => setIsAddPaymentOpen(true)} data-testid="button-add-recurring">
              <Plus className="h-4 w-4 mr-2" />
              Add Payment
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {paymentsLoading || planLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : recurringPayments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">Delivery</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>Phase/Milestone</TableHead>
                  <TableHead className="text-right">Expected</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>100%</TableHead>
                  <TableHead className="text-center">Target</TableHead>
                  {(canEditPayments || canDeletePayments) && <TableHead className="w-24">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {recurringPayments.map((payment) => (
                  <TableRow key={payment.id} data-testid={`row-recurring-${payment.id}`}>
                    <TableCell>
                      {payment.project && (
                        <DeliveryStatusIndicator 
                          projectId={payment.project.id} 
                          currentStatus={(payment.project as any).deliveryStatus} 
                          size="sm"
                        />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {payment.project?.id ? (
                          <button
                            className="hover:underline hover:text-primary transition-colors text-left"
                            onClick={() => { setDetailProjectId(payment.project!.id); setProjectDetailOpen(true); }}
                            data-testid={`link-project-recurring-${payment.id}`}
                          >
                            {payment.project.name}
                          </button>
                        ) : payment.project?.name}
                      </div>
                    </TableCell>
                    <TableCell>{payment.project?.clientName}</TableCell>
                    <TableCell>
                      {payment.project?.region && <RegionBadge region={payment.project.region} />}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{payment.narration || "-"}</TableCell>
                    <TableCell className="text-right">{formatCurrency(payment.expectedAmount)}</TableCell>
                    <TableCell data-testid={`text-due-date-${payment.id}`}>
                      {payment.dueDate ? new Date(payment.dueDate).toLocaleDateString() : "-"}
                    </TableCell>
                    <TableCell><StatusBadge status={payment.status} /></TableCell>
                    <TableCell>
                      <Button
                        variant={(payment as any).isConfirmed ? "default" : "outline"}
                        size="sm"
                        className={`text-xs h-7 px-2 ${(payment as any).isConfirmed ? "bg-blue-600 hover:bg-blue-700" : ""}`}
                        onClick={() => toggleConfirmedMutation.mutate({ id: payment.id, isConfirmed: !(payment as any).isConfirmed })}
                        disabled={toggleConfirmedMutation.isPending}
                        data-testid={`button-confirm-${payment.id}`}
                      >
                        {(payment as any).isConfirmed ? "Confirmed" : "Confirm"}
                      </Button>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={payment.isTarget ?? true}
                        onCheckedChange={(checked) => toggleTargetMutation.mutate({ id: payment.id, isTarget: checked })}
                        data-testid={`switch-target-${payment.id}`}
                      />
                    </TableCell>
                    {(canEditPayments || canDeletePayments) && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {canEditPayments && (
                            <Button variant="ghost" size="icon" onClick={() => openEditPayment(payment)} data-testid={`button-edit-payment-${payment.id}`}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {canDeletePayments && (
                            <Button variant="ghost" size="icon" onClick={() => setDeletePaymentId(payment.id)} data-testid={`button-delete-payment-${payment.id}`}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>No recurring payments for {monthLabel} {selectedYear}.</p>
              <p className="text-sm mt-1">Add recurring payments to track for this month.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {upsellPayments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Upsell Payments</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">Delivery</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>Phase/Milestone</TableHead>
                  <TableHead className="text-right">Expected</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>100%</TableHead>
                  <TableHead className="text-center">Target</TableHead>
                  {(canEditPayments || canDeletePayments) && <TableHead className="w-24">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {upsellPayments.map((payment) => (
                  <TableRow key={payment.id} data-testid={`row-upsell-${payment.id}`}>
                    <TableCell>
                      {payment.project && (
                        <DeliveryStatusIndicator 
                          projectId={payment.project.id} 
                          currentStatus={(payment.project as any).deliveryStatus} 
                          size="sm"
                        />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {payment.project?.id ? (
                          <button
                            className="hover:underline hover:text-primary transition-colors text-left"
                            onClick={() => { setDetailProjectId(payment.project!.id); setProjectDetailOpen(true); }}
                            data-testid={`link-project-upsell-${payment.id}`}
                          >
                            {payment.project.name}
                          </button>
                        ) : payment.project?.name}
                        {(payment as any).isNewUpsell && (
                          <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-xs">New</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{payment.project?.clientName}</TableCell>
                    <TableCell>
                      {payment.project?.region && <RegionBadge region={payment.project.region} />}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{payment.narration || "-"}</TableCell>
                    <TableCell className="text-right">{formatCurrency(payment.expectedAmount)}</TableCell>
                    <TableCell data-testid={`text-upsell-due-date-${payment.id}`}>
                      {payment.dueDate ? new Date(payment.dueDate).toLocaleDateString() : "-"}
                    </TableCell>
                    <TableCell><StatusBadge status={payment.status} /></TableCell>
                    <TableCell>
                      <Button
                        variant={(payment as any).isConfirmed ? "default" : "outline"}
                        size="sm"
                        className={`text-xs h-7 px-2 ${(payment as any).isConfirmed ? "bg-blue-600 hover:bg-blue-700" : ""}`}
                        onClick={() => toggleConfirmedMutation.mutate({ id: payment.id, isConfirmed: !(payment as any).isConfirmed })}
                        disabled={toggleConfirmedMutation.isPending}
                        data-testid={`button-confirm-upsell-${payment.id}`}
                      >
                        {(payment as any).isConfirmed ? "Confirmed" : "Confirm"}
                      </Button>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={(payment as any).isTarget ?? false}
                        onCheckedChange={(checked) => toggleTargetMutation.mutate({ id: payment.id, isTarget: checked })}
                        data-testid={`switch-target-upsell-${payment.id}`}
                      />
                    </TableCell>
                    {(canEditPayments || canDeletePayments) && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {canEditPayments && (
                            <Button variant="ghost" size="icon" onClick={() => openEditPayment(payment)} data-testid={`button-edit-upsell-${payment.id}`}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {canDeletePayments && (
                            <Button variant="ghost" size="icon" onClick={() => setDeletePaymentId(payment.id)} data-testid={`button-delete-upsell-${payment.id}`}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Previous Month's Payments Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5" />
            Previous Month Summary ({prevMonthLabel} {prevMonth.year})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50">
              <Target className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Planned</p>
                <p className="text-xl font-semibold" data-testid="text-prev-planned">{formatCurrency(prevTotalPlanned)}</p>
                <p className="text-xs text-muted-foreground">{prevPlannedPayments.length} payments</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Received</p>
                <p className="text-xl font-semibold text-green-600" data-testid="text-prev-received">{formatCurrency(prevTotalReceived)}</p>
                <p className="text-xs text-muted-foreground">{prevReceivedPayments.length} payments</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Upsells</p>
                <p className="text-xl font-semibold text-blue-600" data-testid="text-prev-upsells">{formatCurrency(prevTotalUpsells)}</p>
                <p className="text-xs text-muted-foreground">{prevUpsellPayments.length} payments</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50">
              <Clock className="h-5 w-5 text-amber-600" />
              <div>
                <p className="text-sm text-muted-foreground">Unreceived</p>
                <p className="text-xl font-semibold text-amber-600" data-testid="text-prev-unreceived">{formatCurrency(prevTotalUnreceived)}</p>
                <p className="text-xs text-muted-foreground">{prevUnreceivedPayments.length} payments</p>
              </div>
            </div>
          </div>

          {/* Unreceived Payments - Carry Forward Section */}
          {prevUnreceivedPayments.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="font-medium">Unreceived Payments from {prevMonthLabel}</h3>
                  <p className="text-sm text-muted-foreground">Select payments to carry forward to {monthLabel} {selectedYear}</p>
                </div>
                <Button 
                  size="sm" 
                  onClick={handleCarryForward} 
                  disabled={selectedCarryForward.size === 0 || carryForwardMutation.isPending || prevPaymentsLoading}
                  data-testid="button-carry-forward"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  {carryForwardMutation.isPending ? "Carrying..." : `Carry Forward (${selectedCarryForward.size})`}
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox 
                        checked={selectedCarryForward.size === prevUnreceivedPayments.length && prevUnreceivedPayments.length > 0}
                        onCheckedChange={toggleAllCarryForward}
                        data-testid="checkbox-select-all-carry"
                      />
                    </TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead className="text-right">Expected</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prevUnreceivedPayments.map((payment) => (
                    <TableRow key={payment.id} data-testid={`row-prev-unreceived-${payment.id}`}>
                      <TableCell>
                        <Checkbox 
                          checked={selectedCarryForward.has(payment.id)}
                          onCheckedChange={() => toggleCarryForward(payment.id)}
                          data-testid={`checkbox-carry-${payment.id}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {payment.project?.id ? (
                          <button
                            className="hover:underline hover:text-primary transition-colors text-left"
                            onClick={() => { setDetailProjectId(payment.project!.id); setProjectDetailOpen(true); }}
                            data-testid={`link-project-carry-${payment.id}`}
                          >
                            {payment.project.name}
                          </button>
                        ) : payment.project?.name}
                      </TableCell>
                      <TableCell>{payment.project?.clientName}</TableCell>
                      <TableCell>
                        {payment.project?.region && <RegionBadge region={payment.project.region} />}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(payment.expectedAmount)}</TableCell>
                      <TableCell><StatusBadge status={payment.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {prevPaymentsLoading && (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          )}

          {!prevPaymentsLoading && previousMonthPayments?.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>No payments found for {prevMonthLabel} {prevMonth.year}.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isAddPaymentOpen} onOpenChange={(open) => { if (!open) resetPaymentForm(); else setIsAddPaymentOpen(true); }}>
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>{editingPayment ? "Edit Payment" : "Add Payment"}</DialogTitle>
            <DialogDescription>{editingPayment ? "Update the payment details." : `Add a payment for ${monthLabel} ${selectedYear}.`}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 overflow-y-auto flex-1">
            <div className="space-y-2">
              <Label>Project *</Label>
              <Popover open={projectSearchOpen} onOpenChange={setProjectSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={projectSearchOpen}
                    className="w-full justify-between font-normal"
                    data-testid="select-payment-project"
                  >
                    {paymentProjectId
                      ? (() => { const p = projects?.find(p => p.id === paymentProjectId); return p ? `${p.name} - ${p.clientName}` : "Select project..."; })()
                      : "Select project..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search projects..." />
                    <CommandList>
                      <CommandEmpty>No project found.</CommandEmpty>
                      <CommandGroup>
                        {projects?.map((p) => (
                          <CommandItem
                            key={p.id}
                            value={`${p.name} ${p.clientName}`}
                            onSelect={() => {
                              setPaymentProjectId(p.id);
                              setProjectSearchOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", paymentProjectId === p.id ? "opacity-100" : "opacity-0")} />
                            {p.name} - {p.clientName}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Amount *</Label>
              <Input
                type="number"
                placeholder="Enter amount"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                data-testid="input-payment-amount"
              />
            </div>
            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2">
                <Label>Payment Type</Label>
                <Select value={paymentType} onValueChange={(v) => setPaymentType(v as "recurring" | "upsell")}>
                  <SelectTrigger data-testid="select-payment-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recurring">Recurring</SelectItem>
                    <SelectItem value="upsell">Upsell</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={paymentStatus} onValueChange={(v) => setPaymentStatus(v as typeof paymentStatus)}>
                  <SelectTrigger className="w-[160px]" data-testid="select-payment-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_targeting">Not Targeting</SelectItem>
                    <SelectItem value="pending_invoice">Pending Invoice</SelectItem>
                    <SelectItem value="invoiced">Invoiced</SelectItem>
                    <SelectItem value="received">Received</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* New Upsell tag - only shown for upsell payments */}
            {paymentType === "upsell" && (
              <div className="flex items-center space-x-2 py-1">
                <Checkbox
                  id="is-new-upsell"
                  checked={isNewUpsell}
                  onCheckedChange={(checked) => setIsNewUpsell(checked === true)}
                  data-testid="checkbox-new-upsell"
                />
                <Label htmlFor="is-new-upsell" className="text-sm font-normal cursor-pointer">
                  Mark as newly locked-in upsell (New)
                </Label>
              </div>
            )}
            
            {/* 100% Confirmed tag - available for all payment types */}
            <div className="flex items-center space-x-2 py-1">
              <Checkbox
                id="is-confirmed"
                checked={isConfirmed}
                onCheckedChange={(checked) => setIsConfirmed(checked === true)}
                data-testid="checkbox-confirmed"
              />
              <Label htmlFor="is-confirmed" className="text-sm font-normal cursor-pointer">
                Mark as 100% Confirmed
              </Label>
            </div>
            
            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={paymentDueDate}
                  onChange={(e) => setPaymentDueDate(e.target.value)}
                  data-testid="input-payment-due-date"
                />
              </div>
              <div className="space-y-2">
                <Label>Probability ({paymentProbability}%)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="range"
                    min="0"
                    max="100"
                    step="10"
                    value={paymentProbability}
                    onChange={(e) => setPaymentProbability(parseInt(e.target.value, 10))}
                    className="flex-1"
                    data-testid="input-payment-probability"
                  />
                  <span className="text-sm text-muted-foreground w-10 text-right">{paymentProbability}%</span>
                </div>
                <p className="text-xs text-muted-foreground">Confidence level for receiving this payment</p>
              </div>
            </div>
            
            {/* For recurring payments, show milestone dropdown; for upsell, show narration */}
            {paymentType === "recurring" && paymentProjectId ? (
              <div className="space-y-2">
                <Label>Milestone</Label>
                <Select 
                  value={selectedMilestoneId} 
                  onValueChange={(v) => {
                    setSelectedMilestoneId(v);
                    // Auto-fill amount from selected milestone
                    const selectedMilestone = projectUnpaidMilestones.find(m => m.id === v);
                    if (selectedMilestone && selectedMilestone.expectedAmount) {
                      setPaymentAmount(selectedMilestone.expectedAmount);
                    }
                  }}
                >
                  <SelectTrigger data-testid="select-payment-milestone">
                    <SelectValue placeholder="Select a milestone (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {projectUnpaidMilestones.length > 0 ? (
                      projectUnpaidMilestones.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name} - {formatCurrency(m.expectedAmount || 0)}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        No unpaid milestones for this project
                      </div>
                    )}
                  </SelectContent>
                </Select>
                {selectedMilestoneId && (
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    className="text-xs"
                    onClick={() => {
                      setSelectedMilestoneId("");
                    }}
                    data-testid="button-clear-milestone"
                  >
                    Clear milestone selection
                  </Button>
                )}
              </div>
            ) : (
              <>
                {/* For upsell payments, link to a Change Request and its installment */}
                {paymentProjectId && (
                  <div className="space-y-2">
                    <Label>Change Request</Label>
                    <Select
                      value={selectedChangeRequestId}
                      onValueChange={(v) => {
                        setSelectedChangeRequestId(v);
                        setSelectedCrInstallmentId("");
                      }}
                    >
                      <SelectTrigger data-testid="select-payment-change-request">
                        <SelectValue placeholder="Select a change request (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        {projectChangeRequests && projectChangeRequests.length > 0 ? (
                          projectChangeRequests.map((cr) => (
                            <SelectItem key={cr.id} value={cr.id}>
                              {cr.title} - {formatCurrency(cr.totalAmount || 0)}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            No change requests for this project
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {paymentProjectId && selectedChangeRequestId && (
                  <div className="space-y-2">
                    <Label>Installment</Label>
                    <Select
                      value={selectedCrInstallmentId}
                      onValueChange={(v) => {
                        setSelectedCrInstallmentId(v);
                        const inst = selectedCrInstallments.find(i => i.id === v);
                        if (inst && inst.expectedAmount) {
                          setPaymentAmount(inst.expectedAmount);
                        }
                      }}
                    >
                      <SelectTrigger data-testid="select-payment-cr-installment">
                        <SelectValue placeholder="Select an installment (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedCrInstallments.length > 0 ? (
                          selectedCrInstallments.map((inst) => (
                            <SelectItem key={inst.id} value={inst.id}>
                              {inst.name} - {formatCurrency(inst.expectedAmount || 0)}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            No unpaid installments for this change request
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                    {selectedCrInstallmentId && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                        onClick={() => setSelectedCrInstallmentId("")}
                        data-testid="button-clear-cr-installment"
                      >
                        Clear installment selection
                      </Button>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Narration</Label>
                  <Input
                    placeholder="Optional description"
                    value={paymentNarration}
                    onChange={(e) => setPaymentNarration(e.target.value)}
                    data-testid="input-payment-narration"
                  />
                </div>
              </>
            )}

            {/* Recent payment history for the selected project */}
            {paymentProjectId && recentPayments && recentPayments.length > 0 && (
              <div className="space-y-2 pt-2 border-t">
                <Label className="flex items-center gap-2 text-muted-foreground">
                  <History className="h-4 w-4" />
                  Recent Payments for This Project
                </Label>
                <div className="space-y-2">
                  {recentPayments.map((rp) => (
                    <div 
                      key={rp.id} 
                      className="text-sm flex justify-between items-center p-2 rounded-md bg-muted/50"
                      data-testid={`recent-payment-${rp.id}`}
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">{formatCurrency(rp.expectedAmount)}</span>
                        <span className="text-xs text-muted-foreground">
                          {rp.milestoneName || rp.narration || `${months.find(m => m.value === rp.month)?.label || ''} ${rp.year}`}
                        </span>
                      </div>
                      <StatusBadge status={rp.status} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="flex-shrink-0">
            <Button variant="outline" onClick={resetPaymentForm}>Cancel</Button>
            <Button onClick={handleSubmitPayment} disabled={createPaymentMutation.isPending || updatePaymentMutation.isPending} data-testid="button-submit-payment">
              {(createPaymentMutation.isPending || updatePaymentMutation.isPending) ? "Saving..." : (editingPayment ? "Update Payment" : "Add Payment")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletePaymentId} onOpenChange={() => setDeletePaymentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this payment? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletePaymentId && deletePaymentMutation.mutate(deletePaymentId)} className="bg-destructive text-destructive-foreground" data-testid="button-confirm-delete-payment">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isDeletePlanOpen} onOpenChange={setIsDeletePlanOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Entire Monthly Plan</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete all {payments?.length || 0} payments for {monthLabel} {selectedYear}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteEntirePlanMutation.mutate()} 
              className="bg-destructive text-destructive-foreground" 
              disabled={deleteEntirePlanMutation.isPending}
              data-testid="button-confirm-delete-plan"
            >
              {deleteEntirePlanMutation.isPending ? "Deleting..." : "Delete All Payments"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BulkPlanGenerator
        open={isBulkGeneratorOpen}
        onOpenChange={setIsBulkGeneratorOpen}
        targetMonth={selectedMonth}
        targetYear={selectedYear}
        previousMonthPayments={previousMonthPayments || []}
        prevMonthLabel={prevMonthLabel}
        prevYear={prevMonth.year}
      />

      <ProjectDetailSheet
        projectId={detailProjectId}
        open={projectDetailOpen}
        onOpenChange={setProjectDetailOpen}
      />
    </div>
  );
}
