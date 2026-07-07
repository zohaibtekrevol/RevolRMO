import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient, apiRequest, getErrorMessage } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, Users2, Crown, Calendar, X, History, Save } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import type { Pod, User, PodMembership } from "@shared/schema";

const podFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  description: z.string().optional(),
  leadId: z.string().nullable().optional(),
  defaultT1: z.string().min(1, "T1 is required"),
  defaultT2: z.string().min(1, "T2 is required"),
  isActive: z.boolean().default(true),
});
type PodFormValues = z.infer<typeof podFormSchema>;

const NONE = "__none__";

export default function AdminPodsPage() {
  const { toast } = useToast();
  const [editingPod, setEditingPod] = useState<Pod | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Pod | null>(null);

  const podsQuery = useQuery<Pod[]>({ queryKey: ["/api/pods"] });
  const usersQuery = useQuery<User[]>({ queryKey: ["/api/users"] });

  const usersById = useMemo(() => {
    const m = new Map<string, User>();
    (usersQuery.data ?? []).forEach((u) => m.set(u.id, u));
    return m;
  }, [usersQuery.data]);

  const membersByPod = useMemo(() => {
    const m = new Map<string, User[]>();
    (usersQuery.data ?? []).forEach((u) => {
      if (!u.podId) return;
      const arr = m.get(u.podId) ?? [];
      arr.push(u);
      m.set(u.podId, arr);
    });
    return m;
  }, [usersQuery.data]);

  const deletePod = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/pods/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pods"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "POD deleted" });
      setDeleteTarget(null);
    },
    onError: (err) => {
      toast({ title: "Failed to delete POD", description: getErrorMessage(err, "Try again"), variant: "destructive" });
    },
  });

  const fullName = (u?: User | null) =>
    u ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email || "User" : "—";

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-page-title">PODs</h1>
          <p className="text-sm text-muted-foreground">Manage delivery PODs, their leads, members, and T1/T2 targets.</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} data-testid="button-create-pod">
          <Plus className="h-4 w-4 mr-2" /> New POD
        </Button>
      </div>

      {podsQuery.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : (podsQuery.data ?? []).length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <Users2 className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>No PODs yet. Create your first POD to start tracking team targets.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {(podsQuery.data ?? []).map((pod) => {
            const members = membersByPod.get(pod.id) ?? [];
            const lead = pod.leadId ? usersById.get(pod.leadId) : null;
            return (
              <Card key={pod.id} data-testid={`card-pod-${pod.id}`}>
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      {pod.name}
                      {!pod.isActive && <Badge variant="secondary">Inactive</Badge>}
                    </CardTitle>
                    {pod.description && (
                      <p className="text-xs text-muted-foreground mt-1">{pod.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setEditingPod(pod)} data-testid={`button-edit-pod-${pod.id}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(pod)} data-testid={`button-delete-pod-${pod.id}`}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Crown className="h-4 w-4 text-amber-500" />
                    <span className="text-muted-foreground">Lead:</span>
                    <span data-testid={`text-pod-lead-${pod.id}`}>{fullName(lead)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Members:</span>
                    <span data-testid={`text-pod-members-count-${pod.id}`}>{members.length}</span>
                    {members.length > 0 && (
                      <span className="text-xs text-muted-foreground truncate">
                        ({members.map(fullName).join(", ")})
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                    <div>
                      <div className="text-xs text-muted-foreground">T1 (Baseline)</div>
                      <div className="font-semibold" data-testid={`text-pod-t1-${pod.id}`}>
                        ${Number(pod.defaultT1).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">T2 (Stretch)</div>
                      <div className="font-semibold" data-testid={`text-pod-t2-${pod.id}`}>
                        ${Number(pod.defaultT2).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <PodFormDialog
        open={isCreateOpen || editingPod !== null}
        pod={editingPod}
        users={usersQuery.data ?? []}
        membersByPod={membersByPod}
        onClose={() => {
          setIsCreateOpen(false);
          setEditingPod(null);
        }}
      />

      <AlertDialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete POD?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && `"${deleteTarget.name}" will be removed. Member PMs will be detached but not deleted.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-pod">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deletePod.mutate(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-pod"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PodFormDialog({
  open,
  pod,
  users,
  membersByPod,
  onClose,
}: {
  open: boolean;
  pod: Pod | null;
  users: User[];
  membersByPod: Map<string, User[]>;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const isEdit = !!pod;

  const defaults: PodFormValues = useMemo(
    () => ({
      name: pod?.name ?? "",
      description: pod?.description ?? "",
      leadId: pod?.leadId ?? null,
      defaultT1: pod ? String(pod.defaultT1) : "0",
      defaultT2: pod ? String(pod.defaultT2) : "0",
      isActive: pod?.isActive ?? true,
    }),
    [pod],
  );

  const form = useForm<PodFormValues>({
    resolver: zodResolver(podFormSchema),
    defaultValues: defaults,
    values: defaults,
  });

  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(() => {
    if (!pod) return new Set();
    return new Set((membersByPod.get(pod.id) ?? []).map((u) => u.id));
  });

  // Re-init selected members when pod changes
  useMemo(() => {
    setSelectedMembers(new Set((pod ? membersByPod.get(pod.id) ?? [] : []).map((u) => u.id)));
  }, [pod, membersByPod]);

  // Attribution prompt state for moving PMs in from another POD.
  const now = new Date();
  const [pendingValues, setPendingValues] = useState<PodFormValues | null>(null);
  const [moveMode, setMoveMode] = useState<"move_all" | "keep_previous">("keep_previous");
  const [effMonth, setEffMonth] = useState<number>(now.getMonth() + 1);
  const [effYear, setEffYear] = useState<number>(now.getFullYear());

  // PM whose POD membership history is being inspected/edited.
  const [historyPm, setHistoryPm] = useState<User | null>(null);

  const mutation = useMutation({
    mutationFn: async ({
      values,
      strategy,
    }: {
      values: PodFormValues;
      strategy?: { mode: "move_all" | "keep_previous"; effMonth?: number; effYear?: number };
    }) => {
      const payload: Record<string, unknown> = {
        ...values,
        leadId: values.leadId ?? null,
        memberIds: Array.from(selectedMembers),
      };
      if (strategy) payload.memberMoveStrategy = strategy;
      if (isEdit && pod) {
        await apiRequest("PATCH", `/api/pods/${pod.id}`, payload);
      } else {
        await apiRequest("POST", "/api/pods", payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pods"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pods/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pods/stats/range"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pods/stats/trend"] });
      toast({ title: isEdit ? "POD updated" : "POD created" });
      setPendingValues(null);
      onClose();
    },
    onError: (err) => {
      toast({ title: "Save failed", description: getErrorMessage(err, "Try again"), variant: "destructive" });
    },
  });

  const podsQueryAll = useQuery<Pod[]>({ queryKey: ["/api/pods"] });
  const podNameById = new Map((podsQueryAll.data ?? []).map((p) => [p.id, p.name]));

  // Include every active PM (whichever POD they're in) so the admin can move them,
  // PLUS anyone already assigned to THIS POD regardless of status/role — otherwise a
  // blocked or role-changed member would vanish from the list and could never be removed.
  const candidatePms = users.filter(
    (u) =>
      (u.status === "active" && u.isProjectManager) ||
      u.podId === pod?.id,
  );

  const toggleMember = (id: string) => {
    const next = new Set(selectedMembers);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedMembers(next);
  };

  const fullName = (u: User) =>
    `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email || "User";

  // PMs being pulled in from a different POD (their existing data needs a decision).
  const movedPms = users.filter(
    (u) => selectedMembers.has(u.id) && !!u.podId && u.podId !== pod?.id,
  );

  const handleSubmit = (values: PodFormValues) => {
    if (movedPms.length > 0) {
      // Fresh decision each time the prompt opens.
      setMoveMode("keep_previous");
      setEffMonth(new Date().getMonth() + 1);
      setEffYear(new Date().getFullYear());
      setPendingValues(values);
    } else {
      mutation.mutate({ values });
    }
  };

  const confirmMove = () => {
    if (!pendingValues) return;
    const strategy =
      moveMode === "keep_previous"
        ? { mode: "keep_previous" as const, effMonth, effYear }
        : { mode: "move_all" as const };
    mutation.mutate({ values: pendingValues, strategy });
  };

  return (
    <>
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit POD" : "Create POD"}</DialogTitle>
          <DialogDescription>
            Configure the team lead, default monthly targets, and member PMs.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>POD Name</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-pod-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value ?? ""} rows={2} data-testid="input-pod-description" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="leadId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Team Lead</FormLabel>
                  <Select
                    value={field.value ?? NONE}
                    onValueChange={(v) => field.onChange(v === NONE ? null : v)}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-pod-lead">
                        <SelectValue placeholder="Select lead" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE}>No lead</SelectItem>
                      {users
                        .filter((u) => u.status === "active")
                        .map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {fullName(u)}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="defaultT1"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default T1 (Baseline)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} data-testid="input-pod-t1" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="defaultT2"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default T2 (Stretch)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} data-testid="input-pod-t2" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="checkbox-pod-active"
                    />
                  </FormControl>
                  <FormLabel className="!mt-0">Active</FormLabel>
                </FormItem>
              )}
            />
            <div className="space-y-2">
              <Label>Members (PMs)</Label>
              <p className="text-xs text-muted-foreground">
                A PM belongs to at most one POD — assigning them here moves them from any current POD.
              </p>
              <div className="border rounded-md max-h-56 overflow-y-auto divide-y">
                {candidatePms.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-4">No PM-eligible users found.</p>
                ) : (
                  candidatePms.map((u) => {
                    const checked = selectedMembers.has(u.id);
                    const otherPodId = u.podId && u.podId !== pod?.id ? u.podId : null;
                    return (
                      <label
                        key={u.id}
                        className="flex items-center gap-3 p-2 cursor-pointer hover-elevate"
                        data-testid={`row-pod-member-${u.id}`}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleMember(u.id)}
                          data-testid={`checkbox-pod-member-${u.id}`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm truncate">{fullName(u)}</div>
                          {u.email && <div className="text-xs text-muted-foreground truncate">{u.email}</div>}
                        </div>
                        {u.status === "blocked" ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] border-destructive/40 text-destructive"
                            data-testid={`badge-blocked-${u.id}`}
                          >
                            blocked — uncheck to remove
                          </Badge>
                        ) : (
                          u.role !== "pm" &&
                          u.role !== "project_manager" && (
                            <Badge
                              variant="outline"
                              className="text-[10px] border-muted-foreground/40 text-muted-foreground"
                              data-testid={`badge-inactive-role-${u.id}`}
                            >
                              not a PM — uncheck to remove
                            </Badge>
                          )
                        )}
                        {otherPodId && (
                          <Badge
                            variant="outline"
                            className="text-[10px] border-amber-500/40 text-amber-700 dark:text-amber-400"
                            data-testid={`badge-move-${u.id}`}
                          >
                            currently in {podNameById.get(otherPodId) ?? "another POD"} — move?
                          </Badge>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          title="View POD history"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setHistoryPm(u);
                          }}
                          data-testid={`button-pod-history-${u.id}`}
                        >
                          <History className="h-4 w-4" />
                        </Button>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose} data-testid="button-cancel-pod">
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending} data-testid="button-save-pod">
                {mutation.isPending ? "Saving..." : isEdit ? "Save changes" : "Create POD"}
              </Button>
            </DialogFooter>
          </form>
        </Form>

        {isEdit && pod && <OverridesPanel podId={pod.id} defaultT1={pod.defaultT1} defaultT2={pod.defaultT2} />}
      </DialogContent>
    </Dialog>

    <AlertDialog open={!!pendingValues} onOpenChange={(o) => !o && !mutation.isPending && setPendingValues(null)}>
      <AlertDialogContent data-testid="dialog-move-attribution">
        <AlertDialogHeader>
          <AlertDialogTitle>Move PM data between PODs?</AlertDialogTitle>
          <AlertDialogDescription>
            {movedPms.length === 1
              ? `${fullName(movedPms[0])} is currently in another POD.`
              : `${movedPms.length} PMs are currently in another POD.`}{" "}
            Choose how their existing data should be attributed.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3 py-1">
          <button
            type="button"
            onClick={() => setMoveMode("keep_previous")}
            className={`w-full text-left rounded-md border p-3 hover-elevate ${
              moveMode === "keep_previous" ? "border-primary ring-1 ring-primary" : "border-border"
            }`}
            data-testid="option-keep-previous"
          >
            <div className="text-sm font-medium">Keep previous data with the old POD</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Only data from the effective month forward counts for the new POD.
            </div>
          </button>

          {moveMode === "keep_previous" && (
            <div className="flex gap-2 pl-3">
              <div className="space-y-1">
                <Label className="text-xs">Effective from</Label>
                <Select value={String(effMonth)} onValueChange={(v) => setEffMonth(parseInt(v))}>
                  <SelectTrigger className="w-36" data-testid="select-eff-month">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {monthNamesShort.map((n, i) => (
                      <SelectItem key={i} value={String(i + 1)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Year</Label>
                <Input
                  type="number"
                  className="w-24"
                  min={2000}
                  max={2100}
                  value={effYear}
                  onChange={(e) => setEffYear(parseInt(e.target.value) || effYear)}
                  data-testid="input-eff-year"
                />
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setMoveMode("move_all")}
            className={`w-full text-left rounded-md border p-3 hover-elevate ${
              moveMode === "move_all" ? "border-primary ring-1 ring-primary" : "border-border"
            }`}
            data-testid="option-move-all"
          >
            <div className="text-sm font-medium">Move all previous data to the new POD</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              The PM's full history counts toward the new POD.
            </div>
          </button>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending} data-testid="button-cancel-move">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction onClick={confirmMove} disabled={mutation.isPending} data-testid="button-confirm-move">
            {mutation.isPending ? "Saving..." : "Confirm"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <PodHistoryDialog
      pm={historyPm}
      pods={podsQueryAll.data ?? []}
      onClose={() => setHistoryPm(null)}
    />
    </>
  );
}

type Override = { id: string; month: number; year: number; t1: string | null; t2: string | null };
type PodWithOverrides = Pod & { overrides: Override[] };

const monthNamesShort = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function OverridesPanel({ podId, defaultT1, defaultT2 }: { podId: string; defaultT1: string; defaultT2: string }) {
  const { toast } = useToast();
  const now = new Date();
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [year, setYear] = useState<number>(now.getFullYear());
  const [t1, setT1] = useState<string>(defaultT1);
  const [t2, setT2] = useState<string>(defaultT2);

  const detailQuery = useQuery<PodWithOverrides>({
    queryKey: ["/api/pods", podId],
  });

  const upsert = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/pods/${podId}/overrides`, {
        month, year, t1, t2,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pods", podId] });
      queryClient.invalidateQueries({ queryKey: ["/api/pods/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pods/stats/range"] });
      toast({ title: "Override saved" });
    },
    onError: (err) => {
      toast({ title: "Save failed", description: getErrorMessage(err, "Try again"), variant: "destructive" });
    },
  });

  const remove = useMutation({
    mutationFn: async (o: { month: number; year: number }) => {
      await apiRequest("DELETE", `/api/pods/${podId}/overrides/${o.month}/${o.year}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pods", podId] });
      queryClient.invalidateQueries({ queryKey: ["/api/pods/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pods/stats/range"] });
      toast({ title: "Override removed" });
    },
    onError: (err) => {
      toast({ title: "Delete failed", description: getErrorMessage(err, "Try again"), variant: "destructive" });
    },
  });

  const overrides = detailQuery.data?.overrides ?? [];

  return (
    <div className="border-t pt-4 mt-4 space-y-3">
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Monthly target overrides</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Replace the default T1/T2 for specific months. If no override exists, the POD defaults apply.
      </p>

      <div className="grid grid-cols-12 gap-2 items-end">
        <div className="col-span-4 space-y-1">
          <Label className="text-xs">Month</Label>
          <Select value={String(month)} onValueChange={(v) => setMonth(parseInt(v))}>
            <SelectTrigger data-testid="select-override-month"><SelectValue /></SelectTrigger>
            <SelectContent>
              {monthNamesShort.map((n, i) => <SelectItem key={i} value={String(i + 1)}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Year</Label>
          <Input type="number" value={year} onChange={(e) => setYear(parseInt(e.target.value) || year)} data-testid="input-override-year" />
        </div>
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">T1</Label>
          <Input type="number" step="0.01" value={t1} onChange={(e) => setT1(e.target.value)} data-testid="input-override-t1" />
        </div>
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">T2</Label>
          <Input type="number" step="0.01" value={t2} onChange={(e) => setT2(e.target.value)} data-testid="input-override-t2" />
        </div>
        <div className="col-span-2">
          <Button
            type="button"
            size="sm"
            onClick={() => upsert.mutate()}
            disabled={upsert.isPending || !t1 || !t2}
            className="w-full"
            data-testid="button-add-override"
          >
            <Plus className="h-4 w-4 mr-1" /> Set
          </Button>
        </div>
      </div>

      {detailQuery.isLoading ? (
        <Skeleton className="h-20 w-full" />
      ) : overrides.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No overrides set — using defaults for every month.</p>
      ) : (
        <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
          {overrides.map((o) => (
            <div key={o.id} className="flex items-center justify-between p-2 text-sm" data-testid={`row-override-${o.id}`}>
              <span className="font-medium w-32">{monthNamesShort[o.month - 1]} {o.year}</span>
              <span className="text-muted-foreground flex-1">
                T1 <span className="font-semibold text-foreground">${Number(o.t1 ?? defaultT1).toLocaleString()}</span>
                {" · "}
                T2 <span className="font-semibold text-foreground">${Number(o.t2 ?? defaultT2).toLocaleString()}</span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => remove.mutate({ month: o.month, year: o.year })}
                disabled={remove.isPending}
                data-testid={`button-delete-override-${o.id}`}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const OPEN = "__open__";

type BoundaryDraft = { month: string; year: string };
type MembershipDraft = {
  podId: string;
  start: BoundaryDraft;
  end: BoundaryDraft;
};

function boundaryFromRow(month: number | null, year: number | null): BoundaryDraft {
  if (month == null || year == null) return { month: OPEN, year: "" };
  return { month: String(month), year: String(year) };
}

function formatBoundary(month: number | null, year: number | null, openLabel: string): string {
  if (month == null || year == null) return openLabel;
  return `${monthNamesShort[month - 1]} ${year}`;
}

function formatRange(row: PodMembership): string {
  const hasStart = row.startMonth != null && row.startYear != null;
  const hasEnd = row.endMonth != null && row.endYear != null;
  if (!hasStart && !hasEnd) return "All months";
  if (!hasStart) return `Through ${formatBoundary(row.endMonth, row.endYear, "")}`;
  if (!hasEnd) return `${formatBoundary(row.startMonth, row.startYear, "")} onward`;
  return `${formatBoundary(row.startMonth, row.startYear, "")} – ${formatBoundary(row.endMonth, row.endYear, "")}`;
}

function BoundaryFields({
  label,
  value,
  onChange,
  testidPrefix,
}: {
  label: string;
  value: BoundaryDraft;
  onChange: (next: BoundaryDraft) => void;
  testidPrefix: string;
}) {
  const isOpen = value.month === OPEN;
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-2">
        <Select
          value={value.month}
          onValueChange={(v) => onChange({ month: v, year: v === OPEN ? "" : value.year })}
        >
          <SelectTrigger className="w-32" data-testid={`${testidPrefix}-month`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={OPEN}>Open</SelectItem>
            {monthNamesShort.map((n, i) => (
              <SelectItem key={i} value={String(i + 1)}>{n}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="number"
          className="w-24"
          min={2000}
          max={2100}
          placeholder="Year"
          disabled={isOpen}
          value={value.year}
          onChange={(e) => onChange({ ...value, year: e.target.value })}
          data-testid={`${testidPrefix}-year`}
        />
      </div>
    </div>
  );
}

function emptyDraft(pods: Pod[]): MembershipDraft {
  return {
    podId: pods[0]?.id ?? "",
    start: { month: OPEN, year: "" },
    end: { month: OPEN, year: "" },
  };
}

function PodHistoryDialog({
  pm,
  pods,
  onClose,
}: {
  pm: User | null;
  pods: Pod[];
  onClose: () => void;
}) {
  const { toast } = useToast();
  const podNameById = useMemo(() => new Map(pods.map((p) => [p.id, p.name])), [pods]);

  // null = not editing; "new" = adding a record; otherwise the row id being edited.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<MembershipDraft>(() => emptyDraft(pods));
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const historyQuery = useQuery<PodMembership[]>({
    queryKey: ["/api/users", pm?.id, "pod-memberships"],
    enabled: !!pm,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/users", pm?.id, "pod-memberships"] });
    queryClient.invalidateQueries({ queryKey: ["/api/pods/stats"] });
    queryClient.invalidateQueries({ queryKey: ["/api/pods/stats/range"] });
    queryClient.invalidateQueries({ queryKey: ["/api/pods/stats/trend"] });
  };

  const boundaryPayload = (b: BoundaryDraft) =>
    b.month === OPEN || b.month === ""
      ? { month: null as number | null, year: null as number | null }
      : { month: parseInt(b.month), year: parseInt(b.year) };

  const buildPayload = () => {
    const s = boundaryPayload(draft.start);
    const e = boundaryPayload(draft.end);
    return {
      podId: draft.podId,
      startMonth: s.month,
      startYear: s.year,
      endMonth: e.month,
      endYear: e.year,
    };
  };

  const validateDraft = (): string | null => {
    if (!draft.podId) return "Choose a target POD.";
    const s = boundaryPayload(draft.start);
    const e = boundaryPayload(draft.end);
    if ((s.month != null) && (!s.year || s.year < 2000)) return "Enter a valid start year.";
    if ((e.month != null) && (!e.year || e.year < 2000)) return "Enter a valid end year.";
    return null;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = buildPayload();
      if (editingId === "new") {
        await apiRequest("POST", "/api/pod-memberships", { ...payload, userId: pm!.id });
      } else if (editingId) {
        await apiRequest("PATCH", `/api/pod-memberships/${editingId}`, payload);
      }
    },
    onSuccess: () => {
      invalidate();
      toast({ title: editingId === "new" ? "History record added" : "History record updated" });
      setEditingId(null);
    },
    onError: (err) => {
      toast({ title: "Save failed", description: getErrorMessage(err, "Try again"), variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/pod-memberships/${id}`);
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "History record deleted" });
      setDeleteId(null);
    },
    onError: (err) => {
      toast({ title: "Delete failed", description: getErrorMessage(err, "Try again"), variant: "destructive" });
    },
  });

  const startCreate = () => {
    setDraft(emptyDraft(pods));
    setEditingId("new");
  };

  const startEdit = (row: PodMembership) => {
    setDraft({
      podId: row.podId,
      start: boundaryFromRow(row.startMonth, row.startYear),
      end: boundaryFromRow(row.endMonth, row.endYear),
    });
    setEditingId(row.id);
  };

  const onSave = () => {
    const err = validateDraft();
    if (err) {
      toast({ title: "Check the record", description: err, variant: "destructive" });
      return;
    }
    saveMutation.mutate();
  };

  const fullName = (u: User) =>
    `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email || "User";

  const rows = historyQuery.data ?? [];

  return (
    <Dialog open={!!pm} onOpenChange={(o) => { if (!o) { setEditingId(null); onClose(); } }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-pod-history">
        <DialogHeader>
          <DialogTitle>POD history{pm ? ` — ${fullName(pm)}` : ""}</DialogTitle>
          <DialogDescription>
            These records pin a PM's monthly data to a specific POD for the given period.
            Months not covered by any record fall back to the PM's current POD.
          </DialogDescription>
        </DialogHeader>

        {historyQuery.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            No history records. This PM's months all count toward their current POD.
          </p>
        ) : (
          <div className="border rounded-md divide-y">
            {rows.map((row) => (
              <div key={row.id} className="p-3" data-testid={`row-membership-${row.id}`}>
                {editingId === row.id ? (
                  <MembershipForm
                    pods={pods}
                    draft={draft}
                    setDraft={setDraft}
                    onSave={onSave}
                    onCancel={() => setEditingId(null)}
                    saving={saveMutation.isPending}
                  />
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate" data-testid={`text-membership-pod-${row.id}`}>
                        {podNameById.get(row.podId) ?? "Unknown POD"}
                      </div>
                      <div className="text-xs text-muted-foreground" data-testid={`text-membership-range-${row.id}`}>
                        {formatRange(row)}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => startEdit(row)}
                        data-testid={`button-edit-membership-${row.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteId(row.id)}
                        data-testid={`button-delete-membership-${row.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {editingId === "new" ? (
          <div className="border rounded-md p-3 mt-3">
            <MembershipForm
              pods={pods}
              draft={draft}
              setDraft={setDraft}
              onSave={onSave}
              onCancel={() => setEditingId(null)}
              saving={saveMutation.isPending}
            />
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3 w-fit"
            onClick={startCreate}
            disabled={pods.length === 0 || editingId !== null}
            data-testid="button-add-membership"
          >
            <Plus className="h-4 w-4 mr-1" /> Add history record
          </Button>
        )}

        <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && !deleteMutation.isPending && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete history record?</AlertDialogTitle>
              <AlertDialogDescription>
                The months in this record will fall back to the PM's current POD for attribution.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteMutation.isPending} data-testid="button-cancel-delete-membership">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteId && deleteMutation.mutate(deleteId)}
                disabled={deleteMutation.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="button-confirm-delete-membership"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}

function MembershipForm({
  pods,
  draft,
  setDraft,
  onSave,
  onCancel,
  saving,
}: {
  pods: Pod[];
  draft: MembershipDraft;
  setDraft: (d: MembershipDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <div className="space-y-3" data-testid="form-membership">
      <div className="space-y-1">
        <Label className="text-xs">Target POD</Label>
        <Select value={draft.podId} onValueChange={(v) => setDraft({ ...draft, podId: v })}>
          <SelectTrigger data-testid="select-membership-pod">
            <SelectValue placeholder="Select POD" />
          </SelectTrigger>
          <SelectContent>
            {pods.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap gap-4">
        <BoundaryFields
          label="From"
          value={draft.start}
          onChange={(start) => setDraft({ ...draft, start })}
          testidPrefix="membership-start"
        />
        <BoundaryFields
          label="To"
          value={draft.end}
          onChange={(end) => setDraft({ ...draft, end })}
          testidPrefix="membership-end"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Set a boundary to "Open" to leave that side unbounded (e.g. all months before a date).
      </p>
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={onSave} disabled={saving} data-testid="button-save-membership">
          <Save className="h-4 w-4 mr-1" /> {saving ? "Saving..." : "Save"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={saving} data-testid="button-cancel-membership">
          Cancel
        </Button>
      </div>
    </div>
  );
}
