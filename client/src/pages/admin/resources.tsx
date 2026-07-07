import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, getErrorMessage } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, MoreHorizontal, Search, Trash2, Edit, UserCheck, UserX, DollarSign, Users, Settings, ChevronDown, ChevronRight, Upload } from "lucide-react";
import { CsvUploadDialog } from "@/components/csv-upload-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import type { ResourceWithUser, User, ResourceRateSettings } from "@shared/schema";

const MONTHLY_WORKING_HOURS = 176;

const resourceFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  designation: z.string().optional(),
  employmentType: z.enum(["employee", "contractor"], { required_error: "Employment type is required" }),
  monthlySalary: z.string().optional(),
  contractorHourlyRate: z.string().optional(),
  isActive: z.boolean().default(true),
  userId: z.string().optional(),
}).refine((data) => {
  if (data.employmentType === "employee") {
    return data.monthlySalary && parseFloat(data.monthlySalary) > 0;
  }
  return true;
}, {
  message: "Monthly salary is required for employees",
  path: ["monthlySalary"],
}).refine((data) => {
  if (data.employmentType === "contractor") {
    return data.contractorHourlyRate && parseFloat(data.contractorHourlyRate) > 0;
  }
  return true;
}, {
  message: "Hourly rate is required for contractors",
  path: ["contractorHourlyRate"],
});

type ResourceFormValues = z.infer<typeof resourceFormSchema>;

const rateSettingsSchema = z.object({
  useGlobalFixedRate: z.boolean().default(false),
  globalFixedHourlyRate: z.string().optional(),
}).refine((data) => {
  if (data.useGlobalFixedRate) {
    return data.globalFixedHourlyRate && parseFloat(data.globalFixedHourlyRate) > 0;
  }
  return true;
}, {
  message: "Global hourly rate is required when using fixed rate",
  path: ["globalFixedHourlyRate"],
});

type RateSettingsFormValues = z.infer<typeof rateSettingsSchema>;

function computeEffectiveHourlyRate(employmentType: string, monthlySalary?: string, contractorHourlyRate?: string): string {
  if (employmentType === "employee" && monthlySalary) {
    const salary = parseFloat(monthlySalary);
    if (!isNaN(salary) && salary > 0) {
      return (salary / MONTHLY_WORKING_HOURS).toFixed(2);
    }
  } else if (employmentType === "contractor" && contractorHourlyRate) {
    const rate = parseFloat(contractorHourlyRate);
    if (!isNaN(rate) && rate > 0) {
      return rate.toFixed(2);
    }
  }
  return "0.00";
}

export default function AdminResources() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<ResourceWithUser | null>(null);
  const [search, setSearch] = useState("");
  const [resourceToDelete, setResourceToDelete] = useState<ResourceWithUser | null>(null);
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [csvUploadOpen, setCsvUploadOpen] = useState(false);

  const form = useForm<ResourceFormValues>({
    resolver: zodResolver(resourceFormSchema),
    defaultValues: {
      name: "",
      email: "",
      designation: "",
      employmentType: "employee",
      monthlySalary: "",
      contractorHourlyRate: "",
      isActive: true,
      userId: "",
    },
  });

  const watchEmploymentType = form.watch("employmentType");
  const watchMonthlySalary = form.watch("monthlySalary");
  const watchContractorRate = form.watch("contractorHourlyRate");
  const computedRate = computeEffectiveHourlyRate(watchEmploymentType, watchMonthlySalary, watchContractorRate);

  const { data: resources, isLoading } = useQuery<ResourceWithUser[]>({
    queryKey: ["/api/resources", { isActive: showActiveOnly ? true : undefined }],
    queryFn: async () => {
      const params = showActiveOnly ? "?isActive=true" : "";
      const response = await fetch(`/api/resources${params}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch resources");
      return response.json();
    },
  });

  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: rateSettings } = useQuery<ResourceRateSettings[]>({
    queryKey: ["/api/resource-rate-settings"],
  });

  const globalSettings = rateSettings?.find(s => s.region === "global");

  const rateSettingsForm = useForm<RateSettingsFormValues>({
    resolver: zodResolver(rateSettingsSchema),
    defaultValues: {
      useGlobalFixedRate: false,
      globalFixedHourlyRate: "",
    },
  });

  // Reset form when settings data loads
  useEffect(() => {
    if (globalSettings) {
      rateSettingsForm.reset({
        useGlobalFixedRate: globalSettings.useGlobalFixedRate || false,
        globalFixedHourlyRate: globalSettings.globalFixedHourlyRate || "",
      });
    }
  }, [globalSettings, rateSettingsForm]);

  const saveRateSettingsMutation = useMutation({
    mutationFn: async (data: RateSettingsFormValues) => {
      return apiRequest("POST", "/api/resource-rate-settings", {
        ...data,
        region: "global",
        globalFixedHourlyRate: data.globalFixedHourlyRate || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resource-rate-settings"] });
      toast({ title: "Settings Saved", description: "Global rate settings have been saved." });
    },
    onError: (error) => {
      toast({ title: "Error", description: getErrorMessage(error, "Failed to save settings."), variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ResourceFormValues) => {
      const payload = {
        ...data,
        userId: data.userId || null,
        monthlySalary: data.monthlySalary || null,
        contractorHourlyRate: data.contractorHourlyRate || null,
      };
      return apiRequest("POST", "/api/resources", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resources"] });
      setIsDialogOpen(false);
      form.reset();
      toast({ title: "Resource Created", description: "Resource has been created successfully." });
    },
    onError: (error) => {
      toast({ title: "Error", description: getErrorMessage(error, "Failed to create resource."), variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: ResourceFormValues & { id: string }) => {
      const payload = {
        ...data,
        userId: data.userId || null,
        monthlySalary: data.monthlySalary || null,
        contractorHourlyRate: data.contractorHourlyRate || null,
      };
      return apiRequest("PATCH", `/api/resources/${data.id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resources"] });
      setIsDialogOpen(false);
      setEditingResource(null);
      form.reset();
      toast({ title: "Resource Updated", description: "Resource has been updated successfully." });
    },
    onError: (error) => {
      toast({ title: "Error", description: getErrorMessage(error, "Failed to update resource."), variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (resourceId: string) => {
      return apiRequest("DELETE", `/api/resources/${resourceId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resources"] });
      setResourceToDelete(null);
      toast({ title: "Resource Deleted", description: "Resource has been permanently deleted." });
    },
    onError: (error) => {
      toast({ title: "Error", description: getErrorMessage(error, "Failed to delete resource."), variant: "destructive" });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async (data: { id: string; isActive: boolean }) => {
      return apiRequest("PATCH", `/api/resources/${data.id}`, { isActive: data.isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resources"] });
      toast({ title: "Status Updated", description: "Resource status has been updated." });
    },
    onError: (error) => {
      toast({ title: "Error", description: getErrorMessage(error, "Failed to update resource status."), variant: "destructive" });
    },
  });

  const filteredResources = resources?.filter(r => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      r.name?.toLowerCase().includes(searchLower) ||
      r.email?.toLowerCase().includes(searchLower) ||
      r.designation?.toLowerCase().includes(searchLower)
    );
  });

  const handleOpenDialog = (resource?: ResourceWithUser) => {
    if (resource) {
      setEditingResource(resource);
      form.reset({
        name: resource.name,
        email: resource.email || "",
        designation: resource.designation || "",
        employmentType: resource.employmentType as "employee" | "contractor",
        monthlySalary: resource.monthlySalary || "",
        contractorHourlyRate: resource.contractorHourlyRate || "",
        isActive: resource.isActive,
        userId: resource.userId || "",
      });
    } else {
      setEditingResource(null);
      form.reset({
        name: "",
        email: "",
        designation: "",
        employmentType: "employee",
        monthlySalary: "",
        contractorHourlyRate: "",
        isActive: true,
        userId: "",
      });
    }
    setIsDialogOpen(true);
  };

  const onSubmit = (data: ResourceFormValues) => {
    if (editingResource) {
      updateMutation.mutate({ ...data, id: editingResource.id });
    } else {
      createMutation.mutate(data);
    }
  };

  const formatCurrency = (value: string | null | undefined) => {
    if (!value) return "-";
    const num = parseFloat(value);
    return isNaN(num) ? "-" : `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const activeCount = resources?.filter(r => r.isActive).length || 0;
  const employeeCount = resources?.filter(r => r.employmentType === "employee").length || 0;
  const contractorCount = resources?.filter(r => r.employmentType === "contractor").length || 0;

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Resources</h1>
          <p className="text-muted-foreground text-sm">Manage team member salary and rate information for cost calculations</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setCsvUploadOpen(true)} data-testid="button-upload-csv">
            <Upload className="w-4 h-4 mr-2" />
            Upload CSV
          </Button>
          <Button onClick={() => handleOpenDialog()} data-testid="button-add-resource">
            <Plus className="w-4 h-4 mr-2" />
            Add Resource
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Resources</CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-resources">{resources?.length || 0}</div>
            <p className="text-xs text-muted-foreground">{activeCount} active</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Employees</CardTitle>
            <UserCheck className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-employee-count">{employeeCount}</div>
            <p className="text-xs text-muted-foreground">Salary-based</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contractors</CardTitle>
            <DollarSign className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-contractor-count">{contractorCount}</div>
            <p className="text-xs text-muted-foreground">Hourly-based</p>
          </CardContent>
        </Card>
      </div>

      <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
        <Card>
          <CardHeader className="pb-3">
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between gap-4 cursor-pointer hover-elevate rounded-md p-2 -m-2">
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-muted-foreground" />
                  <CardTitle className="text-base">Global Rate Settings</CardTitle>
                  {globalSettings?.useGlobalFixedRate && (
                    <Badge variant="secondary">Override Active: ${globalSettings.globalFixedHourlyRate}/hr</Badge>
                  )}
                </div>
                {settingsOpen ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <Form {...rateSettingsForm}>
                <form onSubmit={rateSettingsForm.handleSubmit((data) => saveRateSettingsMutation.mutate(data))} className="space-y-4">
                  <FormField
                    control={rateSettingsForm.control}
                    name="useGlobalFixedRate"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Use Global Fixed Rate</FormLabel>
                          <FormDescription>
                            When enabled, all resources will use this hourly rate instead of their individual rates for cost calculations.
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-use-global-rate"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  {rateSettingsForm.watch("useGlobalFixedRate") && (
                    <FormField
                      control={rateSettingsForm.control}
                      name="globalFixedHourlyRate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Global Fixed Hourly Rate (USD)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="50.00"
                              {...field}
                              data-testid="input-global-hourly-rate"
                            />
                          </FormControl>
                          <FormDescription>
                            This rate will be used for all timesheet entries and cost calculations, overriding individual resource rates.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  <Button
                    type="submit"
                    disabled={saveRateSettingsMutation.isPending}
                    data-testid="button-save-rate-settings"
                  >
                    {saveRateSettingsMutation.isPending ? "Saving..." : "Save Settings"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle>Resource List</CardTitle>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Switch
                  id="active-only"
                  checked={showActiveOnly}
                  onCheckedChange={setShowActiveOnly}
                  data-testid="switch-active-only"
                />
                <label htmlFor="active-only" className="text-sm text-muted-foreground">
                  Active only
                </label>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search resources..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 w-64"
                  data-testid="input-search-resources"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Salary/Rate</TableHead>
                  <TableHead className="text-right">Effective Rate</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Linked User</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredResources?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      No resources found. Click "Add Resource" to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredResources?.map((resource) => (
                    <TableRow key={resource.id} data-testid={`row-resource-${resource.id}`}>
                      <TableCell className="font-medium">{resource.name}</TableCell>
                      <TableCell>{resource.email}</TableCell>
                      <TableCell>{resource.designation || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={resource.employmentType === "employee" ? "default" : "secondary"}>
                          {resource.employmentType === "employee" ? "Employee" : "Contractor"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {resource.employmentType === "employee" 
                          ? `${formatCurrency(resource.monthlySalary)}/mo`
                          : `${formatCurrency(resource.contractorHourlyRate)}/hr`
                        }
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(resource.effectiveHourlyRate)}/hr
                      </TableCell>
                      <TableCell>
                        <Badge variant={resource.isActive ? "default" : "outline"}>
                          {resource.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {resource.user ? (
                          <span className="text-sm">{resource.user.firstName} {resource.user.lastName}</span>
                        ) : (
                          <span className="text-muted-foreground text-sm">Not linked</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`button-actions-${resource.id}`}>
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenDialog(resource)}>
                              <Edit className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toggleStatusMutation.mutate({ id: resource.id, isActive: !resource.isActive })}>
                              {resource.isActive ? (
                                <>
                                  <UserX className="w-4 h-4 mr-2" />
                                  Deactivate
                                </>
                              ) : (
                                <>
                                  <UserCheck className="w-4 h-4 mr-2" />
                                  Activate
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => setResourceToDelete(resource)}
                              className="text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingResource ? "Edit Resource" : "Add Resource"}</DialogTitle>
            <DialogDescription>
              {editingResource ? "Update resource information and rate settings." : "Add a new team member with salary or hourly rate information."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} data-testid="input-resource-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="john@company.com" type="email" {...field} data-testid="input-resource-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="designation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Designation (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Senior Developer" {...field} data-testid="input-resource-designation" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="employmentType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employment Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-employment-type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="employee">Employee (Monthly Salary)</SelectItem>
                        <SelectItem value="contractor">Contractor (Hourly Rate)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {watchEmploymentType === "employee" && (
                <FormField
                  control={form.control}
                  name="monthlySalary"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monthly Salary (USD)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01" 
                          placeholder="5000.00" 
                          {...field} 
                          data-testid="input-monthly-salary" 
                        />
                      </FormControl>
                      <FormDescription>
                        Hourly rate will be calculated automatically (salary / {MONTHLY_WORKING_HOURS} hours)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {watchEmploymentType === "contractor" && (
                <FormField
                  control={form.control}
                  name="contractorHourlyRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hourly Rate (USD)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01" 
                          placeholder="75.00" 
                          {...field} 
                          data-testid="input-hourly-rate" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <div className="p-3 bg-muted rounded-md">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Computed Effective Hourly Rate:</span>
                  <span className="font-semibold" data-testid="text-computed-rate">${computedRate}/hr</span>
                </div>
              </div>
              <FormField
                control={form.control}
                name="userId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Link to User Account (Optional)</FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(value === "none" ? "" : value)} 
                      value={field.value || "none"}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-linked-user">
                          <SelectValue placeholder="Select user to link" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {users?.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.firstName} {user.lastName} ({user.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Link this resource to a system user for automatic rate population in timesheets
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Active</FormLabel>
                      <FormDescription>
                        Inactive resources won't appear in timesheet selections
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-is-active"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-save-resource"
                >
                  {createMutation.isPending || updateMutation.isPending ? "Saving..." : editingResource ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!resourceToDelete} onOpenChange={() => setResourceToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Resource</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{resourceToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => resourceToDelete && deleteMutation.mutate(resourceToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CsvUploadDialog
        open={csvUploadOpen}
        onOpenChange={setCsvUploadOpen}
        title="Import Resources from CSV"
        description="Upload a CSV file to bulk import resources. Download the template for the correct format."
        templateFilename="resources_template.csv"
        templateContent="name,email,designation,employment_type,monthly_salary,contractor_hourly_rate\nJohn Doe,john@example.com,Software Engineer,employee,5000,\nJane Smith,jane@example.com,Consultant,contractor,,75"
        expectedColumns={["name", "email", "designation", "employment_type", "monthly_salary", "contractor_hourly_rate"]}
        columnDisplayNames={{
          name: "Name",
          email: "Email",
          designation: "Designation",
          employment_type: "Employment Type",
          monthly_salary: "Monthly Salary",
          contractor_hourly_rate: "Hourly Rate (Contractor)",
        }}
        onImport={async (data) => {
          const response = await apiRequest("POST", "/api/resources/csv-import", { resources: data });
          return response.json();
        }}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/resources"] });
          toast({ title: "Import completed", description: "Resources have been imported successfully" });
        }}
      />
    </div>
  );
}
