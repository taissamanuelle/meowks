import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { userMessage, userName, mode, aiResponse } = await req.json();

    let systemPrompt: string;

    if (mode === "title") {
      systemPrompt = `Você gera títulos curtos e descritivos para conversas de chat.
Dado a primeira mensagem do usuário e a resposta da IA, crie um título curto (máximo 50 caracteres) que descreva o assunto da conversa.
Seja criativo e conciso. Pode usar emoji no início se fizer sentido.
Responda APENAS com o título, sem aspas, sem explicação.

Exemplos:
- Usuário: "como fazer bolo de chocolate?" → 🍫 Receita de bolo de chocolate
- Usuário: "me ajuda com meu código python" → 🐍 Ajuda com código Python
- Usuário: "tô triste hoje" → 💙 Conversa sobre sentimentos`;
    } else if (mode === "report") {
      systemPrompt = `Você é um especialista em criar relatórios pessoais detalhados e bem organizados.
Dado um conjunto de memórias sobre uma pessoa, crie um relatório completo e humanizado usando markdown.
Use ## para títulos de seção. Seja descritivo, elabore cada ponto, e organize de forma lógica.
Inclua seções relevantes como: Visão Geral, Personalidade e Interesses, Vida Pessoal, Relacionamentos, Trabalho/Estudos, Preferências, Saúde, e outras que fizerem sentido.
Se não houver informação para uma seção, não a inclua.
Escreva em terceira pessoa usando o nome "${userName || 'O usuário'}".
Responda APENAS com o relatório em markdown, sem explicações extras.`;
    } else {
      systemPrompt = `Você é um assistente que extrai informações pessoais de mensagens para salvar como memória.
Dado o texto do usuário, resuma em uma frase curta NA PRIMEIRA PESSOA (usando "Eu") o que o usuário revelou sobre si mesmo.
Foque em fatos, sentimentos, preferências, pessoas mencionadas, hobbies, trabalho, etc.
NÃO inclua a resposta da IA, apenas o que o USUÁRIO disse.
Responda APENAS com o texto da memória, sem aspas, sem explicação extra.
SEMPRE escreva na primeira pessoa como se fosse o próprio usuário falando.

Exemplos:
- Entrada: "eu tô bastante feliz porque fiz x, y e z. é muito legal ver meu progresso"
  Saída: Eu estou feliz por ter feito X, Y e Z e estou satisfeito(a) com o progresso.

- Entrada: "meus melhores amigos são João e Maria, a gente se conhece desde a escola"
  Saída: Eu tenho como melhores amigos João e Maria, nos conhecemos desde a escola.

- Entrada: "eu gosto muito de carros e tenho um fusca"
  Saída: Eu gosto muito de carros e tenho um fusca.`;
    }

    const userContent = mode === "title"
      ? `Usuário: ${userMessage}\nIA: ${(aiResponse || "").slice(0, 200)}`
      : userMessage;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: mode === "report" ? "google/gemini-2.5-flash" : "google/gemini-2.5-flash-lite",
        max_tokens: mode === "report" ? 4000 : undefined,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content?.trim() || userMessage;

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("summarize error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
