import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Circle } from "lucide-react";
import type { DeliveryStatus } from "@shared/schema";

interface DeliveryStatusIndicatorProps {
  projectId: string;
  currentStatus: DeliveryStatus | null | undefined;
  size?: "sm" | "md";
}

const statusColors: Record<DeliveryStatus, string> = {
  green: "text-green-500 fill-green-500",
  amber: "text-amber-500 fill-amber-500",
  red: "text-red-500 fill-red-500",
};

const statusLabels: Record<DeliveryStatus, string> = {
  green: "Green",
  amber: "Amber",
  red: "Red",
};

export function DeliveryStatusIndicator({ projectId, currentStatus, size = "md" }: DeliveryStatusIndicatorProps) {
  const status = currentStatus || "green";
  const iconSize = size === "sm" ? "h-3 w-3" : "h-4 w-4";
  
  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: DeliveryStatus) => {
      const res = await apiRequest("PATCH", `/api/projects/${projectId}/delivery-status`, {
        deliveryStatus: newStatus,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/monthly-plans"] });
    },
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="p-1 rounded hover-elevate active-elevate-2 focus:outline-none focus:ring-2 focus:ring-ring"
          data-testid={`button-delivery-status-${projectId}`}
          disabled={updateStatusMutation.isPending}
        >
          <Circle className={`${iconSize} ${statusColors[status]}`} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {(["green", "amber", "red"] as DeliveryStatus[]).map((statusOption) => (
          <DropdownMenuItem
            key={statusOption}
            onClick={() => updateStatusMutation.mutate(statusOption)}
            className="flex items-center gap-2"
            data-testid={`menu-delivery-${statusOption}`}
          >
            <Circle className={`h-3 w-3 ${statusColors[statusOption]}`} />
            <span>{statusLabels[statusOption]}</span>
            {status === statusOption && <span className="ml-auto text-xs text-muted-foreground">(current)</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
