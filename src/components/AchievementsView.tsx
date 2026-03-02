import { useState, useEffect, useCallback } from "react";
import { Trophy, Plus, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Achievement {
  id: string;
  title: string;
  year: number;
  created_at: string;
}

// Deterministic color from year — each year gets a unique vibrant hue
const YEAR_COLORS: Record<number, { bg: string; border: string; text: string }> = {};
function getYearColor(year: number) {
  if (YEAR_COLORS[year]) return YEAR_COLORS[year];
  // Use golden-angle hue distribution seeded by year for nice spread
  const hue = ((year * 137.508) % 360);
  YEAR_COLORS[year] = {
    bg: `hsla(${hue}, 70%, 50%, 0.08)`,
    border: `hsla(${hue}, 70%, 50%, 0.25)`,
    text: `hsla(${hue}, 70%, 60%, 1)`,
  };
  return YEAR_COLORS[year];
}

export function AchievementsView() {
  const { user } = useAuth();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchAchievements = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("achievements")
      .select("*")
      .eq("user_id", user.id)
      .order("year", { ascending: false });
    if (data) setAchievements(data as Achievement[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchAchievements();
  }, [fetchAchievements]);

  const handleAdd = async () => {
    if (!user || !title.trim()) return;
    setAdding(true);
    const { error } = await supabase.from("achievements").insert({
      user_id: user.id,
      title: title.trim(),
      year,
    });
    if (error) {
      toast.error("Erro ao adicionar conquista");
    } else {
      toast.success("Conquista adicionada!");
      setTitle("");
      setShowForm(false);
      await fetchAchievements();
    }
    setAdding(false);
  };

  const handleDelete = async (id: string) => {
    if (deletingId === id) {
      await supabase.from("achievements").delete().eq("id", id);
      setAchievements((p) => p.filter((a) => a.id !== id));
      setDeletingId(null);
      toast.success("Conquista removida");
    } else {
      setDeletingId(id);
      setTimeout(() => setDeletingId(null), 3000);
    }
  };

  // Group by year
  const grouped = achievements.reduce<Record<number, Achievement[]>>((acc, a) => {
    (acc[a.year] ||= []).push(a);
    return acc;
  }, {});
  const sortedYears = Object.keys(grouped)
    .map(Number)
    .sort((a, b) => b - a);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-5 py-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Conquistas</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Registro das suas conquistas por ano</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowForm(!showForm)}
              className="gap-1.5"
            >
              {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {showForm ? "Cancelar" : "Adicionar"}
            </Button>
          </div>

          {/* Add form */}
          {showForm && (
            <div className="rounded-xl border border-border bg-card/50 p-4 space-y-3">
              <Input
                placeholder="Qual foi a conquista?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                autoFocus
              />
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-muted-foreground">Ano:</label>
                  <Input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    className="w-24"
                    min={1900}
                    max={2100}
                  />
                </div>
                <Button
                  onClick={handleAdd}
                  disabled={!title.trim() || adding}
                  size="sm"
                  className="ml-auto"
                >
                  Salvar
                </Button>
              </div>
            </div>
          )}

          {/* Empty state */}
          {achievements.length === 0 && !showForm && (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <Trophy className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground">Suas conquistas</h3>
              <p className="text-muted-foreground text-sm max-w-xs text-center">
                Registre marcos importantes da sua vida. A IA vai conhecer suas conquistas assim como conhece suas memórias.
              </p>
            </div>
          )}

          {/* Achievements list grouped by year */}
          {sortedYears.map((yr) => {
            const color = getYearColor(yr);
            return (
              <section key={yr}>
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="text-sm font-bold px-2.5 py-0.5 rounded-full"
                    style={{ backgroundColor: color.bg, color: color.text, border: `1px solid ${color.border}` }}
                  >
                    {yr}
                  </span>
                  <span className="text-xs text-muted-foreground">{grouped[yr].length} conquista{grouped[yr].length !== 1 ? "s" : ""}</span>
                </div>
                <div className="space-y-2">
                  {grouped[yr].map((a) => (
                    <div
                      key={a.id}
                      className="group rounded-xl px-4 py-3 transition-colors flex items-center gap-3"
                      style={{
                        backgroundColor: color.bg,
                        border: `1px solid ${color.border}`,
                      }}
                    >
                      <Trophy className="h-4 w-4 shrink-0" style={{ color: color.text }} />
                      <p className="text-sm font-medium text-foreground flex-1">{a.title}</p>
                      <button
                        onClick={() => handleDelete(a.id)}
                        className={cn(
                          "opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-destructive/10",
                          deletingId === a.id && "opacity-100 text-destructive"
                        )}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
