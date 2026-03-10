import { useState, useRef, useEffect, useCallback } from "react";
import { Palette } from "lucide-react";

interface AccentColorPickerProps {
  value: string; // hex
  onChange: (hex: string) => void;
}

const PRESETS = [
  "#00e89d", // default green
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#f59e0b", // amber
  "#ef4444", // red
  "#06b6d4", // cyan
  "#10b981", // emerald
  "#f97316", // orange
  "#6366f1", // indigo
];

export function AccentColorPicker({ value, onChange }: AccentColorPickerProps) {
  const [hexInput, setHexInput] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHexInput(value);
  }, [value]);

  const handleHexChange = useCallback((raw: string) => {
    setHexInput(raw);
    const cleaned = raw.startsWith("#") ? raw : `#${raw}`;
    if (/^#[0-9a-fA-F]{6}$/.test(cleaned)) {
      onChange(cleaned);
    }
  }, [onChange]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Palette className="h-4 w-4 text-accent" />
        <label className="text-sm font-medium text-foreground">Cor do app</label>
      </div>

      {/* Color wheel via native picker */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <input
            ref={inputRef}
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div
            className="w-10 h-10 rounded-xl border-2 border-border cursor-pointer transition-shadow hover:shadow-lg"
            style={{ backgroundColor: value }}
            onClick={() => inputRef.current?.click()}
          />
        </div>

        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-mono">#</span>
          <input
            type="text"
            value={hexInput.replace("#", "")}
            onChange={(e) => handleHexChange(e.target.value)}
            maxLength={6}
            placeholder="00e89d"
            className="w-full rounded-xl border border-input bg-secondary pl-7 pr-3 py-2 text-xs text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {/* Presets */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            className={`w-7 h-7 rounded-lg border-2 transition-all hover:scale-110 ${
              value.toLowerCase() === color.toLowerCase()
                ? "border-foreground scale-110"
                : "border-transparent"
            }`}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>

      <p className="text-[11px] text-muted-foreground/70">
        Escolha uma cor de destaque ou use o seletor para personalizar.
      </p>
    </div>
  );
}
