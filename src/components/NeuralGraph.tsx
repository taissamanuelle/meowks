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
  isCategoryHub?: boolean;
}

interface Connection {
  source: number;
  target: number;
  strength: number;
}

const LIFE_CATEGORIES: { key: string; label: string; color: string; keywords: RegExp }[] = [
  { key: "saude", label: "🩺 Saúde", color: "#34d399", keywords: /saúde|médic|doença|remédio|hospital|exercício|academia|dieta|peso|dormir|sono|ansiedade|depressão|terapia|psicólog|dentista|exame|vacina|alergia|dor |vitamina|treino|corr[ei]/i },
  { key: "autoconhecimento", label: "🧠 Autoconhecimento", color: "#a78bfa", keywords: /personalidade|introvertid|extrovertid|qualidade|defeito|medo|sonho|objetivo|meta|valor|princípio|acredit|reflet|medita|mindful|autoestima|ansios|sentir|emoção|feliz|triste|raiva|calm|paciên|gratidão/i },
  { key: "trabalho", label: "💼 Trabalho", color: "#60a5fa", keywords: /trabalh|emprego|empresa|salário|profissão|carreira|chefe|colega|reunião|projeto|deadline|freela|negócio|cliente|escritório|home office|currículo|entrevista|promoção/i },
  { key: "estudos", label: "📚 Estudos", color: "#fbbf24", keywords: /estud|faculdade|universidade|curso|aula|professor|prova|nota|livro|aprend|ler |leitura|formação|diploma|certificad|concurso|vestibular|enem|pesquis/i },
  { key: "financas", label: "💰 Finanças", color: "#f472b6", keywords: /dinheir|financ|investim|poupança|gast|econom|salári|dívida|cartão|banco|empréstimo|orçamento|criptomoeda|ações|rendiment|pagar|conta|boleto/i },
  { key: "relacionamentos", label: "❤️ Relacionamentos", color: "#fb7185", keywords: /namorad|casad|esposa|marido|noiv|relacion|amor|paixão|término|saudade|famíli|mãe|pai|irmã|irmão|filh|amig|casal|compromiss/i },
  { key: "casa", label: "🏠 Casa", color: "#fb923c", keywords: /casa|apartamento|aluguel|mudan|móve|decoração|limpeza|cozinha|quarto|banheiro|jardim|reform|condomínio|vizinho|mora[rd]|endereço/i },
  { key: "veiculos", label: "🚗 Veículos", color: "#94a3b8", keywords: /carro|moto|veículo|dirig|habilitação|combustível|gasolina|mecânico|oficina|seguro auto|multa|estaciona|uber|táxi|ônibus|metrô|bicicleta/i },
  { key: "lazer", label: "🎮 Lazer", color: "#38bdf8", keywords: /jog[oa]|game|série|filme|música|viajar|viagem|férias|netflix|hobby|dança|cinema|teatro|show|festival|passeio|parque|praia|churrasq|festa|diversão|tocar|instrumento/i },
  { key: "alimentacao", label: "🍽️ Alimentação", color: "#a3e635", keywords: /com[ei]r|comida|aliment|cozinhar|receita|restaurante|café|almoço|jantar|lanche|dieta|vegano|vegetarian|fruta|carne|doce|bolo|pizza/i },
  { key: "tecnologia", label: "💻 Tecnologia", color: "#818cf8", keywords: /computador|celular|app|programa|código|site|internet|software|hardware|tecnolog|inteligência artificial|ia |notebook|tablet|rede social/i },
  { key: "espiritualidade", label: "✨ Espiritualidade", color: "#e879f9", keywords: /deus|fé|igreja|oração|espiritual|religião|bíblia|meditação espiritual|alma|energia|universo|gratidão|propósito/i },
];

const FALLBACK_CATEGORY = { key: "geral", label: "📌 Geral", color: "#6ee7b7" };

function categorizeMemory(content: string): { key: string; label: string; color: string } {
  for (const cat of LIFE_CATEGORIES) {
    if (cat.keywords.test(content)) return cat;
  }
  return FALLBACK_CATEGORY;
}

function findCommonWords(a: string, b: string): number {
  const clean = (s: string) => new Set(s.toLowerCase().replace(/[^\w\sàáâãéèêíïóôõúüç]/g, "").split(/\s+/).filter(w => w.length > 3));
  const wordsA = clean(a);
  const wordsB = clean(b);
  let common = 0;
  wordsA.forEach(w => { if (wordsB.has(w)) common++; });
  return common;
}

export function NeuralGraph() {
  const { user } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const connectionsRef = useRef<Connection[]>([]);
  const categoryColorsRef = useRef<Record<string, string>>({});
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

      // Categorize all memories
      const categorized = memories.map(m => ({ ...m, cat: categorizeMemory(m.content) }));

      // Group by category
      const groups: Record<string, typeof categorized> = {};
      categorized.forEach(m => {
        if (!groups[m.cat.key]) groups[m.cat.key] = [];
        groups[m.cat.key].push(m);
      });

      const categoryKeys = Object.keys(groups);
      const colorMap: Record<string, string> = {};

      // Create category hub nodes first, arranged in a circle
      const allNodes: Node[] = [];
      const hubRadius = Math.min(w, h) * 0.28;
      const hubIndices: Record<string, number> = {};

      categoryKeys.forEach((key, ci) => {
        const cat = groups[key][0].cat;
        const angle = (ci / categoryKeys.length) * Math.PI * 2 - Math.PI / 2;
        colorMap[key] = cat.color;
        hubIndices[key] = allNodes.length;
        allNodes.push({
          id: `hub-${key}`,
          label: cat.label,
          category: key,
          importance: 5,
          x: centerX + Math.cos(angle) * hubRadius,
          y: centerY + Math.sin(angle) * hubRadius,
          isCategoryHub: true,
        });
      });

      // Create memory nodes clustered around their category hub
      const memoryNodeIndices: Record<string, number> = {};
      categoryKeys.forEach(key => {
        const hub = allNodes[hubIndices[key]];
        const mems = groups[key];
        mems.forEach((m, mi) => {
          const angle = (mi / mems.length) * Math.PI * 2;
          const clusterRadius = 40 + mems.length * 12;
          memoryNodeIndices[m.id] = allNodes.length;
          allNodes.push({
            id: m.id,
            label: m.content,
            category: key,
            importance: Math.min(3, Math.ceil(m.content.length / 30)),
            x: hub.x + Math.cos(angle) * clusterRadius + (Math.random() - 0.5) * 20,
            y: hub.y + Math.sin(angle) * clusterRadius + (Math.random() - 0.5) * 20,
          });
        });
      });

      // Create connections: memory → hub
      const connections: Connection[] = [];
      categoryKeys.forEach(key => {
        const hubIdx = hubIndices[key];
        groups[key].forEach(m => {
          connections.push({ source: hubIdx, target: memoryNodeIndices[m.id], strength: 0.6 });
        });
      });

      // Connect memories with common words (cross-category too)
      const memIds = Object.keys(memoryNodeIndices);
      for (let i = 0; i < memIds.length; i++) {
        for (let j = i + 1; j < memIds.length; j++) {
          const mA = memories.find(m => m.id === memIds[i]);
          const mB = memories.find(m => m.id === memIds[j]);
          if (mA && mB) {
            const common = findCommonWords(mA.content, mB.content);
            if (common > 0) {
              connections.push({ source: memoryNodeIndices[memIds[i]], target: memoryNodeIndices[memIds[j]], strength: Math.min(1, common * 0.3) });
            }
          }
        }
      }

      // Connect hubs that share cross-category memory connections
      for (let i = 0; i < categoryKeys.length; i++) {
        for (let j = i + 1; j < categoryKeys.length; j++) {
          const hasLink = connections.some(c => {
            const sNode = allNodes[c.source];
            const tNode = allNodes[c.target];
            return sNode && tNode && !sNode.isCategoryHub && !tNode.isCategoryHub &&
              sNode.category === categoryKeys[i] && tNode.category === categoryKeys[j];
          });
          if (hasLink) {
            connections.push({ source: hubIndices[categoryKeys[i]], target: hubIndices[categoryKeys[j]], strength: 0.15 });
          }
        }
      }

      // Pre-compute stable layout
      for (let iter = 0; iter < 400; iter++) {
        for (let i = 0; i < allNodes.length; i++) {
          for (let j = i + 1; j < allNodes.length; j++) {
            const dx = allNodes[j].x - allNodes[i].x;
            const dy = allNodes[j].y - allNodes[i].y;
            const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
            const bothHubs = allNodes[i].isCategoryHub && allNodes[j].isCategoryHub;
            const repulsion = (bothHubs ? 8000 : 2500) / (dist * dist);
            allNodes[i].x -= dx * repulsion * 0.003;
            allNodes[i].y -= dy * repulsion * 0.003;
            allNodes[j].x += dx * repulsion * 0.003;
            allNodes[j].y += dy * repulsion * 0.003;
          }
          allNodes[i].x += (centerX - allNodes[i].x) * 0.001;
          allNodes[i].y += (centerY - allNodes[i].y) * 0.001;
          allNodes[i].x = Math.max(100, Math.min(w - 100, allNodes[i].x));
          allNodes[i].y = Math.max(60, Math.min(h - 60, allNodes[i].y));
        }
        // Spring forces
        connections.forEach(c => {
          const s = allNodes[c.source];
          const t = allNodes[c.target];
          if (!s || !t) return;
          const dx = t.x - s.x;
          const dy = t.y - s.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const targetDist = s.isCategoryHub && !t.isCategoryHub ? 100 : 180;
          if (dist > 0) {
            const force = (dist - targetDist) * 0.003;
            if (!s.isCategoryHub) { s.x += dx / dist * force; s.y += dy / dist * force; }
            if (!t.isCategoryHub) { t.x -= dx / dist * force; t.y -= dy / dist * force; }
          }
        });
      }

      categoryColorsRef.current = colorMap;
      nodesRef.current = allNodes;
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

    const wrapText = (text: string, maxWidth: number): string[] => {
      const words = text.split(" ");
      const lines: string[] = [];
      let current = words[0] || "";
      for (let i = 1; i < words.length; i++) {
        const test = current + " " + words[i];
        if (ctx.measureText(test).width > maxWidth) {
          lines.push(current);
          current = words[i];
        } else {
          current = test;
        }
      }
      lines.push(current);
      return lines;
    };

    const draw = () => {
      time += 0.006;
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const nodes = nodesRef.current;
      const connections = connectionsRef.current;
      const colors = categoryColorsRef.current;

      // Draw category cluster backgrounds
      const categoryGroups: Record<string, Node[]> = {};
      nodes.forEach(n => {
        if (!n.isCategoryHub) {
          if (!categoryGroups[n.category]) categoryGroups[n.category] = [];
          categoryGroups[n.category].push(n);
        }
      });
      Object.entries(categoryGroups).forEach(([cat, catNodes]) => {
        const hub = nodes.find(n => n.isCategoryHub && n.category === cat);
        if (!hub) return;
        const allPts = [hub, ...catNodes];
        const cx = allPts.reduce((s, n) => s + n.x, 0) / allPts.length;
        const cy = allPts.reduce((s, n) => s + n.y, 0) / allPts.length;
        const maxDist = Math.max(80, ...allPts.map(n => Math.sqrt((n.x - cx) ** 2 + (n.y - cy) ** 2))) + 50;
        const color = colors[cat] || "#6ee7b7";
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxDist);
        grad.addColorStop(0, color + "12");
        grad.addColorStop(0.7, color + "08");
        grad.addColorStop(1, color + "00");
        ctx.beginPath();
        ctx.fillStyle = grad;
        ctx.arc(cx, cy, maxDist, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw connections
      connections.forEach(c => {
        const source = nodes[c.source];
        const target = nodes[c.target];
        if (!source || !target) return;
        const sColor = colors[source.category] || "#6ee7b7";
        const tColor = colors[target.category] || "#6ee7b7";
        const gradient = ctx.createLinearGradient(source.x, source.y, target.x, target.y);
        const alpha = Math.floor(25 + Math.sin(time * 2) * 10).toString(16).padStart(2, "0");
        gradient.addColorStop(0, sColor + alpha);
        gradient.addColorStop(1, tColor + alpha);
        ctx.beginPath();
        ctx.strokeStyle = gradient;
        ctx.lineWidth = source.isCategoryHub || target.isCategoryHub ? c.strength * 3 : c.strength * 1.5;
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.stroke();
      });

      // Draw nodes
      nodes.forEach((node, idx) => {
        const color = colors[node.category] || "#6ee7b7";

        if (node.isCategoryHub) {
          // Category hub: large glowing node with prominent label
          const radius = 18;

          // Large outer glow
          const glow = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, radius * 5);
          glow.addColorStop(0, color + "40");
          glow.addColorStop(0.5, color + "15");
          glow.addColorStop(1, color + "00");
          ctx.beginPath();
          ctx.fillStyle = glow;
          ctx.arc(node.x, node.y, radius * 5, 0, Math.PI * 2);
          ctx.fill();

          // Pulsing ring
          const pulseRadius = radius + 4 + Math.sin(time * 1.5) * 3;
          ctx.beginPath();
          ctx.strokeStyle = color + "50";
          ctx.lineWidth = 2;
          ctx.arc(node.x, node.y, pulseRadius, 0, Math.PI * 2);
          ctx.stroke();

          // Main circle
          ctx.beginPath();
          ctx.fillStyle = color;
          ctx.shadowColor = color;
          ctx.shadowBlur = 20;
          ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;

          // Inner white dot
          ctx.beginPath();
          ctx.fillStyle = "#ffffff60";
          ctx.arc(node.x, node.y, 5, 0, Math.PI * 2);
          ctx.fill();

          // Category label (bold, bigger)
          ctx.font = "bold 14px Outfit, sans-serif";
          ctx.textAlign = "center";
          const labelW = ctx.measureText(node.label).width + 16;
          const labelH = 26;
          const ly = node.y - radius - 16;

          // Label background pill
          ctx.fillStyle = color + "30";
          ctx.beginPath();
          ctx.roundRect(node.x - labelW / 2, ly - labelH / 2, labelW, labelH, 13);
          ctx.fill();
          ctx.strokeStyle = color + "60";
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.fillStyle = "#ffffff";
          ctx.fillText(node.label, node.x, ly + 5);
        } else {
          // Memory node
          const radius = 5 + node.importance * 2;

          // Glow
          const glow = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, radius * 3);
          glow.addColorStop(0, color + "25");
          glow.addColorStop(1, color + "00");
          ctx.beginPath();
          ctx.fillStyle = glow;
          ctx.arc(node.x, node.y, radius * 3, 0, Math.PI * 2);
          ctx.fill();

          // Orbiting electron
          const orbitRadius = radius * 2;
          const speed = 0.8 + idx * 0.2;
          ctx.beginPath();
          ctx.fillStyle = color + "60";
          ctx.arc(
            node.x + Math.cos(time * speed) * orbitRadius,
            node.y + Math.sin(time * speed) * orbitRadius,
            1.5, 0, Math.PI * 2
          );
          ctx.fill();

          // Main dot
          ctx.beginPath();
          ctx.fillStyle = color;
          ctx.shadowColor = color;
          ctx.shadowBlur = 8;
          ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;

          // Label with word wrap
          ctx.font = "11px Outfit, sans-serif";
          ctx.textAlign = "center";
          const maxWidth = 130;
          const lineHeight = 13;
          const lines = wrapText(node.label, maxWidth);

          const labelY = node.y + radius + 12;
          const bgPad = 4;
          const bgH = lines.length * lineHeight + bgPad * 2;
          const bgW = Math.min(maxWidth + bgPad * 2, lines.reduce((mx, l) => Math.max(mx, ctx.measureText(l).width), 0) + bgPad * 2);

          ctx.fillStyle = "rgba(10, 10, 15, 0.8)";
          ctx.beginPath();
          ctx.roundRect(node.x - bgW / 2, labelY - bgPad, bgW, bgH, 4);
          ctx.fill();

          ctx.fillStyle = "#cbd5e1";
          lines.forEach((line, li) => {
            ctx.fillText(line, node.x, labelY + li * lineHeight + 10);
          });
        }
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
