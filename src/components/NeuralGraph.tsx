import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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

const CATEGORY_COLORS: Record<string, string> = {
  personal: "hsl(340, 70%, 55%)",
  work: "hsl(210, 70%, 55%)",
  hobby: "hsl(45, 80%, 55%)",
  health: "hsl(120, 60%, 45%)",
  general: "hsl(var(--primary))",
};

function getColor(category: string) {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS.general;
}

export function NeuralGraph() {
  const { user } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const connectionsRef = useRef<Connection[]>([]);
  const animRef = useRef<number>(0);
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);
  const dragRef = useRef<{ nodeId: string | null; offsetX: number; offsetY: number }>({ nodeId: null, offsetX: 0, offsetY: 0 });
  const panRef = useRef({ x: 0, y: 0, dragging: false, startX: 0, startY: 0 });
  const scaleRef = useRef(1);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: nodes }, { data: connections }] = await Promise.all([
      supabase.from("neural_nodes").select("*").eq("user_id", user.id),
      supabase.from("neural_connections").select("*").eq("user_id", user.id),
    ]);

    if (!nodes || nodes.length === 0) {
      setEmpty(true);
      setLoading(false);
      return;
    }

    setEmpty(false);
    const w = containerRef.current?.clientWidth || 600;
    const h = containerRef.current?.clientHeight || 400;

    nodesRef.current = nodes.map((n, i) => ({
      id: n.id,
      label: n.label,
      category: n.category,
      importance: n.importance,
      x: n.x ?? w / 2 + Math.cos((i / nodes.length) * Math.PI * 2) * 120 + (Math.random() - 0.5) * 40,
      y: n.y ?? h / 2 + Math.sin((i / nodes.length) * Math.PI * 2) * 120 + (Math.random() - 0.5) * 40,
      vx: 0,
      vy: 0,
    }));

    connectionsRef.current = (connections || []).map((c) => ({
      source: c.source_node_id,
      target: c.target_node_id,
      strength: c.strength,
    }));

    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Force-directed simulation + render
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

    let tick = 0;
    const simulate = () => {
      const nodes = nodesRef.current;
      const conns = connectionsRef.current;
      const w = (containerRef.current?.clientWidth || 600);
      const h = (containerRef.current?.clientHeight || 400);
      const cx = w / 2;
      const cy = h / 2;

      // Only run physics for first ~300 ticks
      if (tick < 300) {
        // Repulsion
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            let dx = nodes[j].x - nodes[i].x;
            let dy = nodes[j].y - nodes[i].y;
            let dist = Math.sqrt(dx * dx + dy * dy) || 1;
            let force = 800 / (dist * dist);
            nodes[i].vx -= (dx / dist) * force;
            nodes[i].vy -= (dy / dist) * force;
            nodes[j].vx += (dx / dist) * force;
            nodes[j].vy += (dy / dist) * force;
          }
        }

        // Attraction (connections)
        const nodeMap = new Map(nodes.map((n) => [n.id, n]));
        for (const c of conns) {
          const s = nodeMap.get(c.source);
          const t = nodeMap.get(c.target);
          if (!s || !t) continue;
          let dx = t.x - s.x;
          let dy = t.y - s.y;
          let dist = Math.sqrt(dx * dx + dy * dy) || 1;
          let force = (dist - 80) * 0.02 * c.strength;
          s.vx += (dx / dist) * force;
          s.vy += (dy / dist) * force;
          t.vx -= (dx / dist) * force;
          t.vy -= (dy / dist) * force;
        }

        // Center gravity
        for (const n of nodes) {
          n.vx += (cx - n.x) * 0.003;
          n.vy += (cy - n.y) * 0.003;
          n.vx *= 0.85;
          n.vy *= 0.85;
          if (dragRef.current.nodeId !== n.id) {
            n.x += n.vx;
            n.y += n.vy;
          }
        }
        tick++;
      }

      // Draw
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.translate(panRef.current.x, panRef.current.y);
      ctx.scale(scaleRef.current, scaleRef.current);

      // Connections
      const nodeMap = new Map(nodes.map((n) => [n.id, n]));
      for (const c of conns) {
        const s = nodeMap.get(c.source);
        const t = nodeMap.get(c.target);
        if (!s || !t) continue;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(t.x, t.y);
        ctx.strokeStyle = `hsla(var(--primary) / ${0.15 + c.strength * 0.25})`;
        ctx.lineWidth = 0.5 + c.strength * 1.5;
        ctx.stroke();
      }

      // Nodes
      for (const n of nodes) {
        const r = 6 + n.importance * 3;
        const color = getColor(n.category);

        // Glow
        ctx.beginPath();
        ctx.arc(n.x, n.y, r + 4, 0, Math.PI * 2);
        const glow = ctx.createRadialGradient(n.x, n.y, r * 0.5, n.x, n.y, r + 6);
        glow.addColorStop(0, color.replace(")", " / 0.4)").replace("hsl(", "hsla("));
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.fill();

        // Circle
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.15)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Label
        ctx.fillStyle = "hsl(0 0% 80%)";
        ctx.font = `${10 + n.importance}px 'Outfit', sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(n.label, n.x, n.y + r + 14);
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

    const getPos = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const s = scaleRef.current;
      return {
        x: (e.clientX - rect.left - panRef.current.x) / s,
        y: (e.clientY - rect.top - panRef.current.y) / s,
      };
    };

    const findNode = (px: number, py: number) => {
      for (const n of nodesRef.current) {
        const r = 6 + n.importance * 3 + 8;
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
        const node = nodesRef.current.find((n) => n.id === dragRef.current.nodeId);
        if (node) {
          node.x = pos.x - dragRef.current.offsetX;
          node.y = pos.y - dragRef.current.offsetY;
          node.vx = 0;
          node.vy = 0;
        }
      } else if (panRef.current.dragging) {
        panRef.current.x = e.clientX - panRef.current.startX;
        panRef.current.y = e.clientY - panRef.current.startY;
      }
    };

    const onUp = () => {
      dragRef.current.nodeId = null;
      panRef.current.dragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      scaleRef.current = Math.max(0.3, Math.min(3, scaleRef.current * delta));
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [loading, empty]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-sm text-muted-foreground animate-pulse">Carregando rede neural...</div>
      </div>
    );
  }

  if (empty) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-muted-foreground text-center px-4">
          A rede neural será formada conforme suas memórias forem criadas durante as conversas.
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full min-h-[250px] relative touch-none">
      <canvas ref={canvasRef} className="absolute inset-0" />
      {/* Legend */}
      <div className="absolute bottom-2 left-2 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
        {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
          <span key={cat} className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: color }} />
            {cat === "personal" ? "Pessoal" : cat === "work" ? "Trabalho" : cat === "hobby" ? "Hobby" : cat === "health" ? "Saúde" : "Geral"}
          </span>
        ))}
      </div>
    </div>
  );
}
