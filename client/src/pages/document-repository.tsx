import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, getErrorMessage } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { 
  Filter, 
  X, 
  Search, 
  Plus, 
  MoreHorizontal, 
  FileCheck, 
  Send, 
  Link,
  ExternalLink,
  FileUp,
  Edit2,
  Trash2,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  FolderCheck,
  Mail,
  ChevronsUpDown,
  Check,
  Link2,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type { ProjectSignoff, Project, ProjectMilestone, SignoffStatus, SignoffType, SystemPermission, User } from "@shared/schema";

const SIGNOFF_PHASE_COLUMNS = [
  "Contract",
  "Scope",
  "Design",
  "Alpha",
  "Beta",
  "UAT",
  "Project Completion",
] as const;

type PhaseColumn = typeof SIGNOFF_PHASE_COLUMNS[number];

function matchPhaseColumn(phaseName: string): PhaseColumn | "CR" | "S&M" | null {
  const lower = phaseName.toLowerCase().trim();
  if (lower === "contract" || lower.includes("contract")) return "Contract";
  if (lower === "scope" || lower.includes("scope")) return "Scope";
  if (lower === "design" || lower.includes("design")) return "Design";
  if (lower === "alpha" || lower.includes("alpha")) return "Alpha";
  if (lower === "beta" || lower.includes("beta")) return "Beta";
  if (lower === "uat" || lower.includes("uat")) return "UAT";
  if (lower === "project completion" || lower.includes("completion") || lower.includes("deployment") || lower.includes("handover")) return "Project Completion";
  if (lower.startsWith("cr") || lower.includes("change request")) return "CR";
  if (lower === "s&m" || lower === "sm" || lower.includes("support") || lower.includes("maintenance") || lower.includes("s&m")) return "S&M";
  return null;
}

interface ProjectWithPM extends Project {
  pm?: User | null;
}

interface ProjectSignoffRow {
  projectId: string;
  projectName: string;
  clientName: string;
  phase: string | null;
  pmName: string;
  signoffs: Record<string, SignoffWithProject[]>;
  crSignoffs: SignoffWithProject[];
  smSignoffs: SignoffWithProject[];
}

const signoffStatusConfig: Record<SignoffStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Clock }> = {
  pending: { label: "Pending", variant: "outline", icon: Clock },
  received: { label: "Received", variant: "default", icon: CheckCircle },
  missing: { label: "Missing", variant: "destructive", icon: AlertTriangle },
  not_required: { label: "Not Required", variant: "secondary", icon: XCircle },
};

const signoffTypeConfig: Record<SignoffType, { label: string; icon: typeof Link }> = {
  pandadoc_link: { label: "PandaDoc", icon: Link },
  uploaded_document: { label: "Uploaded", icon: FileUp },
  external_link: { label: "External Link", icon: ExternalLink },
};

interface SignoffWithProject extends ProjectSignoff {
  project?: Project;
  milestone?: ProjectMilestone;
}

interface MissingSignoff {
  projectId: string;
  projectName: string;
  milestoneId: string;
  milestoneName: string;
  milestoneNumber: number;
  paidAmount: string;
  paidDate: string | null;
  pmId: string | null;
  pmEmail?: string;
}

function SignoffStatusBadge({ status }: { status: SignoffStatus }) {
  const config = signoffStatusConfig[status] || { label: status, variant: "secondary" as const, icon: Clock };
  const IconComponent = config.icon;
  return (
    <Badge variant={config.variant} className="gap-1" data-testid={`badge-status-${status}`}>
      <IconComponent className="w-3 h-3" />
      {config.label}
    </Badge>
  );
}

function SignoffTypeBadge({ type }: { type: SignoffType }) {
  const config = signoffTypeConfig[type] || { label: type, icon: Link };
  const IconComponent = config.icon;
  return (
    <Badge variant="outline" className="gap-1" data-testid={`badge-type-${type}`}>
      <IconComponent className="w-3 h-3" />
      {config.label}
    </Badge>
  );
}

const REASSIGN_PHASES = [
  "Contract",
  "Scope",
  "Design",
  "Alpha",
  "Beta",
  "UAT",
  "Project Completion",
  "CR",
  "S&M",
] as const;

function UnmappedSignoffRow({
  signoff,
  onReassign,
  onEdit,
  onDelete,
  canEdit,
  canDelete,
  isPending,
}: {
  signoff: SignoffWithProject;
  onReassign: (id: string, newPhaseName: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  canEdit: boolean;
  canDelete: boolean;
  isPending: boolean;
}) {
  const [selectedPhase, setSelectedPhase] = useState("");
  const url = signoff.pandadocUrl || signoff.externalUrl || null;
  const typeConfig = signoffTypeConfig[signoff.signoffType];
  const statusConfig = signoffStatusConfig[signoff.status];

  return (
    <TableRow data-testid={`row-unmapped-${signoff.id}`}>
      <TableCell className="font-medium text-sm">
        {signoff.project?.name || "Unknown Project"}
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">{signoff.phaseName}</span>
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 underline text-xs hover:opacity-80"
            >
              {url.length > 40 ? url.substring(0, 40) + "..." : url}
            </a>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="gap-1">
          {typeConfig?.icon && <typeConfig.icon className="w-3 h-3" />}
          {typeConfig?.label || signoff.signoffType}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge variant={statusConfig?.variant || "secondary"} className="gap-1">
          {statusConfig?.icon && <statusConfig.icon className="w-3 h-3" />}
          {statusConfig?.label || signoff.status}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Select value={selectedPhase} onValueChange={setSelectedPhase}>
            <SelectTrigger className="w-[160px]" data-testid={`select-reassign-${signoff.id}`}>
              <SelectValue placeholder="Select phase..." />
            </SelectTrigger>
            <SelectContent>
              {REASSIGN_PHASES.map((phase) => (
                <SelectItem key={phase} value={phase}>
                  {phase}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedPhase && (
            <Button
              size="sm"
              onClick={() => onReassign(signoff.id, selectedPhase)}
              disabled={isPending}
              data-testid={`button-reassign-${signoff.id}`}
            >
              <ArrowRight className="w-4 h-4 mr-1" />
              {isPending ? "Saving..." : "Map"}
            </Button>
          )}
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          {canEdit && (
            <Button
              size="icon"
              variant="ghost"
              onClick={onEdit}
              data-testid={`button-edit-unmapped-${signoff.id}`}
            >
              <Edit2 className="w-4 h-4" />
            </Button>
          )}
          {canDelete && (
            <Button
              size="icon"
              variant="ghost"
              onClick={onDelete}
              data-testid={`button-delete-unmapped-${signoff.id}`}
            >
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function DocumentRepository() {
  const { toast } = useToast();
  const [filters, setFilters] = useState({
    status: "",
    projectId: "",
    search: "",
  });
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedSignoff, setSelectedSignoff] = useState<SignoffWithProject | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "missing" | "unmapped">("all");
  const [projectFilterOpen, setProjectFilterOpen] = useState(false);
  
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [isCustomSignoff, setIsCustomSignoff] = useState(false);
  
  const [newSignoff, setNewSignoff] = useState({
    projectId: "",
    milestoneId: "",
    phaseName: "",
    phaseNumber: 0,
    signoffType: "external_link" as SignoffType,
    pandadocUrl: "",
    externalUrl: "",
    documentName: "",
    status: "pending" as SignoffStatus,
    signedBy: "",
    signedDate: "",
    notes: "",
  });

  const queryParams = new URLSearchParams();
  if (filters.status) queryParams.set("status", filters.status);
  if (filters.projectId) queryParams.set("projectId", filters.projectId);

  const { data: signoffs, isLoading } = useQuery<SignoffWithProject[]>({
    queryKey: ["/api/signoffs", filters],
    queryFn: async () => {
      const response = await fetch(`/api/signoffs?${queryParams.toString()}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch signoffs");
      return response.json();
    },
  });

  const { data: missingSignoffs, isLoading: missingLoading } = useQuery<MissingSignoff[]>({
    queryKey: ["/api/signoffs/missing/all"],
  });

  const { data: projects } = useQuery<ProjectWithPM[]>({
    queryKey: ["/api/projects"],
  });

  const { data: userPermissions } = useQuery<SystemPermission[]>({
    queryKey: ["/api/access/my-permissions"],
  });

  const canCreateSignoffs = userPermissions?.includes("create_signoffs") ?? false;
  const canEditSignoffs = userPermissions?.includes("edit_signoffs") ?? false;
  const canDeleteSignoffs = userPermissions?.includes("delete_signoffs") ?? false;
  const canSendReminders = userPermissions?.includes("send_signoff_reminders") ?? false;

  const selectedProject = projects?.find(p => p.id === newSignoff.projectId);

  const { data: milestones } = useQuery<ProjectMilestone[]>({
    queryKey: ["/api/projects", newSignoff.projectId, "milestones"],
    queryFn: async () => {
      if (!newSignoff.projectId) return [];
      const response = await fetch(`/api/projects/${newSignoff.projectId}/milestones`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch milestones");
      return response.json();
    },
    enabled: !!newSignoff.projectId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof newSignoff) => {
      // Convert empty milestoneId to null for custom signoffs
      const payload = {
        ...data,
        milestoneId: data.milestoneId || null,
      };
      const response = await apiRequest("POST", "/api/signoffs", payload);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Signoff created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/signoffs"] });
      setIsCreateDialogOpen(false);
      resetNewSignoff();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: getErrorMessage(error, "Failed to create signoff"), variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof newSignoff> }) => {
      const response = await apiRequest("PUT", `/api/signoffs/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Signoff updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/signoffs"] });
      setIsEditDialogOpen(false);
      setSelectedSignoff(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: getErrorMessage(error, "Failed to update signoff"), variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/signoffs/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Signoff deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/signoffs"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: getErrorMessage(error, "Failed to delete signoff"), variant: "destructive" });
    },
  });

  const sendReminderMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/signoffs/${id}/send-reminder`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Reminder sent successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/signoffs"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: getErrorMessage(error, "Failed to send reminder"), variant: "destructive" });
    },
  });

  function resetNewSignoff() {
    setNewSignoff({
      projectId: "",
      milestoneId: "",
      phaseName: "",
      phaseNumber: 0,
      signoffType: "external_link",
      pandadocUrl: "",
      externalUrl: "",
      documentName: "",
      status: "pending",
      signedBy: "",
      signedDate: "",
      notes: "",
    });
    setIsCustomSignoff(false);
  }

  const STATIC_PHASES = [
    "Contract",
    "Scope",
    "Design",
    "Alpha",
    "Beta",
    "UAT",
    "Project Completion",
    "CR",
    "S&M",
  ];

  function handleMilestoneSelect(value: string) {
    if (value.startsWith("static:")) {
      const phaseName = value.replace("static:", "");
      setNewSignoff(prev => ({
        ...prev,
        milestoneId: "",
        phaseName,
        phaseNumber: STATIC_PHASES.indexOf(phaseName) + 1,
      }));
    } else {
      const milestone = milestones?.find(m => m.id === value);
      if (milestone) {
        setNewSignoff(prev => ({
          ...prev,
          milestoneId: value,
          phaseName: milestone.name,
          phaseNumber: milestone.sequenceNumber || milestone.phaseNumber || 1,
        }));
      }
    }
  }

  function openEditDialog(signoff: SignoffWithProject) {
    setSelectedSignoff(signoff);
    setNewSignoff({
      projectId: signoff.projectId,
      milestoneId: signoff.milestoneId || "",
      phaseName: signoff.phaseName,
      phaseNumber: signoff.phaseNumber || 1,
      signoffType: signoff.signoffType,
      pandadocUrl: signoff.pandadocUrl || "",
      externalUrl: signoff.externalUrl || "",
      documentName: signoff.documentName || "",
      status: signoff.status,
      signedBy: signoff.signedBy || "",
      signedDate: signoff.signedDate ? format(new Date(signoff.signedDate), "yyyy-MM-dd") : "",
      notes: signoff.notes || "",
    });
    setIsEditDialogOpen(true);
  }

  const filteredSignoffs = signoffs?.filter(s => {
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      return (
        s.phaseName.toLowerCase().includes(searchLower) ||
        s.project?.name?.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  const unmappedSignoffs = useMemo(() => {
    if (!signoffs) return [];
    return signoffs.filter(s => {
      const column = matchPhaseColumn(s.phaseName);
      return column === null;
    });
  }, [signoffs]);

  const stats = {
    total: signoffs?.length || 0,
    received: signoffs?.filter(s => s.status === "received").length || 0,
    pending: signoffs?.filter(s => s.status === "pending").length || 0,
    missing: missingSignoffs?.length || 0,
    unmapped: unmappedSignoffs.length,
  };

  const projectSignoffMatrix: ProjectSignoffRow[] = useMemo(() => {
    if (!projects || !signoffs) return [];

    const projectMap = new Map<string, ProjectSignoffRow>();

    for (const project of projects) {
      const pmName = project.pm
        ? `${project.pm.firstName || ""} ${project.pm.lastName || ""}`.trim() || (project.pm.email || "")
        : "";
      projectMap.set(project.id, {
        projectId: project.id,
        projectName: project.name,
        clientName: project.clientName,
        phase: project.phase || project.status || null,
        pmName,
        signoffs: {},
        crSignoffs: [],
        smSignoffs: [],
      });
    }

    for (const signoff of signoffs) {
      const row = projectMap.get(signoff.projectId);
      if (!row) continue;

      const column = matchPhaseColumn(signoff.phaseName);
      if (column === "CR") {
        row.crSignoffs.push(signoff);
      } else if (column === "S&M") {
        row.smSignoffs.push(signoff);
      } else if (column) {
        if (!row.signoffs[column]) row.signoffs[column] = [];
        row.signoffs[column].push(signoff);
      } else {
        if (!row.signoffs[signoff.phaseName]) row.signoffs[signoff.phaseName] = [];
        row.signoffs[signoff.phaseName].push(signoff);
      }
    }

    return Array.from(projectMap.values()).filter(row => {
      const hasAnySignoff = Object.keys(row.signoffs).length > 0 || row.crSignoffs.length > 0 || row.smSignoffs.length > 0;
      if (filters.projectId && row.projectId !== filters.projectId) return false;
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        if (!row.projectName.toLowerCase().includes(searchLower) && !row.clientName.toLowerCase().includes(searchLower)) return false;
      }
      return true;
    });
  }, [projects, signoffs, filters.projectId, filters.search]);

  function getSignoffUrl(signoff: SignoffWithProject): string | null {
    return signoff.pandadocUrl || signoff.externalUrl || null;
  }

  function renderSignoffCell(signoffsForPhase: SignoffWithProject[] | undefined) {
    if (!signoffsForPhase || signoffsForPhase.length === 0) {
      return null;
    }
    const signoff = signoffsForPhase[0];
    const url = getSignoffUrl(signoff);

    let statusContent: React.ReactNode;
    if (url) {
      statusContent = (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 underline text-sm hover:opacity-80"
          data-testid={`link-signoff-${signoff.id}`}
          onClick={(e) => e.stopPropagation()}
        >
          Link
        </a>
      );
    } else if (signoff.status === "received") {
      statusContent = <span className="text-green-600 dark:text-green-400 text-sm font-medium">Received</span>;
    } else if (signoff.status === "not_required") {
      statusContent = <span className="text-muted-foreground text-sm">N/A</span>;
    } else {
      statusContent = (
        <span className="text-muted-foreground text-sm" data-testid={`missing-signoff-${signoff.id}`}>
          Missing
        </span>
      );
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="inline-flex items-center gap-1 cursor-pointer rounded px-1.5 py-0.5 hover-elevate focus:outline-none"
            data-testid={`button-signoff-actions-${signoff.id}`}
          >
            {statusContent}
            <MoreHorizontal className="w-3 h-3 text-muted-foreground shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center">
          {(signoff.pandadocUrl || signoff.externalUrl) && (
            <>
              <DropdownMenuItem
                onClick={() => {
                  const url = signoff.pandadocUrl || signoff.externalUrl || "";
                  const finalUrl = url.startsWith("http") ? url : `https://${url}`;
                  window.open(finalUrl, "_blank", "noopener,noreferrer");
                }}
                data-testid={`button-open-link-${signoff.id}`}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open Link
              </DropdownMenuItem>
              {(canEditSignoffs || canDeleteSignoffs) && <DropdownMenuSeparator />}
            </>
          )}
          {canEditSignoffs && (
            <DropdownMenuItem
              onClick={() => openEditDialog(signoff)}
              data-testid={`button-edit-signoff-${signoff.id}`}
            >
              <Edit2 className="w-4 h-4 mr-2" />
              Edit
            </DropdownMenuItem>
          )}
          {canDeleteSignoffs && (
            <>
              {canEditSignoffs && <DropdownMenuSeparator />}
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => {
                  if (confirm("Are you sure you want to delete this signoff?")) {
                    deleteMutation.mutate(signoff.id);
                  }
                }}
                data-testid={`button-delete-signoff-${signoff.id}`}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </>
          )}
          {!canEditSignoffs && !canDeleteSignoffs && (
            <DropdownMenuItem disabled>
              No actions available
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  function renderMissingCell() {
    return (
      <span className="text-muted-foreground text-sm">
        Missing
      </span>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <FolderCheck className="w-8 h-8 text-primary" />
            Document Repository
          </h1>
          <p className="text-muted-foreground">Manage project phase signoffs and customer approvals</p>
        </div>
        <div className="flex items-center gap-2">
          {canCreateSignoffs && (
            <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-signoff">
              <Plus className="w-4 h-4 mr-2" />
              New Signoff
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Signoffs</CardTitle>
            <FileCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-signoffs">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Received</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-received-signoffs">{stats.received}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600" data-testid="text-pending-signoffs">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Missing</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive" data-testid="text-missing-signoffs">{stats.missing}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-2 border-b">
        <Button
          variant={activeTab === "all" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("all")}
          data-testid="tab-all"
        >
          All Signoffs
        </Button>
        <Button
          variant={activeTab === "missing" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("missing")}
          className="gap-2"
          data-testid="tab-missing"
        >
          Missing Signoffs
          {stats.missing > 0 && (
            <Badge variant="destructive" className="text-xs">{stats.missing}</Badge>
          )}
        </Button>
        <Button
          variant={activeTab === "unmapped" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("unmapped")}
          className="gap-2"
          data-testid="tab-unmapped"
        >
          Unmapped Records
          {stats.unmapped > 0 && (
            <Badge variant="outline" className="text-xs">{stats.unmapped}</Badge>
          )}
        </Button>
      </div>

      {activeTab === "all" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle>Project Signoff Matrix</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search projects..."
                  value={filters.search}
                  onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
                  className="w-64 pl-8"
                  data-testid="input-search"
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowFilters(!showFilters)}
                data-testid="button-toggle-filters"
              >
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          
          {showFilters && (
            <div className="px-6 pb-4 flex flex-wrap gap-4 items-end">
              <div className="w-64">
                <Label className="text-xs">Project</Label>
                <Popover open={projectFilterOpen} onOpenChange={setProjectFilterOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={projectFilterOpen}
                      className="w-full justify-between font-normal"
                      data-testid="button-filter-project"
                    >
                      {filters.projectId
                        ? projects?.find(p => p.id === filters.projectId)?.name || "Select project..."
                        : "All Projects"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search projects..." />
                      <CommandList>
                        <CommandEmpty>No project found.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="all-projects"
                            onSelect={() => {
                              setFilters(f => ({ ...f, projectId: "" }));
                              setProjectFilterOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", filters.projectId === "" ? "opacity-100" : "opacity-0")} />
                            All Projects
                          </CommandItem>
                          {projects?.map(p => (
                            <CommandItem
                              key={p.id}
                              value={p.name}
                              onSelect={() => {
                                setFilters(f => ({ ...f, projectId: p.id }));
                                setProjectFilterOpen(false);
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", filters.projectId === p.id ? "opacity-100" : "opacity-0")} />
                              {p.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilters({ status: "", projectId: "", search: "" })}
                data-testid="button-clear-filters"
              >
                <X className="w-4 h-4 mr-1" />
                Clear
              </Button>
            </div>
          )}

          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : projectSignoffMatrix.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileCheck className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No projects found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[140px] sticky left-0 z-10 bg-background">Client Details</TableHead>
                      <TableHead className="min-w-[140px]">Project</TableHead>
                      <TableHead className="min-w-[100px]">Phase</TableHead>
                      <TableHead className="min-w-[130px]">Project Manager</TableHead>
                      <TableHead className="text-center min-w-[110px]">Contract (BDM)</TableHead>
                      <TableHead className="text-center min-w-[100px]">Scope (PM)</TableHead>
                      <TableHead className="text-center min-w-[100px]">Design (PM)</TableHead>
                      <TableHead className="text-center min-w-[100px]">Alpha (PM)</TableHead>
                      <TableHead className="text-center min-w-[100px]">Beta (PM)</TableHead>
                      <TableHead className="text-center min-w-[100px]">UAT (PM)</TableHead>
                      <TableHead className="text-center min-w-[140px]">Deployment + Handover (PM)</TableHead>
                      <TableHead className="text-center min-w-[120px]">CR</TableHead>
                      <TableHead className="text-center min-w-[120px]">S&M</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projectSignoffMatrix.map((row) => (
                      <TableRow key={row.projectId} data-testid={`row-project-${row.projectId}`}>
                        <TableCell className="font-medium text-sm sticky left-0 z-10 bg-background">
                          {row.clientName}
                        </TableCell>
                        <TableCell className="text-sm">{row.projectName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{row.phase || "—"}</TableCell>
                        <TableCell className="text-sm">{row.pmName || "—"}</TableCell>
                        {SIGNOFF_PHASE_COLUMNS.map((phase) => (
                          <TableCell key={phase} className="text-center">
                            {row.signoffs[phase]
                              ? renderSignoffCell(row.signoffs[phase])
                              : renderMissingCell()
                            }
                          </TableCell>
                        ))}
                        <TableCell className="text-center">
                          {row.crSignoffs.length > 0 ? (
                            <div className="flex flex-col items-center gap-1">
                              {row.crSignoffs.map((cr, idx) => {
                                const url = getSignoffUrl(cr);
                                const crContent = url ? (
                                  <a
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 dark:text-blue-400 underline text-sm hover:opacity-80"
                                    data-testid={`link-cr-${cr.id}`}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {cr.phaseName || `CR ${idx + 1}`}
                                  </a>
                                ) : (
                                  <span className="text-muted-foreground text-sm">
                                    Missing
                                  </span>
                                );
                                return (
                                  <DropdownMenu key={cr.id}>
                                    <DropdownMenuTrigger asChild>
                                      <button
                                        className="inline-flex items-center gap-1 cursor-pointer rounded px-1.5 py-0.5 hover-elevate focus:outline-none"
                                        data-testid={`button-cr-actions-${cr.id}`}
                                      >
                                        {crContent}
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="center">
                                      {url && (
                                        <>
                                          <DropdownMenuItem
                                            onClick={() => {
                                              const finalUrl = url.startsWith("http") ? url : `https://${url}`;
                                              window.open(finalUrl, "_blank", "noopener,noreferrer");
                                            }}
                                            data-testid={`button-open-cr-link-${cr.id}`}
                                          >
                                            <ExternalLink className="w-4 h-4 mr-2" />
                                            Open Link
                                          </DropdownMenuItem>
                                          {(canEditSignoffs || canDeleteSignoffs) && <DropdownMenuSeparator />}
                                        </>
                                      )}
                                      {canEditSignoffs && (
                                        <DropdownMenuItem
                                          onClick={() => openEditDialog(cr)}
                                          data-testid={`button-edit-cr-${cr.id}`}
                                        >
                                          <Edit2 className="w-4 h-4 mr-2" />
                                          Edit
                                        </DropdownMenuItem>
                                      )}
                                      {canDeleteSignoffs && (
                                        <>
                                          {canEditSignoffs && <DropdownMenuSeparator />}
                                          <DropdownMenuItem
                                            className="text-destructive focus:text-destructive"
                                            onClick={() => {
                                              if (confirm("Are you sure you want to delete this signoff?")) {
                                                deleteMutation.mutate(cr.id);
                                              }
                                            }}
                                            data-testid={`button-delete-cr-${cr.id}`}
                                          >
                                            <Trash2 className="w-4 h-4 mr-2" />
                                            Delete
                                          </DropdownMenuItem>
                                        </>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {row.smSignoffs.length > 0 ? (
                            <div className="flex flex-col items-center gap-1">
                              {row.smSignoffs.map((sm, idx) => {
                                const url = getSignoffUrl(sm);
                                const smContent = url ? (
                                  <a
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 dark:text-blue-400 underline text-sm hover:opacity-80"
                                    data-testid={`link-sm-${sm.id}`}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {sm.phaseName || `S&M ${idx + 1}`}
                                  </a>
                                ) : (
                                  <span className="text-muted-foreground text-sm">
                                    Missing
                                  </span>
                                );
                                return (
                                  <DropdownMenu key={sm.id}>
                                    <DropdownMenuTrigger asChild>
                                      <button
                                        className="inline-flex items-center gap-1 cursor-pointer rounded px-1.5 py-0.5 hover-elevate focus:outline-none"
                                        data-testid={`button-sm-actions-${sm.id}`}
                                      >
                                        {smContent}
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="center">
                                      {url && (
                                        <>
                                          <DropdownMenuItem
                                            onClick={() => {
                                              const finalUrl = url.startsWith("http") ? url : `https://${url}`;
                                              window.open(finalUrl, "_blank", "noopener,noreferrer");
                                            }}
                                            data-testid={`button-open-sm-link-${sm.id}`}
                                          >
                                            <ExternalLink className="w-4 h-4 mr-2" />
                                            Open Link
                                          </DropdownMenuItem>
                                          {(canEditSignoffs || canDeleteSignoffs) && <DropdownMenuSeparator />}
                                        </>
                                      )}
                                      {canEditSignoffs && (
                                        <DropdownMenuItem
                                          onClick={() => openEditDialog(sm)}
                                          data-testid={`button-edit-sm-${sm.id}`}
                                        >
                                          <Edit2 className="w-4 h-4 mr-2" />
                                          Edit
                                        </DropdownMenuItem>
                                      )}
                                      {canDeleteSignoffs && (
                                        <>
                                          {canEditSignoffs && <DropdownMenuSeparator />}
                                          <DropdownMenuItem
                                            className="text-destructive focus:text-destructive"
                                            onClick={() => {
                                              if (confirm("Are you sure you want to delete this signoff?")) {
                                                deleteMutation.mutate(sm.id);
                                              }
                                            }}
                                            data-testid={`button-delete-sm-${sm.id}`}
                                          >
                                            <Trash2 className="w-4 h-4 mr-2" />
                                            Delete
                                          </DropdownMenuItem>
                                        </>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "missing" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Missing Signoffs
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Milestones with paid status but no signoff document recorded
            </p>
          </CardHeader>
          <CardContent>
            {missingLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : missingSignoffs?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500 opacity-50" />
                <p>All paid milestones have signoffs recorded</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead>Milestone</TableHead>
                      <TableHead>Paid Amount</TableHead>
                      <TableHead>Paid Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {missingSignoffs?.map((missing) => (
                      <TableRow key={`${missing.projectId}-${missing.milestoneId}`} data-testid={`row-missing-${missing.milestoneId}`}>
                        <TableCell className="font-medium">{missing.projectName}</TableCell>
                        <TableCell>
                          <span className="text-muted-foreground text-xs mr-1">#{missing.milestoneNumber}</span>
                          {missing.milestoneName}
                        </TableCell>
                        <TableCell className="font-mono">
                          ${parseFloat(missing.paidAmount).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {missing.paidDate ? format(new Date(missing.paidDate), "MMM d, yyyy") : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {canCreateSignoffs && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setNewSignoff(prev => ({
                                    ...prev,
                                    projectId: missing.projectId,
                                    milestoneId: missing.milestoneId,
                                    phaseName: missing.milestoneName,
                                    phaseNumber: missing.milestoneNumber,
                                    status: "received",
                                  }));
                                  setIsCreateDialogOpen(true);
                                }}
                                data-testid={`button-add-signoff-${missing.milestoneId}`}
                              >
                                <Plus className="w-3 h-3 mr-1" />
                                Add Signoff
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "unmapped" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-primary" />
              Unmapped Signoff Records
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              These signoff records have phase names that don't match any standard column in the matrix. Reassign them to the correct phase so they appear in the right place.
            </p>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : unmappedSignoffs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500 opacity-50" />
                <p>All signoff records are mapped to standard phases</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Current Phase Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reassign To</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unmappedSignoffs.map((signoff) => (
                    <UnmappedSignoffRow
                      key={signoff.id}
                      signoff={signoff}
                      onReassign={(id: string, newPhaseName: string) => {
                        updateMutation.mutate({
                          id,
                          data: { phaseName: newPhaseName },
                        });
                      }}
                      onEdit={() => openEditDialog(signoff)}
                      onDelete={() => {
                        if (confirm("Are you sure you want to delete this signoff?")) {
                          deleteMutation.mutate(signoff.id);
                        }
                      }}
                      canEdit={canEditSignoffs}
                      canDelete={canDeleteSignoffs}
                      isPending={updateMutation.isPending}
                    />
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
        setIsCreateDialogOpen(open);
        if (!open) setIsCustomSignoff(false);
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Signoff</DialogTitle>
            <DialogDescription>Add a new signoff record for a project phase</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Project</Label>
              <Popover open={createProjectOpen} onOpenChange={setCreateProjectOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={createProjectOpen}
                    className="w-full justify-between font-normal"
                    data-testid="button-select-project"
                  >
                    {newSignoff.projectId
                      ? projects?.find(p => p.id === newSignoff.projectId)?.name
                      : "Select project..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start" style={{ width: "var(--radix-popover-trigger-width)" }}>
                  <Command>
                    <CommandInput placeholder="Search projects..." />
                    <CommandList className="max-h-[200px]">
                      <CommandEmpty>No project found.</CommandEmpty>
                      <CommandGroup>
                        {projects?.map(p => (
                          <CommandItem
                            key={p.id}
                            value={p.name}
                            onSelect={() => {
                              setNewSignoff(prev => ({ ...prev, projectId: p.id, milestoneId: "" }));
                              setCreateProjectOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", newSignoff.projectId === p.id ? "opacity-100" : "opacity-0")} />
                            {p.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {newSignoff.projectId && (
              <>
                <div className="flex items-center gap-4 py-2">
                  <Label className="text-sm font-medium">Signoff Category:</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={!isCustomSignoff ? "default" : "outline"}
                      onClick={() => {
                        setIsCustomSignoff(false);
                        setNewSignoff(prev => ({ ...prev, milestoneId: "", phaseName: "", phaseNumber: 0 }));
                      }}
                      data-testid="button-milestone-signoff"
                    >
                      Phase/Milestone
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={isCustomSignoff ? "default" : "outline"}
                      onClick={() => {
                        setIsCustomSignoff(true);
                        setNewSignoff(prev => ({ ...prev, milestoneId: "", phaseName: "", phaseNumber: 0 }));
                      }}
                      data-testid="button-custom-signoff"
                    >
                      Custom Signoff
                    </Button>
                  </div>
                </div>

                {!isCustomSignoff ? (
                  <div>
                    <Label>Milestone / Phase <span className="text-destructive">*</span></Label>
                    <Select
                      value={newSignoff.milestoneId || (newSignoff.phaseName && STATIC_PHASES.includes(newSignoff.phaseName) ? `static:${newSignoff.phaseName}` : "")}
                      onValueChange={handleMilestoneSelect}
                    >
                      <SelectTrigger data-testid="select-milestone">
                        <SelectValue placeholder="Select phase" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATIC_PHASES.map(phase => (
                          <SelectItem key={`static:${phase}`} value={`static:${phase}`}>
                            {phase}
                          </SelectItem>
                        ))}
                        {milestones && milestones.length > 0 && (
                          <>
                            <SelectItem value="__separator__" disabled>
                              ── Project Milestones ──
                            </SelectItem>
                            {milestones.map(m => (
                              <SelectItem key={m.id} value={m.id}>
                                #{m.sequenceNumber || m.phaseNumber || 1} - {m.name}
                              </SelectItem>
                            ))}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div>
                    <Label>Signoff Name <span className="text-destructive">*</span></Label>
                    <Input
                      value={newSignoff.phaseName}
                      onChange={(e) => setNewSignoff(prev => ({ ...prev, phaseName: e.target.value }))}
                      placeholder="e.g., Agreement, CR Signoff, Completion Agreement"
                      data-testid="input-custom-signoff-name"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Use for agreements or signoffs not tied to a specific milestone
                    </p>
                  </div>
                )}
              </>
            )}

            <div>
              <Label>Signoff Type</Label>
              <Select
                value={newSignoff.signoffType}
                onValueChange={(value: SignoffType) => setNewSignoff(prev => ({ ...prev, signoffType: value }))}
              >
                <SelectTrigger data-testid="select-signoff-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pandadoc_link">PandaDoc Link</SelectItem>
                  <SelectItem value="external_link">External Link</SelectItem>
                  <SelectItem value="uploaded_document">Uploaded Document</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newSignoff.signoffType === "pandadoc_link" && (
              <div>
                <Label>PandaDoc URL</Label>
                <Input
                  value={newSignoff.pandadocUrl}
                  onChange={(e) => setNewSignoff(prev => ({ ...prev, pandadocUrl: e.target.value }))}
                  placeholder="https://app.pandadoc.com/..."
                  data-testid="input-pandadoc-url"
                />
              </div>
            )}

            {newSignoff.signoffType === "external_link" && (
              <div>
                <Label>External URL</Label>
                <Input
                  value={newSignoff.externalUrl}
                  onChange={(e) => setNewSignoff(prev => ({ ...prev, externalUrl: e.target.value }))}
                  placeholder="https://..."
                  data-testid="input-external-url"
                />
              </div>
            )}

            {newSignoff.signoffType === "uploaded_document" && (
              <div>
                <Label>Document Name</Label>
                <Input
                  value={newSignoff.documentName}
                  onChange={(e) => setNewSignoff(prev => ({ ...prev, documentName: e.target.value }))}
                  placeholder="signoff-document.pdf"
                  data-testid="input-document-name"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  File upload coming soon. For now, enter the document reference name.
                </p>
              </div>
            )}

            <div>
              <Label>Status</Label>
              <Select
                value={newSignoff.status}
                onValueChange={(value: SignoffStatus) => setNewSignoff(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger data-testid="select-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="received">Received</SelectItem>
                  <SelectItem value="missing">Missing</SelectItem>
                  <SelectItem value="not_required">Not Required</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newSignoff.status === "received" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Signed By</Label>
                  <Input
                    value={newSignoff.signedBy}
                    onChange={(e) => setNewSignoff(prev => ({ ...prev, signedBy: e.target.value }))}
                    placeholder="Customer name"
                    data-testid="input-signed-by"
                  />
                </div>
                <div>
                  <Label>Signed Date <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input
                    type="date"
                    value={newSignoff.signedDate}
                    onChange={(e) => setNewSignoff(prev => ({ ...prev, signedDate: e.target.value }))}
                    data-testid="input-signed-date"
                  />
                </div>
              </div>
            )}

            <div>
              <Label>Notes</Label>
              <Textarea
                value={newSignoff.notes}
                onChange={(e) => setNewSignoff(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional notes..."
                rows={2}
                data-testid="input-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate(newSignoff)}
              disabled={
                !newSignoff.projectId || 
                !newSignoff.phaseName.trim() ||
                createMutation.isPending
              }
              data-testid="button-submit-signoff"
            >
              {createMutation.isPending ? "Creating..." : "Create Signoff"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Signoff</DialogTitle>
            <DialogDescription>Update the signoff record</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Phase Name</Label>
              <Input
                value={newSignoff.phaseName}
                onChange={(e) => setNewSignoff(prev => ({ ...prev, phaseName: e.target.value }))}
                data-testid="edit-input-phase-name"
              />
            </div>

            <div>
              <Label>Signoff Type</Label>
              <Select
                value={newSignoff.signoffType}
                onValueChange={(value: SignoffType) => setNewSignoff(prev => ({ ...prev, signoffType: value }))}
              >
                <SelectTrigger data-testid="edit-select-signoff-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pandadoc_link">PandaDoc Link</SelectItem>
                  <SelectItem value="external_link">External Link</SelectItem>
                  <SelectItem value="uploaded_document">Uploaded Document</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newSignoff.signoffType === "pandadoc_link" && (
              <div>
                <Label>PandaDoc URL</Label>
                <Input
                  value={newSignoff.pandadocUrl}
                  onChange={(e) => setNewSignoff(prev => ({ ...prev, pandadocUrl: e.target.value }))}
                  placeholder="https://app.pandadoc.com/..."
                  data-testid="edit-input-pandadoc-url"
                />
              </div>
            )}

            {newSignoff.signoffType === "external_link" && (
              <div>
                <Label>External URL</Label>
                <Input
                  value={newSignoff.externalUrl}
                  onChange={(e) => setNewSignoff(prev => ({ ...prev, externalUrl: e.target.value }))}
                  placeholder="https://..."
                  data-testid="edit-input-external-url"
                />
              </div>
            )}

            {newSignoff.signoffType === "uploaded_document" && (
              <div>
                <Label>Document Name</Label>
                <Input
                  value={newSignoff.documentName}
                  onChange={(e) => setNewSignoff(prev => ({ ...prev, documentName: e.target.value }))}
                  placeholder="signoff-document.pdf"
                  data-testid="edit-input-document-name"
                />
              </div>
            )}

            <div>
              <Label>Status</Label>
              <Select
                value={newSignoff.status}
                onValueChange={(value: SignoffStatus) => setNewSignoff(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger data-testid="edit-select-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="received">Received</SelectItem>
                  <SelectItem value="missing">Missing</SelectItem>
                  <SelectItem value="not_required">Not Required</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newSignoff.status === "received" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Signed By</Label>
                  <Input
                    value={newSignoff.signedBy}
                    onChange={(e) => setNewSignoff(prev => ({ ...prev, signedBy: e.target.value }))}
                    placeholder="Customer name"
                    data-testid="edit-input-signed-by"
                  />
                </div>
                <div>
                  <Label>Signed Date <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input
                    type="date"
                    value={newSignoff.signedDate}
                    onChange={(e) => setNewSignoff(prev => ({ ...prev, signedDate: e.target.value }))}
                    data-testid="edit-input-signed-date"
                  />
                </div>
              </div>
            )}

            <div>
              <Label>Notes</Label>
              <Textarea
                value={newSignoff.notes}
                onChange={(e) => setNewSignoff(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional notes..."
                rows={2}
                data-testid="edit-input-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedSignoff) {
                  updateMutation.mutate({
                    id: selectedSignoff.id,
                    data: {
                      phaseName: newSignoff.phaseName,
                      signoffType: newSignoff.signoffType,
                      pandadocUrl: newSignoff.pandadocUrl || "",
                      externalUrl: newSignoff.externalUrl || "",
                      documentName: newSignoff.documentName || "",
                      status: newSignoff.status,
                      signedBy: newSignoff.signedBy || "",
                      signedDate: newSignoff.signedDate || "",
                      notes: newSignoff.notes || "",
                    },
                  });
                }
              }}
              disabled={updateMutation.isPending}
              data-testid="button-save-signoff"
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
