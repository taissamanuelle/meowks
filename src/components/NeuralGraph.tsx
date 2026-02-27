import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Node {
  id: string;
  label: string;
  category: string;
  importance: number;
  x: number;
  y: number;
  isCategoryHub?: boolean;
  // Bounding box for repulsion (computed during layout)
  bboxW?: number;
  bboxH?: number;
}

interface Connection {
  source: number;
  target: number;
  strength: number;
}

const LIFE_CATEGORIES: { key: string; label: string; color: string; keywords: RegExp }[] = [
  { key: "saude", label: "🩺 Saúde", color: "#34d399", keywords: /saúde|médic|doença|remédio|hospital|exercício|academia|dieta|peso|dormir|sono|ansiedade|depressão|terapia|psicólog|dentista|exame|vacina|alergia|dor |vitamina|treino|corr[ei]|musculação|muscul|cardio|yoga|pilates|nutrição|suplemento|gordura|emagrec|engordar|flexão|agacha|alongamento|caminhada|esporte|natação/i },
  { key: "autoconhecimento", label: "🧠 Autoconhecimento", color: "#a78bfa", keywords: /personalidade|introvertid|extrovertid|qualidade|defeito|medo|sonho|objetivo|meta|valor|princípio|acredit|reflet|medita|mindful|autoestima|ansios|sentir|emoção|feliz|triste|raiva|calm|paciên|gratidão|tímid|confiança|inseguranç/i },
  { key: "trabalho", label: "💼 Trabalho", color: "#60a5fa", keywords: /trabalh|emprego|empresa|salário|profissão|carreira|chefe|colega|reunião|projeto|deadline|freela|negócio|cliente|escritório|home office|currículo|entrevista|promoção/i },
  { key: "estudos", label: "📚 Estudos", color: "#fbbf24", keywords: /estud|faculdade|universidade|curso|aula|professor|prova|nota|livro|aprend|ler |leitura|formação|diploma|certificad|concurso|vestibular|enem|pesquis/i },
  { key: "financas", label: "💰 Finanças", color: "#f472b6", keywords: /dinheir|financ|investim|poupança|gast|econom|salári|dívida|cartão|banco|empréstimo|orçamento|criptomoeda|ações|rendiment|pagar|conta|boleto/i },
  { key: "relacionamentos", label: "❤️ Relacionamentos", color: "#fb7185", keywords: /namorad|casad|esposa|marido|noiv|relacion|amor|paixão|término|saudade|famíli|mãe|pai|irmã|irmão|filh|amig|casal|compromiss/i },
  { key: "casa", label: "🏠 Casa", color: "#fb923c", keywords: /casa|apartamento|aluguel|mudan|móve|decoração|limpeza|cozinha|quarto|banheiro|jardim|reform|condomínio|vizinho|mora[rd]|endereço/i },
  { key: "veiculos", label: "🚗 Veículos", color: "#c4b5fd", keywords: /carro|moto|veículo|dirig|habilitação|combustível|gasolina|mecânico|oficina|seguro auto|multa|estaciona|uber|táxi|ônibus|metrô|bicicleta/i },
  { key: "lazer", label: "🎮 Lazer", color: "#38bdf8", keywords: /jog[oa]|game|série|filme|música|viajar|viagem|férias|netflix|hobby|dança|cinema|teatro|show|festival|passeio|parque|praia|churrasq|festa|diversão|tocar|instrumento/i },
  { key: "alimentacao", label: "🍽️ Alimentação", color: "#a3e635", keywords: /com[ei]r|comida|aliment|cozinhar|receita|restaurante|café|almoço|jantar|lanche|vegano|vegetarian|fruta|carne|doce|bolo|pizza/i },
  { key: "tecnologia", label: "💻 Tecnologia", color: "#818cf8", keywords: /computador|celular|app|programa|código|site|internet|software|hardware|tecnolog|inteligência artificial|notebook|tablet|rede social|programação|desenvolv/i },
  { key: "espiritualidade", label: "✨ Espiritualidade", color: "#e879f9", keywords: /deus|fé|igreja|oração|espiritual|religião|bíblia|meditação espiritual|alma|energia divina|universo espiritual|propósito divino/i },
];

const FALLBACK_CATEGORY = { key: "geral", label: "📌 Geral", color: "#6ee7b7" };

function categorizeMemory(content: string): { key: string; label: string; color: string } {
  let bestCat = FALLBACK_CATEGORY;
  let bestScore = 0;
  for (const cat of LIFE_CATEGORIES) {
    const matches = content.match(new RegExp(cat.keywords.source, "gi"));
    const score = matches ? matches.length : 0;
    if (score > bestScore) {
      bestScore = score;
      bestCat = cat;
    }
  }
  return bestCat;
}

const STOPWORDS = new Set(["para","como","mais","está","esse","essa","isso","aqui","aquele","aquela","muito","todo","toda","todos","todas","pode","será","sido","sido","porque","desde","sobre","entre","depois","antes","ainda","também","além","assim","apenas","cada","outro","outra","outros","outras","onde","quando","qual","quais","pelo","pela","pelos","pelas","nosso","nossa","nossos","nossas","eles","elas","dele","dela","deles","delas","mesmo","mesma","nada","tudo","algo","alguém","ninguém","gosta","acha","quer","faz","fazer","feito","tendo","teve","sabe","saber"]);

function findCommonWords(a: string, b: string): number {
  const clean = (s: string) => new Set(
    s.toLowerCase()
      .replace(/[^\w\sàáâãéèêíïóôõúüç]/g, "")
      .split(/\s+/)
      .filter(w => w.length > 3 && !STOPWORDS.has(w))
  );
  const wordsA = clean(a);
  const wordsB = clean(b);
  let common = 0;
  wordsA.forEach(w => { if (wordsB.has(w)) common++; });
  return common;
}

const CONNECTION_COLOR = "#a78bfa";

// Estimated text box size for a memory node (used during physics layout)
function estimateNodeBox(label: string): { w: number; h: number } {
  const maxWidth = 140;
  const lineHeight = 13;
  const maxLines = 4;
  const charWidth = 5.5; // approximate for 11px Outfit
  const text = label.replace(/^Eu\s+/i, "");
  const truncated = text.length > 120 ? text.slice(0, 117) : text;
  const words = truncated.split(" ");
  let lines = 1;
  let lineW = 0;
  let maxLineW = 0;
  for (const word of words) {
    const ww = word.length * charWidth;
    if (lineW + ww > maxWidth && lineW > 0) {
      maxLineW = Math.max(maxLineW, lineW);
      lines++;
      lineW = ww;
      if (lines > maxLines) break;
    } else {
      lineW += (lineW > 0 ? charWidth : 0) + ww;
    }
  }
  maxLineW = Math.max(maxLineW, lineW);
  lines = Math.min(lines, maxLines);
  const pad = 20;
  return { w: Math.min(maxWidth, maxLineW) + pad * 2, h: lines * lineHeight + pad * 2 };
}

export function NeuralGraph() {
  const { user } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const connectionsRef = useRef<Connection[]>([]);
  const categoryColorsRef = useRef<Record<string, string>>({});
  const animRef = useRef<number>(0);
  const [isEmpty, setIsEmpty] = useState(true);
  const [selectedMemory, setSelectedMemory] = useState<{ label: string; category: string; color: string } | null>(null);

  // Pan & zoom state
  const viewRef = useRef({ offsetX: 0, offsetY: 0, scale: 1 });
  const dragRef = useRef<{ active: boolean; lastX: number; lastY: number; moved: boolean }>({ active: false, lastX: 0, lastY: 0, moved: false });
  const pinchRef = useRef<{ dist: number } | null>(null);

  // Click/tap handler to detect node clicks
  const handleCanvasClick = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const view = viewRef.current;
    // Convert screen coords to world coords
    const worldX = (clientX - rect.left - view.offsetX) / view.scale;
    const worldY = (clientY - rect.top - view.offsetY) / view.scale;

    const nodes = nodesRef.current;
    const colors = categoryColorsRef.current;
    // Check memory nodes (non-hub) — hit test on their bounding box area
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      if (node.isCategoryHub) continue;
      const radius = 5 + node.importance * 2;
      const bw = (node.bboxW || 120) / 2;
      const bh = (node.bboxH || 60);
      // Hit area covers the dot + the text box below it
      const hitTop = node.y - radius - 5;
      const hitBottom = node.y + radius + 12 + bh;
      const hitLeft = node.x - bw;
      const hitRight = node.x + bw;
      if (worldX >= hitLeft && worldX <= hitRight && worldY >= hitTop && worldY <= hitBottom) {
        const color = colors[node.category] || "#6ee7b7";
        setSelectedMemory({ label: node.label, category: node.category, color });
        return;
      }
    }
  }, []);

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

      const categorized = memories.map(m => ({ ...m, cat: categorizeMemory(m.content) }));
      const groups: Record<string, typeof categorized> = {};
      categorized.forEach(m => {
        if (!groups[m.cat.key]) groups[m.cat.key] = [];
        groups[m.cat.key].push(m);
      });

      const categoryKeys = Object.keys(groups);
      const colorMap: Record<string, string> = {};
      const allNodes: Node[] = [];
      const hubRadius = Math.min(w, h) * 0.45;
      const hubIndices: Record<string, number> = {};

      const vidaColor = "#e2e8f0";
      colorMap["vida"] = vidaColor;
      const vidaIdx = allNodes.length;
      allNodes.push({
        id: "hub-vida", label: "🌟 Vida", category: "vida", importance: 8,
        x: centerX, y: centerY, isCategoryHub: true,
      });

      categoryKeys.forEach((key, ci) => {
        const cat = groups[key][0].cat;
        const angle = (ci / categoryKeys.length) * Math.PI * 2 - Math.PI / 2;
        colorMap[key] = cat.color;
        hubIndices[key] = allNodes.length;
        allNodes.push({
          id: `hub-${key}`, label: cat.label, category: key, importance: 5,
          x: centerX + Math.cos(angle) * hubRadius, y: centerY + Math.sin(angle) * hubRadius,
          isCategoryHub: true,
        });
      });

      const memoryNodeIndices: Record<string, number> = {};
      categoryKeys.forEach(key => {
        const hub = allNodes[hubIndices[key]];
        const mems = groups[key];
        mems.forEach((m, mi) => {
          const angle = (mi / mems.length) * Math.PI * 2;
          // More spacing based on count
          const clusterRadius = 150 + mems.length * 45;
          const capitalizedContent = m.content.charAt(0).toUpperCase() + m.content.slice(1);
          const box = estimateNodeBox(capitalizedContent);
          memoryNodeIndices[m.id] = allNodes.length;
          allNodes.push({
            id: m.id, label: capitalizedContent, category: key,
            importance: Math.min(3, Math.ceil(m.content.length / 30)),
            x: hub.x + Math.cos(angle) * clusterRadius + (Math.random() - 0.5) * 40,
            y: hub.y + Math.sin(angle) * clusterRadius + (Math.random() - 0.5) * 40,
            bboxW: box.w, bboxH: box.h,
          });
        });
      });

      const connections: Connection[] = [];

      categoryKeys.forEach(key => {
        connections.push({ source: vidaIdx, target: hubIndices[key], strength: 0.3 });
      });

      categoryKeys.forEach(key => {
        const hubIdx = hubIndices[key];
        groups[key].forEach(m => {
          connections.push({ source: hubIdx, target: memoryNodeIndices[m.id], strength: 0.6 });
        });
      });

      const memIds = Object.keys(memoryNodeIndices);
      for (let i = 0; i < memIds.length; i++) {
        for (let j = i + 1; j < memIds.length; j++) {
          const mA = memories.find(m => m.id === memIds[i]);
          const mB = memories.find(m => m.id === memIds[j]);
          if (mA && mB) {
            const catA = categorizeMemory(mA.content).key;
            const catB = categorizeMemory(mB.content).key;
            const common = findCommonWords(mA.content, mB.content);
            const threshold = catA === catB ? 1 : 2;
            if (common >= threshold) {
              connections.push({ source: memoryNodeIndices[memIds[i]], target: memoryNodeIndices[memIds[j]], strength: Math.min(1, common * 0.25) });
            }
          }
        }
      }

      // ── Helper: get full bounding box of a node (dot + text below) ──
      const getNodeRect = (n: Node) => {
        const r = n.isCategoryHub ? (n.id === "hub-vida" ? 24 : 18) : 5 + n.importance * 2;
        if (n.isCategoryHub) {
          return { cx: n.x, cy: n.y, hw: 60, hh: r + 20 };
        }
        const textW = (n.bboxW || 140) / 2;
        const textH = (n.bboxH || 60);
        // The text box sits below the dot, so the total vertical extent is from dot-top to text-bottom
        const top = n.y - r;
        const bottom = n.y + r + 12 + textH;
        const totalH = (bottom - top) / 2;
        const cy = (top + bottom) / 2;
        return { cx: n.x, cy, hw: textW + 10, hh: totalH + 10 };
      };

      // ── Phase 1: Spring layout (light, just for structure) ──
      for (let iter = 0; iter < 200; iter++) {
        // General repulsion between all nodes
        for (let i = 0; i < allNodes.length; i++) {
          for (let j = i + 1; j < allNodes.length; j++) {
            const dx = allNodes[j].x - allNodes[i].x;
            const dy = allNodes[j].y - allNodes[i].y;
            const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
            const isVida = allNodes[i].id === "hub-vida" || allNodes[j].id === "hub-vida";
            const bothHubs = allNodes[i].isCategoryHub && allNodes[j].isCategoryHub;
            const repulsion = (isVida ? 50000 : bothHubs ? 35000 : 25000) / (dist * dist);
            const fx = (dx / dist) * repulsion * 0.005;
            const fy = (dy / dist) * repulsion * 0.005;
            if (allNodes[i].id !== "hub-vida") { allNodes[i].x -= fx; allNodes[i].y -= fy; }
            if (allNodes[j].id !== "hub-vida") { allNodes[j].x += fx; allNodes[j].y += fy; }
          }
          if (allNodes[i].id !== "hub-vida") {
            allNodes[i].x += (centerX - allNodes[i].x) * 0.0002;
            allNodes[i].y += (centerY - allNodes[i].y) * 0.0002;
          }
        }
        connections.forEach(c => {
          const s = allNodes[c.source]; const t = allNodes[c.target];
          if (!s || !t) return;
          const dx = t.x - s.x; const dy = t.y - s.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const isVidaLink = s.id === "hub-vida" || t.id === "hub-vida";
          const targetDist = isVidaLink ? hubRadius : (s.isCategoryHub && !t.isCategoryHub ? 200 : 280);
          if (dist > 0) {
            const force = (dist - targetDist) * 0.002;
            if (!s.isCategoryHub && s.id !== "hub-vida") { s.x += dx / dist * force; s.y += dy / dist * force; }
            if (!t.isCategoryHub && t.id !== "hub-vida") { t.x -= dx / dist * force; t.y -= dy / dist * force; }
            if (isVidaLink) {
              const hubNode = s.id === "hub-vida" ? t : s;
              if (hubNode.isCategoryHub) {
                const pullForce = (dist - targetDist) * 0.002;
                hubNode.x += (s.id === "hub-vida" ? 1 : -1) * dx / dist * pullForce;
                hubNode.y += (s.id === "hub-vida" ? 1 : -1) * dy / dist * pullForce;
              }
            }
          }
        });
      }

      // ── Phase 2: Aggressive overlap resolution (GPS anti-collision) ──
      // Run many passes; each pass pushes overlapping nodes apart directly
      const PADDING = 25; // extra gap between boxes
      for (let pass = 0; pass < 300; pass++) {
        let anyOverlap = false;
        for (let i = 0; i < allNodes.length; i++) {
          if (allNodes[i].isCategoryHub) continue;
          const ri = getNodeRect(allNodes[i]);
          for (let j = i + 1; j < allNodes.length; j++) {
            if (allNodes[j].isCategoryHub) continue;
            const rj = getNodeRect(allNodes[j]);

            const overlapX = (ri.hw + rj.hw + PADDING) - Math.abs(ri.cx - rj.cx);
            const overlapY = (ri.hh + rj.hh + PADDING) - Math.abs(ri.cy - rj.cy);

            if (overlapX > 0 && overlapY > 0) {
              anyOverlap = true;
              // Push apart along the axis with less overlap
              const pushX = overlapX < overlapY;
              if (pushX) {
                const sign = ri.cx < rj.cx ? -1 : 1;
                const push = (overlapX / 2) + 2;
                allNodes[i].x += sign * push;
                allNodes[j].x -= sign * push;
              } else {
                const sign = ri.cy < rj.cy ? -1 : 1;
                const push = (overlapY / 2) + 2;
                // Adjust the node Y directly; cy offset from y depends on text below
                allNodes[i].y += sign * push;
                allNodes[j].y -= sign * push;
              }
            }
          }
        }
        if (!anyOverlap) break; // All clear!
      }

      categoryColorsRef.current = colorMap;
      nodesRef.current = allNodes;
      connectionsRef.current = connections;
      setIsEmpty(false);
    };
    fetchData();
  }, [user]);

  // Pan & zoom event handlers
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const getTouchDist = (e: TouchEvent) => {
      const [a, b] = [e.touches[0], e.touches[1]];
      return Math.sqrt((a.clientX - b.clientX) ** 2 + (a.clientY - b.clientY) ** 2);
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const view = viewRef.current;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const oldScale = view.scale;
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      view.scale = Math.max(0.2, Math.min(5, oldScale * delta));
      view.offsetX = mx - (mx - view.offsetX) * (view.scale / oldScale);
      view.offsetY = my - (my - view.offsetY) * (view.scale / oldScale);
    };

    const DRAG_THRESHOLD = 8;

    const onMouseDown = (e: MouseEvent) => {
      dragRef.current = { active: true, lastX: e.clientX, lastY: e.clientY, moved: false };
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!dragRef.current.active) return;
      const dx = e.clientX - dragRef.current.lastX;
      const dy = e.clientY - dragRef.current.lastY;
      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
        dragRef.current.moved = true;
      }
      const view = viewRef.current;
      view.offsetX += dx;
      view.offsetY += dy;
      dragRef.current.lastX = e.clientX;
      dragRef.current.lastY = e.clientY;
    };
    const onMouseUp = (e: MouseEvent) => {
      if (!dragRef.current.moved) {
        handleCanvasClick(e.clientX, e.clientY);
      }
      dragRef.current.active = false;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        pinchRef.current = { dist: getTouchDist(e) };
      } else if (e.touches.length === 1) {
        dragRef.current = { active: true, lastX: e.touches[0].clientX, lastY: e.touches[0].clientY, moved: false };
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const view = viewRef.current;
      if (e.touches.length === 2 && pinchRef.current) {
        const newDist = getTouchDist(e);
        const ratio = newDist / pinchRef.current.dist;
        const rect = canvas.getBoundingClientRect();
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
        const oldScale = view.scale;
        view.scale = Math.max(0.2, Math.min(5, oldScale * ratio));
        view.offsetX = cx - (cx - view.offsetX) * (view.scale / oldScale);
        view.offsetY = cy - (cy - view.offsetY) * (view.scale / oldScale);
        pinchRef.current.dist = newDist;
      } else if (e.touches.length === 1 && dragRef.current.active) {
        const dx = e.touches[0].clientX - dragRef.current.lastX;
        const dy = e.touches[0].clientY - dragRef.current.lastY;
        if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
          dragRef.current.moved = true;
        }
        view.offsetX += dx;
        view.offsetY += dy;
        dragRef.current.lastX = e.touches[0].clientX;
        dragRef.current.lastY = e.touches[0].clientY;
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (!dragRef.current.moved && e.changedTouches.length === 1) {
        handleCanvasClick(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
      }
      dragRef.current.active = false;
      pinchRef.current = null;
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd);

    return () => {
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
    };
  }, [isEmpty, handleCanvasClick]);

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
      const view = viewRef.current;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      ctx.save();
      ctx.translate(view.offsetX, view.offsetY);
      ctx.scale(view.scale, view.scale);

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
        const gradient = ctx.createLinearGradient(source.x, source.y, target.x, target.y);
        const alpha = Math.floor(35 + Math.sin(time * 2) * 15).toString(16).padStart(2, "0");
        gradient.addColorStop(0, CONNECTION_COLOR + alpha);
        gradient.addColorStop(1, CONNECTION_COLOR + alpha);
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
          const isVida = node.id === "hub-vida";
          const radius = isVida ? 24 : 18;

          const glow = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, radius * 5);
          glow.addColorStop(0, color + "40");
          glow.addColorStop(0.5, color + "15");
          glow.addColorStop(1, color + "00");
          ctx.beginPath();
          ctx.fillStyle = glow;
          ctx.arc(node.x, node.y, radius * 5, 0, Math.PI * 2);
          ctx.fill();

          const pulseRadius = radius + 4 + Math.sin(time * 1.5) * 3;
          ctx.beginPath();
          ctx.strokeStyle = color + "50";
          ctx.lineWidth = 2;
          ctx.arc(node.x, node.y, pulseRadius, 0, Math.PI * 2);
          ctx.stroke();

          ctx.beginPath();
          ctx.fillStyle = color;
          ctx.shadowColor = color;
          ctx.shadowBlur = 20;
          ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;

          ctx.beginPath();
          ctx.fillStyle = "#ffffff60";
          ctx.arc(node.x, node.y, 5, 0, Math.PI * 2);
          ctx.fill();

          ctx.font = "bold 14px Outfit, sans-serif";
          ctx.textAlign = "center";
          const labelW = ctx.measureText(node.label).width + 16;
          const labelH = 26;
          const ly = node.y - radius - 16;

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
          const radius = 5 + node.importance * 2;

          const glow = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, radius * 3);
          glow.addColorStop(0, color + "25");
          glow.addColorStop(1, color + "00");
          ctx.beginPath();
          ctx.fillStyle = glow;
          ctx.arc(node.x, node.y, radius * 3, 0, Math.PI * 2);
          ctx.fill();

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

          ctx.beginPath();
          ctx.fillStyle = color;
          ctx.shadowColor = color;
          ctx.shadowBlur = 8;
          ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;

          ctx.font = "11px Outfit, sans-serif";
          ctx.textAlign = "center";
          const maxWidth = 140;
          const lineHeight = 13;
          const maxLines = 4;
          // Ensure uppercase + truncate
          let summarized = node.label.replace(/^Eu\s+/i, "");
          summarized = summarized.charAt(0).toUpperCase() + summarized.slice(1);
          if (summarized.length > 120) summarized = summarized.slice(0, 117) + "…";
          let lines = wrapText(summarized, maxWidth);
          if (lines.length > maxLines) {
            lines = lines.slice(0, maxLines);
            lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, "…");
          }

          const labelY = node.y + radius + 12;
          const bgPad = 10;
          const bgH = lines.length * lineHeight + bgPad * 2;
          const bgW = Math.min(maxWidth + bgPad * 2, lines.reduce((mx, l) => Math.max(mx, ctx.measureText(l).width), 0) + bgPad * 2);

          ctx.fillStyle = "rgba(10, 10, 15, 0.85)";
          ctx.beginPath();
          ctx.roundRect(node.x - bgW / 2, labelY - bgPad + 4, bgW, bgH, 6);
          ctx.fill();

          ctx.fillStyle = "#cbd5e1";
          lines.forEach((line, li) => {
            ctx.fillText(line, node.x, labelY + li * lineHeight + 10);
          });
        }
      });

      ctx.restore();
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

  const catInfo = selectedMemory ? LIFE_CATEGORIES.find(c => c.key === selectedMemory.category) || FALLBACK_CATEGORY : null;

  return (
    <>
      <canvas
        ref={canvasRef}
        className="h-full w-full cursor-grab active:cursor-grabbing"
        style={{ background: "transparent", touchAction: "none" }}
      />
      <Dialog open={!!selectedMemory} onOpenChange={(open) => !open && setSelectedMemory(null)}>
        <DialogContent className="max-w-md border-border/50 bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: selectedMemory?.color }}
              />
              {catInfo?.label || "Memória"}
            </DialogTitle>
          </DialogHeader>
          <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
            {selectedMemory?.label}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
