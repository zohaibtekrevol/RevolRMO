import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, getErrorMessage } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles,
  TrendingUp,
  Target,
  Award,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  XCircle,
  Trophy,
  RefreshCw,
  Brain,
  DollarSign,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { UpsellAiAnalysisWithUser, UpsellAiProvider, UpsellAnalysisScope } from "@shared/schema";

type CategoryStat = { category: string; count: number; value: number; received: number };
type ProjectStat = { projectId: string; projectName: string; count: number; value: number };
type PmStat = { pmId: string; pmName: string; count: number; value: number };
type MonthStat = { month: string; count: number; value: number };
type StatusStat = { status: string; count: number; value: number };
type WinRateStat = { category: string; won: number; lost: number; winRate: number; wonValue: number; lostValue: number };
type RevenueTrendPoint = { month: string; soldValue: number; convertedValue: number };
type TagStat = { tagId: string; tagName: string; color: string; count: number; value: number };

type UpsellAnalysisStats = {
  generatedAt: string;
  scope: UpsellAnalysisScope;
  overview: {
    soldCount: number;
    soldValue: number;
    soldReceived: number;
    pipelineCount: number;
    pipelineOpenCount: number;
    pipelineOpenValue: number;
    convertedCount: number;
    convertedValue: number;
    lostCount: number;
    lostValue: number;
    overallWinRate: number;
  };
  soldByCategory: CategoryStat[];
  soldByProject: ProjectStat[];
  soldByPm: PmStat[];
  soldByMonth: MonthStat[];
  soldByTag: TagStat[];
  pipelineByStatus: StatusStat[];
  winRateByCategory: WinRateStat[];
  monthlyRevenueTrend: RevenueTrendPoint[];
  topCategories: { category: string; value: number }[];
  bottomCategories: { category: string; value: number }[];
};

const SCOPE_LABEL: Record<UpsellAnalysisScope, string> = {
  combined: "Pipeline + Sold Upsells",
  sold: "Sold Upsells only",
};

type LatestResponse = {
  analysis: UpsellAiAnalysisWithUser | null;
  configuredProviders: UpsellAiProvider[];
};

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

const PROVIDER_LABEL: Record<UpsellAiProvider, string> = {
  anthropic: "Claude (Anthropic)",
  openai: "OpenAI",
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatMonth(month: string): string {
  const [y, m] = month.split("-");
  if (!y || !m) return month;
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "0.5rem",
  fontSize: "12px",
};

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
  testId,
}: {
  title: string;
  value: string;
  sub?: string;
  icon: typeof Sparkles;
  testId: string;
}) {
  return (
    <Card data-testid={testId}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold" data-testid={`${testId}-value`}>{value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function InsightList({
  title,
  items,
  icon: Icon,
  iconClass,
  testId,
}: {
  title: string;
  items: string[];
  icon: typeof Sparkles;
  iconClass: string;
  testId: string;
}) {
  return (
    <Card data-testid={testId}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className={`h-4 w-4 ${iconClass}`} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No items.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item, i) => (
              <li key={i} className="text-sm flex gap-2" data-testid={`${testId}-item-${i}`}>
                <span className="text-muted-foreground">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default function UpsellAiAnalysis() {
  const { toast } = useToast();
  const [provider, setProvider] = useState<UpsellAiProvider>("anthropic");
  const [scope, setScope] = useState<UpsellAnalysisScope>("combined");
  const isSoldOnly = scope === "sold";

  const { data: stats, isLoading: statsLoading } = useQuery<UpsellAnalysisStats>({
    queryKey: [`/api/upsells/ai/stats?scope=${scope}`],
  });

  const { data: latest, isLoading: latestLoading } = useQuery<LatestResponse>({
    queryKey: [`/api/upsells/ai/analysis/latest?scope=${scope}`],
  });

  const configuredProviders = latest?.configuredProviders ?? [];
  const hasAnyProvider = configuredProviders.length > 0;

  const runMutation = useMutation({
    mutationFn: async (selectedProvider: UpsellAiProvider) => {
      return await apiRequest("POST", "/api/upsells/ai/analysis", { provider: selectedProvider, scope });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/upsells/ai/analysis/latest?scope=${scope}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/upsells/ai/stats?scope=${scope}`] });
      toast({ title: "Analysis complete", description: "Fresh AI insights have been generated." });
    },
    onError: (error) => {
      toast({
        title: "Analysis failed",
        description: getErrorMessage(error, "Could not run the analysis. Please try again."),
        variant: "destructive",
      });
    },
  });

  const analysis = latest?.analysis;
  const insights = analysis?.insights;
  const overview = stats?.overview;

  const soldVsLostData = overview
    ? [
        { name: "Converted", value: overview.convertedCount },
        { name: "Lost", value: overview.lostCount },
        { name: "Open", value: overview.pipelineOpenCount },
      ]
    : [];

  const collectionRateByCategory = stats
    ? stats.soldByCategory
        .map((c) => ({
          category: c.category,
          rate: c.value > 0 ? Math.round((c.received / c.value) * 100) : 0,
        }))
        .sort((a, b) => b.rate - a.rate)
    : [];

  const SOLD_DISTRIBUTION_TOP_N = 5;
  const soldValueDistribution = stats
    ? (() => {
        const sorted = [...stats.soldByCategory].sort((a, b) => b.value - a.value);
        const top = sorted.slice(0, SOLD_DISTRIBUTION_TOP_N).map((c) => ({ name: c.category, value: c.value }));
        const rest = sorted.slice(SOLD_DISTRIBUTION_TOP_N);
        const otherValue = rest.reduce((sum, c) => sum + c.value, 0);
        return otherValue > 0 ? [...top, { name: "Other", value: otherValue }] : top;
      })()
    : [];

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-upsell-ai-analysis">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            Upsell AI Analysis
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Deterministic upsell stats plus AI-generated insights into trends, strengths and weaknesses.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={scope} onValueChange={(v) => setScope(v as UpsellAnalysisScope)}>
            <SelectTrigger className="w-[220px]" data-testid="select-analysis-scope">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="combined" data-testid="option-scope-combined">
                {SCOPE_LABEL.combined}
              </SelectItem>
              <SelectItem value="sold" data-testid="option-scope-sold">
                {SCOPE_LABEL.sold}
              </SelectItem>
            </SelectContent>
          </Select>
          <Select value={provider} onValueChange={(v) => setProvider(v as UpsellAiProvider)}>
            <SelectTrigger className="w-[180px]" data-testid="select-ai-provider">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="anthropic" data-testid="option-provider-anthropic">
                Claude (Anthropic)
                {hasAnyProvider && !configuredProviders.includes("anthropic") ? " — not configured" : ""}
              </SelectItem>
              <SelectItem value="openai" data-testid="option-provider-openai">
                OpenAI
                {hasAnyProvider && !configuredProviders.includes("openai") ? " — not configured" : ""}
              </SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={() => runMutation.mutate(provider)}
            disabled={runMutation.isPending}
            data-testid="button-run-analysis"
          >
            {runMutation.isPending ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            {runMutation.isPending ? "Analyzing…" : "Run Analysis"}
          </Button>
        </div>
      </div>

      {/* Provider config warning */}
      {!latestLoading && !hasAnyProvider && (
        <Alert variant="destructive" data-testid="alert-no-provider">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>No AI provider is configured</AlertTitle>
          <AlertDescription>
            Add an <strong>ANTHROPIC_API_KEY</strong> (for Claude) and/or an{" "}
            <strong>OPENAI_API_KEY</strong> (for OpenAI) so the analysis can run. The deterministic
            stats below work without a provider.
          </AlertDescription>
        </Alert>
      )}

      {/* Stat cards */}
      {statsLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : overview ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Sold Upsells"
            value={String(overview.soldCount)}
            sub={`${formatCurrency(overview.soldValue)} sold · ${formatCurrency(overview.soldReceived)} received`}
            icon={DollarSign}
            testId="stat-sold"
          />
          {!isSoldOnly && (
            <StatCard
              title="Pipeline Value (Open)"
              value={formatCurrency(overview.pipelineOpenValue)}
              sub={`${overview.pipelineOpenCount} open opportunities`}
              icon={Target}
              testId="stat-pipeline"
            />
          )}
          {!isSoldOnly && (
            <StatCard
              title="Win Rate"
              value={`${overview.overallWinRate}%`}
              sub={`${overview.convertedCount} won · ${overview.lostCount} lost`}
              icon={Trophy}
              testId="stat-winrate"
            />
          )}
          {!isSoldOnly && (
            <StatCard
              title="Converted Value"
              value={formatCurrency(overview.convertedValue)}
              sub={`${formatCurrency(overview.lostValue)} lost`}
              icon={TrendingUp}
              testId="stat-converted"
            />
          )}
        </div>
      ) : null}

      {/* Charts */}
      {overview && (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Revenue trend */}
          <Card data-testid="chart-revenue-trend">
            <CardHeader>
              <CardTitle className="text-base">{isSoldOnly ? "Monthly Sold Trend" : "Monthly Revenue Trend"}</CardTitle>
              <CardDescription>
                {isSoldOnly ? "Sold change requests over time" : "Sold change requests vs. converted pipeline"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[260px]">
                {stats!.monthlyRevenueTrend.length === 0 ? (
                  <EmptyChart />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={stats!.monthlyRevenueTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="month"
                        tickFormatter={formatMonth}
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                      />
                      <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        labelFormatter={(l) => formatMonth(String(l))}
                        formatter={(v: number) => formatCurrency(v)}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="soldValue" name="Sold" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                      {!isSoldOnly && (
                        <Line type="monotone" dataKey="convertedValue" name="Converted" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Sold by category */}
          <Card data-testid="chart-by-category">
            <CardHeader>
              <CardTitle className="text-base">Sold Value by Category</CardTitle>
              <CardDescription>Total sold revenue per upsell category</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[260px]">
                {stats!.soldByCategory.length === 0 ? (
                  <EmptyChart />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats!.soldByCategory.slice(0, 8)} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                      <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <YAxis
                        type="category"
                        dataKey="category"
                        width={110}
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                      />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatCurrency(v)} />
                      <Bar dataKey="value" name="Sold value" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Win rate by category (combined) / Collection rate by category (sold only) */}
          <Card data-testid="chart-win-rate">
            <CardHeader>
              <CardTitle className="text-base">
                {isSoldOnly ? "Collection Rate by Category" : "Win Rate by Category"}
              </CardTitle>
              <CardDescription>
                {isSoldOnly
                  ? "Share of sold value actually received, per category"
                  : "Converted vs. lost pipeline opportunities"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[260px]">
                {isSoldOnly ? (
                  collectionRateByCategory.length === 0 ? (
                    <EmptyChart />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={collectionRateByCategory.slice(0, 8)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="category" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                        <YAxis domain={[0, 100]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v}%`} />
                        <Bar dataKey="rate" name="Collection rate %" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )
                ) : stats!.winRateByCategory.length === 0 ? (
                  <EmptyChart />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats!.winRateByCategory.slice(0, 8)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="category" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v}%`} />
                      <Bar dataKey="winRate" name="Win rate %" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Pipeline outcome split (combined) / Sold value distribution (sold only) */}
          <Card data-testid="chart-outcome-split">
            <CardHeader>
              <CardTitle className="text-base">
                {isSoldOnly ? "Sold Value Distribution" : "Pipeline Outcomes"}
              </CardTitle>
              <CardDescription>
                {isSoldOnly ? "Share of sold value by category" : "Converted, lost and open opportunities"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[260px]">
                {isSoldOnly ? (
                  soldValueDistribution.length === 0 ? (
                    <EmptyChart />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={soldValueDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                          {soldValueDistribution.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatCurrency(v)} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )
                ) : overview.pipelineCount === 0 ? (
                  <EmptyChart />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={soldVsLostData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                        {soldVsLostData.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Sold by tag */}
          <Card data-testid="chart-by-tag">
            <CardHeader>
              <CardTitle className="text-base">Sold Value by Tag</CardTitle>
              <CardDescription>Sold upsell revenue grouped by tag</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[260px]">
                {stats!.soldByTag.length === 0 ? (
                  <EmptyChart />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats!.soldByTag.slice(0, 8)} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                      <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <YAxis
                        type="category"
                        dataKey="tagName"
                        width={110}
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                      />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatCurrency(v)} />
                      <Bar dataKey="value" name="Sold value" radius={[0, 4, 4, 0]}>
                        {stats!.soldByTag.slice(0, 8).map((t, i) => (
                          <Cell key={t.tagId} fill={t.color || CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Sold by project */}
          <Card data-testid="chart-by-project">
            <CardHeader>
              <CardTitle className="text-base">Sold Value by Project</CardTitle>
              <CardDescription>Top projects by sold upsell revenue</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[260px]">
                {stats!.soldByProject.length === 0 ? (
                  <EmptyChart />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats!.soldByProject.slice(0, 8)} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                      <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <YAxis
                        type="category"
                        dataKey="projectName"
                        width={120}
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                      />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatCurrency(v)} />
                      <Bar dataKey="value" name="Sold value" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Sold by project manager */}
          <Card data-testid="chart-by-pm">
            <CardHeader>
              <CardTitle className="text-base">Sold Value by Project Manager</CardTitle>
              <CardDescription>Sold upsell revenue per PM</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[260px]">
                {stats!.soldByPm.length === 0 ? (
                  <EmptyChart />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats!.soldByPm.slice(0, 8)} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                      <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <YAxis
                        type="category"
                        dataKey="pmName"
                        width={120}
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                      />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatCurrency(v)} />
                      <Bar dataKey="value" name="Sold value" fill="hsl(var(--chart-4))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Top & bottom categories */}
          <Card data-testid="card-top-bottom-categories">
            <CardHeader>
              <CardTitle className="text-base">Top & Bottom Categories</CardTitle>
              <CardDescription>Best and weakest performing upsell categories by sold value</CardDescription>
            </CardHeader>
            <CardContent>
              {stats!.topCategories.length === 0 ? (
                <EmptyChart />
              ) : (
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Top performers</p>
                    <div className="space-y-2">
                      {stats!.topCategories.map((c, i) => (
                        <div
                          key={c.category}
                          className="flex items-center justify-between text-sm"
                          data-testid={`row-top-category-${i}`}
                        >
                          <span className="truncate pr-2">{c.category}</span>
                          <span className="font-medium tabular-nums">{formatCurrency(c.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Needs attention</p>
                    <div className="space-y-2">
                      {stats!.bottomCategories.map((c, i) => (
                        <div
                          key={c.category}
                          className="flex items-center justify-between text-sm"
                          data-testid={`row-bottom-category-${i}`}
                        >
                          <span className="truncate pr-2">{c.category}</span>
                          <span className="font-medium tabular-nums">{formatCurrency(c.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* AI Insights */}
      <Card data-testid="card-ai-insights">
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Insights
            </CardTitle>
            {analysis && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground" data-testid="text-analysis-meta">
                <Badge variant="secondary">{PROVIDER_LABEL[analysis.provider]}</Badge>
                <span>{analysis.model}</span>
                <span>·</span>
                <span>{new Date(analysis.createdAt).toLocaleString()}</span>
                {analysis.generator && (
                  <>
                    <span>·</span>
                    <span>
                      {[analysis.generator.firstName, analysis.generator.lastName].filter(Boolean).join(" ") ||
                        analysis.generator.email}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {latestLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <div className="grid gap-4 md:grid-cols-2">
                <Skeleton className="h-40" />
                <Skeleton className="h-40" />
              </div>
            </div>
          ) : !insights ? (
            <div className="text-center py-10" data-testid="empty-insights">
              <Lightbulb className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="font-medium">No analysis yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                {hasAnyProvider
                  ? "Pick a provider and click Run Analysis to generate insights from your upsell data."
                  : "Configure an AI provider to generate insights. The stats above are already available."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/40 p-4" data-testid="text-summary">
                <p className="text-sm leading-relaxed">{insights.summary}</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <InsightList title="Trends" items={insights.trends} icon={TrendingUp} iconClass="text-blue-500" testId="insight-trends" />
                <InsightList title="Easy to Upsell" items={insights.easyToUpsell} icon={Award} iconClass="text-amber-500" testId="insight-easy" />
                <InsightList title="Strengths" items={insights.strengths} icon={CheckCircle2} iconClass="text-green-500" testId="insight-strengths" />
                <InsightList title="Weaknesses" items={insights.weaknesses} icon={XCircle} iconClass="text-red-500" testId="insight-weaknesses" />
              </div>
              <InsightList title="Recommendations" items={insights.recommendations} icon={Lightbulb} iconClass="text-primary" testId="insight-recommendations" />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
      No data to display
    </div>
  );
}
