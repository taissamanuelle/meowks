import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ChatSidebar } from "@/components/ChatSidebar";
import { ChatMessage } from "@/components/ChatMessage";
import { ChatInput } from "@/components/ChatInput";
import { ProfileMenu } from "@/components/ProfileMenu";
import { NeuralGraph } from "@/components/NeuralGraph";
import { ConversationRename } from "@/components/ConversationRename";
import { streamChat, type Msg } from "@/lib/chatStream";
import { toast } from "sonner";
import { PanelLeftClose, PanelLeft, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navigate } from "react-router-dom";

type Tab = "chat" | "neural";

function AtomIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="12" cy="12" r="2" />
      <ellipse cx="12" cy="12" rx="9" ry="4" />
      <ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(120 12 12)" />
    </svg>
  );
}

const MIN_SIDEBAR = 200;
const MAX_SIDEBAR = 400;
const DEFAULT_SIDEBAR = 260;

const Index = () => {
  const { user, profile, session, loading } = useAuth();
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [memories, setMemories] = useState<{ id: string; content: string }[]>([]);
  const [tab, setTab] = useState<Tab>("chat");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR);
  const isResizing = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    const startX = e.clientX;
    const startWidth = sidebarWidth;
    const onMouseMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      setSidebarWidth(Math.min(MAX_SIDEBAR, Math.max(MIN_SIDEBAR, startWidth + (ev.clientX - startX))));
    };
    const onMouseUp = () => {
      isResizing.current = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [sidebarWidth]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("conversations").select("*").eq("user_id", user.id).order("updated_at", { ascending: false });
      if (data) setConversations(data);
    })();
  }, [user]);

  useEffect(() => {
    if (!activeConvId || !user) { setMessages([]); return; }
    (async () => {
      const { data } = await supabase.from("messages").select("*").eq("conversation_id", activeConvId).order("created_at", { ascending: true });
      if (data) setMessages(data.map((m) => {
        const msg: Msg = { role: m.role as "user" | "assistant", content: m.content };
        // Parse stored image URLs from content metadata
        try {
          const parsed = JSON.parse(m.content);
          if (parsed._images) {
            msg.content = parsed.text || "";
            msg.images = parsed._images;
          }
        } catch { /* plain text */ }
        return msg;
      }));
    })();
  }, [activeConvId, user]);

  const refreshMemories = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("memories").select("id, content").eq("user_id", user.id);
    if (data) setMemories(data);
  }, [user]);

  useEffect(() => { refreshMemories(); }, [refreshMemories]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }
  if (!session) return <Navigate to="/login" replace />;

  const createConversation = async () => {
    if (!user) return null;
    const { data } = await supabase.from("conversations").insert({ user_id: user.id }).select().single();
    if (data) { setConversations((p) => [data, ...p]); setActiveConvId(data.id); setMessages([]); return data.id; }
    return null;
  };

  const generateTitle = async (convId: string, userText: string, aiResponse: string) => {
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/summarize-memory`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ userMessage: userText, userName: "", mode: "title", aiResponse }),
      });
      if (resp.ok) {
        const { summary } = await resp.json();
        const title = summary.slice(0, 60);
        await supabase.from("conversations").update({ title }).eq("id", convId);
        setConversations((p) => p.map((c) => (c.id === convId ? { ...c, title } : c)));
      }
    } catch { /* fallback */ }
  };

  // Upload images to storage and return public URLs
  const uploadImages = async (blobUrls: string[]): Promise<string[]> => {
    if (!user) return [];
    const urls: string[] = [];
    for (const blobUrl of blobUrls) {
      try {
        const resp = await fetch(blobUrl);
        const blob = await resp.blob();
        const ext = blob.type.split("/")[1] || "png";
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from("chat-images").upload(path, blob, { contentType: blob.type });
        if (!error) {
          const { data: urlData } = supabase.storage.from("chat-images").getPublicUrl(path);
          urls.push(urlData.publicUrl);
        }
      } catch { /* skip failed */ }
    }
    return urls;
  };

  const handleSend = async (text: string, imagePreviews?: string[]) => {
    if (!user) return;
    let convId = activeConvId;
    const isFirst = !convId || messages.length === 0;
    if (!convId) { convId = await createConversation(); if (!convId) return; }

    // Upload images if any
    let imageUrls: string[] | undefined;
    if (imagePreviews && imagePreviews.length > 0) {
      imageUrls = await uploadImages(imagePreviews);
    }

    const userMsg: Msg = { role: "user", content: text, images: imageUrls };
    setMessages((p) => [...p, userMsg]);
    setIsStreaming(true);

    // Store message - encode images in content if present
    const storedContent = imageUrls && imageUrls.length > 0
      ? JSON.stringify({ text, _images: imageUrls })
      : text;
    await supabase.from("messages").insert({ conversation_id: convId, user_id: user.id, role: "user", content: storedContent });

    if (isFirst) {
      const t = (text || "Imagem").slice(0, 50) + (text.length > 50 ? "..." : "");
      await supabase.from("conversations").update({ title: t }).eq("id", convId);
      setConversations((p) => p.map((c) => (c.id === convId ? { ...c, title: t } : c)));
    }

    let assistantContent = "";
    const upsert = (chunk: string) => {
      assistantContent += chunk;
      setMessages((p) => {
        const last = p[p.length - 1];
        if (last?.role === "assistant") return p.map((m, i) => (i === p.length - 1 ? { ...m, content: assistantContent } : m));
        return [...p, { role: "assistant", content: assistantContent }];
      });
    };

    const cid = convId;
    try {
      await streamChat({
        messages: [...messages, userMsg],
        memories: memories.map((m) => m.content),
        conversationId: convId,
        onDelta: upsert,
        onDone: async () => {
          setIsStreaming(false);
          await supabase.from("messages").insert({ conversation_id: cid, user_id: user!.id, role: "assistant", content: assistantContent });
          await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", cid);
          if (isFirst) generateTitle(cid, text || "Imagem enviada", assistantContent);
        },
      });
    } catch (e: any) {
      setIsStreaming(false);
      toast.error(e.message || "Erro ao comunicar com a IA");
    }
  };

  const handleDeleteConversation = async (id: string) => {
    await supabase.from("messages").delete().eq("conversation_id", id);
    await supabase.from("conversations").delete().eq("id", id);
    setConversations((p) => p.filter((c) => c.id !== id));
    if (activeConvId === id) { setActiveConvId(null); setMessages([]); }
  };

  const handleRenameConversation = async (newTitle: string) => {
    if (!activeConvId) return;
    await supabase.from("conversations").update({ title: newTitle }).eq("id", activeConvId);
    setConversations((p) => p.map((c) => (c.id === activeConvId ? { ...c, title: newTitle } : c)));
  };

  const handleRenameConversationById = async (id: string, newTitle: string) => {
    await supabase.from("conversations").update({ title: newTitle }).eq("id", id);
    setConversations((p) => p.map((c) => (c.id === id ? { ...c, title: newTitle } : c)));
  };

  const handleSaveMemory = async (userText: string) => {
    if (!user) return;
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/summarize-memory`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ userMessage: userText, userName: profile?.display_name || "O usuário" }),
      });
      if (!resp.ok) throw new Error("Erro");
      const { summary } = await resp.json();
      await supabase.from("memories").insert({ user_id: user.id, content: summary, source: "ai" });
      toast.success("Memória salva: " + summary);
      await refreshMemories();
    } catch { toast.error("Erro ao salvar memória"); }
  };

  const activeConv = conversations.find((c) => c.id === activeConvId);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {sidebarOpen && (
        <div className="hidden md:flex" style={{ width: sidebarWidth }}>
          <div className="flex-1 min-w-0 flex flex-col">
            <ChatSidebar
              conversations={conversations}
              activeId={activeConvId}
              onSelect={setActiveConvId}
              onNew={() => { setActiveConvId(null); setMessages([]); }}
              onDelete={handleDeleteConversation}
              onRename={handleRenameConversationById}
            />
            <div className="border-t border-sidebar-border bg-sidebar px-3 py-3">
              <ProfileMenu onMemoriesChanged={refreshMemories} layout="sidebar" />
            </div>
          </div>
          <div className="w-1 cursor-col-resize hover:bg-accent/30 active:bg-accent/50 transition-colors flex-shrink-0" onMouseDown={handleResizeStart} />
        </div>
      )}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setSidebarOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative z-50 h-full w-72 flex flex-col" onClick={(e) => e.stopPropagation()}>
            <ChatSidebar
              conversations={conversations}
              activeId={activeConvId}
              onSelect={(id) => { setActiveConvId(id); setSidebarOpen(false); }}
              onNew={() => { setActiveConvId(null); setMessages([]); setSidebarOpen(false); }}
              onDelete={handleDeleteConversation}
              onRename={handleRenameConversationById}
            />
            <div className="border-t border-sidebar-border bg-sidebar px-3 py-3">
              <ProfileMenu onMemoriesChanged={refreshMemories} layout="sidebar" />
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col min-w-0">
        <header className="flex h-12 items-center justify-between px-4 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setSidebarOpen(!sidebarOpen)}>
              {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
            </Button>
            {activeConv && (
              <ConversationRename key={activeConv.id} title={activeConv.title} onRename={handleRenameConversation} />
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex gap-0.5 rounded-lg bg-secondary/60 p-0.5">
              <button
                onClick={() => setTab("chat")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  tab === "chat" ? "bg-accent text-accent-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <MessageSquare className="h-3 w-3" />
                Chat
              </button>
              <button
                onClick={() => setTab("neural")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  tab === "neural" ? "bg-accent text-accent-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <AtomIcon className="h-3 w-3" />
                Neural
              </button>
            </div>
          </div>
        </header>

        {tab === "chat" ? (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto">
              {messages.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center space-y-3">
                    <h1 className="text-3xl font-semibold text-foreground">
                      Olá{profile?.display_name ? `, ${profile.display_name.split(" ")[0]}` : ""}! 👋
                    </h1>
                    <p className="text-muted-foreground text-base">Como posso te ajudar hoje?</p>
                  </div>
                </div>
              ) : (
                <div className="mx-auto max-w-3xl px-6 py-4">
                  <div className="flex items-center justify-center py-4">
                    <span className="text-xs text-muted-foreground/60 font-medium">Hoje</span>
                  </div>
                  {messages.map((m, i) => (
                    <ChatMessage
                      key={i}
                      role={m.role}
                      content={m.content}
                      images={m.images}
                      avatar={m.role === "user" ? profile?.avatar_url : null}
                      isStreaming={m.role === "assistant" && isStreaming && i === messages.length - 1}
                      onSaveMemory={m.role === "user" ? handleSaveMemory : undefined}
                    />
                  ))}
                  <div ref={bottomRef} />
                </div>
              )}
            </div>
            <ChatInput onSend={handleSend} disabled={isStreaming} />
          </div>
        ) : (
          <div className="flex-1 overflow-hidden">
            <NeuralGraph />
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
