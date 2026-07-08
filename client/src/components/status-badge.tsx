import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PaymentStatus } from "@shared/schema";

interface StatusBadgeProps {
  status: PaymentStatus | string;
  className?: string;
}

const statusConfig: Record<PaymentStatus, { label: string; className: string }> = {
  not_targeting: {
    label: "Not Targeting",
    className: "bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700",
  },
  pending_invoice: {
    label: "Pending Invoice",
    className: "bg-red-100 text-red-600 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
  },
  invoiced: {
    label: "Invoiced",
    className: "bg-blue-100 text-blue-600 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
  },
  received: {
    label: "Received",
    className: "bg-green-100 text-green-600 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
  },
};

const defaultConfig = {
  label: "Unknown",
  className: "bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700",
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const knownStatus = status as PaymentStatus;
  const config = statusConfig[knownStatus] || defaultConfig;
  const displayLabel = statusConfig[knownStatus] ? config.label : status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", config.className, className)}
      data-testid={`status-badge-${status}`}
    >
      {displayLabel}
    </Badge>
  );
}
