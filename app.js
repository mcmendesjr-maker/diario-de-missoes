// Telas e regras de jogo do Diário de Missões.
import { login, logout, watchUser, watchTasks, saveTask, deleteTask } from "./firebase.js";

/* ---------- regras de jogo ---------- */
const XP = { 1: 10, 2: 25, 3: 50 };
const DIFF = { 1: "Fácil", 2: "Média", 3: "Difícil" };
const RANKS = ["Iniciante", "Aprendiz", "Em ritmo", "Constante", "Disciplinado", "Imparável", "Mestre da rotina", "Lenda"];

// Nível 1→2 pede 100 XP; cada nível seguinte pede 50 XP a mais.
function levelFor(xp) {
  let lvl = 1, need = 100, floor = 0;
  while (xp >= floor + need) { floor += need; lvl++; need = 100 + (lvl - 1) * 50; }
  return { lvl, into: xp - floor, need };
}

/* ---------- estado ---------- */
let uid = null;
let tasks = new Map();
let loaded = false;
let unsub = null;
let tab = "hoje", filter = "todas";
const form = { cat: "pessoal", diff: 1 };
let lastLevel = null;
let armed = null;

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------- datas (horário local) ---------- */
const dstr = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const today = () => dstr(new Date());
function addDays(s, n) { const [y, m, d] = s.split("-").map(Number); return dstr(new Date(y, m - 1, d + n)); }
const WD = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
function nice(s) { const [y, m, d] = s.split("-").map(Number); return WD[new Date(y, m - 1, d).getDay()] + ", " + d + " " + MO[m - 1]; }

/* ---------- cálculos ---------- */
// O XP é sempre recalculado a partir das missões concluídas, nunca guardado solto.
function computeStats() {
  const byDay = {}; let total = 0, count = 0; const cats = { pessoal: 0, profissional: 0 };
  for (const t of tasks.values()) {
    const xp = XP[t.diff] || 10;
    const dates = t.daily ? (t.done || []) : (t.doneAt ? [t.doneAt] : []);
    for (const d of dates) { byDay[d] = (byDay[d] || 0) + xp; total += xp; count++; cats[t.cat] = (cats[t.cat] || 0) + 1; }
  }
  let streak = 0, d = today();
  if (!byDay[d]) d = addDays(d, -1);
  while (byDay[d]) { streak++; d = addDays(d, -1); }
  return { byDay, total, count, cats, streak };
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
  const byOpen = (a, b) => (isDoneToday(a) - isDoneToday(b)) || ((a.due || "9") > (b.due || "9") ? 1 : (a.due || "9") < (b.due || "9") ? -1 : 0) || (b.diff - a.diff);
  hoje.sort(byOpen);
  prox.sort((a, b) => (a.due > b.due ? 1 : -1));
  feitas.sort((a, b) => (a.doneAt < b.doneAt ? 1 : -1));
  return { hoje, prox, feitas };
}

/* ---------- desenho da tela ---------- */
const CHECK = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5l3.2 3L13 4.5"/></svg>';
const rankOf = (lvl) => RANKS[Math.min(lvl - 1, RANKS.length - 1)];

function render() {
  const s = computeStats(), L = levelFor(s.total);
  $("lvl").textContent = L.lvl;
  $("rank").textContent = rankOf(L.lvl);
  $("barFill").style.width = (L.into / L.need * 100) + "%";
  $("barNow").textContent = L.into + " / " + L.need + " XP";
  $("barNext").textContent = "faltam " + (L.need - L.into) + " XP para o nível " + (L.lvl + 1);
  $("sToday").textContent = s.byDay[today()] || 0;
  $("sStreak").textContent = s.streak;
  $("sTotal").textContent = s.total;
  $("sub").textContent = s.count ? s.count + " missões concluídas até agora." : "Conclua missões para ganhar XP e subir de nível.";

  if (loaded && lastLevel !== null && L.lvl > lastLevel) {
    const b = $("lvlBanner"); b.className = "levelup"; b.hidden = false;
    b.innerHTML = "<span>Subiu para o nível " + L.lvl + ": " + esc(rankOf(L.lvl)) + "!</span><button type=\"button\" id=\"lvlOk\">Fechar</button>";
    $("lvlOk").onclick = () => { b.hidden = true; };
  }
  if (loaded) lastLevel = L.lvl;

  const B = buckets(), f = (x) => filter === "todas" || x.cat === filter;
  const openToday = B.hoje.filter((x) => !isDoneToday(x)).length;
  $("nHoje").textContent = openToday || "";
  $("nProx").textContent = B.prox.length || "";
  $("nFeitas").textContent = B.feitas.length || "";

  const rows = (tab === "hoje" ? B.hoje : tab === "proximas" ? B.prox : B.feitas).filter(f);
  const list = $("list");
  if (!loaded) {
    list.innerHTML = '<li class="empty"><b>Carregando missões…</b>Isso leva só um instante.</li>';
  } else if (!rows.length) {
    const msg = tasks.size === 0
      ? '<b>Nenhuma missão ainda</b>Escreva a primeira lá em cima, escolha se é pessoal ou profissional e a dificuldade.<br><button type="button" class="ghost" id="seed">Começar com missões de exemplo</button>'
      : tab === "hoje" ? "<b>Tudo em dia</b>Nada pendente para hoje" + (filter !== "todas" ? " nesse filtro" : "") + "."
      : tab === "proximas" ? "<b>Sem missões futuras</b>Missões com prazo depois de hoje aparecem aqui."
      : "<b>Nada concluído ainda</b>Missões finalizadas ficam guardadas aqui.";
    list.innerHTML = '<li class="empty">' + msg + "</li>";
    const sb = $("seed"); if (sb) sb.onclick = seed;
  } else {
    const td = today();
    list.innerHTML = rows.map((t) => {
      const done = isDoneToday(t);
      let when = "";
      if (t.daily) when = "<span>todo dia" + ((t.done || []).length ? " · " + t.done.length + "×" : "") + "</span>";
      else if (t.doneAt) when = "<span>feita " + (t.doneAt === td ? "hoje" : nice(t.doneAt)) + "</span>";
      else if (t.due) when = t.due < td ? '<span class="late">atrasada · ' + nice(t.due) + "</span>" : "<span>" + (t.due === td ? "vence hoje" : nice(t.due)) + "</span>";
      return '<li class="task' + (done ? " done" : "") + '" data-id="' + esc(t.id) + '">' +
        '<button type="button" class="check" data-act="toggle" aria-label="' + (done ? "Desmarcar" : "Concluir") + " " + esc(t.title) + '">' + CHECK + "</button>" +
        '<div class="body"><div class="ttl">' + esc(t.title) + '</div><div class="meta"><span class="tag ' + esc(t.cat) + '">' + (t.cat === "profissional" ? "Profissional" : "Pessoal") + "</span><span>" + DIFF[t.diff] + "</span>" + when + "</div></div>" +
        '<span class="xp">+' + (XP[t.diff] || 10) + "</span>" +
        '<button type="button" class="del' + (armed === t.id ? " arm" : "") + '" data-act="del" aria-label="Excluir ' + esc(t.title) + '">' + (armed === t.id ? "Excluir?" : "✕") + "</button></li>";
    }).join("");
  }

  // últimos 7 dias
  const days = []; for (let i = 6; i >= 0; i--) days.push(addDays(today(), -i));
  const vals = days.map((d) => s.byDay[d] || 0), max = Math.max(50, ...vals);
  $("weekSum").textContent = vals.reduce((a, b) => a + b, 0) + " XP";
  $("week").innerHTML = days.map((d, i) => {
    const [y, m, dd] = d.split("-").map(Number);
    return '<div class="col' + (i === 6 ? " today" : "") + '"><span class="v">' + (vals[i] || "") + '</span><div class="b" style="height:' + (vals[i] / max * 78) + '%"></div><span class="d">' + (i === 6 ? "hoje" : WD[new Date(y, m - 1, dd).getDay()]) + "</span></div>";
  }).join("");

  // conquistas
  const A = [
    ["1", "Primeira missão", "1 missão concluída", s.count >= 1],
    ["10", "Pegando o ritmo", "10 missões", s.count >= 10],
    ["50", "Experiente", "50 missões", s.count >= 50],
    ["3d", "Três seguidos", "3 dias de sequência", s.streak >= 3],
    ["7d", "Semana perfeita", "7 dias de sequência", s.streak >= 7],
    ["⚖", "Equilíbrio", "5 pessoais e 5 profissionais", s.cats.pessoal >= 5 && s.cats.profissional >= 5],
    ["N5", "Nível 5", "Alcance o nível 5", L.lvl >= 5],
    ["1k", "Mil XP", "1.000 XP no total", s.total >= 1000],
  ];
  $("achCount").textContent = A.filter((a) => a[3]).length + "/" + A.length;
  $("ach").innerHTML = A.map((a) => '<div class="a' + (a[3] ? " on" : "") + '"><div class="ic">' + a[0] + "</div><div><b>" + a[1] + "</b><span>" + a[2] + "</span></div></div>").join("");
}

/* ---------- avisos ---------- */
let toastT;
function toast(html) { const t = $("toast"); t.innerHTML = html; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 1800); }
function showDbError(e) {
  const box = $("dbErr"); box.hidden = false;
  if (e && e.code === "permission-denied") box.textContent = "O banco recusou o acesso. Confira se as regras do Firestore foram publicadas (arquivo firestore.rules).";
  else if (e && (e.code === "not-found" || e.code === "failed-precondition")) box.textContent = "O banco de dados ainda não existe. Crie o Firestore Database no console do Firebase.";
  else box.textContent = "Não consegui falar com o banco de dados. Verifique a internet e tente de novo.";
}

/* ---------- gravação ---------- */
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
function put(id, data) {
  tasks.set(id, data); render();
  saveTask(uid, id, data).catch((e) => { showDbError(e); toast("Não consegui salvar."); });
}
function remove(id) {
  tasks.delete(id); render();
  deleteTask(uid, id).catch((e) => { showDbError(e); toast("Não consegui excluir."); });
}

/* ---------- ações ---------- */
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
const group = (attr, fn) => document.querySelectorAll("[" + attr + "]").forEach((b) => b.addEventListener("click", () => {
  document.querySelectorAll("[" + attr + "]").forEach((x) => x.setAttribute("aria-pressed", x === b)); fn(b);
}));
group("data-cat", (b) => { form.cat = b.dataset.cat; });
group("data-diff", (b) => { form.diff = +b.dataset.diff; });
group("data-tab", (b) => { tab = b.dataset.tab; armed = null; render(); });
group("data-filter", (b) => { filter = b.dataset.filter; render(); });
$("newDaily").addEventListener("change", () => { $("newDue").disabled = $("newDaily").checked; });

$("list").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-act]"); if (!btn) return;
  const id = btn.closest(".task").dataset.id, t = tasks.get(id); if (!t) return;
  if (btn.dataset.act === "del") {
    if (armed === id) { armed = null; remove(id); }
    else { armed = id; render(); setTimeout(() => { if (armed === id) { armed = null; render(); } }, 3000); }
    return;
  }
  const td = today(), xp = XP[t.diff] || 10, n = { ...t };
  let gained;
  if (t.daily) {
    const d = [...(t.done || [])], i = d.indexOf(td);
    if (i >= 0) { d.splice(i, 1); gained = false; } else { d.push(td); gained = true; }
    n.done = d;
  } else { gained = !t.doneAt; n.doneAt = gained ? td : null; }
  put(id, n);
  toast(gained ? 'Missão concluída <span class="mono">+' + xp + " XP</span>" : 'Desmarcada <span class="mono">−' + xp + " XP</span>");
});

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

/* ---------- login ---------- */
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

watchUser((user) => {
  $("bootScreen").hidden = true;
  if (unsub) { unsub(); unsub = null; }
  if (!user) {
    uid = null; tasks = new Map(); loaded = false; lastLevel = null;
    $("appScreen").hidden = true; $("loginScreen").hidden = false;
    return;
  }
  uid = user.uid;
  $("loginScreen").hidden = true; $("appScreen").hidden = false; $("dbErr").hidden = true;
  $("userName").textContent = user.displayName || user.email || "";
  const av = $("avatar"); if (user.photoURL) { av.src = user.photoURL; av.hidden = false; } else av.hidden = true;
  render();
  unsub = watchTasks(uid, (map) => { tasks = map; loaded = true; $("dbErr").hidden = true; render(); },
    (e) => { loaded = true; showDbError(e); render(); });
});

// Atualiza "hoje" quando o app volta a ficar visível num novo dia.
document.addEventListener("visibilitychange", () => { if (!document.hidden && uid) render(); });
