import { useState, useRef, useEffect } from "react";
import { Palette } from "lucide-react";

const COMPACT_PRESETS = [
  "#00e89d", "#3b82f6", "#8b5cf6", "#ec4899",
  "#f59e0b", "#ef4444", "#06b6d4", "#f97316",
];

interface CompactColorPickerProps {
  value: string | null;
  onChange: (hex: string | null) => void;
}

export function CompactColorPicker({ value, onChange }: CompactColorPickerProps) {
  const [hexInput, setHexInput] = useState(value?.replace("#", "") || "");
  const colorRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHexInput(value?.replace("#", "") || "");
  }, [value]);

  return (
    <div className="space-y-2 px-1 py-1">
      <div className="flex flex-wrap gap-1.5">
        {COMPACT_PRESETS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(color); }}
            className={`w-6 h-6 rounded-md border-2 transition-all hover:scale-110 ${
              value?.toLowerCase() === color.toLowerCase()
                ? "border-foreground scale-110"
                : "border-transparent"
            }`}
            style={{ backgroundColor: color }}
          />
        ))}
        <div className="relative">
          <input
            ref={colorRef}
            type="color"
            value={value || "#00e89d"}
            onChange={(e) => { e.stopPropagation(); onChange(e.target.value); }}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); colorRef.current?.click(); }}
            className="w-6 h-6 rounded-md border-2 border-dashed border-muted-foreground flex items-center justify-center hover:border-foreground transition-colors"
          >
            <Palette className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground font-mono">#</span>
        <input
          type="text"
          value={hexInput}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            e.stopPropagation();
            setHexInput(e.target.value);
            const cleaned = `#${e.target.value}`;
            if (/^#[0-9a-fA-F]{6}$/.test(cleaned)) onChange(cleaned);
          }}
          maxLength={6}
          placeholder="hex..."
          className="flex-1 rounded-md border border-input bg-secondary px-2 py-0.5 text-[11px] text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        {value && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(null); }}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
