import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, getErrorMessage } from "@/lib/queryClient";
import { generateInvoiceFromRecord, generateReceiptPDF } from "@shared/invoice-generator";
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
import { RegionBadge } from "@/components/region-badge";
import { ProjectDetailSheet } from "@/components/project-detail-sheet";
import { useToast } from "@/hooks/use-toast";
import { 
  Filter, 
  X, 
  Search, 
  Plus, 
  MoreHorizontal, 
  FileText, 
  Send, 
  DollarSign, 
  Receipt, 
  Eye,
  Ban,
  Trash2,
  Download,
  Clock,
  CheckCircle,
  AlertCircle,
  CloudUpload,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { format } from "date-fns";
import type { InvoiceListItem, InvoiceWithDetails, Project, InvoiceStatus, Region, RegionBankingDetails, SystemPermission } from "@shared/schema";

const invoiceStatusConfig: Record<InvoiceStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Draft", variant: "secondary" },
  sent: { label: "Sent", variant: "outline" },
  paid: { label: "Paid", variant: "default" },
  cancelled: { label: "Cancelled", variant: "destructive" },
  overdue: { label: "Overdue", variant: "destructive" },
};

const regions: { value: Region; label: string }[] = [
  { value: "CA", label: "California" },
  { value: "TX", label: "Texas" },
  { value: "AE", label: "UAE" },
];

function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const config = invoiceStatusConfig[status] || { label: status, variant: "secondary" as const };
  return (
    <Badge variant={config.variant} data-testid={`badge-status-${status}`}>
      {config.label}
    </Badge>
  );
}

export default function Invoices() {
  const { toast } = useToast();
  const [filters, setFilters] = useState({
    status: "",
    region: "",
    projectId: "",
    search: "",
  });
  
  const [detailProjectId, setDetailProjectId] = useState<string | null>(null);
  const [projectDetailOpen, setProjectDetailOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceWithDetails | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());

  const toggleInvoiceExpand = (id: string) => {
    setExpandedInvoices(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  
  const [newInvoice, setNewInvoice] = useState({
    clientName: "",
    clientEmail: "",
    clientAddress: "",
    projectId: "",
    dueDate: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
    notes: "",
    lineItems: [{ description: "", quantity: "1", unitPrice: "" }],
  });

  const queryParams = new URLSearchParams();
  if (filters.status) queryParams.set("status", filters.status);
  if (filters.region) queryParams.set("region", filters.region);
  if (filters.projectId) queryParams.set("projectId", filters.projectId);

  const queryString = queryParams.toString();
  const { data: invoices, isLoading } = useQuery<InvoiceListItem[]>({
    queryKey: ["/api/invoices", filters],
    queryFn: async () => {
      const response = await fetch(`/api/invoices?${queryString}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch invoices");
      return response.json();
    },
  });

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: bankingDetails } = useQuery<RegionBankingDetails[]>({
    queryKey: ["/api/settings/banking"],
  });

  const { data: nextNumber } = useQuery<{ invoiceNumber: string }>({
    queryKey: ["/api/invoices/next-number"],
  });

  const { data: userPermissions } = useQuery<SystemPermission[]>({
    queryKey: ["/api/access/my-permissions"],
  });

  const canCreateInvoices = userPermissions?.includes("create_invoices") ?? false;
  const canCancelInvoices = userPermissions?.includes("cancel_invoices") ?? false;
  const canRecordPayment = userPermissions?.includes("record_payment_invoices") ?? false;
  const canDeleteInvoices = userPermissions?.includes("delete_invoices") ?? false;

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/invoices", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices/next-number"] });
      setIsCreateDialogOpen(false);
      resetNewInvoice();
      toast({ title: "Invoice created successfully" });
    },
    onError: (error) => {
      toast({ title: "Failed to create invoice", description: getErrorMessage(error), variant: "destructive" });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/invoices/${id}/send`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Invoice marked as sent" });
    },
    onError: (error) => {
      toast({ title: "Failed to mark invoice as sent", description: getErrorMessage(error), variant: "destructive" });
    },
  });

  const syncToQuickbooksMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/invoices/${id}/sync-quickbooks`, {});
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
        toast({ title: "Invoice synced to QuickBooks", description: `QuickBooks Invoice ID: ${data.quickbooksInvoiceId}` });
      } else {
        toast({ title: "QuickBooks sync failed", description: data.error || "Unknown error", variant: "destructive" });
      }
    },
    onError: (error) => {
      toast({ title: "Failed to sync to QuickBooks", description: getErrorMessage(error), variant: "destructive" });
    },
  });

  const recordPaymentMutation = useMutation({
    mutationFn: async ({ id, amount, paidDate }: { id: string; amount: string; paidDate: string }) => {
      const response = await apiRequest("POST", `/api/invoices/${id}/record-payment`, { amount, paidDate });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] }); // Also refresh payments since linked payment is updated
      setIsPaymentDialogOpen(false);
      setPaymentAmount("");
      toast({ title: "Payment recorded successfully" });
    },
    onError: (error) => {
      toast({ title: "Failed to record payment", description: getErrorMessage(error), variant: "destructive" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/invoices/${id}/cancel`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Invoice cancelled" });
    },
    onError: (error) => {
      toast({ title: "Failed to cancel invoice", description: getErrorMessage(error), variant: "destructive" });
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/invoices/${id}/reactivate`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Invoice reactivated", description: "The invoice is active again and its status can be updated." });
    },
    onError: (error) => {
      toast({ title: "Failed to reactivate invoice", description: getErrorMessage(error, "Failed to reactivate invoice"), variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/invoices/${id}`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Invoice deleted" });
    },
    onError: (error) => {
      toast({ title: "Failed to delete invoice", description: getErrorMessage(error), variant: "destructive" });
    },
  });

  const resetNewInvoice = () => {
    setNewInvoice({
      clientName: "",
      clientEmail: "",
      clientAddress: "",
      projectId: "",
      dueDate: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
      notes: "",
      lineItems: [{ description: "", quantity: "1", unitPrice: "" }],
    });
  };

  const handleProjectSelect = (projectId: string) => {
    const project = projects?.find(p => p.id === projectId);
    if (project) {
      setNewInvoice(prev => ({
        ...prev,
        projectId,
        clientName: project.clientName || "",
        clientEmail: project.clientEmail || "",
      }));
    }
  };

  const addLineItem = () => {
    setNewInvoice(prev => ({
      ...prev,
      lineItems: [...prev.lineItems, { description: "", quantity: "1", unitPrice: "" }],
    }));
  };

  const removeLineItem = (index: number) => {
    setNewInvoice(prev => ({
      ...prev,
      lineItems: prev.lineItems.filter((_, i) => i !== index),
    }));
  };

  const updateLineItem = (index: number, field: string, value: string) => {
    setNewInvoice(prev => ({
      ...prev,
      lineItems: prev.lineItems.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const calculateTotals = () => {
    const subtotal = newInvoice.lineItems.reduce((sum, item) => {
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.unitPrice) || 0;
      return sum + (qty * price);
    }, 0);
    return { subtotal, total: subtotal };
  };

  const handleCreateInvoice = () => {
    const { subtotal, total } = calculateTotals();
    const lineItems = newInvoice.lineItems
      .filter(item => item.description && item.unitPrice)
      .map((item, index) => ({
        description: item.description,
        quantity: item.quantity || "1",
        unitPrice: item.unitPrice,
        amount: ((parseFloat(item.quantity) || 1) * (parseFloat(item.unitPrice) || 0)).toFixed(2),
        sortOrder: index,
      }));

    if (lineItems.length === 0) {
      toast({ title: "At least one line item is required", variant: "destructive" });
      return;
    }

    const project = projects?.find(p => p.id === newInvoice.projectId);
    
    createMutation.mutate({
      clientName: newInvoice.clientName,
      clientEmail: newInvoice.clientEmail || null,
      clientAddress: newInvoice.clientAddress || null,
      projectId: newInvoice.projectId || null,
      region: project?.region || null,
      issueDate: new Date(),
      dueDate: new Date(newInvoice.dueDate),
      paidDate: null,
      subtotal: subtotal.toFixed(2),
      total: total.toFixed(2),
      balance: total.toFixed(2),
      notes: newInvoice.notes || null,
      lineItems,
    });
  };

  const handleViewInvoice = async (invoiceId: string) => {
    try {
      const response = await fetch(`/api/invoices/${invoiceId}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch invoice details");
      const invoice = await response.json();
      setSelectedInvoice(invoice);
      setIsViewDialogOpen(true);
    } catch (error) {
      toast({ title: "Failed to load invoice details", variant: "destructive" });
    }
  };

  const handleRecordPayment = (invoice: InvoiceListItem) => {
    setSelectedInvoice(invoice as any);
    setPaymentAmount(invoice.balance || "0");
    setPaymentDate(format(new Date(), "yyyy-MM-dd"));
    setIsPaymentDialogOpen(true);
  };

  const handleDownloadInvoice = async (invoiceId: string, region: Region | null) => {
    try {
      const response = await fetch(`/api/invoices/${invoiceId}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch invoice details");
      const invoice: InvoiceWithDetails = await response.json();
      
      const banking = bankingDetails?.find((b) => b.region === (region || "CA")) || {
        id: "default",
        region: "CA" as Region,
        createdAt: null,
        updatedAt: null,
        companyName: "TekRevol LLC",
        companyAddress: "",
        bankName: "",
        accountName: "",
        accountNumber: "",
        routingNumber: "",
        swiftCode: "",
        iban: "",
        currency: "USD" as const,
        notes: "",
        bankAddress: null,
        beneficiaryAddress: null,
        additionalInstructions: null,
      };
      
      generateInvoiceFromRecord({
        invoice,
        banking,
      });
      
      toast({ title: "Invoice downloaded successfully" });
    } catch (error) {
      toast({ title: "Failed to download invoice", description: getErrorMessage(error), variant: "destructive" });
    }
  };

  const handleDownloadReceipt = async (invoice: InvoiceWithDetails) => {
    try {
      const banking = bankingDetails?.find((b) => b.region === (invoice.region || "CA")) || {
        id: "default",
        region: "CA" as Region,
        createdAt: null,
        updatedAt: null,
        companyName: "TekRevol LLC",
        companyAddress: "",
        bankName: "",
        accountName: "",
        accountNumber: "",
        routingNumber: "",
        swiftCode: "",
        iban: "",
        currency: "USD" as const,
        notes: "",
        bankAddress: null,
        beneficiaryAddress: null,
        additionalInstructions: null,
      };
      
      generateReceiptPDF({
        invoice,
        banking,
      });
      
      toast({ title: "Receipt downloaded successfully" });
    } catch (error) {
      toast({ title: "Failed to download receipt", description: getErrorMessage(error), variant: "destructive" });
    }
  };

  const clearFilters = () => {
    setFilters({ status: "", region: "", projectId: "", search: "" });
  };

  const hasActiveFilters = filters.status || filters.region || filters.projectId || filters.search;

  const filteredInvoices = invoices?.filter(invoice => {
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      return (
        invoice.invoiceNumber.toLowerCase().includes(searchLower) ||
        invoice.clientName.toLowerCase().includes(searchLower) ||
        invoice.projectName?.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  // Calculate KPIs
  const kpis = {
    total: filteredInvoices?.length || 0,
    draft: filteredInvoices?.filter(i => i.status === "draft").length || 0,
    sent: filteredInvoices?.filter(i => i.status === "sent").length || 0,
    paid: filteredInvoices?.filter(i => i.status === "paid").length || 0,
    overdue: filteredInvoices?.filter(i => i.status === "overdue").length || 0,
    totalValue: filteredInvoices?.reduce((sum, i) => sum + parseFloat(i.total || "0"), 0) || 0,
    paidValue: filteredInvoices?.reduce((sum, i) => sum + parseFloat(i.amountPaid || "0"), 0) || 0,
    pendingValue: filteredInvoices?.reduce((sum, i) => sum + parseFloat(i.balance || "0"), 0) || 0,
  };

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Invoices</h1>
            <p className="text-muted-foreground">Track and manage all invoices</p>
          </div>
          {canCreateInvoices && (
            <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-invoice">
              <Plus className="w-4 h-4 mr-2" />
              Create Invoice
            </Button>
          )}
        </div>

        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {/* Total Invoices - Primary/Blood Red Gradient */}
          <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-card via-card to-primary/5 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-primary/10 blur-2xl" />
            <div className="relative z-10">
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-sm font-medium text-foreground">Total Invoices</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
              </div>
              <div className="text-2xl font-bold" data-testid="text-total-invoices">{kpis.total}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {kpis.draft} draft, {kpis.sent} sent
              </p>
            </div>
          </div>
          
          {/* Paid - Green Gradient */}
          <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-card via-card to-green-500/5 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-green-500/10 blur-2xl" />
            <div className="relative z-10">
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-sm font-medium text-foreground">Paid</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-500" />
                </div>
              </div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-500" data-testid="text-paid-invoices">{kpis.paid}</div>
              <p className="text-xs text-muted-foreground mt-1">
                ${kpis.paidValue.toLocaleString(undefined, { minimumFractionDigits: 2 })} collected
              </p>
            </div>
          </div>
          
          {/* Pending - Amber/Yellow Gradient */}
          <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-card via-card to-amber-500/5 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-amber-500/10 blur-2xl" />
            <div className="relative z-10">
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-sm font-medium text-foreground">Pending</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                  <Clock className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                </div>
              </div>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-500" data-testid="text-pending-value">
                ${kpis.pendingValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Outstanding balance</p>
            </div>
          </div>
          
          {/* Overdue - Red Gradient */}
          <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-card via-card to-red-500/5 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-red-500/10 blur-2xl" />
            <div className="relative z-10">
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-sm font-medium text-foreground">Overdue</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                  <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-500" />
                </div>
              </div>
              <div className="text-2xl font-bold text-red-600 dark:text-red-500" data-testid="text-overdue-count">{kpis.overdue}</div>
              <p className="text-xs text-muted-foreground mt-1">Require attention</p>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4">
            <CardTitle className="text-lg">Invoice List</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search invoices..."
                  className="pl-8 w-[200px]"
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  data-testid="input-search"
                />
              </div>
              
              <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
                <SelectTrigger className="w-[130px]" data-testid="select-status">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filters.region} onValueChange={(value) => setFilters(prev => ({ ...prev, region: value }))}>
                <SelectTrigger className="w-[130px]" data-testid="select-region">
                  <SelectValue placeholder="Region" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Regions</SelectItem>
                  {regions.map(region => (
                    <SelectItem key={region.value} value={region.value}>{region.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-filters">
                  <X className="w-4 h-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filteredInvoices && filteredInvoices.length > 0 ? (
              <>
                {/* Mobile card view (< md) */}
                <div className="block md:hidden space-y-3">
                  {filteredInvoices.map((invoice) => {
                    const isExpanded = expandedInvoices.has(invoice.id);
                    return (
                      <div key={invoice.id} className="rounded-lg border bg-card shadow-sm" data-testid={`card-invoice-${invoice.id}`}>
                        <div className="flex items-start justify-between gap-2 p-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm" data-testid={`text-invoice-number-${invoice.id}`}>{invoice.invoiceNumber}</span>
                              <InvoiceStatusBadge status={invoice.status} />
                            </div>
                            <p className="text-sm text-muted-foreground mt-0.5 truncate">{invoice.clientName}</p>
                            <p className="text-base font-bold mt-1">
                              ${parseFloat(invoice.total || "0").toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" data-testid={`button-actions-${invoice.id}`}>
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleViewInvoice(invoice.id)}>
                                  <Eye className="w-4 h-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDownloadInvoice(invoice.id, invoice.region)}>
                                  <Download className="w-4 h-4 mr-2" />
                                  Download PDF
                                </DropdownMenuItem>
                                {canCreateInvoices && (
                                  <DropdownMenuItem 
                                    onClick={() => syncToQuickbooksMutation.mutate(invoice.id)}
                                    disabled={syncToQuickbooksMutation.isPending}
                                  >
                                    <CloudUpload className="w-4 h-4 mr-2" />
                                    Send to QuickBooks
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                {invoice.status === "draft" && canCreateInvoices && (
                                  <DropdownMenuItem onClick={() => sendMutation.mutate(invoice.id)}>
                                    <Send className="w-4 h-4 mr-2" />
                                    Mark as Sent
                                  </DropdownMenuItem>
                                )}
                                {(invoice.status === "sent" || invoice.status === "overdue" || invoice.status === "cancelled") && canRecordPayment && (
                                  <DropdownMenuItem onClick={() => handleRecordPayment(invoice)}>
                                    <DollarSign className="w-4 h-4 mr-2" />
                                    Record Payment
                                  </DropdownMenuItem>
                                )}
                                {invoice.status === "cancelled" && canCancelInvoices && (
                                  <DropdownMenuItem 
                                    onClick={() => reactivateMutation.mutate(invoice.id)}
                                    disabled={reactivateMutation.isPending}
                                    data-testid={`button-reactivate-${invoice.id}`}
                                  >
                                    <RotateCcw className="w-4 h-4 mr-2" />
                                    Reactivate Invoice
                                  </DropdownMenuItem>
                                )}
                                {invoice.status === "paid" && (
                                  <DropdownMenuItem onClick={() => handleViewInvoice(invoice.id)}>
                                    <Receipt className="w-4 h-4 mr-2" />
                                    View Receipt
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                {invoice.status !== "paid" && invoice.status !== "cancelled" && canCancelInvoices && (
                                  <DropdownMenuItem 
                                    className="text-destructive"
                                    onClick={() => cancelMutation.mutate(invoice.id)}
                                  >
                                    <Ban className="w-4 h-4 mr-2" />
                                    Cancel Invoice
                                  </DropdownMenuItem>
                                )}
                                {invoice.status !== "paid" && canDeleteInvoices && (
                                  <DropdownMenuItem 
                                    className="text-destructive"
                                    onClick={() => deleteMutation.mutate(invoice.id)}
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => toggleInvoiceExpand(invoice.id)}
                              data-testid={`button-expand-${invoice.id}`}
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </Button>
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="border-t px-4 py-3 space-y-2 text-sm bg-muted/30">
                            {invoice.projectName && (
                              <div className="flex justify-between gap-2">
                                <span className="text-muted-foreground">Project</span>
                                {invoice.projectId ? (
                                  <button
                                    className="text-right font-medium hover:underline text-primary"
                                    onClick={() => { setDetailProjectId(invoice.projectId!); setProjectDetailOpen(true); }}
                                  >
                                    {invoice.projectName}
                                  </button>
                                ) : (
                                  <span className="text-right font-medium">{invoice.projectName}</span>
                                )}
                              </div>
                            )}
                            <div className="flex justify-between gap-2">
                              <span className="text-muted-foreground">Issue Date</span>
                              <span className="font-medium">{invoice.issueDate ? format(new Date(invoice.issueDate), "MMM d, yyyy") : "-"}</span>
                            </div>
                            <div className="flex justify-between gap-2">
                              <span className="text-muted-foreground">Due Date</span>
                              <span className="font-medium">{invoice.dueDate ? format(new Date(invoice.dueDate), "MMM d, yyyy") : "-"}</span>
                            </div>
                            <div className="flex justify-between gap-2">
                              <span className="text-muted-foreground">Balance</span>
                              <span className="font-medium">${parseFloat(invoice.balance || "0").toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                            {invoice.region && (
                              <div className="flex justify-between gap-2 items-center">
                                <span className="text-muted-foreground">Region</span>
                                <RegionBadge region={invoice.region} />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Desktop table view (≥ md) */}
                <div className="hidden md:block">
                <ScrollArea className="h-[500px] overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Issue Date</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Region</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.map((invoice) => (
                      <TableRow key={invoice.id} data-testid={`row-invoice-${invoice.id}`}>
                        <TableCell className="font-medium" data-testid={`text-invoice-number-${invoice.id}`}>
                          {invoice.invoiceNumber}
                        </TableCell>
                        <TableCell>{invoice.clientName}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {invoice.projectId && invoice.projectName ? (
                            <button
                              className="hover:underline hover:text-foreground transition-colors text-left"
                              onClick={() => { setDetailProjectId(invoice.projectId!); setProjectDetailOpen(true); }}
                              data-testid={`link-project-${invoice.id}`}
                            >
                              {invoice.projectName}
                            </button>
                          ) : (invoice.projectName || "-")}
                        </TableCell>
                        <TableCell>
                          {invoice.issueDate ? format(new Date(invoice.issueDate), "MMM d, yyyy") : "-"}
                        </TableCell>
                        <TableCell>
                          {invoice.dueDate ? format(new Date(invoice.dueDate), "MMM d, yyyy") : "-"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ${parseFloat(invoice.total || "0").toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right">
                          ${parseFloat(invoice.balance || "0").toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          <InvoiceStatusBadge status={invoice.status} />
                        </TableCell>
                        <TableCell>
                          {invoice.region ? <RegionBadge region={invoice.region} /> : "-"}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" data-testid={`button-actions-${invoice.id}`}>
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleViewInvoice(invoice.id)}>
                                <Eye className="w-4 h-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDownloadInvoice(invoice.id, invoice.region)}>
                                <Download className="w-4 h-4 mr-2" />
                                Download PDF
                              </DropdownMenuItem>
                              {canCreateInvoices && (
                                <DropdownMenuItem 
                                  onClick={() => syncToQuickbooksMutation.mutate(invoice.id)}
                                  disabled={syncToQuickbooksMutation.isPending}
                                >
                                  <CloudUpload className="w-4 h-4 mr-2" />
                                  Send to QuickBooks
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              {invoice.status === "draft" && canCreateInvoices && (
                                <DropdownMenuItem onClick={() => sendMutation.mutate(invoice.id)}>
                                  <Send className="w-4 h-4 mr-2" />
                                  Mark as Sent
                                </DropdownMenuItem>
                              )}
                              {(invoice.status === "sent" || invoice.status === "overdue" || invoice.status === "cancelled") && canRecordPayment && (
                                <DropdownMenuItem onClick={() => handleRecordPayment(invoice)}>
                                  <DollarSign className="w-4 h-4 mr-2" />
                                  Record Payment
                                </DropdownMenuItem>
                              )}
                              {invoice.status === "cancelled" && canCancelInvoices && (
                                <DropdownMenuItem 
                                  onClick={() => reactivateMutation.mutate(invoice.id)}
                                  disabled={reactivateMutation.isPending}
                                  data-testid={`button-reactivate-${invoice.id}`}
                                >
                                  <RotateCcw className="w-4 h-4 mr-2" />
                                  Reactivate Invoice
                                </DropdownMenuItem>
                              )}
                              {invoice.status === "paid" && (
                                <DropdownMenuItem onClick={() => handleViewInvoice(invoice.id)}>
                                  <Receipt className="w-4 h-4 mr-2" />
                                  View Receipt
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              {invoice.status !== "paid" && invoice.status !== "cancelled" && canCancelInvoices && (
                                <DropdownMenuItem 
                                  className="text-destructive"
                                  onClick={() => cancelMutation.mutate(invoice.id)}
                                >
                                  <Ban className="w-4 h-4 mr-2" />
                                  Cancel Invoice
                                </DropdownMenuItem>
                              )}
                              {invoice.status !== "paid" && canDeleteInvoices && (
                                <DropdownMenuItem 
                                  className="text-destructive"
                                  onClick={() => deleteMutation.mutate(invoice.id)}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No invoices found</h3>
                <p className="text-muted-foreground mb-4">
                  {hasActiveFilters ? "Try adjusting your filters" : "Create your first invoice to get started"}
                </p>
                {!hasActiveFilters && canCreateInvoices && (
                  <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-first-invoice">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Invoice
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Invoice</DialogTitle>
            <DialogDescription>
              Create a new invoice with custom line items
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="project">Project (Optional)</Label>
                <Select value={newInvoice.projectId} onValueChange={handleProjectSelect}>
                  <SelectTrigger data-testid="select-project">
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects?.map(project => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name} - {project.clientName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="clientName">Client Name *</Label>
                  <Input
                    id="clientName"
                    value={newInvoice.clientName}
                    onChange={(e) => setNewInvoice(prev => ({ ...prev, clientName: e.target.value }))}
                    placeholder="Client name"
                    data-testid="input-client-name"
                  />
                </div>
                <div>
                  <Label htmlFor="clientEmail">Client Email</Label>
                  <Input
                    id="clientEmail"
                    type="email"
                    value={newInvoice.clientEmail}
                    onChange={(e) => setNewInvoice(prev => ({ ...prev, clientEmail: e.target.value }))}
                    placeholder="client@example.com"
                    data-testid="input-client-email"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="clientAddress">Client Address</Label>
                <Textarea
                  id="clientAddress"
                  value={newInvoice.clientAddress}
                  onChange={(e) => setNewInvoice(prev => ({ ...prev, clientAddress: e.target.value }))}
                  placeholder="Full billing address"
                  rows={2}
                  data-testid="input-client-address"
                />
              </div>

              <div>
                <Label htmlFor="dueDate">Due Date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={newInvoice.dueDate}
                  onChange={(e) => setNewInvoice(prev => ({ ...prev, dueDate: e.target.value }))}
                  data-testid="input-due-date"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Line Items</Label>
                <Button type="button" variant="outline" size="sm" onClick={addLineItem} data-testid="button-add-line-item">
                  <Plus className="w-4 h-4 mr-1" />
                  Add Item
                </Button>
              </div>

              {newInvoice.lineItems.map((item, index) => (
                <div key={index} className="flex gap-2 items-start">
                  <div className="flex-1">
                    <Input
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => updateLineItem(index, "description", e.target.value)}
                      data-testid={`input-line-description-${index}`}
                    />
                  </div>
                  <div className="w-20">
                    <Input
                      type="number"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => updateLineItem(index, "quantity", e.target.value)}
                      data-testid={`input-line-quantity-${index}`}
                    />
                  </div>
                  <div className="w-28">
                    <Input
                      type="number"
                      placeholder="Unit Price"
                      value={item.unitPrice}
                      onChange={(e) => updateLineItem(index, "unitPrice", e.target.value)}
                      data-testid={`input-line-price-${index}`}
                    />
                  </div>
                  <div className="w-24 text-right pt-2 font-medium">
                    ${((parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0)).toFixed(2)}
                  </div>
                  {newInvoice.lineItems.length > 1 && (
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon"
                      onClick={() => removeLineItem(index)}
                      data-testid={`button-remove-line-${index}`}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}

              <div className="flex justify-end pt-4 border-t">
                <div className="text-right space-y-1">
                  <div className="flex justify-between gap-8">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span className="font-medium">${calculateTotals().subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between gap-8 text-lg">
                    <span className="font-semibold">Total:</span>
                    <span className="font-bold">${calculateTotals().total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={newInvoice.notes}
                onChange={(e) => setNewInvoice(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional notes or payment instructions"
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
              onClick={handleCreateInvoice}
              disabled={!newInvoice.clientName || createMutation.isPending}
              data-testid="button-submit-invoice"
            >
              {createMutation.isPending ? "Creating..." : "Create Invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Invoice Details</DialogTitle>
            <DialogDescription>
              {selectedInvoice?.invoiceNumber}
            </DialogDescription>
          </DialogHeader>
          
          {selectedInvoice && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Client</Label>
                  <p className="font-medium">{selectedInvoice.clientName}</p>
                  {selectedInvoice.clientEmail && (
                    <p className="text-sm text-muted-foreground">{selectedInvoice.clientEmail}</p>
                  )}
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <div className="mt-1">
                    <InvoiceStatusBadge status={selectedInvoice.status} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-muted-foreground">Issue Date</Label>
                  <p className="font-medium">
                    {selectedInvoice.issueDate ? format(new Date(selectedInvoice.issueDate), "MMM d, yyyy") : "-"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Due Date</Label>
                  <p className="font-medium">
                    {selectedInvoice.dueDate ? format(new Date(selectedInvoice.dueDate), "MMM d, yyyy") : "-"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Paid Date</Label>
                  <p className="font-medium">
                    {selectedInvoice.paidDate ? format(new Date(selectedInvoice.paidDate), "MMM d, yyyy") : "-"}
                  </p>
                </div>
              </div>

              {selectedInvoice.lineItems && selectedInvoice.lineItems.length > 0 && (
                <div>
                  <Label className="text-muted-foreground mb-2 block">Line Items</Label>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedInvoice.lineItems.map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.description}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">${parseFloat(item.unitPrice || "0").toFixed(2)}</TableCell>
                          <TableCell className="text-right font-medium">${parseFloat(item.amount || "0").toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <div className="flex justify-end pt-4 border-t">
                <div className="text-right space-y-1">
                  <div className="flex justify-between gap-8">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span>${parseFloat(selectedInvoice.subtotal || "0").toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between gap-8 text-lg">
                    <span className="font-semibold">Total:</span>
                    <span className="font-bold">${parseFloat(selectedInvoice.total || "0").toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between gap-8">
                    <span className="text-muted-foreground">Amount Paid:</span>
                    <span className="text-green-600">${parseFloat(selectedInvoice.amountPaid || "0").toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between gap-8">
                    <span className="font-medium">Balance Due:</span>
                    <span className="font-bold">${parseFloat(selectedInvoice.balance || "0").toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {selectedInvoice.notes && (
                <div>
                  <Label className="text-muted-foreground">Notes</Label>
                  <p className="mt-1">{selectedInvoice.notes}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              Close
            </Button>
            {selectedInvoice?.status === "paid" && (
              <Button 
                onClick={() => selectedInvoice && handleDownloadReceipt(selectedInvoice)}
                data-testid="button-download-receipt"
              >
                <Download className="w-4 h-4 mr-2" />
                Download Receipt
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Record a payment for invoice {selectedInvoice?.invoiceNumber}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="paymentAmount">Payment Amount *</Label>
              <Input
                id="paymentAmount"
                type="number"
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0.00"
                data-testid="input-payment-amount"
              />
            </div>
            <div>
              <Label htmlFor="paymentDate">Payment Date</Label>
              <Input
                id="paymentDate"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                data-testid="input-payment-date"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (selectedInvoice) {
                  recordPaymentMutation.mutate({
                    id: selectedInvoice.id,
                    amount: paymentAmount,
                    paidDate: paymentDate,
                  });
                }
              }}
              disabled={!paymentAmount || recordPaymentMutation.isPending}
              data-testid="button-submit-payment"
            >
              {recordPaymentMutation.isPending ? "Recording..." : "Record Payment"}
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
