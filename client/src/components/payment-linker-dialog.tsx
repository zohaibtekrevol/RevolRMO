import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchableCombobox, type ComboboxOption } from "@/components/searchable-combobox";
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
  Link2,
  CheckCircle,
  AlertTriangle,
  X,
  Pencil,
  Save,
  Calendar,
} from "lucide-react";
import type {
  ProjectWithPM,
  ProjectWithMilestones,
  MilestoneWithPayment,
  ChangeRequestWithInstallments,
  CrInstallmentWithPayment,
  Payment,
} from "@shared/schema";

const paymentStatusItems = [
  { value: "pending_invoice", label: "Pending" },
  { value: "invoiced", label: "Invoiced" },
  { value: "received", label: "Received" },
  { value: "not_targeting", label: "Not Targeting" },
];

function formatCurrency(value: number | string | null | undefined) {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (num === null || num === undefined || isNaN(num as number)) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(num as number);
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "No date";
  try {
    return format(new Date(value), "MMM d, yyyy");
  } catch {
    return "No date";
  }
}

interface PaymentLinkerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEditPayments: boolean;
}

type LinkInfo = { kind: "milestone" | "installment"; id: string; name: string };

export function PaymentLinkerDialog({
  open,
  onOpenChange,
  canEditPayments,
}: PaymentLinkerDialogProps) {
  const { toast } = useToast();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  useEffect(() => {
    if (!open) setSelectedProjectId("");
  }, [open]);

  const { data: projects } = useQuery<ProjectWithPM[]>({
    queryKey: ["/api/projects"],
  });

  const enabled = !!selectedProjectId && open;

  const { data: milestoneData, isLoading: milestonesLoading } =
    useQuery<ProjectWithMilestones>({
      queryKey: [`/api/projects/${selectedProjectId}/with-milestones`],
      enabled,
    });

  const { data: changeRequests, isLoading: crsLoading } = useQuery<
    ChangeRequestWithInstallments[]
  >({
    queryKey: [`/api/projects/${selectedProjectId}/change-requests`],
    enabled,
  });

  const { data: projectPayments, isLoading: paymentsLoading } = useQuery<
    Payment[]
  >({
    queryKey: [`/api/projects/${selectedProjectId}/payments`],
    enabled,
  });

  const handleError = (error: unknown, fallback: string) => {
    const message = error instanceof Error ? error.message : fallback;
    toast({ title: "Error", description: message, variant: "destructive" });
  };

  const invalidateAll = () => {
    queryClient.invalidateQueries({
      queryKey: [`/api/projects/${selectedProjectId}/with-milestones`],
    });
    queryClient.invalidateQueries({
      queryKey: [`/api/projects/${selectedProjectId}/change-requests`],
    });
    queryClient.invalidateQueries({
      queryKey: [`/api/projects/${selectedProjectId}/payments`],
    });
    queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
  };

  const linkMilestoneMutation = useMutation({
    mutationFn: async ({
      paymentId,
      milestoneId,
    }: {
      paymentId: string;
      milestoneId: string;
    }) => {
      const res = await apiRequest(
        "POST",
        `/api/payments/${paymentId}/link-milestone`,
        { milestoneId },
      );
      return res.json();
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Linked", description: "Payment linked to milestone." });
    },
    onError: (error) => handleError(error, "Failed to link payment."),
  });

  const unlinkMilestoneMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const res = await apiRequest(
        "POST",
        `/api/payments/${paymentId}/unlink-milestone`,
      );
      return res.json();
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Cleared", description: "Milestone link removed." });
    },
    onError: (error) => handleError(error, "Failed to clear link."),
  });

  const linkInstallmentMutation = useMutation({
    mutationFn: async ({
      paymentId,
      crInstallmentId,
    }: {
      paymentId: string;
      crInstallmentId: string;
    }) => {
      const res = await apiRequest(
        "POST",
        `/api/payments/${paymentId}/link-cr-installment`,
        { crInstallmentId },
      );
      return res.json();
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Linked", description: "Payment linked to installment." });
    },
    onError: (error) => handleError(error, "Failed to link payment."),
  });

  const unlinkInstallmentMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const res = await apiRequest(
        "POST",
        `/api/payments/${paymentId}/unlink-cr-installment`,
      );
      return res.json();
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Cleared", description: "Installment link removed." });
    },
    onError: (error) => handleError(error, "Failed to clear link."),
  });

  const updatePaymentMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Record<string, unknown>;
    }) => {
      const res = await apiRequest("PATCH", `/api/payments/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Saved", description: "Payment details updated." });
    },
    onError: (error) => handleError(error, "Failed to update payment."),
  });

  const projectOptions: ComboboxOption[] = useMemo(
    () =>
      (projects || []).map((p) => ({
        value: p.id,
        label: p.clientName ? `${p.name} — ${p.clientName}` : p.name,
      })),
    [projects],
  );

  const recurringPayments = useMemo(
    () => (projectPayments || []).filter((p) => p.paymentType === "recurring"),
    [projectPayments],
  );
  const upsellPayments = useMemo(
    () => (projectPayments || []).filter((p) => p.paymentType === "upsell"),
    [projectPayments],
  );

  // Map of paymentId -> what it is currently linked to, so we can flag links to a
  // different milestone/installment. Built from the payments themselves so EVERY
  // linked payment is included (a target can have several linked payments).
  const linkMap = useMemo(() => {
    const map: Record<string, LinkInfo> = {};
    const msNames = new Map<string, string>();
    (milestoneData?.milestones || []).forEach((m) => msNames.set(m.id, m.name));
    const instNames = new Map<string, string>();
    (changeRequests || []).forEach((cr) =>
      cr.installments.forEach((inst) =>
        instNames.set(inst.id, `${cr.title} — ${inst.name}`),
      ),
    );
    (projectPayments || []).forEach((p) => {
      if (p.milestoneId) {
        map[p.id] = {
          kind: "milestone",
          id: p.milestoneId,
          name: msNames.get(p.milestoneId) || "a milestone",
        };
      } else if (p.crInstallmentId) {
        map[p.id] = {
          kind: "installment",
          id: p.crInstallmentId,
          name: instNames.get(p.crInstallmentId) || "an installment",
        };
      }
    });
    return map;
  }, [milestoneData, changeRequests, projectPayments]);

  // All payments currently linked to a given target.
  const milestoneLinks = (milestoneId: string) =>
    (projectPayments || []).filter((p) => p.milestoneId === milestoneId);
  const installmentLinks = (installmentId: string) =>
    (projectPayments || []).filter((p) => p.crInstallmentId === installmentId);

  // Options for the "add a payment" picker: received payments not already linked here.
  const buildAddOptions = (
    pool: Payment[],
    currentTargetId: string,
    linkedHereIds: Set<string>,
  ): ComboboxOption[] => {
    return pool
      .filter((p) => p.status === "received" && !linkedHereIds.has(p.id))
      .map((p) => {
        const linkedTo = linkMap[p.id];
        const elsewhere = linkedTo && linkedTo.id !== currentTargetId;
        const amount = formatCurrency(p.receivedAmount || p.expectedAmount);
        const date = formatDate(p.receivedDate);
        const base = `${amount} · ${date}`;
        return {
          value: p.id,
          label: elsewhere ? `${base} · linked to ${linkedTo!.name}` : base,
        };
      });
  };

  const isLoading = milestonesLoading || crsLoading || paymentsLoading;
  const selectedProject = projects?.find((p) => p.id === selectedProjectId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-4xl max-h-[90vh] overflow-y-auto"
        data-testid="dialog-payment-linker"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Link Payments
          </DialogTitle>
          <DialogDescription>
            Pick a project, then connect each received payment to the right
            milestone or change-request installment. Amounts that don't match
            are flagged so you can fix them.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label>Project</Label>
            <SearchableCombobox
              options={projectOptions}
              value={selectedProjectId}
              onChange={setSelectedProjectId}
              placeholder="Select a project..."
              searchPlaceholder="Search projects..."
              emptyText="No projects found."
              testId="combobox-linker-project"
            />
          </div>

          {!selectedProjectId ? (
            <div className="text-center py-10 text-muted-foreground border rounded-md">
              <Link2 className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>Choose a project to start linking payments.</p>
            </div>
          ) : isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : (
            <>
              {/* Milestones */}
              <div className="space-y-3">
                <h3 className="text-lg font-medium">
                  Milestones
                  {selectedProject ? ` · ${selectedProject.name}` : ""}
                </h3>
                {milestoneData?.milestones &&
                milestoneData.milestones.length > 0 ? (
                  <div className="space-y-2">
                    {milestoneData.milestones.map((milestone) => {
                      const linkedPayments = milestoneLinks(milestone.id);
                      const linkedHereIds = new Set(
                        linkedPayments.map((p) => p.id),
                      );
                      return (
                        <LinkRow
                          key={milestone.id}
                          rowId={milestone.id}
                          name={milestone.name}
                          status={milestone.status}
                          expectedAmount={milestone.expectedAmount}
                          linkedPayments={linkedPayments}
                          addOptions={buildAddOptions(
                            recurringPayments,
                            milestone.id,
                            linkedHereIds,
                          )}
                          canEdit={canEditPayments}
                          testIdPrefix="milestone"
                          emptyText="No received recurring payments"
                          linkMap={linkMap}
                          currentTargetId={milestone.id}
                          onLink={(paymentId) =>
                            linkMilestoneMutation.mutate({
                              paymentId,
                              milestoneId: milestone.id,
                            })
                          }
                          onClear={(paymentId) =>
                            unlinkMilestoneMutation.mutate(paymentId)
                          }
                          onSavePayment={(id, data) =>
                            updatePaymentMutation.mutateAsync({ id, data })
                          }
                          linking={
                            linkMilestoneMutation.isPending ||
                            unlinkMilestoneMutation.isPending
                          }
                        />
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground border rounded-md p-4 text-center">
                    This project has no milestones.
                  </p>
                )}
              </div>

              <Separator />

              {/* Change Requests */}
              <div className="space-y-3">
                <h3 className="text-lg font-medium">Change Requests</h3>
                {changeRequests && changeRequests.length > 0 ? (
                  <div className="space-y-4">
                    {changeRequests.map((cr) => (
                      <div
                        key={cr.id}
                        className="border rounded-md p-3 space-y-2"
                        data-testid={`linker-cr-${cr.id}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium truncate">{cr.title}</p>
                          <span className="text-sm font-medium">
                            {formatCurrency(cr.totalAmount)}
                          </span>
                        </div>
                        {cr.installments.length > 0 ? (
                          <div className="space-y-2">
                            {cr.installments.map((inst) => {
                              const linkedPayments = installmentLinks(inst.id);
                              const linkedHereIds = new Set(
                                linkedPayments.map((p) => p.id),
                              );
                              return (
                                <LinkRow
                                  key={inst.id}
                                  rowId={inst.id}
                                  name={inst.name}
                                  status={inst.status}
                                  expectedAmount={inst.expectedAmount}
                                  linkedPayments={linkedPayments}
                                  addOptions={buildAddOptions(
                                    upsellPayments,
                                    inst.id,
                                    linkedHereIds,
                                  )}
                                  canEdit={canEditPayments}
                                  testIdPrefix="installment"
                                  emptyText="No received upsell payments"
                                  linkMap={linkMap}
                                  currentTargetId={inst.id}
                                  onLink={(paymentId) =>
                                    linkInstallmentMutation.mutate({
                                      paymentId,
                                      crInstallmentId: inst.id,
                                    })
                                  }
                                  onClear={(paymentId) =>
                                    unlinkInstallmentMutation.mutate(paymentId)
                                  }
                                  onSavePayment={(id, data) =>
                                    updatePaymentMutation.mutateAsync({ id, data })
                                  }
                                  linking={
                                    linkInstallmentMutation.isPending ||
                                    unlinkInstallmentMutation.isPending
                                  }
                                />
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            No installments.
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground border rounded-md p-4 text-center">
                    This project has no change requests.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface LinkRowProps {
  rowId: string;
  name: string;
  status: string;
  expectedAmount: string | null;
  linkedPayments: Payment[];
  addOptions: ComboboxOption[];
  canEdit: boolean;
  testIdPrefix: string;
  emptyText: string;
  linkMap: Record<string, LinkInfo>;
  currentTargetId: string;
  onLink: (paymentId: string) => void;
  onClear: (paymentId: string) => void;
  onSavePayment: (id: string, data: Record<string, unknown>) => Promise<unknown>;
  linking: boolean;
}

function LinkRow({
  rowId,
  name,
  status,
  expectedAmount,
  linkedPayments,
  addOptions,
  canEdit,
  testIdPrefix,
  emptyText,
  linkMap,
  currentTargetId,
  onLink,
  onClear,
  onSavePayment,
  linking,
}: LinkRowProps) {
  const [pendingMove, setPendingMove] = useState<{
    paymentId: string;
    fromName: string;
  } | null>(null);

  const handleSelect = (paymentId: string | undefined) => {
    if (!paymentId) return;
    const linkedElsewhere = linkMap[paymentId];
    if (linkedElsewhere && linkedElsewhere.id !== currentTargetId) {
      setPendingMove({ paymentId, fromName: linkedElsewhere.name });
      return;
    }
    onLink(paymentId);
  };

  const expected = parseFloat(expectedAmount || "0");
  // Only payments marked "received" count toward the milestone/installment total,
  // matching the backend recompute semantics.
  const totalReceived = linkedPayments.reduce(
    (sum, p) =>
      p.status === "received"
        ? sum +
          parseFloat(p.receivedAmount?.toString() || p.expectedAmount?.toString() || "0")
        : sum,
    0,
  );
  const hasLinks = linkedPayments.length > 0;
  const over = totalReceived > expected + 0.01;
  const covered = expected > 0 && totalReceived + 0.005 >= expected;
  const short = hasLinks && totalReceived + 0.005 < expected;

  return (
    <div
      className="border rounded-md p-3 space-y-2 bg-muted/20"
      data-testid={`linker-row-${testIdPrefix}-${rowId}`}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="font-medium truncate">{name}</p>
          <p className="text-xs text-muted-foreground">
            Expected: {formatCurrency(expectedAmount)} ·{" "}
            <span className="capitalize">{status.replace(/_/g, " ")}</span>
          </p>
        </div>
        {hasLinks &&
          (over ? (
            <Badge
              variant="outline"
              className="text-xs border-amber-500/40 text-amber-600 dark:text-amber-400 gap-1"
              data-testid={`badge-over-${testIdPrefix}-${rowId}`}
            >
              <AlertTriangle className="h-3 w-3" />
              Over by {formatCurrency(totalReceived - expected)}
            </Badge>
          ) : covered ? (
            <Badge
              variant="outline"
              className="text-xs border-emerald-500/40 text-emerald-600 dark:text-emerald-400 gap-1"
              data-testid={`badge-covered-${testIdPrefix}-${rowId}`}
            >
              <CheckCircle className="h-3 w-3" />
              Fully covered
            </Badge>
          ) : short ? (
            <Badge
              variant="outline"
              className="text-xs border-amber-500/40 text-amber-600 dark:text-amber-400 gap-1"
              data-testid={`badge-short-${testIdPrefix}-${rowId}`}
            >
              <AlertTriangle className="h-3 w-3" />
              Short by {formatCurrency(expected - totalReceived)}
            </Badge>
          ) : null)}
      </div>

      {hasLinks && (
        <p
          className="text-xs text-muted-foreground"
          data-testid={`text-total-${testIdPrefix}-${rowId}`}
        >
          Received {formatCurrency(totalReceived)} of{" "}
          {formatCurrency(expectedAmount)} across {linkedPayments.length}{" "}
          payment{linkedPayments.length === 1 ? "" : "s"}
        </p>
      )}

      {hasLinks && (
        <div className="space-y-2">
          {linkedPayments.map((payment) => (
            <LinkedPaymentItem
              key={payment.id}
              payment={payment}
              canEdit={canEdit}
              testIdPrefix={testIdPrefix}
              onClear={onClear}
              onSavePayment={onSavePayment}
              linking={linking}
            />
          ))}
        </div>
      )}

      {canEdit && (
        <div className="pt-1">
          <SearchableCombobox
            options={addOptions}
            value={undefined}
            onChange={handleSelect}
            placeholder={
              hasLinks ? "Add another payment..." : "Link a received payment..."
            }
            searchPlaceholder="Search payments..."
            emptyText={emptyText}
            disabled={!canEdit || linking}
            testId={`combobox-payment-${testIdPrefix}-${rowId}`}
          />
        </div>
      )}

      <AlertDialog
        open={!!pendingMove}
        onOpenChange={(o) => {
          if (!o) setPendingMove(null);
        }}
      >
        <AlertDialogContent data-testid={`dialog-confirm-move-${testIdPrefix}-${rowId}`}>
          <AlertDialogHeader>
            <AlertDialogTitle>Move this payment?</AlertDialogTitle>
            <AlertDialogDescription>
              This payment is currently linked to{" "}
              <span className="font-medium text-foreground">
                {pendingMove?.fromName}
              </span>
              . Moving it here will remove that link and reassign it to{" "}
              <span className="font-medium text-foreground">{name}</span>. This
              changes the financial status on both records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              data-testid={`button-cancel-move-${testIdPrefix}-${rowId}`}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingMove) onLink(pendingMove.paymentId);
                setPendingMove(null);
              }}
              data-testid={`button-confirm-move-${testIdPrefix}-${rowId}`}
            >
              Move it here
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface LinkedPaymentItemProps {
  payment: Payment;
  canEdit: boolean;
  testIdPrefix: string;
  onClear: (paymentId: string) => void;
  onSavePayment: (id: string, data: Record<string, unknown>) => Promise<unknown>;
  linking: boolean;
}

function LinkedPaymentItem({
  payment,
  canEdit,
  testIdPrefix,
  onClear,
  onSavePayment,
  linking,
}: LinkedPaymentItemProps) {
  const [editing, setEditing] = useState(false);
  const [editAmount, setEditAmount] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editStatus, setEditStatus] = useState("received");
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setEditAmount(payment.receivedAmount?.toString() || "");
    setEditDate(
      payment.receivedDate
        ? new Date(payment.receivedDate).toISOString().split("T")[0]
        : "",
    );
    setEditStatus(payment.status || "received");
    setEditing(true);
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      await onSavePayment(payment.id, {
        receivedAmount: editAmount || "0",
        receivedDate: editDate ? new Date(editDate).toISOString() : null,
        status: editStatus,
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="rounded-md border bg-background p-2 space-y-2"
      data-testid={`linked-payment-${testIdPrefix}-${payment.id}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 text-sm">
          <span className="font-medium">
            {formatCurrency(payment.receivedAmount || payment.expectedAmount)}
          </span>
          <span className="text-muted-foreground">
            {" · "}
            {formatDate(payment.receivedDate)}
            {" · "}
            <span className="capitalize">
              {(payment.status || "").replace(/_/g, " ")}
            </span>
          </span>
        </div>
        {canEdit && !editing && (
          <div className="flex items-center gap-1 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={startEdit}
              title="Edit payment"
              data-testid={`button-edit-payment-${testIdPrefix}-${payment.id}`}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive"
              onClick={() => onClear(payment.id)}
              disabled={linking}
              title="Remove link"
              data-testid={`button-clear-link-${testIdPrefix}-${payment.id}`}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {editing && (
        <div
          className="rounded-md border p-3 space-y-3 bg-muted/20"
          data-testid={`edit-payment-${testIdPrefix}-${payment.id}`}
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Received Amount</Label>
              <Input
                type="number"
                step="0.01"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                data-testid={`input-received-amount-${testIdPrefix}-${payment.id}`}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Received Date
              </Label>
              <Input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                data-testid={`input-received-date-${testIdPrefix}-${payment.id}`}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger
                  data-testid={`select-payment-status-${testIdPrefix}-${payment.id}`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {paymentStatusItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEditing(false)}
              disabled={saving}
              data-testid={`button-cancel-edit-${testIdPrefix}-${payment.id}`}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={saveEdit}
              disabled={saving}
              data-testid={`button-save-edit-${testIdPrefix}-${payment.id}`}
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
