import { useCallback, useEffect, useRef, useState } from "react";
import { FluentEmoji } from "@/components/FluentEmoji";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ChatSidebar } from "@/components/ChatSidebar";
import { PinSetup } from "@/pages/PinSetup";
import { ChatMessage } from "@/components/ChatMessage";
import { ChatInput } from "@/components/ChatInput";
import { ProfileMenu } from "@/components/ProfileMenu";
import { NeuralGraph } from "@/components/NeuralGraph";
import { ConversationRename } from "@/components/ConversationRename";
import { streamChat, type Msg } from "@/lib/chatStream";
import { toast } from "sonner";
import { PanelLeftClose, PanelLeft, MessageSquare, Brain, Settings, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navigate } from "react-router-dom";
import { MemoryDialog } from "@/components/MemoryDialog";
import { SettingsDialog } from "@/components/SettingsDialog";

type Tab = "chat" | "neural" | "profile";

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

const MIN_SIDEBAR = 280;
const MAX_SIDEBAR = 400;
const DEFAULT_SIDEBAR = 300;

const Index = () => {
  const { user, profile, session, loading, signOut, isAllowedEmail, pinStatus, setPinVerified, refreshProfile } = useAuth();
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [memories, setMemories] = useState<{ id: string; content: string }[]>([]);
  const [tab, setTab] = useState<Tab>("chat");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR);
  const [nickname, setNickname] = useState<string>("");
  const [mobileMemoryOpen, setMobileMemoryOpen] = useState(false);
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);
  const isResizing = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const assistantStartRef = useRef<HTMLDivElement>(null);
  const lastAssistantIdxRef = useRef<number>(-1);

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

  // Fetch nickname
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("nickname").eq("user_id", user.id).single().then(({ data }) => {
      setNickname((data as any)?.nickname || "");
    });
  }, [user]);

  const refreshMemories = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("memories").select("id, content").eq("user_id", user.id);
    if (data) setMemories(data);
  }, [user]);

  useEffect(() => { refreshMemories(); }, [refreshMemories]);
  // When a new assistant message starts, scroll to its top; otherwise don't auto-scroll during streaming
  useEffect(() => {
    const lastIdx = messages.length - 1;
    const lastMsg = messages[lastIdx];
    if (!lastMsg) return;

    if (lastMsg.role === "user") {
      // User just sent a message, scroll to bottom so they see the upcoming response
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      lastAssistantIdxRef.current = -1;
    } else if (lastMsg.role === "assistant" && lastAssistantIdxRef.current !== lastIdx) {
      // New assistant message just appeared — scroll to its start
      lastAssistantIdxRef.current = lastIdx;
      setTimeout(() => {
        assistantStartRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    }
  }, [messages.length, messages[messages.length - 1]?.role]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }
  if (!session) return <Navigate to="/login" replace />;

  // Email restriction
  if (!isAllowedEmail) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <h1 className="text-2xl font-semibold text-foreground">Acesso restrito</h1>
        <p className="text-muted-foreground">Esta aplicação é de uso exclusivo. Seu email não tem permissão de acesso.</p>
        <button onClick={signOut} className="mt-4 rounded-lg bg-accent px-6 py-2 text-accent-foreground text-sm font-medium hover:bg-accent/80 transition-colors">
          Sair
        </button>
      </div>
    );
  }

  // PIN gate
  if (pinStatus === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }
  if (pinStatus === "needs_create") {
    return <PinSetup mode="create" onSuccess={() => { setPinVerified(); refreshProfile(); }} />;
  }
  if (pinStatus === "needs_verify") {
    return <PinSetup mode="verify" onSuccess={setPinVerified} />;
  }

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
        userNickname: nickname || undefined,
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
        body: JSON.stringify({ userMessage: userText, userName: nickname || profile?.display_name || "O usuário" }),
      });
      if (!resp.ok) throw new Error("Erro");
      const { summary } = await resp.json();
      await supabase.from("memories").insert({ user_id: user.id, content: summary, source: "ai" });
      toast.success("Memória salva: " + summary);
      await refreshMemories();
    } catch { toast.error("Erro ao salvar memória"); }
  };

  const handleUpdateMemory = async (newContent: string) => {
    if (!user) return;
    try {
      // The AI already provides a well-formed update string, use it directly
      const words = newContent.toLowerCase().split(/\s+/);
      const match = memories.find((m) => {
        const memWords = m.content.toLowerCase();
        return words.some((w) => w.length > 3 && memWords.includes(w));
      });

      if (match) {
        await supabase.from("memories").update({ content: newContent, updated_at: new Date().toISOString() }).eq("id", match.id);
        toast.success("Memória atualizada!");
      } else {
        await supabase.from("memories").insert({ user_id: user.id, content: newContent, source: "ai" });
        toast.success("Memória salva!");
      }
      await refreshMemories();
    } catch { toast.error("Erro ao atualizar memória"); }
  };

  const activeConv = conversations.find((c) => c.id === activeConvId);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <div
        className={`hidden md:flex transition-all duration-300 ease-in-out overflow-hidden ${sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        style={{ width: sidebarOpen ? sidebarWidth : 0 }}
      >
        <div className="flex-1 min-w-0 flex flex-col bg-sidebar rounded-r-2xl overflow-hidden">
          <ChatSidebar
            conversations={conversations}
            activeId={activeConvId}
            onSelect={setActiveConvId}
            onNew={() => { setActiveConvId(null); setMessages([]); }}
            onDelete={handleDeleteConversation}
            onRename={handleRenameConversationById}
          />
          <div className="border-t border-sidebar-border px-3 py-3">
            <ProfileMenu onMemoriesChanged={refreshMemories} onNicknameChanged={setNickname} layout="sidebar" />
          </div>
        </div>
        <div className="w-1 cursor-col-resize hover:bg-accent/30 active:bg-accent/50 transition-colors flex-shrink-0" onMouseDown={handleResizeStart} />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setSidebarOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" />
          <div className="relative z-50 h-full w-72 flex flex-col animate-slide-in-left rounded-r-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <ChatSidebar
              conversations={conversations}
              activeId={activeConvId}
              onSelect={(id) => { setActiveConvId(id); setSidebarOpen(false); }}
              onNew={() => { setActiveConvId(null); setMessages([]); setSidebarOpen(false); }}
              onDelete={handleDeleteConversation}
              onRename={handleRenameConversationById}
            />
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col min-w-0">
        {/* Header — hide tab switcher on mobile (uses bottom tabs instead) */}
        <header className="flex h-12 items-center justify-between px-4 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setSidebarOpen(!sidebarOpen)}>
              {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
            </Button>
            {activeConv && tab === "chat" && (
              <ConversationRename key={activeConv.id} title={activeConv.title} onRename={handleRenameConversation} />
            )}
            {tab === "neural" && <span className="text-sm font-medium text-foreground">Rede Neural</span>}
            {tab === "profile" && <span className="text-sm font-medium text-foreground md:hidden">Perfil</span>}
          </div>
          {/* Desktop tab switcher */}
          <div className="hidden md:flex items-center gap-1.5">
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

        {/* Content area */}
        <div className="flex-1 overflow-hidden pb-14 md:pb-0">
          {tab === "chat" ? (
            <div className="flex h-full flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto">
                {messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center">
                    <div className="text-center space-y-3">
                      <h1 className="text-3xl font-semibold text-foreground flex items-center justify-center gap-2">
                        <span>Olá{profile?.display_name ? `, ${profile.display_name.split(" ")[0]}` : ""}!</span>
                        <FluentEmoji emoji="👋" size={36} />
                      </h1>
                      <p className="text-muted-foreground text-base">Como posso te ajudar hoje?</p>
                    </div>
                  </div>
                ) : (
                  <div className="mx-auto max-w-3xl px-6 py-4">
                    <div className="flex items-center justify-center py-4">
                      <span className="text-xs text-muted-foreground/60 font-medium">Hoje</span>
                    </div>
                    {messages.map((m, i) => {
                      const isLastAssistant = m.role === "assistant" && i === messages.length - 1;
                      return (
                        <div key={i}>
                          {isLastAssistant && <div ref={assistantStartRef} />}
                          <ChatMessage
                            role={m.role}
                            content={m.content}
                            images={m.images}
                            avatar={m.role === "user" ? profile?.avatar_url : null}
                            isStreaming={m.role === "assistant" && isStreaming && i === messages.length - 1}
                            onSaveMemory={m.role === "user" ? handleSaveMemory : undefined}
                            onUpdateMemory={m.role === "assistant" ? handleUpdateMemory : undefined}
                          />
                        </div>
                      );
                    })}
                    <div ref={bottomRef} />
                  </div>
                )}
              </div>
              <ChatInput onSend={handleSend} disabled={isStreaming} />
            </div>
          ) : tab === "neural" ? (
            <div className="h-full overflow-hidden">
              <NeuralGraph />
            </div>
          ) : (
            /* Profile tab (mobile) */
            <div className="flex h-full flex-col items-center px-6 py-8 overflow-y-auto">
              <div className="w-full max-w-sm space-y-6">
                {/* Avatar & name */}
                <div className="flex flex-col items-center gap-3">
                  <div className="h-20 w-20 overflow-hidden rounded-full border-2 border-border">
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt="Perfil" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-accent text-accent-foreground text-2xl font-bold">
                        {profile?.display_name?.[0] || "U"}
                      </div>
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold text-foreground">{profile?.display_name || "Usuário"}</p>
                    <p className="text-sm text-muted-foreground">{profile?.email}</p>
                  </div>
                </div>

                {/* Menu items */}
                <div className="space-y-1">
                  <button
                    onClick={() => setMobileMemoryOpen(true)}
                    className="flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-medium text-foreground hover:bg-secondary transition-colors"
                  >
                    <Brain className="h-5 w-5 text-accent" />
                    Memórias
                    <span className="ml-auto text-xs text-muted-foreground">{memories.length}</span>
                  </button>
                  <button
                    onClick={() => setMobileSettingsOpen(true)}
                    className="flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-medium text-foreground hover:bg-secondary transition-colors"
                  >
                    <Settings className="h-5 w-5 text-muted-foreground" />
                    Configurações
                  </button>
                </div>

                <div className="pt-4 border-t border-border">
                  <button
                    onClick={signOut}
                    className="flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <LogOut className="h-5 w-5" />
                    Sair da conta
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Mobile bottom tab bar */}
        <nav className="fixed bottom-0 left-0 right-0 z-30 flex md:hidden border-t border-border bg-background/95 backdrop-blur-lg safe-bottom">
          <button
            onClick={() => setTab("chat")}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 transition-colors ${
              tab === "chat" ? "text-accent" : "text-muted-foreground"
            }`}
          >
            <MessageSquare className="h-5 w-5" />
            <span className="text-[10px] font-medium">Chat</span>
          </button>
          <button
            onClick={() => setTab("neural")}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 transition-colors ${
              tab === "neural" ? "text-accent" : "text-muted-foreground"
            }`}
          >
            <AtomIcon className="h-5 w-5" />
            <span className="text-[10px] font-medium">Neural</span>
          </button>
          <button
            onClick={() => setTab("profile")}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 transition-colors ${
              tab === "profile" ? "text-accent" : "text-muted-foreground"
            }`}
          >
            <User className="h-5 w-5" />
            <span className="text-[10px] font-medium">Perfil</span>
          </button>
        </nav>
      </div>

      {/* Mobile dialogs */}
      <MemoryDialog open={mobileMemoryOpen} onOpenChange={setMobileMemoryOpen} onMemoriesChanged={refreshMemories} />
      <SettingsDialog open={mobileSettingsOpen} onOpenChange={setMobileSettingsOpen} onNicknameChanged={setNickname} />
    </div>
  );
};

export default Index;
