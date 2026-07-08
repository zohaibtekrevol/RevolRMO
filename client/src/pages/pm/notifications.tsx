import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Bell, RefreshCw, Mail, MailOpen, Reply, Clock, AlertTriangle, Send } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import type { NotificationWithDetails, NotificationResponse } from "@shared/schema";

type NotificationForPM = NotificationWithDetails & {
  myResponses?: NotificationResponse[];
};

export default function PMNotifications() {
  const { toast } = useToast();
  const [selectedNotification, setSelectedNotification] = useState<NotificationForPM | null>(null);
  const [responseMessage, setResponseMessage] = useState("");
  const [replyDialogOpen, setReplyDialogOpen] = useState(false);

  const { data: notifications = [], isLoading, refetch } = useQuery<NotificationForPM[]>({
    queryKey: ["/api/notifications"],
  });

  const { data: unreadCount = { count: 0 } } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    refetchInterval: 30000,
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/notifications/read-all");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
      toast({
        title: "All Read",
        description: "All notifications marked as read.",
      });
    },
  });

  const respondMutation = useMutation({
    mutationFn: async (data: { notificationId: string; message: string }) => {
      return apiRequest("POST", `/api/notifications/${data.notificationId}/respond`, {
        responseMessage: data.message,
      });
    },
    onSuccess: () => {
      toast({
        title: "Response Sent",
        description: "Your response has been sent to the administrator.",
      });
      setReplyDialogOpen(false);
      setResponseMessage("");
      setSelectedNotification(null);
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send response. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleReply = (notification: NotificationForPM) => {
    setSelectedNotification(notification);
    setResponseMessage("");
    setReplyDialogOpen(true);
    if (!notification.isRead) {
      markAsReadMutation.mutate(notification.id);
    }
  };

  const handleSendResponse = () => {
    if (!selectedNotification || !responseMessage.trim()) return;
    respondMutation.mutate({
      notificationId: selectedNotification.id,
      message: responseMessage.trim(),
    });
  };

  const getNotificationIcon = (type: string) => {
    if (type === "payment_overdue") {
      return <AlertTriangle className="h-4 w-4 text-destructive" />;
    }
    return <Clock className="h-4 w-4 text-yellow-500" />;
  };

  const getNotificationBadge = (type: string) => {
    if (type === "payment_overdue") {
      return <Badge variant="destructive">Overdue</Badge>;
    }
    if (type === "payment_due_soon") {
      return <Badge variant="secondary">Due Soon</Badge>;
    }
    return <Badge variant="outline">{type.replace(/_/g, " ")}</Badge>;
  };

  const unreadNotifications = notifications.filter(n => !n.isRead);

  const renderNotificationItem = (notification: NotificationForPM) => {
    const hasResponded = notification.responses && notification.responses.length > 0;

    return (
      <div
        key={notification.id}
        className={`p-4 rounded-md border ${notification.isRead ? "bg-background" : "bg-muted/50"}`}
        data-testid={`notification-item-${notification.id}`}
      >
        <div className="flex items-start gap-4">
          <div className="mt-1">
            {notification.isRead ? (
              <MailOpen className="h-5 w-5 text-muted-foreground" />
            ) : (
              <Mail className="h-5 w-5 text-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {!notification.isRead && (
                <Badge variant="default" className="text-xs">New</Badge>
              )}
              {getNotificationBadge(notification.type)}
              <span className="text-xs text-muted-foreground">
                {notification.createdAt ? formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true }) : ""}
              </span>
            </div>
            <h4 className="font-medium mb-1">{notification.title}</h4>
            <p className="text-sm text-muted-foreground mb-2">{notification.message}</p>
            
            {notification.payment && notification.payment.project && (
              <div className="text-sm bg-muted/50 p-2 rounded-md mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {getNotificationIcon(notification.type)}
                  <span className="font-medium">{notification.payment.project.name}</span>
                  <span className="text-muted-foreground">|</span>
                  <span>${parseFloat(notification.payment.expectedAmount).toLocaleString()}</span>
                  {notification.payment.dueDate && (
                    <>
                      <span className="text-muted-foreground">|</span>
                      <span>Due: {format(new Date(notification.payment.dueDate), "MMM d, yyyy")}</span>
                    </>
                  )}
                </div>
              </div>
            )}

            {hasResponded && (
              <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <Reply className="h-3 w-3" />
                You have already responded to this notification
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap mt-3">
              {!notification.isRead && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => markAsReadMutation.mutate(notification.id)}
                  disabled={markAsReadMutation.isPending}
                  data-testid={`button-mark-read-${notification.id}`}
                >
                  <MailOpen className="h-4 w-4 mr-1" />
                  Mark Read
                </Button>
              )}
              <Button
                variant={hasResponded ? "outline" : "default"}
                size="sm"
                onClick={() => handleReply(notification)}
                data-testid={`button-reply-${notification.id}`}
              >
                <Reply className="h-4 w-4 mr-1" />
                {hasResponded ? "Reply Again" : "Reply"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">My Notifications</h1>
          <p className="text-muted-foreground">
            View payment reminders and notifications from administrators.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isLoading}
            data-testid="button-refresh"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          {unreadNotifications.length > 0 && (
            <Button
              variant="secondary"
              onClick={() => markAllAsReadMutation.mutate()}
              disabled={markAllAsReadMutation.isPending}
              data-testid="button-mark-all-read"
            >
              <MailOpen className="h-4 w-4 mr-2" />
              Mark All Read
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unread</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-unread-count">{unreadCount.count}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-count">{notifications.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Overdue Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive" data-testid="text-overdue-count">
              {notifications.filter(n => n.type === "payment_overdue").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Due Soon Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600" data-testid="text-due-soon-count">
              {notifications.filter(n => n.type === "payment_due_soon").length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </CardTitle>
          <CardDescription>
            Payment reminders and alerts from administrators. Click Reply to respond.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading notifications...</div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground flex flex-col items-center gap-2">
              <Bell className="h-12 w-12" />
              <p>No notifications</p>
              <p className="text-sm">You have no notifications at the moment.</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-3 pr-4">
                {notifications.map(notification => renderNotificationItem(notification))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog open={replyDialogOpen} onOpenChange={setReplyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reply to Notification</DialogTitle>
            <DialogDescription>
              Send a response to the administrator regarding this notification.
            </DialogDescription>
          </DialogHeader>
          {selectedNotification && (
            <div className="space-y-4">
              <div className="bg-muted/50 p-3 rounded-md">
                <p className="text-sm font-medium mb-1">{selectedNotification.title}</p>
                <p className="text-sm text-muted-foreground">{selectedNotification.message}</p>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Your Response</label>
                <Textarea
                  placeholder="Type your response here..."
                  value={responseMessage}
                  onChange={(e) => setResponseMessage(e.target.value)}
                  rows={4}
                  data-testid="input-response-message"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReplyDialogOpen(false)}
              data-testid="button-cancel-reply"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendResponse}
              disabled={!responseMessage.trim() || respondMutation.isPending}
              data-testid="button-send-response"
            >
              <Send className="h-4 w-4 mr-2" />
              {respondMutation.isPending ? "Sending..." : "Send Response"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
