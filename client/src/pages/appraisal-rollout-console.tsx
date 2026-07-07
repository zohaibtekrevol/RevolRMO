import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { AppraisalWithPm, SalaryGradeBand } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Lock,
  Loader2,
  Pencil,
  Rocket,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const VERDICTS = ["Approved", "Approved with conditions", "No increment", "Deferred"];

const fmtMoney = (v: string | number | null | undefined) => {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "number" ? v : parseFloat(v);
  if (isNaN(n)) return "—";
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
};
const fmtScore = (v: string | number | null | undefined) => {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "number" ? v : parseFloat(v);
  if (isNaN(n)) return "—";
  return n.toFixed(1);
};
const toNum = (v: string | number | null | undefined): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(v);
  return isNaN(n) ? null : n;
};

// One row's working edits before the board locks it.
type RowDraft = {
  bandId: string; // "" when no band assigned
  salary: string; // free-text dollar amount
  verdict: string;
  comment: string;
};

// Read the cycle the console should show from the URL query string, falling
// back to the current month/year. The Appraisals tab links here with the cycle
// it had selected.
function readCycleFromUrl() {
  const now = new Date();
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const pm = parseInt(params.get("periodMonths") || "", 10);
  const em = parseInt(params.get("periodEndMonth") || "", 10);
  const ey = parseInt(params.get("periodEndYear") || "", 10);
  return {
    periodMonths: pm === 6 || pm === 12 ? pm : 12,
    endMonth: em >= 1 && em <= 12 ? em : now.getMonth() + 1,
    endYear: ey >= 2000 && ey <= 2100 ? ey : now.getFullYear(),
  };
}

export default function AppraisalRolloutConsole() {
  const { toast } = useToast();
  const now = new Date();
  const initial = readCycleFromUrl();
  const [periodMonths, setPeriodMonths] = useState(initial.periodMonths);
  const [endMonth, setEndMonth] = useState(initial.endMonth);
  const [endYear, setEndYear] = useState(initial.endYear);

  // Per-row edits keyed by appraisal id. Seeded from the appraisal when data loads.
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});
  const [confirm, setConfirm] = useState<{ type: "one"; id: string } | { type: "all" } | null>(null);

  const { data: appraisals = [], isLoading } = useQuery<AppraisalWithPm[]>({
    queryKey: ["/api/kpi/appraisals", periodMonths, endMonth, endYear],
    queryFn: async () => {
      const res = await fetch(
        `/api/kpi/appraisals?periodMonths=${periodMonths}&periodEndMonth=${endMonth}&periodEndYear=${endYear}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to fetch appraisals");
      return res.json();
    },
  });

  const { data: bands = [] } = useQuery<SalaryGradeBand[]>({ queryKey: ["/api/kpi/grade-bands"] });
  const bandsById = useMemo(() => new Map(bands.map((b) => [b.id, b])), [bands]);

  // Seed/refresh row drafts whenever the appraisal set changes. Rolled-out rows
  // are read-only so we don't seed editable defaults for them.
  useEffect(() => {
    setDrafts((prev) => {
      const next: Record<string, RowDraft> = {};
      for (const a of appraisals) {
        next[a.id] = prev[a.id] ?? {
          bandId: a.assignedBandId ?? "",
          salary: a.assignedSalary ?? "",
          verdict: a.finalVerdict ?? (a.eligible ? "Approved" : "No increment"),
          comment: a.boardComment ?? "",
        };
      }
      return next;
    });
  }, [appraisals]);

  const years = [now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  const pending = appraisals.filter((a) => a.status !== "rolled_out");
  const lockedCount = appraisals.length - pending.length;

  const setDraft = (id: string, patch: Partial<RowDraft>) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  // When the board picks a band, default the final salary to that band's basic
  // (they can then override it). Clearing the band leaves salary as-is.
  const onPickBand = (a: AppraisalWithPm, bandId: string) => {
    const band = bandId ? bandsById.get(bandId) : null;
    setDraft(a.id, {
      bandId,
      salary: band?.salaryAmount != null ? String(band.salaryAmount) : drafts[a.id]?.salary ?? "",
    });
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/kpi/appraisals"] });
    queryClient.invalidateQueries({ queryKey: ["/api/users"] });
  };

  const buildItem = (a: AppraisalWithPm) => {
    const d = drafts[a.id];
    return {
      id: a.id,
      finalVerdict: d?.verdict ?? "",
      boardComment: d?.comment ?? "",
      assignedBandId: d?.bandId ?? "",
      assignedSalary: d?.salary ?? "",
    };
  };

  const lockOne = useMutation({
    mutationFn: (a: AppraisalWithPm) => apiRequest("POST", `/api/kpi/appraisals/${a.id}/rollout`, buildItem(a)),
    onSuccess: () => {
      invalidate();
      toast({ title: "Locked & rolled out", description: "The employee has been notified and their new grade applied." });
      setConfirm(null);
    },
    onError: (e: any) => toast({ title: "Couldn't roll out", description: e.message, variant: "destructive" }),
  });

  const lockAll = useMutation({
    mutationFn: async () => {
      const items = pending.map(buildItem);
      const res = await apiRequest("POST", "/api/kpi/appraisals/rollout-batch", { items });
      return res.json() as Promise<{ summary: { rolledOut: number; skipped: number; failed: number; total: number } }>;
    },
    onSuccess: (data) => {
      invalidate();
      const s = data.summary;
      toast({
        title: `Rolled out ${s.rolledOut} of ${s.total}`,
        description: `${s.skipped} already locked, ${s.failed} failed.`,
        variant: s.failed > 0 ? "destructive" : undefined,
      });
      setConfirm(null);
    },
    onError: (e: any) => toast({ title: "Couldn't roll out", description: e.message, variant: "destructive" }),
  });

  const busy = lockOne.isPending || lockAll.isPending;

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 md:p-6" data-testid="page-rollout-console">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/pmo-kpis">
            <Button variant="ghost" size="sm" className="mb-1 -ml-2 h-7 text-muted-foreground" data-testid="link-back-to-kpis">
              <ArrowLeft className="h-4 w-4 mr-1" />Back to KPIs
            </Button>
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-bold" data-testid="text-console-title">
            <Rocket className="h-6 w-6 text-primary" />Full Roll Out
          </h1>
          <p className="text-sm text-muted-foreground">
            Review every employee's appraisal for this cycle, adjust their final grade and salary if needed, then lock and roll out the board's decision.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 pt-6">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Cycle Length</Label>
            <Select value={String(periodMonths)} onValueChange={(v) => setPeriodMonths(Number(v))}>
              <SelectTrigger className="w-36" data-testid="select-console-cycle-length"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="6">6 Months</SelectItem>
                <SelectItem value="12">1 Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Cycle End Month</Label>
            <Select value={String(endMonth)} onValueChange={(v) => setEndMonth(Number(v))}>
              <SelectTrigger className="w-40" data-testid="select-console-cycle-month"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTH_NAMES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Cycle End Year</Label>
            <Select value={String(endYear)} onValueChange={(v) => setEndYear(Number(v))}>
              <SelectTrigger className="w-28" data-testid="select-console-cycle-year"><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="text-right text-xs text-muted-foreground" data-testid="text-console-summary">
              <div><span className="font-semibold text-foreground">{pending.length}</span> to roll out</div>
              <div><span className="font-semibold text-foreground">{lockedCount}</span> already locked</div>
            </div>
            <Button
              onClick={() => setConfirm({ type: "all" })}
              disabled={busy || pending.length === 0}
              data-testid="button-lock-all"
            >
              <Lock className="h-4 w-4 mr-1" />Lock all
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground" data-testid="text-console-loading">
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />Loading appraisals…
            </div>
          ) : appraisals.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground" data-testid="text-console-empty">
              No appraisals for this cycle. Generate them from the KPIs page first.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-3 pr-4 font-medium">Employee</th>
                    <th className="py-3 pr-4 font-medium">Status</th>
                    <th className="py-3 pr-4 font-medium text-right">Performance</th>
                    <th className="py-3 pr-4 font-medium text-center">Eligible</th>
                    <th className="py-3 pr-4 font-medium">Current → New grade</th>
                    <th className="py-3 pr-4 font-medium">Final salary</th>
                    <th className="py-3 pr-4 font-medium text-right">Increment</th>
                    <th className="py-3 pr-4 font-medium">Verdict</th>
                    <th className="py-3 pr-2 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {appraisals.map((a) => {
                    const name = `${a.pm?.firstName || ""} ${a.pm?.lastName || ""}`.trim() || a.pm?.email || "Unknown";
                    const d = drafts[a.id];
                    const locked = a.status === "rolled_out";
                    const designationBands = bands.filter((b) => b.designationId === a.gradeId);
                    const currentSalaryN = toNum(a.currentSalary) ?? 0;
                    const liveSalaryN = locked ? toNum(a.assignedSalary) : toNum(d?.salary ?? null);
                    const liveIncrement = liveSalaryN != null ? liveSalaryN - currentSalaryN : null;
                    return (
                      <tr
                        key={a.id}
                        className={`border-b align-top transition-colors hover:bg-muted/30 ${a.eligible ? "border-l-2 border-l-green-500" : "border-l-2 border-l-transparent"}`}
                        data-testid={`row-console-${a.id}`}
                      >
                        <td className="py-3 pr-4">
                          <div className="font-medium leading-tight">{name}</div>
                          <div className="text-xs text-muted-foreground leading-tight">{a.gradeName || "—"}</div>
                        </td>
                        <td className="py-3 pr-4 whitespace-nowrap">
                          {a.status === "rolled_out" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary" data-testid={`status-${a.id}`}>
                              <Rocket className="h-3 w-3" />Rolled out
                            </span>
                          ) : a.status === "finalized" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" data-testid={`status-${a.id}`}>
                              <Lock className="h-3 w-3" />Finalized
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground" data-testid={`status-${a.id}`}>
                              <Pencil className="h-3 w-3" />Draft
                            </span>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-right whitespace-nowrap">
                          <span className="font-semibold">{fmtScore(a.averageScore)}</span>
                          <span className="text-xs text-muted-foreground"> / {fmtScore(a.targetScore)}</span>
                        </td>
                        <td className="py-3 pr-4 text-center">
                          {a.eligible ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300"><CheckCircle2 className="h-3.5 w-3.5" />Yes</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300" title={a.eligibilityReason || "Not eligible"}><XCircle className="h-3.5 w-3.5" />No</span>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          <div className="mb-1 text-xs text-muted-foreground whitespace-nowrap">
                            {a.currentGradeCode || "—"} <ArrowRight className="inline h-3 w-3" /> {locked ? (a.assignedGradeCode || "—") : ""}
                          </div>
                          {locked ? (
                            <div className="font-medium">{a.assignedGradeCode || "—"}</div>
                          ) : (
                            <Select value={d?.bandId || "none"} onValueChange={(v) => onPickBand(a, v === "none" ? "" : v)} disabled={busy}>
                              <SelectTrigger className="h-8 w-44" data-testid={`select-band-${a.id}`}><SelectValue placeholder="No grade" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">No grade</SelectItem>
                                {designationBands.map((b) => (
                                  <SelectItem key={b.id} value={b.id}>{b.gradeCode || b.label || fmtMoney(b.salaryAmount)}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          <div className="mb-1 text-xs text-muted-foreground whitespace-nowrap">from {fmtMoney(a.currentSalary)}</div>
                          {locked ? (
                            <div className="font-semibold">{fmtMoney(a.assignedSalary)}</div>
                          ) : (
                            <Input
                              type="number"
                              min={0}
                              value={d?.salary ?? ""}
                              onChange={(e) => setDraft(a.id, { salary: e.target.value })}
                              className="h-8 w-32"
                              placeholder="0"
                              disabled={busy}
                              data-testid={`input-salary-${a.id}`}
                            />
                          )}
                        </td>
                        <td className="py-3 pr-4 text-right whitespace-nowrap">
                          {liveIncrement != null && liveIncrement > 0 ? (
                            <span className="inline-flex items-center justify-end gap-1 font-semibold text-emerald-600 dark:text-emerald-400"><TrendingUp className="h-3.5 w-3.5" />{fmtMoney(liveIncrement)}</span>
                          ) : (
                            <span className="text-muted-foreground">{fmtMoney(liveIncrement)}</span>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          {locked ? (
                            <div className="max-w-[12rem]">
                              <div className="font-medium">{a.finalVerdict || "—"}</div>
                              {a.boardComment && <div className="text-xs text-muted-foreground line-clamp-2">{a.boardComment}</div>}
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              <Select value={d?.verdict || ""} onValueChange={(v) => setDraft(a.id, { verdict: v })} disabled={busy}>
                                <SelectTrigger className="h-8 w-48" data-testid={`select-verdict-${a.id}`}><SelectValue placeholder="Choose a verdict" /></SelectTrigger>
                                <SelectContent>
                                  {VERDICTS.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                                </SelectContent>
                              </Select>
                              <Textarea
                                value={d?.comment ?? ""}
                                onChange={(e) => setDraft(a.id, { comment: e.target.value })}
                                placeholder="Board comment (optional)"
                                rows={2}
                                maxLength={4000}
                                className="w-48 text-xs"
                                disabled={busy}
                                data-testid={`input-comment-${a.id}`}
                              />
                            </div>
                          )}
                        </td>
                        <td className="py-3 pr-2 text-right">
                          {locked ? (
                            <span className="text-xs text-muted-foreground">Locked</span>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => setConfirm({ type: "one", id: a.id })}
                              disabled={busy || !(d?.verdict ?? "").trim()}
                              data-testid={`button-lock-${a.id}`}
                            >
                              <Lock className="h-3.5 w-3.5 mr-1" />Lock & roll out
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!confirm} onOpenChange={(o) => { if (!o) setConfirm(null); }}>
        <AlertDialogContent data-testid="dialog-confirm-rollout">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {confirm?.type === "all" ? "Lock and roll out everyone?" : "Lock and roll out this appraisal?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.type === "all"
                ? `This applies the final decision for all ${pending.length} appraisals still to be rolled out. Each employee's new grade and pay band take effect, the appraisals are locked, and everyone is notified by email.`
                : "This applies the final decision for this employee. Their new grade and pay band take effect, the appraisal is locked, and they're notified by email. You can undo a single rollout from the KPIs page if needed."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy} data-testid="button-cancel-confirm-rollout">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (!confirm) return;
                if (confirm.type === "all") lockAll.mutate();
                else {
                  const a = appraisals.find((x) => x.id === confirm.id);
                  if (a) lockOne.mutate(a);
                }
              }}
              disabled={busy}
              data-testid="button-confirm-rollout"
            >
              {busy ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Rolling out…</> : <><Rocket className="h-4 w-4 mr-1" />Roll out</>}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
