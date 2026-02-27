import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ChatSidebar } from "@/components/ChatSidebar";
import { ChatMessage } from "@/components/ChatMessage";
import { ChatInput } from "@/components/ChatInput";
import { ProfileMenu } from "@/components/ProfileMenu";
import { NeuralGraph } from "@/components/NeuralGraph";
import { streamChat, type Msg } from "@/lib/chatStream";
import { toast } from "sonner";
import { Menu, MessageSquare, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navigate } from "react-router-dom";

type Tab = "chat" | "neural";

const Index = () => {
  const { user, profile, session, loading } = useAuth();
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [memories, setMemories] = useState<string[]>([]);
  const [tab, setTab] = useState<Tab>("chat");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

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

  // Fetch messages for active conversation
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

  // Fetch memories
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("memories")
        .select("content")
        .eq("user_id", user.id);
      if (data) setMemories(data.map((m) => m.content));
    };
    load();
  }, [user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
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

  const handleSend = async (text: string) => {
    if (!user) return;
    let convId = activeConvId;
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

    if (messages.length === 0) {
      const title = text.slice(0, 50) + (text.length > 50 ? "..." : "");
      await supabase.from("conversations").update({ title }).eq("id", convId);
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, title } : c))
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

    try {
      await streamChat({
        messages: [...messages, userMsg],
        memories,
        conversationId: convId,
        onDelta: upsert,
        onDone: async () => {
          setIsStreaming(false);
          await supabase.from("messages").insert({
            conversation_id: convId!,
            user_id: user!.id,
            role: "assistant",
            content: assistantContent,
          });
          await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", convId!);
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

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {sidebarOpen && (
        <div className="hidden md:block">
          <ChatSidebar
            conversations={conversations}
            activeId={activeConvId}
            onSelect={setActiveConvId}
            onNew={() => { setActiveConvId(null); setMessages([]); }}
            onDelete={handleDeleteConversation}
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
            />
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex gap-1 rounded-lg bg-secondary p-0.5">
              <button
                onClick={() => setTab("chat")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
                  tab === "chat" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <MessageSquare className="h-4 w-4" />
                Chat
              </button>
              <button
                onClick={() => setTab("neural")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
                  tab === "neural" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Share2 className="h-4 w-4" />
                Rede Neural
              </button>
            </div>
          </div>
          <ProfileMenu />
        </header>

        {tab === "chat" ? (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto">
              {messages.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <h2 className="text-2xl font-semibold text-foreground">Olá! 👋</h2>
                    <p className="mt-2 text-muted-foreground">Como posso te ajudar hoje?</p>
                  </div>
                </div>
              ) : (
                <div className="mx-auto max-w-3xl py-4">
                  {messages.map((m, i) => (
                    <ChatMessage
                      key={i}
                      role={m.role}
                      content={m.content}
                      avatar={m.role === "user" ? profile?.avatar_url : null}
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
