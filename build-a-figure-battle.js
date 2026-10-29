/* Build-a-Figure battles: live battles (Firestore rooms) and challenge links (everything inside the link).
   The rules live in battle-core.js; the figure-building screens live in build-a-figure.html (window.BAF). */
import { account } from "./account.js";
import {
  KEYS, ROUND_SECONDS, seededRandom, newSeed, total, validStats, cleanSettings, cleanSide,
  resolveRound, resolveBattle, score, unusedKeys, randomPick,
  makeChallenge, readChallenge, makeResult, readResult,
  commitPick, checkReveal, randomSalt, roomCode
} from "./battle-core.js";

const BAF = window.BAF;
const LABEL = {};
BAF.STATS.forEach((s) => (LABEL[s.key] = s.label));

// ---------- page furniture ----------
const css = document.createElement("style");
css.textContent = `
.baf-status{background:var(--panel);border:1px solid var(--line);border-left:4px solid var(--gold);border-radius:2px;padding:14px 18px;margin-bottom:16px;display:flex;flex-wrap:wrap;gap:10px 18px;align-items:center;justify-content:space-between;font-size:16px}
.baf-status:empty{display:none}
.baf-status .st-text{color:#c9bfab}
.baf-status .st-text strong{color:var(--paper)}
.arena{background:var(--panel);border:1px solid var(--line);border-radius:2px;padding:24px 22px;margin-bottom:22px}
.arena:empty{display:none}
.arena h2{font-family:'Cinzel',serif;font-weight:900;font-size:clamp(22px,4vw,30px);margin:0 0 6px}
.arena .lead{color:#c9bfab;font-size:17px;line-height:1.55;margin:0 0 18px}
.arena .note{color:#96897a;font-size:14px;font-style:italic;margin:10px 0 0}
.field-row{display:flex;flex-direction:column;gap:8px;margin-bottom:16px}
.field-label{font-family:'Cinzel',serif;font-weight:700;font-size:12px;letter-spacing:.08em;color:var(--gold)}
.chips{display:flex;flex-wrap:wrap;gap:8px}
.btn-skip-option.on{border-color:var(--gold);color:var(--gold);background:rgba(201,162,39,.1)}
.text-input{background:var(--panel-raised);border:1px solid var(--line);color:var(--paper);font-family:'EB Garamond',serif;font-weight:600;font-size:16px;padding:10px 12px;border-radius:2px;width:100%;max-width:280px}
.toggle{display:flex;gap:12px;align-items:flex-start;cursor:pointer;max-width:460px}
.toggle input{width:20px;height:20px;accent-color:var(--gold);margin:2px 0 0;flex:none}
.toggle span{font-size:15px;color:#c9bfab;line-height:1.45}
.toggle b{color:var(--paper);font-family:'Cinzel',serif;font-size:13px;letter-spacing:.04em;display:block;margin-bottom:2px}
.btn-row{display:flex;flex-wrap:wrap;gap:10px;margin-top:6px}
.btn-ghost{background:transparent;border:1px solid var(--line);color:var(--paper)}
.btn-ghost:hover:not(:disabled){border-color:var(--gold);color:var(--gold)}
.share-box{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:6px 0 4px}
.share-box input{flex:1 1 220px;min-width:0;max-width:none;font-size:14px}
.pick-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:8px;margin:14px 0}
@media (max-width:760px){.pick-grid{grid-template-columns:repeat(4,1fr)}}
@media (max-width:460px){.pick-grid{grid-template-columns:repeat(2,1fr)}}
.pick-card{position:relative;text-align:left;background:var(--panel-raised);border:1px solid var(--line);border-top:4px solid var(--c);border-radius:2px;padding:10px 10px 11px;color:var(--paper);font-family:'EB Garamond',serif;letter-spacing:0;display:flex;flex-direction:column;gap:2px;min-height:92px}
.pick-card:hover:not(:disabled){border-color:var(--c);filter:brightness(1.08)}
.pick-card .pc-lbl{font-family:'Cinzel',serif;font-weight:700;font-size:10.5px;letter-spacing:.04em;color:var(--c)}
.pick-card .pc-val{font-family:'Cinzel',serif;font-weight:900;font-size:26px;line-height:1.1}
.pick-card .pc-fig{font-size:13px;color:#96897a;font-style:italic}
.pick-card .pc-slot{position:absolute;top:6px;right:8px;font-family:'Cinzel',serif;font-weight:900;font-size:13px;color:#15110d;background:var(--gold);border-radius:50%;width:22px;height:22px;display:grid;place-items:center}
.pick-card.used{opacity:.28}
.pick-card.chosen{outline:2px solid var(--gold);outline-offset:1px}
.pick-card:disabled{cursor:default}
.timer{height:6px;background:#332b22;border-radius:3px;overflow:hidden;margin:4px 0 2px}
.timer div{height:100%;background:var(--gold);transition:width .25s linear}
.timer.low div{background:var(--maroon)}
.timer-label{font-size:14px;color:#96897a;font-style:italic}
.scoreboard{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:12px;margin-bottom:16px}
.scoreboard .sb-name{font-family:'Cinzel',serif;font-weight:700;font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.scoreboard .sb-name.r{text-align:right}
.scoreboard .sb-score{font-family:'Cinzel',serif;font-weight:900;font-size:30px;color:var(--gold);font-variant-numeric:tabular-nums}
.sb-round{font-family:'Cinzel',serif;font-weight:700;font-size:12px;letter-spacing:.1em;color:#96897a;text-align:center;grid-column:1/-1;margin-top:-6px}
.rounds{display:flex;flex-direction:column;gap:8px;margin-top:14px}
.round-row{display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:stretch}
.round-side{background:var(--panel-raised);border:1px solid var(--line);border-left:4px solid var(--c);border-radius:2px;padding:8px 10px}
.round-side.r{border-left-width:1px;border-right:4px solid var(--c);text-align:right}
.round-side .rs-lbl{font-family:'Cinzel',serif;font-weight:700;font-size:11px;letter-spacing:.04em;color:var(--c)}
.round-side .rs-val{font-family:'Cinzel',serif;font-weight:900;font-size:22px;line-height:1.1}
.round-side .rs-fig{font-size:13px;color:#96897a;font-style:italic}
.round-side.won{background:rgba(201,162,39,.14);border-color:var(--gold)}
.round-side.won.r{border-right-color:var(--c)}
.round-mid{display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:'Cinzel',serif;font-weight:700;font-size:11px;letter-spacing:.06em;color:#96897a;min-width:46px;text-align:center}
.round-mid b{font-size:15px;color:var(--paper)}
.round-row.fresh{animation:bafIn .45s ease}
@keyframes bafIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.verdict{font-family:'Cinzel',serif;font-weight:900;font-size:clamp(30px,6vw,46px);margin:0;color:var(--gold)}
.verdict-sub{color:#c9bfab;font-size:17px;margin:6px 0 0;line-height:1.5}
.waiting{display:flex;align-items:center;gap:10px;color:#c9bfab;font-size:16px;margin:8px 0}
.dot{width:9px;height:9px;border-radius:50%;background:var(--gold);animation:bafPulse 1.2s ease-in-out infinite;flex:none}
@keyframes bafPulse{0%,100%{opacity:.25}50%{opacity:1}}
.order-slots{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin:6px 0 4px}
@media (max-width:560px){.order-slots{grid-template-columns:repeat(4,1fr)}}
.order-slot{border:1px dashed var(--line);border-radius:2px;padding:6px;font-size:12px;text-align:center;min-height:44px;color:#96897a}
.order-slot b{display:block;font-family:'Cinzel',serif;font-size:11px;color:var(--paper)}
.order-slot.filled{border-style:solid;border-color:var(--c);color:var(--c);font-family:'Cinzel',serif;font-weight:700;font-size:10.5px}
`;
document.head.appendChild(css);

const status = document.createElement("div");
status.className = "baf-status"; status.id = "bafStatus";
const arena = document.createElement("section");
arena.className = "arena"; arena.id = "arena";
BAF.spinCard.before(status);
BAF.spinCard.after(arena);

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const $ = (id) => document.getElementById(id);
const pageUrl = () => location.origin + location.pathname;

function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k)); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }
const savedName = () => store("baf-name") || "";

function showBuilder(on) {
  BAF.board.style.display = on ? "" : "none";
  BAF.result.style.display = on ? "" : "none";
  $("nameInput").style.display = on ? "none" : "";
}
function card(html) { BAF.spinCard.innerHTML = `<div class="spin-idle">${html}</div>`; }
function clearScreens() { status.innerHTML = ""; arena.innerHTML = ""; }
function settingsText(s) {
  const skips = s.skips === "inf" ? "unlimited skips" : s.skips === 0 ? "no skips" : `${s.skips} skip${s.skips > 1 ? "s" : ""}`;
  return `${s.mode === "hard" ? "Hard" : "Easy"} mode · ${skips} · ${Number.isInteger(s.seed) ? "same spins" : "own spins"}`;
}

async function shareLink(url, text) {
  if (navigator.share) {
    try { await navigator.share({ title: "Build-a-Figure battle", text, url }); return "shared"; }
    catch (e) { if (e && e.name === "AbortError") return "cancelled"; }
  }
  return copyLink(url);
}
async function copyLink(url) {
  try { await navigator.clipboard.writeText(url); return "copied"; }
  catch (e) { const i = $("shareUrl"); if (i) { i.focus(); i.select(); } return "select"; }
}
function shareBox(url, text) {
  const id = "sh" + Math.random().toString(36).slice(2, 7);
  setTimeout(() => {
    const s = $(id + "s"), c = $(id + "c"), m = $(id + "m");
    const say = (r) => { if (m) m.textContent = r === "copied" ? "Link copied. Paste it into a text." : r === "shared" ? "Sent!" : r === "select" ? "Copy the link above." : ""; };
    if (s) s.onclick = async () => say(await shareLink(url, text));
    if (c) c.onclick = async () => say(await copyLink(url));
  });
  return `<div class="share-box"><input class="text-input" id="shareUrl" readonly value="${esc(url)}" onclick="this.select()"></div>
    <div class="btn-row">${navigator.share ? `<button class="btn-spin" id="${id}s">TEXT THE LINK</button>` : ""}
    <button class="${navigator.share ? "btn-ghost" : "btn-spin"}" id="${id}c">COPY LINK</button></div>
    <p class="note" id="${id}m"></p>`;
}

// ---------- shared pieces: settings form, order picker, round rows, final result ----------
function settingsForm(kind, onGo) {
  clearScreens(); showBuilder(false);
  const st = { mode: "easy", skips: 0, same: true };
  card(`<p><strong>${kind === "live" ? "Live battle" : "Challenge link"}</strong>: ${kind === "live"
      ? "you'll get a link to text your friend. You both build at the same time, then pick one category a round, with " + ROUND_SECONDS + " seconds to choose."
      : "build your figure and set the order you'll play your categories in, then text the link. Your friend builds and sets theirs whenever they like."}</p>`);
  arena.innerHTML = `
    <div class="field-row"><span class="field-label">YOUR NAME</span>
      <input class="text-input" id="bName" maxlength="24" placeholder="Your name" value="${esc(savedName())}"></div>
    <div class="field-row"><span class="field-label">DIFFICULTY</span><div class="chips" id="bMode"></div></div>
    <div class="field-row"><span class="field-label">SKIPS EACH</span><div class="chips" id="bSkips"></div></div>
    <div class="field-row"><label class="toggle"><input type="checkbox" id="bSame" checked>
      <span><b>SAME SPINS</b>Both players get the same figures, in the same order, so it comes down to how you build and battle. Turn off and each of you spins your own.</span></label></div>
    <div class="btn-row"><button class="btn-spin" id="bGo">${kind === "live" ? "CREATE BATTLE" : "START BUILDING"}</button>
      <button class="btn-ghost" id="bBack">BACK</button></div>
    <p class="note" id="bMsg"></p>`;
  const chips = (el, opts, key) => {
    el.innerHTML = "";
    opts.forEach(([v, label]) => {
      const b = document.createElement("button");
      b.className = "btn-skip-option" + (st[key] === v ? " on" : "");
      b.textContent = label;
      b.onclick = () => { st[key] = v; chips(el, opts, key); };
      el.appendChild(b);
    });
  };
  chips($("bMode"), [["easy", "Easy"], ["hard", "Hard"]], "mode");
  chips($("bSkips"), [[0, "None"], [1, "1"], [2, "2"], [3, "3"], [5, "5"], ["inf", "Unlimited"]], "skips");
  $("bBack").onclick = () => leave(true);
  $("bGo").onclick = () => {
    const name = $("bName").value.trim().slice(0, 24) || "Player";
    store("baf-name", name);
    const settings = { mode: st.mode, skips: st.skips, seed: $("bSame").checked ? newSeed() : null };
    onGo(settings, name);
  };
}

function nameScreen(intro, btn, onGo) {
  clearScreens(); showBuilder(false);
  card(intro);
  arena.innerHTML = `
    <div class="field-row"><span class="field-label">YOUR NAME</span>
      <input class="text-input" id="bName" maxlength="24" placeholder="Your name" value="${esc(savedName())}"></div>
    <div class="btn-row"><button class="btn-spin" id="bGo">${btn}</button></div>
    <p class="note" id="bMsg"></p>`;
  $("bGo").onclick = () => {
    const name = $("bName").value.trim().slice(0, 24) || "Player";
    store("baf-name", name);
    onGo(name);
  };
}

function buildFigure(settings, onDone, onProgress) {
  arena.innerHTML = "";
  showBuilder(true);
  BAF.startBuild({ mode: settings.mode, skips: settings.skips, seed: settings.seed, onProgress, onDone });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function cardHtml(k, b, extra = "", inner = "") {
  return `<button class="pick-card ${extra}" data-k="${k}" style="--c:var(--${k}-color)" ${extra.includes("used") || extra.includes("off") ? "disabled" : ""}>
    ${inner}<span class="pc-lbl">${LABEL[k]}</span><span class="pc-val">${b.stats[k]}</span><span class="pc-fig">${esc(b.figs[k])}</span></button>`;
}

function orderPicker(build, onLock) {
  showBuilder(false);
  card(`<p>Your figure is built. Now set your <strong>battle order</strong>: tap your categories in the order you'll play them, round 1 to 7. Your friend does the same without seeing yours, then the rounds are revealed one at a time.</p>`);
  const order = [];
  const draw = () => {
    arena.innerHTML = `
      <h2>Set your battle order</h2>
      <p class="lead">Total of your stats: <strong>${total(build.stats)}</strong>. The higher number wins each round; most rounds wins the battle.</p>
      <div class="order-slots">${KEYS.map((_, i) => order[i]
        ? `<div class="order-slot filled" style="--c:var(--${order[i]}-color)"><b>R${i + 1}</b>${LABEL[order[i]]} ${build.stats[order[i]]}</div>`
        : `<div class="order-slot"><b>R${i + 1}</b>—</div>`).join("")}</div>
      <div class="pick-grid">${KEYS.map((k) => {
        const at = order.indexOf(k);
        return cardHtml(k, build, at >= 0 ? "used" : "", at >= 0 ? `<span class="pc-slot">${at + 1}</span>` : "");
      }).join("")}</div>
      <div class="btn-row">
        <button class="btn-spin" id="oLock" ${order.length < KEYS.length ? "disabled" : ""}>LOCK IN ORDER</button>
        <button class="btn-ghost" id="oUndo" ${order.length ? "" : "disabled"}>UNDO</button>
        <button class="btn-ghost" id="oRand">RANDOM ORDER</button>
      </div>`;
    arena.querySelectorAll(".pick-card").forEach((b) => (b.onclick = () => { order.push(b.dataset.k); draw(); }));
    $("oUndo").onclick = () => { order.pop(); draw(); };
    $("oRand").onclick = () => { order.length = 0; const left = KEYS.slice(); while (left.length) order.push(left.splice(Math.floor(Math.random() * left.length), 1)[0]); draw(); };
    $("oLock").onclick = () => onLock(order.slice());
  };
  draw();
}

function sideHtml(r, side, figs, cls) {
  const s = r[side];
  const won = r.winner === side;
  return `<div class="round-side ${cls} ${won ? "won" : ""}" style="--c:var(--${s.key}-color)">
    <div class="rs-lbl">${LABEL[s.key]}</div><div class="rs-val">${s.value}</div><div class="rs-fig">${esc(figs[s.key])}</div></div>`;
}
// left is always side "a" here; callers pass rounds already oriented with the viewer on the left.
function roundRow(r, i, figsA, figsB, fresh) {
  const mid = r.winner === "tie" ? "DRAW" : r.winner === "a" ? "◀ WIN" : "WIN ▶";
  return `<div class="round-row ${fresh ? "fresh" : ""}">${sideHtml(r, "a", figsA, "")}
    <div class="round-mid"><span>ROUND</span><b>${i + 1}</b><span>${mid}</span></div>${sideHtml(r, "b", figsB, "r")}</div>`;
}
function scoreboard(nameA, nameB, s, roundLabel) {
  return `<div class="scoreboard"><div class="sb-name">${esc(nameA)}</div>
    <div class="sb-score">${s.winsA} – ${s.winsB}</div><div class="sb-name r">${esc(nameB)}</div>
    ${roundLabel ? `<div class="sb-round">${roundLabel}</div>` : ""}</div>`;
}
function verdictHtml(s, nameA, nameB, youAreA) {
  const winnerName = s.winner === "a" ? nameA : nameB;
  const head = s.winner === "tie" ? "It's a draw" : youAreA ? (s.winner === "a" ? "You win!" : `${esc(nameB)} wins`) : `${esc(winnerName)} wins`;
  const draws = s.ties ? ` with ${s.ties} drawn round${s.ties > 1 ? "s" : ""}` : "";
  let sub = `${esc(nameA)} ${s.winsA} – ${s.winsB} ${esc(nameB)} in rounds${draws}.`;
  if (s.decidedBy === "total") sub += ` Rounds were level, so total stats decided it: ${s.totalA} to ${s.totalB}.`;
  if (s.decidedBy === "draw") sub += ` Total stats were level too (${s.totalA} each).`;
  return `<p class="verdict">${head}</p><p class="verdict-sub">${sub}</p>`;
}

// Reveal a finished challenge battle one round at a time.
function playReveal({ nameA, nameB, figsA, figsB, battle, youAreA, after }) {
  showBuilder(false);
  let shown = 0, timer = null;
  const draw = (instant) => {
    const s = score(battle.rounds.slice(0, shown), { ...battle.statsA }, { ...battle.statsB });
    const done = shown >= KEYS.length;
    const full = done ? score(battle.rounds, battle.statsA, battle.statsB) : null;
    arena.innerHTML = `
      ${done ? verdictHtml(full, nameA, nameB, youAreA) : ""}
      ${scoreboard(nameA, nameB, s, done ? "FINAL" : `ROUND ${Math.min(shown + 1, 7)} OF 7`)}
      <div class="rounds">${battle.rounds.slice(0, shown).map((r, i) => roundRow(r, i, figsA, figsB, !instant && i === shown - 1)).join("")}</div>
      ${done ? `<div id="afterBox" style="margin-top:20px"></div>` : `<div class="btn-row" style="margin-top:14px"><button class="btn-ghost" id="rvSkip">SHOW ALL</button></div>`}`;
    if (done) { after($("afterBox")); return; }
    $("rvSkip").onclick = () => { clearTimeout(timer); shown = KEYS.length; draw(true); };
  };
  const step = () => { shown++; draw(false); if (shown < KEYS.length) timer = setTimeout(step, 1400); };
  card(`<p>Revealing the battle…</p>`);
  draw(true);
  timer = setTimeout(step, 700);
  cleanup.push(() => clearTimeout(timer));
}

// ---------- challenge links ----------
function linkHost(settings, name) {
  buildFigure(settings, (build) => {
    orderPicker(build, (order) => {
      const id = roomCode();
      const code = makeChallenge({ name, stats: build.stats, figs: build.figs, order }, settings, id);
      const url = `${pageUrl()}#c=${code}`;
      card(`<p>Your challenge is ready. Text the link to a friend. When they finish, they'll get a link to send back so you can see how the battle went.</p>`);
      arena.innerHTML = `<h2>Challenge ready</h2>
        <p class="lead">${esc(settingsText(settings))}. Your battle order is locked in the link.</p>
        ${shareBox(url, `${name} challenged you to a Build-a-Figure battle on Bible Games Daily!`)}
        <div class="btn-row" style="margin-top:14px"><button class="btn-ghost" id="lkNew">NEW BATTLE</button></div>`;
      $("lkNew").onclick = () => leave(true);
    });
  });
}

function linkGuest(code) {
  const ch = readChallenge(code);
  if (!ch) return problem("This challenge link looks broken or incomplete. Ask your friend to send it again.");
  const doneKey = `baf-ch-${ch.id}`;
  const saved = store(doneKey);
  if (saved && readResult(saved)) return showGuestResult(ch, readResult(saved), saved, true);
  nameScreen(`<p><strong>${esc(ch.a.name)}</strong> challenged you to a Build-a-Figure battle! ${esc(settingsText(ch.settings))}.</p>
    <p>Build your figure, set the order you'll play your categories in, and the seven rounds are revealed against ${esc(ch.a.name)}'s figure.</p>`,
    "START BUILDING", (name) => {
      buildFigure(ch.settings, (build) => {
        orderPicker(build, (order) => {
          const me = cleanSide({ name, stats: build.stats, figs: build.figs, order }, "Player");
          const resCode = makeResult(ch, me);
          store(doneKey, resCode);
          showGuestResult(ch, readResult(resCode), resCode, false);
        });
      });
    });
}

function showGuestResult(ch, res, resCode, already) {
  clearScreens();
  const battle = resolveBattle(res.b.stats, res.b.order, res.a.stats, res.a.order);
  battle.statsA = res.b.stats; battle.statsB = res.a.stats;
  const url = `${pageUrl()}#r=${resCode}`;
  playReveal({
    nameA: res.b.name, nameB: res.a.name, figsA: res.b.figs, figsB: res.a.figs, battle, youAreA: true,
    after: (box) => {
      card(`<p>${already ? "You've already played this challenge, so here's how it went." : "Battle over!"} Send the result to ${esc(res.a.name)} so they can see it too.</p>`);
      box.innerHTML = `<p class="field-label" style="margin:0 0 6px">SEND THE RESULT TO ${esc(res.a.name.toUpperCase())}</p>
        ${shareBox(url, `I took your Build-a-Figure challenge! See how it went:`)}
        <div class="btn-row" style="margin-top:14px"><button class="btn-ghost" id="gNew">START YOUR OWN BATTLE</button></div>`;
      $("gNew").onclick = () => leave(true);
    }
  });
}

function resultView(code) {
  const res = readResult(code);
  if (!res) return problem("This result link looks broken or incomplete.");
  clearScreens();
  const battle = resolveBattle(res.a.stats, res.a.order, res.b.stats, res.b.order);
  battle.statsA = res.a.stats; battle.statsB = res.b.stats;
  playReveal({
    nameA: res.a.name, nameB: res.b.name, figsA: res.a.figs, figsB: res.b.figs, battle, youAreA: false,
    after: (box) => {
      card(`<p><strong>${esc(res.b.name)}</strong> took ${esc(res.a.name)}'s challenge. ${esc(settingsText(res.settings))}.</p>`);
      box.innerHTML = `<div class="btn-row"><button class="btn-spin" id="rvNew">NEW BATTLE</button></div>`;
      $("rvNew").onclick = () => leave(true);
    }
  });
}

// ---------- live battles ----------
let L = null;           // the live battle in progress
let cleanup = [];       // listeners and timers to stop when leaving

async function session() {
  if (!account.state.enabled) throw new Error("Live battles aren't switched on.");
  let t;
  const timeout = new Promise((_, rej) => (t = setTimeout(() => rej(new Error("Timed out connecting")), 15000)));
  try { return await Promise.race([account.battleSession(), timeout]); } finally { clearTimeout(t); }
}

async function liveHost(settings, name) {
  card(`<p>Setting up your battle…</p>`); arena.innerHTML = "";
  let sess;
  try { sess = await session(); } catch (e) { return problem("Live battles couldn't connect. Check your internet connection and try again, or use a challenge link instead.", e); }
  const { db, F, user } = sess;
  const code = roomCode();
  const now = Date.now();
  try {
    await F.setDoc(F.doc(db, "battles", code), { host: user.uid, hostName: name, guest: null, guestName: null, createdAt: now, settings: cleanSettings(settings) });
    await F.setDoc(F.doc(db, "battles", code, "players", user.uid), blankPlayer(name));
  } catch (e) { return problem("Couldn't create the battle. Please try again in a moment.", e); }
  history.replaceState(null, "", `${pageUrl()}?live=${code}`);
  enterRoom(sess, code, "host");
}

function blankPlayer(name) { return { name, progress: 0, ready: false, stats: null, figs: null, commits: [], reveals: [], updatedAt: Date.now() }; }

async function liveJoin(code) {
  card(`<p>Finding the battle…</p>`); clearScreens(); showBuilder(false);
  let sess;
  try { sess = await session(); } catch (e) { return problem("Live battles couldn't connect. Check your internet connection and try again.", e); }
  const { db, F, user } = sess;
  const ref = F.doc(db, "battles", code);
  let snap;
  try { snap = await F.getDoc(ref); } catch (e) { return problem("Couldn't reach the battle. Check your connection and try again.", e); }
  if (!snap.exists()) return problem("That battle link doesn't match any battle. Ask your friend to send it again.");
  const room = snap.data();
  if (room.host === user.uid) return enterRoom(sess, code, "host");
  if (room.guest === user.uid) return enterRoom(sess, code, "guest");
  if (room.guest) return problem("This battle already has two players. Ask your friend to start a new one for you.");
  const settings = cleanSettings(room.settings);
  nameScreen(`<p><strong>${esc(room.hostName || "Your friend")}</strong> wants a live Build-a-Figure battle! ${esc(settingsText(settings))}.</p>
    <p>You'll both build at the same time, then pick one category a round, with ${ROUND_SECONDS} seconds each.</p>`, "JOIN BATTLE", async (name) => {
    $("bGo").disabled = true;
    try {
      await F.updateDoc(ref, { guest: user.uid, guestName: name });
      await F.setDoc(F.doc(db, "battles", code, "players", user.uid), blankPlayer(name));
    } catch (e) {
      return problem("Couldn't join. Someone else may have joined first; ask your friend to start a new battle.", e);
    }
    enterRoom(sess, code, "guest");
  });
}

async function enterRoom(sess, code, role) {
  const { db, F, user } = sess;
  const roomRef = F.doc(db, "battles", code);
  const myRef = F.doc(db, "battles", code, "players", user.uid);
  const local = store(`baf-live-${code}`) || {};
  L = { sess, code, role, uid: user.uid, roomRef, myRef, room: null, opp: null, oppUid: null, oppSub: null,
        mine: null, picks: local.picks || [], oppCommits: local.oppCommits || {}, revealed: [], results: [],
        round: 0, phase: "build", busy: false, deadline: 0, showing: false };
  const save = () => store(`baf-live-${code}`, { picks: L.picks, oppCommits: L.oppCommits });
  L.save = save;
  const link = `${pageUrl()}?live=${code}`;
  L.link = link;

  let myDoc;
  try { myDoc = (await F.getDoc(myRef)).data(); } catch (e) { return problem("Couldn't load your side of the battle.", e); }
  if (!myDoc) { try { await F.setDoc(myRef, blankPlayer(savedName() || "Player")); myDoc = blankPlayer(savedName() || "Player"); } catch (e) { return problem("Couldn't join the battle.", e); } }
  L.myName = myDoc.name;

  const unRoom = F.onSnapshot(roomRef, (s) => {
    if (!L || L.code !== code) return;
    L.room = s.data();
    const oppUid = role === "host" ? L.room.guest : L.room.host;
    if (oppUid && !L.oppUid) {
      L.oppUid = oppUid;
      const unOpp = F.onSnapshot(F.doc(db, "battles", code, "players", oppUid), (o) => {
        if (!L || L.code !== code) return;
        L.opp = o.exists() ? o.data() : null;
        onLiveChange();
      }, (e) => console.error(e));
      cleanup.push(unOpp);
    }
    onLiveChange();
  }, (e) => { console.error(e); problem("Lost the connection to the battle.", e); });
  cleanup.push(unRoom);

  if (myDoc.ready && validStats(myDoc.stats)) {
    L.mine = { stats: myDoc.stats, figs: myDoc.figs };
    L.phase = "waiting";
    showBuilder(false);
    card(`<p>Your figure is built.</p>`);
  } else {
    const settingsP = new Promise((r) => { const chk = () => (L && L.room ? r(cleanSettings(L.room.settings)) : setTimeout(chk, 100)); chk(); });
    const settings = await settingsP;
    if (!L || L.code !== code) return;
    buildFigure(settings, async (build) => {
      L.mine = { stats: build.stats, figs: build.figs };
      L.phase = "waiting";
      showBuilder(false);
      card(`<p>Your figure is built.</p>`);
      try { await F.setDoc(myRef, { stats: build.stats, figs: build.figs, ready: true, progress: 7, updatedAt: Date.now() }, { merge: true }); }
      catch (e) { return problem("Couldn't send your figure. Check your connection.", e); }
      onLiveChange();
    }, (n) => { F.setDoc(myRef, { progress: n, updatedAt: Date.now() }, { merge: true }).catch(() => {}); });
  }
  const iv = setInterval(timerTick, 250);
  cleanup.push(() => clearInterval(iv));
  onLiveChange();
}

function oppName() { return (L.opp && L.opp.name) || (L.role === "host" ? (L.room && L.room.guestName) : (L.room && L.room.hostName)) || "Your friend"; }

function renderStatus() {
  if (!L || L.phase === "battle" || L.phase === "over") { status.innerHTML = ""; return; }
  const joined = !!L.oppUid;
  let text;
  if (!joined) text = `<span class="st-text"><span class="dot" style="display:inline-block;margin-right:8px"></span>Waiting for your friend to join. Text them the link.</span>`;
  else if (!L.opp) text = `<span class="st-text"><strong>${esc(oppName())}</strong> joined.</span>`;
  else if (L.opp.ready) text = `<span class="st-text"><strong>${esc(oppName())}</strong> has finished building.</span>`;
  else text = `<span class="st-text"><strong>${esc(oppName())}</strong> is building: figure ${Math.min((L.opp.progress || 0) + 1, 7)} of 7.</span>`;
  const shareHtml = !joined ? shareBox(L.link, `${L.myName} wants a live Build-a-Figure battle on Bible Games Daily!`) : "";
  if (status.dataset.k === text + joined) return;   // avoid redrawing share buttons on every update
  status.dataset.k = text + joined;
  status.innerHTML = `${text}${shareHtml ? `<div>${shareHtml}</div>` : ""}`;
}

function onLiveChange() {
  if (!L) return;
  renderStatus();
  if (L.phase === "waiting") {
    if (L.opp && L.opp.ready && validStats(L.opp.stats)) return startLiveBattle();
    arena.innerHTML = `<h2>Ready for battle</h2>
      <p class="lead">Your figure totals <strong>${total(L.mine.stats)}</strong>.</p>
      <div class="pick-grid">${KEYS.map((k) => cardHtml(k, L.mine, "off")).join("")}</div>
      <div class="waiting"><span class="dot"></span>Waiting for ${esc(oppName())} ${L.oppUid ? "to finish building" : "to join"}…</div>
      ${L.oppUid ? "" : `<p class="note">Haven't sent the link yet? Use the buttons above.</p>`}`;
    return;
  }
  if (L.phase === "battle") advance();
}

function startLiveBattle() {
  L.phase = "battle";
  L.oppBuild = { stats: { ...L.opp.stats }, figs: { ...(L.opp.figs || {}) } };
  status.innerHTML = ""; status.dataset.k = "";
  showBuilder(false);
  card(`<p>Battle on! Each round, pick a category you haven't used. Picks stay hidden until you've both locked in. You have ${ROUND_SECONDS} seconds a round, or one is picked for you.</p>`);
  L.deadline = Date.now() + ROUND_SECONDS * 1000;
  renderBattle();
  advance();
}

const usedMine = () => L.picks.slice(0, L.round).map((p) => p.k);
const usedOpp = () => L.revealed.slice(0, L.round);

async function choose(k) {
  const r = L.round;
  if (L.picks[r] || L.phase !== "battle" || L.showing) return;
  if (!unusedKeys(usedMine()).includes(k)) return;
  const s = randomSalt();
  const c = await commitPick(r, k, s);
  if (L.picks[r]) return;
  L.picks[r] = { k, s, c };
  L.save();
  renderBattle();
  try { await L.sess.F.setDoc(L.myRef, { commits: L.picks.slice(0, r + 1).map((p) => p.c), updatedAt: Date.now() }, { merge: true }); }
  catch (e) { console.error(e); }
  advance();
}

// Moves the current round along whenever something changes: reveal once both have locked in, score once both revealed.
async function advance() {
  if (!L || L.phase !== "battle" || L.showing) return;
  if (L.busy) { L.again = true; return; }
  L.busy = true; L.again = false;
  try {
    const F = L.sess.F;
    const r = L.round;
    const opp = L.opp || {};
    const oc = (opp.commits || [])[r];
    if (oc && !L.oppCommits[r]) { L.oppCommits[r] = oc; L.save(); }   // remember the first fingerprint we saw
    const mine = L.picks[r];
    if (mine && L.oppCommits[r] && !L.revealedMine?.[r]) {
      L.revealedMine = L.revealedMine || {};
      await F.setDoc(L.myRef, { reveals: L.picks.slice(0, r + 1).map((p) => ({ k: p.k, s: p.s })), updatedAt: Date.now() }, { merge: true });
      L.revealedMine[r] = true;
    }
    const orv = (opp.reveals || [])[r];
    if (mine && L.revealedMine?.[r] && orv) {
      const ok = await checkReveal(r, L.oppCommits[r], orv, usedOpp());
      const oppKey = ok ? orv.k : null;
      let res;
      if (ok) res = resolveRound(L.mine.stats, mine.k, L.oppBuild.stats, oppKey);
      else res = { a: { key: mine.k, value: L.mine.stats[mine.k] }, b: { key: unusedKeys(usedOpp())[0], value: 0 }, winner: "a", bad: true };
      L.revealed[r] = res.b.key;
      L.results[r] = res;
      L.showing = true;
      renderBattle(true);
      setTimeout(() => {
        if (!L) return;
        L.showing = false;
        L.round++;
        if (L.round >= KEYS.length) return finishLive();
        L.deadline = Date.now() + ROUND_SECONDS * 1000;
        renderBattle();
        advance();
      }, 2600);
    }
  } catch (e) { console.error("Battle step failed", e); }
  finally { if (L) L.busy = false; }
  if (L && L.again && !L.showing) return advance();
  if (L && L.phase === "battle" && !L.showing) renderBattle();
}

function timerTick() {
  if (!L || L.phase !== "battle" || L.showing) return;
  const left = Math.max(0, L.deadline - Date.now());
  const bar = $("lvTimer"), lab = $("lvTimerLabel");
  const r = L.round;
  if (!L.picks[r]) {
    if (bar) { bar.firstElementChild.style.width = (left / (ROUND_SECONDS * 10)) + "%"; bar.classList.toggle("low", left < 8000); }
    if (lab) lab.textContent = `${Math.ceil(left / 1000)} seconds to pick`;
    if (left <= 0 && !L.autoPicked?.[r]) { (L.autoPicked = L.autoPicked || {})[r] = true; choose(randomPick(usedMine())); }
  } else {
    const away = Date.now() - L.deadline > 25000;
    const el = $("lvAway");
    if (el) el.style.display = away ? "" : "none";
  }
  // Fallback in case a snapshot was missed: try to move on every few seconds.
  if (Date.now() % 3000 < 250) advance();
}

function renderBattle(justScored) {
  if (!L) return;
  const r = L.round;
  const s = score(L.results.filter(Boolean), L.mine.stats, L.oppBuild.stats);
  const used = L.picks.slice(0, r).map((p) => p.k);
  const mine = L.picks[r];
  let middle;
  if (justScored) {
    const res = L.results[r];
    const msg = res.bad ? `${esc(oppName())}'s pick didn't check out, so this round goes to you.`
      : res.winner === "tie" ? "A draw." : res.winner === "a" ? "You win the round!" : `${esc(oppName())} wins the round.`;
    middle = `<p class="lead" style="margin:0"><strong>${msg}</strong></p>`;
  } else if (mine) {
    middle = `<div class="waiting"><span class="dot"></span>Locked in: ${LABEL[mine.k]} (${L.mine.stats[mine.k]}). Waiting for ${esc(oppName())}…</div>
      <div id="lvAway" style="display:none"><p class="note">${esc(oppName())} seems to be away. Keep waiting, or <a href="#" id="lvLeave" style="color:var(--gold)">leave the battle</a>.</p></div>`;
  } else {
    middle = `<div class="timer" id="lvTimer"><div style="width:100%"></div></div><span class="timer-label" id="lvTimerLabel">${ROUND_SECONDS} seconds to pick</span>`;
  }
  arena.innerHTML = `
    ${scoreboard("You", oppName(), s, `ROUND ${Math.min(r + 1, 7)} OF 7`)}
    ${middle}
    <div class="pick-grid">${KEYS.map((k) => {
      const isUsed = used.includes(k);
      const chosen = mine && mine.k === k;
      return cardHtml(k, L.mine, isUsed ? "used" : chosen ? "chosen off" : mine || justScored ? "off" : "");
    }).join("")}</div>
    <div class="rounds">${L.results.map((x, i) => x ? roundRow(x, i, L.mine.figs, L.oppBuild.figs, justScored && i === r) : "").reverse().join("")}</div>`;
  arena.querySelectorAll(".pick-card:not(:disabled)").forEach((b) => (b.onclick = () => choose(b.dataset.k)));
  const lv = $("lvLeave"); if (lv) lv.onclick = (e) => { e.preventDefault(); leave(true); };
}

function finishLive() {
  L.phase = "over";
  const s = score(L.results, L.mine.stats, L.oppBuild.stats);
  card(`<p>Battle over!</p>`);
  arena.innerHTML = `${verdictHtml(s, "You", oppName(), true)}
    <div style="margin-top:16px">${scoreboard("You", oppName(), s, "FINAL")}</div>
    <div class="rounds">${L.results.map((x, i) => roundRow(x, i, L.mine.figs, L.oppBuild.figs, false)).join("")}</div>
    <div class="btn-row" style="margin-top:20px"><button class="btn-spin" id="lvNew">NEW BATTLE</button></div>`;
  $("lvNew").onclick = () => leave(true);
}

// ---------- entry points ----------
function problem(msg, err) {
  if (err) console.error(err);
  stopAll();
  clearScreens(); showBuilder(false);
  card(`<p>${esc(msg)}</p><button class="btn-spin" id="pbBack">BACK TO GAMES</button>`);
  $("pbBack").onclick = () => leave(true);
}

function stopAll() {
  cleanup.forEach((f) => { try { f(); } catch (e) {} });
  cleanup = [];
  L = null;
}

function leave(toMenu) {
  stopAll();
  clearScreens();
  status.dataset.k = "";
  if (location.search || location.hash) history.replaceState(null, "", pageUrl());
  $("nameInput").style.display = "";
  BAF.result.style.display = "";
  if (toMenu) BAF.showMenu();
  else BAF.reset();
}

function start(kind) {
  stopAll();
  if (kind === "live") settingsForm("live", liveHost);
  else settingsForm("link", linkHost);
}

window.BAFBattle = { start, leave: () => leave(false), seededRandom };
window.dispatchEvent(new Event("baf-battle-ready"));

// Opened from a link?
const params = new URLSearchParams(location.search);
const hash = location.hash.slice(1);
if (params.get("live")) liveJoin(params.get("live").replace(/[^a-z0-9]/gi, "").slice(0, 16));
else if (hash.startsWith("c=")) linkGuest(hash.slice(2));
else if (hash.startsWith("r=")) resultView(hash.slice(2));
// A challenge or result link opened in a tab that already has the game open only changes the #part, so reload for it.
window.addEventListener("hashchange", () => { if (/^#(c|r)=/.test(location.hash)) location.reload(); });
