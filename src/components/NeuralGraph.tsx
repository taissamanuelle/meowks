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
  source: number;
  target: number;
  strength: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  person: "#4f8ff7",
  place: "#38bdf8",
  interest: "#a78bfa",
  emotion: "#f472b6",
  general: "#6ee7b7",
};

function categorizeMemory(content: string): string {
  const lower = content.toLowerCase();
  if (/gost|ador|odeio|amo|prefere|fã|curte|não gosta|parou/.test(lower)) return "interest";
  if (/feliz|triste|ansios|medo|raiva|alegr|saudade/.test(lower)) return "emotion";
  if (/mora|cidade|país|bairro|rua|lugar|viaj/.test(lower)) return "place";
  if (/nome|chamad|apelid|idade|anos|aniversário/.test(lower)) return "person";
  return "general";
}

function findCommonWords(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().replace(/[^\w\sàáâãéèêíïóôõúüç]/g, "").split(/\s+/).filter(w => w.length > 3));
  const wordsB = new Set(b.toLowerCase().replace(/[^\w\sàáâãéèêíïóôõúüç]/g, "").split(/\s+/).filter(w => w.length > 3));
  let common = 0;
  wordsA.forEach(w => { if (wordsB.has(w)) common++; });
  return common;
}

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
      const { data: memories } = await supabase
        .from("memories")
        .select("id, content")
        .eq("user_id", user.id);

      if (!memories || memories.length === 0) {
        setIsEmpty(true);
        return;
      }

      const w = window.innerWidth;
      const h = window.innerHeight;
      const centerX = w / 2;
      const centerY = h / 2;

      // Create nodes from memories
      const nodes: Node[] = memories.map((m, i) => {
        const angle = (i / memories.length) * Math.PI * 2;
        const radius = Math.min(w, h) * 0.32;
        return {
          id: m.id,
          label: m.content,
          category: categorizeMemory(m.content),
          importance: Math.min(3, Math.ceil(m.content.length / 30)),
          x: centerX + Math.cos(angle) * radius + (Math.random() - 0.5) * 60,
          y: centerY + Math.sin(angle) * radius + (Math.random() - 0.5) * 60,
        };
      });

      // Create connections based on common words
      const connections: Connection[] = [];
      for (let i = 0; i < memories.length; i++) {
        for (let j = i + 1; j < memories.length; j++) {
          const common = findCommonWords(memories[i].content, memories[j].content);
          if (common > 0) {
            connections.push({ source: i, target: j, strength: Math.min(1, common * 0.4) });
          }
        }
        // Also connect by category
        for (let j = i + 1; j < nodes.length; j++) {
          if (nodes[i].category === nodes[j].category && !connections.find(c => c.source === i && c.target === j)) {
            connections.push({ source: i, target: j, strength: 0.3 });
          }
        }
      }

      nodesRef.current = nodes;
      connectionsRef.current = connections;
      setIsEmpty(false);
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
      time += 0.008;
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const nodes = nodesRef.current;
      const connections = connectionsRef.current;

      // Force simulation - stronger repulsion to avoid label overlap
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const repulsion = 3000 / (dist * dist);
          nodes[i].x -= dx * repulsion * 0.003;
          nodes[i].y -= dy * repulsion * 0.003;
          nodes[j].x += dx * repulsion * 0.003;
          nodes[j].y += dy * repulsion * 0.003;
        }
        nodes[i].x += (w / 2 - nodes[i].x) * 0.001;
        nodes[i].y += (h / 2 - nodes[i].y) * 0.001;
        nodes[i].x = Math.max(120, Math.min(w - 120, nodes[i].x));
        nodes[i].y = Math.max(60, Math.min(h - 60, nodes[i].y));
      }

      // Spring forces for connections
      connections.forEach((c) => {
        const s = nodes[c.source];
        const t = nodes[c.target];
        if (!s || !t) return;
        const dx = t.x - s.x;
        const dy = t.y - s.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const target = 150;
        if (dist > 0) {
          const force = (dist - target) * 0.002;
          s.x += dx / dist * force;
          s.y += dy / dist * force;
          t.x -= dx / dist * force;
          t.y -= dy / dist * force;
        }
      });

      // Draw connections
      connections.forEach((c) => {
        const source = nodes[c.source];
        const target = nodes[c.target];
        if (!source || !target) return;

        const sColor = CATEGORY_COLORS[source.category] || CATEGORY_COLORS.general;
        const tColor = CATEGORY_COLORS[target.category] || CATEGORY_COLORS.general;

        const gradient = ctx.createLinearGradient(source.x, source.y, target.x, target.y);
        const alpha = Math.floor(30 + Math.sin(time * 2) * 15).toString(16).padStart(2, '0');
        gradient.addColorStop(0, sColor + alpha);
        gradient.addColorStop(1, tColor + alpha);

        ctx.beginPath();
        ctx.strokeStyle = gradient;
        ctx.lineWidth = c.strength * 2.5;
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.stroke();
      });

      // Draw nodes
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

        // Label - word wrap
        ctx.fillStyle = "#e2e8f0";
        ctx.font = "11px Outfit, sans-serif";
        ctx.textAlign = "center";
        const maxWidth = 140;
        const lineHeight = 14;
        const words = node.label.split(" ");
        const lines: string[] = [];
        let currentLine = words[0] || "";
        for (let wi = 1; wi < words.length; wi++) {
          const test = currentLine + " " + words[wi];
          if (ctx.measureText(test).width > maxWidth) {
            lines.push(currentLine);
            currentLine = words[wi];
          } else {
            currentLine = test;
          }
        }
        lines.push(currentLine);
        
        // Background for readability
        const labelY = node.y + radius + 14;
        const bgPadding = 4;
        const bgHeight = lines.length * lineHeight + bgPadding * 2;
        const bgWidth = Math.min(maxWidth + bgPadding * 2, lines.reduce((max, l) => Math.max(max, ctx.measureText(l).width), 0) + bgPadding * 2);
        ctx.fillStyle = "rgba(15, 15, 20, 0.75)";
        ctx.beginPath();
        ctx.roundRect(node.x - bgWidth / 2, labelY - bgPadding - 2, bgWidth, bgHeight, 4);
        ctx.fill();
        
        ctx.fillStyle = "#e2e8f0";
        lines.forEach((line, li) => {
          ctx.fillText(line, node.x, labelY + li * lineHeight + 10);
        });
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
          <p className="text-sm text-muted-foreground/60 mt-1">Salve memórias para começar a construí-la!</p>
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
