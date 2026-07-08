import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSearch } from "wouter";
import AdminPodsPage from "@/pages/admin/pods";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Settings, Save, Building2, Bell, FileText, Calendar, Mail, Send, 
  AlertCircle, CheckCircle2, Landmark, TrendingUp, Plus, Pencil, 
  Trash2, Shield, Users, Key, Lock, Unlock, Target, Palette, RotateCcw,
  Activity, Clock, AlertTriangle, RefreshCw, Zap, Link2, Unlink, ExternalLink,
  XCircle, DollarSign, Users2, Eye, EyeOff, LayoutGrid,
  ShieldCheck, ShieldAlert, Ban, Globe, Gauge, LogIn, Brain
} from "lucide-react";
import type { AppSettings, RegionBankingDetails, Region, Currency, UpsellTypeSetting, Role, SystemPermission, ThemeSettings, SecurityDashboard } from "@shared/schema";
import { navSections } from "@/components/app-sidebar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";

interface QuickbooksSettings {
  id?: string;
  isConnected: boolean;
  realmId?: string;
  tokenExpiresAt?: string;
  refreshTokenExpiresAt?: string;
  lastSyncAt?: string;
  syncEnabled?: boolean;
  autoSyncInvoices?: boolean;
  hasTokens?: boolean;
  webhookVerifierToken?: string;
}

interface WebhookEvent {
  id: string;
  eventType: string;
  operation: string;
  entityId: string;
  realmId: string;
  processed: boolean;
  processedAt?: string;
  error?: string;
  createdAt: string;
}

type NotificationStatus = {
  configured: boolean;
  apiKeySet: boolean;
  emailNotificationsEnabled: boolean;
  paymentReminderDays: number;
  dueDateWarningDays: number;
};

const settingsFormSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  defaultCurrency: z.enum(["USD", "EUR", "GBP", "AED", "CAD"]),
  paymentReminderDays: z.coerce.number().min(1).max(30),
  dueDateWarningDays: z.coerce.number().min(1).max(14),
  enableEmailNotifications: z.boolean(),
  fiscalYearStartMonth: z.coerce.number().min(1).max(12),
  defaultReportFormat: z.enum(["pdf", "csv"]),
  reminderCcEmail: z.string().email("Invalid email address").optional().or(z.literal("")),
  enableBucketWarningNotifications: z.boolean(),
  enableBucketCriticalNotifications: z.boolean(),
  enableTimesheetApprovalNotifications: z.boolean(),
});

type SettingsFormValues = z.infer<typeof settingsFormSchema>;

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

const regions: { value: Region; label: string }[] = [
  { value: "CA", label: "California (CA)" },
  { value: "TX", label: "Texas (TX)" },
  { value: "AE", label: "UAE (AE)" },
];

const bankingFormSchema = z.object({
  companyName: z.string().optional(),
  companyAddress: z.string().optional(),
  bankName: z.string().min(1, "Bank name is required"),
  accountName: z.string().min(1, "Account name is required"),
  accountNumber: z.string().min(1, "Account number is required"),
  routingNumber: z.string().optional(),
  swiftCode: z.string().optional(),
  iban: z.string().optional(),
  bankAddress: z.string().optional(),
  beneficiaryAddress: z.string().optional(),
  additionalInstructions: z.string().optional(),
  currency: z.enum(["USD", "EUR", "GBP", "AED", "CAD"]),
});

type BankingFormValues = z.infer<typeof bankingFormSchema>;

const permissionLabels: Record<string, { label: string; description: string }> = {
  // Dashboard
  view_dashboard: { label: "View Dashboard", description: "Access the main dashboard" },
  // Payments
  view_payments: { label: "View Payments", description: "View payment records and history" },
  create_payments: { label: "Create Payments", description: "Create new payment records" },
  edit_payments: { label: "Edit Payments", description: "Modify existing payment records" },
  delete_payments: { label: "Delete Payments", description: "Remove payment records" },
  // Projects
  view_projects: { label: "View Projects", description: "View project details and lists" },
  create_projects: { label: "Create Projects", description: "Create new projects" },
  edit_projects: { label: "Edit Projects", description: "Modify existing projects" },
  delete_projects: { label: "Delete Projects", description: "Remove projects from the system" },
  // Monthly Planning
  view_planning: { label: "View Planning", description: "Access monthly planning data" },
  create_planning: { label: "Create Planning", description: "Create monthly plans" },
  edit_planning: { label: "Edit Planning", description: "Modify monthly plans" },
  delete_planning: { label: "Delete Planning", description: "Remove monthly plans" },
  // Upsells
  view_upsells: { label: "View Upsells", description: "View upsell opportunities" },
  create_upsells: { label: "Create Upsells", description: "Create new upsell opportunities" },
  edit_upsells: { label: "Edit Upsells", description: "Modify upsell opportunities" },
  delete_upsells: { label: "Delete Upsells", description: "Remove upsell opportunities" },
  // Invoices
  view_invoices: { label: "View Invoices", description: "View invoice records" },
  create_invoices: { label: "Create Invoices", description: "Create new invoices" },
  cancel_invoices: { label: "Cancel Invoices", description: "Cancel existing invoices" },
  record_payment_invoices: { label: "Record Payment", description: "Record payments on invoices" },
  // Forecasting
  view_forecasting: { label: "View Forecasting", description: "Access recurring forecasting module" },
  edit_forecasting: { label: "Edit Forecasting", description: "Modify forecasting data" },
  // Analytics
  view_analytics: { label: "View Analytics", description: "Access analytics and charts" },
  // Calendar
  view_calendar: { label: "View Calendar", description: "Access the payment calendar" },
  // Reports
  view_reports: { label: "View Reports", description: "Access and view reports" },
  export_reports: { label: "Export Reports", description: "Export reports to PDF/CSV" },
  // Users
  view_users: { label: "View Users", description: "View user accounts" },
  create_users: { label: "Create Users", description: "Create new user accounts" },
  edit_users: { label: "Edit Users", description: "Modify user accounts" },
  delete_users: { label: "Delete Users", description: "Remove user accounts" },
  // Settings
  view_settings: { label: "View Settings", description: "Access application settings" },
  edit_settings: { label: "Edit Settings", description: "Modify application settings" },
  // Notifications
  view_notifications: { label: "View Notifications", description: "View system notifications" },
  send_notifications: { label: "Send Notifications", description: "Send payment reminders and notifications" },
  // Access Control
  manage_roles: { label: "Manage Roles", description: "Create, edit, and manage user roles and permissions" },
  // Import Data
  import_data: { label: "Import Data", description: "Access the data import module to bulk import payments and milestones" },
};

function UpsellTypesSection() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<UpsellTypeSetting | null>(null);
  const [typeToDelete, setTypeToDelete] = useState<UpsellTypeSetting | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    displayName: "",
    isActive: true,
    sortOrder: 0,
  });

  const { data: upsellTypes, isLoading } = useQuery<UpsellTypeSetting[]>({
    queryKey: ["/api/settings/upsell-types"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest("POST", "/api/settings/upsell-types", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/upsell-types"] });
      setIsDialogOpen(false);
      resetForm();
      toast({ title: "Upsell type created", description: "The new upsell type has been added." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create upsell type.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      const response = await apiRequest("PATCH", `/api/settings/upsell-types/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/upsell-types"] });
      setIsDialogOpen(false);
      setEditingType(null);
      resetForm();
      toast({ title: "Upsell type updated", description: "Changes have been saved." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update upsell type.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/settings/upsell-types/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/upsell-types"] });
      setIsDeleteDialogOpen(false);
      setTypeToDelete(null);
      toast({ title: "Upsell type deleted", description: "The upsell type has been removed." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete upsell type.", variant: "destructive" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const response = await apiRequest("PATCH", `/api/settings/upsell-types/${id}`, { isActive });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/upsell-types"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to toggle status.", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({ name: "", displayName: "", isActive: true, sortOrder: 0 });
  };

  const openCreateDialog = () => {
    resetForm();
    setEditingType(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (type: UpsellTypeSetting) => {
    setEditingType(type);
    setFormData({
      name: type.name,
      displayName: type.displayName,
      isActive: type.isActive,
      sortOrder: type.sortOrder,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingType) {
      updateMutation.mutate({ id: editingType.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (type: UpsellTypeSetting) => {
    setTypeToDelete(type);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (typeToDelete) {
      deleteMutation.mutate(typeToDelete.id);
    }
  };

  if (isLoading) {
    return <Skeleton className="h-48" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Upsell Types</h3>
          <p className="text-sm text-muted-foreground">Configure available upsell opportunity types</p>
        </div>
        <Button onClick={openCreateDialog} data-testid="button-add-upsell-type">
          <Plus className="h-4 w-4 mr-2" />
          Add Type
        </Button>
      </div>

      <div className="space-y-2">
        {upsellTypes?.map((type) => (
          <div key={type.id} className="flex items-center justify-between p-3 rounded-md border">
            <div className="flex items-center gap-3">
              <Switch
                checked={type.isActive}
                onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: type.id, isActive: checked })}
                data-testid={`switch-upsell-type-${type.id}`}
              />
              <div>
                <p className="font-medium">{type.displayName}</p>
                <p className="text-xs text-muted-foreground">ID: {type.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={type.isActive ? "default" : "secondary"}>
                {type.isActive ? "Active" : "Inactive"}
              </Badge>
              <Button size="icon" variant="ghost" onClick={() => openEditDialog(type)} data-testid={`button-edit-type-${type.id}`}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => handleDelete(type)} data-testid={`button-delete-type-${type.id}`}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingType ? "Edit Upsell Type" : "Add Upsell Type"}</DialogTitle>
            <DialogDescription>
              {editingType ? "Update the upsell type details below." : "Create a new upsell type for categorizing opportunities."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Display Name</label>
              <Input
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                placeholder="e.g., Additional Service"
                data-testid="input-upsell-display-name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Internal Name (ID)</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value.toLowerCase().replace(/\s+/g, "_") })}
                placeholder="e.g., additional_service"
                data-testid="input-upsell-name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Sort Order</label>
              <Input
                type="number"
                value={formData.sortOrder}
                onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                data-testid="input-upsell-sort-order"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                data-testid="switch-upsell-active"
              />
              <label className="text-sm font-medium">Active</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-upsell-type">
              {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Upsell Type</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{typeToDelete?.displayName}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface CostMarginGlobalSettings {
  id?: string;
  hourlyRateCA: string;
  hourlyRateTX: string;
  hourlyRateAE: string;
  globalProfitabilityPercent: string;
  globalVarianceHours: string;
}

function CostMarginSettingsSection() {
  const { toast } = useToast();
  const [formData, setFormData] = useState<CostMarginGlobalSettings>({
    hourlyRateCA: "20",
    hourlyRateTX: "18",
    hourlyRateAE: "15",
    globalProfitabilityPercent: "30",
    globalVarianceHours: "0",
  });

  const { data: settings, isLoading } = useQuery<CostMarginGlobalSettings>({
    queryKey: ["/api/cost-margin-settings"],
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        hourlyRateCA: settings.hourlyRateCA || "20",
        hourlyRateTX: settings.hourlyRateTX || "18",
        hourlyRateAE: settings.hourlyRateAE || "15",
        globalProfitabilityPercent: settings.globalProfitabilityPercent || "30",
        globalVarianceHours: settings.globalVarianceHours || "0",
      });
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: async (data: CostMarginGlobalSettings) => {
      const response = await apiRequest("POST", "/api/cost-margin-settings", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cost-margin-settings"] });
      toast({ title: "Settings saved", description: "Cost & Margin global settings have been updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" });
    },
  });

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  if (isLoading) {
    return <Skeleton className="h-64" />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Hourly Rates by Region
          </CardTitle>
          <CardDescription>
            Define the hourly cost rates for each region. These are used to calculate implementation hours from project value.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">California (CA) Rate</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.hourlyRateCA}
                  onChange={(e) => setFormData({ ...formData, hourlyRateCA: e.target.value })}
                  className="pl-7"
                  placeholder="20.00"
                  data-testid="input-hourly-rate-ca"
                />
              </div>
              <p className="text-xs text-muted-foreground">Per hour cost for CA region</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Texas (TX) Rate</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.hourlyRateTX}
                  onChange={(e) => setFormData({ ...formData, hourlyRateTX: e.target.value })}
                  className="pl-7"
                  placeholder="18.00"
                  data-testid="input-hourly-rate-tx"
                />
              </div>
              <p className="text-xs text-muted-foreground">Per hour cost for TX region</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">UAE (AE) Rate</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.hourlyRateAE}
                  onChange={(e) => setFormData({ ...formData, hourlyRateAE: e.target.value })}
                  className="pl-7"
                  placeholder="15.00"
                  data-testid="input-hourly-rate-ae"
                />
              </div>
              <p className="text-xs text-muted-foreground">Per hour cost for AE region</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Profitability & Variance
          </CardTitle>
          <CardDescription>
            Configure global profitability margin and variance buffer. These can be overridden at project level.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Global Profitability Margin (%)</label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.globalProfitabilityPercent}
                  onChange={(e) => setFormData({ ...formData, globalProfitabilityPercent: e.target.value })}
                  placeholder="30"
                  data-testid="input-profitability-percent"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Percentage of revenue reserved as profit. Example: 30% means 30% of total hours are profit-reserved.
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Global Variance (Hours)</label>
              <Input
                type="number"
                step="0.5"
                value={formData.globalVarianceHours}
                onChange={(e) => setFormData({ ...formData, globalVarianceHours: e.target.value })}
                placeholder="0"
                data-testid="input-variance-hours"
              />
              <p className="text-xs text-muted-foreground">
                Default variance buffer in hours. Can be positive (expected overrun) or negative (efficiency expectation).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Calculation Formula
          </CardTitle>
          <CardDescription>How hourly buckets are calculated for each project</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
            <p><strong>1. Total Hour Bucket</strong> = Project Value ÷ Hourly Rate (by region)</p>
            <p><strong>2. Profit Reserved Hours</strong> = Total Hour Bucket × Profitability %</p>
            <p><strong>3. Implementation Hours</strong> = Total Hour Bucket − Profit Reserved Hours</p>
            <p><strong>4. Final Available Hours</strong> = Implementation Hours ± Variance</p>
            <p><strong>5. Remaining Hours</strong> = Final Available Hours − Consumed Hours (from timesheets)</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateMutation.isPending} data-testid="button-save-cost-margin-settings">
          <Save className="h-4 w-4 mr-2" />
          {updateMutation.isPending ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}

function BankingDetailsSection() {
  const { toast } = useToast();
  const [activeRegion, setActiveRegion] = useState<Region>("CA");

  const { data: allBankingDetails, isLoading } = useQuery<RegionBankingDetails[]>({
    queryKey: ["/api/settings/banking"],
  });

  const getBankingForRegion = (region: Region) => {
    return allBankingDetails?.find(b => b.region === region);
  };

  const form = useForm<BankingFormValues>({
    resolver: zodResolver(bankingFormSchema),
    defaultValues: {
      companyName: "",
      companyAddress: "",
      bankName: "",
      accountName: "",
      accountNumber: "",
      routingNumber: "",
      swiftCode: "",
      iban: "",
      bankAddress: "",
      beneficiaryAddress: "",
      additionalInstructions: "",
      currency: "USD",
    },
  });

  useEffect(() => {
    const regionData = getBankingForRegion(activeRegion);
    if (regionData) {
      form.reset({
        companyName: regionData.companyName || "",
        companyAddress: regionData.companyAddress || "",
        bankName: regionData.bankName || "",
        accountName: regionData.accountName || "",
        accountNumber: regionData.accountNumber || "",
        routingNumber: regionData.routingNumber || "",
        swiftCode: regionData.swiftCode || "",
        iban: regionData.iban || "",
        bankAddress: regionData.bankAddress || "",
        beneficiaryAddress: regionData.beneficiaryAddress || "",
        additionalInstructions: regionData.additionalInstructions || "",
        currency: (regionData.currency as Currency) || "USD",
      });
    } else {
      form.reset({
        companyName: "",
        companyAddress: "",
        bankName: "",
        accountName: "",
        accountNumber: "",
        routingNumber: "",
        swiftCode: "",
        iban: "",
        bankAddress: "",
        beneficiaryAddress: "",
        additionalInstructions: "",
        currency: activeRegion === "AE" ? "AED" : "USD",
      });
    }
  }, [activeRegion, allBankingDetails]);

  const saveMutation = useMutation({
    mutationFn: async (data: BankingFormValues) => {
      const response = await apiRequest("PUT", `/api/settings/banking/${activeRegion}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/banking"] });
      toast({ title: "Banking details saved", description: `${activeRegion} banking information has been updated.` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save banking details.", variant: "destructive" });
    },
  });

  const onSubmit = (data: BankingFormValues) => {
    saveMutation.mutate(data);
  };

  if (isLoading) {
    return <Skeleton className="h-64" />;
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Regional Banking Details</h3>
        <p className="text-sm text-muted-foreground">Configure ACH wire transfer information for each region</p>
      </div>

      <Tabs value={activeRegion} onValueChange={(v) => setActiveRegion(v as Region)}>
        <TabsList>
          {regions.map((region) => (
            <TabsTrigger key={region.value} value={region.value} data-testid={`tab-banking-${region.value}`}>
              {region.label}
              {getBankingForRegion(region.value) && (
                <CheckCircle2 className="h-3 w-3 ml-1 text-green-600" />
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {regions.map((region) => (
          <TabsContent key={region.value} value={region.value} className="mt-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="companyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Company name for invoices" {...field} data-testid="input-banking-company-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="currency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Currency</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-banking-currency">
                              <SelectValue placeholder="Select currency" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="USD">USD - US Dollar</SelectItem>
                            <SelectItem value="EUR">EUR - Euro</SelectItem>
                            <SelectItem value="GBP">GBP - British Pound</SelectItem>
                            <SelectItem value="AED">AED - UAE Dirham</SelectItem>
                            <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="companyAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Address</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Full company address" {...field} data-testid="input-company-address" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="bankName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bank Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Bank name" {...field} data-testid="input-bank-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="accountName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Account Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Account holder name" {...field} data-testid="input-account-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="accountNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Account Number</FormLabel>
                        <FormControl>
                          <Input placeholder="Account number" {...field} data-testid="input-account-number" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="routingNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Routing Number</FormLabel>
                        <FormControl>
                          <Input placeholder="Routing number" {...field} data-testid="input-routing-number" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="swiftCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SWIFT Code</FormLabel>
                        <FormControl>
                          <Input placeholder="SWIFT/BIC code" {...field} data-testid="input-swift-code" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="iban"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>IBAN</FormLabel>
                        <FormControl>
                          <Input placeholder="International Bank Account Number" {...field} data-testid="input-iban" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="bankAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bank Address</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Full bank address" {...field} data-testid="input-bank-address" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="beneficiaryAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Beneficiary Address</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Beneficiary address" {...field} data-testid="input-beneficiary-address" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="additionalInstructions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Additional Instructions</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Any additional payment instructions" {...field} data-testid="input-additional-instructions" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end">
                  <Button type="submit" disabled={saveMutation.isPending} data-testid="button-save-banking">
                    <Save className="h-4 w-4 mr-2" />
                    {saveMutation.isPending ? "Saving..." : `Save ${region.label} Banking Details`}
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

type ApiRoleWithPermissions = Role & { permissions: SystemPermission[] };

function getPermissionStrings(permissions: SystemPermission[] | undefined): SystemPermission[] {
  if (!permissions) return [];
  return permissions;
}

function AccessControlSection() {
  const { toast } = useToast();
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<ApiRoleWithPermissions | null>(null);
  const [roleToDelete, setRoleToDelete] = useState<ApiRoleWithPermissions | null>(null);
  const [roleFormData, setRoleFormData] = useState({
    name: "",
    displayName: "",
    description: "",
    department: "",
    isActive: true,
  });
  const [selectedPermissions, setSelectedPermissions] = useState<SystemPermission[]>([]);

  const { data: roles, isLoading: rolesLoading } = useQuery<ApiRoleWithPermissions[]>({
    queryKey: ["/api/access/roles"],
  });

  const { data: permissions } = useQuery<SystemPermission[]>({
    queryKey: ["/api/access/permissions"],
  });

  const createRoleMutation = useMutation({
    mutationFn: async (data: typeof roleFormData & { permissions: SystemPermission[] }) => {
      const response = await apiRequest("POST", "/api/access/roles", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/access/roles"] });
      setIsRoleDialogOpen(false);
      resetRoleForm();
      toast({ title: "Role created", description: "The new role has been added." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create role.", variant: "destructive" });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof roleFormData> & { permissions?: SystemPermission[] } }) => {
      const response = await apiRequest("PATCH", `/api/access/roles/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/access/roles"] });
      setIsRoleDialogOpen(false);
      setEditingRole(null);
      resetRoleForm();
      toast({ title: "Role updated", description: "Changes have been saved." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update role.", variant: "destructive" });
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/access/roles/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/access/roles"] });
      setIsDeleteDialogOpen(false);
      setRoleToDelete(null);
      toast({ title: "Role deleted", description: "The role has been removed." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete role.", variant: "destructive" });
    },
  });

  const resetRoleForm = () => {
    setRoleFormData({ name: "", displayName: "", description: "", department: "", isActive: true });
    setSelectedPermissions([]);
  };

  const openCreateRoleDialog = () => {
    resetRoleForm();
    setEditingRole(null);
    setIsRoleDialogOpen(true);
  };

  const openEditRoleDialog = (role: ApiRoleWithPermissions) => {
    setEditingRole(role);
    setRoleFormData({
      name: role.name,
      displayName: role.displayName,
      description: role.description || "",
      department: role.department || "",
      isActive: role.isActive,
    });
    setSelectedPermissions(getPermissionStrings(role.permissions));
    setIsRoleDialogOpen(true);
  };

  const handleRoleSubmit = () => {
    const data = { ...roleFormData, permissions: selectedPermissions };
    if (editingRole) {
      updateRoleMutation.mutate({ id: editingRole.id, data });
    } else {
      createRoleMutation.mutate(data);
    }
  };

  const handleDeleteRole = (role: ApiRoleWithPermissions) => {
    setRoleToDelete(role);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteRole = () => {
    if (roleToDelete) {
      deleteRoleMutation.mutate(roleToDelete.id);
    }
  };

  const togglePermission = (permission: SystemPermission) => {
    setSelectedPermissions(prev => 
      prev.includes(permission) 
        ? prev.filter(p => p !== permission)
        : [...prev, permission]
    );
  };

  if (rolesLoading) {
    return <Skeleton className="h-64" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Roles & Permissions</h3>
          <p className="text-sm text-muted-foreground">Manage user roles and their associated permissions</p>
        </div>
        <Button onClick={openCreateRoleDialog} data-testid="button-add-role">
          <Plus className="h-4 w-4 mr-2" />
          Add Role
        </Button>
      </div>

      <div className="space-y-3">
        {roles?.map((role) => (
          <Card key={role.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{role.displayName}</span>
                    {role.isSystem && (
                      <Badge variant="secondary">System</Badge>
                    )}
                    {!role.isActive && (
                      <Badge variant="outline">Inactive</Badge>
                    )}
                  </div>
                  {role.department && (
                    <p className="text-sm text-muted-foreground">{role.department}</p>
                  )}
                  {role.description && (
                    <p className="text-sm text-muted-foreground">{role.description}</p>
                  )}
                  <div className="flex flex-wrap gap-1 pt-2">
                    {getPermissionStrings(role.permissions).map((permission) => (
                      <Badge key={permission} variant="outline" className="text-xs">
                        {permissionLabels[permission]?.label || permission}
                      </Badge>
                    ))}
                    {(!role.permissions || role.permissions.length === 0) && (
                      <span className="text-xs text-muted-foreground">No permissions assigned</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="icon" variant="ghost" onClick={() => openEditRoleDialog(role)} data-testid={`button-edit-role-${role.id}`}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {!role.isSystem && (
                    <Button size="icon" variant="ghost" onClick={() => handleDeleteRole(role)} data-testid={`button-delete-role-${role.id}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingRole ? "Edit Role" : "Create Role"}</DialogTitle>
            <DialogDescription>
              {editingRole ? "Update the role details and permissions." : "Create a new role and assign permissions."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Display Name</label>
                <Input
                  value={roleFormData.displayName}
                  onChange={(e) => setRoleFormData({ ...roleFormData, displayName: e.target.value })}
                  placeholder="e.g., Finance Manager"
                  data-testid="input-role-display-name"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Internal Name</label>
                <Input
                  value={roleFormData.name}
                  onChange={(e) => setRoleFormData({ ...roleFormData, name: e.target.value.toLowerCase().replace(/\s+/g, "_") })}
                  placeholder="e.g., finance_manager"
                  disabled={editingRole?.isSystem}
                  data-testid="input-role-name"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Department</label>
              <Select 
                value={roleFormData.department} 
                onValueChange={(v) => setRoleFormData({ ...roleFormData, department: v })}
              >
                <SelectTrigger data-testid="select-role-department">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="C-Suite">C-Suite</SelectItem>
                  <SelectItem value="Finance">Finance</SelectItem>
                  <SelectItem value="Business Development">Business Development</SelectItem>
                  <SelectItem value="Production">Production</SelectItem>
                  <SelectItem value="Operations">Operations</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={roleFormData.description}
                onChange={(e) => setRoleFormData({ ...roleFormData, description: e.target.value })}
                placeholder="Describe this role's responsibilities"
                data-testid="input-role-description"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={roleFormData.isActive}
                onCheckedChange={(checked) => setRoleFormData({ ...roleFormData, isActive: checked })}
                data-testid="switch-role-active"
              />
              <label className="text-sm font-medium">Active</label>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Permissions</label>
              <ScrollArea className="h-64 rounded-md border p-4">
                <div className="space-y-3">
                  {permissions?.map((permission) => (
                    <div key={permission} className="flex items-start gap-3">
                      <Checkbox
                        id={permission}
                        checked={selectedPermissions.includes(permission)}
                        onCheckedChange={() => togglePermission(permission)}
                        data-testid={`checkbox-permission-${permission}`}
                      />
                      <label htmlFor={permission} className="flex-1 cursor-pointer">
                        <p className="text-sm font-medium">{permissionLabels[permission]?.label || permission}</p>
                        <p className="text-xs text-muted-foreground">{permissionLabels[permission]?.description || ""}</p>
                      </label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRoleDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleRoleSubmit} disabled={createRoleMutation.isPending || updateRoleMutation.isPending} data-testid="button-save-role">
              {(createRoleMutation.isPending || updateRoleMutation.isPending) ? "Saving..." : "Save Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{roleToDelete?.displayName}"? Users with this role will lose their permissions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteRole}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ModuleVisibilitySettings({ canEdit }: { canEdit: boolean }) {
  const { toast } = useToast();
  const { data: settings, isLoading } = useQuery<AppSettings>({
    queryKey: ["/api/settings"],
  });

  const [hidden, setHidden] = useState<string[]>([]);
  const prevServerRef = useRef<string[] | null>(null);

  useEffect(() => {
    if (!settings) return;
    const server = settings.hiddenModules ?? [];
    const prev = prevServerRef.current;
    // Adopt the server value on first load, or when the user hasn't made local edits
    // relative to the last known server value (so external changes still sync in).
    const localMatchesPrev =
      prev !== null &&
      JSON.stringify([...hidden].sort()) === JSON.stringify([...prev].sort());
    if (prev === null || localMatchesPrev) {
      setHidden(server);
    }
    prevServerRef.current = server;
  }, [settings, hidden]);

  const saveMutation = useMutation({
    mutationFn: async (hiddenModules: string[]) => {
      const response = await apiRequest("PATCH", "/api/settings", { hiddenModules });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/navigation/hidden-modules"] });
      toast({
        title: "Modules updated",
        description: "Sidebar module visibility has been saved for all users.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update module visibility. Please try again.",
        variant: "destructive",
      });
    },
  });

  const isHidden = (url: string) => hidden.includes(url);

  const toggleModule = (url: string, visible: boolean) => {
    setHidden((prev) =>
      visible ? prev.filter((u) => u !== url) : Array.from(new Set([...prev, url]))
    );
  };

  const dirty =
    settings != null &&
    JSON.stringify([...hidden].sort()) !==
      JSON.stringify([...(settings.hiddenModules ?? [])].sort());

  const hiddenCount = hidden.length;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <LayoutGrid className="h-5 w-5" />
              Module Visibility
            </CardTitle>
            <CardDescription className="mt-1.5">
              Choose which modules appear in the sidebar. Hidden modules are removed for{" "}
              <span className="font-medium text-foreground">all users</span> — even those
              with permission to access them. Turn a module back on to make it reappear
              automatically.
            </CardDescription>
          </div>
          <Badge variant={hiddenCount > 0 ? "secondary" : "outline"} data-testid="badge-hidden-count">
            {hiddenCount} hidden
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {navSections.map((section) => (
          <div key={section.label} className="space-y-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {section.label}
            </h3>
            <div className="rounded-lg border divide-y">
              {section.items.map((item) => {
                const Icon = item.icon;
                const locked = item.alwaysVisible === true;
                const visible = locked ? true : !isHidden(item.url);
                return (
                  <div
                    key={item.url}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                    data-testid={`module-row-${item.url}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-md shrink-0 ${
                          visible ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{item.title}</span>
                          {locked && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                              Always on
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          {visible ? (
                            <>
                              <Eye className="h-3 w-3" /> Visible
                            </>
                          ) : (
                            <>
                              <EyeOff className="h-3 w-3" /> Hidden
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <Switch
                      checked={visible}
                      disabled={locked || !canEdit}
                      onCheckedChange={(checked) => toggleModule(item.url, checked)}
                      data-testid={`switch-module-${item.url}`}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {canEdit && (
          <div className="flex items-center justify-end gap-3 pt-2">
            {dirty && (
              <span className="text-xs text-muted-foreground">You have unsaved changes</span>
            )}
            <Button
              onClick={() => saveMutation.mutate(hidden)}
              disabled={!dirty || saveMutation.isPending}
              data-testid="button-save-modules"
            >
              <Save className="h-4 w-4 mr-2" />
              {saveMutation.isPending ? "Saving..." : "Save changes"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminSettings() {
  const { toast } = useToast();
  const search = useSearch();
  const [activeTab, setActiveTab] = useState(() => new URLSearchParams(search).get("tab") || "general");
  useEffect(() => {
    const t = new URLSearchParams(search).get("tab");
    if (t) setActiveTab(t);
  }, [search]);
  const [testEmail, setTestEmail] = useState("");
  const [testType, setTestType] = useState<"payment_received" | "invoice_pending" | "due_date_reminder">("payment_received");

  const { data: settings, isLoading } = useQuery<AppSettings>({
    queryKey: ["/api/settings"],
  });

  const { data: notificationStatus } = useQuery<NotificationStatus>({
    queryKey: ["/api/notifications/status"],
  });

  const { data: userPermissions } = useQuery<SystemPermission[]>({
    queryKey: ["/api/access/my-permissions"],
  });

  const canManageRoles = userPermissions?.includes("manage_roles") ?? false;
  const canManagePods = userPermissions?.includes("manage_pods") ?? false;
  const canEditSettings = userPermissions?.includes("edit_settings") ?? false;

  // SMTP Settings state
  const [smtpForm, setSmtpForm] = useState({
    host: "",
    port: "587",
    username: "",
    password: "",
    fromEmail: "",
    fromName: "",
    encryption: "starttls" as "none" | "ssl" | "starttls",
  });
  const [smtpTestEmail, setSmtpTestEmail] = useState("");

  // AI Provider settings state — one form per provider.
  const [aiProviderForms, setAiProviderForms] = useState<Record<string, { apiKey: string; model: string; isActive: boolean }>>({
    anthropic: { apiKey: "", model: "", isActive: true },
    openai: { apiKey: "", model: "", isActive: true },
  });

  // Global Theme state
  const presetColors = [
    { name: "Blood Red", hsl: "0 85% 38%", hex: "#C22828" },
    { name: "Ocean Blue", hsl: "210 85% 45%", hex: "#1976D2" },
    { name: "Forest Green", hsl: "142 71% 35%", hex: "#2E7D32" },
    { name: "Royal Purple", hsl: "270 70% 45%", hex: "#7B1FA2" },
    { name: "Sunset Orange", hsl: "30 90% 50%", hex: "#F57C00" },
    { name: "Teal", hsl: "180 65% 40%", hex: "#00897B" },
    { name: "Deep Pink", hsl: "330 80% 45%", hex: "#C2185B" },
    { name: "Slate", hsl: "215 25% 45%", hex: "#5C6BC0" },
  ];
  
  const [globalTheme, setGlobalTheme] = useState<ThemeSettings>({
    primaryColor: "0 85% 38%",
    mode: "system",
  });
  const [hasThemeChanges, setHasThemeChanges] = useState(false);
  const [customThemeHex, setCustomThemeHex] = useState("#C22828");

  const { data: globalThemeData } = useQuery<{ theme: ThemeSettings | null }>({
    queryKey: ["/api/settings/global-theme"],
  });

  useEffect(() => {
    if (globalThemeData?.theme) {
      setGlobalTheme(globalThemeData.theme);
    }
  }, [globalThemeData]);

  const updateGlobalThemeMutation = useMutation({
    mutationFn: async (themeSettings: ThemeSettings) => {
      return apiRequest("PUT", "/api/settings/global-theme", themeSettings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/global-theme"] });
      setHasThemeChanges(false);
      toast({
        title: "Global Theme Updated",
        description: "The default theme for all users has been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update global theme. Please try again.",
        variant: "destructive",
      });
    },
  });

  const resetGlobalThemeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", "/api/settings/global-theme");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/global-theme"] });
      setGlobalTheme({ primaryColor: "0 85% 38%", mode: "system" });
      setHasThemeChanges(false);
      toast({
        title: "Global Theme Reset",
        description: "The global theme has been reset to default.",
      });
    },
  });

  // QuickBooks Integration state
  const [isDisconnectDialogOpen, setIsDisconnectDialogOpen] = useState(false);

  const { data: qbSettings, isLoading: qbSettingsLoading } = useQuery<QuickbooksSettings>({
    queryKey: ["/api/quickbooks/settings"],
  });

  const { data: webhookEvents, isLoading: eventsLoading } = useQuery<WebhookEvent[]>({
    queryKey: ["/api/quickbooks/webhook-events"],
    enabled: qbSettings?.isConnected === true,
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("GET", "/api/quickbooks/auth-url");
      const data = await response.json();
      return data;
    },
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to initiate QuickBooks connection",
        variant: "destructive",
      });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/quickbooks/disconnect");
    },
    onSuccess: () => {
      toast({ title: "QuickBooks disconnected successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/quickbooks/settings"] });
      setIsDisconnectDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to disconnect QuickBooks",
        variant: "destructive",
      });
    },
  });

  // Handle QuickBooks OAuth callback params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const successParam = urlParams.get("success");
    const errorParam = urlParams.get("error");

    if (successParam === "connected") {
      toast({ title: "QuickBooks connected successfully!" });
      window.history.replaceState({}, "", "/admin/settings");
      setActiveTab("quickbooks");
    }

    if (errorParam) {
      const errorMessages: Record<string, string> = {
        oauth_denied: "QuickBooks authorization was denied",
        missing_params: "Missing required parameters from QuickBooks",
        token_exchange: "Failed to complete QuickBooks authentication",
      };
      toast({
        title: "Connection Error",
        description: errorMessages[errorParam] || "Failed to connect to QuickBooks",
        variant: "destructive",
      });
      window.history.replaceState({}, "", "/admin/settings");
      setActiveTab("quickbooks");
    }
  }, [toast]);

  function hexToHsl(hex: string): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return "0 85% 38%";
    
    let r = parseInt(result[1], 16) / 255;
    let g = parseInt(result[2], 16) / 255;
    let b = parseInt(result[3], 16) / 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;
    
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    
    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  }

  const { data: smtpSettings, isLoading: smtpLoading } = useQuery<{
    id: string;
    host: string;
    port: number;
    username: string;
    fromEmail: string;
    fromName: string;
    encryption: string;
    hasPassword: boolean;
  } | null>({
    queryKey: ["/api/settings/smtp"],
  });

  useEffect(() => {
    if (smtpSettings) {
      setSmtpForm({
        host: smtpSettings.host || "",
        port: String(smtpSettings.port || 587),
        username: smtpSettings.username || "",
        password: "",
        fromEmail: smtpSettings.fromEmail || "",
        fromName: smtpSettings.fromName || "",
        encryption: (smtpSettings.encryption as "none" | "ssl" | "starttls") || "starttls",
      });
    }
  }, [smtpSettings]);

  const saveSMTPMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PUT", "/api/settings/smtp", smtpForm);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/smtp"] });
      toast({
        title: "SMTP settings saved",
        description: "Email configuration has been updated successfully.",
      });
      setSmtpForm(prev => ({ ...prev, password: "" }));
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save SMTP settings.",
        variant: "destructive",
      });
    },
  });

  const { data: aiProviderSettings, isLoading: aiProvidersLoading } = useQuery<Array<{
    id: string;
    provider: "anthropic" | "openai";
    model: string | null;
    isActive: boolean;
    hasApiKey: boolean;
    updatedAt: string | null;
  }>>({
    queryKey: ["/api/settings/ai-providers"],
    enabled: canEditSettings,
  });

  useEffect(() => {
    if (aiProviderSettings) {
      setAiProviderForms((prev) => {
        const next = { ...prev };
        for (const s of aiProviderSettings) {
          next[s.provider] = { apiKey: "", model: s.model || "", isActive: s.isActive };
        }
        return next;
      });
    }
  }, [aiProviderSettings]);

  const saveAiProviderMutation = useMutation({
    mutationFn: async (provider: "anthropic" | "openai") => {
      const form = aiProviderForms[provider];
      const payload: { apiKey?: string; model: string | null; isActive: boolean } = {
        model: form.model.trim() || null,
        isActive: form.isActive,
      };
      if (form.apiKey.trim()) {
        payload.apiKey = form.apiKey.trim();
      }
      const response = await apiRequest("PUT", `/api/settings/ai-providers/${provider}`, payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/ai-providers"] });
      toast({
        title: "AI provider saved",
        description: "The provider settings have been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save AI provider settings.",
        variant: "destructive",
      });
    },
  });

  const testSMTPConnectionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/settings/smtp/test-connection", smtpForm);
      return response.json();
    },
    onSuccess: (data: { success: boolean; message: string }) => {
      if (data.success) {
        toast({
          title: "Connection successful",
          description: "SMTP server connection verified successfully.",
        });
      } else {
        toast({
          title: "Connection failed",
          description: data.message || "Failed to connect to SMTP server.",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Connection failed",
        description: error.message || "Failed to connect to SMTP server.",
        variant: "destructive",
      });
    },
  });

  const sendSMTPTestEmailMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/settings/smtp/send-test", { email: smtpTestEmail });
      return response.json();
    },
    onSuccess: (data: { success: boolean; message: string }) => {
      if (data.success) {
        toast({
          title: "Test email sent",
          description: `Test email sent successfully to ${smtpTestEmail}`,
        });
      } else {
        toast({
          title: "Send failed",
          description: data.message || "Failed to send test email.",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Send failed",
        description: error.message || "Failed to send test email.",
        variant: "destructive",
      });
    },
  });

  const sendRemindersMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/notifications/send-reminders");
      return response.json();
    },
    onSuccess: (data: { sent: number; errors: number }) => {
      toast({
        title: "Reminders sent",
        description: `Sent ${data.sent} reminder emails${data.errors > 0 ? ` (${data.errors} errors)` : ""}.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send reminders. Please try again.",
        variant: "destructive",
      });
    },
  });

  const sendTestMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/notifications/test", {
        email: testEmail,
        type: testType,
      });
      return response.json();
    },
    onSuccess: (data: { success: boolean; error?: string }) => {
      if (data.success) {
        toast({
          title: "Test email sent",
          description: `Test notification sent to ${testEmail}`,
        });
      } else {
        toast({
          title: "Test email failed",
          description: data.error || "Failed to send test email",
          variant: "destructive",
        });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send test email. Please try again.",
        variant: "destructive",
      });
    },
  });

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    values: settings ? {
      companyName: settings.companyName,
      defaultCurrency: settings.defaultCurrency as "USD" | "EUR" | "GBP" | "AED" | "CAD",
      paymentReminderDays: settings.paymentReminderDays,
      dueDateWarningDays: settings.dueDateWarningDays,
      enableEmailNotifications: settings.enableEmailNotifications,
      fiscalYearStartMonth: settings.fiscalYearStartMonth,
      defaultReportFormat: settings.defaultReportFormat as "pdf" | "csv",
      reminderCcEmail: settings.reminderCcEmail || "",
      enableBucketWarningNotifications: settings.enableBucketWarningNotifications ?? true,
      enableBucketCriticalNotifications: settings.enableBucketCriticalNotifications ?? true,
      enableTimesheetApprovalNotifications: settings.enableTimesheetApprovalNotifications ?? true,
      enableMilestoneSyncPrompt: settings.enableMilestoneSyncPrompt ?? true,
    } : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: SettingsFormValues) => {
      const response = await apiRequest("PATCH", "/api/settings", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Settings updated",
        description: "Your application settings have been saved successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SettingsFormValues) => {
    updateMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-md" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const settingsNavItems = [
    { value: "general", label: "General", icon: Building2, description: "Basic app configuration" },
    { value: "notifications", label: "Notifications", icon: Bell, description: "Alert preferences" },
    { value: "email", label: "Email (SMTP)", icon: Mail, description: "Email server settings" },
    ...(canEditSettings ? [{ value: "ai-providers", label: "AI Providers", icon: Brain, description: "AI analysis API keys" }] : []),
    { value: "finance", label: "Finance", icon: FileText, description: "Fiscal year & reports" },
    { value: "cost-margin", label: "Cost & Margin", icon: TrendingUp, description: "Profit calculations" },
    { value: "banking", label: "Banking", icon: Landmark, description: "Bank account details" },
    { value: "upsells", label: "Upsell Types", icon: Target, description: "Upsell categories" },
    { value: "theme", label: "Theme", icon: Palette, description: "Colors & appearance" },
    { value: "modules", label: "Module Visibility", icon: LayoutGrid, description: "Show or hide sidebar modules" },
    { value: "health", label: "System Health", icon: Activity, description: "System monitoring" },
    ...(canEditSettings ? [{ value: "security", label: "Security", icon: ShieldCheck, description: "Cyber-security stats" }] : []),
    { value: "quickbooks", label: "QuickBooks", icon: Link2, description: "Accounting sync" },
    ...(canManageRoles ? [{ value: "access", label: "Access Control", icon: Shield, description: "Roles & permissions" }] : []),
    ...(canManagePods ? [{ value: "pods", label: "PODs", icon: Users2, description: "Teams, leads & T1/T2 targets" }] : []),
  ];

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-4rem)]">
      <div className="w-full md:w-64 border-b md:border-b-0 md:border-r bg-muted/30 p-4 flex flex-col md:min-h-0">
        <div className="flex items-center gap-3 mb-6 px-2">
          <div className="p-2 rounded-md bg-primary/10">
            <Settings className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold" data-testid="text-settings-title">Settings</h1>
            <p className="text-xs text-muted-foreground">System configuration</p>
          </div>
        </div>

        <ScrollArea className="flex-1 -mx-2 md:max-h-none max-h-32">
          <nav className="flex md:flex-col flex-row md:space-y-1 gap-1 md:gap-0 px-2 pb-1 md:pb-0 overflow-x-auto md:overflow-visible">
            {settingsNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.value;
              return (
                <button
                  key={item.value}
                  onClick={() => setActiveTab(item.value)}
                  data-testid={`tab-${item.value}`}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-colors ${
                    isActive 
                      ? "bg-primary text-primary-foreground" 
                      : "hover-elevate text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm font-medium truncate ${isActive ? "" : ""}`}>
                      {item.label}
                    </div>
                    <div className={`text-xs truncate ${isActive ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {item.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </nav>
        </ScrollArea>
      </div>

      <div className="flex-1 overflow-auto min-h-0">
        <div className="p-4 sm:p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsContent value="general" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                General Settings
              </CardTitle>
              <CardDescription>Basic application configuration</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="companyName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter company name" {...field} data-testid="input-company-name" />
                          </FormControl>
                          <FormDescription>Displayed in reports and exports</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="defaultCurrency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Default Currency</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-currency">
                                <SelectValue placeholder="Select currency" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="USD">USD - US Dollar</SelectItem>
                              <SelectItem value="EUR">EUR - Euro</SelectItem>
                              <SelectItem value="GBP">GBP - British Pound</SelectItem>
                              <SelectItem value="AED">AED - UAE Dirham</SelectItem>
                              <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>Currency for new payments</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save-general">
                      <Save className="h-4 w-4 mr-2" />
                      {updateMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="mt-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Settings
              </CardTitle>
              <CardDescription>Configure alerts and reminders</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="paymentReminderDays"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payment Reminder Days</FormLabel>
                          <FormControl>
                            <Input type="number" min={1} max={30} {...field} data-testid="input-reminder-days" />
                          </FormControl>
                          <FormDescription>Days before due date to send reminders</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="dueDateWarningDays"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Due Date Warning Days</FormLabel>
                          <FormControl>
                            <Input type="number" min={1} max={14} {...field} data-testid="input-warning-days" />
                          </FormControl>
                          <FormDescription>Days before due date to show warnings</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="enableEmailNotifications"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>Email Notifications</FormLabel>
                          <FormDescription>Receive email alerts for payments</FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-email-notifications" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="reminderCcEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reminder CC Email</FormLabel>
                        <FormControl>
                          <Input 
                            type="email" 
                            placeholder="finance@company.com" 
                            {...field} 
                            data-testid="input-reminder-cc-email" 
                          />
                        </FormControl>
                        <FormDescription>
                          Receive a copy of all client payment reminder emails at this address
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="space-y-3 pt-4 border-t">
                    <h4 className="text-sm font-medium text-foreground">Notification Types</h4>
                    <FormField
                      control={form.control}
                      name="enableBucketWarningNotifications"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <div className="space-y-0.5">
                            <FormLabel>Hourly Bucket Warnings</FormLabel>
                            <FormDescription>Notify PMs when project utilization reaches 80%</FormDescription>
                          </div>
                          <FormControl>
                            <Switch 
                              checked={field.value} 
                              onCheckedChange={field.onChange} 
                              data-testid="switch-bucket-warning-notifications" 
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="enableBucketCriticalNotifications"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <div className="space-y-0.5">
                            <FormLabel>Hourly Bucket Critical Alerts</FormLabel>
                            <FormDescription>Notify PMs when project utilization exceeds 100%</FormDescription>
                          </div>
                          <FormControl>
                            <Switch 
                              checked={field.value} 
                              onCheckedChange={field.onChange} 
                              data-testid="switch-bucket-critical-notifications" 
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="enableTimesheetApprovalNotifications"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <div className="space-y-0.5">
                            <FormLabel>Timesheet Approvals</FormLabel>
                            <FormDescription>Notify PMs when timesheets are approved for their projects</FormDescription>
                          </div>
                          <FormControl>
                            <Switch 
                              checked={field.value} 
                              onCheckedChange={field.onChange} 
                              data-testid="switch-timesheet-approval-notifications" 
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <Separator className="my-4" />
                  <h4 className="text-sm font-medium">Payment & Milestone Sync</h4>
                  <div className="space-y-3">
                    <FormField
                      control={form.control}
                      name="enableMilestoneSyncPrompt"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <div className="space-y-0.5">
                            <FormLabel>Milestone Sync Prompt</FormLabel>
                            <FormDescription>When a payment is marked as received, prompt users to link it to a project milestone for status tracking</FormDescription>
                          </div>
                          <FormControl>
                            <Switch 
                              checked={field.value} 
                              onCheckedChange={field.onChange} 
                              data-testid="switch-milestone-sync-prompt" 
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save-notifications">
                      <Save className="h-4 w-4 mr-2" />
                      {updateMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Notification Service
              </CardTitle>
              <CardDescription>Configure and test email notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4 flex-wrap">
                {notificationStatus?.apiKeySet ? (
                  <Badge variant="outline" className="gap-1">
                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                    API Key Configured
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1">
                    <AlertCircle className="h-3 w-3 text-amber-600" />
                    API Key Not Set
                  </Badge>
                )}
                {notificationStatus?.emailNotificationsEnabled ? (
                  <Badge variant="outline" className="gap-1">
                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                    Notifications Enabled
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1">
                    <AlertCircle className="h-3 w-3 text-muted-foreground" />
                    Notifications Disabled
                  </Badge>
                )}
              </div>

              {!notificationStatus?.apiKeySet && (
                <div className="rounded-md bg-muted p-4 text-sm text-muted-foreground">
                  <p className="font-medium mb-1">Email service not configured</p>
                  <p>To enable email notifications, add the <code className="bg-background px-1 py-0.5 rounded">RESEND_API_KEY</code> environment variable with your Resend API key.</p>
                </div>
              )}

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-3">
                  <h4 className="font-medium">Send Due Date Reminders</h4>
                  <p className="text-sm text-muted-foreground">
                    Manually send reminder emails for all payments with due dates within the configured reminder period ({notificationStatus?.paymentReminderDays || 7} days).
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => sendRemindersMutation.mutate()}
                    disabled={sendRemindersMutation.isPending || !notificationStatus?.emailNotificationsEnabled}
                    data-testid="button-send-reminders"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {sendRemindersMutation.isPending ? "Sending..." : "Send Reminders Now"}
                  </Button>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium">Send Test Email</h4>
                  <div className="flex flex-col gap-2">
                    <Input
                      type="email"
                      placeholder="Email address"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      data-testid="input-test-email"
                    />
                    <Select value={testType} onValueChange={(v: any) => setTestType(v)}>
                      <SelectTrigger data-testid="select-test-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="payment_received">Payment Received</SelectItem>
                        <SelectItem value="invoice_pending">Invoice Pending</SelectItem>
                        <SelectItem value="due_date_reminder">Due Date Reminder</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => sendTestMutation.mutate()}
                      disabled={sendTestMutation.isPending || !testEmail || !notificationStatus?.emailNotificationsEnabled}
                      data-testid="button-send-test"
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      {sendTestMutation.isPending ? "Sending..." : "Send Test"}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                SMTP Email Configuration
              </CardTitle>
              <CardDescription>Configure outgoing email settings for system notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {smtpLoading ? (
                <Skeleton className="h-48" />
              ) : (
                <>
                  <div className="flex items-center gap-4 flex-wrap">
                    {smtpSettings ? (
                      <Badge variant="outline" className="gap-1">
                        <CheckCircle2 className="h-3 w-3 text-green-600" />
                        SMTP Configured
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1">
                        <AlertCircle className="h-3 w-3 text-amber-600" />
                        SMTP Not Configured
                      </Badge>
                    )}
                    {smtpSettings?.hasPassword && (
                      <Badge variant="outline" className="gap-1">
                        <Lock className="h-3 w-3" />
                        Password Set
                      </Badge>
                    )}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">SMTP Host</label>
                      <Input
                        placeholder="e.g., smtp.gmail.com"
                        value={smtpForm.host}
                        onChange={(e) => setSmtpForm(prev => ({ ...prev, host: e.target.value }))}
                        data-testid="input-smtp-host"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">SMTP Port</label>
                      <Input
                        type="number"
                        placeholder="587"
                        value={smtpForm.port}
                        onChange={(e) => setSmtpForm(prev => ({ ...prev, port: e.target.value }))}
                        data-testid="input-smtp-port"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Username</label>
                      <Input
                        placeholder="Email or username"
                        value={smtpForm.username}
                        onChange={(e) => setSmtpForm(prev => ({ ...prev, username: e.target.value }))}
                        data-testid="input-smtp-username"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Password</label>
                      <Input
                        type="password"
                        placeholder={smtpSettings?.hasPassword ? "Leave blank to keep current" : "Enter password"}
                        value={smtpForm.password}
                        onChange={(e) => setSmtpForm(prev => ({ ...prev, password: e.target.value }))}
                        data-testid="input-smtp-password"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">From Email</label>
                      <Input
                        type="email"
                        placeholder="noreply@yourdomain.com"
                        value={smtpForm.fromEmail}
                        onChange={(e) => setSmtpForm(prev => ({ ...prev, fromEmail: e.target.value }))}
                        data-testid="input-smtp-from-email"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">From Name</label>
                      <Input
                        placeholder="RevolRMO Notifications"
                        value={smtpForm.fromName}
                        onChange={(e) => setSmtpForm(prev => ({ ...prev, fromName: e.target.value }))}
                        data-testid="input-smtp-from-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Encryption</label>
                      <Select
                        value={smtpForm.encryption}
                        onValueChange={(v: "none" | "ssl" | "starttls") => setSmtpForm(prev => ({ ...prev, encryption: v }))}
                      >
                        <SelectTrigger data-testid="select-smtp-encryption">
                          <SelectValue placeholder="Select encryption" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="starttls">STARTTLS (Recommended)</SelectItem>
                          <SelectItem value="ssl">SSL/TLS</SelectItem>
                          <SelectItem value="none">None</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => saveSMTPMutation.mutate()}
                      disabled={saveSMTPMutation.isPending || !smtpForm.host || !smtpForm.username || !smtpForm.fromEmail}
                      data-testid="button-save-smtp"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {saveSMTPMutation.isPending ? "Saving..." : "Save SMTP Settings"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => testSMTPConnectionMutation.mutate()}
                      disabled={testSMTPConnectionMutation.isPending || !smtpForm.host || !smtpForm.username}
                      data-testid="button-test-smtp-connection"
                    >
                      {testSMTPConnectionMutation.isPending ? "Testing..." : "Test Connection"}
                    </Button>
                  </div>

                  <div className="border-t pt-6">
                    <h4 className="font-medium mb-3">Send Test Email</h4>
                    <div className="flex gap-2">
                      <Input
                        type="email"
                        placeholder="recipient@example.com"
                        value={smtpTestEmail}
                        onChange={(e) => setSmtpTestEmail(e.target.value)}
                        className="max-w-xs"
                        data-testid="input-smtp-test-email"
                      />
                      <Button
                        variant="outline"
                        onClick={() => sendSMTPTestEmailMutation.mutate()}
                        disabled={sendSMTPTestEmailMutation.isPending || !smtpTestEmail || !smtpSettings}
                        data-testid="button-send-smtp-test"
                      >
                        <Send className="h-4 w-4 mr-2" />
                        {sendSMTPTestEmailMutation.isPending ? "Sending..." : "Send Test"}
                      </Button>
                    </div>
                    {!smtpSettings && (
                      <p className="text-sm text-muted-foreground mt-2">
                        Save SMTP settings before sending a test email.
                      </p>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai-providers" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                AI Providers
              </CardTitle>
              <CardDescription>
                Add API keys for the AI providers used by the Upsell AI Analysis. Keys are stored securely and never shown again after saving.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              {aiProvidersLoading ? (
                <Skeleton className="h-48" />
              ) : (
                ([
                  { key: "anthropic", label: "Claude (Anthropic)", placeholder: "claude-3-5-sonnet-latest" },
                  { key: "openai", label: "OpenAI", placeholder: "gpt-4o" },
                ] as const).map((p) => {
                  const saved = aiProviderSettings?.find((s) => s.provider === p.key);
                  const form = aiProviderForms[p.key];
                  return (
                    <div key={p.key} className="space-y-4 border-b last:border-b-0 pb-8 last:pb-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h4 className="font-medium">{p.label}</h4>
                        {saved?.hasApiKey ? (
                          <Badge variant="outline" className="gap-1">
                            <CheckCircle2 className="h-3 w-3 text-green-600" />
                            Key Set
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1">
                            <AlertCircle className="h-3 w-3 text-amber-600" />
                            No Key
                          </Badge>
                        )}
                        {saved && !saved.isActive && (
                          <Badge variant="outline" className="gap-1">
                            <Ban className="h-3 w-3 text-muted-foreground" />
                            Disabled
                          </Badge>
                        )}
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">API Key</label>
                          <Input
                            type="password"
                            placeholder={saved?.hasApiKey ? "Leave blank to keep current" : "Enter API key"}
                            value={form.apiKey}
                            onChange={(e) => setAiProviderForms((prev) => ({ ...prev, [p.key]: { ...prev[p.key], apiKey: e.target.value } }))}
                            data-testid={`input-ai-${p.key}-key`}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Model (optional)</label>
                          <Input
                            placeholder={p.placeholder}
                            value={form.model}
                            onChange={(e) => setAiProviderForms((prev) => ({ ...prev, [p.key]: { ...prev[p.key], model: e.target.value } }))}
                            data-testid={`input-ai-${p.key}-model`}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Switch
                          checked={form.isActive}
                          onCheckedChange={(v) => setAiProviderForms((prev) => ({ ...prev, [p.key]: { ...prev[p.key], isActive: v } }))}
                          data-testid={`switch-ai-${p.key}-active`}
                        />
                        <span className="text-sm text-muted-foreground">Use this provider for analysis</span>
                      </div>

                      <Button
                        onClick={() => saveAiProviderMutation.mutate(p.key)}
                        disabled={saveAiProviderMutation.isPending || (!saved?.hasApiKey && !form.apiKey.trim())}
                        data-testid={`button-save-ai-${p.key}`}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {saveAiProviderMutation.isPending ? "Saving..." : `Save ${p.label}`}
                      </Button>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="finance" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Fiscal Year & Reporting
              </CardTitle>
              <CardDescription>Configure financial year and report settings</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="fiscalYearStartMonth"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Fiscal Year Start Month</FormLabel>
                          <Select onValueChange={(v) => field.onChange(parseInt(v))} value={field.value?.toString()}>
                            <FormControl>
                              <SelectTrigger data-testid="select-fiscal-month">
                                <SelectValue placeholder="Select month" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {months.map((month) => (
                                <SelectItem key={month.value} value={month.value.toString()}>
                                  {month.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>Month when your fiscal year begins</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="defaultReportFormat"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Default Report Format</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-report-format">
                                <SelectValue placeholder="Select format" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="pdf">PDF Document</SelectItem>
                              <SelectItem value="csv">CSV Spreadsheet</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>Default export format for reports</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save-finance">
                      <Save className="h-4 w-4 mr-2" />
                      {updateMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cost-margin" className="mt-0">
          <CostMarginSettingsSection />
        </TabsContent>

        <TabsContent value="banking" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Landmark className="h-5 w-5" />
                Banking Details
              </CardTitle>
              <CardDescription>Configure payment and wire transfer information for invoices</CardDescription>
            </CardHeader>
            <CardContent>
              <BankingDetailsSection />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upsells" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Upsell Type Management
              </CardTitle>
              <CardDescription>Configure the types of upsell opportunities available in the system</CardDescription>
            </CardHeader>
            <CardContent>
              <UpsellTypesSection />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="theme" className="mt-0">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Global Theme Settings
                </CardTitle>
                <CardDescription>
                  Set the default theme for all users. Users can override this with their own preferences.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="text-sm font-medium mb-3">Primary Color</h4>
                  <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
                    {presetColors.map((color) => (
                      <button
                        key={color.name}
                        onClick={() => {
                          setGlobalTheme(prev => ({ ...prev, primaryColor: color.hsl }));
                          setHasThemeChanges(true);
                        }}
                        className={`w-12 h-12 rounded-lg border-2 transition-all hover:scale-110 ${
                          globalTheme.primaryColor === color.hsl
                            ? "border-foreground ring-2 ring-offset-2 ring-foreground"
                            : "border-transparent"
                        }`}
                        style={{ backgroundColor: color.hex }}
                        title={color.name}
                        data-testid={`global-color-preset-${color.name.toLowerCase().replace(/\s/g, "-")}`}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-end gap-3">
                  <div className="flex-1 max-w-xs">
                    <label className="text-sm font-medium mb-1 block">Custom Color (Hex)</label>
                    <Input
                      type="text"
                      value={customThemeHex}
                      onChange={(e) => setCustomThemeHex(e.target.value)}
                      placeholder="#C22828"
                      className="font-mono"
                      data-testid="input-global-custom-color"
                    />
                  </div>
                  <div
                    className="w-12 h-10 rounded border"
                    style={{ backgroundColor: customThemeHex }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const hsl = hexToHsl(customThemeHex);
                      setGlobalTheme(prev => ({ ...prev, primaryColor: hsl }));
                      setHasThemeChanges(true);
                    }}
                    data-testid="button-apply-global-custom-color"
                  >
                    Apply
                  </Button>
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-3">Default Appearance Mode</h4>
                  <div className="flex gap-4">
                    {(["light", "dark", "system"] as const).map((mode) => (
                      <label key={mode} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="globalMode"
                          value={mode}
                          checked={globalTheme.mode === mode}
                          onChange={() => {
                            setGlobalTheme(prev => ({ ...prev, mode }));
                            setHasThemeChanges(true);
                          }}
                          className="text-primary"
                          data-testid={`radio-global-mode-${mode}`}
                        />
                        <span className="capitalize">{mode}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Preview</CardTitle>
                <CardDescription>See how the selected colors will look</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="p-4 border rounded-lg space-y-4">
                  <div className="flex gap-2 flex-wrap">
                    <button
                      className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium min-h-9 px-4 py-2 text-white"
                      style={{ backgroundColor: `hsl(${globalTheme.primaryColor})` }}
                      data-testid="preview-global-button-primary"
                    >
                      Primary Button
                    </button>
                    <Button variant="secondary" data-testid="preview-global-button-secondary">Secondary</Button>
                    <button
                      className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium min-h-9 px-4 py-2 border-2 bg-transparent"
                      style={{ 
                        borderColor: `hsl(${globalTheme.primaryColor})`,
                        color: `hsl(${globalTheme.primaryColor})`
                      }}
                      data-testid="preview-global-button-outline"
                    >
                      Outline
                    </button>
                    <Button variant="destructive" data-testid="preview-global-button-destructive">Destructive</Button>
                  </div>
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-8 h-8 rounded-full"
                      style={{ backgroundColor: `hsl(${globalTheme.primaryColor})` }}
                    />
                    <span className="text-sm text-muted-foreground">
                      Current selection: <span style={{ color: `hsl(${globalTheme.primaryColor})` }} className="font-medium">{presetColors.find(c => c.hsl === globalTheme.primaryColor)?.name || "Custom Color"}</span>
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => resetGlobalThemeMutation.mutate()}
                disabled={!globalThemeData?.theme}
                data-testid="button-reset-global-theme"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset to Default
              </Button>
              <Button
                onClick={() => updateGlobalThemeMutation.mutate(globalTheme)}
                disabled={!hasThemeChanges || updateGlobalThemeMutation.isPending}
                data-testid="button-save-global-theme"
              >
                <Save className="h-4 w-4 mr-2" />
                {updateGlobalThemeMutation.isPending ? "Saving..." : "Save Global Theme"}
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="modules" className="mt-0">
          <ModuleVisibilitySettings canEdit={canEditSettings} />
        </TabsContent>

        <TabsContent value="health" className="mt-0">
          <SystemHealthSection />
        </TabsContent>

        {canEditSettings && (
          <TabsContent value="security" className="mt-0">
            <SecuritySettingsSection />
          </TabsContent>
        )}

        {canManageRoles && (
          <TabsContent value="access" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Access Control
                </CardTitle>
                <CardDescription>Manage user roles and permissions for system access</CardDescription>
              </CardHeader>
              <CardContent>
                <AccessControlSection />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="quickbooks" className="mt-0 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold">QuickBooks Integration</h2>
              <p className="text-muted-foreground text-sm">
                Connect to QuickBooks Online to sync invoices and receive payment updates automatically
              </p>
            </div>
            <Badge 
              variant={qbSettings?.isConnected ? "default" : "secondary"} 
              className="flex items-center gap-1"
            >
              {qbSettings?.isConnected ? (
                <>
                  <CheckCircle2 className="h-3 w-3" />
                  Connected
                </>
              ) : (
                <>
                  <XCircle className="h-3 w-3" />
                  Not Connected
                </>
              )}
            </Badge>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                QuickBooks Online Connection
              </CardTitle>
              <CardDescription>
                Connect your QuickBooks Online account to sync invoices and automatically track payments
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {qbSettingsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : qbSettings?.isConnected ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Company ID</p>
                      <p className="text-sm font-mono">{qbSettings.realmId || "—"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Last Sync</p>
                      <p className="text-sm">
                        {qbSettings.lastSyncAt 
                          ? format(new Date(qbSettings.lastSyncAt), "MMM d, yyyy h:mm a")
                          : "Never"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Token Expires</p>
                      <p className="text-sm">
                        {qbSettings.tokenExpiresAt 
                          ? format(new Date(qbSettings.tokenExpiresAt), "MMM d, yyyy h:mm a")
                          : "—"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Refresh Token Expires</p>
                      <p className="text-sm">
                        {qbSettings.refreshTokenExpiresAt 
                          ? format(new Date(qbSettings.refreshTokenExpiresAt), "MMM d, yyyy")
                          : "—"}
                      </p>
                    </div>
                  </div>

                  {qbSettings.webhookVerifierToken && (
                    <div className="p-4 bg-muted rounded-lg space-y-2">
                      <p className="text-sm font-medium">Webhook Configuration</p>
                      <p className="text-xs text-muted-foreground">
                        Configure your QuickBooks webhook to point to:
                      </p>
                      <code className="block text-xs bg-background p-2 rounded border">
                        {window.location.origin}/api/quickbooks/webhook
                      </code>
                      <p className="text-xs text-muted-foreground">
                        Use the verifier token below when setting up webhooks in QuickBooks Developer Portal:
                      </p>
                      <code className="block text-xs bg-background p-2 rounded border break-all">
                        {qbSettings.webhookVerifierToken}
                      </code>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => setIsDisconnectDialogOpen(true)}
                      data-testid="button-disconnect"
                    >
                      <Unlink className="h-4 w-4 mr-2" />
                      Disconnect
                    </Button>
                    <Button
                      variant="outline"
                      asChild
                    >
                      <a 
                        href="https://developer.intuit.com/app/developer/dashboard" 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        QuickBooks Developer Portal
                      </a>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <h4 className="font-medium mb-2">Before connecting:</h4>
                    <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                      <li>Create an app in the QuickBooks Developer Portal</li>
                      <li>Configure OAuth 2.0 redirect URI to: <code className="text-xs bg-background px-1 rounded">{window.location.origin}/api/quickbooks/callback</code></li>
                      <li>Set up the required environment variables (QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET, QUICKBOOKS_REDIRECT_URI)</li>
                      <li>Subscribe to Payment and Invoice webhook events</li>
                    </ol>
                  </div>

                  <Button 
                    onClick={() => connectMutation.mutate()}
                    disabled={connectMutation.isPending}
                    data-testid="button-connect"
                  >
                    {connectMutation.isPending ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <Link2 className="h-4 w-4 mr-2" />
                        Connect to QuickBooks
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                How It Works
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <h4 className="font-medium">Send Invoices</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Sync invoices from RevolRMO to QuickBooks with a single click
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <RefreshCw className="h-4 w-4 text-primary" />
                    </div>
                    <h4 className="font-medium">Auto-Sync Payments</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    When payments are recorded in QuickBooks, invoice status updates automatically
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    </div>
                    <h4 className="font-medium">Track Status</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Keep both systems in sync with real-time webhook updates
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {qbSettings?.isConnected && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Recent Webhook Events
                </CardTitle>
                <CardDescription>
                  View incoming webhook events from QuickBooks for debugging and monitoring
                </CardDescription>
              </CardHeader>
              <CardContent>
                {eventsLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : webhookEvents && webhookEvents.length > 0 ? (
                  <ScrollArea className="h-[300px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Operation</TableHead>
                          <TableHead>Entity ID</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Received</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {webhookEvents.map((event) => (
                          <TableRow key={event.id} data-testid={`row-event-${event.id}`}>
                            <TableCell>
                              <Badge variant="outline">{event.eventType}</Badge>
                            </TableCell>
                            <TableCell>{event.operation}</TableCell>
                            <TableCell className="font-mono text-xs">{event.entityId}</TableCell>
                            <TableCell>
                              {event.error ? (
                                <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                                  <AlertCircle className="h-3 w-3" />
                                  Error
                                </Badge>
                              ) : event.processed ? (
                                <Badge variant="default" className="flex items-center gap-1 w-fit">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Processed
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                                  <Clock className="h-3 w-3" />
                                  Pending
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {event.createdAt 
                                ? format(new Date(event.createdAt), "MMM d, h:mm a")
                                : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <RefreshCw className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No webhook events received yet</p>
                    <p className="text-sm">Events will appear here when QuickBooks sends updates</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <AlertDialog open={isDisconnectDialogOpen} onOpenChange={setIsDisconnectDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Disconnect QuickBooks?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will disconnect your QuickBooks account. You will need to reconnect to sync invoices 
                  and receive payment updates. Existing synced data will remain in both systems.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => disconnectMutation.mutate()}
                  disabled={disconnectMutation.isPending}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {disconnectMutation.isPending ? "Disconnecting..." : "Disconnect"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </TabsContent>

        {canManagePods && (
          <TabsContent value="pods" className="mt-0 -m-6 md:-m-8">
            <AdminPodsPage />
          </TabsContent>
        )}
      </Tabs>
        </div>
      </div>
    </div>
  );
}

// Security Dashboard Section - cyber-security stats (rate limiting, auth
// failures, sessions, blocked users, security headers, recent events).
function SecuritySettingsSection() {
  const [timeRange, setTimeRange] = useState("24");

  const { data, isLoading, isError, refetch } = useQuery<SecurityDashboard>({
    queryKey: ["/api/security/dashboard", timeRange],
    queryFn: async () => {
      const res = await fetch(`/api/security/dashboard?hours=${timeRange}`);
      if (!res.ok) {
        throw new Error(`Failed to load security dashboard (${res.status})`);
      }
      return res.json();
    },
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <ShieldAlert className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground" data-testid="text-security-error">
            Unable to load the security dashboard. You may not have permission to view it.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => refetch()} data-testid="button-retry-security">
            <RefreshCw className="h-4 w-4 mr-2" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const d: SecurityDashboard = data || {
    windowHours: Number(timeRange),
    totalRequests: 0,
    rateLimitHits: 0,
    unauthorizedCount: 0,
    forbiddenCount: 0,
    clientErrors: 0,
    serverErrors: 0,
    errorRate: 0,
    authFailureEndpoints: [],
    activeSessions: 0,
    totalUsers: 0,
    blockedUsers: [],
    recentSecurityEvents: [],
    rateLimitConfig: {
      auth: { windowMinutes: 15, max: 30, paths: [] },
      api: { windowMinutes: 15, max: 1000, paths: [] },
    },
    securityHeaders: [],
  };

  const formatRelativeTime = (iso: string | null) => {
    if (!iso) return "";
    const then = new Date(iso).getTime();
    const diff = Date.now() - then;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  const actionLabel = (action: string, entity: string) => {
    if (action === "login") return "Signed in";
    if (action === "logout") return "Signed out";
    if (action === "status_change" && entity === "user") return "User status changed";
    return `${action} ${entity}`;
  };

  return (
    <div className="space-y-6">
      {/* Header + overview KPIs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Security Overview
            </CardTitle>
            <CardDescription>Cyber-security activity across the selected time window</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-32" data-testid="select-security-time-range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Last 1 hour</SelectItem>
                <SelectItem value="6">Last 6 hours</SelectItem>
                <SelectItem value="24">Last 24 hours</SelectItem>
                <SelectItem value="72">Last 3 days</SelectItem>
                <SelectItem value="168">Last 7 days</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => refetch()} data-testid="button-refresh-security">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Gauge className="h-4 w-4" />
                Rate-limit Blocks
              </div>
              <div className={`text-2xl font-bold mt-1 ${d.rateLimitHits > 0 ? "text-yellow-600" : "text-green-600"}`} data-testid="text-rate-limit-hits">
                {d.rateLimitHits.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">HTTP 429 responses</p>
            </div>
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Lock className="h-4 w-4" />
                Unauthorized
              </div>
              <div className={`text-2xl font-bold mt-1 ${d.unauthorizedCount > 0 ? "text-yellow-600" : ""}`} data-testid="text-unauthorized-count">
                {d.unauthorizedCount.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">HTTP 401 (no session)</p>
            </div>
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <ShieldAlert className="h-4 w-4" />
                Forbidden
              </div>
              <div className={`text-2xl font-bold mt-1 ${d.forbiddenCount > 0 ? "text-yellow-600" : ""}`} data-testid="text-forbidden-count">
                {d.forbiddenCount.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">HTTP 403 (no permission)</p>
            </div>
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <AlertTriangle className="h-4 w-4" />
                Server Errors
              </div>
              <div className={`text-2xl font-bold mt-1 ${d.serverErrors > 0 ? "text-destructive" : ""}`} data-testid="text-server-errors">
                {d.serverErrors.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">HTTP 5xx</p>
            </div>
          </div>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mt-4">
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Users className="h-4 w-4" />
                Active Sessions
              </div>
              <div className="text-2xl font-bold mt-1" data-testid="text-active-sessions">
                {d.activeSessions.toLocaleString()}
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Ban className="h-4 w-4" />
                Blocked Users
              </div>
              <div className={`text-2xl font-bold mt-1 ${d.blockedUsers.length > 0 ? "text-destructive" : ""}`} data-testid="text-blocked-users-count">
                {d.blockedUsers.length.toLocaleString()}
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Activity className="h-4 w-4" />
                Total Requests
              </div>
              <div className="text-2xl font-bold mt-1" data-testid="text-security-total-requests">
                {d.totalRequests.toLocaleString()}
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <AlertCircle className="h-4 w-4" />
                Error Rate
              </div>
              <div className={`text-2xl font-bold mt-1 ${d.errorRate > 5 ? "text-destructive" : d.errorRate > 1 ? "text-yellow-600" : "text-green-600"}`} data-testid="text-security-error-rate">
                {d.errorRate}%
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rate limiting + security headers */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Gauge className="h-4 w-4" />
              Rate Limiting
            </CardTitle>
            <CardDescription>Active throttling rules protecting the API</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border p-4" data-testid="card-rate-limit-auth">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-medium">
                  <LogIn className="h-4 w-4" />
                  Authentication routes
                </div>
                <Badge variant="secondary">
                  {d.rateLimitConfig.auth.max} / {d.rateLimitConfig.auth.windowMinutes} min
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Guards login, callback &amp; logout against brute-force attempts.
              </p>
              {d.rateLimitConfig.auth.paths.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {d.rateLimitConfig.auth.paths.map((p) => (
                    <code key={p} className="text-xs bg-muted px-1.5 py-0.5 rounded">{p}</code>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-lg border p-4" data-testid="card-rate-limit-api">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-medium">
                  <Globe className="h-4 w-4" />
                  General API routes
                </div>
                <Badge variant="secondary">
                  {d.rateLimitConfig.api.max} / {d.rateLimitConfig.api.windowMinutes} min
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Protects all other API endpoints from runaway clients.
              </p>
              {d.rateLimitConfig.api.paths.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {d.rateLimitConfig.api.paths.map((p) => (
                    <code key={p} className="text-xs bg-muted px-1.5 py-0.5 rounded">{p}</code>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-4 w-4" />
              Security Headers
            </CardTitle>
            <CardDescription>HTTP hardening applied to every response</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {d.securityHeaders.map((h, idx) => (
                <div key={idx} className="flex items-start justify-between gap-3 py-1" data-testid={`row-security-header-${idx}`}>
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{h.name}</div>
                    <p className="text-xs text-muted-foreground">{h.detail}</p>
                  </div>
                  {h.enabled ? (
                    <Badge variant="secondary" className="shrink-0 gap-1 text-green-700 dark:text-green-400">
                      <CheckCircle2 className="h-3 w-3" /> On
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="shrink-0 gap-1 text-muted-foreground">
                      <XCircle className="h-3 w-3" /> Off
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Auth failures + blocked users */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldAlert className="h-4 w-4" />
              Top Auth Failures
            </CardTitle>
            <CardDescription>Endpoints with the most 401 / 403 / 429 responses</CardDescription>
          </CardHeader>
          <CardContent>
            {d.authFailureEndpoints.length === 0 ? (
              <p className="text-muted-foreground text-sm">No authentication failures in this window</p>
            ) : (
              <div className="space-y-3">
                {d.authFailureEndpoints.map((e, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b last:border-b-0">
                    <code className="text-xs bg-muted px-2 py-1 rounded truncate block flex-1 min-w-0" data-testid={`text-auth-fail-endpoint-${idx}`}>
                      {e.endpoint}
                    </code>
                    <Badge variant="outline" className="ml-4 shrink-0" data-testid={`badge-auth-fail-count-${idx}`}>
                      {e.count}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Ban className="h-4 w-4" />
              Blocked Users
            </CardTitle>
            <CardDescription>Accounts currently denied access</CardDescription>
          </CardHeader>
          <CardContent>
            {d.blockedUsers.length === 0 ? (
              <p className="text-muted-foreground text-sm">No blocked users</p>
            ) : (
              <div className="space-y-3">
                {d.blockedUsers.map((u, idx) => (
                  <div key={u.id} className="flex items-center justify-between py-2 border-b last:border-b-0" data-testid={`row-blocked-user-${idx}`}>
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{u.name}</div>
                      {u.email && <p className="text-xs text-muted-foreground truncate">{u.email}</p>}
                    </div>
                    <Badge variant="destructive" className="ml-4 shrink-0">Blocked</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent security events */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="h-4 w-4" />
            Recent Security Events
          </CardTitle>
          <CardDescription>Sign-ins, sign-outs and user status changes</CardDescription>
        </CardHeader>
        <CardContent>
          {d.recentSecurityEvents.length === 0 ? (
            <p className="text-muted-foreground text-sm">No recent security events</p>
          ) : (
            <div className="space-y-3">
              {d.recentSecurityEvents.map((ev, idx) => (
                <div key={ev.id} className="flex items-center justify-between gap-3 py-2 border-b last:border-b-0" data-testid={`row-security-event-${idx}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-md bg-muted shrink-0">
                      {ev.action === "login" ? (
                        <LogIn className="h-4 w-4" />
                      ) : ev.action === "logout" ? (
                        <Lock className="h-4 w-4" />
                      ) : (
                        <ShieldAlert className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">
                        {actionLabel(ev.action, ev.entity)}
                        {ev.userName ? ` · ${ev.userName}` : ""}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {ev.details || ev.entity}
                        {ev.ipAddress ? ` · ${ev.ipAddress}` : ""}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{formatRelativeTime(ev.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// System Health Monitoring Section
function SystemHealthSection() {
  const { toast } = useToast();
  const [timeRange, setTimeRange] = useState("24");
  
  const { data: healthData, isLoading, refetch } = useQuery({
    queryKey: ["/api/system-health", timeRange],
    queryFn: () => fetch(`/api/system-health?hours=${timeRange}`).then(res => res.json()),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const cleanupMutation = useMutation({
    mutationFn: async (daysToKeep: number) => {
      const response = await apiRequest("DELETE", `/api/system-health/cleanup?daysToKeep=${daysToKeep}`);
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Cleanup Complete",
        description: `Removed ${data.deletedCount} old metrics records`,
      });
      refetch();
    },
    onError: () => {
      toast({
        title: "Cleanup Failed",
        description: "Failed to clean up old metrics",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const summary = healthData || {
    totalRequests: 0,
    avgResponseTime: 0,
    errorCount: 0,
    errorRate: 0,
    slowEndpoints: [],
    errorEndpoints: [],
    recentMetrics: [],
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              System Health Overview
            </CardTitle>
            <CardDescription>Monitor API performance and error rates</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-32" data-testid="select-time-range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Last 1 hour</SelectItem>
                <SelectItem value="6">Last 6 hours</SelectItem>
                <SelectItem value="24">Last 24 hours</SelectItem>
                <SelectItem value="72">Last 3 days</SelectItem>
                <SelectItem value="168">Last 7 days</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => refetch()} data-testid="button-refresh-health">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Zap className="h-4 w-4" />
                Total Requests
              </div>
              <div className="text-2xl font-bold mt-1" data-testid="text-total-requests">
                {summary.totalRequests.toLocaleString()}
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Clock className="h-4 w-4" />
                Avg Response Time
              </div>
              <div className="text-2xl font-bold mt-1" data-testid="text-avg-response-time">
                {summary.avgResponseTime}ms
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <AlertTriangle className="h-4 w-4" />
                Total Errors
              </div>
              <div className={`text-2xl font-bold mt-1 ${summary.errorCount > 0 ? 'text-destructive' : ''}`} data-testid="text-error-count">
                {summary.errorCount}
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <AlertCircle className="h-4 w-4" />
                Error Rate
              </div>
              <div className={`text-2xl font-bold mt-1 ${summary.errorRate > 5 ? 'text-destructive' : summary.errorRate > 1 ? 'text-yellow-600' : 'text-green-600'}`} data-testid="text-error-rate">
                {summary.errorRate}%
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-4 w-4" />
              Slowest Endpoints
            </CardTitle>
            <CardDescription>Endpoints with highest average response time</CardDescription>
          </CardHeader>
          <CardContent>
            {summary.slowEndpoints.length === 0 ? (
              <p className="text-muted-foreground text-sm">No data available yet</p>
            ) : (
              <div className="space-y-3">
                {summary.slowEndpoints.map((endpoint: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b last:border-b-0">
                    <div className="flex-1 min-w-0">
                      <code className="text-xs bg-muted px-2 py-1 rounded truncate block" data-testid={`text-slow-endpoint-${idx}`}>
                        {endpoint.endpoint}
                      </code>
                    </div>
                    <div className="flex items-center gap-4 ml-4">
                      <span className="text-sm text-muted-foreground">{endpoint.requestCount} requests</span>
                      <Badge 
                        variant={endpoint.avgResponseTime > 1000 ? "destructive" : endpoint.avgResponseTime > 500 ? "outline" : "secondary"}
                        data-testid={`badge-slow-time-${idx}`}
                      >
                        {endpoint.avgResponseTime}ms
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="h-4 w-4" />
              Error Endpoints
            </CardTitle>
            <CardDescription>Endpoints with the most errors</CardDescription>
          </CardHeader>
          <CardContent>
            {summary.errorEndpoints.length === 0 ? (
              <p className="text-muted-foreground text-sm">No errors recorded</p>
            ) : (
              <div className="space-y-3">
                {summary.errorEndpoints.map((endpoint: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b last:border-b-0">
                    <div className="flex-1 min-w-0">
                      <code className="text-xs bg-muted px-2 py-1 rounded truncate block" data-testid={`text-error-endpoint-${idx}`}>
                        {endpoint.endpoint}
                      </code>
                      {endpoint.lastError && (
                        <p className="text-xs text-muted-foreground mt-1 truncate" title={endpoint.lastError}>
                          {endpoint.lastError}
                        </p>
                      )}
                    </div>
                    <Badge variant="destructive" className="ml-4" data-testid={`badge-error-count-${idx}`}>
                      {endpoint.errorCount} errors
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-4 w-4" />
              Recent API Requests
            </CardTitle>
            <CardDescription>Last 50 API calls</CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => cleanupMutation.mutate(7)}
            disabled={cleanupMutation.isPending}
            data-testid="button-cleanup-metrics"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Cleanup Old Data
          </Button>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {summary.recentMetrics.length === 0 ? (
                <p className="text-muted-foreground text-sm">No recent requests recorded</p>
              ) : (
                summary.recentMetrics.map((metric: any, idx: number) => (
                  <div 
                    key={idx} 
                    className={`flex items-center justify-between py-2 px-3 rounded border ${
                      metric.statusCode >= 400 ? 'bg-destructive/5 border-destructive/20' : 'bg-muted/30'
                    }`}
                    data-testid={`row-metric-${idx}`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Badge 
                        variant={metric.statusCode >= 400 ? "destructive" : "secondary"} 
                        className="font-mono text-xs"
                      >
                        {metric.method}
                      </Badge>
                      <code className="text-xs truncate flex-1" title={metric.endpoint}>
                        {metric.endpoint}
                      </code>
                    </div>
                    <div className="flex items-center gap-4 ml-4">
                      <Badge 
                        variant={metric.statusCode >= 400 ? "destructive" : "outline"}
                        className="font-mono"
                      >
                        {metric.statusCode}
                      </Badge>
                      <span className={`text-xs font-mono ${metric.responseTimeMs > 1000 ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {metric.responseTimeMs}ms
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(metric.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
