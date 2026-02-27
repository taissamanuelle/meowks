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
import { Menu, MessageSquare } from "lucide-react";
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
const MAX_SIDEBAR = 420;
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

  // Sidebar resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const onMouseMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = Math.min(MAX_SIDEBAR, Math.max(MIN_SIDEBAR, startWidth + (ev.clientX - startX)));
      setSidebarWidth(newWidth);
    };
    const onMouseUp = () => {
      isResizing.current = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [sidebarWidth]);

  // Fetch conversations
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("conversations")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });
      if (data) setConversations(data);
    };
    load();
  }, [user]);

  // Fetch messages
  useEffect(() => {
    if (!activeConvId || !user) { setMessages([]); return; }
    const load = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", activeConvId)
        .order("created_at", { ascending: true });
      if (data) setMessages(data.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })));
    };
    load();
  }, [activeConvId, user]);

  // Fetch memories - always fresh
  const refreshMemories = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("memories")
      .select("id, content")
      .eq("user_id", user.id);
    if (data) setMemories(data);
  }, [user]);

  useEffect(() => {
    refreshMemories();
  }, [refreshMemories]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
    const { data } = await supabase
      .from("conversations")
      .insert({ user_id: user.id })
      .select()
      .single();
    if (data) {
      setConversations((prev) => [data, ...prev]);
      setActiveConvId(data.id);
      setMessages([]);
      return data.id;
    }
    return null;
  };

  // Generate a title from the AI based on conversation
  const generateTitle = async (convId: string, userText: string, aiResponse: string) => {
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/summarize-memory`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          userMessage: userText,
          userName: "",
          mode: "title",
          aiResponse,
        }),
      });
      if (resp.ok) {
        const { summary } = await resp.json();
        const title = summary.slice(0, 60);
        await supabase.from("conversations").update({ title }).eq("id", convId);
        setConversations((prev) =>
          prev.map((c) => (c.id === convId ? { ...c, title } : c))
        );
      }
    } catch { /* fallback to user text */ }
  };

  const handleSend = async (text: string) => {
    if (!user) return;
    let convId = activeConvId;
    const isFirstMessage = !convId || messages.length === 0;
    if (!convId) {
      convId = await createConversation();
      if (!convId) return;
    }

    const userMsg: Msg = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);

    await supabase.from("messages").insert({
      conversation_id: convId,
      user_id: user.id,
      role: "user",
      content: text,
    });

    // Set temporary title
    if (isFirstMessage) {
      const tempTitle = text.slice(0, 50) + (text.length > 50 ? "..." : "");
      await supabase.from("conversations").update({ title: tempTitle }).eq("id", convId);
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, title: tempTitle } : c))
      );
    }

    let assistantContent = "";
    const upsert = (chunk: string) => {
      assistantContent += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantContent } : m));
        }
        return [...prev, { role: "assistant", content: assistantContent }];
      });
    };

    const currentConvId = convId;
    try {
      await streamChat({
        messages: [...messages, userMsg],
        memories: memories.map((m) => m.content),
        conversationId: convId,
        onDelta: upsert,
        onDone: async () => {
          setIsStreaming(false);
          await supabase.from("messages").insert({
            conversation_id: currentConvId,
            user_id: user!.id,
            role: "assistant",
            content: assistantContent,
          });
          await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", currentConvId);
          // Generate smart title after first exchange
          if (isFirstMessage) {
            generateTitle(currentConvId, text, assistantContent);
          }
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
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeConvId === id) {
      setActiveConvId(null);
      setMessages([]);
    }
  };

  const handleRenameConversation = async (newTitle: string) => {
    if (!activeConvId) return;
    await supabase.from("conversations").update({ title: newTitle }).eq("id", activeConvId);
    setConversations((prev) =>
      prev.map((c) => (c.id === activeConvId ? { ...c, title: newTitle } : c))
    );
  };

  const handleRenameConversationById = async (id: string, newTitle: string) => {
    await supabase.from("conversations").update({ title: newTitle }).eq("id", id);
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: newTitle } : c))
    );
  };

  // Save memory from user message (summarized by AI)
  const handleSaveMemory = async (userText: string) => {
    if (!user) return;
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/summarize-memory`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          userMessage: userText,
          userName: profile?.display_name || "O usuário",
        }),
      });
      if (!resp.ok) throw new Error("Erro ao processar memória");
      const { summary } = await resp.json();
      const { error } = await supabase.from("memories").insert({
        user_id: user.id,
        content: summary,
        source: "ai",
      });
      if (error) throw error;
      toast.success("Memória salva: " + summary);
      await refreshMemories();
    } catch (err) {
      toast.error("Erro ao salvar memória");
      throw err;
    }
  };

  const activeConv = conversations.find((c) => c.id === activeConvId);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {sidebarOpen && (
        <div className="hidden md:flex" style={{ width: sidebarWidth }}>
          <div className="flex-1 min-w-0">
            <ChatSidebar
              conversations={conversations}
              activeId={activeConvId}
              onSelect={setActiveConvId}
              onNew={() => { setActiveConvId(null); setMessages([]); }}
              onDelete={handleDeleteConversation}
              onRename={handleRenameConversationById}
            />
          </div>
          {/* Resize handle */}
          <div
            className="w-1 cursor-col-resize hover:bg-accent/30 active:bg-accent/50 transition-colors flex-shrink-0"
            onMouseDown={handleResizeStart}
          />
        </div>
      )}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setSidebarOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative z-50 h-full w-64" onClick={(e) => e.stopPropagation()}>
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
        <header className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <Menu className="h-5 w-5" />
            </Button>
            {activeConv && (
              <ConversationRename
                key={activeConv.id}
                title={activeConv.title}
                onRename={handleRenameConversation}
              />
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 rounded-full bg-secondary p-1">
              <button
                onClick={() => setTab("chat")}
                className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm transition-all ${
                  tab === "chat" ? "bg-accent text-accent-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Chat
              </button>
              <button
                onClick={() => setTab("neural")}
                className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm transition-all ${
                  tab === "neural" ? "bg-accent text-accent-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <AtomIcon className="h-3.5 w-3.5" />
                Neural
              </button>
            </div>
            <ProfileMenu onMemoriesChanged={refreshMemories} />
          </div>
        </header>

        {tab === "chat" ? (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto">
              {messages.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <h2 className="text-3xl font-semibold text-foreground">Olá! 👋</h2>
                    <p className="mt-3 text-muted-foreground">Como posso te ajudar hoje?</p>
                  </div>
                </div>
              ) : (
                <div className="mx-auto max-w-3xl px-4">
                  {messages.map((m, i) => (
                    <ChatMessage
                      key={i}
                      role={m.role}
                      content={m.content}
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
