import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import {
  Award,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Target,
  ListChecks,
  ClipboardList,
  Sparkles,
  Printer,
  ArrowLeft,
  CalendarDays,
  ArrowRight,
  Rocket,
  MessageSquare,
  Gauge,
  Wallet,
  Clock,
  Banknote,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { AppraisalReport, SalaryGradeBand, AppraisalAiAnalysis } from "@shared/schema";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const fmtMoney = (v: string | number | null | undefined) => {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "number" ? v : parseFloat(v);
  if (isNaN(n)) return "—";
  return `PKR ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
};
const fmtPct = (v: string | number | null | undefined) => {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "number" ? v : parseFloat(v);
  if (isNaN(n)) return "—";
  return `${n.toFixed(1)}%`;
};
const fmtScore = (v: string | number | null | undefined) => {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "number" ? v : parseFloat(v);
  if (isNaN(n)) return "—";
  return n.toFixed(1);
};
const toNum = (raw: any): number | null => {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = typeof raw === "number" ? raw : parseFloat(String(raw).replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? null : n;
};
const getPackageAmount = (band: SalaryGradeBand | null): number | null => {
  if (!band) return null;
  const details = band.details || {};
  const key = Object.keys(details).find((k) => k.toLowerCase().includes("package"));
  if (!key) return null;
  return toNum(details[key]);
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function cycleLabel(r: AppraisalReport): string {
  const end = `${MONTH_NAMES[(r.periodEndMonth ?? 1) - 1] ?? ""} ${r.periodEndYear ?? ""}`.trim();
  const len = r.periodMonths === 12 ? "Annual" : `${r.periodMonths}-Month`;
  return `${len} appraisal · ending ${end}`;
}

function performanceColor(n: number | null): string {
  if (n == null) return "text-foreground";
  if (n >= 90) return "text-green-600 dark:text-green-400";
  if (n >= 75) return "text-emerald-600 dark:text-emerald-400";
  if (n >= 60) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

// A colorful stat card used across the report's KPI rows.
function StatCard({
  label,
  icon: Icon,
  accent,
  children,
  sub,
  testid,
}: {
  label: string;
  icon: typeof Target;
  accent: { card: string; chip: string };
  children: React.ReactNode;
  sub?: React.ReactNode;
  testid: string;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 shadow-sm transition-shadow hover-elevate ${accent.card} print:border-border print:bg-transparent print:shadow-none`}
      data-testid={testid}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground print:text-foreground">{label}</span>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${accent.chip} print:hidden`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-2.5">{children}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function PackageBreakdown({ currentBand, newBand }: { currentBand: SalaryGradeBand | null; newBand: SalaryGradeBand | null }) {
  const detailKeys = Array.from(
    new Set([
      ...Object.keys(currentBand?.details || {}),
      ...Object.keys(newBand?.details || {}),
    ]),
  );
  const fmtDetail = (raw: any) => {
    if (raw === null || raw === undefined || raw === "") return "—";
    const n = toNum(raw);
    return n != null ? fmtMoney(n) : String(raw);
  };
  const curPkg = getPackageAmount(currentBand);
  const newPkg = getPackageAmount(newBand);
  const pkgDelta = curPkg != null && newPkg != null ? newPkg - curPkg : null;

  if (!currentBand && !newBand) {
    return <p className="text-sm text-muted-foreground" data-testid="text-no-package">No pay grade details are available for this appraisal.</p>;
  }

  return (
    <div className="space-y-3" data-testid="report-package-breakdown">
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 text-left text-muted-foreground">
              <th className="py-2.5 px-4 font-medium">Benefit</th>
              <th className="py-2.5 px-4 font-medium text-right whitespace-nowrap">
                Current {currentBand?.gradeCode ? `(${currentBand.gradeCode})` : ""}
              </th>
              <th className="py-2.5 px-4 font-medium text-right whitespace-nowrap">
                New {newBand?.gradeCode ? `(${newBand.gradeCode})` : ""}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t" data-testid="report-breakdown-row-basic">
              <td className="py-2.5 px-4 font-medium">Basic</td>
              <td className="py-2.5 px-4 text-right whitespace-nowrap">{fmtMoney(currentBand?.salaryAmount)}</td>
              <td className="py-2.5 px-4 text-right whitespace-nowrap font-medium text-emerald-700 dark:text-emerald-400">{fmtMoney(newBand?.salaryAmount)}</td>
            </tr>
            {detailKeys.map((k) => (
              <tr key={k} className="border-t" data-testid={`report-breakdown-row-${k}`}>
                <td className="py-2.5 px-4 whitespace-nowrap">{k}</td>
                <td className="py-2.5 px-4 text-right whitespace-nowrap">{fmtDetail((currentBand?.details || {})[k])}</td>
                <td className="py-2.5 px-4 text-right whitespace-nowrap">{fmtDetail((newBand?.details || {})[k])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-emerald-100/40 px-4 py-3 dark:border-emerald-900/40 dark:from-emerald-950/40 dark:to-emerald-900/10 print:border-border print:bg-transparent" data-testid="report-total-package">
        <span className="text-sm font-semibold">Total Package (PKR)</span>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">{curPkg != null ? fmtMoney(curPkg) : "—"}</span>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-semibold text-emerald-700 dark:text-emerald-400" data-testid="report-text-new-package">{newPkg != null ? fmtMoney(newPkg) : "—"}</span>
          {pkgDelta != null && pkgDelta !== 0 && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${pkgDelta > 0 ? "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400"}`} data-testid="report-text-package-delta">
              {pkgDelta > 0 ? "+" : ""}{fmtMoney(pkgDelta)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function AiAnalysisBlock({ analysis }: { analysis: AppraisalAiAnalysis }) {
  const sections: { key: keyof AppraisalAiAnalysis; label: string; icon: typeof Target; tone: string; card: string }[] = [
    { key: "strengths", label: "Strengths", icon: CheckCircle2, tone: "text-green-600 dark:text-green-400", card: "border-green-200 bg-green-50/60 dark:border-green-900/40 dark:bg-green-950/20" },
    { key: "improvements", label: "Areas for improvement", icon: Target, tone: "text-amber-600 dark:text-amber-400", card: "border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20" },
    { key: "actionItems", label: "Action items", icon: ListChecks, tone: "text-blue-600 dark:text-blue-400", card: "border-blue-200 bg-blue-50/60 dark:border-blue-900/40 dark:bg-blue-950/20" },
    { key: "plan", label: "Improvement plan", icon: ClipboardList, tone: "text-violet-600 dark:text-violet-400", card: "border-violet-200 bg-violet-50/60 dark:border-violet-900/40 dark:bg-violet-950/20" },
  ];
  return (
    <div className="space-y-4" data-testid="report-ai-analysis">
      {analysis.summary && (
        <p className="rounded-xl border bg-card p-4 text-sm leading-relaxed text-foreground" data-testid="report-ai-summary">{analysis.summary}</p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {sections.map(({ key, label, icon: Icon, tone, card }) => {
          const items = analysis[key];
          if (!Array.isArray(items) || items.length === 0) return null;
          return (
            <div key={key} className={`rounded-xl border p-4 ${card} print:border-border print:bg-transparent`} data-testid={`report-ai-${key}`}>
              <div className={`mb-2 flex items-center gap-1.5 text-sm font-semibold ${tone}`}>
                <Icon className="h-4 w-4" />{label}
              </div>
              <ul className="space-y-1.5">
                {items.map((item, i) => (
                  <li key={i} className="flex gap-2 text-sm leading-snug text-muted-foreground">
                    <span className={`mt-1.5 h-1 w-1 shrink-0 rounded-full ${tone.replace("text-", "bg-")}`} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReportSkeleton() {
  return (
    <div className="mx-auto max-w-7xl p-6 space-y-6">
      <Skeleton className="h-28 w-full rounded-3xl" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-64 w-full rounded-2xl lg:col-span-2" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    </div>
  );
}

function ReportError({ isPublic }: { isPublic: boolean }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <XCircle className="h-6 w-6 text-muted-foreground" />
      </div>
      <h1 className="text-lg font-semibold" data-testid="text-report-not-found">Report not available</h1>
      <p className="text-sm text-muted-foreground">
        {isPublic
          ? "This share link is invalid or has been revoked. Please ask for a new link."
          : "We couldn't load this report. It may not exist or you may not have access to it."}
      </p>
      {!isPublic && (
        <Link href="/pmo-kpis">
          <Button variant="outline" size="sm" data-testid="button-back-to-kpis"><ArrowLeft className="h-4 w-4 mr-1" />Back to PMO KPIs</Button>
        </Link>
      )}
    </div>
  );
}

// Section heading helper with a colored accent bar.
function SectionTitle({ icon: Icon, title, accent, right }: { icon: typeof Target; title: string; accent: string; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${accent}`}>
          <Icon className="h-4 w-4" />
        </span>
        {title}
      </div>
      {right}
    </div>
  );
}

// The shared, printable report body. Used by both the authenticated and the
// public (no-login) wrappers below.
function AppraisalReportView({ report, isPublic }: { report: AppraisalReport; isPublic: boolean }) {
  const perf = report.overallPerformancePct;
  const tgtN = report.targetScore == null || report.targetScore === "" ? null : Number(report.targetScore);
  const meetsTarget = perf != null && tgtN != null ? perf >= tgtN : null;
  const increment = report.finalIncrement ? parseFloat(report.finalIncrement) : 0;
  const hasDecision = !!(report.finalVerdict || report.boardComment);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-violet-50/40 dark:from-background dark:via-background dark:to-background print:bg-white">
      <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8 print:p-0">
        {/* Toolbar (hidden when printing) */}
        <div className="mb-5 flex items-center justify-between gap-2 print:hidden">
          {isPublic ? (
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Award className="h-5 w-5 text-primary" />RevolRMO
            </div>
          ) : (
            <Link href="/pmo-kpis">
              <Button variant="ghost" size="sm" data-testid="button-report-back"><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
            </Link>
          )}
          <Button variant="outline" size="sm" onClick={() => window.print()} data-testid="button-print-report">
            <Printer className="h-4 w-4 mr-1" />Print / Save PDF
          </Button>
        </div>

        {/* Hero header */}
        <div className="overflow-hidden rounded-3xl bg-gradient-to-r from-primary via-indigo-600 to-violet-600 p-6 text-white shadow-lg sm:p-8 print:border print:bg-white print:text-foreground print:shadow-none">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-2xl font-bold backdrop-blur print:bg-muted print:text-foreground">
                {initials(report.personName)}
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-sm font-medium text-white/80 print:text-muted-foreground">
                  <Award className="h-4 w-4" /> Performance Report
                </div>
                <h1 className="mt-0.5 text-3xl font-bold" data-testid="text-report-person">{report.personName}</h1>
                <p className="text-sm text-white/80 print:text-muted-foreground" data-testid="text-report-designation">{report.designation || "—"}</p>
              </div>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium backdrop-blur print:border print:bg-transparent print:text-muted-foreground" data-testid="text-report-cycle">
              <CalendarDays className="h-3.5 w-3.5" />{cycleLabel(report)}
            </div>
          </div>
        </div>

        {/* Eligibility banner */}
        <div className="mt-6">
          {report.eligible ? (
            <div className="flex items-center gap-3 rounded-2xl border border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 px-5 py-4 text-green-700 shadow-sm dark:border-green-900/40 dark:from-green-950/40 dark:to-emerald-950/20 dark:text-green-300 print:border-border print:bg-transparent" data-testid="report-eligible-banner">
              <CheckCircle2 className="h-6 w-6 shrink-0" />
              <span className="text-base font-semibold">Eligible for an increment this cycle.</span>
            </div>
          ) : (
            <div className="rounded-2xl border border-red-200 bg-gradient-to-r from-red-50 to-rose-50 px-5 py-4 text-red-700 shadow-sm dark:border-red-900/50 dark:from-red-950/30 dark:to-rose-950/20 dark:text-red-300 print:border-border print:bg-transparent" data-testid="report-ineligible-banner">
              <div className="flex items-start gap-3">
                <XCircle className="h-6 w-6 mt-0.5 shrink-0" />
                <div>
                  <p className="text-base font-semibold">Not eligible for an increment this cycle.</p>
                  <p className="mt-0.5 text-sm" data-testid="text-report-ineligible-reason">{report.eligibilityReason || "Does not meet the eligibility criteria."}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Performance + salary KPIs — one full-width row */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard
            label="Overall performance"
            icon={Gauge}
            accent={{ card: "border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100/40 dark:border-blue-900/40 dark:from-blue-950/40 dark:to-blue-900/10", chip: "bg-blue-500/15 text-blue-600 dark:text-blue-400" }}
            sub="Average of each month's efficiency"
            testid="report-stat-performance"
          >
            <div className={`text-2xl font-bold ${performanceColor(perf)}`}>{perf != null ? fmtPct(perf) : "—"}</div>
          </StatCard>

          <StatCard
            label="Average vs target score"
            icon={Target}
            accent={{ card: "border-violet-200 bg-gradient-to-br from-violet-50 to-violet-100/40 dark:border-violet-900/40 dark:from-violet-950/40 dark:to-violet-900/10", chip: "bg-violet-500/15 text-violet-600 dark:text-violet-400" }}
            sub={<>HP: {fmtPct(report.hpPct)} · Base: {fmtPct(report.baseIncrementPct)}</>}
            testid="report-stat-score"
          >
            <div className="inline-flex items-center gap-1.5 text-2xl font-bold">
              {meetsTarget === true && <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />}
              {fmtScore(report.averageScore)}
              <span className="text-base font-medium text-muted-foreground">/ {fmtScore(report.targetScore)}</span>
            </div>
          </StatCard>

          <StatCard
            label="Service"
            icon={Clock}
            accent={{ card: "border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100/40 dark:border-amber-900/40 dark:from-amber-950/40 dark:to-amber-900/10", chip: "bg-amber-500/15 text-amber-600 dark:text-amber-400" }}
            sub="At end of appraisal period"
            testid="report-stat-service"
          >
            <div className="text-2xl font-bold">{report.servedMonths != null ? `${report.servedMonths}` : "—"}<span className="text-base font-medium text-muted-foreground"> mo</span></div>
          </StatCard>

          <StatCard
            label="Current salary (PKR)"
            icon={Wallet}
            accent={{ card: "border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100/40 dark:border-slate-800 dark:from-slate-900/40 dark:to-slate-800/10", chip: "bg-slate-500/15 text-slate-600 dark:text-slate-300" }}
            sub={report.currentGradeCode ? `Grade ${report.currentGradeCode}` : undefined}
            testid="report-stat-current-salary"
          >
            <div className="text-2xl font-bold">{fmtMoney(report.currentSalary)}</div>
          </StatCard>

          <StatCard
            label="New salary (PKR)"
            icon={Banknote}
            accent={{ card: "border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100/40 dark:border-emerald-900/40 dark:from-emerald-950/40 dark:to-emerald-900/10", chip: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" }}
            sub={report.assignedGradeCode ? `Grade ${report.assignedGradeCode}` : undefined}
            testid="report-stat-new-salary"
          >
            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{fmtMoney(report.assignedSalary)}</div>
          </StatCard>

          <StatCard
            label="Annual increment (PKR)"
            icon={TrendingUp}
            accent={{ card: "border-teal-200 bg-gradient-to-br from-teal-50 to-teal-100/40 dark:border-teal-900/40 dark:from-teal-950/40 dark:to-teal-900/10", chip: "bg-teal-500/15 text-teal-600 dark:text-teal-400" }}
            testid="report-stat-increment"
          >
            <div className="inline-flex items-center gap-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {increment > 0 && <TrendingUp className="h-5 w-5" />}{fmtMoney(report.finalIncrement)}
            </div>
          </StatCard>
        </div>

        {/* Main two-column area: package breakdown + decision/criteria sidebar */}
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {/* Package breakdown */}
          <div className="rounded-2xl border bg-card p-5 shadow-sm lg:col-span-2 print:border-border print:shadow-none">
            <SectionTitle icon={Wallet} title="Package breakdown" accent="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" />
            <PackageBreakdown currentBand={report.currentBand} newBand={report.newBand} />
          </div>

          {/* Sidebar: board decision + how eligibility is decided */}
          <div className="space-y-6">
            {hasDecision && (
              <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 shadow-sm print:border-border print:shadow-none" data-testid="report-board-decision">
                <SectionTitle icon={Rocket} title="Board decision" accent="bg-primary/15 text-primary" />
                {report.finalVerdict && (
                  <div className="text-sm" data-testid="text-report-verdict">
                    <span className="text-muted-foreground">Verdict: </span>
                    <span className="font-medium">{report.finalVerdict}</span>
                  </div>
                )}
                {report.boardComment && (
                  <p className="mt-2 flex gap-1.5 whitespace-pre-line text-sm text-muted-foreground" data-testid="text-report-board-comment">
                    <MessageSquare className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{report.boardComment}</span>
                  </p>
                )}
              </div>
            )}

            <div className="rounded-2xl border bg-card p-5 shadow-sm print:border-border print:shadow-none" data-testid="report-eligibility-criteria">
              <SectionTitle icon={Info} title="How eligibility is decided" accent="bg-blue-500/15 text-blue-600 dark:text-blue-400" />
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-1.5"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />Average performance score must meet or beat the designation's target score.</li>
                <li className="flex gap-1.5"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />Enough months of service must be completed by the end of the appraisal period.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* AI analysis — full width */}
        <div className="mt-6 rounded-2xl border bg-card p-5 shadow-sm print:border-border print:shadow-none">
          <SectionTitle
            icon={Sparkles}
            title="AI performance analysis"
            accent="bg-violet-500/15 text-violet-600 dark:text-violet-400"
            right={
              report.aiAnalysisAt ? (
                <span className="text-xs font-normal text-muted-foreground" data-testid="text-report-ai-at">
                  {new Date(report.aiAnalysisAt).toLocaleDateString()}
                </span>
              ) : undefined
            }
          />
          {report.aiAnalysis ? (
            <AiAnalysisBlock analysis={report.aiAnalysis} />
          ) : (
            <p className="text-sm text-muted-foreground" data-testid="text-report-ai-empty">No AI analysis has been generated for this appraisal yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// Authenticated route: the employee's own report (or any, for managers).
export function AppraisalReportPage() {
  const [, params] = useRoute("/appraisals/:id/report");
  const id = params?.id;
  const { data, isLoading, isError } = useQuery<AppraisalReport>({
    queryKey: ["/api/kpi/appraisals", id, "report"],
    enabled: !!id,
  });

  if (isLoading) return <ReportSkeleton />;
  if (isError || !data) return <ReportError isPublic={false} />;
  return <AppraisalReportView report={data} isPublic={false} />;
}

// Public route: no login, reachable only with a valid share token.
export function AppraisalPublicReportPage() {
  const [, params] = useRoute("/r/appraisal/:token");
  const token = params?.token;
  const { data, isLoading, isError } = useQuery<AppraisalReport>({
    queryKey: ["/api/public/appraisal-report", token],
    enabled: !!token,
  });

  if (isLoading) return <ReportSkeleton />;
  if (isError || !data) return <ReportError isPublic={true} />;
  return <AppraisalReportView report={data} isPublic={true} />;
}
