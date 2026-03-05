export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, authorization, x-client-info, apikey',
  };

  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) throw new Error("Chave ausente");

    const body = await req.json();
    const { messages, memories, userNickname } = body;

    // LIMPEZA DO HISTÓRICO: O Groq exige texto puro e papéis alternados
    const cleanMessages = messages.map((m: any) => {
      let content = m.content;
      // Se o conteúdo for um JSON (com imagens), extrai apenas o texto
      try {
        const parsed = JSON.parse(m.content);
        if (parsed.text) content = parsed.text;
      } catch (e) { /* já é texto puro */ }

      return {
        role: m.role === "model" ? "assistant" : m.role,
        content: String(content)
      };
    }).filter((m: any) => m.content.trim() !== "");

    let systemPrompt = `Você é Meowks. Responda em PT-BR. Hoje: ${new Date().toLocaleDateString("pt-BR")}.\n`;
    systemPrompt += `REGRA: Seja firme, direta e SEM bajulação. O usuário odeia elogios.\n`;
    if (userNickname) systemPrompt += `\nUsuário: ${userNickname}.`;
    if (memories?.length) systemPrompt += `\n\nMEMÓRIAS:\n${memories.join("\n")}`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "system", content: systemPrompt }, ...cleanMessages],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(JSON.stringify({ error: errorText }), { status: response.status, headers: corsHeaders });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
}
