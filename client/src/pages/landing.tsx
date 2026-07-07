import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { BarChart3, Shield, Users, TrendingUp, DollarSign, PieChart, ChevronDown } from "lucide-react";
import { SiGoogle } from "react-icons/si";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type DevUser = { id: string; email: string; firstName: string | null; lastName: string | null };

function DevLoginButton() {
  const [users, setUsers] = useState<DevUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dev-users")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setUsers(data))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-dashed border-amber-500 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950"
          data-testid="button-dev-login"
        >
          Dev Login
          <ChevronDown className="ml-1 h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 max-h-80 overflow-y-auto">
        <DropdownMenuLabel className="text-amber-600">Quick login (dev only)</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {loading && (
          <DropdownMenuItem disabled>Loading users…</DropdownMenuItem>
        )}
        {!loading && users.length === 0 && (
          <DropdownMenuItem disabled>No users found</DropdownMenuItem>
        )}
        {users.map((u) => (
          <DropdownMenuItem
            key={u.id}
            asChild
            data-testid={`dev-login-user-${u.id}`}
          >
            <a href={`/api/dev-login/${u.id}`} className="cursor-pointer">
              <div>
                <p className="font-medium text-sm">
                  {u.firstName || u.lastName ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() : u.email}
                </p>
                <p className="text-xs text-muted-foreground">{u.email}</p>
              </div>
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function LoginErrorBanner() {
  const [info, setInfo] = useState<{ error: string; reason: string } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    if (error) {
      setInfo({ error, reason: params.get("reason") || "" });
    }
  }, []);

  if (!info) return null;

  const friendly =
    info.error === "access_denied"
      ? "Sign-in was denied. Make sure you are using your @tekrevol.com Google account."
      : "Sign-in failed. Please try again.";

  return (
    <div
      className="container mx-auto max-w-4xl px-6 pt-6"
      data-testid="banner-login-error"
    >
      <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        <p className="font-medium" data-testid="text-login-error">{friendly}</p>
        {info.reason && (
          <p className="mt-1 text-xs opacity-80" data-testid="text-login-error-reason">
            Details: {info.reason}
          </p>
        )}
      </div>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-14 items-center justify-between gap-4 px-6">
          <div className="flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-primary" />
            <span className="text-lg font-semibold">RevolRMO</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {import.meta.env.DEV && <DevLoginButton />}
            <Button asChild data-testid="button-login">
              <a href="/api/login" className="flex items-center gap-2">
                <SiGoogle className="h-4 w-4" />
                Sign in with Google
              </a>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <LoginErrorBanner />
        <section className="py-20 px-6">
          <div className="container mx-auto max-w-4xl text-center">
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl mb-4">
              Revol Recurring Management Office
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
              Track recurring payments, manage upsells, set targets, and generate reports. 
              A complete solution for project managers and administrators.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" asChild data-testid="button-get-started">
                <a href="/api/login" className="flex items-center gap-2">
                  <SiGoogle className="h-5 w-5" />
                  Get Started with Google
                </a>
              </Button>
            </div>
          </div>
        </section>

        <section className="py-16 px-6 bg-muted/30">
          <div className="container mx-auto max-w-6xl">
            <h2 className="text-2xl font-semibold text-center mb-10">
              Everything You Need
            </h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-chart-1/10">
                      <BarChart3 className="h-5 w-5 text-chart-1" />
                    </div>
                    <CardTitle className="text-lg">Dashboard Analytics</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm">
                    Real-time metrics for targets, recurring payments, upsells, and region breakdowns with intuitive visualizations.
                  </CardDescription>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-chart-2/10">
                      <DollarSign className="h-5 w-5 text-chart-2" />
                    </div>
                    <CardTitle className="text-lg">Payment Management</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm">
                    Track invoices, due dates, and received amounts with comprehensive filtering by month, region, and status.
                  </CardDescription>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-chart-3/10">
                      <TrendingUp className="h-5 w-5 text-chart-3" />
                    </div>
                    <CardTitle className="text-lg">Monthly Planning</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm">
                    Set monthly targets, plan recurring payments, and mark items for targeting or non-targeting.
                  </CardDescription>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-chart-4/10">
                      <Users className="h-5 w-5 text-chart-4" />
                    </div>
                    <CardTitle className="text-lg">User Management</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm">
                    Admin controls for creating users, assigning roles, managing access, and resetting passwords.
                  </CardDescription>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-chart-5/10">
                      <PieChart className="h-5 w-5 text-chart-5" />
                    </div>
                    <CardTitle className="text-lg">Reporting</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm">
                    Generate daily, weekly, monthly, and yearly reports with filters for PM, region, and time periods.
                  </CardDescription>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-chart-1/10">
                      <Shield className="h-5 w-5 text-chart-1" />
                    </div>
                    <CardTitle className="text-lg">Secure Access</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm">
                    Private access for invited users only. Role-based permissions ensure data security and privacy.
                  </CardDescription>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="py-16 px-6">
          <div className="container mx-auto max-w-4xl text-center">
            <h2 className="text-2xl font-semibold mb-4">
              Ready to streamline your financial workflows?
            </h2>
            <p className="text-muted-foreground mb-8">
              Only @tekrevol.com Google accounts are authorized to access this system.
            </p>
            <Button variant="outline" size="lg" asChild data-testid="button-contact-admin">
              <a href="/api/login" className="flex items-center gap-2">
                <SiGoogle className="h-4 w-4" />
                Sign in with Google
              </a>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t py-8 px-6">
        <div className="container mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-chart-1" />
            <span className="font-medium">RevolRMO</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Recurring Management Office
          </p>
        </div>
      </footer>
    </div>
  );
}
