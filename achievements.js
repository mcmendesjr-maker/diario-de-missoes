// Catálogo de conquistas do Diário de Missões.
// Trilhas: 4 níveis (bronze, prata, ouro, diamante). Avulsas: +50 XP. Secretas: +100 XP.
// Cada regra lê um "contexto" calculado em app.js a partir do histórico de missões.

export const TIER_NAMES = ["Bronze", "Prata", "Ouro", "Diamante"];
export const TIER_KEYS = ["bronze", "prata", "ouro", "diamante"];
export const TIER_XP = [25, 50, 100, 250];
export const SINGLE_XP = 50;
export const SECRET_XP = 100;

// [id, nome, o que conta, chave no contexto, metas, [título ouro, título diamante], ícone]
const TRAILS_RAW = [
  ["missoes", "Missionário", "missões concluídas", "count", [10, 50, 250, 1000], ["Caçador de Missões", "Lenda das Missões"], "✓"],
  ["sequencia", "Maratonista", "dias seguidos (melhor sequência)", "bestStreak", [7, 30, 100, 365], ["Incansável", "Ininterrupto"], "≫"],
  ["nivel", "Ascensão", "nível com XP das missões", "missionLevel", [5, 10, 20, 30], ["Veterano da Rotina", "Mestre Supremo"], "▲"],
  ["xp", "Acumulador", "XP das missões", "missionXp", [1000, 5000, 15000, 50000], ["Colecionador de XP", "Magnata do XP"], "XP"],
  ["pessoal", "Vida Pessoal", "missões pessoais", "pessoal", [10, 50, 200, 500], ["Guardião do Bem-estar", "Sábio da Vida"], "♥"],
  ["profissional", "Carreira", "missões profissionais", "profissional", [10, 50, 200, 500], ["Profissional Exemplar", "Titã da Carreira"], "◆"],
  ["dificeis", "Desafiante", "missões difíceis", "hard", [5, 25, 100, 300], ["Destemido", "Caçador de Chefes"], "!"],
  ["habito", "Hábito de Ferro", "vezes que a mesma diária foi feita", "maxDaily", [7, 30, 100, 365], ["Inabalável", "Mestre do Hábito"], "↻"],
  ["pontual", "Pontual", "concluídas até o prazo", "pontual", [5, 25, 100, 300], ["Relógio Suíço", "Senhor do Tempo"], "◷"],
  ["dia", "Dia Produtivo", "maior XP em um dia", "maxDay", [100, 200, 350, 500], ["Turbinado", "Furacão"], "⚡"],
  ["semana", "Semana Forte", "maior XP em uma semana", "maxWeek", [300, 700, 1500, 3000], ["Rolo Compressor", "Força da Natureza"], "7"],
  ["fds", "Fim de Semana", "fins de semana com sábado e domingo ativos", "weekends", [1, 5, 20, 52], ["Sem Folga", "Guerreiro do Domingo"], "S"],
  ["madrugador", "Madrugador", "concluídas antes das 7h", "early", [5, 25, 100, 300], ["Primeiro Raio", "Senhor da Aurora"], "☀"],
  ["coruja", "Coruja", "concluídas depois das 22h", "night", [5, 25, 100, 300], ["Vigia Noturno", "Senhor da Madrugada"], "☾"],
  ["presenca", "Presença", "dias com ao menos uma missão", "activeDays", [30, 100, 250, 500], ["Assinatura Diária", "Parte da Mobília"], "●"],
];

export const TRAILS = TRAILS_RAW.map(([id, name, unit, key, goals, titles, icon]) => ({ id, name, unit, key, goals, titles, icon }));

// [id, nome, como ganhar, chave booleana no contexto, título ou null]
const SINGLES_RAW = [
  ["primeira", "Primeira Missão", "Concluir a primeira missão", "first", null],
  ["aquecimento", "Aquecimento", "3 dias seguidos", "streak3", null],
  ["novohabito", "Novo Hábito", "Criar a primeira missão diária", "dailyExists", null],
  ["planejador", "Planejador", "Ter 10 missões com prazo", "planner", "Estrategista"],
  ["equilibrio", "Equilíbrio", "5 pessoais e 5 profissionais", "balance5", null],
  ["grandeequilibrio", "Grande Equilíbrio", "50 pessoais e 50 profissionais", "balance50", "Equilibrista"],
  ["semanaequilibrada", "Semana Equilibrada", "Na mesma semana, 5 pessoais e 5 profissionais", "balancedWeek", null],
  ["trio", "Trio Difícil", "3 missões difíceis no mesmo dia", "trioHard", "Corajoso"],
  ["perfeito", "Dia Perfeito", "Concluir todas as missões do dia, com pelo menos 5", "perfectDay", "Impecável"],
  ["faxina", "Faxina", "Zerar as atrasadas depois de ter 3 ou mais", "faxina", null],
  ["semanasematraso", "Semana Sem Atraso", "Uma semana inteira sem atrasos, com 5 ou mais concluídas", "cleanWeek", "Em Dia"],
  ["emgrupo", "Em Grupo", "Entrar em um grupo", "inGroup", null],
  ["fundador", "Fundador", "Criar um grupo", "founder", "Fundador"],
  ["turma", "Turma Completa", "Estar em um grupo com 5 ou mais pessoas", "groupOf5", null],
  ["lider", "Líder da Semana", "1º no ranking semanal de um grupo com 3+ pessoas, com 100+ XP", "leader", "Campeão da Semana"],
];
export const SINGLES = SINGLES_RAW.map(([id, name, desc, key, title]) => ({ id, name, desc, key, title }));

// [id, nome, dica, regra revelada, chave, título]
const SECRETS_RAW = [
  ["voltaporcima", "Volta por Cima", "Todo mundo tropeça.", "Concluir uma missão depois de 7 ou mais dias parado", "comeback", "Fênix"],
  ["insonia", "Insônia", "O mundo dorme…", "Concluir uma missão entre 3h e 4h59", "insomnia", "Ser da Noite"],
  ["perfeccionista", "Perfeccionista", "Mais do que o necessário.", "10 missões no mesmo dia", "tenInDay", "Perfeccionista"],
  ["centuriao", "Centurião", "Nem um a mais, nem um a menos.", "Fechar um dia com exatamente 100 XP", "exact100", "Centurião"],
  ["sextou", "Sextou Produtivo", "Enquanto todos descansam…", "150 XP ou mais numa sexta-feira", "fridayBig", "Sextador"],
  ["anonovo", "Ano Novo, Rotina Nova", "Começos importam.", "Concluir uma missão em 1º de janeiro", "newYear", "Resolução Cumprida"],
  ["natal", "Espírito Natalino", "Nem no feriado.", "Concluir uma missão em 25 de dezembro", "xmas", "Duende Produtivo"],
  ["aniversario", "Aniversário", "O tempo voa.", "1 ano desde o primeiro acesso, com missão no dia", "anniversary", "Veterano de Guerra"],
];
export const SECRETS = SECRETS_RAW.map(([id, name, hint, desc, key, title]) => ({ id, name, hint, desc, key, title }));

export const TOTAL = TRAILS.length * 4 + SINGLES.length + SECRETS.length;

// Lista plana de todas as conquistas, com id único, XP e título.
export const ALL = [
  ...TRAILS.flatMap((t) => t.goals.map((g, i) => ({
    id: t.id + "-" + (i + 1), kind: "trail", trail: t, tier: i,
    name: t.name + " " + TIER_NAMES[i], xp: TIER_XP[i],
    title: i >= 2 ? t.titles[i - 2] : null,
  }))),
  ...SINGLES.map((s) => ({ id: s.id, kind: "single", name: s.name, xp: SINGLE_XP, title: s.title, def: s })),
  ...SECRETS.map((s) => ({ id: s.id, kind: "secret", name: s.name, xp: SECRET_XP, title: s.title, def: s })),
];
export const BY_ID = Object.fromEntries(ALL.map((a) => [a.id, a]));

// Quais conquistas o contexto atual permite desbloquear.
export function eligible(ctx) {
  const out = [];
  for (const a of ALL) {
    if (a.kind === "trail") { if ((ctx[a.trail.key] || 0) >= a.trail.goals[a.tier]) out.push(a.id); }
    else if (ctx[a.def.key]) out.push(a.id);
  }
  return out;
}
