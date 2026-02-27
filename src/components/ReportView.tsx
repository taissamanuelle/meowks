import { useState, useEffect, useRef } from "react";
import { FileText, Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

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

  const exportPdf = async () => {
    if (!reportRef.current || !report) return;

    const displayName = profile?.display_name || "Usuário";

    toast.info("Gerando PDF...");

    try {
      const { default: html2canvas } = await import("html2canvas");
      const { jsPDF } = await import("jspdf");

      // Create a temporary styled container for rendering
      const container = document.createElement("div");
      container.style.cssText = `
        position: fixed; left: -9999px; top: 0;
        width: 800px; padding: 48px;
        background: #fff; color: #111;
        font-family: 'Outfit', sans-serif; line-height: 1.7;
      `;
      container.innerHTML = `
        <div style="border-bottom: 2px solid #e0e0e0; padding-bottom: 16px; margin-bottom: 32px;">
          <h1 style="font-size: 28px; font-weight: 700; margin: 0 0 8px; color: #111;">Relatório de ${displayName}</h1>
          <p style="font-size: 13px; color: #888;">Gerado em ${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</p>
        </div>
        <div style="color: #111;">${reportRef.current.innerHTML}</div>
      `;
      // Fix inner element colors for white-background PDF
      container.querySelectorAll("h1,h2,h3,h4,h5,h6").forEach((el) => {
        (el as HTMLElement).style.color = "#111";
      });
      container.querySelectorAll("p,li,span,strong,em").forEach((el) => {
        (el as HTMLElement).style.color = "#222";
      });

      document.body.appendChild(container);

      const canvas = await html2canvas(container, { scale: 2, useCORS: true, logging: false, backgroundColor: "#ffffff" });
      document.body.removeChild(container);

      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const pdf = new jsPDF("p", "mm", "a4");
      const imgData = canvas.toDataURL("image/png");

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`relatorio-${displayName.toLowerCase().replace(/\s+/g, "-")}.pdf`);
      toast.success("PDF baixado!");
    } catch {
      toast.error("Erro ao gerar PDF");
    }
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
