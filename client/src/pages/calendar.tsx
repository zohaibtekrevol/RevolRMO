import { useState, useMemo, DragEvent } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  DollarSign,
  Clock,
  FileText,
  CheckCircle,
  XCircle,
  GripVertical,
  Pencil,
  RefreshCw,
  ArrowUpRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Payment, PaymentStatus, Project } from "@shared/schema";

type CalendarViewMode = "daily" | "weekly" | "monthly";

type PaymentWithProject = Payment & { project?: Project };

const STATUS_COLORS: Record<PaymentStatus, { bg: string; text: string; label: string; dragBg: string }> = {
  pending_invoice: { bg: "bg-red-500", text: "text-white", label: "Pending Invoice", dragBg: "bg-red-400" },
  invoiced: { bg: "bg-blue-500", text: "text-white", label: "Invoiced", dragBg: "bg-blue-400" },
  received: { bg: "bg-green-500", text: "text-white", label: "Received", dragBg: "bg-green-400" },
  not_targeting: { bg: "bg-gray-400", text: "text-white", label: "Not Targeting", dragBg: "bg-gray-300" },
};

const STATUS_OPTIONS: { value: PaymentStatus; label: string }[] = [
  { value: "not_targeting", label: "Not Targeting" },
  { value: "pending_invoice", label: "Pending Invoice" },
  { value: "invoiced", label: "Invoiced" },
  { value: "received", label: "Received" },
];

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatCurrency(value: string | number | null | undefined): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (num === null || num === undefined || isNaN(num)) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(num);
}

function formatDateForInput(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  return d.toISOString().split("T")[0];
}

function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const date = new Date(year, month, 1);
  while (date.getMonth() === month) {
    days.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return days;
}

function getWeekDays(date: Date): Date[] {
  const days: Date[] = [];
  const startOfWeek = new Date(date);
  startOfWeek.setDate(date.getDate() - date.getDay());
  for (let i = 0; i < 7; i++) {
    const day = new Date(startOfWeek);
    day.setDate(startOfWeek.getDate() + i);
    days.push(day);
  }
  return days;
}

function getMonthGrid(year: number, month: number): (Date | null)[][] {
  const days = getDaysInMonth(year, month);
  const firstDayOfWeek = days[0].getDay();
  const grid: (Date | null)[][] = [];
  let week: (Date | null)[] = [];

  for (let i = 0; i < firstDayOfWeek; i++) {
    week.push(null);
  }

  for (const day of days) {
    week.push(day);
    if (week.length === 7) {
      grid.push(week);
      week = [];
    }
  }

  if (week.length > 0) {
    while (week.length < 7) {
      week.push(null);
    }
    grid.push(week);
  }

  return grid;
}

interface PaymentCardProps {
  payment: PaymentWithProject;
  compact?: boolean;
  onEdit: (payment: PaymentWithProject) => void;
  onDragStart: (e: DragEvent, payment: PaymentWithProject) => void;
}

function PaymentCard({ payment, compact = false, onEdit, onDragStart }: PaymentCardProps) {
  const status = STATUS_COLORS[payment.status];
  const projectName = payment.project?.name || "Unknown Project";
  const amount = formatCurrency(payment.expectedAmount);
  const isUpsell = payment.paymentType === "upsell";
  const typeLabel = isUpsell ? "U" : "R";
  const typeTitle = isUpsell ? "Upsell" : "Recurring";

  if (compact) {
    return (
      <div
        draggable
        onDragStart={(e) => {
          e.stopPropagation();
          onDragStart(e, payment);
        }}
        onClick={(e) => {
          e.stopPropagation();
          onEdit(payment);
        }}
        className={`${status.bg} ${status.text} text-xs px-1.5 py-0.5 rounded truncate cursor-grab active:cursor-grabbing flex items-center gap-1`}
        data-testid={`payment-card-${payment.id}`}
        title={`${projectName} - ${amount} (${status.label}) - ${typeTitle}`}
      >
        <span 
          className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${isUpsell ? "bg-blue-700 text-white" : "bg-white/30 text-white"}`}
          title={typeTitle}
        >
          {typeLabel}
        </span>
        <GripVertical className="h-3 w-3 opacity-60 flex-shrink-0" />
        <span className="truncate">{projectName}</span>
      </div>
    );
  }

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, payment)}
      onClick={() => onEdit(payment)}
      className={`${status.bg} ${status.text} p-2 rounded-md text-sm cursor-grab active:cursor-grabbing`}
      data-testid={`payment-card-${payment.id}`}
    >
      <div className="flex items-center gap-1">
        <span 
          className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${isUpsell ? "bg-blue-700 text-white" : "bg-white/30 text-white"}`}
          title={typeTitle}
        >
          {typeLabel}
        </span>
        <GripVertical className="h-4 w-4 opacity-60 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{projectName}</div>
          <div className="text-xs opacity-90">{amount}</div>
        </div>
        <Pencil className="h-3 w-3 opacity-60 flex-shrink-0" />
      </div>
    </div>
  );
}

function StatsPanel({ payments }: { payments: PaymentWithProject[] }) {
  const stats = useMemo(() => {
    const result = {
      pending_invoice: { count: 0, amount: 0 },
      invoiced: { count: 0, amount: 0 },
      received: { count: 0, amount: 0 },
      upsells: { count: 0, amount: 0 },
      total: { count: 0, amount: 0 },
    };

    for (const p of payments) {
      const expectedAmount = parseFloat(p.expectedAmount) || 0;
      const receivedAmount = parseFloat(p.receivedAmount || p.expectedAmount) || 0;
      
      // Track upsells separately
      if (p.paymentType === "upsell") {
        result.upsells.count++;
        result.upsells.amount += expectedAmount;
      }
      
      // Track by status (handle all possible statuses)
      switch (p.status) {
        case "pending_invoice":
          result.pending_invoice.count++;
          result.pending_invoice.amount += expectedAmount;
          break;
        case "invoiced":
          result.invoiced.count++;
          result.invoiced.amount += expectedAmount;
          break;
        case "received":
          result.received.count++;
          result.received.amount += receivedAmount;
          break;
        // not_targeting and any other status are counted in total only
        default:
          break;
      }
      
      // Always count in total using expected amount for consistency
      result.total.count++;
      result.total.amount += expectedAmount;
    }

    return result;
  }, [payments]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {/* Pending Invoice - Red Gradient */}
      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-card via-card to-red-500/5 p-4 shadow-sm hover:shadow-md transition-shadow">
        <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-red-500/10 blur-2xl" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <Clock className="h-4 w-4 text-red-600 dark:text-red-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Pending Invoice</p>
            <p className="font-semibold text-sm text-red-600 dark:text-red-500" data-testid="stat-pending">{formatCurrency(stats.pending_invoice.amount)}</p>
            <p className="text-xs text-muted-foreground">{stats.pending_invoice.count} payments</p>
          </div>
        </div>
      </div>

      {/* Invoiced - Blue Gradient */}
      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-card via-card to-blue-500/5 p-4 shadow-sm hover:shadow-md transition-shadow">
        <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-blue-500/10 blur-2xl" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
            <FileText className="h-4 w-4 text-blue-600 dark:text-blue-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Invoiced</p>
            <p className="font-semibold text-sm text-blue-600 dark:text-blue-500" data-testid="stat-invoiced">{formatCurrency(stats.invoiced.amount)}</p>
            <p className="text-xs text-muted-foreground">{stats.invoiced.count} payments</p>
          </div>
        </div>
      </div>

      {/* Received - Green Gradient */}
      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-card via-card to-green-500/5 p-4 shadow-sm hover:shadow-md transition-shadow">
        <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-green-500/10 blur-2xl" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Received</p>
            <p className="font-semibold text-sm text-green-600 dark:text-green-500" data-testid="stat-received">{formatCurrency(stats.received.amount)}</p>
            <p className="text-xs text-muted-foreground">{stats.received.count} payments</p>
          </div>
        </div>
      </div>

      {/* Upsells - Orange Gradient */}
      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-card via-card to-orange-500/5 p-4 shadow-sm hover:shadow-md transition-shadow">
        <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-orange-500/10 blur-2xl" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30">
            <ArrowUpRight className="h-4 w-4 text-orange-600 dark:text-orange-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Upsells</p>
            <p className="font-semibold text-sm text-orange-600 dark:text-orange-500" data-testid="stat-upsells">{formatCurrency(stats.upsells.amount)}</p>
            <p className="text-xs text-muted-foreground">{stats.upsells.count} payments</p>
          </div>
        </div>
      </div>

      {/* Total - Primary/Blood Red Gradient */}
      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-card via-card to-primary/5 p-4 shadow-sm hover:shadow-md transition-shadow">
        <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-primary/10 blur-2xl" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
            <DollarSign className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="font-semibold text-sm" data-testid="stat-total">{formatCurrency(stats.total.amount)}</p>
            <p className="text-xs text-muted-foreground">{stats.total.count} payments</p>
          </div>
        </div>
      </div>
    </div>
  );
}

interface EditPaymentDialogProps {
  payment: PaymentWithProject | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, data: { dueDate: string; expectedAmount: string; status: PaymentStatus; receivedAmount: string }) => void;
  isSaving: boolean;
}

function EditPaymentDialog({ payment, open, onOpenChange, onSave, isSaving }: EditPaymentDialogProps) {
  const [dueDate, setDueDate] = useState("");
  const [expectedAmount, setExpectedAmount] = useState("");
  const [status, setStatus] = useState<PaymentStatus>("pending_invoice");
  const [receivedAmount, setReceivedAmount] = useState("");

  useMemo(() => {
    if (payment) {
      setDueDate(formatDateForInput(payment.dueDate));
      setExpectedAmount(payment.expectedAmount || "");
      setStatus(payment.status);
      setReceivedAmount(payment.receivedAmount || "");
    }
  }, [payment]);

  const handleSave = () => {
    if (payment) {
      onSave(payment.id, { dueDate, expectedAmount, status, receivedAmount });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Payment</DialogTitle>
        </DialogHeader>
        {payment && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Project</Label>
              <p className="text-sm text-muted-foreground">{payment.project?.name || "Unknown"}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="due-date">Due Date</Label>
              <Input
                id="due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                data-testid="input-due-date"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Expected Amount</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={expectedAmount}
                onChange={(e) => setExpectedAmount(e.target.value)}
                data-testid="input-amount"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as PaymentStatus)}>
                <SelectTrigger data-testid="select-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded ${STATUS_COLORS[opt.value].bg}`} />
                        {opt.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {status === "received" && (
              <div className="space-y-2">
                <Label htmlFor="received-amount">Received Amount</Label>
                <Input
                  id="received-amount"
                  type="number"
                  step="0.01"
                  value={receivedAmount}
                  onChange={(e) => setReceivedAmount(e.target.value)}
                  placeholder="Enter the actual amount received"
                  data-testid="input-received-amount"
                />
                <p className="text-xs text-muted-foreground">
                  Enter the actual payment amount received
                </p>
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving} data-testid="button-save-payment">
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface MonthViewProps {
  year: number;
  month: number;
  payments: PaymentWithProject[];
  getPaymentsForDate: (date: Date) => PaymentWithProject[];
  onEditPayment: (payment: PaymentWithProject) => void;
  onDragStart: (e: DragEvent, payment: PaymentWithProject) => void;
  onDrop: (date: Date) => void;
  draggedPayment: PaymentWithProject | null;
  onShowAllPayments: (date: Date, payments: PaymentWithProject[]) => void;
}

function MonthView({ 
  year, 
  month, 
  payments, 
  getPaymentsForDate,
  onEditPayment,
  onDragStart,
  onDrop,
  draggedPayment,
  onShowAllPayments,
}: MonthViewProps) {
  const grid = getMonthGrid(year, month);
  const today = new Date();

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: DragEvent, date: Date) => {
    e.preventDefault();
    onDrop(date);
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="grid grid-cols-7 bg-muted/50">
        {weekDays.map((day) => (
          <div key={day} className="p-2 text-center text-sm font-medium border-b">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {grid.flat().map((date, idx) => {
          const isToday = date && date.toDateString() === today.toDateString();
          const dayPayments = date ? getPaymentsForDate(date) : [];
          const isDropTarget = draggedPayment !== null && date !== null;

          return (
            <div
              key={idx}
              onDragOver={date ? handleDragOver : undefined}
              onDrop={date ? (e) => handleDrop(e, date) : undefined}
              className={`min-h-[100px] border-b border-r p-1 transition-colors ${
                date ? "bg-background" : "bg-muted/20"
              } ${isToday ? "ring-2 ring-primary ring-inset" : ""} ${
                isDropTarget ? "hover:bg-muted/40" : ""
              }`}
              data-testid={date ? `calendar-day-${date.getDate()}` : undefined}
            >
              {date && (
                <>
                  <div className={`text-sm font-medium mb-1 ${isToday ? "text-primary" : ""}`}>
                    {date.getDate()}
                  </div>
                  <div className="space-y-0.5">
                    {dayPayments.slice(0, 3).map((p) => (
                      <PaymentCard 
                        key={p.id} 
                        payment={p} 
                        compact 
                        onEdit={onEditPayment}
                        onDragStart={onDragStart}
                      />
                    ))}
                    {dayPayments.length > 3 && (
                      <button
                        onClick={() => onShowAllPayments(date, dayPayments)}
                        className="text-xs text-primary hover:underline cursor-pointer w-full text-left"
                        data-testid={`show-more-${date.getDate()}`}
                      >
                        +{dayPayments.length - 3} more
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface WeekViewProps {
  currentDate: Date;
  getPaymentsForDate: (date: Date) => PaymentWithProject[];
  onEditPayment: (payment: PaymentWithProject) => void;
  onDragStart: (e: DragEvent, payment: PaymentWithProject) => void;
  onDrop: (date: Date) => void;
  draggedPayment: PaymentWithProject | null;
}

function WeekView({ 
  currentDate,
  getPaymentsForDate,
  onEditPayment,
  onDragStart,
  onDrop,
  draggedPayment,
}: WeekViewProps) {
  const weekDates = getWeekDays(currentDate);
  const today = new Date();

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: DragEvent, date: Date) => {
    e.preventDefault();
    onDrop(date);
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="grid grid-cols-7 bg-muted/50">
        {weekDates.map((date, idx) => {
          const isToday = date.toDateString() === today.toDateString();
          return (
            <div key={idx} className="p-2 text-center border-b">
              <div className="text-sm font-medium">{weekDays[idx]}</div>
              <div className={`text-lg font-bold ${isToday ? "text-primary" : ""}`}>
                {date.getDate()}
              </div>
              <div className="text-xs text-muted-foreground">
                {months[date.getMonth()].slice(0, 3)}
              </div>
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-7 min-h-[400px]">
        {weekDates.map((date, idx) => {
          const dayPayments = getPaymentsForDate(date);
          const isToday = date.toDateString() === today.toDateString();
          const isDropTarget = draggedPayment !== null;

          return (
            <div
              key={idx}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, date)}
              className={`border-r p-2 transition-colors ${isToday ? "bg-primary/5" : ""} ${
                isDropTarget ? "hover:bg-muted/40" : ""
              }`}
              data-testid={`week-day-${idx}`}
            >
              <ScrollArea className="h-[350px]">
                <div className="space-y-2">
                  {dayPayments.map((p) => (
                    <PaymentCard 
                      key={p.id} 
                      payment={p} 
                      onEdit={onEditPayment}
                      onDragStart={onDragStart}
                    />
                  ))}
                  {dayPayments.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      No payments
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface DayViewProps {
  currentDate: Date;
  getPaymentsForDate: (date: Date) => PaymentWithProject[];
  onEditPayment: (payment: PaymentWithProject) => void;
  onDragStart: (e: DragEvent, payment: PaymentWithProject) => void;
  onDrop: (date: Date) => void;
  draggedPayment: PaymentWithProject | null;
}

function DayView({ 
  currentDate,
  getPaymentsForDate,
  onEditPayment,
  onDragStart,
  onDrop,
  draggedPayment,
}: DayViewProps) {
  const dayPayments = getPaymentsForDate(currentDate);
  const today = new Date();
  const isToday = currentDate.toDateString() === today.toDateString();

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    onDrop(currentDate);
  };

  return (
    <Card
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={draggedPayment ? "ring-2 ring-dashed ring-primary/50" : ""}
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5" />
          <span>
            {weekDays[currentDate.getDay()]}, {months[currentDate.getMonth()]} {currentDate.getDate()}, {currentDate.getFullYear()}
          </span>
          {isToday && <Badge variant="default">Today</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {dayPayments.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <CalendarIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No payments scheduled for this day</p>
            <p className="text-sm mt-1">Drag payments here to reschedule</p>
          </div>
        ) : (
          <div className="space-y-3">
            {dayPayments.map((p) => {
              const status = STATUS_COLORS[p.status];
              return (
                <div
                  key={p.id}
                  draggable
                  onDragStart={(e) => onDragStart(e, p)}
                  onClick={() => onEditPayment(p)}
                  className="flex items-center gap-4 p-4 rounded-lg border cursor-grab active:cursor-grabbing hover:bg-muted/50 transition-colors"
                  data-testid={`day-payment-${p.id}`}
                >
                  <GripVertical className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <div className={`w-1 h-12 rounded-full ${status.bg}`} />
                  <div className="flex-1">
                    <div className="font-medium">{p.project?.name || "Unknown Project"}</div>
                    <div className="text-sm text-muted-foreground">
                      {p.project?.clientName}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{formatCurrency(p.expectedAmount)}</div>
                    <Badge className={`${status.bg} ${status.text}`}>
                      {status.label}
                    </Badge>
                  </div>
                  <Pencil className="h-4 w-4 text-muted-foreground" />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function CalendarView() {
  const { toast } = useToast();
  const today = new Date();
  const [view, setView] = useState<CalendarViewMode>("monthly");
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const [currentDate, setCurrentDate] = useState(today);
  const [editingPayment, setEditingPayment] = useState<PaymentWithProject | null>(null);
  const [draggedPayment, setDraggedPayment] = useState<PaymentWithProject | null>(null);
  const [allPaymentsDialog, setAllPaymentsDialog] = useState<{ date: Date; payments: PaymentWithProject[] } | null>(null);

  const { data: payments, isLoading, refetch } = useQuery<PaymentWithProject[]>({
    queryKey: ["/api/payments"],
  });

  const updatePaymentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      return apiRequest("PATCH", `/api/payments/${id}`, data);
    },
    onSuccess: async () => {
      // Invalidate all payment-related queries across the app (Calendar, Payments, Dashboard, etc.)
      await queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      // Also invalidate dashboard stats and projects which may show payment-related data
      await queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Payment updated successfully" });
      setEditingPayment(null);
    },
    onError: () => {
      toast({ title: "Failed to update payment", variant: "destructive" });
    },
  });

  const handleRefresh = () => {
    refetch();
    toast({ title: "Calendar refreshed" });
  };

  // Filter payments to only show: targeted recurring, received, or upsells
  const filterPaymentsForCalendar = (paymentList: PaymentWithProject[]): PaymentWithProject[] => {
    return paymentList.filter(p => {
      // Show all upsells
      if (p.paymentType === "upsell") return true;
      // Show all received payments (regardless of isTarget)
      if (p.status === "received") return true;
      // Show recurring payments only if they are targeted
      if (p.paymentType === "recurring" && p.isTarget) return true;
      return false;
    });
  };

  const monthPayments = useMemo(() => {
    if (!payments) return [];
    const filtered = payments.filter(p => p.month === selectedMonth + 1 && p.year === selectedYear);
    return filterPaymentsForCalendar(filtered);
  }, [payments, selectedMonth, selectedYear]);

  const getPaymentsForDate = (date: Date): PaymentWithProject[] => {
    if (!payments) return [];
    const datePayments = payments.filter(p => {
      if (!p.dueDate) return false;
      const dueDate = new Date(p.dueDate);
      return dueDate.toDateString() === date.toDateString();
    });
    return filterPaymentsForCalendar(datePayments);
  };

  const handleEditPayment = (payment: PaymentWithProject) => {
    setEditingPayment(payment);
  };

  const handleSavePayment = (id: string, data: { dueDate: string; expectedAmount: string; status: PaymentStatus; receivedAmount: string }) => {
    // When status is "received", use receivedAmount if provided, otherwise default to expectedAmount
    let finalReceivedAmount: string | null = null;
    let receivedDate: string | null = null;
    
    if (data.status === "received") {
      finalReceivedAmount = data.receivedAmount && data.receivedAmount.trim() !== "" 
        ? data.receivedAmount 
        : data.expectedAmount; // Default to expected amount if not provided
      receivedDate = new Date().toISOString(); // Set received date to now
    }
    
    updatePaymentMutation.mutate({
      id,
      data: {
        dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : null,
        expectedAmount: data.expectedAmount,
        status: data.status,
        receivedAmount: finalReceivedAmount,
        receivedDate: receivedDate,
      },
    });
  };

  const handleDragStart = (e: DragEvent, payment: PaymentWithProject) => {
    setDraggedPayment(payment);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(payment.id));
  };

  const handleDrop = (date: Date) => {
    if (draggedPayment) {
      updatePaymentMutation.mutate({
        id: draggedPayment.id,
        data: {
          dueDate: date.toISOString(),
        },
      });
      setDraggedPayment(null);
    }
  };

  const handleShowAllPayments = (date: Date, payments: PaymentWithProject[]) => {
    setAllPaymentsDialog({ date, payments });
  };

  const goToPrevious = () => {
    if (view === "monthly") {
      if (selectedMonth === 0) {
        setSelectedMonth(11);
        setSelectedYear(selectedYear - 1);
      } else {
        setSelectedMonth(selectedMonth - 1);
      }
    } else if (view === "weekly") {
      const newDate = new Date(currentDate);
      newDate.setDate(newDate.getDate() - 7);
      setCurrentDate(newDate);
      setSelectedMonth(newDate.getMonth());
      setSelectedYear(newDate.getFullYear());
    } else {
      const newDate = new Date(currentDate);
      newDate.setDate(newDate.getDate() - 1);
      setCurrentDate(newDate);
      setSelectedMonth(newDate.getMonth());
      setSelectedYear(newDate.getFullYear());
    }
  };

  const goToNext = () => {
    if (view === "monthly") {
      if (selectedMonth === 11) {
        setSelectedMonth(0);
        setSelectedYear(selectedYear + 1);
      } else {
        setSelectedMonth(selectedMonth + 1);
      }
    } else if (view === "weekly") {
      const newDate = new Date(currentDate);
      newDate.setDate(newDate.getDate() + 7);
      setCurrentDate(newDate);
      setSelectedMonth(newDate.getMonth());
      setSelectedYear(newDate.getFullYear());
    } else {
      const newDate = new Date(currentDate);
      newDate.setDate(newDate.getDate() + 1);
      setCurrentDate(newDate);
      setSelectedMonth(newDate.getMonth());
      setSelectedYear(newDate.getFullYear());
    }
  };

  const goToToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedMonth(now.getMonth());
    setSelectedYear(now.getFullYear());
  };

  const getNavigationLabel = () => {
    if (view === "monthly") {
      return `${months[selectedMonth]} ${selectedYear}`;
    } else if (view === "weekly") {
      const weekDates = getWeekDays(currentDate);
      const start = weekDates[0];
      const end = weekDates[6];
      if (start.getMonth() === end.getMonth()) {
        return `${months[start.getMonth()]} ${start.getDate()} - ${end.getDate()}, ${start.getFullYear()}`;
      }
      return `${months[start.getMonth()].slice(0, 3)} ${start.getDate()} - ${months[end.getMonth()].slice(0, 3)} ${end.getDate()}, ${start.getFullYear()}`;
    } else {
      return `${months[currentDate.getMonth()]} ${currentDate.getDate()}, ${currentDate.getFullYear()}`;
    }
  };

  const years = [2023, 2024, 2025, 2026];

  return (
    <div className="space-y-6">
      <StatsPanel payments={monthPayments} />

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={goToPrevious}
                data-testid="button-prev"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={goToNext}
                data-testid="button-next"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                onClick={goToToday}
                data-testid="button-today"
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleRefresh}
                data-testid="button-refresh"
                title="Refresh calendar"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <h2 className="text-lg font-semibold ml-2" data-testid="calendar-nav-label">
                {getNavigationLabel()}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <Select
                value={String(selectedMonth)}
                onValueChange={(v) => setSelectedMonth(parseInt(v))}
              >
                <SelectTrigger className="w-[130px]" data-testid="select-month">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((m, idx) => (
                    <SelectItem key={idx} value={String(idx)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={String(selectedYear)}
                onValueChange={(v) => setSelectedYear(parseInt(v))}
              >
                <SelectTrigger className="w-[100px]" data-testid="select-year">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs value={view} onValueChange={(v) => setView(v as CalendarViewMode)}>
            <TabsList className="mb-4">
              <TabsTrigger value="daily" data-testid="tab-daily">Day</TabsTrigger>
              <TabsTrigger value="weekly" data-testid="tab-weekly">Week</TabsTrigger>
              <TabsTrigger value="monthly" data-testid="tab-monthly">Month</TabsTrigger>
            </TabsList>

            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-[400px] w-full" />
              </div>
            ) : (
              <>
                <TabsContent value="monthly">
                  <MonthView
                    year={selectedYear}
                    month={selectedMonth}
                    payments={monthPayments}
                    getPaymentsForDate={getPaymentsForDate}
                    onEditPayment={handleEditPayment}
                    onDragStart={handleDragStart}
                    onDrop={handleDrop}
                    draggedPayment={draggedPayment}
                    onShowAllPayments={handleShowAllPayments}
                  />
                </TabsContent>

                <TabsContent value="weekly">
                  <WeekView
                    currentDate={currentDate}
                    getPaymentsForDate={getPaymentsForDate}
                    onEditPayment={handleEditPayment}
                    onDragStart={handleDragStart}
                    onDrop={handleDrop}
                    draggedPayment={draggedPayment}
                  />
                </TabsContent>

                <TabsContent value="daily">
                  <DayView
                    currentDate={currentDate}
                    getPaymentsForDate={getPaymentsForDate}
                    onEditPayment={handleEditPayment}
                    onDragStart={handleDragStart}
                    onDrop={handleDrop}
                    draggedPayment={draggedPayment}
                  />
                </TabsContent>
              </>
            )}
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Legend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {Object.entries(STATUS_COLORS).map(([status, colors]) => (
              <div key={status} className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded ${colors.bg}`} />
                <span className="text-sm">{colors.label}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Tip: Drag payments to move them to a different date, or click to edit details
          </p>
        </CardContent>
      </Card>

      <EditPaymentDialog
        payment={editingPayment}
        open={editingPayment !== null}
        onOpenChange={(open) => !open && setEditingPayment(null)}
        onSave={handleSavePayment}
        isSaving={updatePaymentMutation.isPending}
      />

      <Dialog open={allPaymentsDialog !== null} onOpenChange={(open) => !open && setAllPaymentsDialog(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {allPaymentsDialog && (
                <>All Payments - {months[allPaymentsDialog.date.getMonth()]} {allPaymentsDialog.date.getDate()}</>
              )}
            </DialogTitle>
          </DialogHeader>
          {allPaymentsDialog && (
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-2 pr-4">
                {allPaymentsDialog.payments.map((p) => {
                  const status = STATUS_COLORS[p.status];
                  return (
                    <div
                      key={p.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, p)}
                      onClick={() => {
                        setAllPaymentsDialog(null);
                        handleEditPayment(p);
                      }}
                      className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50"
                      data-testid={`all-payments-item-${p.id}`}
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className={`w-1 h-10 rounded-full ${status.bg}`} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{p.project?.name || "Unknown"}</div>
                        <div className="text-xs text-muted-foreground">{p.project?.clientName}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-sm">{formatCurrency(p.expectedAmount)}</div>
                        <Badge className={`${status.bg} ${status.text} text-xs`}>
                          {status.label}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAllPaymentsDialog(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default CalendarView;
