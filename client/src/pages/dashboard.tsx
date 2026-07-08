import { useMemo, useState } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { RegionBadge } from "@/components/region-badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";
import {
  Target,
  DollarSign,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Clock,
  FileText,
  Plus,
  Bell,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Activity,
  ArrowRight,
  Receipt,
  Users,
  FolderOpen,
  Award,
  BarChart3,
  Minus,
  Wallet,
  Sparkles,
  PiggyBank,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  AreaChart,
  Area,
  LineChart,
  Line,
  ComposedChart,
  PieChart,
  Pie,
  Cell,
  RadialBarChart,
  RadialBar,
} from "recharts";
import type { DashboardStats, PmLeaders } from "@shared/schema";
import { PmLeaderCards } from "@/components/pm-leader-cards";
import { formatDistanceToNow } from "date-fns";

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

const SHORT_MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthNames = SHORT_MONTHS;

interface AttentionRequired {
  overduePayments: Array<{
    id: string;
    projectName: string;
    clientName: string;
    expectedAmount: string;
    expectedDate: string;
    daysOverdue: number;
  }>;
  overdueInvoices: Array<{
    id: string;
    invoiceNumber: string;
    clientName: string;
    totalAmount: string;
    dueDate: string;
    daysOverdue: number;
  }>;
  pendingInvoices: Array<{
    id: string;
    invoiceNumber: string;
    clientName: string;
    totalAmount: string;
    createdAt: string;
  }>;
  projectsAtRisk: Array<{
    id: string;
    name: string;
    clientName: string;
    totalHours: number;
    usedHours: number;
    percentRemaining: number;
  }>;
  counts: {
    overduePayments: number;
    overdueInvoices: number;
    pendingInvoices: number;
    projectsAtRisk: number;
  };
}

interface UpcomingPayments {
  upcomingPayments: Array<{
    id: string;
    projectName: string;
    clientName: string;
    region: string;
    expectedAmount: string;
    expectedDate: string;
    paymentType: string;
    daysUntilDue: number;
  }>;
  totalExpected: number;
}

interface InvoiceSummary {
  draft: { count: number; amount: number };
  sent: { count: number; amount: number };
  paid: { count: number; amount: number };
  overdue: { count: number; amount: number };
  cancelled: { count: number; amount: number };
}

interface PMPerformanceData {
  available: boolean;
  averageEfficiency: number;
  trend: number;
  recentMonths: Array<{
    month: number;
    year: number;
    efficiency: number;
  }>;
  topParameters: Array<{ name: string; score: number; weightage: number }>;
  bottomParameters: Array<{ name: string; score: number; weightage: number }>;
  totalMonthsReviewed: number;
  latestEfficiency: number;
}

interface RecentActivity {
  activities: Array<{
    id: string;
    type: string;
    description: string;
    projectName?: string;
    userName: string;
    createdAt: string;
  }>;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

const formatCurrencyCompact = (value: number) => {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  return `$${Math.round(value)}`;
};

type Tone = "primary" | "emerald" | "amber" | "violet" | "rose" | "sky";

const TONE_STYLES: Record<Tone, { card: string; chip: string; icon: string; accent: string; spark: string; ring: string }> = {
  primary: {
    card: "bg-gradient-to-br from-primary/10 via-primary/5 to-transparent dark:from-primary/20 dark:via-primary/10",
    chip: "bg-primary/15 text-primary",
    icon: "text-primary",
    accent: "text-primary",
    spark: "hsl(var(--primary))",
    ring: "ring-primary/20",
  },
  emerald: {
    card: "bg-gradient-to-br from-emerald-500/15 via-teal-500/5 to-transparent dark:from-emerald-500/20 dark:via-teal-500/10",
    chip: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    icon: "text-emerald-600 dark:text-emerald-400",
    accent: "text-emerald-700 dark:text-emerald-400",
    spark: "#10b981",
    ring: "ring-emerald-500/20",
  },
  amber: {
    card: "bg-gradient-to-br from-amber-500/15 via-orange-500/5 to-transparent dark:from-amber-500/20 dark:via-orange-500/10",
    chip: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    icon: "text-amber-600 dark:text-amber-400",
    accent: "text-amber-700 dark:text-amber-400",
    spark: "#f59e0b",
    ring: "ring-amber-500/20",
  },
  violet: {
    card: "bg-gradient-to-br from-violet-500/15 via-fuchsia-500/5 to-transparent dark:from-violet-500/20 dark:via-fuchsia-500/10",
    chip: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
    icon: "text-violet-600 dark:text-violet-400",
    accent: "text-violet-700 dark:text-violet-400",
    spark: "#8b5cf6",
    ring: "ring-violet-500/20",
  },
  rose: {
    card: "bg-gradient-to-br from-rose-500/15 via-red-500/5 to-transparent dark:from-rose-500/20 dark:via-red-500/10",
    chip: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
    icon: "text-rose-600 dark:text-rose-400",
    accent: "text-rose-700 dark:text-rose-400",
    spark: "#f43f5e",
    ring: "ring-rose-500/20",
  },
  sky: {
    card: "bg-gradient-to-br from-sky-500/15 via-blue-500/5 to-transparent dark:from-sky-500/20 dark:via-blue-500/10",
    chip: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
    icon: "text-sky-600 dark:text-sky-400",
    accent: "text-sky-700 dark:text-sky-400",
    spark: "#0ea5e9",
    ring: "ring-sky-500/20",
  },
};

let sparklineIdCounter = 0;
function Sparkline({ data, color, testId }: { data: number[]; color: string; testId?: string }) {
  const id = useMemo(() => `spark-${++sparklineIdCounter}`, []);
  const seriesData = useMemo(() => (data ?? []).map((v, i) => ({ i, v })), [data]);
  if (!data || data.length < 2) return <div className="h-8" />;
  return (
    <div className="h-8 w-full" data-testid={testId}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={seriesData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#${id})`} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function GradientStatCard({
  label,
  value,
  subtitle,
  icon: Icon,
  tone,
  delta,
  sparkline,
  testId,
  valueTestId,
  emphasised,
}: {
  label: string;
  value: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: Tone;
  delta?: { value: number; suffix?: string } | null;
  sparkline?: number[];
  testId?: string;
  valueTestId?: string;
  emphasised?: boolean;
}) {
  const t = TONE_STYLES[tone];
  return (
    <Card
      className={`relative overflow-hidden border-card-border ${t.card} shadow-sm hover:shadow-md transition-all duration-300 ${emphasised ? `ring-2 ${t.ring}` : ""}`}
      data-testid={testId}
    >
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full blur-3xl opacity-50" style={{ background: t.spark }} />
      <CardContent className="p-5 relative">
        <div className="flex items-start justify-between gap-2">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${t.chip} backdrop-blur border border-white/30 dark:border-white/10 shadow-sm`}>
            <Icon className={`h-5 w-5 ${t.icon}`} />
          </div>
          {delta !== undefined && delta !== null && (
            <Badge
              variant="outline"
              className={`text-xs gap-1 border-transparent ${
                delta.value > 0
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                  : delta.value < 0
                  ? "bg-rose-500/15 text-rose-700 dark:text-rose-400"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {delta.value > 0 ? <TrendingUp className="h-3 w-3" /> : delta.value < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
              {delta.value > 0 ? "+" : ""}
              {Math.abs(delta.value).toFixed(0)}
              {delta.suffix ?? "%"}
            </Badge>
          )}
        </div>
        <div className="mt-4">
          <p className={`text-2xl font-bold tracking-tight ${t.accent}`} data-testid={valueTestId}>{value}</p>
          <p className="text-xs text-muted-foreground mt-1">{label}</p>
          {subtitle && <p className="text-[11px] text-muted-foreground/80 mt-0.5">{subtitle}</p>}
        </div>
        {sparkline && sparkline.length >= 2 && (
          <div className="mt-3">
            <Sparkline data={sparkline} color={t.spark} testId={testId ? `${testId}-spark` : undefined} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function buildTrendMonths(month: number, year: number, count: number) {
  const out: Array<{ month: number; year: number }> = [];
  let m = month;
  let y = year;
  for (let i = 0; i < count; i++) {
    out.unshift({ month: m, year: y });
    m -= 1;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
  }
  return out;
}

export default function Dashboard() {
  const { user } = useAuth();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const currentMonth = MONTHS.find((m) => m.value === selectedMonth)?.label || "";
  const currentYear = selectedYear;
  const currentMonthNum = selectedMonth;

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

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats", { month: currentMonthNum, year: currentYear }],
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/stats?month=${currentMonthNum}&year=${currentYear}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch dashboard stats");
      return response.json();
    },
  });

  const trendMonths = useMemo(() => buildTrendMonths(currentMonthNum, currentYear, 6), [currentMonthNum, currentYear]);
  const trendQueries = useQueries({
    queries: trendMonths.map((mo) => ({
      queryKey: ["/api/dashboard/stats", { month: mo.month, year: mo.year }] as const,
      queryFn: async () => {
        const r = await fetch(`/api/dashboard/stats?month=${mo.month}&year=${mo.year}`, { credentials: "include" });
        if (!r.ok) throw new Error("Failed to fetch dashboard stats");
        return r.json() as Promise<DashboardStats>;
      },
    })),
  });

  const trendData = useMemo(() => {
    return trendMonths.map((mo, i) => {
      const d = trendQueries[i]?.data;
      return {
        key: `${SHORT_MONTHS[mo.month]} ${String(mo.year).slice(2)}`,
        month: mo.month,
        year: mo.year,
        target: d?.totalTarget ?? 0,
        received: d?.totalReceived ?? 0,
        upsells: d?.totalUpsells ?? 0,
        remaining: Math.max(0, (d?.totalTarget ?? 0) - (d?.totalReceived ?? 0)),
        regions: d?.regionBreakdown ?? [],
        pms: d?.pmStats ?? [],
      };
    });
  }, [trendMonths, trendQueries]);

  const trendLoading = trendQueries.some((q) => q.isLoading);

  type RevenueScope = "all" | "region" | "pm";
  const [revenueScope, setRevenueScope] = useState<RevenueScope>("all");

  const { data: pmLeaders } = useQuery<PmLeaders>({
    queryKey: ["/api/dashboard/pm-leaders", { month: currentMonthNum, year: currentYear }],
    queryFn: async () => {
      const r = await fetch(`/api/dashboard/pm-leaders?month=${currentMonthNum}&year=${currentYear}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch pm leaders");
      return r.json();
    },
  });

  const { data: attentionData } = useQuery<AttentionRequired>({
    queryKey: ["/api/dashboard/attention-required"],
  });

  const { data: upcomingData } = useQuery<UpcomingPayments>({
    queryKey: ["/api/dashboard/upcoming-payments"],
  });

  const { data: invoiceSummary } = useQuery<InvoiceSummary>({
    queryKey: ["/api/dashboard/invoice-summary"],
  });

  const { data: activityData } = useQuery<RecentActivity>({
    queryKey: ["/api/dashboard/recent-activity"],
  });

  const [showPerformance, setShowPerformance] = useState(true);

  const { data: userPermissions } = useQuery<string[]>({
    queryKey: ["/api/access/my-permissions"],
    enabled: !!user,
  });

  const hasManageKpis = userPermissions?.includes("manage_kpis") ?? false;
  const isAdminUser = hasManageKpis;
  const permissionsLoaded = userPermissions !== undefined;

  const { data: performanceData } = useQuery<PMPerformanceData>({
    queryKey: ["/api/dashboard/my-performance"],
    enabled: !!user && permissionsLoaded && !isAdminUser,
  });

  const { data: teamPerformanceData } = useQuery<PMPerformanceData & { totalPmsTracked?: number }>({
    queryKey: ["/api/dashboard/team-performance"],
    enabled: !!user && permissionsLoaded && isAdminUser,
  });

  const activePerformanceData = isAdminUser ? teamPerformanceData : performanceData;
  const showPerformanceSection = isAdminUser || performanceData?.available === true;

  const totalTarget = stats?.totalTarget ?? 0;
  const totalReceived = stats?.totalReceived ?? 0;
  const totalRemaining = stats?.totalRemaining ?? Math.max(0, totalTarget - totalReceived);
  const totalUpsells = stats?.totalUpsells ?? 0;

  const progressPercent = totalTarget > 0 ? Math.min(100, (totalReceived / totalTarget) * 100) : 0;

  const overdueExposure =
    (attentionData?.overduePayments.reduce((s, p) => s + parseFloat(p.expectedAmount || "0"), 0) ?? 0) +
    (attentionData?.overdueInvoices.reduce((s, p) => s + parseFloat(p.totalAmount || "0"), 0) ?? 0);

  const totalAttentionItems = attentionData
    ? attentionData.counts.overduePayments +
      attentionData.counts.overdueInvoices +
      attentionData.counts.pendingInvoices +
      attentionData.counts.projectsAtRisk
    : 0;

  // Deltas vs previous month from trend data (last index = current month, second-to-last = previous)
  const prev = trendData[trendData.length - 2];
  const cur = trendData[trendData.length - 1];
  const pctDelta = (a: number, b: number) => {
    if (!b) return null;
    return ((a - b) / b) * 100;
  };
  const deltaTarget = prev && cur ? pctDelta(cur.target, prev.target) : null;
  const deltaReceived = prev && cur ? pctDelta(cur.received, prev.received) : null;
  const deltaRemaining = prev && cur ? pctDelta(cur.remaining, prev.remaining) : null;
  const deltaUpsells = prev && cur ? pctDelta(cur.upsells, prev.upsells) : null;

  const sparkTarget = trendData.map((t) => t.target);
  const sparkReceived = trendData.map((t) => t.received);
  const sparkRemaining = trendData.map((t) => t.remaining);
  const sparkUpsells = trendData.map((t) => t.upsells);

  // Hero pulse stats (derived only, no fake data)
  const upcomingThisWeek = upcomingData?.upcomingPayments.length ?? 0;
  const upcomingExpected = upcomingData?.totalExpected ?? 0;
  const activeRegions = stats?.regionBreakdown?.filter((r) => r.target > 0 || r.received > 0).length ?? 0;

  const regionChartData =
    stats?.regionBreakdown?.map((r) => ({
      name: r.region,
      Target: r.target,
      Received: r.received,
      Upsells: r.upsells,
    })) || [];

  // Cashflow next 7 days, stacked by paymentType
  const cashflowData = useMemo(() => {
    const days: Array<{ key: string; recurring: number; upsell: number; milestone: number; other: number }> = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      days.push({ key: i === 0 ? "Today" : SHORT_MONTHS[d.getMonth() + 1] + " " + d.getDate(), recurring: 0, upsell: 0, milestone: 0, other: 0 });
    }
    upcomingData?.upcomingPayments.forEach((p) => {
      if (p.daysUntilDue < 0 || p.daysUntilDue > 6) return;
      const amt = parseFloat(p.expectedAmount || "0");
      const bucket = days[p.daysUntilDue];
      const pt = (p.paymentType || "").toLowerCase();
      if (pt === "recurring") bucket.recurring += amt;
      else if (pt === "upsell") bucket.upsell += amt;
      else if (pt === "milestone") bucket.milestone += amt;
      else bucket.other += amt;
    });
    return days;
  }, [upcomingData]);

  // Invoice donut data
  const invoiceDonutData = useMemo(() => {
    if (!invoiceSummary) return [];
    return [
      { name: "Paid", value: invoiceSummary.paid.count, amount: invoiceSummary.paid.amount, color: "#10b981" },
      { name: "Sent", value: invoiceSummary.sent.count, amount: invoiceSummary.sent.amount, color: "#0ea5e9" },
      { name: "Draft", value: invoiceSummary.draft.count, amount: invoiceSummary.draft.amount, color: "#94a3b8" },
      { name: "Overdue", value: invoiceSummary.overdue.count, amount: invoiceSummary.overdue.amount, color: "#f43f5e" },
      { name: "Cancelled", value: invoiceSummary.cancelled.count, amount: invoiceSummary.cancelled.amount, color: "#cbd5e1" },
    ].filter((d) => d.value > 0);
  }, [invoiceSummary]);

  const totalInvoiceCount = invoiceDonutData.reduce((s, d) => s + d.value, 0);

  // Invoice aging buckets: Current (sent, not overdue) + 1-30 / 31-60 / 60+
  const agingBuckets = useMemo(() => {
    const buckets: Record<string, number> = { Current: 0, "1-30": 0, "31-60": 0, "60+": 0 };
    buckets.Current = invoiceSummary?.sent.amount ?? 0;
    attentionData?.overdueInvoices.forEach((inv) => {
      const amt = parseFloat(inv.totalAmount || "0");
      const d = inv.daysOverdue;
      if (d <= 30) buckets["1-30"] += amt;
      else if (d <= 60) buckets["31-60"] += amt;
      else buckets["60+"] += amt;
    });
    return [
      { range: "Current", amount: buckets.Current },
      { range: "1-30", amount: buckets["1-30"] },
      { range: "31-60", amount: buckets["31-60"] },
      { range: "60+", amount: buckets["60+"] },
    ];
  }, [attentionData, invoiceSummary]);

  const topRegions = useMemo(() => {
    return [...(stats?.regionBreakdown ?? [])]
      .sort((a, b) => b.received - a.received)
      .slice(0, 3);
  }, [stats]);

  const collectionGaugeData = [{ name: "received", value: progressPercent, fill: "url(#gaugeGradient)" }];

  if (statsLoading && !stats) {
    return (
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-72 rounded-2xl lg:col-span-2" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      <div className="h-1.5 w-full bg-primary" data-testid="theme-accent-bar" />
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* HERO BAND */}
        <div
          className="relative overflow-hidden rounded-2xl border border-card-border bg-gradient-to-br from-primary via-primary/85 to-primary/60 text-primary-foreground shadow-md"
          data-testid="hero-band"
        >
          <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/15 blur-3xl" />
          <div className="absolute -left-12 -bottom-16 h-56 w-56 rounded-full bg-black/20 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_55%)]" />
          <div className="relative flex flex-col gap-5 p-6 lg:p-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur px-3 py-1 text-xs font-medium border border-white/20">
                <Sparkles className="h-3.5 w-3.5" />
                Executive Overview
              </div>
              <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight" data-testid="text-welcome">
                Welcome back, {user?.firstName || "User"}
              </h1>
              <p className="text-sm lg:text-base text-primary-foreground/85">
                Here's how {currentMonth} {currentYear} is shaping up across your portfolio.
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <div className="flex items-center gap-2 rounded-full bg-white/15 backdrop-blur px-3 py-1.5 text-xs font-medium border border-white/20" data-testid="hero-chip-attention">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {totalAttentionItems} item{totalAttentionItems === 1 ? "" : "s"} need attention
                </div>
                <div className="flex items-center gap-2 rounded-full bg-white/15 backdrop-blur px-3 py-1.5 text-xs font-medium border border-white/20" data-testid="hero-chip-upcoming">
                  <Calendar className="h-3.5 w-3.5" />
                  {upcomingThisWeek} due this week · {formatCurrencyCompact(upcomingExpected)}
                </div>
                <div className="flex items-center gap-2 rounded-full bg-white/15 backdrop-blur px-3 py-1.5 text-xs font-medium border border-white/20" data-testid="hero-chip-progress">
                  <Target className="h-3.5 w-3.5" />
                  {progressPercent.toFixed(0)}% of monthly target collected
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start lg:self-auto">
              <Button
                variant="outline"
                size="icon"
                onClick={handlePrevMonth}
                className="bg-white/15 hover:bg-white/25 border-white/30 text-primary-foreground hover:text-primary-foreground"
                data-testid="button-prev-month"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
                <SelectTrigger className="w-[130px] bg-white/15 border-white/30 text-primary-foreground hover:bg-white/25" data-testid="select-month">
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
              <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
                <SelectTrigger className="w-[90px] bg-white/15 border-white/30 text-primary-foreground hover:bg-white/25" data-testid="select-year">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2023, 2024, 2025, 2026, 2027].map((y) => (
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
                className="bg-white/15 hover:bg-white/25 border-white/30 text-primary-foreground hover:text-primary-foreground"
                data-testid="button-next-month"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* KPI STRIP */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          <GradientStatCard
            label="Monthly Target"
            value={formatCurrency(totalTarget)}
            icon={Target}
            tone="primary"
            delta={deltaTarget !== null ? { value: deltaTarget } : undefined}
            sparkline={sparkTarget}
            testId="card-stat-target"
            valueTestId="text-total-target"
          />
          <GradientStatCard
            label="Total Received"
            value={formatCurrency(totalReceived)}
            subtitle={`${progressPercent.toFixed(0)}% of target`}
            icon={DollarSign}
            tone="emerald"
            delta={deltaReceived !== null ? { value: deltaReceived } : undefined}
            sparkline={sparkReceived}
            testId="card-stat-received"
            valueTestId="text-total-received"
          />
          <GradientStatCard
            label="Remaining to Collect"
            value={formatCurrency(totalRemaining)}
            icon={Wallet}
            tone="amber"
            delta={deltaRemaining !== null ? { value: deltaRemaining } : undefined}
            sparkline={sparkRemaining}
            testId="card-stat-remaining"
          />
          <GradientStatCard
            label="Upsells Received"
            value={formatCurrency(totalUpsells)}
            icon={ArrowUpRight}
            tone="violet"
            delta={deltaUpsells !== null ? { value: deltaUpsells } : undefined}
            sparkline={sparkUpsells}
            testId="card-stat-upsells"
            valueTestId="text-upsells"
          />
          <GradientStatCard
            label="Overdue Exposure"
            value={formatCurrency(overdueExposure)}
            subtitle={`${attentionData?.counts.overduePayments ?? 0} pmts · ${attentionData?.counts.overdueInvoices ?? 0} invs`}
            icon={AlertCircle}
            tone="rose"
            testId="card-stat-overdue"
            emphasised={overdueExposure > 0}
          />
          <GradientStatCard
            label="Items Need Attention"
            value={String(totalAttentionItems)}
            subtitle={`${attentionData?.counts.projectsAtRisk ?? 0} projects at risk`}
            icon={AlertTriangle}
            tone="sky"
            testId="card-stat-attention"
            emphasised={totalAttentionItems > 0}
          />
        </div>

        {/* REVENUE PERFORMANCE ROW */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2 border-card-border bg-gradient-to-br from-card via-card to-primary/5 shadow-sm" data-testid="card-revenue-trend">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <CardTitle className="text-base font-semibold">Revenue vs Target</CardTitle>
                  <CardDescription>
                    {revenueScope === "all"
                      ? "Last 6 months · target line vs received area"
                      : revenueScope === "region"
                      ? "Last 6 months · received split by region"
                      : "Last 6 months · received by top PMs"}
                  </CardDescription>
                </div>
                <div className="inline-flex rounded-lg border border-card-border bg-muted/40 p-0.5" data-testid="revenue-scope-chips">
                  {(["all", "region", "pm"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setRevenueScope(s)}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                        revenueScope === s ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                      }`}
                      data-testid={`chip-revenue-${s}`}
                    >
                      {s === "all" ? "All" : s === "region" ? "By Region" : "By PM"}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {trendLoading && trendData.every((t) => t.target === 0 && t.received === 0) ? (
                <Skeleton className="h-64 w-full rounded-lg" />
              ) : revenueScope === "all" ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="receivedAreaGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.45} />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="upsellsAreaGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                      <XAxis dataKey="key" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickFormatter={formatCurrencyCompact} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                        }}
                        formatter={(value: number) => formatCurrency(value)}
                      />
                      <Area type="monotone" dataKey="received" name="Received" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#receivedAreaGradient)" />
                      <Area type="monotone" dataKey="upsells" name="Upsells" stroke="#8b5cf6" strokeWidth={1.5} fill="url(#upsellsAreaGradient)" />
                      <Line type="monotone" dataKey="target" name="Target" stroke="hsl(var(--muted-foreground))" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : revenueScope === "region" ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={trendData.map((t) => {
                        const find = (r: string) => t.regions.find((x) => x.region === r)?.received ?? 0;
                        return { key: t.key, CA: find("CA"), TX: find("TX"), AE: find("AE") };
                      })}
                      margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                      <XAxis dataKey="key" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickFormatter={formatCurrencyCompact} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                        formatter={(value: number) => formatCurrency(value)}
                      />
                      <Line type="monotone" dataKey="CA" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="TX" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="AE" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                (() => {
                  const lastPms = trendData[trendData.length - 1]?.pms ?? [];
                  const topPms = [...lastPms].sort((a, b) => b.received - a.received).slice(0, 3);
                  const colors = ["hsl(var(--primary))", "#8b5cf6", "#0ea5e9"];
                  const pmChartData = trendData.map((t) => {
                    const row: Record<string, number | string> = { key: t.key };
                    topPms.forEach((pm) => {
                      const match = t.pms.find((p) => p.pmId === pm.pmId);
                      row[pm.pmName || "Unknown"] = match?.received ?? 0;
                    });
                    return row;
                  });
                  if (topPms.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center h-64 text-center">
                        <Users className="h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">No PM data for this period</p>
                      </div>
                    );
                  }
                  return (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={pmChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                          <XAxis dataKey="key" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickFormatter={formatCurrencyCompact} axisLine={false} tickLine={false} />
                          <Tooltip
                            contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                            formatter={(value: number) => formatCurrency(value)}
                          />
                          {topPms.map((pm, i) => (
                            <Line key={pm.pmId} type="monotone" dataKey={pm.pmName || "Unknown"} stroke={colors[i]} strokeWidth={2} dot={{ r: 3 }} />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  );
                })()
              )}
              <div className="flex items-center justify-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                {revenueScope === "all" && (
                  <>
                    <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded bg-primary" /> Received</span>
                    <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded" style={{ background: "#8b5cf6" }} /> Upsells</span>
                    <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 border-t-2 border-dashed border-muted-foreground" /> Target</span>
                  </>
                )}
                {revenueScope === "region" && (
                  <>
                    <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded bg-primary" /> CA</span>
                    <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded" style={{ background: "#8b5cf6" }} /> TX</span>
                    <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded" style={{ background: "#0ea5e9" }} /> AE</span>
                  </>
                )}
                {revenueScope === "pm" && (
                  <span>Top 3 PMs by received in {currentMonth}</span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-card-border bg-gradient-to-br from-card via-card to-emerald-500/5 shadow-sm" data-testid="card-collection-gauge">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Collection Rate</CardTitle>
              <CardDescription>{currentMonth} {currentYear}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart innerRadius="70%" outerRadius="100%" startAngle={210} endAngle={-30} data={collectionGaugeData}>
                    <defs>
                      <linearGradient id="gaugeGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="hsl(var(--primary))" />
                        <stop offset="100%" stopColor="#f59e0b" />
                      </linearGradient>
                    </defs>
                    <RadialBar dataKey="value" cornerRadius={20} background={{ fill: "hsl(var(--muted))" }} />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-3xl font-bold text-primary" data-testid="text-collection-percent">
                    {progressPercent.toFixed(0)}%
                  </p>
                  <p className="text-xs text-muted-foreground">collected</p>
                </div>
              </div>
              <div className="space-y-1.5 mt-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Top contributing regions</p>
                {topRegions.length === 0 && <p className="text-xs text-muted-foreground">No regional activity yet.</p>}
                {topRegions.map((r) => {
                  const pct = totalReceived > 0 ? (r.received / totalReceived) * 100 : 0;
                  return (
                    <div key={r.region} className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <RegionBadge region={r.region as "CA" | "TX" | "AE"} />
                        <span className="text-muted-foreground truncate">{formatCurrencyCompact(r.received)}</span>
                      </div>
                      <span className="font-semibold text-primary">{pct.toFixed(0)}%</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* CASH & INVOICE HEALTH ROW */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="border-card-border bg-gradient-to-br from-card via-card to-sky-500/5 shadow-sm" data-testid="card-cashflow">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Cashflow · Next 7 Days</CardTitle>
              <CardDescription>Expected inflows by day, by payment type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cashflowData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                    <defs>
                      <linearGradient id="recurringBar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
                      </linearGradient>
                      <linearGradient id="upsellBar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8b5cf6" />
                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.6} />
                      </linearGradient>
                      <linearGradient id="milestoneBar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0ea5e9" />
                        <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.6} />
                      </linearGradient>
                      <linearGradient id="otherBar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#94a3b8" />
                        <stop offset="100%" stopColor="#94a3b8" stopOpacity={0.6} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                    <XAxis dataKey="key" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickFormatter={formatCurrencyCompact} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Bar dataKey="recurring" stackId="a" fill="url(#recurringBar)" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="upsell" stackId="a" fill="url(#upsellBar)" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="milestone" stackId="a" fill="url(#milestoneBar)" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="other" stackId="a" fill="url(#otherBar)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded bg-primary" /> Recurring</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded" style={{ background: "#8b5cf6" }} /> Upsell</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded" style={{ background: "#0ea5e9" }} /> Milestone</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded" style={{ background: "#94a3b8" }} /> Other</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-card-border bg-gradient-to-br from-card via-card to-violet-500/5 shadow-sm" data-testid="card-invoice-donut">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Invoice Status</CardTitle>
                <Link href="/invoices">
                  <Button variant="ghost" size="sm" className="text-xs gap-1" data-testid="link-invoices-view-all">
                    View All <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
              <CardDescription>Distribution by status</CardDescription>
            </CardHeader>
            <CardContent>
              {invoiceDonutData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Receipt className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No invoices yet</p>
                </div>
              ) : (
                <>
                  <div className="relative h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={invoiceDonutData} dataKey="value" innerRadius={50} outerRadius={75} paddingAngle={3} stroke="none">
                          {invoiceDonutData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                          formatter={(value: number, _name: string, item) => {
                            const payload = (item as { payload?: { amount?: number; name?: string } } | undefined)?.payload;
                            const amount = payload?.amount ?? 0;
                            const name = payload?.name ?? "";
                            return [`${value} · ${formatCurrency(amount)}`, name];
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <p className="text-2xl font-bold">{totalInvoiceCount}</p>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">invoices</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-2">
                    {invoiceDonutData.map((d) => (
                      <div key={d.name} className="flex items-center justify-between text-xs gap-2 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: d.color }} />
                          <span className="truncate">{d.name}</span>
                        </div>
                        <span className="text-muted-foreground tabular-nums">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-card-border bg-gradient-to-br from-card via-card to-rose-500/5 shadow-sm" data-testid="card-invoice-aging">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Invoice Aging</CardTitle>
              <CardDescription>Overdue invoices by bucket</CardDescription>
            </CardHeader>
            <CardContent>
              {agingBuckets.every((b) => b.amount === 0) ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2" />
                  <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">No invoices outstanding</p>
                </div>
              ) : agingBuckets.filter((b) => b.range !== "Current").every((b) => b.amount === 0) ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2" />
                  <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">No overdue invoices</p>
                  <p className="text-xs text-muted-foreground mt-1">Receivables are healthy.</p>
                </div>
              ) : (
                <div className="space-y-3 pt-1">
                  {agingBuckets.map((b) => {
                    const max = Math.max(...agingBuckets.map((x) => x.amount), 1);
                    const w = (b.amount / max) * 100;
                    const colorMap: Record<string, string> = {
                      Current: "from-emerald-400 to-emerald-500",
                      "1-30": "from-amber-400 to-amber-500",
                      "31-60": "from-orange-400 to-orange-500",
                      "60+": "from-rose-500 to-red-600",
                    };
                    return (
                      <div key={b.range} data-testid={`aging-${b.range}`}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-medium">{b.range} days</span>
                          <span className="tabular-nums text-muted-foreground">{formatCurrency(b.amount)}</span>
                        </div>
                        <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                          <div className={`h-full bg-gradient-to-r ${colorMap[b.range]} rounded-full transition-all`} style={{ width: `${Math.max(4, w)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* REGIONAL PERFORMANCE */}
        <div className="grid gap-4">
          <Card className="border-card-border bg-gradient-to-br from-card via-card to-primary/5 shadow-sm" data-testid="card-regional">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Regional Performance</CardTitle>
              <CardDescription>Target vs Received vs Upsells per region</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={regionChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="targetBar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#cbd5e1" />
                        <stop offset="100%" stopColor="#94a3b8" />
                      </linearGradient>
                      <linearGradient id="receivedBar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
                      </linearGradient>
                      <linearGradient id="upsellsBar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8b5cf6" />
                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.6} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickFormatter={formatCurrencyCompact} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Bar dataKey="Target" fill="url(#targetBar)" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="Received" fill="url(#receivedBar)" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="Upsells" fill="url(#upsellsBar)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                {(["CA", "TX", "AE"] as const).map((region) => {
                  const regionData = stats?.regionBreakdown?.find((r) => r.region === region);
                  const target = regionData?.target || 0;
                  const received = regionData?.received || 0;
                  const progress = target > 0 ? Math.min(100, (received / target) * 100) : 0;
                  return (
                    <div key={region} className="rounded-xl border border-card-border bg-gradient-to-br from-muted/30 to-transparent p-3" data-testid={`card-region-${region.toLowerCase()}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <RegionBadge region={region} />
                          <span className="text-xs font-medium">{region === "CA" ? "California" : region === "TX" ? "Texas" : "UAE"}</span>
                        </div>
                        <span className="text-xs font-semibold text-primary">{progress.toFixed(0)}%</span>
                      </div>
                      <Progress value={progress} className="h-1.5" />
                      <div className="flex items-center justify-between mt-2 text-[11px] text-muted-foreground">
                        <span>{formatCurrencyCompact(received)}</span>
                        <span>of {formatCurrencyCompact(target)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

        </div>

        {/* PM HIGHLIGHT CARDS (existing component, kept) */}
        <PmLeaderCards leaders={pmLeaders} currentMonth={currentMonth} formatCurrency={formatCurrency} />

        {/* TEAM PERFORMANCE — UNCHANGED (verbatim) */}
        {showPerformanceSection && (
          <Card className="relative overflow-hidden border-l-4 border-l-primary" data-testid="card-pm-performance">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    <Award className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-medium">
                      {isAdminUser ? "Team Performance" : "My Performance"}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {isAdminUser ? "Aggregate KPI efficiency across all PMs" : "KPI efficiency overview"}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isAdminUser && teamPerformanceData?.available && (teamPerformanceData as any)?.totalPmsTracked && (
                    <Badge variant="secondary" className="text-xs">
                      <Users className="h-3 w-3 mr-1" />
                      {(teamPerformanceData as any).totalPmsTracked} PMs
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPerformance(!showPerformance)}
                    className="h-8 px-2 text-xs"
                    data-testid="button-toggle-performance"
                  >
                    {showPerformance ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </Button>
                </div>
              </div>
            </CardHeader>
            {showPerformance && (
              <CardContent className="pt-0">
                {!activePerformanceData?.available ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted mb-2">
                      <BarChart3 className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">No KPI reviews available yet</p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-4">
                    <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-muted/50">
                      <p className="text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wide">
                        {isAdminUser ? "Team Avg Efficiency" : "Avg Efficiency"}
                      </p>
                      <p className={`text-3xl font-bold ${
                        activePerformanceData.averageEfficiency >= 80 ? "text-green-600 dark:text-green-500" :
                        activePerformanceData.averageEfficiency >= 60 ? "text-yellow-600 dark:text-yellow-500" :
                        "text-red-600 dark:text-red-500"
                      }`} data-testid="text-avg-efficiency">
                        {activePerformanceData.averageEfficiency}%
                      </p>
                      <div className="flex items-center gap-1 mt-1">
                        {activePerformanceData.trend > 0 ? (
                          <TrendingUp className="h-3 w-3 text-green-600 dark:text-green-500" />
                        ) : activePerformanceData.trend < 0 ? (
                          <TrendingDown className="h-3 w-3 text-red-600 dark:text-red-500" />
                        ) : (
                          <Minus className="h-3 w-3 text-muted-foreground" />
                        )}
                        <span className={`text-xs font-medium ${
                          activePerformanceData.trend > 0 ? "text-green-600 dark:text-green-500" :
                          activePerformanceData.trend < 0 ? "text-red-600 dark:text-red-500" :
                          "text-muted-foreground"
                        }`}>
                          {activePerformanceData.trend > 0 ? "+" : ""}{activePerformanceData.trend}%
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {activePerformanceData.totalMonthsReviewed} months reviewed
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-muted/50">
                      <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Monthly Trend</p>
                      <div className="flex items-end gap-1 h-16">
                        {activePerformanceData.recentMonths.map((m, i) => {
                          const maxEff = Math.max(...activePerformanceData.recentMonths.map(rm => rm.efficiency), 1);
                          const height = Math.max(8, (m.efficiency / maxEff) * 100);
                          return (
                            <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                              <span className="text-[10px] font-medium">{m.efficiency}%</span>
                              <div
                                className={`w-full rounded-t transition-all ${
                                  m.efficiency >= 80 ? "bg-green-500" :
                                  m.efficiency >= 60 ? "bg-yellow-500" :
                                  "bg-red-500"
                                }`}
                                style={{ height: `${height}%`, minHeight: "4px" }}
                                data-testid={`bar-performance-${m.month}-${m.year}`}
                              />
                              <span className="text-[9px] text-muted-foreground">{monthNames[m.month]}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-muted/50">
                      <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">
                        {isAdminUser ? "Strongest Areas" : "Top Areas"}
                      </p>
                      <div className="space-y-2">
                        {activePerformanceData.topParameters.map((p, i) => {
                          const pct = p.weightage > 0 ? Math.round((p.score / p.weightage) * 100) : 0;
                          return (
                            <div key={i} className="flex items-center gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate">{p.name}</p>
                              </div>
                              <div className="flex items-center gap-1">
                                <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-green-500"
                                    style={{ width: `${Math.min(100, pct)}%` }}
                                  />
                                </div>
                                <span className="text-[10px] font-medium text-green-600 dark:text-green-500 w-8 text-right">{pct}%</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-muted/50">
                      <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Needs Improvement</p>
                      <div className="space-y-2">
                        {activePerformanceData.bottomParameters.map((p, i) => {
                          const pct = p.weightage > 0 ? Math.round((p.score / p.weightage) * 100) : 0;
                          return (
                            <div key={i} className="flex items-center gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate">{p.name}</p>
                              </div>
                              <div className="flex items-center gap-1">
                                <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      pct >= 60 ? "bg-yellow-500" : "bg-red-500"
                                    }`}
                                    style={{ width: `${Math.min(100, pct)}%` }}
                                  />
                                </div>
                                <span className={`text-[10px] font-medium w-8 text-right ${
                                  pct >= 60 ? "text-yellow-600 dark:text-yellow-500" : "text-red-600 dark:text-red-500"
                                }`}>{pct}%</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        )}

        {/* OPERATIONS ROW: Attention tabs + Quick actions */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2 border-card-border shadow-sm" data-testid="card-attention">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="text-base font-semibold">Attention Required</CardTitle>
                  <CardDescription>Triage what needs your eyes today</CardDescription>
                </div>
                {totalAttentionItems > 0 && (
                  <Badge variant="destructive" data-testid="badge-attention-count">{totalAttentionItems} items</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {totalAttentionItems === 0 && (attentionData?.counts.projectsAtRisk ?? 0) === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 mb-3">
                    <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <p className="font-medium text-emerald-700 dark:text-emerald-400">All caught up!</p>
                  <p className="text-sm text-muted-foreground mt-1">No items require immediate attention</p>
                </div>
              ) : (
                <Tabs defaultValue="payments" className="w-full">
                  <TabsList className="grid grid-cols-4 w-full">
                    <TabsTrigger value="payments" className="text-xs gap-1" data-testid="tab-attention-payments">
                      Payments
                      {(attentionData?.counts.overduePayments ?? 0) > 0 && <Badge variant="destructive" className="h-4 px-1.5 text-[10px]">{attentionData!.counts.overduePayments}</Badge>}
                    </TabsTrigger>
                    <TabsTrigger value="invoices" className="text-xs gap-1" data-testid="tab-attention-invoices">
                      Invoices
                      {(attentionData?.counts.overdueInvoices ?? 0) > 0 && <Badge variant="destructive" className="h-4 px-1.5 text-[10px]">{attentionData!.counts.overdueInvoices}</Badge>}
                    </TabsTrigger>
                    <TabsTrigger value="drafts" className="text-xs gap-1" data-testid="tab-attention-drafts">
                      Drafts
                      {(attentionData?.counts.pendingInvoices ?? 0) > 0 && <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">{attentionData!.counts.pendingInvoices}</Badge>}
                    </TabsTrigger>
                    <TabsTrigger value="projects" className="text-xs gap-1" data-testid="tab-attention-projects">
                      At Risk
                      {(attentionData?.counts.projectsAtRisk ?? 0) > 0 && <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">{attentionData!.counts.projectsAtRisk}</Badge>}
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="payments">
                    <ScrollArea className="h-[220px] pr-2">
                      <div className="space-y-2">
                        {(attentionData?.overduePayments.length ?? 0) === 0 && <p className="text-xs text-muted-foreground p-3">No overdue payments.</p>}
                        {attentionData?.overduePayments.map((p) => (
                          <Link key={p.id} href="/payments">
                            <div className="flex items-center gap-3 p-3 rounded-xl border-l-4 border-l-rose-500 bg-rose-500/5 hover-elevate cursor-pointer" data-testid={`attention-payment-${p.id}`}>
                              <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{p.projectName}</p>
                                <p className="text-xs text-muted-foreground">{p.clientName} · overdue {p.daysOverdue}d</p>
                              </div>
                              <p className="text-sm font-semibold text-rose-600 dark:text-rose-400 tabular-nums">{formatCurrency(parseFloat(p.expectedAmount))}</p>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </ScrollArea>
                  </TabsContent>
                  <TabsContent value="invoices">
                    <ScrollArea className="h-[220px] pr-2">
                      <div className="space-y-2">
                        {(attentionData?.overdueInvoices.length ?? 0) === 0 && <p className="text-xs text-muted-foreground p-3">No overdue invoices.</p>}
                        {attentionData?.overdueInvoices.map((inv) => (
                          <Link key={inv.id} href="/invoices">
                            <div className="flex items-center gap-3 p-3 rounded-xl border-l-4 border-l-orange-500 bg-orange-500/5 hover-elevate cursor-pointer" data-testid={`attention-invoice-${inv.id}`}>
                              <Receipt className="h-4 w-4 text-orange-500 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{inv.invoiceNumber}</p>
                                <p className="text-xs text-muted-foreground">{inv.clientName} · overdue {inv.daysOverdue}d</p>
                              </div>
                              <p className="text-sm font-semibold text-orange-600 dark:text-orange-400 tabular-nums">{formatCurrency(parseFloat(inv.totalAmount) || 0)}</p>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </ScrollArea>
                  </TabsContent>
                  <TabsContent value="drafts">
                    <ScrollArea className="h-[220px] pr-2">
                      <div className="space-y-2">
                        {(attentionData?.pendingInvoices.length ?? 0) === 0 && <p className="text-xs text-muted-foreground p-3">No pending drafts.</p>}
                        {attentionData?.pendingInvoices.map((inv) => (
                          <Link key={inv.id} href="/invoices">
                            <div className="flex items-center gap-3 p-3 rounded-xl border-l-4 border-l-slate-400 bg-muted/30 hover-elevate cursor-pointer" data-testid={`attention-draft-${inv.id}`}>
                              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{inv.invoiceNumber}</p>
                                <p className="text-xs text-muted-foreground">Draft ready to send · {inv.clientName}</p>
                              </div>
                              <p className="text-sm font-semibold tabular-nums">{formatCurrency(parseFloat(inv.totalAmount) || 0)}</p>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </ScrollArea>
                  </TabsContent>
                  <TabsContent value="projects">
                    <ScrollArea className="h-[220px] pr-2">
                      <div className="space-y-2">
                        {(attentionData?.projectsAtRisk.length ?? 0) === 0 && <p className="text-xs text-muted-foreground p-3">No projects at risk.</p>}
                        {attentionData?.projectsAtRisk.map((pr) => (
                          <Link key={pr.id} href={`/projects/${pr.id}`}>
                            <div className="flex items-center gap-3 p-3 rounded-xl border-l-4 border-l-amber-500 bg-amber-500/5 hover-elevate cursor-pointer" data-testid={`attention-project-${pr.id}`}>
                              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{pr.name}</p>
                                <p className="text-xs text-muted-foreground">{pr.clientName} · {pr.usedHours}/{pr.totalHours} hrs used</p>
                              </div>
                              <Badge variant="outline" className="text-xs bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">
                                {pr.percentRemaining.toFixed(0)}% left
                              </Badge>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              )}
            </CardContent>
          </Card>

          <Card className="border-card-border bg-gradient-to-br from-card via-card to-primary/5 shadow-sm" data-testid="card-quick-actions">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
              <CardDescription>Jump straight into what matters</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { href: "/payments", icon: Plus, label: "New Payment", sub: "Record cash-in", tone: "primary" as Tone, testId: "button-quick-payment" },
                  { href: "/projects", icon: FolderOpen, label: "View Projects", sub: "Open portfolio", tone: "sky" as Tone, testId: "button-quick-project" },
                  { href: "/invoices", icon: Receipt, label: "Manage Invoices", sub: "Send & track", tone: "violet" as Tone, testId: "button-quick-invoice" },
                  { href: "/admin/notifications", icon: Bell, label: "Send Reminders", sub: "Nudge clients", tone: "amber" as Tone, testId: "button-quick-reminder" },
                ].map((a) => {
                  const t = TONE_STYLES[a.tone];
                  return (
                    <Link key={a.href} href={a.href}>
                      <div className={`group rounded-xl border border-card-border ${t.card} p-3 hover-elevate cursor-pointer transition-all`} data-testid={a.testId}>
                        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${t.chip} backdrop-blur border border-white/30 dark:border-white/10 mb-2`}>
                          <a.icon className={`h-4 w-4 ${t.icon}`} />
                        </div>
                        <p className="text-sm font-semibold leading-tight">{a.label}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{a.sub}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ACTIVITY ROW: Upcoming + Recent activity */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2 border-card-border bg-gradient-to-br from-card via-card to-sky-500/5 shadow-sm" data-testid="card-upcoming">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Upcoming Payments</CardTitle>
                  <CardDescription>Expected in the next 7 days</CardDescription>
                </div>
                {upcomingData && upcomingData.upcomingPayments.length > 0 && (
                  <Badge className="bg-sky-500/15 text-sky-700 dark:text-sky-400 border-transparent">{formatCurrency(upcomingData.totalExpected)}</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!upcomingData || upcomingData.upcomingPayments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
                    <Calendar className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">No payments due in the next 7 days</p>
                </div>
              ) : (
                <ScrollArea className="h-[240px] pr-2">
                  <div className="space-y-2">
                    {upcomingData.upcomingPayments.map((p) => (
                      <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl border border-card-border bg-card hover-elevate" data-testid={`upcoming-${p.id}`}>
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-xl shrink-0 ${
                            p.daysUntilDue <= 1 ? "bg-rose-500/15" : p.daysUntilDue <= 3 ? "bg-amber-500/15" : "bg-muted"
                          }`}
                        >
                          <Clock className={`h-4 w-4 ${p.daysUntilDue <= 1 ? "text-rose-600 dark:text-rose-400" : p.daysUntilDue <= 3 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{p.projectName}</p>
                            {p.region && <RegionBadge region={p.region as "CA" | "TX" | "AE"} />}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {p.daysUntilDue === 0 ? "Due today" : p.daysUntilDue === 1 ? "Due tomorrow" : `Due in ${p.daysUntilDue} days`} · {p.clientName}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold tabular-nums">{formatCurrency(parseFloat(p.expectedAmount))}</p>
                          <p className="text-[10px] text-muted-foreground capitalize">{p.paymentType}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          <Card className="border-card-border shadow-sm" data-testid="card-activity">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </div>
              <CardDescription>What's been happening</CardDescription>
            </CardHeader>
            <CardContent>
              {!activityData || activityData.activities.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
                    <Activity className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">No recent activity</p>
                </div>
              ) : (
                <ScrollArea className="h-[240px] pr-2">
                  <div className="space-y-3">
                    {activityData.activities.slice(0, 10).map((activity) => (
                      <div key={activity.id} className="flex gap-3" data-testid={`activity-${activity.id}`}>
                        <div className="relative flex flex-col items-center">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                            <Activity className="h-3 w-3 text-primary" />
                          </div>
                          <div className="w-px flex-1 bg-border mt-1" />
                        </div>
                        <div className="flex-1 min-w-0 pb-2">
                          <p className="text-sm line-clamp-2 leading-tight">{activity.description}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[11px] text-muted-foreground">{activity.userName}</span>
                            <span className="text-[11px] text-muted-foreground">·</span>
                            <span className="text-[11px] text-muted-foreground">{formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
