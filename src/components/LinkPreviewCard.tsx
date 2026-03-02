import { useState, useEffect } from "react";
import { ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface LinkPreview {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  price: string | null;
}

// Cache previews globally to avoid re-fetching
const previewCache = new Map<string, LinkPreview | null>();

export function useLinkPreviews(urls: string[]) {
  const [previews, setPreviews] = useState<LinkPreview[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (urls.length === 0) return;

    const uncached = urls.filter((u) => !previewCache.has(u));
    const cached = urls
      .filter((u) => previewCache.has(u))
      .map((u) => previewCache.get(u)!)
      .filter(Boolean);

    if (uncached.length === 0) {
      setPreviews(cached.filter((p) => p.image && p.title));
      return;
    }

    setLoading(true);
    supabase.functions
      .invoke("fetch-link-preview", { body: { urls: uncached } })
      .then(({ data }) => {
        const fetched: LinkPreview[] = data?.previews || [];
        fetched.forEach((p) => previewCache.set(p.url, p));
        uncached
          .filter((u) => !fetched.find((p) => p.url === u))
          .forEach((u) => previewCache.set(u, null));

        const all = urls
          .map((u) => previewCache.get(u))
          .filter((p): p is LinkPreview => !!p && !!p.image && !!p.title);
        setPreviews(all);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [urls.join(",")]);

  return { previews, loading };
}

export function LinkPreviewCards({ urls }: { urls: string[] }) {
  const { previews } = useLinkPreviews(urls);

  if (previews.length === 0) return null;

  return (
    <div className="mt-3 flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
      {previews.map((p) => (
        <a
          key={p.url}
          href={p.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex-shrink-0 w-[200px] rounded-xl border border-border bg-card/80 overflow-hidden hover:border-accent/50 transition-all hover:shadow-lg hover:shadow-accent/5"
        >
          {p.image && (
            <div className="relative w-full aspect-[4/3] bg-muted overflow-hidden">
              <img
                src={p.image}
                alt={p.title || ""}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          )}
          <div className="p-3 space-y-1">
            <p className="text-sm font-medium text-foreground line-clamp-2 leading-tight">
              {p.title}
            </p>
            {p.price && (
              <p className="text-sm font-semibold text-accent">{p.price}</p>
            )}
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <ExternalLink className="h-3 w-3" />
              <span className="truncate">{p.siteName || new URL(p.url).hostname}</span>
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}
