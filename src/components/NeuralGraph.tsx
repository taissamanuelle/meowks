import { useEffect, useRef, useState, useCallback } from "react";
import { ArrowRightLeft, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FluentEmoji } from "@/components/FluentEmoji";

interface Node {
  id: string;
  label: string;
  category: string;
  importance: number;
  x: number;
  y: number;
  isCategoryHub?: boolean;
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

function estimateNodeBox(label: string): { w: number; h: number } {
  const maxWidth = 140;
  const lineHeight = 13;
  const maxLines = 4;
  const charWidth = 5.5;
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

interface CategorizedMemory {
  id: string;
  content: string;
  cat: { key: string; label: string; color: string };
}

function buildCategoryLayout(
  mems: CategorizedMemory[],
  catInfo: { key: string; label: string; color: string },
): { nodes: Node[]; connections: Connection[]; colorMap: Record<string, string> } {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const centerX = w / 2;
  const centerY = h / 2;
  const colorMap: Record<string, string> = {};
  const nodes: Node[] = [];

  colorMap[catInfo.key] = catInfo.color;

  // Hub at center
  const hubIdx = 0;
  nodes.push({
    id: `hub-${catInfo.key}`, label: catInfo.label, category: catInfo.key, importance: 5,
    x: centerX, y: centerY, isCategoryHub: true,
  });

  const memIndicesMap: Record<string, number> = {};
  mems.forEach((m, mi) => {
    const angle = (mi / mems.length) * Math.PI * 2;
    const clusterRadius = 120 + mems.length * 35;
    const capitalizedContent = m.content.charAt(0).toUpperCase() + m.content.slice(1);
    const box = estimateNodeBox(capitalizedContent);
    memIndicesMap[m.id] = nodes.length;
    nodes.push({
      id: m.id, label: capitalizedContent, category: catInfo.key,
      importance: Math.min(3, Math.ceil(m.content.length / 30)),
      x: centerX + Math.cos(angle) * clusterRadius + (Math.random() - 0.5) * 40,
      y: centerY + Math.sin(angle) * clusterRadius + (Math.random() - 0.5) * 40,
      bboxW: box.w, bboxH: box.h,
    });
  });

  const connections: Connection[] = [];
  mems.forEach(m => {
    connections.push({ source: hubIdx, target: memIndicesMap[m.id], strength: 0.6 });
  });

  for (let i = 0; i < mems.length; i++) {
    for (let j = i + 1; j < mems.length; j++) {
      const common = findCommonWords(mems[i].content, mems[j].content);
      if (common >= 1) {
        connections.push({ source: memIndicesMap[mems[i].id], target: memIndicesMap[mems[j].id], strength: Math.min(1, common * 0.25) });
      }
    }
  }

  const getNodeRect = (n: Node) => {
    const r = n.isCategoryHub ? 18 : 5 + n.importance * 2;
    if (n.isCategoryHub) return { cx: n.x, cy: n.y, hw: 60, hh: r + 20 };
    const textW = (n.bboxW || 140) / 2;
    const textH = (n.bboxH || 60);
    const top = n.y - r;
    const bottom = n.y + r + 12 + textH;
    const totalH = (bottom - top) / 2;
    const cy = (top + bottom) / 2;
    return { cx: n.x, cy, hw: textW + 10, hh: totalH + 10 };
  };

  // Spring layout
  for (let iter = 0; iter < 200; iter++) {
    for (let a = 0; a < nodes.length; a++) {
      for (let b = a + 1; b < nodes.length; b++) {
        const ni = nodes[a]; const nj = nodes[b];
        const dx = nj.x - ni.x; const dy = nj.y - ni.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const repBase = ni.isCategoryHub || nj.isCategoryHub ? 20000 : 12000;
        const repulsion = repBase / (dist * dist);
        const fx = (dx / dist) * repulsion * 0.005;
        const fy = (dy / dist) * repulsion * 0.005;
        if (!ni.isCategoryHub) { ni.x -= fx; ni.y -= fy; }
        if (!nj.isCategoryHub) { nj.x += fx; nj.y += fy; }
      }
    }

    // Pull memory nodes toward hub
    for (let i = 1; i < nodes.length; i++) {
      const n = nodes[i];
      const hub = nodes[0];
      const dx = hub.x - n.x; const dy = hub.y - n.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 180) {
        const force = (dist - 180) * 0.005;
        n.x += (dx / dist) * force;
        n.y += (dy / dist) * force;
      }
    }

    connections.forEach(c => {
      const s = nodes[c.source]; const t = nodes[c.target];
      if (!s || !t) return;
      const dx = t.x - s.x; const dy = t.y - s.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const targetDist = s.isCategoryHub || t.isCategoryHub ? 160 : 200;
      if (dist > 0) {
        const force = (dist - targetDist) * 0.002;
        if (!s.isCategoryHub) { s.x += dx / dist * force; s.y += dy / dist * force; }
        if (!t.isCategoryHub) { t.x -= dx / dist * force; t.y -= dy / dist * force; }
      }
    });
  }

  // Overlap resolution
  const PADDING = 25;
  for (let pass = 0; pass < 300; pass++) {
    let anyOverlap = false;
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].isCategoryHub) continue;
      const ri = getNodeRect(nodes[i]);
      for (let j = i + 1; j < nodes.length; j++) {
        if (nodes[j].isCategoryHub) continue;
        const rj = getNodeRect(nodes[j]);
        const overlapX = (ri.hw + rj.hw + PADDING) - Math.abs(ri.cx - rj.cx);
        const overlapY = (ri.hh + rj.hh + PADDING) - Math.abs(ri.cy - rj.cy);
        if (overlapX > 0 && overlapY > 0) {
          anyOverlap = true;
          const pushX = overlapX < overlapY;
          if (pushX) {
            const sign = ri.cx < rj.cx ? -1 : 1;
            const push = (overlapX / 2) + 2;
            nodes[i].x += sign * push; nodes[j].x -= sign * push;
          } else {
            const sign = ri.cy < rj.cy ? -1 : 1;
            const push = (overlapY / 2) + 2;
            nodes[i].y += sign * push; nodes[j].y -= sign * push;
          }
        }
      }
    }
    if (!anyOverlap) break;
  }

  return { nodes, connections, colorMap };
}

export function NeuralGraph() {
  const { user } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const connectionsRef = useRef<Connection[]>([]);
  const categoryColorsRef = useRef<Record<string, string>>({});
  const animRef = useRef<number>(0);
  const [isEmpty, setIsEmpty] = useState(true);
  const [selectedMemory, setSelectedMemory] = useState<{ id: string; label: string; category: string; color: string } | null>(null);
  const [moveTarget, setMoveTarget] = useState<string>("");
  const [aiRecommendation, setAiRecommendation] = useState<string | null>(null);
  const [loadingRec, setLoadingRec] = useState(false);
  const [moving, setMoving] = useState(false);

  // Category data
  const [availableCategories, setAvailableCategories] = useState<{ key: string; label: string; color: string; count: number }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const groupsRef = useRef<Record<string, CategorizedMemory[]>>({});

  // Pan & zoom state
  const viewRef = useRef({ offsetX: 0, offsetY: 0, scale: 1 });
  const dragRef = useRef<{ active: boolean; lastX: number; lastY: number; moved: boolean }>({ active: false, lastX: 0, lastY: 0, moved: false });
  const pinchRef = useRef<{ dist: number } | null>(null);
  const wasPinchingRef = useRef(false);
  const lastClickRef = useRef<{ time: number; x: number; y: number }>({ time: 0, x: 0, y: 0 });

  const handleCanvasClick = useCallback((clientX: number, clientY: number) => {
    const now = Date.now();
    const last = lastClickRef.current;
    const dx = clientX - last.x;
    const dy = clientY - last.y;
    const timeDiff = now - last.time;
    const isDoubleClick = timeDiff < 400 && Math.abs(dx) < 30 && Math.abs(dy) < 30;
    lastClickRef.current = { time: now, x: clientX, y: clientY };
    if (!isDoubleClick) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const view = viewRef.current;
    const worldX = (clientX - rect.left - view.offsetX) / view.scale;
    const worldY = (clientY - rect.top - view.offsetY) / view.scale;

    const nodes = nodesRef.current;
    const colors = categoryColorsRef.current;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      if (node.isCategoryHub) continue;
      const radius = 5 + node.importance * 2;
      const bw = (node.bboxW || 120) / 2;
      const bh = (node.bboxH || 60);
      const hitTop = node.y - radius - 5;
      const hitBottom = node.y + radius + 12 + bh;
      const hitLeft = node.x - bw;
      const hitRight = node.x + bw;
      if (worldX >= hitLeft && worldX <= hitRight && worldY >= hitTop && worldY <= hitBottom) {
        const color = colors[node.category] || "#6ee7b7";
        setSelectedMemory({ id: node.id, label: node.label, category: node.category, color });
        setMoveTarget("");
        setAiRecommendation(null);
        lastClickRef.current = { time: 0, x: 0, y: 0 };
        return;
      }
    }
  }, []);

  // Fetch all memories and categorize
  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const { data: memories } = await supabase
        .from("memories")
        .select("id, content, category")
        .eq("user_id", user.id);

      if (!memories || memories.length === 0) {
        setIsEmpty(true);
        return;
      }

      const categorized: CategorizedMemory[] = memories.map(m => {
        // Use stored category override if available, otherwise auto-categorize
        if (m.category) {
          const cat = LIFE_CATEGORIES.find(c => c.key === m.category) || FALLBACK_CATEGORY;
          return { id: m.id, content: m.content, cat };
        }
        return { id: m.id, content: m.content, cat: categorizeMemory(m.content) };
      });
      const groups: Record<string, CategorizedMemory[]> = {};
      categorized.forEach(m => {
        if (!groups[m.cat.key]) groups[m.cat.key] = [];
        groups[m.cat.key].push(m);
      });

      groupsRef.current = groups;

      const cats = Object.keys(groups).map(key => {
        const cat = groups[key][0].cat;
        return { key, label: cat.label, color: cat.color, count: groups[key].length };
      });
      setAvailableCategories(cats);

      // Auto-select first category
      if (cats.length > 0) {
        setSelectedCategory(cats[0].key);
      }

      setIsEmpty(false);
    };
    fetchData();
  }, [user]);

  // Build layout when category changes
  useEffect(() => {
    if (!selectedCategory || isEmpty) return;
    const groups = groupsRef.current;
    const mems = groups[selectedCategory];
    if (!mems || mems.length === 0) return;

    const catInfo = mems[0].cat;
    const { nodes, connections, colorMap } = buildCategoryLayout(mems, catInfo);

    nodesRef.current = nodes;
    connectionsRef.current = connections;
    categoryColorsRef.current = colorMap;

    // Reset pan/zoom when switching categories
    viewRef.current = { offsetX: 0, offsetY: 0, scale: 1 };
  }, [selectedCategory, isEmpty]);

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
      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) dragRef.current.moved = true;
      viewRef.current.offsetX += dx; viewRef.current.offsetY += dy;
      dragRef.current.lastX = e.clientX; dragRef.current.lastY = e.clientY;
    };
    const onMouseUp = (e: MouseEvent) => {
      if (!dragRef.current.moved) handleCanvasClick(e.clientX, e.clientY);
      dragRef.current.active = false;
    };
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        pinchRef.current = { dist: getTouchDist(e) };
        wasPinchingRef.current = true;
        dragRef.current.moved = true;
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
        if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) dragRef.current.moved = true;
        view.offsetX += dx; view.offsetY += dy;
        dragRef.current.lastX = e.touches[0].clientX; dragRef.current.lastY = e.touches[0].clientY;
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (!dragRef.current.moved && !wasPinchingRef.current && e.changedTouches.length === 1) {
        handleCanvasClick(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
      }
      dragRef.current.active = false;
      if (e.touches.length === 0) {
        setTimeout(() => { wasPinchingRef.current = false; }, 300);
        pinchRef.current = null;
      }
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

  // Canvas rendering
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

      // Draw cluster background
      const memNodes = nodes.filter(n => !n.isCategoryHub);
      const hub = nodes.find(n => n.isCategoryHub);
      if (hub && memNodes.length > 0) {
        const allPts = [hub, ...memNodes];
        const cx = allPts.reduce((s, n) => s + n.x, 0) / allPts.length;
        const cy = allPts.reduce((s, n) => s + n.y, 0) / allPts.length;
        const maxDist = Math.max(80, ...allPts.map(n => Math.sqrt((n.x - cx) ** 2 + (n.y - cy) ** 2))) + 50;
        const color = colors[hub.category] || "#6ee7b7";
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxDist);
        grad.addColorStop(0, color + "12");
        grad.addColorStop(0.7, color + "08");
        grad.addColorStop(1, color + "00");
        ctx.beginPath();
        ctx.fillStyle = grad;
        ctx.arc(cx, cy, maxDist, 0, Math.PI * 2);
        ctx.fill();
      }

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
          const radius = 18;
          const glow = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, radius * 5);
          glow.addColorStop(0, color + "40");
          glow.addColorStop(0.5, color + "15");
          glow.addColorStop(1, color + "00");
          ctx.beginPath(); ctx.fillStyle = glow;
          ctx.arc(node.x, node.y, radius * 5, 0, Math.PI * 2); ctx.fill();

          const pulseRadius = radius + 4 + Math.sin(time * 1.5) * 3;
          ctx.beginPath(); ctx.strokeStyle = color + "50"; ctx.lineWidth = 2;
          ctx.arc(node.x, node.y, pulseRadius, 0, Math.PI * 2); ctx.stroke();

          ctx.beginPath(); ctx.fillStyle = color;
          ctx.shadowColor = color; ctx.shadowBlur = 20;
          ctx.arc(node.x, node.y, radius, 0, Math.PI * 2); ctx.fill();
          ctx.shadowBlur = 0;

          ctx.beginPath(); ctx.fillStyle = "#ffffff60";
          ctx.arc(node.x, node.y, 5, 0, Math.PI * 2); ctx.fill();

          ctx.font = "bold 14px Outfit, sans-serif";
          ctx.textAlign = "center";
          const labelW = ctx.measureText(node.label).width + 16;
          const labelH = 26;
          const ly = node.y - radius - 16;
          ctx.fillStyle = color + "30";
          ctx.beginPath();
          ctx.roundRect(node.x - labelW / 2, ly - labelH / 2, labelW, labelH, 13);
          ctx.fill();
          ctx.strokeStyle = color + "60"; ctx.lineWidth = 1; ctx.stroke();
          ctx.fillStyle = "#ffffff";
          ctx.fillText(node.label, node.x, ly + 5);
        } else {
          const radius = 5 + node.importance * 2;
          const glow = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, radius * 3);
          glow.addColorStop(0, color + "25");
          glow.addColorStop(1, color + "00");
          ctx.beginPath(); ctx.fillStyle = glow;
          ctx.arc(node.x, node.y, radius * 3, 0, Math.PI * 2); ctx.fill();

          const orbitRadius = radius * 2;
          const speed = 0.8 + idx * 0.2;
          ctx.beginPath(); ctx.fillStyle = color + "60";
          ctx.arc(
            node.x + Math.cos(time * speed) * orbitRadius,
            node.y + Math.sin(time * speed) * orbitRadius,
            1.5, 0, Math.PI * 2
          ); ctx.fill();

          ctx.beginPath(); ctx.fillStyle = color;
          ctx.shadowColor = color; ctx.shadowBlur = 8;
          ctx.arc(node.x, node.y, radius, 0, Math.PI * 2); ctx.fill();
          ctx.shadowBlur = 0;

          ctx.font = "11px Outfit, sans-serif";
          ctx.textAlign = "center";
          const maxWidth = 140;
          const lineHeight = 13;
          const maxLines = 4;
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
  }, [isEmpty, selectedCategory]);

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
  const currentCatEmoji = availableCategories.find(c => c.key === selectedCategory)?.label.split(" ")[0] || "📌";

  return (
    <div className="relative h-full w-full">
      {/* Category selector */}
      <div className="absolute top-3 left-3 z-10">
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-[200px] border-border/50 bg-card/90 backdrop-blur-sm text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            {availableCategories.map(cat => (
              <SelectItem key={cat.key} value={cat.key}>
                <span className="flex items-center gap-2">
                  <FluentEmoji emoji={cat.label.split(" ")[0]} size={16} />
                  <span>{cat.label.split(" ").slice(1).join(" ")}</span>
                  <span className="text-muted-foreground text-xs">({cat.count})</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <canvas
        ref={canvasRef}
        className="h-full w-full cursor-grab active:cursor-grabbing"
        style={{ background: "transparent", touchAction: "none" }}
      />

      <Dialog open={!!selectedMemory} onOpenChange={(open) => {
        if (!open) { setSelectedMemory(null); setMoveTarget(""); setAiRecommendation(null); }
      }}>
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

          {/* Move category section */}
          <div className="mt-3 pt-3 border-t border-border/50 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <ArrowRightLeft className="h-3.5 w-3.5" />
              Mover para outra categoria
            </div>

            {/* AI Recommendation */}
            {!aiRecommendation && !loadingRec && (
              <button
                onClick={async () => {
                  if (!selectedMemory) return;
                  setLoadingRec(true);
                  try {
                    const { data: { session: s } } = await supabase.auth.getSession();
                    const token = s?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
                    const allCats = [...LIFE_CATEGORIES, FALLBACK_CATEGORY]
                      .filter(c => c.key !== selectedMemory.category)
                      .map(c => c.key)
                      .join(", ");
                    const resp = await fetch(
                      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/summarize-memory`,
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                        body: JSON.stringify({
                          userMessage: `A memória "${selectedMemory.label}" está na categoria "${selectedMemory.category}". Qual dessas categorias faria mais sentido? Categorias disponíveis: ${allCats}. Responda APENAS com a key da categoria, sem explicação.`,
                          userName: "",
                          mode: "memory",
                        }),
                      }
                    );
                    if (resp.ok) {
                      const { summary } = await resp.json();
                      const rec = summary.trim().toLowerCase().replace(/[^a-záàâãéèêíïóôõúüç]/g, "");
                      const validCat = [...LIFE_CATEGORIES, FALLBACK_CATEGORY].find(c => c.key === rec);
                      if (validCat && validCat.key !== selectedMemory.category) {
                        setAiRecommendation(validCat.key);
                        setMoveTarget(validCat.key);
                      }
                    }
                  } catch { /* ignore */ }
                  setLoadingRec(false);
                }}
                className="flex items-center gap-2 text-xs text-primary hover:text-primary/80 transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Ver recomendação da IA
              </button>
            )}
            {loadingRec && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Analisando...
              </div>
            )}
            {aiRecommendation && (() => {
              const recCat = [...LIFE_CATEGORIES, FALLBACK_CATEGORY].find(c => c.key === aiRecommendation);
              return recCat ? (
                <div className="flex items-center gap-2 text-xs">
                  <Sparkles className="h-3 w-3 text-primary" />
                  <span className="text-muted-foreground">IA recomenda:</span>
                  <span className="font-medium text-foreground">{recCat.label}</span>
                </div>
              ) : null;
            })()}

            {/* Category selector */}
            <Select value={moveTarget} onValueChange={setMoveTarget}>
              <SelectTrigger className="w-full text-sm">
                <SelectValue placeholder="Selecionar categoria..." />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {[...LIFE_CATEGORIES, FALLBACK_CATEGORY]
                  .filter(c => c.key !== selectedMemory?.category)
                  .map(cat => (
                    <SelectItem key={cat.key} value={cat.key}>
                      <span className="flex items-center gap-2">
                        <FluentEmoji emoji={cat.label.split(" ")[0]} size={16} />
                        <span>{cat.label.split(" ").slice(1).join(" ")}</span>
                        {cat.key === aiRecommendation && (
                          <span className="text-[10px] text-primary font-medium ml-1">Recomendado</span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>

            <button
              disabled={!moveTarget || moving}
              onClick={async () => {
                if (!selectedMemory || !moveTarget) return;
                setMoving(true);
                try {
                  await supabase.from("memories").update({ category: moveTarget }).eq("id", selectedMemory.id);
                  // Refresh the graph
                  setSelectedMemory(null);
                  setMoveTarget("");
                  setAiRecommendation(null);
                  // Re-fetch memories
                  const { data: memories } = await supabase.from("memories").select("id, content, category").eq("user_id", user!.id);
                  if (memories && memories.length > 0) {
                    const categorized: CategorizedMemory[] = memories.map(m => {
                      if (m.category) {
                        const cat = LIFE_CATEGORIES.find(c => c.key === m.category) || FALLBACK_CATEGORY;
                        return { id: m.id, content: m.content, cat };
                      }
                      return { id: m.id, content: m.content, cat: categorizeMemory(m.content) };
                    });
                    const groups: Record<string, CategorizedMemory[]> = {};
                    categorized.forEach(m => {
                      if (!groups[m.cat.key]) groups[m.cat.key] = [];
                      groups[m.cat.key].push(m);
                    });
                    groupsRef.current = groups;
                    const cats = Object.keys(groups).map(key => {
                      const cat = groups[key][0].cat;
                      return { key, label: cat.label, color: cat.color, count: groups[key].length };
                    });
                    setAvailableCategories(cats);
                    // Switch to target category if it exists
                    if (groups[moveTarget]) setSelectedCategory(moveTarget);
                  }
                  const { toast } = await import("sonner");
                  toast.success("Memória movida!");
                } catch {
                  const { toast } = await import("sonner");
                  toast.error("Erro ao mover memória");
                }
                setMoving(false);
              }}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground py-2 text-sm font-medium disabled:opacity-40 hover:bg-primary/90 transition-colors"
            >
              {moving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
              Mover
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
