import { WebSocketServer, WebSocket } from "ws";
import type { Server, IncomingMessage } from "http";
import type { Express } from "express";
import { log } from "./index";
import { getSessionStore, getSessionSecret } from "./googleAuth";
import { storage } from "./storage";
import { parse as parseCookie } from "cookie";
import { unsign } from "cookie-signature";

interface ActiveUser {
visibleId: string;
  name: string;
  email: string;
  profileImageUrl: string | null;
  role: string;
  lastActiveTime: number;
  connectionCount: number;
}

interface PresenceConnection {
  ws: WebSocket;
  userId: string;
}

interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  profileImageUrl: string | null;
  role: string;
}

const activeUsers = new Map<string, ActiveUser>();
const connections = new Map<WebSocket, PresenceConnection>();

const INACTIVE_TIMEOUT = 60000;
const CLEANUP_INTERVAL = 30000;

function broadcastActiveUsers() {
  const users = Array.from(activeUsers.values()).map(user => ({
    odUserId: user.visibleId,
    name: user.name,
    email: user.email,
    profileImageUrl: user.profileImageUrl,
    role: user.role,
  }));

  const message = JSON.stringify({
    type: "presence_update",
    users,
  });

  connections.forEach((conn, ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
}

function cleanupInactiveUsers() {
  const now = Date.now();
  const inactiveKeys: string[] = [];

  activeUsers.forEach((user, key) => {
    if (now - user.lastActiveTime > INACTIVE_TIMEOUT) {
      inactiveKeys.push(key);
    }
  });

  if (inactiveKeys.length > 0) {
    inactiveKeys.forEach(key => {
      activeUsers.delete(key);
    });
    broadcastActiveUsers();
  }
}

function addUserConnection(user: AuthenticatedUser, ws: WebSocket) {
  const existing = activeUsers.get(user.id);
  
  if (existing) {
    existing.connectionCount++;
    existing.lastActiveTime = Date.now();
  } else {
    activeUsers.set(user.id, {
      visibleId: user.id,
      name: user.name,
      email: user.email,
      profileImageUrl: user.profileImageUrl,
      role: user.role,
      lastActiveTime: Date.now(),
      connectionCount: 1,
    });
  }

  connections.set(ws, {
    ws,
    userId: user.id,
  });
}

function removeUserConnection(ws: WebSocket): boolean {
  const conn = connections.get(ws);
  if (!conn) return false;

  const user = activeUsers.get(conn.userId);
  connections.delete(ws);

  if (user) {
    user.connectionCount--;
    if (user.connectionCount <= 0) {
      activeUsers.delete(conn.userId);
      return true;
    }
  }
  
  return false;
}

async function authenticateFromSession(req: IncomingMessage): Promise<AuthenticatedUser | null> {
  try {
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) {
      log("No cookie header in WebSocket request", "presence");
      return null;
    }

    const cookies = parseCookie(cookieHeader);
    const signedSessionId = cookies["connect.sid"];
    
    if (!signedSessionId) {
      log("No session cookie found", "presence");
      return null;
    }

    const sessionSecret = getSessionSecret();
    if (!sessionSecret) {
      log("Session secret not available", "presence");
      return null;
    }

    const sessionId = signedSessionId.startsWith("s:")
      ? unsign(signedSessionId.slice(2), sessionSecret)
      : signedSessionId;

    if (!sessionId) {
      log("Failed to unsign session cookie", "presence");
      return null;
    }

    const sessionStore = getSessionStore();
    
    return new Promise((resolve) => {
      sessionStore.get(sessionId, async (err: any, session: any) => {
        if (err || !session) {
          log(`Session lookup failed: ${err?.message || 'no session'}`, "presence");
          resolve(null);
          return;
        }

        const passport = session.passport;
        if (!passport?.user?.claims?.sub) {
          log("No user in session", "presence");
          resolve(null);
          return;
        }

        const odUserId = passport.user.claims.sub;
        
        try {
          const dbUser = await storage.getUser(odUserId);
          if (!dbUser) {
            log(`User not found in database: ${odUserId}`, "presence");
            resolve(null);
            return;
          }

          resolve({
            id: dbUser.id,
            name: `${dbUser.firstName || ''} ${dbUser.lastName || ''}`.trim() || dbUser.email || 'Unknown',
            email: dbUser.email || '',
            profileImageUrl: dbUser.profileImageUrl || null,
            role: dbUser.role || 'user',
          });
        } catch (dbError) {
          log(`Database lookup failed: ${dbError}`, "presence");
          resolve(null);
        }
      });
    });
  } catch (error) {
    log(`Authentication error: ${error}`, "presence");
    return null;
  }
}

export function setupPresenceWebSocket(httpServer: Server, app: Express) {
  const wss = new WebSocketServer({ 
    server: httpServer,
    path: "/ws/presence"
  });

  setInterval(cleanupInactiveUsers, CLEANUP_INTERVAL);

  wss.on("connection", async (ws, req) => {
    log("Presence WebSocket connecting...", "presence");

    const authenticatedUser = await authenticateFromSession(req);
    
    if (!authenticatedUser) {
      log("WebSocket connection rejected: not authenticated", "presence");
      ws.send(JSON.stringify({ type: "error", message: "Authentication required" }));
      ws.close(1008, "Authentication required");
      return;
    }

    ws.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString());

        if (message.type === "join") {
          addUserConnection(authenticatedUser, ws);
          log(`User ${authenticatedUser.name} joined presence`, "presence");
          broadcastActiveUsers();
        } else if (message.type === "heartbeat") {
          const user = activeUsers.get(authenticatedUser.id);
          if (user) {
            user.lastActiveTime = Date.now();
          }
        } else if (message.type === "leave") {
          const needsBroadcast = removeUserConnection(ws);
          if (needsBroadcast) {
            broadcastActiveUsers();
          }
        }
      } catch (error) {
        console.error("Presence WebSocket message error:", error);
      }
    });

    ws.on("close", () => {
      const needsBroadcast = removeUserConnection(ws);
      if (needsBroadcast) {
        broadcastActiveUsers();
        log(`User ${authenticatedUser.name} left presence`, "presence");
      }
    });

    ws.on("error", (error) => {
      console.error("Presence WebSocket error:", error);
    });
  });

  log("Presence WebSocket server initialized on /ws/presence", "presence");
}
