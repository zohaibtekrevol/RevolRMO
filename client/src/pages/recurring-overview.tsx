import { useState, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toPng } from "html-to-image";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarView } from "@/pages/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { RegionBadge } from "@/components/region-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { 
  Calendar, 
  CheckCircle, 
  Clock, 
  FileText, 
  AlertCircle,
  DollarSign,
  Target,
  ArrowUpRight,
  RefreshCw,
  ChevronDown,
  Sparkles,
  Trophy,
  PartyPopper,
  BadgeCheck,
  CircleDot,
  FileDown,
  ReceiptText,
  Mail,
  Search,
  CalendarIcon,
  Wallet,
  MessageSquare,
  Camera,
  Pencil,
  Trash2,
  Loader2,
  Plus,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { generateInvoicePDF, generateInvoicePDFBase64, invoiceFileName } from "@shared/invoice-generator";
import { MilestoneSyncDialog } from "@/components/milestone-sync-dialog";
import { ProjectWorkspacePanel } from "@/components/project-workspace-panel";
import type { DashboardStats, PaymentWithProject, PaymentStatus, RegionBankingDetails, PaymentCommentWithUser, ProjectWithPM, ProjectMilestone } from "@shared/schema";
import { SearchableCombobox } from "@/components/searchable-combobox";

type CommentSummary = Record<string, { count: number; latest: PaymentCommentWithUser | null }>;

function getInitials(user: { firstName?: string | null; lastName?: string | null; email?: string | null } | null | undefined) {
  if (!user) return "?";
  const f = (user.firstName || "").charAt(0);
  const l = (user.lastName || "").charAt(0);
  const initials = `${f}${l}`.trim();
  if (initials) return initials.toUpperCase();
  return (user.email || "?").charAt(0).toUpperCase();
}

function getDisplayName(user: { firstName?: string | null; lastName?: string | null; email?: string | null } | null | undefined) {
  if (!user) return "Unknown";
  const name = `${user.firstName || ""} ${user.lastName || ""}`.trim();
  return name || user.email || "Unknown";
}

function CommentsCell({
  payment,
  summary,
  screenshotMode,
}: {
  payment: PaymentWithProject;
  summary: CommentSummary;
  screenshotMode: boolean;
}) {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  const summaryEntry = summary[payment.id];
  const count = summaryEntry?.count ?? 0;
  const latest = summaryEntry?.latest ?? null;

  const isAdmin = currentUser?.role === "admin";

  const { data: comments, isLoading } = useQuery<PaymentCommentWithUser[]>({
    queryKey: ["/api/payments", payment.id, "comments"],
    queryFn: async () => {
      const res = await fetch(`/api/payments/${payment.id}/comments`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch comments");
      return res.json();
    },
    enabled: open,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/payments", payment.id, "comments"] });
    queryClient.invalidateQueries({ queryKey: ["/api/payment-comments/summary"] });
  };

  const createMut = useMutation({
    mutationFn: async (text: string) => {
      const res = await apiRequest("POST", `/api/payments/${payment.id}/comments`, { comment: text });
      return res.json();
    },
    onSuccess: () => {
      setNewComment("");
      invalidate();
    },
    onError: () => toast({ title: "Error", description: "Failed to post comment", variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, text }: { id: string; text: string }) => {
      const res = await apiRequest("PATCH", `/api/payment-comments/${id}`, { comment: text });
      return res.json();
    },
    onSuccess: () => {
      setEditingId(null);
      setEditingText("");
      invalidate();
    },
    onError: () => toast({ title: "Error", description: "Failed to update comment", variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/payment-comments/${id}`);
    },
    onSuccess: () => invalidate(),
    onError: () => toast({ title: "Error", description: "Failed to delete comment", variant: "destructive" }),
  });

  if (screenshotMode) {
    if (!latest) {
      return <span className="text-xs text-muted-foreground">—</span>;
    }
    const extra = Math.max(0, count - 1);
    return (
      <div className="text-xs space-y-0.5 max-w-[260px]">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-foreground">{getDisplayName(latest.user)}</span>
          <span className="text-muted-foreground">· {formatDistanceToNow(new Date(latest.createdAt), { addSuffix: true })}</span>
          {extra > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">+{extra} more</span>
          )}
        </div>
        <div className="text-foreground whitespace-pre-wrap break-words">{latest.comment}</div>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 gap-1.5"
          data-testid={`button-comments-${payment.id}`}
        >
          <MessageSquare className={`h-4 w-4 ${count > 0 ? "text-primary" : "text-muted-foreground"}`} />
          <span className={`text-xs font-medium ${count > 0 ? "text-primary" : "text-muted-foreground"}`}>
            {count}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="px-4 py-3 border-b">
          <div className="text-sm font-semibold">Comments</div>
          <div className="text-xs text-muted-foreground truncate">{payment.project?.name}</div>
        </div>
        <ScrollArea className="max-h-72">
          <div className="px-4 py-3 space-y-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : comments && comments.length > 0 ? (
              comments.map(c => {
                const canManage = isAdmin || c.userId === currentUser?.id;
                const isEditing = editingId === c.id;
                return (
                  <div key={c.id} className="flex gap-2" data-testid={`comment-${c.id}`}>
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarImage src={c.user?.profileImageUrl || undefined} />
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">{getInitials(c.user)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-semibold">{getDisplayName(c.user)}</span>
                        <span className="text-muted-foreground">{formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}</span>
                        {canManage && !isEditing && (
                          <div className="ml-auto flex items-center gap-0.5">
                            {c.userId === currentUser?.id && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => { setEditingId(c.id); setEditingText(c.comment); }}
                                data-testid={`button-edit-comment-${c.id}`}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                            )}
                            {(c.userId === currentUser?.id || isAdmin) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-destructive hover:text-destructive"
                                onClick={() => deleteMut.mutate(c.id)}
                                disabled={deleteMut.isPending}
                                data-testid={`button-delete-comment-${c.id}`}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                      {isEditing ? (
                        <div className="mt-1 space-y-1.5">
                          <Textarea
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            rows={2}
                            className="text-sm"
                            data-testid={`textarea-edit-comment-${c.id}`}
                          />
                          <div className="flex gap-1.5">
                            <Button
                              size="sm"
                              className="h-7"
                              onClick={() => updateMut.mutate({ id: c.id, text: editingText.trim() })}
                              disabled={!editingText.trim() || updateMut.isPending}
                              data-testid={`button-save-comment-${c.id}`}
                            >
                              Save
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7" onClick={() => { setEditingId(null); setEditingText(""); }}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm mt-0.5 whitespace-pre-wrap break-words">{c.comment}</div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-sm text-muted-foreground text-center py-4">No comments yet.</div>
            )}
          </div>
        </ScrollArea>
        <div className="px-4 py-3 border-t space-y-2">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment for the team..."
            rows={2}
            className="text-sm"
            data-testid={`textarea-new-comment-${payment.id}`}
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => createMut.mutate(newComment.trim())}
              disabled={!newComment.trim() || createMut.isPending}
              data-testid={`button-post-comment-${payment.id}`}
            >
              {createMut.isPending ? "Posting..." : "Post Comment"}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

const statusOptions = [
  { value: "received", label: "Received" },
  { value: "invoiced", label: "Invoiced" },
  { value: "pending_invoice", label: "Pending" },
  { value: "not_targeting", label: "Not Targeting" },
];

const paymentTypeOptions = [
  { value: "recurring", label: "Recurring" },
  { value: "upsell", label: "Upsell" },
];

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

const currentYear = new Date().getFullYear();
const EARLIEST_YEAR = 2023;
const years = Array.from(
  { length: currentYear + 1 - EARLIEST_YEAR + 1 },
  (_, i) => EARLIEST_YEAR + i
)
  .map(y => ({ value: String(y), label: String(y) }))
  .reverse();

const avatarPalettes = [
  "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
  "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  "bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300",
  "bg-pink-100 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
  "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300",
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300",
];

function getAvatarPalette(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return avatarPalettes[hash % avatarPalettes.length];
}

function getStatusBadge(status: string) {
  switch (status) {
    case "received":
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-400 dark:border-green-800">
          <CheckCircle className="h-3 w-3 mr-1" />
          Received
        </Badge>
      );
    case "invoiced":
      return (
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800">
          <FileText className="h-3 w-3 mr-1" />
          Invoiced
        </Badge>
      );
    case "pending_invoice":
      return (
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      );
    case "not_targeting":
      return (
        <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-900/50 dark:text-gray-400 dark:border-gray-700">
          <AlertCircle className="h-3 w-3 mr-1" />
          Not Targeting
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function RecurringOverview() {
  const { toast } = useToast();
  const now = new Date();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const viewParam = new URLSearchParams(search).get("view");

  const { data: viewerPermissions } = useQuery<import("@shared/schema").SystemPermission[]>({
    queryKey: ["/api/access/my-permissions"],
  });
  const canViewCalendar = viewerPermissions?.includes("view_calendar") ?? false;
  const canEditProjectsWorkspace = viewerPermissions?.includes("edit_projects") ?? false;
  const canCreatePaymentsWorkspace = viewerPermissions?.includes("create_payments") ?? false;
  const canEditPaymentsWorkspace = viewerPermissions?.includes("edit_payments") ?? false;
  const canDeletePaymentsWorkspace = viewerPermissions?.includes("delete_payments") ?? false;
  const activeTab = viewParam === "calendar" && canViewCalendar ? "calendar" : "table";

  const [expandedPayments, setExpandedPayments] = useState<Set<string>>(new Set());
  const togglePaymentExpand = (id: string) => {
    setExpandedPayments(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const [workspaceProjectId, setWorkspaceProjectId] = useState<string | null>(null);
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [workspaceAutoAddPayment, setWorkspaceAutoAddPayment] = useState(false);
  const openWorkspace = (projectId: string | null | undefined) => {
    if (!projectId) return;
    setWorkspaceProjectId(projectId);
    setIsWorkspaceOpen(true);
  };

  const { data: allProjects } = useQuery<ProjectWithPM[]>({
    queryKey: ["/api/projects"],
    enabled: canCreatePaymentsWorkspace,
  });
  const [isPickProjectOpen, setIsPickProjectOpen] = useState(false);
  const [pickedProjectId, setPickedProjectId] = useState("");
  const projectOptions = (allProjects || [])
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => ({ value: p.id, label: p.name }));
  const handleAddPaymentForProject = () => {
    if (!pickedProjectId) return;
    setWorkspaceProjectId(pickedProjectId);
    setWorkspaceAutoAddPayment(true);
    setIsWorkspaceOpen(true);
    setIsPickProjectOpen(false);
  };

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(search);
    if (value === "calendar") {
      params.set("view", "calendar");
    } else {
      params.delete("view");
    }
    const query = params.toString();
    setLocation(`/recurring-overview${query ? `?${query}` : ""}`);
  };
  const [selectedMonth, setSelectedMonth] = useState(String(now.getMonth() + 1));
  const [selectedYear, setSelectedYear] = useState(String(now.getFullYear()));
  
  // Table filters
  const [filterStatuses, setFilterStatuses] = useState<Set<string>>(new Set());
  const [filterRegion, setFilterRegion] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterTarget, setFilterTarget] = useState<string>("all");
  const [filterPM, setFilterPM] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  
  // Status editing
  const [editingPayment, setEditingPayment] = useState<PaymentWithProject | null>(null);
  const [isReceivedDialogOpen, setIsReceivedDialogOpen] = useState(false);
  const [receivedAmount, setReceivedAmount] = useState("");
  const [pendingStatusChange, setPendingStatusChange] = useState<{ payment: PaymentWithProject; newStatus: PaymentStatus } | null>(null);
  const [isClearReceivedDialogOpen, setIsClearReceivedDialogOpen] = useState(false);
  
  const [milestoneSyncData, setMilestoneSyncData] = useState<{ autoLinked: boolean; milestone?: any; availableMilestones?: any[] } | null>(null);
  const [milestoneSyncPaymentId, setMilestoneSyncPaymentId] = useState<string>("");

  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
  const [invoicePayment, setInvoicePayment] = useState<PaymentWithProject | null>(null);

  // Edit payment dialog
  const [isEditPaymentOpen, setIsEditPaymentOpen] = useState(false);
  const [paymentToEdit, setPaymentToEdit] = useState<PaymentWithProject | null>(null);
  const [editForm, setEditForm] = useState({
    expectedAmount: "",
    paymentType: "recurring" as "recurring" | "upsell",
    status: "pending_invoice" as PaymentStatus,
    narration: "",
    dueDate: "",
    milestoneId: "",
  });

  // Delete payment confirmation
  const [paymentToDelete, setPaymentToDelete] = useState<PaymentWithProject | null>(null);

  type UnpaidMilestone = ProjectMilestone & { projectName: string; clientName: string };
  const { data: unpaidMilestones } = useQuery<UnpaidMilestone[]>({
    queryKey: ["/api/milestones/unpaid"],
    queryFn: async () => {
      const res = await fetch("/api/milestones/unpaid", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch unpaid milestones");
      return res.json();
    },
    enabled: isEditPaymentOpen,
  });

  // Milestones available for the payment being edited: the project's unpaid milestones,
  // plus the currently-linked milestone (which may no longer be "unpaid") so it still shows.
  const editMilestoneOptions = (() => {
    if (!paymentToEdit) return [] as { id: string; name: string }[];
    const projectMs = (unpaidMilestones || []).filter(m => m.projectId === paymentToEdit.projectId);
    const list = projectMs.map(m => ({ id: m.id, name: m.name }));
    const linkedId = (paymentToEdit as any).milestoneId as string | null;
    if (linkedId && !list.some(m => m.id === linkedId)) {
      const linkedName = (paymentToEdit as any).milestoneName || paymentToEdit.narration || "Current milestone";
      list.unshift({ id: linkedId, name: linkedName });
    }
    return list;
  })();

  // Screenshot capture
  const [screenshotMode, setScreenshotMode] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const tableCardRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const [isReceiptMode, setIsReceiptMode] = useState(false);
  const [isDownloadingReceipt, setIsDownloadingReceipt] = useState(false);
  const [invoiceDetails, setInvoiceDetails] = useState({
    invoiceNumber: "",
    invoiceDate: format(new Date(), "yyyy-MM-dd"),
    description: "",
    notes: "",
    conversionRate: "3.67",
  });
  
  const toggleStatus = (status: string) => {
    const newSet = new Set(filterStatuses);
    if (newSet.has(status)) {
      newSet.delete(status);
    } else {
      newSet.add(status);
    }
    setFilterStatuses(newSet);
  };
  
  const clearStatusFilters = () => {
    setFilterStatuses(new Set());
  };
  
  const monthNum = parseInt(selectedMonth);
  const yearNum = parseInt(selectedYear);
  
  // Status update mutation
  const updateStatusMutation = useMutation({
    mutationFn: async (data: { id: string; status: PaymentStatus; receivedAmount?: string; clearReceivedAmount?: boolean }) => {
      const payload: Record<string, unknown> = { status: data.status };
      if (data.status === "received") {
        payload.receivedDate = new Date().toISOString().split('T')[0];
        if (data.receivedAmount) {
          payload.receivedAmount = data.receivedAmount;
        }
      } else if (data.clearReceivedAmount) {
        payload.receivedAmount = "0";
        payload.receivedDate = null;
      }
      const response = await apiRequest("PATCH", `/api/payments/${data.id}`, payload);
      return response.json();
    },
    onSuccess: (data: any, variables: { id: string; status: PaymentStatus; receivedAmount?: string; clearReceivedAmount?: boolean }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/milestones"] });
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && (key.startsWith("/api/projects") || key.startsWith("/api/forecasting"));
        },
      });
      toast({ title: "Status updated", description: "Payment status has been updated successfully" });
      if (data?.milestoneSyncSuggestion) {
        setMilestoneSyncData(data.milestoneSyncSuggestion);
        setMilestoneSyncPaymentId(variables.id);
      }
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update payment status", variant: "destructive" });
    },
  });

  const sendReminderMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const response = await apiRequest("POST", `/api/payments/${paymentId}/send-reminder`);
      return response.json();
    },
    onSuccess: (data: any) => {
      const reminderTypeLabels: Record<string, string> = {
        soft_reminder: "friendly reminder",
        due_soon: "due soon reminder",
        overdue: "overdue notice",
        final_warning: "final warning",
      };
      const typeLabel = reminderTypeLabels[data.reminderType] || "reminder";
      toast({
        title: "Reminder Sent",
        description: `A ${typeLabel} email has been sent to the client.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Send Reminder",
        description: error?.message || "Could not send the payment reminder.",
        variant: "destructive",
      });
    },
  });

  const sendReceiptMutation = useMutation({
    mutationFn: async (vars: { paymentId: string; pdfBase64?: string; fileName?: string }) => {
      const response = await apiRequest("POST", `/api/payments/${vars.paymentId}/send-receipt`, {
        pdfBase64: vars.pdfBase64,
        fileName: vars.fileName,
      });
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Receipt Sent",
        description: data.message || "Payment receipt confirmation has been sent to the client.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Send Receipt",
        description: error?.message || "Could not send the payment receipt.",
        variant: "destructive",
      });
    },
  });

  const [sendingReceiptId, setSendingReceiptId] = useState<string | null>(null);

  const handleSendReceipt = async (payment: PaymentWithProject) => {
    const region = payment.project?.region;
    const banking = bankingDetails?.find((b) => b.region === region);

    if (!banking) {
      toast({
        title: "Banking details not configured",
        description: `Please configure banking details for region ${region} in Settings before sending receipts.`,
        variant: "destructive",
      });
      return;
    }

    setSendingReceiptId(payment.id);
    try {
      // Mirror the receipt prefill logic so the emailed PDF matches the downloaded one
      let receiptNumber = `INV-${format(new Date(), "yyyyMMdd")}-${payment.id.slice(0, 8).toUpperCase()}`;
      let receiptDate = payment.receivedDate
        ? format(new Date(payment.receivedDate), "yyyy-MM-dd")
        : format(new Date(), "yyyy-MM-dd");
      let receiptNotes = "";

      try {
        const response = await apiRequest("GET", `/api/payments/${payment.id}/invoice`);
        const linkedInvoice = await response.json();
        if (linkedInvoice?.invoiceNumber) {
          receiptNumber = linkedInvoice.invoiceNumber;
          if (linkedInvoice.issueDate) {
            receiptDate = format(new Date(linkedInvoice.issueDate), "yyyy-MM-dd");
          }
          if (linkedInvoice.notes) {
            receiptNotes = linkedInvoice.notes;
          }
        }
      } catch {
        // No linked invoice - fall back to generated defaults
      }

      const pdfBase64 = generateInvoicePDFBase64({
        payment,
        banking,
        invoiceNumber: receiptNumber,
        invoiceDate: receiptDate,
        description: payment.narration || `${payment.project?.name} - ${payment.project?.phase || "Services"}`,
        notes: receiptNotes,
        conversionRate: 3.67,
        isReceipt: true,
        receivedDate: payment.receivedDate,
      });

      sendReceiptMutation.mutate({
        paymentId: payment.id,
        pdfBase64,
        fileName: invoiceFileName({ invoiceNumber: receiptNumber, isReceipt: true }),
      });
    } catch (error) {
      console.error("Error generating receipt PDF for email:", error);
      toast({
        title: "Failed to Send Receipt",
        description: "Could not generate the receipt PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSendingReceiptId(null);
    }
  };

  const updateDueDateMutation = useMutation({
    mutationFn: async (data: { id: string; dueDate: string }) => {
      const response = await apiRequest("PATCH", `/api/payments/${data.id}`, {
        dueDate: data.dueDate,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Due date updated", description: "The payment due date has been updated successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update due date", variant: "destructive" });
    },
  });

  const handleDueDateChange = (paymentId: string, newDate: Date | undefined) => {
    if (!newDate) return;
    const dateString = format(newDate, "yyyy-MM-dd");
    updateDueDateMutation.mutate({ id: paymentId, dueDate: dateString });
  };

  const openEditPayment = (payment: PaymentWithProject) => {
    setPaymentToEdit(payment);
    setEditForm({
      expectedAmount: payment.expectedAmount?.toString() || "",
      paymentType: (payment.paymentType as "recurring" | "upsell") || "recurring",
      status: payment.status as PaymentStatus,
      narration: payment.narration || "",
      dueDate: payment.dueDate ? new Date(payment.dueDate).toISOString().split("T")[0] : "",
      milestoneId: (payment as any).milestoneId || "",
    });
    setIsEditPaymentOpen(true);
  };

  const editPaymentMutation = useMutation({
    mutationFn: async (data: {
      id: string;
      expectedAmount: string;
      paymentType: string;
      status: PaymentStatus;
      narration: string;
      dueDate: string | null;
      milestoneId: string | null;
      changeRequestId: string | null;
      crInstallmentId: string | null;
    }) => {
      const { id, ...payload } = data;
      const response = await apiRequest("PATCH", `/api/payments/${id}`, payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/milestones/unpaid"] });
      setIsEditPaymentOpen(false);
      setPaymentToEdit(null);
      toast({ title: "Payment updated", description: "The payment record has been updated successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update payment.", variant: "destructive" });
    },
  });

  const handleSaveEdit = () => {
    if (!paymentToEdit) return;
    if (!editForm.expectedAmount || parseFloat(editForm.expectedAmount) <= 0) {
      toast({ title: "Invalid amount", description: "Please enter a valid amount.", variant: "destructive" });
      return;
    }
    const isRecurring = editForm.paymentType === "recurring";
    const originalMilestoneId = (paymentToEdit as any).milestoneId || null;
    const milestoneId = isRecurring && editForm.milestoneId ? editForm.milestoneId : null;
    const milestoneChanged = milestoneId !== originalMilestoneId;

    // Only auto-update narration when the milestone changed AND the existing narration
    // was empty or still matched the previously linked milestone's name. This preserves
    // any narration the user customised manually.
    let narration = editForm.narration;
    if (isRecurring && milestoneId && milestoneChanged) {
      const chosen = editMilestoneOptions.find(m => m.id === milestoneId);
      const originalName = editMilestoneOptions.find(m => m.id === originalMilestoneId)?.name;
      const narrationMatchedOld = !narration.trim() || (!!originalName && narration === originalName);
      if (chosen && narrationMatchedOld) {
        narration = chosen.name;
      }
    }

    // Keep linkage fields coherent with the chosen type: recurring payments link to a
    // milestone (and must not keep upsell CR links); upsell payments keep their existing
    // CR links (this dialog doesn't edit them) and must not keep a milestone link.
    const changeRequestId = isRecurring ? null : ((paymentToEdit as any).changeRequestId || null);
    const crInstallmentId = isRecurring ? null : ((paymentToEdit as any).crInstallmentId || null);

    editPaymentMutation.mutate({
      id: paymentToEdit.id,
      expectedAmount: editForm.expectedAmount,
      paymentType: editForm.paymentType,
      status: editForm.status,
      narration,
      dueDate: editForm.dueDate || null,
      milestoneId,
      changeRequestId,
      crInstallmentId,
    });
  };

  const deletePaymentMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/payments/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/milestones/unpaid"] });
      setPaymentToDelete(null);
      toast({ title: "Payment deleted", description: "The payment record has been removed." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete payment.", variant: "destructive" });
    },
  });
  
  const handleStatusChange = (payment: PaymentWithProject, newStatus: PaymentStatus) => {
    if (newStatus === payment.status) return;
    if (newStatus === "received") {
      setEditingPayment(payment);
      const currentReceived = payment.receivedAmount ? parseFloat(String(payment.receivedAmount)) : 0;
      const expected = payment.expectedAmount ? parseFloat(String(payment.expectedAmount)) : 0;
      setReceivedAmount(currentReceived > 0 ? String(currentReceived) : String(expected));
      setIsReceivedDialogOpen(true);
    } else if (
      payment.status === "received" &&
      payment.receivedAmount &&
      parseFloat(String(payment.receivedAmount)) > 0
    ) {
      setPendingStatusChange({ payment, newStatus });
      setIsClearReceivedDialogOpen(true);
    } else {
      updateStatusMutation.mutate({ id: payment.id, status: newStatus });
    }
  };

  const handleKeepReceivedAmount = () => {
    if (!pendingStatusChange) return;
    updateStatusMutation.mutate({
      id: pendingStatusChange.payment.id,
      status: pendingStatusChange.newStatus,
    });
    setIsClearReceivedDialogOpen(false);
    setPendingStatusChange(null);
  };

  const handleResetReceivedAmount = () => {
    if (!pendingStatusChange) return;
    updateStatusMutation.mutate({
      id: pendingStatusChange.payment.id,
      status: pendingStatusChange.newStatus,
      clearReceivedAmount: true,
    });
    setIsClearReceivedDialogOpen(false);
    setPendingStatusChange(null);
  };

  const handleCancelStatusChange = () => {
    setIsClearReceivedDialogOpen(false);
    setPendingStatusChange(null);
  };
  
  const handleConfirmReceived = () => {
    if (!editingPayment) return;
    const amount = parseFloat(receivedAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Invalid amount", description: "Please enter a valid amount", variant: "destructive" });
      return;
    }
    updateStatusMutation.mutate({
      id: editingPayment.id,
      status: "received",
      receivedAmount: amount.toString(),
    });
    setIsReceivedDialogOpen(false);
    setEditingPayment(null);
    setReceivedAmount("");
  };
  
  const handleCancelReceived = () => {
    setIsReceivedDialogOpen(false);
    setEditingPayment(null);
    setReceivedAmount("");
  };
  const monthName = months.find(m => m.value === selectedMonth)?.label || "";

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats", { month: monthNum, year: yearNum }],
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/stats?month=${monthNum}&year=${yearNum}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch stats");
      return response.json();
    },
  });

  const { data: payments, isLoading: paymentsLoading } = useQuery<PaymentWithProject[]>({
    queryKey: ["/api/payments", { month: monthNum, year: yearNum }],
    queryFn: async () => {
      const response = await fetch(`/api/payments?month=${monthNum}&year=${yearNum}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch payments");
      return response.json();
    },
  });

  const { data: bankingDetails } = useQuery<RegionBankingDetails[]>({
    queryKey: ["/api/settings/banking"],
  });

  const paymentIds = (payments || []).map(p => p.id);
  const paymentIdsKey = paymentIds.join(",");
  const { data: commentSummary } = useQuery<CommentSummary>({
    queryKey: ["/api/payment-comments/summary", paymentIdsKey],
    queryFn: async () => {
      if (!paymentIdsKey) return {};
      const res = await fetch(`/api/payment-comments/summary?paymentIds=${encodeURIComponent(paymentIdsKey)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch comment summary");
      return res.json();
    },
    enabled: paymentIds.length > 0,
  });
  const summary: CommentSummary = commentSummary || {};

  const handleCaptureScreenshot = async () => {
    if (!tableCardRef.current) return;
    setCapturing(true);
    setScreenshotMode(true);

    const card = tableCardRef.current;
    const scroller = tableScrollRef.current;
    const prevCardWidth = card.style.width;
    const prevScrollOverflow = scroller?.style.overflow;
    const prevScrollWidth = scroller?.style.width;

    try {
      // Wait for re-render with inline comments
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);

      // Expand the horizontally-scrolling wrapper so the full table is captured
      let fullWidth = card.scrollWidth;
      if (scroller) {
        scroller.style.overflow = "visible";
        scroller.style.width = "max-content";
        await new Promise(requestAnimationFrame);
        fullWidth = Math.max(fullWidth, scroller.scrollWidth, scroller.offsetWidth);
        card.style.width = `${fullWidth}px`;
        await new Promise(requestAnimationFrame);
      }
      const fullHeight = card.scrollHeight;

      const dataUrl = await toPng(card, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: getComputedStyle(document.body).backgroundColor || "#ffffff",
        width: fullWidth,
        height: fullHeight,
        style: { width: `${fullWidth}px`, height: `${fullHeight}px` },
      });
      const link = document.createElement("a");
      const stamp = format(new Date(), "yyyyMMdd-HHmmss");
      link.download = `recurring-overview-${monthName.toLowerCase()}-${selectedYear}-${stamp}.png`;
      link.href = dataUrl;
      link.click();
      toast({ title: "Screenshot saved", description: "Payment table has been downloaded as PNG." });
    } catch (err) {
      console.error("Screenshot failed", err);
      toast({ title: "Screenshot failed", description: "Could not capture the table.", variant: "destructive" });
    } finally {
      card.style.width = prevCardWidth;
      if (scroller) {
        scroller.style.overflow = prevScrollOverflow ?? "";
        scroller.style.width = prevScrollWidth ?? "";
      }
      setScreenshotMode(false);
      setCapturing(false);
    }
  };

  const handleGenerateInvoice = (payment: PaymentWithProject) => {
    setIsReceiptMode(false);
    setInvoicePayment(payment);
    setInvoiceDetails({
      invoiceNumber: `INV-${format(new Date(), "yyyyMMdd")}-${payment.id.slice(0, 8).toUpperCase()}`,
      invoiceDate: format(new Date(), "yyyy-MM-dd"),
      description: payment.narration || `${payment.project?.name} - ${payment.project?.phase || "Services"}`,
      notes: "",
      conversionRate: "3.67",
    });
    setIsInvoiceDialogOpen(true);
  };

  const handleGenerateReceipt = async (payment: PaymentWithProject) => {
    setIsReceiptMode(true);
    setInvoicePayment(payment);

    // Defaults (used when no linked invoice exists yet)
    let receiptNumber = `INV-${format(new Date(), "yyyyMMdd")}-${payment.id.slice(0, 8).toUpperCase()}`;
    let receiptDate = payment.receivedDate
      ? format(new Date(payment.receivedDate), "yyyy-MM-dd")
      : format(new Date(), "yyyy-MM-dd");
    let receiptNotes = "";

    // Prefill from the linked invoice when one exists so the receipt matches it
    try {
      const response = await apiRequest("GET", `/api/payments/${payment.id}/invoice`);
      const linkedInvoice = await response.json();
      if (linkedInvoice?.invoiceNumber) {
        receiptNumber = linkedInvoice.invoiceNumber;
        if (linkedInvoice.issueDate) {
          receiptDate = format(new Date(linkedInvoice.issueDate), "yyyy-MM-dd");
        }
        if (linkedInvoice.notes) {
          receiptNotes = linkedInvoice.notes;
        }
      }
    } catch {
      // No linked invoice (404) or fetch failure - fall back to generated defaults
    }

    setInvoiceDetails({
      invoiceNumber: receiptNumber,
      invoiceDate: receiptDate,
      description: payment.narration || `${payment.project?.name} - ${payment.project?.phase || "Services"}`,
      notes: receiptNotes,
      conversionRate: "3.67",
    });
    setIsInvoiceDialogOpen(true);
  };

  const handleDownloadReceipt = async () => {
    if (!invoicePayment) return;

    const region = invoicePayment.project?.region;
    const banking = bankingDetails?.find((b) => b.region === region);

    if (!banking) {
      toast({
        title: "Banking details not configured",
        description: `Please configure banking details for region ${region} in Settings before generating receipts.`,
        variant: "destructive",
      });
      return;
    }

    setIsDownloadingReceipt(true);
    try {
      // Safety net: ensure the linked invoice (if any) is marked paid. Best-effort.
      try {
        await apiRequest("POST", `/api/payments/${invoicePayment.id}/mark-invoice-paid`);
        queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
        queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      } catch (syncError) {
        console.error("Could not confirm linked invoice as paid:", syncError);
      }

      const parsedRate = parseFloat(invoiceDetails.conversionRate);
      generateInvoicePDF({
        payment: invoicePayment,
        banking,
        invoiceNumber: invoiceDetails.invoiceNumber,
        invoiceDate: invoiceDetails.invoiceDate,
        description: invoiceDetails.description,
        notes: invoiceDetails.notes,
        conversionRate: !isNaN(parsedRate) && parsedRate > 0 ? parsedRate : undefined,
        isReceipt: true,
        receivedDate: invoicePayment.receivedDate,
      });

      setIsInvoiceDialogOpen(false);
      toast({
        title: "Receipt downloaded",
        description: `Payment receipt for ${invoiceDetails.invoiceNumber} has been downloaded.`,
      });
    } catch (error) {
      console.error("Error generating receipt:", error);
      toast({
        title: "Error",
        description: "Failed to generate receipt. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDownloadingReceipt(false);
    }
  };

  const handleDownloadInvoice = async () => {
    if (!invoicePayment) return;
    
    const region = invoicePayment.project?.region;
    const banking = bankingDetails?.find((b) => b.region === region);
    
    if (!banking) {
      toast({
        title: "Banking details not configured",
        description: `Please configure banking details for region ${region} in Settings before generating invoices.`,
        variant: "destructive",
      });
      return;
    }
    
    // Create invoice record in database (links to payment) before generating PDF
    try {
      await apiRequest("POST", "/api/invoices/from-payment", {
        paymentId: invoicePayment.id,
        invoiceNumber: invoiceDetails.invoiceNumber,
        invoiceDate: invoiceDetails.invoiceDate,
        description: invoiceDetails.description,
        notes: invoiceDetails.notes,
      });
      
      // Invalidate caches so changes appear in both modules
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      
      // Only generate PDF after successful save
      const parsedRate = parseFloat(invoiceDetails.conversionRate);
      generateInvoicePDF({
        payment: invoicePayment,
        banking,
        invoiceNumber: invoiceDetails.invoiceNumber,
        invoiceDate: invoiceDetails.invoiceDate,
        description: invoiceDetails.description,
        notes: invoiceDetails.notes,
        conversionRate: !isNaN(parsedRate) && parsedRate > 0 ? parsedRate : undefined,
      });
      
      setIsInvoiceDialogOpen(false);
      toast({
        title: "Invoice generated",
        description: `Invoice ${invoiceDetails.invoiceNumber} has been downloaded and saved to Invoices.`,
      });
    } catch (error) {
      console.error("Error creating invoice record:", error);
      toast({
        title: "Error",
        description: "Failed to save invoice. Please try again.",
        variant: "destructive",
      });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Calculate regional breakdown
  const regions = ["CA", "TX", "AE"] as const;
  const regionData = regions.map(region => {
    const regionPayments = payments?.filter(p => p.project?.region === region) || [];
    // Target should only sum recurring payments marked as isTarget
    const target = regionPayments
      .filter(p => p.paymentType === "recurring" && p.isTarget === true)
      .reduce((sum, p) => sum + Number(p.expectedAmount || 0), 0);
    const received = regionPayments
      .filter(p => p.status === "received")
      .reduce((sum, p) => sum + Number(p.receivedAmount || 0), 0);
    // Expected: only recurring payments with pending_invoice or invoiced status that are also in target
    const expected = regionPayments
      .filter(p => p.paymentType === "recurring" && p.isTarget === true && (p.status === "pending_invoice" || p.status === "invoiced"))
      .reduce((sum, p) => sum + Number(p.expectedAmount || 0), 0);
    // Upsells: sum of receivedAmount for upsell payments with status "received"
    const upsells = regionPayments
      .filter(p => p.paymentType === "upsell" && p.status === "received")
      .reduce((sum, p) => sum + Number(p.receivedAmount || 0), 0);
    
    const remaining = target - received;
    return { region, target, received, expected, remaining, upsells, count: regionPayments.length };
  });

  // Calculate totals
  const totals = {
    target: regionData.reduce((sum, r) => sum + r.target, 0),
    received: regionData.reduce((sum, r) => sum + r.received, 0),
    expected: regionData.reduce((sum, r) => sum + r.expected, 0),
    remaining: regionData.reduce((sum, r) => sum + r.remaining, 0),
    upsells: regionData.reduce((sum, r) => sum + r.upsells, 0),
    count: payments?.length || 0,
  };

  const receivedPercent = totals.target > 0 ? ((totals.received / totals.target) * 100).toFixed(1) : "0";
  const expectedPercent = totals.target > 0 ? ((totals.expected / totals.target) * 100).toFixed(1) : "0";
  const remainingPercent = totals.target > 0 ? ((totals.remaining / totals.target) * 100).toFixed(1) : "0";

  // Target achieved: total received has reached (or passed) a non-zero target.
  const targetAchieved = totals.target > 0 && totals.received >= totals.target;

  // Days left in the displayed month, relative to today. For the current month
  // we count from today to the end of the month; for a future month the whole
  // month is still ahead; for a past month we don't show a countdown (null).
  const todayDate = new Date();
  const isCurrentMonth =
    todayDate.getFullYear() === yearNum && todayDate.getMonth() + 1 === monthNum;
  const isFutureMonth =
    yearNum > todayDate.getFullYear() ||
    (yearNum === todayDate.getFullYear() && monthNum > todayDate.getMonth() + 1);
  const lastDayOfMonth = new Date(yearNum, monthNum, 0).getDate();
  let daysLeftInMonth: number | null = null;
  if (isCurrentMonth) {
    daysLeftInMonth = lastDayOfMonth - todayDate.getDate();
  } else if (isFutureMonth) {
    daysLeftInMonth = lastDayOfMonth;
  }
  const daysLeftLabel =
    daysLeftInMonth === null
      ? null
      : `${Math.max(0, daysLeftInMonth)} ${Math.max(0, daysLeftInMonth) === 1 ? "day" : "days"} left this month`;

  // Count by status
  const statusCounts = {
    received: payments?.filter(p => p.status === "received").length || 0,
    invoiced: payments?.filter(p => p.status === "invoiced").length || 0,
    pending: payments?.filter(p => p.status === "pending_invoice").length || 0,
    notTargeting: payments?.filter(p => p.status === "not_targeting").length || 0,
  };

  // Extract unique PMs from payments for filter dropdown
  const uniquePMs = (payments || []).reduce((acc, p) => {
    if (p.pm?.id && !acc.find(pm => pm.id === p.pm?.id)) {
      acc.push({
        id: p.pm.id,
        name: `${p.pm.firstName || ""} ${p.pm.lastName || ""}`.trim() || p.pm.email || "Unknown PM",
      });
    }
    return acc;
  }, [] as { id: string; name: string }[]).sort((a, b) => a.name.localeCompare(b.name));

  // Filter payments for table
  // Status priority for sorting: received first, then invoiced, pending_invoice, not_targeting last
  const statusPriority: Record<string, number> = {
    received: 1,
    invoiced: 2,
    pending_invoice: 3,
    not_targeting: 4,
  };

  const filteredPayments = (payments || []).filter(p => {
    // Search filter by project name
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      const projectName = p.project?.name?.toLowerCase() || "";
      if (!projectName.includes(query)) return false;
    }
    // Multi-select status filter: if no statuses selected, show all; otherwise filter
    if (filterStatuses.size > 0 && !filterStatuses.has(p.status)) return false;
    if (filterRegion !== "all" && p.project?.region !== filterRegion) return false;
    if (filterType !== "all" && p.paymentType !== filterType) return false;
    if (filterTarget === "targeted" && !p.isTarget) return false;
    if (filterTarget === "not_targeted" && p.isTarget) return false;
    if (filterPM !== "all" && p.pm?.id !== filterPM) return false;
    return true;
  }).sort((a, b) => {
    // Primary sort by status priority
    const priorityA = statusPriority[a.status] ?? 5;
    const priorityB = statusPriority[b.status] ?? 5;
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    // Secondary sort by due date (earliest first)
    const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    return dateA - dateB;
  });

  // Calculate filtered totals for table footer
  const filteredTotals = {
    count: filteredPayments.length,
    expectedAmount: filteredPayments.reduce((sum, p) => sum + Number(p.expectedAmount || 0), 0),
    receivedAmount: filteredPayments.filter(p => p.status === "received").reduce((sum, p) => sum + Number(p.receivedAmount || 0), 0),
  };

  if (statsLoading || paymentsLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 bg-background min-h-screen">
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="mb-4">
          <TabsTrigger value="table" data-testid="tab-recurring-table">Table</TabsTrigger>
          {canViewCalendar && (
            <TabsTrigger value="calendar" data-testid="tab-recurring-calendar">Calendar</TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="table" className="space-y-6 mt-0">
      {/* Modern Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/5 via-card to-primary/10 border border-primary/10 p-6 lg:p-8">
        <div className="absolute top-0 right-0 w-72 h-72 bg-primary/10 rounded-full blur-3xl -translate-y-32 translate-x-32" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-green-500/10 rounded-full blur-3xl translate-y-24 -translate-x-24" />
        
        <div className="relative z-10">
          {/* Title and Date Selector Row */}
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight mb-1">Recurring Overview</h1>
              <p className="text-muted-foreground">Financial snapshot for {monthName} {selectedYear}</p>
            </div>
            <div className="flex items-center gap-2 bg-background/80 backdrop-blur-sm rounded-lg p-1.5 border border-border/50">
              <Calendar className="h-4 w-4 text-muted-foreground ml-2" />
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-32 border-0 bg-transparent shadow-none" data-testid="select-month">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-20 border-0 bg-transparent shadow-none" data-testid="select-year">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map(y => (
                    <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Target Achieved Banner */}
          {targetAchieved && (
            <div
              className="group relative mb-6 overflow-hidden rounded-2xl p-[1.5px] shadow-lg shadow-emerald-500/20 animate-in fade-in slide-in-from-top-2 duration-500"
              data-testid="banner-target-achieved"
            >
              {/* Animated gradient border */}
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 via-teal-400 to-green-500 opacity-90" />
              <div className="relative flex flex-wrap items-center gap-4 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-green-50 px-5 py-4 dark:from-emerald-950/80 dark:via-teal-950/70 dark:to-green-950/80">
                {/* Shimmer sweep */}
                <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent group-hover:translate-x-full transition-transform duration-1000 ease-out dark:via-white/10" />

                <div className="relative shrink-0">
                  <div className="absolute inset-0 rounded-full bg-emerald-400/40 blur-md animate-pulse" />
                  <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-green-600 shadow-md shadow-emerald-500/40">
                    <Trophy className="h-6 w-6 text-white" />
                  </div>
                </div>

                <div className="relative flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-extrabold tracking-tight text-emerald-800 dark:text-emerald-200" data-testid="text-target-achieved">
                      Target Achieved!
                    </p>
                    <PartyPopper className="h-5 w-5 text-amber-500 animate-bounce" />
                  </div>
                  <p className="text-sm font-medium text-emerald-700/90 dark:text-emerald-300/90">
                    Outstanding work, team — you crushed this month's goal.
                    {daysLeftLabel && (
                      <span className="text-emerald-600/80 dark:text-emerald-400/80" data-testid="text-days-left"> {daysLeftLabel}</span>
                    )}
                  </p>
                </div>

                <div className="relative shrink-0 flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 shadow-sm ring-1 ring-emerald-500/20 dark:bg-emerald-900/50">
                  <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300" data-testid="text-target-percent">
                    {receivedPercent}% of target
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Key Metrics Row */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <div className="bg-background/60 backdrop-blur-sm rounded-xl p-4 border border-border/30">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Target className="h-4 w-4 text-primary" />
                </div>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Target</span>
              </div>
              <p className="text-2xl font-bold text-primary" data-testid="text-total-target">{formatCurrency(totals.target)}</p>
            </div>
            
            <div className="bg-background/60 backdrop-blur-sm rounded-xl p-4 border border-border/30">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </div>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Received</span>
              </div>
              <p className="text-2xl font-bold text-green-600 dark:text-green-500" data-testid="text-total-received">{formatCurrency(totals.received)}</p>
              <p className="text-xs text-green-600/70 mt-0.5">{receivedPercent}% of target</p>
            </div>
            
            <div className="bg-background/60 backdrop-blur-sm rounded-xl p-4 border border-border/30">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-amber-600" />
                </div>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Expected</span>
              </div>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-500" data-testid="text-total-expected">{formatCurrency(totals.expected)}</p>
              <p className="text-xs text-amber-600/70 mt-0.5">{expectedPercent}% of target</p>
            </div>

            <div className="bg-background/60 backdrop-blur-sm rounded-xl p-4 border border-border/30">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <Wallet className="h-4 w-4 text-blue-600" />
                </div>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Remaining</span>
              </div>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-500" data-testid="text-total-remaining">{formatCurrency(totals.remaining)}</p>
              <p className="text-xs text-blue-600/70 mt-0.5">{remainingPercent}% of target</p>
            </div>
            
            <div className="bg-background/60 backdrop-blur-sm rounded-xl p-4 border border-border/30">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-full bg-orange-500/10 flex items-center justify-center">
                  <ArrowUpRight className="h-4 w-4 text-orange-600" />
                </div>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Upsells</span>
              </div>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-500" data-testid="text-total-upsells">{formatCurrency(totals.upsells)}</p>
            </div>
          </div>

          {/* Regional Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {regionData.map(r => (
              <div 
                key={r.region} 
                className="bg-background/60 backdrop-blur-sm rounded-xl p-4 border border-border/30 hover:border-border transition-colors"
                data-testid={`card-region-${r.region}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <RegionBadge region={r.region} />
                    <span className="text-sm font-medium">{r.region === "CA" ? "California" : r.region === "TX" ? "Texas" : "UAE"}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">{r.count} payments</Badge>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Target</p>
                    <p className="font-semibold" data-testid={`text-target-${r.region}`}>{formatCurrency(r.target)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Received</p>
                    <p className="font-semibold text-green-600 dark:text-green-500" data-testid={`text-received-${r.region}`}>{formatCurrency(r.received)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Remaining</p>
                    <p className="font-semibold text-blue-600 dark:text-blue-500" data-testid={`text-remaining-${r.region}`}>{formatCurrency(r.remaining)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Upsells</p>
                    <p className="font-semibold text-orange-600 dark:text-orange-500" data-testid={`text-upsells-${r.region}`}>{formatCurrency(r.upsells)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Status Summary Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-muted/30 border border-border/50">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Payment Status Overview</span>
        </div>
        <div className="flex flex-wrap items-center gap-4" data-testid="text-status-counts">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-sm"><span className="font-semibold">{statusCounts.received}</span> received</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-blue-500" />
            <span className="text-sm"><span className="font-semibold">{statusCounts.invoiced}</span> invoiced</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-amber-500" />
            <span className="text-sm"><span className="font-semibold">{statusCounts.pending}</span> pending</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-gray-400" />
            <span className="text-sm"><span className="font-semibold">{statusCounts.notTargeting}</span> not targeting</span>
          </div>
        </div>
      </div>

      {/* Payments Table */}
      <Card ref={tableCardRef}>
        <CardHeader className="py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <CardTitle className="text-lg flex items-center gap-2">
              Payments - {monthName} {selectedYear}
              {filteredPayments.length !== totals.count ? (
                <Badge variant="secondary" className="ml-2">{filteredPayments.length} / {totals.count}</Badge>
              ) : (
                <Badge variant="secondary" className="ml-2">{totals.count} total</Badge>
              )}
            </CardTitle>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search project..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-48"
                  data-testid="input-search-project"
                />
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-40 justify-between" data-testid="button-filter-status">
                    <span className="truncate">
                      {filterStatuses.size === 0 
                        ? "All Statuses" 
                        : filterStatuses.size === 1
                          ? statusOptions.find(s => filterStatuses.has(s.value))?.label
                          : `${filterStatuses.size} selected`
                      }
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-2" align="start">
                  <div className="space-y-1">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-full justify-start font-normal"
                      onClick={clearStatusFilters}
                      data-testid="button-clear-status-filters"
                    >
                      All Statuses
                    </Button>
                    <div className="border-t my-1" />
                    {statusOptions.map(option => (
                      <label 
                        key={option.value} 
                        className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer"
                        data-testid={`checkbox-filter-status-${option.value}`}
                      >
                        <Checkbox 
                          checked={filterStatuses.has(option.value)} 
                          onCheckedChange={() => toggleStatus(option.value)}
                        />
                        <span className="text-sm">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              <Select value={filterRegion} onValueChange={setFilterRegion}>
                <SelectTrigger className="w-32" data-testid="select-filter-region">
                  <SelectValue placeholder="Region" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Regions</SelectItem>
                  <SelectItem value="CA">CA</SelectItem>
                  <SelectItem value="TX">TX</SelectItem>
                  <SelectItem value="AE">AE</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-32" data-testid="select-filter-type">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="recurring">Recurring</SelectItem>
                  <SelectItem value="upsell">Upsell</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterTarget} onValueChange={setFilterTarget}>
                <SelectTrigger className="w-36" data-testid="select-filter-target">
                  <SelectValue placeholder="Target" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Payments</SelectItem>
                  <SelectItem value="targeted">Targeted</SelectItem>
                  <SelectItem value="not_targeted">Non-Targeted</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterPM} onValueChange={setFilterPM}>
                <SelectTrigger className="w-40" data-testid="select-filter-pm">
                  <SelectValue placeholder="Project Manager" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All PMs</SelectItem>
                  {uniquePMs.map(pm => (
                    <SelectItem key={pm.id} value={pm.id}>{pm.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={handleCaptureScreenshot}
                disabled={capturing || filteredPayments.length === 0}
                data-testid="button-capture-screenshot"
              >
                {capturing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Camera className="h-4 w-4 mr-2" />}
                Capture Screenshot
              </Button>
              {canCreatePaymentsWorkspace && (
                <Button
                  onClick={() => { setPickedProjectId(""); setIsPickProjectOpen(true); }}
                  data-testid="button-add-payment-any-project"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Payment
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Mobile card view (< md) */}
          <div className="block md:hidden p-4 space-y-3">
            {filteredPayments.length > 0 ? filteredPayments.map((payment, index) => {
              const isExpanded = expandedPayments.has(payment.id);
              return (
                <div key={payment.id} className="rounded-lg border bg-card shadow-sm" data-testid={`card-payment-${payment.id}`}>
                  <div className="flex items-start justify-between gap-2 p-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs text-muted-foreground">#{index + 1}</span>
                        {payment.project?.region && <RegionBadge region={payment.project.region} className="rounded-full px-2.5" />}
                      </div>
                      <button
                        type="button"
                        onClick={() => openWorkspace(payment.projectId)}
                        disabled={!payment.projectId}
                        className="text-left font-semibold text-sm text-foreground leading-tight hover:text-primary hover:underline disabled:cursor-default"
                      >
                        {payment.project?.name || "Unknown"}
                      </button>
                      {payment.narration && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{payment.narration}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="text-base font-bold">{formatCurrency(Number(payment.expectedAmount))}</span>
                        <div className="shrink-0">
                          <Select
                            value={payment.status}
                            onValueChange={(value) => handleStatusChange(payment, value as PaymentStatus)}
                          >
                            <SelectTrigger className="h-7 text-xs w-auto" data-testid={`select-status-${payment.id}`}>
                              <SelectValue>{getStatusBadge(payment.status)}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {statusOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {getStatusBadge(option.value)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <div className="flex gap-0.5">
                        {payment.status === "received" && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleGenerateInvoice(payment)} data-testid={`button-invoice-${payment.id}`}>
                            <FileDown className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => payment.status === "received" ? handleGenerateReceipt(payment) : handleGenerateInvoice(payment)}>
                          {payment.status === "received" ? <ReceiptText className="h-4 w-4 text-green-600" /> : <FileDown className="h-4 w-4" />}
                        </Button>
                        {payment.status === "received" ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleSendReceipt(payment)}
                            disabled={sendReceiptMutation.isPending || sendingReceiptId === payment.id}
                            data-testid={`button-send-receipt-${payment.id}`}
                          >
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => sendReminderMutation.mutate(payment.id)}
                            disabled={sendReminderMutation.isPending}
                            data-testid={`button-send-reminder-${payment.id}`}
                          >
                            <Mail className="h-4 w-4" />
                          </Button>
                        )}
                        {canEditPaymentsWorkspace && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditPayment(payment)} data-testid={`button-edit-${payment.id}`}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => togglePaymentExpand(payment.id)}
                        data-testid={`button-expand-payment-${payment.id}`}
                      >
                        {isExpanded ? <ChevronDown className="h-4 w-4 rotate-180" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="border-t px-4 py-3 space-y-2 text-sm bg-muted/30">
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Received</span>
                        <span className="font-medium">{formatCurrency(Number(payment.receivedAmount || 0))}</span>
                      </div>
                      <div className="flex justify-between gap-2 items-center">
                        <span className="text-muted-foreground">Due Date</span>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs font-normal" data-testid={`button-duedate-${payment.id}`}>
                              <CalendarIcon className="mr-1 h-3 w-3 text-muted-foreground" />
                              {payment.dueDate ? format(new Date(payment.dueDate), "MMM d, yyyy") : "Set date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="end">
                            <CalendarComponent
                              mode="single"
                              selected={payment.dueDate ? new Date(payment.dueDate) : undefined}
                              onSelect={(date) => handleDueDateChange(payment.id, date)}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="flex justify-between gap-2 items-center">
                        <span className="text-muted-foreground">Type</span>
                        <span>
                          {payment.paymentType === "upsell" ? (
                            <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs font-medium bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-400 dark:border-orange-800">
                              <ArrowUpRight className="h-3 w-3 mr-1" />Upsell
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800">
                              <RefreshCw className="h-3 w-3 mr-1" />Recurring
                            </Badge>
                          )}
                        </span>
                      </div>
                      {payment.pm && (
                        <div className="flex justify-between gap-2 items-center">
                          <span className="text-muted-foreground">PM</span>
                          <span className="font-medium">{`${payment.pm.firstName || ""} ${payment.pm.lastName || ""}`.trim() || "—"}</span>
                        </div>
                      )}
                      <div className="flex justify-between gap-2 items-center">
                        <span className="text-muted-foreground">Notes</span>
                        <CommentsCell payment={payment} summary={summary} screenshotMode={false} />
                      </div>
                      {(payment.isConfirmed || payment.isNewUpsell || payment.isTarget) && (
                        <div className="flex justify-between gap-2 items-center">
                          <span className="text-muted-foreground">Flags</span>
                          <div className="flex items-center gap-1.5">
                            {payment.isTarget && (
                              <div className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary/15">
                                <Target className="h-3.5 w-3.5 text-primary" />
                              </div>
                            )}
                            {payment.isConfirmed && (
                              <div className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-green-100 dark:bg-green-900/30">
                                <BadgeCheck className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                              </div>
                            )}
                            {payment.isNewUpsell && (
                              <div className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-purple-100 dark:bg-purple-900/30">
                                <Sparkles className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      {canDeletePaymentsWorkspace && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full mt-1 text-destructive hover:text-destructive"
                          onClick={() => setPaymentToDelete(payment)}
                          data-testid={`button-delete-${payment.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          Delete Payment
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            }) : (
              <p className="text-center text-muted-foreground py-8">
                {payments && payments.length > 0 
                  ? "No payments match the selected filters."
                  : `No payments for ${monthName} ${selectedYear}.`
                }
              </p>
            )}
          </div>

          {/* Desktop table view (≥ md) */}
          <div className="hidden md:block overflow-x-auto" ref={tableScrollRef}>
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border bg-muted/40 hover:bg-muted/40">
                  <TableHead className="h-12 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-12">#</TableHead>
                  <TableHead className="h-12 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground min-w-[220px]">Project</TableHead>
                  <TableHead className="h-12 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-14 text-center">PM</TableHead>
                  <TableHead className="h-12 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-20">Region</TableHead>
                  <TableHead className="h-12 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-28">Type</TableHead>
                  <TableHead className="h-12 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-center w-16">Target</TableHead>
                  <TableHead className="h-12 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-right w-32">Expected</TableHead>
                  <TableHead className="h-12 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-right w-32">Received</TableHead>
                  <TableHead className="h-12 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground min-w-[140px]">Due Date</TableHead>
                  <TableHead className="h-12 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground min-w-[150px]">Status</TableHead>
                  <TableHead className={`h-12 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground ${screenshotMode ? "min-w-[260px]" : "text-center w-20"}`}>Notes</TableHead>
                  <TableHead className="h-12 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-center w-24">Flags</TableHead>
                  <TableHead className="h-12 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-center w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.length > 0 ? (
                  filteredPayments.map((payment, index) => (
                    <TableRow key={payment.id} className="border-b border-border/60 transition-colors hover:bg-muted/30 [&>td]:py-4" data-testid={`row-payment-${payment.id}`}>
                      <TableCell className="text-sm text-muted-foreground tabular-nums" data-testid={`text-sno-${payment.id}`}>
                        {index + 1}
                      </TableCell>
                      <TableCell data-testid={`text-project-${payment.id}`}>
                        <div className="flex flex-col gap-0.5">
                          <button
                            type="button"
                            onClick={() => openWorkspace(payment.projectId)}
                            disabled={!payment.projectId}
                            className="text-left font-semibold text-foreground leading-tight hover:text-primary hover:underline disabled:cursor-default disabled:no-underline disabled:hover:text-foreground"
                            data-testid={`button-open-workspace-${payment.id}`}
                          >
                            {payment.project?.name || "Unknown"}
                          </button>
                          <span className="text-xs text-muted-foreground leading-tight" data-testid={`text-phase-${payment.id}`}>
                            {payment.narration || "—"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center" data-testid={`text-pm-${payment.id}`}>
                        {payment.pm ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Avatar className="h-8 w-8 cursor-pointer ring-2 ring-background shadow-sm mx-auto">
                                <AvatarImage src={payment.pm.profileImageUrl || undefined} alt={`${payment.pm.firstName || ""} ${payment.pm.lastName || ""}`} />
                                <AvatarFallback className={`text-xs font-semibold ${getAvatarPalette(`${payment.pm.firstName || ""}${payment.pm.lastName || ""}${payment.pm.id || ""}`)}`}>
                                  {(payment.pm.firstName?.charAt(0) || "").toUpperCase()}
                                  {(payment.pm.lastName?.charAt(0) || "").toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-center">
                              <p className="font-medium">{`${payment.pm.firstName || ""} ${payment.pm.lastName || ""}`.trim() || "Unknown"}</p>
                              {payment.pm.email && <p className="text-xs text-muted-foreground">{payment.pm.email}</p>}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-muted-foreground/50">-</span>
                        )}
                      </TableCell>
                      <TableCell data-testid={`text-region-${payment.id}`}>
                        {payment.project?.region && <RegionBadge region={payment.project.region} className="rounded-full px-2.5" />}
                      </TableCell>
                      <TableCell data-testid={`text-type-${payment.id}`}>
                        {payment.paymentType === "upsell" ? (
                          <Badge variant="outline" className="rounded-full px-2.5 py-0.5 font-medium bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-400 dark:border-orange-800">
                            <ArrowUpRight className="h-3 w-3 mr-1" />
                            Upsell
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="rounded-full px-2.5 py-0.5 font-medium bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800">
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Recurring
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center" data-testid={`text-target-${payment.id}`}>
                        {payment.isTarget ? (
                          <Tooltip>
                            <TooltipTrigger>
                              <div className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary/15">
                                <Target className="h-3.5 w-3.5 text-primary" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>In Target</TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-muted-foreground/50">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-foreground" data-testid={`text-amount-${payment.id}`}>
                        {formatCurrency(Number(payment.expectedAmount))}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-foreground" data-testid={`text-received-${payment.id}`}>
                        {formatCurrency(Number(payment.receivedAmount || 0))}
                      </TableCell>
                      <TableCell data-testid={`text-duedate-${payment.id}`}>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-full justify-start text-left font-normal hover-elevate"
                              data-testid={`button-duedate-${payment.id}`}
                            >
                              <CalendarIcon className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                              <span className={payment.dueDate ? "" : "text-muted-foreground"}>
                                {payment.dueDate 
                                  ? format(new Date(payment.dueDate), "MMM d, yyyy")
                                  : "Set date"
                                }
                              </span>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent
                              mode="single"
                              selected={payment.dueDate ? new Date(payment.dueDate) : undefined}
                              onSelect={(date) => handleDueDateChange(payment.id, date)}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </TableCell>
                      <TableCell data-testid={`text-status-${payment.id}`}>
                        <Select
                          value={payment.status}
                          onValueChange={(value) => handleStatusChange(payment, value as PaymentStatus)}
                        >
                          <SelectTrigger className="h-8 w-[160px]" data-testid={`select-status-${payment.id}`}>
                            <SelectValue>{getStatusBadge(payment.status)}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {statusOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {getStatusBadge(option.value)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className={screenshotMode ? "align-top" : "text-center"} data-testid={`cell-comments-${payment.id}`}>
                        <CommentsCell payment={payment} summary={summary} screenshotMode={screenshotMode} />
                      </TableCell>
                      <TableCell className="text-center" data-testid={`text-indicators-${payment.id}`}>
                        <div className="flex items-center justify-center gap-1.5">
                          {payment.isConfirmed && (
                            <Tooltip>
                              <TooltipTrigger>
                                <div className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-green-100 dark:bg-green-900/30">
                                  <BadgeCheck className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>Confirmed</TooltipContent>
                            </Tooltip>
                          )}
                          {payment.isNewUpsell && (
                            <Tooltip>
                              <TooltipTrigger>
                                <div className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-purple-100 dark:bg-purple-900/30">
                                  <Sparkles className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>New Upsell</TooltipContent>
                            </Tooltip>
                          )}
                          {!payment.isConfirmed && !payment.isNewUpsell && (
                            <span className="text-muted-foreground/50">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center" data-testid={`cell-actions-${payment.id}`}>
                        <div className="flex items-center justify-center gap-0.5">
                          {payment.status === "received" && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleGenerateInvoice(payment)}
                                  data-testid={`button-invoice-${payment.id}`}
                                >
                                  <FileDown className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Download Invoice</TooltipContent>
                            </Tooltip>
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              {payment.status === "received" ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleGenerateReceipt(payment)}
                                  data-testid={`button-receipt-${payment.id}`}
                                >
                                  <ReceiptText className="h-4 w-4 text-green-600" />
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleGenerateInvoice(payment)}
                                  data-testid={`button-invoice-${payment.id}`}
                                >
                                  <FileDown className="h-4 w-4" />
                                </Button>
                              )}
                            </TooltipTrigger>
                            <TooltipContent>
                              {payment.status === "received" ? "Download Payment Receipt" : "Generate Invoice"}
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              {payment.status === "received" ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleSendReceipt(payment)}
                                  disabled={sendReceiptMutation.isPending || sendingReceiptId === payment.id}
                                  data-testid={`button-send-receipt-${payment.id}`}
                                >
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => sendReminderMutation.mutate(payment.id)}
                                  disabled={sendReminderMutation.isPending}
                                  data-testid={`button-send-reminder-${payment.id}`}
                                >
                                  <Mail className="h-4 w-4" />
                                </Button>
                              )}
                            </TooltipTrigger>
                            <TooltipContent>
                              {payment.status === "received" ? "Share Payment Receipt" : "Send Reminder to Client"}
                            </TooltipContent>
                          </Tooltip>
                          {canEditPaymentsWorkspace && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openEditPayment(payment)}
                                  data-testid={`button-edit-${payment.id}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit Payment</TooltipContent>
                            </Tooltip>
                          )}
                          {canDeletePaymentsWorkspace && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setPaymentToDelete(payment)}
                                  data-testid={`button-delete-${payment.id}`}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete Payment</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={13} className="text-center py-12 text-muted-foreground">
                      {payments && payments.length > 0 
                        ? "No payments match the selected filters."
                        : `No payments for ${monthName} ${selectedYear}.`
                      }
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              <TableFooter>
                <TableRow className="bg-muted/40 font-semibold hover:bg-muted/40 border-t border-border">
                  <TableCell colSpan={6} className="text-right text-muted-foreground" data-testid="text-total-label">
                    Total ({filteredTotals.count} {filteredTotals.count === 1 ? "payment" : "payments"})
                  </TableCell>
                  <TableCell className="text-right font-bold tabular-nums" data-testid="text-total-amount">
                    {formatCurrency(filteredTotals.expectedAmount)}
                  </TableCell>
                  <TableCell className="text-right font-bold tabular-nums" data-testid="text-total-received">
                    {formatCurrency(filteredTotals.receivedAmount)}
                  </TableCell>
                  <TableCell colSpan={5}></TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isReceivedDialogOpen} onOpenChange={setIsReceivedDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Payment as Received</DialogTitle>
            <DialogDescription>
              Enter the amount received for {editingPayment?.project?.name || "this payment"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="received-amount">Received Amount</Label>
              <Input
                id="received-amount"
                type="number"
                value={receivedAmount}
                onChange={(e) => setReceivedAmount(e.target.value)}
                placeholder="Enter amount received"
                data-testid="input-received-amount"
              />
              <p className="text-xs text-muted-foreground">
                Expected: {formatCurrency(Number(editingPayment?.expectedAmount) || 0)}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelReceived}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmReceived} 
              disabled={updateStatusMutation.isPending || !receivedAmount}
              data-testid="button-confirm-received"
            >
              {updateStatusMutation.isPending ? "Saving..." : "Confirm Received"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isClearReceivedDialogOpen}
        onOpenChange={(open) => {
          if (!open) handleCancelStatusChange();
        }}
      >
        <DialogContent data-testid="dialog-clear-received-amount">
          <DialogHeader>
            <DialogTitle>Keep or reset the received amount?</DialogTitle>
            <DialogDescription>
              {pendingStatusChange ? (
                <>
                  You're changing{" "}
                  <strong>
                    {pendingStatusChange.payment.project?.name || "this payment"}
                  </strong>{" "}
                  from <strong>Received</strong> to{" "}
                  <strong>
                    {statusOptions.find((o) => o.value === pendingStatusChange.newStatus)?.label || pendingStatusChange.newStatus}
                  </strong>
                  . This payment currently shows{" "}
                  <strong>
                    {formatCurrency(Number(pendingStatusChange.payment.receivedAmount) || 0)}
                  </strong>{" "}
                  received. Keep this amount on record, or reset it to $0?
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={handleCancelStatusChange}
              disabled={updateStatusMutation.isPending}
              data-testid="button-cancel-status-change"
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={handleKeepReceivedAmount}
              disabled={updateStatusMutation.isPending}
              data-testid="button-keep-received-amount"
            >
              Keep amount
            </Button>
            <Button
              variant="destructive"
              onClick={handleResetReceivedAmount}
              disabled={updateStatusMutation.isPending}
              data-testid="button-reset-received-amount"
            >
              {updateStatusMutation.isPending ? "Saving..." : "Reset to $0"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isInvoiceDialogOpen} onOpenChange={setIsInvoiceDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{isReceiptMode ? "Download Payment Receipt" : "Generate Invoice"}</DialogTitle>
            <DialogDescription>
              {isReceiptMode
                ? "Review the receipt details before downloading the payment receipt."
                : "Review and customize the invoice details before downloading."}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 py-4 pr-4">
              <div className="p-4 bg-muted/50 rounded-md space-y-2">
                <div className="flex justify-between gap-2">
                  <span className="text-sm text-muted-foreground">Project</span>
                  <span className="text-sm font-medium">{invoicePayment?.project?.name}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-sm text-muted-foreground">Client</span>
                  <span className="text-sm font-medium">{invoicePayment?.project?.clientName}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-sm text-muted-foreground">Region</span>
                  <span className="text-sm font-medium">
                    {invoicePayment?.project?.region && <RegionBadge region={invoicePayment.project.region} />}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-sm text-muted-foreground">Amount</span>
                  <span className="text-sm font-medium">{formatCurrency(Number(invoicePayment?.expectedAmount) || 0)}</span>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="invoice-number">{isReceiptMode ? "Receipt Number" : "Invoice Number"}</Label>
                    <Input
                      id="invoice-number"
                      value={invoiceDetails.invoiceNumber}
                      onChange={(e) => setInvoiceDetails(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                      data-testid="input-invoice-number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invoice-date">{isReceiptMode ? "Receipt Date" : "Invoice Date"}</Label>
                    <Input
                      id="invoice-date"
                      type="date"
                      value={invoiceDetails.invoiceDate}
                      onChange={(e) => setInvoiceDetails(prev => ({ ...prev, invoiceDate: e.target.value }))}
                      data-testid="input-invoice-date"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="invoice-description">Description</Label>
                  <Input
                    id="invoice-description"
                    value={invoiceDetails.description}
                    onChange={(e) => setInvoiceDetails(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Service description"
                    data-testid="input-invoice-description"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="invoice-notes">Additional Notes (Optional)</Label>
                  <Textarea
                    id="invoice-notes"
                    value={invoiceDetails.notes}
                    onChange={(e) => setInvoiceDetails(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Payment terms, special instructions, etc."
                    rows={3}
                    data-testid="input-invoice-notes"
                  />
                </div>

                {invoicePayment?.project?.region === "AE" && (
                  <div className="space-y-2">
                    <Label htmlFor="invoice-conversion-rate">USD → AED Rate</Label>
                    <Input
                      id="invoice-conversion-rate"
                      type="number"
                      min="0"
                      step="0.0001"
                      value={invoiceDetails.conversionRate}
                      onChange={(e) => setInvoiceDetails(prev => ({ ...prev, conversionRate: e.target.value }))}
                      placeholder="3.67"
                      data-testid="input-invoice-conversion-rate"
                    />
                    <p className="text-xs text-muted-foreground">
                      Used to calculate the AED amounts on the invoice. 1 USD = this many AED.
                    </p>
                  </div>
                )}
              </div>

              {invoicePayment?.project?.region && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Banking Details ({invoicePayment.project.region})</Label>
                    {bankingDetails?.find((b) => b.region === invoicePayment.project?.region) ? (
                      <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-md space-y-1">
                        <p>Bank: {bankingDetails.find((b) => b.region === invoicePayment.project?.region)?.bankName}</p>
                        <p>Account: {bankingDetails.find((b) => b.region === invoicePayment.project?.region)?.accountNumber}</p>
                        <p>Currency: {bankingDetails.find((b) => b.region === invoicePayment.project?.region)?.currency || "USD"}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-destructive">
                        Banking details not configured for this region. Please configure them in Admin Settings.
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInvoiceDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={isReceiptMode ? handleDownloadReceipt : handleDownloadInvoice}
              disabled={!invoiceDetails.invoiceNumber || !invoiceDetails.invoiceDate || isDownloadingReceipt}
              data-testid="button-download-invoice"
            >
              {isReceiptMode ? <ReceiptText className="h-4 w-4 mr-2" /> : <FileDown className="h-4 w-4 mr-2" />}
              {isReceiptMode ? "Download Receipt" : "Download PDF"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditPaymentOpen} onOpenChange={(open) => { setIsEditPaymentOpen(open); if (!open) setPaymentToEdit(null); }}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-edit-payment">
          <DialogHeader>
            <DialogTitle>Edit Payment</DialogTitle>
            <DialogDescription>
              {paymentToEdit?.project?.name ? `Update the payment details for ${paymentToEdit.project.name}.` : "Update the payment details."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-amount">Amount</Label>
              <Input
                id="edit-amount"
                type="number"
                step="0.01"
                value={editForm.expectedAmount}
                onChange={(e) => setEditForm(f => ({ ...f, expectedAmount: e.target.value }))}
                data-testid="input-edit-amount"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-type">Type</Label>
              <Select
                value={editForm.paymentType}
                onValueChange={(v) => setEditForm(f => ({ ...f, paymentType: v as "recurring" | "upsell" }))}
              >
                <SelectTrigger id="edit-type" data-testid="select-edit-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {paymentTypeOptions.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {editForm.paymentType === "recurring" && (
              <div className="space-y-2">
                <Label htmlFor="edit-milestone">Milestone</Label>
                <Select
                  value={editForm.milestoneId || "none"}
                  onValueChange={(v) => setEditForm(f => ({ ...f, milestoneId: v === "none" ? "" : v }))}
                >
                  <SelectTrigger id="edit-milestone" data-testid="select-edit-milestone">
                    <SelectValue placeholder="Select milestone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No milestone</SelectItem>
                    {editMilestoneOptions.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select
                value={editForm.status}
                onValueChange={(v) => setEditForm(f => ({ ...f, status: v as PaymentStatus }))}
              >
                <SelectTrigger id="edit-status" data-testid="select-edit-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-due-date">Due Date</Label>
              <Input
                id="edit-due-date"
                type="date"
                value={editForm.dueDate}
                onChange={(e) => setEditForm(f => ({ ...f, dueDate: e.target.value }))}
                data-testid="input-edit-due-date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-narration">Narration</Label>
              <Textarea
                id="edit-narration"
                value={editForm.narration}
                onChange={(e) => setEditForm(f => ({ ...f, narration: e.target.value }))}
                rows={2}
                data-testid="input-edit-narration"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsEditPaymentOpen(false); setPaymentToEdit(null); }} data-testid="button-cancel-edit">
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={editPaymentMutation.isPending} data-testid="button-save-edit">
              {editPaymentMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={paymentToDelete !== null} onOpenChange={(open) => { if (!open) setPaymentToDelete(null); }}>
        <AlertDialogContent data-testid="dialog-delete-payment">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this payment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the payment record{paymentToDelete?.project?.name ? ` for ${paymentToDelete.project.name}` : ""}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (paymentToDelete) deletePaymentMutation.mutate(paymentToDelete.id); }}
              disabled={deletePaymentMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deletePaymentMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MilestoneSyncDialog
        open={milestoneSyncData !== null}
        onOpenChange={(open) => { if (!open) setMilestoneSyncData(null); }}
        syncData={milestoneSyncData}
        paymentId={milestoneSyncPaymentId}
      />

      <ProjectWorkspacePanel
        projectId={workspaceProjectId}
        open={isWorkspaceOpen}
        onOpenChange={setIsWorkspaceOpen}
        month={monthNum}
        year={yearNum}
        payments={payments || []}
        canEditProject={canEditProjectsWorkspace}
        canCreatePayment={canCreatePaymentsWorkspace}
        canEditPayment={canEditPaymentsWorkspace}
        autoOpenAddPayment={workspaceAutoAddPayment}
        onAutoAddPaymentHandled={() => setWorkspaceAutoAddPayment(false)}
      />

      <Dialog open={isPickProjectOpen} onOpenChange={setIsPickProjectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Payment</DialogTitle>
            <DialogDescription>Pick a project to add a payment for. You can choose any project, even ones not in this month's table.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Project</Label>
            <SearchableCombobox
              options={projectOptions}
              value={pickedProjectId}
              onChange={setPickedProjectId}
              placeholder="Select a project"
              searchPlaceholder="Search projects..."
              emptyText="No projects found."
              testId="combobox-add-payment-project"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPickProjectOpen(false)}>Cancel</Button>
            <Button onClick={handleAddPaymentForProject} disabled={!pickedProjectId} data-testid="button-continue-add-payment">
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </TabsContent>
        {canViewCalendar && (
          <TabsContent value="calendar" className="mt-0">
            <CalendarView />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
