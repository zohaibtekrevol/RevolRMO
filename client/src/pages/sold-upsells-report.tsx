import { Fragment, useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ArrowLeft,
  Download,
  FileText,
  Filter,
  X,
  Paperclip,
  Link2,
  ChevronDown,
  ChevronRight,
  Mail,
   ShoppingBag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TagBadge } from "@/components/tag-selector";
import {
  exportToCSV,
  exportToPDF,
  formatCurrencyForExport,
  formatDateForExport,
  type ExportColumn,
} from "@/lib/export-utils";
import { usePresence } from "@/hooks/use-presence";
import { ProjectDetailSheet } from "@/components/project-detail-sheet";
import type { SoldUpsell, ChangeRequestStatus, User } from "@shared/schema";

const soldStatusOptions: { value: ChangeRequestStatus; label: string; color: string }[] = [
  { value: "open", label: "Open", color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200" },
  { value: "won", label: "Won", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  { value: "lost", label: "Lost", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
];

const installmentStatusOptions: Record<string, { label: string; color: string }> = {
  planned: { label: "Planned", color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200" },
  ready_for_invoice: { label: "Ready", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  invoiced: { label: "Invoiced", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  partially_paid: { label: "Partial", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  paid: { label: "Paid", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
};

function fmtMoney(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function statusLabel(status: string) {
  return soldStatusOptions.find((s) => s.value === status)?.label || status;
}

function pmName(s: SoldUpsell): string {
  const pm = s.project?.pm;
  if (!pm) return "";
  return `${pm.firstName ?? ""} ${pm.lastName ?? ""}`.trim();
}

function getInitials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function getAvatarColor(userId: string): string {
  const colors = [
    "bg-blue-500",
    "bg-green-500",
    "bg-purple-500",
    "bg-orange-500",
    "bg-pink-500",
    "bg-teal-500",
    "bg-indigo-500",
    "bg-rose-500",
  ];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function getRoleLabel(role: string): string {
  const roleLabels: Record<string, string> = {
    admin: "Administrator",
    ceo: "CEO",
    cfo: "CFO",
    pm: "Project Manager",
    finance: "Finance",
    viewer: "Viewer",
  };
  return roleLabels[role] || role;
}

function toNum(v: string): number | null {
  if (v.trim() === "") return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

type SortBy =
  | "category"
  | "status"
  | "project"
  | "pm"
  | "title"
  | "amount"
  | "received"
  | "outstanding"
  | "dateLocked"
  | "createdAt"
  | "outcome";

interface MultiSelectFilterProps {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
  testId: string;
}

function MultiSelectFilter({ label, options, selected, onChange, testId }: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false);
  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-between font-normal"
            data-testid={`button-filter-${testId}`}
          >
            <span className="truncate">
              {selected.length === 0 ? `All ${label}` : `${selected.length} selected`}
            </span>
            <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2" align="start">
          <div className="max-h-64 overflow-y-auto space-y-1">
            {options.length === 0 && (
              <div className="text-xs text-muted-foreground px-1 py-2">No options</div>
            )}
            {options.map((opt) => (
              <label
                key={opt.value}
                className="flex items-center gap-2 rounded-sm px-1 py-1.5 text-sm hover-elevate cursor-pointer"
                data-testid={`option-filter-${testId}-${opt.value}`}
              >
                <Checkbox
                  checked={selected.includes(opt.value)}
                  onCheckedChange={() => toggle(opt.value)}
                />
                <span className="truncate">{opt.label}</span>
              </label>
            ))}
          </div>
          {selected.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-1 gap-1.5"
              onClick={() => onChange([])}
              data-testid={`button-clear-filter-${testId}`}
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </Button>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

const emptyFilters = {
  search: "",
  whatWasSold: "",
  outcome: "",
  tags: "",
  categories: [] as string[],
  statuses: [] as string[],
  projects: [] as string[],
  pms: [] as string[],
  amountMin: "",
  amountMax: "",
  receivedMin: "",
  receivedMax: "",
  outstandingMin: "",
  outstandingMax: "",
  lockedFrom: "",
  lockedTo: "",
  createdFrom: "",
  createdTo: "",
};

export default function SoldUpsellsReport() {
  const { data: soldUpsells, isLoading } = useQuery<SoldUpsell[]>({
    queryKey: ["/api/sold-upsells"],
  });
  const { data: currentUser } = useQuery<User>({ queryKey: ["/api/auth/user"] });
  const { activeUsers } = usePresence({ enabled: !!currentUser?.id });
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isProjectDetailOpen, setIsProjectDetailOpen] = useState(false);

  const [filters, setFilters] = useState(emptyFilters);
  const [sort, setSort] = useState<{ by: SortBy; dir: "asc" | "desc" }>({
    by: "dateLocked",
    dir: "desc",
  });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const data = soldUpsells || [];

  const amountOf = (s: SoldUpsell) => parseFloat(s.totalAmount?.toString() || "0");
  const receivedOf = (s: SoldUpsell) => s.receivedAmount || 0;
  const outstandingOf = (s: SoldUpsell) => amountOf(s) - receivedOf(s);

  const categoryOptions = useMemo(
    () =>
      Array.from(new Set(data.map((s) => s.category).filter(Boolean) as string[]))
        .sort()
        .map((c) => ({ value: c, label: c })),
    [data],
  );
  const projectOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of data) {
      if (s.project) map.set(s.project.id, s.project.name);
    }
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [data]);
  const pmOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of data) {
      const pm = s.project?.pm;
      if (pm) map.set(pm.id, pmName(s) || "Unknown");
    }
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [data]);

  const filtered = useMemo(() => {
    const amountMin = toNum(filters.amountMin);
    const amountMax = toNum(filters.amountMax);
    const receivedMin = toNum(filters.receivedMin);
    const receivedMax = toNum(filters.receivedMax);
    const outstandingMin = toNum(filters.outstandingMin);
    const outstandingMax = toNum(filters.outstandingMax);
    const lockedFrom = filters.lockedFrom ? new Date(filters.lockedFrom) : null;
    const lockedTo = filters.lockedTo ? new Date(filters.lockedTo + "T23:59:59") : null;
    const createdFrom = filters.createdFrom ? new Date(filters.createdFrom) : null;
    const createdTo = filters.createdTo ? new Date(filters.createdTo + "T23:59:59") : null;
    const search = filters.search.trim().toLowerCase();
    const whatWasSold = filters.whatWasSold.trim().toLowerCase();
    const outcome = filters.outcome.trim().toLowerCase();
    const tagQ = filters.tags.trim().toLowerCase();

    return data.filter((s) => {
      if (filters.categories.length && !filters.categories.includes(s.category || "")) return false;
      if (filters.statuses.length && !filters.statuses.includes(s.status || "open")) return false;
      if (filters.projects.length && !(s.project && filters.projects.includes(s.project.id))) return false;
      if (filters.pms.length && !(s.project?.pm && filters.pms.includes(s.project.pm.id))) return false;

      const amount = amountOf(s);
      const received = receivedOf(s);
      const outstanding = outstandingOf(s);
      if (amountMin !== null && amount < amountMin) return false;
      if (amountMax !== null && amount > amountMax) return false;
      if (receivedMin !== null && received < receivedMin) return false;
      if (receivedMax !== null && received > receivedMax) return false;
      if (outstandingMin !== null && outstanding < outstandingMin) return false;
      if (outstandingMax !== null && outstanding > outstandingMax) return false;

      if (lockedFrom && (!s.dateLocked || new Date(s.dateLocked) < lockedFrom)) return false;
      if (lockedTo && (!s.dateLocked || new Date(s.dateLocked) > lockedTo)) return false;
      if (createdFrom && (!s.createdAt || new Date(s.createdAt) < createdFrom)) return false;
      if (createdTo && (!s.createdAt || new Date(s.createdAt) > createdTo)) return false;

      if (whatWasSold) {
        const hay = `${s.title || ""} ${s.whatWasSold || ""} ${s.description || ""}`.toLowerCase();
        if (!hay.includes(whatWasSold)) return false;
      }
      if (outcome && !(s.outcome || "").toLowerCase().includes(outcome)) return false;
      if (tagQ && !(s.tags || []).some((t) => t.name.toLowerCase().includes(tagQ))) return false;

      if (search) {
        const hay = [
          s.title,
          s.whatWasSold,
          s.description,
          s.outcome,
          s.category,
          s.project?.name,
          s.project?.clientName,
          pmName(s),
          ...(s.tags || []).map((t) => t.name),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });
  }, [data, filters]);

  const sorted = useMemo(() => {
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sort.by) {
        case "category":
          return (a.category || "").localeCompare(b.category || "") * dir;
        case "status":
          return statusLabel(a.status || "open").localeCompare(statusLabel(b.status || "open")) * dir;
        case "project":
          return (a.project?.name || "").localeCompare(b.project?.name || "") * dir;
        case "pm":
          return pmName(a).localeCompare(pmName(b)) * dir;
        case "title":
          return (a.title || "").localeCompare(b.title || "") * dir;
        case "amount":
          return (amountOf(a) - amountOf(b)) * dir;
        case "received":
          return (receivedOf(a) - receivedOf(b)) * dir;
        case "outstanding":
          return (outstandingOf(a) - outstandingOf(b)) * dir;
        case "outcome":
          return (a.outcome || "").localeCompare(b.outcome || "") * dir;
        case "createdAt": {
          const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return (at - bt) * dir;
        }
        case "dateLocked":
        default: {
          const at = a.dateLocked ? new Date(a.dateLocked).getTime() : 0;
          const bt = b.dateLocked ? new Date(b.dateLocked).getTime() : 0;
          return (at - bt) * dir;
        }
      }
    });
  }, [filtered, sort]);

  const totalAmount = filtered.reduce((sum, s) => sum + amountOf(s), 0);
  const totalReceived = filtered.reduce((sum, s) => sum + receivedOf(s), 0);
  const totalOutstanding = totalAmount - totalReceived;

  const hasActiveFilters =
    filters.search !== "" ||
    filters.whatWasSold !== "" ||
    filters.outcome !== "" ||
    filters.tags !== "" ||
    filters.categories.length > 0 ||
    filters.statuses.length > 0 ||
    filters.projects.length > 0 ||
    filters.pms.length > 0 ||
    filters.amountMin !== "" ||
    filters.amountMax !== "" ||
    filters.receivedMin !== "" ||
    filters.receivedMax !== "" ||
    filters.outstandingMin !== "" ||
    filters.outstandingMax !== "" ||
    filters.lockedFrom !== "" ||
    filters.lockedTo !== "" ||
    filters.createdFrom !== "" ||
    filters.createdTo !== "";

  const toggleSort = (by: SortBy) => {
    setSort((prev) =>
      prev.by === by
        ? { by, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { by, dir: "asc" },
    );
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exportColumns: ExportColumn[] = [
    { header: "Category", accessor: (s: SoldUpsell) => s.category || "" },
    { header: "Status", accessor: (s: SoldUpsell) => statusLabel(s.status || "open") },
    { header: "Project", accessor: (s: SoldUpsell) => s.project?.name || "" },
    { header: "Client", accessor: (s: SoldUpsell) => s.project?.clientName || "" },
    { header: "PM", accessor: (s: SoldUpsell) => pmName(s) },
    { header: "Title", accessor: (s: SoldUpsell) => s.title || "" },
    { header: "What was sold", accessor: (s: SoldUpsell) => s.whatWasSold || "" },
    { header: "Description", accessor: (s: SoldUpsell) => s.description || "" },
    { header: "Tags", accessor: (s: SoldUpsell) => (s.tags || []).map((t) => t.name).join(", ") },
    { header: "Amount", accessor: (s: SoldUpsell) => formatCurrencyForExport(amountOf(s)) },
    { header: "Received", accessor: (s: SoldUpsell) => formatCurrencyForExport(receivedOf(s)) },
    { header: "Outstanding", accessor: (s: SoldUpsell) => formatCurrencyForExport(outstandingOf(s)) },
    { header: "Date Locked", accessor: (s: SoldUpsell) => formatDateForExport(s.dateLocked) },
    { header: "Created", accessor: (s: SoldUpsell) => formatDateForExport(s.createdAt) },
    { header: "Outcome", accessor: (s: SoldUpsell) => s.outcome || "" },
    {
      header: "Installments",
      accessor: (s: SoldUpsell) =>
        (s.installments || [])
          .map(
            (i) =>
              `${i.name}: ${formatCurrencyForExport(parseFloat(i.expectedAmount?.toString() || "0"))} due ${formatDateForExport(i.dueDate)} | paid ${formatCurrencyForExport(parseFloat(i.receivedAmount?.toString() || "0"))} (${installmentStatusOptions[i.status]?.label || i.status})`,
          )
          .join(" ; "),
    },
  ];

  const handleExportCSV = () => {
    exportToCSV(sorted, exportColumns, `sold-upsells-report-${format(new Date(), "yyyy-MM-dd")}`);
  };

  const handleExportPDF = () => {
    exportToPDF(
      sorted,
      exportColumns,
      `sold-upsells-report-${format(new Date(), "yyyy-MM-dd")}`,
      "Sold Upsells Report",
    );
  };

  const sortIndicator = (by: SortBy) =>
    sort.by === by ? (sort.dir === "asc" ? " ▲" : " ▼") : "";

  const SortableHead = ({ by, children, className }: { by: SortBy; children: React.ReactNode; className?: string }) => (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => toggleSort(by)}
        className="inline-flex items-center font-medium hover:text-foreground"
        data-testid={`sort-${by}`}
      >
        {children}
        <span className="text-xs">{sortIndicator(by)}</span>
      </button>
    </TableHead>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="px-4 sm:px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Link href="/upsells">
              <Button variant="ghost" size="sm" className="gap-1.5" data-testid="link-back-upsells">
                <ArrowLeft className="h-4 w-4" />
                Back to Upsells
              </Button>
            </Link>
            <div>
              <h1 className="text-lg font-bold leading-tight" data-testid="text-report-title">
                Sold Upsells Report
              </h1>
              <p className="text-xs text-muted-foreground">All locked change requests in full detail</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExportCSV} data-testid="button-export-csv">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExportPDF} data-testid="button-export-pdf">
              <FileText className="h-4 w-4" />
              Export PDF
            </Button>
          </div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-6 space-y-4">
        <div className="rounded-md border bg-card p-4 space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Filter className="h-4 w-4" />
              Filters
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setFilters(emptyFilters)} data-testid="button-clear-all-filters">
                <X className="h-4 w-4" />
                Clear all filters
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Search</Label>
              <Input
                placeholder="Search everything..."
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                data-testid="input-search"
              />
            </div>
            <MultiSelectFilter
              label="Category"
              options={categoryOptions}
              selected={filters.categories}
              onChange={(v) => setFilters((f) => ({ ...f, categories: v }))}
              testId="category"
            />
            <MultiSelectFilter
              label="Status"
              options={soldStatusOptions.map((s) => ({ value: s.value, label: s.label }))}
              selected={filters.statuses}
              onChange={(v) => setFilters((f) => ({ ...f, statuses: v }))}
              testId="status"
            />
            <MultiSelectFilter
              label="Project"
              options={projectOptions}
              selected={filters.projects}
              onChange={(v) => setFilters((f) => ({ ...f, projects: v }))}
              testId="project"
            />
            <MultiSelectFilter
              label="Project Manager"
              options={pmOptions}
              selected={filters.pms}
              onChange={(v) => setFilters((f) => ({ ...f, pms: v }))}
              testId="pm"
            />
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">What was sold contains</Label>
              <Input
                placeholder="Title / description..."
                value={filters.whatWasSold}
                onChange={(e) => setFilters((f) => ({ ...f, whatWasSold: e.target.value }))}
                data-testid="input-what-was-sold"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Tags contain</Label>
              <Input
                placeholder="Tag name..."
                value={filters.tags}
                onChange={(e) => setFilters((f) => ({ ...f, tags: e.target.value }))}
                data-testid="input-tags"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Outcome contains</Label>
              <Input
                placeholder="Outcome..."
                value={filters.outcome}
                onChange={(e) => setFilters((f) => ({ ...f, outcome: e.target.value }))}
                data-testid="input-outcome"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Amount (min / max)</Label>
              <div className="flex items-center gap-2">
                <Input type="number" placeholder="Min" value={filters.amountMin} onChange={(e) => setFilters((f) => ({ ...f, amountMin: e.target.value }))} data-testid="input-amount-min" />
                <Input type="number" placeholder="Max" value={filters.amountMax} onChange={(e) => setFilters((f) => ({ ...f, amountMax: e.target.value }))} data-testid="input-amount-max" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Received (min / max)</Label>
              <div className="flex items-center gap-2">
                <Input type="number" placeholder="Min" value={filters.receivedMin} onChange={(e) => setFilters((f) => ({ ...f, receivedMin: e.target.value }))} data-testid="input-received-min" />
                <Input type="number" placeholder="Max" value={filters.receivedMax} onChange={(e) => setFilters((f) => ({ ...f, receivedMax: e.target.value }))} data-testid="input-received-max" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Outstanding (min / max)</Label>
              <div className="flex items-center gap-2">
                <Input type="number" placeholder="Min" value={filters.outstandingMin} onChange={(e) => setFilters((f) => ({ ...f, outstandingMin: e.target.value }))} data-testid="input-outstanding-min" />
                <Input type="number" placeholder="Max" value={filters.outstandingMax} onChange={(e) => setFilters((f) => ({ ...f, outstandingMax: e.target.value }))} data-testid="input-outstanding-max" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Date locked (from / to)</Label>
              <div className="flex items-center gap-2">
                <Input type="date" value={filters.lockedFrom} onChange={(e) => setFilters((f) => ({ ...f, lockedFrom: e.target.value }))} data-testid="input-locked-from" />
                <Input type="date" value={filters.lockedTo} onChange={(e) => setFilters((f) => ({ ...f, lockedTo: e.target.value }))} data-testid="input-locked-to" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Created (from / to)</Label>
              <div className="flex items-center gap-2">
                <Input type="date" value={filters.createdFrom} onChange={(e) => setFilters((f) => ({ ...f, createdFrom: e.target.value }))} data-testid="input-created-from" />
                <Input type="date" value={filters.createdTo} onChange={(e) => setFilters((f) => ({ ...f, createdTo: e.target.value }))} data-testid="input-created-to" />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 flex-wrap text-sm">
          <div className="text-muted-foreground" data-testid="text-summary">
            Showing <span className="font-semibold text-foreground" data-testid="text-summary-count">{filtered.length}</span> of {data.length} sold upsells
            {" · "}Total amount <span className="font-semibold text-foreground" data-testid="text-summary-amount">{fmtMoney(totalAmount)}</span>
            {" · "}Received <span className="font-semibold text-green-600" data-testid="text-summary-received">{fmtMoney(totalReceived)}</span>
            {" · "}Outstanding <span className="font-semibold text-foreground" data-testid="text-summary-outstanding">{fmtMoney(totalOutstanding)}</span>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : sorted.length > 0 ? (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <SortableHead by="project">Project / Client</SortableHead>
                  <SortableHead by="category">Category</SortableHead>
                  <SortableHead by="status">Status</SortableHead>
                  <TableHead className="w-[52px] text-center">PM</TableHead>
                  <SortableHead by="title">What was sold</SortableHead>
                  <TableHead>Tags</TableHead>
                  <SortableHead by="amount" className="text-right">Amount</SortableHead>
                  <SortableHead by="received" className="text-right">Received</SortableHead>
                  <SortableHead by="outstanding" className="text-right">Outstanding</SortableHead>
                  <SortableHead by="dateLocked">Locked</SortableHead>
                  <SortableHead by="createdAt">Created</SortableHead>
                  <SortableHead by="outcome">Outcome</SortableHead>
                  <TableHead>Files</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((s) => {
                  const installments = s.installments || [];
                  const isOpen = expanded.has(s.id);
                  return (
                    <Fragment key={s.id}>
                      <TableRow data-testid={`row-sold-${s.id}`}>
                        <TableCell className="align-top">
                          {installments.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => toggleExpand(s.id)}
                              className="text-muted-foreground hover:text-foreground"
                              aria-label="Toggle installments"
                              data-testid={`button-expand-${s.id}`}
                            >
                              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                          ) : null}
                        </TableCell>
                        <TableCell className="align-top min-w-[12rem]">
                          {s.project ? (
                            <>
                              <button
                                type="button"
                                className="font-medium text-sm text-primary hover:underline text-left leading-snug"
                                onClick={() => { setSelectedProjectId(s.project!.id); setIsProjectDetailOpen(true); }}
                                data-testid={`link-project-${s.id}`}
                              >
                                {s.project.name}
                              </button>
                              <div className="text-sm text-muted-foreground">{s.project.clientName || ""}</div>
                            </>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="align-top">
                          {s.category ? (
                            <Badge variant="secondary" data-testid={`badge-category-${s.id}`}>{s.category}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell className="align-top">
                          <Badge
                            className={`${soldStatusOptions.find((o) => o.value === (s.status || "open"))?.color || ""} no-default-hover-elevate no-default-active-elevate`}
                            data-testid={`badge-status-${s.id}`}
                          >
                            {statusLabel(s.status || "open")}
                          </Badge>
                        </TableCell>
                        <TableCell className="align-top text-center">
                          {s.project?.pm ? (() => {
                            const pm = s.project!.pm!;
                            const name = pmName(s);
                            const isOnline = activeUsers.some((u) => u.odUserId === pm.id);
                            return (
                              <HoverCard openDelay={200} closeDelay={100}>
                                <HoverCardTrigger asChild>
                                  <Avatar
                                    className={`h-8 w-8 cursor-pointer ${getAvatarColor(pm.id)}`}
                                    data-testid={`avatar-pm-${s.id}`}
                                  >
                                    <AvatarFallback className="text-white text-xs font-medium bg-transparent">
                                      {getInitials(name)}
                                    </AvatarFallback>
                                  </Avatar>
                                </HoverCardTrigger>
                                <HoverCardContent side="top" align="center" className="w-72 p-4">
                                  <div className="flex gap-4">
                                    <Avatar className={`h-14 w-14 ${getAvatarColor(pm.id)}`}>
                                      <AvatarFallback className="text-white text-lg font-medium bg-transparent">
                                        {getInitials(name)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 space-y-1">
                                      <h4 className="text-sm font-semibold">{name || "—"}</h4>
                                      <p className="text-xs text-muted-foreground">{getRoleLabel(pm.role || "")}</p>
                                      {pm.email && (
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                          <Mail className="h-3 w-3" />
                                          <span className="truncate">{pm.email}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  {isOnline && (
                                    <div className="mt-3 pt-3 border-t">
                                      <div className="flex items-center gap-1.5">
                                        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                                        <span className="text-xs text-muted-foreground">Currently online</span>
                                      </div>
                                    </div>
                                  )}
                                </HoverCardContent>
                              </HoverCard>
                            );
                          })() : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="align-top min-w-[14rem] max-w-[20rem]">
                          <div className="font-medium" data-testid={`text-title-${s.id}`}>{s.title}</div>
                          {s.whatWasSold && <div className="text-sm text-muted-foreground whitespace-pre-wrap">{s.whatWasSold}</div>}
                          {s.description && <div className="text-sm text-muted-foreground whitespace-pre-wrap" data-testid={`text-description-${s.id}`}>{s.description}</div>}
                        </TableCell>
                        <TableCell className="align-top max-w-[14rem]">
                          {s.tags && s.tags.length > 0 ? (
                            <div className="flex flex-wrap gap-1" data-testid={`tags-${s.id}`}>
                              {s.tags.map((tag) => (
                                <TagBadge key={tag.id} tag={tag} />
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell className="align-top text-right font-mono" data-testid={`text-amount-${s.id}`}>{fmtMoney(amountOf(s))}</TableCell>
                        <TableCell className="align-top text-right font-mono text-green-600" data-testid={`text-received-${s.id}`}>{fmtMoney(receivedOf(s))}</TableCell>
                        <TableCell className="align-top text-right font-mono" data-testid={`text-outstanding-${s.id}`}>{fmtMoney(outstandingOf(s))}</TableCell>
                        <TableCell className="align-top text-sm whitespace-nowrap">{s.dateLocked ? format(new Date(s.dateLocked), "MMM d, yyyy") : "—"}</TableCell>
                        <TableCell className="align-top text-sm whitespace-nowrap">{s.createdAt ? format(new Date(s.createdAt), "MMM d, yyyy") : "—"}</TableCell>
                        <TableCell className="align-top max-w-[14rem]">
                          <span className="text-sm text-muted-foreground whitespace-pre-wrap">{s.outcome || "—"}</span>
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="flex items-center gap-2">
                            {(s.attachmentDriveLink || s.attachmentDriveId || s.attachmentPath) ? (
                              <a
                                href={s.attachmentDriveLink || (s.attachmentDriveId ? `/api/change-requests/${s.id}/attachment` : s.attachmentPath!)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                                title={s.attachmentName || "Attachment"}
                                data-testid={`link-attachment-${s.id}`}
                              >
                                <Paperclip className="h-4 w-4" />
                              </a>
                            ) : null}
                            {s.pandadocLink ? (
                              <a href={s.pandadocLink} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" title="PandaDoc" data-testid={`link-pandadoc-${s.id}`}>
                                <Link2 className="h-4 w-4" />
                              </a>
                            ) : null}
                            {!s.attachmentDriveLink && !s.attachmentDriveId && !s.attachmentPath && !s.pandadocLink && (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      {isOpen && installments.length > 0 && (
                        <TableRow key={`${s.id}-installments`} data-testid={`row-installments-${s.id}`}>
                          <TableCell />
                          <TableCell colSpan={13} className="bg-muted/30">
                            <div className="py-2">
                              <div className="text-xs font-medium text-muted-foreground mb-2">
                                Installments ({installments.length})
                              </div>
                              <div className="rounded-md border bg-background overflow-x-auto">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>#</TableHead>
                                      <TableHead>Name</TableHead>
                                      <TableHead className="text-right">Amount</TableHead>
                                      <TableHead>Due date</TableHead>
                                      <TableHead className="text-right">Paid amount</TableHead>
                                      <TableHead>Paid status</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {[...installments]
                                      .sort((a, b) => (a.sequenceNumber || 0) - (b.sequenceNumber || 0))
                                      .map((inst) => {
                                        const so = installmentStatusOptions[inst.status];
                                        return (
                                          <TableRow key={inst.id} data-testid={`row-installment-${inst.id}`}>
                                            <TableCell className="text-sm">{inst.sequenceNumber}</TableCell>
                                            <TableCell className="text-sm">{inst.name}</TableCell>
                                            <TableCell className="text-right font-mono text-sm">{fmtMoney(parseFloat(inst.expectedAmount?.toString() || "0"))}</TableCell>
                                            <TableCell className="text-sm whitespace-nowrap">{inst.dueDate ? format(new Date(inst.dueDate), "MMM d, yyyy") : "—"}</TableCell>
                                            <TableCell className="text-right font-mono text-sm text-green-600">{fmtMoney(parseFloat(inst.receivedAmount?.toString() || "0"))}</TableCell>
                                            <TableCell>
                                              <Badge className={`${so?.color || ""} no-default-hover-elevate no-default-active-elevate`}>
                                                {so?.label || inst.status}
                                              </Badge>
                                            </TableCell>
                                          </TableRow>
                                        );
                                      })}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-16 text-muted-foreground border rounded-md">
            <ShoppingBag className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>{data.length === 0 ? "No sold upsells yet" : "No sold upsells match the current filters"}</p>
          </div>
        )}
      </main>
      <ProjectDetailSheet
        projectId={selectedProjectId}
        open={isProjectDetailOpen}
        onOpenChange={setIsProjectDetailOpen}
      />
    </div>
  );
}
