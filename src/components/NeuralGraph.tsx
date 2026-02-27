import { useEffect, useRef, useState } from "react";
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
  id: string;
  source_node_id: string;
  target_node_id: string;
  strength: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  person: "#4f8ff7",
  place: "#38bdf8",
  interest: "#a78bfa",
  event: "#f472b6",
  general: "#6ee7b7",
};

export function NeuralGraph() {
  const { user } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const animRef = useRef<number>(0);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const [{ data: nodesData }, { data: connsData }] = await Promise.all([
        supabase.from("neural_nodes").select("*").eq("user_id", user.id),
        supabase.from("neural_connections").select("*").eq("user_id", user.id),
      ]);

      if (nodesData) {
        const w = window.innerWidth;
        const h = window.innerHeight;
        setNodes(
          nodesData.map((n) => ({
            ...n,
            x: n.x ?? Math.random() * w * 0.6 + w * 0.2,
            y: n.y ?? Math.random() * h * 0.6 + h * 0.2,
            vx: 0,
            vy: 0,
            importance: n.importance ?? 1,
          }))
        );
      }
      if (connsData) setConnections(connsData);
    };
    fetchData();
  }, [user]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener("resize", resize);

    const handleMouse = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    canvas.addEventListener("mousemove", handleMouse);

    const draw = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);

      // Draw connections
      connections.forEach((c) => {
        const source = nodes.find((n) => n.id === c.source_node_id);
        const target = nodes.find((n) => n.id === c.target_node_id);
        if (!source || !target) return;

        const gradient = ctx.createLinearGradient(source.x, source.y, target.x, target.y);
        const sColor = CATEGORY_COLORS[source.category] || CATEGORY_COLORS.general;
        const tColor = CATEGORY_COLORS[target.category] || CATEGORY_COLORS.general;
        gradient.addColorStop(0, sColor + "60");
        gradient.addColorStop(1, tColor + "60");

        ctx.beginPath();
        ctx.strokeStyle = gradient;
        ctx.lineWidth = c.strength * 2;
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.stroke();
      });

      // Draw nodes
      nodes.forEach((node) => {
        const color = CATEGORY_COLORS[node.category] || CATEGORY_COLORS.general;
        const radius = 6 + node.importance * 3;

        // Glow
        ctx.beginPath();
        const glow = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, radius * 3);
        glow.addColorStop(0, color + "40");
        glow.addColorStop(1, color + "00");
        ctx.fillStyle = glow;
        ctx.arc(node.x, node.y, radius * 3, 0, Math.PI * 2);
        ctx.fill();

        // Node circle
        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fill();

        // Label
        ctx.fillStyle = "#e2e8f0";
        ctx.font = "11px Outfit, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(node.label, node.x, node.y + radius + 14);
      });

      // Simple force simulation
      if (nodes.length > 1) {
        setNodes((prev) => {
          const next = prev.map((n) => ({ ...n }));
          for (let i = 0; i < next.length; i++) {
            for (let j = i + 1; j < next.length; j++) {
              const dx = next[j].x - next[i].x;
              const dy = next[j].y - next[i].y;
              const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
              const force = 200 / (dist * dist);
              next[i].x -= dx * force * 0.01;
              next[i].y -= dy * force * 0.01;
              next[j].x += dx * force * 0.01;
              next[j].y += dy * force * 0.01;
            }
            // Keep in bounds
            next[i].x = Math.max(40, Math.min(w - 40, next[i].x));
            next[i].y = Math.max(40, Math.min(h - 40, next[i].y));
          }

          // Attract connected nodes
          connections.forEach((c) => {
            const si = next.findIndex((n) => n.id === c.source_node_id);
            const ti = next.findIndex((n) => n.id === c.target_node_id);
            if (si === -1 || ti === -1) return;
            const dx = next[ti].x - next[si].x;
            const dy = next[ti].y - next[si].y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 150) {
              next[si].x += dx * 0.002;
              next[si].y += dy * 0.002;
              next[ti].x -= dx * 0.002;
              next[ti].y -= dy * 0.002;
            }
          });

          return next;
        });
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", handleMouse);
    };
  }, [nodes.length, connections.length]);

  if (nodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Sua rede neural está vazia.</p>
          <p className="text-sm text-muted-foreground/60 mt-1">Converse com a Meowks para começar a construí-la!</p>
        </div>
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className="h-full w-full"
      style={{ background: "transparent" }}
    />
  );
}
