import { useCallback, useEffect, useRef, useState } from "react";
import { FluentEmoji } from "@/components/FluentEmoji";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChatSidebar } from "@/components/ChatSidebar";
import { PinSetup } from "@/pages/PinSetup";
import { TotpSetup } from "@/pages/TotpSetup";
import { MasterPasswordSetup } from "@/pages/MasterPasswordSetup";
import { ChatMessage } from "@/components/ChatMessage";
import { ChatInput } from "@/components/ChatInput";
import { ProfileMenu } from "@/components/ProfileMenu";
import { ConversationRename } from "@/components/ConversationRename";
import { AgentDialog, type Agent } from "@/components/AgentDialog";
import { streamChat, type Msg } from "@/lib/chatStream";
import { toast } from "sonner";
import { PanelLeftClose, PanelLeft, MessageSquare, Settings, LogOut, User, Bot, Trophy, ChevronDown, Brain } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Navigate } from "react-router-dom";
import { MemoryDialog } from "@/components/MemoryDialog";
import { SettingsDialog } from "@/components/SettingsDialog";
import { AchievementsView } from "@/components/AchievementsView";
import { NeuralGraph } from "@/components/NeuralGraph";

import { applyAccentColor } from "@/hooks/useAccentColor";

type Tab = "chat" | "achievements" | "neural" | "profile";


const MIN_SIDEBAR = 320;
const MAX_SIDEBAR = 460;
const DEFAULT_SIDEBAR = 360;

const Index = () => {
  const { user, profile, session, loading, signOut, isAllowedEmail, pinStatus, setPinVerified, refreshProfile, totpStatus, setTotpVerified, masterPasswordStatus, setMasterPasswordVerified } = useAuth();
  const isMobile = useIsMobile();
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConvId, setActiveConvIdRaw] = useState<string | null>(() => sessionStorage.getItem("meowks_active_conv") || null);
  const setActiveConvId = useCallback((id: string | null) => {
    setActiveConvIdRaw(id);
    if (id) sessionStorage.setItem("meowks_active_conv", id);
    else sessionStorage.removeItem("meowks_active_conv");
  }, []);
  const [primaryConvId, setPrimaryConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isProcessingDocs, setIsProcessingDocs] = useState(false);
  const [memories, setMemories] = useState<{ id: string; content: string }[]>([]);
  const [achievements, setAchievements] = useState<{ id: string; title: string; year: number }[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [tab, setTabState] = useState<Tab>(() => {
    const saved = sessionStorage.getItem("meowks_active_tab");
    return (saved as Tab) || "chat";
  });

  // Wrap setTab to push browser history for back-button navigation
  const tabHistoryRef = useRef<Tab[]>([]);
  const isPopStateRef = useRef(false);
  const setTab = useCallback((newTab: Tab) => {
    setTabState(prev => {
      if (prev !== newTab && !isPopStateRef.current) {
        tabHistoryRef.current.push(prev);
        window.history.pushState({ tab: newTab }, "");
      }
      isPopStateRef.current = false;
      return newTab;
    });
  }, []);

  const [mobileMemoryOpen, setMobileMemoryOpen] = useState(false);
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);

  // Track how many dialog history entries are currently pushed
  const dialogHistoryCountRef = useRef(0);
  const isBackClosingDialogRef = useRef(false);

  // Wrap dialog openers to push history entries
  const openMobileMemory = useCallback(() => {
    setMobileMemoryOpen(true);
    dialogHistoryCountRef.current++;
    window.history.pushState({ dialog: "memory" }, "");
  }, []);
  const openMobileSettings = useCallback(() => {
    setMobileSettingsOpen(true);
    dialogHistoryCountRef.current++;
    window.history.pushState({ dialog: "settings" }, "");
  }, []);

  // Handle dialog close from UI (not from back button)
  const handleMobileMemoryChange = useCallback((open: boolean) => {
    if (!open && mobileMemoryOpen && !isBackClosingDialogRef.current && dialogHistoryCountRef.current > 0) {
      dialogHistoryCountRef.current--;
      window.history.back();
    }
    setMobileMemoryOpen(open);
  }, [mobileMemoryOpen]);
  const handleMobileSettingsChange = useCallback((open: boolean) => {
    if (!open && mobileSettingsOpen && !isBackClosingDialogRef.current && dialogHistoryCountRef.current > 0) {
      dialogHistoryCountRef.current--;
      window.history.back();
    }
    setMobileSettingsOpen(open);
  }, [mobileSettingsOpen]);

  // Listen for browser back button
  useEffect(() => {
    const handlePopState = () => {
      // If a dialog is open, close it instead of navigating tabs
      if (dialogHistoryCountRef.current > 0) {
        dialogHistoryCountRef.current--;
        isBackClosingDialogRef.current = true;
        setMobileMemoryOpen(false);
        setMobileSettingsOpen(false);
        // Re-push anchor so history doesn't empty
        window.history.pushState({ tab: "anchor" }, "");
        requestAnimationFrame(() => { isBackClosingDialogRef.current = false; });
        return;
      }
      const prevTab = tabHistoryRef.current.pop();
      if (prevTab) {
        isPopStateRef.current = true;
        setTabState(prevTab);
        sessionStorage.setItem("meowks_active_tab", prevTab);
      }
      // Always re-push a state so the history never empties (prevents leaving the app)
      window.history.pushState({ tab: "anchor" }, "");
    };
    window.addEventListener("popstate", handlePopState);
    // Push initial state + anchor so there's always something in the stack
    window.history.replaceState({ tab }, "");
    window.history.pushState({ tab: "anchor" }, "");
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR);
  const [nickname, setNickname] = useState<string>("");
  // mobileMemoryOpen and mobileSettingsOpen moved above (before dialog history handlers)
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activeAgentId, setActiveAgentIdRaw] = useState<string | null>(() => sessionStorage.getItem("meowks_active_agent") || null);
  const setActiveAgentId = useCallback((id: string | null) => {
    setActiveAgentIdRaw(id);
    if (id) sessionStorage.setItem("meowks_active_agent", id);
    else sessionStorage.removeItem("meowks_active_agent");
  }, []);
  const [agentDialogOpen, setAgentDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const isResizing = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const assistantStartRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const lastAssistantIdxRef = useRef<number>(-1);
  // Skip next fetch when we just created a conversation
  const skipNextFetchRef = useRef(false);

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

  // Helper to resolve the correct color for a conversation
  const resolveConversationColor = useCallback((convId: string | null, convList: any[], agentList: Agent[], globalColor?: string) => {
    if (!convId) return globalColor || "#00e89d";
    const conv = convList.find(c => c.id === convId);
    if (conv?.accent_color) return conv.accent_color;
    if (conv?.agent_id) {
      const agent = agentList.find(a => a.id === conv.agent_id);
      if (agent?.accent_color) return agent.accent_color;
    }
    return globalColor || "#00e89d";
  }, []);

  // Track the global user color
  const globalColorRef = useRef("#00e89d");

  useEffect(() => {
    if (!user) return;
    setLoadingConversations(true);
    (async () => {
      // Fetch conversations, profile, and agents in parallel
      const [convResult, profResult, agentResult] = await Promise.all([
        supabase.from("conversations").select("*").eq("user_id", user.id).order("updated_at", { ascending: false }),
        supabase.from("profiles").select("primary_conversation_id, accent_color").eq("user_id", user.id).single(),
        supabase.from("agents").select("*").eq("user_id", user.id).order("created_at", { ascending: true }),
      ]);

      const convData = convResult.data || [];
      const agentData = (agentResult.data || []) as Agent[];
      setConversations(convData);
      setAgents(agentData);

      const pid = (profResult.data as any)?.primary_conversation_id || null;
      const savedGlobalColor = (profResult.data as any)?.accent_color || "#00e89d";
      globalColorRef.current = savedGlobalColor;
      setPrimaryConvId(pid);

      // Determine which conversation will be active
      const targetConvId = activeConvId || pid;
      if (pid && !activeConvId) {
        setActiveConvId(pid);
        const primaryConv = convData.find(c => c.id === pid);
        if (primaryConv?.agent_id) setActiveAgentId(primaryConv.agent_id);
      }

      // Apply the correct color immediately with all data available
      const correctColor = resolveConversationColor(targetConvId, convData, agentData, savedGlobalColor);
      applyAccentColor(correctColor);

      setLoadingConversations(false);
    })();
  }, [user]);

  // Reapply accent color when switching conversations (not on initial load)
  const isInitialLoadRef = useRef(true);
  useEffect(() => {
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      return;
    }
    if (!activeConvId) {
      applyAccentColor(globalColorRef.current);
      return;
    }
    const color = resolveConversationColor(activeConvId, conversations, agents, globalColorRef.current);
    applyAccentColor(color);
  }, [activeConvId]);

  useEffect(() => {
    if (!activeConvId || !user) { setMessages([]); return; }
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false;
      return;
    }
    setLoadingMessages(true);
    (async () => {
      const { data } = await supabase.from("messages").select("*").eq("conversation_id", activeConvId).order("created_at", { ascending: true });
      if (data) setMessages(data.map((m) => {
        const msg: Msg = { role: m.role as "user" | "assistant", content: m.content };
        try {
          const parsed = JSON.parse(m.content);
          if (parsed._images || parsed._documents) {
            msg.content = parsed.text || "";
            if (parsed._images) msg.images = parsed._images;
            if (parsed._documents) msg.documents = parsed._documents;
          }
        } catch { /* plain text */ }
        return msg;
      }));
      setLoadingMessages(false);
    })();
  }, [activeConvId, user]);

  // Scroll to bottom after messages finish loading AND chat is visible (all gates passed)
  const prevLoadingMessages = useRef(false);
  const hasScrolledInitial = useRef(false);
  const allGatesPassed = pinStatus === "verified" && totpStatus === "verified" && masterPasswordStatus === "verified";

  useEffect(() => {
    // Case 1: messages just finished loading and chat is visible
    if (prevLoadingMessages.current && !loadingMessages && messages.length > 0 && allGatesPassed) {
      requestAnimationFrame(() => {
        const savedScroll = sessionStorage.getItem("meowks_scroll");
        if (savedScroll && chatScrollRef.current) {
          chatScrollRef.current.scrollTop = Number(savedScroll);
        } else {
          bottomRef.current?.scrollIntoView({ behavior: "auto" });
        }
      });
      hasScrolledInitial.current = true;
    }
    prevLoadingMessages.current = loadingMessages;
  }, [loadingMessages, messages.length, allGatesPassed]);

  // Case 2: gates just passed but messages were already loaded (primary conversation)
  useEffect(() => {
    if (allGatesPassed && !loadingMessages && messages.length > 0 && !hasScrolledInitial.current) {
      requestAnimationFrame(() => {
        setTimeout(() => {
          const savedScroll = sessionStorage.getItem("meowks_scroll");
          if (savedScroll && chatScrollRef.current) {
            chatScrollRef.current.scrollTop = Number(savedScroll);
          } else {
            bottomRef.current?.scrollIntoView({ behavior: "auto" });
          }
          hasScrolledInitial.current = true;
        }, 50);
      });
    }
  }, [allGatesPassed]);

  // Restore scroll when returning from a webview / tab switch / focus
  useEffect(() => {
    const restoreScroll = () => {
      const saved = sessionStorage.getItem("meowks_scroll");
      if (saved && chatScrollRef.current) {
        const scrollVal = Number(saved);
        chatScrollRef.current.scrollTop = scrollVal;
        // Double-check after layout settles
        requestAnimationFrame(() => {
          if (chatScrollRef.current) chatScrollRef.current.scrollTop = scrollVal;
        });
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") restoreScroll();
    };
    const handleFocus = () => restoreScroll();
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) restoreScroll();
      else restoreScroll();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("pageshow", handlePageShow);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  // Fetch nickname
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("nickname").eq("user_id", user.id).single().then(({ data, error }) => {
      if (error) console.error("Nickname fetch error:", error);
      setNickname(data?.nickname || "");
    });
  }, [user]);

  const refreshMemories = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("memories").select("id, content").eq("user_id", user.id);
    if (data) setMemories(data);
  }, [user]);

  const refreshAchievements = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("achievements").select("id, title, year").eq("user_id", user.id).order("year", { ascending: false });
    if (data) setAchievements(data as any);
  }, [user]);

  // Persist active tab to sessionStorage
  useEffect(() => {
    sessionStorage.setItem("meowks_active_tab", tab);
    // Scroll to bottom when switching back to chat tab
    if (tab === "chat" && messages.length > 0) {
      requestAnimationFrame(() => {
        setTimeout(() => {
          bottomRef.current?.scrollIntoView({ behavior: "auto" });
        }, 50);
      });
    }
  }, [tab]);

  const refreshAgents = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("agents").select("*").eq("user_id", user.id).order("created_at", { ascending: true });
    if (data) setAgents(data as Agent[]);
  }, [user]);

  useEffect(() => { refreshMemories(); }, [refreshMemories]);
  useEffect(() => { refreshAchievements(); }, [refreshAchievements]);
  useEffect(() => { refreshAgents(); }, [refreshAgents]);
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

  // TOTP 2FA gate (before PIN)
  if (totpStatus === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }
  if (totpStatus === "needs_enroll") {
    return <TotpSetup mode="enroll" onSuccess={setTotpVerified} />;
  }
  if (totpStatus === "needs_verify") {
    return <TotpSetup mode="verify" onSuccess={setTotpVerified} />;
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

  // Master Password gate (only on new devices)
  if (masterPasswordStatus === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }
  if (masterPasswordStatus === "needs_create") {
    return <MasterPasswordSetup mode="create" onSuccess={setMasterPasswordVerified} />;
  }
  if (masterPasswordStatus === "needs_verify") {
    return <MasterPasswordSetup mode="verify" onSuccess={setMasterPasswordVerified} />;
  }



  const createConversation = async (forAgentId?: string) => {
    if (!user) return null;
    const insertData: any = { user_id: user.id };
    if (forAgentId) insertData.agent_id = forAgentId;
    const { data } = await supabase.from("conversations").insert(insertData).select().single();
    if (data) {
      setConversations((p) => [data, ...p]);
      skipNextFetchRef.current = true; // prevent useEffect from clearing messages
      setActiveConvId(data.id);
      setMessages([]);
      return data.id;
    }
    return null;
  };

  const generateTitle = async (convId: string, userText: string, aiResponse: string) => {
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      const token = s?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/summarize-memory`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
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

  // Upload images to storage and return signed URLs
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
          const { data: signedData } = await supabase.storage.from("chat-images").createSignedUrl(path, 60 * 60 * 24 * 365); // 1 year
          if (signedData?.signedUrl) urls.push(signedData.signedUrl);
        }
      } catch { /* skip failed */ }
    }
    return urls;
  };

  // Upload documents (PDF/CSV) to storage, extract text, and return content
  const uploadDocuments = async (files: File[]): Promise<{ name: string; content: string }[]> => {
    if (!user) return [];
    const results: { name: string; content: string }[] = [];
    for (const file of files) {
      try {
        const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from("chat-images").upload(path, file, { contentType: file.type });
        if (error) continue;

        // For CSV, read directly as text
        if (ext === "csv") {
          const text = await file.text();
          const truncated = text.length > 30000 ? text.substring(0, 30000) + "\n[...truncado]" : text;
          results.push({ name: file.name, content: truncated });
          continue;
        }

        // For PDF, use parse-document edge function
        const { data: { session: s } } = await supabase.auth.getSession();
        const token = s?.access_token;
        if (!token) continue;

        const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-document`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ filePath: path, fileType: ext, agentId: "chat" }),
        });

        if (resp.ok) {
          const data = await resp.json();
          // Read the full content from agent_documents or use the response
          const { data: docData } = await supabase.storage.from("chat-images").createSignedUrl(path, 3600);
          results.push({ name: file.name, content: data.contentText || "[Documento processado]" });
        } else {
          // Fallback: just note the file was attached
          results.push({ name: file.name, content: "[Não foi possível extrair o conteúdo]" });
        }
      } catch {
        results.push({ name: file.name, content: "[Erro ao processar arquivo]" });
      }
    }
    return results;
  };

  const handleSend = async (text: string, imagePreviews?: string[], documentFiles?: File[]) => {
    if (!user) return;
    let convId = activeConvId;
    const isFirst = !convId || messages.length === 0;
    if (!convId) { convId = await createConversation(activeAgentId || undefined); if (!convId) return; }

    // Upload images if any
    let imageUrls: string[] | undefined;
    if (imagePreviews && imagePreviews.length > 0) {
      imageUrls = await uploadImages(imagePreviews);
    }

    // Build document metadata for display (show immediately)
    const docMeta = documentFiles && documentFiles.length > 0
      ? documentFiles.map(f => ({ name: f.name, type: f.name.split(".").pop()?.toLowerCase() || "file" }))
      : undefined;

    // Add user message + empty assistant placeholder immediately
    const userMsg: Msg = { role: "user", content: text || (documentFiles?.length ? "📎 Documentos anexados" : ""), images: imageUrls, documents: docMeta };
    setMessages((p) => [...p, userMsg, { role: "assistant", content: "" }]);
    setIsStreaming(true);

    // Process documents if any (user already sees the processing indicator)
    let docContext = "";
    if (documentFiles && documentFiles.length > 0) {
      setIsProcessingDocs(true);
      try {
        const docs = await uploadDocuments(documentFiles);
        if (docs.length > 0) {
          docContext = docs.map(d => `\n\n📎 Arquivo "${d.name}":\n${d.content}`).join("");
        }
      } catch (e) {
        console.error("Error processing documents:", e);
        toast.error("Erro ao processar documentos. Tente novamente.");
      }
      setIsProcessingDocs(false);
    }

    // Append doc context to message content for AI — with anti-hallucination instruction
    const fullText = docContext 
      ? (text || "Analise os documentos anexados") + docContext + "\n\n⚠️ INSTRUÇÃO: Responda APENAS com base no conteúdo dos documentos acima. Não invente dados."
      : text;

    // Store message - encode images/documents in content if present
    const hasAttachments = (imageUrls && imageUrls.length > 0) || (docMeta && docMeta.length > 0);
    const storedContent = hasAttachments
      ? JSON.stringify({ 
          text: text || "", 
          ...(imageUrls && imageUrls.length > 0 ? { _images: imageUrls } : {}),
          ...(docMeta && docMeta.length > 0 ? { _documents: docMeta } : {}),
        })
      : text || "📎 Documentos anexados";
    await supabase.from("messages").insert({ conversation_id: convId, user_id: user.id, role: "user", content: storedContent });

    if (isFirst) {
      const t = (text || "Documento").slice(0, 50) + (text && text.length > 50 ? "..." : "");
      await supabase.from("conversations").update({ title: t }).eq("id", convId);
      setConversations((p) => p.map((c) => (c.id === convId ? { ...c, title: t } : c)));
    }

    let assistantContent = "";
    let animFrameId: number | null = null;
    let streamDone = false;

    const updateDisplay = (content: string) => {
      setMessages((p) => {
        const last = p[p.length - 1];
        if (last?.role === "assistant") return p.map((m, i) => (i === p.length - 1 ? { ...m, content } : m));
        return [...p, { role: "assistant", content }];
      });
    };

    const onDelta = (chunk: string) => {
      assistantContent += chunk;
      // Direct update — React batches these naturally, no artificial delay
      if (!animFrameId) {
        animFrameId = requestAnimationFrame(() => {
          updateDisplay(assistantContent);
          animFrameId = null;
        });
      }
    };

    const cid = convId;
    const aiUserMsg: Msg = { role: "user", content: fullText, images: imageUrls };
    try {
      await streamChat({
        messages: [...messages, aiUserMsg],
        memories: memories.map((m) => m.content),
        achievements: achievements.map(a => ({ title: a.title, year: a.year })),
        conversationId: convId,
        userNickname: nickname || undefined,
        agentId: activeAgentId || undefined,
        onDelta,
        onDone: async () => {
          if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
          updateDisplay(assistantContent);
          setIsStreaming(false);
          await supabase.from("messages").insert({ conversation_id: cid, user_id: user!.id, role: "assistant", content: assistantContent });
          await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", cid);
          if (isFirst) setTimeout(() => generateTitle(cid, text || "Documento enviado", assistantContent), 5000);
        },
      });
    } catch (e: any) {
      if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
      setIsStreaming(false);
      const msg = e?.message === 'rate_limit' ? "Limite de requisições atingido. Tente novamente em alguns segundos."
        : e?.message === 'auth_error' ? "Sessão expirada. Faça login novamente."
        : e?.message && e.message !== 'server_error' ? e.message
        : "Ocorreu um erro ao processar sua mensagem. Tente novamente.";
      toast.error(msg);
    }
  };

  const handleDeleteConversation = async (id: string) => {
    await supabase.from("messages").delete().eq("conversation_id", id);
    await supabase.from("conversations").delete().eq("id", id);
    setConversations((p) => p.filter((c) => c.id !== id));
    if (activeConvId === id) { setActiveConvId(null); setMessages([]); }
  };

  const handleEditMessage = async (index: number, newContent: string) => {
    if (!user || !activeConvId || isStreaming) return;
    // Delete all messages from index onward in DB
    const { data: dbMsgs } = await supabase.from("messages").select("id, created_at").eq("conversation_id", activeConvId).order("created_at", { ascending: true });
    if (dbMsgs && dbMsgs.length > index) {
      const idsToDelete = dbMsgs.slice(index).map((m) => m.id);
      await supabase.from("messages").delete().in("id", idsToDelete);
    }
    // Truncate local messages and re-send with new content
    const truncated = messages.slice(0, index);
    setMessages(truncated);
    // Use handleSend logic but with truncated history
    const userMsg: Msg = { role: "user", content: newContent, images: messages[index]?.images };
    setMessages([...truncated, userMsg, { role: "assistant", content: "" }]);
    setIsStreaming(true);
    const storedContent = userMsg.images && userMsg.images.length > 0
      ? JSON.stringify({ text: newContent, _images: userMsg.images })
      : newContent;
    await supabase.from("messages").insert({ conversation_id: activeConvId, user_id: user.id, role: "user", content: storedContent });

    let assistantContent = "";
    let animFrameId: number | null = null;
    const updateDisplay = (content: string) => {
      setMessages((p) => {
        const last = p[p.length - 1];
        if (last?.role === "assistant") return p.map((m, i) => (i === p.length - 1 ? { ...m, content } : m));
        return [...p, { role: "assistant", content }];
      });
    };
    const onDelta = (chunk: string) => {
      assistantContent += chunk;
      if (!animFrameId) {
        animFrameId = requestAnimationFrame(() => { updateDisplay(assistantContent); animFrameId = null; });
      }
    };
    try {
      await streamChat({
        messages: [...truncated, userMsg],
        memories: memories.map((m) => m.content),
        achievements: achievements.map(a => ({ title: a.title, year: a.year })),
        conversationId: activeConvId,
        userNickname: nickname || undefined,
        agentId: activeAgentId || undefined,
        onDelta,
        onDone: async () => {
          if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
          updateDisplay(assistantContent);
          setIsStreaming(false);
          await supabase.from("messages").insert({ conversation_id: activeConvId!, user_id: user!.id, role: "assistant", content: assistantContent });
          await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", activeConvId!);
        },
      });
    } catch (e: any) {
      if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
      setIsStreaming(false);
      const msg = e?.message === 'rate_limit' ? "Limite de requisições atingido. Tente novamente em alguns segundos."
        : e?.message === 'auth_error' ? "Sessão expirada. Faça login novamente."
        : e?.message && e.message !== 'server_error' ? e.message
        : "Ocorreu um erro ao processar sua mensagem. Tente novamente.";
      toast.error(msg);
    }
  };

  const handleRegenerate = async (index: number) => {
    if (!user || !activeConvId || isStreaming) return;
    // Delete the assistant message at index from DB and regenerate
    const { data: dbMsgs } = await supabase.from("messages").select("id, created_at").eq("conversation_id", activeConvId).order("created_at", { ascending: true });
    if (dbMsgs && dbMsgs.length > index) {
      const idsToDelete = dbMsgs.slice(index).map((m) => m.id);
      await supabase.from("messages").delete().in("id", idsToDelete);
    }
    const truncated = messages.slice(0, index);
    setMessages([...truncated, { role: "assistant", content: "" }]);
    setIsStreaming(true);

    let assistantContent = "";
    let animFrameId: number | null = null;
    const updateDisplay = (content: string) => {
      setMessages((p) => {
        const last = p[p.length - 1];
        if (last?.role === "assistant") return p.map((m, i) => (i === p.length - 1 ? { ...m, content } : m));
        return [...p, { role: "assistant", content }];
      });
    };
    const onDelta = (chunk: string) => {
      assistantContent += chunk;
      if (!animFrameId) {
        animFrameId = requestAnimationFrame(() => { updateDisplay(assistantContent); animFrameId = null; });
      }
    };
    try {
      await streamChat({
        messages: truncated,
        memories: memories.map((m) => m.content),
        achievements: achievements.map(a => ({ title: a.title, year: a.year })),
        conversationId: activeConvId,
        userNickname: nickname || undefined,
        agentId: activeAgentId || undefined,
        onDelta,
        onDone: async () => {
          if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
          updateDisplay(assistantContent);
          setIsStreaming(false);
          await supabase.from("messages").insert({ conversation_id: activeConvId!, user_id: user!.id, role: "assistant", content: assistantContent });
          await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", activeConvId!);
        },
      });
    } catch (e: any) {
      if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
      setIsStreaming(false);
      const msg = e?.message === 'rate_limit' ? "Limite de requisições atingido. Tente novamente em alguns segundos."
        : e?.message === 'auth_error' ? "Sessão expirada. Faça login novamente."
        : e?.message && e.message !== 'server_error' ? e.message
        : "Ocorreu um erro ao processar sua mensagem. Tente novamente.";
      toast.error(msg);
    }
  };

  const refetchConversations = async () => {
    if (!user) return;
    const { data } = await supabase.from("conversations").select("*").eq("user_id", user.id).order("updated_at", { ascending: false });
    if (data) setConversations(data);
  };

  const handleRenameConversation = async (newTitle: string) => {
    if (!activeConvId) return;
    setConversations((p) => p.map((c) => (c.id === activeConvId ? { ...c, title: newTitle } : c)));
    await supabase.from("conversations").update({ title: newTitle }).eq("id", activeConvId);
    await refetchConversations();
  };

  const handleRenameConversationById = async (id: string, newTitle: string) => {
    // Optimistic update — reflect immediately in UI
    setConversations((p) => p.map((c) => (c.id === id ? { ...c, title: newTitle } : c)));
    await supabase.from("conversations").update({ title: newTitle }).eq("id", id);
    await refetchConversations();
  };

  const handleSetPrimary = async (id: string | null) => {
    if (!user) return;
    setPrimaryConvId(id);
    await supabase.from("profiles").update({ primary_conversation_id: id } as any).eq("user_id", user.id);
  };

  const handleConversationColorChange = async (id: string, color: string | null) => {
    setConversations(p => p.map(c => c.id === id ? { ...c, accent_color: color } : c));
    await supabase.from("conversations").update({ accent_color: color } as any).eq("id", id);
    if (id === activeConvId) {
      applyAccentColor(color || globalColorRef.current);
    }
  };

  const handleSaveMemory = async (userText: string) => {
    if (!user) return;
    try {
      // Save the user's text exactly as written, just capitalize first letter
      const capitalizedText = userText.trim().charAt(0).toUpperCase() + userText.trim().slice(1);
      await supabase.from("memories").insert({ user_id: user.id, content: capitalizedText, source: "user" });
      toast.success("Memória salva!");
      await refreshMemories();
    } catch { toast.error("Erro ao salvar memória"); }
  };

  const handleUpdateMemory = async (oldContent: string, newContent: string) => {
    if (!user) return;
    try {
      const capContent = newContent.charAt(0).toUpperCase() + newContent.slice(1);

      // Try to find the exact old memory first
      let match = oldContent
        ? memories.find((m) => m.content.toLowerCase().trim() === oldContent.toLowerCase().trim())
        : null;

      // Fallback: fuzzy match by keywords
      if (!match && oldContent) {
        const words = oldContent.toLowerCase().split(/\s+/);
        match = memories.find((m) => {
          const memWords = m.content.toLowerCase();
          const matchCount = words.filter((w) => w.length > 3 && memWords.includes(w)).length;
          return matchCount >= Math.max(2, Math.floor(words.filter(w => w.length > 3).length * 0.5));
        });
      }

      if (match) {
        await supabase.from("memories").update({ content: capContent, updated_at: new Date().toISOString() }).eq("id", match.id);
        toast.success("Memória atualizada!");
      } else {
        await supabase.from("memories").insert({ user_id: user.id, content: capContent, source: "ai" });
        toast.success("Memória salva!");
      }
      await refreshMemories();
    } catch { toast.error("Erro ao atualizar memória"); }
  };

  const handleMoveMemory = async (memoryText: string, newCategory: string) => {
    if (!user) return;
    try {
      // Find the neural node that matches this memory text
      const { data: nodes } = await supabase.from("neural_nodes").select("id, label, category").eq("user_id", user.id);
      if (!nodes) { toast.error("Erro ao buscar nós"); return; }
      
      const normalizedText = memoryText.toLowerCase().trim();
      let match = nodes.find(n => n.label.toLowerCase().trim() === normalizedText);
      if (!match) {
        // Fuzzy match
        const words = normalizedText.split(/\s+/);
        match = nodes.find(n => {
          const label = n.label.toLowerCase();
          const matchCount = words.filter(w => w.length > 3 && label.includes(w)).length;
          return matchCount >= Math.max(2, Math.floor(words.filter(w => w.length > 3).length * 0.4));
        });
      }
      
      if (match) {
        await supabase.from("neural_nodes").update({ category: newCategory }).eq("id", match.id);
        toast.success("Memória reorganizada!");
      } else {
        toast.error("Memória não encontrada na rede neural");
      }
    } catch { toast.error("Erro ao mover memória"); }
  };

  const activeConv = conversations.find((c) => c.id === activeConvId);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <div
        className={`hidden md:flex overflow-hidden ${sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        style={{ width: sidebarOpen ? sidebarWidth : 0, transition: 'width 0.3s ease-in-out, opacity 0.3s ease-in-out' }}
      >
        <div className="flex-1 min-w-0 flex flex-col skeu-sidebar rounded-r-2xl overflow-hidden">
          <ChatSidebar
              conversations={conversations}
              activeId={activeConvId}
              primaryId={primaryConvId}
              loading={loadingConversations}
              agents={agents}
               onSelect={(id) => { setActiveConvId(id); const conv = conversations.find(c => c.id === id); setActiveAgentId(conv?.agent_id || null); setTab("chat"); }}
               onNew={() => { setActiveConvId(null); setActiveAgentId(null); setMessages([]); setTab("chat"); }}
               onDelete={handleDeleteConversation}
               onRename={handleRenameConversationById}
              onSetPrimary={handleSetPrimary}
              onSelectAgent={async (a) => {
                setActiveAgentId(a.id);
                setTab("chat");
                const existing = conversations.find(c => c.agent_id === a.id);
                if (existing) {
                  setActiveConvId(existing.id);
                  // Color applied automatically by activeConvId useEffect
                } else {
                  const convId = await createConversation(a.id);
                  if (convId) {
                    await supabase.from("conversations").update({ title: a.name }).eq("id", convId);
                    setConversations(p => p.map(c => c.id === convId ? { ...c, title: a.name } : c));
                  }
                }
              }}
              onEditAgent={(a) => { setEditingAgent(a); setAgentDialogOpen(true); }}
              onDeleteAgent={async (a) => {
                await supabase.from("agents").delete().eq("id", a.id);
                if (activeAgentId === a.id) { setActiveAgentId(null); setActiveConvId(null); setMessages([]); }
                refreshAgents();
              }}
              onClearAgent={async (a) => {
                const conv = conversations.find(c => c.agent_id === a.id);
                if (conv) {
                  await supabase.from("messages").delete().eq("conversation_id", conv.id);
                  if (activeConvId === conv.id) setMessages([]);
                  toast.success("Conversa limpa!");
                }
              }}
              onFavoriteAgent={async (a) => {
                const conv = conversations.find(c => c.agent_id === a.id);
                if (conv) {
                  // Toggle: if already primary, remove; otherwise set
                  const newPrimary = primaryConvId === conv.id ? null : conv.id;
                  await handleSetPrimary(newPrimary);
                } else {
                  // Create conversation first, then set as primary
                  const convId = await createConversation(a.id);
                  if (convId) {
                    await supabase.from("conversations").update({ title: a.name }).eq("id", convId);
                    setConversations(p => p.map(c => c.id === convId ? { ...c, title: a.name } : c));
                    await handleSetPrimary(convId);
                  }
                }
              }}
              favoriteAgentId={(() => { const fav = conversations.find(c => c.id === primaryConvId && c.agent_id); return fav?.agent_id || null; })()}
              onNewAgent={() => { setEditingAgent(null); setAgentDialogOpen(true); }}
              onConversationColorChange={handleConversationColorChange}
            />
          <div className="skeu-divider mx-3 my-0" />
          <div className="px-3 py-3">
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
              primaryId={primaryConvId}
              loading={loadingConversations}
              agents={agents}
              onSelect={(id) => { setActiveConvId(id); const conv = conversations.find(c => c.id === id); setActiveAgentId(conv?.agent_id || null); setSidebarOpen(false); setTab("chat"); }}
              onNew={() => { setActiveConvId(null); setActiveAgentId(null); setMessages([]); setSidebarOpen(false); setTab("chat"); }}
              onDelete={handleDeleteConversation}
              onRename={handleRenameConversationById}
              onSetPrimary={handleSetPrimary}
              onSelectAgent={async (a) => {
                setActiveAgentId(a.id);
                setSidebarOpen(false);
                setTab("chat");
                const existing = conversations.find(c => c.agent_id === a.id);
                if (existing) {
                  setActiveConvId(existing.id);
                  // Color applied automatically by activeConvId useEffect
                } else {
                  const convId = await createConversation(a.id);
                  if (convId) {
                    await supabase.from("conversations").update({ title: a.name }).eq("id", convId);
                    setConversations(p => p.map(c => c.id === convId ? { ...c, title: a.name } : c));
                  }
                }
              }}
              onEditAgent={(a) => { setEditingAgent(a); setAgentDialogOpen(true); }}
              onDeleteAgent={async (a) => {
                await supabase.from("agents").delete().eq("id", a.id);
                if (activeAgentId === a.id) { setActiveAgentId(null); setActiveConvId(null); setMessages([]); }
                refreshAgents();
              }}
              onClearAgent={async (a) => {
                const conv = conversations.find(c => c.agent_id === a.id);
                if (conv) {
                  await supabase.from("messages").delete().eq("conversation_id", conv.id);
                  if (activeConvId === conv.id) setMessages([]);
                  toast.success("Conversa limpa!");
                }
              }}
              onFavoriteAgent={async (a) => {
                const conv = conversations.find(c => c.agent_id === a.id);
                if (conv) {
                  const newPrimary = primaryConvId === conv.id ? null : conv.id;
                  await handleSetPrimary(newPrimary);
                } else {
                  const convId = await createConversation(a.id);
                  if (convId) {
                    await supabase.from("conversations").update({ title: a.name }).eq("id", convId);
                    setConversations(p => p.map(c => c.id === convId ? { ...c, title: a.name } : c));
                    await handleSetPrimary(convId);
                  }
                }
              }}
              favoriteAgentId={(() => { const fav = conversations.find(c => c.id === primaryConvId && c.agent_id); return fav?.agent_id || null; })()}
              onNewAgent={() => { setEditingAgent(null); setAgentDialogOpen(true); }}
              onConversationColorChange={handleConversationColorChange}
            />
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col min-w-0">
        {/* Header — hide tab switcher on mobile (uses bottom tabs instead) */}
        <header className="skeu-header flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
             <Button variant="ghost" size="icon" className="skeu-btn h-8 w-8 rounded-lg" onClick={() => setSidebarOpen(!sidebarOpen)}>
               {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
             </Button>
            {activeConv && tab === "chat" && !activeAgentId && (
              <ConversationRename key={activeConv.id} title={activeConv.title} onRename={handleRenameConversation} />
            )}
            {tab === "chat" && activeAgentId && (() => {
              const agent = agents.find(a => a.id === activeAgentId);
              return agent ? (
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full overflow-hidden bg-secondary shrink-0 flex items-center justify-center">
                    {agent.avatar_url ? <img src={agent.avatar_url} alt={agent.name} className="h-full w-full object-cover" /> : <Bot className="h-3.5 w-3.5 text-muted-foreground" />}
                  </div>
                  <span className="text-sm font-medium text-foreground">{agent.name}</span>
                </div>
              ) : null;
            })()}
            {tab === "achievements" && <span className="text-sm font-medium text-foreground">Conquistas</span>}
            {tab === "profile" && <span className="text-sm font-medium text-foreground md:hidden">Perfil</span>}
          </div>
          {/* Desktop tab switcher */}
          <div className="hidden md:flex items-center gap-1.5">
            <div className="flex gap-1.5 p-1.5">
              <button
                onClick={() => setTab("chat")}
                className={`flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-medium transition-all ${
                  tab === "chat" ? "skeu-tab-active shadow-sm" : "skeu-tab text-muted-foreground hover:text-foreground"
                }`}
              >
                <MessageSquare className="h-4 w-4" />
                Chat
              </button>
              <button
                onClick={() => setTab("achievements")}
                className={`flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-medium transition-all ${
                  tab === "achievements" ? "skeu-tab-active shadow-sm" : "skeu-tab text-muted-foreground hover:text-foreground"
                }`}
              >
                <Trophy className="h-4 w-4" />
                Conquistas
              </button>
            </div>
          </div>
        </header>

        {/* Content area */}
        <div className="flex-1 overflow-hidden pb-16 md:pb-0">
          {tab === "chat" ? (
            <div className="flex h-full flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto" ref={(el) => {
                chatScrollRef.current = el;
                if (el) {
                  const saved = sessionStorage.getItem("meowks_scroll");
                  if (saved) {
                    const val = Number(saved);
                    if (Math.abs(el.scrollTop - val) > 10) {
                      el.scrollTop = val;
                    }
                  }
                }
              }} onScroll={() => {
                if (chatScrollRef.current) {
                  sessionStorage.setItem("meowks_scroll", String(chatScrollRef.current.scrollTop));
                  const el = chatScrollRef.current;
                  const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
                  setShowScrollBottom(distFromBottom > 200);
                }
              }}>
                {loadingMessages ? (
                  <div className="mx-auto max-w-3xl px-4 md:px-6 py-8 space-y-6">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
                        {i % 2 === 0 ? (
                          <div className="max-w-[70%] space-y-2">
                            <Skeleton className="h-12 w-48 rounded-2xl rounded-tr-sm ml-auto" />
                          </div>
                        ) : (
                          <div className="w-full space-y-2">
                            <Skeleton className="h-4 w-3/4 rounded-md" />
                            <Skeleton className="h-4 w-1/2 rounded-md" />
                            <Skeleton className="h-4 w-2/3 rounded-md" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center">
                    <div className="text-center space-y-3">
                      {activeAgentId ? (() => {
                        const agent = agents.find(a => a.id === activeAgentId);
                        return agent ? (
                          <>
                            <div className="flex justify-center">
                              <div className="h-16 w-16 rounded-full overflow-hidden bg-secondary flex items-center justify-center border-2 border-border">
                                {agent.avatar_url ? <img src={agent.avatar_url} alt={agent.name} className="h-full w-full object-cover" /> : <Bot className="h-8 w-8 text-muted-foreground" />}
                              </div>
                            </div>
                            <h1 className="text-2xl font-semibold text-foreground">{agent.name}</h1>
                            {agent.description && <p className="text-muted-foreground text-sm max-w-xs mx-auto">{agent.description}</p>}
                          </>
                        ) : null;
                      })() : (
                        <>
                          <h1 className="text-3xl font-semibold text-foreground flex items-center justify-center gap-2">
                            <span>Olá{profile?.display_name ? `, ${profile.display_name.split(" ")[0]}` : ""}!</span>
                            <FluentEmoji emoji="👋" size={36} />
                          </h1>
                          <p className="text-muted-foreground text-base">Como posso te ajudar hoje?</p>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="mx-auto max-w-3xl px-4 md:px-6 py-4 min-h-full flex flex-col justify-end">
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
                            documents={m.documents}
                            avatar={m.role === "user" ? profile?.avatar_url : (activeAgentId ? agents.find(a => a.id === activeAgentId)?.avatar_url || null : null)}
                            isStreaming={m.role === "assistant" && isStreaming && i === messages.length - 1}
                            isProcessingDocs={m.role === "assistant" && isProcessingDocs && isStreaming && i === messages.length - 1}
                            onSaveMemory={m.role === "user" ? handleSaveMemory : undefined}
                            onUpdateMemory={m.role === "assistant" ? handleUpdateMemory : undefined}
                            onSuggestMemory={m.role === "assistant" ? handleSaveMemory : undefined}
                            onMoveMemory={m.role === "assistant" ? handleMoveMemory : undefined}
                            onEdit={m.role === "user" && !isStreaming ? (newContent) => handleEditMessage(i, newContent) : undefined}
                            onResend={m.role === "user" && !isStreaming ? () => handleEditMessage(i, m.content) : undefined}
                            onRegenerate={m.role === "assistant" && !isStreaming ? () => handleRegenerate(i) : undefined}
                            currentMemories={memories.map(mem => mem.content)}
                          />
                        </div>
                      );
                    })}
                    <div ref={bottomRef} />
                  </div>
                )}
              </div>
              {showScrollBottom && (
                <div className="relative">
                  <button
                    onClick={() => bottomRef.current?.scrollIntoView({ behavior: "smooth" })}
                    className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 h-9 w-9 rounded-full bg-secondary border border-border shadow-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-200"
                    aria-label="Voltar ao final"
                  >
                    <ChevronDown className="h-5 w-5" />
                  </button>
                </div>
              )}
              <ChatInput onSend={handleSend} disabled={isStreaming} />
            </div>
          ) : tab === "achievements" ? (
            <AchievementsView />
          ) : tab === "neural" ? (
            <div className="flex h-full flex-col overflow-hidden">
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
                    onClick={openMobileMemory}
                    className="flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-medium text-foreground hover:bg-secondary transition-colors"
                  >
                    <Settings className="h-5 w-5 text-accent" />
                    Memórias
                    <span className="ml-auto text-xs text-muted-foreground">{memories.length}</span>
                  </button>
                  <button
                    onClick={openMobileSettings}
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
        <nav className="fixed bottom-0 left-0 right-0 z-30 flex md:hidden skeu-bottombar safe-bottom">
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
            onClick={() => setTab("achievements")}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 transition-colors ${
              tab === "achievements" ? "text-accent" : "text-muted-foreground"
            }`}
          >
            <Trophy className="h-5 w-5" />
            <span className="text-[10px] font-medium">Conquistas</span>
          </button>
          <button
            onClick={() => setTab("neural")}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 transition-colors ${
              tab === "neural" ? "text-accent" : "text-muted-foreground"
            }`}
          >
            <Brain className="h-5 w-5" />
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
      <MemoryDialog open={mobileMemoryOpen} onOpenChange={handleMobileMemoryChange} onMemoriesChanged={refreshMemories} />
      <SettingsDialog open={mobileSettingsOpen} onOpenChange={handleMobileSettingsChange} onNicknameChanged={setNickname} />
      <AgentDialog open={agentDialogOpen} onOpenChange={setAgentDialogOpen} agent={editingAgent} onSaved={refreshAgents} />
    </div>
  );
};

export default Index;
