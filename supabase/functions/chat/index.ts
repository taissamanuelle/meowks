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

    const { messages, memories, conversationId, userNickname } = await req.json();

    let systemPrompt = `Você é Meowks, uma assistente de IA inteligente e carinhosa. Responda sempre em português brasileiro de forma natural e amigável.

Você tem acesso às memórias salvas do usuário. Use-as para personalizar suas respostas.

REGRAS ABSOLUTAS:
- Use as memórias existentes naturalmente nas respostas sem chamar atenção para elas.
- Responda usando markdown quando apropriado.
- Seja natural e conversacional.
- NUNCA use [SAVE_MEMORY] na resposta. O sistema cuida disso automaticamente.
- NUNCA pergunte ao usuário se ele quer salvar memórias novas. O sistema cuida disso.
- NUNCA mencione "memórias" ou sugira guardar dados.

ATUALIZAÇÃO DE MEMÓRIA:
- Se o usuário disser algo que CONTRADIZ uma memória existente (por exemplo, antes gostava de X e agora diz que não gosta mais), inclua EXATAMENTE UMA tag no final da sua resposta: [UPDATE_MEMORY: nova informação resumida aqui]
- Isso vai mostrar um botão para o usuário confirmar a atualização. NÃO mencione a tag na conversa.
- Só use quando houver uma contradição clara com uma memória existente.

CAPACIDADES:
- Você pode ver e analisar imagens enviadas pelo usuário.
- Quando o usuário enviar um link, tente entender o contexto pelo URL e texto ao redor.`;

    if (userNickname) {
      systemPrompt += `\n\nO usuário pediu para ser chamado de "${userNickname}". Use esse apelido nas suas respostas.`;
    }

    if (memories && memories.length > 0) {
      systemPrompt += `\n\n📝 Contexto do usuário (use naturalmente, NÃO mencione que são "memórias"):\n${memories.map((m: string, i: number) => `- ${m}`).join("\n")}`;
    }

    // Use gemini-2.5-flash which supports multimodal (images)
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
