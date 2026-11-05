// Telas e regras de jogo do Diário de Missões.
import {
  db, login, logout, watchUser,
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot,
  arrayUnion, arrayRemove, writeBatch
} from "./firebase.js?v=10";
import { TRAILS, SINGLES, SECRETS, ALL, BY_ID, TOTAL, TIER_NAMES, TIER_KEYS, TIER_XP, eligible } from "./achievements.js?v=10";
import { ICONS, iconSvg, TAG_COLORS, tagColor, burst, confetti, countTo } from "./look.js?v=10";
import { avatarSvg, cleanAvatar, DEFAULT_AVATAR, SKINS, HAIR_COLORS, CLOTH_COLORS, BG_COLORS, HAIRS, EYES, MOUTHS, LASHES, LIPS, BEARDS, BODIES, GLASSES, EARRINGS, ITEMS, GEAR, FRAMES, MOODS, PRESETS } from "./avatar.js?v=10";

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
let user = null, uid = null;
let profile = null;           // users/{uid}
let tasks = new Map();        // users/{uid}/tasks
let loaded = false;
let subs = [];
let groupSubs = new Map();    // código -> cancelar inscrição
let groupData = new Map();    // código -> { name, owner, banned, members }

let view = "missoes", tab = "hoje", filter = "todas", rankBy = "week";
const form = { cat: "pessoal", diff: 1, rep: "once", days: [1, 2, 3, 4, 5], tags: [], icon: "" };
let editing = null;           // rascunho da missão aberta
let lastLevel = null, lastSync = "";
let histQuery = "", histLimit = 14;
let selDay = null;
let tagFilter = null;          // id da tag usada como filtro
let justDone = null;           // missão recém-concluída (para a animação)
let newTagFor = null;          // onde o campo "nova tag" está aberto: "add" ou "edit"            // dia escolhido na faixa da Agenda (null = hoje)
let groupUi = {};             // estado de botões dos grupos (confirmações, renomear)

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/* =========================================================
   Datas (horário local)
   ========================================================= */
const dstr = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const today = () => dstr(new Date());
function addDays(s, n) { const [y, m, d] = s.split("-").map(Number); return dstr(new Date(y, m - 1, d + n)); }
const weekday = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d).getDay(); };
function weekStart(s = today()) { return addDays(s, -((weekday(s) + 6) % 7)); } // segunda-feira
const dayNum = (s) => { const [y, m, d] = s.split("-").map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000); };
const WD = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const WD1 = ["D", "S", "T", "Q", "Q", "S", "S"];
const MO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
function nice(s) { const [y, m, d] = s.split("-").map(Number); return WD[new Date(y, m - 1, d).getDay()] + ", " + d + " " + MO[m - 1]; }
function dayLabel(s) { const td = today(); return s === td ? "Hoje" : s === addDays(td, -1) ? "Ontem" : nice(s); }
function quickDate(q) {
  const td = today();
  if (q === "none") return "";
  if (q === "fri") { const w = weekday(td); return addDays(td, ((5 - w + 7) % 7) || 7); }
  return addDays(td, +q);
}

/* =========================================================
   Repetição
   ========================================================= */
// Uma missão "daily" é qualquer missão que se repete; repeat define como.
function repeatOf(t) { return !t.daily ? "once" : (t.repeat || "daily"); }
function isScheduled(t, d) {
  if (!t.daily || t.paused) return false;
  const r = repeatOf(t);
  if (r === "week") return (t.days || []).includes(weekday(d));
  if (r === "month") {
    const [y, m, dd] = d.split("-").map(Number);
    const last = new Date(y, m, 0).getDate();
    return dd === Math.min(t.monthDay || 1, last);
  }
  return true;
}
function nextScheduled(t, from = today()) {
  for (let i = 1; i <= 62; i++) { const d = addDays(from, i); if (isScheduled(t, d)) return d; }
  return null;
}
function repeatLabel(t) {
  const r = repeatOf(t);
  if (r === "week") { const ds = [...(t.days || [])].sort(); return ds.length === 7 ? "todo dia" : ds.length === 5 && !ds.includes(0) && !ds.includes(6) ? "dias úteis" : ds.map((d) => WD[d]).join(", "); }
  if (r === "month") return "todo dia " + (t.monthDay || 1);
  return "todo dia";
}

/* =========================================================
   Cálculos (o XP é sempre recalculado das missões concluídas)
   ========================================================= */
function bonusInfo() {
  const ach = profile?.ach || {}, ws = weekStart(), pws = addDays(ws, -7), td = today();
  let total = 0, week = 0, prevWeek = 0, todayXp = 0;
  for (const [id, ts] of Object.entries(ach)) {
    const a = BY_ID[id]; if (!a) continue;
    total += a.xp;
    const d = dstr(new Date(ts));
    if (d >= ws) week += a.xp; else if (d >= pws) prevWeek += a.xp;
    if (d === td) todayXp += a.xp;
  }
  return { total, week, prevWeek, today: todayXp };
}
const isDoneOn = (t, d) => t.daily ? (t.done || []).includes(d) : t.doneAt === d;
const isDoneToday = (t) => t.daily ? (t.done || []).includes(today()) : !!t.doneAt;

function computeStats() {
  const td = today(), ws = weekStart();
  const byDay = {}, countDay = {}, hardDay = {}, weekCats = {};
  let missionXp = 0, count = 0, hard = 0, pontual = 0, early = 0, night = 0, insomnia = 0, maxDaily = 0, withDue = 0, overdue = 0;
  const cats = { pessoal: 0, profissional: 0 };
  let dailyExists = false;
  const lateByWeek = {};

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

  // sequência (escudos contam como dia ativo só para a sequência)
  const shields = new Set(profile?.shields || []);
  const days = Object.keys(byDay).sort();
  const streakDays = [...new Set([...days, ...shields])].sort();
  let bestStreak = 0, run = 0, prev = null;
  for (const d of streakDays) { const n = dayNum(d); run = prev !== null && n - prev === 1 ? run + 1 : 1; bestStreak = Math.max(bestStreak, run); prev = n; }
  let comeback = false; prev = null;
  for (const d of days) { const n = dayNum(d); if (prev !== null && n - prev >= 8) comeback = true; prev = n; }
  const active = (d) => !!byDay[d] || shields.has(d);
  let streak = 0, d = td;
  if (!active(d)) d = addDays(d, -1);
  while (active(d)) { streak++; d = addDays(d, -1); }

  const weekXpMap = {};
  for (const x of days) { const w = weekStart(x); weekXpMap[w] = (weekXpMap[w] || 0) + byDay[x]; }
  const maxDay = Math.max(0, ...Object.values(byDay));
  const maxWeek = Math.max(0, ...Object.values(weekXpMap));
  let weekends = 0;
  for (const x of days) if (weekday(x) === 6 && byDay[addDays(x, 1)]) weekends++;
  let cleanWeek = false;
  for (const w of Object.keys(weekXpMap)) {
    if (w >= ws) continue;
    let c = 0; for (let i = 0; i < 7; i++) c += countDay[addDays(w, i)] || 0;
    if (c >= 5 && !lateByWeek[w]) { cleanWeek = true; break; }
  }

  const B = buckets();
  const perfectDay = B.hoje.length >= 5 && B.hoje.every(isDoneToday);

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
  let weekMission = 0, prevWeekMission = 0;
  for (let i = 0; i < 7; i++) { weekMission += byDay[addDays(ws, i)] || 0; prevWeekMission += byDay[addDays(ws, i - 7)] || 0; }
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
    byDay, count, cats, streak, overdue, ctx, bonus, shields,
    missionXp, total: missionXp + bonus.total,
    todayXp: (byDay[td] || 0) + bonus.today,
    weekXp: weekMission + bonus.week, week: ws,
    prevWeekXp: prevWeekMission + bonus.prevWeek, prevWeek: addDays(ws, -7),
  };
}

function buckets() {
  const td = today(), hoje = [], prox = [];
  for (const [id, t] of tasks) {
    const item = { id, ...t };
    if (t.daily) {
      if (isScheduled(t, td) || isDoneOn(t, td)) hoje.push(item); else prox.push(item);
      continue;
    }
    if (t.doneAt) { if (t.doneAt === td) hoje.push(item); continue; }
    if (t.due && t.due > td) prox.push(item); else hoje.push(item);
  }
  const key = (x) => x.due || "9999";
  hoje.sort((a, b) => (isDoneToday(a) - isDoneToday(b)) || ((b.pin ? 1 : 0) - (a.pin ? 1 : 0)) || key(a).localeCompare(key(b)) || (b.diff - a.diff));
  const nextKey = (x) => x.daily ? (x.paused ? "9999-p" : (nextScheduled(x) || "9998")) : key(x);
  prox.sort((a, b) => ((b.pin ? 1 : 0) - (a.pin ? 1 : 0)) || nextKey(a).localeCompare(nextKey(b)));
  return { hoje, prox };
}

// Missões de um dia específico (faixa de dias da Agenda).
function dayItems(D) {
  const td = today(), out = [];
  for (const [id, t] of tasks) {
    let show;
    if (t.daily) show = isScheduled(t, D) || isDoneOn(t, D);
    else if (D === td) show = t.doneAt === td || (!t.doneAt && (!t.due || t.due <= td));
    else show = t.doneAt === D || (!t.doneAt && t.due === D);
    if (show) out.push({ id, ...t });
  }
  const done = (x) => isDoneOn(x, D) ? 1 : 0;
  out.sort((a, b) => done(a) - done(b) || (a.time || "99").localeCompare(b.time || "99") || ((b.pin ? 1 : 0) - (a.pin ? 1 : 0)) || (b.diff - a.diff));
  return out;
}
const nowHM = () => { const d = new Date(); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };
const hmToMin = (hm) => { const [h, m] = hm.split(":").map(Number); return h * 60 + m; };

// Todas as conclusões (uma por dia por missão), mais recentes primeiro.
function history() {
  const out = [];
  for (const [id, t] of tasks) {
    const dates = t.daily ? (t.done || []) : (t.doneAt ? [t.doneAt] : []);
    for (const d of dates) out.push({ id, t, date: d });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || a.t.title.localeCompare(b.t.title));
}

/* =========================================================
   Tags
   ========================================================= */
const tagsList = () => profile?.tags || [];
const tagById = (id) => tagsList().find((g) => g.id === id);
const taskTags = (t) => (t.tags || []).map(tagById).filter(Boolean);
function taskColor(t) {
  const g = taskTags(t)[0];
  return g ? tagColor(g.c) : (t.cat === "profissional" ? "#2FD0C8" : "#FFBD65");
}
function tagChip(g, extra = "") {
  return '<span class="tchip" style="--c:' + tagColor(g.c) + '"' + extra + "><i></i>" + esc(g.n) + "</span>";
}
function tagPickHtml(selected, scope) {
  const list = tagsList();
  return '<span class="fl">Tags</span><div class="chips tags">' +
    list.map((g) => '<button type="button" class="tpick" data-tpick="' + esc(g.id) + '" data-scope="' + scope + '" aria-pressed="' + selected.includes(g.id) + '" style="--c:' + tagColor(g.c) + '"><i></i>' + esc(g.n) + "</button>").join("") +
    (newTagFor === scope
      ? '<span class="newtag"><input type="text" id="newTag-' + scope + '" maxlength="24" placeholder="Nome da tag" aria-label="Nome da nova tag"><button type="button" data-tcreate="' + scope + '">Criar</button></span>'
      : (list.length < 30 ? '<button type="button" class="tadd" data-topen="' + scope + '">+ Nova tag</button>' : "")) +
    "</div>" + (selected.length >= 5 ? '<span class="hint">Máximo de 5 tags por missão.</span>' : "");
}
function iconPickHtml(current, scope) {
  return '<span class="fl">Ícone</span><div class="icons">' +
    '<button type="button" data-ipick="" data-scope="' + scope + '" aria-pressed="' + !current + '" aria-label="Sem ícone" class="none">—</button>' +
    Object.entries(ICONS).map(([k, [name]]) => '<button type="button" data-ipick="' + k + '" data-scope="' + scope + '" aria-pressed="' + (current === k) + '" aria-label="' + esc(name) + '" title="' + esc(name) + '">' + iconSvg(k) + "</button>").join("") +
    "</div>";
}
async function createTag(name) {
  name = name.trim().slice(0, 24); if (!name) return null;
  if (tagsList().length >= 30) { toast("Você pode ter até 30 tags"); return null; }
  const exists = tagsList().find((g) => g.n.toLowerCase() === name.toLowerCase());
  if (exists) return exists.id;
  const g = { id: newId(), n: name, c: tagsList().length % TAG_COLORS.length };
  profile = { ...profile, tags: [...tagsList(), g] };
  try { await updateDoc(profileRef(), { tags: profile.tags }); } catch (e) { showDbError(e); }
  return g.id;
}
function renderAddPickers() {
  $("newTags").innerHTML = tagPickHtml(form.tags, "add");
  $("newIcons").innerHTML = iconPickHtml(form.icon, "add");
}
function renderTagFilter() {
  const box = $("tagFilter"), list = tagsList();
  box.hidden = !list.length;
  if (!list.length) { tagFilter = null; return; }
  if (tagFilter && !tagById(tagFilter)) tagFilter = null;
  box.innerHTML = list.map((g) => '<button type="button" data-tfilter="' + esc(g.id) + '" aria-pressed="' + (tagFilter === g.id) + '" style="--c:' + tagColor(g.c) + '"><i></i>' + esc(g.n) + "</button>").join("");
}

/* =========================================================
   Desenho da tela
   ========================================================= */
const CHECK = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5l3.2 3L13 4.5"/></svg>';
const STAR = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.6l1.9 4.1 4.5.5-3.4 3 1 4.4L8 11.3 4 13.6l1-4.4-3.4-3 4.5-.5z"/></svg>';

function render() {
  const s = computeStats(), L = levelFor(s.total);
  renderStatus(s, L);
  if (view === "missoes") renderTasks();
  if (view === "progresso") renderProgress(s, L);
  if (view === "grupos") renderGroups();
  if (view === "conta") { renderTitles(); syncNotifyRow(); renderTagList(); }
  applyCards();
  renderMyAvatar();
  syncRanking(s, L);
  checkAchievements(s);
  checkShield(s);
}

function renderStatus(s, L) {
  $("lvl").textContent = L.lvl;
  $("rank").textContent = rankOf(L.lvl);
  $("barFill").style.width = (L.into / L.need * 100) + "%";
  $("barNow").textContent = L.into + " / " + L.need;
  $("barNext").textContent = "faltam " + (L.need - L.into) + " XP para o nível " + (L.lvl + 1);
  $("sToday").textContent = s.todayXp;
  $("sStreak").textContent = s.streak;
  const usedThisWeek = [...s.shields].some((d) => d >= weekStart());
  $("sShield").textContent = usedThisWeek ? "escudo usado" : "escudo pronto";
  $("sShield").classList.toggle("used", usedThisWeek);
  countTo($("sTotal"), s.total);
  $("sAch").textContent = ALL.filter((a) => profile?.ach?.[a.id]).length + "/" + TOTAL;
  const title = profile?.title && profile?.ach?.[profile.title] ? BY_ID[profile.title]?.title : null;
  const done = s.count ? s.count + (s.count === 1 ? " missão concluída" : " missões concluídas") : "Conclua missões para ganhar XP e subir de nível.";
  $("sub").textContent = title ? "“" + title + "” · " + done : done;
  if (loaded && lastLevel !== null && L.lvl > lastLevel) {
    const b = $("lvlBanner"); b.className = "levelup pop"; b.hidden = false;
    confetti();
    b.innerHTML = "<span>Subiu para o nível " + L.lvl + ": " + esc(rankOf(L.lvl)) + "!</span><button type=\"button\" id=\"lvlOk\">Fechar</button>";
    $("lvlOk").onclick = () => { b.hidden = true; };
  }
  if (loaded) lastLevel = L.lvl;
}

function segHtml(attr, items, current) {
  return '<div class="seg">' + items.map(([v, label]) => '<button type="button" ' + attr + '="' + v + '" aria-pressed="' + (String(current) === String(v)) + '">' + label + "</button>").join("") + "</div>";
}
function daysHtml(attr, sel) {
  return '<div class="days">' + [1, 2, 3, 4, 5, 6, 0].map((d) => '<button type="button" ' + attr + '="' + d + '" aria-pressed="' + sel.includes(d) + '" aria-label="' + WD[d] + '">' + WD1[d] + "</button>").join("") + "</div>";
}
function linkify(text) {
  return esc(text).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\n/g, "<br>");
}

function renderTasks() {
  const B = buckets(), f = (x) => (filter === "todas" || x.cat === filter) && (!tagFilter || (x.tags || []).includes(tagFilter));
  renderTagFilter();
  if (!document.activeElement || !document.activeElement.closest("#moreNew")) renderAddPickers();
  $("nHoje").textContent = B.hoje.filter((x) => !isDoneToday(x)).length || "";
  $("nProx").textContent = B.prox.length || "";
  $("nFeitas").textContent = "";
  $("histSearch").hidden = tab !== "feitas";
  $("dayStrip").hidden = tab !== "hoje";
  if (tab === "hoje") renderDayStrip();
  // Enquanto edita, a lista não é redesenhada para não perder o que está sendo digitado.
  if (editing && tasks.has(editing.id) && document.querySelector(".editbox")) return;

  const list = $("list");
  if (!loaded) { list.innerHTML = '<li class="empty"><b>Carregando missões…</b>Isso leva só um instante.</li>'; return; }
  if (tab === "feitas") { renderHistory(f); return; }

  const D = selDay || today();
  const rows = (tab === "hoje" ? dayItems(D) : B.prox).filter(f);
  // uma missão aberta para edição que não está nesta aba (ex.: concluída em outro dia) aparece no topo
  if (editing && tasks.has(editing.id) && !rows.some((r) => r.id === editing.id)) rows.unshift({ id: editing.id, ...tasks.get(editing.id) });
  if (!rows.length) {
    const msg = tasks.size === 0
      ? '<b>Nenhuma missão ainda</b>Escreva a primeira lá em cima, escolha se é pessoal ou profissional e a dificuldade.<br><button type="button" class="ghost" id="seed">Começar com missões de exemplo</button>'
      : tab === "hoje" ? (D === today() ? "<b>Tudo em dia</b>Nada pendente para hoje" + (filter !== "todas" ? " nesse filtro" : "") + "." : "<b>Nada neste dia</b>Nenhuma missão marcada para " + esc(nice(D)) + ".")
      : "<b>Sem missões futuras</b>Missões com prazo depois de hoje e repetições fora de hoje aparecem aqui.";
    list.innerHTML = '<li class="empty">' + msg + "</li>";
    const sb = $("seed"); if (sb) sb.onclick = seed;
    return;
  }
  if (tab === "hoje") {
    const timed = rows.filter((t) => t.time), untimed = rows.filter((t) => !t.time);
    list.innerHTML = timed.map((t) => editing && editing.id === t.id ? editRow(t) : taskRow(t, { day: D, tl: true })).join("") +
      (timed.length && untimed.length ? '<li class="dayhead"><b>Sem horário</b><span></span></li>' : "") +
      untimed.map((t) => editing && editing.id === t.id ? editRow(t) : taskRow(t, { day: D })).join("");
  } else list.innerHTML = rows.map((t) => editing && editing.id === t.id ? editRow(t) : taskRow(t)).join("");
}

function renderDayStrip() {
  const td = today(), D = selDay || td, box = $("dayStrip");
  const days = []; for (let i = -3; i <= 3; i++) days.push(addDays(td, i));
  box.innerHTML = days.map((d) => {
    const n = dayItems(d).filter((t) => !isDoneOn(t, d)).length;
    return '<button type="button" data-day="' + d + '" aria-pressed="' + (d === D) + '" class="' + (d === td ? "today" : "") + (n ? " has" : "") + '"><b>' + Number(d.slice(8)) + "</b><span>" + (d === td ? "hoje" : WD[weekday(d)]) + "</span></button>";
  }).join("");
}
$("dayStrip").addEventListener("click", (e) => {
  const b = e.target.closest("[data-day]"); if (!b) return;
  selDay = b.dataset.day === today() ? null : b.dataset.day; editing = null; renderTasks();
});

function taskRow(t, opts = {}) {
  const td = today();
  const date = opts.date || td;
  const day = opts.day || td;
  const done = opts.date ? true : opts.day ? isDoneOn(t, day) : isDoneToday(t);
  const canToggle = !!opts.date || day === td || (day === addDays(td, -1));
  let when = "";
  if (opts.date) when = "<span>" + (t.daily ? "repetição" : "") + "</span>";
  else if (t.daily) {
    if (t.paused) when = '<span class="paused">pausada · ' + esc(repeatLabel(t)) + "</span>";
    else {
      const next = isScheduled(t, td) || isDoneOn(t, td) ? null : nextScheduled(t);
      when = "<span>" + esc(repeatLabel(t)) + ((t.done || []).length ? " · " + t.done.length + "×" : "") + (next ? " · próxima " + nice(next) : "") + "</span>";
    }
  } else if (t.doneAt) when = "<span>feita " + (t.doneAt === td ? "hoje" : nice(t.doneAt)) + "</span>";
  else if (t.due) when = t.due < td ? '<span class="late">atrasada · ' + nice(t.due) + "</span>" : "<span>" + (t.due === td ? "vence hoje" : nice(t.due)) + "</span>";

  const subsArr = t.subs || [];
  const subsDone = subsDoneFor(t);
  const subsHtml = subsArr.length && !opts.date
    ? '<ul class="subs">' + subsArr.map((s, i) => '<li><label><input type="checkbox" data-act="sub" data-i="' + i + '"' + (subsDone[i] ? " checked" : "") + '><span>' + esc(s.t) + "</span></label></li>").join("") + "</ul>"
    : "";
  let state = "";
  if (!opts.date) {
    if (done) state = '<span class="state done">Concluída</span>';
    else if (day < td || (day === td && !t.daily && t.due && t.due < td)) state = '<span class="state late">Atrasada</span>';
    else if (day === td && t.time) {
      const diffMin = hmToMin(t.time) - hmToMin(nowHM());
      if (diffMin <= 0 && diffMin > -90) state = '<span class="state now">Agora</span>';
      else if (diffMin <= -90) state = '<span class="state late">Passou da hora</span>';
    }
  }
  const tchips = taskTags(t).map((g) => tagChip(g)).join("");
  const meta = state + tchips + '<span class="tag ' + esc(t.cat) + '">' + (t.cat === "profissional" ? "Profissional" : "Pessoal") + "</span><span>" + DIFF[t.diff] + "</span>" + when +
    (subsArr.length ? '<span class="pill">' + subsDone.filter(Boolean).length + "/" + subsArr.length + "</span>" : "") +
    (t.note ? '<span class="pill" title="Tem nota">nota</span>' : "") +
    (t.time && !opts.tl ? '<span class="pill mono">' + esc(t.time) + "</span>" : "");
  const dataDate = opts.date ? date : (opts.day && opts.day !== td ? opts.day : null);
  return '<li class="task cat-' + esc(t.cat) + (done ? " done" : "") + (t.pin ? " pinned" : "") + (t.paused ? " is-paused" : "") + (justDone === t.id && done ? " justdone" : "") + '" style="--tc:' + taskColor(t) + '" data-id="' + esc(t.id) + '"' + (dataDate ? ' data-date="' + dataDate + '"' : "") + ">" +
    (opts.tl ? '<span class="tl">' + esc(t.time) + "</span>" : "") +
    '<button type="button" class="check" data-act="toggle" aria-label="' + (done ? "Desmarcar" : "Concluir") + " " + esc(t.title) + '"' + ((t.paused && !opts.date) || !canToggle ? " disabled" : "") + ">" + CHECK + "</button>" +
    (t.icon && ICONS[t.icon] ? '<span class="ticon">' + iconSvg(t.icon) + "</span>" : "") +
    '<div class="body"><div class="ttl edit" data-act="open" role="button" tabindex="0">' + esc(t.title) + '</div><div class="meta">' + meta + "</div>" + subsHtml + "</div>" +
    '<span class="xp">+' + (XP[t.diff] || 10) + "</span>" +
    (opts.date ? "" : '<button type="button" class="pinbtn" data-act="pin" aria-pressed="' + !!t.pin + '" aria-label="' + (t.pin ? "Desafixar" : "Fixar no topo") + '">' + STAR + "</button>") +
    "</li>";
}

// Subtarefas: em missões que se repetem, as marcações valem só para o dia.
function subsDoneFor(t) {
  const arr = t.subs || [];
  if (t.daily && t.subsDay !== today()) return arr.map(() => false);
  return arr.map((s) => !!s.d);
}

function renderHistory(f) {
  const q = norm(histQuery);
  const items = history().filter((h) => f(h.t) && (!q || norm(h.t.title).includes(q) || norm(h.t.note).includes(q)));
  const list = $("list");
  if (!items.length) {
    list.innerHTML = '<li class="empty">' + (q ? "<b>Nada encontrado</b>Nenhuma missão concluída com esse texto." : "<b>Nada concluído ainda</b>Missões finalizadas ficam guardadas aqui, agrupadas por dia.") + "</li>";
    return;
  }
  const groups = [];
  for (const h of items) { const g = groups[groups.length - 1]; if (g && g.date === h.date) g.items.push(h); else groups.push({ date: h.date, items: [h] }); }
  const shown = groups.slice(0, histLimit);
  list.innerHTML = shown.map((g) => {
    const xp = g.items.reduce((a, h) => a + (XP[h.t.diff] || 10), 0);
    return '<li class="dayhead"><b>' + esc(dayLabel(g.date)) + '</b><span class="mono">' + g.items.length + " · +" + xp + " XP</span></li>" +
      g.items.map((h) => taskRow({ id: h.id, ...h.t }, { date: h.date })).join("");
  }).join("") + (groups.length > histLimit ? '<li><button type="button" class="ghost wide" id="moreHist">Mostrar mais dias</button></li>' : "");
  const more = $("moreHist"); if (more) more.onclick = () => { histLimit += 14; renderTasks(); };
}

function editRow(t) {
  const e = editing, td = today(), yd = addDays(td, -1);
  const canYesterday = t.daily
    ? !t.paused && isScheduled(t, yd) && !isDoneOn(t, yd)
    : !t.doneAt;
  const rep = e.rep;
  return '<li class="task open" data-id="' + esc(t.id) + '"><div class="editbox">' +
    '<input type="text" id="editTitle" maxlength="140" value="' + esc(e.title) + '" aria-label="Nome da missão">' +
    '<div class="opts">' +
      segHtml("data-ecat", [["pessoal", "Pessoal"], ["profissional", "Profissional"]], e.cat) +
      segHtml("data-ediff", [[1, "Fácil · 10"], [2, "Média · 25"], [3, "Difícil · 50"]], e.diff) +
    "</div>" +
    (t.daily
      ? '<div class="opts">' + segHtml("data-erep", [["daily", "Todo dia"], ["week", "Dias da semana"], ["month", "Mensal"]], rep) + "</div>" +
        (rep === "week" ? '<div class="opts">' + daysHtml("data-eday", e.days) + "</div>" : "") +
        (rep === "month" ? '<div class="opts"><label class="chk">Todo dia <input type="number" id="editMonthDay" min="1" max="31" value="' + e.monthDay + '" aria-label="Dia do mês"> de cada mês</label></div>' : "")
      : '<div class="opts"><div class="chips">' + [["0", "Hoje"], ["1", "Amanhã"], ["fri", "Sexta"], ["none", "Sem prazo"]].map(([q, l]) => '<button type="button" data-equick="' + q + '">' + l + "</button>").join("") + "</div>" +
        '<input type="date" id="editDue" value="' + esc(e.due || "") + '" aria-label="Prazo"></div>') +
    '<div class="opts"><label class="chk">Horário <input type="time" id="editTime" value="' + esc(e.time || "") + '" aria-label="Horário"></label>' + (e.time ? '<button type="button" class="ghost" style="margin:0;padding:5px 10px" data-act="cleartime">Sem horário</button>' : "") + "</div>" +
    '<label class="fl" for="editNote">Nota</label>' +
    '<textarea id="editNote" maxlength="1000" rows="2" placeholder="Detalhes, links, observações">' + esc(e.note) + "</textarea>" +
    (e.note && /https?:\/\//.test(e.note) ? '<p class="notepreview">' + linkify(e.note) + "</p>" : "") +
    tagPickHtml(e.tags, "edit") +
    iconPickHtml(e.icon, "edit") +
    '<span class="fl">Subtarefas</span>' +
    '<ul class="esubs">' + e.subs.map((s, i) => '<li><input type="checkbox" data-esubd="' + i + '"' + (s.d ? " checked" : "") + ' aria-label="Concluída"><input type="text" data-esubt="' + i + '" value="' + esc(s.t) + '" maxlength="100" aria-label="Subtarefa ' + (i + 1) + '"><button type="button" class="x" data-esubx="' + i + '" aria-label="Remover subtarefa">✕</button></li>').join("") + "</ul>" +
    (e.subs.length < 20 ? '<div class="addrow small"><input type="text" id="newSub" maxlength="100" placeholder="Nova subtarefa"><button type="button" class="secondary" data-act="addsub">Adicionar</button></div>' : "") +
    '<div class="actions">' +
      '<button type="button" data-act="pin">' + (t.pin ? "Desafixar" : "Fixar no topo") + "</button>" +
      (canYesterday ? '<button type="button" data-act="yesterday">Marcar como feita ontem</button>' : "") +
      (t.daily ? '<button type="button" data-act="pause">' + (t.paused ? "Retomar" : "Pausar") + "</button>" : "") +
      '<a class="gcal" href="' + esc(gcalUrl({ ...t, title: e.title, time: e.time, due: e.due, note: e.note, repeat: e.rep, days: e.days, monthDay: e.monthDay })) + '" target="_blank" rel="noopener">Adicionar ao Google Agenda</a>' +
      '<button type="button" class="danger" data-act="del">Excluir</button>' +
    "</div>" +
    '<div class="acts"><button type="button" class="cancel" data-act="ecancel">Fechar</button><button type="button" class="save" data-act="esave">Salvar</button></div>' +
    "</div></li>";
}

function renderProgress(s, L) {
  const days = []; for (let i = 6; i >= 0; i--) days.push(addDays(today(), -i));
  const vals = days.map((d) => s.byDay[d] || 0), max = Math.max(50, ...vals);
  $("weekSum").textContent = vals.reduce((a, b) => a + b, 0) + " XP";
  $("week").innerHTML = days.map((d, i) =>
    '<div class="col' + (i === 6 ? " today" : "") + (s.shields.has(d) ? " shielded" : "") + '"><span class="v">' + (vals[i] || (s.shields.has(d) ? "escudo" : "")) + '</span><div class="b" style="height:' + (vals[i] / max * 78) + '%"></div><span class="d">' + (i === 6 ? "hoje" : WD[weekday(d)]) + "</span></div>").join("");

  const ach = profile?.ach || {}, ctx = s.ctx;
  $("achCount").textContent = ALL.filter((a) => ach[a.id]).length + "/" + TOTAL;
  $("achBonus").textContent = "+" + s.bonus.total + " XP de bônus";
  renderTagStats();
  const when = (id) => ach[id] ? "conquistada em " + nice(dstr(new Date(ach[id]))).replace(/^\S+, /, "") : "";
  const fmt = (n) => n.toLocaleString("pt-BR");

  $("trails").innerHTML = TRAILS.map((t) => {
    const reached = t.goals.filter((_, i) => ach[t.id + "-" + (i + 1)]).length;
    const val = ctx[t.key] || 0;
    const next = reached < 4 ? t.goals[reached] : null;
    const prevGoal = reached > 0 ? t.goals[reached - 1] : 0;
    const pct = next ? Math.min(100, Math.max(0, (val - prevGoal) / (next - prevGoal) * 100)) : 100;
    const medal = reached ? TIER_KEYS[reached - 1] : "none";
    const pips = t.goals.map((g, i) => '<span class="pip ' + (ach[t.id + "-" + (i + 1)] ? TIER_KEYS[i] : "") + '" title="' + TIER_NAMES[i] + ": " + fmt(g) + '"></span>').join("");
    return '<li class="trail"><div class="thead"><span class="tier ' + medal + '">' + (reached ? TIER_NAMES[reached - 1] : "A caminho") + '</span><span class="tprog">' + (next ? fmt(Math.min(val, next)) + " / " + fmt(next) : "completa") + "</span></div>" +
      '<div class="medal ' + medal + '">' + esc(t.icon) + "</div>" +
      '<div class="tbody"><b class="tname">' + esc(t.name) + "</b>" +
      '<div class="tbar"><i style="width:' + pct + '%"></i></div>' +
      '<span class="tmeta">' + esc(t.unit) + (next ? " · próximo: " + TIER_NAMES[reached] + " +" + TIER_XP[reached] + " XP" : "") + "</span>" +
      '<span class="pips">' + pips + "</span></div></li>";
  }).join("");

  $("singles").innerHTML = SINGLES.map((x) => {
    const on = !!ach[x.id];
    return '<div class="a' + (on ? " on" : "") + '"><div class="band"><span>' + (on ? "Completa" : "Especial") + "</span><span>+50 XP</span></div>" +
      '<div class="abody"><b>' + esc(x.name) + "</b><span>" + esc(x.desc) + "</span>" +
      '<span class="xpline">' + (x.title ? "Título “" + esc(x.title) + "”" : "") + (on ? (x.title ? " · " : "") + when(x.id) : "") + "</span></div></div>";
  }).join("");

  $("secrets").innerHTML = SECRETS.map((x) => {
    const on = !!ach[x.id];
    return '<div class="a secret' + (on ? " on" : "") + '"><div class="band"><span>' + (on ? "Desvendada" : "Secreta") + "</span><span>+100 XP</span></div>" +
      '<div class="abody"><b>' + (on ? esc(x.name) : "???") + "</b><span>" + esc(on ? x.desc : x.hint) + "</span>" +
      '<span class="xpline">' + (on ? "Título “" + esc(x.title) + "” · " + when(x.id) : "") + "</span></div></div>";
  }).join("");
}
function renderGroups() {
  const box = $("groups");
  const codes = profile?.groups || [];
  if (!codes.length) {
    box.innerHTML = '<div class="empty"><b>Você ainda não está em nenhum grupo</b>Crie um grupo acima e envie o código, ou entre com o código que alguém te mandou.</div>';
    return;
  }
  if (document.querySelector("#renameInput") && Object.values(groupUi).some((u) => u && u.renaming)) return; // não apaga o que está sendo digitado
  const ws = weekStart(), lw = addDays(ws, -7);
  box.innerHTML = codes.map((code) => {
    const g = groupData.get(code), ui = groupUi[code] || {};
    if (!g || !g.members) return '<div class="group"><div class="ghead"><h2>Carregando grupo…</h2><span class="code">' + esc(code) + "</span></div></div>";
    const isOwner = g.owner === uid;
    const pts = (m) => rankBy === "week" ? (m.week === ws ? m.weekXp : 0) : m.total;
    const lastPts = (m) => m.prevWeek === lw ? m.prevWeekXp : m.week === lw ? m.weekXp : 0;
    const members = [...g.members].sort((a, b) => pts(b) - pts(a) || b.total - a.total);
    const champ = [...g.members].sort((a, b) => lastPts(b) - lastPts(a))[0];
    const rows = members.map((m, i) =>
      '<li class="rk' + (m.id === uid ? " me" : "") + '"><span class="pos">' + (i + 1) + "</span>" +
      (m.avatar ? '<span class="rkav">' + avatarSvg(m.avatar, { size: 34 }) + "</span>" : m.photo ? '<img src="' + esc(m.photo) + '" alt="" referrerpolicy="no-referrer">' : '<span class="ph0">' + esc((m.name || "?").charAt(0).toUpperCase()) + "</span>") +
      '<span class="nm">' + esc(m.name || "Sem nome") + (m.id === uid ? " (você)" : "") + "<small>Nível " + (m.level || 1) + " · " + esc(m.title || rankOf(m.level || 1)) + "</small></span>" +
      '<span class="pts">' + pts(m) + " XP</span>" +
      (isOwner && m.id !== uid ? '<button type="button" class="leave" data-gact="kick" data-uid="' + esc(m.id) + '">' + (ui.kick === m.id ? "Remover?" : "✕") + "</button>" : "") +
      "</li>").join("");
    return '<div class="group" data-code="' + esc(code) + '"><div class="ghead">' +
      (ui.renaming ? '<form class="addrow small" data-gform="rename"><input type="text" id="renameInput" maxlength="40" value="' + esc(g.name) + '" aria-label="Novo nome do grupo"><button type="submit" class="secondary">Salvar</button></form>'
        : "<h2>" + esc(g.name || "Grupo") + "</h2>") +
      '<span class="gbtns"><button type="button" class="code" data-gact="copy" title="Copiar código">' + esc(code) + "</button>" +
      (isOwner && !ui.renaming ? '<button type="button" class="leave" data-gact="rename">Renomear</button>' : "") +
      '<button type="button" class="leave" data-gact="leave">' + (ui.leave ? "Sair mesmo?" : "Sair") + "</button></span></div>" +
      (champ && lastPts(champ) > 0 ? '<p class="champ">Campeão da semana passada: <b>' + esc(champ.name) + "</b> · " + lastPts(champ) + " XP</p>" : "") +
      '<ul class="ranklist">' + (rows || '<li class="note">Ninguém no ranking ainda.</li>') + "</ul></div>";
  }).join("");
}

/* =========================================================
   Avisos
   ========================================================= */
let toastT;
function toast(html, action) {
  const t = $("toast");
  t.innerHTML = "<span>" + html + "</span>" + (action ? '<button type="button" id="toastAct">' + esc(action.label) + "</button>" : "");
  t.classList.toggle("interactive", !!action);
  t.classList.add("show");
  if (action) $("toastAct").onclick = () => { t.classList.remove("show"); action.run(); };
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), action ? 5000 : 2000);
}
function showDbError(e) {
  const box = $("dbErr"); box.hidden = false;
  if (e && e.code === "permission-denied") box.textContent = "O banco recusou a operação. Confira se as regras novas do Firestore foram publicadas (arquivo firestore.rules).";
  else if (e && (e.code === "not-found" || e.code === "failed-precondition")) box.textContent = "O banco de dados ainda não existe. Crie o Firestore Database no console do Firebase.";
  else box.textContent = "Não consegui falar com o banco de dados. Verifique a internet e tente de novo.";
}
function celebrate(r, xp) {
  try { navigator.vibrate?.(25); } catch (e) { }
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || !r || !r.width) return;
  const el = document.createElement("span");
  el.className = "xpfloat"; el.textContent = "+" + xp + " XP";
  el.style.left = (r.left + r.width / 2) + "px"; el.style.top = r.top + "px";
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

/* =========================================================
   Google Agenda e avisos no horário
   ========================================================= */
const TZ = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo"; } catch (e) { return "America/Sao_Paulo"; } })();
const BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
function gcalUrl(t) {
  const td = today();
  const r = t.daily ? (t.repeat || "daily") : "once";
  let date = t.daily ? (isScheduled({ ...t, paused: false }, td) ? td : (nextScheduled({ ...t, paused: false }) || td)) : (t.due || td);
  const compact = (d) => d.replace(/-/g, "");
  let dates;
  if (t.time && /^\d{2}:\d{2}$/.test(t.time)) {
    const start = hmToMin(t.time), end = start + 30;
    const hm = (m) => String(Math.floor(m / 60) % 24).padStart(2, "0") + String(m % 60).padStart(2, "0") + "00";
    const endDate = end >= 1440 ? addDays(date, 1) : date;
    dates = compact(date) + "T" + hm(start) + "/" + compact(endDate) + "T" + hm(end);
  } else dates = compact(date) + "/" + compact(addDays(date, 1));
  const p = new URLSearchParams({ action: "TEMPLATE", text: t.title || "Missão", dates, ctz: TZ,
    details: (t.note ? t.note + "\n\n" : "") + "Missão do Diário de Missões (" + (XP[t.diff] || 10) + " XP)." });
  if (r === "daily") p.set("recur", "RRULE:FREQ=DAILY");
  if (r === "week") p.set("recur", "RRULE:FREQ=WEEKLY;BYDAY=" + (t.days || []).map((d) => BYDAY[d]).join(","));
  if (r === "month") p.set("recur", "RRULE:FREQ=MONTHLY;BYMONTHDAY=" + (t.monthDay || 1));
  return "https://calendar.google.com/calendar/render?" + p.toString();
}

const NOTIFY_KEY = "missoes.notify";
let notifyOn = false;
try { notifyOn = localStorage.getItem(NOTIFY_KEY) === "1"; } catch (e) { }
const notified = new Set();
function syncNotifyRow() {
  const row = $("notifyBtn"); if (!row) return;
  const perm = typeof Notification === "undefined" ? "unsupported" : Notification.permission;
  row.classList.toggle("on", notifyOn);
  row.querySelector("b").textContent = "Avisos no horário: " + (notifyOn ? "ligados" : "desligados");
  $("notifyHint").textContent = perm === "unsupported" ? "Este navegador não mostra notificações. O app ainda avisa na tela quando estiver aberto."
    : perm === "denied" ? "As notificações estão bloqueadas nas configurações do navegador. O app avisa só na tela."
    : "Avisa quando chega a hora de uma missão, com o app aberto. Para lembrete com o app fechado, use o Google Agenda na missão.";
}
$("notifyBtn").addEventListener("click", async () => {
  if (!notifyOn && typeof Notification !== "undefined" && Notification.permission === "default") {
    try { await Notification.requestPermission(); } catch (e) { }
  }
  notifyOn = !notifyOn;
  try { localStorage.setItem(NOTIFY_KEY, notifyOn ? "1" : "0"); } catch (e) { }
  syncNotifyRow();
  toast(notifyOn ? "Avisos no horário ligados" : "Avisos no horário desligados");
});
async function showReminder(t) {
  const body = (t.cat === "profissional" ? "Profissional" : "Pessoal") + " · +" + (XP[t.diff] || 10) + " XP";
  toast("Agora: " + esc(t.title));
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(t.title, { body, icon: "icons/icon-192.png", tag: "missao-" + t.id });
    else new Notification(t.title, { body, icon: "icons/icon-192.png" });
  } catch (e) { }
}
function reminderTick() {
  if (!notifyOn || !uid || !loaded) return;
  const td = today(), now = hmToMin(nowHM());
  for (const t of dayItems(td)) {
    if (!t.time || isDoneOn(t, td) || t.paused) continue;
    const key = t.id + "@" + td + "@" + t.time;
    const diff = now - hmToMin(t.time);
    if (diff >= 0 && diff <= 2 && !notified.has(key)) { notified.add(key); showReminder(t); }
  }
}
setInterval(reminderTick, 20000);
setInterval(() => { if (uid && loaded && view === "missoes" && !editing) renderTasks(); }, 60000); // atualiza "Agora"

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
  const backup = tasks.get(id);
  tasks.delete(id); render();
  deleteDoc(doc(tasksCol(), id)).catch((e) => { showDbError(e); toast("Não consegui excluir."); });
  toast("Missão excluída", { label: "Desfazer", run: () => put(id, backup) });
}

/* =========================================================
   Ações: nova missão
   ========================================================= */
function syncAddForm() {
  $("dueRow").hidden = form.rep !== "once";
  $("daysRow").hidden = form.rep !== "week";
  $("monthRow").hidden = form.rep !== "month";
  $("newDays").innerHTML = daysHtml("data-nday", form.days).replace(/^<div class="days">|<\/div>$/g, "");
}
$("newDays").addEventListener("click", (e) => {
  const b = e.target.closest("[data-nday]"); if (!b) return;
  const d = +b.dataset.nday;
  form.days = form.days.includes(d) ? form.days.filter((x) => x !== d) : [...form.days, d];
  syncAddForm();
});
document.querySelectorAll("[data-quick]").forEach((b) => b.addEventListener("click", () => { $("newDue").value = quickDate(b.dataset.quick); }));

$("addForm").addEventListener("submit", (e) => {
  e.preventDefault();
  if (!loaded) return;
  const title = $("newTitle").value.trim(); if (!title) { $("newTitle").focus(); return; }
  const tm = $("newTime").value;
  const data = { title, cat: form.cat, diff: form.diff, daily: form.rep !== "once", due: null, created: Date.now(), time: /^\d{2}:\d{2}$/.test(tm) ? tm : null };
  if (form.tags.length) data.tags = form.tags.slice(0, 5);
  if (form.icon) data.icon = form.icon;
  if (form.rep === "once") { data.due = $("newDue").value || null; data.doneAt = null; }
  else {
    data.done = []; data.repeat = form.rep;
    if (form.rep === "week") { if (!form.days.length) { toast("Escolha pelo menos um dia da semana"); return; } data.days = [...form.days].sort(); }
    if (form.rep === "month") data.monthDay = Math.min(31, Math.max(1, +$("newMonthDay").value || 1));
  }
  put(newId(), data);
  $("newTitle").value = ""; $("newDue").value = ""; $("newTime").value = "";
  form.tags = []; form.icon = ""; renderAddPickers();
  if (form.rep === "once" && data.due && data.due > today()) toast("Missão agendada para " + esc(nice(data.due)));
  else if (form.rep !== "once" && !isScheduled(data, today())) toast("Repetição criada. Próxima: " + esc(nice(nextScheduled(data))));
});

function group(attr, fn) {
  document.querySelectorAll("[" + attr + "]").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll("[" + attr + "]").forEach((x) => x.setAttribute("aria-pressed", x === b)); fn(b);
  }));
}
group("data-cat", (b) => { form.cat = b.dataset.cat; });
group("data-diff", (b) => { form.diff = +b.dataset.diff; });
group("data-rep", (b) => { form.rep = b.dataset.rep; syncAddForm(); });
group("data-tab", (b) => { tab = b.dataset.tab; editing = null; histLimit = 14; render(); });
group("data-filter", (b) => { filter = b.dataset.filter; editing = null; render(); });
group("data-rank", (b) => { rankBy = b.dataset.rank; render(); });
group("data-view", (b) => {
  view = b.dataset.view; editing = null;
  document.querySelectorAll(".view").forEach((v) => { v.hidden = v.id !== "view-" + view; });
  render();
});
$("histSearch").addEventListener("input", (e) => { histQuery = e.target.value; histLimit = 14; renderTasks(); });

/* =========================================================
   Seletores de tag e ícone (formulário e editor)
   ========================================================= */
function pickerTarget(scope) { return scope === "edit" ? editing : form; }
function refreshPickers(scope) { if (scope === "edit") rerenderEditor(); else renderAddPickers(); }
async function handlePicker(e) {
  let b;
  if ((b = e.target.closest("[data-tpick]"))) {
    const tgt = pickerTarget(b.dataset.scope); if (!tgt) return true;
    const id = b.dataset.tpick;
    if (tgt.tags.includes(id)) tgt.tags = tgt.tags.filter((x) => x !== id);
    else if (tgt.tags.length < 5) tgt.tags = [...tgt.tags, id];
    refreshPickers(b.dataset.scope); return true;
  }
  if ((b = e.target.closest("[data-ipick]"))) {
    const tgt = pickerTarget(b.dataset.scope); if (!tgt) return true;
    tgt.icon = b.dataset.ipick; refreshPickers(b.dataset.scope); return true;
  }
  if ((b = e.target.closest("[data-topen]"))) {
    newTagFor = b.dataset.topen; refreshPickers(newTagFor);
    $("newTag-" + newTagFor)?.focus(); return true;
  }
  if ((b = e.target.closest("[data-tcreate]"))) { await submitNewTag(b.dataset.tcreate); return true; }
  return false;
}
async function submitNewTag(scope) {
  const inp = $("newTag-" + scope); if (!inp) return;
  const id = await createTag(inp.value);
  newTagFor = null;
  const tgt = pickerTarget(scope);
  if (id && tgt && !tgt.tags.includes(id) && tgt.tags.length < 5) tgt.tags = [...tgt.tags, id];
  refreshPickers(scope);
}
$("moreNew").addEventListener("click", (e) => { handlePicker(e); });
$("moreNew").addEventListener("keydown", (e) => {
  if (e.target.id === "newTag-add" && e.key === "Enter") { e.preventDefault(); submitNewTag("add"); }
  if (e.target.id === "newTag-add" && e.key === "Escape") { newTagFor = null; renderAddPickers(); }
});
$("tagFilter").addEventListener("click", (e) => {
  const b = e.target.closest("[data-tfilter]"); if (!b) return;
  tagFilter = tagFilter === b.dataset.tfilter ? null : b.dataset.tfilter;
  editing = null; renderTasks();
});

/* =========================================================
   Ações: lista de missões
   ========================================================= */
function openEditor(id) {
  const t = tasks.get(id); if (!t) return;
  editing = {
    id, title: t.title, cat: t.cat, diff: t.diff, due: t.due || "",
    rep: repeatOf(t) === "once" ? "daily" : repeatOf(t), days: t.days ? [...t.days] : [1, 2, 3, 4, 5], monthDay: t.monthDay || 1,
    note: t.note || "", time: t.time || "", tags: [...(t.tags || [])].filter((id) => tagById(id)), icon: t.icon || "",
    subs: (t.subs || []).map((s, i) => ({ t: s.t, d: subsDoneFor(t)[i] })),
  };
  // abre na aba em que a missão aparece (ou em Hoje, se ela não aparece em nenhuma)
  const B = buckets();
  const inDay = dayItems(selDay || today()).some((x) => x.id === id);
  const target = tab === "hoje" && inDay ? "hoje" : B.prox.some((x) => x.id === id) && !B.hoje.some((x) => x.id === id) ? "proximas" : "hoje";
  if (tab !== target) { tab = target; document.querySelectorAll("[data-tab]").forEach((x) => x.setAttribute("aria-pressed", x.dataset.tab === target)); }
  renderTasks();
  const inp = $("editTitle"); if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
}
function rerenderEditor() {
  const li = document.querySelector(".task.open"); if (!li || !editing) return;
  const t = tasks.get(editing.id); if (!t) return;
  li.outerHTML = editRow({ id: editing.id, ...t });
}

function toggleDone(id, date, btn) {
  const t = tasks.get(id); if (!t) return;
  const xp = XP[t.diff] || 10, n = { ...t };
  const d = date || today();
  const rect = btn ? btn.getBoundingClientRect() : null;
  let gained;
  const hour = new Date().getHours();
  if (t.daily) {
    const done = [...(t.done || [])], i = done.indexOf(d), hours = { ...(t.hours || {}) };
    if (i >= 0) { done.splice(i, 1); delete hours[d]; gained = false; }
    else { done.push(d); if (d === today()) hours[d] = hour; gained = true; }
    n.done = done; n.hours = hours;
  } else {
    gained = !t.doneAt;
    n.doneAt = gained ? d : null; n.doneHour = gained && d === today() ? hour : null;
  }
  put(id, n);
  if (gained) {
    justDone = id; setTimeout(() => { if (justDone === id) justDone = null; }, 900);
    if (rect && rect.width) burst(rect.left + rect.width / 2, rect.top + rect.height / 2, { colors: [taskColor(t), "#FFBD65", "#2FD0C8"] });
    renderTasks();
    celebrate(rect, xp); toast('Missão concluída <span class="mono">+' + xp + " XP</span>"); }
  else toast('Desmarcada <span class="mono">−' + xp + " XP</span>", { label: "Desfazer", run: () => put(id, t) });
}

$("list").addEventListener("click", async (e) => {
  if (editing && await handlePicker(e)) return;
  // controles dentro do editor
  const pick = (attr) => e.target.closest("[" + attr + "]");
  let b;
  if ((b = pick("data-ecat"))) { editing.cat = b.dataset.ecat; setPressed(b, "data-ecat"); return; }
  if ((b = pick("data-ediff"))) { editing.diff = +b.dataset.ediff; setPressed(b, "data-ediff"); return; }
  if ((b = pick("data-erep"))) { editing.rep = b.dataset.erep; rerenderEditor(); return; }
  if ((b = pick("data-eday"))) { const d = +b.dataset.eday; editing.days = editing.days.includes(d) ? editing.days.filter((x) => x !== d) : [...editing.days, d]; b.setAttribute("aria-pressed", editing.days.includes(d)); return; }
  if ((b = pick("data-equick"))) { editing.due = quickDate(b.dataset.equick); $("editDue").value = editing.due; return; }
  if ((b = pick("data-esubx"))) { editing.subs.splice(+b.dataset.esubx, 1); rerenderEditor(); return; }

  const btn = e.target.closest("[data-act]"); if (!btn) return;
  const li = btn.closest(".task"); if (!li) return;
  const id = li.dataset.id, t = tasks.get(id); if (!t) return;
  const act = btn.dataset.act;

  if (act === "open") { openEditor(id); return; }
  if (act === "ecancel") { editing = null; newTagFor = null; renderTasks(); return; }
  if (act === "esave") { saveEdit(); return; }
  if (act === "addsub") { addSubFromInput(); return; }
  if (act === "cleartime") { editing.time = ""; rerenderEditor(); return; }
  if (act === "toggle") { toggleDone(id, li.dataset.date, btn); return; }
  if (act === "sub") {
    const i = +btn.dataset.i, done = subsDoneFor(t);
    done[i] = btn.checked;
    put(id, { ...t, subs: (t.subs || []).map((s, k) => ({ t: s.t, d: !!done[k] })), subsDay: today() });
    if (done.every(Boolean) && !isDoneToday(t)) toast("Todas as subtarefas feitas. Concluir a missão?", { label: "Concluir", run: () => toggleDone(id, null, li.querySelector(".check")) });
    return;
  }
  if (act === "pin") {
    put(id, { ...t, pin: !t.pin });
    toast(t.pin ? "Missão desafixada" : "Missão fixada no topo");
    if (editing) { editing = null; renderTasks(); }
    return;
  }
  if (act === "pause") {
    put(id, { ...t, paused: !t.paused });
    toast(t.paused ? "Missão retomada" : "Missão pausada. A contagem do hábito fica guardada.");
    editing = null; renderTasks();
    return;
  }
  if (act === "yesterday") {
    const yd = addDays(today(), -1);
    editing = null;
    toggleDone(id, yd, null);
    if ((profile?.shields || []).includes(yd)) updateDoc(profileRef(), { shields: arrayRemove(yd) }).catch(() => {});
    toast("Registrada como feita ontem");
    return;
  }
  if (act === "del") { editing = null; remove(id); return; }
});
function setPressed(b, attr) { b.parentElement.querySelectorAll("[" + attr + "]").forEach((x) => x.setAttribute("aria-pressed", x === b)); }

$("list").addEventListener("keydown", (e) => {
  if (e.target.id === "editTitle") {
    if (e.key === "Enter") { e.preventDefault(); saveEdit(); }
    if (e.key === "Escape") { editing = null; renderTasks(); }
  } else if (e.target.id === "newSub" && e.key === "Enter") { e.preventDefault(); addSubFromInput(); }
  else if (e.target.id === "newTag-edit" && e.key === "Enter") { e.preventDefault(); submitNewTag("edit"); }
  else if (e.target.dataset?.act === "open" && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); e.target.click(); }
});
$("list").addEventListener("input", (e) => {
  if (!editing) return;
  const el = e.target;
  if (el.id === "editTitle") editing.title = el.value;
  else if (el.id === "editDue") editing.due = el.value;
  else if (el.id === "editNote") editing.note = el.value;
  else if (el.id === "editTime") editing.time = el.value;
  else if (el.id === "editMonthDay") editing.monthDay = Math.min(31, Math.max(1, +el.value || 1));
  else if (el.dataset.esubt !== undefined) editing.subs[+el.dataset.esubt].t = el.value;
  else if (el.dataset.esubd !== undefined) editing.subs[+el.dataset.esubd].d = el.checked;
});
$("list").addEventListener("change", (e) => {
  if (editing && e.target.dataset.esubd !== undefined) editing.subs[+e.target.dataset.esubd].d = e.target.checked;
});

function addSubFromInput() {
  const inp = $("newSub"); if (!inp) return;
  const v = inp.value.trim(); if (!v) { inp.focus(); return; }
  editing.subs.push({ t: v.slice(0, 100), d: false });
  rerenderEditor();
  const next = $("newSub"); if (next) next.focus();
}

function saveEdit() {
  const id = editing.id, t = tasks.get(id);
  if (!t) { editing = null; renderTasks(); return; }
  const title = editing.title.trim(); if (!title) { $("editTitle").focus(); return; }
  const n = { ...t, title, cat: editing.cat, diff: editing.diff, updated: Date.now(), note: editing.note.trim().slice(0, 1000), time: /^\d{2}:\d{2}$/.test(editing.time) ? editing.time : null,
    tags: editing.tags.slice(0, 5), icon: editing.icon || "" };
  const subs = editing.subs.filter((s) => s.t.trim()).map((s) => ({ t: s.t.trim().slice(0, 100), d: !!s.d }));
  n.subs = subs; n.subsDay = today();
  if (t.daily) {
    if (editing.rep === "week" && !editing.days.length) { toast("Escolha pelo menos um dia da semana"); return; }
    n.repeat = editing.rep;
    if (editing.rep === "week") n.days = [...editing.days].sort(); else delete n.days;
    if (editing.rep === "month") n.monthDay = editing.monthDay; else delete n.monthDay;
  } else n.due = editing.due || null;
  editing = null;
  put(id, n);
  toast("Missão atualizada");
}

function seed() {
  const td = today();
  const ex = [
    { title: "Beber 2 litros de água", cat: "pessoal", diff: 1, daily: true, repeat: "daily", done: [] },
    { title: "Treino na academia", cat: "pessoal", diff: 2, daily: true, repeat: "week", days: [1, 3, 5], done: [], time: "18:30" },
    { title: "Planejar as prioridades do dia", cat: "profissional", diff: 1, daily: true, repeat: "week", days: [1, 2, 3, 4, 5], done: [], time: "08:30" },
    { title: "Responder e-mails pendentes", cat: "profissional", diff: 2, daily: false, due: td, doneAt: null, pin: true, time: "10:00" },
    { title: "Finalizar a apresentação do projeto", cat: "profissional", diff: 3, daily: false, due: addDays(td, 2), doneAt: null,
      subs: [{ t: "Reunir os números", d: false }, { t: "Montar os slides", d: false }, { t: "Revisar com a equipe", d: false }] },
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
      await setDoc(profileRef(), { name, photo, createdAt: Date.now(), onboarded: false, groups: [], ach: {}, title: "", flags: { od: 0 }, shields: [] });
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
   Escudo de sequência: 1 por semana, usado sozinho
   ========================================================= */
let shieldBusy = false;
async function checkShield(s) {
  if (!loaded || !profile || shieldBusy) return;
  const td = today(), yd = addDays(td, -1), dby = addDays(td, -2);
  const shields = new Set(profile.shields || []);
  if (s.byDay[yd] || shields.has(yd)) return;                       // ontem já está coberto
  if (!s.byDay[dby] && !shields.has(dby)) return;                   // não havia sequência para salvar
  if ((profile.createdAt || Date.now()) > new Date(yd + "T23:59:59").getTime()) return;
  const wk = weekStart(yd);
  if ([...shields].some((d) => weekStart(d) === wk)) return;        // já usou nesta semana
  shieldBusy = true;
  try {
    const list = [...shields, yd].sort().slice(-400);
    await updateDoc(profileRef(), { shields: list });
    toast("Escudo usado: sua sequência foi salva");
  } catch (e) { showDbError(e); }
  finally { shieldBusy = false; }
}

function renderTagStats() {
  const sums = new Map(), counts = new Map();
  for (const h of history()) {
    const xp = XP[h.t.diff] || 10;
    const ids = (h.t.tags || []).filter((id) => tagById(id));
    for (const id of (ids.length ? ids : ["__none"])) { sums.set(id, (sums.get(id) || 0) + xp); counts.set(id, (counts.get(id) || 0) + 1); }
  }
  const rows = [...sums.entries()].sort((a, b) => b[1] - a[1]);
  const box = $("tagStats");
  if (!rows.length) { box.innerHTML = '<p class="muted">Conclua missões com tags para ver quanto XP cada uma rendeu.</p>'; return; }
  if (!tagsList().length) { box.innerHTML = '<p class="muted">Crie tags na aba Conta ou no formulário de nova missão para ver o XP separado por tag.</p>'; return; }
  const max = rows[0][1];
  box.innerHTML = rows.map(([id, xp]) => {
    const g = tagById(id), name = g ? g.n : "Sem tag", c = g ? tagColor(g.c) : "var(--surface-3)";
    return '<div class="tsrow"><span class="tsname"><i style="background:' + c + '"></i>' + esc(name) + '</span><div class="tsbar"><i style="width:' + (xp / max * 100) + "%;background:" + c + '"></i></div><span class="tsval mono">' + xp.toLocaleString("pt-BR") + " XP · " + counts.get(id) + "</span></div>";
  }).join("");
}

/* =========================================================
   Aparência e tags (aba Conta)
   ========================================================= */
const THEME_KEY = "missoes.theme";
function applyTheme(choice) {
  const real = choice === "system" ? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark") : choice;
  document.documentElement.dataset.theme = real;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", real === "light" ? "#F2F6F6" : "#071317");
  document.querySelectorAll("[data-theme-set]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.themeSet === choice));
}
let themeChoice = "dark";
try { themeChoice = localStorage.getItem(THEME_KEY) || "dark"; } catch (e) { }
applyTheme(themeChoice);
matchMedia("(prefers-color-scheme: light)").addEventListener?.("change", () => { if (themeChoice === "system") applyTheme("system"); });
document.querySelectorAll("[data-theme-set]").forEach((b) => b.addEventListener("click", () => {
  themeChoice = b.dataset.themeSet;
  try { localStorage.setItem(THEME_KEY, themeChoice); } catch (e) { }
  applyTheme(themeChoice);
}));

function applyCards() {
  const style = profile?.cardStyle === "full" ? "full" : "stripe";
  document.body.classList.toggle("cards-full", style === "full");
  document.querySelectorAll("[data-cards]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.cards === style));
}
document.querySelectorAll("[data-cards]").forEach((b) => b.addEventListener("click", async () => {
  profile = { ...profile, cardStyle: b.dataset.cards }; applyCards();
  try { await updateDoc(profileRef(), { cardStyle: b.dataset.cards }); } catch (e) { showDbError(e); }
}));

let tagArmed = null;
function renderTagList() {
  const list = tagsList();
  $("tagCount").textContent = list.length + "/30";
  if (document.activeElement && document.activeElement.closest("#tagList")) return; // não atrapalha a digitação
  $("tagList").innerHTML = list.length ? list.map((g) => {
    const used = [...tasks.values()].filter((t) => (t.tags || []).includes(g.id)).length;
    return '<li data-tid="' + esc(g.id) + '"><button type="button" class="swatch" data-tcolor style="background:' + tagColor(g.c) + '" aria-label="Trocar cor (' + esc(TAG_COLORS[g.c]?.[1] || "") + ')"></button>' +
      '<input type="text" value="' + esc(g.n) + '" maxlength="24" data-tname aria-label="Nome da tag">' +
      '<span class="hint">' + used + (used === 1 ? " missão" : " missões") + "</span>" +
      '<button type="button" class="leave" data-tdel>' + (tagArmed === g.id ? "Excluir?" : "✕") + "</button></li>";
  }).join("") : '<li class="hint">Nenhuma tag criada ainda.</li>';
}
async function saveTags(list) {
  profile = { ...profile, tags: list };
  try { await updateDoc(profileRef(), { tags: list }); } catch (e) { showDbError(e); }
}
$("tagList").addEventListener("click", async (e) => {
  const li = e.target.closest("[data-tid]"); if (!li) return;
  const id = li.dataset.tid, list = tagsList().map((g) => ({ ...g }));
  const g = list.find((x) => x.id === id); if (!g) return;
  if (e.target.closest("[data-tcolor]")) { g.c = (g.c + 1) % TAG_COLORS.length; await saveTags(list); renderTagList(); render(); return; }
  if (e.target.closest("[data-tdel]")) {
    if (tagArmed !== id) { tagArmed = id; renderTagList(); setTimeout(() => { if (tagArmed === id) { tagArmed = null; renderTagList(); } }, 3000); return; }
    tagArmed = null;
    await saveTags(list.filter((x) => x.id !== id));
    // tira a tag das missões que a usavam
    for (const [tid, t] of tasks) if ((t.tags || []).includes(id)) put(tid, { ...t, tags: t.tags.filter((x) => x !== id) });
    toast("Tag excluída"); renderTagList();
  }
});
$("tagList").addEventListener("change", async (e) => {
  if (!e.target.matches("[data-tname]")) return;
  const id = e.target.closest("[data-tid]").dataset.tid, name = e.target.value.trim().slice(0, 24);
  if (!name) { renderTagList(); return; }
  await saveTags(tagsList().map((g) => g.id === id ? { ...g, n: name } : g));
  toast("Tag renomeada"); render();
});
$("tagForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = await createTag($("tagName").value);
  if (id) { $("tagName").value = ""; toast("Tag criada"); renderTagList(); }
});

/* =========================================================
   Avatar
   ========================================================= */
// O que cada peça especial pede para ser liberada.
const anyTier = (n) => Object.keys(profile?.ach || {}).some((id) => id.endsWith("-" + n));
const hasAch = (id) => !!profile?.ach?.[id];
const curLevel = () => levelFor(computeStats().total).lvl;
const UNLOCKS = {
  item: {
    fone: [() => hasAch("missoes-2"), "Missionário Prata"],
    gato: [() => hasAch("sequencia-2"), "Maratonista Prata (30 dias seguidos)"],
    moto: [() => hasAch("dificeis-2"), "Desafiante Prata"],
    espacial: [() => curLevel() >= 10, "Nível 10"],
    coroa: [() => curLevel() >= 20, "Nível 20"],
    aureola: [() => SECRETS.some((x) => hasAch(x.id)), "Qualquer conquista secreta"],
    mago: [() => curLevel() >= 12, "Nível 12"],
  },
  gear: {
    cajado: [() => curLevel() >= 8, "Nível 8"],
    capa: [() => curLevel() >= 15, "Nível 15"],
    espada: [() => hasAch("pontual-2"), "Pontual Prata"],
    escudo: [() => hasAch("semanasematraso"), "Semana Sem Atraso"],
  },
  glasses: {
    sol: [() => curLevel() >= 5, "Nível 5"],
    aviador: [() => hasAch("madrugador-3"), "Madrugador Ouro"],
  },
  body: {
    jaqueta: [() => curLevel() >= 3, "Nível 3"],
    terno: [() => hasAch("profissional-2"), "Carreira Prata"],
  },
  mouth: { lingua: [() => hasAch("sextou"), "Uma conquista secreta"] },
  frame: {
    bronze: [() => anyTier(1), "Qualquer medalha de bronze"],
    prata: [() => anyTier(2), "Qualquer medalha de prata"],
    ouro: [() => anyTier(3), "Qualquer medalha de ouro"],
    diamante: [() => anyTier(4), "Qualquer medalha de diamante"],
  },
};
const lockOf = (field, key) => { const u = UNLOCKS[field]?.[key]; return u && !u[0]() ? u[1] : null; };

// Humor do dia: pela quantidade de missões que ainda faltam hoje.
function dayMood() {
  if (!loaded) return { key: "calmo", pending: 0 };
  const td = today();
  const pending = dayItems(td).filter((t) => !isDoneOn(t, td) && !t.paused).length;
  const key = pending <= 2 ? "calmo" : pending <= 5 ? "focado" : "estressado";
  return { key, pending };
}
const usingAvatar = () => profile?.useAvatar !== false;
function myAvatarHtml(size, mood = null) {
  if (usingAvatar()) return avatarSvg(profile?.avatar || DEFAULT_AVATAR, { size, mood });
  if (user?.photoURL) return '<img src="' + esc(user.photoURL) + '" alt="" referrerpolicy="no-referrer" width="' + size + '" height="' + size + '">';
  return avatarSvg(DEFAULT_AVATAR, { size, mood });
}
let lastMoodSig = "";
function renderMyAvatar() {
  if (!user) return;
  const m = dayMood(), md = MOODS[m.key];
  const sig = m.key + "|" + usingAvatar() + "|" + JSON.stringify(profile?.avatar || {}) + "|" + (user.photoURL || "");
  const box = $("avatar");
  if (sig !== lastMoodSig) {
    const changed = lastMoodSig && lastMoodSig.split("|")[0] !== m.key;
    lastMoodSig = sig;
    box.innerHTML = myAvatarHtml(120, m.key);
    box.style.setProperty("--ring", md.ring);
    if (changed) { box.classList.remove("bounce"); void box.offsetWidth; box.classList.add("bounce"); }
  }
  box.hidden = false;
  $("moodChip").innerHTML = '<i style="background:' + md.ring + '"></i>' + md.name + " · " + (m.pending === 0 ? "nada pendente" : m.pending + (m.pending === 1 ? " pendente" : " pendentes"));
  $("avatarBig").innerHTML = myAvatarHtml(64);
  $("useAvatar").checked = usingAvatar();
}

let avDraft = null, avTab = "rosto", avMood = "calmo";
function openAvatarEditor() {
  avDraft = cleanAvatar(profile?.avatar || DEFAULT_AVATAR);
  avTab = profile?.avatar ? "rosto" : "estilo";
  document.querySelectorAll("[data-avtab]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.avtab === avTab));
  $("avEditor").hidden = false;
  renderAvatarEditor();
}
function optGrid(field, entries, labelOf = (k, v) => v[0]) {
  return '<div class="avgrid">' + entries.map(([k, v]) => {
    const lock = lockOf(field, k);
    const preview = avatarSvg({ ...avDraft, [field]: k }, { size: 64 });
    return '<button type="button" class="avopt" data-avfield="' + field + '" data-avval="' + esc(k) + '" aria-pressed="' + (avDraft[field] === k) + '"' + (lock ? ' data-locked="' + esc(lock) + '"' : "") + ">" +
      preview + "<span>" + esc(labelOf(k, v)) + "</span>" + (lock ? '<em class="lock">🔒 ' + esc(lock) + "</em>" : "") + "</button>";
  }).join("") + "</div>";
}
function swatches(field, colors, label) {
  return '<span class="fl">' + label + '</span><div class="swatches">' + colors.map((c, i) =>
    '<button type="button" class="sw" data-avfield="' + field + '" data-avval="' + i + '" data-num="1" aria-pressed="' + (avDraft[field] === i) + '" style="background:' + c + '" aria-label="' + label + " " + (i + 1) + '"></button>').join("") + "</div>";
}
function renderAvatarEditor() {
  $("avPreview").innerHTML = avatarSvg(avDraft, { size: 150, mood: avMood });
  let html = "";
  if (avTab === "estilo") html = '<p class="muted">Escolha um ponto de partida. Depois você ajusta cada peça como quiser — todas as peças valem para qualquer estilo.</p><div class="avgrid presets">' +
    Object.entries(PRESETS).map(([k, [name, p]]) => '<button type="button" class="avopt" data-avpreset="' + k + '">' + avatarSvg({ ...avDraft, ...p }, { size: 64 }) + "<span>" + name + "</span></button>").join("") + "</div>";
  if (avTab === "rosto") html = swatches("skin", SKINS, "Tom de pele") + '<span class="fl">Olhos</span>' + optGrid("eyes", Object.entries(EYES)) + '<span class="fl">Cílios</span>' + optGrid("lashes", Object.entries(LASHES)) +
    '<span class="fl">Boca</span><p class="hint">Esta é a boca do humor tranquilo. Nos dias movimentados e puxados, a expressão muda sozinha.</p>' + optGrid("mouth", Object.entries(MOUTHS)) + '<span class="fl">Batom</span>' + optGrid("lips", Object.entries(LIPS));
  if (avTab === "barba") html = '<span class="fl">Barba e bigode</span><p class="hint">A barba usa a cor do cabelo.</p>' + optGrid("beard", Object.entries(BEARDS));
  if (avTab === "cabelo") html = swatches("hairC", HAIR_COLORS, "Cor do cabelo") + '<span class="fl">Estilo</span>' + optGrid("hair", Object.entries(HAIRS));
  if (avTab === "roupa") html = swatches("bodyC", CLOTH_COLORS, "Cor da roupa") + '<span class="fl">Roupa</span>' + optGrid("body", Object.entries(BODIES));
  if (avTab === "itens") html = '<span class="fl">Óculos</span>' + optGrid("glasses", Object.entries(GLASSES)) + '<span class="fl">Brincos</span>' + optGrid("ears", Object.entries(EARRINGS)) + swatches("itemC", CLOTH_COLORS, "Cor do item") + '<span class="fl">Na cabeça</span>' + optGrid("item", Object.entries(ITEMS)) +
    '<span class="fl">Equipamento</span>' + optGrid("gear", Object.entries(GEAR));
  if (avTab === "fundo") html = swatches("bg", BG_COLORS, "Cor do fundo") + '<span class="fl">Moldura</span>' + optGrid("frame", Object.entries(FRAMES));
  $("avOpts").innerHTML = html;
}
$("avEditBtn").addEventListener("click", openAvatarEditor);
$("avClose").addEventListener("click", () => { $("avEditor").hidden = true; });
document.querySelectorAll("[data-avtab]").forEach((b) => b.addEventListener("click", () => {
  avTab = b.dataset.avtab;
  document.querySelectorAll("[data-avtab]").forEach((x) => x.setAttribute("aria-pressed", x === b));
  renderAvatarEditor();
}));
document.querySelectorAll("[data-avmood]").forEach((b) => b.addEventListener("click", () => {
  avMood = b.dataset.avmood;
  document.querySelectorAll("[data-avmood]").forEach((x) => x.setAttribute("aria-pressed", x === b));
  $("avPreview").innerHTML = avatarSvg(avDraft, { size: 150, mood: avMood });
}));
$("avatar").addEventListener("click", () => { if (user) openAvatarEditor(); });
$("avOpts").addEventListener("click", (e) => {
  const pr = e.target.closest("[data-avpreset]");
  if (pr) { avDraft = cleanAvatar({ ...avDraft, ...PRESETS[pr.dataset.avpreset][1] }); avTab = "rosto"; document.querySelectorAll("[data-avtab]").forEach((x) => x.setAttribute("aria-pressed", x.dataset.avtab === "rosto")); renderAvatarEditor(); return; }
  const b = e.target.closest("[data-avfield]"); if (!b) return;
  if (b.dataset.locked) { toast("Para liberar: " + esc(b.dataset.locked)); return; }
  avDraft[b.dataset.avfield] = b.dataset.num ? +b.dataset.avval : b.dataset.avval;
  // ao trocar boca ou batom, a prévia volta para o humor tranquilo, que mostra a boca escolhida
  if (b.dataset.avfield === "mouth" || b.dataset.avfield === "lips") {
    avMood = "calmo";
    document.querySelectorAll("[data-avmood]").forEach((x) => x.setAttribute("aria-pressed", x.dataset.avmood === "calmo"));
  }
  const scroll = $("avOpts").scrollTop;
  renderAvatarEditor();
  $("avOpts").scrollTop = scroll;
});
$("avRandom").addEventListener("click", () => {
  const pickFree = (field, obj) => { const ks = Object.keys(obj).filter((k) => !lockOf(field, k)); return ks[Math.floor(Math.random() * ks.length)]; };
  const r = (n) => Math.floor(Math.random() * n);
  avDraft = { ...avDraft, skin: r(SKINS.length), hair: pickFree("hair", HAIRS), hairC: r(HAIR_COLORS.length), eyes: pickFree("eyes", EYES), mouth: pickFree("mouth", MOUTHS),
    lashes: pickFree("lashes", LASHES), lips: Math.random() < .3 ? pickFree("lips", LIPS) : "nao", beard: Math.random() < .3 ? pickFree("beard", BEARDS) : "nenhuma", ears: Math.random() < .4 ? pickFree("ears", EARRINGS) : "nenhum",
    body: pickFree("body", BODIES), bodyC: r(CLOTH_COLORS.length), glasses: pickFree("glasses", GLASSES), item: pickFree("item", ITEMS), itemC: r(CLOTH_COLORS.length), bg: r(BG_COLORS.length),
    gear: Math.random() < .5 ? pickFree("gear", GEAR) : "nenhum" };
  renderAvatarEditor();
});
$("avSave").addEventListener("click", async () => {
  const a = cleanAvatar(avDraft);
  profile = { ...profile, avatar: a, useAvatar: true };
  $("avEditor").hidden = true; renderMyAvatar(); lastSync = ""; render();
  try { await updateDoc(profileRef(), { avatar: a, useAvatar: true }); toast("Avatar salvo"); } catch (e) { showDbError(e); }
});
$("useAvatar").addEventListener("change", async (e) => {
  profile = { ...profile, useAvatar: e.target.checked }; renderMyAvatar(); lastSync = ""; render();
  try { await updateDoc(profileRef(), { useAvatar: e.target.checked }); } catch (err) { showDbError(err); }
});

/* =========================================================
   Conquistas: desbloqueio e títulos
   ========================================================= */
let achPending = false;
async function checkAchievements(s) {
  if (!loaded || !profile || achPending) return;
  const ach = profile.ach || {};
  const updates = {};
  const od = profile.flags?.od || 0;
  if (s.overdue >= 3 && od < 3) updates["flags.od"] = s.overdue;
  const fresh = eligible(s.ctx).filter((id) => !ach[id]);
  if (fresh.includes("faxina")) updates["flags.od"] = 0;
  const now = Date.now();
  for (const id of fresh) updates["ach." + id] = now;
  if (!Object.keys(updates).length) return;
  achPending = true;
  try {
    await updateDoc(profileRef(), updates);
    if (fresh.length) announce(fresh);
  } catch (e) { showDbError(e); }
  finally { achPending = false; }
}

function announce(ids) {
  const xp = ids.reduce((a, id) => a + (BY_ID[id]?.xp || 0), 0);
  const b = $("achBanner"); b.hidden = false;
  b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop");
  if (ids.length === 1) {
    const a = BY_ID[ids[0]];
    b.innerHTML = "<span><small>Conquista desbloqueada</small>" + esc(a.name) + ' <span class="mono">+' + xp + " XP</span>" + (a.title ? "<small>Novo título: “" + esc(a.title) + "”</small>" : "") + "</span>";
  } else {
    b.innerHTML = "<span><small>" + ids.length + " conquistas desbloqueadas</small>" + ids.slice(0, 3).map((id) => esc(BY_ID[id].name)).join(", ") + (ids.length > 3 ? " e mais " + (ids.length - 3) : "") + ' <span class="mono">+' + xp + " XP</span></span>";
  }
  b.insertAdjacentHTML("beforeend", '<button type="button" id="achOk">Ver</button>');
  $("achOk").onclick = () => { b.hidden = true; document.querySelector('[data-view="progresso"]').click(); };
  try { navigator.vibrate?.([30, 60, 30]); } catch (e) { }
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
$("titleSel").addEventListener("change", async (e) => {
  try { await updateDoc(profileRef(), { title: e.target.value }); toast(e.target.value ? "Título atualizado" : "Título removido"); }
  catch (err) { showDbError(err); }
});

/* =========================================================
   Grupos e ranking
   ========================================================= */
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sem 0/O e 1/I/L, que confundem
const makeCode = () => Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");
const memberRef = (code, id = uid) => doc(db, "groups", code, "members", id);
const groupRef = (code) => doc(db, "groups", code);

function memberData() {
  const s = computeStats(), L = levelFor(s.total);
  const title = profile?.title && profile?.ach?.[profile.title] ? (BY_ID[profile.title]?.title || "") : "";
  return { name: profile?.name || user.displayName || "Sem nome", photo: profile?.photo || "", title, level: L.lvl, total: s.total,
    avatar: profile?.useAvatar !== false ? cleanAvatar(profile?.avatar || DEFAULT_AVATAR) : null,
    week: s.week, weekXp: s.weekXp, prevWeek: s.prevWeek, prevWeekXp: s.prevWeekXp, updated: Date.now() };
}

function groupError(msg) { const b = $("groupErr"); b.textContent = msg; b.hidden = !msg; }

async function joinGroup(code) {
  code = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(code)) { groupError("O código tem 6 letras e números."); return false; }
  if ((profile?.groups || []).includes(code)) { groupError("Você já está nesse grupo."); return false; }
  if ((profile?.groups || []).length >= 10) { groupError("Você pode participar de até 10 grupos."); return false; }
  try {
    const g = await getDoc(groupRef(code));
    if (!g.exists()) { groupError("Nenhum grupo com esse código. Confira com quem te enviou."); return false; }
    if ((g.data().banned || []).includes(uid)) { groupError("Você foi removido desse grupo por quem o criou."); return false; }
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
      const exists = await getDoc(groupRef(code));
      if (exists.exists()) continue;
      await setDoc(groupRef(code), { name: name.slice(0, 40), owner: uid, createdAt: Date.now(), banned: [] });
      if (await joinGroup(code)) { $("groupName").value = ""; toast("Grupo criado. Código: <span class=\"mono\">" + code + "</span>"); }
      return;
    } catch (err) { /* código ocupado ou erro de rede: tenta outro */ }
  }
  groupError("Não consegui criar o grupo. Tente de novo.");
});

function armGroup(code, key, value) {
  groupUi[code] = { ...(groupUi[code] || {}), [key]: value };
  renderGroups();
  setTimeout(() => { if (groupUi[code]?.[key] === value) { groupUi[code][key] = null; renderGroups(); } }, 3000);
}

$("groups").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-gact]"); if (!btn) return;
  const code = btn.closest(".group").dataset.code, g = groupData.get(code), ui = groupUi[code] || {};
  const act = btn.dataset.gact;
  if (act === "copy") {
    try { await navigator.clipboard.writeText(code); toast("Código copiado"); }
    catch { toast("Código: <span class=\"mono\">" + code + "</span>"); }
    return;
  }
  if (act === "rename") { groupUi[code] = { ...ui, renaming: true }; renderGroups(); $("renameInput")?.focus(); return; }
  if (act === "leave" && g) {
    if (!ui.leave) { armGroup(code, "leave", true); return; }
    try {
      await deleteDoc(memberRef(code));
      await updateDoc(profileRef(), { groups: arrayRemove(code) });
      toast("Você saiu do grupo");
    } catch (err) { groupError("Não consegui sair do grupo. Tente de novo."); }
    return;
  }
  if (act === "kick" && g) {
    const who = btn.dataset.uid;
    if (ui.kick !== who) { armGroup(code, "kick", who); return; }
    try {
      await updateDoc(groupRef(code), { banned: arrayUnion(who) });
      await deleteDoc(memberRef(code, who));
      groupUi[code] = { ...ui, kick: null };
      toast("Pessoa removida do grupo");
    } catch (err) { groupError("Não consegui remover. Confira se as regras novas foram publicadas."); }
  }
});
$("groups").addEventListener("submit", async (e) => {
  const f = e.target.closest("[data-gform='rename']"); if (!f) return;
  e.preventDefault();
  const code = f.closest(".group").dataset.code, name = $("renameInput").value.trim().slice(0, 40);
  if (!name) return;
  try {
    await updateDoc(groupRef(code), { name });
    const g = groupData.get(code); if (g) g.name = name;
    groupUi[code] = { ...(groupUi[code] || {}), renaming: false };
    renderGroups(); toast("Grupo renomeado");
  } catch (err) { groupError("Não consegui renomear. Tente de novo."); }
});

function watchGroups(codes) {
  for (const [code, stop] of groupSubs) if (!codes.includes(code)) { stop(); groupSubs.delete(code); groupData.delete(code); }
  for (const code of codes) {
    if (groupSubs.has(code)) continue;
    groupData.set(code, groupData.get(code) || { members: null });
    const stops = [];
    stops.push(onSnapshot(groupRef(code), (g) => {
      const cur = groupData.get(code) || {};
      if (!g.exists()) { groupData.set(code, { ...cur, name: "Grupo removido", owner: null, members: cur.members || [] }); }
      else {
        const d = g.data();
        groupData.set(code, { ...cur, name: d.name, owner: d.owner, banned: d.banned || [] });
        if ((d.banned || []).includes(uid)) {
          updateDoc(profileRef(), { groups: arrayRemove(code) }).catch(() => {});
          toast("Você foi removido do grupo " + esc(d.name));
        }
      }
      if (view === "grupos") renderGroups();
    }, () => {}));
    stops.push(onSnapshot(collection(db, "groups", code, "members"), (snap) => {
      const cur = groupData.get(code) || {};
      groupData.set(code, { ...cur, members: snap.docs.map((d) => ({ id: d.id, ...d.data() })) });
      if (view === "grupos") renderGroups();
    }, () => {}));
    groupSubs.set(code, () => stops.forEach((s) => s()));
  }
  lastSync = "";
}

let syncT;
function syncRanking(s, L) {
  const codes = profile?.groups || [];
  if (!loaded || !codes.length) return;
  const sig = [L.lvl, s.total, s.week, s.weekXp, s.prevWeekXp, profile.name, profile.photo, profile.title || "", profile.useAvatar !== false ? JSON.stringify(profile.avatar || {}) : "", codes.join(",")].join("|");
  if (sig === lastSync) return;
  clearTimeout(syncT);
  syncT = setTimeout(async () => {
    lastSync = sig;
    const data = memberData();
    for (const code of codes) {
      if ((groupData.get(code)?.banned || []).includes(uid)) continue;
      try { await setDoc(memberRef(code), data); } catch (e) { /* grupo removido */ }
    }
  }, 1500);
}

/* =========================================================
   Conta: exportar e apagar
   ========================================================= */
$("exportBtn").addEventListener("click", () => {
  const q = (v) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
  const lines = [["Missão", "Tipo", "Dificuldade", "XP", "Repetição", "Prazo", "Concluída em", "Subtarefas", "Nota"].map(q).join(";")];
  for (const t of tasks.values()) {
    const dates = t.daily ? (t.done || []).join(", ") : (t.doneAt || "");
    lines.push([t.title, t.cat === "profissional" ? "Profissional" : "Pessoal", DIFF[t.diff], XP[t.diff], t.daily ? repeatLabel(t) + (t.paused ? " (pausada)" : "") : "Uma vez",
      t.due || "", dates, (t.subs || []).map((s) => s.t).join(" | "), t.note || ""].map(q).join(";"));
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
    for (const code of profile?.groups || []) { try { await deleteDoc(memberRef(code)); } catch (e) { } }
    const all = await getDocs(tasksCol());
    let batch = writeBatch(db), n = 0;
    for (const d of all.docs) { batch.delete(d.ref); n++; if (n === 450) { await batch.commit(); batch = writeBatch(db); n = 0; } }
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
  renderMyAvatar();
  syncAddForm();
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

document.addEventListener("visibilitychange", () => { if (!document.hidden && uid) render(); });

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
