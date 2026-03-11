import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ChevronDown, Filter } from "lucide-react";

interface Node {
  id: string;
  label: string;
  category: string;
  importance: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface Connection {
  source: string;
  target: string;
  strength: number;
}

const CATEGORIES: Record<string, { label: string; color: string }> = {
  pessoal: { label: "Pessoal", color: "#c678dd" },
  trabalho: { label: "Trabalho", color: "#61afef" },
  hobby: { label: "Hobby", color: "#e5c07b" },
  saúde: { label: "Saúde", color: "#98c379" },
  geral: { label: "Geral", color: "#abb2bf" },
};

function categorize(content: string): string {
  const lower = content.toLowerCase();
  if (/trabalho|emprego|empresa|projeto|reunião|deadline|cliente|carreira|profiss|estágio/i.test(lower)) return "trabalho";
  if (/saúde|médico|remédio|exercício|academia|dieta|doença|sintoma|consulta/i.test(lower)) return "saúde";
  if (/hobby|jogo|game|música|filme|série|livro|viagem|receita|cozinha|esport/i.test(lower)) return "hobby";
  if (/família|amigo|namorad|casamento|aniversário|pessoal|sentimento|emoção|gosta|prefere|favor|mãe|pai|irmã/i.test(lower)) return "pessoal";
  return "geral";
}

function truncateLabel(text: string, max = 25): string {
  const firstLine = text.split(/[.\n]/)[0].trim();
  const short = firstLine.length > max ? firstLine.slice(0, max - 1) + "…" : firstLine;
  return short;
}

export function NeuralGraph() {
  const { user } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const allNodesRef = useRef<Node[]>([]);
  const connectionsRef = useRef<Connection[]>([]);
  const allConnectionsRef = useRef<Connection[]>([]);
  const animRef = useRef<number>(0);
  const tickRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [activeCategories, setActiveCategories] = useState<Set<string>>(new Set(Object.keys(CATEGORIES)));
  const dragRef = useRef<{ nodeId: string | null; offsetX: number; offsetY: number }>({ nodeId: null, offsetX: 0, offsetY: 0 });
  const panRef = useRef({ x: 0, y: 0, dragging: false, startX: 0, startY: 0 });
  const scaleRef = useRef(1);
  const hoveredNodeRef = useRef<string | null>(null);

  const toggleCategory = (cat: string) => {
    setActiveCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  // Filter nodes/connections when activeCategories change
  useEffect(() => {
    const filtered = allNodesRef.current.filter(n => activeCategories.has(n.category));
    const filteredIds = new Set(filtered.map(n => n.id));
    nodesRef.current = filtered;
    connectionsRef.current = allConnectionsRef.current.filter(c => filteredIds.has(c.source) && filteredIds.has(c.target));
    tickRef.current = 0; // restart simulation
  }, [activeCategories]);

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
    const w = containerRef.current?.clientWidth || 600;
    const h = containerRef.current?.clientHeight || 500;

    const nodes: Node[] = memories.map((m, i) => {
      const cat = m.category || categorize(m.content);
      const angle = (i / memories.length) * Math.PI * 2;
      const radius = 100 + Math.random() * 80;
      return {
        id: m.id,
        label: truncateLabel(m.content),
        category: cat,
        importance: m.source === "ai" ? 2 : 1,
        x: w / 2 + Math.cos(angle) * radius,
        y: h / 2 + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
      };
    });

    // Connections: same category neighbors
    const connections: Connection[] = [];
    const byCategory = new Map<string, Node[]>();
    for (const n of nodes) {
      const list = byCategory.get(n.category) || [];
      list.push(n);
      byCategory.set(n.category, list);
    }
    for (const [, group] of byCategory) {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < Math.min(i + 3, group.length); j++) {
          connections.push({ source: group[i].id, target: group[j].id, strength: 0.5 });
        }
      }
    }

    // Cross-category keyword overlap
    for (let i = 0; i < nodes.length && i < 80; i++) {
      const wordsA = new Set(memories[i].content.toLowerCase().split(/\s+/).filter(w => w.length > 4));
      for (let j = i + 1; j < nodes.length && j < 80; j++) {
        if (nodes[i].category === nodes[j].category) continue;
        const wordsB = memories[j].content.toLowerCase().split(/\s+/).filter(w => w.length > 4);
        const overlap = wordsB.filter(w => wordsA.has(w)).length;
        if (overlap >= 2) {
          connections.push({ source: nodes[i].id, target: nodes[j].id, strength: 0.25 });
        }
      }
    }

    allNodesRef.current = nodes;
    allConnectionsRef.current = connections;
    nodesRef.current = [...nodes];
    connectionsRef.current = [...connections];
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Render loop
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

    const simulate = () => {
      const nodes = nodesRef.current;
      const conns = connectionsRef.current;
      const w = containerRef.current?.clientWidth || 600;
      const h = containerRef.current?.clientHeight || 500;
      const cx = w / 2;
      const cy = h / 2;

      // Physics (only first ~350 ticks after reset)
      if (tickRef.current < 350) {
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            let dx = nodes[j].x - nodes[i].x;
            let dy = nodes[j].y - nodes[i].y;
            let dist = Math.sqrt(dx * dx + dy * dy) || 1;
            let force = 1500 / (dist * dist);
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
          let force = (dist - 120) * 0.012 * c.strength;
          s.vx += (dx / dist) * force;
          s.vy += (dy / dist) * force;
          t.vx -= (dx / dist) * force;
          t.vy -= (dy / dist) * force;
        }

        for (const n of nodes) {
          n.vx += (cx - n.x) * 0.001;
          n.vy += (cy - n.y) * 0.001;
          n.vx *= 0.9;
          n.vy *= 0.9;
          if (dragRef.current.nodeId !== n.id) {
            n.x += n.vx;
            n.y += n.vy;
          }
        }
        tickRef.current++;
      }

      // === DRAW (Obsidian-style) ===
      // Dark background with subtle grid dots
      ctx.fillStyle = "#1a1b1e";
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.translate(panRef.current.x, panRef.current.y);
      ctx.scale(scaleRef.current, scaleRef.current);

      // Subtle dot grid
      const gridSize = 40;
      const startX = -panRef.current.x / scaleRef.current;
      const startY = -panRef.current.y / scaleRef.current;
      const endX = startX + w / scaleRef.current;
      const endY = startY + h / scaleRef.current;
      ctx.fillStyle = "rgba(255,255,255,0.03)";
      for (let gx = Math.floor(startX / gridSize) * gridSize; gx < endX; gx += gridSize) {
        for (let gy = Math.floor(startY / gridSize) * gridSize; gy < endY; gy += gridSize) {
          ctx.beginPath();
          ctx.arc(gx, gy, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const hovered = hoveredNodeRef.current;
      const nodeMap = new Map(nodes.map(n => [n.id, n]));

      // Find hovered node's connected nodes
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
          const sColor = CATEGORIES[s.category]?.color || "#abb2bf";
          ctx.strokeStyle = sColor + "80";
          ctx.lineWidth = 1.5;
        } else if (isDimmed) {
          ctx.strokeStyle = "rgba(255,255,255,0.02)";
          ctx.lineWidth = 0.5;
        } else {
          ctx.strokeStyle = "rgba(255,255,255,0.06)";
          ctx.lineWidth = 0.8;
        }
        ctx.stroke();
      }

      // Draw nodes
      for (const n of nodes) {
        const r = 4 + n.importance * 2;
        const color = CATEGORIES[n.category]?.color || "#abb2bf";
        const isHovered = n.id === hovered;
        const isConnected = connectedToHovered.has(n.id);
        const isDimmed = hovered && !isConnected;

        // Glow for hovered/connected
        if (isHovered || isConnected) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, r + (isHovered ? 12 : 6), 0, Math.PI * 2);
          const glow = ctx.createRadialGradient(n.x, n.y, r * 0.5, n.x, n.y, r + (isHovered ? 14 : 8));
          glow.addColorStop(0, color + (isHovered ? "50" : "25"));
          glow.addColorStop(1, "transparent");
          ctx.fillStyle = glow;
          ctx.fill();
        }

        // Node circle
        ctx.beginPath();
        ctx.arc(n.x, n.y, isHovered ? r + 2 : r, 0, Math.PI * 2);
        ctx.fillStyle = isDimmed ? color + "30" : color + (isHovered ? "ff" : "cc");
        ctx.fill();

        // Label
        if (!isDimmed || isConnected) {
          const fontSize = isHovered ? 11 : 9;
          ctx.font = `${fontSize}px 'Outfit', sans-serif`;
          ctx.textAlign = "center";
          ctx.fillStyle = isDimmed ? "rgba(255,255,255,0.15)" : isHovered ? "#e0e0e0" : "rgba(255,255,255,0.45)";
          ctx.fillText(n.label, n.x, n.y + r + 12);
        }
      }

      ctx.restore();
      animRef.current = requestAnimationFrame(simulate);
    };

    animRef.current = requestAnimationFrame(simulate);
    return () => {
      cancelAnimationFrame(animRef.current);
      ro.disconnect();
    };
  }, [loading, empty]);

  // Pointer interactions
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
        const r = 4 + n.importance * 2 + 12;
        if (Math.hypot(n.x - px, n.y - py) < r) return n;
      }
      return null;
    };

    const onDown = (e: PointerEvent) => {
      const pos = getPos(e);
      const node = findNode(pos.x, pos.y);
      if (node) {
        dragRef.current = { nodeId: node.id, offsetX: pos.x - node.x, offsetY: pos.y - node.y };
        canvas.setPointerCapture(e.pointerId);
      } else {
        panRef.current.dragging = true;
        panRef.current.startX = e.clientX - panRef.current.x;
        panRef.current.startY = e.clientY - panRef.current.y;
        canvas.setPointerCapture(e.pointerId);
      }
    };

    const onMove = (e: PointerEvent) => {
      if (dragRef.current.nodeId) {
        const pos = getPos(e);
        const node = nodesRef.current.find(n => n.id === dragRef.current.nodeId);
        if (node) {
          node.x = pos.x - dragRef.current.offsetX;
          node.y = pos.y - dragRef.current.offsetY;
          node.vx = 0;
          node.vy = 0;
        }
      } else if (panRef.current.dragging) {
        panRef.current.x = e.clientX - panRef.current.startX;
        panRef.current.y = e.clientY - panRef.current.startY;
      } else {
        // Hover detection
        const pos = getPos(e);
        const node = findNode(pos.x, pos.y);
        hoveredNodeRef.current = node?.id || null;
        canvas.style.cursor = node ? "grab" : "default";
      }
    };

    const onUp = () => {
      dragRef.current.nodeId = null;
      panRef.current.dragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const delta = e.deltaY > 0 ? 0.92 : 1.08;
      const newScale = Math.max(0.2, Math.min(4, scaleRef.current * delta));
      
      // Zoom toward mouse position
      panRef.current.x = mouseX - (mouseX - panRef.current.x) * (newScale / scaleRef.current);
      panRef.current.y = mouseY - (mouseY - panRef.current.y) * (newScale / scaleRef.current);
      scaleRef.current = newScale;
    };

    const onLeave = () => {
      hoveredNodeRef.current = null;
    };

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#1a1b1e]">
        <div className="text-sm text-muted-foreground animate-pulse">Carregando rede neural...</div>
      </div>
    );
  }

  if (empty) {
    return (
      <div className="flex items-center justify-center h-full bg-[#1a1b1e]">
        <p className="text-sm text-muted-foreground text-center px-4">
          Nenhuma memória encontrada. Crie memórias nas conversas para visualizar a rede neural.
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full relative touch-none" style={{ background: "#1a1b1e" }}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      
      {/* Filter dropdown */}
      <div className="absolute top-3 right-3 z-10">
        <button
          onClick={() => setFilterOpen(p => !p)}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
          style={{
            background: "rgba(30, 31, 35, 0.85)",
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
            className="absolute right-0 mt-1.5 rounded-lg p-2 space-y-0.5 min-w-[160px]"
            style={{
              background: "rgba(30, 31, 35, 0.95)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
            }}
          >
            {Object.entries(CATEGORIES).map(([key, { label, color }]) => (
              <button
                key={key}
                onClick={() => toggleCategory(key)}
                className="flex items-center gap-2 w-full rounded-md px-2.5 py-1.5 text-xs transition-colors hover:bg-white/5"
                style={{ color: activeCategories.has(key) ? color : "rgba(255,255,255,0.25)" }}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 transition-opacity"
                  style={{
                    background: color,
                    opacity: activeCategories.has(key) ? 1 : 0.2,
                  }}
                />
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Node count */}
      <div
        className="absolute bottom-3 left-3 rounded-md px-2 py-1 text-[10px]"
        style={{
          background: "rgba(30, 31, 35, 0.8)",
          color: "rgba(255,255,255,0.4)",
          border: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        {nodesRef.current.length} nós · {connectionsRef.current.length} conexões
      </div>
    </div>
  );
}
