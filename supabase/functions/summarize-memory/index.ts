import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Use direct Google Gemini API — NO Lovable AI Gateway
const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

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

    // Server-side email restriction
    const ALLOWED_EMAIL = Deno.env.get("ALLOWED_EMAIL") || "taissamanuellefj@gmail.com";
    const { data: { user: authUser }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !authUser || authUser.email !== ALLOWED_EMAIL) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY");
    if (!GOOGLE_API_KEY) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY not configured");

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

    // Direct Google Gemini API call (no gateway)
    const geminiPayload = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userContent }] }],
      generationConfig: {
        maxOutputTokens: (mode === "report" || mode === "traits") ? 4000 : 256,
      },
    };

    // Retry with backoff for rate limits
    let response: Response | null = null;
    const retryDelays = [10000, 20000];
    for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
      response = await fetch(`${GEMINI_URL}?key=${GOOGLE_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiPayload),
      });
      if (response.status !== 429) break;
      if (attempt < retryDelays.length) {
        await response.text();
        console.log(`summarize-memory rate limited, retrying in ${retryDelays[attempt]}ms`);
        await new Promise(r => setTimeout(r, retryDelays[attempt]));
      }
    }

    if (!response || !response.ok) {
      const t = await response?.text() || "No response";
      console.error("Gemini API error:", response?.status, t);
      
      // Fallback: return the user message as-is for title mode
      if (mode === "title") {
        const fallbackTitle = (userMessage || "Nova conversa").slice(0, 50);
        return new Response(JSON.stringify({ summary: fallbackTitle }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "AI error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const summary = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || userMessage;

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
