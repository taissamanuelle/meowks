import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Server-side email restriction
    const ALLOWED_EMAIL = Deno.env.get("ALLOWED_EMAIL") || "taissamanuellefj@gmail.com";
    const { data: { user: authUser }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !authUser || authUser.email !== ALLOWED_EMAIL) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
    } else if (mode === "traits") {
      systemPrompt = `Você é um psicólogo especialista em análise de personalidade. Analise as memórias de ${userName || 'uma pessoa'} e identifique qualidades (pontos fortes) e defeitos/pontos a melhorar.

REGRAS:
- Retorne APENAS um JSON válido, sem markdown, sem explicação.
- Formato: {"qualities": [...], "flaws": [...]}
- Cada item: {"label": "Nome curto da característica", "detail": "Explicação breve baseada nas memórias"}
- Para defeitos que a pessoa JÁ SUPEROU ou MELHOROU (baseado em memórias que mostrem progresso), adicione "improved": true
- Seja justo, empático e preciso. Baseie-se APENAS no que as memórias revelam.
- Use linguagem acessível e carinhosa. Máximo 8 qualidades e 6 defeitos.
- Se não houver evidência suficiente, retorne listas vazias.
- NÃO invente coisas que não estão nas memórias.

Exemplo de resposta:
{"qualities":[{"label":"Determinação","detail":"Demonstra persistência ao enfrentar desafios"}],"flaws":[{"label":"Autocrítica excessiva","detail":"Tende a ser muito dura consigo mesma","improved":false}]}`;
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
        model: (mode === "report" || mode === "traits") ? "google/gemini-3-flash-preview" : "google/gemini-2.5-flash-lite",
        max_tokens: (mode === "report" || mode === "traits") ? 4000 : undefined,
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
