import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, getErrorMessage } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Plus, MoreHorizontal, UserCheck, UserX, KeyRound, Search, Trash2, X, Mail, Shield, Calendar, CheckCircle2, XCircle, Send } from "lucide-react";
import type { User, UserRole, UserStatus, Role, RolePermission, Grade, SalaryGradeBand } from "@shared/schema";

const userFormSchema = z.object({
  email: z.string().email("Invalid email address"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  role: z.string().min(1, "Role is required"),
  isProjectManager: z.boolean().default(false),
  joiningDate: z.string().optional(),
  gradeId: z.string().optional(),
  gradeBandId: z.string().optional(),
});

type UserFormValues = z.infer<typeof userFormSchema>;

// Extended role type with permissions
interface RoleWithPermissions extends Role {
  permissions?: string[];
}

// Permission category grouping for display
const permissionCategories: Record<string, { label: string; permissions: string[] }> = {
  dashboard: { label: "Dashboard", permissions: ["view_dashboard"] },
  payments: { label: "Payments", permissions: ["view_payments", "create_payments", "edit_payments", "delete_payments"] },
  projects: { label: "Projects", permissions: ["view_projects", "create_projects", "edit_projects", "delete_projects"] },
  planning: { label: "Monthly Planning", permissions: ["view_planning", "create_planning", "edit_planning", "delete_planning"] },
  upsells: { label: "Upsells", permissions: ["view_upsells", "create_upsells", "edit_upsells", "delete_upsells"] },
  forecasting: { label: "Forecasting", permissions: ["view_forecasting", "edit_forecasting"] },
  analytics: { label: "Analytics", permissions: ["view_analytics"] },
  calendar: { label: "Calendar", permissions: ["view_calendar"] },
  reports: { label: "Reports", permissions: ["view_reports", "export_reports"] },
  users: { label: "Users", permissions: ["view_users", "create_users", "edit_users", "delete_users"] },
  settings: { label: "Settings", permissions: ["view_settings", "edit_settings"] },
  notifications: { label: "Notifications", permissions: ["view_notifications", "send_notifications"] },
  access: { label: "Access Control", permissions: ["manage_roles"] },
};

export default function AdminUsers() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [search, setSearch] = useState("");
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [replacementUserId, setReplacementUserId] = useState<string>("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
      role: "",
      isProjectManager: false,
      joiningDate: "",
      gradeId: "",
      gradeBandId: "",
    },
  });

  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: roles } = useQuery<RoleWithPermissions[]>({
    queryKey: ["/api/access/roles"],
  });

  const { data: grades } = useQuery<Grade[]>({
    queryKey: ["/api/kpi/grades"],
  });

  const { data: gradeBands } = useQuery<SalaryGradeBand[]>({
    queryKey: ["/api/kpi/grade-bands"],
  });

  const watchedGradeId = form.watch("gradeId");
  const designationBands = (gradeBands || []).filter((b) => b.designationId === watchedGradeId);

  const { data: linkedData, isLoading: isLinkedDataLoading, isError: isLinkedDataError } = useQuery<{ counts: Record<string, number>; total: number }>({
    queryKey: ["/api/users", userToDelete?.id, "linked-data"],
    queryFn: async () => {
      const response = await fetch(`/api/users/${userToDelete!.id}/linked-data`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to check linked data");
      return response.json();
    },
    enabled: !!userToDelete,
    retry: 1,
  });

  // Get the role object for a user based on their role name
  const getUserRole = (user: User): RoleWithPermissions | undefined => {
    return roles?.find(r => r.name === user.role);
  };

  // Get permissions for a user based on their role
  const getUserPermissions = (user: User): string[] => {
    const role = getUserRole(user);
    return role?.permissions || [];
  };

  const createMutation = useMutation({
    mutationFn: async (data: UserFormValues) => {
      const response = await apiRequest("POST", "/api/users", data);
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsDialogOpen(false);
      form.reset();
      if (data.inviteEmailSent) {
        toast({ title: "User Created", description: "User has been created and an invitation email has been sent." });
      } else {
        toast({ 
          title: "User Created", 
          description: data.inviteEmailError 
            ? `User created but invitation email failed: ${data.inviteEmailError}` 
            : "User has been created. Invitation email was not sent (check email settings).",
          variant: data.inviteEmailError ? "destructive" : "default"
        });
      }
    },
    onError: (error) => {
      toast({ title: "Error", description: getErrorMessage(error, "Failed to create user."), variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: UserFormValues & { id: string }) => {
      return apiRequest("PATCH", `/api/users/${data.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsDialogOpen(false);
      setEditingUser(null);
      form.reset();
      toast({ title: "User Updated", description: "User has been updated successfully." });
    },
    onError: (error) => {
      toast({ title: "Error", description: getErrorMessage(error, "Failed to update user."), variant: "destructive" });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async (data: { id: string; status: UserStatus }) => {
      return apiRequest("PATCH", `/api/users/${data.id}`, { status: data.status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      // Blocking a user detaches them from their POD on the server, so refresh
      // POD rosters and stats dashboards to reflect the change immediately.
      queryClient.invalidateQueries({ queryKey: ["/api/pods"] });
      toast({ title: "Status Updated", description: "User status has been updated." });
    },
    onError: (error) => {
      toast({ title: "Error", description: getErrorMessage(error, "Failed to update user status."), variant: "destructive" });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("POST", `/api/users/${userId}/reset-password`);
    },
    onSuccess: () => {
      toast({ title: "Email Sent", description: "Password reset email has been sent to the user." });
    },
    onError: (error) => {
      toast({ title: "Error", description: getErrorMessage(error, "Failed to send password reset email. Check email configuration."), variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ userId, replacementId }: { userId: string; replacementId?: string }) => {
      const url = replacementId
        ? `/api/users/${userId}?replacementUserId=${replacementId}`
        : `/api/users/${userId}`;
      return apiRequest("DELETE", url);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/monthly-plans"] });
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === "/api/pm-targets"
      });
      setUserToDelete(null);
      setReplacementUserId("");
      toast({ title: "User Deleted", description: replacementUserId ? "User deleted and data reassigned successfully." : "User has been permanently deleted." });
    },
    onError: (error) => {
      toast({ title: "Error", description: getErrorMessage(error, "Failed to delete user."), variant: "destructive" });
    },
  });

  const resendInviteMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("POST", `/api/users/${userId}/resend-invite`);
    },
    onSuccess: () => {
      toast({ title: "Invite Sent", description: "Invitation email has been sent to the user." });
    },
    onError: (error) => {
      toast({ title: "Error", description: getErrorMessage(error, "Failed to send invitation email. Check email configuration."), variant: "destructive" });
    },
  });

  const filteredUsers = users?.filter(u => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      u.email?.toLowerCase().includes(searchLower) ||
      u.firstName?.toLowerCase().includes(searchLower) ||
      u.lastName?.toLowerCase().includes(searchLower)
    );
  }) || [];

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    const first = firstName?.charAt(0) || "";
    const last = lastName?.charAt(0) || "";
    return (first + last).toUpperCase() || "U";
  };

  const openEditDialog = (user: User) => {
    setEditingUser(user);
    form.reset({
      email: user.email || "",
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      role: user.role as UserRole,
      isProjectManager: user.isProjectManager ?? false,
      joiningDate: user.joiningDate || "",
      gradeId: user.gradeId || "",
      gradeBandId: user.gradeBandId || "",
    });
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingUser(null);
    form.reset();
    setIsDialogOpen(true);
  };

  const onSubmit = (data: UserFormValues) => {
    const payload: any = {
      ...data,
      joiningDate: data.joiningDate ? data.joiningDate : null,
      gradeId: data.gradeId ? data.gradeId : null,
      gradeBandId: data.gradeBandId ? data.gradeBandId : null,
    };
    if (editingUser) {
      updateMutation.mutate({ ...payload, id: editingUser.id });
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">User Management</h1>
          <p className="text-muted-foreground">Manage user accounts and permissions</p>
        </div>
        <Button onClick={openCreateDialog} data-testid="button-add-user">
          <Plus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          data-testid="input-search-users"
        />
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : filteredUsers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-16">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow 
                    key={user.id} 
                    data-testid={`row-user-${user.id}`}
                    className="cursor-pointer hover-elevate"
                    onClick={() => setSelectedUser(user)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={user.profileImageUrl || undefined} className="object-cover" />
                          <AvatarFallback className="text-xs">
                            {getInitials(user.firstName, user.lastName)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{user.firstName} {user.lastName}</p>
                          <p className="text-xs text-muted-foreground">ID: {user.id.slice(0, 8)}...</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === "admin" ? "default" : "secondary"} className="capitalize">
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={user.status === "active" ? "bg-chart-2/10 text-chart-2 border-chart-2/20" : "bg-destructive/10 text-destructive border-destructive/20"}
                        >
                          {user.status === "active" ? "Active" : "Blocked"}
                        </Badge>
                        {!user.lastLogin && (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800">
                            Pending Invite
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`button-user-menu-${user.id}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(user)}>
                            Edit User
                          </DropdownMenuItem>
                          {user.id !== currentUser?.id && (
                            <>
                              {!user.lastLogin && (
                                <DropdownMenuItem 
                                  onClick={() => resendInviteMutation.mutate(user.id)}
                                  disabled={resendInviteMutation.isPending}
                                  data-testid={`button-resend-invite-${user.id}`}
                                >
                                  <Send className="h-4 w-4 mr-2" />
                                  {resendInviteMutation.isPending ? "Sending..." : "Resend Invite"}
                                </DropdownMenuItem>
                              )}
                              {user.status === "active" ? (
                                <DropdownMenuItem onClick={() => toggleStatusMutation.mutate({ id: user.id, status: "blocked" })}>
                                  <UserX className="h-4 w-4 mr-2" />
                                  Block User
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={() => toggleStatusMutation.mutate({ id: user.id, status: "active" })}>
                                  <UserCheck className="h-4 w-4 mr-2" />
                                  Activate User
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem 
                                onClick={() => resetPasswordMutation.mutate(user.id)}
                                disabled={resetPasswordMutation.isPending}
                                data-testid={`button-reset-password-${user.id}`}
                              >
                                <KeyRound className="h-4 w-4 mr-2" />
                                {resetPasswordMutation.isPending ? "Sending..." : "Reset Password"}
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => setUserToDelete(user)}
                                className="text-destructive focus:text-destructive"
                                data-testid={`button-delete-user-${user.id}`}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete User
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>No users found.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUser ? "Edit User" : "Add New User"}</DialogTitle>
            <DialogDescription>
              {editingUser ? "Update user details and role." : "Create a new user account. They will be able to sign in after creation."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email *</FormLabel>
                  <FormControl><Input type="email" {...field} data-testid="input-user-email" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="firstName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name *</FormLabel>
                    <FormControl><Input {...field} data-testid="input-user-first-name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="lastName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name *</FormLabel>
                    <FormControl><Input {...field} data-testid="input-user-last-name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="role" render={({ field }) => (
                <FormItem>
                  <FormLabel>Role *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger data-testid="select-user-role"><SelectValue placeholder="Select a role" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {roles?.filter(r => r.isActive).map((role) => (
                        <SelectItem key={role.id} value={role.name}>
                          {role.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="isProjectManager" render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Project Manager</FormLabel>
                    <p className="text-xs text-muted-foreground">
                      Mark this user as a Project Manager. This is separate from their role and controls where they appear in PM lists, filters, and targets.
                    </p>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-user-project-manager"
                    />
                  </FormControl>
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="joiningDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Joining Date</FormLabel>
                    <FormControl>
                      <Input type="date" value={field.value || ""} onChange={field.onChange} data-testid="input-user-joining-date" />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">Used for appraisal eligibility (1+ year of service).</p>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="gradeId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Designation</FormLabel>
                    <Select onValueChange={(v) => { const nv = v === "none" ? "" : v; field.onChange(nv); form.setValue("gradeBandId", ""); }} value={field.value || "none"}>
                      <FormControl><SelectTrigger data-testid="select-user-grade"><SelectValue placeholder="Select a designation" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="none">No designation</SelectItem>
                        {grades?.map((g) => (
                          <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Designation sets the appraisal target score and base increment.</p>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="gradeBandId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Grade</FormLabel>
                    <Select onValueChange={(v) => field.onChange(v === "none" ? "" : v)} value={field.value || "none"} disabled={!watchedGradeId}>
                      <FormControl><SelectTrigger data-testid="select-user-grade-band"><SelectValue placeholder={watchedGradeId ? "Select a grade" : "Select a designation first"} /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="none">No grade</SelectItem>
                        {designationBands.map((b) => (
                          <SelectItem key={b.id} value={b.id}>{b.gradeCode ? `${b.gradeCode} · ` : ""}{Number(b.salaryAmount).toLocaleString()}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Pay grade within the designation; its Basic is the current salary for appraisals.</p>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-user">
                  {editingUser ? "Update User" : "Create User"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!userToDelete} onOpenChange={(open) => { if (!open) { setUserToDelete(null); setReplacementUserId(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              {isLinkedDataLoading ? (
                "Checking for linked data..."
              ) : isLinkedDataError ? (
                "Unable to check linked data. Please try again."
              ) : linkedData && linkedData.total > 0 ? (
                <>
                  <span className="font-medium">{userToDelete?.firstName} {userToDelete?.lastName}</span> has linked data that needs to be reassigned to another user before deletion.
                </>
              ) : (
                <>
                  Are you sure you want to permanently delete <span className="font-medium">{userToDelete?.firstName} {userToDelete?.lastName}</span>?
                  This action cannot be undone.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {isLinkedDataError && (
            <div className="rounded-lg border border-destructive/50 p-3 bg-destructive/10">
              <p className="text-sm text-destructive">Could not verify linked data. Deletion is blocked to prevent data loss. Please close and try again.</p>
            </div>
          )}

          {!isLinkedDataLoading && !isLinkedDataError && linkedData && linkedData.total > 0 && (
            <div className="space-y-4">
              <div className="rounded-lg border p-3 bg-muted/50">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Data to reassign</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {linkedData.counts.projects > 0 && (
                    <p className="text-sm" data-testid="text-linked-projects">{linkedData.counts.projects} Project{linkedData.counts.projects !== 1 ? "s" : ""}</p>
                  )}
                  {linkedData.counts.kpiReviews > 0 && (
                    <p className="text-sm" data-testid="text-linked-kpis">{linkedData.counts.kpiReviews} KPI Review{linkedData.counts.kpiReviews !== 1 ? "s" : ""}</p>
                  )}
                  {linkedData.counts.timesheets > 0 && (
                    <p className="text-sm" data-testid="text-linked-timesheets">{linkedData.counts.timesheets} Timesheet{linkedData.counts.timesheets !== 1 ? "s" : ""}</p>
                  )}
                  {linkedData.counts.pmTargets > 0 && (
                    <p className="text-sm" data-testid="text-linked-targets">{linkedData.counts.pmTargets} PM Target{linkedData.counts.pmTargets !== 1 ? "s" : ""}</p>
                  )}
                  {linkedData.counts.upsells > 0 && (
                    <p className="text-sm" data-testid="text-linked-upsells">{linkedData.counts.upsells} Upsell{linkedData.counts.upsells !== 1 ? "s" : ""}</p>
                  )}
                  {linkedData.counts.invoices > 0 && (
                    <p className="text-sm" data-testid="text-linked-invoices">{linkedData.counts.invoices} Invoice{linkedData.counts.invoices !== 1 ? "s" : ""}</p>
                  )}
                  {linkedData.counts.forecastEntries > 0 && (
                    <p className="text-sm" data-testid="text-linked-forecasts">{linkedData.counts.forecastEntries} Forecast Entr{linkedData.counts.forecastEntries !== 1 ? "ies" : "y"}</p>
                  )}
                  {linkedData.counts.signoffs > 0 && (
                    <p className="text-sm" data-testid="text-linked-signoffs">{linkedData.counts.signoffs} Signoff{linkedData.counts.signoffs !== 1 ? "s" : ""}</p>
                  )}
                  {linkedData.counts.activityLogs > 0 && (
                    <p className="text-sm" data-testid="text-linked-logs">{linkedData.counts.activityLogs} Activity Log{linkedData.counts.activityLogs !== 1 ? "s" : ""}</p>
                  )}
                  {linkedData.counts.notifications > 0 && (
                    <p className="text-sm" data-testid="text-linked-notifications">{linkedData.counts.notifications} Notification{linkedData.counts.notifications !== 1 ? "s" : ""}</p>
                  )}
                  {linkedData.counts.monthlyPlans > 0 && (
                    <p className="text-sm" data-testid="text-linked-plans">{linkedData.counts.monthlyPlans} Monthly Plan{linkedData.counts.monthlyPlans !== 1 ? "s" : ""}</p>
                  )}
                  {linkedData.counts.mergeAudits > 0 && (
                    <p className="text-sm" data-testid="text-linked-audits">{linkedData.counts.mergeAudits} Merge Audit{linkedData.counts.mergeAudits !== 1 ? "s" : ""}</p>
                  )}
                  {linkedData.counts.costRecords > 0 && (
                    <p className="text-sm" data-testid="text-linked-costs">{linkedData.counts.costRecords} Cost Record{linkedData.counts.costRecords !== 1 ? "s" : ""}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Reassign data to</label>
                <Select value={replacementUserId} onValueChange={setReplacementUserId}>
                  <SelectTrigger data-testid="select-replacement-user">
                    <SelectValue placeholder="Select a replacement user..." />
                  </SelectTrigger>
                  <SelectContent>
                    {users?.filter(u => u.id !== userToDelete?.id && u.status === "active").map(u => (
                      <SelectItem key={u.id} value={u.id} data-testid={`select-replacement-${u.id}`}>
                        {u.firstName} {u.lastName} ({u.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setUserToDelete(null); setReplacementUserId(""); }} data-testid="button-cancel-delete">
              Cancel
            </Button>
            {isLinkedDataError ? (
              <Button variant="destructive" disabled data-testid="button-confirm-delete">
                Delete Blocked
              </Button>
            ) : linkedData && linkedData.total > 0 ? (
              <Button
                variant="destructive"
                onClick={() => userToDelete && deleteMutation.mutate({ userId: userToDelete.id, replacementId: replacementUserId })}
                disabled={deleteMutation.isPending || !replacementUserId}
                data-testid="button-confirm-delete"
              >
                {deleteMutation.isPending ? "Reassigning & Deleting..." : "Reassign & Delete"}
              </Button>
            ) : (
              <Button
                variant="destructive"
                onClick={() => userToDelete && deleteMutation.mutate({ userId: userToDelete.id })}
                disabled={deleteMutation.isPending || isLinkedDataLoading}
                data-testid="button-confirm-delete"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Detail Side View */}
      <Sheet open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto" data-testid="sheet-user-details">
          {selectedUser && (
            <>
              <SheetHeader className="pb-4">
                <div className="flex items-start gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={selectedUser.profileImageUrl || undefined} className="object-cover" />
                    <AvatarFallback className="text-lg">
                      {getInitials(selectedUser.firstName, selectedUser.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <SheetTitle className="text-xl">
                      {selectedUser.firstName} {selectedUser.lastName}
                    </SheetTitle>
                    <Badge 
                      variant="outline"
                      className={selectedUser.status === "active" 
                        ? "mt-2 bg-chart-2/10 text-chart-2 border-chart-2/20" 
                        : "mt-2 bg-destructive/10 text-destructive border-destructive/20"
                      }
                    >
                      {selectedUser.status === "active" ? "Active" : "Blocked"}
                    </Badge>
                  </div>
                </div>
              </SheetHeader>

              <Separator />

              {/* User Information */}
              <div className="py-4 space-y-4">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">User Information</h3>
                
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Email</p>
                      <p className="font-medium">{selectedUser.email || "Not set"}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Role</p>
                      <div className="flex items-center gap-2">
                        <Badge variant={selectedUser.role === "admin" ? "default" : "secondary"} className="capitalize">
                          {getUserRole(selectedUser)?.displayName || selectedUser.role}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">User ID</p>
                      <p className="font-mono text-sm">{selectedUser.id}</p>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Permissions Section */}
              <div className="py-4 space-y-4">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Permissions</h3>
                
                {(() => {
                  const userPerms = getUserPermissions(selectedUser);
                  if (userPerms.length === 0) {
                    return (
                      <p className="text-sm text-muted-foreground">No permissions assigned to this role.</p>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      {Object.entries(permissionCategories).map(([key, category]) => {
                        const categoryPerms = category.permissions;
                        const hasAnyPermission = categoryPerms.some(p => userPerms.includes(p));
                        
                        if (!hasAnyPermission) return null;

                        return (
                          <div key={key} className="space-y-2">
                            <h4 className="text-sm font-medium">{category.label}</h4>
                            <div className="flex flex-wrap gap-1">
                              {categoryPerms.map(permission => {
                                const hasPermission = userPerms.includes(permission);
                                const label = permission.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
                                
                                return (
                                  <Badge 
                                    key={permission}
                                    variant="outline"
                                    className={hasPermission 
                                      ? "text-xs bg-chart-2/10 text-chart-2 border-chart-2/20" 
                                      : "text-xs bg-muted text-muted-foreground border-muted invisible"
                                    }
                                  >
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                    {label}
                                  </Badge>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              <Separator />

              {/* Actions */}
              <div className="py-4 space-y-2">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-3">Actions</h3>
                
                <div className="flex flex-col gap-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => {
                      openEditDialog(selectedUser);
                      setSelectedUser(null);
                    }}
                    data-testid="button-edit-from-sheet"
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Edit User
                  </Button>

                  {selectedUser.id !== currentUser?.id && (
                    <>
                      {selectedUser.status === "active" ? (
                        <Button
                          variant="outline"
                          className="w-full justify-start"
                          onClick={() => {
                            toggleStatusMutation.mutate({ id: selectedUser.id, status: "blocked" });
                            setSelectedUser(null);
                          }}
                          data-testid="button-block-from-sheet"
                        >
                          <UserX className="h-4 w-4 mr-2" />
                          Block User
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          className="w-full justify-start"
                          onClick={() => {
                            toggleStatusMutation.mutate({ id: selectedUser.id, status: "active" });
                            setSelectedUser(null);
                          }}
                          data-testid="button-activate-from-sheet"
                        >
                          <UserCheck className="h-4 w-4 mr-2" />
                          Activate User
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => resetPasswordMutation.mutate(selectedUser.id)}
                        disabled={resetPasswordMutation.isPending}
                        data-testid="button-reset-password-from-sheet"
                      >
                        <KeyRound className="h-4 w-4 mr-2" />
                        {resetPasswordMutation.isPending ? "Sending..." : "Reset Password"}
                      </Button>

                      <Button
                        variant="outline"
                        className="w-full justify-start text-destructive hover:text-destructive"
                        onClick={() => {
                          setUserToDelete(selectedUser);
                          setSelectedUser(null);
                        }}
                        data-testid="button-delete-from-sheet"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete User
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
