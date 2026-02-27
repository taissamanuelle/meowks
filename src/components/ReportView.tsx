import { useState, useEffect, useRef } from "react";
import { FileText, Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import jsPDF from "jspdf";

export function ReportView() {
  const { user, profile } = useAuth();
  const [report, setReport] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [memoriesHash, setMemoriesHash] = useState<string>("");
  const reportRef = useRef<HTMLDivElement>(null);

  const generateReport = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: memories } = await supabase
        .from("memories")
        .select("content")
        .eq("user_id", user.id);

      if (!memories || memories.length === 0) {
        setReport("");
        setMemoriesHash("");
        setLoading(false);
        return;
      }

      const hash = memories.map((m) => m.content).sort().join("|");
      // Skip if memories haven't changed
      if (hash === memoriesHash && report) {
        setLoading(false);
        return;
      }

      const memoriesList = memories.map((m) => m.content).join("\n- ");
      const displayName = profile?.display_name || "o usuário";

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/summarize-memory`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            userMessage: `Com base nas seguintes memórias sobre ${displayName}, gere um relatório completo e detalhado sobre essa pessoa. Organize em seções com markdown (use ## para títulos de seção). Inclua seções como: Visão Geral, Personalidade e Interesses, Vida Pessoal, Trabalho/Estudos, Preferências, e qualquer outra categoria relevante baseada nas memórias. Seja descritivo e elabore cada ponto.\n\nMemórias:\n- ${memoriesList}`,
            userName: displayName,
            mode: "report",
          }),
        }
      );

      if (!resp.ok) throw new Error("Erro ao gerar relatório");
      const { summary } = await resp.json();
      setReport(summary);
      setMemoriesHash(hash);
    } catch {
      toast.error("Erro ao gerar o relatório");
    }
    setLoading(false);
  };

  // Auto-generate on mount and when memories change
  useEffect(() => {
    if (!user) return;

    generateReport();

    // Subscribe to memory changes
    const channel = supabase
      .channel("report-memories")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "memories", filter: `user_id=eq.${user.id}` },
        () => {
          // Small delay to let DB settle
          setTimeout(() => generateReport(), 1000);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const exportPdf = () => {
    if (!report) return;

    const displayName = profile?.display_name || "Usuário";
    const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const marginL = 20;
    const marginR = 20;
    const maxW = pageW - marginL - marginR;
    let y = 25;

    const checkPage = (needed: number) => {
      if (y + needed > pageH - 20) {
        doc.addPage();
        y = 20;
      }
    };

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(17, 17, 17);
    doc.text(`Relatório de ${displayName}`, marginL, y);
    y += 8;
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(136, 136, 136);
    doc.text(`Gerado em ${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}`, marginL, y);
    y += 4;
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.5);
    doc.line(marginL, y, pageW - marginR, y);
    y += 10;

    // Parse markdown lines
    const lines = report.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) { y += 3; continue; }

      if (trimmed.startsWith("### ")) {
        checkPage(12);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(51, 51, 51);
        y += 4;
        const wrapped = doc.splitTextToSize(trimmed.replace(/^###\s*/, ""), maxW);
        doc.text(wrapped, marginL, y);
        y += wrapped.length * 5.5 + 3;
      } else if (trimmed.startsWith("## ")) {
        checkPage(14);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(15);
        doc.setTextColor(34, 34, 34);
        y += 6;
        const wrapped = doc.splitTextToSize(trimmed.replace(/^##\s*/, ""), maxW);
        doc.text(wrapped, marginL, y);
        y += wrapped.length * 6 + 3;
      } else if (trimmed.startsWith("# ")) {
        checkPage(16);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.setTextColor(17, 17, 17);
        y += 8;
        const wrapped = doc.splitTextToSize(trimmed.replace(/^#\s*/, ""), maxW);
        doc.text(wrapped, marginL, y);
        y += wrapped.length * 7 + 4;
      } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        checkPage(8);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.setTextColor(50, 50, 50);
        const text = trimmed.replace(/^[-*]\s*/, "").replace(/\*\*/g, "");
        const wrapped = doc.splitTextToSize(text, maxW - 6);
        doc.text("•", marginL, y);
        doc.text(wrapped, marginL + 5, y);
        y += wrapped.length * 5 + 2;
      } else {
        checkPage(8);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.setTextColor(50, 50, 50);
        const clean = trimmed.replace(/\*\*/g, "");
        const wrapped = doc.splitTextToSize(clean, maxW);
        doc.text(wrapped, marginL, y);
        y += wrapped.length * 5 + 2;
      }
    }

    doc.save(`relatorio-${displayName.toLowerCase().replace(/\s+/g, "-")}.pdf`);
  };

  if (!report && !loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-3 px-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <FileText className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">Relatório Pessoal</h2>
          <p className="text-muted-foreground text-sm max-w-xs">
            Adicione memórias para que seu relatório seja gerado automaticamente.
          </p>
        </div>
      </div>
    );
  }

  if (loading && !report) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 mx-auto animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-muted-foreground text-sm">Gerando seu relatório...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-6">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-lg font-semibold text-foreground">Seu Relatório</h2>
              {loading && <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={generateReport} disabled={loading} className="gap-1.5">
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
              <Button size="sm" onClick={exportPdf} className="gap-1.5">
                <Download className="h-3.5 w-3.5" />
                Exportar PDF
              </Button>
            </div>
          </div>
          <div
            ref={reportRef}
            className="prose prose-invert max-w-none text-foreground
              prose-headings:text-foreground
              prose-h1:text-2xl prose-h1:font-bold prose-h1:mt-8 prose-h1:mb-4
              prose-h2:text-xl prose-h2:font-semibold prose-h2:mt-6 prose-h2:mb-3
              prose-h3:text-lg prose-h3:font-medium prose-h3:mt-4 prose-h3:mb-2
              prose-p:text-foreground/85 prose-p:text-[15px] prose-p:leading-relaxed
              prose-li:text-foreground/85 prose-li:text-[15px]
              prose-strong:text-foreground prose-strong:font-semibold"
          >
            <ReactMarkdown>{report}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}
