// Avatar montável: personagem original em traço grosso e cores chapadas.
// Tudo é desenhado em SVG (viewBox 200x200), então não depende de imagens externas.

const INK = "#141414";
const SW = 6; // espessura do contorno
const LIP = "#C2334D";

export const SKINS = ["#F8D9C8", "#F1C4A4", "#E0A47E", "#C27F57", "#8D5A3B", "#5E3A26"];
export const HAIR_COLORS = ["#141414", "#5A3824", "#A0642C", "#E3B04B", "#D9573E", "#7C5CD6", "#2FA6A0", "#E8E8E8"];
export const CLOTH_COLORS = ["#6A2FC0", "#02A0A0", "#FFBD65", "#FF7A6B", "#3D7BE0", "#4FA35A", "#F2F2F2", "#2A2A2A", "#F28DB2", "#8B5A2B"];
export const BG_COLORS = ["#CDEFEA", "#FFE3BD", "#FFD3CC", "#E2DAFF", "#DDF5C9", "#D4ECFF", "#F2F2F2", "#173239"];

const st = (w = SW) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
const stroke = st();
const curls = (pts, c) => `<g fill="${c}" ${stroke}>` + pts.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join("") + "</g>";

/* ---------- base ---------- */
const HEAD = (skin) =>
  `<path d="M150 98a10 11 0 1 1 -2 22" fill="${skin}" ${stroke}/>` +
  `<path d="M62 74Q62 40 100 40Q146 40 146 80L146 108Q146 140 108 140Q86 140 74 128Q62 116 62 96Z" fill="${skin}" ${stroke}/>`;
const NECK = (skin) => `<path d="M90 134L114 134L114 156L90 156Z" fill="${skin}"/><path d="M90 134L90 154M114 134L114 154" ${stroke} fill="none"/>`;
const CHEEKS = `<ellipse cx="76" cy="106" rx="7" ry="4" fill="#FF8F8F" opacity=".45"/><ellipse cx="124" cy="106" rx="7" ry="4" fill="#FF8F8F" opacity=".45"/>`;

/* ---------- rosto ---------- */
export const EYES = {
  pontos: ["Pontos", `<circle cx="84" cy="92" r="5" fill="${INK}"/><circle cx="110" cy="92" r="5" fill="${INK}"/>`],
  brilho: ["Com brilho", `<circle cx="84" cy="92" r="6.5" fill="${INK}"/><circle cx="110" cy="92" r="6.5" fill="${INK}"/><circle cx="86" cy="90" r="2.2" fill="#fff"/><circle cx="112" cy="90" r="2.2" fill="#fff"/>`],
  felizes: ["Felizes", `<path d="M77 94q7-8 14 0M103 94q7-8 14 0" fill="none" ${st(5)}/>`],
  grandes: ["Grandes", `<ellipse cx="84" cy="91" rx="8" ry="10" fill="#fff" ${st(4)}/><ellipse cx="110" cy="91" rx="8" ry="10" fill="#fff" ${st(4)}/><circle cx="86" cy="93" r="4" fill="${INK}"/><circle cx="112" cy="93" r="4" fill="${INK}"/>`],
  piscando: ["Piscando", `<circle cx="84" cy="92" r="5" fill="${INK}"/><path d="M103 93q7-6 14 0" fill="none" ${st(5)}/>`],
  serios: ["Sérios", `<path d="M78 92h12M104 92h12" ${st(5)}/>`],
};
export const MOUTHS = {
  nenhuma: ["Sem boca", () => ""],
  sorriso: ["Sorriso", (c) => `<path d="M88 112q9 8 18 0" fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round"/>`],
  aberta: ["Animada", (c) => `<path d="M87 110h20q-2 14-10 14t-10-14z" fill="#B23A3A" stroke="${c}" stroke-width="4" stroke-linejoin="round"/>`],
  neutra: ["Neutra", (c) => `<path d="M90 114h14" stroke="${c}" stroke-width="5" stroke-linecap="round"/>`],
  lingua: ["Língua", (c) => `<path d="M88 111q9 7 18 0" fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round"/><path d="M95 115q0 9 5 9t5-9" fill="#E86A7A" ${st(3.5)}/>`],
};
export const LASHES = {
  nao: ["Sem cílios", ""],
  sim: ["Cílios", `<path d="M77 87l-5-4M80 85l-2-5M117 87l5-4M114 85l2-5" ${st(3.5)}/>`],
};
export const LIPS = {
  nao: ["Sem batom", null],
  vermelho: ["Batom vermelho", "#C2334D"],
  rosa: ["Batom rosa", "#E06A9A"],
  vinho: ["Batom vinho", "#7E1F3B"],
};
export const BEARDS = {
  nenhuma: ["Sem barba", () => ""],
  rala: ["Barba rala", (c) => `<path d="M64 104Q66 138 98 141Q128 140 144 112L146 104Q140 126 112 128Q96 132 82 126Q68 120 64 104Z" fill="${c}" opacity=".32"/><path d="M84 106Q91 102 97 105Q103 102 110 106" fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round" opacity=".45"/>`],
  cheia: ["Barba cheia", (c) => `<path d="M63 98Q60 146 98 150Q138 150 146 104L146 98Q140 120 118 120Q108 126 97 126Q86 126 78 120Q66 116 63 98Z" fill="${c}" ${stroke}/><path d="M83 108Q91 101 97 106Q103 101 111 108Q104 113 97 110Q90 113 83 108Z" fill="${c}" ${st(3.5)}/>`],
  cavanhaque: ["Cavanhaque", (c) => `<path d="M88 122Q97 146 106 122Q97 128 88 122Z" fill="${c}" ${st(4)}/><path d="M83 107Q91 101 97 106Q103 101 111 107Q104 112 97 109Q90 112 83 107Z" fill="${c}" ${st(3.5)}/>`],
  bigode: ["Bigode", (c) => `<path d="M81 108Q90 99 97 105Q104 99 113 108Q105 113 97 109Q89 113 81 108Z" fill="${c}" ${st(4)}/>`],
};

/* ---------- cabelo: [nome, atrás da cabeça, por cima] ---------- */
export const HAIRS = {
  curto: ["Curto", null, (c) => `<path d="M58 84Q52 34 102 32Q152 32 150 86Q140 62 112 60Q96 72 76 66Q64 72 58 84Z" fill="${c}" ${stroke}/>`],
  degrade: ["Degradê", null, (c) => `<path d="M62 82Q60 42 100 38Q144 38 146 84Q140 66 120 58Q100 54 80 60Q66 66 62 82Z" fill="${c}" opacity=".45"/><path d="M70 58Q76 34 104 32Q134 32 140 58Q120 48 104 50Q86 50 70 58Z" fill="${c}" ${stroke}/>`],
  moicano: ["Moicano", null, (c) => `<path d="M62 82Q60 44 100 40Q144 40 146 84Q132 62 100 58Q74 60 62 82Z" fill="${c}" opacity=".35"/><path d="M90 48L92 18L102 34L108 10L116 32L126 18L124 52Q106 42 90 48Z" fill="${c}" ${stroke}/>`],
  topete: ["Topete", null, (c) => `<path d="M60 82Q54 46 80 36Q78 20 104 18Q132 16 136 34Q154 44 150 86Q140 64 114 62Q92 54 76 66Q66 72 60 82Z" fill="${c}" ${stroke}/>`],
  cacheado: ["Cacheado", null, (c) => curls([[64, 74, 14], [66, 54, 15], [82, 40, 16], [102, 34, 17], [122, 38, 16], [140, 50, 15], [150, 70, 14], [150, 88, 11]], c) +
    `<path d="M58 70Q66 50 100 48Q136 48 146 72L146 64Q130 40 100 40Q70 40 58 64Z" fill="${c}"/>`],
  franja: ["Franja", null, (c) => `<path d="M56 96Q48 34 102 32Q156 32 150 92Q146 76 140 70L132 80L124 66L112 78L102 64L90 76L80 64L70 78Q62 82 56 96Z" fill="${c}" ${stroke}/>`],
  chanel: ["Chanel", (c) => `<path d="M52 80Q46 128 62 142L150 142Q160 126 154 80Z" fill="${c}" ${stroke}/>`,
    (c) => `<path d="M54 110Q44 36 102 32Q158 34 154 108Q150 84 140 72Q120 76 104 60Q90 78 66 80Q58 92 54 110Z" fill="${c}" ${stroke}/>`],
  longo: ["Longo", (c) => `<path d="M58 70Q50 150 62 180L142 180Q154 150 148 70Z" fill="${c}" ${stroke}/>`,
    (c) => `<path d="M56 100Q46 34 102 32Q156 32 152 100Q146 70 128 62Q104 70 80 62Q62 72 56 100Z" fill="${c}" ${stroke}/>`],
  cacheadolongo: ["Cacheado longo", (c) => curls([[58, 86, 18], [52, 112, 18], [56, 140, 18], [64, 166, 16], [148, 86, 18], [154, 112, 18], [150, 140, 18], [142, 166, 16]], c),
    (c) => curls([[62, 72, 15], [66, 50, 15], [84, 36, 16], [104, 30, 17], [124, 34, 16], [142, 48, 15], [150, 70, 14]], c) +
      `<path d="M58 72Q66 50 100 46Q136 46 148 72L146 62Q130 38 100 38Q70 38 58 62Z" fill="${c}"/>`],
  rabo: ["Rabo de cavalo", (c) => `<path d="M140 56Q178 60 170 118Q166 150 150 158Q158 126 150 100Q148 78 134 66Z" fill="${c}" ${stroke}/>`,
    (c) => `<path d="M58 86Q52 34 102 32Q150 32 150 84Q142 60 118 56Q96 54 80 64Q64 72 58 86Z" fill="${c}" ${stroke}/><path d="M136 52l12-6l4 12l-12 6z" fill="#FF7A6B" ${st(4)}/>`],
  trancas: ["Tranças", (c) => [62, 146].map((x) => [0, 1, 2, 3, 4].map((i) => `<ellipse cx="${x}" cy="${104 + i * 16}" rx="10" ry="9" fill="${c}" ${st(5)}/>`).join("")).join("") +
    `<circle cx="62" cy="186" r="5" fill="#FF7A6B" ${st(3)}/><circle cx="146" cy="186" r="5" fill="#FF7A6B" ${st(3)}/>`,
    (c) => `<path d="M56 96Q48 34 102 32Q156 32 152 96Q148 70 130 60Q114 56 102 46Q90 56 74 60Q58 70 56 96Z" fill="${c}" ${stroke}/><path d="M102 34L102 48" ${st(3)}/>`],
  coque: ["Coque", null, (c) => `<circle cx="104" cy="22" r="16" fill="${c}" ${stroke}/><path d="M58 84Q52 34 102 32Q152 32 150 86Q138 60 104 58Q76 58 58 84Z" fill="${c}" ${stroke}/>`],
  raspado: ["Raspado", null, (c) => `<path d="M62 76Q62 40 100 40Q146 40 146 80Q130 56 100 54Q74 54 62 76Z" fill="${c}" opacity=".55"/>`],
  careca: ["Careca", null, () => `<path d="M80 54q10-6 20-6" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".6"/>`],
};

/* ---------- roupa: (cor, pele) ---------- */
const TORSO = "M34 204Q36 160 76 148L128 148Q168 160 170 204Z";
export const BODIES = {
  moletom: ["Moletom", (c) => `<path d="${TORSO}" fill="${c}" ${stroke}/>` +
    `<path d="M80 150Q84 168 102 168Q120 168 124 150" fill="none" ${stroke}/><path d="M64 176L62 204M140 176L142 204" ${stroke}/><path d="M94 168v14M110 168v14" ${st(4)}/>`],
  camiseta: ["Camiseta", (c) => `<path d="M38 204Q40 164 80 150Q100 160 124 150Q164 164 166 204Z" fill="${c}" ${stroke}/><path d="M82 151Q102 166 122 151" fill="none" ${st(4)}/>`],
  camisa: ["Camisa social", (c) => `<path d="${TORSO}" fill="${c}" ${stroke}/><path d="M80 146L92 168L102 152L112 168L124 146" fill="${c}" ${st(5)}/><path d="M102 156V204" ${st(4)}/><circle cx="108" cy="172" r="2.5" fill="${INK}"/><circle cx="108" cy="186" r="2.5" fill="${INK}"/><circle cx="108" cy="200" r="2.5" fill="${INK}"/>`],
  blusa: ["Blusa", (c) => `<path d="M36 204Q38 162 74 152Q100 176 130 152Q166 162 168 204Z" fill="${c}" ${stroke}/><path d="M74 152Q100 182 130 152" fill="none" ${st(4)}/><path d="M58 172Q62 160 74 154M146 172Q142 160 130 154" fill="none" ${st(4)}/><circle cx="102" cy="172" r="3.5" fill="#fff" ${st(2.5)}/>`],
  regata: ["Regata", (c, s) => `<path d="${TORSO}" fill="${s}" ${stroke}/><path d="M66 204L66 156Q74 152 78 152Q86 172 102 172Q118 172 126 152Q132 152 138 156L138 204Z" fill="${c}" ${stroke}/>`],
  vestido: ["Vestido", (c, s) => `<path d="${TORSO}" fill="${s}" ${stroke}/><path d="M62 204L66 170Q84 164 102 176Q120 164 138 170L142 204Z" fill="${c}" ${stroke}/><path d="M74 168L80 150M130 168L124 150" ${st(4)}/><circle cx="102" cy="176" r="4" fill="#fff" ${st(2.5)}/>`],
  cropped: ["Cropped", (c, s) => `<path d="${TORSO}" fill="${s}" ${stroke}/><path d="M38 192Q40 162 78 150Q100 162 126 150Q164 162 166 192Z" fill="${c}" ${stroke}/><path d="M82 151Q102 164 122 151" fill="none" ${st(4)}/><circle cx="102" cy="200" r="2" fill="${INK}" opacity=".5"/>`],
  jaqueta: ["Jaqueta", (c) => `<path d="${TORSO}" fill="${c}" ${stroke}/>` +
    `<path d="M102 154L102 204" ${stroke}/><path d="M80 148L94 172L102 156L110 172L124 148" fill="#F2F2F2" ${st(5)}/><path d="M60 182h18M126 182h18" ${st(4)}/>`],
  terno: ["Terno", (c) => `<path d="${TORSO}" fill="${c}" ${stroke}/>` +
    `<path d="M84 148L102 186L120 148Z" fill="#F7F7F7" ${st(5)}/><path d="M98 160L106 160L104 184L100 184Z" fill="#D9473B" ${st(3)}/><path d="M84 148L96 190M120 148L108 190" ${st(5)}/>`],
};

/* ---------- acessórios ---------- */
export const GLASSES = {
  nenhum: ["Sem óculos", ""],
  redondo: ["Redondo", `<g fill="rgba(255,255,255,.25)" ${st(5)}><circle cx="84" cy="92" r="12"/><circle cx="112" cy="92" r="12"/></g><path d="M96 92h4M124 90l22-4" ${st(5)}/>`],
  quadrado: ["Quadrado", `<g fill="rgba(255,255,255,.25)" ${st(5)}><rect x="70" y="82" width="26" height="20" rx="4"/><rect x="100" y="82" width="26" height="20" rx="4"/></g><path d="M126 88l20-3" ${st(5)}/>`],
  gatinho: ["Gatinho", `<g fill="rgba(255,255,255,.25)" ${st(5)}><path d="M68 84Q84 80 96 86Q96 102 82 102Q70 100 68 84Z"/><path d="M100 86Q114 80 130 84Q128 100 116 102Q102 102 100 86Z"/></g><path d="M130 86l16-3" ${st(5)}/>`],
  sol: ["De sol", `<g fill="${INK}" ${st(5)}><path d="M68 84h30q0 18-15 18t-15-18z"/><path d="M100 84h30q0 18-15 18t-15-18z"/></g><path d="M130 86l16-3" ${st(5)}/>`],
  aviador: ["Aviador", `<path d="M62 82Q100 74 148 82" fill="none" stroke="#8B5A2B" stroke-width="10" stroke-linecap="round"/><g fill="#BFE8FF" ${st(5)}><circle cx="84" cy="86" r="13"/><circle cx="114" cy="86" r="13"/></g><path d="M80 80l6 6M110 80l6 6" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`],
};
export const EARRINGS = {
  nenhum: ["Sem brinco", ""],
  ponto: ["Ponto", `<circle cx="153" cy="123" r="4.5" fill="#FFC93C" ${st(3)}/>`],
  argola: ["Argola", `<circle cx="153" cy="128" r="8" fill="none" stroke="${INK}" stroke-width="7"/><circle cx="153" cy="128" r="8" fill="none" stroke="#FFC93C" stroke-width="3"/>`],
  pingente: ["Pingente", `<path d="M153 120v10" ${st(3)}/><path d="M153 128l6 8l-6 8l-6-8z" fill="#7FE6FF" ${st(3)}/>`],
};
// Itens: [nome, desenho(cor), esconde o cabelo?]
export const ITEMS = {
  nenhum: ["Nada", null, false],
  laco: ["Laço", (c) => `<g transform="translate(64 40) rotate(-18)"><path d="M0 0L-22 -12L-22 12Z M0 0L22 -12L22 12Z" fill="${c}" ${st(5)}/><circle cx="0" cy="0" r="6" fill="${c}" ${st(4)}/></g>`, false],
  tiara: ["Tiara", (c) => `<path d="M58 72Q62 36 102 34Q144 36 148 74" fill="none" ${st(11)}/><path d="M58 72Q62 36 102 34Q144 36 148 74" fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round"/>`, false],
  bandana: ["Bandana", (c) => `<path d="M58 70Q100 52 150 70L150 84Q100 66 58 84Z" fill="${c}" ${stroke}/><path d="M150 74l18-10l-4 14l12 6l-22 2z" fill="${c}" ${st(4)}/><circle cx="84" cy="72" r="2.5" fill="#fff"/><circle cx="104" cy="66" r="2.5" fill="#fff"/><circle cx="124" cy="68" r="2.5" fill="#fff"/>`, false],
  bone: ["Boné", (c) => `<path d="M58 74Q56 34 102 32Q148 32 150 78Z" fill="${c}" ${stroke}/><path d="M58 74Q40 76 30 84Q46 90 74 80" fill="${c}" ${stroke}/><circle cx="104" cy="32" r="5" fill="${INK}"/>`, false],
  gorro: ["Gorro", (c) => `<path d="M56 78Q54 30 102 28Q150 30 150 80Z" fill="${c}" ${stroke}/><path d="M52 80Q102 66 154 82L152 70Q102 54 54 68Z" fill="#F2F2F2" ${stroke}/><circle cx="102" cy="20" r="11" fill="#F2F2F2" ${stroke}/>`, false],
  fone: ["Fone", (c) => `<path d="M56 94Q50 26 104 24Q158 26 152 96" fill="none" ${st(9)}/><path d="M56 94Q50 26 104 24Q158 26 152 96" fill="none" stroke="${c}" stroke-width="4"/><rect x="44" y="86" width="20" height="30" rx="9" fill="${c}" ${stroke}/><rect x="144" y="86" width="20" height="30" rx="9" fill="${c}" ${stroke}/>`, false],
  coroa: ["Coroa", () => `<path d="M68 46L74 14L90 32L104 8L118 32L134 14L138 46Z" fill="#FFC93C" ${stroke}/><circle cx="104" cy="34" r="5" fill="#E8414C"/><circle cx="84" cy="38" r="4" fill="#2FA6A0"/><circle cx="124" cy="38" r="4" fill="#2FA6A0"/>`, false],
  gato: ["Gato", () => `<path d="M96 36Q100 6 132 12Q156 16 156 36Z" fill="#8A8A8A" ${stroke}/><path d="M156 30Q176 24 172 4" fill="none" ${st(7)}/><path d="M156 30Q176 24 172 4" fill="none" stroke="#8A8A8A" stroke-width="2.5"/>` +
    `<path d="M76 40Q72 14 96 14Q118 14 116 40Z" fill="#8A8A8A" ${stroke}/><path d="M78 22L80 4L92 16M102 16L114 4L114 22" fill="#8A8A8A" ${stroke}/><path d="M86 30Q96 22 106 30L104 40L88 40Z" fill="#F4F4F4"/><circle cx="88" cy="26" r="3" fill="${INK}"/><circle cx="104" cy="26" r="3" fill="${INK}"/><path d="M92 33q4 3 8 0" fill="none" ${st(3)}/>`, false],
  moto: ["Capacete", (c) => `<path d="M46 108Q40 26 104 24Q164 26 158 110Q158 134 140 140L134 118Q132 84 102 82Q74 82 70 110L66 140Q46 132 46 108Z" fill="${c}" ${stroke}/><path d="M66 72Q102 52 140 70" fill="none" stroke="#fff" stroke-width="12" opacity=".8"/><circle cx="148" cy="100" r="9" fill="#F2F2F2" ${st(4)}/>`, true],
  espacial: ["Espacial", () => `<circle cx="102" cy="92" r="62" fill="rgba(191,232,255,.35)" ${stroke}/><path d="M60 62Q74 42 96 38" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" opacity=".9"/><path d="M58 146Q102 164 146 146L150 160Q102 178 54 160Z" fill="#DDE3EA" ${stroke}/><circle cx="148" cy="138" r="7" fill="#FF7A6B" ${st(3)}/>`, false],
  aureola: ["Auréola", () => `<ellipse cx="104" cy="20" rx="34" ry="9" fill="none" stroke="#FFC93C" stroke-width="7"/><ellipse cx="104" cy="20" rx="34" ry="9" fill="none" stroke="${INK}" stroke-width="2" opacity=".5"/>`, false],
};
export const FRAMES = {
  nenhuma: ["Sem moldura", null],
  bronze: ["Bronze", "#D08A4E"],
  prata: ["Prata", "#B9C8CC"],
  ouro: ["Ouro", "#FFBD65"],
  diamante: ["Diamante", "#7FE6FF"],
};

/* ---------- humor do dia ---------- */
// Muda sobrancelhas e boca e acrescenta detalhes; usado no painel conforme a carga de missões.
export const MOODS = {
  calmo: { name: "Dia tranquilo", ring: "#2FD0C8",
    face: () => `<path d="M76 80q8-6 16-2M102 78q8-4 16 2" fill="none" ${st(4.5)}/>`,
    mouth: (c) => `<path d="M85 109q12 16 24 0z" fill="#B23A3A" stroke="${c}" stroke-width="4.5" stroke-linejoin="round"/><path d="M89 110h16" stroke="#fff" stroke-width="3"/>`,
    extra: `<path d="M164 40l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill="#FFC93C" ${st(2.5)}/><path d="M38 58l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#FFC93C" ${st(2)}/>` },
  focado: { name: "Dia movimentado", ring: "#FFBD65",
    face: () => `<path d="M76 82l15 1M103 83l15-1" fill="none" ${st(4.5)}/>`,
    mouth: (c) => `<path d="M90 114q7 3 14 0" fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round"/>`,
    extra: `<path d="M166 62h12M170 50l8-6M170 74l8 6" ${st(3.5)}/>` },
  estressado: { name: "Dia puxado", ring: "#FF7A6B",
    face: () => `<path d="M76 84l15-6M103 78l15 6" fill="none" ${st(4.5)}/>`,
    mouth: (c) => `<path d="M82 116q4-5 8 0t8 0t8 0t8 0" fill="none" stroke="${c}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>`,
    extra: `<path d="M136 52q8 10 0 16q-8-6 0-16z" fill="#8FD8FF" ${st(3)}/><path d="M40 46l8 6M34 60h10M42 72l8-4" ${st(3.5)}/>` },
};

/* ---------- pontos de partida ---------- */
export const PRESETS = {
  feminino: ["Feminino", { hair: "longo", hairC: 1, eyes: "brilho", lashes: "sim", lips: "rosa", mouth: "sorriso", beard: "nenhuma", body: "blusa", bodyC: 8, ears: "argola", glasses: "nenhum", item: "nenhum", bg: 2 }],
  masculino: ["Masculino", { hair: "degrade", hairC: 0, eyes: "pontos", lashes: "nao", lips: "nao", mouth: "sorriso", beard: "rala", body: "camisa", bodyC: 4, ears: "nenhum", glasses: "nenhum", item: "nenhum", bg: 5 }],
  neutro: ["Neutro", { hair: "cacheado", hairC: 0, eyes: "pontos", lashes: "nao", lips: "nao", mouth: "nenhuma", beard: "nenhuma", body: "moletom", bodyC: 0, ears: "nenhum", glasses: "nenhum", item: "nenhum", bg: 0 }],
};

export const DEFAULT_AVATAR = { skin: 0, hair: "cacheado", hairC: 0, eyes: "pontos", mouth: "nenhuma", lashes: "nao", lips: "nao", beard: "nenhuma", body: "moletom", bodyC: 0, glasses: "nenhum", ears: "nenhum", item: "nenhum", itemC: 1, bg: 0, frame: "nenhuma" };

// Normaliza um avatar guardado (campos desconhecidos voltam ao padrão).
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
    item: pick(d.item, ITEMS, "nenhum"), itemC: idx(d.itemC, CLOTH_COLORS),
    bg: idx(d.bg, BG_COLORS), frame: pick(d.frame, FRAMES, "nenhuma"),
  };
}

// Desenha o avatar como texto SVG. mood: "calmo" | "focado" | "estressado" (opcional).
export function avatarSvg(raw, { size = 120, cls = "avsvg", title = "", mood = null } = {}) {
  const a = cleanAvatar(raw);
  const skin = SKINS[a.skin], hc = HAIR_COLORS[a.hairC], bc = CLOTH_COLORS[a.bodyC], ic = CLOTH_COLORS[a.itemC];
  const hair = HAIRS[a.hair], item = ITEMS[a.item], md = mood ? MOODS[mood] : null;
  const frame = FRAMES[a.frame][1];
  const clip = "av" + Math.random().toString(36).slice(2, 8);
  const hideHair = item[2];
  const lipC = LIPS[a.lips][1];
  const mouthC = lipC || INK;
  // No humor tranquilo vale a boca escolhida; nos outros, a boca mostra a emoção.
  const useOwnMouth = !md || (mood === "calmo" && a.mouth !== "nenhuma");
  let mouth = useOwnMouth ? MOUTHS[a.mouth][1](mouthC) : md.mouth(mouthC);
  if (useOwnMouth && lipC && a.mouth === "nenhuma") mouth = `<path d="M87 112q5-4 10 0q5-4 10 0q-5 7-10 7t-10-7z" fill="${lipC}" ${st(3)}/>`;
  return `<svg class="${cls}" viewBox="0 0 200 200" width="${size}" height="${size}" role="img" aria-label="${title || "Avatar"}">` +
    `<defs><clipPath id="${clip}"><circle cx="100" cy="100" r="${frame ? 90 : 100}"/></clipPath></defs>` +
    (frame ? `<circle cx="100" cy="100" r="99" fill="${frame}"/><circle cx="100" cy="100" r="92" fill="none" stroke="${INK}" stroke-width="4"/>` : "") +
    `<g clip-path="url(#${clip})">` +
      `<rect width="200" height="200" fill="${BG_COLORS[a.bg]}"/>` +
      (md ? md.extra : "") +
      `<g transform="translate(15 12) scale(.85)">` +
        (hideHair || !hair[1] ? "" : hair[1](hc)) +
        BODIES[a.body][1](bc, skin) + NECK(skin) + HEAD(skin) +
        EARRINGS[a.ears][1] +
        CHEEKS + BEARDS[a.beard][1](hc) + EYES[a.eyes][1] + LASHES[a.lashes][1] + (md ? md.face() : "") + mouth +
        (hideHair ? "" : hair[2](hc)) +
        GLASSES[a.glasses][1] +
        (item[1] ? item[1](ic) : "") +
      `</g>` +
    `</g></svg>`;
}
