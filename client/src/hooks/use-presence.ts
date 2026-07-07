import { useState, useEffect, useRef, useCallback } from "react";

interface ActiveUser {
  odUserId: string;
  name: string;
  email: string;
  profileImageUrl: string | null;
  role: string;
}

interface UsePresenceOptions {
  enabled?: boolean;
}

export function usePresence({ enabled = true }: UsePresenceOptions = {}) {
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (!enabled) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/presence`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        ws.send(JSON.stringify({ type: "join" }));

        heartbeatRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "heartbeat" }));
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "presence_update") {
            setActiveUsers(data.users);
          } else if (data.type === "error") {
            console.error("Presence error:", data.message);
          }
        } catch (error) {
          console.error("Presence message parse error:", error);
        }
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current);
          heartbeatRef.current = null;
        }
        
        if (enabled && event.code !== 1008) {
          reconnectRef.current = setTimeout(() => {
            connect();
          }, 3000);
        }
      };

      ws.onerror = (error) => {
        console.error("Presence WebSocket error:", error);
      };
    } catch (error) {
      console.error("Failed to connect to presence WebSocket:", error);
    }
  }, [enabled]);

  useEffect(() => {
    connect();

    return () => {
      if (wsRef.current) {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "leave" }));
        }
        wsRef.current.close();
        wsRef.current = null;
      }
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
    };
  }, [connect]);

  return { activeUsers, isConnected };
}
