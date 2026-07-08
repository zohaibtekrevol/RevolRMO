import { Switch, Route, Redirect, useRoute } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationsDropdown } from "@/components/notifications-dropdown";
import { SecurityBadge } from "@/components/security-badge";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import Payments from "@/pages/payments";
import Planning from "@/pages/planning";
import Projects from "@/pages/projects";
import AdminUsers from "@/pages/admin/users";
import AdminReports from "@/pages/admin/reports";
import AdminActivity from "@/pages/admin/activity";
import AdminSettings from "@/pages/admin/settings";
import AdminNotifications from "@/pages/admin/notifications";
import AdminResources from "@/pages/admin/resources";
import AdminJiraIntegration from "@/pages/admin/jira-integration";
import PMNotifications from "@/pages/pm/notifications";
import Analytics from "@/pages/analytics";
import Upsells from "@/pages/upsells";
import SoldUpsellsReport from "@/pages/sold-upsells-report";
import UpsellAiAnalysis from "@/pages/upsell-ai-analysis";
import PaymentsReport from "@/pages/payments-report";
import Invoices from "@/pages/invoices";
import Forecasting from "@/pages/forecasting";
import RecurringOverview from "@/pages/recurring-overview";
import ImportData from "@/pages/import-data";
import CostMargin from "@/pages/cost-margin";
import Timesheets from "@/pages/timesheets";
import DocumentRepository from "@/pages/document-repository";
import DriveDocuments from "@/pages/drive-documents";
import ThemeSettings from "@/pages/theme-settings";
import PmoKpis from "@/pages/pmo-kpis";
import { AppraisalReportPage, AppraisalPublicReportPage } from "@/pages/appraisal-report";
import AppraisalRolloutConsole from "@/pages/appraisal-rollout-console";
import PodsDashboard from "@/pages/pods";
import { Skeleton } from "@/components/ui/skeleton";
import { ActiveUsers } from "@/components/active-users";
import type { SystemPermission } from "@shared/schema";

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3.5rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties} defaultOpen={true}>
      <AppSidebar />
      <SidebarInset className="min-w-0 flex flex-col h-screen overflow-hidden">
        <header className="sticky top-0 z-40 flex items-center justify-between gap-2 p-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shrink-0">
          <SidebarTrigger data-testid="button-sidebar-toggle" />
          <div className="flex items-center gap-2">
            <SecurityBadge />
            <ActiveUsers />
            <NotificationsDropdown />
            <ThemeToggle />
          </div>
        </header>
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="space-y-4 text-center">
        <Skeleton className="h-12 w-12 rounded-full mx-auto" />
        <Skeleton className="h-4 w-32 mx-auto" />
      </div>
    </div>
  );
}

function Router() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [publicReportMatch] = useRoute("/r/appraisal/:token");

  const { data: userPermissions } = useQuery<SystemPermission[]>({
    queryKey: ["/api/access/my-permissions"],
    enabled: !!user,
  });

  // Permission-based access for admin modules
  const canViewUsers = userPermissions?.includes("view_users") ?? false;
  const canViewReports = userPermissions?.includes("view_reports") ?? false;
  const canViewSettings = userPermissions?.includes("view_settings") ?? false;
  const canViewNotifications = userPermissions?.includes("view_notifications") ?? false;
  const canSendNotifications = userPermissions?.includes("send_notifications") ?? false;
  
  // Permission-based access for main modules
  const canViewUpsells = userPermissions?.includes("view_upsells") ?? false;
  const canViewForecasting = (userPermissions?.includes("view_forecasting") || userPermissions?.includes("view_payments")) ?? false;
  const canViewKpis = userPermissions?.includes("view_kpis") ?? false;
  const canManageKpis = userPermissions?.includes("manage_kpis") ?? false;
  const canViewPods = (userPermissions?.includes("view_pods") || userPermissions?.includes("manage_pods")) ?? false;

  // Public, no-login report reached via a private share token. Matched before any
  // auth gating so a forwarded link works without a session.
  if (publicReportMatch) {
    return <AppraisalPublicReportPage />;
  }

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/" component={Landing} />
        <Route component={Landing} />
      </Switch>
    );
  }

  return (
    <Switch>
      {canViewUpsells && <Route path="/upsells/sold-report" component={SoldUpsellsReport} />}
      <Route>
        <AuthenticatedLayout>
          <Switch>
            <Route path="/" component={Dashboard} />
        <Route path="/recurring-overview" component={RecurringOverview} />
        <Route path="/payments" component={Payments} />
        <Route path="/invoices" component={Invoices} />
        <Route path="/planning" component={Planning} />
        <Route path="/projects" component={Projects} />
        <Route path="/analytics" component={Analytics} />
        <Route path="/cost-margin" component={CostMargin} />
        <Route path="/timesheets" component={Timesheets} />
        <Route path="/document-repository" component={DocumentRepository} />
        <Route path="/drive-documents" component={DriveDocuments} />
        {canViewUpsells && <Route path="/upsells" component={Upsells} />}
        {canViewUpsells && <Route path="/upsells/ai-analysis" component={UpsellAiAnalysis} />}
        <Route path="/reports/payments" component={PaymentsReport} />
        {canViewForecasting && <Route path="/forecasting" component={Forecasting} />}
        <Route path="/calendar">
          <Redirect to="/recurring-overview?view=calendar" />
        </Route>
        {canViewUsers && <Route path="/admin/users" component={AdminUsers} />}
        {canViewReports && <Route path="/admin/reports" component={AdminReports} />}
        {canViewSettings && <Route path="/admin/activity" component={AdminActivity} />}
        {canViewSettings && <Route path="/admin/settings" component={AdminSettings} />}
        {canSendNotifications && <Route path="/admin/notifications" component={AdminNotifications} />}
        {canViewUsers && <Route path="/admin/resources" component={AdminResources} />}
        {canViewSettings && <Route path="/admin/jira-integration" component={AdminJiraIntegration} />}
        {canViewNotifications && !canSendNotifications && <Route path="/notifications" component={PMNotifications} />}
        {canViewKpis && <Route path="/pmo-kpis" component={PmoKpis} />}
        {canManageKpis && <Route path="/pmo-kpis/rollout" component={AppraisalRolloutConsole} />}
        <Route path="/appraisals/:id/report" component={AppraisalReportPage} />
        {canViewPods && <Route path="/pods" component={PodsDashboard} />}
        <Route path="/import-data" component={ImportData} />
        <Route path="/settings/theme" component={ThemeSettings} />
        <Route component={NotFound} />
          </Switch>
        </AuthenticatedLayout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="financeflow-theme">
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
