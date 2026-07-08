import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Bell, Send, RefreshCw, AlertTriangle, Clock, CheckCircle2, MessageSquare, Inbox, Mail, MailOpen, History, EyeOff, Undo2 } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import type { PaymentWithProject, User, NotificationResponseWithDetails, NotificationWithDetails } from "@shared/schema";

type SentNotification = NotificationWithDetails & { recipient?: User | null };

export default function AdminNotifications() {
  const { toast } = useToast();
  const [selectedPayments, setSelectedPayments] = useState<Set<string>>(new Set());
  const [customMessage, setCustomMessage] = useState("");
  const [activeMainTab, setActiveMainTab] = useState("send");

  const { data: paymentsData, isLoading: paymentsLoading, refetch: refetchPayments } = useQuery<{
    dueSoon: PaymentWithProject[];
    overdue: PaymentWithProject[];
  }>({
    queryKey: ["/api/notifications/payments-needing-attention"],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: responses = [], isLoading: responsesLoading, refetch: refetchResponses } = useQuery<NotificationResponseWithDetails[]>({
    queryKey: ["/api/notifications/responses"],
  });

  const { data: unreadResponseCount = { count: 0 } } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/responses/unread-count"],
    refetchInterval: 30000,
  });

  const { data: sentNotifications = [], isLoading: sentLoading, refetch: refetchSent } = useQuery<SentNotification[]>({
    queryKey: ["/api/notifications/sent"],
  });

  const { data: dismissedPayments = [], isLoading: dismissedLoading, refetch: refetchDismissed } = useQuery<PaymentWithProject[]>({
    queryKey: ["/api/notifications/dismissed-payments"],
  });

  const userMap = new Map(users.map(u => [u.id, u]));

  const sendRemindersMutation = useMutation({
    mutationFn: async (data: { paymentIds: string[]; message?: string }) => {
      const res = await apiRequest("POST", "/api/notifications/send-reminders", data);
      return res.json() as Promise<{ success: boolean; notificationsSent: number; pmsNotified: number }>;
    },
    onSuccess: (data) => {
      toast({
        title: "Reminders Sent",
        description: `Successfully sent ${data.notificationsSent} notification(s) to ${data.pmsNotified} PM(s).`,
      });
      setSelectedPayments(new Set());
      setCustomMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/payments-needing-attention"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send reminders. Please try again.",
        variant: "destructive",
      });
    },
  });

  const generateAutoRemindersMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/notifications/generate-auto-reminders");
      return res.json() as Promise<{ success: boolean; overdueNotifications: number; dueSoonNotifications: number; totalNotifications: number }>;
    },
    onSuccess: (data) => {
      toast({
        title: "Auto Reminders Generated",
        description: `Generated ${data.totalNotifications} notification(s): ${data.overdueNotifications} overdue, ${data.dueSoonNotifications} due soon.`,
      });
      refetchPayments();
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/sent"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate auto reminders. Please try again.",
        variant: "destructive",
      });
    },
  });

  const markResponseAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/notifications/responses/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/responses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/responses/unread-count"] });
    },
  });

  const markAllResponsesAsReadMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/notifications/responses/read-all");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/responses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/responses/unread-count"] });
      toast({
        title: "All Marked Read",
        description: "All PM responses have been marked as read.",
      });
    },
  });

  const dismissPaymentMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      return apiRequest("POST", `/api/payments/${paymentId}/dismiss-from-reminders`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/payments-needing-attention"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/dismissed-payments"] });
      toast({
        title: "Payment Dismissed",
        description: "This payment will no longer appear in reminders.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to dismiss payment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const restorePaymentMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      return apiRequest("POST", `/api/payments/${paymentId}/restore-to-reminders`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/payments-needing-attention"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/dismissed-payments"] });
      toast({
        title: "Payment Restored",
        description: "This payment will now appear in reminders again.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to restore payment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const dismissAllMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/notifications/dismiss-all");
      return res.json() as Promise<{ dismissed: number; message: string }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/payments-needing-attention"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/dismissed-payments"] });
      setSelectedPayments(new Set());
      toast({
        title: "All Payments Dismissed",
        description: data.message,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to dismiss all payments. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSelectPayment = (paymentId: string, checked: boolean) => {
    const newSelected = new Set(selectedPayments);
    if (checked) {
      newSelected.add(paymentId);
    } else {
      newSelected.delete(paymentId);
    }
    setSelectedPayments(newSelected);
  };

  const handleSelectAll = (payments: PaymentWithProject[], checked: boolean) => {
    const newSelected = new Set(selectedPayments);
    for (const payment of payments) {
      if (checked) {
        newSelected.add(payment.id);
      } else {
        newSelected.delete(payment.id);
      }
    }
    setSelectedPayments(newSelected);
  };

  const handleSendReminders = () => {
    if (selectedPayments.size === 0) {
      toast({
        title: "No Payments Selected",
        description: "Please select at least one payment to send reminders.",
        variant: "destructive",
      });
      return;
    }
    sendRemindersMutation.mutate({
      paymentIds: Array.from(selectedPayments),
      message: customMessage || undefined,
    });
  };

  const renderPaymentRow = (payment: PaymentWithProject, isOverdue: boolean) => {
    const pm = payment.project?.pmId ? userMap.get(payment.project.pmId) : null;
    const dueDate = payment.dueDate ? new Date(payment.dueDate) : null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let daysDiff = 0;
    if (dueDate) {
      daysDiff = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    }

    return (
      <div
        key={payment.id}
        className="flex items-center gap-4 p-3 rounded-md border bg-card hover-elevate"
        data-testid={`payment-row-${payment.id}`}
      >
        <Checkbox
          checked={selectedPayments.has(payment.id)}
          onCheckedChange={(checked) => handleSelectPayment(payment.id, checked === true)}
          data-testid={`checkbox-payment-${payment.id}`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium truncate">{payment.project?.name}</span>
            <Badge variant={isOverdue ? "destructive" : "secondary"}>
              {isOverdue ? (
                <span className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {Math.abs(daysDiff)} days overdue
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {daysDiff} days left
                </span>
              )}
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            <span>{payment.project?.clientName}</span>
            {" | "}
            <span className="font-medium">${parseFloat(payment.expectedAmount).toLocaleString()}</span>
            {" | "}
            <span>Due: {dueDate ? format(dueDate, "MMM d, yyyy") : "N/A"}</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-medium">
            {pm ? `${pm.firstName || ""} ${pm.lastName || ""}`.trim() || pm.email : "No PM"}
          </div>
          <div className="text-xs text-muted-foreground">{payment.project?.region}</div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => dismissPaymentMutation.mutate(payment.id)}
          disabled={dismissPaymentMutation.isPending}
          title="Dismiss from reminders"
          data-testid={`button-dismiss-${payment.id}`}
        >
          <EyeOff className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>
    );
  };

  const renderDismissedPaymentRow = (payment: PaymentWithProject) => {
    const pm = payment.project?.pmId ? userMap.get(payment.project.pmId) : null;
    const dueDate = payment.dueDate ? new Date(payment.dueDate) : null;

    return (
      <div
        key={payment.id}
        className="flex items-center gap-4 p-3 rounded-md border bg-muted/50"
        data-testid={`dismissed-payment-row-${payment.id}`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium truncate">{payment.project?.name}</span>
            <Badge variant="secondary">
              {payment.month}/{payment.year}
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            <span>{payment.project?.clientName}</span>
            {" | "}
            <span className="font-medium">${parseFloat(payment.expectedAmount).toLocaleString()}</span>
            {dueDate && (
              <>
                {" | "}
                <span>Due: {format(dueDate, "MMM d, yyyy")}</span>
              </>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-medium">
            {pm ? `${pm.firstName || ""} ${pm.lastName || ""}`.trim() || pm.email : "No PM"}
          </div>
          <div className="text-xs text-muted-foreground">{payment.project?.region}</div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => restorePaymentMutation.mutate(payment.id)}
          disabled={restorePaymentMutation.isPending}
          data-testid={`button-restore-${payment.id}`}
        >
          <Undo2 className="h-4 w-4 mr-2" />
          Restore
        </Button>
      </div>
    );
  };

  const overduePayments = paymentsData?.overdue || [];
  const dueSoonPayments = paymentsData?.dueSoon || [];
  const allPayments = [...overduePayments, ...dueSoonPayments];

  const allOverdueSelected = overduePayments.length > 0 && overduePayments.every(p => selectedPayments.has(p.id));
  const allDueSoonSelected = dueSoonPayments.length > 0 && dueSoonPayments.every(p => selectedPayments.has(p.id));

  const unreadResponses = responses.filter(r => !r.isRead);

  const renderResponseItem = (response: NotificationResponseWithDetails) => {
    const responderName = response.responder 
      ? `${response.responder.firstName || ""} ${response.responder.lastName || ""}`.trim() || response.responder.email 
      : "Unknown PM";

    return (
      <div
        key={response.id}
        className={`p-4 rounded-md border ${response.isRead ? "bg-background" : "bg-muted/50"}`}
        data-testid={`response-item-${response.id}`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {!response.isRead && (
                <Badge variant="default" className="text-xs">New</Badge>
              )}
              <span className="font-medium">{responderName}</span>
              <span className="text-xs text-muted-foreground">
                {response.createdAt ? formatDistanceToNow(new Date(response.createdAt), { addSuffix: true }) : ""}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              Re: {response.notification?.title || "Notification"}
            </p>
            <p className="text-sm">{response.responseMessage}</p>
          </div>
          {!response.isRead && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markResponseAsReadMutation.mutate(response.id)}
              disabled={markResponseAsReadMutation.isPending}
              data-testid={`button-mark-read-${response.id}`}
            >
              <MailOpen className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    );
  };

  const renderSentNotificationItem = (notification: SentNotification) => {
    const recipientName = notification.recipient 
      ? `${notification.recipient.firstName || ""} ${notification.recipient.lastName || ""}`.trim() || notification.recipient.email 
      : "Unknown";

    return (
      <div
        key={notification.id}
        className="p-3 rounded-md border bg-background"
        data-testid={`sent-notification-${notification.id}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge variant="outline" className="text-xs">
                {notification.type === "manual_reminder" ? "Manual" : notification.type.replace(/_/g, " ")}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {notification.createdAt ? formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true }) : ""}
              </span>
            </div>
            <p className="text-sm font-medium">To: {recipientName}</p>
            <p className="text-sm text-muted-foreground line-clamp-2">{notification.message}</p>
          </div>
          {notification.isRead ? (
            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
          ) : (
            <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Notification Management</h1>
          <p className="text-muted-foreground">
            Send reminders to Project Managers and view their responses.
          </p>
        </div>
      </div>

      <Tabs value={activeMainTab} onValueChange={setActiveMainTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="send" className="gap-2" data-testid="tab-send-reminders">
            <Send className="h-4 w-4" />
            Send Reminders
          </TabsTrigger>
          <TabsTrigger value="responses" className="gap-2" data-testid="tab-pm-responses">
            <Inbox className="h-4 w-4" />
            PM Responses
            {unreadResponseCount.count > 0 && (
              <Badge variant="destructive" className="ml-1">{unreadResponseCount.count}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2" data-testid="tab-sent-history">
            <History className="h-4 w-4" />
            Sent History
          </TabsTrigger>
          <TabsTrigger value="dismissed" className="gap-2" data-testid="tab-dismissed">
            <EyeOff className="h-4 w-4" />
            Dismissed
            {dismissedPayments.length > 0 && (
              <Badge variant="secondary" className="ml-1">{dismissedPayments.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="send">
          <div className="flex items-center justify-end gap-2 mb-4 flex-wrap">
            <Button
              variant="outline"
              onClick={() => refetchPayments()}
              disabled={paymentsLoading}
              data-testid="button-refresh"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${paymentsLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              onClick={() => dismissAllMutation.mutate()}
              disabled={dismissAllMutation.isPending || allPayments.length === 0}
              data-testid="button-dismiss-all"
            >
              <EyeOff className={`h-4 w-4 mr-2 ${dismissAllMutation.isPending ? "animate-pulse" : ""}`} />
              Dismiss All ({allPayments.length})
            </Button>
            <Button
              variant="secondary"
              onClick={() => generateAutoRemindersMutation.mutate()}
              disabled={generateAutoRemindersMutation.isPending}
              data-testid="button-auto-generate"
            >
              <Bell className="h-4 w-4 mr-2" />
              Auto Generate Reminders
            </Button>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    Payments Needing Attention
                  </CardTitle>
                  <CardDescription>
                    Select payments to send manual reminders to their Project Managers.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {paymentsLoading ? (
                    <div className="text-center py-8 text-muted-foreground">Loading payments...</div>
                  ) : allPayments.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground flex flex-col items-center gap-2">
                      <CheckCircle2 className="h-12 w-12 text-green-500" />
                      <p>All payments are on track!</p>
                      <p className="text-sm">No overdue or upcoming payments require attention.</p>
                    </div>
                  ) : (
                    <Tabs defaultValue="overdue">
                      <TabsList className="mb-4">
                        <TabsTrigger value="overdue" data-testid="tab-overdue">
                          Overdue ({overduePayments.length})
                        </TabsTrigger>
                        <TabsTrigger value="due-soon" data-testid="tab-due-soon">
                          Due Soon ({dueSoonPayments.length})
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="overdue" className="space-y-3">
                        {overduePayments.length > 0 && (
                          <div className="flex items-center gap-2 pb-2 border-b">
                            <Checkbox
                              checked={allOverdueSelected}
                              onCheckedChange={(checked) => handleSelectAll(overduePayments, checked === true)}
                              data-testid="checkbox-select-all-overdue"
                            />
                            <span className="text-sm text-muted-foreground">Select all overdue</span>
                          </div>
                        )}
                        {overduePayments.length === 0 ? (
                          <p className="text-muted-foreground text-center py-4">No overdue payments</p>
                        ) : (
                          overduePayments.map(payment => renderPaymentRow(payment, true))
                        )}
                      </TabsContent>

                      <TabsContent value="due-soon" className="space-y-3">
                        {dueSoonPayments.length > 0 && (
                          <div className="flex items-center gap-2 pb-2 border-b">
                            <Checkbox
                              checked={allDueSoonSelected}
                              onCheckedChange={(checked) => handleSelectAll(dueSoonPayments, checked === true)}
                              data-testid="checkbox-select-all-due-soon"
                            />
                            <span className="text-sm text-muted-foreground">Select all due soon</span>
                          </div>
                        )}
                        {dueSoonPayments.length === 0 ? (
                          <p className="text-muted-foreground text-center py-4">No payments due soon</p>
                        ) : (
                          dueSoonPayments.map(payment => renderPaymentRow(payment, false))
                        )}
                      </TabsContent>
                    </Tabs>
                  )}
                </CardContent>
              </Card>
            </div>

            <div>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Send className="h-5 w-5" />
                    Send Reminders
                  </CardTitle>
                  <CardDescription>
                    Compose and send notifications to selected PMs.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="text-sm font-medium mb-2">Selected Payments</div>
                    <div className="text-2xl font-bold" data-testid="text-selected-count">
                      {selectedPayments.size}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Custom Message (Optional)</label>
                    <Textarea
                      placeholder="Enter a custom message for the reminder..."
                      value={customMessage}
                      onChange={(e) => setCustomMessage(e.target.value)}
                      rows={4}
                      data-testid="input-custom-message"
                    />
                  </div>

                  <Button
                    className="w-full"
                    onClick={handleSendReminders}
                    disabled={selectedPayments.size === 0 || sendRemindersMutation.isPending}
                    data-testid="button-send-reminders"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {sendRemindersMutation.isPending
                      ? "Sending..."
                      : `Send ${selectedPayments.size} Reminder${selectedPayments.size !== 1 ? "s" : ""}`}
                  </Button>
                </CardContent>
              </Card>

              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="text-base">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => handleSelectAll(overduePayments, true)}
                    disabled={overduePayments.length === 0}
                    data-testid="button-select-overdue"
                  >
                    <AlertTriangle className="h-4 w-4 mr-2 text-destructive" />
                    Select All Overdue ({overduePayments.length})
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => handleSelectAll(dueSoonPayments, true)}
                    disabled={dueSoonPayments.length === 0}
                    data-testid="button-select-due-soon"
                  >
                    <Clock className="h-4 w-4 mr-2 text-yellow-500" />
                    Select All Due Soon ({dueSoonPayments.length})
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => setSelectedPayments(new Set())}
                    disabled={selectedPayments.size === 0}
                    data-testid="button-clear-selection"
                  >
                    Clear Selection
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="responses">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    PM Responses
                  </CardTitle>
                  <CardDescription>
                    View and manage responses from Project Managers to your notifications.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchResponses()}
                    disabled={responsesLoading}
                    data-testid="button-refresh-responses"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${responsesLoading ? "animate-spin" : ""}`} />
                    Refresh
                  </Button>
                  {unreadResponses.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => markAllResponsesAsReadMutation.mutate()}
                      disabled={markAllResponsesAsReadMutation.isPending}
                      data-testid="button-mark-all-read"
                    >
                      <MailOpen className="h-4 w-4 mr-2" />
                      Mark All Read
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {responsesLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading responses...</div>
              ) : responses.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground flex flex-col items-center gap-2">
                  <Inbox className="h-12 w-12" />
                  <p>No responses yet</p>
                  <p className="text-sm">PM responses to your notifications will appear here.</p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3 pr-4">
                    {responses.map(response => renderResponseItem(response))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5" />
                    Sent Notifications History
                  </CardTitle>
                  <CardDescription>
                    View all notifications that have been sent to Project Managers.
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchSent()}
                  disabled={sentLoading}
                  data-testid="button-refresh-sent"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${sentLoading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {sentLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading sent notifications...</div>
              ) : sentNotifications.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground flex flex-col items-center gap-2">
                  <Send className="h-12 w-12" />
                  <p>No notifications sent yet</p>
                  <p className="text-sm">Sent notifications will appear here.</p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3 pr-4">
                    {sentNotifications.map(notification => renderSentNotificationItem(notification))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dismissed">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <EyeOff className="h-5 w-5" />
                    Dismissed Payments
                  </CardTitle>
                  <CardDescription>
                    Payments that have been dismissed from reminders. These are typically older payments 
                    that were later covered by subsequent payments.
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchDismissed()}
                  disabled={dismissedLoading}
                  data-testid="button-refresh-dismissed"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${dismissedLoading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {dismissedLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading dismissed payments...</div>
              ) : dismissedPayments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground flex flex-col items-center gap-2">
                  <CheckCircle2 className="h-12 w-12 text-green-500" />
                  <p>No dismissed payments</p>
                  <p className="text-sm">
                    Payments you dismiss from reminders will appear here. You can restore them if needed.
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3 pr-4">
                    {dismissedPayments.map(payment => renderDismissedPaymentRow(payment))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
