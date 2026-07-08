import { useState, useEffect, useMemo, useRef, Fragment } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ProjectDetailSheet } from "@/components/project-detail-sheet";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
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
import * as HoverCardPrimitive from "@radix-ui/react-hover-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { usePresence } from "@/hooks/use-presence";
import { Mail } from "lucide-react";
import {
  Plus,
  Edit,
  Trash2,
  Award,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Save,
  Users,
  BarChart3,
  Star,
  FileText,
  AlertTriangle,
  UserCheck,
  Upload,
  RefreshCw,
  Lock,
  Unlock,
  SlidersHorizontal,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  Wallet,
  CalendarDays,
  Sparkles,
  Loader2,
  Target,
  ListChecks,
  ClipboardList,
  Link2,
  Copy,
  Check,
  ExternalLink,
  MoreHorizontal,
  Trash,
  Rocket,
  RotateCcw,
  MessageSquare,
  ShieldCheck,
  ShieldOff,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import * as XLSX from "xlsx";
import type {
  KpiParameter,
  KpiLevel,
  KpiLevelScore,
  KpiMonthlyReview,
  SystemPermission,
  Grade,
  SalaryGradeBand,
  AppraisalWithPm,
  AppraisalAiAnalysis,
} from "@shared/schema";
import { buildAscendingGradeCandidates } from "@shared/appraisalGrades";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getRoleLabel(role: string): string {
  const roleLabels: Record<string, string> = {
    admin: "Administrator",
    ceo: "CEO",
    cfo: "CFO",
    project_manager: "Project Manager",
    production: "Production",
    finance: "Finance",
    viewer: "Viewer",
  };
  return roleLabels[role] || role.replace(/_/g, " ");
}

function getAvatarColor(userId: string): string {
  const colors = [
    "bg-blue-500", "bg-green-500", "bg-purple-500", "bg-orange-500",
    "bg-pink-500", "bg-teal-500", "bg-indigo-500", "bg-rose-500",
  ];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function UserHoverCard({
  userId,
  name,
  email,
  role,
  profileImageUrl,
  kpiLevelName,
  activeUserIds,
  children,
}: {
  userId: string;
  name: string;
  email?: string | null;
  role?: string | null;
  profileImageUrl?: string | null;
  kpiLevelName?: string | null;
  activeUserIds: Set<string>;
  children: React.ReactNode;
}) {
  const initials = name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  const isOnline = activeUserIds.has(userId);

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <div className="cursor-pointer">{children}</div>
      </HoverCardTrigger>
      <HoverCardPrimitive.Portal>
        <HoverCardContent side="bottom" align="start" sideOffset={8} className="w-72 p-4 z-[100]">
          <div className="flex gap-4">
            <Avatar className={`h-14 w-14 border-2 ${isOnline ? "border-green-500" : "border-border"} ${!profileImageUrl ? getAvatarColor(userId) : ""}`}>
              {profileImageUrl && (
                <AvatarImage src={profileImageUrl} alt={name} className="object-cover" />
              )}
              <AvatarFallback className={`text-lg font-medium ${!profileImageUrl ? "text-white bg-transparent" : ""}`}>
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-1 min-w-0">
              <h4 className="text-sm font-semibold truncate">{name}</h4>
              {role && <p className="text-xs text-muted-foreground">{getRoleLabel(role)}</p>}
              {kpiLevelName && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">{kpiLevelName}</Badge>
              )}
              {email && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Mail className="h-3 w-3 shrink-0" />
                  <span className="truncate">{email}</span>
                </div>
              )}
            </div>
          </div>
          <div className="mt-3 pt-3 border-t">
            <div className="flex items-center gap-1.5">
              <div className={`h-2 w-2 rounded-full ${isOnline ? "bg-green-500 animate-pulse" : "bg-muted-foreground/30"}`} />
              <span className="text-xs text-muted-foreground">{isOnline ? "Currently online" : "Offline"}</span>
            </div>
          </div>
        </HoverCardContent>
      </HoverCardPrimitive.Portal>
    </HoverCard>
  );
}

const VALUE_OPTIONS: Record<string, string[]> = {
  number: ["0", "1", "2", "3", "4", "5"],
  rating: ["Poor", "Below Average", "Average", "Good", "Excellent"],
  boolean: ["Yes", "No"],
  percentage: ["0%", "10%", "20%", "30%", "40%", "50%", "60%", "70%", "80%", "90%", "100%"],
};

function getEfficiencyColor(efficiency: number): string {
  if (efficiency >= 80) return "text-green-600 dark:text-green-400";
  if (efficiency >= 60) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function getEfficiencyBgColor(efficiency: number): string {
  if (efficiency >= 80) return "bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200";
  if (efficiency >= 60) return "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200";
  if (efficiency >= 40) return "bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-200";
  return "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200";
}

const COLOR_GREEN = "bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30";
const COLOR_EMERALD = "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
const COLOR_YELLOW = "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/30";
const COLOR_ORANGE = "bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-500/30";
const COLOR_RED = "bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30";
const COLOR_MUTED = "bg-muted text-muted-foreground";

function getValueColor(value: string, valueType: string, isInverse = false): string {
  if (valueType === "rating") {
    const ratingMap: Record<string, string> = {
      "Excellent": isInverse ? COLOR_RED : COLOR_GREEN,
      "Very Good": isInverse ? COLOR_ORANGE : COLOR_EMERALD,
      "Good": isInverse ? COLOR_ORANGE : COLOR_EMERALD,
      "Average": COLOR_YELLOW,
      "Below Average": isInverse ? COLOR_EMERALD : COLOR_ORANGE,
      "Poor": isInverse ? COLOR_GREEN : COLOR_RED,
    };
    return ratingMap[value] || COLOR_MUTED;
  }
  if (valueType === "boolean") {
    const isYes = value === "Yes";
    const isGood = isInverse ? !isYes : isYes;
    return isGood ? COLOR_GREEN : COLOR_RED;
  }
  if (valueType === "number") {
    const n = parseInt(value);
    if (isInverse) {
      if (n <= 1) return COLOR_GREEN;
      if (n <= 2) return COLOR_YELLOW;
      if (n <= 3) return COLOR_ORANGE;
      return COLOR_RED;
    }
    if (n >= 4) return COLOR_GREEN;
    if (n >= 3) return COLOR_YELLOW;
    if (n >= 2) return COLOR_ORANGE;
    return COLOR_RED;
  }
  if (valueType === "percentage") {
    const n = parseInt(value);
    if (isInverse) {
      if (n <= 20) return COLOR_GREEN;
      if (n <= 40) return COLOR_YELLOW;
      if (n <= 60) return COLOR_ORANGE;
      return COLOR_RED;
    }
    if (n >= 80) return COLOR_GREEN;
    if (n >= 60) return COLOR_YELLOW;
    if (n >= 40) return COLOR_ORANGE;
    return COLOR_RED;
  }
  return COLOR_MUTED;
}

function getEfficiencyBadge(efficiency: number) {
  if (efficiency >= 80) return <Badge variant="default">Excellent</Badge>;
  if (efficiency >= 60) return <Badge variant="secondary">Good</Badge>;
  if (efficiency >= 40) return <Badge variant="outline">Average</Badge>;
  return <Badge variant="destructive">Needs Improvement</Badge>;
}

// ======================== PARAMETERS TAB ========================
function ParametersTab() {
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [editingParam, setEditingParam] = useState<KpiParameter | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    valueType: "rating" as string,
    weightage: "",
    isInverse: false,
    isAutoCalculated: false,
    autoCalcType: "" as string,
    sortOrder: 0,
    isActive: true,
  });

  const { data: parameters = [], isLoading } = useQuery<KpiParameter[]>({
    queryKey: ["/api/kpi/parameters"],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/kpi/parameters", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kpi/parameters"] });
      toast({ title: "Parameter created successfully" });
      setShowDialog(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Failed to create parameter", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PUT", `/api/kpi/parameters/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kpi/parameters"] });
      toast({ title: "Parameter updated successfully" });
      setShowDialog(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Failed to update parameter", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/kpi/parameters/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kpi/parameters"] });
      toast({ title: "Parameter deleted" });
    },
  });

  const resetForm = () => {
    setFormData({ name: "", description: "", valueType: "rating", weightage: "", isInverse: false, isAutoCalculated: false, autoCalcType: "", sortOrder: 0, isActive: true });
    setEditingParam(null);
  };

  const openCreate = () => {
    resetForm();
    setShowDialog(true);
  };

  const openEdit = (param: KpiParameter) => {
    setEditingParam(param);
    setFormData({
      name: param.name,
      description: param.description || "",
      valueType: param.valueType,
      weightage: param.weightage || "",
      isInverse: param.isInverse ?? false,
      isAutoCalculated: param.isAutoCalculated ?? false,
      autoCalcType: param.autoCalcType || "",
      sortOrder: param.sortOrder || 0,
      isActive: param.isActive ?? true,
    });
    setShowDialog(true);
  };

  const handleSubmit = () => {
    const data = {
      ...formData,
      weightage: formData.weightage,
      sortOrder: formData.sortOrder,
      autoCalcType: formData.isAutoCalculated ? (formData.autoCalcType || "target_achievement") : null,
      valueType: formData.isAutoCalculated ? "percentage" : formData.valueType,
    };
    if (editingParam) {
      updateMutation.mutate({ id: editingParam.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const totalWeightage = parameters.reduce((sum, p) => sum + parseFloat(p.weightage || "0"), 0);

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold" data-testid="text-parameters-title">KPI Parameters</h2>
          <p className="text-sm text-muted-foreground">Define the parameters used to evaluate project managers</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-sm">
            Total Weightage:{" "}
            <span className={totalWeightage === 100 ? "text-green-600 dark:text-green-400 font-semibold" : "text-red-600 dark:text-red-400 font-semibold"}>
              {totalWeightage}%
            </span>
            {totalWeightage !== 100 && (
              <span className="text-xs text-muted-foreground ml-1">(must equal 100%)</span>
            )}
          </div>
          <Button onClick={openCreate} data-testid="button-add-parameter">
            <Plus className="h-4 w-4 mr-1" />
            Add Parameter
          </Button>
        </div>
      </div>

      {parameters.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No KPI parameters defined yet</p>
            <Button variant="outline" className="mt-4" onClick={openCreate}>
              Create your first parameter
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {parameters
            .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
            .map((param) => (
              <Card key={param.id} data-testid={`card-parameter-${param.id}`}>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium">{param.name}</h3>
                      <Badge variant="outline">{param.valueType}</Badge>
                      {param.isInverse && <Badge variant="secondary" className="bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800">Inverse</Badge>}
                      {param.isAutoCalculated && <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">Auto-linked</Badge>}
                      {!param.isActive && <Badge variant="secondary">Inactive</Badge>}
                    </div>
                    {param.description && (
                      <p className="text-sm text-muted-foreground mt-1">{param.description}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-semibold">{param.weightage}%</div>
                    <div className="text-xs text-muted-foreground">weightage</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(param)} data-testid={`button-edit-parameter-${param.id}`}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(param.id)} data-testid={`button-delete-parameter-${param.id}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingParam ? "Edit Parameter" : "Add Parameter"}</DialogTitle>
            <DialogDescription>
              {editingParam ? "Update the KPI parameter settings" : "Create a new KPI evaluation parameter"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Communication"
                data-testid="input-parameter-name"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe this parameter..."
                data-testid="input-parameter-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Value Type</Label>
                <Select value={formData.valueType} onValueChange={(v) => setFormData({ ...formData, valueType: v })}>
                  <SelectTrigger data-testid="select-parameter-value-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rating">Rating (Poor-Excellent)</SelectItem>
                    <SelectItem value="number">Number (0-5)</SelectItem>
                    <SelectItem value="boolean">Yes/No</SelectItem>
                    <SelectItem value="percentage">Percentage (0%-100%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Weightage (%)</Label>
                <Input
                  type="number"
                  value={formData.weightage}
                  onChange={(e) => setFormData({ ...formData, weightage: e.target.value })}
                  placeholder="e.g. 15"
                  min="0"
                  max="100"
                  data-testid="input-parameter-weightage"
                />
              </div>
            </div>
            <div>
              <Label>Sort Order</Label>
              <Input
                type="number"
                value={formData.sortOrder}
                onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                data-testid="input-parameter-sort-order"
              />
            </div>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.isInverse}
                  onCheckedChange={(v) => setFormData({ ...formData, isInverse: v })}
                  data-testid="switch-parameter-inverse"
                />
                <div>
                  <Label>Inverse Scoring</Label>
                  <p className="text-xs text-muted-foreground">Lower values score higher (e.g. Escalations)</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(v) => setFormData({ ...formData, isActive: v })}
                  data-testid="switch-parameter-active"
                />
                <Label>Active</Label>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.isAutoCalculated}
                onCheckedChange={(v) => setFormData({ ...formData, isAutoCalculated: v, autoCalcType: v ? "target_achievement" : "", valueType: v ? "percentage" : formData.valueType })}
                data-testid="switch-parameter-auto-calculated"
              />
              <div>
                <Label>Auto-linked to Payments</Label>
                <p className="text-xs text-muted-foreground">Automatically populated from PM's recurring target achievement (received payments + upsells vs target)</p>
              </div>
            </div>
            {formData.isAutoCalculated && (
              <div className="p-3 rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
                <p className="text-xs text-muted-foreground">
                  This parameter will be automatically calculated as a percentage based on the PM's received payments (recurring + upsells) divided by their monthly target. The value type is set to Percentage automatically.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-parameter">
              <Save className="h-4 w-4 mr-1" />
              {editingParam ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ======================== LEVELS TAB ========================
function LevelsTab() {
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [editingLevel, setEditingLevel] = useState<KpiLevel | null>(null);
  const [showScoreDialog, setShowScoreDialog] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<KpiLevel | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    displayName: "",
    description: "",
    sortOrder: 0,
    isActive: true,
  });
  const [scoreEdits, setScoreEdits] = useState<Record<string, Record<string, string>>>({});

  const { data: levels = [], isLoading: levelsLoading } = useQuery<KpiLevel[]>({
    queryKey: ["/api/kpi/levels"],
  });

  const { data: parameters = [] } = useQuery<KpiParameter[]>({
    queryKey: ["/api/kpi/parameters"],
  });

  const { data: allScores = [] } = useQuery<KpiLevelScore[]>({
    queryKey: ["/api/kpi/level-scores"],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/kpi/levels", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kpi/levels"] });
      toast({ title: "Level created successfully" });
      setShowDialog(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Failed to create level", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PUT", `/api/kpi/levels/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kpi/levels"] });
      toast({ title: "Level updated successfully" });
      setShowDialog(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Failed to update level", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/kpi/levels/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kpi/levels"] });
      toast({ title: "Level deleted" });
    },
  });

  const bulkScoreMutation = useMutation({
    mutationFn: (scores: any[]) => apiRequest("POST", "/api/kpi/level-scores/bulk", { scores }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kpi/level-scores"] });
      toast({ title: "Score mappings saved" });
      setShowScoreDialog(false);
    },
    onError: (error: any) => {
      toast({ title: "Failed to save scores", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({ name: "", displayName: "", description: "", sortOrder: 0, isActive: true });
    setEditingLevel(null);
  };

  const openCreate = () => {
    resetForm();
    setShowDialog(true);
  };

  const openEdit = (level: KpiLevel) => {
    setEditingLevel(level);
    setFormData({
      name: level.name,
      displayName: level.displayName,
      description: level.description || "",
      sortOrder: level.sortOrder || 0,
      isActive: level.isActive ?? true,
    });
    setShowDialog(true);
  };

  const openScoreMapping = (level: KpiLevel) => {
    setSelectedLevel(level);
    const existing: Record<string, Record<string, string>> = {};
    for (const param of parameters) {
      existing[param.id] = {};
      const values = VALUE_OPTIONS[param.valueType] || [];
      for (const val of values) {
        const score = allScores.find(
          (s) => s.parameterId === param.id && s.levelId === level.id && s.value === val
        );
        existing[param.id][val] = score?.scorePercentage || "0";
      }
    }
    setScoreEdits(existing);
    setShowScoreDialog(true);
  };

  const handleSubmit = () => {
    if (editingLevel) {
      updateMutation.mutate({ id: editingLevel.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleSaveScores = () => {
    if (!selectedLevel) return;
    const scores: any[] = [];
    for (const [parameterId, values] of Object.entries(scoreEdits)) {
      for (const [value, scorePercentage] of Object.entries(values)) {
        scores.push({
          parameterId,
          levelId: selectedLevel.id,
          value,
          scorePercentage,
        });
      }
    }
    bulkScoreMutation.mutate(scores);
  };

  if (levelsLoading) {
    return (
      <div className="space-y-4 p-6">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold" data-testid="text-levels-title">PM Levels</h2>
          <p className="text-sm text-muted-foreground">Define experience levels and their score percentages per parameter</p>
        </div>
        <Button onClick={openCreate} data-testid="button-add-level">
          <Plus className="h-4 w-4 mr-1" />
          Add Level
        </Button>
      </div>

      {levels.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No PM levels defined yet</p>
            <Button variant="outline" className="mt-4" onClick={openCreate}>
              Create your first level
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {levels
            .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
            .map((level) => {
              const levelScoreCount = allScores.filter(s => s.levelId === level.id).length;
              return (
                <Card key={level.id} data-testid={`card-level-${level.id}`}>
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium">{level.displayName}</h3>
                        <Badge variant="outline">{level.name}</Badge>
                        {!level.isActive && <Badge variant="secondary">Inactive</Badge>}
                      </div>
                      {level.description && (
                        <p className="text-sm text-muted-foreground mt-1">{level.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {levelScoreCount} score mappings configured
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="outline" size="sm" onClick={() => openScoreMapping(level)} data-testid={`button-score-mapping-${level.id}`}>
                        Score Mapping
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(level)} data-testid={`button-edit-level-${level.id}`}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(level.id)} data-testid={`button-delete-level-${level.id}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLevel ? "Edit Level" : "Add Level"}</DialogTitle>
            <DialogDescription>
              {editingLevel ? "Update the PM level settings" : "Create a new PM experience level"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Internal Name (unique key)</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. senior"
                disabled={!!editingLevel}
                data-testid="input-level-name"
              />
            </div>
            <div>
              <Label>Display Name</Label>
              <Input
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                placeholder="e.g. Senior PM"
                data-testid="input-level-display-name"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe this level..."
                data-testid="input-level-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                  data-testid="input-level-sort-order"
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(v) => setFormData({ ...formData, isActive: v })}
                  data-testid="switch-level-active"
                />
                <Label>Active</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-level">
              <Save className="h-4 w-4 mr-1" />
              {editingLevel ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showScoreDialog} onOpenChange={setShowScoreDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Score Mapping: {selectedLevel?.displayName}</DialogTitle>
            <DialogDescription>
              Set the score percentage each value maps to for this PM level
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {parameters
              .filter(p => p.isActive)
              .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
              .map((param) => {
                const values = VALUE_OPTIONS[param.valueType] || [];
                return (
                  <div key={param.id}>
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium">{param.name}</h4>
                      <Badge variant="outline" className="text-xs">{param.weightage}%</Badge>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {values.map((val) => (
                        <div key={val} className="flex items-center gap-2">
                          <Label className="text-sm w-24 shrink-0">{val}</Label>
                          <Input
                            type="number"
                            className="w-20"
                            min="0"
                            max="100"
                            value={scoreEdits[param.id]?.[val] || "0"}
                            onChange={(e) => {
                              setScoreEdits(prev => ({
                                ...prev,
                                [param.id]: {
                                  ...prev[param.id],
                                  [val]: e.target.value,
                                },
                              }));
                            }}
                            data-testid={`input-score-${param.id}-${val}`}
                          />
                          <span className="text-xs text-muted-foreground">%</span>
                        </div>
                      ))}
                    </div>
                    <Separator className="mt-4" />
                  </div>
                );
              })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScoreDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveScores} disabled={bulkScoreMutation.isPending} data-testid="button-save-scores">
              <Save className="h-4 w-4 mr-1" />
              Save Score Mappings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ======================== MONTHLY PERFORMANCE TAB ========================
interface PerformanceData {
  month: number;
  year: number;
  performances: {
    pmId: string;
    pmName: string;
    profileImageUrl?: string | null;
    email?: string | null;
    role?: string | null;
    kpiLevelId?: string | null;
    kpiLevelName?: string | null;
    paramScores: {
      parameterId: string;
      parameterName: string;
      value: string;
      weightage: number;
      score: number;
      notes?: string | null;
    }[];
    totalScore: number;
    efficiency: number;
    reviewCount: number;
    graceAdjustment?: number;
    graceScores?: {
      id: string;
      points: number;
      reason: string;
      reviewerName: string;
      createdAt: string | null;
    }[];
    targetAchievement?: {
      targetAmount: number;
      receivedAmount: number;
      achievementPercentage: number;
      projects?: Array<{ id: string; name: string; amount: number }>;
    } | null;
  }[];
  topPerformer: any;
  totalParameters: number;
  totalWeightage: number;
}

function MonthlyPerformanceTab() {
  const { toast } = useToast();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [showScoringDialog, setShowScoringDialog] = useState(false);
  const [selectedPm, setSelectedPm] = useState<any>(null);
  const [reviewEdits, setReviewEdits] = useState<Record<string, { value: string; notes: string }>>({});
  const [detailProjectId, setDetailProjectId] = useState<string | null>(null);
  const [projectDetailOpen, setProjectDetailOpen] = useState(false);

  const { data: currentUser } = useQuery<any>({ queryKey: ["/api/auth/user"] });
  const { activeUsers } = usePresence({ enabled: !!currentUser?.id });
  const activeUserIds = new Set(activeUsers.map(u => u.odUserId));

  const { data: userPermissions } = useQuery<SystemPermission[]>({
    queryKey: ["/api/access/my-permissions"],
  });
  const canManageKpis = userPermissions?.includes("manage_kpis") ?? false;

  const { data: performance, isLoading } = useQuery<PerformanceData>({
    queryKey: ["/api/kpi/performance", month, year],
    queryFn: () => fetch(`/api/kpi/performance?month=${month}&year=${year}`, { credentials: "include" }).then(r => r.json()),
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const { data: parameters = [] } = useQuery<KpiParameter[]>({
    queryKey: ["/api/kpi/parameters", "active"],
    queryFn: () => fetch("/api/kpi/parameters?activeOnly=true", { credentials: "include" }).then(r => r.json()),
  });

  const { data: levels = [] } = useQuery<KpiLevel[]>({
    queryKey: ["/api/kpi/levels", "active"],
    queryFn: () => fetch("/api/kpi/levels?activeOnly=true", { credentials: "include" }).then(r => r.json()),
  });

  const { data: allScores = [] } = useQuery<KpiLevelScore[]>({
    queryKey: ["/api/kpi/level-scores"],
  });

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  const bulkReviewMutation = useMutation({
    mutationFn: (reviews: any[]) => apiRequest("POST", "/api/kpi/reviews/bulk", { reviews }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kpi/performance", month, year] });
      queryClient.invalidateQueries({ queryKey: ["/api/kpi/reviews"] });
      toast({ title: "Reviews saved successfully" });
      setShowScoringDialog(false);
    },
    onError: (error: any) => {
      toast({ title: "Failed to save reviews", description: error.message, variant: "destructive" });
    },
  });

  const [showGraceDialog, setShowGraceDialog] = useState(false);
  const [graceTargetPm, setGraceTargetPm] = useState<{ id: string; name: string } | null>(null);
  const [gracePoints, setGracePoints] = useState("");
  const [graceReason, setGraceReason] = useState("");

  const createGraceMutation = useMutation({
    mutationFn: (data: { pmId: string; month: number; year: number; points: number; reason: string }) =>
      apiRequest("POST", "/api/kpi/grace-scores", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kpi/performance", month, year] });
      queryClient.invalidateQueries({ queryKey: ["/api/kpi/report-card"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/my-performance"] });
      toast({ title: "Grace adjustment added" });
      setGracePoints("");
      setGraceReason("");
    },
    onError: (error: any) => {
      toast({ title: "Failed to add adjustment", description: error.message, variant: "destructive" });
    },
  });

  const deleteGraceMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/kpi/grace-scores/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kpi/performance", month, year] });
      queryClient.invalidateQueries({ queryKey: ["/api/kpi/report-card"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/my-performance"] });
      toast({ title: "Grace adjustment removed" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to remove adjustment", description: error.message, variant: "destructive" });
    },
  });

  const openGraceDialog = (pm: { id: string; name: string }) => {
    setGraceTargetPm(pm);
    setGracePoints("");
    setGraceReason("");
    setShowGraceDialog(true);
  };

  const handleAddGrace = () => {
    if (!graceTargetPm) return;
    const points = parseFloat(gracePoints);
    if (isNaN(points) || points === 0) {
      toast({ title: "Enter a non-zero point value", variant: "destructive" });
      return;
    }
    if (!graceReason.trim()) {
      toast({ title: "A reason is required", variant: "destructive" });
      return;
    }
    createGraceMutation.mutate({ pmId: graceTargetPm.id, month, year, points, reason: graceReason.trim() });
  };

  const navigateMonth = (direction: number) => {
    let newMonth = month + direction;
    let newYear = year;
    if (newMonth > 12) { newMonth = 1; newYear++; }
    if (newMonth < 1) { newMonth = 12; newYear--; }
    setMonth(newMonth);
    setYear(newYear);
  };

  const openScoring = (pm: any) => {
    setSelectedPm(pm);
    const existing = performance?.performances.find(p => p.pmId === pm.id);
    const edits: Record<string, { value: string; notes: string }> = {};
    for (const param of parameters) {
      const existingScore = existing?.paramScores.find(s => s.parameterId === param.id);
      edits[param.id] = {
        value: existingScore?.value || "",
        notes: existingScore?.notes || "",
      };
    }
    setReviewEdits(edits);
    setShowScoringDialog(true);
  };

  const calculateScore = (parameterId: string, value: string, levelId: string): number => {
    const param = parameters.find(p => p.id === parameterId);
    if (!param) return 0;
    const scoreMapping = allScores.find(
      s => s.parameterId === parameterId && s.levelId === levelId && s.value === value
    );
    let percentage = parseFloat(scoreMapping?.scorePercentage || "0");
    if (param.isInverse) {
      const paramScoresForLevel = allScores.filter(
        s => s.parameterId === parameterId && s.levelId === levelId
      );
      const maxPercentage = paramScoresForLevel.reduce(
        (max, s) => Math.max(max, parseFloat(s.scorePercentage || "0")), 0
      );
      percentage = maxPercentage - percentage;
    }
    const weightage = parseFloat(param.weightage || "0");
    return (percentage / 100) * weightage;
  };

  const handleSaveReviews = () => {
    if (!selectedPm) return;
    const pmUser = users.find(u => u.id === selectedPm.id);
    const pmLevelId = pmUser?.kpiLevelId || levels[0]?.id;
    const autoCalcParamIds = new Set(parameters.filter(p => p.isAutoCalculated).map(p => p.id));
    const reviews = Object.entries(reviewEdits)
      .filter(([parameterId, v]) => v.value && !autoCalcParamIds.has(parameterId))
      .map(([parameterId, { value, notes }]) => ({
        pmId: selectedPm.id,
        month,
        year,
        parameterId,
        value,
        notes: notes || null,
        score: pmLevelId ? calculateScore(parameterId, value, pmLevelId).toString() : "0",
      }));
    bulkReviewMutation.mutate(reviews);
  };

  const pmUsers = users.filter(u => u.isProjectManager);
  const excludedUserIds = new Set(users.filter(u => u.kpiExcluded).map(u => u.id));

  const sortedParams = [...parameters].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  const allPms = [
    ...(performance?.performances || [])
      .filter(pm => pm.pmName && pm.pmName !== "Unknown" && pm.pmName.trim() !== "")
      .filter(pm => !excludedUserIds.has(pm.pmId))
      .map(pm => ({
        id: pm.pmId,
        name: pm.pmName,
        profileImageUrl: pm.profileImageUrl,
        email: pm.email || null,
        role: pm.role || null,
        kpiLevelName: pm.kpiLevelName || null,
        paramScores: pm.paramScores,
        totalScore: pm.totalScore,
        efficiency: pm.efficiency,
        reviewCount: pm.reviewCount,
        graceAdjustment: pm.graceAdjustment || 0,
        graceScores: pm.graceScores || [],
        scored: true,
        targetAchievement: pm.targetAchievement || null,
      })),
    ...pmUsers
      .filter(u => !performance?.performances.find(p => p.pmId === u.id))
      .filter(u => !u.kpiExcluded)
      .filter(u => `${u.firstName || ""} ${u.lastName || ""}`.trim() !== "")
      .map(pm => ({
        id: pm.id,
        name: `${pm.firstName || ""} ${pm.lastName || ""}`.trim(),
        profileImageUrl: pm.profileImageUrl,
        email: pm.email || null,
        role: pm.role || null,
        kpiLevelName: levels.find(l => l.id === pm.kpiLevelId)?.displayName || null,
        paramScores: [] as any[],
        totalScore: 0,
        efficiency: 0,
        reviewCount: 0,
        graceAdjustment: 0,
        graceScores: [] as PerformanceData["performances"][number]["graceScores"],
        scored: false,
        targetAchievement: null as any,
      })),
  ];

  const topPerformer = performance?.topPerformer;

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold" data-testid="text-monthly-performance-title" style={{ color: "#C22828" }}>
              {MONTH_NAMES[month - 1].toUpperCase()}
            </h2>
            <span className="text-3xl font-light text-muted-foreground">{year}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigateMonth(-1)} data-testid="button-prev-month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-sm font-medium min-w-[140px] text-center" data-testid="text-current-month">
            {MONTH_NAMES[month - 1]} {year}
          </div>
          <Button variant="outline" size="icon" onClick={() => navigateMonth(1)} data-testid="button-next-month">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {topPerformer && (
        <div className="flex items-center gap-3 p-3 rounded-md bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 border border-amber-200 dark:border-amber-800">
          <Award className="h-7 w-7 text-amber-500 shrink-0" />
          <UserHoverCard
            userId={topPerformer.pmId}
            name={topPerformer.pmName}
            email={topPerformer.email}
            role={topPerformer.role}
            profileImageUrl={topPerformer.profileImageUrl}
            kpiLevelName={topPerformer.kpiLevelName}
            activeUserIds={activeUserIds}
          >
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9 border-2 border-amber-400 shrink-0">
                <AvatarImage src={topPerformer.profileImageUrl || undefined} />
                <AvatarFallback className="text-xs bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300">
                  {topPerformer.pmName.split(" ").map((n: string) => n[0]).join("").toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="font-semibold text-amber-800 dark:text-amber-200">{topPerformer.pmName}</span>
            </div>
          </UserHoverCard>
          <div className="flex-1 min-w-0">
            <span className="text-sm text-amber-600 dark:text-amber-400 ml-2">Top Performer</span>
          </div>
          <div className="text-right shrink-0">
            <span className="text-xl font-bold text-amber-700 dark:text-amber-300">{topPerformer.efficiency}%</span>
          </div>
        </div>
      )}

      {allPms.length > 0 && sortedParams.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-monthly-performance">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-semibold sticky left-0 bg-card z-10 min-w-[180px]" data-testid="th-pm">
                      PM
                    </th>
                    {sortedParams.map((param) => (
                      <th
                        key={param.id}
                        className="text-center p-3 font-semibold min-w-[120px]"
                        data-testid={`th-param-${param.id}`}
                      >
                        <div className="flex items-center justify-center gap-1">
                          {param.name}
                          {param.isAutoCalculated && (
                            <TrendingUp className="h-3 w-3 text-blue-500" />
                          )}
                        </div>
                        <div className="text-xs font-normal text-muted-foreground">{param.weightage}%</div>
                      </th>
                    ))}
                    <th className="text-center p-3 font-semibold min-w-[90px] bg-muted/50" data-testid="th-efficiency">
                      <div>Efficiency</div>
                    </th>
                    <th className="text-center p-3 font-semibold min-w-[70px] bg-muted/50" data-testid="th-total">
                      <div>Total</div>
                      <div className="text-xs font-normal text-muted-foreground">/ 100</div>
                    </th>
                    <th className="text-center p-3 font-semibold min-w-[90px]" data-testid="th-grace">
                      <div>Grace</div>
                      <div className="text-xs font-normal text-muted-foreground">adj.</div>
                    </th>
                    {canManageKpis && (
                      <th className="text-center p-3 min-w-[60px]" data-testid="th-actions">
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {allPms.map((pm, idx) => {
                    const isTop = topPerformer && pm.id === topPerformer.pmId;
                    return (
                      <tr
                        key={pm.id}
                        className={`border-b last:border-b-0 transition-colors ${isTop ? "bg-amber-50/50 dark:bg-amber-950/20" : idx % 2 === 0 ? "" : "bg-muted/20"}`}
                        data-testid={`row-pm-${pm.id}`}
                      >
                        <td className="p-3 sticky left-0 bg-card z-10">
                          <UserHoverCard
                            userId={pm.id}
                            name={pm.name}
                            email={pm.email}
                            role={pm.role}
                            profileImageUrl={pm.profileImageUrl}
                            kpiLevelName={pm.kpiLevelName}
                            activeUserIds={activeUserIds}
                          >
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8 border border-border shrink-0">
                                <AvatarImage src={pm.profileImageUrl || undefined} />
                                <AvatarFallback className="text-xs">
                                  {pm.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium truncate">{pm.name}</span>
                              {isTop && <Award className="h-4 w-4 text-amber-500 shrink-0" />}
                            </div>
                          </UserHoverCard>
                        </td>
                        {sortedParams.map((param) => {
                          const score = pm.paramScores.find(s => s.parameterId === param.id);
                          const value = score?.value || "";
                          const isAutoCalc = param.isAutoCalculated && param.autoCalcType === "target_achievement";
                          const colorClass = value ? getValueColor(value, param.valueType, param.isInverse ?? false) : "";
                          return (
                            <td key={param.id} className="p-2 text-center" data-testid={`cell-${pm.id}-${param.id}`}>
                              {value ? (
                                <div className="flex flex-col items-center gap-0.5">
                                  <span className={`inline-flex items-center justify-center px-2 py-1 rounded-md text-xs font-medium border ${colorClass}`}>
                                    {value}
                                  </span>
                                  {isAutoCalc && pm.targetAchievement && (
                                    <span className="text-[10px] text-muted-foreground leading-tight">
                                      ${pm.targetAchievement.receivedAmount.toLocaleString()} / ${pm.targetAchievement.targetAmount.toLocaleString()}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground/40">--</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="p-2 text-center" data-testid={`cell-efficiency-${pm.id}`}>
                          {pm.scored ? (
                            <span className={`inline-flex items-center justify-center px-2 py-1 rounded-md text-sm font-bold ${getEfficiencyBgColor(pm.efficiency)}`}>
                              {pm.efficiency.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground/40">--</span>
                          )}
                        </td>
                        <td className="p-2 text-center" data-testid={`cell-total-${pm.id}`}>
                          {pm.scored ? (
                            <span className={`text-sm font-bold ${getEfficiencyColor(pm.efficiency)}`}>
                              {pm.totalScore.toFixed(0)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/40">0</span>
                          )}
                        </td>
                        <td className="p-2 text-center" data-testid={`cell-grace-${pm.id}`}>
                          {pm.graceAdjustment !== 0 ? (
                            <HoverCard>
                              <HoverCardTrigger asChild>
                                <span
                                  className={`inline-flex items-center justify-center px-2 py-1 rounded-md text-sm font-bold cursor-help ${pm.graceAdjustment > 0 ? "text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30" : "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30"}`}
                                  data-testid={`text-grace-${pm.id}`}
                                >
                                  {pm.graceAdjustment > 0 ? "+" : ""}{pm.graceAdjustment}
                                </span>
                              </HoverCardTrigger>
                              <HoverCardContent className="w-72 text-left" align="center">
                                <div className="space-y-2">
                                  <p className="text-sm font-semibold">Grace Adjustments</p>
                                  {(pm.graceScores || []).map(g => (
                                    <div key={g.id} className="text-xs border-b last:border-b-0 pb-1.5 last:pb-0">
                                      <span className={`font-bold ${g.points > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                                        {g.points > 0 ? "+" : ""}{g.points}
                                      </span>
                                      <span className="text-muted-foreground"> by {g.reviewerName}</span>
                                      <div className="text-foreground/80">{g.reason}</div>
                                    </div>
                                  ))}
                                </div>
                              </HoverCardContent>
                            </HoverCard>
                          ) : (
                            <span className="text-muted-foreground/40">--</span>
                          )}
                        </td>
                        {canManageKpis && (
                          <td className="p-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  if (pm.scored) {
                                    openScoring({ id: pm.id, firstName: pm.name.split(" ")[0], lastName: pm.name.split(" ").slice(1).join(" ") });
                                  } else {
                                    const user = pmUsers.find(u => u.id === pm.id);
                                    if (user) openScoring(user);
                                  }
                                }}
                                data-testid={`button-score-pm-${pm.id}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openGraceDialog({ id: pm.id, name: pm.name })}
                                title="Manage grace adjustments"
                                data-testid={`button-grace-pm-${pm.id}`}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : allPms.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Star className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No project managers to score</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No KPI parameters configured yet. Set up parameters first.</p>
          </CardContent>
        </Card>
      )}

      <Dialog open={showScoringDialog} onOpenChange={setShowScoringDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Score: {selectedPm?.firstName} {selectedPm?.lastName}
            </DialogTitle>
            <DialogDescription>
              {MONTH_NAMES[month - 1]} {year} Performance Review
              {selectedPm && (() => {
                const pmUser = users.find(u => u.id === selectedPm.id);
                const levelName = pmUser?.kpiLevelId ? levels.find(l => l.id === pmUser.kpiLevelId)?.displayName : null;
                return levelName ? ` \u2022 Level: ${levelName}` : " \u2022 Level: Unassigned (using default)";
              })()}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            {sortedParams.map((param) => {
              const isAutoCalc = param.isAutoCalculated && param.autoCalcType === "target_achievement";
              const values = VALUE_OPTIONS[param.valueType] || [];
              const currentValue = reviewEdits[param.id]?.value || "";
              const currentNotes = reviewEdits[param.id]?.notes || "";

              if (isAutoCalc) {
                const pmPerf = performance?.performances.find(p => p.pmId === selectedPm?.id);
                const autoValue = pmPerf?.paramScores.find(s => s.parameterId === param.id)?.value || "";
                const targetInfo = pmPerf?.targetAchievement;
                return (
                  <div key={param.id} className="space-y-2 p-3 rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Label className="font-semibold">{param.name}</Label>
                        <Badge variant="outline" className="text-xs">{param.weightage}%</Badge>
                        <Badge variant="secondary" className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">Auto-linked</Badge>
                      </div>
                      {autoValue && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getValueColor(autoValue, param.valueType, param.isInverse ?? false)}`}>
                          {autoValue}
                        </span>
                      )}
                    </div>
                    {targetInfo ? (
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div className="flex justify-between">
                          <span>Target Amount:</span>
                          <span className="font-medium">${targetInfo.targetAmount.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Received (Recurring + Upsells):</span>
                          <span className="font-medium">${targetInfo.receivedAmount.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Achievement:</span>
                          <span className="font-semibold">{targetInfo.achievementPercentage}%</span>
                        </div>
                        {targetInfo.projects && targetInfo.projects.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-blue-200 dark:border-blue-800">
                            <p className="text-[11px] font-medium text-muted-foreground mb-1">Contributing Projects:</p>
                            <div className="space-y-0.5">
                              {targetInfo.projects.map((proj) => (
                                <div key={proj.id} className="flex items-center justify-between gap-2">
                                  <button
                                    className="text-[11px] hover:underline hover:text-primary transition-colors text-left truncate"
                                    onClick={() => { setDetailProjectId(proj.id); setProjectDetailOpen(true); }}
                                    data-testid={`link-project-kpi-${proj.id}`}
                                  >
                                    {proj.name}
                                  </button>
                                  <span className="text-[11px] shrink-0">${proj.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No target set for this PM this month. Set PM targets in the Recurring module.</p>
                    )}
                  </div>
                );
              }

              return (
                <div key={param.id} className="space-y-2 p-3 rounded-md border bg-muted/20">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Label className="font-semibold">{param.name}</Label>
                      <Badge variant="outline" className="text-xs">{param.weightage}%</Badge>
                    </div>
                    {currentValue && (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getValueColor(currentValue, param.valueType, param.isInverse ?? false)}`}>
                        {currentValue}
                      </span>
                    )}
                  </div>
                  <Select
                    value={currentValue}
                    onValueChange={(v) => {
                      setReviewEdits(prev => ({
                        ...prev,
                        [param.id]: { ...prev[param.id], value: v },
                      }));
                    }}
                  >
                    <SelectTrigger data-testid={`select-review-${param.id}`}>
                      <SelectValue placeholder="Select value..." />
                    </SelectTrigger>
                    <SelectContent>
                      {values.map(v => (
                        <SelectItem key={v} value={v}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Notes (optional)"
                    value={currentNotes}
                    onChange={(e) => {
                      setReviewEdits(prev => ({
                        ...prev,
                        [param.id]: { ...prev[param.id], notes: e.target.value },
                      }));
                    }}
                    data-testid={`input-review-notes-${param.id}`}
                  />
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScoringDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveReviews} disabled={bulkReviewMutation.isPending} data-testid="button-save-reviews">
              <Save className="h-4 w-4 mr-1" />
              Save Reviews
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showGraceDialog} onOpenChange={setShowGraceDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Grace Adjustments: {graceTargetPm?.name}</DialogTitle>
            <DialogDescription>
              {MONTH_NAMES[month - 1]} {year} &bull; Add a positive or negative point adjustment with a reason. Multiple adjustments add up and are applied to this month's total and efficiency.
            </DialogDescription>
          </DialogHeader>

          {(() => {
            const target = allPms.find(p => p.id === graceTargetPm?.id);
            const existing = target?.graceScores || [];
            return (
              <div className="space-y-4">
                {existing.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Existing adjustments</Label>
                    {existing.map(g => (
                      <div key={g.id} className="flex items-start gap-2 p-2 rounded-md border bg-muted/20" data-testid={`grace-entry-${g.id}`}>
                        <span className={`font-bold text-sm shrink-0 ${g.points > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                          {g.points > 0 ? "+" : ""}{g.points}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm break-words">{g.reason}</div>
                          <div className="text-xs text-muted-foreground">by {g.reviewerName}</div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0 h-7 w-7"
                          onClick={() => deleteGraceMutation.mutate(g.id)}
                          disabled={deleteGraceMutation.isPending}
                          data-testid={`button-delete-grace-${g.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-3 pt-2 border-t">
                  <Label className="text-sm font-semibold">Add adjustment</Label>
                  <div className="space-y-1">
                    <Label htmlFor="grace-points" className="text-xs text-muted-foreground">Points (use a negative number to deduct)</Label>
                    <Input
                      id="grace-points"
                      type="number"
                      step="any"
                      placeholder="e.g. 5 or -3"
                      value={gracePoints}
                      onChange={(e) => setGracePoints(e.target.value)}
                      data-testid="input-grace-points"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="grace-reason" className="text-xs text-muted-foreground">Reason</Label>
                    <Textarea
                      id="grace-reason"
                      placeholder="Why is this adjustment being made?"
                      value={graceReason}
                      onChange={(e) => setGraceReason(e.target.value)}
                      data-testid="input-grace-reason"
                    />
                  </div>
                </div>
              </div>
            );
          })()}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGraceDialog(false)}>Close</Button>
            <Button onClick={handleAddGrace} disabled={createGraceMutation.isPending} data-testid="button-add-grace">
              <Plus className="h-4 w-4 mr-1" />
              Add Adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProjectDetailSheet
        projectId={detailProjectId}
        open={projectDetailOpen}
        onOpenChange={setProjectDetailOpen}
      />
    </div>
  );
}

// ======================== REPORT CARD TAB ========================
interface ReportCardData {
  pmId: string;
  pmName: string;
  profileImageUrl?: string | null;
  email?: string | null;
  months: {
    month: number;
    year: number;
    paramScores: {
      parameterId: string;
      parameterName: string;
      value: string;
      weightage: number;
      score: number;
      notes?: string | null;
    }[];
    totalScore: number;
    efficiency: number;
    graceAdjustment?: number;
    graceScores?: {
      id: string;
      points: number;
      reason: string;
      reviewerName: string;
      createdAt: string | null;
    }[];
  }[];
  averageEfficiency: number;
  totalMonthsReviewed: number;
  parameters: KpiParameter[];
}

function ReportCardTab() {
  const [selectedPmId, setSelectedPmId] = useState<string>("");

  const { data: currentUser } = useQuery<any>({ queryKey: ["/api/auth/user"] });
  const { activeUsers } = usePresence({ enabled: !!currentUser?.id });
  const activeUserIds = new Set(activeUsers.map(u => u.odUserId));

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  const { data: reportCard, isLoading } = useQuery<ReportCardData>({
    queryKey: ["/api/kpi/report-card", selectedPmId],
    queryFn: () => fetch(`/api/kpi/report-card/${selectedPmId}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!selectedPmId,
  });

  const pmUsers = users.filter(u => u.isProjectManager)
    .filter(u => !u.kpiExcluded);

  const getTrendIcon = (months: ReportCardData["months"]) => {
    if (months.length < 2) return <Minus className="h-4 w-4 text-muted-foreground" />;
    const latest = months[0]?.efficiency || 0;
    const previous = months[1]?.efficiency || 0;
    if (latest > previous) return <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />;
    if (latest < previous) return <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold" data-testid="text-report-card-title">Individual Report Card</h2>
          <p className="text-sm text-muted-foreground">View performance history and trends for a project manager</p>
        </div>
        <Select value={selectedPmId} onValueChange={setSelectedPmId}>
          <SelectTrigger className="w-[250px]" data-testid="select-report-pm">
            <SelectValue placeholder="Select a project manager..." />
          </SelectTrigger>
          <SelectContent>
            {pmUsers.map(pm => (
              <SelectItem key={pm.id} value={pm.id}>
                {pm.firstName} {pm.lastName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedPmId && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Select a project manager to view their report card</p>
          </CardContent>
        </Card>
      )}

      {selectedPmId && isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {reportCard && (
        <>
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <UserHoverCard
                userId={selectedPmId}
                name={reportCard.pmName}
                email={reportCard.email}
                role={users.find(u => u.id === selectedPmId)?.role}
                profileImageUrl={reportCard.profileImageUrl}
                activeUserIds={activeUserIds}
              >
                <Avatar className="h-16 w-16 border border-border shrink-0">
                  <AvatarImage src={reportCard.profileImageUrl || undefined} />
                  <AvatarFallback>
                    {reportCard.pmName.split(" ").map(n => n[0]).join("").toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </UserHoverCard>
              <div className="flex-1 min-w-0">
                <h3 className="text-xl font-semibold">{reportCard.pmName}</h3>
                {reportCard.email && (
                  <p className="text-sm text-muted-foreground">{reportCard.email}</p>
                )}
                <div className="flex items-center gap-4 mt-2 flex-wrap">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Avg Efficiency:</span>{" "}
                    <span className={`font-semibold ${getEfficiencyColor(reportCard.averageEfficiency)}`}>
                      {reportCard.averageEfficiency}%
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Months Reviewed:</span>{" "}
                    <span className="font-semibold">{reportCard.totalMonthsReviewed}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-muted-foreground">Trend:</span>
                    {getTrendIcon(reportCard.months)}
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className={`text-3xl font-bold ${getEfficiencyColor(reportCard.averageEfficiency)}`}>
                  {reportCard.averageEfficiency}%
                </div>
                <div className="text-sm text-muted-foreground">overall</div>
              </div>
            </CardContent>
          </Card>

          {reportCard.months.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No performance data available yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {reportCard.months.map((m) => (
                <Card key={`${m.year}-${m.month}`} data-testid={`card-report-month-${m.year}-${m.month}`}>
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base">{MONTH_NAMES[m.month - 1]} {m.year}</CardTitle>
                      <div className="flex items-center gap-2">
                        {getEfficiencyBadge(m.efficiency)}
                        <span className={`text-lg font-bold ${getEfficiencyColor(m.efficiency)}`}>
                          {m.efficiency}%
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {m.paramScores.map((ps) => (
                        <div key={ps.parameterId} className="text-sm">
                          <div className="text-muted-foreground">{ps.parameterName}</div>
                          <div className="flex items-center justify-between gap-2">
                            <Badge variant="outline">{ps.value}</Badge>
                            <span className="font-medium">{ps.score.toFixed(1)}/{ps.weightage}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    {(m.graceScores?.length ?? 0) > 0 && (
                      <div className="mt-3 pt-3 border-t space-y-1.5" data-testid={`grace-report-${m.year}-${m.month}`}>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground">Grace adjustment:</span>
                          <span className={`font-bold ${(m.graceAdjustment ?? 0) > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                            {(m.graceAdjustment ?? 0) > 0 ? "+" : ""}{m.graceAdjustment ?? 0}
                          </span>
                        </div>
                        {m.graceScores!.map(g => (
                          <div key={g.id} className="text-xs text-muted-foreground">
                            <span className={`font-semibold ${g.points > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                              {g.points > 0 ? "+" : ""}{g.points}
                            </span>{" "}
                            {g.reason} <span className="opacity-70">({g.reviewerName})</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ======================== PM ASSIGNMENTS TAB ========================
function PmAssignmentsTab() {
  const { toast } = useToast();

  const { data: currentUser } = useQuery<any>({ queryKey: ["/api/auth/user"] });
  const { activeUsers } = usePresence({ enabled: !!currentUser?.id });
  const activeUserIds = new Set(activeUsers.map(u => u.odUserId));

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  const { data: levels = [], isLoading: levelsLoading } = useQuery<KpiLevel[]>({
    queryKey: ["/api/kpi/levels", "active"],
    queryFn: () => fetch("/api/kpi/levels?activeOnly=true", { credentials: "include" }).then(r => r.json()),
  });

  const assignLevelMutation = useMutation({
    mutationFn: (data: { userId: string; kpiLevelId: string | null }) =>
      apiRequest("PATCH", "/api/kpi/assign-level", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kpi/performance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "PM level updated" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to assign level", description: error.message, variant: "destructive" });
    },
  });

  const toggleExcludedMutation = useMutation({
    mutationFn: (data: { userId: string; kpiExcluded: boolean }) =>
      apiRequest("PATCH", "/api/kpi/toggle-excluded", data),
    onSuccess: (_data: any, variables: { userId: string; kpiExcluded: boolean }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/kpi/performance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: variables.kpiExcluded ? "User excluded from KPI reviews" : "User included in KPI reviews" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update", description: error.message, variant: "destructive" });
    },
  });

  const pmUsers = users.filter(u => u.isProjectManager);

  if (levelsLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    );
  }

  if (levels.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold mb-2">No Levels Configured</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Please configure PM levels in the "PM Levels" tab before assigning them to project managers.
        </p>
      </div>
    );
  }

  const includedUsers = pmUsers.filter(u => !u.kpiExcluded);
  const excludedCount = pmUsers.length - includedUsers.length;
  const assignedCount = includedUsers.filter(u => u.kpiLevelId).length;
  const unassignedCount = includedUsers.length - assignedCount;

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      <div>
        <h2 className="text-2xl font-bold" style={{ color: "#C22828" }}>PM Level Assignments</h2>
        <p className="text-muted-foreground mt-1">
          Assign experience levels to project managers for accurate KPI scoring
        </p>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{pmUsers.length} Total PMs</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-green-50 dark:bg-green-950/30">
          <UserCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
          <span className="text-sm text-green-700 dark:text-green-300">{assignedCount} Assigned</span>
        </div>
        {unassignedCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-50 dark:bg-amber-950/30">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span className="text-sm text-amber-700 dark:text-amber-300">{unassignedCount} Unassigned</span>
          </div>
        )}
        {excludedCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50">
            <span className="text-sm text-muted-foreground">{excludedCount} Excluded</span>
          </div>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm" data-testid="table-pm-assignments">
            <thead>
              <tr className="border-b">
                <th className="text-center p-4 font-semibold w-[100px]">Include</th>
                <th className="text-left p-4 font-semibold">Project Manager</th>
                <th className="text-left p-4 font-semibold">Email</th>
                <th className="text-left p-4 font-semibold">Role</th>
                <th className="text-left p-4 font-semibold min-w-[180px]">Assigned Level</th>
              </tr>
            </thead>
            <tbody>
              {pmUsers.map((pm, idx) => {
                const currentLevel = levels.find(l => l.id === pm.kpiLevelId);
                return (
                  <tr
                    key={pm.id}
                    className={`border-b last:border-b-0 ${idx % 2 === 0 ? "" : "bg-muted/20"}`}
                    data-testid={`row-pm-assign-${pm.id}`}
                  >
                    <td className="p-4 text-center">
                      <Switch
                        checked={!pm.kpiExcluded}
                        onCheckedChange={(checked) => {
                          toggleExcludedMutation.mutate({ userId: pm.id, kpiExcluded: !checked });
                        }}
                        data-testid={`switch-kpi-include-${pm.id}`}
                      />
                    </td>
                    <td className="p-4">
                      <UserHoverCard
                        userId={pm.id}
                        name={`${pm.firstName || ""} ${pm.lastName || ""}`.trim()}
                        email={pm.email}
                        role={pm.role}
                        profileImageUrl={pm.profileImageUrl}
                        kpiLevelName={currentLevel?.displayName}
                        activeUserIds={activeUserIds}
                      >
                        <div className={`flex items-center gap-3 ${pm.kpiExcluded ? "opacity-50" : ""}`}>
                          <Avatar className="h-9 w-9 border border-border shrink-0">
                            <AvatarImage src={pm.profileImageUrl || undefined} />
                            <AvatarFallback className="text-xs">
                              {`${pm.firstName || ""} ${pm.lastName || ""}`.trim().split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{pm.firstName} {pm.lastName}</span>
                          {pm.kpiExcluded && <Badge variant="outline" className="text-xs">Excluded</Badge>}
                        </div>
                      </UserHoverCard>
                    </td>
                    <td className="p-4 text-muted-foreground">{pm.email}</td>
                    <td className="p-4">
                      <Badge variant="outline" className="capitalize">{pm.role?.replace(/_/g, " ")}</Badge>
                    </td>
                    <td className="p-4">
                      <Select
                        value={pm.kpiLevelId || "unassigned"}
                        onValueChange={(v) => {
                          assignLevelMutation.mutate({
                            userId: pm.id,
                            kpiLevelId: v === "unassigned" ? null : v,
                          });
                        }}
                      >
                        <SelectTrigger data-testid={`select-assign-level-${pm.id}`}>
                          <SelectValue placeholder="Select level..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {levels.map(level => (
                            <SelectItem key={level.id} value={level.id}>{level.displayName}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                );
              })}
              {pmUsers.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    No project managers found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

// ======================== APPRAISALS TAB ========================
// ======================== APPRAISALS HELPERS ========================
const fmtMoney = (v: string | number | null | undefined) => {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "number" ? v : parseFloat(v);
  if (isNaN(n)) return "—";
  return `PKR ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
};
const fmtPct = (v: string | number | null | undefined) => {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "number" ? v : parseFloat(v);
  if (isNaN(n)) return "—";
  return `${n.toFixed(1)}%`;
};
const fmtScore = (v: string | number | null | undefined) => {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "number" ? v : parseFloat(v);
  if (isNaN(n)) return "—";
  return n.toFixed(1);
};

// Coerce an arbitrary sheet-detail value to a number when possible (strips
// currency symbols / commas). Returns null for blanks or non-numeric text.
const toNum = (raw: any): number | null => {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = typeof raw === "number" ? raw : parseFloat(String(raw).replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? null : n;
};

// A grade sheet row carries its own rolled-up "Package" total in a column whose
// name contains "package". This returns that figure (the authoritative total
// package for the grade) or null when the sheet has no such column.
const getPackageAmount = (band: SalaryGradeBand | undefined | null): number | null => {
  if (!band) return null;
  const details = band.details || {};
  const key = Object.keys(details).find((k) => k.toLowerCase().includes("package"));
  if (!key) return null;
  return toNum(details[key]);
};

// Side-by-side benefit breakdown of a PM's current pay grade vs the new
// (assigned) pay grade, plus a headline total-package comparison so finance can
// see the real cost of the increment. Basic is the math column; everything else
// comes from the grade sheet's `details`.
function GradeBenefitBreakdown({
  currentBand,
  newBand,
}: {
  currentBand?: SalaryGradeBand | null;
  newBand?: SalaryGradeBand | null;
}) {
  const detailKeys = Array.from(
    new Set([
      ...Object.keys(currentBand?.details || {}),
      ...Object.keys(newBand?.details || {}),
    ]),
  );
  const fmtDetail = (raw: any) => {
    if (raw === null || raw === undefined || raw === "") return "—";
    const n = toNum(raw);
    return n != null ? fmtMoney(n) : String(raw);
  };

  const curPkg = getPackageAmount(currentBand);
  const newPkg = getPackageAmount(newBand);
  const pkgDelta = curPkg != null && newPkg != null ? newPkg - curPkg : null;

  return (
    <div className="rounded-md border bg-muted/20 p-3 space-y-3" data-testid="grade-benefit-breakdown">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-muted-foreground border-b">
            <th className="py-1 pr-3 font-medium">Benefit</th>
            <th className="py-1 pr-3 font-medium text-right whitespace-nowrap">
              Current {currentBand?.gradeCode ? `(${currentBand.gradeCode})` : ""}
            </th>
            <th className="py-1 pr-3 font-medium text-right whitespace-nowrap">
              New {newBand?.gradeCode ? `(${newBand.gradeCode})` : ""}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b" data-testid="breakdown-row-basic">
            <td className="py-1 pr-3 font-medium">Basic</td>
            <td className="py-1 pr-3 text-right whitespace-nowrap">{fmtMoney(currentBand?.salaryAmount)}</td>
            <td className="py-1 pr-3 text-right whitespace-nowrap">{fmtMoney(newBand?.salaryAmount)}</td>
          </tr>
          {detailKeys.map((k) => (
            <tr key={k} className="border-b" data-testid={`breakdown-row-${k}`}>
              <td className="py-1 pr-3 whitespace-nowrap">{k}</td>
              <td className="py-1 pr-3 text-right whitespace-nowrap">{fmtDetail((currentBand?.details || {})[k])}</td>
              <td className="py-1 pr-3 text-right whitespace-nowrap">{fmtDetail((newBand?.details || {})[k])}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center justify-between gap-4 rounded-md bg-primary/5 px-3 py-2" data-testid="breakdown-total-package">
        <span className="text-xs font-semibold">Total Package</span>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">{curPkg != null ? fmtMoney(curPkg) : "—"}</span>
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
          <span className="font-semibold" data-testid="text-new-total-package">{newPkg != null ? fmtMoney(newPkg) : "—"}</span>
          {pkgDelta != null && pkgDelta !== 0 && (
            <span className={`text-xs font-medium ${pkgDelta > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`} data-testid="text-package-delta">
              {pkgDelta > 0 ? "+" : ""}{fmtMoney(pkgDelta)}
            </span>
          )}
        </div>
      </div>
      {curPkg == null && newPkg == null && (
        <p className="text-xs text-muted-foreground">No "Package" column in the grade sheet — upload one to see total package figures.</p>
      )}
    </div>
  );
}

// ======================== GRADES MANAGER ========================
function GradesManager() {
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<Grade | null>(null);
  const [form, setForm] = useState({ name: "", code: "", targetScore: "", baseIncrementPct: "", sortOrder: 0 });

  const { data: grades = [], isLoading } = useQuery<Grade[]>({ queryKey: ["/api/kpi/grades"] });

  const reset = () => { setForm({ name: "", code: "", targetScore: "", baseIncrementPct: "", sortOrder: 0 }); setEditing(null); };

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/kpi/grades", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/kpi/grades"] }); toast({ title: "Grade created" }); setShowDialog(false); reset(); },
    onError: (e: any) => toast({ title: "Failed to create grade", description: e.message, variant: "destructive" }),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PATCH", `/api/kpi/grades/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/kpi/grades"] }); toast({ title: "Grade updated" }); setShowDialog(false); reset(); },
    onError: (e: any) => toast({ title: "Failed to update grade", description: e.message, variant: "destructive" }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/kpi/grades/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/kpi/grades"] }); toast({ title: "Grade deleted" }); },
    onError: (e: any) => toast({ title: "Failed to delete grade", description: e.message, variant: "destructive" }),
  });

  const openCreate = () => { reset(); setShowDialog(true); };
  const openEdit = (g: Grade) => {
    setEditing(g);
    setForm({ name: g.name, code: g.code || "", targetScore: g.targetScore || "", baseIncrementPct: g.baseIncrementPct || "", sortOrder: g.sortOrder || 0 });
    setShowDialog(true);
  };
  const handleSubmit = () => {
    const data = { name: form.name, code: form.code || null, targetScore: form.targetScore, baseIncrementPct: form.baseIncrementPct, sortOrder: Number(form.sortOrder) || 0 };
    if (editing) updateMutation.mutate({ id: editing.id, data });
    else createMutation.mutate(data);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>Designations</CardTitle>
          <CardDescription>Designations define the average-score target for eligibility and the base increment %. Each designation holds its own set of pay grades (uploaded in the Grades tab).</CardDescription>
        </div>
        <Button onClick={openCreate} data-testid="button-add-grade"><Plus className="h-4 w-4 mr-1" />Add Designation</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : grades.length === 0 ? (
          <p className="text-muted-foreground text-sm py-8 text-center">No designations yet. Add a designation to get started.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Designation</th>
                  <th className="py-2 pr-4 font-medium">Code</th>
                  <th className="py-2 pr-4 font-medium">Target Score</th>
                  <th className="py-2 pr-4 font-medium">Base Increment</th>
                  <th className="py-2 pr-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {grades.map((g) => (
                  <tr key={g.id} className="border-b" data-testid={`row-grade-${g.id}`}>
                    <td className="py-2 pr-4 font-medium">{g.name}</td>
                    <td className="py-2 pr-4">{g.code || "—"}</td>
                    <td className="py-2 pr-4">{fmtScore(g.targetScore)}</td>
                    <td className="py-2 pr-4">{fmtPct(g.baseIncrementPct)}</td>
                    <td className="py-2 pr-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(g)} data-testid={`button-edit-grade-${g.id}`}><Edit className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => { if (confirm(`Delete designation "${g.name}"? Users on this designation will be unassigned.`)) deleteMutation.mutate(g.id); }} data-testid={`button-delete-grade-${g.id}`}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <Dialog open={showDialog} onOpenChange={(o) => { setShowDialog(o); if (!o) reset(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Designation" : "Add Designation"}</DialogTitle>
            <DialogDescription>Target score is the average KPI score a person must exceed to be eligible.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Designation Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Assistant Vice President" data-testid="input-grade-name" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Code</Label>
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="AVP" data-testid="input-grade-code" />
              </div>
              <div className="space-y-2">
                <Label>Sort Order</Label>
                <Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} data-testid="input-grade-sort" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Target Score *</Label>
                <Input type="number" step="0.01" value={form.targetScore} onChange={(e) => setForm({ ...form, targetScore: e.target.value })} placeholder="80" data-testid="input-grade-target" />
              </div>
              <div className="space-y-2">
                <Label>Base Increment % *</Label>
                <Input type="number" step="0.01" value={form.baseIncrementPct} onChange={(e) => setForm({ ...form, baseIncrementPct: e.target.value })} placeholder="15" data-testid="input-grade-base" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDialog(false); reset(); }}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!form.name || !form.targetScore || !form.baseIncrementPct || createMutation.isPending || updateMutation.isPending} data-testid="button-save-grade">
              {editing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ======================== GRADE SHEET MANAGER ========================
function GradeSheetManager() {
  const { toast } = useToast();
  type ParsedGrade = { designationName: string; gradeCode: string; salaryAmount: number; details: Record<string, any> };
  const [parsed, setParsed] = useState<ParsedGrade[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [skipped, setSkipped] = useState<{ designationName: string; gradeCode: string | null }[]>([]);

  const { data: bands = [], isLoading } = useQuery<SalaryGradeBand[]>({ queryKey: ["/api/kpi/grade-bands"] });

  const saveMutation = useMutation({
    mutationFn: (rows: ParsedGrade[]) => apiRequest("PUT", "/api/kpi/grade-bands", { bands: rows }),
    onSuccess: async (res: any) => {
      const data = await res.json().catch(() => ({}));
      const skippedRows = Array.isArray(data?.skipped) ? data.skipped : [];
      setSkipped(skippedRows);
      queryClient.invalidateQueries({ queryKey: ["/api/kpi/grade-bands"] });
      toast({
        title: "Grade sheet saved",
        description: skippedRows.length > 0
          ? `${skippedRows.length} row(s) skipped — designation not found. Add the designation first, then re-upload.`
          : undefined,
        variant: skippedRows.length > 0 ? "destructive" : "default",
      });
      setParsed(null);
      setFileName("");
    },
    onError: (e: any) => toast({ title: "Failed to save grade sheet", description: e.message, variant: "destructive" }),
  });

  const num = (v: any): number | null => {
    const n = parseFloat(String(v ?? "").replace(/[,$\s]/g, ""));
    return Number.isFinite(n) ? n : null;
  };

  const handleFile = async (file: File) => {
    try {
      setFileName(file.name);
      setSkipped([]);
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const aoa: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
      if (aoa.length === 0) { toast({ title: "Empty file", variant: "destructive" }); return; }

      // Find the real header row: it contains both a "Designation" and a "Grade" column.
      const headerIdx = aoa.findIndex((r) =>
        Array.isArray(r) &&
        r.some((c) => /designation/i.test(String(c))) &&
        r.some((c) => /^\s*grade\s*$/i.test(String(c)))
      );
      if (headerIdx < 0) {
        toast({ title: "Could not find header row", description: "The sheet needs a header row with 'Designation' and 'Grade' columns.", variant: "destructive" });
        return;
      }
      const headers = aoa[headerIdx].map((h) => String(h).trim());
      const desigIdx = headers.findIndex((h) => /designation/i.test(h));
      const gradeIdx = headers.findIndex((h) => /^grade$/i.test(h));
      let basicIdx = headers.findIndex((h) => /^basic$/i.test(h));
      if (basicIdx < 0) basicIdx = headers.findIndex((h) => /basic/i.test(h));
      if (basicIdx < 0) {
        toast({ title: "No 'Basic' salary column found", description: "Add a 'Basic' column with the basic salary amounts.", variant: "destructive" });
        return;
      }

      const rows: ParsedGrade[] = [];
      let lastDesig = "";
      for (let i = headerIdx + 1; i < aoa.length; i++) {
        const row = aoa[i];
        if (!row) continue;
        let desig = String(row[desigIdx] ?? "").trim();
        if (desig) lastDesig = desig; else desig = lastDesig; // designation cells are merged down the sheet
        const gradeCode = String(row[gradeIdx] ?? "").trim();
        const basic = num(row[basicIdx]);
        if (!desig || !gradeCode || basic == null || basic <= 0) continue;
        const details: Record<string, any> = {};
        headers.forEach((h, idx) => {
          if (idx === desigIdx || idx === gradeIdx || idx === basicIdx || !h) return;
          const raw = row[idx];
          if (raw === "" || raw == null) return;
          details[h] = raw;
        });
        rows.push({ designationName: desig, gradeCode, salaryAmount: basic, details });
      }
      if (rows.length === 0) { toast({ title: "No valid grade rows found", variant: "destructive" }); return; }
      setParsed(rows);
    } catch (e: any) {
      toast({ title: "Failed to read file", description: e.message, variant: "destructive" });
    }
  };

  // Union of all benefit columns across saved grades, for the display table.
  const detailKeys = Array.from(
    bands.reduce((set, b) => {
      Object.keys(b.details || {}).forEach((k) => set.add(k));
      return set;
    }, new Set<string>())
  );

  // Group saved grades by designation for display.
  const grouped = bands.reduce((map, b) => {
    const key = b.designationName || "—";
    (map.get(key) || map.set(key, []).get(key)!).push(b);
    return map;
  }, new Map<string, SalaryGradeBand[]>());

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
        <div>
          <CardTitle>Grades (Pay Grade Sheet)</CardTitle>
          <CardDescription>Upload an Excel/CSV with <span className="font-medium">Designation</span>, <span className="font-medium">Grade</span>, <span className="font-medium">Basic</span> and benefit columns. Each grade belongs to a designation; new salaries snap within the same designation. Add designations first — rows whose designation isn't found are skipped.</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <input
            id="grade-sheet-file"
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.currentTarget.value = ""; }}
            data-testid="input-grade-sheet-file"
          />
          <Button variant="outline" onClick={() => document.getElementById("grade-sheet-file")?.click()} data-testid="button-upload-grade-sheet">
            <Upload className="h-4 w-4 mr-1" />Upload File
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {parsed && (
          <div className="rounded-md border p-4 bg-muted/30 space-y-3">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <p className="text-sm">Parsed <span className="font-semibold">{parsed.length}</span> grades from <span className="font-mono">{fileName}</span>. Saving updates the grade sheet (existing assignments are kept where the grade still exists).</p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => { setParsed(null); setFileName(""); }} data-testid="button-cancel-grade-sheet">Cancel</Button>
                <Button size="sm" onClick={() => saveMutation.mutate(parsed)} disabled={saveMutation.isPending} data-testid="button-save-grade-sheet">Save Grade Sheet</Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {parsed.slice(0, 24).map((r, i) => (
                <Badge key={i} variant="secondary">{r.designationName} · {r.gradeCode}: {fmtMoney(r.salaryAmount)}</Badge>
              ))}
              {parsed.length > 24 && <Badge variant="outline">+{parsed.length - 24} more</Badge>}
            </div>
          </div>
        )}

        {skipped.length > 0 && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 space-y-2" data-testid="grade-sheet-skipped">
            <p className="text-sm font-medium text-destructive">{skipped.length} row(s) skipped — designation not found. Create the designation in the Designations tab, then re-upload.</p>
            <div className="flex flex-wrap gap-1">
              {skipped.slice(0, 24).map((s, i) => (
                <Badge key={i} variant="outline">{s.designationName}{s.gradeCode ? ` · ${s.gradeCode}` : ""}</Badge>
              ))}
            </div>
          </div>
        )}

        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : bands.length === 0 ? (
          <p className="text-muted-foreground text-sm py-8 text-center">No grades uploaded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Designation</th>
                  <th className="py-2 pr-4 font-medium">Grade</th>
                  <th className="py-2 pr-4 font-medium text-right">Basic</th>
                  {detailKeys.map((k) => (
                    <th key={k} className="py-2 pr-4 font-medium text-right whitespace-nowrap">{k}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from(grouped.entries()).map(([desig, group]) =>
                  group.map((b, idx) => (
                    <tr key={b.id} className="border-b" data-testid={`row-band-${b.id}`}>
                      <td className="py-2 pr-4 font-medium whitespace-nowrap">{idx === 0 ? desig : ""}</td>
                      <td className="py-2 pr-4 whitespace-nowrap">{b.gradeCode || "—"}</td>
                      <td className="py-2 pr-4 text-right whitespace-nowrap">{fmtMoney(b.salaryAmount)}</td>
                      {detailKeys.map((k) => {
                        const v = (b.details || {})[k];
                        return <td key={k} className="py-2 pr-4 text-right whitespace-nowrap">{v == null || v === "" ? "—" : String(v)}</td>;
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ======================== APPRAISAL OVERRIDE DIALOG ========================
// The ascending, cross-designation band candidate list is computed by a
// shared helper (shared/appraisalGrades.ts) so the client dropdown and the
// server's override-save validation always agree on what's assignable.
function buildAscendingGradeOptions(
  bands: SalaryGradeBand[],
  grades: Grade[],
  appraisal: AppraisalWithPm | null,
): SalaryGradeBand[] {
  if (!appraisal) return [];
  return buildAscendingGradeCandidates(bands, grades, appraisal.currentGradeBandId, appraisal.gradeId);
}

// Mirrors server snapToBand (smaller absolute difference wins; ties favor the
// higher/ceiling band) so the dropdown can live-preview the same result the
// backend would compute on save.
function snapToNearestBandClient(raw: number, candidates: SalaryGradeBand[]): SalaryGradeBand | null {
  let best: { band: SalaryGradeBand; diff: number; amt: number } | null = null;
  for (const b of candidates) {
    const amt = parseFloat(b.salaryAmount || "0");
    const diff = Math.abs(amt - raw);
    if (!best || diff < best.diff || (diff === best.diff && amt > best.amt)) {
      best = { band: b, diff, amt };
    }
  }
  return best ? best.band : null;
}

function AppraisalOverrideDialog({ appraisal, bands, grades, open, onOpenChange }: { appraisal: AppraisalWithPm | null; bands: SalaryGradeBand[]; grades: Grade[]; open: boolean; onOpenChange: (o: boolean) => void; }) {
  const { toast } = useToast();
  const [base, setBase] = useState("");
  const [hp, setHp] = useState("");
  const [salary, setSalary] = useState("");
  // Two-way preview: whichever control the admin touched most recently
  // "drives" the other's preview. "percent" = Base%/HP%/Salary inputs drive
  // the nearest-grade preview (default). "band" = a manually-picked grade
  // drives the previewed package instead. Editing the percent inputs again
  // switches the driver back to "percent", so a stale manual pick doesn't
  // silently stick around once the admin goes back to typing numbers.
  const [driver, setDriver] = useState<"percent" | "band">("percent");
  const [manualBandId, setManualBandId] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/kpi/appraisals/${appraisal!.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kpi/appraisals"] });
      toast({ title: "Appraisal updated" });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "Failed to update", description: e.message, variant: "destructive" }),
  });

  const handlePercentChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value);
    setDriver("percent");
  };

  const handleSave = () => {
    const data: any = {};
    if (base !== "") data.baseIncrementPct = base;
    if (hp !== "") data.hpPct = hp;
    if (salary !== "") data.currentSalary = salary;
    data.assignedBandId = driver === "band" ? manualBandId : null;
    mutation.mutate(data);
  };

  // Assignable grades: from the employee's current grade onward, spanning
  // across designations (an employee can be promoted into a different
  // designation, not just move within their current one).
  const gradeOptions = useMemo(
    () => buildAscendingGradeOptions(bands, grades, appraisal),
    [bands, grades, appraisal],
  );

  // Live preview: recompute the raw new salary the same way the backend does
  // whenever the percent/salary inputs change. This always runs regardless of
  // driver, so switching back to "percent" after a manual pick recomputes
  // immediately from the current input values (last-change-wins).
  const liveRawSalary = useMemo(() => {
    if (!appraisal) return null;
    const baseVal = base !== "" ? parseFloat(base) : parseFloat(appraisal.baseIncrementPct ?? "0") || 0;
    const hpVal = hp !== "" ? parseFloat(hp) : parseFloat(appraisal.hpPct ?? "0") || 0;
    const salaryVal = salary !== "" ? parseFloat(salary) : parseFloat(appraisal.currentSalary ?? "0") || 0;
    if (!Number.isFinite(baseVal) || !Number.isFinite(hpVal) || !Number.isFinite(salaryVal)) return null;
    return salaryVal * (1 + (baseVal + hpVal) / 100);
  }, [base, hp, salary, appraisal]);

  const nearestBand = useMemo(() => {
    if (liveRawSalary == null || gradeOptions.length === 0) return null;
    return snapToNearestBandClient(liveRawSalary, gradeOptions);
  }, [liveRawSalary, gradeOptions]);

  const handleBandChange = (value: string) => {
    if (value === "auto") {
      setManualBandId(null);
      setDriver("percent");
    } else {
      setManualBandId(value);
      setDriver("band");
    }
  };

  // The Select's own value: "auto" whenever the percent inputs are the
  // active driver (even if a band was previously picked), else the manually
  // picked band id.
  const selectValue = driver === "band" && manualBandId ? manualBandId : "auto";

  // Benefit breakdown reflects the current grade vs the grade that will be
  // assigned. When the band driver is active it previews the manually-picked
  // grade; when the percent driver is active (default, or after editing
  // Base%/HP%/Salary again) it previews the live nearest-grade snap.
  const currentBand = appraisal?.currentGradeBandId
    ? bands.find((b) => b.id === appraisal.currentGradeBandId)
    : null;
  const previewBandId = driver === "band" && manualBandId ? manualBandId : (nearestBand?.id ?? appraisal?.assignedBandId ?? null);
  const newBand = previewBandId ? bands.find((b) => b.id === previewBandId) : null;
  const isManualPick = driver === "band";

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setBase(""); setHp(""); setSalary(""); setManualBandId(null); setDriver("percent"); } }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Override Appraisal</DialogTitle>
          <DialogDescription>
            {appraisal ? `${appraisal.pm?.firstName || ""} ${appraisal.pm?.lastName || ""}`.trim() || appraisal?.pm?.email : ""} — leave a field blank to keep the computed value. The new salary is recomputed and re-snapped to a band.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Base Increment %</Label>
              <Input type="number" step="0.01" value={base} onChange={handlePercentChange(setBase)} placeholder={appraisal?.baseIncrementPct ?? "0"} data-testid="input-override-base" />
            </div>
            <div className="space-y-2">
              <Label>HP %</Label>
              <Input type="number" step="0.01" value={hp} onChange={handlePercentChange(setHp)} placeholder={appraisal?.hpPct ?? "0"} data-testid="input-override-hp" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Current Salary</Label>
            <Input type="number" step="0.01" value={salary} onChange={handlePercentChange(setSalary)} placeholder={appraisal?.currentSalary ?? "0"} data-testid="input-override-salary" />
          </div>
          <div className="space-y-2">
            <Label>Assigned Grade</Label>
            <Select value={selectValue} onValueChange={handleBandChange}>
              <SelectTrigger data-testid="select-override-band"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto (snap to nearest)</SelectItem>
                {gradeOptions.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.gradeCode ? `${b.gradeCode} · ` : ""}{b.designationName ? `${b.designationName} · ` : ""}{fmtMoney(b.salaryAmount)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Showing grades from the employee's current grade upward, including higher designations. Typing a Base/HP % or salary drives the preview to the nearest matching grade; picking one here drives the preview instead — whichever you touch last wins, until you touch the other.
            </p>
          </div>
          <div className="space-y-2">
            <Label>New Package Breakdown</Label>
            <GradeBenefitBreakdown currentBand={currentBand} newBand={newBand} />
            {!isManualPick && (
              <p className="text-xs text-muted-foreground">Live preview based on current inputs. Saving re-snaps to the nearest grade, which may differ if inputs change.</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={mutation.isPending} data-testid="button-save-override">Save Override</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ======================== APPRAISAL DISPLAY HELPERS ========================
function pctChange(from: string | null | undefined, to: string | null | undefined): number | null {
  const f = parseFloat(from ?? "");
  const t = parseFloat(to ?? "");
  if (!isFinite(f) || !isFinite(t) || f === 0) return null;
  return ((t - f) / f) * 100;
}

// A small coloured up/down pill used for salary movement.
function TrendPill({ pct }: { pct: number | null }) {
  if (pct == null || Math.abs(pct) < 0.005) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" />0%
      </span>
    );
  }
  const up = pct > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium ${
        up
          ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
          : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
      }`}
    >
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {up ? "+" : ""}{pct.toFixed(1)}%
    </span>
  );
}

function cycleLabel(a: AppraisalWithPm): string {
  const end = `${MONTH_NAMES[(a.periodEndMonth ?? 1) - 1] ?? ""} ${a.periodEndYear ?? ""}`.trim();
  const len = a.periodMonths === 12 ? "Annual" : `${a.periodMonths}-Month`;
  return `${len} appraisal · ending ${end}`;
}

// ======================== APPRAISALS RESULTS ========================
// Renders a stored AI performance analysis. Reused across the admin dropdown and
// (later) the per-employee report page.
function AppraisalAiAnalysisView({ analysis, id }: { analysis: AppraisalAiAnalysis; id: string }) {
  const sections: { key: keyof AppraisalAiAnalysis; label: string; icon: typeof Sparkles; tone: string }[] = [
    { key: "strengths", label: "Strengths", icon: CheckCircle2, tone: "text-green-600 dark:text-green-400" },
    { key: "improvements", label: "Areas for improvement", icon: Target, tone: "text-amber-600 dark:text-amber-400" },
    { key: "actionItems", label: "Action items", icon: ListChecks, tone: "text-blue-600 dark:text-blue-400" },
    { key: "plan", label: "Improvement plan", icon: ClipboardList, tone: "text-violet-600 dark:text-violet-400" },
  ];
  return (
    <div className="space-y-3" data-testid={`ai-analysis-${id}`}>
      {analysis.summary && (
        <p className="text-xs leading-relaxed text-foreground" data-testid={`ai-analysis-summary-${id}`}>{analysis.summary}</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {sections.map(({ key, label, icon: Icon, tone }) => {
          const items = analysis[key];
          if (!Array.isArray(items) || items.length === 0) return null;
          return (
            <div key={key} className="rounded-lg border bg-background/60 p-3" data-testid={`ai-analysis-${key}-${id}`}>
              <div className={`mb-1.5 flex items-center gap-1.5 text-xs font-semibold ${tone}`}>
                <Icon className="h-3.5 w-3.5" />{label}
              </div>
              <ul className="space-y-1">
                {items.map((item, i) => (
                  <li key={i} className="flex gap-1.5 text-[11px] leading-snug text-muted-foreground">
                    <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Admin control to create, copy, regenerate, or revoke the private share link
// for an appraisal's performance report. The token lives on the appraisal row.
function ShareLinkActions({ appraisal }: { appraisal: AppraisalWithPm }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const hasToken = !!appraisal.shareToken;

  const generate = useMutation({
    mutationFn: () => apiRequest("POST", `/api/kpi/appraisals/${appraisal.id}/share-link`, {}),
    onSuccess: async (res) => {
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/kpi/appraisals"] });
      const url = `${window.location.origin}${data.path}`;
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast({ title: "Share link copied", description: "Anyone with this link can view the report without logging in." });
      } catch {
        toast({ title: "Share link ready", description: url });
      }
    },
    onError: (e: any) => toast({ title: "Couldn't create share link", description: e.message, variant: "destructive" }),
  });

  const revoke = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/kpi/appraisals/${appraisal.id}/share-link`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kpi/appraisals"] });
      toast({ title: "Share link revoked", description: "The old link no longer works." });
    },
    onError: (e: any) => toast({ title: "Couldn't revoke share link", description: e.message, variant: "destructive" }),
  });

  const copyExisting = async () => {
    if (!appraisal.shareToken) return;
    const url = `${window.location.origin}/r/appraisal/${appraisal.shareToken}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Share link copied" });
    } catch {
      toast({ title: "Share link", description: url });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className={`h-8 w-8 ${hasToken ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
          data-testid={`button-share-link-${appraisal.id}`}
          title={hasToken ? "Share link active" : "Create share link"}
          aria-label="Performance report share link"
        >
          {hasToken ? <Link2 className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {hasToken ? (
          <>
            <DropdownMenuItem onClick={copyExisting} data-testid={`menu-copy-link-${appraisal.id}`}>
              {copied ? <Check className="h-4 w-4 mr-2 text-green-600" /> : <Copy className="h-4 w-4 mr-2" />}
              Copy share link
            </DropdownMenuItem>
            <a href={`/r/appraisal/${appraisal.shareToken}`} target="_blank" rel="noopener noreferrer">
              <DropdownMenuItem data-testid={`menu-open-link-${appraisal.id}`}>
                <ExternalLink className="h-4 w-4 mr-2" />Open report
              </DropdownMenuItem>
            </a>
            <DropdownMenuItem onClick={() => generate.mutate()} disabled={generate.isPending} data-testid={`menu-regenerate-link-${appraisal.id}`}>
              <RefreshCw className={`h-4 w-4 mr-2 ${generate.isPending ? "animate-spin" : ""}`} />Regenerate link
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => revoke.mutate()} disabled={revoke.isPending} className="text-red-600 focus:text-red-600" data-testid={`menu-revoke-link-${appraisal.id}`}>
              <Trash className="h-4 w-4 mr-2" />Revoke link
            </DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem onClick={() => generate.mutate()} disabled={generate.isPending} data-testid={`menu-create-link-${appraisal.id}`}>
            <Link2 className={`h-4 w-4 mr-2 ${generate.isPending ? "animate-pulse" : ""}`} />Create & copy share link
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AppraisalsResults({ canManage }: { canManage: boolean }) {
  const { toast } = useToast();
  const now = new Date();
  const [periodMonths, setPeriodMonths] = useState(12);
  const [endMonth, setEndMonth] = useState(now.getMonth() + 1);
  const [endYear, setEndYear] = useState(now.getFullYear());
  const [overrideTarget, setOverrideTarget] = useState<AppraisalWithPm | null>(null);
  const [showRolloutIntro, setShowRolloutIntro] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const { data: appraisals = [], isLoading } = useQuery<AppraisalWithPm[]>({
    queryKey: ["/api/kpi/appraisals", periodMonths, endMonth, endYear],
    queryFn: async () => {
      const res = await fetch(`/api/kpi/appraisals?periodMonths=${periodMonths}&periodEndMonth=${endMonth}&periodEndYear=${endYear}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch appraisals");
      return res.json();
    },
  });

  const { data: bands = [] } = useQuery<SalaryGradeBand[]>({ queryKey: ["/api/kpi/grade-bands"] });
  const { data: grades = [] } = useQuery<Grade[]>({ queryKey: ["/api/kpi/grades"] });

  const generateMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/kpi/appraisals/generate", { periodMonths, periodEndMonth: endMonth, periodEndYear: endYear }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/kpi/appraisals"] }); toast({ title: "Appraisals generated" }); },
    onError: (e: any) => toast({ title: "Failed to generate", description: e.message, variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => apiRequest("PATCH", `/api/kpi/appraisals/${id}`, { status }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/kpi/appraisals"] }); },
    onError: (e: any) => toast({ title: "Failed to update status", description: e.message, variant: "destructive" }),
  });

  const overrideMutation = useMutation({
    mutationFn: ({ id, eligibilityOverride }: { id: string; eligibilityOverride: boolean }) =>
      apiRequest("PATCH", `/api/kpi/appraisals/${id}`, { eligibilityOverride }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/kpi/appraisals"] });
      toast({ title: vars.eligibilityOverride ? "Eligibility override applied" : "Override removed" });
    },
    onError: (e: any) => toast({ title: "Failed to update eligibility override", description: e.message, variant: "destructive" }),
  });

  const aiMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/kpi/appraisals/${id}/ai-analysis`, {}),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/kpi/appraisals"] }); toast({ title: "AI analysis ready" }); },
    onError: (e: any) => toast({ title: "Couldn't generate analysis", description: e.message, variant: "destructive" }),
  });

  const years = [now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];
  const eligibleCount = appraisals.filter((a) => a.eligible).length;
  const totalIncrement = appraisals.reduce((s, a) => s + (a.finalIncrement ? parseFloat(a.finalIncrement) : 0), 0);
  const bandsById = new Map(bands.map((b) => [b.id, b]));
  const colSpan = canManage ? 8 : 7;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-end gap-4 flex-wrap">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Cycle Length</Label>
              <Select value={String(periodMonths)} onValueChange={(v) => setPeriodMonths(Number(v))}>
                <SelectTrigger className="w-36" data-testid="select-cycle-length"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="6">6 Months</SelectItem>
                  <SelectItem value="12">1 Year</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Cycle End Month</Label>
              <Select value={String(endMonth)} onValueChange={(v) => setEndMonth(Number(v))}>
                <SelectTrigger className="w-40" data-testid="select-cycle-month"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Cycle End Year</Label>
              <Select value={String(endYear)} onValueChange={(v) => setEndYear(Number(v))}>
                <SelectTrigger className="w-28" data-testid="select-cycle-year"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {canManage && (
              <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending} data-testid="button-generate-appraisals">
                <RefreshCw className={`h-4 w-4 mr-1 ${generateMutation.isPending ? "animate-spin" : ""}`} />
                {appraisals.length > 0 ? "Regenerate" : "Generate"}
              </Button>
            )}
            {canManage && appraisals.length > 0 && (
              <Button variant="outline" onClick={() => setShowRolloutIntro(true)} data-testid="button-open-rollout-console">
                <Rocket className="h-4 w-4 mr-1" />Full Roll Out
              </Button>
            )}
          </div>
          {canManage && (
            <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground" data-testid="text-regenerate-hint">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500" />
              <span>Added or changed KPI scores for past months in the appraisal period? Click {appraisals.length > 0 ? "Regenerate" : "Generate"} to update these results — appraisals don't recompute on their own.</span>
            </p>
          )}
        </CardContent>
      </Card>

      {appraisals.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border bg-gradient-to-br from-blue-50 to-blue-100/40 dark:from-blue-950/40 dark:to-blue-900/10 p-4 flex items-center gap-3" data-testid="stat-reviewed">
            <div className="rounded-lg bg-blue-500/15 p-2"><Users className="h-5 w-5 text-blue-600 dark:text-blue-400" /></div>
            <div>
              <div className="text-2xl font-bold leading-none">{appraisals.length}</div>
              <div className="text-xs text-muted-foreground mt-1">People reviewed</div>
            </div>
          </div>
          <div className="rounded-xl border bg-gradient-to-br from-green-50 to-green-100/40 dark:from-green-950/40 dark:to-green-900/10 p-4 flex items-center gap-3" data-testid="stat-eligible">
            <div className="rounded-lg bg-green-500/15 p-2"><CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" /></div>
            <div>
              <div className="text-2xl font-bold leading-none">{eligibleCount}<span className="text-base font-medium text-muted-foreground"> / {appraisals.length}</span></div>
              <div className="text-xs text-muted-foreground mt-1">Eligible for increment</div>
            </div>
          </div>
          <div className="rounded-xl border bg-gradient-to-br from-emerald-50 to-emerald-100/40 dark:from-emerald-950/40 dark:to-emerald-900/10 p-4 flex items-center gap-3" data-testid="stat-total-increment">
            <div className="rounded-lg bg-emerald-500/15 p-2"><Wallet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /></div>
            <div>
              <div className="text-2xl font-bold leading-none text-emerald-700 dark:text-emerald-400">{fmtMoney(totalIncrement)}</div>
              <div className="text-xs text-muted-foreground mt-1">Total annual increment</div>
            </div>
          </div>
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : appraisals.length === 0 ? (
            <p className="text-muted-foreground text-sm py-12 text-center">
              No appraisals for this cycle yet.{canManage ? " Click Generate to compute them." : ""}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-3 pr-2 font-medium w-6"></th>
                    <th className="py-3 pr-8 font-medium">Person</th>
                    <th className="py-3 pr-8 font-medium text-right">Score</th>
                    <th className="py-3 pr-8 font-medium text-center">Service</th>
                    <th className="py-3 pr-8 font-medium text-center">Eligible</th>
                    <th className="py-3 pr-8 font-medium">Salary</th>
                    <th className="py-3 pr-8 font-medium text-right">Increment</th>
                    {canManage && <th className="py-3 pr-2 font-medium text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {appraisals.map((a) => {
                    const name = `${a.pm?.firstName || ""} ${a.pm?.lastName || ""}`.trim() || a.pm?.email || "Unknown";
                    const isOpen = expanded.has(a.id);
                    const currentBand = a.currentGradeBandId ? bandsById.get(a.currentGradeBandId) : null;
                    const newBand = a.assignedBandId ? bandsById.get(a.assignedBandId) : null;
                    const salaryPct = pctChange(a.currentSalary, a.assignedSalary);
                    const avgN = parseFloat(a.averageScore ?? "");
                    const tgtN = parseFloat(a.targetScore ?? "");
                    const scoreAbove = isFinite(avgN) && isFinite(tgtN) ? avgN >= tgtN : null;
                    return (
                      <Fragment key={a.id}>
                      <tr className={`border-b transition-colors hover:bg-muted/40 ${a.eligible ? "border-l-2 border-l-green-500" : "border-l-2 border-l-transparent"}`} data-testid={`row-appraisal-${a.id}`}>
                        <td className="py-3.5 pr-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => toggleExpanded(a.id)}
                            data-testid={`button-expand-appraisal-${a.id}`}
                            title={isOpen ? "Hide package breakdown" : "Show package breakdown"}
                          >
                            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </Button>
                        </td>
                        <td className="py-3.5 pr-8">
                          <div className="flex items-center gap-2">
                            <div>
                              <div className="font-medium leading-tight">{name}</div>
                              <div className="text-xs text-muted-foreground leading-tight">{a.gradeName || "—"}</div>
                            </div>
                            {a.status === "rolled_out" ? (
                              <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary" title="Rolled out — final decision applied">
                                <Rocket className="h-3 w-3 shrink-0" />Rolled out
                              </span>
                            ) : a.status === "finalized" ? (
                              <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300" title="Finalized">
                                <Lock className="h-3 w-3 shrink-0" />Final
                              </span>
                            ) : (
                              <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-amber-400/60 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400" title="Draft">
                                Draft
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 pr-8 text-right whitespace-nowrap">
                          <span className="inline-flex items-center justify-end gap-1">
                            {scoreAbove === true && <TrendingUp className="h-3.5 w-3.5 text-green-600 dark:text-green-400 shrink-0" />}
                            {scoreAbove === false && <TrendingDown className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                            <span className={scoreAbove === true ? "text-green-600 dark:text-green-400 font-semibold" : scoreAbove === false ? "text-red-500 font-semibold" : "font-semibold"}>{fmtScore(a.averageScore)}</span>
                            <span className="text-xs text-muted-foreground">/ {fmtScore(a.targetScore)}</span>
                          </span>
                        </td>
                        <td className="py-3.5 pr-8 text-center text-muted-foreground whitespace-nowrap">{a.servedMonths != null ? `${a.servedMonths} mo` : "—"}</td>
                        <td className="py-3.5 pr-8 text-center">
                          <div className="flex flex-col items-center gap-1">
                            {a.eligible ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300"><CheckCircle2 className="h-3.5 w-3.5" />{a.eligibilityOverride ? "Yes (Override)" : "Yes"}</span>
                            ) : (
                              <HoverCard openDelay={150}>
                                <HoverCardTrigger asChild>
                                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 cursor-help dark:bg-red-900/40 dark:text-red-300"><XCircle className="h-3.5 w-3.5" />No</span>
                                </HoverCardTrigger>
                                <HoverCardContent className="text-xs w-64">{a.eligibilityReason || "Not eligible"}</HoverCardContent>
                              </HoverCard>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 pr-8">
                          <div className="flex items-center gap-2 whitespace-nowrap">
                            <span className="text-muted-foreground">{fmtMoney(a.currentSalary)}</span>
                            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                            <span className="font-semibold">{fmtMoney(a.assignedSalary)}</span>
                            {(a.salaryOverridden || a.bandOverridden) && <span className="text-amber-500" title="Overridden">*</span>}
                            {a.eligible && <TrendPill pct={salaryPct} />}
                          </div>
                          {(a.currentGradeCode || a.assignedGradeCode) && (
                            <div className="text-xs text-muted-foreground whitespace-nowrap">{a.currentGradeCode || "—"} → {a.assignedGradeCode || "—"}</div>
                          )}
                        </td>
                        <td className="py-3.5 pr-8 text-right whitespace-nowrap">
                          {a.finalIncrement && parseFloat(a.finalIncrement) > 0 ? (
                            <span className="inline-flex items-center justify-end gap-1 font-semibold text-emerald-600 dark:text-emerald-400"><TrendingUp className="h-3.5 w-3.5" />{fmtMoney(a.finalIncrement)}</span>
                          ) : (
                            <span className="text-muted-foreground">{fmtMoney(a.finalIncrement)}</span>
                          )}
                        </td>
                        {canManage && (
                          <td className="py-3.5 pr-2">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                onClick={() => setOverrideTarget(a)}
                                disabled={a.status === "rolled_out"}
                                data-testid={`button-override-${a.id}`}
                                title={a.status === "rolled_out" ? "Locked — appraisal rolled out" : "Override appraisal"}
                                aria-label="Override appraisal"
                              >
                                <SlidersHorizontal className="h-4 w-4" />
                              </Button>
                              {a.status !== "rolled_out" && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className={`h-8 w-8 ${a.eligibilityOverride ? "text-amber-600 hover:text-amber-700 dark:text-amber-400" : "text-muted-foreground hover:text-foreground"}`}
                                  onClick={() => overrideMutation.mutate({ id: a.id, eligibilityOverride: !a.eligibilityOverride })}
                                  data-testid={`button-eligibility-override-${a.id}`}
                                  title={a.eligibilityOverride ? "Remove tenure override — eligibility will go back to being based on months served" : "Force eligible — bypasses only the 1-year tenure requirement; the score must still meet the target"}
                                  aria-label={a.eligibilityOverride ? "Remove eligibility override" : "Force eligible (bypass tenure requirement)"}
                                >
                                  {a.eligibilityOverride ? <ShieldOff className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                                </Button>
                              )}
                              <ShareLinkActions appraisal={a} />
                              {a.status === "rolled_out" ? (
                                <UndoRolloutButton appraisal={a} />
                              ) : a.status === "finalized" ? (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-green-600 hover:text-green-700 dark:text-green-400"
                                  onClick={() => statusMutation.mutate({ id: a.id, status: "draft" })}
                                  data-testid={`button-unfinalize-${a.id}`}
                                  title="Unlock (revert to draft)"
                                  aria-label="Unlock appraisal (revert to draft)"
                                >
                                  <Unlock className="h-4 w-4" />
                                </Button>
                              ) : (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400"
                                  onClick={() => statusMutation.mutate({ id: a.id, status: "finalized" })}
                                  data-testid={`button-finalize-${a.id}`}
                                  title="Finalize"
                                  aria-label="Finalize appraisal"
                                >
                                  <Lock className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                      {isOpen && (
                        <tr className="border-b bg-muted/10" data-testid={`row-appraisal-breakdown-${a.id}`}>
                          <td colSpan={colSpan} className="py-3 px-4">
                            <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
                              <span className="inline-flex items-center gap-1.5 text-muted-foreground" data-testid={`text-overall-performance-${a.id}`}>
                                Overall performance:
                                <span className={`font-semibold ${getEfficiencyColor(parseFloat(a.averageScore ?? "0"))}`}>{fmtPct(a.averageScore)}</span>
                                {isFinite(parseFloat(a.averageScore ?? "")) && getEfficiencyBadge(parseFloat(a.averageScore ?? "0"))}
                              </span>
                              <span className="text-muted-foreground">Base increment: <span className="font-medium text-foreground">{fmtPct(a.baseIncrementPct)}</span>{a.baseOverridden && <span className="text-amber-500" title="Overridden">*</span>}</span>
                              <span className="text-muted-foreground">HP: <span className="font-medium text-foreground">{fmtPct(a.hpPct)}</span>{a.hpOverridden && <span className="text-amber-500" title="Overridden">*</span>}</span>
                              <span className="text-muted-foreground">Avg score: <span className="font-medium text-foreground">{fmtScore(a.averageScore)}</span> / {fmtScore(a.targetScore)}</span>
                              <span className="text-muted-foreground">Service: <span className="font-medium text-foreground">{a.servedMonths != null ? `${a.servedMonths} mo` : "—"}</span></span>
                            </div>
                            <p className="mb-3 text-[11px] text-muted-foreground">Overall performance is the average of each in-period month's efficiency across the appraisal period.</p>
                            {!a.eligible && (
                              <div className="mb-3 flex items-start gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300" data-testid={`text-ineligible-reason-${a.id}`}>
                                <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                                <span><span className="font-medium">Not eligible for increment:</span> {a.eligibilityReason || "Does not meet eligibility criteria."}</span>
                              </div>
                            )}
                            <p className="text-xs font-medium mb-2">New package breakdown — {name}</p>
                            <GradeBenefitBreakdown currentBand={currentBand} newBand={newBand} />

                            <div className="mt-4 border-t pt-3">
                              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 text-xs font-semibold">
                                  <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                                  AI performance analysis
                                  {a.aiAnalysisAt && (
                                    <span className="text-[10px] font-normal text-muted-foreground" data-testid={`text-ai-generated-at-${a.id}`}>
                                      · {new Date(a.aiAnalysisAt).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                                {canManage && (
                                  <Button
                                    size="sm"
                                    variant={a.aiAnalysis ? "outline" : "default"}
                                    className="h-7 text-xs"
                                    onClick={() => aiMutation.mutate(a.id)}
                                    disabled={aiMutation.isPending && aiMutation.variables === a.id}
                                    data-testid={`button-analyze-${a.id}`}
                                  >
                                    {aiMutation.isPending && aiMutation.variables === a.id ? (
                                      <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />Analyzing…</>
                                    ) : (
                                      <><Sparkles className="h-3.5 w-3.5 mr-1" />{a.aiAnalysis ? "Re-analyze" : "Analyze"}</>
                                    )}
                                  </Button>
                                )}
                              </div>
                              {a.aiAnalysis ? (
                                <AppraisalAiAnalysisView analysis={a.aiAnalysis} id={a.id} />
                              ) : aiMutation.isPending && aiMutation.variables === a.id ? (
                                <p className="text-xs text-muted-foreground" data-testid={`text-ai-pending-${a.id}`}>Generating analysis from this appraisal's performance data…</p>
                              ) : (
                                <p className="text-xs text-muted-foreground" data-testid={`text-ai-empty-${a.id}`}>
                                  {canManage ? "No analysis yet. Click Analyze to generate one from this appraisal's data." : "No analysis available yet."}
                                </p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <AppraisalOverrideDialog appraisal={overrideTarget} bands={bands} grades={grades} open={!!overrideTarget} onOpenChange={(o) => { if (!o) setOverrideTarget(null); }} />

      <Dialog open={showRolloutIntro} onOpenChange={setShowRolloutIntro}>
        <DialogContent data-testid="dialog-rollout-intro">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Rocket className="h-5 w-5 text-primary" />Full Roll Out</DialogTitle>
            <DialogDescription>
              Open the board console to review every employee's appraisal for this cycle in one place. There you can adjust each person's final grade and salary, then lock and roll out decisions one at a time or all at once.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-3 py-2 text-center">
            <div className="rounded-md border p-3">
              <div className="text-2xl font-bold" data-testid="text-intro-total">{appraisals.length}</div>
              <div className="text-xs text-muted-foreground">Employees</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-intro-eligible">{eligibleCount}</div>
              <div className="text-xs text-muted-foreground">Eligible</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400" data-testid="text-intro-increment">{fmtMoney(totalIncrement)}</div>
              <div className="text-xs text-muted-foreground">Total increment</div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRolloutIntro(false)} data-testid="button-cancel-rollout-intro">Cancel</Button>
            <Link href={`/pmo-kpis/rollout?periodMonths=${periodMonths}&periodEndMonth=${endMonth}&periodEndYear=${endYear}`}>
              <Button data-testid="button-go-rollout-console"><Rocket className="h-4 w-4 mr-1" />Open board console</Button>
            </Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Guarded "Undo rollout" for an accidental rollout. Reverts the appraisal back to
// "finalized", clears the board verdict/comment, and restores the employee's
// pre-rollout grade/pay band. Confirmation-gated since it changes the employee's
// applied grade.
function UndoRolloutButton({ appraisal }: { appraisal: AppraisalWithPm }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const name = `${appraisal.pm?.firstName || ""} ${appraisal.pm?.lastName || ""}`.trim() || appraisal.pm?.email || "this employee";

  const undoMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/kpi/appraisals/${appraisal.id}/undo-rollout`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kpi/appraisals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Rollout undone", description: "The appraisal is back to finalized and the employee's prior grade has been restored." });
      setOpen(false);
    },
    onError: (e: any) => toast({ title: "Couldn't undo rollout", description: e.message, variant: "destructive" }),
  });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8 text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400"
        onClick={() => setOpen(true)}
        data-testid={`button-undo-rollout-${appraisal.id}`}
        title="Undo rollout (revert to finalized)"
        aria-label="Undo rollout"
      >
        <RotateCcw className="h-4 w-4" />
      </Button>
      <AlertDialogContent data-testid={`dialog-undo-rollout-${appraisal.id}`}>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2"><RotateCcw className="h-5 w-5 text-amber-500" />Undo rollout?</AlertDialogTitle>
          <AlertDialogDescription>
            This reverts the appraisal for <span className="font-medium text-foreground">{name}</span> back to finalized. The board's verdict and comment are cleared, and the employee's grade and pay band are restored to their values from before the rollout. Use this only if the rollout was applied by mistake.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid={`button-cancel-undo-rollout-${appraisal.id}`}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); undoMutation.mutate(); }}
            disabled={undoMutation.isPending}
            data-testid={`button-confirm-undo-rollout-${appraisal.id}`}
          >
            {undoMutation.isPending ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Undoing…</> : <><RotateCcw className="h-4 w-4 mr-1" />Undo rollout</>}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ======================== MY APPRAISALS (PM SELF-SERVICE) ========================
function MyAppraisalsView() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const { data: appraisals = [], isLoading } = useQuery<AppraisalWithPm[]>({
    queryKey: ["/api/kpi/appraisals/mine"],
  });
  const { data: bands = [] } = useQuery<SalaryGradeBand[]>({ queryKey: ["/api/kpi/grade-bands"] });
  const bandsById = new Map(bands.map((b) => [b.id, b]));

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center gap-3">
        <Award className="h-6 w-6 text-primary" />
        <div>
          <h2 className="text-lg font-semibold" data-testid="text-my-appraisals-title">My Appraisal</h2>
          <p className="text-sm text-muted-foreground">Your finalized appraisal results appear here once approved.</p>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : appraisals.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <CalendarDays className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="font-medium" data-testid="text-no-appraisals">No finalized appraisal yet</p>
            <p className="text-sm text-muted-foreground mt-1">When your manager finalizes your appraisal, you'll see your increment and new grade here.</p>
          </CardContent>
        </Card>
      ) : (
        appraisals.map((a) => {
          const isOpen = expanded.has(a.id);
          const currentBand = a.currentGradeBandId ? bandsById.get(a.currentGradeBandId) : null;
          const newBand = a.assignedBandId ? bandsById.get(a.assignedBandId) : null;
          const salaryPct = pctChange(a.currentSalary, a.assignedSalary);
          const increment = a.finalIncrement ? parseFloat(a.finalIncrement) : 0;
          return (
            <Card key={a.id} className="overflow-hidden" data-testid={`card-my-appraisal-${a.id}`}>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-5 py-3">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{cycleLabel(a)}</span>
                </div>
                {a.status === "rolled_out" ? (
                  <Badge className="gap-1 border-transparent bg-primary text-primary-foreground hover:bg-primary"><Rocket className="h-3 w-3" />Final decision</Badge>
                ) : (
                  <Badge className="gap-1 border-transparent bg-green-600 text-white hover:bg-green-600"><Lock className="h-3 w-3" />Finalized</Badge>
                )}
              </div>
              <CardContent className="pt-5">
                {a.eligible ? (
                  <div className="mb-4 flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950/40 dark:text-green-300">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="font-medium">Eligible for increment</span>
                  </div>
                ) : (
                  <div className="mb-4 flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                    <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>Not eligible this cycle{a.eligibilityReason ? ` — ${a.eligibilityReason}` : ""}.</span>
                  </div>
                )}

                {(a.finalVerdict || a.boardComment) && (
                  <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3" data-testid={`block-board-decision-${a.id}`}>
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-primary">
                      <MessageSquare className="h-4 w-4" />Board decision
                    </div>
                    {a.finalVerdict && <div className="mt-1 text-sm"><span className="text-muted-foreground">Verdict: </span><span className="font-medium" data-testid={`text-board-verdict-${a.id}`}>{a.finalVerdict}</span></div>}
                    {a.boardComment && <p className="mt-1.5 whitespace-pre-line text-sm text-muted-foreground" data-testid={`text-board-comment-${a.id}`}>{a.boardComment}</p>}
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-xl border p-4">
                    <div className="text-xs text-muted-foreground mb-1">Current salary</div>
                    <div className="text-xl font-bold">{fmtMoney(a.currentSalary)}</div>
                    {a.currentGradeCode && <div className="text-xs text-muted-foreground mt-1">Grade {a.currentGradeCode}</div>}
                  </div>
                  <div className="rounded-xl border p-4 bg-gradient-to-br from-emerald-50 to-emerald-100/30 dark:from-emerald-950/40 dark:to-emerald-900/10">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">New salary</span>
                      {a.eligible && <TrendPill pct={salaryPct} />}
                    </div>
                    <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{fmtMoney(a.assignedSalary)}</div>
                    {a.assignedGradeCode && <div className="text-xs text-muted-foreground mt-1">Grade {a.assignedGradeCode}</div>}
                  </div>
                  <div className="rounded-xl border p-4">
                    <div className="text-xs text-muted-foreground mb-1">Annual increment</div>
                    <div className="inline-flex items-center gap-1 text-xl font-bold text-emerald-600 dark:text-emerald-400">
                      {increment > 0 && <ArrowUpRight className="h-5 w-5" />}{fmtMoney(a.finalIncrement)}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5" data-testid={`text-my-overall-performance-${a.id}`}>
                    Overall performance:
                    <span className={`font-semibold ${getEfficiencyColor(parseFloat(a.averageScore ?? "0"))}`}>{fmtPct(a.averageScore)}</span>
                  </span>
                  <span>Designation: <span className="text-foreground font-medium">{a.gradeName || "—"}</span></span>
                  <span>Avg score: <span className="text-foreground font-medium">{fmtScore(a.averageScore)}</span> (target {fmtScore(a.targetScore)})</span>
                  <span>Service: <span className="text-foreground font-medium">{a.servedMonths != null ? `${a.servedMonths} mo` : "—"}</span></span>
                </div>

                <div className="mt-4">
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="px-2" onClick={() => toggle(a.id)} data-testid={`button-toggle-my-breakdown-${a.id}`}>
                      {isOpen ? <ChevronDown className="h-4 w-4 mr-1" /> : <ChevronRight className="h-4 w-4 mr-1" />}
                      {isOpen ? "Hide package breakdown" : "Show package breakdown"}
                    </Button>
                    <Link href={`/appraisals/${a.id}/report`}>
                      <Button variant="outline" size="sm" className="px-2" data-testid={`button-view-my-report-${a.id}`}>
                        <FileText className="h-4 w-4 mr-1" />View report
                      </Button>
                    </Link>
                  </div>
                  {isOpen && (
                    <div className="mt-2 rounded-lg border bg-muted/10 p-4">
                      <GradeBenefitBreakdown currentBand={currentBand} newBand={newBand} />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}

function AppraisalsTab() {
  const { user } = useAuth();
  const { data: userPermissions } = useQuery<SystemPermission[]>({
    queryKey: ["/api/access/my-permissions"],
    enabled: !!user,
  });
  const isAdminRole = user?.role === "admin" || (user?.role as string) === "administrator";
  const canManage = isAdminRole || (userPermissions?.includes("manage_kpis") ?? false);
  const [section, setSection] = useState("results");

  if (!canManage) {
    return (
      <div className="p-4 sm:p-6">
        <MyAppraisalsView />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <Tabs value={section} onValueChange={setSection}>
        <TabsList className="mb-4">
          <TabsTrigger value="results" data-testid="subtab-appraisals-results"><Award className="h-4 w-4 mr-1" />Appraisals</TabsTrigger>
          <TabsTrigger value="grades" data-testid="subtab-grades"><Star className="h-4 w-4 mr-1" />Designations</TabsTrigger>
          <TabsTrigger value="grade-sheet" data-testid="subtab-grade-sheet"><FileText className="h-4 w-4 mr-1" />Grades</TabsTrigger>
        </TabsList>
        <TabsContent value="results" className="mt-0">
          <AppraisalsResults canManage={canManage} />
        </TabsContent>
        <TabsContent value="grades" className="mt-0">
          <GradesManager />
        </TabsContent>
        <TabsContent value="grade-sheet" className="mt-0">
          <GradeSheetManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ======================== MAIN PMO KPIs PAGE ========================
export default function PmoKpis() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("performance");

  const { data: userPermissions } = useQuery<SystemPermission[]>({
    queryKey: ["/api/access/my-permissions"],
    enabled: !!user,
  });

  const canManage = userPermissions?.includes("manage_kpis") ?? false;

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 sm:p-6 pb-0">
        <div className="flex items-center gap-3 mb-1">
          <BarChart3 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold" data-testid="text-pmo-kpis-title">PMO KPIs</h1>
        </div>
        <p className="text-muted-foreground mb-4">Track and evaluate project manager performance across key parameters</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="px-4 sm:px-6 overflow-x-auto">
          <TabsList data-testid="tabs-pmo-kpis" className="flex-nowrap">
            <TabsTrigger value="performance" data-testid="tab-performance">
              <Star className="h-4 w-4 mr-1" />
              Monthly Performance
            </TabsTrigger>
            <TabsTrigger value="report-card" data-testid="tab-report-card">
              <FileText className="h-4 w-4 mr-1" />
              Report Card
            </TabsTrigger>
            {canManage && (
              <TabsTrigger value="parameters" data-testid="tab-parameters">
                <BarChart3 className="h-4 w-4 mr-1" />
                Parameters
              </TabsTrigger>
            )}
            {canManage && (
              <TabsTrigger value="levels" data-testid="tab-levels">
                <Users className="h-4 w-4 mr-1" />
                PM Levels
              </TabsTrigger>
            )}
            {canManage && (
              <TabsTrigger value="assignments" data-testid="tab-assignments">
                <UserCheck className="h-4 w-4 mr-1" />
                PM Assignments
              </TabsTrigger>
            )}
            <TabsTrigger value="appraisals" data-testid="tab-appraisals">
              <Award className="h-4 w-4 mr-1" />
              Appraisals
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-auto">
          <TabsContent value="performance" className="mt-0">
            <MonthlyPerformanceTab />
          </TabsContent>
          <TabsContent value="report-card" className="mt-0">
            <ReportCardTab />
          </TabsContent>
          {canManage && (
            <TabsContent value="parameters" className="mt-0">
              <ParametersTab />
            </TabsContent>
          )}
          {canManage && (
            <TabsContent value="levels" className="mt-0">
              <LevelsTab />
            </TabsContent>
          )}
          {canManage && (
            <TabsContent value="assignments" className="mt-0">
              <PmAssignmentsTab />
            </TabsContent>
          )}
          <TabsContent value="appraisals" className="mt-0">
            <AppraisalsTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}