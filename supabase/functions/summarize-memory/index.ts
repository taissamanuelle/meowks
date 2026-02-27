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

    const { userMessage, userName } = await req.json();

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `Você é um assistente que extrai informações pessoais de mensagens para salvar como memória.
Dado o texto do usuário, resuma em uma frase curta na terceira pessoa o que o usuário revelou sobre si mesmo.
Foque em fatos, sentimentos, preferências, pessoas mencionadas, hobbies, trabalho, etc.
NÃO inclua a resposta da IA, apenas o que o USUÁRIO disse.
Responda APENAS com o texto da memória, sem aspas, sem explicação extra.
Use o nome "${userName || 'O usuário'}" no início quando possível.

Exemplos:
- Entrada: "eu tô bastante feliz porque fiz x, y e z. é muito legal ver meu progresso"
  Saída: ${userName || 'O usuário'} está feliz por ter feito X, Y e Z e está satisfeito(a) com o progresso.

- Entrada: "meus melhores amigos são João e Maria, a gente se conhece desde a escola"
  Saída: ${userName || 'O usuário'} tem como melhores amigos João e Maria, amigos desde a escola.`
          },
          { role: "user", content: userMessage },
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
