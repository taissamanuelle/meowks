import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Build system prompt with memories
    let systemPrompt = `Você é Meowks, uma assistente de IA inteligente e carinhosa. Responda sempre em português brasileiro de forma natural e amigável.

Você tem uma funcionalidade especial: você pode lembrar coisas sobre o usuário. As memórias salvas do usuário estão abaixo.

REGRAS IMPORTANTES:
1. Quando o usuário compartilhar informações pessoais (nome, preferências, amigos, hobbies, trabalho, etc.), SEMPRE pergunte se ele deseja salvar essa informação na memória. Use o formato exato: [SAVE_MEMORY: conteúdo da memória aqui]
2. Se você perceber que uma informação nova contradiz uma memória existente, pergunte ao usuário se deseja atualizar. Use o formato: [UPDATE_MEMORY: id_da_memória | novo conteúdo]
3. Use as memórias para personalizar suas respostas e mostrar que você se lembra do usuário.
4. Seja proativa em usar o conhecimento das memórias nas conversas.
5. Responda usando markdown quando apropriado.`;

    if (memories && memories.length > 0) {
      systemPrompt += `\n\n📝 MEMÓRIAS DO USUÁRIO:\n${memories.map((m: string, i: number) => `${i + 1}. ${m}`).join("\n")}`;
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
