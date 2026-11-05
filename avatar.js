// Avatares de Horália: personagens em pixel art desenhados à mão por classe, variante, penteado e fase.
// Cada imagem em horalia/ (uma por classe, variante e penteado, com as 4 fases lado a lado) guarda as cores normais nos pixels de opacidade 255 e marca, pela opacidade,
// os pixels que o app pinta: 254 = pele (nível no vermelho), 253 = cabelo (nível no vermelho), 252 = traje (cor original).
// O app pinta pele, cabelo e traje com as cores escolhidas e guarda o resultado em memória.

import BOXES from "./horalia-boxes.js?v=13";

export const CLASSES = {
  guardiao: { n: "Guardião", f: "Guardiã", color: "#FFBD65", motto: "Um dia de cada vez, sem falhar.",
    fit: "Hábitos e missões diárias.", perkName: "Escudo extra", perk: "2 escudos de sequência por semana, em vez de 1.",
    tiers: ["Escudeiro", "Sentinela", "Cavaleiro", "Paladino"] },
  arcanista: { n: "Arcanista", f: "Arcanista", color: "#2FD0C8", motto: "Foco é a magia mais rara.",
    fit: "Estudo, leitura e tarefas que pedem concentração.", perkName: "Estudo concentrado", perk: "+5 XP em cada missão difícil concluída.",
    tiers: ["Aprendiz", "Conjurador", "Mago", "Arquimago"] },
  batedor: { n: "Batedor", f: "Batedora", color: "#9BE36B", motto: "Chegar antes é metade da vitória.",
    fit: "Prazos, compromissos e missões rápidas.", perkName: "Passo à frente", perk: "+5 XP ao concluir uma missão antes do prazo.",
    tiers: ["Andarilho", "Batedor", "Patrulheiro", "Mestre da Mata"] },
  artifice: { n: "Artífice", f: "Artífice", color: "#E8955A", motto: "Peça por peça, a obra fica de pé.",
    fit: "Projetos com várias etapas e subtarefas.", perkName: "Obra completa", perk: "+5 XP ao concluir uma missão com todas as subtarefas feitas.",
    tiers: ["Ferramenteiro", "Engenhoqueiro", "Mestre-Artesão", "Engenheiro Arcano"] },
};
export const HAIRSTYLES = {
  f: [["longo", "Longo"], ["rabo", "Rabo de cavalo"], ["cacheado", "Cacheado"], ["afro", "Afro"]],
  m: [["curto", "Curto"], ["raspado", "Raspado"], ["cacheado", "Cacheado"], ["afro", "Afro"]],
};
export const TIERS = [["Aprendiz", 1], ["Aventureiro", 5], ["Veterano", 10], ["Lendário", 20]];
export const tierFor = (level) => (level >= 20 ? 4 : level >= 10 ? 3 : level >= 5 ? 2 : 1);

// [nome, luz, base, sombra, sombra profunda]
export const SKIN_TONES = [
  ["Clara", "#FCE4D2", "#F4CCAE", "#E2A784", "#C58163"],
  ["Clara média", "#F5CFAE", "#E8B188", "#CF8D64", "#AD6A49"],
  ["Média", "#E6B68D", "#D0976A", "#B0754C", "#8C5636"],
  ["Morena", "#C88E63", "#AA6E46", "#8A5232", "#683A22"],
  ["Escura", "#A06A47", "#7F4F31", "#623822", "#462314"],
  ["Retinta", "#7E5034", "#603A23", "#472817", "#2F190D"],
];
export const HAIR_TONES = [
  ["Preto", "#2B2229"], ["Castanho escuro", "#4B2E1E"], ["Castanho", "#7B4A28"], ["Ruivo", "#B9472A"],
  ["Loiro", "#E2B44C"], ["Grisalho", "#CBC6BF"], ["Azul", "#3E66D0"], ["Rosa", "#E05AA0"],
];
// [nome, matiz (null = original), fator de saturação, fator de luz]
export const OUTFITS = [
  ["Original", null, 1, 1], ["Roxo", 270, 1, 1], ["Vinho", 345, 0.85, 0.92], ["Azul", 220, 1, 1],
  ["Verde", 125, 0.85, 1], ["Turquesa", 178, 1, 1], ["Dourado", 44, 1, 1.08], ["Sombra", 250, 0.18, 0.62],
];
export const PETS = [
  ["nenhum", "Sem companheiro", ""],
  ["brotinho", "Brotinho", "Slime com um broto na cabeça"],
  ["brasa", "Brasa", "Raposa esperta"],
  ["nuvem", "Nuvem", "Gato cinza listrado"],
  ["pena", "Pena", "Coruja dos estudos"],
  ["tic", "Tic", "Robozinho de corda"],
  ["faisca", "Faísca", "Filhote de dragão"],
];
export const BGS = ["guilda", "#F4A9A8", "#E7BA80", "#A3B4A6", "#A9C6E6", "#C7B6E6", "#B7D99F", "#EFEAE2", "#173239"];
export const FRAMES = {
  nenhuma: ["Sem moldura", null],
  bronze: ["Bronze", "#D08A4E"],
  prata: ["Prata", "#B9C8CC"],
  ouro: ["Ouro", "#FFBD65"],
  diamante: ["Diamante", "#7FE6FF"],
};
export const MOODS = {
  calmo: { name: "Dia tranquilo", ring: "#2FD0C8" },
  focado: { name: "Dia movimentado", ring: "#FFBD65" },
  estressado: { name: "Dia puxado", ring: "#FF7A6B" },
};

export const DEFAULT_AVATAR = { v: 2, cls: "arcanista", sex: "f", hs: "cacheado", skin: 3, hair: 1, outfit: 0, pet: "nenhum", bg: 0, frame: "nenhuma", since: "", clsAt: 0, hist: [] };

const OLD_HAIR = [0, 1, 2, 4, 3, 6, 6, 5]; // cores do avatar antigo → novas
export function cleanAvatar(raw) {
  let a = raw || {};
  if (a.v !== 2) {
    // avatar antigo: aproveita pele, cor do cabelo, fundo e moldura
    const sex = a.lashes === "sim" || (a.lips && a.lips !== "nao") ? "f" : a.beard && a.beard !== "nenhuma" ? "m" : "f";
    a = { ...DEFAULT_AVATAR, sex, hs: sex === "f" ? "longo" : "curto",
      skin: Number.isInteger(a.skin) ? a.skin : 3, hair: Number.isInteger(a.hairC) ? OLD_HAIR[a.hairC] ?? 1 : 1,
      bg: Number.isInteger(a.bg) ? a.bg + 1 : 0, frame: a.frame };
  }
  const idx = (v, n, d = 0) => (Number.isInteger(v) && v >= 0 && v < n ? v : d);
  const cls = a.cls in CLASSES ? a.cls : "arcanista";
  const sex = a.sex === "m" ? "m" : "f";
  const hs = HAIRSTYLES[sex].some(([k]) => k === a.hs) ? a.hs : HAIRSTYLES[sex][0][0];
  return {
    v: 2, cls, sex, hs,
    skin: idx(a.skin, SKIN_TONES.length, 3), hair: idx(a.hair, HAIR_TONES.length, 1), outfit: idx(a.outfit, OUTFITS.length),
    pet: PETS.some(([k]) => k === a.pet) ? a.pet : "nenhum", bg: idx(a.bg, BGS.length), frame: a.frame in FRAMES ? a.frame : "nenhuma",
    since: typeof a.since === "string" && a.since.length === 10 ? a.since : "",
    clsAt: typeof a.clsAt === "number" ? a.clsAt : 0,
    hist: Array.isArray(a.hist) ? a.hist.filter((e) => typeof e === "string" && e.length <= 24).slice(-20) : [],
  };
}
export const classLabel = (a) => { const c = CLASSES[a.cls]; return a.sex === "f" ? c.f : c.n; };
export const tierTitle = (a, level) => CLASSES[a.cls].tiers[tierFor(level) - 1];

/* ---------- cores ---------- */
const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
function satLight(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  return [d ? (l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn)) : 0, l];
}
function fromHsl(h, s, l) {
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}
function hairRamp(hex) {
  const b = rgb(hex), lum = (b[0] + b[1] + b[2]) / 3 / 255, dark = lum < 0.25;
  const hi = b.map((v) => Math.min(255, v * (dark ? 1.55 : 1.22) + (dark ? 26 : 12)));
  return [hi, b, b.map((v) => v * 0.72)];
}
function skinRamp(i) {
  const r = SKIN_TONES[i].slice(1).map(rgb), blush = rgb("#C2564F");
  return [...r, r[3].map((v) => v * 0.85), blush.map((v, k) => v * 0.4 + r[1][k] * 0.6)];
}

/* ---------- carregamento e pintura ---------- */
const base = new URL("./horalia/", import.meta.url).href;
const imgs = new Map();   // arquivo -> Promise<HTMLImageElement>
const urls = new Map();   // chave da imagem pronta -> data URL
const jobs = new Map();   // chave -> Promise
function loadImg(file) {
  if (!imgs.has(file)) imgs.set(file, new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = base + file; }));
  return imgs.get(file);
}
const spriteName = (a, tier) => `${a.cls}-${a.sex}-${a.hs}-${tier}`;
const PET_FILE = { brotinho: 5, brasa: 1, nuvem: 4, pena: 2, tic: 6, faisca: 3 };

async function paint(a, tier) {
  // cada arquivo traz as 4 fases lado a lado (380 px cada)
  const im = await loadImg(`${a.cls}-${a.sex}-${a.hs}.png`);
  const c = document.createElement("canvas"); c.width = 380; c.height = 380;
  const x = c.getContext("2d", { willReadFrequently: true });
  x.drawImage(im, (tier - 1) * 380, 0, 380, 380, 0, 0, 380, 380);
  const d = x.getImageData(0, 0, c.width, c.height), p = d.data;
  const sk = skinRamp(a.skin), hr = hairRamp(HAIR_TONES[a.hair][1]);
  const [, hue, sm, lm] = OUTFITS[a.outfit];
  for (let i = 0; i < p.length; i += 4) {
    const al = p[i + 3];
    if (al === 255 || al === 0 || al < 250) continue;
    let col;
    if (al === 254) col = sk[Math.min(5, Math.round(p[i] / 50))];
    else if (al === 253) col = hr[Math.min(2, Math.round(p[i] / 80))];
    else if (al === 252) {
      if (hue === null) { p[i + 3] = 255; continue; }
      const [s, l] = satLight(p[i], p[i + 1], p[i + 2]);
      col = fromHsl(hue, Math.min(1, s * sm), Math.min(0.95, l * lm));
    } else { p[i + 3] = 255; continue; }
    p[i] = col[0]; p[i + 1] = col[1]; p[i + 2] = col[2]; p[i + 3] = 255;
  }
  x.putImageData(d, 0, 0);
  return c;
}

// Monta a imagem final: "full" (corpo inteiro, com companheiro) ou "face" (retrato).
async function build(a, tier, view) {
  const src = await paint(a, tier);
  const name = spriteName(a, tier);
  const out = document.createElement("canvas");
  const o = out.getContext("2d");
  if (view === "face") {
    const [bx, by, side] = BOXES[name] || [0, 0, 380];
    out.width = out.height = 160;
    o.imageSmoothingEnabled = true; o.imageSmoothingQuality = "high";
    o.drawImage(src, bx, by, side, side, 0, 0, 160, 160);
  } else {
    out.width = out.height = 380;
    o.drawImage(src, 0, 0);
    if (a.pet !== "nenhum" && (tier < 4 || a.cls === "guardiao")) { // na fase lendária as outras classes já vêm com um bichinho
      const pet = await loadImg("pet-" + PET_FILE[a.pet] + ".png");
      const h = 104, w = pet.width * h / pet.height;
      o.imageSmoothingEnabled = false;
      o.drawImage(pet, 380 - w - 44, 380 - h - 30, w, h);
    }
  }
  return out.toDataURL("image/png");
}

const BLANK = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
const keyOf = (a, tier, view) => [a.cls, a.sex, a.hs, tier, a.skin, a.hair, a.outfit, view === "full" ? a.pet : "", view].join(".");
function ensure(a, tier, view) {
  const k = keyOf(a, tier, view);
  if (urls.has(k) || jobs.has(k)) return k;
  jobs.set(k, build(a, tier, view).then((u) => {
    urls.set(k, u); jobs.delete(k);
    document.querySelectorAll('img[data-avk="' + k + '"]').forEach((el) => { el.src = u; el.classList.add("on"); });
  }).catch(() => jobs.delete(k)));
  return k;
}

// Emoji do humor, escolhido pela quantidade de missões pendentes do dia.
export function moodEmoji(pending) {
  if (pending <= 0) return ["😎", "Tudo feito por hoje"];
  if (pending <= 2) return ["🙂", "Dia tranquilo"];
  if (pending <= 5) return ["😤", "Dia movimentado"];
  if (pending <= 8) return ["😰", "Dia puxado"];
  return ["🥵", "Dia muito puxado"];
}

// HTML do avatar. view: "full" (corpo inteiro) ou "face" (retrato, para listas).
// pending: número de missões pendentes (mostra o emoji em balão); null não mostra.
export function avatarHtml(raw, { size = 120, level = 1, view = "full", pending = null, title = "", tier = null } = {}) {
  const a = cleanAvatar(raw);
  const t = tier || tierFor(level);
  const k = ensure(a, t, view);
  const u = urls.get(k);
  const bg = BGS[a.bg], frame = FRAMES[a.frame][1];
  const style = "width:" + size + "px;height:" + size + "px;" + (bg === "guilda" ? "" : "--avbg:" + bg + ";") + (frame ? "--frame:" + frame + ";--fw:" + Math.max(2, Math.round(size * 0.05)) + "px;" : "");
  const em = pending === null ? null : moodEmoji(pending);
  const fx = em ? '<span class="moodpop" title="' + em[1] + '" aria-label="' + em[1] + '">' + em[0] + "</span>" : "";
  return '<span class="hav ' + view + (bg === "guilda" ? " guild" : "") + (frame ? " framed" : "") + '" style="' + style + '" role="img" aria-label="' + (title || classLabel(a)).replace(/"/g, "&quot;") + '">' +
    '<img alt="" data-avk="' + k + '" src="' + (u || BLANK) + '"' + (u ? ' class="on"' : "") + ">" + fx + "</span>";
}
// Pré-carrega as imagens de um avatar (para a primeira pintura ser rápida).
export function warmAvatar(raw, level = 1) { const a = cleanAvatar(raw), t = tierFor(level); ensure(a, t, "full"); ensure(a, t, "face"); }
export const PET_SRC = (k) => base + "pet-" + PET_FILE[k] + ".png";
