import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Target, Calendar, DollarSign } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface MilestoneSyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  syncData: {
    autoLinked: boolean;
    milestone?: any;
    availableMilestones?: any[];
  } | null;
  paymentId: string;
}

function formatCurrency(value: number | string | null) {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (num === null || num === undefined || isNaN(num as number)) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num as number);
}

function formatDate(date: string | Date | null) {
  if (!date) return "-";
  return format(new Date(date), "MMM d, yyyy");
}

function getStatusBadge(status: string) {
  switch (status) {
    case "completed":
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-400 dark:border-green-800">Completed</Badge>;
    case "in_progress":
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800">In Progress</Badge>;
    case "pending":
      return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800">Pending</Badge>;
    case "blocked":
      return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-400 dark:border-red-800">Blocked</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function MilestoneSyncDialog({ open, onOpenChange, syncData, paymentId }: MilestoneSyncDialogProps) {
  const { toast } = useToast();
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string>("");

  const linkMilestoneMutation = useMutation({
    mutationFn: async (milestoneId: string) => {
      const response = await apiRequest("POST", `/api/payments/${paymentId}/link-milestone`, { milestoneId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/milestones"] });
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && (key.startsWith("/api/projects") || key.startsWith("/api/forecasting"));
        },
      });
      toast({
        title: "Milestone linked",
        description: "The payment has been linked to the selected milestone.",
      });
      setSelectedMilestoneId("");
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to link milestone. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSkip = () => {
    setSelectedMilestoneId("");
    onOpenChange(false);
  };

  const handleLink = () => {
    if (selectedMilestoneId) {
      linkMilestoneMutation.mutate(selectedMilestoneId);
    }
  };

  if (!syncData) return null;

  if (syncData.autoLinked && syncData.milestone) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Milestone Automatically Linked
            </DialogTitle>
            <DialogDescription>
              This payment was automatically linked to a matching milestone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-3 p-4 rounded-lg border bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
            <Target className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="font-medium" data-testid="text-linked-milestone-name">{syncData.milestone.name}</p>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {syncData.milestone.expectedAmount && (
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-3.5 w-3.5" />
                    {formatCurrency(syncData.milestone.expectedAmount)}
                  </span>
                )}
                {syncData.milestone.dueDate && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDate(syncData.milestone.dueDate)}
                  </span>
                )}
                {syncData.milestone.status && getStatusBadge(syncData.milestone.status)}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)} data-testid="button-milestone-sync-ok">
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const milestones = syncData.availableMilestones || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Link to Milestone
          </DialogTitle>
          <DialogDescription>
            {milestones.length > 0
              ? "Select a milestone to link this payment to."
              : "No matching milestones found for this payment."}
          </DialogDescription>
        </DialogHeader>

        {milestones.length > 0 && (
          <RadioGroup
            value={selectedMilestoneId}
            onValueChange={setSelectedMilestoneId}
            className="space-y-2 max-h-64 overflow-y-auto"
            data-testid="radio-milestone-list"
          >
            {milestones.map((milestone: any) => (
              <label
                key={milestone.id}
                className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover-elevate transition-colors"
                data-testid={`milestone-option-${milestone.id}`}
              >
                <RadioGroupItem value={milestone.id} className="mt-0.5" data-testid={`radio-milestone-${milestone.id}`} />
                <div className="space-y-1 flex-1 min-w-0">
                  <p className="font-medium text-sm leading-tight">{milestone.name}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {milestone.expectedAmount && (
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        {formatCurrency(milestone.expectedAmount)}
                      </span>
                    )}
                    {milestone.dueDate && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(milestone.dueDate)}
                      </span>
                    )}
                    {milestone.status && getStatusBadge(milestone.status)}
                  </div>
                </div>
              </label>
            ))}
          </RadioGroup>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleSkip} data-testid="button-milestone-sync-skip">
            Skip
          </Button>
          {milestones.length > 0 && (
            <Button
              onClick={handleLink}
              disabled={!selectedMilestoneId || linkMilestoneMutation.isPending}
              data-testid="button-milestone-sync-link"
            >
              {linkMilestoneMutation.isPending ? "Linking..." : "Link Milestone"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
