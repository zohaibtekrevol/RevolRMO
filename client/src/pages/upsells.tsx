import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, getErrorMessage } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  Filter, 
  X, 
  Search, 
  MoreHorizontal, 
  Pencil, 
  Trash2, 
  DollarSign, 
  TrendingUp, 
  Target, 
  Clock, 
  CheckCircle,
  MessageSquare,
  ArrowRight,
  Calendar,
  Paperclip,
  Link2,
  ShoppingBag,
  Upload,
  FileText,
  Mail,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";
import { DriveFileUploader } from "@/components/DriveFileUploader";
import { TagSelector, TagBadge } from "@/components/tag-selector";
import { usePresence } from "@/hooks/use-presence";
import { ProjectDetailSheet } from "@/components/project-detail-sheet";
import type { UpsellWithDetails, UpsellStatus, User, Project, ProjectWithPM, UpsellTypeSetting, SystemPermission, SoldUpsell, ChangeRequestStatus } from "@shared/schema";

const soldStatusOptions: { value: ChangeRequestStatus; label: string; color: string }[] = [
  { value: "open", label: "Open", color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200" },
  { value: "won", label: "Won", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  { value: "lost", label: "Lost", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
];

function SoldStatusBadge({ status }: { status: string }) {
  const opt = soldStatusOptions.find((s) => s.value === status);
  return (
    <Badge className={`${opt?.color || ""} no-default-hover-elevate no-default-active-elevate`} data-testid={`badge-sold-status-${status}`}>
      {opt?.label || status}
    </Badge>
  );
}

function getInitials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function getAvatarColor(userId: string): string {
  const colors = [
    "bg-blue-500",
    "bg-green-500",
    "bg-purple-500",
    "bg-orange-500",
    "bg-pink-500",
    "bg-teal-500",
    "bg-indigo-500",
    "bg-rose-500",
  ];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function getRoleLabel(role: string): string {
  const roleLabels: Record<string, string> = {
    admin: "Administrator",
    ceo: "CEO",
    cfo: "CFO",
    pm: "Project Manager",
    finance: "Finance",
    viewer: "Viewer",
  };
  return roleLabels[role] || role;
}

const upsellStatusOptions: { value: UpsellStatus; label: string; color: string }[] = [
  { value: "identified", label: "Identified", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  { value: "in_discussion", label: "In Discussion", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  { value: "proposal_sent", label: "Proposal Sent", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  { value: "negotiating", label: "Negotiating", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
  { value: "converted", label: "Converted", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  { value: "lost", label: "Lost", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
];

function UpsellStatusBadge({ status }: { status: UpsellStatus }) {
  const statusOption = upsellStatusOptions.find((s) => s.value === status);
  return (
    <Badge className={`${statusOption?.color || ""} no-default-hover-elevate no-default-active-elevate`}>
      {statusOption?.label || status}
    </Badge>
  );
}

export default function Upsells() {
  const { toast } = useToast();
  
  const [expandedUpsells, setExpandedUpsells] = useState<Set<string>>(new Set());
  const toggleUpsellExpand = (id: string) => {
    setExpandedUpsells(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const [expandedSoldUpsells, setExpandedSoldUpsells] = useState<Set<string>>(new Set());
  const toggleSoldExpand = (id: string) => {
    setExpandedSoldUpsells(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const [filters, setFilters] = useState({
    status: "",
    pmId: "",
    search: "",
  });
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isConvertDialogOpen, setIsConvertDialogOpen] = useState(false);
  const [isActivityDialogOpen, setIsActivityDialogOpen] = useState(false);
  const [selectedUpsell, setSelectedUpsell] = useState<UpsellWithDetails | null>(null);
  
  const [formData, setFormData] = useState({
    projectId: "",
    title: "",
    description: "",
    amount: "",
    probability: "50",
    status: "identified" as UpsellStatus,
    upsellType: "",
    expectedCloseDate: "",
  });

  const [convertData, setConvertData] = useState({
    receivedAmount: "",
    receivedDate: format(new Date(), "yyyy-MM-dd"),
    month: String(new Date().getMonth() + 1),
    year: String(new Date().getFullYear()),
  });

  const [activityData, setActivityData] = useState({
    activityType: "call",
    description: "",
    activityDate: format(new Date(), "yyyy-MM-dd"),
  });

  const queryParams = new URLSearchParams();
  if (filters.status) queryParams.set("status", filters.status);
  if (filters.pmId) queryParams.set("pmId", filters.pmId);

  const { data: upsells, isLoading } = useQuery<UpsellWithDetails[]>({
    queryKey: ["/api/upsells", filters],
    queryFn: async () => {
      const response = await fetch(`/api/upsells?${queryParams.toString()}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch upsells");
      return response.json();
    },
  });

  const { data: userPermissions } = useQuery<SystemPermission[]>({
    queryKey: ["/api/access/my-permissions"],
  });

  const canCreateUpsells = userPermissions?.includes("create_upsells") ?? false;
  const canEditUpsells = userPermissions?.includes("edit_upsells") ?? false;
  const canDeleteUpsells = userPermissions?.includes("delete_upsells") ?? false;
  // Sold upsells are change requests; editing them hits PATCH /api/change-requests/:id,
  // which requires the edit_projects permission on the backend.
  const canEditSold = userPermissions?.includes("edit_projects") ?? false;

  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: projects } = useQuery<ProjectWithPM[]>({
    queryKey: ["/api/projects"],
  });

  const { data: upsellTypeOptions } = useQuery<UpsellTypeSetting[]>({
    queryKey: ["/api/settings/upsell-types"],
  });

  const activeUpsellTypes = upsellTypeOptions?.filter((t) => t.isActive) || [];

  const { data: soldUpsells, isLoading: isLoadingSold } = useQuery<SoldUpsell[]>({
    queryKey: ["/api/sold-upsells"],
  });

  const [soldFilters, setSoldFilters] = useState({ search: "", category: "", pmId: "", projectId: "", dateFrom: "", dateTo: "" });
  const [soldSort, setSoldSort] = useState<{ by: "dateLocked" | "amount" | "received" | "project"; dir: "asc" | "desc" }>({ by: "dateLocked", dir: "desc" });

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isProjectDetailOpen, setIsProjectDetailOpen] = useState(false);

  const { data: currentUser } = useQuery<User>({ queryKey: ["/api/auth/user"] });
  const { activeUsers } = usePresence({ enabled: !!currentUser?.id });

  const [editSold, setEditSold] = useState<SoldUpsell | null>(null);
  const [soldForm, setSoldForm] = useState({
    title: "",
    category: "",
    status: "open" as ChangeRequestStatus,
    whatWasSold: "",
    totalAmount: "",
    dateLocked: "",
    outcome: "",
    pandadocLink: "",
    attachmentName: "",
    attachmentDriveId: "",
    attachmentDriveLink: "",
    tagIds: [] as string[],
  });

  const openEditSold = (s: SoldUpsell) => {
    setEditSold(s);
    setSoldForm({
      title: s.title || "",
      category: s.category || "",
      status: (s.status as ChangeRequestStatus) || "open",
      whatWasSold: s.whatWasSold || "",
      totalAmount: s.totalAmount?.toString() || "",
      dateLocked: s.dateLocked ? new Date(s.dateLocked).toISOString().split("T")[0] : "",
      outcome: s.outcome || "",
      pandadocLink: s.pandadocLink || "",
      attachmentName: s.attachmentName || "",
      attachmentDriveId: s.attachmentDriveId || "",
      attachmentDriveLink: s.attachmentDriveLink || "",
      tagIds: (s.tags || []).map((t) => t.id),
    });
  };

  const createUpsellMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/upsells", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/upsells"] });
      setIsCreateDialogOpen(false);
      resetForm();
      toast({ title: "Upsell created successfully" });
    },
    onError: (error) => {
      toast({ title: "Error", description: getErrorMessage(error, "Failed to create upsell."), variant: "destructive" });
    },
  });

  const updateSoldMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest("PATCH", `/api/change-requests/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sold-upsells"] });
      setEditSold(null);
      toast({ title: "Sold upsell updated" });
    },
    onError: (error) => {
      toast({ title: "Error", description: getErrorMessage(error, "Failed to update sold upsell."), variant: "destructive" });
    },
  });

  const updateUpsellMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest("PATCH", `/api/upsells/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/upsells"] });
      setIsEditDialogOpen(false);
      setSelectedUpsell(null);
      resetForm();
      toast({ title: "Upsell updated successfully" });
    },
    onError: (error) => {
      toast({ title: "Error", description: getErrorMessage(error, "Failed to update upsell."), variant: "destructive" });
    },
  });

  const deleteUpsellMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/upsells/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/upsells"] });
      setIsDeleteDialogOpen(false);
      setSelectedUpsell(null);
      toast({ title: "Upsell deleted successfully" });
    },
    onError: (error) => {
      toast({ title: "Error", description: getErrorMessage(error, "Failed to delete upsell."), variant: "destructive" });
    },
  });

  const convertUpsellMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest("POST", `/api/upsells/${id}/convert`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/upsells"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      setIsConvertDialogOpen(false);
      setSelectedUpsell(null);
      toast({ title: "Upsell converted to payment successfully" });
    },
    onError: (error) => {
      toast({ title: "Error", description: getErrorMessage(error, "Failed to convert upsell."), variant: "destructive" });
    },
  });

  const addActivityMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest("POST", `/api/upsells/${id}/activities`, data);
    },
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/upsells"] });
      setActivityData({ activityType: "call", description: "", activityDate: format(new Date(), "yyyy-MM-dd") });
      toast({ title: "Activity added successfully" });
      
      // Refetch the specific upsell from the server to get updated activities
      try {
        const response = await fetch(`/api/upsells/${variables.id}`, { credentials: "include" });
        if (response.ok) {
          const updatedUpsell = await response.json();
          setSelectedUpsell(updatedUpsell);
        }
      } catch (e) {
        console.error("Failed to refetch upsell:", e);
      }
    },
    onError: (error) => {
      toast({ title: "Error", description: getErrorMessage(error, "Failed to add activity."), variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: UpsellStatus }) => {
      return apiRequest("PATCH", `/api/upsells/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/upsells"] });
      toast({ title: "Status updated" });
    },
    onError: (error) => {
      toast({ title: "Error", description: getErrorMessage(error, "Failed to update status."), variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      projectId: "",
      title: "",
      description: "",
      amount: "",
      probability: "50",
      status: "identified",
      upsellType: activeUpsellTypes[0]?.name || "",
      expectedCloseDate: "",
    });
  };

  const handleEdit = (upsell: UpsellWithDetails) => {
    setSelectedUpsell(upsell);
    setFormData({
      projectId: upsell.projectId,
      title: upsell.title || "",
      description: upsell.description || "",
      amount: upsell.amount,
      probability: String(upsell.probability),
      status: upsell.status,
      upsellType: upsell.upsellType,
      expectedCloseDate: upsell.expectedCloseDate ? format(new Date(upsell.expectedCloseDate), "yyyy-MM-dd") : "",
    });
    setIsEditDialogOpen(true);
  };

  const handleConvert = (upsell: UpsellWithDetails) => {
    setSelectedUpsell(upsell);
    setConvertData({
      receivedAmount: upsell.amount,
      receivedDate: format(new Date(), "yyyy-MM-dd"),
      month: String(new Date().getMonth() + 1),
      year: String(new Date().getFullYear()),
    });
    setIsConvertDialogOpen(true);
  };

  const handleViewActivities = (upsell: UpsellWithDetails) => {
    setSelectedUpsell(upsell);
    setIsActivityDialogOpen(true);
  };

  const handleSubmitCreate = () => {
    if (!formData.projectId || !formData.amount || !formData.upsellType) {
      toast({ title: "Please fill in required fields (Project, Amount, Type)", variant: "destructive" });
      return;
    }
    createUpsellMutation.mutate({
      ...formData,
      probability: parseInt(formData.probability),
      expectedCloseDate: formData.expectedCloseDate ? new Date(formData.expectedCloseDate) : null,
    });
  };

  const handleSubmitEdit = () => {
    if (!selectedUpsell || !formData.projectId || !formData.amount || !formData.upsellType) {
      toast({ title: "Please fill in required fields (Project, Amount, Type)", variant: "destructive" });
      return;
    }
    updateUpsellMutation.mutate({
      id: selectedUpsell.id,
      data: {
        ...formData,
        probability: parseInt(formData.probability),
        expectedCloseDate: formData.expectedCloseDate ? new Date(formData.expectedCloseDate) : null,
      },
    });
  };

  const handleSubmitConvert = () => {
    if (!selectedUpsell) return;
    convertUpsellMutation.mutate({
      id: selectedUpsell.id,
      data: {
        receivedAmount: convertData.receivedAmount,
        receivedDate: convertData.receivedDate,
        month: parseInt(convertData.month),
        year: parseInt(convertData.year),
      },
    });
  };

  const handleSubmitActivity = () => {
    if (!selectedUpsell || !activityData.description) {
      toast({ title: "Please provide activity description", variant: "destructive" });
      return;
    }
    addActivityMutation.mutate({
      id: selectedUpsell.id,
      data: {
        activityType: activityData.activityType,
        description: activityData.description,
        activityDate: new Date(activityData.activityDate),
      },
    });
  };

  const filteredUpsells = upsells?.filter((upsell) => {
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      return (
        (upsell.title?.toLowerCase().includes(searchLower) ?? false) ||
        upsell.project?.name.toLowerCase().includes(searchLower) ||
        upsell.project?.clientName.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  const pms = users?.filter((u) => u.isProjectManager && u.status === "active") || [];

  const soldCategories = Array.from(
    new Set((soldUpsells || []).map((s) => s.category).filter(Boolean) as string[]),
  );

  const filteredSoldUpsells = (soldUpsells || []).filter((s) => {
    if (soldFilters.category && s.category !== soldFilters.category) return false;
    if (soldFilters.pmId && s.project?.pm?.id !== soldFilters.pmId) return false;
    if (soldFilters.projectId && s.project?.id !== soldFilters.projectId) return false;
    if (soldFilters.dateFrom) {
      if (!s.dateLocked || new Date(s.dateLocked) < new Date(soldFilters.dateFrom)) return false;
    }
    if (soldFilters.dateTo) {
      if (!s.dateLocked || new Date(s.dateLocked) > new Date(soldFilters.dateTo + "T23:59:59")) return false;
    }
    if (soldFilters.search) {
      const q = soldFilters.search.toLowerCase();
      return (
        (s.title?.toLowerCase().includes(q) ?? false) ||
        (s.whatWasSold?.toLowerCase().includes(q) ?? false) ||
        (s.project?.name?.toLowerCase().includes(q) ?? false) ||
        (s.project?.clientName?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });

  const sortedSoldUpsells = [...filteredSoldUpsells].sort((a, b) => {
    const dir = soldSort.dir === "asc" ? 1 : -1;
    switch (soldSort.by) {
      case "amount":
        return (parseFloat(a.totalAmount?.toString() || "0") - parseFloat(b.totalAmount?.toString() || "0")) * dir;
      case "received":
        return ((a.receivedAmount || 0) - (b.receivedAmount || 0)) * dir;
      case "project":
        return (a.project?.name || "").localeCompare(b.project?.name || "") * dir;
      case "dateLocked":
      default: {
        const at = a.dateLocked ? new Date(a.dateLocked).getTime() : 0;
        const bt = b.dateLocked ? new Date(b.dateLocked).getTime() : 0;
        return (at - bt) * dir;
      }
    }
  });

  const soldTotalValue = filteredSoldUpsells.reduce((sum, s) => sum + parseFloat(s.totalAmount?.toString() || "0"), 0);
  const soldTotalReceived = filteredSoldUpsells.reduce((sum, s) => sum + (s.receivedAmount || 0), 0);
  const fmtMoney = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const soldCategoryBreakdown = (() => {
    const map = new Map<string, { count: number; value: number; received: number }>();
    for (const s of filteredSoldUpsells) {
      const key = s.category || "Uncategorized";
      const entry = map.get(key) || { count: 0, value: 0, received: 0 };
      entry.count += 1;
      entry.value += parseFloat(s.totalAmount?.toString() || "0");
      entry.received += s.receivedAmount || 0;
      map.set(key, entry);
    }
    return Array.from(map.entries())
      .map(([category, v]) => ({ category, ...v }))
      .sort((a, b) => b.value - a.value);
  })();

  const soldProjects = Array.from(
    new Map((soldUpsells || []).filter((s) => s.project).map((s) => [s.project!.id, s.project!])).values(),
  );

  const totalPipeline = filteredUpsells?.filter((u) => u.status !== "converted" && u.status !== "lost")
    .reduce((sum, u) => sum + parseFloat(u.amount), 0) || 0;
  const weightedPipeline = filteredUpsells?.filter((u) => u.status !== "converted" && u.status !== "lost")
    .reduce((sum, u) => sum + (parseFloat(u.amount) * u.probability / 100), 0) || 0;
  const totalConverted = filteredUpsells?.filter((u) => u.status === "converted")
    .reduce((sum, u) => sum + parseFloat(u.amount), 0) || 0;
  const activeCount = filteredUpsells?.filter((u) => u.status !== "converted" && u.status !== "lost").length || 0;

  return (
    <div className="flex-1 p-4 sm:p-6 overflow-auto">
      <div className="w-full space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Upsell Planning</h1>
            <p className="text-muted-foreground">Track and manage upsell opportunities</p>
          </div>
          {canCreateUpsells && (
            <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-upsell">
              <Plus className="h-4 w-4 mr-2" />
              New Upsell
            </Button>
          )}
        </div>

        <Tabs defaultValue="sold" className="space-y-6">
          <TabsList data-testid="tabs-upsells">
            <TabsTrigger value="pipeline" data-testid="tab-pipeline">
              <Target className="h-4 w-4 mr-2" />
              Pipeline
            </TabsTrigger>
            <TabsTrigger value="sold" data-testid="tab-sold-upsells">
              <ShoppingBag className="h-4 w-4 mr-2" />
              Sold Upsells
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pipeline" className="space-y-6 mt-0">
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Pipeline</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-pipeline">
                ${totalPipeline.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">{activeCount} active opportunities</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Weighted Pipeline</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-weighted-pipeline">
                ${weightedPipeline.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">Based on probability</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Converted Value</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" data-testid="text-converted-value">
                ${totalConverted.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">Successfully converted</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-win-rate">
                {filteredUpsells && filteredUpsells.length > 0
                  ? `${Math.round((filteredUpsells.filter(u => u.status === "converted").length / filteredUpsells.filter(u => u.status === "converted" || u.status === "lost").length) * 100 || 0)}%`
                  : "N/A"}
              </div>
              <p className="text-xs text-muted-foreground">Converted vs Lost</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4 flex-wrap">
            <CardTitle>Upsell Opportunities</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={filters.search}
                  onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                  className="pl-9 w-48"
                  data-testid="input-search"
                />
              </div>
              <Select value={filters.status} onValueChange={(v) => setFilters((f) => ({ ...f, status: v }))}>
                <SelectTrigger className="w-40" data-testid="select-status-filter">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {upsellStatusOptions.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filters.pmId} onValueChange={(v) => setFilters((f) => ({ ...f, pmId: v }))}>
                <SelectTrigger className="w-40" data-testid="select-pm-filter">
                  <SelectValue placeholder="All PMs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All PMs</SelectItem>
                  {pms.map((pm) => (
                    <SelectItem key={pm.id} value={pm.id}>
                      {pm.firstName} {pm.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(filters.status || filters.pmId || filters.search) && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setFilters({ status: "", pmId: "", search: "" })}
                  data-testid="button-clear-filters"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filteredUpsells && filteredUpsells.length > 0 ? (
              <>
                {/* Mobile card view (< md) */}
                <div className="block md:hidden space-y-3">
                  {filteredUpsells.map((upsell) => {
                    const isExpanded = expandedUpsells.has(upsell.id);
                    return (
                      <div key={upsell.id} className="rounded-lg border bg-card shadow-sm" data-testid={`card-upsell-${upsell.id}`}>
                        <div className="flex items-start justify-between gap-2 p-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                              <UpsellStatusBadge status={upsell.status} />
                            </div>
                            <p className="font-semibold text-sm mt-1">{upsell.title}</p>
                            <p className="text-xs text-muted-foreground truncate">{upsell.project?.name} · {upsell.project?.clientName}</p>
                            <p className="text-base font-bold mt-1 font-mono">
                              ${parseFloat(upsell.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {(canEditUpsells || canDeleteUpsells) && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`button-actions-${upsell.id}`}>
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleViewActivities(upsell)}>
                                    <MessageSquare className="h-4 w-4 mr-2" />
                                    View Activities
                                  </DropdownMenuItem>
                                  {canEditUpsells && (
                                    <DropdownMenuItem onClick={() => handleEdit(upsell)}>
                                      <Pencil className="h-4 w-4 mr-2" />
                                      Edit
                                    </DropdownMenuItem>
                                  )}
                                  {canEditUpsells && upsell.status !== "converted" && upsell.status !== "lost" && (
                                    <DropdownMenuItem onClick={() => handleConvert(upsell)}>
                                      <ArrowRight className="h-4 w-4 mr-2" />
                                      Convert to Payment
                                    </DropdownMenuItem>
                                  )}
                                  {canDeleteUpsells && <DropdownMenuSeparator />}
                                  {canDeleteUpsells && (
                                    <DropdownMenuItem
                                      onClick={() => { setSelectedUpsell(upsell); setIsDeleteDialogOpen(true); }}
                                      className="text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => toggleUpsellExpand(upsell.id)}
                              data-testid={`button-expand-upsell-${upsell.id}`}
                            >
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="border-t px-4 py-3 space-y-2 text-sm bg-muted/30">
                            <div className="flex justify-between gap-2 items-center">
                              <span className="text-muted-foreground">Probability</span>
                              <div className="flex items-center gap-2">
                                <Progress value={upsell.probability} className="w-16 h-2" />
                                <span>{upsell.probability}%</span>
                              </div>
                            </div>
                            <div className="flex justify-between gap-2">
                              <span className="text-muted-foreground">Type</span>
                              <span className="font-medium">{upsellTypeOptions?.find((t) => t.name === upsell.upsellType)?.displayName || upsell.upsellType}</span>
                            </div>
                            {upsell.expectedCloseDate && (
                              <div className="flex justify-between gap-2">
                                <span className="text-muted-foreground">Expected Close</span>
                                <span className="font-medium">{format(new Date(upsell.expectedCloseDate), "MMM d, yyyy")}</span>
                              </div>
                            )}
                            {canEditUpsells && (
                              <div className="pt-1">
                                <Select
                                  value={upsell.status}
                                  onValueChange={(value: UpsellStatus) => updateStatusMutation.mutate({ id: upsell.id, status: value })}
                                >
                                  <SelectTrigger className="w-full h-8 text-sm" data-testid={`select-upsell-status-${upsell.id}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {upsellStatusOptions.map((option) => (
                                      <SelectItem key={option.value} value={option.value}>
                                        <span className={`px-2 py-0.5 rounded text-xs ${option.color}`}>
                                          {option.label}
                                        </span>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Desktop table view (≥ md) */}
              <div className="hidden md:block rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Probability</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Expected Close</TableHead>
                      {(canEditUpsells || canDeleteUpsells) && <TableHead className="w-10"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUpsells.map((upsell) => (
                      <TableRow key={upsell.id} data-testid={`row-upsell-${upsell.id}`}>
                        <TableCell className="font-medium">{upsell.title}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{upsell.project?.name}</div>
                            <div className="text-sm text-muted-foreground">{upsell.project?.clientName}</div>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono">
                          ${parseFloat(upsell.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={upsell.probability} className="w-16 h-2" />
                            <span className="text-sm">{upsell.probability}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {canEditUpsells ? (
                            <Select
                              value={upsell.status}
                              onValueChange={(value: UpsellStatus) => updateStatusMutation.mutate({ id: upsell.id, status: value })}
                            >
                              <SelectTrigger className="w-[140px]" data-testid={`select-upsell-status-${upsell.id}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {upsellStatusOptions.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    <span className={`px-2 py-0.5 rounded text-xs ${option.color}`}>
                                      {option.label}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <UpsellStatusBadge status={upsell.status} />
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {upsellTypeOptions?.find((t) => t.name === upsell.upsellType)?.displayName || upsell.upsellType}
                        </TableCell>
                        <TableCell className="text-sm">
                          {upsell.expectedCloseDate ? format(new Date(upsell.expectedCloseDate), "MMM d, yyyy") : "-"}
                        </TableCell>
                        {(canEditUpsells || canDeleteUpsells) && (
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" data-testid={`button-actions-${upsell.id}`}>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleViewActivities(upsell)}>
                                  <MessageSquare className="h-4 w-4 mr-2" />
                                  View Activities
                                </DropdownMenuItem>
                                {canEditUpsells && (
                                  <DropdownMenuItem onClick={() => handleEdit(upsell)}>
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                )}
                                {canEditUpsells && upsell.status !== "converted" && upsell.status !== "lost" && (
                                  <DropdownMenuItem onClick={() => handleConvert(upsell)}>
                                    <ArrowRight className="h-4 w-4 mr-2" />
                                    Convert to Payment
                                  </DropdownMenuItem>
                                )}
                                {canDeleteUpsells && <DropdownMenuSeparator />}
                                {canDeleteUpsells && (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedUpsell(upsell);
                                      setIsDeleteDialogOpen(true);
                                    }}
                                    className="text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              </>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No upsell opportunities found</p>
                <Button variant="outline" className="mt-4" onClick={() => setIsCreateDialogOpen(true)}>
                  Create your first upsell
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="sold" className="space-y-4 mt-0">
            {/* KPI summary row */}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Sold Upsells</CardTitle>
                  <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-sold-count">{filteredSoldUpsells.length}</div>
                  <p className="text-xs text-muted-foreground">Locked change requests</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Value</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-sold-total-value">{fmtMoney(soldTotalValue)}</div>
                  <p className="text-xs text-muted-foreground">Sum of sold amounts</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Received</CardTitle>
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600" data-testid="text-sold-total-received">{fmtMoney(soldTotalReceived)}</div>
                  <p className="text-xs text-muted-foreground">Collected so far</p>
                </CardContent>
              </Card>
            </div>

            {soldCategoryBreakdown.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Breakdown by Category</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Category</TableHead>
                          <TableHead className="text-right">Count</TableHead>
                          <TableHead className="text-right">Total Value</TableHead>
                          <TableHead className="text-right">Received</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {soldCategoryBreakdown.map((b) => (
                          <TableRow key={b.category} data-testid={`row-sold-breakdown-${b.category}`}>
                            <TableCell>
                              <Badge variant="secondary">{b.category}</Badge>
                            </TableCell>
                            <TableCell className="text-right" data-testid={`text-breakdown-count-${b.category}`}>{b.count}</TableCell>
                            <TableCell className="text-right font-mono" data-testid={`text-breakdown-value-${b.category}`}>{fmtMoney(b.value)}</TableCell>
                            <TableCell className="text-right font-mono text-green-600" data-testid={`text-breakdown-received-${b.category}`}>{fmtMoney(b.received)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-4">
                {/* Title row + action buttons */}
                <div className="flex items-center justify-between gap-2 flex-wrap mb-4">
                  <CardTitle>Sold / Completed Upsells</CardTitle>
                  <div className="flex items-center gap-2">
                    {(soldFilters.search || soldFilters.category || soldFilters.pmId || soldFilters.projectId || soldFilters.dateFrom || soldFilters.dateTo) && (
                      <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setSoldFilters({ search: "", category: "", pmId: "", projectId: "", dateFrom: "", dateTo: "" })} data-testid="button-clear-sold-filters">
                        <X className="h-4 w-4" />
                        Clear filters
                      </Button>
                    )}
                    <Link href="/upsells/sold-report">
                      <Button variant="outline" size="sm" className="gap-1.5" data-testid="button-open-sold-report">
                        <FileText className="h-4 w-4" />
                        Open full report
                      </Button>
                    </Link>
                  </div>
                </div>
                {/* Responsive filter bar */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
                  <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-1 xl:col-span-2">
                    <Label htmlFor="sold-search" className="text-xs text-muted-foreground">Search</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        id="sold-search"
                        placeholder="Title, project, client..."
                        value={soldFilters.search}
                        onChange={(e) => setSoldFilters((f) => ({ ...f, search: e.target.value }))}
                        className="pl-8 h-9"
                        data-testid="input-sold-search"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs text-muted-foreground">Category</Label>
                    <Select value={soldFilters.category || "all"} onValueChange={(v) => setSoldFilters((f) => ({ ...f, category: v === "all" ? "" : v }))}>
                      <SelectTrigger className="h-9 w-full" data-testid="select-sold-category-filter">
                        <SelectValue placeholder="All Categories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {soldCategories.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs text-muted-foreground">Project Manager</Label>
                    <Select value={soldFilters.pmId || "all"} onValueChange={(v) => setSoldFilters((f) => ({ ...f, pmId: v === "all" ? "" : v }))}>
                      <SelectTrigger className="h-9 w-full" data-testid="select-sold-pm-filter">
                        <SelectValue placeholder="All PMs" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All PMs</SelectItem>
                        {pms.map((pm) => (
                          <SelectItem key={pm.id} value={pm.id}>{pm.firstName} {pm.lastName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs text-muted-foreground">Project</Label>
                    <Select value={soldFilters.projectId || "all"} onValueChange={(v) => setSoldFilters((f) => ({ ...f, projectId: v === "all" ? "" : v }))}>
                      <SelectTrigger className="h-9 w-full" data-testid="select-sold-project-filter">
                        <SelectValue placeholder="All Projects" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Projects</SelectItem>
                        {soldProjects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1 sm:col-span-1">
                    <Label className="text-xs text-muted-foreground">Locked from / to</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="sold-date-from"
                        type="date"
                        value={soldFilters.dateFrom}
                        onChange={(e) => setSoldFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                        className="h-9 min-w-0"
                        data-testid="input-sold-date-from"
                      />
                      <Input
                        id="sold-date-to"
                        type="date"
                        value={soldFilters.dateTo}
                        onChange={(e) => setSoldFilters((f) => ({ ...f, dateTo: e.target.value }))}
                        className="h-9 min-w-0"
                        data-testid="input-sold-date-to"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs text-muted-foreground">Sort by</Label>
                    <Select value={`${soldSort.by}:${soldSort.dir}`} onValueChange={(v) => { const [by, dir] = v.split(":"); setSoldSort({ by: by as any, dir: dir as any }); }}>
                      <SelectTrigger className="h-9 w-full" data-testid="select-sold-sort">
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dateLocked:desc">Date locked (newest)</SelectItem>
                        <SelectItem value="dateLocked:asc">Date locked (oldest)</SelectItem>
                        <SelectItem value="amount:desc">Amount (high → low)</SelectItem>
                        <SelectItem value="amount:asc">Amount (low → high)</SelectItem>
                        <SelectItem value="received:desc">Received (high → low)</SelectItem>
                        <SelectItem value="received:asc">Received (low → high)</SelectItem>
                        <SelectItem value="project:asc">Project (A → Z)</SelectItem>
                        <SelectItem value="project:desc">Project (Z → A)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {isLoadingSold ? (
                  <div className="space-y-2 p-6">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : sortedSoldUpsells.length > 0 ? (
                  <>
                    {/* Mobile card view (< md) */}
                    <div className="block md:hidden p-4 space-y-3">
                      {sortedSoldUpsells.map((s) => {
                        const isExpanded = expandedSoldUpsells.has(s.id);
                        const pmName = s.project?.pm ? `${s.project.pm.firstName ?? ""} ${s.project.pm.lastName ?? ""}`.trim() : null;
                        return (
                          <div key={s.id} className="rounded-lg border bg-card shadow-sm" data-testid={`card-sold-upsell-${s.id}`}>
                            <div className="flex items-start justify-between gap-2 p-4">
                              <div className="flex-1 min-w-0">
                                {s.project ? (
                                  <>
                                    <button
                                      className="font-semibold text-sm text-primary hover:underline text-left leading-snug"
                                      onClick={() => { setSelectedProjectId(s.project!.id); setIsProjectDetailOpen(true); }}
                                    >
                                      {s.project.name}
                                    </button>
                                    <p className="text-xs text-muted-foreground">{s.project.clientName}</p>
                                  </>
                                ) : (
                                  <span className="text-sm text-muted-foreground">—</span>
                                )}
                                <p className="text-sm font-medium mt-1">{s.title}</p>
                                {s.category && (
                                  <Badge variant="secondary" className="text-xs mt-1">{s.category}</Badge>
                                )}
                                <div className="flex items-center gap-3 mt-1.5">
                                  <span className="text-base font-bold font-mono">{fmtMoney(parseFloat(s.totalAmount?.toString() || "0"))}</span>
                                  <span className="text-sm text-green-600 font-medium">{fmtMoney(s.receivedAmount || 0)} received</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {canEditSold && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => openEditSold(s)}
                                    data-testid={`button-edit-sold-${s.id}`}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => toggleSoldExpand(s.id)}
                                  data-testid={`button-expand-sold-${s.id}`}
                                >
                                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </Button>
                              </div>
                            </div>
                            {isExpanded && (
                              <div className="border-t px-4 py-3 space-y-2 text-sm bg-muted/30">
                                {s.whatWasSold && (
                                  <div className="flex flex-col gap-1">
                                    <span className="text-muted-foreground">What was sold</span>
                                    <span className="font-medium">{s.whatWasSold}</span>
                                  </div>
                                )}
                                {pmName && (
                                  <div className="flex justify-between gap-2">
                                    <span className="text-muted-foreground">PM</span>
                                    <span className="font-medium">{pmName}</span>
                                  </div>
                                )}
                                <div className="flex justify-between gap-2">
                                  <span className="text-muted-foreground">Date Locked</span>
                                  <span className="font-medium">{s.dateLocked ? format(new Date(s.dateLocked), "MMM d, yyyy") : "—"}</span>
                                </div>
                                {s.outcome && (
                                  <div className="flex flex-col gap-1">
                                    <span className="text-muted-foreground">Outcome</span>
                                    <span className="font-medium">{s.outcome}</span>
                                  </div>
                                )}
                                {(s.attachmentDriveId || s.attachmentPath || s.pandadocLink) && (
                                  <div className="flex justify-between gap-2 items-center">
                                    <span className="text-muted-foreground">Files</span>
                                    <div className="flex items-center gap-2">
                                      {(s.attachmentDriveId || s.attachmentPath) && (
                                        <a href={s.attachmentDriveId ? `/api/change-requests/${s.id}/attachment` : s.attachmentPath!} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 transition-colors">
                                          <Paperclip className="h-4 w-4" />
                                        </a>
                                      )}
                                      {s.pandadocLink && (
                                        <a href={s.pandadocLink} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 transition-colors">
                                          <Link2 className="h-4 w-4" />
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Desktop table view (≥ md) */}
                  <div className="hidden md:block border-t overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[200px]">Project</TableHead>
                          <TableHead>What was sold</TableHead>
                          <TableHead className="w-[52px] text-center">PM</TableHead>
                          <TableHead className="text-right w-[110px]">Amount</TableHead>
                          <TableHead className="text-right w-[110px]">Received</TableHead>
                          <TableHead className="w-[110px]">Date Locked</TableHead>
                          <TableHead>Outcome</TableHead>
                          <TableHead className="w-[72px]">Files</TableHead>
                          {canEditSold && <TableHead className="w-[48px]" />}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedSoldUpsells.map((s) => (
                          <TableRow key={s.id} data-testid={`row-sold-upsell-${s.id}`}>
                            <TableCell>
                              {s.project ? (
                                <div>
                                  <button
                                    className="font-medium text-sm text-primary hover:underline text-left leading-snug"
                                    onClick={() => { setSelectedProjectId(s.project!.id); setIsProjectDetailOpen(true); }}
                                    data-testid={`link-sold-project-${s.id}`}
                                  >
                                    {s.project.name}
                                  </button>
                                  <div className="text-xs text-muted-foreground">{s.project.clientName}</div>
                                </div>
                              ) : (
                                <span className="text-sm text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium" data-testid={`text-sold-title-${s.id}`}>{s.title}</div>
                              {s.whatWasSold && <div className="text-sm text-muted-foreground mt-0.5">{s.whatWasSold}</div>}
                              {s.category && (
                                <Badge variant="secondary" className="w-fit text-xs mt-1.5" data-testid={`badge-sold-category-${s.id}`}>{s.category}</Badge>
                              )}
                              {s.tags && s.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1" data-testid={`tags-sold-${s.id}`}>
                                  {s.tags.map((tag) => (
                                    <TagBadge key={tag.id} tag={tag} />
                                  ))}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {s.project?.pm ? (() => {
                                const pm = s.project!.pm!;
                                const pmName = `${pm.firstName ?? ""} ${pm.lastName ?? ""}`.trim();
                                const isOnline = activeUsers.some((u) => u.odUserId === pm.id);
                                return (
                                  <HoverCard openDelay={200} closeDelay={100}>
                                    <HoverCardTrigger asChild>
                                      <Avatar
                                        className={`h-8 w-8 cursor-pointer ${getAvatarColor(pm.id)}`}
                                        data-testid={`avatar-pm-sold-${s.id}`}
                                      >
                                        <AvatarFallback className="text-white text-xs font-medium bg-transparent">
                                          {getInitials(pmName)}
                                        </AvatarFallback>
                                      </Avatar>
                                    </HoverCardTrigger>
                                    <HoverCardContent side="top" align="center" className="w-72 p-4">
                                      <div className="flex gap-4">
                                        <Avatar className={`h-14 w-14 ${getAvatarColor(pm.id)}`}>
                                          <AvatarFallback className="text-white text-lg font-medium bg-transparent">
                                            {getInitials(pmName)}
                                          </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 space-y-1">
                                          <h4 className="text-sm font-semibold">{pmName || "—"}</h4>
                                          <p className="text-xs text-muted-foreground">{getRoleLabel(pm.role || "")}</p>
                                          {pm.email && (
                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                              <Mail className="h-3 w-3" />
                                              <span className="truncate">{pm.email}</span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                      {isOnline && (
                                        <div className="mt-3 pt-3 border-t">
                                          <div className="flex items-center gap-1.5">
                                            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                                            <span className="text-xs text-muted-foreground">Currently online</span>
                                          </div>
                                        </div>
                                      )}
                                    </HoverCardContent>
                                  </HoverCard>
                                );
                              })() : (
                                <span className="text-sm text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm tabular-nums">{fmtMoney(parseFloat(s.totalAmount?.toString() || "0"))}</TableCell>
                            <TableCell className="text-right font-mono text-sm tabular-nums text-green-600">{fmtMoney(s.receivedAmount || 0)}</TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              {s.dateLocked ? format(new Date(s.dateLocked), "MMM d, yyyy") : "—"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-[200px]">
                              <span className="line-clamp-2">{s.outcome || "—"}</span>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                {(s.attachmentDriveId || s.attachmentPath) ? (
                                  <a href={s.attachmentDriveId ? `/api/change-requests/${s.id}/attachment` : s.attachmentPath!} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 transition-colors" title={s.attachmentName || "Attachment"} data-testid={`link-sold-attachment-${s.id}`}>
                                    <Paperclip className="h-4 w-4" />
                                  </a>
                                ) : null}
                                {s.pandadocLink ? (
                                  <a href={s.pandadocLink} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 transition-colors" title="PandaDoc" data-testid={`link-sold-pandadoc-${s.id}`}>
                                    <Link2 className="h-4 w-4" />
                                  </a>
                                ) : null}
                                {!s.attachmentDriveId && !s.attachmentPath && !s.pandadocLink && <span className="text-muted-foreground text-sm">—</span>}
                              </div>
                            </TableCell>
                            {canEditSold && (
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => openEditSold(s)}
                                  data-testid={`button-edit-sold-${s.id}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  </>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <ShoppingBag className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p>No sold upsells yet</p>
                    <p className="text-sm">Locked change requests will appear here automatically.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Upsell</DialogTitle>
            <DialogDescription>Add a new upsell opportunity to track</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Project *</Label>
              <Select value={formData.projectId} onValueChange={(v) => setFormData((f) => ({ ...f, projectId: v }))}>
                <SelectTrigger data-testid="select-project">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} - {p.clientName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Title (Optional)</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData((f) => ({ ...f, title: e.target.value }))}
                placeholder="Enter upsell title"
                data-testid="input-title"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
                placeholder="Enter description"
                data-testid="input-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount *</Label>
                <Input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                  data-testid="input-amount"
                />
              </div>
              <div className="space-y-2">
                <Label>Probability (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.probability}
                  onChange={(e) => setFormData((f) => ({ ...f, probability: e.target.value }))}
                  data-testid="input-probability"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type *</Label>
                <Select value={formData.upsellType} onValueChange={(v) => setFormData((f) => ({ ...f, upsellType: v }))}>
                  <SelectTrigger data-testid="select-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeUpsellTypes.map((t) => (
                      <SelectItem key={t.name} value={t.name}>{t.displayName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Expected Close Date</Label>
                <Input
                  type="date"
                  value={formData.expectedCloseDate}
                  onChange={(e) => setFormData((f) => ({ ...f, expectedCloseDate: e.target.value }))}
                  data-testid="input-expected-close-date"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleSubmitCreate} 
              disabled={createUpsellMutation.isPending}
              data-testid="button-submit-create"
            >
              {createUpsellMutation.isPending ? "Creating..." : "Create Upsell"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Upsell</DialogTitle>
            <DialogDescription>Update upsell details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Project *</Label>
              <Select value={formData.projectId} onValueChange={(v) => setFormData((f) => ({ ...f, projectId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} - {p.clientName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Title (Optional)</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData((f) => ({ ...f, title: e.target.value }))}
                placeholder="Enter upsell title"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
                placeholder="Enter description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount *</Label>
                <Input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Probability (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.probability}
                  onChange={(e) => setFormData((f) => ({ ...f, probability: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData((f) => ({ ...f, status: v as UpsellStatus }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {upsellStatusOptions.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Type *</Label>
                <Select value={formData.upsellType} onValueChange={(v) => setFormData((f) => ({ ...f, upsellType: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeUpsellTypes.map((t) => (
                      <SelectItem key={t.name} value={t.name}>{t.displayName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Expected Close Date</Label>
              <Input
                type="date"
                value={formData.expectedCloseDate}
                onChange={(e) => setFormData((f) => ({ ...f, expectedCloseDate: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleSubmitEdit} 
              disabled={updateUpsellMutation.isPending}
              data-testid="button-submit-edit"
            >
              {updateUpsellMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Upsell</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedUpsell?.title}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => selectedUpsell && deleteUpsellMutation.mutate(selectedUpsell.id)}
              disabled={deleteUpsellMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteUpsellMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isConvertDialogOpen} onOpenChange={setIsConvertDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convert to Payment</DialogTitle>
            <DialogDescription>
              Convert "{selectedUpsell?.title}" to a payment record. This will create a new payment entry.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Received Amount</Label>
              <Input
                type="number"
                value={convertData.receivedAmount}
                onChange={(e) => setConvertData((d) => ({ ...d, receivedAmount: e.target.value }))}
                data-testid="input-convert-amount"
              />
            </div>
            <div className="space-y-2">
              <Label>Received Date</Label>
              <Input
                type="date"
                value={convertData.receivedDate}
                onChange={(e) => setConvertData((d) => ({ ...d, receivedDate: e.target.value }))}
                data-testid="input-convert-date"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Month</Label>
                <Select value={convertData.month} onValueChange={(v) => setConvertData((d) => ({ ...d, month: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[...Array(12)].map((_, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>
                        {format(new Date(2024, i), "MMMM")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Year</Label>
                <Input
                  type="number"
                  value={convertData.year}
                  onChange={(e) => setConvertData((d) => ({ ...d, year: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConvertDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSubmitConvert}
              disabled={convertUpsellMutation.isPending}
              data-testid="button-confirm-convert"
            >
              {convertUpsellMutation.isPending ? "Converting..." : "Convert to Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isActivityDialogOpen} onOpenChange={setIsActivityDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Activity Timeline - {selectedUpsell?.title}</DialogTitle>
            <DialogDescription>Track interactions and progress for this opportunity</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 flex-1 overflow-y-auto">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Add New Activity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Activity Type</Label>
                    <Select value={activityData.activityType} onValueChange={(v) => setActivityData((d) => ({ ...d, activityType: v }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="call">Call</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="meeting">Meeting</SelectItem>
                        <SelectItem value="proposal">Proposal</SelectItem>
                        <SelectItem value="negotiation">Negotiation</SelectItem>
                        <SelectItem value="follow_up">Follow Up</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Date</Label>
                    <Input
                      type="date"
                      value={activityData.activityDate}
                      onChange={(e) => setActivityData((d) => ({ ...d, activityDate: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Description</Label>
                  <Textarea
                    value={activityData.description}
                    onChange={(e) => setActivityData((d) => ({ ...d, description: e.target.value }))}
                    placeholder="Describe the activity..."
                    rows={2}
                    data-testid="input-activity-description"
                  />
                </div>
                <Button 
                  onClick={handleSubmitActivity} 
                  disabled={addActivityMutation.isPending}
                  className="w-full"
                  data-testid="button-add-activity"
                >
                  {addActivityMutation.isPending ? "Adding..." : "Add Activity"}
                </Button>
              </CardContent>
            </Card>
            
            <Separator />
            
            <ScrollArea className="h-64">
              <div className="space-y-3">
                {selectedUpsell?.activities && selectedUpsell.activities.length > 0 ? (
                  selectedUpsell.activities.map((activity) => (
                    <div key={activity.id} className="flex gap-3 p-3 rounded-md bg-muted/50">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <Calendar className="h-4 w-4 text-primary" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="secondary" className="text-xs">{activity.activityType}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {activity.activityDate ? format(new Date(activity.activityDate), "MMM d, yyyy") : ""}
                          </span>
                        </div>
                        <p className="text-sm">{activity.description}</p>
                        {activity.creator && (
                          <p className="text-xs text-muted-foreground mt-1">
                            by {activity.creator.firstName} {activity.creator.lastName}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No activities recorded yet</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsActivityDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editSold} onOpenChange={(o) => { if (!o) setEditSold(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Sold Upsell</DialogTitle>
            <DialogDescription>Update this sold change request.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input value={soldForm.title} onChange={(e) => setSoldForm((f) => ({ ...f, title: e.target.value }))} data-testid="input-edit-sold-title" />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={soldForm.category} onValueChange={(v) => setSoldForm((f) => ({ ...f, category: v }))}>
                <SelectTrigger data-testid="select-edit-sold-category">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {activeUpsellTypes.map((t) => (
                    <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={soldForm.status} onValueChange={(v) => setSoldForm((f) => ({ ...f, status: v as ChangeRequestStatus }))}>
                <SelectTrigger data-testid="select-edit-sold-status">
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
              <Textarea value={soldForm.whatWasSold} onChange={(e) => setSoldForm((f) => ({ ...f, whatWasSold: e.target.value }))} data-testid="input-edit-sold-what-was-sold" />
            </div>
            <div className="space-y-2">
              <Label>Total Amount *</Label>
              <Input type="number" value={soldForm.totalAmount} onChange={(e) => setSoldForm((f) => ({ ...f, totalAmount: e.target.value }))} data-testid="input-edit-sold-total-amount" />
            </div>
            <div className="space-y-2">
              <Label>Date Locked</Label>
              <Input type="date" value={soldForm.dateLocked} onChange={(e) => setSoldForm((f) => ({ ...f, dateLocked: e.target.value }))} data-testid="input-edit-sold-date-locked" />
            </div>
            <div className="space-y-2">
              <Label>Outcome</Label>
              <Textarea value={soldForm.outcome} onChange={(e) => setSoldForm((f) => ({ ...f, outcome: e.target.value }))} data-testid="input-edit-sold-outcome" />
            </div>
            <div className="space-y-2">
              <Label>PandaDoc Link</Label>
              <Input placeholder="https://app.pandadoc.com/..." value={soldForm.pandadocLink} onChange={(e) => setSoldForm((f) => ({ ...f, pandadocLink: e.target.value }))} data-testid="input-edit-sold-pandadoc" />
            </div>
            <div className="space-y-2">
              <Label>Attachment</Label>
              <div className="flex items-center gap-2 flex-wrap">
                <DriveFileUploader
                  projectId={editSold?.projectId ?? ""}
                  buttonClassName="h-9"
                  data-testid="button-edit-sold-upload"
                  onUploaded={(result) => {
                    setSoldForm((f) => ({ ...f, attachmentDriveId: result.driveId, attachmentDriveLink: result.link || "", attachmentName: result.name }));
                  }}
                >
                  <span className="flex items-center gap-2"><Upload className="h-4 w-4" /> {soldForm.attachmentDriveId ? "Replace File" : "Upload File"}</span>
                </DriveFileUploader>
                {soldForm.attachmentDriveId && (
                  <span className="flex items-center gap-1 text-sm text-muted-foreground truncate max-w-[12rem]" data-testid="text-edit-sold-attachment-name">
                    <Paperclip className="h-3.5 w-3.5" /> {soldForm.attachmentName || "Attached"}
                  </span>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tags</Label>
              <TagSelector
                selectedTagIds={soldForm.tagIds}
                onChange={(ids) => setSoldForm((f) => ({ ...f, tagIds: ids }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSold(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!editSold) return;
                if (!soldForm.title || !soldForm.totalAmount) {
                  toast({ title: "Error", description: "Please enter a title and total amount.", variant: "destructive" });
                  return;
                }
                updateSoldMutation.mutate({
                  id: editSold.id,
                  data: {
                    title: soldForm.title,
                    category: soldForm.category || null,
                    status: soldForm.status,
                    whatWasSold: soldForm.whatWasSold || null,
                    totalAmount: soldForm.totalAmount,
                    dateLocked: soldForm.dateLocked || null,
                    outcome: soldForm.outcome || null,
                    pandadocLink: soldForm.pandadocLink || null,
                    attachmentName: soldForm.attachmentName || null,
                    attachmentDriveId: soldForm.attachmentDriveId || null,
                    attachmentDriveLink: soldForm.attachmentDriveLink || null,
                    // A new Drive upload replaces any legacy object-storage path so the
                    // table links to the Drive file, not a stale path.
                    ...(soldForm.attachmentDriveId && soldForm.attachmentDriveId !== editSold.attachmentDriveId
                      ? { attachmentPath: null }
                      : {}),
                    tagIds: soldForm.tagIds,
                  },
                });
              }}
              disabled={updateSoldMutation.isPending}
              data-testid="button-submit-edit-sold"
            >
              {updateSoldMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProjectDetailSheet
        projectId={selectedProjectId}
        open={isProjectDetailOpen}
        onOpenChange={(open) => {
          setIsProjectDetailOpen(open);
          if (!open) setSelectedProjectId(null);
        }}
      />
    </div>
  );
}
