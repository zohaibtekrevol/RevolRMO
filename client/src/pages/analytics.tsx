import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
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
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";
import { TrendingUp, TrendingDown, Users, DollarSign, Target, BarChart3, Trophy, Crown, Zap } from "lucide-react";
import { Tooltip as UITooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { AnalyticsData } from "@shared/schema";

export default function Analytics() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  
  const { data: analytics, isLoading } = useQuery<AnalyticsData>({
    queryKey: ["/api/analytics", { year: selectedYear }],
    queryFn: async () => {
      const response = await fetch(`/api/analytics?year=${selectedYear}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch analytics");
      return response.json();
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatCompact = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}k`;
    }
    return `$${value}`;
  };

  const statusColors: Record<string, string> = {
    not_targeting: "hsl(var(--muted))",
    pending_invoice: "#f59e0b",
    invoiced: "#3b82f6",
    received: "#22c55e",
  };

  const statusLabels: Record<string, string> = {
    not_targeting: "Not Targeting",
    pending_invoice: "Pending Invoice",
    invoiced: "Invoiced",
    received: "Received",
  };

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div className="space-y-1">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  const yoyGrowth = analytics?.yearOverYear?.growthPercent || 0;
  const isPositiveGrowth = yoyGrowth >= 0;

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight" data-testid="text-analytics-title">
            Advanced Analytics
          </h1>
          <p className="text-muted-foreground">
            Payment trends, performance metrics, and insights
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Year:</span>
          <Select
            value={String(selectedYear)}
            onValueChange={(v) => setSelectedYear(Number(v))}
          >
            <SelectTrigger className="w-[100px]" data-testid="select-analytics-year">
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
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Year to Date
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold" data-testid="text-ytd-total">
              {formatCurrency(analytics?.yearOverYear?.currentYearTotal || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {analytics?.yearOverYear?.currentYear} total received
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              {isPositiveGrowth ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
              Year over Year
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div 
              className={`text-2xl font-semibold ${isPositiveGrowth ? "text-green-500" : "text-red-500"}`}
              data-testid="text-yoy-growth"
            >
              {isPositiveGrowth ? "+" : ""}{yoyGrowth}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              vs. {analytics?.yearOverYear?.previousYear} ({formatCurrency(analytics?.yearOverYear?.previousYearTotal || 0)})
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Active PMs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold" data-testid="text-active-pms">
              {analytics?.pmPerformance?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Project managers with payments
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Payment Trends (12 Months)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart 
                  data={analytics?.paymentTrends || []} 
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorReceived" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorTarget" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="monthLabel" 
                    className="text-xs" 
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} 
                  />
                  <YAxis 
                    className="text-xs" 
                    tick={{ fill: "hsl(var(--muted-foreground))" }} 
                    tickFormatter={(v) => formatCompact(v)} 
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)"
                    }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="target" 
                    stroke="hsl(var(--muted-foreground))" 
                    fillOpacity={1} 
                    fill="url(#colorTarget)" 
                    name="Target"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="received" 
                    stroke="hsl(var(--chart-1))" 
                    fillOpacity={1} 
                    fill="url(#colorReceived)" 
                    name="Received"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium">Region Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart 
                  data={analytics?.regionTrends || []} 
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="monthLabel" 
                    className="text-xs" 
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} 
                  />
                  <YAxis 
                    className="text-xs" 
                    tick={{ fill: "hsl(var(--muted-foreground))" }} 
                    tickFormatter={(v) => formatCompact(v)} 
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)"
                    }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="CA" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="TX" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="AE" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium">Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics?.statusDistribution?.filter(s => s.count > 0) || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="amount"
                    nameKey="status"
                    label={({ status }) => statusLabels[status] || status}
                    labelLine={false}
                  >
                    {analytics?.statusDistribution?.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={statusColors[entry.status] || "hsl(var(--muted))"} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)"
                    }}
                    formatter={(value: number, name: string) => [formatCurrency(value), statusLabels[name] || name]}
                  />
                  <Legend formatter={(value) => statusLabels[value] || value} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium">PM Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={analytics?.pmPerformance?.slice(0, 5) || []} 
                  layout="vertical"
                  margin={{ top: 10, right: 10, left: 60, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    type="number" 
                    tick={{ fill: "hsl(var(--muted-foreground))" }} 
                    tickFormatter={(v) => formatCompact(v)} 
                  />
                  <YAxis 
                    dataKey="pmName" 
                    type="category" 
                    width={55}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} 
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)"
                    }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Legend />
                  <Bar dataKey="target" fill="hsl(var(--muted))" name="Target" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="received" fill="#22c55e" name="Received" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <Target className="h-5 w-5" />
            PM Performance Details
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {analytics?.pmPerformance && analytics.pmPerformance.length > 0 ? (
            (() => {
              const pmData = analytics.pmPerformance;
              const topPerformerId = pmData.reduce((best, pm) => 
                pm.progressPercent > (best?.progressPercent || 0) ? pm : best, pmData[0])?.pmId;
              const highestValueId = pmData.reduce((best, pm) => 
                pm.received > (best?.received || 0) ? pm : best, pmData[0])?.pmId;
              const upsellKingId = pmData.reduce((best, pm) => 
                pm.upsells > (best?.upsells || 0) ? pm : best, pmData[0])?.pmId;
              
              return (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project Manager</TableHead>
                      <TableHead className="text-center">Awards</TableHead>
                      <TableHead className="text-right">Target</TableHead>
                      <TableHead className="text-right">Received</TableHead>
                      <TableHead className="text-right">Upsells</TableHead>
                      <TableHead className="text-right">Payments</TableHead>
                      <TableHead className="text-right">Avg. Size</TableHead>
                      <TableHead className="text-right">Progress</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pmData.map((pm) => {
                      const awards: { icon: typeof Trophy; label: string; color: string; bgColor: string; chipBg: string; chipBorder: string }[] = [];
                      if (pm.pmId === topPerformerId && pm.progressPercent > 0) {
                        awards.push({ icon: Trophy, label: "Top Performer", color: "text-amber-600 dark:text-amber-400", bgColor: "bg-amber-50 dark:bg-amber-950/30", chipBg: "bg-amber-100 dark:bg-amber-900/50", chipBorder: "border-amber-300 dark:border-amber-700" });
                      }
                      if (pm.pmId === highestValueId && pm.received > 0) {
                        awards.push({ icon: Crown, label: "Highest Value", color: "text-violet-600 dark:text-violet-400", bgColor: "bg-violet-50 dark:bg-violet-950/30", chipBg: "bg-violet-100 dark:bg-violet-900/50", chipBorder: "border-violet-300 dark:border-violet-700" });
                      }
                      if (pm.pmId === upsellKingId && pm.upsells > 0) {
                        awards.push({ icon: Zap, label: "Upsell Pro", color: "text-orange-600 dark:text-orange-400", bgColor: "bg-orange-50 dark:bg-orange-950/30", chipBg: "bg-orange-100 dark:bg-orange-900/50", chipBorder: "border-orange-300 dark:border-orange-700" });
                      }
                      
                      const rowBgClass = awards.length > 0 ? awards[0].bgColor : "";
                      
                      return (
                        <TableRow key={pm.pmId} data-testid={`row-analytics-pm-${pm.pmId}`} className={rowBgClass}>
                          <TableCell className="font-medium">{pm.pmName}</TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-1 flex-wrap">
                              {awards.map((award, idx) => (
                                <Badge 
                                  key={idx} 
                                  variant="outline" 
                                  className={`${award.chipBg} ${award.color} ${award.chipBorder} text-xs`}
                                >
                                  <award.icon className="h-3 w-3 mr-1" />
                                  {award.label}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(pm.target)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(pm.received)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(pm.upsells)}</TableCell>
                          <TableCell className="text-right">{pm.paymentCount}</TableCell>
                          <TableCell className="text-right">{formatCurrency(pm.avgPaymentSize)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Progress value={Math.min(100, pm.progressPercent)} className="w-16" />
                              <span className="text-xs text-muted-foreground w-10 text-right">
                                {pm.progressPercent}%
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              );
            })()
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No PM performance data available.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
