import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormDescription,
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Settings, Save, Link2, CheckCircle2, XCircle, RefreshCw, Plus, 
  Trash2, AlertCircle, Clock, ExternalLink, Server
} from "lucide-react";
import type { JiraIntegrationSettings, JiraProjectMapping, Project } from "@shared/schema";
import { format } from "date-fns";

const jiraSettingsSchema = z.object({
  serverUrl: z.string().url("Must be a valid URL"),
  username: z.string().min(1, "Username is required"),
  apiToken: z.string().optional(),
  webhookSecret: z.string().optional(),
  syncIntervalMinutes: z.coerce.number().min(5).max(1440),
  isActive: z.boolean(),
});

type JiraSettingsFormValues = z.infer<typeof jiraSettingsSchema>;

const projectMappingSchema = z.object({
  jiraProjectKey: z.string().min(1, "Jira project key is required"),
  jiraProjectName: z.string().optional(),
  revolrmoProjectId: z.string().min(1, "RevolRMO project is required"),
  isActive: z.boolean(),
});

type ProjectMappingFormValues = z.infer<typeof projectMappingSchema>;

export default function AdminJiraIntegration() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("connection");
  const [isMappingDialogOpen, setIsMappingDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<JiraProjectMapping | null>(null);
  const [deletingMappingId, setDeletingMappingId] = useState<string | null>(null);

  const { data: settings, isLoading: settingsLoading } = useQuery<JiraIntegrationSettings>({
    queryKey: ["/api/jira/settings"],
  });

  const { data: mappings, isLoading: mappingsLoading } = useQuery<JiraProjectMapping[]>({
    queryKey: ["/api/jira/mappings"],
  });

  const { data: projects } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["/api/projects"],
  });

  const settingsForm = useForm<JiraSettingsFormValues>({
    resolver: zodResolver(jiraSettingsSchema),
    defaultValues: {
      serverUrl: "",
      username: "",
      apiToken: "",
      webhookSecret: "",
      syncIntervalMinutes: 30,
      isActive: false,
    },
  });

  const mappingForm = useForm<ProjectMappingFormValues>({
    resolver: zodResolver(projectMappingSchema),
    defaultValues: {
      jiraProjectKey: "",
      jiraProjectName: "",
      revolrmoProjectId: "",
      isActive: true,
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: JiraSettingsFormValues) => {
      return apiRequest("POST", "/api/jira/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jira/settings"] });
      toast({
        title: "Settings saved",
        description: "Jira integration settings have been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save settings.",
        variant: "destructive",
      });
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/jira/test-connection");
    },
    onSuccess: (data: any) => {
      if (data.success) {
        toast({
          title: "Connection successful",
          description: "Successfully connected to Jira server.",
        });
      } else {
        toast({
          title: "Connection failed",
          description: data.error || "Could not connect to Jira server.",
          variant: "destructive",
        });
      }
    },
    onError: () => {
      toast({
        title: "Connection failed",
        description: "Could not connect to Jira server.",
        variant: "destructive",
      });
    },
  });

  const syncWorklogsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/jira/sync");
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/jira/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/timesheets"] });
      toast({
        title: "Sync completed",
        description: `Synced ${data.syncedCount || 0} worklogs from Jira.`,
      });
    },
    onError: () => {
      toast({
        title: "Sync failed",
        description: "Failed to sync worklogs from Jira.",
        variant: "destructive",
      });
    },
  });

  const createMappingMutation = useMutation({
    mutationFn: async (data: ProjectMappingFormValues) => {
      return apiRequest("POST", "/api/jira/mappings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jira/mappings"] });
      setIsMappingDialogOpen(false);
      mappingForm.reset();
      toast({
        title: "Mapping created",
        description: "Project mapping has been added.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create mapping.",
        variant: "destructive",
      });
    },
  });

  const updateMappingMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ProjectMappingFormValues }) => {
      return apiRequest("PATCH", `/api/jira/mappings/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jira/mappings"] });
      setIsMappingDialogOpen(false);
      setEditingMapping(null);
      mappingForm.reset();
      toast({
        title: "Mapping updated",
        description: "Project mapping has been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update mapping.",
        variant: "destructive",
      });
    },
  });

  const deleteMappingMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/jira/mappings/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jira/mappings"] });
      setIsDeleteDialogOpen(false);
      setDeletingMappingId(null);
      toast({
        title: "Mapping deleted",
        description: "Project mapping has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete mapping.",
        variant: "destructive",
      });
    },
  });

  const onSubmitSettings = (data: JiraSettingsFormValues) => {
    updateSettingsMutation.mutate(data);
  };

  const onSubmitMapping = (data: ProjectMappingFormValues) => {
    if (editingMapping) {
      updateMappingMutation.mutate({ id: editingMapping.id, data });
    } else {
      createMappingMutation.mutate(data);
    }
  };

  const openEditMappingDialog = (mapping: JiraProjectMapping) => {
    setEditingMapping(mapping);
    mappingForm.reset({
      jiraProjectKey: mapping.jiraProjectKey,
      jiraProjectName: mapping.jiraProjectName || "",
      revolrmoProjectId: mapping.revolrmoProjectId,
      isActive: mapping.isActive,
    });
    setIsMappingDialogOpen(true);
  };

  const openCreateMappingDialog = () => {
    setEditingMapping(null);
    mappingForm.reset({
      jiraProjectKey: "",
      jiraProjectName: "",
      revolrmoProjectId: "",
      isActive: true,
    });
    setIsMappingDialogOpen(true);
  };

  const getProjectName = (projectId: string) => {
    const project = projects?.find(p => p.id === projectId);
    return project?.name || "Unknown Project";
  };

  if (settingsLoading) {
    return (
      <div className="p-6">
        <Skeleton className="h-8 w-64 mb-6" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-jira-title">
            <Server className="h-6 w-6" />
            Jira Integration
          </h1>
          <p className="text-muted-foreground mt-1">
            Connect to your Jira server to automatically sync worklogs as timesheets.
          </p>
        </div>
        {settings?.isActive && (
          <div className="flex items-center gap-2">
            {settings.lastSyncStatus === "success" && (
              <Badge variant="outline" className="text-green-600 border-green-600">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Connected
              </Badge>
            )}
            {settings.lastSyncStatus === "failed" && (
              <Badge variant="outline" className="text-destructive border-destructive">
                <XCircle className="h-3 w-3 mr-1" />
                Sync Failed
              </Badge>
            )}
            {settings.lastSyncAt && (
              <span className="text-sm text-muted-foreground">
                Last sync: {format(new Date(settings.lastSyncAt), "MMM d, h:mm a")}
              </span>
            )}
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="connection" data-testid="tab-connection">
            <Link2 className="h-4 w-4 mr-2" />
            Connection
          </TabsTrigger>
          <TabsTrigger value="mappings" data-testid="tab-mappings">
            <Settings className="h-4 w-4 mr-2" />
            Project Mappings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="connection" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Jira Server Connection</CardTitle>
              <CardDescription>
                Configure the connection to your on-premise Jira server at http://10.10.30.35:8080/
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...settingsForm}>
                <form onSubmit={settingsForm.handleSubmit(onSubmitSettings)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={settingsForm.control}
                      name="serverUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Jira Server URL</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="http://10.10.30.35:8080"
                              data-testid="input-jira-url"
                            />
                          </FormControl>
                          <FormDescription>
                            The base URL of your Jira server
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={settingsForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="jira-service-account"
                              data-testid="input-jira-username"
                            />
                          </FormControl>
                          <FormDescription>
                            Jira account username for API access
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={settingsForm.control}
                      name="apiToken"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>API Token / Password</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="password"
                              placeholder="Enter token or leave blank to keep current"
                              data-testid="input-jira-token"
                            />
                          </FormControl>
                          <FormDescription>
                            Leave blank to keep existing token
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={settingsForm.control}
                      name="webhookSecret"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Webhook Secret (Optional)</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="password"
                              placeholder="Shared secret for webhook validation"
                              data-testid="input-webhook-secret"
                            />
                          </FormControl>
                          <FormDescription>
                            Used to validate incoming webhook requests from Jira
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={settingsForm.control}
                      name="syncIntervalMinutes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sync Interval (minutes)</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              min={5}
                              max={1440}
                              data-testid="input-sync-interval"
                            />
                          </FormControl>
                          <FormDescription>
                            How often to sync worklogs (5-1440 mins)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={settingsForm.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>Enable Integration</FormLabel>
                          <FormDescription>
                            Turn on to start syncing worklogs from Jira
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-jira-active"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <div className="flex items-center gap-3 flex-wrap pt-4">
                    <Button
                      type="submit"
                      disabled={updateSettingsMutation.isPending}
                      data-testid="button-save-settings"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {updateSettingsMutation.isPending ? "Saving..." : "Save Settings"}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => testConnectionMutation.mutate()}
                      disabled={testConnectionMutation.isPending}
                      data-testid="button-test-connection"
                    >
                      <Link2 className="h-4 w-4 mr-2" />
                      {testConnectionMutation.isPending ? "Testing..." : "Test Connection"}
                    </Button>

                    {settings?.isActive && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => syncWorklogsMutation.mutate()}
                        disabled={syncWorklogsMutation.isPending}
                        data-testid="button-manual-sync"
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${syncWorklogsMutation.isPending ? "animate-spin" : ""}`} />
                        {syncWorklogsMutation.isPending ? "Syncing..." : "Sync Now"}
                      </Button>
                    )}
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          {settings?.lastSyncError && (
            <Card className="border-destructive">
              <CardHeader className="pb-3">
                <CardTitle className="text-destructive flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Last Sync Error
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{settings.lastSyncError}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="mappings" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>Project Mappings</CardTitle>
                <CardDescription>
                  Map Jira projects to RevolRMO projects for worklog syncing
                </CardDescription>
              </div>
              <Button onClick={openCreateMappingDialog} data-testid="button-add-mapping">
                <Plus className="h-4 w-4 mr-2" />
                Add Mapping
              </Button>
            </CardHeader>
            <CardContent>
              {mappingsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : !mappings?.length ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No project mappings configured.</p>
                  <p className="text-sm">Add a mapping to start syncing Jira worklogs.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Jira Project</TableHead>
                      <TableHead>RevolRMO Project</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Sync</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mappings.map((mapping) => (
                      <TableRow key={mapping.id} data-testid={`row-mapping-${mapping.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{mapping.jiraProjectKey}</Badge>
                            {mapping.jiraProjectName && (
                              <span className="text-muted-foreground">{mapping.jiraProjectName}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getProjectName(mapping.revolrmoProjectId)}</TableCell>
                        <TableCell>
                          <Badge variant={mapping.isActive ? "default" : "secondary"}>
                            {mapping.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {mapping.lastSyncAt ? (
                            <span className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {format(new Date(mapping.lastSyncAt), "MMM d, h:mm a")}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Never</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openEditMappingDialog(mapping)}
                              data-testid={`button-edit-mapping-${mapping.id}`}
                            >
                              Edit
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                setDeletingMappingId(mapping.id);
                                setIsDeleteDialogOpen(true);
                              }}
                              data-testid={`button-delete-mapping-${mapping.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isMappingDialogOpen} onOpenChange={setIsMappingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingMapping ? "Edit Project Mapping" : "Add Project Mapping"}
            </DialogTitle>
            <DialogDescription>
              Map a Jira project to a RevolRMO project for worklog syncing.
            </DialogDescription>
          </DialogHeader>
          <Form {...mappingForm}>
            <form onSubmit={mappingForm.handleSubmit(onSubmitMapping)} className="space-y-4">
              <FormField
                control={mappingForm.control}
                name="jiraProjectKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Jira Project Key</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g., PROJ"
                        data-testid="input-mapping-jira-key"
                      />
                    </FormControl>
                    <FormDescription>
                      The project key in Jira (e.g., PROJ for PROJ-123 issues)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={mappingForm.control}
                name="jiraProjectName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Jira Project Name (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g., My Project"
                        data-testid="input-mapping-jira-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={mappingForm.control}
                name="revolrmoProjectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>RevolRMO Project</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-mapping-project">
                          <SelectValue placeholder="Select a project" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {projects?.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={mappingForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Active</FormLabel>
                      <FormDescription>
                        Enable syncing for this project
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-mapping-active"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsMappingDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMappingMutation.isPending || updateMappingMutation.isPending}
                  data-testid="button-save-mapping"
                >
                  {createMappingMutation.isPending || updateMappingMutation.isPending
                    ? "Saving..."
                    : editingMapping
                    ? "Update"
                    : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project Mapping</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this project mapping? This will stop syncing worklogs for this project.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingMappingId && deleteMappingMutation.mutate(deletingMappingId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-mapping"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
