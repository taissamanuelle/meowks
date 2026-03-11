import { useEffect } from "react";

function hexToHSL(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
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

function adjustLightness(hsl: string, targetL: number): string {
  const parts = hsl.split(" ");
  return `${parts[0]} ${parts[1]} ${targetL}%`;
}

export function applyAccentColor(hex: string) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return;

  const hsl = hexToHSL(hex);
  const root = document.documentElement;

  // Parse HSL parts for user-bubble with adjusted lightness
  const parts = hsl.split(" ");
  const hue = parts[0];
  const sat = parts[1];

  root.style.setProperty("--primary", hsl);
  root.style.setProperty("--accent", hsl);
  root.style.setProperty("--ring", hsl);
  root.style.setProperty("--sidebar-primary", hsl);
  root.style.setProperty("--sidebar-ring", hsl);
  root.style.setProperty("--neural-glow", adjustLightness(hsl, 50));
  root.style.setProperty("--user-bubble", `${hue} ${sat} 28%`);
}

export function useAccentColor(hex: string | null) {
  useEffect(() => {
    if (hex) {
      applyAccentColor(hex);
    }
  }, [hex]);
}
