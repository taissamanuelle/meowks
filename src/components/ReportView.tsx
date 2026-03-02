import { useState, useEffect } from "react";
import { Sparkles, ThumbsUp, ThumbsDown, RefreshCw, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Trait {
  label: string;
  detail: string;
  improved?: boolean; // if true, means user improved on this flaw
}

interface TraitsData {
  qualities: Trait[];
  flaws: Trait[];
}

export function ReportView() {
  const { user, profile } = useAuth();
  const [data, setData] = useState<TraitsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [memoriesHash, setMemoriesHash] = useState("");

  const analyze = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: memories } = await supabase
        .from("memories")
        .select("content")
        .eq("user_id", user.id);

      if (!memories || memories.length === 0) {
        setData(null);
        setMemoriesHash("");
        setLoading(false);
        return;
      }

      const hash = memories.map((m) => m.content).sort().join("|");
      if (hash === memoriesHash && data) {
        setLoading(false);
        return;
      }

      const memoriesList = memories.map((m) => `- ${m.content}`).join("\n");
      const displayName = profile?.display_name || "o usuário";

      const { data: { session: s } } = await supabase.auth.getSession();
      const token = s?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/summarize-memory`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            userMessage: memoriesList,
            userName: displayName,
            mode: "traits",
          }),
        }
      );

      if (!resp.ok) throw new Error("Erro ao analisar");
      const { summary } = await resp.json();

      try {
        // Extract JSON from the response (might be wrapped in markdown code block)
        const jsonStr = summary.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const parsed: TraitsData = JSON.parse(jsonStr);
        setData(parsed);
        setMemoriesHash(hash);
      } catch {
        console.error("Failed to parse traits JSON:", summary);
        toast.error("Erro ao processar análise");
      }
    } catch {
      toast.error("Erro ao gerar análise");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    analyze();

    const channel = supabase
      .channel("traits-memories")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "memories", filter: `user_id=eq.${user.id}` },
        () => setTimeout(() => analyze(), 1000)
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  if (!data && !loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-3 px-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">Autoconhecimento</h2>
          <p className="text-muted-foreground text-sm max-w-xs">
            Adicione memórias para descobrir suas qualidades e pontos a melhorar.
          </p>
        </div>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 mx-auto animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-muted-foreground text-sm">Analisando suas memórias...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-5 py-6 space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Relatório</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Baseado nas suas memórias</p>
            </div>
            <button
              onClick={analyze}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              Atualizar
            </button>
          </div>

          {/* Qualidades */}
          {data && data.qualities.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/15">
                  <ThumbsUp className="h-4 w-4 text-emerald-400" />
                </div>
                <h3 className="text-base font-semibold text-foreground">Qualidades</h3>
                <span className="text-xs text-muted-foreground ml-auto">{data.qualities.length} encontradas</span>
              </div>
              <div className="space-y-2.5">
                {data.qualities.map((q, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 transition-colors"
                  >
                    <p className="text-sm font-medium text-foreground">{q.label}</p>
                    <p className="text-[13px] text-muted-foreground mt-0.5 leading-relaxed">{q.detail}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Defeitos / Pontos a melhorar */}
          {data && data.flaws.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/15">
                  <ThumbsDown className="h-4 w-4 text-amber-400" />
                </div>
                <h3 className="text-base font-semibold text-foreground">Pontos a melhorar</h3>
                <span className="text-xs text-muted-foreground ml-auto">{data.flaws.filter(f => !f.improved).length} ativos</span>
              </div>
              <div className="space-y-2.5">
                {data.flaws.map((f, i) => (
                  <div
                    key={i}
                    className={cn(
                      "rounded-xl border px-4 py-3 transition-colors",
                      f.improved
                        ? "border-emerald-500/20 bg-emerald-500/5"
                        : "border-amber-500/20 bg-amber-500/5"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <p className={cn("text-sm font-medium", f.improved ? "text-emerald-400" : "text-foreground")}>{f.label}</p>
                      {f.improved && (
                        <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-full">
                          <TrendingUp className="h-3 w-3" />
                          Melhorou
                        </span>
                      )}
                    </div>
                    <p className="text-[13px] text-muted-foreground mt-0.5 leading-relaxed">{f.detail}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {data && data.qualities.length === 0 && data.flaws.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Adicione mais memórias para que a análise seja gerada.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
