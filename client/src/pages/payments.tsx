import { useState, useEffect } from "react";
import { useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, getErrorMessage } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { RegionBadge } from "@/components/region-badge";
import { DeliveryStatusIndicator } from "@/components/delivery-status-indicator";
import { useToast } from "@/hooks/use-toast";
import { Filter, X, Search, Download, FileSpreadsheet, FileText, Upload, ChevronDown, Target, DollarSign, TrendingUp, Wallet, FileDown, CheckCircle, XCircle, Mail } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { exportToCSV, exportToPDF, formatCurrencyForExport, formatDateForExport } from "@/lib/export-utils";
import { PaymentImportModal } from "@/components/payment-import-modal";
import { generateInvoicePDF } from "@shared/invoice-generator";
import { MilestoneSyncDialog } from "@/components/milestone-sync-dialog";
import type { PaymentWithProject, User, Project, PaymentStatus, PaymentType, Region, RegionBankingDetails } from "@shared/schema";

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

const paymentStatuses: { value: PaymentStatus; label: string }[] = [
  { value: "not_targeting", label: "Not Targeting" },
  { value: "pending_invoice", label: "Pending Invoice" },
  { value: "invoiced", label: "Invoiced" },
  { value: "received", label: "Received" },
];

const paymentTypes: { value: PaymentType; label: string }[] = [
  { value: "recurring", label: "Recurring" },
  { value: "upsell", label: "Upsell" },
];

const regions: { value: Region; label: string }[] = [
  { value: "CA", label: "California" },
  { value: "TX", label: "Texas" },
  { value: "AE", label: "UAE" },
];

export default function Payments() {
  const { toast } = useToast();
  const currentDate = new Date();
  const search = useSearch();
  const initialParams = new URLSearchParams(search);

  const [filters, setFilters] = useState({
    month: initialParams.get("month") || String(currentDate.getMonth() + 1),
    year: initialParams.get("year") || String(currentDate.getFullYear()),
    region: "",
    pmId: "",
    paymentType: initialParams.get("paymentType") || "",
    status: "",
    search: "",
  });

  const [highlightId, setHighlightId] = useState<string | null>(initialParams.get("highlight"));
  
  const [editingPayment, setEditingPayment] = useState<PaymentWithProject | null>(null);
  const [receivedAmount, setReceivedAmount] = useState("");
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isReceivedDialogOpen, setIsReceivedDialogOpen] = useState(false);
  const [milestoneSyncData, setMilestoneSyncData] = useState<{ autoLinked: boolean; milestone?: any; availableMilestones?: any[] } | null>(null);
  const [milestoneSyncPaymentId, setMilestoneSyncPaymentId] = useState<string>("");
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
  const [invoicePayment, setInvoicePayment] = useState<PaymentWithProject | null>(null);
  const [invoiceDetails, setInvoiceDetails] = useState({
    invoiceNumber: "",
    invoiceDate: format(new Date(), "yyyy-MM-dd"),
    description: "",
    notes: "",
  });

  const queryParams = new URLSearchParams();
  if (filters.month) queryParams.set("month", filters.month);
  if (filters.year) queryParams.set("year", filters.year);
  if (filters.region) queryParams.set("region", filters.region);
  if (filters.pmId) queryParams.set("pmId", filters.pmId);
  if (filters.paymentType) queryParams.set("paymentType", filters.paymentType);
  if (filters.status) queryParams.set("status", filters.status);

  const queryString = queryParams.toString();
  const { data: payments, isLoading } = useQuery<PaymentWithProject[]>({
    queryKey: ["/api/payments", filters],
    queryFn: async () => {
      const response = await fetch(`/api/payments?${queryString}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch payments");
      return response.json();
    },
  });

  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: bankingDetails } = useQuery<RegionBankingDetails[]>({
    queryKey: ["/api/settings/banking"],
  });

  const handleGenerateInvoice = (payment: PaymentWithProject) => {
    setInvoicePayment(payment);
    setInvoiceDetails({
      invoiceNumber: `INV-${format(new Date(), "yyyyMMdd")}-${payment.id.slice(0, 8).toUpperCase()}`,
      invoiceDate: format(new Date(), "yyyy-MM-dd"),
      description: payment.narration || `${payment.project?.name} - ${payment.project?.phase || "Services"}`,
      notes: "",
    });
    setIsInvoiceDialogOpen(true);
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
      generateInvoicePDF({
        payment: invoicePayment,
        banking,
        invoiceNumber: invoiceDetails.invoiceNumber,
        invoiceDate: invoiceDetails.invoiceDate,
        description: invoiceDetails.description,
        notes: invoiceDetails.notes,
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

  const updateStatusMutation = useMutation({
    mutationFn: async (data: { id: string; status: PaymentStatus; receivedAmount?: string; invoiceDate?: string }) => {
      const payload: Record<string, unknown> = { status: data.status };
      if (data.status === "received") {
        payload.receivedDate = new Date().toISOString();
        if (data.receivedAmount) {
          payload.receivedAmount = data.receivedAmount;
        }
      }
      if (data.status === "invoiced" && data.invoiceDate) {
        payload.invoiceDate = data.invoiceDate;
      }
      const response = await apiRequest("PATCH", `/api/payments/${data.id}`, payload);
      return response.json();
    },
    onSuccess: (data: any, variables: { id: string; status: PaymentStatus; receivedAmount?: string; invoiceDate?: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/pm-leaders"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/cost-margin/summary"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/cost-margin/hourly-buckets"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/milestones"] });
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && (key.startsWith("/api/projects") || key.startsWith("/api/forecasting"));
        },
      });
      setEditingPayment(null);
      setReceivedAmount("");
      toast({
        title: "Status Updated",
        description: "Payment status has been updated successfully.",
      });
      if (data?.milestoneSyncSuggestion) {
        setMilestoneSyncData(data.milestoneSyncSuggestion);
        setMilestoneSyncPaymentId(variables.id);
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to update payment status. Please try again."),
        variant: "destructive",
      });
    },
  });

  const toggleConfirmedMutation = useMutation({
    mutationFn: async (data: { id: string; isConfirmed: boolean }) => {
      return apiRequest("PATCH", `/api/payments/${data.id}`, { isConfirmed: data.isConfirmed });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/pm-leaders"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/cost-margin/summary"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/cost-margin/hourly-buckets"], exact: false });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to update confirmation status."),
        variant: "destructive",
      });
    },
  });

  const sendReminderMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      return apiRequest("POST", `/api/payments/${paymentId}/send-reminder`);
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
    onError: (error) => {
      toast({
        title: "Failed to Send Reminder",
        description: getErrorMessage(error, "Could not send the payment reminder."),
        variant: "destructive",
      });
    },
  });

  const sendReceiptMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const response = await apiRequest("POST", `/api/payments/${paymentId}/send-receipt`);
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Receipt Sent",
        description: data.message || "Payment receipt confirmation has been sent to the client.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to Send Receipt",
        description: getErrorMessage(error, "Could not send the payment receipt."),
        variant: "destructive",
      });
    },
  });

  const formatCurrency = (value: number | string | null) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    if (num === null || isNaN(num as number)) return "$0";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num as number);
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return "-";
    return format(new Date(date), "MMM d, yyyy");
  };

  const clearFilters = () => {
    setFilters({
      month: String(currentDate.getMonth() + 1),
      year: String(currentDate.getFullYear()),
      region: "",
      pmId: "",
      paymentType: "",
      status: "",
      search: "",
    });
  };

  const pmUsers = users?.filter(u => u.isProjectManager) || [];

  const filteredPayments = payments?.filter(payment => {
    if (!filters.search) return true;
    const searchLower = filters.search.toLowerCase();
    return (
      payment.project?.name?.toLowerCase().includes(searchLower) ||
      payment.project?.clientName?.toLowerCase().includes(searchLower)
    );
  }) || [];

  useEffect(() => {
    if (!highlightId || isLoading) return;
    const el = document.querySelector(`[data-testid="row-payment-${highlightId}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    const timer = setTimeout(() => setHighlightId(null), 3500);
    return () => clearTimeout(timer);
  }, [highlightId, isLoading, filteredPayments]);

  const stats = {
    targeted: filteredPayments
      .filter(p => p.paymentType === "recurring" && p.isTarget === true)
      .reduce((sum, p) => sum + (parseFloat(String(p.expectedAmount)) || 0), 0),
    upsellExpected: filteredPayments
      .filter(p => p.paymentType === "upsell")
      .reduce((sum, p) => sum + (parseFloat(String(p.expectedAmount)) || 0), 0),
    upsellReceived: filteredPayments
      .filter(p => p.paymentType === "upsell")
      .reduce((sum, p) => sum + (parseFloat(String(p.receivedAmount)) || 0), 0),
    expected: filteredPayments
      .reduce((sum, p) => sum + (parseFloat(String(p.expectedAmount)) || 0), 0),
    received: filteredPayments
      .reduce((sum, p) => sum + (parseFloat(String(p.receivedAmount)) || 0), 0),
    get remaining() { return this.targeted - this.received; }
  };

  const regionStats = {
    CA: {
      targeted: filteredPayments
        .filter(p => p.project?.region === "CA" && p.paymentType === "recurring" && p.isTarget === true)
        .reduce((sum, p) => sum + (parseFloat(String(p.expectedAmount)) || 0), 0),
      upsellExpected: filteredPayments
        .filter(p => p.project?.region === "CA" && p.paymentType === "upsell")
        .reduce((sum, p) => sum + (parseFloat(String(p.expectedAmount)) || 0), 0),
      upsellReceived: filteredPayments
        .filter(p => p.project?.region === "CA" && p.paymentType === "upsell")
        .reduce((sum, p) => sum + (parseFloat(String(p.receivedAmount)) || 0), 0),
      expected: filteredPayments
        .filter(p => p.project?.region === "CA")
        .reduce((sum, p) => sum + (parseFloat(String(p.expectedAmount)) || 0), 0),
      received: filteredPayments
        .filter(p => p.project?.region === "CA")
        .reduce((sum, p) => sum + (parseFloat(String(p.receivedAmount)) || 0), 0),
    },
    TX: {
      targeted: filteredPayments
        .filter(p => p.project?.region === "TX" && p.paymentType === "recurring" && p.isTarget === true)
        .reduce((sum, p) => sum + (parseFloat(String(p.expectedAmount)) || 0), 0),
      upsellExpected: filteredPayments
        .filter(p => p.project?.region === "TX" && p.paymentType === "upsell")
        .reduce((sum, p) => sum + (parseFloat(String(p.expectedAmount)) || 0), 0),
      upsellReceived: filteredPayments
        .filter(p => p.project?.region === "TX" && p.paymentType === "upsell")
        .reduce((sum, p) => sum + (parseFloat(String(p.receivedAmount)) || 0), 0),
      expected: filteredPayments
        .filter(p => p.project?.region === "TX")
        .reduce((sum, p) => sum + (parseFloat(String(p.expectedAmount)) || 0), 0),
      received: filteredPayments
        .filter(p => p.project?.region === "TX")
        .reduce((sum, p) => sum + (parseFloat(String(p.receivedAmount)) || 0), 0),
    },
    AE: {
      targeted: filteredPayments
        .filter(p => p.project?.region === "AE" && p.paymentType === "recurring" && p.isTarget === true)
        .reduce((sum, p) => sum + (parseFloat(String(p.expectedAmount)) || 0), 0),
      upsellExpected: filteredPayments
        .filter(p => p.project?.region === "AE" && p.paymentType === "upsell")
        .reduce((sum, p) => sum + (parseFloat(String(p.expectedAmount)) || 0), 0),
      upsellReceived: filteredPayments
        .filter(p => p.project?.region === "AE" && p.paymentType === "upsell")
        .reduce((sum, p) => sum + (parseFloat(String(p.receivedAmount)) || 0), 0),
      expected: filteredPayments
        .filter(p => p.project?.region === "AE")
        .reduce((sum, p) => sum + (parseFloat(String(p.expectedAmount)) || 0), 0),
      received: filteredPayments
        .filter(p => p.project?.region === "AE")
        .reduce((sum, p) => sum + (parseFloat(String(p.receivedAmount)) || 0), 0),
    },
  };

  const handleStatusChange = (payment: PaymentWithProject, newStatus: PaymentStatus) => {
    if (newStatus === payment.status) return;
    
    if (newStatus === "received") {
      setEditingPayment(payment);
      const currentReceived = payment.receivedAmount ? parseFloat(String(payment.receivedAmount)) : 0;
      const expectedAmount = payment.expectedAmount ? parseFloat(String(payment.expectedAmount)) : 0;
      setReceivedAmount(currentReceived > 0 ? String(currentReceived) : String(expectedAmount));
      setIsReceivedDialogOpen(true);
    } else if (newStatus === "invoiced") {
      // Set invoice date to today when marking as invoiced
      updateStatusMutation.mutate({ 
        id: payment.id, 
        status: newStatus,
        invoiceDate: new Date().toISOString(),
      });
    } else {
      updateStatusMutation.mutate({ id: payment.id, status: newStatus });
    }
  };

  const handleConfirmReceived = () => {
    if (!editingPayment) return;
    const amount = parseFloat(receivedAmount);
    if (isNaN(amount) || amount < 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid received amount.",
        variant: "destructive",
      });
      return;
    }
    updateStatusMutation.mutate({
      id: editingPayment.id,
      status: "received",
      receivedAmount: amount.toString(),
    });
    setIsReceivedDialogOpen(false);
  };

  const handleCancelReceived = () => {
    setIsReceivedDialogOpen(false);
    setEditingPayment(null);
    setReceivedAmount("");
  };

  const paymentExportColumns = [
    { header: "Project", accessor: (row: PaymentWithProject) => row.project?.name || "" },
    { header: "Client", accessor: (row: PaymentWithProject) => row.project?.clientName || "" },
    { header: "Region", accessor: (row: PaymentWithProject) => row.project?.region || "" },
    { header: "Type", accessor: "paymentType" },
    { header: "Phase", accessor: (row: PaymentWithProject) => row.narration || row.project?.phase || "" },
    { header: "Total", accessor: (row: PaymentWithProject) => formatCurrencyForExport(row.totalAmount) },
    { header: "Expected", accessor: (row: PaymentWithProject) => formatCurrencyForExport(row.expectedAmount) },
    { header: "Received", accessor: (row: PaymentWithProject) => formatCurrencyForExport(row.receivedAmount) },
    { header: "Status", accessor: "status" },
    { header: "Invoice Date", accessor: (row: PaymentWithProject) => formatDateForExport(row.invoiceDate) },
    { header: "Due Date", accessor: (row: PaymentWithProject) => formatDateForExport(row.dueDate) },
    { header: "Received Date", accessor: (row: PaymentWithProject) => formatDateForExport(row.receivedDate) },
  ];

  const handleExportPaymentsCSV = () => {
    if (!filteredPayments.length) return;
    const monthName = months.find(m => m.value === filters.month)?.label || filters.month;
    exportToCSV(filteredPayments, paymentExportColumns, `payments-${monthName}-${filters.year}`);
  };

  const handleExportPaymentsPDF = () => {
    if (!filteredPayments.length) return;
    const monthName = months.find(m => m.value === filters.month)?.label || filters.month;
    exportToPDF(
      filteredPayments,
      paymentExportColumns,
      `payments-${monthName}-${filters.year}`,
      `Payments - ${monthName} ${filters.year}`
    );
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Payments</h1>
          <p className="text-muted-foreground">Manage and track all payments</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setIsImportDialogOpen(true)} data-testid="button-import-payments">
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" data-testid="button-export-payments">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportPaymentsCSV} data-testid="button-export-payments-csv">
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Export CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPaymentsPDF} data-testid="button-export-payments-pdf">
                <FileText className="h-4 w-4 mr-2" />
                Export PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <div className="relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-br from-card via-card to-primary/5 shadow-sm hover:shadow-md transition-all duration-300">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -translate-y-8 translate-x-8" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl translate-y-6 -translate-x-6" />
          <div className="relative z-10 p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20">
                <Target className="h-4 w-4 text-primary" />
              </div>
              <p className="text-[10px] font-semibold text-primary uppercase tracking-wider">Targeted Amount</p>
            </div>
            <div className="text-3xl font-extrabold text-primary" data-testid="stat-targeted-amount">
              {isLoading ? <Skeleton className="h-8 w-24" /> : formatCurrency(stats.targeted)}
            </div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-1">Recurring payments targeted</p>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-br from-card via-card to-blue-500/5 shadow-sm hover:shadow-md transition-all duration-300">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -translate-y-8 translate-x-8" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl translate-y-6 -translate-x-6" />
          <div className="relative z-10 p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500/10 ring-1 ring-blue-500/20">
                <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-500" />
              </div>
              <p className="text-[10px] font-semibold text-blue-600 dark:text-blue-500 uppercase tracking-wider">Upsell Expected</p>
            </div>
            <div className="text-3xl font-extrabold text-blue-600 dark:text-blue-500" data-testid="stat-upsell-expected">
              {isLoading ? <Skeleton className="h-8 w-24" /> : formatCurrency(stats.upsellExpected)}
            </div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-1">Upsell payments expected</p>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-br from-card via-card to-orange-500/5 shadow-sm hover:shadow-md transition-all duration-300">
          <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full blur-3xl -translate-y-8 translate-x-8" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-orange-500/5 rounded-full blur-2xl translate-y-6 -translate-x-6" />
          <div className="relative z-10 p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-500/10 ring-1 ring-orange-500/20">
                <DollarSign className="h-4 w-4 text-orange-600 dark:text-orange-500" />
              </div>
              <p className="text-[10px] font-semibold text-orange-600 dark:text-orange-500 uppercase tracking-wider">Upsell Received</p>
            </div>
            <div className="text-3xl font-extrabold text-orange-600 dark:text-orange-500" data-testid="stat-upsell-received">
              {isLoading ? <Skeleton className="h-8 w-24" /> : formatCurrency(stats.upsellReceived)}
            </div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-1">Upsell payments received</p>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-br from-card via-card to-green-500/5 shadow-sm hover:shadow-md transition-all duration-300">
          <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 rounded-full blur-3xl -translate-y-8 translate-x-8" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-green-500/5 rounded-full blur-2xl translate-y-6 -translate-x-6" />
          <div className="relative z-10 p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-500/10 ring-1 ring-green-500/20">
                <Wallet className="h-4 w-4 text-green-600 dark:text-green-500" />
              </div>
              <p className="text-[10px] font-semibold text-green-600 dark:text-green-500 uppercase tracking-wider">Total Received</p>
            </div>
            <div className="text-3xl font-extrabold text-green-600 dark:text-green-500" data-testid="stat-received-amount">
              {isLoading ? <Skeleton className="h-8 w-24" /> : formatCurrency(stats.received)}
            </div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-1">All payments received</p>
          </div>
        </div>

        <div className={`relative overflow-hidden rounded-xl border border-border/50 shadow-sm hover:shadow-md transition-all duration-300 ${stats.received >= stats.targeted ? "bg-gradient-to-br from-card via-card to-green-500/5" : "bg-gradient-to-br from-card via-card to-amber-500/5"}`}>
          <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -translate-y-8 translate-x-8 ${stats.received >= stats.targeted ? "bg-green-500/5" : "bg-amber-500/5"}`} />
          <div className={`absolute bottom-0 left-0 w-24 h-24 rounded-full blur-2xl translate-y-6 -translate-x-6 ${stats.received >= stats.targeted ? "bg-green-500/5" : "bg-amber-500/5"}`} />
          <div className="relative z-10 p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-full ring-1 ${stats.received >= stats.targeted ? "bg-green-500/10 ring-green-500/20" : "bg-amber-500/10 ring-amber-500/20"}`}>
                {stats.received >= stats.targeted ? (
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                )}
              </div>
              <p className={`text-[10px] font-semibold uppercase tracking-wider ${stats.received >= stats.targeted ? "text-green-600 dark:text-green-500" : "text-amber-600 dark:text-amber-500"}`}>Target Status</p>
            </div>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : stats.received >= stats.targeted ? (
              <div className="text-3xl font-extrabold text-green-600 dark:text-green-500" data-testid="stat-target-status">
                Achieved
              </div>
            ) : (
              <div className="text-3xl font-extrabold text-amber-600 dark:text-amber-500" data-testid="stat-target-status">
                {formatCurrency(stats.remaining)}
              </div>
            )}
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-1">
              {stats.received >= stats.targeted 
                ? `Exceeded by ${formatCurrency(stats.received - stats.targeted)}`
                : "Remaining to target"}
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Region Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Region</TableHead>
                  <TableHead className="text-right">Targeted</TableHead>
                  <TableHead className="text-right">Upsell Expected</TableHead>
                  <TableHead className="text-right">Upsell Received</TableHead>
                  <TableHead className="text-right">Total Expected</TableHead>
                  <TableHead className="text-right">Total Received</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(["CA", "TX", "AE"] as const).map((region) => (
                  <TableRow key={region}>
                    <TableCell>
                      <RegionBadge region={region} />
                    </TableCell>
                    <TableCell className="text-right font-medium" data-testid={`stat-region-targeted-${region}`}>
                      {isLoading ? <Skeleton className="h-5 w-20 ml-auto" /> : formatCurrency(regionStats[region].targeted)}
                    </TableCell>
                    <TableCell className="text-right text-blue-600 dark:text-blue-500" data-testid={`stat-region-upsell-expected-${region}`}>
                      {isLoading ? <Skeleton className="h-5 w-20 ml-auto" /> : formatCurrency(regionStats[region].upsellExpected)}
                    </TableCell>
                    <TableCell className="text-right text-green-600 dark:text-green-500" data-testid={`stat-region-upsell-received-${region}`}>
                      {isLoading ? <Skeleton className="h-5 w-20 ml-auto" /> : formatCurrency(regionStats[region].upsellReceived)}
                    </TableCell>
                    <TableCell className="text-right" data-testid={`stat-region-expected-${region}`}>
                      {isLoading ? <Skeleton className="h-5 w-20 ml-auto" /> : formatCurrency(regionStats[region].expected)}
                    </TableCell>
                    <TableCell className="text-right text-green-600 dark:text-green-500" data-testid={`stat-region-received-${region}`}>
                      {isLoading ? <Skeleton className="h-5 w-20 ml-auto" /> : formatCurrency(regionStats[region].received)}
                    </TableCell>
                    <TableCell className="text-right text-amber-600 dark:text-amber-500" data-testid={`stat-region-remaining-${region}`}>
                      {isLoading ? <Skeleton className="h-5 w-20 ml-auto" /> : formatCurrency(regionStats[region].targeted - regionStats[region].received)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-br from-card via-card to-muted/30 shadow-sm">
        <div className="absolute top-0 right-0 w-48 h-48 bg-muted/10 rounded-full blur-3xl -translate-y-12 translate-x-12" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-muted/10 rounded-full blur-2xl translate-y-8 -translate-x-8" />
        <div className="relative z-10 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted/50 ring-1 ring-border/50">
              <Filter className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Filters</p>
          </div>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            <div className="space-y-1.5">
              <Label className="text-xs">Month</Label>
              <Select value={filters.month} onValueChange={(v) => setFilters({ ...filters, month: v })}>
                <SelectTrigger data-testid="filter-month">
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {months.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Year</Label>
              <Select value={filters.year} onValueChange={(v) => setFilters({ ...filters, year: v })}>
                <SelectTrigger data-testid="filter-year">
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {[2023, 2024, 2025, 2026, 2027].map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Region</Label>
              <Select value={filters.region || "all"} onValueChange={(v) => setFilters({ ...filters, region: v === "all" ? "" : v })}>
                <SelectTrigger data-testid="filter-region">
                  <SelectValue placeholder="All regions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Regions</SelectItem>
                  {regions.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Project Manager</Label>
              <Select value={filters.pmId || "all"} onValueChange={(v) => setFilters({ ...filters, pmId: v === "all" ? "" : v })}>
                <SelectTrigger data-testid="filter-pm">
                  <SelectValue placeholder="All PMs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All PMs</SelectItem>
                  {pmUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Payment Type</Label>
              <Select value={filters.paymentType || "all"} onValueChange={(v) => setFilters({ ...filters, paymentType: v === "all" ? "" : v })}>
                <SelectTrigger data-testid="filter-type">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {paymentTypes.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={filters.status || "all"} onValueChange={(v) => setFilters({ ...filters, status: v === "all" ? "" : v })}>
                <SelectTrigger className="w-[160px]" data-testid="filter-status">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {paymentStatuses.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex items-center gap-4 mt-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search projects or clients..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="pl-9"
                data-testid="input-search"
              />
            </div>
            <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-filters">
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : filteredPayments.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">Delivery</TableHead>
                    <TableHead className="min-w-[150px]">Project</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Phase</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Expected</TableHead>
                    <TableHead className="text-right">Received</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>100%</TableHead>
                    <TableHead>Invoice Date</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Received Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.map((payment) => (
                    <TableRow
                      key={payment.id}
                      data-testid={`row-payment-${payment.id}`}
                      className={highlightId === payment.id ? "bg-primary/10 ring-2 ring-inset ring-primary transition-colors" : "transition-colors"}
                    >
                      <TableCell>
                        {payment.project && (
                          <DeliveryStatusIndicator 
                            projectId={payment.project.id} 
                            currentStatus={(payment.project as any).deliveryStatus} 
                            size="sm"
                          />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{payment.project?.name}</TableCell>
                      <TableCell>{payment.project?.clientName}</TableCell>
                      <TableCell>
                        {payment.project?.region && <RegionBadge region={payment.project.region} />}
                      </TableCell>
                      <TableCell className="capitalize">
                        <div className="flex items-center gap-2">
                          {payment.paymentType}
                          {payment.paymentType === "upsell" && (payment as any).isNewUpsell && (
                            <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-xs">New</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{payment.narration || payment.project?.phase || "-"}</TableCell>
                      <TableCell className="text-right">{formatCurrency(payment.totalAmount)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(payment.expectedAmount)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(payment.receivedAmount)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-auto p-0 gap-1"
                              disabled={updateStatusMutation.isPending}
                              data-testid={`button-status-${payment.id}`}
                            >
                              <StatusBadge status={payment.status} />
                              <ChevronDown className="h-3 w-3 text-muted-foreground" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            {paymentStatuses.map((s) => (
                              <DropdownMenuItem 
                                key={s.value}
                                onClick={() => handleStatusChange(payment, s.value)}
                                disabled={payment.status === s.value}
                                data-testid={`status-option-${s.value}-${payment.id}`}
                              >
                                <StatusBadge status={s.value} />
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
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
                      <TableCell>{formatDate(payment.invoiceDate)}</TableCell>
                      <TableCell>{formatDate(payment.dueDate)}</TableCell>
                      <TableCell>{formatDate(payment.receivedDate)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleGenerateInvoice(payment)}
                            data-testid={`button-generate-invoice-${payment.id}`}
                          >
                            <FileDown className="h-4 w-4 mr-1" />
                            Invoice
                          </Button>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              {payment.status === "received" ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => sendReceiptMutation.mutate(payment.id)}
                                  disabled={sendReceiptMutation.isPending}
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
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <tfoot className="border-t-2 bg-muted/50">
                  <tr>
                    <td colSpan={6} className="px-4 py-3 font-semibold text-sm">
                      Total ({filteredPayments.length} payments)
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-sm" data-testid="total-sum-total">
                      {formatCurrency(filteredPayments.reduce((sum, p) => sum + (parseFloat(String(p.totalAmount)) || 0), 0))}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-sm" data-testid="total-sum-expected">
                      {formatCurrency(filteredPayments.reduce((sum, p) => sum + (parseFloat(String(p.expectedAmount)) || 0), 0))}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-sm" data-testid="total-sum-received">
                      {formatCurrency(filteredPayments.reduce((sum, p) => sum + (parseFloat(String(p.receivedAmount)) || 0), 0))}
                    </td>
                    <td colSpan={6}></td>
                  </tr>
                </tfoot>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>No payments found for the selected filters.</p>
              <p className="text-sm mt-1">Payments are created through Monthly Plans. Try adjusting your filters or create a monthly plan first.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <PaymentImportModal 
        open={isImportDialogOpen} 
        onOpenChange={setIsImportDialogOpen} 
      />

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
                Expected: {formatCurrency(editingPayment?.expectedAmount || 0)}
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

      <Dialog open={isInvoiceDialogOpen} onOpenChange={setIsInvoiceDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Generate Invoice</DialogTitle>
            <DialogDescription>
              Review and customize the invoice details before downloading.
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
                  <span className="text-sm font-medium">{formatCurrency(invoicePayment?.expectedAmount || 0)}</span>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="invoice-number">Invoice Number</Label>
                    <Input
                      id="invoice-number"
                      value={invoiceDetails.invoiceNumber}
                      onChange={(e) => setInvoiceDetails(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                      data-testid="input-invoice-number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invoice-date">Invoice Date</Label>
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
              onClick={handleDownloadInvoice}
              disabled={!invoiceDetails.invoiceNumber || !invoiceDetails.invoiceDate}
              data-testid="button-download-invoice"
            >
              <FileDown className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MilestoneSyncDialog
        open={milestoneSyncData !== null}
        onOpenChange={(open) => { if (!open) setMilestoneSyncData(null); }}
        syncData={milestoneSyncData}
        paymentId={milestoneSyncPaymentId}
      />
    </div>
  );
}
