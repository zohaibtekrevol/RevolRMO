import { useState, useEffect } from "react";
import { useTheme } from "@/components/theme-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Palette, RotateCcw, Save, Moon, Sun, Monitor } from "lucide-react";
import type { ThemeSettings } from "@shared/schema";

const presetColors = [
  { name: "Blood Red", hsl: "0 85% 38%", hex: "#C22828" },
  { name: "Ocean Blue", hsl: "210 85% 45%", hex: "#1976D2" },
  { name: "Forest Green", hsl: "142 71% 35%", hex: "#2E7D32" },
  { name: "Royal Purple", hsl: "270 70% 45%", hex: "#7B1FA2" },
  { name: "Sunset Orange", hsl: "30 90% 50%", hex: "#F57C00" },
  { name: "Teal", hsl: "180 65% 40%", hex: "#00897B" },
  { name: "Deep Pink", hsl: "330 80% 45%", hex: "#C2185B" },
  { name: "Slate", hsl: "215 25% 45%", hex: "#5C6BC0" },
];

function hexToHsl(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "0 85% 38%";
  
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export default function ThemeSettingsPage() {
  const { themeSettings, themeSource, updateTheme, resetTheme, mode, setMode, isLoading } = useTheme();
  const { toast } = useToast();
  
  const [localSettings, setLocalSettings] = useState<ThemeSettings>({
    primaryColor: themeSettings?.primaryColor || "0 85% 38%",
    accentColor: themeSettings?.accentColor || "",
    sidebarColor: themeSettings?.sidebarColor || "",
    mode: mode as "light" | "dark" | "system",
  });
  
  const [customHex, setCustomHex] = useState("#C22828");
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (themeSettings) {
      setLocalSettings({
        primaryColor: themeSettings.primaryColor || "0 85% 38%",
        accentColor: themeSettings.accentColor || "",
        sidebarColor: themeSettings.sidebarColor || "",
        mode: themeSettings.mode || "system",
      });
    }
  }, [themeSettings]);

  const handleColorSelect = (hsl: string) => {
    setLocalSettings(prev => ({ ...prev, primaryColor: hsl }));
    setHasChanges(true);
  };

  const handleCustomColor = () => {
    const hsl = hexToHsl(customHex);
    setLocalSettings(prev => ({ ...prev, primaryColor: hsl }));
    setHasChanges(true);
  };

  const handleModeChange = (newMode: "light" | "dark" | "system") => {
    setLocalSettings(prev => ({ ...prev, mode: newMode }));
    setMode(newMode);
    setHasChanges(true);
  };

  const handleSave = () => {
    updateTheme(localSettings);
    setHasChanges(false);
    toast({
      title: "Theme Saved",
      description: "Your personalized theme has been applied.",
    });
  };

  const handleReset = () => {
    resetTheme();
    setLocalSettings({
      primaryColor: "0 85% 38%",
      accentColor: "",
      sidebarColor: "",
      mode: "system",
    });
    setHasChanges(false);
    toast({
      title: "Theme Reset",
      description: "Your theme has been reset to the system default.",
    });
  };

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Palette className="h-6 w-6" />
            Theme Settings
          </h1>
          <p className="text-muted-foreground mt-1">
            Personalize the application colors to your preference
          </p>
        </div>
        <div className="flex items-center gap-2">
          {themeSource === "user" && (
            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
              Custom Theme Active
            </span>
          )}
          {themeSource === "global" && (
            <span className="text-xs bg-muted px-2 py-1 rounded">
              Using Organization Default
            </span>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Appearance Mode</CardTitle>
          <CardDescription>
            Choose between light, dark, or system-based theme
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={localSettings.mode || "system"}
            onValueChange={(value) => handleModeChange(value as "light" | "dark" | "system")}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="light" id="light" data-testid="radio-mode-light" />
              <Label htmlFor="light" className="flex items-center gap-1 cursor-pointer">
                <Sun className="h-4 w-4" />
                Light
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="dark" id="dark" data-testid="radio-mode-dark" />
              <Label htmlFor="dark" className="flex items-center gap-1 cursor-pointer">
                <Moon className="h-4 w-4" />
                Dark
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="system" id="system" data-testid="radio-mode-system" />
              <Label htmlFor="system" className="flex items-center gap-1 cursor-pointer">
                <Monitor className="h-4 w-4" />
                System
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Primary Color</CardTitle>
          <CardDescription>
            Select a preset color or enter a custom color
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
            {presetColors.map((color) => (
              <button
                key={color.name}
                onClick={() => handleColorSelect(color.hsl)}
                className={`w-12 h-12 rounded-lg border-2 transition-all hover:scale-110 ${
                  localSettings.primaryColor === color.hsl
                    ? "border-foreground ring-2 ring-offset-2 ring-foreground"
                    : "border-transparent"
                }`}
                style={{ backgroundColor: color.hex }}
                title={color.name}
                data-testid={`color-preset-${color.name.toLowerCase().replace(/\s/g, "-")}`}
              />
            ))}
          </div>

          <Separator />

          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Label htmlFor="custom-color">Custom Color (Hex)</Label>
              <Input
                id="custom-color"
                type="text"
                value={customHex}
                onChange={(e) => setCustomHex(e.target.value)}
                placeholder="#C22828"
                className="font-mono"
                data-testid="input-custom-color"
              />
            </div>
            <div
              className="w-12 h-10 rounded border"
              style={{ backgroundColor: customHex }}
            />
            <Button
              variant="outline"
              onClick={handleCustomColor}
              data-testid="button-apply-custom-color"
            >
              Apply
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>
            See how your selected colors will look
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 border rounded-lg space-y-4">
            <div className="flex gap-2 flex-wrap">
              <Button data-testid="preview-button-primary">Primary Button</Button>
              <Button variant="secondary" data-testid="preview-button-secondary">Secondary</Button>
              <Button variant="outline" data-testid="preview-button-outline">Outline</Button>
              <Button variant="destructive" data-testid="preview-button-destructive">Destructive</Button>
            </div>
            <div className="flex gap-2">
              <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary ring-1 ring-inset ring-primary/20">
                Badge
              </span>
              <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                Muted Badge
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={handleReset}
          disabled={themeSource === "default"}
          data-testid="button-reset-theme"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset to Default
        </Button>
        <Button
          onClick={handleSave}
          disabled={!hasChanges}
          data-testid="button-save-theme"
        >
          <Save className="h-4 w-4 mr-2" />
          Save Theme
        </Button>
      </div>
    </div>
  );
}
