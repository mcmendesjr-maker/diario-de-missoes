// Telas e regras de jogo do Diário de Missões.
import {
  db, login, logout, watchUser,
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot,
  arrayUnion, arrayRemove, writeBatch
} from "./firebase.js";
import { TRAILS, SINGLES, SECRETS, ALL, BY_ID, TOTAL, TIER_NAMES, TIER_KEYS, eligible } from "./achievements.js";

/* =========================================================
   Regras de jogo
   ========================================================= */
const XP = { 1: 10, 2: 25, 3: 50 };
const DIFF = { 1: "Fácil", 2: "Média", 3: "Difícil" };
const RANKS = ["Iniciante", "Aprendiz", "Em ritmo", "Constante", "Disciplina de ferro", "Imparável", "Mestre da rotina", "Lenda"];

// Nível 1→2 pede 100 XP; cada nível seguinte pede 50 XP a mais.
function levelFor(xp) {
  let lvl = 1, need = 100, floor = 0;
  while (xp >= floor + need) { floor += need; lvl++; need = 100 + (lvl - 1) * 50; }
  return { lvl, into: xp - floor, need };
}
const rankOf = (lvl) => RANKS[Math.min(lvl - 1, RANKS.length - 1)];

/* =========================================================
   Estado
   ========================================================= */
let user = null;              // usuário do Firebase Auth
let uid = null;
let profile = null;           // users/{uid}
let tasks = new Map();        // users/{uid}/tasks
let loaded = false;
let subs = [];                // inscrições ativas (para cancelar ao sair)
let groupSubs = new Map();    // código -> cancelar inscrição
let groupData = new Map();    // código -> { name, owner, members: [] }

let view = "missoes", tab = "hoje", filter = "todas", rankBy = "week";
const form = { cat: "pessoal", diff: 1 };
let editing = null;           // { id, title, cat, diff, due }
let armed = null;             // missão aguardando confirmação de exclusão
let lastLevel = null;
let lastSync = "";            // evita regravar o ranking sem mudança

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* =========================================================
   Datas (horário local)
   ========================================================= */
const dstr = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const today = () => dstr(new Date());
function addDays(s, n) { const [y, m, d] = s.split("-").map(Number); return dstr(new Date(y, m - 1, d + n)); }
function weekStart(s = today()) { const [y, m, d] = s.split("-").map(Number); const dt = new Date(y, m - 1, d); const back = (dt.getDay() + 6) % 7; return addDays(s, -back); } // segunda-feira
const WD = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
function nice(s) { const [y, m, d] = s.split("-").map(Number); return WD[new Date(y, m - 1, d).getDay()] + ", " + d + " " + MO[m - 1]; }

/* =========================================================
   Cálculos (o XP é sempre recalculado das missões concluídas)
   ========================================================= */
const dayNum = (s) => { const [y, m, d] = s.split("-").map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000); };
const weekday = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d).getDay(); };

// Bônus das conquistas já desbloqueadas (guardadas no perfil com a data).
function bonusInfo() {
  const ach = profile?.ach || {}, ws = weekStart(), td = today();
  let total = 0, week = 0, todayXp = 0;
  for (const [id, ts] of Object.entries(ach)) {
    const a = BY_ID[id]; if (!a) continue;
    total += a.xp;
    const d = dstr(new Date(ts));
    if (d >= ws) week += a.xp;
    if (d === td) todayXp += a.xp;
  }
  return { total, week, today: todayXp };
}

function computeStats() {
  const td = today(), ws = weekStart();
  const byDay = {}, countDay = {}, hardDay = {}, weekCats = {};
  let missionXp = 0, count = 0, hard = 0, pontual = 0, early = 0, night = 0, insomnia = 0, maxDaily = 0, withDue = 0, overdue = 0;
  const cats = { pessoal: 0, profissional: 0 };
  let dailyExists = false;
  const lateByWeek = {}; // semanas em que alguma missão com prazo atrasou

  for (const t of tasks.values()) {
    const xp = XP[t.diff] || 10;
    if (t.daily) { dailyExists = true; maxDaily = Math.max(maxDaily, (t.done || []).length); }
    if (!t.daily && t.due) {
      withDue++;
      const late = t.doneAt ? t.doneAt > t.due : t.due < td;
      if (late) lateByWeek[weekStart(t.due)] = true;
      if (!t.doneAt && t.due < td) overdue++;
      if (t.doneAt && t.doneAt <= t.due) pontual++;
    }
    const entries = t.daily
      ? (t.done || []).map((d) => [d, t.hours ? t.hours[d] : undefined])
      : (t.doneAt ? [[t.doneAt, t.doneHour]] : []);
    for (const [d, h] of entries) {
      byDay[d] = (byDay[d] || 0) + xp; countDay[d] = (countDay[d] || 0) + 1;
      missionXp += xp; count++; cats[t.cat] = (cats[t.cat] || 0) + 1;
      if (t.diff === 3) { hard++; hardDay[d] = (hardDay[d] || 0) + 1; }
      const w = weekStart(d); weekCats[w] = weekCats[w] || { pessoal: 0, profissional: 0 }; weekCats[w][t.cat]++;
      if (typeof h === "number") { if (h < 7) early++; if (h >= 22) night++; if (h >= 3 && h < 5) insomnia++; }
    }
  }

  // sequências
  const days = Object.keys(byDay).sort();
  let bestStreak = 0, run = 0, prev = null, comeback = false;
  for (const d of days) {
    const n = dayNum(d);
    if (prev !== null && n - prev >= 8) comeback = true;
    run = prev !== null && n - prev === 1 ? run + 1 : 1;
    bestStreak = Math.max(bestStreak, run); prev = n;
  }
  let streak = 0, d = td;
  if (!byDay[d]) d = addDays(d, -1);
  while (byDay[d]) { streak++; d = addDays(d, -1); }

  // semanas e dias
  const weekXpMap = {};
  for (const d2 of days) { const w = weekStart(d2); weekXpMap[w] = (weekXpMap[w] || 0) + byDay[d2]; }
  const maxDay = Math.max(0, ...Object.values(byDay));
  const maxWeek = Math.max(0, ...Object.values(weekXpMap));
  let weekends = 0;
  for (const d2 of days) if (weekday(d2) === 6 && byDay[addDays(d2, 1)]) weekends++;
  let cleanWeek = false;
  for (const w of Object.keys(weekXpMap)) {
    if (w >= ws) continue; // só semanas já encerradas
    let c = 0; for (let i = 0; i < 7; i++) c += countDay[addDays(w, i)] || 0;
    if (c >= 5 && !lateByWeek[w]) { cleanWeek = true; break; }
  }

  // hoje
  const B = buckets();
  const perfectDay = B.hoje.length >= 5 && B.hoje.every(isDoneToday);

  // grupos
  const codes = profile?.groups || [];
  let founder = false, groupOf5 = false, leader = false;
  for (const c of codes) {
    const g = groupData.get(c); if (!g) continue;
    if (g.owner === uid) founder = true;
    const ms = g.members || [];
    if (ms.length >= 5) groupOf5 = true;
    if (ms.length >= 3) {
      const pts = (m) => (m.week === ws ? m.weekXp : 0);
      const me = ms.find((m) => m.id === uid);
      if (me && pts(me) >= 100 && ms.every((m) => m.id === uid || pts(m) < pts(me))) leader = true;
    }
  }

  const bonus = bonusInfo();
  let weekMission = 0; for (let i = 0; i < 7; i++) weekMission += byDay[addDays(ws, i)] || 0;
  const created = profile?.createdAt || Date.now();

  const ctx = {
    count, bestStreak, missionXp, missionLevel: levelFor(missionXp).lvl, pessoal: cats.pessoal, profissional: cats.profissional,
    hard, maxDaily, pontual, maxDay, maxWeek, weekends, early, night, activeDays: days.length,
    first: count >= 1, streak3: bestStreak >= 3, dailyExists, planner: withDue >= 10,
    balance5: cats.pessoal >= 5 && cats.profissional >= 5, balance50: cats.pessoal >= 50 && cats.profissional >= 50,
    balancedWeek: Object.values(weekCats).some((c) => c.pessoal >= 5 && c.profissional >= 5),
    trioHard: Object.values(hardDay).some((n) => n >= 3), perfectDay,
    faxina: overdue === 0 && (profile?.flags?.od || 0) >= 3, cleanWeek,
    inGroup: codes.length >= 1, founder, groupOf5, leader,
    comeback, insomnia: insomnia >= 1, tenInDay: Object.values(countDay).some((n) => n >= 10),
    exact100: days.some((x) => x < td && byDay[x] === 100),
    fridayBig: days.some((x) => weekday(x) === 5 && byDay[x] >= 150),
    newYear: days.some((x) => x.endsWith("-01-01")), xmas: days.some((x) => x.endsWith("-12-25")),
    anniversary: !!byDay[td] && Date.now() - created >= 365 * 86400000,
  };

  return {
    byDay, count, cats, streak, overdue, ctx, bonus,
    missionXp, total: missionXp + bonus.total,
    todayXp: (byDay[td] || 0) + bonus.today,
    weekXp: weekMission + bonus.week, week: ws,
  };
}
const isDoneToday = (t) => t.daily ? (t.done || []).includes(today()) : !!t.doneAt;

function buckets() {
  const td = today(), hoje = [], prox = [], feitas = [];
  for (const [id, t] of tasks) {
    const item = { id, ...t };
    if (t.daily) { hoje.push(item); continue; }
    if (t.doneAt) { feitas.push(item); if (t.doneAt === td) hoje.push(item); continue; }
    if (t.due && t.due > td) prox.push(item); else hoje.push(item);
  }
  const key = (x) => x.due || "9999";
  hoje.sort((a, b) => (isDoneToday(a) - isDoneToday(b)) || key(a).localeCompare(key(b)) || (b.diff - a.diff));
  prox.sort((a, b) => key(a).localeCompare(key(b)));
  feitas.sort((a, b) => b.doneAt.localeCompare(a.doneAt));
  return { hoje, prox, feitas };
}

/* =========================================================
   Desenho da tela
   ========================================================= */
const CHECK = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5l3.2 3L13 4.5"/></svg>';

function render() {
  const s = computeStats(), L = levelFor(s.total);
  renderStatus(s, L);
  if (view === "missoes") renderTasks();
  if (view === "progresso") renderProgress(s, L);
  if (view === "grupos") renderGroups();
  if (view === "conta") renderTitles();
  syncRanking(s, L);
  checkAchievements(s);
}

function renderStatus(s, L) {
  $("lvl").textContent = L.lvl;
  $("rank").textContent = rankOf(L.lvl);
  $("barFill").style.width = (L.into / L.need * 100) + "%";
  $("barNow").textContent = L.into + " / " + L.need + " XP";
  $("barNext").textContent = "faltam " + (L.need - L.into) + " XP para o nível " + (L.lvl + 1);
  $("sToday").textContent = s.todayXp;
  $("sStreak").textContent = s.streak;
  $("sTotal").textContent = s.total;
  const title = profile?.title && profile?.ach?.[profile.title] ? BY_ID[profile.title]?.title : null;
  const done = s.count ? s.count + (s.count === 1 ? " missão concluída" : " missões concluídas") : "Conclua missões para ganhar XP e subir de nível.";
  $("sub").textContent = title ? "“" + title + "” · " + done : done;
  if (loaded && lastLevel !== null && L.lvl > lastLevel) {
    const b = $("lvlBanner"); b.className = "levelup"; b.hidden = false;
    b.innerHTML = "<span>Subiu para o nível " + L.lvl + ": " + esc(rankOf(L.lvl)) + "!</span><button type=\"button\" id=\"lvlOk\">Fechar</button>";
    $("lvlOk").onclick = () => { b.hidden = true; };
  }
  if (loaded) lastLevel = L.lvl;
}

function segHtml(attr, items, current) {
  return '<div class="seg">' + items.map(([v, label]) => '<button type="button" ' + attr + '="' + v + '" aria-pressed="' + (String(current) === String(v)) + '">' + label + "</button>").join("") + "</div>";
}

function renderTasks() {
  const B = buckets(), f = (x) => filter === "todas" || x.cat === filter;
  $("nHoje").textContent = B.hoje.filter((x) => !isDoneToday(x)).length || "";
  $("nProx").textContent = B.prox.length || "";
  $("nFeitas").textContent = B.feitas.length || "";
  // Enquanto edita, a lista não é redesenhada para não perder o que está sendo digitado.
  if (editing && tasks.has(editing.id) && document.querySelector(".editbox")) return;

  const rows = (tab === "hoje" ? B.hoje : tab === "proximas" ? B.prox : B.feitas).filter(f);
  const list = $("list");
  if (!loaded) { list.innerHTML = '<li class="empty"><b>Carregando missões…</b>Isso leva só um instante.</li>'; return; }
  if (!rows.length) {
    const msg = tasks.size === 0
      ? '<b>Nenhuma missão ainda</b>Escreva a primeira lá em cima, escolha se é pessoal ou profissional e a dificuldade.<br><button type="button" class="ghost" id="seed">Começar com missões de exemplo</button>'
      : tab === "hoje" ? "<b>Tudo em dia</b>Nada pendente para hoje" + (filter !== "todas" ? " nesse filtro" : "") + "."
      : tab === "proximas" ? "<b>Sem missões futuras</b>Missões com prazo depois de hoje aparecem aqui."
      : "<b>Nada concluído ainda</b>Missões finalizadas ficam guardadas aqui.";
    list.innerHTML = '<li class="empty">' + msg + "</li>";
    const sb = $("seed"); if (sb) sb.onclick = seed;
    return;
  }
  const td = today();
  list.innerHTML = rows.map((t) => {
    if (editing && editing.id === t.id) return editRow(t);
    const done = isDoneToday(t);
    let when = "";
    if (t.daily) when = "<span>todo dia" + ((t.done || []).length ? " · " + t.done.length + "×" : "") + "</span>";
    else if (t.doneAt) when = "<span>feita " + (t.doneAt === td ? "hoje" : nice(t.doneAt)) + "</span>";
    else if (t.due) when = t.due < td ? '<span class="late">atrasada · ' + nice(t.due) + "</span>" : "<span>" + (t.due === td ? "vence hoje" : nice(t.due)) + "</span>";
    return '<li class="task' + (done ? " done" : "") + '" data-id="' + esc(t.id) + '">' +
      '<button type="button" class="check" data-act="toggle" aria-label="' + (done ? "Desmarcar" : "Concluir") + " " + esc(t.title) + '">' + CHECK + "</button>" +
      '<div class="body"><div class="ttl edit" data-act="edit" role="button" tabindex="0">' + esc(t.title) + '</div><div class="meta"><span class="tag ' + esc(t.cat) + '">' + (t.cat === "profissional" ? "Profissional" : "Pessoal") + "</span><span>" + DIFF[t.diff] + "</span>" + when + "</div></div>" +
      '<span class="xp">+' + (XP[t.diff] || 10) + "</span>" +
      '<button type="button" class="del' + (armed === t.id ? " arm" : "") + '" data-act="del" aria-label="Excluir ' + esc(t.title) + '">' + (armed === t.id ? "Excluir?" : "✕") + "</button></li>";
  }).join("");
}

function editRow(t) {
  return '<li class="task" data-id="' + esc(t.id) + '"><div class="editbox">' +
    '<input type="text" id="editTitle" maxlength="140" value="' + esc(editing.title) + '" aria-label="Nome da missão">' +
    '<div class="opts">' +
      segHtml("data-ecat", [["pessoal", "Pessoal"], ["profissional", "Profissional"]], editing.cat) +
      segHtml("data-ediff", [[1, "Fácil · 10"], [2, "Média · 25"], [3, "Difícil · 50"]], editing.diff) +
      (t.daily ? '<span class="chk">Todo dia</span>' : '<input type="date" id="editDue" value="' + esc(editing.due || "") + '" aria-label="Prazo">') +
    "</div>" +
    '<div class="acts"><button type="button" class="cancel" data-act="ecancel">Cancelar</button><button type="button" class="save" data-act="esave">Salvar</button></div>' +
    "</div></li>";
}

function renderProgress(s, L) {
  const days = []; for (let i = 6; i >= 0; i--) days.push(addDays(today(), -i));
  const vals = days.map((d) => s.byDay[d] || 0), max = Math.max(50, ...vals);
  $("weekSum").textContent = vals.reduce((a, b) => a + b, 0) + " XP";
  $("week").innerHTML = days.map((d, i) => {
    const [y, m, dd] = d.split("-").map(Number);
    return '<div class="col' + (i === 6 ? " today" : "") + '"><span class="v">' + (vals[i] || "") + '</span><div class="b" style="height:' + (vals[i] / max * 78) + '%"></div><span class="d">' + (i === 6 ? "hoje" : WD[new Date(y, m - 1, dd).getDay()]) + "</span></div>";
  }).join("");
  const ach = profile?.ach || {}, ctx = s.ctx;
  const got = ALL.filter((a) => ach[a.id]).length;
  $("achCount").textContent = got + "/" + TOTAL;
  $("achBonus").textContent = "+" + s.bonus.total + " XP de bônus";
  const when = (id) => ach[id] ? "conquistada em " + nice(dstr(new Date(ach[id]))).replace(/^\w+, /, "") : "";
  const fmt = (n) => n.toLocaleString("pt-BR");

  // trilhas
  $("trails").innerHTML = TRAILS.map((t) => {
    const reached = t.goals.filter((_, i) => ach[t.id + "-" + (i + 1)]).length;
    const val = ctx[t.key] || 0;
    const next = reached < 4 ? t.goals[reached] : null;
    const prevGoal = reached > 0 ? t.goals[reached - 1] : 0;
    const pct = next ? Math.min(100, Math.max(0, (val - prevGoal) / (next - prevGoal) * 100)) : 100;
    const medal = reached ? TIER_KEYS[reached - 1] : "none";
    const pips = t.goals.map((g, i) => '<span class="pip ' + (ach[t.id + "-" + (i + 1)] ? TIER_KEYS[i] : "") + '" title="' + TIER_NAMES[i] + ": " + fmt(g) + '"></span>').join("");
    return '<li class="trail"><div class="medal ' + medal + '">' + esc(t.icon) + "</div>" +
      '<div class="tbody"><div class="thead"><b>' + esc(t.name) + (reached ? ' <span class="tier ' + medal + '">' + TIER_NAMES[reached - 1] + "</span>" : "") + '</b><span class="pips">' + pips + "</span></div>" +
      '<div class="tbar"><i class="' + (next ? (reached < 4 ? TIER_KEYS[reached] : "") : "diamante") + '" style="width:' + pct + '%"></i></div>' +
      '<span class="tmeta">' + (next ? fmt(Math.min(val, next)) + " / " + fmt(next) + " " + esc(t.unit) + " · próximo: " + TIER_NAMES[reached] + " +" + [25, 50, 100, 250][reached] + " XP" : "Trilha completa · " + fmt(val) + " " + esc(t.unit)) + "</span></div></li>";
  }).join("");

  // avulsas
  $("singles").innerHTML = SINGLES.map((x) => {
    const on = !!ach[x.id];
    return '<div class="a' + (on ? " on" : "") + '"><div class="ic">★</div><div><b>' + esc(x.name) + "</b><span>" + esc(x.desc) + "</span>" +
      '<span class="xpline">+50 XP' + (x.title ? " · título “" + esc(x.title) + "”" : "") + (on ? " · " + when(x.id) : "") + "</span></div></div>";
  }).join("");

  // secretas
  $("secrets").innerHTML = SECRETS.map((x) => {
    const on = !!ach[x.id];
    return '<div class="a secret' + (on ? " on" : "") + '"><div class="ic">' + (on ? "✦" : "?") + "</div><div><b>" + (on ? esc(x.name) : "???") + "</b><span>" + esc(on ? x.desc : x.hint) + "</span>" +
      '<span class="xpline">+100 XP' + (on ? " · título “" + esc(x.title) + "” · " + when(x.id) : "") + "</span></div></div>";
  }).join("");
}

/* =========================================================
   Conquistas: desbloqueio e títulos
   ========================================================= */
let achPending = false;
async function checkAchievements(s) {
  if (!loaded || !profile || achPending) return;
  const ach = profile.ach || {};
  const updates = {};
  // Faxina: lembra quando chegou a ter 3 ou mais atrasadas.
  const od = profile.flags?.od || 0;
  if (s.overdue >= 3 && od < 3) updates["flags.od"] = s.overdue;
  const fresh = eligible(s.ctx).filter((id) => !ach[id]);
  if (fresh.includes("faxina")) updates["flags.od"] = 0;
  const now = Date.now();
  for (const id of fresh) updates["ach." + id] = now;
  if (!Object.keys(updates).length) return;
  achPending = true;
  try {
    if (!profile.flags && updates["flags.od"] !== undefined) { updates.flags = { od: updates["flags.od"] }; delete updates["flags.od"]; }
    if (!profile.ach && fresh.length) { updates.ach = Object.fromEntries(fresh.map((id) => [id, now])); fresh.forEach((id) => delete updates["ach." + id]); }
    await updateDoc(profileRef(), updates);
    if (fresh.length) announce(fresh);
  } catch (e) { showDbError(e); }
  finally { achPending = false; }
}

function announce(ids) {
  const xp = ids.reduce((a, id) => a + (BY_ID[id]?.xp || 0), 0);
  const b = $("achBanner"); b.hidden = false;
  if (ids.length === 1) {
    const a = BY_ID[ids[0]];
    b.innerHTML = '<span><small>Conquista desbloqueada</small>' + esc(a.name) + ' <span class="mono">+' + xp + " XP</span>" + (a.title ? "<small>Novo título: “" + esc(a.title) + "”</small>" : "") + "</span>";
  } else {
    b.innerHTML = '<span><small>' + ids.length + " conquistas desbloqueadas</small>" + ids.slice(0, 3).map((id) => esc(BY_ID[id].name)).join(", ") + (ids.length > 3 ? " e mais " + (ids.length - 3) : "") + ' <span class="mono">+' + xp + " XP</span></span>";
  }
  b.insertAdjacentHTML("beforeend", '<button type="button" id="achOk">Ver</button>');
  $("achOk").onclick = () => { b.hidden = true; document.querySelector('[data-view="progresso"]').click(); };
  clearTimeout(announce.t); announce.t = setTimeout(() => { b.hidden = true; }, 8000);
}

function renderTitles() {
  const sel = $("titleSel"); if (!sel) return;
  const ach = profile?.ach || {};
  const owned = ALL.filter((a) => a.title && ach[a.id]);
  const cur = profile?.title && ach[profile.title] ? profile.title : "";
  const html = '<option value="">Sem título</option>' + owned.map((a) => '<option value="' + esc(a.id) + '"' + (a.id === cur ? " selected" : "") + ">" + esc(a.title) + " (" + esc(a.name) + ")</option>").join("");
  if (sel.dataset.html !== html) { sel.innerHTML = html; sel.dataset.html = html; }
  $("titleHint").textContent = owned.length ? owned.length + " títulos disponíveis. Ele aparece no seu painel e no ranking dos grupos." : "Você ganha títulos nas conquistas de ouro, diamante, secretas e em algumas especiais.";
}

function renderGroups() {
  const box = $("groups");
  const codes = profile?.groups || [];
  if (!codes.length) {
    box.innerHTML = '<div class="empty"><b>Você ainda não está em nenhum grupo</b>Crie um grupo acima e envie o código, ou entre com o código que alguém te mandou.</div>';
    return;
  }
  const ws = weekStart();
  box.innerHTML = codes.map((code) => {
    const g = groupData.get(code);
    if (!g) return '<div class="group"><div class="ghead"><h2>Carregando grupo…</h2><span class="code">' + esc(code) + "</span></div></div>";
    const pts = (m) => rankBy === "week" ? (m.week === ws ? m.weekXp : 0) : m.total;
    const members = [...(g.members || [])].sort((a, b) => pts(b) - pts(a) || b.total - a.total);
    const rows = members.map((m, i) =>
      '<li class="rk' + (m.id === uid ? " me" : "") + '"><span class="pos">' + (i + 1) + "</span>" +
      (m.photo ? '<img src="' + esc(m.photo) + '" alt="" referrerpolicy="no-referrer">' : '<span class="ph0">' + esc((m.name || "?").charAt(0).toUpperCase()) + "</span>") +
      '<span class="nm">' + esc(m.name || "Sem nome") + (m.id === uid ? " (você)" : "") + "<small>Nível " + (m.level || 1) + " · " + esc(m.title || rankOf(m.level || 1)) + "</small></span>" +
      '<span class="pts">' + pts(m) + " XP</span></li>").join("");
    return '<div class="group" data-code="' + esc(code) + '"><div class="ghead"><h2>' + esc(g.name || "Grupo") + "</h2>" +
      '<span style="display:flex;gap:6px;align-items:center"><button type="button" class="code" data-gact="copy" title="Copiar código">' + esc(code) + "</button>" +
      '<button type="button" class="leave" data-gact="leave">' + (g.leaveArmed ? "Sair mesmo?" : "Sair") + "</button></span></div>" +
      '<ul class="ranklist">' + (rows || '<li class="note">Ninguém no ranking ainda.</li>') + "</ul></div>";
  }).join("");
}

/* =========================================================
   Avisos
   ========================================================= */
let toastT;
function toast(html) { const t = $("toast"); t.innerHTML = html; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2000); }
function showDbError(e) {
  const box = $("dbErr"); box.hidden = false;
  if (e && e.code === "permission-denied") box.textContent = "O banco recusou a operação. Confira se as regras novas do Firestore foram publicadas (arquivo firestore.rules).";
  else if (e && (e.code === "not-found" || e.code === "failed-precondition")) box.textContent = "O banco de dados ainda não existe. Crie o Firestore Database no console do Firebase.";
  else box.textContent = "Não consegui falar com o banco de dados. Verifique a internet e tente de novo.";
}

/* =========================================================
   Gravação de missões
   ========================================================= */
const tasksCol = () => collection(db, "users", uid, "tasks");
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
function put(id, data) {
  tasks.set(id, data); render();
  setDoc(doc(tasksCol(), id), data).catch((e) => { showDbError(e); toast("Não consegui salvar."); });
}
function remove(id) {
  tasks.delete(id); render();
  deleteDoc(doc(tasksCol(), id)).catch((e) => { showDbError(e); toast("Não consegui excluir."); });
}

/* =========================================================
   Ações: missões
   ========================================================= */
$("addForm").addEventListener("submit", (e) => {
  e.preventDefault();
  if (!loaded) return;
  const title = $("newTitle").value.trim(); if (!title) { $("newTitle").focus(); return; }
  const daily = $("newDaily").checked, due = $("newDue").value || null;
  const data = { title, cat: form.cat, diff: form.diff, daily, due: daily ? null : due, created: Date.now() };
  if (daily) data.done = []; else data.doneAt = null;
  put(newId(), data);
  $("newTitle").value = ""; $("newDue").value = ""; $("newDaily").checked = false; $("newDue").disabled = false;
  if (!daily && due && due > today()) toast("Missão agendada para " + esc(nice(due)));
});

function group(attr, fn) {
  document.querySelectorAll("[" + attr + "]").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll("[" + attr + "]").forEach((x) => x.setAttribute("aria-pressed", x === b)); fn(b);
  }));
}
group("data-cat", (b) => { form.cat = b.dataset.cat; });
group("data-diff", (b) => { form.diff = +b.dataset.diff; });
group("data-tab", (b) => { tab = b.dataset.tab; armed = null; editing = null; render(); });
group("data-filter", (b) => { filter = b.dataset.filter; editing = null; render(); });
group("data-rank", (b) => { rankBy = b.dataset.rank; render(); });
group("data-view", (b) => {
  view = b.dataset.view; editing = null;
  document.querySelectorAll(".view").forEach((v) => { v.hidden = v.id !== "view-" + view; });
  render();
});
$("newDaily").addEventListener("change", () => { $("newDue").disabled = $("newDaily").checked; });

$("list").addEventListener("click", (e) => {
  // botões de tipo e dificuldade dentro da edição
  const ec = e.target.closest("[data-ecat]"), ed = e.target.closest("[data-ediff]");
  if (ec || ed) {
    const attr = ec ? "data-ecat" : "data-ediff", b = ec || ed;
    b.parentElement.querySelectorAll("[" + attr + "]").forEach((x) => x.setAttribute("aria-pressed", x === b));
    if (ec) editing.cat = b.dataset.ecat; else editing.diff = +b.dataset.ediff;
    return;
  }
  const btn = e.target.closest("[data-act]"); if (!btn) return;
  const li = btn.closest(".task"); if (!li) return;
  const id = li.dataset.id, t = tasks.get(id); if (!t) return;
  const act = btn.dataset.act;

  if (act === "edit") {
    editing = { id, title: t.title, cat: t.cat, diff: t.diff, due: t.due || "" };
    armed = null;
    renderTasks();
    const inp = $("editTitle"); if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
    return;
  }
  if (act === "ecancel") { editing = null; renderTasks(); return; }
  if (act === "esave") { saveEdit(); return; }

  if (act === "del") {
    if (armed === id) { armed = null; remove(id); }
    else { armed = id; renderTasks(); setTimeout(() => { if (armed === id) { armed = null; renderTasks(); } }, 3000); }
    return;
  }
  if (act === "toggle") {
    const td = today(), xp = XP[t.diff] || 10, n = { ...t };
    let gained;
    const hour = new Date().getHours();
    if (t.daily) {
      const d = [...(t.done || [])], i = d.indexOf(td), hours = { ...(t.hours || {}) };
      if (i >= 0) { d.splice(i, 1); delete hours[td]; gained = false; } else { d.push(td); hours[td] = hour; gained = true; }
      n.done = d; n.hours = hours;
    } else { gained = !t.doneAt; n.doneAt = gained ? td : null; n.doneHour = gained ? hour : null; }
    put(id, n);
    toast(gained ? 'Missão concluída <span class="mono">+' + xp + " XP</span>" : 'Desmarcada <span class="mono">−' + xp + " XP</span>");
  }
});
$("list").addEventListener("keydown", (e) => {
  if (e.target.id === "editTitle") {
    if (e.key === "Enter") { e.preventDefault(); saveEdit(); }
    if (e.key === "Escape") { editing = null; renderTasks(); }
  } else if (e.target.dataset?.act === "edit" && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); e.target.click(); }
});
$("list").addEventListener("input", (e) => {
  if (!editing) return;
  if (e.target.id === "editTitle") editing.title = e.target.value;
  if (e.target.id === "editDue") editing.due = e.target.value;
});

function saveEdit() {
  const id = editing.id, t = tasks.get(id);
  if (!t) { editing = null; renderTasks(); return; }
  const title = editing.title.trim(); if (!title) { $("editTitle").focus(); return; }
  const n = { ...t, title, cat: editing.cat, diff: editing.diff, updated: Date.now() };
  if (!t.daily) n.due = editing.due || null;
  editing = null;
  put(id, n);
  toast("Missão atualizada");
}

function seed() {
  const td = today();
  const ex = [
    { title: "Beber 2 litros de água", cat: "pessoal", diff: 1, daily: true, done: [] },
    { title: "Planejar as prioridades do dia", cat: "profissional", diff: 1, daily: true, done: [] },
    { title: "Responder e-mails pendentes", cat: "profissional", diff: 2, daily: false, due: td, doneAt: null },
    { title: "Treino de 30 minutos", cat: "pessoal", diff: 2, daily: false, due: td, doneAt: null },
    { title: "Finalizar a apresentação do projeto", cat: "profissional", diff: 3, daily: false, due: addDays(td, 2), doneAt: null },
  ];
  ex.forEach((d, i) => put(newId() + i, { ...d, due: d.due || null, created: Date.now() + i }));
  toast("Exemplos adicionados. Exclua quando quiser.");
}

/* =========================================================
   Perfil
   ========================================================= */
const profileRef = () => doc(db, "users", uid);

async function ensureProfile() {
  const name = (user.displayName || user.email || "Sem nome").slice(0, 80);
  const photo = (user.photoURL || "").slice(0, 600);
  try {
    const snap = await getDoc(profileRef());
    if (!snap.exists()) {
      await setDoc(profileRef(), { name, photo, createdAt: Date.now(), onboarded: false, groups: [], ach: {}, title: "", flags: { od: 0 } });
    } else {
      const p = snap.data();
      if (p.name !== name || p.photo !== photo) await updateDoc(profileRef(), { name, photo });
    }
  } catch (e) { showDbError(e); }
}

$("obOk").addEventListener("click", async () => {
  $("onboard").hidden = true;
  if (profile && !profile.onboarded) { try { await updateDoc(profileRef(), { onboarded: true }); } catch (e) { showDbError(e); } }
});
$("howBtn").addEventListener("click", () => { $("onboard").hidden = false; $("obOk").focus(); });

/* =========================================================
   Grupos e ranking
   ========================================================= */
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sem 0/O e 1/I/L, que confundem
const makeCode = () => Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");
const memberRef = (code, id = uid) => doc(db, "groups", code, "members", id);

function memberData() {
  const s = computeStats(), L = levelFor(s.total);
  const title = profile?.title && profile?.ach?.[profile.title] ? (BY_ID[profile.title]?.title || "") : "";
  return { name: profile?.name || user.displayName || "Sem nome", photo: profile?.photo || "", title, level: L.lvl, total: s.total, week: s.week, weekXp: s.weekXp, updated: Date.now() };
}

function groupError(msg) { const b = $("groupErr"); b.textContent = msg; b.hidden = !msg; }

async function joinGroup(code) {
  code = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(code)) { groupError("O código tem 6 letras e números."); return false; }
  if ((profile?.groups || []).includes(code)) { groupError("Você já está nesse grupo."); return false; }
  if ((profile?.groups || []).length >= 10) { groupError("Você pode participar de até 10 grupos."); return false; }
  try {
    const g = await getDoc(doc(db, "groups", code));
    if (!g.exists()) { groupError("Nenhum grupo com esse código. Confira com quem te enviou."); return false; }
    await setDoc(memberRef(code), memberData());
    await updateDoc(profileRef(), { groups: arrayUnion(code) });
    groupError("");
    return true;
  } catch (e) { groupError("Não consegui entrar no grupo. Tente de novo."); return false; }
}

$("joinForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (await joinGroup($("joinCode").value)) { $("joinCode").value = ""; toast("Você entrou no grupo"); }
});

$("createForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = $("groupName").value.trim();
  if (!name) { $("groupName").focus(); return; }
  if ((profile?.groups || []).length >= 10) { groupError("Você pode participar de até 10 grupos."); return; }
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeCode();
    try {
      const exists = await getDoc(doc(db, "groups", code));
      if (exists.exists()) continue;
      await setDoc(doc(db, "groups", code), { name: name.slice(0, 40), owner: uid, createdAt: Date.now() });
      if (await joinGroup(code)) { $("groupName").value = ""; toast("Grupo criado. Código: <span class=\"mono\">" + code + "</span>"); }
      return;
    } catch (err) { /* código ocupado ou erro de rede: tenta outro */ }
  }
  groupError("Não consegui criar o grupo. Tente de novo.");
});

$("groups").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-gact]"); if (!btn) return;
  const code = btn.closest(".group").dataset.code, g = groupData.get(code);
  if (btn.dataset.gact === "copy") {
    try { await navigator.clipboard.writeText(code); toast("Código copiado"); }
    catch { toast("Código: <span class=\"mono\">" + code + "</span>"); }
    return;
  }
  if (btn.dataset.gact === "leave" && g) {
    if (!g.leaveArmed) { g.leaveArmed = true; renderGroups(); setTimeout(() => { g.leaveArmed = false; renderGroups(); }, 3000); return; }
    try {
      await deleteDoc(memberRef(code));
      await updateDoc(profileRef(), { groups: arrayRemove(code) });
      toast("Você saiu do grupo");
    } catch (err) { groupError("Não consegui sair do grupo. Tente de novo."); }
  }
});

// Acompanha os grupos da pessoa; abre e fecha inscrições conforme entra ou sai.
function watchGroups(codes) {
  for (const [code, stop] of groupSubs) if (!codes.includes(code)) { stop(); groupSubs.delete(code); groupData.delete(code); }
  for (const code of codes) {
    if (groupSubs.has(code)) continue;
    groupData.set(code, groupData.get(code) || null);
    getDoc(doc(db, "groups", code)).then((g) => {
      const cur = groupData.get(code) || { members: [] };
      groupData.set(code, { ...cur, name: g.exists() ? g.data().name : "Grupo removido", owner: g.exists() ? g.data().owner : null });
      if (view === "grupos") renderGroups();
    }).catch(() => {});
    const stop = onSnapshot(collection(db, "groups", code, "members"), (snap) => {
      const cur = groupData.get(code) || {};
      groupData.set(code, { ...cur, members: snap.docs.map((d) => ({ id: d.id, ...d.data() })) });
      if (view === "grupos") renderGroups();
    }, () => {});
    groupSubs.set(code, stop);
  }
  lastSync = ""; // força atualizar o próprio placar nos grupos
}

// Atualiza seu placar nos grupos quando o XP muda (com uma pequena espera para juntar cliques).
let syncT;
function syncRanking(s, L) {
  const codes = profile?.groups || [];
  if (!loaded || !codes.length) return;
  const sig = [L.lvl, s.total, s.week, s.weekXp, profile.name, profile.photo, profile.title || "", codes.join(",")].join("|");
  if (sig === lastSync) return;
  clearTimeout(syncT);
  syncT = setTimeout(async () => {
    lastSync = sig;
    const data = memberData();
    for (const code of codes) { try { await setDoc(memberRef(code), data); } catch (e) { /* grupo removido */ } }
  }, 1500);
}

/* =========================================================
   Conta: exportar e apagar
   ========================================================= */
$("exportBtn").addEventListener("click", () => {
  const q = (v) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
  const lines = [["Missão", "Tipo", "Dificuldade", "XP", "Diária", "Prazo", "Concluída em"].map(q).join(";")];
  for (const t of tasks.values()) {
    const dates = t.daily ? (t.done || []).join(", ") : (t.doneAt || "");
    lines.push([t.title, t.cat === "profissional" ? "Profissional" : "Pessoal", DIFF[t.diff], XP[t.diff], t.daily ? "Sim" : "Não", t.due || "", dates].map(q).join(";"));
  }
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "minhas-missoes-" + today() + ".csv";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast("Planilha baixada");
});

let wipeArmed = false;
$("wipeBtn").addEventListener("click", async () => {
  const btn = $("wipeBtn");
  if (!wipeArmed) {
    wipeArmed = true; btn.classList.add("arm");
    btn.querySelector("b").textContent = "Toque de novo para apagar tudo";
    setTimeout(() => { wipeArmed = false; btn.classList.remove("arm"); btn.querySelector("b").textContent = "Apagar todos os meus dados"; }, 4000);
    return;
  }
  wipeArmed = false;
  btn.querySelector("b").textContent = "Apagando…";
  try {
    const codes = profile?.groups || [];
    for (const code of codes) { try { await deleteDoc(memberRef(code)); } catch (e) { } }
    const all = await getDocs(tasksCol());
    let batch = writeBatch(db), n = 0;
    for (const d of all.docs) {
      batch.delete(d.ref); n++;
      if (n === 450) { await batch.commit(); batch = writeBatch(db); n = 0; }
    }
    await batch.commit();
    await deleteDoc(profileRef());
    toast("Seus dados foram apagados");
    await logout();
  } catch (e) {
    showDbError(e);
    btn.querySelector("b").textContent = "Apagar todos os meus dados";
    btn.classList.remove("arm");
  }
});

$("titleSel").addEventListener("change", async (e) => {
  try { await updateDoc(profileRef(), { title: e.target.value }); toast(e.target.value ? "Título atualizado" : "Título removido"); }
  catch (err) { showDbError(err); }
});

/* =========================================================
   Login e sessão
   ========================================================= */
$("loginBtn").addEventListener("click", async () => {
  const err = $("loginErr"); err.hidden = true;
  try { await login(); }
  catch (e) {
    err.hidden = false;
    if (e.code === "auth/unauthorized-domain") err.textContent = "Este endereço ainda não foi autorizado no Firebase. Adicione-o em Authentication → Configurações → Domínios autorizados.";
    else if (e.code === "auth/operation-not-allowed" || e.code === "auth/configuration-not-found") err.textContent = "O login com Google ainda não foi ativado em Authentication → Método de login.";
    else if (e.code === "auth/popup-closed-by-user" || e.code === "auth/cancelled-popup-request") err.hidden = true;
    else err.textContent = "Não foi possível entrar (" + (e.code || "erro") + "). Tente de novo.";
  }
});
$("logoutBtn").addEventListener("click", () => logout());

function stopAll() {
  subs.forEach((s) => s()); subs = [];
  groupSubs.forEach((s) => s()); groupSubs.clear(); groupData.clear();
}

watchUser(async (u) => {
  $("bootScreen").hidden = true;
  stopAll();
  if (!u) {
    user = null; uid = null; profile = null; tasks = new Map(); loaded = false; lastLevel = null; lastSync = "";
    $("appScreen").hidden = true; $("onboard").hidden = true; $("loginScreen").hidden = false;
    return;
  }
  user = u; uid = u.uid;
  $("loginScreen").hidden = true; $("appScreen").hidden = false; $("dbErr").hidden = true;
  $("userName").textContent = u.displayName || "";
  $("userEmail").textContent = u.email || "";
  for (const id of ["avatar", "avatarBig"]) { const im = $(id); if (u.photoURL) { im.src = u.photoURL; im.hidden = false; } else im.hidden = true; }
  render();

  await ensureProfile();
  subs.push(onSnapshot(profileRef(), (snap) => {
    profile = snap.exists() ? snap.data() : null;
    if (profile && !profile.onboarded) $("onboard").hidden = false;
    watchGroups(profile?.groups || []);
    render();
  }, () => {}));
  subs.push(onSnapshot(tasksCol(), (snap) => {
    const m = new Map(); snap.forEach((d) => m.set(d.id, d.data()));
    tasks = m; loaded = true; $("dbErr").hidden = true; render();
  }, (e) => { loaded = true; showDbError(e); render(); }));
});

// Recalcula "hoje" quando o app volta a ficar visível (por exemplo, num novo dia).
document.addEventListener("visibilitychange", () => { if (!document.hidden && uid) render(); });

// Modo offline e instalação no celular.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
