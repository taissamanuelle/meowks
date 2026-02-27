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

    const { messages, memories, conversationId } = await req.json();

    let systemPrompt = `Você é Meowks, uma assistente de IA inteligente e carinhosa. Responda sempre em português brasileiro de forma natural e amigável.

Você tem acesso às memórias salvas do usuário. Use-as para personalizar suas respostas.

REGRAS DE MEMÓRIA:
1. Quando o usuário compartilhar informações pessoais importantes, pergunte se ele deseja salvar na memória. Use o formato EXATO em uma linha separada: [SAVE_MEMORY: resumo na terceira pessoa do que o usuário disse]
2. Se uma informação nova CONTRADIZ uma memória existente, identifique qual memória (pelo número) e sugira a atualização. Use o formato EXATO: [UPDATE_MEMORY: número | novo conteúdo atualizado]
3. NUNCA inclua os tags [SAVE_MEMORY] ou [UPDATE_MEMORY] no meio de frases. Coloque-os SEMPRE em linhas separadas, APÓS o texto da sua resposta.
4. Use as memórias ativamente para mostrar que você se lembra do usuário.
5. Responda usando markdown quando apropriado.
6. Não salve coisas triviais. Salve apenas informações pessoais relevantes (amigos, preferências, trabalho, hobbies, sentimentos importantes, etc).`;

    if (memories && memories.length > 0) {
      systemPrompt += `\n\n📝 MEMÓRIAS DO USUÁRIO (use o número para referência em UPDATE_MEMORY):\n${memories.map((m: string, i: number) => `${i + 1}. ${m}`).join("\n")}`;
    } else {
      systemPrompt += "\n\n📝 O usuário ainda não tem memórias salvas.";
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
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
