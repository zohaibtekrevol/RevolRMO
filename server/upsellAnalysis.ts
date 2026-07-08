import { storage } from "./storage";
import type { SoldUpsell, UpsellWithDetails, UpsellAnalysisScope } from "@shared/schema";

// Deterministic aggregates computed from the unified upsell dataset:
//   - "Sold" upsells = locked Change Requests (storage.getSoldUpsells)
//   - "Pipeline" upsells = the upsells table incl. converted/lost (storage.getAllUpsells)
// These aggregates are reused both by the stats endpoint and as the (bounded)
// payload sent to the AI provider, so we never ship raw unbounded rows to the LLM.
//
// The dataset can be computed for two scopes:
//   - "combined": Pipeline + Sold Upsells (the original, full behavior)
//   - "sold": Sold Upsells only — pipeline aggregates are omitted entirely

export type CategoryStat = { category: string; count: number; value: number; received: number };
export type ProjectStat = { projectId: string; projectName: string; count: number; value: number };
export type PmStat = { pmId: string; pmName: string; count: number; value: number };
export type MonthStat = { month: string; count: number; value: number };
export type StatusStat = { status: string; count: number; value: number };
export type TagStat = { tagId: string; tagName: string; color: string; count: number; value: number };
export type WinRateStat = {
  category: string;
  won: number;
  lost: number;
  winRate: number;
  wonValue: number;
  lostValue: number;
};
export type RevenueTrendPoint = { month: string; soldValue: number; convertedValue: number };

export type UpsellAnalysisStats = {
  scope: UpsellAnalysisScope;
  generatedAt: string;
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

const UNCATEGORIZED = "Uncategorized";

function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const n = parseFloat(String(value));
  return Number.isFinite(n) ? n : 0;
}

function monthKey(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function pmName(pm: { firstName?: string | null; lastName?: string | null; email?: string | null } | null | undefined): string {
  if (!pm) return "Unassigned";
  const name = [pm.firstName, pm.lastName].filter(Boolean).join(" ").trim();
  return name || pm.email || "Unassigned";
}

export function computeUpsellAnalysisStats(
  sold: SoldUpsell[],
  pipeline: UpsellWithDetails[],
  scope: UpsellAnalysisScope = "combined",
): UpsellAnalysisStats {
  // In "sold" scope, pipeline data is never included in any aggregate.
  const effectivePipeline = scope === "sold" ? [] : pipeline;

  // ---- Sold (locked CRs) ----
  const soldByCategory = new Map<string, CategoryStat>();
  const soldByProject = new Map<string, ProjectStat>();
  const soldByPm = new Map<string, PmStat>();
  const soldByMonth = new Map<string, MonthStat>();
  const soldByTag = new Map<string, TagStat>();

  let soldValue = 0;
  let soldReceived = 0;

  for (const cr of sold) {
    const value = toNumber(cr.totalAmount);
    const received = toNumber(cr.receivedAmount);
    soldValue += value;
    soldReceived += received;

    const category = cr.category || UNCATEGORIZED;
    const catStat = soldByCategory.get(category) || { category, count: 0, value: 0, received: 0 };
    catStat.count += 1;
    catStat.value += value;
    catStat.received += received;
    soldByCategory.set(category, catStat);

    if (cr.project) {
      const projStat = soldByProject.get(cr.project.id) || {
        projectId: cr.project.id,
        projectName: cr.project.name || "Untitled project",
        count: 0,
        value: 0,
      };
      projStat.count += 1;
      projStat.value += value;
      soldByProject.set(cr.project.id, projStat);

      const pm = cr.project.pm;
      const pmId = pm?.id || "unassigned";
      const pmStat = soldByPm.get(pmId) || { pmId, pmName: pmName(pm), count: 0, value: 0 };
      pmStat.count += 1;
      pmStat.value += value;
      soldByPm.set(pmId, pmStat);
    }

    const mk = monthKey(cr.dateLocked) || monthKey(cr.createdAt);
    if (mk) {
      const m = soldByMonth.get(mk) || { month: mk, count: 0, value: 0 };
      m.count += 1;
      m.value += value;
      soldByMonth.set(mk, m);
    }

    for (const tag of cr.tags || []) {
      const tagStat = soldByTag.get(tag.id) || {
        tagId: tag.id,
        tagName: tag.name,
        color: tag.color,
        count: 0,
        value: 0,
      };
      tagStat.count += 1;
      tagStat.value += value;
      soldByTag.set(tag.id, tagStat);
    }
  }

  // ---- Pipeline (upsells table incl. converted/lost) ----
  const pipelineByStatus = new Map<string, StatusStat>();
  const winRateByCategory = new Map<string, WinRateStat>();
  const convertedByMonth = new Map<string, number>();

  let pipelineOpenCount = 0;
  let pipelineOpenValue = 0;
  let convertedCount = 0;
  let convertedValue = 0;
  let lostCount = 0;
  let lostValue = 0;

  for (const up of effectivePipeline) {
    const value = toNumber(up.amount);
    const status = up.status;

    const statusStat = pipelineByStatus.get(status) || { status, count: 0, value: 0 };
    statusStat.count += 1;
    statusStat.value += value;
    pipelineByStatus.set(status, statusStat);

    const category = up.upsellType || UNCATEGORIZED;
    const wr = winRateByCategory.get(category) || {
      category,
      won: 0,
      lost: 0,
      winRate: 0,
      wonValue: 0,
      lostValue: 0,
    };

    if (status === "converted") {
      convertedCount += 1;
      convertedValue += value;
      wr.won += 1;
      wr.wonValue += value;
      const mk = monthKey(up.convertedAt) || monthKey(up.updatedAt);
      if (mk) convertedByMonth.set(mk, (convertedByMonth.get(mk) || 0) + value);
    } else if (status === "lost") {
      lostCount += 1;
      lostValue += value;
      wr.lost += 1;
      wr.lostValue += value;
    } else {
      pipelineOpenCount += 1;
      pipelineOpenValue += value;
    }
    winRateByCategory.set(category, wr);
  }

  for (const wr of Array.from(winRateByCategory.values())) {
    const decided = wr.won + wr.lost;
    wr.winRate = decided > 0 ? Math.round((wr.won / decided) * 100) : 0;
  }

  const overallDecided = convertedCount + lostCount;
  const overallWinRate = overallDecided > 0 ? Math.round((convertedCount / overallDecided) * 100) : 0;

  // ---- Monthly revenue trend (sold, plus converted pipeline in combined scope) ----
  const trendMonths = new Set<string>([
    ...Array.from(soldByMonth.keys()),
    ...Array.from(convertedByMonth.keys()),
  ]);
  const monthlyRevenueTrend: RevenueTrendPoint[] = Array.from(trendMonths)
    .sort()
    .map((month) => ({
      month,
      soldValue: soldByMonth.get(month)?.value || 0,
      convertedValue: convertedByMonth.get(month) || 0,
    }));

  const sortedCategoriesByValue = Array.from(soldByCategory.values()).sort((a, b) => b.value - a.value);

  return {
    scope,
    generatedAt: new Date().toISOString(),
    overview: {
      soldCount: sold.length,
      soldValue,
      soldReceived,
      pipelineCount: effectivePipeline.length,
      pipelineOpenCount,
      pipelineOpenValue,
      convertedCount,
      convertedValue,
      lostCount,
      lostValue,
      overallWinRate,
    },
    soldByCategory: Array.from(soldByCategory.values()).sort((a, b) => b.value - a.value),
    soldByProject: Array.from(soldByProject.values()).sort((a, b) => b.value - a.value).slice(0, 20),
    soldByPm: Array.from(soldByPm.values()).sort((a, b) => b.value - a.value),
    soldByMonth: Array.from(soldByMonth.values()).sort((a, b) => a.month.localeCompare(b.month)),
    soldByTag: Array.from(soldByTag.values()).sort((a, b) => b.value - a.value),
    pipelineByStatus: Array.from(pipelineByStatus.values()),
    winRateByCategory: Array.from(winRateByCategory.values()).sort((a, b) => b.winRate - a.winRate),
    monthlyRevenueTrend,
    topCategories: sortedCategoriesByValue.slice(0, 5).map((c) => ({ category: c.category, value: c.value })),
    bottomCategories: sortedCategoriesByValue
      .slice(-5)
      .reverse()
      .map((c) => ({ category: c.category, value: c.value })),
  };
}

// Convenience loader: assembles the unified dataset and computes the aggregates
// for the requested scope. When scope is "sold", pipeline data is not even
// fetched, since it's excluded from every aggregate anyway.
export async function getUpsellAnalysisStats(scope: UpsellAnalysisScope = "combined"): Promise<UpsellAnalysisStats> {
  if (scope === "sold") {
    const sold = await storage.getSoldUpsells();
    return computeUpsellAnalysisStats(sold, [], "sold");
  }
  const [sold, pipeline] = await Promise.all([
    storage.getSoldUpsells(),
    storage.getAllUpsells(),
  ]);
  return computeUpsellAnalysisStats(sold, pipeline, "combined");
}

// Total data points available — used to gate the AI run on low-data states.
export function totalDataPoints(stats: UpsellAnalysisStats): number {
  return stats.overview.soldCount + stats.overview.pipelineCount;
}
