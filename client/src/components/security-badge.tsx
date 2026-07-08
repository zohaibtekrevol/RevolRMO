import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import type { SystemPermission } from "@shared/schema";

export function SecurityBadge() {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(true);
  const [hovered, setHovered] = useState(false);

  const { data: userPermissions } = useQuery<SystemPermission[]>({
    queryKey: ["/api/access/my-permissions"],
    enabled: !!user,
  });

  const canNavigate = userPermissions?.includes("view_settings") ?? false;

  useEffect(() => {
    const timer = setTimeout(() => setExpanded(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  const showText = expanded || hovered;

  const badge = (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      data-testid="badge-system-secured"
      className={cn(
        "group/secure relative flex items-center justify-center overflow-hidden rounded-full border border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 via-green-500/5 to-teal-500/10 py-1.5 shadow-sm transition-all duration-300 hover:border-emerald-500/40 hover:shadow-md hover:shadow-emerald-500/10",
        showText ? "gap-2 px-2.5" : "gap-0 px-1.5",
        canNavigate && "cursor-pointer",
      )}
    >
      <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-green-600 shadow-sm shadow-emerald-500/30">
        <span className="absolute inset-0 rounded-full ring-2 ring-emerald-400/40 animate-ping opacity-60" />
        <ShieldCheck className="relative h-4 w-4 text-white" />
      </div>
      <div
        className={cn(
          "flex items-center overflow-hidden transition-all duration-300",
          showText ? "max-w-[180px] opacity-100" : "max-w-0 opacity-0",
        )}
      >
        <div className="flex flex-col whitespace-nowrap pr-1">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-semibold leading-none text-foreground">
              System Secured
            </p>
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
          </div>
          <p className="mt-0.5 text-[10px] leading-none text-muted-foreground">
            Protected &amp; encrypted
          </p>
        </div>
      </div>
    </div>
  );

  if (canNavigate) {
    return (
      <Link href="/admin/settings?tab=security" aria-label="Open Security settings" data-testid="link-security-dashboard">
        {badge}
      </Link>
    );
  }

  return badge;
}
