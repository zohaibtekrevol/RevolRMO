import { createContext, useContext, useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ThemeSettings } from "@shared/schema";

type ThemeMode = "dark" | "light" | "system";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: ThemeMode;
  storageKey?: string;
};

type ThemeProviderState = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  themeSettings: ThemeSettings | null;
  themeSource: "user" | "global" | "default";
  updateTheme: (settings: ThemeSettings) => void;
  resetTheme: () => void;
  isLoading: boolean;
};

const initialState: ThemeProviderState = {
  mode: "system",
  setMode: () => null,
  themeSettings: null,
  themeSource: "default",
  updateTheme: () => null,
  resetTheme: () => null,
  isLoading: true,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

function applyThemeColors(settings: ThemeSettings | null) {
  const root = window.document.documentElement;
  
  if (!settings) {
    root.style.removeProperty("--primary");
    root.style.removeProperty("--destructive");
    root.style.removeProperty("--ring");
    root.style.removeProperty("--sidebar-primary");
    root.style.removeProperty("--sidebar-accent");
    root.style.removeProperty("--sidebar-ring");
    root.style.removeProperty("--sidebar");
    return;
  }
  
  if (settings.primaryColor) {
    root.style.setProperty("--primary", settings.primaryColor);
    root.style.setProperty("--destructive", settings.primaryColor);
    root.style.setProperty("--ring", settings.primaryColor);
    root.style.setProperty("--sidebar-primary", settings.primaryColor);
    root.style.setProperty("--sidebar-ring", settings.primaryColor);
  }
  
  if (settings.accentColor) {
    root.style.setProperty("--sidebar-accent", settings.accentColor);
  }
  
  if (settings.sidebarColor) {
    root.style.setProperty("--sidebar", settings.sidebarColor);
  }
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "financeflow-theme",
  ...props
}: ThemeProviderProps) {
  const [mode, setModeState] = useState<ThemeMode>(
    () => (localStorage.getItem(storageKey) as ThemeMode) || defaultTheme
  );

  const { data: themeData, isLoading } = useQuery<{
    theme: ThemeSettings | null;
    source: "user" | "global" | "default";
  }>({
    queryKey: ["/api/theme"],
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  const updateThemeMutation = useMutation({
    mutationFn: async (settings: ThemeSettings) => {
      return apiRequest("PUT", "/api/theme", settings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/theme"] });
    },
  });

  const resetThemeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", "/api/theme");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/theme"] });
    },
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");

    // Priority: themeData mode (user/global) > localStorage mode > default
    // If themeData has a mode, use it (even if it's "system")
    // Only fall back to localStorage if no theme mode is set
    let effectiveMode: ThemeMode = mode;
    
    if (themeData?.theme?.mode) {
      // Theme from user or global settings takes priority
      effectiveMode = themeData.theme.mode;
    }

    if (effectiveMode === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";
      root.classList.add(systemTheme);
    } else {
      root.classList.add(effectiveMode);
    }
  }, [mode, themeData?.theme?.mode]);

  useEffect(() => {
    if (themeData?.theme) {
      applyThemeColors(themeData.theme);
    } else {
      applyThemeColors(null);
    }
  }, [themeData?.theme]);

  const setMode = (newMode: ThemeMode) => {
    localStorage.setItem(storageKey, newMode);
    setModeState(newMode);
  };

  const value: ThemeProviderState = {
    mode,
    setMode,
    themeSettings: themeData?.theme || null,
    themeSource: themeData?.source || "default",
    updateTheme: (settings: ThemeSettings) => updateThemeMutation.mutate(settings),
    resetTheme: () => resetThemeMutation.mutate(),
    isLoading,
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");

  return context;
};
