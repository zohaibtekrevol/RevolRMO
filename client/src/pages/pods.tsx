import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Users2, Crown, Target, ChevronDown, ChevronRight, TrendingUp, Calendar, CalendarRange } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from "recharts";
import type { Pod, User } from "@shared/schema";

type PodPmStats = {
  pm: User;
  recurringReceived: number;
  upsellReceived: number;
  totalReceived: number;
  paymentCount: number;
};

type PodStats = {
  pod: Pod;
  lead: User | null;
  members: User[];
  period: { startMonth: number; startYear: number; endMonth: number; endYear: number };
  t1: number;
  t2: number;
  recurringReceived: number;
  upsellReceived: number;
  totalReceived: number;
  achievedT1Percent: number;
  achievedT2Percent: number;
  remainingT1: number;
  remainingT2: number;
  pmStats: PodPmStats[];
};

type QuickRange = "this_month" | "last_2" | "last_3" | "ytd" | "custom";

type PodStatsResponse = { pods: PodStats[]; totals: {
  t1: number; t2: number; recurringReceived: number; upsellReceived: number; totalReceived: number;
  achievedT1Percent: number; achievedT2Percent: number; remainingT1: number; remainingT2: number;
  period: { startMonth: number; startYear: number; endMonth: number; endYear: number };
} };

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const monthShort = monthNames.map((m) => m.slice(0, 3));

function getRangeForQuick(quick: QuickRange, now: Date): { sm: number; sy: number; em: number; ey: number } {
  const m = now.getMonth() + 1;
  const y = now.getFullYear();
  const back = (months: number) => {
    let sm = m - (months - 1), sy = y;
    while (sm <= 0) { sm += 12; sy -= 1; }
    return { sm, sy, em: m, ey: y };
  };
  switch (quick) {
    case "this_month": return { sm: m, sy: y, em: m, ey: y };
    case "last_2": return back(2);
    case "last_3": return back(3);
    case "ytd": return { sm: 1, sy: y, em: m, ey: y };
    default: return { sm: m, sy: y, em: m, ey: y };
  }
}

function enumerateMonths(sm: number, sy: number, em: number, ey: number) {
  const out: { month: number; year: number }[] = [];
  let m = sm, y = sy;
  while (y < ey || (y === ey && m <= em)) {
    out.push({ month: m, year: y });
    m += 1;
    if (m > 12) { m = 1; y += 1; }
    if (out.length > 240) break;
  }
  return out;
}

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

function fullName(u?: User | null) {
  if (!u) return "—";
  return `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email || "User";
}

function formatPeriod(p: { sm: number; sy: number; em: number; ey: number }) {
  if (p.sm === p.em && p.sy === p.ey) return `${monthNames[p.sm - 1]} ${p.sy}`;
  return `${monthNames[p.sm - 1]} ${p.sy} – ${monthNames[p.em - 1]} ${p.ey}`;
}

export default function PodsDashboardPage() {
  const now = new Date();
  const m = now.getMonth() + 1;
  const y = now.getFullYear();

  // Single-month section state
  const [singleMonth, setSingleMonth] = useState({ month: m, year: y });

  // Cumulative range section state
  const [quick, setQuick] = useState<QuickRange>("ytd");
  const [custom, setCustom] = useState(getRangeForQuick("ytd", now));
  const range = quick === "custom" ? custom : getRangeForQuick(quick, now);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-page-title">PODs</h1>
        <p className="text-sm text-muted-foreground">
          Team-level performance against T1 (baseline) and T2 (stretch) targets.
        </p>
      </div>

      <SingleMonthSection
        month={singleMonth.month}
        year={singleMonth.year}
        onChange={(month, year) => setSingleMonth({ month, year })}
      />

      <CumulativeSection
        quick={quick}
        setQuick={setQuick}
        custom={custom}
        setCustom={setCustom}
        range={range}
      />
    </div>
  );
}

function SingleMonthSection({
  month, year, onChange,
}: { month: number; year: number; onChange: (m: number, y: number) => void }) {
  const statsQuery = useQuery<PodStatsResponse>({
    queryKey: ["/api/pods/stats", "month", month, year],
    queryFn: async () => {
      const res = await fetch(`/api/pods/stats?month=${month}&year=${year}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
  });
  const totals = statsQuery.data?.totals;

  return (
    <section className="space-y-4" data-testid="section-single-month">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Selected Month</h2>
          <Badge variant="outline" data-testid="badge-single-month">{monthNames[month - 1]} {year}</Badge>
        </div>
        <div className="flex gap-2">
          <Select value={String(month)} onValueChange={(v) => onChange(parseInt(v), year)}>
            <SelectTrigger className="w-36" data-testid="select-single-month">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthNames.map((n, i) => <SelectItem key={i} value={String(i + 1)}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input
            type="number"
            className="w-24"
            min={2000}
            max={2100}
            value={year}
            onChange={(e) => onChange(month, parseInt(e.target.value) || year)}
            data-testid="input-single-year"
          />
        </div>
      </div>

      <KpiRow totals={totals} testPrefix="single" />
      <PodList query={statsQuery} testPrefix="single" />
    </section>
  );
}

function CumulativeSection({
  quick, setQuick, custom, setCustom, range,
}: {
  quick: QuickRange;
  setQuick: (q: QuickRange) => void;
  custom: { sm: number; sy: number; em: number; ey: number };
  setCustom: (r: { sm: number; sy: number; em: number; ey: number }) => void;
  range: { sm: number; sy: number; em: number; ey: number };
}) {
  const statsQuery = useQuery<PodStatsResponse>({
    queryKey: ["/api/pods/stats/range", range.sm, range.sy, range.em, range.ey],
    queryFn: async () => {
      const res = await fetch(
        `/api/pods/stats/range?startMonth=${range.sm}&startYear=${range.sy}&endMonth=${range.em}&endYear=${range.ey}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
  });
  const totals = statsQuery.data?.totals;

  // Per-month trend across the range (one query per month, lightweight).
  const months = enumerateMonths(range.sm, range.sy, range.em, range.ey);
  const trendQuery = useQuery<{ label: string; received: number; t1: number; t2: number }[]>({
    queryKey: ["/api/pods/stats/trend", range.sm, range.sy, range.em, range.ey],
    enabled: months.length > 1,
    queryFn: async () => {
      const results = await Promise.all(
        months.map(async ({ month, year }) => {
          const res = await fetch(`/api/pods/stats?month=${month}&year=${year}`, { credentials: "include" });
          if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
          const data = (await res.json()) as PodStatsResponse;
          return {
            label: `${monthShort[month - 1]} ${String(year).slice(2)}`,
            received: data.totals.totalReceived,
            t1: data.totals.t1,
            t2: data.totals.t2,
          };
        }),
      );
      return results;
    },
  });

  return (
    <section className="space-y-4" data-testid="section-cumulative">
      <div className="flex items-center gap-2">
        <CalendarRange className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Cumulative Range</h2>
        <Badge variant="outline" data-testid="badge-cumulative-period">{formatPeriod(range)}</Badge>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            {([
              ["this_month", "This Month"],
              ["last_2", "Last 2 Months"],
              ["last_3", "Last 3 Months"],
              ["ytd", "Year to Date"],
              ["custom", "Custom"],
            ] as [QuickRange, string][]).map(([key, label]) => (
              <Button
                key={key}
                variant={quick === key ? "default" : "outline"}
                size="sm"
                onClick={() => setQuick(key)}
                data-testid={`button-range-${key}`}
              >
                {label}
              </Button>
            ))}
          </div>
          {quick === "custom" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t">
              <div className="space-y-1">
                <Label className="text-xs">From month</Label>
                <Select value={String(custom.sm)} onValueChange={(v) => setCustom({ ...custom, sm: parseInt(v) })}>
                  <SelectTrigger data-testid="select-from-month"><SelectValue /></SelectTrigger>
                  <SelectContent>{monthNames.map((n, i) => <SelectItem key={i} value={String(i + 1)}>{n}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">From year</Label>
                <Input type="number" value={custom.sy}
                  onChange={(e) => setCustom({ ...custom, sy: parseInt(e.target.value) || custom.sy })}
                  data-testid="input-from-year" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">To month</Label>
                <Select value={String(custom.em)} onValueChange={(v) => setCustom({ ...custom, em: parseInt(v) })}>
                  <SelectTrigger data-testid="select-to-month"><SelectValue /></SelectTrigger>
                  <SelectContent>{monthNames.map((n, i) => <SelectItem key={i} value={String(i + 1)}>{n}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">To year</Label>
                <Input type="number" value={custom.ey}
                  onChange={(e) => setCustom({ ...custom, ey: parseInt(e.target.value) || custom.ey })}
                  data-testid="input-to-year" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <KpiRow totals={totals} testPrefix="cumulative" />

      {months.length > 1 && (
        <Card data-testid="card-trend">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Monthly trend (all PODs)</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {trendQuery.isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendQuery.data ?? []}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${Math.round(v / 1000)}k`} />
                  <Tooltip formatter={(v: any) => money(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="t1" name="T1" fill="hsl(var(--muted-foreground))" opacity={0.4} />
                  <Bar dataKey="t2" name="T2" fill="hsl(var(--muted-foreground))" opacity={0.2} />
                  <Bar dataKey="received" name="Received" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      )}

      <PodList query={statsQuery} testPrefix="cumulative" />
    </section>
  );
}

function KpiRow({
  totals, testPrefix,
}: {
  totals: PodStatsResponse["totals"] | undefined;
  testPrefix: string;
}) {
  const t1 = totals?.t1 ?? 0;
  const t2 = totals?.t2 ?? 0;
  const received = totals?.totalReceived ?? 0;
  const recurring = totals?.recurringReceived ?? 0;
  const upsell = totals?.upsellReceived ?? 0;
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <KpiCard label="T1 Total" value={money(t1)} icon={<Target className="h-4 w-4 text-muted-foreground" />} testId={`kpi-${testPrefix}-t1`} />
      <KpiCard label="T2 Total" value={money(t2)} icon={<Target className="h-4 w-4 text-muted-foreground" />} testId={`kpi-${testPrefix}-t2`} />
      <KpiCard
        label="Total Received"
        value={money(received)}
        icon={<TrendingUp className="h-4 w-4 text-emerald-500" />}
        sub={`Recurring ${money(recurring)} · Upsell ${money(upsell)}`}
        testId={`kpi-${testPrefix}-received`}
      />
      <KpiCard
        label="T1 Achievement"
        value={t1 > 0 ? `${((received / t1) * 100).toFixed(1)}%` : "—"}
        icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
        sub={t2 > 0 ? `T2: ${((received / t2) * 100).toFixed(1)}%` : undefined}
        testId={`kpi-${testPrefix}-achievement`}
      />
    </div>
  );
}

function PodList({ query, testPrefix }: { query: ReturnType<typeof useQuery<PodStatsResponse>>; testPrefix: string }) {
  if (query.isLoading) {
    return (
      <div className="grid gap-4">
        {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
      </div>
    );
  }
  if (query.isError) {
    return <Card><CardContent className="p-8 text-center text-destructive">Failed to load POD stats.</CardContent></Card>;
  }
  const data = query.data?.pods ?? [];
  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center text-muted-foreground">
          <Users2 className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p>No PODs configured yet.</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-4">
      {data.map((s) => <PodCard key={s.pod.id} stats={s} testPrefix={testPrefix} />)}
    </div>
  );
}

function KpiCard({
  label, value, sub, icon, testId,
}: { label: string; value: string; sub?: string; icon?: React.ReactNode; testId?: string }) {
  return (
    <Card data-testid={testId}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function achievementStatus(stats: PodStats): { label: string; tone: "success" | "info" | "warning" | "danger" } {
  if (stats.t2 > 0 && stats.totalReceived > stats.t2) return { label: "Over T2", tone: "success" };
  if (stats.t2 > 0 && stats.totalReceived >= stats.t2) return { label: "Hit T2", tone: "success" };
  if (stats.t1 > 0 && stats.totalReceived >= stats.t1) return { label: "Hit T1", tone: "info" };
  if (stats.t1 > 0) return { label: "Below T1", tone: "danger" };
  return { label: "No target", tone: "warning" };
}

function PodCard({ stats, testPrefix }: { stats: PodStats; testPrefix: string }) {
  const [open, setOpen] = useState(false);
  const t1Pct = Math.min(stats.achievedT1Percent, 100);
  const t2Pct = Math.min(stats.achievedT2Percent, 100);
  const colorFor = (p: number) => p >= 100 ? "bg-emerald-500" : p >= 75 ? "bg-amber-500" : "bg-rose-500";
  const status = achievementStatus(stats);
  const badgeClass =
    status.tone === "success" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" :
    status.tone === "info" ? "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30" :
    status.tone === "danger" ? "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30" :
    "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";

  return (
    <Card data-testid={`card-pod-${testPrefix}-${stats.pod.id}`}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-base" data-testid={`text-pod-name-${stats.pod.id}`}>{stats.pod.name}</CardTitle>
                <Badge variant="outline" className={badgeClass} data-testid={`badge-status-${stats.pod.id}`}>
                  {status.label}
                </Badge>
                {!stats.pod.isActive && <Badge variant="secondary">Inactive</Badge>}
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Crown className="h-3 w-3 text-amber-500" />{fullName(stats.lead)}
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Users2 className="h-3 w-3" />{stats.members.length} PM{stats.members.length === 1 ? "" : "s"}
                </span>
              </div>
              {stats.pod.description && <p className="text-xs text-muted-foreground mt-1">{stats.pod.description}</p>}
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" data-testid={`button-toggle-pod-${stats.pod.id}`}>
                {open ? <ChevronDown className="h-4 w-4 mr-1" /> : <ChevronRight className="h-4 w-4 mr-1" />}
                {open ? "Hide" : "Show"} PM breakdown
              </Button>
            </CollapsibleTrigger>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <TargetRow label="T1 (Baseline)" target={stats.t1} received={stats.totalReceived}
              percent={stats.achievedT1Percent} remaining={stats.remainingT1}
              barColor={colorFor(stats.achievedT1Percent)} progress={t1Pct}
              testId={`target-t1-${stats.pod.id}`} />
            <TargetRow label="T2 (Stretch)" target={stats.t2} received={stats.totalReceived}
              percent={stats.achievedT2Percent} remaining={stats.remainingT2}
              barColor={colorFor(stats.achievedT2Percent)} progress={t2Pct}
              testId={`target-t2-${stats.pod.id}`} />
          </div>
          <div className="grid grid-cols-3 gap-3 pt-3 border-t text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Recurring received</div>
              <div className="font-semibold" data-testid={`text-recurring-${stats.pod.id}`}>{money(stats.recurringReceived)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Upsell received</div>
              <div className="font-semibold" data-testid={`text-upsell-${stats.pod.id}`}>{money(stats.upsellReceived)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Total received</div>
              <div className="font-semibold" data-testid={`text-total-${stats.pod.id}`}>{money(stats.totalReceived)}</div>
            </div>
          </div>
          <CollapsibleContent>
            <div className="pt-3 border-t">
              {stats.pmStats.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No PMs assigned to this POD.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>PM</TableHead>
                      <TableHead className="text-right">Recurring</TableHead>
                      <TableHead className="text-right">Upsell</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Payments</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.pmStats.map((p) => (
                      <TableRow key={p.pm.id} data-testid={`row-pod-pm-${p.pm.id}`}>
                        <TableCell className="font-medium">{fullName(p.pm)}</TableCell>
                        <TableCell className="text-right">{money(p.recurringReceived)}</TableCell>
                        <TableCell className="text-right">{money(p.upsellReceived)}</TableCell>
                        <TableCell className="text-right font-semibold">{money(p.totalReceived)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{p.paymentCount}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </CollapsibleContent>
        </CardContent>
      </Collapsible>
    </Card>
  );
}

function TargetRow({
  label, target, received, percent, remaining, barColor, progress, testId,
}: {
  label: string; target: number; received: number; percent: number; remaining: number;
  barColor: string; progress: number; testId?: string;
}) {
  return (
    <div className="space-y-2" data-testid={testId}>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          {money(received)} / <span className="text-foreground font-semibold">{money(target)}</span>
        </span>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${barColor} transition-all`} style={{ width: `${progress}%` }} />
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{target > 0 ? `${percent.toFixed(1)}% achieved` : "No target set"}</span>
        <span>
          {target <= 0
            ? "—"
            : remaining > 0
              ? `${money(remaining)} remaining`
              : remaining < 0
                ? <span className="text-emerald-600 dark:text-emerald-400 font-medium">over by {money(Math.abs(remaining))}</span>
                : "Target met"}
        </span>
      </div>
    </div>
  );
}
