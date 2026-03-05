export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, authorization, x-client-info, apikey',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY não configurada");

    const body = await req.json();
    const { messages, memories, userNickname } = body;

    // Prompt firme e direto para a Meowks
    let systemPrompt = `Você é Meowks. Responda em PT-BR. HOJE: ${new Date().toLocaleDateString("pt-BR")}.\n`;
    systemPrompt += `⚠️ REGRA: Seja firme, direta e SEM bajulação. O usuário odeia elogios.\n`;
    
    if (userNickname) systemPrompt += `\nUsuário: ${userNickname}.`;
    if (memories?.length) systemPrompt += `\n\n📝 MEMÓRIAS:\n${memories.map((m: any) => `- ${m}`).join("\n")}`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return new Response(JSON.stringify({ error: err }), { status: response.status, headers: corsHeaders });
    }

    // Retorna o stream bruto (O Edge Runtime lida com isso nativamente e rápido)
    return new Response(response.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}
