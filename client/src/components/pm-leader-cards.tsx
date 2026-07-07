import { Trophy, DollarSign, TrendingUp } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { PmLeaders, User } from "@shared/schema";

interface PmLeaderCardsProps {
  leaders: PmLeaders | undefined;
  currentMonth: string;
  formatCurrency: (value: number) => string;
}

function getPmName(pm: User): string {
  const fullName = `${pm.firstName || ""} ${pm.lastName || ""}`.trim();
  return fullName || pm.email || "Unknown";
}

function getPmInitials(pm: User): string {
  const firstName = pm.firstName || "";
  const lastName = pm.lastName || "";
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }
  if (firstName) {
    return firstName.slice(0, 2).toUpperCase();
  }
  if (pm.email) {
    return pm.email.slice(0, 2).toUpperCase();
  }
  return "??";
}

export function PmLeaderCards({ leaders, currentMonth, formatCurrency }: PmLeaderCardsProps) {
  if (!leaders?.topPerformer && !leaders?.topValuePerformer && !leaders?.topUpseller) {
    return null;
  }

  return (
    <div className="grid gap-4 sm:gap-5 grid-cols-1 md:grid-cols-3">
      {leaders?.topPerformer && (
        <div className="relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-br from-card via-card to-primary/5 shadow-sm group hover:shadow-md transition-all duration-300">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -translate-y-8 translate-x-8" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl translate-y-6 -translate-x-6" />
          
          <div className="relative z-10 p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="relative">
                <Avatar className="h-11 w-11 ring-2 ring-primary/20">
                  <AvatarImage src={leaders.topPerformer.pm.profileImageUrl || undefined} alt={getPmName(leaders.topPerformer.pm)} />
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                    {getPmInitials(leaders.topPerformer.pm)}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary shadow-sm">
                  <Trophy className="h-3 w-3 text-primary-foreground" />
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-primary uppercase tracking-wider">Top Performer</p>
                <p className="text-sm font-bold text-foreground" data-testid="text-top-performer-name">
                  {getPmName(leaders.topPerformer.pm)}
                </p>
              </div>
            </div>
            <div className="flex items-end justify-between gap-2">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Progress</p>
                <p className="text-3xl font-extrabold text-primary" data-testid="text-top-performer-progress">
                  {leaders.topPerformer.progress.toFixed(0)}%
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Received / Target</p>
                <p className="text-sm font-semibold text-foreground" data-testid="text-top-performer-received">
                  {formatCurrency(leaders.topPerformer.actualReceived)} / {formatCurrency(leaders.topPerformer.targetAmount)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {leaders?.topValuePerformer && (
        <div className="relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-br from-card via-card to-violet-500/5 shadow-sm group hover:shadow-md transition-all duration-300">
          <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 rounded-full blur-3xl -translate-y-8 translate-x-8" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-violet-500/5 rounded-full blur-2xl translate-y-6 -translate-x-6" />
          
          <div className="relative z-10 p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="relative">
                <Avatar className="h-11 w-11 ring-2 ring-violet-500/20">
                  <AvatarImage src={leaders.topValuePerformer.pm.profileImageUrl || undefined} alt={getPmName(leaders.topValuePerformer.pm)} />
                  <AvatarFallback className="bg-violet-500/10 text-violet-600 dark:text-violet-500 text-sm font-medium">
                    {getPmInitials(leaders.topValuePerformer.pm)}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 dark:bg-violet-500 shadow-sm">
                  <DollarSign className="h-3 w-3 text-white" />
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-violet-600 dark:text-violet-500 uppercase tracking-wider">Top Value Performer</p>
                <p className="text-sm font-bold text-foreground" data-testid="text-top-value-performer-name">
                  {getPmName(leaders.topValuePerformer.pm)}
                </p>
              </div>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Total Cash-In</p>
              <p className="text-3xl font-extrabold text-violet-600 dark:text-violet-500" data-testid="text-top-value-performer-amount">
                {formatCurrency(leaders.topValuePerformer.totalCashIn)}
              </p>
            </div>
          </div>
        </div>
      )}

      {leaders?.topUpseller && leaders.topUpseller.upsellAmount > 0 && (
        <div className="relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-br from-card via-card to-blue-500/5 shadow-sm group hover:shadow-md transition-all duration-300">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -translate-y-8 translate-x-8" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl translate-y-6 -translate-x-6" />
          
          <div className="relative z-10 p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="relative">
                <Avatar className="h-11 w-11 ring-2 ring-blue-500/20">
                  <AvatarImage src={leaders.topUpseller.pm.profileImageUrl || undefined} alt={getPmName(leaders.topUpseller.pm)} />
                  <AvatarFallback className="bg-blue-500/10 text-blue-600 dark:text-blue-500 text-sm font-medium">
                    {getPmInitials(leaders.topUpseller.pm)}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 dark:bg-blue-500 shadow-sm">
                  <TrendingUp className="h-3 w-3 text-white" />
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-blue-600 dark:text-blue-500 uppercase tracking-wider">Top Upseller</p>
                <p className="text-sm font-bold text-foreground" data-testid="text-top-upseller-name">
                  {getPmName(leaders.topUpseller.pm)}
                </p>
              </div>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Upsell Amount</p>
              <p className="text-3xl font-extrabold text-blue-600 dark:text-blue-500" data-testid="text-top-upseller-amount">
                {formatCurrency(leaders.topUpseller.upsellAmount)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
