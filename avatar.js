// Avatar em pixel art: personagem chibi de corpo inteiro, numa grade de 32x32.
// Cada peça pinta pixels na grade; no fim o contorno escuro é gerado sozinho.
// O resultado vira um SVG de retângulos (nítido em qualquer tamanho).

const N = 32;
const INK = "#1E1620";

export const SKINS = ["#FBDCC6", "#F2C29C", "#DFA275", "#B97A50", "#8A5636", "#5C3824"];
export const HAIR_COLORS = ["#2B2430", "#5A3A26", "#A0622D", "#E9A74A", "#D4532F", "#7058C8", "#2B7E86", "#E6E1DA"];
export const CLOTH_COLORS = ["#6A3FC2", "#1F8E97", "#F0A649", "#E8604E", "#3E70D1", "#4E9A55", "#EEE9E0", "#2E2B36", "#EC8FB4", "#8C5634"];
export const BG_COLORS = ["#F4A9A8", "#E7BA80", "#A3B4A6", "#A9C6E6", "#C7B6E6", "#B7D99F", "#EFEAE2", "#173239"];

/* ---------- cores ---------- */
function rgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
function hex([r, g, b]) { return "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join(""); }
const shade = (h, f) => hex(rgb(h).map((v) => v * f));
const mix = (a, b, t) => { const A = rgb(a), B = rgb(b); return hex(A.map((v, i) => v + (B[i] - v) * t)); };

/* ---------- pintura ---------- */
function canvas() {
  const g = new Array(N * N).fill(null);
  const set = (x, y, c) => { if (c && x >= 0 && y >= 0 && x < N && y < N) g[y * N + x] = c; };
  const rect = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, c); };
  const row = (y, x0, x1, c) => { for (let x = x0; x <= x1; x++) set(x, y, c); };
  const get = (x, y) => (x >= 0 && y >= 0 && x < N && y < N ? g[y * N + x] : null);
  const pts = (list, c) => list.forEach(([x, y]) => set(x, y, c));
  return { g, set, rect, row, get, pts };
}

/* ---------- corpo base ---------- */
function drawHead(p, skin) {
  const sh = shade(skin, 0.88);
  p.row(6, 11, 20, skin); p.row(7, 10, 21, skin);
  p.rect(9, 8, 14, 8, skin);
  p.row(16, 10, 21, skin);
  p.row(16, 10, 11, sh); p.row(16, 20, 21, sh); p.set(9, 15, sh); p.set(22, 15, sh);
  p.rect(8, 11, 1, 3, skin); p.rect(23, 11, 1, 3, skin); // orelhas
  p.set(8, 12, sh); p.set(23, 12, sh);
}
const BLUSH = (p) => { p.set(11, 14, "#F28C8C"); p.set(20, 14, "#F28C8C"); };

/* ---------- rosto ---------- */
const EYE_L = 12, EYE_R = 18, EYE_Y = 11;
export const EYES = {
  pontos: ["Pontos", (p) => { p.rect(EYE_L, EYE_Y, 1, 2, INK); p.rect(EYE_R + 1, EYE_Y, 1, 2, INK); }],
  brilho: ["Com brilho", (p) => { p.rect(EYE_L, EYE_Y, 2, 2, INK); p.rect(EYE_R, EYE_Y, 2, 2, INK); p.set(EYE_L, EYE_Y, "#FFFFFF"); p.set(EYE_R, EYE_Y, "#FFFFFF"); }],
  felizes: ["Felizes", (p) => { p.pts([[EYE_L - 1, EYE_Y + 1], [EYE_L, EYE_Y], [EYE_L + 1, EYE_Y + 1], [EYE_R, EYE_Y + 1], [EYE_R + 1, EYE_Y], [EYE_R + 2, EYE_Y + 1]], INK); }],
  grandes: ["Grandes", (p) => { p.rect(EYE_L - 1, EYE_Y - 1, 3, 3, "#FFFFFF"); p.rect(EYE_R, EYE_Y - 1, 3, 3, "#FFFFFF"); p.rect(EYE_L, EYE_Y, 2, 2, INK); p.rect(EYE_R + 1, EYE_Y, 2, 2, INK); }],
  piscando: ["Piscando", (p) => { p.rect(EYE_L, EYE_Y, 1, 2, INK); p.row(EYE_Y + 1, EYE_R, EYE_R + 2, INK); }],
  serios: ["Sérios", (p) => { p.row(EYE_Y + 1, EYE_L - 1, EYE_L + 1, INK); p.row(EYE_Y + 1, EYE_R, EYE_R + 2, INK); }],
};
export const LASHES = {
  nao: ["Sem cílios", () => {}],
  sim: ["Cílios", (p) => { p.set(EYE_L - 1, EYE_Y - 1, INK); p.set(EYE_R + 2, EYE_Y - 1, INK); }],
};
export const MOUTHS = {
  nenhuma: ["Sem boca", () => {}],
  sorriso: ["Sorriso", (p, c) => { p.pts([[14, 14], [15, 15], [16, 15], [17, 14]], c); }],
  aberta: ["Animada", (p, c) => { p.row(14, 14, 17, c); p.rect(15, 15, 2, 1, "#B43A3A"); p.set(14, 15, c); p.set(17, 15, c); }],
  neutra: ["Neutra", (p, c) => { p.row(15, 15, 16, c); }],
  lingua: ["Língua", (p, c) => { p.pts([[14, 14], [15, 15], [16, 15], [17, 14]], c); p.set(16, 16, "#EF7A8C"); }],
};
export const LIPS = {
  nao: ["Sem batom", null],
  vermelho: ["Batom vermelho", "#C2334D"],
  rosa: ["Batom rosa", "#DF6A98"],
  vinho: ["Batom vinho", "#7E1F3B"],
};
export const BEARDS = {
  nenhuma: ["Sem barba", () => {}],
  rala: ["Barba rala", (p, hc, skin) => { const c = mix(skin, hc, 0.45); p.rect(9, 13, 2, 3, c); p.rect(21, 13, 2, 3, c); p.row(16, 11, 20, c); p.row(13, 14, 17, c); }],
  cheia: ["Barba cheia", (p, hc) => { p.rect(9, 12, 2, 5, hc); p.rect(21, 12, 2, 5, hc); p.row(16, 10, 21, hc); p.row(17, 11, 20, hc); p.row(18, 13, 18, hc); p.rect(11, 15, 10, 1, hc); p.row(13, 13, 18, hc); p.row(14, 12, 13, hc); p.row(14, 18, 19, hc); }],
  cavanhaque: ["Cavanhaque", (p, hc) => { p.row(13, 13, 18, hc); p.rect(14, 16, 4, 2, hc); }],
  bigode: ["Bigode", (p, hc) => { p.row(13, 13, 18, hc); p.set(12, 14, hc); p.set(19, 14, hc); }],
};

/* ---------- cabelo: [nome, atrás, por cima] ---------- */
function cap(p, c, top = 4) {
  const s = shade(c, 0.82);
  p.row(top, 11, 20, c); p.row(top + 1, 10, 21, c); p.rect(9, top + 2, 14, 8 - top, c);
  p.set(13, top + 1, mix(c, "#FFFFFF", 0.35)); p.set(14, top + 1, mix(c, "#FFFFFF", 0.35)); // brilho
  return s;
}
export const HAIRS = {
  curto: ["Curto", null, (p, c) => { const s = cap(p, c); p.row(8, 9, 22, c); p.set(9, 9, c); p.set(9, 10, s); p.set(22, 9, c); p.row(9, 12, 15, s); p.set(19, 9, s); }],
  degrade: ["Degradê", null, (p, c, skin) => { const f = mix(c, skin, 0.55); p.row(5, 11, 20, c); p.rect(10, 6, 12, 2, c); p.rect(9, 8, 1, 4, f); p.rect(22, 8, 1, 4, f); p.row(8, 10, 21, f); p.set(13, 6, mix(c, "#FFFFFF", 0.35)); }],
  moicano: ["Moicano", null, (p, c, skin) => { const f = mix(c, skin, 0.6); p.rect(9, 7, 14, 2, f); p.rect(14, 1, 4, 7, c); p.pts([[13, 3], [18, 2], [13, 5], [18, 5]], c); p.set(15, 1, mix(c, "#FFFFFF", 0.35)); }],
  topete: ["Topete", null, (p, c) => { const s = cap(p, c, 4); p.pts([[11, 3], [12, 2], [15, 2], [16, 1], [17, 2], [19, 3], [20, 3]], c); p.rect(9, 8, 4, 3, c); p.set(9, 11, c); p.set(12, 11, s); p.row(8, 13, 22, c); p.set(22, 9, c); p.set(21, 9, s); }],
  cacheado: ["Cacheado", null, (p, c) => { const s = cap(p, c, 4); p.pts([[10, 3], [12, 2], [15, 2], [18, 2], [21, 3], [8, 6], [8, 8], [23, 6], [23, 8], [8, 10], [23, 10]], c); p.row(8, 9, 22, c); p.pts([[10, 9], [13, 9], [16, 9], [19, 9], [22, 9]], c); p.pts([[11, 5], [16, 4], [20, 6], [12, 7], [18, 7]], s); }],
  franja: ["Franja", null, (p, c) => { const s = cap(p, c); p.rect(9, 8, 14, 2, c); p.pts([[10, 10], [12, 10], [14, 10], [17, 10], [19, 10], [21, 10]], c); p.row(9, 10, 21, s); p.set(9, 10, c); p.set(22, 10, c); p.rect(9, 10, 1, 3, c); p.rect(22, 10, 1, 3, c); }],
  chanel: ["Chanel", (p, c) => { p.rect(7, 9, 3, 8, shade(c, 0.85)); p.rect(22, 9, 3, 8, shade(c, 0.85)); }, (p, c) => { const s = cap(p, c); p.rect(9, 8, 14, 1, c); p.rect(9, 9, 5, 2, c); p.row(10, 14, 16, c); p.rect(8, 8, 2, 9, c); p.rect(22, 8, 2, 9, c); p.set(13, 10, s); }],
  longo: ["Longo", (p, c) => { const s = shade(c, 0.82); p.rect(7, 9, 3, 13, s); p.rect(22, 9, 3, 13, s); p.row(22, 8, 9, s); p.row(22, 22, 23, s); }, (p, c) => { const s = cap(p, c); p.rect(9, 8, 14, 1, c); p.rect(9, 9, 4, 2, c); p.rect(18, 9, 5, 2, c); p.rect(8, 8, 2, 10, c); p.rect(22, 8, 2, 10, c); p.set(12, 10, s); p.set(18, 10, s); }],
  cacheadolongo: ["Cacheado longo", (p, c) => { const s = shade(c, 0.82); for (let y = 8; y <= 22; y += 2) { p.rect(6, y, 4, 2, y % 4 ? c : s); p.rect(22, y, 4, 2, y % 4 ? c : s); } }, (p, c) => { const s = cap(p, c, 3); p.pts([[9, 2], [13, 1], [17, 1], [21, 2], [7, 5], [24, 5]], c); p.row(8, 9, 22, c); p.pts([[10, 9], [12, 9], [19, 9], [21, 9]], c); p.pts([[11, 4], [15, 3], [19, 5], [13, 6]], s); }],
  rabo: ["Rabo de cavalo", (p, c) => { const s = shade(c, 0.82); p.rect(3, 5, 6, 3, c); p.rect(2, 8, 5, 4, c); p.rect(3, 12, 4, 3, s); p.rect(4, 15, 2, 2, s); p.rect(8, 4, 3, 3, "#E0533A"); }, (p, c) => { const s = cap(p, c); p.rect(9, 8, 14, 1, c); p.rect(17, 9, 6, 2, c); p.set(9, 9, c); p.set(16, 9, s); p.set(22, 11, c); }],
  trancas: ["Tranças", (p, c) => { const s = shade(c, 0.8); for (let y = 11; y <= 23; y += 2) { p.rect(6, y, 3, 2, (y - 11) % 4 ? s : c); p.rect(23, y, 3, 2, (y - 11) % 4 ? s : c); } p.rect(6, 25, 3, 1, "#E0533A"); p.rect(23, 25, 3, 1, "#E0533A"); }, (p, c) => { const s = cap(p, c); p.rect(9, 8, 6, 2, c); p.rect(17, 8, 6, 2, c); p.row(8, 15, 16, s); p.rect(8, 8, 2, 4, c); p.rect(22, 8, 2, 4, c); }],
  coque: ["Coque", null, (p, c) => { const s = cap(p, c); p.rect(13, 0, 6, 4, c); p.row(3, 13, 18, s); p.row(8, 9, 22, c); p.rect(9, 9, 1, 2, c); p.rect(22, 9, 1, 2, c); p.set(14, 1, mix(c, "#FFFFFF", 0.35)); }],
  raspado: ["Raspado", null, (p, c, skin) => { const f = mix(c, skin, 0.55); p.row(5, 11, 20, f); p.rect(10, 6, 12, 2, f); p.rect(9, 8, 1, 3, f); p.rect(22, 8, 1, 3, f); }],
  careca: ["Careca", null, (p, c, skin) => { p.set(13, 7, mix(skin, "#FFFFFF", 0.5)); p.set(14, 7, mix(skin, "#FFFFFF", 0.5)); }],
};

/* ---------- roupa ---------- */
const SHOE = "#4A2E22", PANTS = "#353447", JEANS = "#3D5A99";
function legs(p, c, shoe = SHOE) { p.rect(12, 25, 3, 4, c); p.rect(17, 25, 3, 4, c); p.set(14, 25, shade(c, 0.85)); p.set(17, 25, shade(c, 0.85)); p.rect(11, 29, 4, 1, shoe); p.rect(17, 29, 4, 1, shoe); }
function torso(p, c, y0 = 17, y1 = 24) { p.rect(11, y0, 10, y1 - y0 + 1, c); }
function arms(p, c, skin, sleeve = 6) { const s = shade(c, 0.85); for (let y = 17; y <= 23; y++) { const col = y < 17 + sleeve ? c : skin; p.rect(9, y, 2, 1, col); p.rect(21, y, 2, 1, col); } p.rect(9, 23, 2, 1, skin); p.rect(21, 23, 2, 1, skin); if (sleeve > 0) { p.set(10, 18, s); p.set(21, 18, s); } }
export const BODIES = {
  moletom: ["Moletom", (p, c, skin) => { legs(p, PANTS); torso(p, c); arms(p, c, skin); const s = shade(c, 0.8); p.row(17, 13, 18, s); p.set(14, 18, "#FFFFFF"); p.set(17, 18, "#FFFFFF"); p.row(22, 13, 18, s); p.set(13, 23, s); p.set(18, 23, s); }],
  camiseta: ["Camiseta", (p, c, skin) => { legs(p, JEANS); torso(p, c); arms(p, c, skin, 2); p.row(17, 14, 17, shade(c, 0.78)); }],
  camisa: ["Camisa social", (p, c, skin) => { legs(p, PANTS); torso(p, c); arms(p, c, skin); const s = shade(c, 0.78); p.pts([[13, 17], [14, 18], [18, 17], [17, 18]], "#FFFFFF"); p.pts([[15, 19], [15, 21], [15, 23]], s); p.row(24, 11, 20, "#5A3A26"); }],
  blusa: ["Blusa", (p, c, skin) => { legs(p, JEANS); torso(p, c); arms(p, c, skin, 2); p.rect(9, 17, 2, 2, c); p.rect(21, 17, 2, 2, c); p.row(17, 13, 18, skin); p.row(18, 14, 17, skin); p.set(15, 20, "#FFFFFF"); p.row(23, 11, 20, shade(c, 0.82)); }],
  regata: ["Regata", (p, c, skin) => { legs(p, PANTS); torso(p, c); arms(p, skin, skin, 0); p.rect(11, 17, 1, 2, skin); p.rect(20, 17, 1, 2, skin); p.row(17, 14, 17, skin); }],
  vestido: ["Vestido", (p, c, skin) => { p.rect(12, 26, 3, 3, skin); p.rect(17, 26, 3, 3, skin); p.rect(11, 29, 4, 1, SHOE); p.rect(17, 29, 4, 1, SHOE); torso(p, c, 17, 22); p.rect(10, 23, 12, 3, c); p.row(25, 10, 21, shade(c, 0.82)); arms(p, skin, skin, 0); p.row(17, 13, 18, skin); p.set(12, 17, c); p.set(19, 17, c); p.set(15, 22, "#FFFFFF"); p.set(16, 22, "#FFFFFF"); }],
  jardineira: ["Jardineira", (p, c, skin) => { legs(p, c); torso(p, "#F4F1EA"); arms(p, "#F4F1EA", skin, 2); p.rect(12, 20, 8, 5, c); p.rect(12, 17, 1, 3, c); p.rect(19, 17, 1, 3, c); p.set(13, 20, "#FFD36A"); p.set(18, 20, "#FFD36A"); p.row(22, 14, 17, shade(c, 0.8)); }],
  cropped: ["Cropped", (p, c, skin) => { legs(p, JEANS); torso(p, skin); torso(p, c, 17, 21); arms(p, c, skin, 2); p.row(17, 14, 17, shade(c, 0.78)); p.set(15, 23, shade(skin, 0.8)); p.row(24, 11, 20, JEANS); }],
  jaqueta: ["Jaqueta", (p, c, skin) => { legs(p, shade(c, 0.6)); torso(p, c); arms(p, c, skin); p.rect(14, 17, 4, 8, "#2E2B36"); p.pts([[13, 17], [13, 18], [18, 17], [18, 18]], shade(c, 0.75)); p.pts([[12, 21], [19, 21]], shade(c, 0.75)); }],
  terno: ["Terno", (p, c, skin) => { legs(p, c); torso(p, c); arms(p, c, skin); p.rect(14, 17, 4, 4, "#F4F4F4"); p.rect(15, 17, 2, 6, "#C8372D"); p.set(15, 17, "#F4F4F4"); p.set(16, 17, "#F4F4F4"); p.pts([[13, 17], [13, 18], [18, 17], [18, 18]], shade(c, 1.25)); }],
  tunica: ["Túnica", (p, c, skin) => { p.rect(12, 27, 3, 2, "#6B4A2F"); p.rect(17, 27, 3, 2, "#6B4A2F"); p.rect(11, 29, 4, 1, SHOE); p.rect(17, 29, 4, 1, SHOE); torso(p, c, 17, 26); p.rect(10, 24, 12, 3, c); arms(p, c, skin); p.row(21, 11, 20, "#7A4F2C"); p.set(15, 21, "#E9C25A"); p.row(26, 10, 21, shade(c, 0.8)); p.pts([[15, 17], [16, 17], [15, 18], [16, 18]], shade(c, 0.78)); }],
};

/* ---------- acessórios ---------- */
const GOLD = "#F2C14E";
export const GLASSES = {
  nenhum: ["Sem óculos", () => {}],
  redondo: ["Redondo", (p) => { const k = INK; p.pts([[11, 10], [12, 10], [13, 10], [10, 11], [14, 11], [10, 12], [14, 12], [11, 13], [12, 13], [13, 13], [17, 10], [18, 10], [19, 10], [16, 11], [20, 11], [16, 12], [20, 12], [17, 13], [18, 13], [19, 13], [15, 11]], k); }],
  quadrado: ["Quadrado", (p) => { const k = INK; p.row(10, 10, 14, k); p.row(13, 10, 14, k); p.rect(10, 11, 1, 2, k); p.rect(14, 11, 1, 2, k); p.row(10, 17, 21, k); p.row(13, 17, 21, k); p.rect(17, 11, 1, 2, k); p.rect(21, 11, 1, 2, k); p.row(11, 15, 16, k); }],
  gatinho: ["Gatinho", (p) => { const k = "#C2334D"; p.row(10, 10, 14, k); p.row(13, 11, 13, k); p.set(10, 12, k); p.set(14, 12, k); p.set(9, 9, k); p.row(10, 17, 21, k); p.row(13, 18, 20, k); p.set(17, 12, k); p.set(21, 12, k); p.set(22, 9, k); p.row(11, 15, 16, k); }],
  sol: ["De sol", (p) => { p.rect(10, 10, 5, 3, INK); p.rect(17, 10, 5, 3, INK); p.row(10, 15, 16, INK); p.set(11, 10, "#6B6B80"); p.set(18, 10, "#6B6B80"); }],
  aviador: ["Aviador", (p) => { p.row(9, 8, 23, "#7A4F2C"); p.rect(10, 9, 5, 4, "#9AD8F2"); p.rect(17, 9, 5, 4, "#9AD8F2"); p.pts([[10, 9], [14, 9], [10, 12], [14, 12], [17, 9], [21, 9], [17, 12], [21, 12]], "#7A4F2C"); p.set(11, 10, "#FFFFFF"); p.set(18, 10, "#FFFFFF"); }],
};
export const EARRINGS = {
  nenhum: ["Sem brinco", () => {}],
  ponto: ["Ponto", (p) => { p.set(8, 14, GOLD); p.set(23, 14, GOLD); }],
  argola: ["Argola", (p) => { p.pts([[8, 14], [7, 15], [8, 16], [23, 14], [24, 15], [23, 16]], GOLD); }],
  pingente: ["Pingente", (p) => { p.set(8, 14, GOLD); p.set(23, 14, GOLD); p.set(8, 15, "#7FE6FF"); p.set(23, 15, "#7FE6FF"); }],
};
// Itens de cabeça: [nome, desenho, esconde o cabelo?]
export const ITEMS = {
  nenhum: ["Nada", null, false],
  laco: ["Laço", (p, c) => { p.rect(8, 4, 2, 3, c); p.rect(12, 4, 2, 3, c); p.rect(10, 5, 2, 1, shade(c, 0.75)); p.set(8, 4, shade(c, 1.2)); }, false],
  tiara: ["Tiara", (p, c) => { p.row(5, 11, 20, c); p.set(10, 6, c); p.set(21, 6, c); p.set(15, 4, "#7FE6FF"); p.set(16, 4, "#7FE6FF"); }, false],
  bandana: ["Bandana", (p, c) => { p.rect(9, 7, 14, 2, c); p.pts([[23, 8], [24, 9], [25, 10], [24, 10]], c); p.pts([[11, 7], [15, 8], [19, 7]], "#FFFFFF"); }, false],
  bone: ["Boné", (p, c) => { const s = shade(c, 0.8); p.row(3, 11, 20, c); p.rect(10, 4, 12, 4, c); p.row(7, 9, 22, s); p.rect(4, 7, 6, 1, s); p.rect(5, 8, 5, 1, s); p.set(15, 3, "#FFFFFF"); }, false],
  gorro: ["Gorro", (p, c) => { p.row(2, 12, 19, c); p.rect(10, 3, 12, 4, c); p.row(7, 9, 22, "#F4F1EA"); p.row(8, 9, 22, "#F4F1EA"); p.rect(14, 0, 3, 2, "#F4F1EA"); p.pts([[12, 4], [15, 5], [18, 4]], shade(c, 0.8)); }, false],
  fone: ["Fone", (p, c) => { p.row(3, 11, 20, INK); p.set(10, 4, INK); p.set(21, 4, INK); p.rect(9, 5, 1, 4, INK); p.rect(22, 5, 1, 4, INK); p.rect(7, 9, 3, 5, c); p.rect(22, 9, 3, 5, c); p.set(8, 10, shade(c, 1.3)); }, false],
  mago: ["Chapéu de mago", (p, c) => { const s = shade(c, 0.78); p.rect(4, 8, 24, 2, c); p.row(10, 6, 25, s); p.rect(10, 5, 12, 3, c); p.rect(12, 3, 9, 2, c); p.rect(15, 1, 6, 2, c); p.rect(19, 0, 4, 1, c); p.rect(22, 0, 2, 2, s); p.row(7, 10, 21, "#E9C25A"); p.set(14, 4, mix(c, "#FFFFFF", 0.4)); }, false],
  coroa: ["Coroa", (p) => { p.rect(11, 3, 10, 3, GOLD); p.pts([[11, 1], [11, 2], [14, 2], [15, 1], [16, 1], [17, 2], [20, 1], [20, 2]], GOLD); p.set(15, 4, "#E8414C"); p.set(12, 4, "#2FA6A0"); p.set(19, 4, "#2FA6A0"); p.row(5, 11, 20, shade(GOLD, 0.8)); }, false],
  gato: ["Gato", (p) => { const g = "#8D8A90", w = "#F4F1EA"; p.rect(11, 1, 9, 3, g); p.rect(13, 2, 4, 2, w); p.pts([[11, 0], [14, 0]], g); p.set(12, 2, INK); p.set(15, 2, INK); p.rect(20, 2, 3, 2, g); p.set(23, 1, g); p.set(24, 0, g); }, false],
  moto: ["Capacete", (p, c) => { const s = shade(c, 0.78); p.row(2, 11, 20, c); p.row(3, 9, 22, c); p.rect(8, 4, 16, 6, c); p.rect(7, 10, 3, 7, c); p.rect(22, 10, 3, 7, c); p.row(10, 10, 21, s); p.row(5, 11, 20, "#FFFFFF"); p.set(23, 13, "#F4F1EA"); }, true],
  espacial: ["Espacial", () => {}, false], // desenhado em compose(), porque envolve a cabeça toda
  aureola: ["Auréola", (p) => { p.row(1, 12, 19, GOLD); p.set(11, 2, GOLD); p.set(20, 2, GOLD); p.row(3, 12, 19, GOLD); }, false],
};

// Equipamentos de RPG (mão ou costas): [nome, atrás do corpo, na frente]
export const GEAR = {
  nenhum: ["Nada", null, null],
  mochila: ["Mochila", (p) => { const b = "#8C5634"; p.rect(21, 17, 5, 7, b); p.rect(22, 16, 3, 1, b); p.row(19, 22, 25, shade(b, 0.75)); p.set(24, 21, GOLD); }, (p) => { p.rect(19, 17, 1, 6, "#6B4A2F"); }],
  capa: ["Capa", (p) => { const r = "#C23B3B", d = shade(r, 0.75); p.rect(8, 16, 16, 4, r); p.rect(7, 20, 18, 4, r); p.rect(6, 24, 20, 4, r); p.row(28, 6, 25, d); p.pts([[7, 21], [6, 25], [24, 21], [25, 25]], d); }, (p) => { p.set(12, 17, GOLD); p.set(19, 17, GOLD); }],
  cajado: ["Cajado", null, (p) => { const w = "#7A4F2C"; p.rect(6, 9, 1, 21, w); p.rect(7, 12, 1, 18, shade(w, 0.8)); p.rect(5, 6, 3, 3, "#7FE6FF"); p.set(5, 6, "#FFFFFF"); p.rect(7, 22, 2, 2, "#FBDCC6"); }],
  espada: ["Espada", null, (p) => { const m = "#C9D2DA"; p.rect(24, 10, 2, 11, m); p.set(24, 10, "#FFFFFF"); p.rect(22, 21, 6, 1, GOLD); p.rect(24, 22, 2, 3, "#6B4A2F"); }],
  escudo: ["Escudo", null, (p) => { const s = "#3E70D1"; p.rect(4, 17, 6, 7, s); p.rect(5, 24, 4, 1, s); p.set(6, 25, s); p.set(7, 25, s); p.rect(6, 19, 2, 3, GOLD); p.row(17, 4, 9, shade(s, 1.25)); }],
  livro: ["Livro", null, (p) => { p.rect(20, 20, 5, 5, "#6A3FC2"); p.rect(21, 21, 3, 3, "#F4F1EA"); p.set(22, 21, "#6A3FC2"); }],
};

export const FRAMES = {
  nenhuma: ["Sem moldura", null],
  bronze: ["Bronze", "#D08A4E"],
  prata: ["Prata", "#B9C8CC"],
  ouro: ["Ouro", "#FFBD65"],
  diamante: ["Diamante", "#7FE6FF"],
};

/* ---------- humor do dia ---------- */
export const MOODS = {
  calmo: { name: "Dia tranquilo", ring: "#2FD0C8",
    mouth: (p, c) => { p.pts([[13, 14], [14, 15], [15, 15], [16, 15], [17, 15], [18, 14]], c); p.row(16, 15, 16, "#B43A3A"); },
    extra: (p) => { p.pts([[4, 5], [3, 6], [5, 6], [4, 7], [27, 3], [26, 4], [28, 4], [27, 5]], "#FFE27A"); } },
  focado: { name: "Dia movimentado", ring: "#FFBD65",
    mouth: (p, c) => { p.row(15, 14, 17, c); },
    face: (p) => { p.row(EYE_Y - 1, EYE_L - 1, EYE_L + 1, INK); p.row(EYE_Y - 1, EYE_R, EYE_R + 2, INK); },
    extra: (p) => { p.pts([[27, 8], [28, 8], [29, 8], [27, 5], [28, 4], [27, 11], [28, 12]], "#1E1620"); } },
  estressado: { name: "Dia puxado", ring: "#FF7A6B",
    mouth: (p, c) => { p.pts([[13, 15], [14, 14], [15, 15], [16, 14], [17, 15], [18, 14]], c); },
    face: (p) => { p.pts([[EYE_L - 1, EYE_Y - 1], [EYE_L, EYE_Y - 2], [EYE_R + 1, EYE_Y - 2], [EYE_R + 2, EYE_Y - 1]], INK); p.set(22, 9, "#8FD8FF"); p.set(22, 10, "#8FD8FF"); p.set(21, 10, "#CFF0FF"); },
    extra: (p) => { p.pts([[3, 4], [4, 5], [2, 8], [3, 8], [4, 8], [3, 11], [4, 10]], "#1E1620"); } },
};

/* ---------- pontos de partida ---------- */
export const PRESETS = {
  feminino: ["Feminino", { hair: "rabo", hairC: 3, eyes: "brilho", lashes: "sim", lips: "rosa", mouth: "sorriso", beard: "nenhuma", body: "jardineira", bodyC: 4, ears: "ponto", glasses: "nenhum", item: "nenhum", gear: "nenhum", bg: 0 }],
  masculino: ["Masculino", { hair: "topete", hairC: 6, eyes: "pontos", lashes: "nao", lips: "nao", mouth: "sorriso", beard: "nenhuma", body: "jaqueta", bodyC: 9, ears: "nenhum", glasses: "nenhum", item: "nenhum", gear: "nenhum", bg: 0 }],
  neutro: ["Neutro", { hair: "curto", hairC: 1, eyes: "pontos", lashes: "nao", lips: "nao", mouth: "neutra", beard: "nenhuma", body: "tunica", bodyC: 1, ears: "nenhum", glasses: "nenhum", item: "nenhum", gear: "mochila", bg: 1 }],
};

export const DEFAULT_AVATAR = { skin: 0, hair: "topete", hairC: 6, eyes: "pontos", mouth: "sorriso", lashes: "nao", lips: "nao", beard: "nenhuma", body: "jaqueta", bodyC: 9, glasses: "nenhum", ears: "nenhum", item: "nenhum", itemC: 1, gear: "nenhum", bg: 0, frame: "nenhuma" };

export function cleanAvatar(a) {
  const d = { ...DEFAULT_AVATAR, ...(a || {}) };
  const pick = (v, set, def) => (typeof v === "string" && v in set ? v : def);
  const idx = (v, arr) => (Number.isInteger(v) && v >= 0 && v < arr.length ? v : 0);
  return {
    skin: idx(d.skin, SKINS), hair: pick(d.hair, HAIRS, "curto"), hairC: idx(d.hairC, HAIR_COLORS),
    eyes: pick(d.eyes, EYES, "pontos"), mouth: pick(d.mouth, MOUTHS, "nenhuma"),
    lashes: pick(d.lashes, LASHES, "nao"), lips: pick(d.lips, LIPS, "nao"), beard: pick(d.beard, BEARDS, "nenhuma"),
    body: pick(d.body, BODIES, "moletom"), bodyC: idx(d.bodyC, CLOTH_COLORS),
    glasses: pick(d.glasses, GLASSES, "nenhum"), ears: pick(d.ears, EARRINGS, "nenhum"),
    item: pick(d.item, ITEMS, "nenhum"), itemC: idx(d.itemC, CLOTH_COLORS), gear: pick(d.gear, GEAR, "nenhum"),
    bg: idx(d.bg, BG_COLORS), frame: pick(d.frame, FRAMES, "nenhuma"),
  };
}

// Monta a grade de pixels do personagem.
function compose(a, mood) {
  const p = canvas();
  const skin = SKINS[a.skin], hc = HAIR_COLORS[a.hairC], bc = CLOTH_COLORS[a.bodyC], ic = CLOTH_COLORS[a.itemC];
  const hair = HAIRS[a.hair], item = ITEMS[a.item], gear = GEAR[a.gear], md = mood ? MOODS[mood] : null;
  const hideHair = item[2];
  if (gear[1]) gear[1](p);
  if (!hideHair && hair[1]) hair[1](p, hc, skin);
  BODIES[a.body][1](p, bc, skin);
  drawHead(p, skin);
  EARRINGS[a.ears][1](p);
  BLUSH(p);
  BEARDS[a.beard][1](p, hc, skin);
  EYES[a.eyes][1](p);
  LASHES[a.lashes][1](p);
  if (md && md.face) md.face(p);
  const lipC = LIPS[a.lips][1], mouthC = lipC || INK;
  const ownMouth = !md || (mood === "calmo" && a.mouth !== "nenhuma");
  if (ownMouth) {
    if (a.mouth === "nenhuma" && lipC) p.row(14, 15, 16, lipC);
    else MOUTHS[a.mouth][1](p, mouthC);
  } else md.mouth(p, mouthC);
  if (!hideHair) hair[2](p, hc, skin);
  GLASSES[a.glasses][1](p);
  if (a.item === "espacial") {
    const gl = "rgba(190,232,255,.42)";
    for (let y = 2; y <= 18; y++) for (let x = 5; x <= 26; x++) {
      const dx = x - 15.5, dy = y - 10.5;
      if (dx * dx / 110 + dy * dy / 72 <= 1 && !p.get(x, y)) p.set(x, y, gl);
    }
    p.row(18, 9, 22, "#DDE3EA"); p.row(19, 9, 22, "#C3CBD5"); p.set(8, 5, "#FFFFFF"); p.set(9, 4, "#FFFFFF");
  } else if (item[1]) item[1](p, ic);
  if (gear[2]) gear[2](p);
  // contorno: pixels vazios encostados no personagem ficam escuros
  const out = p.g.slice();
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (p.get(x, y)) continue;
    if (p.get(x - 1, y) || p.get(x + 1, y) || p.get(x, y - 1) || p.get(x, y + 1)) out[y * N + x] = INK;
  }
  // chão
  for (let x = 9; x <= 22; x++) if (!out[31 * N + x]) out[31 * N + x] = "rgba(0,0,0,.14)";
  // detalhes do humor (fora do personagem)
  if (md && md.extra) { const e = canvas(); md.extra(e); e.g.forEach((c, i) => { if (c && !out[i]) out[i] = c; }); }
  return out;
}

// Desenha o avatar como texto SVG. mood: "calmo" | "focado" | "estressado" (opcional).
export function avatarSvg(raw, { size = 120, cls = "avsvg", title = "", mood = null } = {}) {
  const a = cleanAvatar(raw);
  const grid = compose(a, mood);
  const frame = FRAMES[a.frame][1];
  const bg = BG_COLORS[a.bg];
  const clip = "av" + Math.random().toString(36).slice(2, 8);
  // fundo com pontinhos, como nas referências
  let dots = "";
  const dotC = shade(bg, 0.92);
  for (let y = 1; y < N; y += 4) for (let x = (y % 8 === 1 ? 2 : 0); x < N; x += 4) dots += `<rect x="${x}" y="${y}" width="1" height="1" fill="${dotC}"/>`;
  // junta pixels vizinhos da mesma cor numa linha (menos elementos)
  let rects = "";
  for (let y = 0; y < N; y++) {
    let x = 0;
    while (x < N) {
      const c = grid[y * N + x];
      if (!c) { x++; continue; }
      let w = 1; while (x + w < N && grid[y * N + x + w] === c) w++;
      rects += `<rect x="${x}" y="${y}" width="${w}" height="1" fill="${c}"/>`;
      x += w;
    }
  }
  const pad = frame ? 2.2 : 0;
  return `<svg class="${cls}" viewBox="0 0 32 32" width="${size}" height="${size}" shape-rendering="crispEdges" role="img" aria-label="${title || "Avatar"}">` +
    `<defs><clipPath id="${clip}"><circle cx="16" cy="16" r="${16 - pad}"/></clipPath></defs>` +
    (frame ? `<circle cx="16" cy="16" r="16" fill="${frame}" shape-rendering="geometricPrecision"/><circle cx="16" cy="16" r="${16 - pad + 0.35}" fill="none" stroke="${INK}" stroke-width=".7" shape-rendering="geometricPrecision"/>` : "") +
    `<g clip-path="url(#${clip})"><rect width="32" height="32" fill="${bg}"/>${dots}` +
    `<g transform="translate(16 ${frame ? 30 : 31}) scale(${(frame ? (16 - pad) / 16 : 1) * 0.9}) translate(-16 -31)">${rects}</g>` +
    `</g></svg>`;
}
