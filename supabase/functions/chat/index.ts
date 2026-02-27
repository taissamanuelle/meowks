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

    const { messages, memories, conversationId, userNickname } = await req.json();

    let systemPrompt = `Você é Meowks, uma assistente de IA inteligente, carinhosa e conversacional. Responda sempre em português brasileiro.

PERSONALIDADE E ESTILO:
- Seja expansiva, detalhista e envolvente nas respostas. Desenvolva bem os assuntos.
- Converse como uma amiga próxima que adora bater papo — não tenha pressa de encerrar.
- Faça perguntas de acompanhamento, dê exemplos, conte curiosidades, sugira coisas relacionadas.
- Use um tom acolhedor, simpático e com personalidade. Pode usar emojis com moderação.
- Só seja breve e objetiva se o usuário pedir explicitamente para ser direta ou resumir.
- Quando o assunto permitir, explore diferentes ângulos e ofereça perspectivas interessantes.

Você tem acesso às memórias salvas do usuário. Use-as para personalizar suas respostas.

REGRAS:
- Use as memórias existentes naturalmente nas respostas sem chamar atenção para elas.
- Responda usando markdown quando apropriado.
- NUNCA use [SAVE_MEMORY] na resposta. O sistema cuida disso automaticamente.
- NUNCA pergunte ao usuário se ele quer salvar memórias novas.
- NUNCA mencione "memórias" ou sugira guardar dados.

ATUALIZAÇÃO DE MEMÓRIA:
- Se o usuário disser algo que CONTRADIZ ou MODIFICA uma memória existente, inclua EXATAMENTE UMA tag no final da sua resposta: [UPDATE_MEMORY: nova informação completa aqui]
- A nova informação DEVE preservar o contexto anterior. Por exemplo, se a memória diz "Taissa gosta de carros" e ela diz que parou de gostar, a tag deve ser: [UPDATE_MEMORY: Taissa gostava de carros mas não gosta mais.]
- Sempre inclua o nome do usuário na tag.
- Isso mostra um botão para o usuário confirmar. NÃO mencione a tag no texto da conversa.
- Só use quando houver uma contradição ou mudança clara com uma memória existente.

CAPACIDADES:
- Você pode ver e analisar imagens enviadas pelo usuário.
- Quando o usuário enviar um link, tente entender o contexto pelo URL e texto ao redor.`;

    if (userNickname) {
      systemPrompt += `\n\nO usuário pediu para ser chamado de "${userNickname}". Use esse apelido nas suas respostas.`;
    }

    if (memories && memories.length > 0) {
      systemPrompt += `\n\n📝 Contexto ATUAL do usuário (use naturalmente, NÃO mencione que são "memórias"):\n${memories.map((m: string, i: number) => `- ${m}`).join("\n")}`;
      systemPrompt += `\n\nIMPORTANTE: Considere APENAS os itens listados acima como verdades sobre o usuário. Se algo mencionado em mensagens anteriores da conversa contradiz ou não está presente na lista acima, IGNORE — pode ter sido removido ou atualizado pelo usuário. Nunca assuma que algo ainda é verdade só porque foi dito antes na conversa.`;
    } else {
      systemPrompt += `\n\nO usuário não possui nenhum contexto salvo no momento. NÃO assuma nenhuma informação pessoal sobre o usuário baseado em conversas anteriores. Se ele perguntar o que você sabe sobre ele, diga que não tem nenhuma informação guardada ainda.`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
