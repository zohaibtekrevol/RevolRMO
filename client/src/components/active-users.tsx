import { usePresence } from "@/hooks/use-presence";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Users, Mail } from "lucide-react";
import type { User } from "@shared/schema";

function getInitials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function getRoleLabel(role: string): string {
  const roleLabels: Record<string, string> = {
    admin: "Administrator",
    ceo: "CEO",
    cfo: "CFO",
    pm: "Project Manager",
    finance: "Finance",
    viewer: "Viewer",
  };
  return roleLabels[role] || role;
}

function getAvatarColor(userId: string): string {
  const colors = [
    "bg-blue-500",
    "bg-green-500",
    "bg-purple-500",
    "bg-orange-500",
    "bg-pink-500",
    "bg-teal-500",
    "bg-indigo-500",
    "bg-rose-500",
  ];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function ActiveUsers() {
  const { data: currentUser } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

  const { activeUsers, isConnected } = usePresence({
    enabled: !!currentUser?.id,
  });

  if (!currentUser || activeUsers.length === 0) {
    return null;
  }

  const currentUserId = currentUser.id;

  const visibleUsers = activeUsers.slice(0, 5);
  const overflowCount = activeUsers.length - 5;

  return (
    <div className="flex items-center gap-2" data-testid="active-users-container">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Users className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Active:</span>
      </div>
      <div className="flex -space-x-2">
        {visibleUsers.map((user) => {
          const isCurrentUser = user.odUserId === currentUserId;
          return (
            <HoverCard key={user.odUserId} openDelay={200} closeDelay={100}>
              <HoverCardTrigger asChild>
                <Avatar 
                  className={`h-8 w-8 border-2 border-background cursor-pointer ring-2 ring-green-500/50 ${!user.profileImageUrl ? getAvatarColor(user.odUserId) : ''}`}
                  data-testid={`avatar-user-${user.odUserId}`}
                >
                  {user.profileImageUrl && (
                    <AvatarImage 
                      src={user.profileImageUrl} 
                      alt={user.name}
                      className="object-cover"
                    />
                  )}
                  <AvatarFallback className="text-white text-xs font-medium bg-transparent">
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
              </HoverCardTrigger>
              <HoverCardContent side="bottom" align="center" className="w-72 p-4">
                <div className="flex gap-4">
                  <Avatar className={`h-14 w-14 ${!user.profileImageUrl ? getAvatarColor(user.odUserId) : ''}`}>
                    {user.profileImageUrl && (
                      <AvatarImage 
                        src={user.profileImageUrl} 
                        alt={user.name}
                        className="object-cover"
                      />
                    )}
                    <AvatarFallback className="text-white text-lg font-medium bg-transparent">
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-1">
                    <h4 className="text-sm font-semibold">
                      {user.name}
                      {isCurrentUser && <span className="text-muted-foreground"> (You)</span>}
                    </h4>
                    <p className="text-xs text-muted-foreground">{getRoleLabel(user.role)}</p>
                    {user.email && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        <span className="truncate">{user.email}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs text-muted-foreground">Currently online</span>
                  </div>
                </div>
              </HoverCardContent>
            </HoverCard>
          );
        })}
        {overflowCount > 0 && (
          <HoverCard openDelay={200} closeDelay={100}>
            <HoverCardTrigger asChild>
              <Avatar 
                className="h-8 w-8 border-2 border-background bg-muted cursor-pointer"
                data-testid="avatar-overflow"
              >
                <AvatarFallback className="text-xs font-medium">
                  +{overflowCount}
                </AvatarFallback>
              </Avatar>
            </HoverCardTrigger>
            <HoverCardContent side="bottom" align="center" className="w-64 p-3">
              <p className="text-sm font-medium mb-2">
                {overflowCount} more {overflowCount === 1 ? "user" : "users"} online
              </p>
              <div className="space-y-2">
                {activeUsers.slice(5).map((user) => (
                  <div key={user.odUserId} className="flex items-center gap-2">
                    <Avatar className={`h-6 w-6 ${!user.profileImageUrl ? getAvatarColor(user.odUserId) : ''}`}>
                      {user.profileImageUrl && (
                        <AvatarImage src={user.profileImageUrl} alt={user.name} />
                      )}
                      <AvatarFallback className="text-white text-xs bg-transparent">
                        {getInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm truncate">{user.name}</span>
                  </div>
                ))}
              </div>
            </HoverCardContent>
          </HoverCard>
        )}
      </div>
    </div>
  );
}
