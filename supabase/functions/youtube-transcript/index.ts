import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function extractVideoId(input: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = input.match(p);
    if (m) return m[1];
  }
  return null;
}

function decodeEntities(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\n/g, " ").trim();
}

interface Segment { text: string; start: number; duration: number; }

function parseCaptionXml(xml: string): Segment[] {
  const segments: Segment[] = [];
  let match;

  // Format 1: <text start="sec" dur="sec">
  const r1 = /<text start="([^"]*)" dur="([^"]*)"[^>]*>([\s\S]*?)<\/text>/g;
  while ((match = r1.exec(xml)) !== null) {
    const t = decodeEntities(match[3]);
    if (t) segments.push({ text: t, start: parseFloat(match[1]), duration: parseFloat(match[2]) });
  }
  if (segments.length > 0) return segments;

  // Format 2: <p t="ms" d="ms">
  const r2 = /<p t="([^"]*)" d="([^"]*)"[^>]*>([\s\S]*?)<\/p>/g;
  while ((match = r2.exec(xml)) !== null) {
    const t = decodeEntities(match[3]);
    if (t) segments.push({ text: t, start: parseFloat(match[1]) / 1000, duration: parseFloat(match[2]) / 1000 });
  }
  return segments;
}

async function fetchTranscript(videoId: string): Promise<{ title: string; segments: Segment[]; language: string } | null> {
  // Strategy 1: Innertube player API
  for (const clientName of ["WEB", "WEB_EMBEDDED_PLAYER"]) {
    try {
      const resp = await fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        body: JSON.stringify({ context: { client: { clientName, clientVersion: "2.20240101.00.00", hl: "pt", gl: "BR" } }, videoId }),
      });
      if (!resp.ok) { await resp.text(); continue; }
      const data = await resp.json();
      const captions = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (!captions?.length) continue;

      let track = captions.find((c: any) => c.languageCode?.startsWith("pt")) || captions.find((c: any) => c.languageCode?.startsWith("en")) || captions[0];
      const capResp = await fetch(track.baseUrl);
      if (!capResp.ok) { await capResp.text(); continue; }
      const xml = await capResp.text();
      const segs = parseCaptionXml(xml);
      if (segs.length > 0) return { title: data?.videoDetails?.title || "Vídeo", segments: segs, language: track.languageCode };
    } catch (e) { console.error(`${clientName} error:`, e); }
  }

  // Strategy 2: Page scrape
  try {
    const resp = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8", "Cookie": "CONSENT=YES+cb" },
    });
    if (!resp.ok) return null;
    const html = await resp.text();
    const titleMatch = html.match(/<title>(.+?)<\/title>/);
    const title = titleMatch ? titleMatch[1].replace(" - YouTube", "").trim() : "Vídeo";
    const playerMatch = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;/s);
    if (!playerMatch) return null;
    const data = JSON.parse(playerMatch[1]);
    const captions = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!captions?.length) return null;
    let track = captions.find((c: any) => c.languageCode?.startsWith("pt")) || captions.find((c: any) => c.languageCode?.startsWith("en")) || captions[0];
    const capResp = await fetch(track.baseUrl);
    if (!capResp.ok) return null;
    const segs = parseCaptionXml(await capResp.text());
    if (segs.length > 0) return { title, segments: segs, language: track.languageCode };
  } catch (e) { console.error("Page scrape error:", e); }

  return null;
}

function fmtTs(s: number): string {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { url } = await req.json();
    if (!url) return new Response(JSON.stringify({ error: "URL is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const videoId = extractVideoId(url);
    if (!videoId) return new Response(JSON.stringify({ error: "Invalid YouTube URL" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    console.log("Fetching transcript for:", videoId);
    const result = await fetchTranscript(videoId);

    if (!result) {
      return new Response(JSON.stringify({ error: "Não foi possível obter a transcrição. O vídeo pode não ter legendas disponíveis." }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const fullText = result.segments.map(s => `[${fmtTs(s.start)}] ${s.text}`).join("\n");
    const plainText = result.segments.map(s => s.text).join(" ");
    const dur = result.segments.length > 0 ? Math.ceil(result.segments[result.segments.length - 1].start + result.segments[result.segments.length - 1].duration) : 0;

    return new Response(JSON.stringify({ videoId, title: result.title, language: result.language, segmentCount: result.segments.length, fullText, plainText, durationSeconds: dur }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch transcript" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
