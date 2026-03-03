import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
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
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { filePath, fileType, agentId } = await req.json();

    if (!filePath || !fileType || !agentId) {
      return new Response(JSON.stringify({ error: "Missing filePath, fileType, or agentId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let contentText = "";

    const isImage = ["png", "jpeg", "jpg"].includes(fileType.toLowerCase());

    if (isImage) {
      // For images, use the AI vision model to describe the image
      const { data: signedData } = await supabase.storage
        .from("agent-documents")
        .createSignedUrl(filePath, 3600);

      if (signedData?.signedUrl) {
        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
        if (LOVABLE_API_KEY) {
          try {
            const visionResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash-lite",
                messages: [
                  {
                    role: "user",
                    content: [
                      { type: "text", text: "Descreva detalhadamente todo o conteúdo desta imagem. Se houver texto, transcreva-o completamente. Se houver tabelas, transcreva-as. Se houver gráficos ou diagramas, descreva-os. Seja o mais completo possível." },
                      { type: "image_url", image_url: { url: signedData.signedUrl } },
                    ],
                  },
                ],
                max_tokens: 4096,
              }),
            });

            if (visionResp.ok) {
              const visionData = await visionResp.json();
              contentText = visionData.choices?.[0]?.message?.content || "[Imagem sem descrição]";
            }
          } catch (e) {
            console.error("Vision API error:", e);
            contentText = "[Erro ao processar imagem]";
          }
        }
      }
    } else if (fileType.toLowerCase() === "csv") {
      // Download and read CSV as text
      const { data: fileData, error: downloadError } = await supabase.storage
        .from("agent-documents")
        .download(filePath);

      if (downloadError || !fileData) {
        contentText = "[Erro ao ler arquivo CSV]";
      } else {
        const text = await fileData.text();
        // Truncate if very large
        contentText = text.length > 50000 ? text.substring(0, 50000) + "\n\n[...conteúdo truncado]" : text;
      }
    } else if (fileType.toLowerCase() === "pdf" || fileType.toLowerCase() === "docx") {
      // For PDF and DOCX, use AI to extract text from the file
      const { data: signedData } = await supabase.storage
        .from("agent-documents")
        .createSignedUrl(filePath, 3600);

      if (signedData?.signedUrl) {
        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
        if (LOVABLE_API_KEY) {
          try {
            // Download the file and convert to base64
            const fileResp = await fetch(signedData.signedUrl);
            const fileBlob = await fileResp.blob();
            const arrayBuf = await fileBlob.arrayBuffer();
            const uint8 = new Uint8Array(arrayBuf);
            let binary = "";
            for (let i = 0; i < uint8.length; i++) {
              binary += String.fromCharCode(uint8[i]);
            }
            const base64 = btoa(binary);

            const mimeType = fileType.toLowerCase() === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

            const visionResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                messages: [
                  {
                    role: "user",
                    content: [
                      { type: "text", text: "Extraia e transcreva TODO o conteúdo textual deste documento. Preserve a estrutura (títulos, parágrafos, listas, tabelas). Seja completo — extraia tudo." },
                      {
                        type: "image_url",
                        image_url: {
                          url: `data:${mimeType};base64,${base64}`,
                        },
                      },
                    ],
                  },
                ],
                max_tokens: 8192,
              }),
            });

            if (visionResp.ok) {
              const visionData = await visionResp.json();
              contentText = visionData.choices?.[0]?.message?.content || "[Documento sem conteúdo extraído]";
            } else {
              console.error("Document parsing error:", visionResp.status, await visionResp.text());
              contentText = "[Erro ao processar documento]";
            }
          } catch (e) {
            console.error("Document parse error:", e);
            contentText = "[Erro ao processar documento]";
          }
        }
      }
    } else {
      contentText = "[Formato não suportado]";
    }

    // Update the agent_documents record with extracted text
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    await serviceClient
      .from("agent_documents")
      .update({ content_text: contentText })
      .eq("file_path", filePath)
      .eq("agent_id", agentId);

    return new Response(JSON.stringify({ success: true, contentText: contentText.substring(0, 200) + "..." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-document error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
