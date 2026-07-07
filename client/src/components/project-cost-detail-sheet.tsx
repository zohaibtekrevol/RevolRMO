import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  ReferenceLine,
  Area,
  ComposedChart,
} from "recharts";
import { DollarSign, Clock, TrendingUp, TrendingDown, Calendar, ArrowRight, Users, ChevronLeft, ChevronRight, Filter } from "lucide-react";

interface ProjectCostDetailSheetProps {
  projectId: string | null;
  projectName: string;
  onClose: () => void;
}

interface TimesheetEntry {
  id: string;
  date: string;
  hoursLogged: number;
  hourlyCostRate: number;
  cost: number;
  description: string | null;
  userId: string;
  userName: string;
}

interface MonthlyHistoryEntry {
  year: number;
  month: number;
  monthLabel: string;
  revenue: number;
  humanCost: number;
  vendorCost: number;
  toolCost: number;
  totalCost: number;
  margin: number;
  bucket: "profit" | "breakeven" | "loss";
  timesheetCount: number;
}

interface StatusChange {
  date: string;
  fromBucket: string;
  toBucket: string;
  margin: number;
}

interface ProjectCostHistoryData {
  project: {
    id: string;
    name: string;
    region: string;
  };
  stats: {
    totalRevenue: number;
    totalCost: number;
    overallMargin: number;
    totalHours: number;
    timesheetCount: number;
    monthsActive: number;
  };
  monthlyHistory: MonthlyHistoryEntry[];
  statusChanges: StatusChange[];
  timesheets: TimesheetEntry[];
  thresholds: {
    profitThreshold: number;
    breakevenThreshold: number;
  };
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatPercent = (value: number) => {
  return `${value.toFixed(1)}%`;
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const BucketBadge = ({ bucket }: { bucket: string }) => {
  const config: Record<string, { label: string; className: string }> = {
    profit: { label: "Profit", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
    breakeven: { label: "Breakeven", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" },
    loss: { label: "Loss", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
  };
  const c = config[bucket] || config.loss;
  return <Badge className={c.className}>{c.label}</Badge>;
};

export function ProjectCostDetailSheet({ projectId, projectName, onClose }: ProjectCostDetailSheetProps) {
  const [resourceFilter, setResourceFilter] = useState<string>("all");
  const [timesheetPage, setTimesheetPage] = useState(0);
  const pageSize = 10;

  const handleResourceFilterChange = (value: string) => {
    setResourceFilter(value);
    setTimesheetPage(0);
  };

  const { data, isLoading } = useQuery<ProjectCostHistoryData>({
    queryKey: ["/api/cost-margin/project", projectId, "history", resourceFilter !== "all" ? resourceFilter : undefined],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (resourceFilter && resourceFilter !== "all") {
        params.set("resourceId", resourceFilter);
      }
      const res = await fetch(`/api/cost-margin/project/${projectId}/history?${params}`);
      if (!res.ok) throw new Error("Failed to fetch project history");
      return res.json();
    },
    enabled: !!projectId,
  });

  const projectUsersList = Array.from(
    new Map(
      (data?.timesheets || []).map(t => [t.userId, { id: t.userId, name: t.userName }])
    ).values()
  );

  const filteredTimesheets = data?.timesheets || [];
  const paginatedTimesheets = filteredTimesheets.slice(
    timesheetPage * pageSize,
    (timesheetPage + 1) * pageSize
  );
  const totalPages = Math.ceil(filteredTimesheets.length / pageSize);

  const chartData = data?.monthlyHistory.map(m => ({
    ...m,
    profitZone: data.thresholds.profitThreshold,
    breakevenZone: data.thresholds.breakevenThreshold,
  })) || [];

  return (
    <Sheet open={!!projectId} onOpenChange={() => onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-hidden flex flex-col">
        <SheetHeader className="shrink-0">
          <SheetTitle className="flex items-center gap-2" data-testid="text-project-detail-title">
            {projectName}
            {data?.project.region && (
              <Badge variant="outline">{data.project.region}</Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {isLoading ? (
            <div className="space-y-4 py-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : data ? (
            <div className="space-y-6 py-4">
              <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <DollarSign className="h-4 w-4" />
                      Revenue
                    </div>
                    <div className="text-lg font-semibold mt-1" data-testid="text-detail-revenue">
                      {formatCurrency(data.stats.totalRevenue)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <DollarSign className="h-4 w-4" />
                      Cost
                    </div>
                    <div className="text-lg font-semibold mt-1" data-testid="text-detail-cost">
                      {formatCurrency(data.stats.totalCost)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      {data.stats.overallMargin >= 0 ? (
                        <TrendingUp className="h-4 w-4 text-green-500" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-500" />
                      )}
                      Margin
                    </div>
                    <div className={`text-lg font-semibold mt-1 ${data.stats.overallMargin >= 0 ? "text-green-600" : "text-red-600"}`} data-testid="text-detail-margin">
                      {formatPercent(data.stats.overallMargin)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <Clock className="h-4 w-4" />
                      Hours
                    </div>
                    <div className="text-lg font-semibold mt-1" data-testid="text-detail-hours">
                      {data.stats.totalHours.toFixed(1)}h
                    </div>
                  </CardContent>
                </Card>
              </div>

              {data.statusChanges.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Status Changes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {data.statusChanges.map((change, idx) => (
                        <div key={idx} className="flex items-center gap-3 text-sm p-2 bg-muted/50 rounded-md" data-testid={`row-status-change-${idx}`}>
                          <span className="text-muted-foreground">{change.date}</span>
                          <BucketBadge bucket={change.fromBucket} />
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          <BucketBadge bucket={change.toBucket} />
                          <span className={`ml-auto font-medium ${change.margin >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {formatPercent(change.margin)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {chartData.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Profitability Trend</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <ComposedChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis 
                          dataKey="monthLabel" 
                          tick={{ fontSize: 11 }}
                          angle={-45}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis 
                          tick={{ fontSize: 11 }}
                          tickFormatter={(v) => `${v}%`}
                          domain={['auto', 'auto']}
                        />
                        <Tooltip
                          formatter={(value: number, name: string) => {
                            if (name === "margin") return [`${value.toFixed(1)}%`, "Margin"];
                            return [formatCurrency(value), name === "revenue" ? "Revenue" : "Cost"];
                          }}
                          contentStyle={{ 
                            backgroundColor: "hsl(var(--card))", 
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "6px"
                          }}
                        />
                        <ReferenceLine 
                          y={data.thresholds.profitThreshold} 
                          stroke="#22c55e" 
                          strokeDasharray="5 5" 
                          label={{ value: "Profit", position: "right", fontSize: 10, fill: "#22c55e" }}
                        />
                        <ReferenceLine 
                          y={data.thresholds.breakevenThreshold} 
                          stroke="#f59e0b" 
                          strokeDasharray="5 5"
                          label={{ value: "Breakeven", position: "right", fontSize: 10, fill: "#f59e0b" }}
                        />
                        <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="5 5" />
                        <Line
                          type="monotone"
                          dataKey="margin"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          dot={{ fill: "hsl(var(--primary))", strokeWidth: 2 }}
                          activeDot={{ r: 6 }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                    <div className="flex justify-center gap-4 mt-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-0.5 bg-green-500" />
                        Profit threshold ({data.thresholds.profitThreshold}%)
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-0.5 bg-amber-500" />
                        Breakeven ({data.thresholds.breakevenThreshold}%)
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Timesheet Entries ({data.stats.timesheetCount})
                    </CardTitle>
                    {projectUsersList.length > 1 && (
                      <Select value={resourceFilter} onValueChange={handleResourceFilterChange}>
                        <SelectTrigger className="w-[180px]" data-testid="select-resource-filter">
                          <Filter className="h-4 w-4 mr-2" />
                          <SelectValue placeholder="All resources" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All resources</SelectItem>
                          {projectUsersList.map(u => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {paginatedTimesheets.length > 0 ? (
                    <>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Resource</TableHead>
                            <TableHead className="text-right">Hours</TableHead>
                            <TableHead className="text-right">Rate</TableHead>
                            <TableHead className="text-right">Cost</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedTimesheets.map((entry) => (
                            <TableRow key={entry.id} data-testid={`row-timesheet-${entry.id}`}>
                              <TableCell className="text-sm">{formatDate(entry.date)}</TableCell>
                              <TableCell className="text-sm">{entry.userName}</TableCell>
                              <TableCell className="text-right text-sm">{entry.hoursLogged.toFixed(1)}h</TableCell>
                              <TableCell className="text-right text-sm">{formatCurrency(entry.hourlyCostRate)}/h</TableCell>
                              <TableCell className="text-right font-medium text-sm">{formatCurrency(entry.cost)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>

                      {totalPages > 1 && (
                        <div className="flex items-center justify-between mt-4 pt-4 border-t">
                          <span className="text-sm text-muted-foreground">
                            Page {timesheetPage + 1} of {totalPages}
                          </span>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setTimesheetPage(p => Math.max(0, p - 1))}
                              disabled={timesheetPage === 0}
                              data-testid="button-prev-page"
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setTimesheetPage(p => Math.min(totalPages - 1, p + 1))}
                              disabled={timesheetPage >= totalPages - 1}
                              data-testid="button-next-page"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No timesheet entries for this project
                    </div>
                  )}
                </CardContent>
              </Card>

              {chartData.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Monthly Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Month</TableHead>
                          <TableHead className="text-right">Revenue</TableHead>
                          <TableHead className="text-right">Cost</TableHead>
                          <TableHead className="text-right">Margin</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {chartData.map((m) => (
                          <TableRow key={`${m.year}-${m.month}`} data-testid={`row-month-${m.year}-${m.month}`}>
                            <TableCell className="text-sm">{m.monthLabel}</TableCell>
                            <TableCell className="text-right text-sm">{formatCurrency(m.revenue)}</TableCell>
                            <TableCell className="text-right text-sm">{formatCurrency(m.totalCost)}</TableCell>
                            <TableCell className={`text-right text-sm font-medium ${m.margin >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {formatPercent(m.margin)}
                            </TableCell>
                            <TableCell>
                              <BucketBadge bucket={m.bucket} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              Failed to load project data
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
