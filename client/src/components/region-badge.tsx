import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Region } from "@shared/schema";

interface RegionBadgeProps {
  region: Region;
  className?: string;
}

const regionConfig: Record<Region, { label: string; className: string }> = {
  CA: {
    label: "CA",
    className: "bg-chart-1/10 text-chart-1 border-chart-1/20",
  },
  TX: {
    label: "TX",
    className: "bg-chart-3/10 text-chart-3 border-chart-3/20",
  },
  AE: {
    label: "AE",
    className: "bg-chart-4/10 text-chart-4 border-chart-4/20",
  },
};

export function RegionBadge({ region, className }: RegionBadgeProps) {
  const config = regionConfig[region];
  
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", config.className, className)}
      data-testid={`region-badge-${region}`}
    >
      {config.label}
    </Badge>
  );
}
