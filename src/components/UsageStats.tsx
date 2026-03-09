import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Progress } from "@/components/ui/progress";
import { Activity, Zap, ArrowUpRight, ArrowDownLeft } from "lucide-react";

interface UsageData {
  request_count: number;
  input_tokens: number;
  output_tokens: number;
}

const LIMITS = {
  requests_per_day: 500,
  input_tokens_per_day: 250_000,
  output_tokens_per_day: 65_536,
};

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function UsageStats({ refreshKey }: { refreshKey?: number }) {
  const { user } = useAuth();
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    supabase
      .from("api_usage")
      .select("request_count, input_tokens, output_tokens")
      .eq("user_id", user.id)
      .eq("usage_date", today)
      .maybeSingle()
      .then(({ data }) => {
        setUsage(data || { request_count: 0, input_tokens: 0, output_tokens: 0 });
        setLoading(false);
      });
  }, [user, refreshKey]);

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-secondary" />
        ))}
      </div>
    );
  }

  if (!usage) return null;

  const stats = [
    {
      label: "Requisições hoje",
      value: usage.request_count,
      limit: LIMITS.requests_per_day,
      icon: Activity,
      color: "hsl(var(--accent))",
    },
    {
      label: "Tokens de entrada",
      value: usage.input_tokens,
      limit: LIMITS.input_tokens_per_day,
      icon: ArrowDownLeft,
      color: "hsl(142, 71%, 45%)",
    },
    {
      label: "Tokens de saída",
      value: usage.output_tokens,
      limit: LIMITS.output_tokens_per_day,
      icon: ArrowUpRight,
      color: "hsl(217, 91%, 60%)",
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Zap className="h-4 w-4 text-accent" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Uso diário — Free Tier</span>
      </div>
      {stats.map((s) => {
        const pct = Math.min((s.value / s.limit) * 100, 100);
        const isHigh = pct >= 80;
        const isCritical = pct >= 95;
        return (
          <div key={s.label} className="rounded-xl bg-secondary/60 px-4 py-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <s.icon className="h-4 w-4" style={{ color: s.color }} />
                <span className="text-sm font-medium text-foreground">{s.label}</span>
              </div>
              <span className={`text-xs font-mono font-semibold ${isCritical ? "text-destructive" : isHigh ? "text-yellow-400" : "text-muted-foreground"}`}>
                {formatNumber(s.value)} / {formatNumber(s.limit)}
              </span>
            </div>
            <div className="relative h-2 rounded-full bg-secondary overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  background: isCritical
                    ? "hsl(var(--destructive))"
                    : isHigh
                      ? "hsl(45, 93%, 47%)"
                      : s.color,
                }}
              />
            </div>
          </div>
        );
      })}
      <p className="text-[10px] text-muted-foreground/60 text-center pt-1">
        Modelo: gemini-2.5-flash · 20 req/min · Reseta à meia-noite UTC
      </p>
    </div>
  );
}
