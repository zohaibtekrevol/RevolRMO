import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Check, X, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Clock, User, FileText, Calendar as CalendarIcon, Upload, Trash2, ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
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
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { CsvUploadDialog } from "@/components/csv-upload-dialog";
import type { SystemPermission } from "@shared/schema";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { Project, User as UserType } from "@shared/schema";

interface MyEffectiveRateResponse {
  rate: string | null;
  source: "global_override" | "resource" | "none";
}

interface ActiveResource {
  id: string;
  name: string;
  designation: string | null;
  effectiveHourlyRate: string | null;
  employmentType: string;
}

interface TimesheetWithDetails {
  id: string;
  userId: string;
  projectId: string;
  date: string;
  hoursLogged: string;
  hourlyCostRate: string;
  description: string | null;
  approvalStatus: "pending" | "approved" | "rejected";
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user: UserType | null;
  project: Project | null;
  approver: UserType | null;
}

const MONTHS = [
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

const timesheetFormSchema = z.object({
  projectId: z.string().min(1, "Project is required"),
  resourceId: z.string().optional(),
  date: z.string().min(1, "Date is required"),
  hoursLogged: z.string().min(1, "Hours is required").refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    "Must be a positive number"
  ),
  hourlyCostRate: z.string().min(1, "Hourly rate is required").refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    "Must be a positive number"
  ),
  description: z.string().optional(),
});

type TimesheetFormData = z.infer<typeof timesheetFormSchema>;

export default function Timesheets() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [expandedTimesheets, setExpandedTimesheets] = useState<Set<string>>(new Set());

  const toggleTimesheetExpand = (id: string) => {
    setExpandedTimesheets(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [csvUploadOpen, setCsvUploadOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [useGlobalRate, setUseGlobalRate] = useState(false);
  const [selectedResourceId, setSelectedResourceId] = useState<string>("");

  const { data: userPermissions } = useQuery<SystemPermission[]>({
    queryKey: ["/api/access/my-permissions"],
  });
  
  const canDeleteTimesheets = userPermissions?.includes("delete_timesheets") ?? false;

  const { data: timesheets, isLoading } = useQuery<TimesheetWithDetails[]>({
    queryKey: ["/api/timesheets", selectedMonth, selectedYear, statusFilter, projectFilter],
    queryFn: async () => {
      let url = `/api/timesheets?month=${selectedMonth}&year=${selectedYear}`;
      if (statusFilter !== "all") {
        url += `&status=${statusFilter}`;
      }
      if (projectFilter !== "all") {
        url += `&projectId=${projectFilter}`;
      }
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch timesheets");
      return res.json();
    },
  });

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  // Fetch active resources for dropdown selection
  const { data: activeResources } = useQuery<ActiveResource[]>({
    queryKey: ["/api/resources/active-list"],
  });

  // Fetch user's effective rate using secure endpoint that applies rate hierarchy
  const { data: myRateData } = useQuery<MyEffectiveRateResponse>({
    queryKey: ["/api/resources/my-effective-rate"],
    queryFn: async () => {
      const response = await fetch("/api/resources/my-effective-rate", { credentials: "include" });
      if (!response.ok) return { rate: null, source: "none" as const };
      return response.json();
    },
  });

  // Auto-populated rate from server (includes global override logic)
  const autoRate = myRateData?.rate ? parseFloat(myRateData.rate).toFixed(2) : "";
  const hasAutoRate = autoRate !== "" && autoRate !== "0.00";
  const rateSource = myRateData?.source || "none";

  const form = useForm<TimesheetFormData>({
    resolver: zodResolver(timesheetFormSchema),
    defaultValues: {
      projectId: "",
      resourceId: "",
      date: format(new Date(), "yyyy-MM-dd"),
      hoursLogged: "",
      hourlyCostRate: "",
      description: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: TimesheetFormData) => {
      return apiRequest("POST", "/api/timesheets", {
        ...data,
        userId: currentUser?.id || "session-user",
        date: new Date(data.date),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timesheets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cost-margin/summary"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/cost-margin/hourly-buckets"], exact: false });
      setIsDialogOpen(false);
      form.reset();
      toast({ title: "Timesheet entry created" });
    },
    onError: () => {
      toast({ title: "Failed to create timesheet", variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/timesheets/${id}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timesheets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cost-margin/summary"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/cost-margin/hourly-buckets"], exact: false });
      toast({ title: "Timesheet approved" });
    },
    onError: () => {
      toast({ title: "Failed to approve timesheet", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/timesheets/${id}/reject`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timesheets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cost-margin/summary"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/cost-margin/hourly-buckets"], exact: false });
      toast({ title: "Timesheet rejected" });
    },
    onError: () => {
      toast({ title: "Failed to reject timesheet", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/timesheets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timesheets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cost-margin/summary"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/cost-margin/hourly-buckets"], exact: false });
      setDeleteConfirmId(null);
      toast({ title: "Timesheet entry deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete timesheet", variant: "destructive" });
    },
  });

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  // Handle resource selection - auto-populate rate from selected resource
  const handleResourceChange = (resourceId: string) => {
    setSelectedResourceId(resourceId);
    if (resourceId && resourceId !== "none") {
      const selectedResource = activeResources?.find(r => r.id === resourceId);
      if (selectedResource?.effectiveHourlyRate && !useGlobalRate) {
        form.setValue("hourlyCostRate", parseFloat(selectedResource.effectiveHourlyRate).toFixed(2));
      }
      form.setValue("resourceId", resourceId);
    } else {
      form.setValue("resourceId", "");
      // If no resource selected, use global rate if available
      if (hasAutoRate) {
        form.setValue("hourlyCostRate", autoRate);
      }
    }
  };

  // Handle toggle for using global rate
  const handleUseGlobalRateToggle = (checked: boolean) => {
    setUseGlobalRate(checked);
    if (checked && hasAutoRate) {
      form.setValue("hourlyCostRate", autoRate);
    } else if (!checked && selectedResourceId && selectedResourceId !== "none") {
      const selectedResource = activeResources?.find(r => r.id === selectedResourceId);
      if (selectedResource?.effectiveHourlyRate) {
        form.setValue("hourlyCostRate", parseFloat(selectedResource.effectiveHourlyRate).toFixed(2));
      }
    }
  };

  const handleOpenDialog = () => {
    setSelectedResourceId("");
    setUseGlobalRate(false);
    form.reset({
      projectId: "",
      resourceId: "",
      date: format(new Date(), "yyyy-MM-dd"),
      hoursLogged: "",
      hourlyCostRate: "",
      description: "",
    });
    setIsDialogOpen(true);
  };

  const onSubmit = (data: TimesheetFormData) => {
    createMutation.mutate(data);
  };

  const StatusBadge = ({ status }: { status: "pending" | "approved" | "rejected" }) => {
    if (status === "approved") {
      return (
        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
          <Check className="w-3 h-3 mr-1" /> Approved
        </Badge>
      );
    }
    if (status === "rejected") {
      return (
        <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">
          <X className="w-3 h-3 mr-1" /> Rejected
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
        <Clock className="w-3 h-3 mr-1" /> Pending
      </Badge>
    );
  };

  const totalHours = timesheets?.reduce((sum, ts) => sum + parseFloat(ts.hoursLogged || "0"), 0) || 0;
  const pendingCount = timesheets?.filter(ts => ts.approvalStatus === "pending").length || 0;
  const approvedCount = timesheets?.filter(ts => ts.approvalStatus === "approved").length || 0;

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div className="space-y-1">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight" data-testid="text-timesheets-title">
            Timesheets
          </h1>
          <p className="text-muted-foreground">
            Track and manage project time entries
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="icon"
            onClick={handlePrevMonth}
            data-testid="button-prev-month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Select
            value={String(selectedMonth)}
            onValueChange={(val) => setSelectedMonth(parseInt(val))}
          >
            <SelectTrigger className="w-[130px]" data-testid="select-month">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m) => (
                <SelectItem key={m.value} value={String(m.value)}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={String(selectedYear)}
            onValueChange={(val) => setSelectedYear(parseInt(val))}
          >
            <SelectTrigger className="w-[100px]" data-testid="select-year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2023, 2024, 2025, 2026].map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon"
            onClick={handleNextMonth}
            data-testid="button-next-month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[120px]" data-testid="select-status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>

          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-[180px]" data-testid="select-project-filter">
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects?.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={() => setCsvUploadOpen(true)} data-testid="button-upload-csv">
            <Upload className="h-4 w-4 mr-2" />
            Upload CSV
          </Button>
          <Button onClick={handleOpenDialog} data-testid="button-add-timesheet">
            <Plus className="h-4 w-4 mr-2" />
            Add Entry
          </Button>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Total Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold" data-testid="text-total-hours">
              {totalHours.toFixed(1)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Hours logged this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Pending Approval
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold" data-testid="text-pending-count">
              {pendingCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Entries awaiting review
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Check className="h-4 w-4" />
              Approved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold" data-testid="text-approved-count">
              {approvedCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Entries approved
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Time Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Mobile card view (< md) */}
          <div className="block md:hidden space-y-3">
            {timesheets && timesheets.length > 0 ? timesheets.map((ts) => {
              const isExpanded = expandedTimesheets.has(ts.id);
              return (
                <div key={ts.id} className="rounded-lg border bg-card shadow-sm" data-testid={`card-timesheet-${ts.id}`}>
                  <div className="flex items-start justify-between gap-2 p-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{format(new Date(ts.date), "MMM d, yyyy")}</span>
                        <StatusBadge status={ts.approvalStatus} />
                      </div>
                      <p className="text-sm font-medium mt-0.5 truncate">{ts.project?.name || "Unknown Project"}</p>
                      <p className="text-base font-bold mt-1">{parseFloat(ts.hoursLogged || "0").toFixed(1)} hrs</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {ts.approvalStatus === "pending" && (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-green-600 h-8 w-8"
                            onClick={() => approveMutation.mutate(ts.id)}
                            disabled={approveMutation.isPending}
                            data-testid={`button-approve-${ts.id}`}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-red-600 h-8 w-8"
                            onClick={() => rejectMutation.mutate(ts.id)}
                            disabled={rejectMutation.isPending}
                            data-testid={`button-reject-${ts.id}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {canDeleteTimesheets && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive h-8 w-8"
                          onClick={() => setDeleteConfirmId(ts.id)}
                          data-testid={`button-delete-${ts.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => toggleTimesheetExpand(ts.id)}
                        data-testid={`button-expand-ts-${ts.id}`}
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="border-t px-4 py-3 space-y-2 text-sm bg-muted/30">
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">User</span>
                        <span className="font-medium">{ts.user?.firstName} {ts.user?.lastName}</span>
                      </div>
                      {ts.description && (
                        <div className="flex flex-col gap-1">
                          <span className="text-muted-foreground">Description</span>
                          <span className="font-medium">{ts.description}</span>
                        </div>
                      )}
                      {ts.approvedBy && (
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground">Approved by</span>
                          <span className="font-medium">{ts.approver?.firstName} {ts.approver?.lastName}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            }) : (
              <p className="text-center text-muted-foreground py-8">
                No timesheet entries for {MONTHS[selectedMonth - 1].label} {selectedYear}
              </p>
            )}
          </div>

          {/* Desktop table view (≥ md) */}
          <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Project</TableHead>
                <TableHead className="text-right">Hours</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {timesheets?.map((ts) => (
                <TableRow key={ts.id} data-testid={`row-timesheet-${ts.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                      {format(new Date(ts.date), "MMM d, yyyy")}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      {ts.user?.firstName} {ts.user?.lastName}
                    </div>
                  </TableCell>
                  <TableCell>{ts.project?.name || "Unknown Project"}</TableCell>
                  <TableCell className="text-right font-medium">{parseFloat(ts.hoursLogged || "0").toFixed(1)}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{ts.description || "-"}</TableCell>
                  <TableCell>
                    <StatusBadge status={ts.approvalStatus} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {ts.approvalStatus === "pending" && (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-green-600"
                            onClick={() => approveMutation.mutate(ts.id)}
                            disabled={approveMutation.isPending}
                            data-testid={`button-approve-${ts.id}`}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-red-600"
                            onClick={() => rejectMutation.mutate(ts.id)}
                            disabled={rejectMutation.isPending}
                            data-testid={`button-reject-${ts.id}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {canDeleteTimesheets && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => setDeleteConfirmId(ts.id)}
                          data-testid={`button-delete-${ts.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(!timesheets || timesheets.length === 0) && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No timesheet entries for {MONTHS[selectedMonth - 1].label} {selectedYear}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Timesheet Entry</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="projectId"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Project</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn(
                              "w-full justify-between",
                              !field.value && "text-muted-foreground"
                            )}
                            data-testid="input-project"
                          >
                            {field.value
                              ? projects?.find((p) => p.id === field.value)?.name
                              : "Search and select project..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search projects..." />
                          <CommandList className="max-h-[200px] overflow-y-auto">
                            <CommandEmpty>No project found.</CommandEmpty>
                            <CommandGroup>
                              {projects?.map((p) => (
                                <CommandItem
                                  key={p.id}
                                  value={p.name}
                                  onSelect={() => {
                                    field.onChange(p.id);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      p.id === field.value ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {p.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="resourceId"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Resource</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn(
                              "w-full justify-between",
                              !selectedResourceId && "text-muted-foreground"
                            )}
                            data-testid="input-resource"
                          >
                            {selectedResourceId && selectedResourceId !== "none"
                              ? (() => {
                                  const r = activeResources?.find((r) => r.id === selectedResourceId);
                                  return r ? `${r.name}${r.designation ? ` - ${r.designation}` : ""}` : "Select resource...";
                                })()
                              : "Search and select resource..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search resources..." />
                          <CommandList className="max-h-[200px] overflow-y-auto">
                            <CommandEmpty>No resource found.</CommandEmpty>
                            <CommandGroup>
                              {activeResources?.map((r) => (
                                <CommandItem
                                  key={r.id}
                                  value={`${r.name} ${r.designation || ""}`}
                                  onSelect={() => {
                                    handleResourceChange(r.id);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      r.id === selectedResourceId ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {r.name}{r.designation ? ` - ${r.designation}` : ""} 
                                  {r.effectiveHourlyRate ? ` ($${parseFloat(r.effectiveHourlyRate).toFixed(2)}/hr)` : ""}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <p className="text-xs text-muted-foreground">
                      Select a team member to auto-populate their hourly rate
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="hoursLogged"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hours</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.5"
                        min="0.5"
                        placeholder="8.0"
                        {...field}
                        data-testid="input-hours"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {hasAutoRate && selectedResourceId && selectedResourceId !== "none" && (
                <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50 border">
                  <Switch
                    id="use-global-rate"
                    checked={useGlobalRate}
                    onCheckedChange={handleUseGlobalRateToggle}
                    data-testid="switch-use-global-rate"
                  />
                  <Label htmlFor="use-global-rate" className="text-sm cursor-pointer">
                    Use global rate (${autoRate}/hr) instead of resource rate
                  </Label>
                </div>
              )}

              <FormField
                control={form.control}
                name="hourlyCostRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hourly Rate ($)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="50.00"
                        {...field}
                        readOnly={!!(selectedResourceId && selectedResourceId !== "none")}
                        className={(selectedResourceId && selectedResourceId !== "none") ? "bg-muted" : ""}
                        data-testid="input-hourly-rate"
                      />
                    </FormControl>
                    {selectedResourceId && selectedResourceId !== "none" ? (
                      <p className="text-xs text-muted-foreground">
                        {useGlobalRate 
                          ? "Using global rate override" 
                          : "Rate populated from selected resource"}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Select a resource above to auto-populate rate, or enter manually
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="What did you work on?"
                        {...field}
                        data-testid="input-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit">
                  {createMutation.isPending ? "Saving..." : "Save Entry"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Timesheet Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this timesheet entry? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CsvUploadDialog
        open={csvUploadOpen}
        onOpenChange={setCsvUploadOpen}
        title="Import Timesheets from CSV"
        description="Upload a CSV file to bulk import your timesheet entries. Download the template for the correct format."
        templateUrl="/api/timesheets/csv-template"
        templateFilename="timesheets_template.csv"
        expectedColumns={["project_name", "date", "hours_logged", "description"]}
        columnDisplayNames={{
          project_name: "Project Name",
          date: "Date",
          hours_logged: "Hours Logged",
          description: "Description",
        }}
        onImport={async (data) => {
          const response = await apiRequest("POST", "/api/timesheets/csv-import", { timesheets: data });
          return response.json();
        }}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/timesheets"] });
          queryClient.invalidateQueries({ queryKey: ["/api/cost-margin/summary"], exact: false });
          queryClient.invalidateQueries({ queryKey: ["/api/cost-margin/hourly-buckets"], exact: false });
          toast({ title: "Import completed", description: "Timesheets have been imported successfully" });
        }}
      />
    </div>
  );
}
