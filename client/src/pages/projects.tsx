import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, getErrorMessage } from "@/lib/queryClient";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { RegionBadge } from "@/components/region-badge";
import { DeliveryStatusIndicator } from "@/components/delivery-status-indicator";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Search, ChevronRight, RefreshCw, Calendar, Upload, Download, FileText, AlertCircle, CheckCircle, Merge, Filter, ArrowUpDown, X, CircleDollarSign, Wallet, TrendingUp, Building2, Receipt, MapPin, Sparkles, Link2, ArrowUpRight, AlertTriangle, Scale, Paperclip } from "lucide-react";
import { useLocation } from "wouter";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { SearchableCombobox } from "@/components/searchable-combobox";
import { PaymentLinkerDialog } from "@/components/payment-linker-dialog";
import { COUNTRIES, UAE_CITIES, PROJECT_TYPE_OPTIONS } from "@/lib/ae-location-data";
import { downloadProjectTemplate, parseProjectCSV, ParsedProjectRow, ProjectImportResult, exportToCSV, ExportColumn, formatCurrencyForExport, formatDateForExport } from "@/lib/export-utils";
import type { ProjectWithPM, User, Region, Payment, SystemPermission, ProjectMilestone, MilestoneWithPayment, ProjectWithMilestones, ChangeRequestWithInstallments, CrInstallmentWithPayment, UpsellTypeSetting, ChangeRequestStatus, CrTag } from "@shared/schema";
import { projectPhases } from "@shared/schema";
import { DriveFileUploader } from "@/components/DriveFileUploader";
import { TagSelector, TagBadge } from "@/components/tag-selector";
import { ProjectDetailSheet } from "@/components/project-detail-sheet";

type ProjectManager = Pick<User, "id" | "firstName" | "lastName" | "email" | "profileImageUrl" | "status" | "podId" | "isProjectManager">;

const phaseItemSchema = z.object({
  name: z.string().min(1, "Phase name is required"),
  percentage: z.coerce.number().min(0).max(100),
  cost: z.coerce.number().min(0),
  dueDate: z.string().optional(),
});

const projectFormSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  clientName: z.string().min(1, "Client name is required"),
  clientEmail: z.string().email().optional().or(z.literal("")),
  region: z.enum(["CA", "TX", "AE"]),
  pmId: z.string().optional(),
  totalCost: z.string().min(1, "Total cost is required"),
  billingType: z.enum(["ftfc", "tbe", "mrr"]).optional().or(z.literal("")),
  phase: z.enum(projectPhases).optional().or(z.literal("")),
  numberOfPhases: z.coerce.number().min(1).optional(),
  phases: z.array(phaseItemSchema).optional(),
  contractStartDate: z.string().optional(),
  contractEndDate: z.string().optional(),
  tbeHoursPerMonth: z.coerce.number().min(0).optional(),
  tbeHourlyRate: z.string().optional(),
  mrrMonthlyAmount: z.string().optional(),
  mrrDurationMonths: z.coerce.number().min(1).optional(),
  // AE (UAE) region-specific fields
  placeOfSupply: z.enum(["inside_uae", "outside_uae"]).optional().or(z.literal("")),
  supplyCountry: z.string().optional().or(z.literal("")),
  supplyCity: z.string().optional().or(z.literal("")),
  projectType: z.string().optional().or(z.literal("")),
  serviceType: z.string().optional().or(z.literal("")),
  clientTrn: z.string().optional().or(z.literal("")),
  clientBusinessName: z.string().optional().or(z.literal("")),
  clientAddress: z.string().optional().or(z.literal("")),
  vat: z.string().optional().or(z.literal("")),
}).superRefine((data, ctx) => {
  if (data.region !== "AE") return;
  if (!data.placeOfSupply) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Place of Supply is required", path: ["placeOfSupply"] });
  }
  if (!data.projectType) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Project Type is required", path: ["projectType"] });
  }
  if (data.placeOfSupply === "outside_uae" && !data.supplyCountry) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Country is required", path: ["supplyCountry"] });
  }
  if (data.placeOfSupply === "inside_uae" && !data.supplyCity) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "City is required", path: ["supplyCity"] });
  }
  if (data.vat === undefined || data.vat === "") {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "VAT is required", path: ["vat"] });
  } else {
    const vatNum = Number(data.vat);
    if (Number.isNaN(vatNum) || vatNum < 0 || vatNum > 100) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "VAT must be between 0 and 100", path: ["vat"] });
    }
  }
});

type ProjectFormValues = z.infer<typeof projectFormSchema>;

const billingTypeLabels: Record<string, string> = {
  ftfc: "Fixed Time Fixed Cost",
  tbe: "Team Based Engagement",
  mrr: "Monthly Recurring Revenue",
};

const billingTypeShort: Record<string, string> = {
  ftfc: "FTFC",
  tbe: "TBE",
  mrr: "MRR",
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

const projectPhaseLabels: Record<string, string> = {
  scope: "Scope",
  design: "Design",
  alpha: "Alpha",
  beta: "Beta",
  uat: "UAT",
  deployment: "Deployment",
  support: "Support",
  maintenance: "Maintenance",
};

const milestoneStatusColors: Record<string, string> = {
  planned: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  ready_for_invoice: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  invoiced: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  partially_paid: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  paid: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

export default function Projects() {
  const { toast, dismiss } = useToast();
  const [, setLocation] = useLocation();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectWithPM | null>(null);
  const [deleteProject, setDeleteProject] = useState<ProjectWithPM | null>(null);
  const [deletePayments, setDeletePayments] = useState<Payment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [search, setSearch] = useState("");
  const undoTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [selectedProject, setSelectedProject] = useState<ProjectWithPM | null>(null);
  const [isProjectDetailOpen, setIsProjectDetailOpen] = useState(false);
  const [isLinkerOpen, setIsLinkerOpen] = useState(false);
  
  // Filter state
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterRegion, setFilterRegion] = useState<string>("all");
  const [filterBillingType, setFilterBillingType] = useState<string>("all");
  const [filterPm, setFilterPm] = useState<string>("all");
  const [filterDeliveryStatus, setFilterDeliveryStatus] = useState<string>("all");
  const [filterPhase, setFilterPhase] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");
  
  // Import state
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importResult, setImportResult] = useState<ProjectImportResult | null>(null);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Merge state
  const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState<string>("");
  const [mergeSourceIds, setMergeSourceIds] = useState<string[]>([]);
  const [mergePreview, setMergePreview] = useState<{
    targetProject: { id: string; name: string };
    sourceProjects: ProjectWithPM[];
    counts: { payments: number; milestones: number; invoices: number; upsells: number; timesheets: number; costs: number };
  } | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: "",
      clientName: "",
      clientEmail: "",
      region: "CA",
      pmId: "",
      totalCost: "",
      billingType: "",
      phase: "",
      numberOfPhases: 1,
      phases: [{ name: "Phase 1", percentage: 100, cost: 0, dueDate: "" }],
      contractStartDate: "",
      contractEndDate: "",
      tbeHoursPerMonth: 0,
      tbeHourlyRate: "",
      mrrMonthlyAmount: "",
      mrrDurationMonths: 12,
      placeOfSupply: "",
      supplyCountry: "",
      supplyCity: "",
      projectType: "",
      serviceType: "",
      clientTrn: "",
      clientBusinessName: "",
      clientAddress: "",
      vat: "",
    },
  });

  const { fields: phaseFields, replace: replacePhases } = useFieldArray({
    control: form.control,
    name: "phases",
  });

  const watchBillingType = form.watch("billingType");
  const watchNumberOfPhases = form.watch("numberOfPhases");
  const watchTotalCost = form.watch("totalCost");
  const watchContractStartDate = form.watch("contractStartDate");
  const watchContractEndDate = form.watch("contractEndDate");
  const watchTbeHoursPerMonth = form.watch("tbeHoursPerMonth");
  const watchTbeHourlyRate = form.watch("tbeHourlyRate");
  const watchMrrMonthlyAmount = form.watch("mrrMonthlyAmount");
  const watchMrrDurationMonths = form.watch("mrrDurationMonths");
  const watchRegion = form.watch("region");
  const watchPlaceOfSupply = form.watch("placeOfSupply");

  // Calculate duration in months for TBE
  const calculateMonthsDuration = (startDate: string | undefined, endDate: string | undefined): number => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
    return Math.max(0, months);
  };

  // Generate milestone months preview
  const generateMilestoneMonths = (startDate: string | undefined, durationMonths: number): Array<{ name: string; month: number; year: number }> => {
    if (!startDate || durationMonths <= 0) return [];
    const start = new Date(startDate);
    if (isNaN(start.getTime())) return [];
    
    const milestones: Array<{ name: string; month: number; year: number }> = [];
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    
    for (let i = 0; i < durationMonths; i++) {
      const date = new Date(start.getFullYear(), start.getMonth() + i, 1);
      milestones.push({
        name: `${monthNames[date.getMonth()]} ${date.getFullYear()}`,
        month: date.getMonth() + 1,
        year: date.getFullYear(),
      });
    }
    return milestones;
  };

  // TBE calculations
  const tbeDurationMonths = calculateMonthsDuration(watchContractStartDate, watchContractEndDate);
  const tbeMonthlyCost = (watchTbeHoursPerMonth || 0) * (parseFloat(watchTbeHourlyRate || "0") || 0);
  const tbeMilestonePreview = generateMilestoneMonths(watchContractStartDate, tbeDurationMonths);
  
  // MRR calculations  
  const mrrMilestonePreview = generateMilestoneMonths(watchContractStartDate, watchMrrDurationMonths || 0);
  
  // Auto-calculate monthly amount for MRR (totalCost / durationMonths)
  const calculatedMrrMonthlyAmount = useMemo(() => {
    if (watchBillingType !== "mrr") return null;
    const totalCost = parseFloat(watchTotalCost || "0");
    const duration = watchMrrDurationMonths || 0;
    if (totalCost > 0 && duration > 0) {
      return (totalCost / duration).toFixed(2);
    }
    return null;
  }, [watchBillingType, watchTotalCost, watchMrrDurationMonths]);
  
  // Update mrrMonthlyAmount when totalCost or duration changes for MRR projects
  useEffect(() => {
    if (watchBillingType === "mrr" && calculatedMrrMonthlyAmount) {
      form.setValue("mrrMonthlyAmount", calculatedMrrMonthlyAmount);
    }
  }, [calculatedMrrMonthlyAmount, watchBillingType]);

  // Update phases array when numberOfPhases changes for FTFC
  useEffect(() => {
    if (watchBillingType === "ftfc" && watchNumberOfPhases) {
      const currentPhases = form.getValues("phases") || [];
      const numPhases = watchNumberOfPhases;
      const totalCost = parseFloat(watchTotalCost) || 0;
      
      // Create new phases array based on numberOfPhases
      const newPhases = Array.from({ length: numPhases }, (_, i) => {
        const existing = currentPhases[i];
        if (existing) {
          return existing;
        }
        // Calculate equal percentage and cost for new phases (allow decimals)
        const equalPercentage = Math.round((100 / numPhases) * 100) / 100;
        const equalCost = Math.round((totalCost / numPhases) * 100) / 100;
        return {
          name: `Phase ${i + 1}`,
          percentage: equalPercentage,
          cost: equalCost,
          dueDate: "",
        };
      });
      
      replacePhases(newPhases);
    }
  }, [watchBillingType, watchNumberOfPhases]);

  const { data: projects, isLoading } = useQuery<ProjectWithPM[]>({
    queryKey: ["/api/projects"],
  });

  const { data: pmUsers = [] } = useQuery<ProjectManager[]>({
    queryKey: ["/api/project-managers"],
  });

  const { data: userPermissions } = useQuery<SystemPermission[]>({
    queryKey: ["/api/access/my-permissions"],
  });

  const canCreateProjects = userPermissions?.includes("create_projects") ?? false;
  const canEditProjects = userPermissions?.includes("edit_projects") ?? false;
  const canDeleteProjects = userPermissions?.includes("delete_projects") ?? false;
  const canEditPayments = userPermissions?.includes("edit_payments") ?? false;

  const invalidatePlanningData = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
    queryClient.invalidateQueries({ queryKey: ["/api/monthly-plans"] });
    queryClient.invalidateQueries({ 
      predicate: (query) => {
        const key = query.queryKey[0];
        return key === "/api/pm-targets";
      }
    });
  };

  // Store phases temporarily for use after project creation
  const pendingPhasesRef = useRef<Array<{ name: string; percentage: number; cost: number; dueDate?: string }> | null>(null);

  const createMutation = useMutation({
    mutationFn: async (data: ProjectFormValues) => {
      // Store phases for FTFC projects before creating
      if (data.billingType === 'ftfc' && data.phases && data.phases.length > 0) {
        pendingPhasesRef.current = data.phases;
      } else {
        pendingPhasesRef.current = null;
      }
      
      const response = await apiRequest("POST", "/api/projects", {
        ...data,
        totalCost: data.totalCost,
        clientEmail: data.clientEmail || null,
        pmId: data.pmId || null,
        billingType: data.billingType || null,
        numberOfPhases: data.numberOfPhases || null,
        contractStartDate: data.contractStartDate || null,
        contractEndDate: data.contractEndDate || null,
        tbeHoursPerMonth: data.tbeHoursPerMonth || null,
        tbeHourlyRate: data.tbeHourlyRate || null,
        mrrMonthlyAmount: data.mrrMonthlyAmount || null,
        mrrDurationMonths: data.mrrDurationMonths || null,
        placeOfSupply: data.placeOfSupply || null,
        supplyCountry: data.supplyCountry || null,
        supplyCity: data.supplyCity || null,
        projectType: data.projectType || null,
        serviceType: data.serviceType || null,
        clientTrn: data.clientTrn || null,
        clientBusinessName: data.clientBusinessName || null,
        clientAddress: data.clientAddress || null,
        vat: data.vat || null,
      });
      return response.json();
    },
    onSuccess: async (project) => {
      // Generate milestones for FTFC projects with phases, or TBE/MRR projects
      if (project.billingType) {
        try {
          const phases = pendingPhasesRef.current;
          await apiRequest("POST", `/api/projects/${project.id}/milestones/generate`, { phases });
        } catch (error) {
          console.error("Failed to generate milestones:", error);
        }
      }
      pendingPhasesRef.current = null;
      invalidatePlanningData();
      setIsDialogOpen(false);
      form.reset();
      toast({ title: "Project Created", description: "The project has been created successfully." });
    },
    onError: (error) => {
      pendingPhasesRef.current = null;
      toast({ title: "Error", description: getErrorMessage(error, "Failed to create project."), variant: "destructive" });
    },
  });

  const shouldRegenerateMilestonesRef = useRef(false);

  const updateMutation = useMutation({
    mutationFn: async (data: ProjectFormValues & { id: string }) => {
      if (data.billingType === 'ftfc' && data.phases && data.phases.length > 0) {
        pendingPhasesRef.current = data.phases;
      }

      const orig = editingProject;
      if (!orig) {
        shouldRegenerateMilestonesRef.current = true;
      } else {
        const billingType = data.billingType || null;
        const origBillingType = orig.billingType || null;
        const billingTypeChanged = billingType !== origBillingType;

        const costChanged = String(data.totalCost || '0') !== String(orig.totalCost || '0');

        const normDate = (v: string | Date | null | undefined): string | null => {
          if (v === undefined || v === null || v === '') return null;
          const d = v instanceof Date ? v : new Date(v);
          return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
        };
        const datesChanged =
          normDate(data.contractStartDate) !== normDate(orig.contractStartDate) ||
          normDate(data.contractEndDate) !== normDate(orig.contractEndDate);

        let typeSpecificChanged = false;
        if (billingType === 'ftfc') {
          typeSpecificChanged = Number(data.numberOfPhases || 0) !== Number(orig.numberOfPhases || 0);
        } else if (billingType === 'tbe') {
          typeSpecificChanged =
            Number(data.tbeHoursPerMonth || 0) !== Number(orig.tbeHoursPerMonth || 0) ||
            String(data.tbeHourlyRate || '') !== String(orig.tbeHourlyRate || '');
        } else if (billingType === 'mrr') {
          typeSpecificChanged =
            String(data.mrrMonthlyAmount || '') !== String(orig.mrrMonthlyAmount || '') ||
            Number(data.mrrDurationMonths || 0) !== Number(orig.mrrDurationMonths || 0);
        }

        shouldRegenerateMilestonesRef.current = billingTypeChanged || costChanged || datesChanged || typeSpecificChanged;
      }

      const response = await apiRequest("PATCH", `/api/projects/${data.id}`, {
        name: data.name,
        clientName: data.clientName,
        region: data.region,
        totalCost: data.totalCost,
        clientEmail: data.clientEmail || null,
        pmId: data.pmId || null,
        billingType: data.billingType || null,
        numberOfPhases: data.numberOfPhases || null,
        contractStartDate: data.contractStartDate || null,
        contractEndDate: data.contractEndDate || null,
        tbeHoursPerMonth: data.tbeHoursPerMonth || null,
        tbeHourlyRate: data.tbeHourlyRate || null,
        mrrMonthlyAmount: data.mrrMonthlyAmount || null,
        mrrDurationMonths: data.mrrDurationMonths || null,
        placeOfSupply: data.placeOfSupply || null,
        supplyCountry: data.supplyCountry || null,
        supplyCity: data.supplyCity || null,
        projectType: data.projectType || null,
        serviceType: data.serviceType || null,
        clientTrn: data.clientTrn || null,
        clientBusinessName: data.clientBusinessName || null,
        clientAddress: data.clientAddress || null,
        vat: data.vat || null,
      });
      return response.json();
    },
    onSuccess: async (project) => {
      if (project.billingType && shouldRegenerateMilestonesRef.current) {
        try {
          const phases = pendingPhasesRef.current;
          await apiRequest("POST", `/api/projects/${project.id}/milestones/generate`, { phases });
          queryClient.invalidateQueries({ queryKey: [`/api/projects/${project.id}/with-milestones`] });
        } catch (error) {
          console.error("Failed to generate milestones:", error);
        }
      } else if (project.billingType === 'ftfc' && pendingPhasesRef.current) {
        try {
          const milestonesResp = await fetch(`/api/projects/${project.id}/with-milestones`);
          if (milestonesResp.ok) {
            const projectData = await milestonesResp.json();
            const existingMilestones = (projectData.milestones || [])
              .slice()
              .sort((a: any, b: any) => (a.sequenceNumber || 0) - (b.sequenceNumber || 0));
            const phases = pendingPhasesRef.current;
            await Promise.all(
              phases.slice(0, existingMilestones.length).map((phase, idx) => {
                const milestone = existingMilestones[idx];
                const updates: any = {};
                const newName = phase.name || `Phase ${idx + 1}`;
                if (newName !== milestone.name) updates.name = newName;
                const newAmount = String(phase.cost || 0);
                if (newAmount !== String(milestone.expectedAmount || 0)) updates.expectedAmount = newAmount;
                const newDueDate = phase.dueDate || null;
                const oldDueDate = milestone.dueDate ? new Date(milestone.dueDate).toISOString().split('T')[0] : null;
                if (newDueDate !== oldDueDate) updates.dueDate = newDueDate;
                if (Object.keys(updates).length === 0) return Promise.resolve();
                return apiRequest("PATCH", `/api/milestones/${milestone.id}`, updates);
              })
            );
            queryClient.invalidateQueries({ queryKey: [`/api/projects/${project.id}/with-milestones`] });
          }
        } catch (error) {
          console.error("Failed to sync milestone phase details:", error);
        }
      }
      shouldRegenerateMilestonesRef.current = false;
      pendingPhasesRef.current = null;
      invalidatePlanningData();
      setIsDialogOpen(false);
      setEditingProject(null);
      form.reset();
      toast({ title: "Project Updated", description: "The project has been updated successfully." });
    },
    onError: (error) => {
      shouldRegenerateMilestonesRef.current = false;
      pendingPhasesRef.current = null;
      toast({ title: "Error", description: getErrorMessage(error, "Failed to update project."), variant: "destructive" });
    },
  });

  const undoMutation = useMutation({
    mutationFn: async (undoToken: string) => {
      return apiRequest("POST", "/api/projects/undo-delete", { undoToken });
    },
    onSuccess: () => {
      invalidatePlanningData();
      toast({ title: "Project Restored", description: "The project and its payments have been restored." });
    },
    onError: (error) => {
      toast({ title: "Error", description: getErrorMessage(error, "Failed to restore project."), variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const response = await apiRequest("DELETE", `/api/projects/${projectId}`);
      return response.json();
    },
    onSuccess: (data) => {
      invalidatePlanningData();
      setDeleteProject(null);
      setDeletePayments([]);
      
      let secondsRemaining = 30;
      const { id: toastId } = toast({
        title: "Project Deleted",
        description: `${data.projectName} deleted. Undo available for ${secondsRemaining}s`,
        duration: 30000,
        action: (
          <Button variant="outline" size="sm" onClick={() => {
            undoMutation.mutate(data.undoToken);
            if (undoTimerRef.current) clearInterval(undoTimerRef.current);
            dismiss(toastId);
          }}>
            Undo
          </Button>
        ),
      });
      
      undoTimerRef.current = setInterval(() => {
        secondsRemaining--;
        if (secondsRemaining <= 0) {
          if (undoTimerRef.current) clearInterval(undoTimerRef.current);
        }
      }, 1000);
    },
    onError: (error) => {
      toast({ title: "Error", description: getErrorMessage(error, "Failed to delete project."), variant: "destructive" });
    },
  });

  const importProjectsMutation = useMutation({
    mutationFn: async (projects: ParsedProjectRow[]) => {
      const response = await apiRequest("POST", "/api/projects/import", { projects });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setIsImportDialogOpen(false);
      setImportResult(null);
      toast({ 
        title: "Import Complete", 
        description: `${data.successCount} projects imported successfully.${data.failedCount > 0 ? ` ${data.failedCount} failed.` : ''}` 
      });
    },
    onError: (error) => {
      toast({ title: "Import Failed", description: getErrorMessage(error, "Failed to import projects."), variant: "destructive" });
    },
  });

  const updateProjectStatus = useMutation({
    mutationFn: async ({ id, status, isNewProject, isFullyPaid, phase }: { id: string; status: string; isNewProject?: boolean; isFullyPaid?: boolean; phase?: string | null }) => {
      const body: any = { status };
      if (isNewProject !== undefined) body.isNewProject = isNewProject;
      if (isFullyPaid !== undefined) body.isFullyPaid = isFullyPaid;
      if (phase !== undefined) body.phase = phase;
      const response = await apiRequest("PATCH", `/api/projects/${id}`, body);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Status Updated", description: "Project has been updated." });
    },
    onError: (error) => {
      toast({ title: "Error", description: getErrorMessage(error, "Failed to update project."), variant: "destructive" });
    },
  });

  const mergeMutation = useMutation({
    mutationFn: async ({ targetProjectId, sourceProjectIds }: { targetProjectId: string; sourceProjectIds: string[] }) => {
      const response = await apiRequest("POST", "/api/projects/merge", { targetProjectId, sourceProjectIds });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/milestones"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/upsells"] });
      queryClient.invalidateQueries({ queryKey: ["/api/timesheets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/costs"] });
      setIsMergeDialogOpen(false);
      resetMergeState();
      toast({ 
        title: "Projects Merged", 
        description: `Successfully merged ${data.audit?.sourceProjectNames?.length || 0} project(s) into the target project.` 
      });
    },
    onError: (error) => {
      toast({ title: "Error", description: getErrorMessage(error, "Failed to merge projects."), variant: "destructive" });
    },
  });

  const resetMergeState = () => {
    setMergeTargetId("");
    setMergeSourceIds([]);
    setMergePreview(null);
  };

  const openMergeDialog = () => {
    resetMergeState();
    setIsMergeDialogOpen(true);
  };

  const handleMergeSourceToggle = (projectId: string, checked: boolean) => {
    if (checked) {
      setMergeSourceIds(prev => [...prev, projectId]);
    } else {
      setMergeSourceIds(prev => prev.filter(id => id !== projectId));
    }
    setMergePreview(null);
  };

  const handleTargetChange = (targetId: string) => {
    setMergeTargetId(targetId);
    setMergeSourceIds(prev => prev.filter(id => id !== targetId));
    setMergePreview(null);
  };

  const fetchMergePreview = async () => {
    if (!mergeTargetId || mergeSourceIds.length === 0) return;
    
    setIsLoadingPreview(true);
    try {
      const response = await apiRequest("POST", "/api/projects/merge/preview", {
        targetProjectId: mergeTargetId,
        sourceProjectIds: mergeSourceIds,
      });
      const preview = await response.json();
      setMergePreview(preview);
    } catch (error) {
      toast({ title: "Error", description: getErrorMessage(error, "Failed to get merge preview."), variant: "destructive" });
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleMergeConfirm = () => {
    if (!mergeTargetId || mergeSourceIds.length === 0) return;
    mergeMutation.mutate({ targetProjectId: mergeTargetId, sourceProjectIds: mergeSourceIds });
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setIsParsingFile(true);
    try {
      const result = await parseProjectCSV(file);
      setImportResult(result);
      setIsImportDialogOpen(true);
    } catch (error) {
      toast({ title: "Parse Error", description: "Failed to parse CSV file. Please check the format.", variant: "destructive" });
    } finally {
      setIsParsingFile(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleImportConfirm = () => {
    if (importResult?.valid && importResult.valid.length > 0) {
      importProjectsMutation.mutate(importResult.valid);
    }
  };

  const handleExportProjects = () => {
    if (!filteredProjects || filteredProjects.length === 0) {
      toast({ title: "No Data", description: "No projects to export.", variant: "destructive" });
      return;
    }

    const columns: ExportColumn[] = [
      { header: "Project Name", accessor: "name" },
      { header: "Client Name", accessor: "clientName" },
      { header: "Client Email", accessor: "clientEmail" },
      { header: "Region", accessor: "region" },
      { header: "Project Manager", accessor: (row: any) => row.pm ? `${row.pm.firstName || ""} ${row.pm.lastName || ""}`.trim() : "" },
      { header: "Project Type", accessor: (row: any) => row.projectType || "" },
      { header: "Billing Type", accessor: (row: any) => (row.billingType || "").toUpperCase() },
      { header: "Status", accessor: (row: any) => (row.status || "").charAt(0).toUpperCase() + (row.status || "").slice(1) },
      { header: "Total Cost", accessor: (row: any) => formatCurrencyForExport(row.totalCost) },
      { header: "Contract Start Date", accessor: (row: any) => formatDateForExport(row.contractStartDate) },
      { header: "Contract End Date", accessor: (row: any) => formatDateForExport(row.contractEndDate) },
      { header: "Payment Terms", accessor: (row: any) => row.paymentTerms || "" },
      { header: "Number of Phases", accessor: (row: any) => row.numberOfPhases ?? "" },
      { header: "MRR Monthly Amount", accessor: (row: any) => row.mrrMonthlyAmount ? formatCurrencyForExport(row.mrrMonthlyAmount) : "" },
      { header: "MRR Duration (Months)", accessor: (row: any) => row.mrrDurationMonths ?? "" },
      { header: "TBE Hours/Month", accessor: (row: any) => row.tbeHoursPerMonth ?? "" },
      { header: "TBE Hourly Rate", accessor: (row: any) => row.tbeHourlyRate ? formatCurrencyForExport(row.tbeHourlyRate) : "" },
      { header: "Delivery Status", accessor: (row: any) => row.deliveryStatus || "" },
      { header: "Fully Paid", accessor: (row: any) => row.isFullyPaid ? "Yes" : "No" },
    ];

    const dateStr = new Date().toISOString().split("T")[0];
    exportToCSV(filteredProjects, columns, `projects_export_${dateStr}`);
    toast({ title: "Export Complete", description: `${filteredProjects.length} project(s) exported to CSV.` });
  };

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearInterval(undoTimerRef.current);
    };
  }, []);

  const filteredProjects = projects
    ?.filter(p => {
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        const matchesSearch = 
          p.name.toLowerCase().includes(searchLower) ||
          p.clientName.toLowerCase().includes(searchLower) ||
          p.clientEmail?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }
      
      // Status filter
      if (filterStatus !== "all" && (p.status || "active") !== filterStatus) return false;
      
      // Region filter
      if (filterRegion !== "all" && p.region !== filterRegion) return false;
      
      // Billing type filter
      if (filterBillingType !== "all" && p.billingType !== filterBillingType) return false;
      
      // PM filter
      if (filterPm !== "all" && p.pmId !== filterPm) return false;
      
      // Delivery status filter
      if (filterDeliveryStatus !== "all") {
        const projectDeliveryStatus = (p as any).deliveryStatus || "not_set";
        if (projectDeliveryStatus !== filterDeliveryStatus) return false;
      }
      
      // Phase filter
      if (filterPhase !== "all" && (p.phase || "") !== filterPhase) return false;
      
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        case "oldest":
          return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
        case "name_asc":
          return a.name.localeCompare(b.name);
        case "name_desc":
          return b.name.localeCompare(a.name);
        case "cost_high":
          return parseFloat(b.totalCost || "0") - parseFloat(a.totalCost || "0");
        case "cost_low":
          return parseFloat(a.totalCost || "0") - parseFloat(b.totalCost || "0");
        default:
          return 0;
      }
    }) || [];

  const formatCurrency = (value: string | number | null) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    if (num === null || isNaN(num as number)) return "$0";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num as number);
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString();
  };

  const openEditDialog = async (project: ProjectWithPM) => {
    setEditingProject(project);
    const totalCost = parseFloat(project.totalCost?.toString() || "0");
    const numPhases = project.numberOfPhases || 1;
    
    // Try to load existing milestones to populate phases with actual names and due dates
    let phases: Array<{ name: string; percentage: number; cost: number; dueDate: string }> = [];
    
    try {
      const response = await fetch(`/api/projects/${project.id}/with-milestones`);
      if (response.ok) {
        const projectData = await response.json();
        if (projectData.milestones && projectData.milestones.length > 0) {
          // Use existing milestones to populate phases
          phases = projectData.milestones
            .sort((a: any, b: any) => (a.sequenceNumber || 0) - (b.sequenceNumber || 0))
            .map((milestone: any) => {
              const amount = parseFloat(milestone.expectedAmount || "0");
              const percentage = totalCost > 0 ? Math.round((amount / totalCost) * 10000) / 100 : 0;
              return {
                name: milestone.name || `Phase ${milestone.sequenceNumber || 1}`,
                percentage,
                cost: amount,
                dueDate: milestone.dueDate ? new Date(milestone.dueDate).toISOString().split('T')[0] : "",
              };
            });
        }
      }
    } catch (error) {
      console.error("Failed to load existing milestones:", error);
    }
    
    // Fall back to default phases if no milestones found
    if (phases.length === 0) {
      phases = Array.from({ length: numPhases }, (_, i) => ({
        name: `Phase ${i + 1}`,
        percentage: Math.round((100 / numPhases) * 100) / 100,
        cost: Math.round((totalCost / numPhases) * 100) / 100,
        dueDate: "",
      }));
    }
    
    form.reset({
      name: project.name,
      clientName: project.clientName,
      clientEmail: project.clientEmail || "",
      region: project.region as Region,
      pmId: project.pmId || "",
      totalCost: project.totalCost?.toString() || "",
      billingType: (project.billingType as "ftfc" | "tbe" | "mrr") || "",
      phase: (project as any).phase || "",
      numberOfPhases: phases.length || numPhases,
      phases: phases,
      contractStartDate: project.contractStartDate ? new Date(project.contractStartDate).toISOString().split('T')[0] : "",
      contractEndDate: project.contractEndDate ? new Date(project.contractEndDate).toISOString().split('T')[0] : "",
      tbeHoursPerMonth: project.tbeHoursPerMonth || 0,
      tbeHourlyRate: project.tbeHourlyRate || "",
      mrrMonthlyAmount: project.mrrMonthlyAmount || "",
      mrrDurationMonths: project.mrrDurationMonths || 12,
      placeOfSupply: (project.placeOfSupply as "inside_uae" | "outside_uae") || "",
      supplyCountry: project.supplyCountry || "",
      supplyCity: project.supplyCity || "",
      projectType: project.projectType || "",
      serviceType: project.serviceType || "",
      clientTrn: project.clientTrn || "",
      clientBusinessName: project.clientBusinessName || "",
      clientAddress: project.clientAddress || "",
      vat: project.vat?.toString() || "",
    });
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingProject(null);
    form.reset({
      name: "",
      clientName: "",
      clientEmail: "",
      region: "CA",
      pmId: "",
      totalCost: "",
      billingType: "",
      phase: "",
      numberOfPhases: 1,
      phases: [{ name: "Phase 1", percentage: 100, cost: 0, dueDate: "" }],
      contractStartDate: "",
      contractEndDate: "",
      tbeHoursPerMonth: 0,
      tbeHourlyRate: "",
      mrrMonthlyAmount: "",
      mrrDurationMonths: 12,
      placeOfSupply: "",
      supplyCountry: "",
      supplyCity: "",
      projectType: "",
      serviceType: "",
      clientTrn: "",
      clientBusinessName: "",
      clientAddress: "",
      vat: "",
    });
    setIsDialogOpen(true);
  };

  const openDeleteDialog = async (project: ProjectWithPM) => {
    setDeleteProject(project);
    setLoadingPayments(true);
    try {
      const response = await fetch(`/api/projects/${project.id}/payments`);
      if (response.ok) {
        const payments = await response.json();
        setDeletePayments(payments);
      }
    } catch (error) {
      console.error("Failed to fetch project payments:", error);
    } finally {
      setLoadingPayments(false);
    }
  };

  const openProjectDetail = (project: ProjectWithPM) => {
    setSelectedProject(project);
    setIsProjectDetailOpen(true);
  };

  const onSubmit = (data: ProjectFormValues) => {
    const payload: any = { ...data };
    // Keep phase consistently nullable in the DB (send null, not "").
    payload.phase = data.phase ? data.phase : null;
    if (data.region !== "AE") {
      // Clear only the AE-specific columns; preserve projectType (a pre-existing
      // field that may hold data for CA/TX projects).
      payload.placeOfSupply = "";
      payload.supplyCountry = "";
      payload.supplyCity = "";
      payload.serviceType = "";
      payload.clientTrn = "";
      payload.clientBusinessName = "";
      payload.clientAddress = "";
      payload.vat = "";
    } else {
      if (data.placeOfSupply === "inside_uae") payload.supplyCountry = "";
      if (data.placeOfSupply === "outside_uae") payload.supplyCity = "";
    }
    if (editingProject) {
      updateMutation.mutate({ ...payload, id: editingProject.id });
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">Manage your project directory</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canCreateProjects && (
            <>
              <Button variant="outline" onClick={handleExportProjects} data-testid="button-export-projects">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button variant="outline" onClick={downloadProjectTemplate} data-testid="button-download-template">
                <FileText className="h-4 w-4 mr-2" />
                Import Template
              </Button>
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isParsingFile} data-testid="button-import-projects">
                <Upload className="h-4 w-4 mr-2" />
                {isParsingFile ? "Parsing..." : "Import CSV"}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
                data-testid="input-import-file"
              />
              <Button onClick={openCreateDialog} data-testid="button-add-project">
                <Plus className="h-4 w-4 mr-2" />
                Add Project
              </Button>
            </>
          )}
          {canDeleteProjects && (
            <Button variant="outline" onClick={openMergeDialog} data-testid="button-merge-projects">
              <Merge className="h-4 w-4 mr-2" />
              Merge Projects
            </Button>
          )}
          {canEditPayments && (
            <Button variant="outline" onClick={() => setIsLinkerOpen(true)} data-testid="button-link-payments">
              <Link2 className="h-4 w-4 mr-2" />
              Link Payments
            </Button>
          )}
        </div>
      </div>

      <PaymentLinkerDialog
        open={isLinkerOpen}
        onOpenChange={setIsLinkerOpen}
        canEditPayments={canEditPayments}
      />

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search-projects"
            />
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-4 w-4 text-muted-foreground" />
            
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[130px]" data-testid="filter-status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="on_hold">On Hold</SelectItem>
                <SelectItem value="complete">Complete</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={filterRegion} onValueChange={setFilterRegion}>
              <SelectTrigger className="w-[130px]" data-testid="filter-region">
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
              <SelectTrigger className="w-[160px]" data-testid="filter-billing-type">
                <SelectValue placeholder="Billing Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Billing</SelectItem>
                <SelectItem value="ftfc">FTFC</SelectItem>
                <SelectItem value="tbe">TBE</SelectItem>
                <SelectItem value="mrr">MRR</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={filterPm} onValueChange={setFilterPm}>
              <SelectTrigger className="w-[160px]" data-testid="filter-pm">
                <SelectValue placeholder="Project Manager" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All PMs</SelectItem>
                {pmUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.firstName} {user.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={filterDeliveryStatus} onValueChange={setFilterDeliveryStatus}>
              <SelectTrigger className="w-[150px]" data-testid="filter-delivery-status">
                <SelectValue placeholder="Delivery" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Delivery</SelectItem>
                <SelectItem value="not_set">Not Set</SelectItem>
                <SelectItem value="on_track">On Track</SelectItem>
                <SelectItem value="at_risk">At Risk</SelectItem>
                <SelectItem value="delayed">Delayed</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={filterPhase} onValueChange={setFilterPhase}>
              <SelectTrigger className="w-[140px]" data-testid="filter-phase">
                <SelectValue placeholder="Phase" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Phases</SelectItem>
                {projectPhases.map((phase) => (
                  <SelectItem key={phase} value={phase} className="capitalize">
                    {phase.charAt(0).toUpperCase() + phase.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <div className="flex items-center gap-2 ml-2 pl-2 border-l">
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[150px]" data-testid="sort-projects">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="name_asc">Name A-Z</SelectItem>
                  <SelectItem value="name_desc">Name Z-A</SelectItem>
                  <SelectItem value="cost_high">Cost High-Low</SelectItem>
                  <SelectItem value="cost_low">Cost Low-High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {(filterStatus !== "all" || filterRegion !== "all" || filterBillingType !== "all" || filterPm !== "all" || filterDeliveryStatus !== "all" || filterPhase !== "all" || search) && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  setFilterStatus("all");
                  setFilterRegion("all");
                  setFilterBillingType("all");
                  setFilterPm("all");
                  setFilterDeliveryStatus("all");
                  setFilterPhase("all");
                  setSearch("");
                }}
                data-testid="button-clear-filters"
              >
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </div>
        
        <div className="text-sm text-muted-foreground">
          Showing {filteredProjects.length} of {projects?.length || 0} projects
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : filteredProjects.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-primary/5 hover:bg-primary/5 border-b-2 border-primary/20">
                    <TableHead className="w-10 text-xs font-semibold uppercase tracking-wide text-primary/80">Delivery</TableHead>
                    <TableHead className="min-w-[150px] text-xs font-semibold uppercase tracking-wide text-primary/80">Project Name</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-primary/80">Client</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-primary/80">Region</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-primary/80">PM</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-primary/80">Billing Type</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-primary/80">Status</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-primary/80">Phase</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-primary/80">Category</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-primary/80">Payment</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-primary/80">Total Cost</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-primary/80">Received</TableHead>
                    <TableHead className="min-w-[180px] text-xs font-semibold uppercase tracking-wide text-primary/80">Collection</TableHead>
                    <TableHead className="w-32 text-xs font-semibold uppercase tracking-wide text-primary/80">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProjects.map((project) => {
                    const projTotalCost = parseFloat(project.totalCost?.toString() || "0");
                    const projReceived = parseFloat(project.totalReceived?.toString() || "0");
                    const projRemaining = projTotalCost - projReceived;
                    const projPct = projTotalCost > 0 ? Math.min(100, Math.round((projReceived / projTotalCost) * 100)) : 0;
                    return (
                    <TableRow key={project.id} className="hover:bg-muted/30 transition-colors" data-testid={`row-project-${project.id}`}>
                      <TableCell>
                        <DeliveryStatusIndicator 
                          projectId={project.id} 
                          currentStatus={(project as any).deliveryStatus} 
                          size="sm"
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <button 
                          onClick={() => openProjectDetail(project)}
                          className="flex items-center gap-1 hover:text-primary transition-colors text-left"
                          data-testid={`link-project-detail-${project.id}`}
                        >
                          {project.name}
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </TableCell>
                      <TableCell>{project.clientName}</TableCell>
                      <TableCell><RegionBadge region={project.region} /></TableCell>
                      <TableCell>{project.pm ? `${project.pm.firstName} ${project.pm.lastName}` : "-"}</TableCell>
                      <TableCell>
                        {project.billingType ? (
                          <Badge variant="outline" className={`whitespace-nowrap font-medium ${billingTypeColors[project.billingType] || ""}`}>
                            {billingTypeShort[project.billingType] || project.billingType}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {canEditProjects ? (
                          <Select
                            value={project.status || "active"}
                            onValueChange={(value) => updateProjectStatus.mutate({ id: project.id, status: value })}
                          >
                            <SelectTrigger className="w-[120px]" data-testid={`select-project-status-${project.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="on_hold">On Hold</SelectItem>
                              <SelectItem value="complete">Complete</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge className={`${projectStatusColors[project.status || "active"]} whitespace-nowrap`}>
                            {projectStatusLabels[project.status || "active"]}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {canEditProjects ? (
                          <Select
                            value={(project as any).phase || "none"}
                            onValueChange={(value) => updateProjectStatus.mutate({ id: project.id, status: project.status || "active", phase: value === "none" ? null : value })}
                          >
                            <SelectTrigger className="w-[140px]" data-testid={`select-project-phase-${project.id}`}>
                              <SelectValue placeholder="—" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">—</SelectItem>
                              {projectPhases.map((p) => (
                                <SelectItem key={p} value={p}>{projectPhaseLabels[p]}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (project as any).phase ? (
                          <Badge variant="outline" className="whitespace-nowrap" data-testid={`badge-project-phase-${project.id}`}>
                            {projectPhaseLabels[(project as any).phase] || (project as any).phase}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {canEditProjects ? (
                          <Badge
                            variant="outline"
                            className={`cursor-pointer whitespace-nowrap ${(project as any).isNewProject !== false ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400"}`}
                            onClick={() => updateProjectStatus.mutate({ id: project.id, status: project.status || "active", isNewProject: (project as any).isNewProject === false })}
                            data-testid={`badge-project-category-${project.id}`}
                          >
                            {(project as any).isNewProject !== false ? "New" : "Old"}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className={`whitespace-nowrap ${(project as any).isNewProject !== false ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400"}`}>
                            {(project as any).isNewProject !== false ? "New" : "Old"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {canEditProjects ? (
                          <Badge
                            variant="outline"
                            className={`cursor-pointer whitespace-nowrap ${(project as any).isFullyPaid ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700" : "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border-amber-200 dark:border-amber-700"}`}
                            onClick={() => updateProjectStatus.mutate({ id: project.id, status: project.status || "active", isFullyPaid: !(project as any).isFullyPaid })}
                            data-testid={`badge-project-payment-${project.id}`}
                          >
                            <CircleDollarSign className="h-3 w-3 mr-1" />
                            {(project as any).isFullyPaid ? "Fully Paid" : "Unpaid"}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className={`whitespace-nowrap ${(project as any).isFullyPaid ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700" : "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border-amber-200 dark:border-amber-700"}`}>
                            <CircleDollarSign className="h-3 w-3 mr-1" />
                            {(project as any).isFullyPaid ? "Fully Paid" : "Unpaid"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums" data-testid={`text-project-total-cost-${project.id}`}>{formatCurrency(project.totalCost)}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums text-emerald-600 dark:text-emerald-400" data-testid={`text-project-received-${project.id}`}>{formatCurrency(projReceived)}</TableCell>
                      <TableCell>
                        <div className="space-y-1 min-w-[160px]" data-testid={`collection-progress-${project.id}`}>
                          <Progress value={projPct} className="h-1.5" />
                          <div className="flex items-center justify-between text-xs">
                            <span className={`font-medium ${projPct >= 100 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>{projPct}%</span>
                            <span className="text-muted-foreground tabular-nums">
                              {projRemaining > 0 ? `${formatCurrency(projRemaining)} left` : "Collected"}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {canEditProjects && (
                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(project)} data-testid={`button-edit-project-${project.id}`}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {canDeleteProjects && (
                            <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(project)} data-testid={`button-delete-project-${project.id}`}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>No projects found.</p>
              <p className="text-sm mt-1">Add your first project to get started.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProject ? "Edit Project" : "Add New Project"}</DialogTitle>
            <DialogDescription>
              {editingProject ? "Update the project details below." : "Fill in the project details to create a new project."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Name *</FormLabel>
                    <FormControl><Input {...field} data-testid="input-project-name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="clientName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client Name *</FormLabel>
                    <FormControl><Input {...field} data-testid="input-client-name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="clientEmail" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client Email</FormLabel>
                    <FormControl><Input type="email" {...field} data-testid="input-client-email" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="region" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Region *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-region"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="CA">California (CA)</SelectItem>
                        <SelectItem value="TX">Texas (TX)</SelectItem>
                        <SelectItem value="AE">UAE (AE)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="pmId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assigned PM</FormLabel>
                    <Select onValueChange={(val) => field.onChange(val === "none" ? "" : val)} value={field.value || "none"}>
                      <FormControl><SelectTrigger data-testid="select-pm"><SelectValue placeholder="Select PM" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {pmUsers.map((u) => (
                          <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="totalCost" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Cost *</FormLabel>
                    <FormControl><Input type="number" {...field} placeholder="0.00" data-testid="input-total-cost" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="phase" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phase</FormLabel>
                    <Select onValueChange={(val) => field.onChange(val === "none" ? "" : val)} value={field.value || "none"}>
                      <FormControl><SelectTrigger data-testid="select-phase"><SelectValue placeholder="Select phase" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        {projectPhases.map((p) => (
                          <SelectItem key={p} value={p}>{projectPhaseLabels[p]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {watchRegion === "AE" && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">UAE Tax Details</h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField control={form.control} name="placeOfSupply" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Place of Supply *</FormLabel>
                          <Select
                            onValueChange={(val) => {
                              field.onChange(val);
                              if (val === "inside_uae") form.setValue("supplyCountry", "");
                              if (val === "outside_uae") form.setValue("supplyCity", "");
                            }}
                            value={field.value || ""}
                          >
                            <FormControl><SelectTrigger data-testid="select-place-of-supply"><SelectValue placeholder="Select place of supply" /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="inside_uae">Inside UAE</SelectItem>
                              <SelectItem value="outside_uae">Outside UAE</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="projectType" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Project Type *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ""}>
                            <FormControl><SelectTrigger data-testid="select-project-type"><SelectValue placeholder="Select project type" /></SelectTrigger></FormControl>
                            <SelectContent>
                              {PROJECT_TYPE_OPTIONS.map((opt) => (
                                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      {watchPlaceOfSupply === "outside_uae" && (
                        <FormField control={form.control} name="supplyCountry" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Country *</FormLabel>
                            <FormControl>
                              <SearchableCombobox
                                options={COUNTRIES.map((c) => ({ value: c.name, label: c.name, icon: c.flag }))}
                                value={field.value || ""}
                                onChange={field.onChange}
                                placeholder="Select country"
                                searchPlaceholder="Search country..."
                                emptyText="No country found."
                                testId="combobox-supply-country"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      )}
                      {watchPlaceOfSupply === "inside_uae" && (
                        <FormField control={form.control} name="supplyCity" render={({ field }) => (
                          <FormItem>
                            <FormLabel>City *</FormLabel>
                            <FormControl>
                              <SearchableCombobox
                                options={UAE_CITIES.map((c) => ({ value: c, label: c }))}
                                value={field.value || ""}
                                onChange={field.onChange}
                                placeholder="Select city"
                                searchPlaceholder="Search city..."
                                emptyText="No city found."
                                testId="combobox-supply-city"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      )}
                      <FormField control={form.control} name="serviceType" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Service Type</FormLabel>
                          <FormControl><Input {...field} value={field.value || ""} placeholder="e.g. Consulting" data-testid="input-service-type" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="clientTrn" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Client TRN Number</FormLabel>
                          <FormControl><Input {...field} value={field.value || ""} placeholder="Tax Registration Number" data-testid="input-client-trn" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="clientBusinessName" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Client Business Name</FormLabel>
                          <FormControl><Input {...field} value={field.value || ""} placeholder="Registered business name" data-testid="input-client-business-name" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="clientAddress" render={({ field }) => (
                        <FormItem className="sm:col-span-2">
                          <FormLabel>Client Address</FormLabel>
                          <FormControl><Textarea {...field} value={field.value || ""} placeholder="Client business address" data-testid="input-client-address" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="vat" render={({ field }) => (
                        <FormItem>
                          <FormLabel>VAT (%) *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              {...field}
                              value={field.value || ""}
                              placeholder="e.g. 5"
                              data-testid="input-vat"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  </div>
                </>
              )}

              <Separator />
              
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Billing Configuration</h3>
                
                <FormField control={form.control} name="billingType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Billing Type</FormLabel>
                    <Select onValueChange={(val) => field.onChange(val === "none" ? "" : val)} value={field.value || "none"}>
                      <FormControl>
                        <SelectTrigger data-testid="select-billing-type">
                          <SelectValue placeholder="Select billing type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Not Set</SelectItem>
                        <SelectItem value="ftfc">Fixed Time Fixed Cost (FTFC)</SelectItem>
                        <SelectItem value="tbe">Team Based Engagement (TBE)</SelectItem>
                        <SelectItem value="mrr">Monthly Recurring Revenue (MRR)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Select how this project will be billed to generate milestones automatically
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />

                {watchBillingType === "ftfc" && (
                  <div className="space-y-4 p-4 border rounded-md bg-muted/30">
                    <FormField control={form.control} name="numberOfPhases" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Number of Phases *</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="1" 
                            max="20"
                            className="w-32"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                            data-testid="input-number-phases" 
                          />
                        </FormControl>
                        <FormDescription>How many milestone phases for this project</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                    
                    {phaseFields.length > 0 && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-12 gap-2 text-sm font-medium text-muted-foreground">
                          <div className="col-span-3">Phase Name</div>
                          <div className="col-span-2">Percentage</div>
                          <div className="col-span-3">Cost ($)</div>
                          <div className="col-span-4">Expected Due Date</div>
                        </div>
                        {phaseFields.map((phaseField, index) => (
                          <div key={phaseField.id} className="grid grid-cols-12 gap-2 items-start">
                            <FormField
                              control={form.control}
                              name={`phases.${index}.name`}
                              render={({ field }) => (
                                <FormItem className="col-span-3">
                                  <FormControl>
                                    <Input 
                                      {...field} 
                                      placeholder={`Phase ${index + 1}`}
                                      data-testid={`input-phase-name-${index}`}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`phases.${index}.percentage`}
                              render={({ field }) => (
                                <FormItem className="col-span-2">
                                  <FormControl>
                                    <div className="flex items-center gap-1">
                                      <Input 
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        max="100"
                                        {...field}
                                        onChange={(e) => {
                                          const pct = parseFloat(e.target.value) || 0;
                                          field.onChange(pct);
                                          // Auto-calculate cost from percentage
                                          const totalCost = parseFloat(watchTotalCost) || 0;
                                          const calculatedCost = Math.round((totalCost * pct / 100) * 100) / 100;
                                          form.setValue(`phases.${index}.cost`, calculatedCost);
                                        }}
                                        data-testid={`input-phase-pct-${index}`}
                                      />
                                      <span className="text-muted-foreground">%</span>
                                    </div>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`phases.${index}.cost`}
                              render={({ field }) => (
                                <FormItem className="col-span-3">
                                  <FormControl>
                                    <Input 
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      {...field}
                                      onChange={(e) => {
                                        const cost = parseFloat(e.target.value) || 0;
                                        field.onChange(cost);
                                        // Auto-calculate percentage from cost (allow decimals)
                                        const totalCost = parseFloat(watchTotalCost) || 0;
                                        if (totalCost > 0) {
                                          const pct = Math.round((cost / totalCost) * 10000) / 100;
                                          form.setValue(`phases.${index}.percentage`, pct);
                                        }
                                      }}
                                      data-testid={`input-phase-cost-${index}`}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`phases.${index}.dueDate`}
                              render={({ field }) => (
                                <FormItem className="col-span-4">
                                  <FormControl>
                                    <Input 
                                      type="date"
                                      {...field}
                                      data-testid={`input-phase-due-date-${index}`}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        ))}
                        
                        {/* Summary row */}
                        <div className="grid grid-cols-12 gap-2 pt-2 border-t text-sm">
                          <div className="col-span-3 font-medium">Total</div>
                          <div className="col-span-2">
                            <span className={`font-medium ${
                              phaseFields.reduce((sum, _, i) => sum + (form.getValues(`phases.${i}.percentage`) || 0), 0) === 100
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-destructive'
                            }`}>
                              {phaseFields.reduce((sum, _, i) => sum + (form.getValues(`phases.${i}.percentage`) || 0), 0)}%
                            </span>
                          </div>
                          <div className="col-span-3">
                            <span className={`font-medium ${
                              Math.abs(phaseFields.reduce((sum, _, i) => sum + (form.getValues(`phases.${i}.cost`) || 0), 0) - (parseFloat(watchTotalCost) || 0)) < 0.01
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-destructive'
                            }`}>
                              ${phaseFields.reduce((sum, _, i) => sum + (form.getValues(`phases.${i}.cost`) || 0), 0).toLocaleString()}
                            </span>
                          </div>
                          <div className="col-span-4"></div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {watchBillingType === "tbe" && (
                  <div className="space-y-4 p-4 border rounded-md bg-muted/30">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField control={form.control} name="contractStartDate" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contract Start Date *</FormLabel>
                          <FormControl><Input type="date" {...field} data-testid="input-contract-start" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="contractEndDate" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contract End Date *</FormLabel>
                          <FormControl><Input type="date" {...field} data-testid="input-contract-end" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="tbeHoursPerMonth" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Hours per Month *</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min="0" 
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              data-testid="input-hours-month" 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="tbeHourlyRate" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Hourly Rate ($) *</FormLabel>
                          <FormControl><Input type="number" step="0.01" {...field} data-testid="input-hourly-rate" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    
                    {/* TBE Summary */}
                    {tbeDurationMonths > 0 && (
                      <div className="pt-4 border-t space-y-3">
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Duration:</span>
                            <span className="ml-2 font-medium">{tbeDurationMonths} month{tbeDurationMonths !== 1 ? 's' : ''}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Monthly Cost:</span>
                            <span className="ml-2 font-medium">${tbeMonthlyCost.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Total:</span>
                            <span className="ml-2 font-medium">${(tbeMonthlyCost * tbeDurationMonths).toLocaleString()}</span>
                          </div>
                        </div>
                        
                        {/* Milestone Preview */}
                        {tbeMilestonePreview.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium">Payment Milestones Preview</h4>
                            <div className="max-h-40 overflow-y-auto rounded border bg-background">
                              <table className="w-full text-sm">
                                <thead className="bg-muted/50 sticky top-0">
                                  <tr>
                                    <th className="text-left p-2 font-medium">#</th>
                                    <th className="text-left p-2 font-medium">Month</th>
                                    <th className="text-right p-2 font-medium">Hours</th>
                                    <th className="text-right p-2 font-medium">Amount</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {tbeMilestonePreview.map((milestone, index) => (
                                    <tr key={index} className="border-t">
                                      <td className="p-2">{index + 1}</td>
                                      <td className="p-2">{milestone.name}</td>
                                      <td className="text-right p-2">{watchTbeHoursPerMonth || 0}</td>
                                      <td className="text-right p-2">${tbeMonthlyCost.toLocaleString()}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {watchBillingType === "mrr" && (
                  <div className="space-y-4 p-4 border rounded-md bg-muted/30">
                    <div className="grid gap-4 sm:grid-cols-3">
                      <FormField control={form.control} name="contractStartDate" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Start Date *</FormLabel>
                          <FormControl><Input type="date" {...field} data-testid="input-mrr-start" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="mrrDurationMonths" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Duration (Months) *</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min="1" 
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                              data-testid="input-mrr-duration" 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="mrrMonthlyAmount" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Monthly Amount ($)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01" 
                              {...field} 
                              readOnly 
                              className="bg-muted"
                              data-testid="input-mrr-amount" 
                            />
                          </FormControl>
                          <p className="text-xs text-muted-foreground">Auto-calculated from Total Cost ÷ Duration</p>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    
                    {/* MRR Summary and Milestone Preview */}
                    {mrrMilestonePreview.length > 0 && (
                      <div className="pt-4 border-t space-y-3">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Duration:</span>
                            <span className="ml-2 font-medium">{watchMrrDurationMonths} month{watchMrrDurationMonths !== 1 ? 's' : ''}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Total:</span>
                            <span className="ml-2 font-medium">${((parseFloat(watchMrrMonthlyAmount || "0") || 0) * (watchMrrDurationMonths || 0)).toLocaleString()}</span>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium">Payment Milestones Preview</h4>
                          <div className="max-h-40 overflow-y-auto rounded border bg-background">
                            <table className="w-full text-sm">
                              <thead className="bg-muted/50 sticky top-0">
                                <tr>
                                  <th className="text-left p-2 font-medium">#</th>
                                  <th className="text-left p-2 font-medium">Month</th>
                                  <th className="text-right p-2 font-medium">Amount</th>
                                </tr>
                              </thead>
                              <tbody>
                                {mrrMilestonePreview.map((milestone, index) => (
                                  <tr key={index} className="border-t">
                                    <td className="p-2">{index + 1}</td>
                                    <td className="p-2">{milestone.name}</td>
                                    <td className="text-right p-2">${(parseFloat(watchMrrMonthlyAmount || "0") || 0).toLocaleString()}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-project">
                  {editingProject ? "Update Project" : "Create Project"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ProjectDetailSheet projectId={selectedProject?.id ?? null} open={isProjectDetailOpen} onOpenChange={setIsProjectDetailOpen} />

      <AlertDialog open={!!deleteProject} onOpenChange={(open) => { if (!open) { setDeleteProject(null); setDeletePayments([]); }}}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Are you sure you want to delete "{deleteProject?.name}"?</p>
                
                {loadingPayments ? (
                  <div className="text-sm text-muted-foreground">Loading associated payments...</div>
                ) : deletePayments.length > 0 ? (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 space-y-2">
                    <p className="font-medium text-destructive">This will also delete {deletePayments.length} associated payment(s):</p>
                    <ul className="text-sm space-y-1 max-h-32 overflow-y-auto">
                      {deletePayments.map((payment) => (
                        <li key={payment.id} className="flex items-center justify-between gap-2">
                          <span>{payment.month}/{payment.year} - {payment.narration || "Payment"}</span>
                          <span className="font-medium">{formatCurrency(payment.totalAmount)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">This project has no associated payments.</p>
                )}
                
                <p className="text-sm text-muted-foreground">You will have 30 seconds to undo this action.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteProject && deleteMutation.mutate(deleteProject.id)} 
              className="bg-destructive text-destructive-foreground" 
              disabled={deleteMutation.isPending || loadingPayments}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Project"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Projects Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={(open) => { 
        if (!open) {
          setImportResult(null);
        }
        setIsImportDialogOpen(open);
      }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Import Projects from CSV
            </DialogTitle>
            <DialogDescription>
              Review the parsed data before importing
            </DialogDescription>
          </DialogHeader>
          
          {importResult && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="flex items-center gap-4">
                {importResult.valid.length > 0 && (
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <CheckCircle className="h-4 w-4" />
                    <span>{importResult.valid.length} valid project(s) ready to import</span>
                  </div>
                )}
                {importResult.errors.length > 0 && (
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <span>{importResult.errors.length} row(s) with errors</span>
                  </div>
                )}
              </div>
              
              {/* Errors */}
              {importResult.errors.length > 0 && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
                  <p className="font-medium text-destructive mb-2">Errors found:</p>
                  <ul className="text-sm space-y-1 max-h-24 overflow-y-auto">
                    {importResult.errors.map((error, i) => (
                      <li key={i} className="text-destructive">
                        Row {error.row}: {error.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Valid Projects Preview */}
              {importResult.valid.length > 0 && (
                <div className="border rounded-md">
                  <div className="bg-muted/50 px-3 py-2 border-b">
                    <p className="font-medium text-sm">Projects to be imported:</p>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Name</TableHead>
                          <TableHead className="text-xs">Client</TableHead>
                          <TableHead className="text-xs">Region</TableHead>
                          <TableHead className="text-xs">Billing</TableHead>
                          <TableHead className="text-xs text-right">Total Cost</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importResult.valid.map((project, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-sm">{project.name}</TableCell>
                            <TableCell className="text-sm">{project.clientName}</TableCell>
                            <TableCell><Badge variant="outline">{project.region}</Badge></TableCell>
                            <TableCell className="text-sm">{project.billingType ? billingTypeLabels[project.billingType] || project.billingType : "-"}</TableCell>
                            <TableCell className="text-sm text-right">{formatCurrency(project.totalCost)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleImportConfirm} 
              disabled={!importResult?.valid.length || importProjectsMutation.isPending}
              data-testid="button-confirm-import"
            >
              {importProjectsMutation.isPending ? "Importing..." : `Import ${importResult?.valid.length || 0} Project(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isMergeDialogOpen} onOpenChange={(open) => { if (!open) resetMergeState(); setIsMergeDialogOpen(open); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Merge Projects</DialogTitle>
            <DialogDescription>
              Combine duplicate projects by merging their data into a single target project. 
              All associated payments, milestones, invoices, and costs will be transferred.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-3">
              <label className="text-sm font-medium">Select Target Project (will receive all data)</label>
              <Select value={mergeTargetId} onValueChange={handleTargetChange}>
                <SelectTrigger data-testid="select-merge-target">
                  <SelectValue placeholder="Select target project..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredProjects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name} - {project.clientName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {mergeTargetId && (
              <div className="space-y-3">
                <label className="text-sm font-medium">Select Source Projects (will be merged and deleted)</label>
                <div className="border rounded-md max-h-48 overflow-y-auto">
                  {filteredProjects
                    .filter(p => p.id !== mergeTargetId)
                    .map((project) => (
                      <div 
                        key={project.id} 
                        className="flex items-center gap-3 p-3 border-b last:border-b-0 hover-elevate"
                      >
                        <Checkbox
                          id={`merge-source-${project.id}`}
                          checked={mergeSourceIds.includes(project.id)}
                          onCheckedChange={(checked) => handleMergeSourceToggle(project.id, !!checked)}
                          data-testid={`checkbox-merge-source-${project.id}`}
                        />
                        <label 
                          htmlFor={`merge-source-${project.id}`} 
                          className="flex-1 cursor-pointer text-sm"
                        >
                          <span className="font-medium">{project.name}</span>
                          <span className="text-muted-foreground"> - {project.clientName}</span>
                          <RegionBadge region={project.region} className="ml-2" />
                        </label>
                      </div>
                    ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Selected: {mergeSourceIds.length} project(s)
                </p>
              </div>
            )}

            {mergeTargetId && mergeSourceIds.length > 0 && !mergePreview && (
              <Button 
                variant="outline" 
                onClick={fetchMergePreview}
                disabled={isLoadingPreview}
                className="w-full"
                data-testid="button-preview-merge"
              >
                {isLoadingPreview ? "Loading Preview..." : "Preview Merge Impact"}
              </Button>
            )}

            {mergePreview && (
              <div className="space-y-4">
                <Separator />
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    Merge Preview
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="space-y-1">
                      <p className="text-muted-foreground">Target Project:</p>
                      <p className="font-medium">{mergePreview.targetProject.name}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground">Source Projects:</p>
                      <p className="font-medium">{mergePreview.sourceProjects.map(p => p.name).join(", ")}</p>
                    </div>
                  </div>
                  <Separator className="my-2" />
                  <p className="text-sm font-medium">Data to be transferred:</p>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="bg-background rounded p-2">
                      <p className="text-muted-foreground text-xs">Payments</p>
                      <p className="font-semibold text-lg">{mergePreview.counts.payments}</p>
                    </div>
                    <div className="bg-background rounded p-2">
                      <p className="text-muted-foreground text-xs">Milestones</p>
                      <p className="font-semibold text-lg">{mergePreview.counts.milestones}</p>
                    </div>
                    <div className="bg-background rounded p-2">
                      <p className="text-muted-foreground text-xs">Invoices</p>
                      <p className="font-semibold text-lg">{mergePreview.counts.invoices}</p>
                    </div>
                    <div className="bg-background rounded p-2">
                      <p className="text-muted-foreground text-xs">Upsells</p>
                      <p className="font-semibold text-lg">{mergePreview.counts.upsells}</p>
                    </div>
                    <div className="bg-background rounded p-2">
                      <p className="text-muted-foreground text-xs">Timesheets</p>
                      <p className="font-semibold text-lg">{mergePreview.counts.timesheets}</p>
                    </div>
                    <div className="bg-background rounded p-2">
                      <p className="text-muted-foreground text-xs">Costs</p>
                      <p className="font-semibold text-lg">{mergePreview.counts.costs}</p>
                    </div>
                  </div>
                  <div className="bg-destructive/10 border border-destructive/20 rounded p-3 mt-3">
                    <p className="text-sm text-destructive font-medium">
                      Warning: This action cannot be undone. The source project(s) will be permanently deleted.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { resetMergeState(); setIsMergeDialogOpen(false); }}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleMergeConfirm}
              disabled={!mergePreview || mergeMutation.isPending}
              data-testid="button-confirm-merge"
            >
              {mergeMutation.isPending ? "Merging..." : "Confirm Merge"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
