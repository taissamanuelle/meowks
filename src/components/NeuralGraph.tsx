import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ChevronDown, Filter, X, Tag } from "lucide-react";

interface MemoryData {
  id: string;
  content: string;
  category: string | null;
  source: string;
}

interface Node {
  id: string;
  label: string;
  fullContent: string;
  category: string;
  importance: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  isCategoryHub: boolean;
}

interface Connection {
  source: string;
  target: string;
  strength: number;
}

const CATEGORIES: Record<string, { label: string; color: string; emoji: string }> = {
  trabalho:     { label: "Trabalho",       color: "#61afef", emoji: "💼" },
  estudo:       { label: "Estudo",         color: "#56b6c2", emoji: "📚" },
  saúde:        { label: "Saúde",          color: "#98c379", emoji: "🏥" },
  fitness:      { label: "Fitness",        color: "#7ec87e", emoji: "💪" },
  família:      { label: "Família",        color: "#e06c75", emoji: "👨‍👩‍👧‍👦" },
  relacionamento: { label: "Relacionamento", color: "#ff6b9d", emoji: "❤️" },
  amizade:      { label: "Amizade",        color: "#f0a0c0", emoji: "🤝" },
  finanças:     { label: "Finanças",       color: "#e5c07b", emoji: "💰" },
  tecnologia:   { label: "Tecnologia",     color: "#c678dd", emoji: "💻" },
  entretenimento: { label: "Entretenimento", color: "#d19a66", emoji: "🎮" },
  música:       { label: "Música",         color: "#e88f4f", emoji: "🎵" },
  viagem:       { label: "Viagem",         color: "#4fc1e8", emoji: "✈️" },
  alimentação:  { label: "Alimentação",    color: "#a3d977", emoji: "🍽️" },
  meta:         { label: "Metas",          color: "#f7c948", emoji: "🎯" },
  rotina:       { label: "Rotina",         color: "#a0a4ab", emoji: "🔄" },
  emocional:    { label: "Emocional",      color: "#da77f2", emoji: "🧠" },
  pessoal:      { label: "Pessoal",        color: "#b497d6", emoji: "🙋" },
  geral:        { label: "Geral",          color: "#abb2bf", emoji: "📌" },
};

function categorize(content: string): string {
  const l = content.toLowerCase();
  if (/\b(trabalho|emprego|empresa|projeto|reunião|deadline|cliente|carreira|profiss|estágio|chefe|salário)\b/i.test(l)) return "trabalho";
  if (/\b(estud|faculdade|universidade|prova|aula|curso|matéria|tcc|vestibular|escola)\b/i.test(l)) return "estudo";
  if (/\b(médico|remédio|consulta|exame|doença|sintoma|hospital|tratamento|diagnóstico)\b/i.test(l)) return "saúde";
  if (/\b(academia|exercício|treino|musculação|corrida|esporte|dieta|emagrec|peso)\b/i.test(l)) return "fitness";
  if (/\b(família|mãe|pai|irmã|irmão|avó|avô|filho|filha|parente)\b/i.test(l)) return "família";
  if (/\b(namorad|casamento|relacionamento|esposa|marido|parceiro|cônjuge|casal)\b/i.test(l)) return "relacionamento";
  if (/\b(amigo|amizade|colega|galera|turma|rolê|sair com)\b/i.test(l)) return "amizade";
  if (/\b(dinheiro|finança|investimento|economia|conta|banco|poupança|gasto|orçamento|salário)\b/i.test(l)) return "finanças";
  if (/\b(tecnologia|programação|código|software|app|computador|celular|dev|ia|inteligência artificial)\b/i.test(l)) return "tecnologia";
  if (/\b(jogo|game|filme|série|netflix|anime|assistir|cinema)\b/i.test(l)) return "entretenimento";
  if (/\b(música|canção|playlist|banda|cantar|instrumento|violão|guitarra|piano)\b/i.test(l)) return "música";
  if (/\b(viagem|viajar|destino|passagem|hotel|turismo|férias|aeroporto)\b/i.test(l)) return "viagem";
  if (/\b(comida|cozinha|receita|restaurante|almoço|jantar|café|comer|culinária)\b/i.test(l)) return "alimentação";
  if (/\b(meta|objetivo|plano|planejamento|futuro|sonho|conquista)\b/i.test(l)) return "meta";
  if (/\b(rotina|hábito|manhã|noite|diário|agenda|organiz)\b/i.test(l)) return "rotina";
  if (/\b(sentimento|emoção|ansiedade|estresse|feliz|triste|medo|raiva|chorar|terapia|psicólog)\b/i.test(l)) return "emocional";
  if (/\b(gosta|prefere|favor|pessoal|preferência|opinião)\b/i.test(l)) return "pessoal";
  return "geral";
}

function truncateLabel(text: string, max = 20): string {
  const firstLine = text.split(/[.\n]/)[0].trim();
  return firstLine.length > max ? firstLine.slice(0, max - 1) + "…" : firstLine;
}

function wrapText(text: string, maxChars = 28, maxLines = 2): string[] {
  const clean = text.replace(/\n/g, " ").trim();
  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (lines.length >= maxLines) break;
    if (current.length + word.length + 1 > maxChars) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = current ? current + " " + word : word;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === maxLines && words.length > 0) {
    const last = lines[maxLines - 1];
    if (clean.length > lines.join(" ").length) {
      lines[maxLines - 1] = last.length > maxChars - 1 ? last.slice(0, maxChars - 1) + "…" : last + "…";
    }
  }
  return lines;
}

export function NeuralGraph() {
  const { user } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const allNodesRef = useRef<Node[]>([]);
  const connectionsRef = useRef<Connection[]>([]);
  const allConnectionsRef = useRef<Connection[]>([]);
  const memoriesRef = useRef<MemoryData[]>([]);
  const animRef = useRef<number>(0);
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [activeCategories, setActiveCategories] = useState<Set<string>>(new Set(Object.keys(CATEGORIES)));
  const panRef = useRef({ x: 0, y: 0, dragging: false, startX: 0, startY: 0 });
  const scaleRef = useRef(1);
  const hoveredNodeRef = useRef<string | null>(null);
  const [selectedMemory, setSelectedMemory] = useState<{ id: string; content: string; category: string } | null>(null);
  const [changingCategory, setChangingCategory] = useState(false);
  const lastClickRef = useRef<{ id: string; time: number } | null>(null);
  const simulationDoneRef = useRef(false);

  const toggleCategory = (cat: string) => {
    setActiveCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  useEffect(() => {
    const filtered = allNodesRef.current.filter(n => activeCategories.has(n.category));
    const filteredIds = new Set(filtered.map(n => n.id));
    nodesRef.current = filtered;
    connectionsRef.current = allConnectionsRef.current.filter(c => filteredIds.has(c.source) && filteredIds.has(c.target));
  }, [activeCategories]);

  const buildGraph = useCallback((memories: MemoryData[]) => {
    const w = containerRef.current?.clientWidth || 600;
    const h = containerRef.current?.clientHeight || 500;
    const cx = w / 2;
    const cy = h / 2;

    // Build category hubs
    const usedCategories = new Set<string>();
    for (const m of memories) {
      usedCategories.add(m.category || categorize(m.content));
    }

    const categoryList = Array.from(usedCategories);
    const hubNodes: Node[] = categoryList.map((cat, i) => {
      const angle = (i / categoryList.length) * Math.PI * 2 - Math.PI / 2;
      const hubRadius = Math.min(w, h) * 0.3;
      return {
        id: `hub-${cat}`,
        label: `${CATEGORIES[cat]?.emoji || "📌"} ${CATEGORIES[cat]?.label || cat}`,
        fullContent: "",
        category: cat,
        importance: 5,
        x: cx + Math.cos(angle) * hubRadius,
        y: cy + Math.sin(angle) * hubRadius,
        vx: 0,
        vy: 0,
        isCategoryHub: true,
      };
    });

    // Build memory nodes spread around their hub
    const byCategory = new Map<string, MemoryData[]>();
    for (const m of memories) {
      const cat = m.category || categorize(m.content);
      const list = byCategory.get(cat) || [];
      list.push({ ...m, category: cat });
      byCategory.set(cat, list);
    }

    const memoryNodes: Node[] = [];
    for (const [cat, mems] of byCategory) {
      const hub = hubNodes.find(h => h.id === `hub-${cat}`);
      if (!hub) continue;
      mems.forEach((m, i) => {
        const angle = (i / mems.length) * Math.PI * 2 + Math.random() * 0.3;
        const spread = 60 + Math.random() * 80;
        memoryNodes.push({
          id: m.id,
          label: truncateLabel(m.content),
          fullContent: m.content,
          category: cat,
          importance: m.source === "ai" ? 2 : 1,
          x: hub.x + Math.cos(angle) * spread,
          y: hub.y + Math.sin(angle) * spread,
          vx: 0,
          vy: 0,
          isCategoryHub: false,
        });
      });
    }

    const allNodes = [...hubNodes, ...memoryNodes];

    // Connections: each memory connects to its hub
    const connections: Connection[] = [];
    for (const n of memoryNodes) {
      connections.push({ source: `hub-${n.category}`, target: n.id, strength: 0.6 });
    }

    // Cross-category keyword connections (limited)
    for (let i = 0; i < memoryNodes.length && i < 60; i++) {
      const wordsA = new Set(
        memoriesRef.current.find(m => m.id === memoryNodes[i].id)?.content.toLowerCase().split(/\s+/).filter(w => w.length > 4) || []
      );
      for (let j = i + 1; j < memoryNodes.length && j < 60; j++) {
        if (memoryNodes[i].category === memoryNodes[j].category) continue;
        const contentB = memoriesRef.current.find(m => m.id === memoryNodes[j].id)?.content || "";
        const wordsB = contentB.toLowerCase().split(/\s+/).filter(w => w.length > 4);
        const overlap = wordsB.filter(w => wordsA.has(w)).length;
        if (overlap >= 2) {
          connections.push({ source: memoryNodes[i].id, target: memoryNodes[j].id, strength: 0.15 });
        }
      }
    }

    allNodesRef.current = allNodes;
    allConnectionsRef.current = connections;
    nodesRef.current = [...allNodes];
    connectionsRef.current = [...connections];
    simulationDoneRef.current = false;
  }, []);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data: memories } = await supabase
      .from("memories")
      .select("id, content, category, source")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (!memories || memories.length === 0) {
      setEmpty(true);
      setLoading(false);
      return;
    }

    setEmpty(false);
    memoriesRef.current = memories;
    buildGraph(memories);
    setLoading(false);
  }, [user, buildGraph]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Run physics simulation once to convergence, then stop
  useEffect(() => {
    if (loading || empty) return;
    const nodes = nodesRef.current;
    const conns = connectionsRef.current;
    const w = containerRef.current?.clientWidth || 600;
    const h = containerRef.current?.clientHeight || 500;
    const cx2 = w / 2;
    const cy2 = h / 2;

    // Pre-simulate to stable positions (no animation jitter)
    for (let tick = 0; tick < 300; tick++) {
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          let dx = nodes[j].x - nodes[i].x;
          let dy = nodes[j].y - nodes[i].y;
          let dist = Math.sqrt(dx * dx + dy * dy) || 1;
          // Larger repulsion for more spacing
          const minDist = (nodes[i].isCategoryHub || nodes[j].isCategoryHub) ? 120 : 60;
          let force = 3000 / (dist * dist);
          if (dist < minDist) force *= 3;
          nodes[i].vx -= (dx / dist) * force;
          nodes[i].vy -= (dy / dist) * force;
          nodes[j].vx += (dx / dist) * force;
          nodes[j].vy += (dy / dist) * force;
        }
      }

      const nodeMap = new Map(nodes.map(n => [n.id, n]));
      for (const c of conns) {
        const s = nodeMap.get(c.source);
        const t = nodeMap.get(c.target);
        if (!s || !t) continue;
        let dx = t.x - s.x;
        let dy = t.y - s.y;
        let dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const idealDist = s.isCategoryHub || t.isCategoryHub ? 140 : 100;
        let force = (dist - idealDist) * 0.008 * c.strength;
        s.vx += (dx / dist) * force;
        s.vy += (dy / dist) * force;
        t.vx -= (dx / dist) * force;
        t.vy -= (dy / dist) * force;
      }

      for (const n of nodes) {
        n.vx += (cx2 - n.x) * 0.0008;
        n.vy += (cy2 - n.y) * 0.0008;
        n.vx *= 0.85;
        n.vy *= 0.85;
        n.x += n.vx;
        n.y += n.vy;
      }
    }

    // Zero out velocities
    for (const n of nodes) { n.vx = 0; n.vy = 0; }
    simulationDoneRef.current = true;
  }, [loading, empty]);

  // Render loop (pure rendering, no physics)
  useEffect(() => {
    if (loading || empty) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const container = containerRef.current;
      if (!container || !canvas) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = container.clientWidth * dpr;
      canvas.height = container.clientHeight * dpr;
      canvas.style.width = `${container.clientWidth}px`;
      canvas.style.height = `${container.clientHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    if (containerRef.current) ro.observe(containerRef.current);

    const draw = () => {
      const nodes = nodesRef.current;
      const conns = connectionsRef.current;
      const w = containerRef.current?.clientWidth || 600;
      const h = containerRef.current?.clientHeight || 500;

      // Dark background
      ctx.fillStyle = "#0d0e12";
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.translate(panRef.current.x, panRef.current.y);
      ctx.scale(scaleRef.current, scaleRef.current);

      // Subtle dot grid
      const gridSize = 50;
      const startX = -panRef.current.x / scaleRef.current;
      const startY = -panRef.current.y / scaleRef.current;
      const endX = startX + w / scaleRef.current;
      const endY = startY + h / scaleRef.current;
      ctx.fillStyle = "rgba(255,255,255,0.025)";
      for (let gx = Math.floor(startX / gridSize) * gridSize; gx < endX; gx += gridSize) {
        for (let gy = Math.floor(startY / gridSize) * gridSize; gy < endY; gy += gridSize) {
          ctx.beginPath();
          ctx.arc(gx, gy, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const hovered = hoveredNodeRef.current;
      const nodeMap = new Map(nodes.map(n => [n.id, n]));

      const connectedToHovered = new Set<string>();
      if (hovered) {
        connectedToHovered.add(hovered);
        for (const c of conns) {
          if (c.source === hovered) connectedToHovered.add(c.target);
          if (c.target === hovered) connectedToHovered.add(c.source);
        }
      }

      // Draw connections
      for (const c of conns) {
        const s = nodeMap.get(c.source);
        const t = nodeMap.get(c.target);
        if (!s || !t) continue;

        const isHighlighted = hovered && (c.source === hovered || c.target === hovered);
        const isDimmed = hovered && !isHighlighted;

        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(t.x, t.y);

        if (isHighlighted) {
          const col = CATEGORIES[s.category]?.color || "#abb2bf";
          ctx.strokeStyle = col + "60";
          ctx.lineWidth = 2;
          ctx.shadowColor = col;
          ctx.shadowBlur = 6;
        } else if (isDimmed) {
          ctx.strokeStyle = "rgba(255,255,255,0.015)";
          ctx.lineWidth = 0.5;
          ctx.shadowBlur = 0;
        } else {
          ctx.strokeStyle = "rgba(255,255,255,0.04)";
          ctx.lineWidth = 0.8;
          ctx.shadowBlur = 0;
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Draw nodes
      for (const n of nodes) {
        const color = CATEGORIES[n.category]?.color || "#abb2bf";
        const isHovered = n.id === hovered;
        const isConnected = connectedToHovered.has(n.id);
        const isDimmed = hovered && !isConnected;

        if (n.isCategoryHub) {
          // Category hub: larger, more prominent, with emoji
          const hubR = 18;

          // Outer neon glow
          const glow = ctx.createRadialGradient(n.x, n.y, hubR * 0.3, n.x, n.y, hubR + 20);
          glow.addColorStop(0, color + (isHovered ? "60" : "30"));
          glow.addColorStop(1, "transparent");
          ctx.beginPath();
          ctx.arc(n.x, n.y, hubR + 20, 0, Math.PI * 2);
          ctx.fillStyle = glow;
          ctx.fill();

          // Hub circle with neon border
          ctx.beginPath();
          ctx.arc(n.x, n.y, hubR, 0, Math.PI * 2);
          ctx.fillStyle = isDimmed ? color + "15" : color + "25";
          ctx.fill();
          ctx.strokeStyle = isDimmed ? color + "30" : color + (isHovered ? "ff" : "bb");
          ctx.lineWidth = 2;
          ctx.shadowColor = color;
          ctx.shadowBlur = isHovered ? 20 : 10;
          ctx.stroke();
          ctx.shadowBlur = 0;

          // Emoji
          const emoji = CATEGORIES[n.category]?.emoji || "📌";
          ctx.font = "14px serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(emoji, n.x, n.y + 1);

          // Label below
          ctx.font = `bold 10px 'Outfit', sans-serif`;
          ctx.textBaseline = "top";
          ctx.fillStyle = isDimmed ? color + "40" : color + (isHovered ? "ff" : "cc");
          ctx.fillText(n.label, n.x, n.y + hubR + 6);
        } else {
          // Memory node: neon style
          const r = 5 + n.importance;
          const isHov = isHovered;

          // Neon outer glow
          if (isHov || isConnected) {
            const glow = ctx.createRadialGradient(n.x, n.y, r * 0.3, n.x, n.y, r + (isHov ? 18 : 10));
            glow.addColorStop(0, color + (isHov ? "50" : "20"));
            glow.addColorStop(1, "transparent");
            ctx.beginPath();
            ctx.arc(n.x, n.y, r + (isHov ? 18 : 10), 0, Math.PI * 2);
            ctx.fillStyle = glow;
            ctx.fill();
          }

          // Core circle with neon
          ctx.beginPath();
          ctx.arc(n.x, n.y, isHov ? r + 2 : r, 0, Math.PI * 2);
          ctx.shadowColor = color;
          ctx.shadowBlur = isDimmed ? 0 : isHov ? 15 : 8;
          ctx.fillStyle = isDimmed ? color + "20" : color + (isHov ? "ff" : "cc");
          ctx.fill();

          // Bright inner dot
          if (!isDimmed) {
            ctx.beginPath();
            ctx.arc(n.x, n.y, isHov ? 3 : 2, 0, Math.PI * 2);
            ctx.fillStyle = "#ffffff" + (isHov ? "cc" : "60");
            ctx.fill();
          }
          ctx.shadowBlur = 0;

          // Label
          if (isHov || (isConnected && !isDimmed)) {
            ctx.font = `${isHov ? 10 : 9}px 'Outfit', sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.fillStyle = isHov ? "#e8e8e8" : "rgba(255,255,255,0.5)";
            ctx.fillText(n.label, n.x, n.y + r + 8);
          }
        }
      }

      ctx.restore();
      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animRef.current);
      ro.disconnect();
    };
  }, [loading, empty]);

  // Pointer interactions (no drag, only pan + hover + double-click)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const getPos = (e: PointerEvent | MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const s = scaleRef.current;
      return {
        x: (e.clientX - rect.left - panRef.current.x) / s,
        y: (e.clientY - rect.top - panRef.current.y) / s,
      };
    };

    const findNode = (px: number, py: number) => {
      for (const n of nodesRef.current) {
        const r = n.isCategoryHub ? 22 : 5 + n.importance + 10;
        if (Math.hypot(n.x - px, n.y - py) < r) return n;
      }
      return null;
    };

    const onDown = (e: PointerEvent) => {
      const pos = getPos(e);
      const node = findNode(pos.x, pos.y);
      if (!node) {
        // Start panning
        panRef.current.dragging = true;
        panRef.current.startX = e.clientX - panRef.current.x;
        panRef.current.startY = e.clientY - panRef.current.y;
        canvas.setPointerCapture(e.pointerId);
      } else {
        // Double-click detection
        const now = Date.now();
        if (lastClickRef.current && lastClickRef.current.id === node.id && now - lastClickRef.current.time < 400) {
          // Double click on a memory node
          if (!node.isCategoryHub) {
            setSelectedMemory({ id: node.id, content: node.fullContent, category: node.category });
          }
          lastClickRef.current = null;
        } else {
          lastClickRef.current = { id: node.id, time: now };
        }
      }
    };

    const onMove = (e: PointerEvent) => {
      if (panRef.current.dragging) {
        panRef.current.x = e.clientX - panRef.current.startX;
        panRef.current.y = e.clientY - panRef.current.startY;
      } else {
        const pos = getPos(e);
        const node = findNode(pos.x, pos.y);
        hoveredNodeRef.current = node?.id || null;
        canvas.style.cursor = node ? (node.isCategoryHub ? "default" : "pointer") : "default";
      }
    };

    const onUp = () => {
      panRef.current.dragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const delta = e.deltaY > 0 ? 0.92 : 1.08;
      const newScale = Math.max(0.2, Math.min(4, scaleRef.current * delta));
      panRef.current.x = mouseX - (mouseX - panRef.current.x) * (newScale / scaleRef.current);
      panRef.current.y = mouseY - (mouseY - panRef.current.y) * (newScale / scaleRef.current);
      scaleRef.current = newScale;
    };

    const onLeave = () => { hoveredNodeRef.current = null; };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [loading, empty]);

  const handleChangeCategory = async (newCat: string) => {
    if (!selectedMemory || !user) return;
    await supabase
      .from("memories")
      .update({ category: newCat })
      .eq("id", selectedMemory.id)
      .eq("user_id", user.id);

    // Update local state
    const mem = memoriesRef.current.find(m => m.id === selectedMemory.id);
    if (mem) mem.category = newCat;
    setSelectedMemory(prev => prev ? { ...prev, category: newCat } : null);
    buildGraph(memoriesRef.current);
    setChangingCategory(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ background: "#0d0e12" }}>
        <div className="text-sm text-muted-foreground animate-pulse">Carregando rede neural...</div>
      </div>
    );
  }

  if (empty) {
    return (
      <div className="flex items-center justify-center h-full" style={{ background: "#0d0e12" }}>
        <p className="text-sm text-muted-foreground text-center px-4">
          Nenhuma memória encontrada. Crie memórias nas conversas para visualizar a rede neural.
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full relative touch-none" style={{ background: "#0d0e12" }}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Filter dropdown */}
      <div className="absolute top-3 right-3 z-10">
        <button
          onClick={() => setFilterOpen(p => !p)}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
          style={{
            background: "rgba(13, 14, 18, 0.9)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.7)",
          }}
        >
          <Filter className="h-3.5 w-3.5" />
          Categorias
          <ChevronDown className={`h-3 w-3 transition-transform ${filterOpen ? "rotate-180" : ""}`} />
        </button>

        {filterOpen && (
          <div
            className="absolute right-0 mt-1.5 rounded-lg p-2 space-y-0.5 max-h-[60vh] overflow-y-auto"
            style={{
              background: "rgba(13, 14, 18, 0.97)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
              minWidth: "180px",
            }}
          >
            {Object.entries(CATEGORIES).map(([key, { label, color, emoji }]) => {
              const hasMemories = allNodesRef.current.some(n => n.category === key && !n.isCategoryHub);
              if (!hasMemories) return null;
              return (
                <button
                  key={key}
                  onClick={() => toggleCategory(key)}
                  className="flex items-center gap-2 w-full rounded-md px-2.5 py-1.5 text-xs transition-colors hover:bg-white/5"
                  style={{ color: activeCategories.has(key) ? color : "rgba(255,255,255,0.25)" }}
                >
                  <span className="text-sm">{emoji}</span>
                  <span
                    className="w-2 h-2 rounded-full shrink-0 transition-opacity"
                    style={{ background: color, opacity: activeCategories.has(key) ? 1 : 0.2 }}
                  />
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Hint */}
      <div
        className="absolute top-3 left-3 rounded-md px-2 py-1 text-[10px]"
        style={{
          background: "rgba(13, 14, 18, 0.8)",
          color: "rgba(255,255,255,0.3)",
          border: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        Toque duas vezes em um nó para ver a memória
      </div>

      {/* Node count */}
      <div
        className="absolute bottom-3 left-3 rounded-md px-2 py-1 text-[10px]"
        style={{
          background: "rgba(13, 14, 18, 0.8)",
          color: "rgba(255,255,255,0.4)",
          border: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        {nodesRef.current.filter(n => !n.isCategoryHub).length} memórias · {connectionsRef.current.length} conexões
      </div>

      {/* Memory detail modal */}
      {selectedMemory && (
        <div className="absolute inset-0 z-20 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div
            className="rounded-xl p-5 w-full max-w-md max-h-[80vh] overflow-y-auto relative"
            style={{
              background: "#16171c",
              border: `1px solid ${CATEGORIES[selectedMemory.category]?.color || "#abb2bf"}40`,
              boxShadow: `0 0 30px ${CATEGORIES[selectedMemory.category]?.color || "#abb2bf"}15`,
            }}
          >
            <button
              onClick={() => { setSelectedMemory(null); setChangingCategory(false); }}
              className="absolute top-3 right-3 rounded-full p-1 hover:bg-white/10 transition-colors"
              style={{ color: "rgba(255,255,255,0.5)" }}
            >
              <X className="h-4 w-4" />
            </button>

            {/* Category badge */}
            <div className="flex items-center gap-2 mb-3">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
                style={{
                  background: (CATEGORIES[selectedMemory.category]?.color || "#abb2bf") + "20",
                  color: CATEGORIES[selectedMemory.category]?.color || "#abb2bf",
                  border: `1px solid ${CATEGORIES[selectedMemory.category]?.color || "#abb2bf"}30`,
                }}
              >
                {CATEGORIES[selectedMemory.category]?.emoji || "📌"} {CATEGORIES[selectedMemory.category]?.label || selectedMemory.category}
              </span>
            </div>

            {/* Content */}
            <p className="text-sm leading-relaxed whitespace-pre-wrap mb-4" style={{ color: "rgba(255,255,255,0.8)" }}>
              {selectedMemory.content}
            </p>

            {/* Change category button */}
            {!changingCategory ? (
              <button
                onClick={() => setChangingCategory(true)}
                className="flex items-center gap-1.5 text-xs rounded-lg px-3 py-1.5 transition-colors hover:bg-white/5"
                style={{ color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                <Tag className="h-3.5 w-3.5" />
                Alterar categoria
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>Escolha a nova categoria:</p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(CATEGORIES).map(([key, { label, color, emoji }]) => (
                    <button
                      key={key}
                      onClick={() => handleChangeCategory(key)}
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] transition-all hover:scale-105"
                      style={{
                        background: key === selectedMemory.category ? color + "30" : "rgba(255,255,255,0.05)",
                        color: key === selectedMemory.category ? color : "rgba(255,255,255,0.5)",
                        border: `1px solid ${key === selectedMemory.category ? color + "50" : "rgba(255,255,255,0.08)"}`,
                      }}
                    >
                      {emoji} {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
