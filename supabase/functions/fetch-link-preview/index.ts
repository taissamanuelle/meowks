import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface LinkPreview {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  price: string | null;
}

function extractMeta(html: string, properties: string[]): string | null {
  for (const prop of properties) {
    // Try property="..." or name="..."
    const regex = new RegExp(
      `<meta[^>]*(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*?)["']|<meta[^>]*content=["']([^"']*?)["'][^>]*(?:property|name)=["']${prop}["']`,
      "i"
    );
    const match = html.match(regex);
    const value = match?.[1] || match?.[2];
    if (value) return value.trim();
  }
  return null;
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match?.[1]?.trim() || null;
}

function extractPrice(html: string): string | null {
  // Try product:price meta tags
  const price = extractMeta(html, ["product:price:amount", "og:price:amount"]);
  const currency = extractMeta(html, ["product:price:currency", "og:price:currency"]);
  if (price) return currency ? `${currency} ${price}` : price;

  // Try JSON-LD
  const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = jsonLdRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(m[1]);
      const offers = data.offers || data?.mainEntity?.offers;
      if (offers) {
        const offer = Array.isArray(offers) ? offers[0] : offers;
        if (offer.price) {
          return `${offer.priceCurrency || "R$"} ${offer.price}`;
        }
      }
    } catch { /* ignore */ }
  }

  return null;
}

async function fetchPreview(url: string): Promise<LinkPreview> {
  const result: LinkPreview = { url, title: null, description: null, image: null, siteName: null, price: null };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        "Accept": "text/html",
      },
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeout);

    if (!resp.ok) return result;

    // Read only the first 50KB to avoid large payloads
    const reader = resp.body?.getReader();
    if (!reader) return result;

    let html = "";
    const decoder = new TextDecoder();
    let totalBytes = 0;
    const MAX_BYTES = 50_000;

    while (totalBytes < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
      totalBytes += value.length;
    }
    reader.cancel();

    result.title = extractMeta(html, ["og:title", "twitter:title"]) || extractTitle(html);
    result.description = extractMeta(html, ["og:description", "twitter:description", "description"]);
    result.image = extractMeta(html, ["og:image", "twitter:image", "twitter:image:src"]);
    result.siteName = extractMeta(html, ["og:site_name"]);
    result.price = extractPrice(html);

    // Make relative image URLs absolute
    if (result.image && !result.image.startsWith("http")) {
      const urlObj = new URL(url);
      result.image = result.image.startsWith("//")
        ? `${urlObj.protocol}${result.image}`
        : `${urlObj.origin}${result.image.startsWith("/") ? "" : "/"}${result.image}`;
    }

    // Derive site name from hostname if missing
    if (!result.siteName) {
      try {
        result.siteName = new URL(url).hostname.replace(/^www\./, "");
      } catch { /* ignore */ }
    }
  } catch (err) {
    console.error("Error fetching preview for", url, err);
  }

  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { urls } = await req.json();
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return new Response(JSON.stringify({ error: "urls array is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Limit to 5 URLs max
    const limited = urls.slice(0, 5);
    const previews = await Promise.all(limited.map(fetchPreview));

    return new Response(JSON.stringify({ previews }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch previews" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
