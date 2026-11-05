// Ícones das missões, cores das tags e animações.

// Ícones de traço (viewBox 24). Chave curta -> [nome, caminho SVG]
export const ICONS = {
  livro: ["Estudo", "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5M8 7h7"],
  treino: ["Treino", "M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12"],
  trabalho: ["Trabalho", "M3 8h18v11H3zM8 8V5h8v3M3 13h18"],
  compras: ["Compras", "M3 4h2l2 11h11l2-8H6M8 20a1 1 0 1 0 2 0a1 1 0 1 0-2 0M16 20a1 1 0 1 0 2 0a1 1 0 1 0-2 0"],
  ligacao: ["Ligação", "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z"],
  email: ["E-mail", "M3 6h18v12H3zM3 7l9 6 9-6"],
  saude: ["Saúde", "M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"],
  casa: ["Casa", "M3 11l9-7 9 7M5 10v10h14V10M10 20v-6h4v6"],
  codigo: ["Código", "M8 8l-4 4 4 4M16 8l4 4-4 4M14 5l-4 14"],
  dinheiro: ["Finanças", "M3 7h18v10H3zM9.5 12a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0M6 10v4M18 10v4"],
  musica: ["Música", "M9 18V5l11-2v13M3 18a3 3 0 1 0 6 0a3 3 0 1 0-6 0M14 16a3 3 0 1 0 6 0a3 3 0 1 0-6 0"],
  viagem: ["Viagem", "M2 12l20-8-7 17-3-7zM12 14l3-3"],
  comida: ["Comida", "M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 0-3 3-3 6s1 4 3 4v8"],
  remedio: ["Remédio", "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM12 8v8M8 12h8"],
  pessoas: ["Pessoas", "M6 8a3 3 0 1 0 6 0a3 3 0 1 0-6 0M3 20c.6-3.5 3-5.5 6-5.5s5.4 2 6 5.5M15.5 5.5a2.5 2.5 0 1 1 0 5M18 14.5c2 .5 3 2.3 3.4 5"],
  estrela: ["Destaque", "M12 3l2.6 5.6 6.1.6-4.6 4.1 1.3 6L12 16.3l-5.4 3 1.3-6-4.6-4.1 6.1-.6z"],
  limpeza: ["Limpeza", "M14 4l6 6M17 7l-9 9M8 16l-4 4h5l3-3"],
  agenda: ["Compromisso", "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4"],
  planta: ["Natureza", "M5 20c0-8 6-15 15-15c0 9-6 15-14 15M5 20l7-7"],
  carro: ["Carro", "M4 16v-4l2-5h12l2 5v4zM4 16v2M20 16v2M7.5 13h.01M16.5 13h.01"],
};
export function iconSvg(key, cls = "ico") {
  const it = ICONS[key]; if (!it) return "";
  return '<svg class="' + cls + '" viewBox="0 0 24 24" aria-hidden="true"><path d="' + it[1] + '"/></svg>';
}

// Cores das tags (fundo do chip e do cartão cheio; o texto em cima é sempre escuro).
export const TAG_COLORS = [
  ["#02A0A0", "Turquesa"], ["#FFBD65", "Laranja"], ["#FF8A7A", "Coral"], ["#B9A3FF", "Lilás"],
  ["#9BE36B", "Verde"], ["#6EC8FF", "Azul"], ["#FF8FC8", "Rosa"], ["#F5E06E", "Amarelo"],
  ["#2FD0C8", "Água"], ["#E8955A", "Cobre"], ["#FF6B6B", "Vermelho"], ["#8C9EFF", "Anil"],
  ["#C6E377", "Lima"], ["#D7B98E", "Areia"], ["#C9D9DA", "Névoa"], ["#F2A65A", "Abóbora"],
];
// A cor da tag pode ser um número da paleta ou uma cor livre "#rrggbb".
export const tagColor = (c) => (typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c) ? c : (TAG_COLORS[c] || TAG_COLORS[0])[0]);
export const tagColorName = (c) => (typeof c === "string" ? "cor personalizada" : (TAG_COLORS[c] || TAG_COLORS[0])[1]);
// Cores livres muito escuras ficam mais claras, porque o texto em cima delas é sempre escuro.
export function readableTagColor(hex) {
  const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255];
  const lum = (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
  if (lum >= 0.45) return hex.toLowerCase();
  const t = Math.min(0.85, (0.45 - lum) / (1 - lum) + 0.08);
  return "#" + c.map((v) => Math.round(v + (255 - v) * t).toString(16).padStart(2, "0")).join("");
}

/* ---------- animações (respeitam "reduzir movimento") ---------- */
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// Explosão de partículas a partir de um ponto (ao concluir e ao subir de nível).
export function burst(x, y, { count = 14, colors = ["#02A0A0", "#FFBD65", "#2FD0C8"], spread = 70 } = {}) {
  if (reduced()) return;
  for (let i = 0; i < count; i++) {
    const p = document.createElement("span");
    p.className = "spark";
    const a = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const d = spread * (0.6 + Math.random() * 0.6);
    p.style.left = x + "px"; p.style.top = y + "px";
    p.style.background = colors[i % colors.length];
    p.style.setProperty("--dx", Math.cos(a) * d + "px");
    p.style.setProperty("--dy", Math.sin(a) * d + "px");
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 800);
  }
}

// Chuva de confete na tela toda (subir de nível).
export function confetti() {
  if (reduced()) return;
  const colors = TAG_COLORS.map((c) => c[0]);
  const w = innerWidth;
  for (let i = 0; i < 60; i++) {
    const p = document.createElement("span");
    p.className = "confetti";
    p.style.left = Math.random() * w + "px";
    p.style.background = colors[i % colors.length];
    p.style.animationDelay = Math.random() * 0.4 + "s";
    p.style.animationDuration = 1.4 + Math.random() * 1.2 + "s";
    p.style.setProperty("--rot", (Math.random() * 720 - 360) + "deg");
    p.style.setProperty("--drift", (Math.random() * 120 - 60) + "px");
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 3200);
  }
}

// Contagem do número de XP (de um valor ao outro).
export function countTo(el, to) {
  const from = Number(el.dataset.v || to);
  el.dataset.v = to;
  if (reduced() || from === to) { el.textContent = to.toLocaleString("pt-BR"); return; }
  const t0 = performance.now(), dur = 650;
  const step = (t) => {
    const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    el.textContent = Math.round(from + (to - from) * e).toLocaleString("pt-BR");
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
