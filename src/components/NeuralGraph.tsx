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
  const nodesRef = useRef<Node[]>([]);
  const connectionsRef = useRef<Connection[]>([]);
  const animRef = useRef<number>(0);
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const [{ data: nodesData }, { data: connsData }] = await Promise.all([
        supabase.from("neural_nodes").select("*").eq("user_id", user.id),
        supabase.from("neural_connections").select("*").eq("user_id", user.id),
      ]);

      if (nodesData && nodesData.length > 0) {
        const w = window.innerWidth;
        const h = window.innerHeight;
        nodesRef.current = nodesData.map((n) => ({
          ...n,
          x: n.x ?? Math.random() * w * 0.6 + w * 0.2,
          y: n.y ?? Math.random() * h * 0.6 + h * 0.2,
          importance: n.importance ?? 1,
        }));
        setIsEmpty(false);
      }
      if (connsData) connectionsRef.current = connsData;
    };
    fetchData();
  }, [user]);

  useEffect(() => {
    if (isEmpty) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let dpr = window.devicePixelRatio || 1;

    const resize = () => {
      dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
    };
    resize();
    window.addEventListener("resize", resize);

    let time = 0;

    const draw = () => {
      time += 0.01;
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const nodes = nodesRef.current;
      const connections = connectionsRef.current;

      // Simple force step
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const repulsion = 300 / (dist * dist);
          nodes[i].x -= dx * repulsion * 0.005;
          nodes[i].y -= dy * repulsion * 0.005;
          nodes[j].x += dx * repulsion * 0.005;
          nodes[j].y += dy * repulsion * 0.005;
        }
        // Center gravity
        nodes[i].x += (w / 2 - nodes[i].x) * 0.001;
        nodes[i].y += (h / 2 - nodes[i].y) * 0.001;
        // Bounds
        nodes[i].x = Math.max(60, Math.min(w - 60, nodes[i].x));
        nodes[i].y = Math.max(60, Math.min(h - 60, nodes[i].y));
      }

      // Spring for connections
      connections.forEach((c) => {
        const s = nodes.find((n) => n.id === c.source_node_id);
        const t = nodes.find((n) => n.id === c.target_node_id);
        if (!s || !t) return;
        const dx = t.x - s.x;
        const dy = t.y - s.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const target = 120;
        if (dist > 0) {
          const force = (dist - target) * 0.003;
          s.x += dx / dist * force;
          s.y += dy / dist * force;
          t.x -= dx / dist * force;
          t.y -= dy / dist * force;
        }
      });

      // Draw connections with animated pulse
      connections.forEach((c) => {
        const source = nodes.find((n) => n.id === c.source_node_id);
        const target = nodes.find((n) => n.id === c.target_node_id);
        if (!source || !target) return;

        const sColor = CATEGORY_COLORS[source.category] || CATEGORY_COLORS.general;
        const tColor = CATEGORY_COLORS[target.category] || CATEGORY_COLORS.general;

        const gradient = ctx.createLinearGradient(source.x, source.y, target.x, target.y);
        const alpha = Math.floor(40 + Math.sin(time * 2) * 15).toString(16).padStart(2, '0');
        gradient.addColorStop(0, sColor + alpha);
        gradient.addColorStop(1, tColor + alpha);

        ctx.beginPath();
        ctx.strokeStyle = gradient;
        ctx.lineWidth = c.strength * 2.5;
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.stroke();
      });

      // Draw nodes with orbiting electrons
      nodes.forEach((node, idx) => {
        const color = CATEGORY_COLORS[node.category] || CATEGORY_COLORS.general;
        const radius = 7 + node.importance * 3;

        // Outer glow
        const glow = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, radius * 4);
        glow.addColorStop(0, color + "30");
        glow.addColorStop(1, color + "00");
        ctx.beginPath();
        ctx.fillStyle = glow;
        ctx.arc(node.x, node.y, radius * 4, 0, Math.PI * 2);
        ctx.fill();

        // Inner glow ring
        ctx.beginPath();
        ctx.strokeStyle = color + "25";
        ctx.lineWidth = 1;
        ctx.arc(node.x, node.y, radius * 2, 0, Math.PI * 2);
        ctx.stroke();

        // Orbiting electron
        const orbitRadius = radius * 2;
        const speed = 1 + idx * 0.3;
        const ex = node.x + Math.cos(time * speed) * orbitRadius;
        const ey = node.y + Math.sin(time * speed) * orbitRadius;
        ctx.beginPath();
        ctx.fillStyle = color + "80";
        ctx.arc(ex, ey, 2, 0, Math.PI * 2);
        ctx.fill();

        // Main node
        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Label
        ctx.fillStyle = "#e2e8f0";
        ctx.font = "12px Outfit, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(node.label, node.x, node.y + radius + 16);
      });

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [isEmpty]);

  if (isEmpty) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent/10">
            <svg className="h-8 w-8 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="3" />
              <ellipse cx="12" cy="12" rx="10" ry="4" />
              <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" />
              <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)" />
            </svg>
          </div>
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
