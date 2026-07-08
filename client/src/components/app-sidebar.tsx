import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  Calendar,
  FolderOpen,
  Users,
  BarChart3,
  LogOut,
  TrendingUp,
  Bell,
  Target,
  FileBarChart,
  FileText,
  Settings,
  Activity,
  Search,
  TableProperties,
  PiggyBank,
  Clock,
  Briefcase,
  Palette,
  FolderCheck,
  FolderArchive,
  ClipboardCheck,
  Users2,
  Brain,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { SystemPermission, Notification } from "@shared/schema";

export type NavItem = {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  showBadge?: boolean;
  requiresPermission?: SystemPermission;
  // When true, this module can never be hidden by admins (e.g. Settings, so admins
  // don't lock themselves out of the visibility controls).
  alwaysVisible?: boolean;
};

export type NavSection = {
  label: string;
  items: NavItem[];
};

export const navSections: NavSection[] = [
  {
    label: "Overview",
    items: [
      {
        title: "Dashboard",
        url: "/",
        icon: LayoutDashboard,
        requiresPermission: "view_dashboard",
      },
      {
        title: "Analytics",
        url: "/analytics",
        icon: TrendingUp,
        requiresPermission: "view_analytics",
      },
    ],
  },
  {
    label: "Revenue",
    items: [
      {
        title: "Recurring Overview",
        url: "/recurring-overview",
        icon: TableProperties,
        requiresPermission: "view_payments",
      },
      {
        title: "Invoices",
        url: "/invoices",
        icon: FileText,
        requiresPermission: "view_invoices",
      },
      {
        title: "Forecasting",
        url: "/forecasting",
        icon: BarChart3,
        requiresPermission: "view_forecasting",
      },
      {
        title: "Upsell Planning",
        url: "/upsells",
        icon: Target,
        requiresPermission: "view_upsells",
      },
      {
        title: "Upsell AI Analysis",
        url: "/upsells/ai-analysis",
        icon: Brain,
        requiresPermission: "view_upsells",
      },
    ],
  },
  {
    label: "Delivery",
    items: [
      {
        title: "Projects",
        url: "/projects",
        icon: FolderOpen,
        requiresPermission: "view_projects",
      },
      {
        title: "Monthly Planning",
        url: "/planning",
        icon: Calendar,
        requiresPermission: "view_planning",
      },
      {
        title: "Timesheets",
        url: "/timesheets",
        icon: Clock,
        requiresPermission: "view_timesheets",
      },
      {
        title: "Document Repository",
        url: "/document-repository",
        icon: FolderCheck,
        requiresPermission: "view_signoffs",
      },
      {
        title: "Drive Documents",
        url: "/drive-documents",
        icon: FolderArchive,
        requiresPermission: "view_projects",
      },
    ],
  },
  {
    label: "Performance",
    items: [
      {
        title: "Cost & Margin",
        url: "/cost-margin",
        icon: PiggyBank,
        requiresPermission: "view_cost_margin",
      },
      {
        title: "PMO KPIs",
        url: "/pmo-kpis",
        icon: ClipboardCheck,
        requiresPermission: "view_kpis",
      },
      {
        title: "PODs",
        url: "/pods",
        icon: Users2,
        requiresPermission: "view_pods",
      },
      {
        title: "Reports",
        url: "/reports/payments",
        icon: FileBarChart,
        requiresPermission: "view_reports",
      },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        title: "Notifications",
        url: "/admin/notifications",
        icon: Bell,
        requiresPermission: "send_notifications",
      },
      {
        title: "User Management",
        url: "/admin/users",
        icon: Users,
        requiresPermission: "view_users",
      },
      {
        title: "Resources",
        url: "/admin/resources",
        icon: Briefcase,
        requiresPermission: "view_users",
      },
      {
        title: "Activity Log",
        url: "/admin/activity",
        icon: Activity,
        requiresPermission: "view_settings",
      },
      {
        title: "Settings",
        url: "/admin/settings",
        icon: Settings,
        requiresPermission: "view_settings",
        alwaysVisible: true,
      },
    ],
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: userPermissions } = useQuery<SystemPermission[]>({
    queryKey: ["/api/access/my-permissions"],
    enabled: !!user,
  });

  const { data: notifications } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    enabled: !!user,
  });

  const { data: hiddenModules } = useQuery<string[]>({
    queryKey: ["/api/navigation/hidden-modules"],
    enabled: !!user,
  });

  const unreadCount = notifications?.filter(n => !n.isRead).length || 0;

  const hasPermission = (permission: SystemPermission | undefined) => {
    if (!permission) return true;
    return userPermissions?.includes(permission) ?? false;
  };

  const isModuleHidden = (item: NavItem) => {
    if (item.alwaysVisible) return false;
    return hiddenModules?.includes(item.url) ?? false;
  };

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    const first = firstName?.charAt(0) || "";
    const last = lastName?.charAt(0) || "";
    return (first + last).toUpperCase() || "U";
  };

  const filterItems = (items: NavItem[]) => {
    const visible = items.filter(
      item => hasPermission(item.requiresPermission) && !isModuleHidden(item)
    );
    if (!searchQuery) return visible;
    return visible.filter(item =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const visibleSections = navSections
    .map(section => ({ ...section, items: filterItems(section.items) }))
    .filter(section => section.items.length > 0);

  const canViewNotifications = userPermissions?.includes("view_notifications") ?? false;
  const canSendNotifications = userPermissions?.includes("send_notifications") ?? false;
  const showPMNotificationsLink = canViewNotifications && !canSendNotifications;

  const isActive = (url: string) => {
    // Exact match only. Nav item URLs are siblings, not parent/child routes
    // (e.g. "/upsells" and "/upsells/ai-analysis" are two separate pages),
    // so prefix matching would incorrectly highlight "/upsells" whenever an
    // "/upsells/..." sub-path like AI Analysis is active.
    return location === url;
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border/60">
      <SidebarHeader className="px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-sm shrink-0 ring-1 ring-primary/20">
            <span className="text-lg font-bold text-primary-foreground tracking-tight">R</span>
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden min-w-0">
            <span className="font-semibold text-sm leading-tight tracking-tight">RevolRMO</span>
            <span className="text-[11px] text-muted-foreground leading-tight truncate">
              Recurring Management Office
            </span>
          </div>
        </div>
      </SidebarHeader>

      <div className="px-3 pb-2 group-data-[collapsible=icon]:hidden">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search menu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 bg-muted/40 border-transparent focus-visible:bg-background focus-visible:border-border rounded-lg text-sm"
            data-testid="input-sidebar-search"
          />
        </div>
      </div>

      <SidebarContent className="px-2 gap-0.5">
        {visibleSections.map((section, idx) => (
          <SidebarGroup key={section.label} className={idx === 0 ? "" : "mt-2"}>
            <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-3 group-data-[collapsible=icon]:hidden">
              {section.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {section.items.map((item) => {
                  const active = isActive(item.url);
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        className="rounded-lg h-9 data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:font-medium data-[active=true]:hover:bg-primary data-[active=true]:hover:text-primary-foreground hover:bg-muted/60"
                        data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        <Link href={item.url}>
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span className="flex-1 text-sm truncate">{item.title}</span>
                          {item.showBadge && unreadCount > 0 && (
                            <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                              {unreadCount > 9 ? "9+" : unreadCount}
                            </Badge>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        {showPMNotificationsLink && (
          <SidebarGroup className="mt-2">
            <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-3 group-data-[collapsible=icon]:hidden">
              My Inbox
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive("/notifications")}
                    className="rounded-lg h-9 data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:font-medium data-[active=true]:hover:bg-primary data-[active=true]:hover:text-primary-foreground hover:bg-muted/60"
                    data-testid="nav-my-notifications"
                  >
                    <Link href="/notifications">
                      <Bell className="h-4 w-4 shrink-0" />
                      <span className="flex-1 text-sm">My Notifications</span>
                      {unreadCount > 0 && (
                        <Badge variant="destructive" className="text-[10px] h-5 px-1.5">
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </Badge>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarSeparator className="mx-3 group-data-[collapsible=icon]:mx-2" />

      <SidebarFooter className="p-3 group-data-[collapsible=icon]:p-2">
        <div className="flex items-center gap-2.5 p-2 rounded-lg hover-elevate group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:justify-center">
          <Avatar className="h-9 w-9 border border-border/60 shrink-0 group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8">
            <AvatarImage
              src={user?.profileImageUrl || undefined}
              alt={`${user?.firstName || "User"}'s avatar`}
              className="object-cover"
            />
            <AvatarFallback className="text-xs bg-primary/10 text-primary font-medium">
              {getInitials(user?.firstName, user?.lastName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="text-sm font-medium truncate leading-tight">
              {user?.firstName || user?.email?.split("@")[0] || "User"}
            </p>
            <p className="text-[11px] text-muted-foreground capitalize leading-tight truncate">
              {user?.role || "Team Member"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            asChild
            className="h-8 w-8 shrink-0 group-data-[collapsible=icon]:hidden"
            data-testid="button-theme-settings"
          >
            <Link href="/settings/theme" title="Theme Settings">
              <Palette className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            asChild
            className="h-8 w-8 shrink-0 group-data-[collapsible=icon]:hidden"
            data-testid="button-logout"
          >
            <a href="/api/logout" title="Sign Out">
              <LogOut className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
