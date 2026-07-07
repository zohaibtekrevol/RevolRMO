import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    isPositive?: boolean;
  };
  icon?: React.ReactNode;
  className?: string;
  valueClassName?: string;
}

export function KPICard({
  title,
  value,
  subtitle,
  trend,
  icon,
  className,
  valueClassName,
}: KPICardProps) {
  const formatValue = (val: string | number) => {
    if (typeof val === "number") {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(val);
    }
    return val;
  };

  return (
    <Card className={cn("", className)}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </CardTitle>
        {icon && (
          <div className="text-muted-foreground">
            {icon}
          </div>
        )}
      </CardHeader>
      <CardContent className="min-w-0">
        <div className={cn("text-2xl font-semibold tracking-tight truncate", valueClassName)} data-testid={`kpi-value-${title.toLowerCase().replace(/\s+/g, "-")}`}>
          {formatValue(value)}
        </div>
        <div className="flex items-center gap-2 mt-1">
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
          {trend && (
            <div
              className={cn(
                "flex items-center gap-0.5 text-xs font-medium",
                trend.isPositive === true && "text-chart-2",
                trend.isPositive === false && "text-destructive",
                trend.isPositive === undefined && "text-muted-foreground"
              )}
            >
              {trend.isPositive === true && <TrendingUp className="h-3 w-3" />}
              {trend.isPositive === false && <TrendingDown className="h-3 w-3" />}
              {trend.isPositive === undefined && <Minus className="h-3 w-3" />}
              <span>{Math.abs(trend.value).toFixed(1)}%</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
