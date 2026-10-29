/* Bible Games Daily: the account page (age check, email + password sign-in, your stats, delete account). */
import { account } from "./account.js";

const $ = (id) => document.getElementById(id);
const views = ["vOff", "vLoading", "vAge", "vBlocked", "vSignin", "vProfile"];
function show(id) { for (const v of views) $(v).hidden = v !== id; }
function msg(id, text, isError) { const el = $(id); el.textContent = text || ""; el.classList.toggle("err", !!isError); }

const ss = { get: (k) => { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) {} } };
const ls = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };

// ---- age check (13+). We keep only a yes/no for this visit, never the birth date. ----
const now = new Date();
const yearSel = $("ageYear"), monthSel = $("ageMonth");
for (let y = now.getFullYear(); y >= now.getFullYear() - 100; y--) yearSel.add(new Option(String(y), String(y)));
["January","February","March","April","May","June","July","August","September","October","November","December"].forEach((m, i) => monthSel.add(new Option(m, String(i))));
yearSel.value = ""; monthSel.value = "";

function blockedRecently() { const t = +ls.get("bgd-age-blocked") || 0; return Date.now() - t < 864e5; }

$("ageForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const y = +yearSel.value, m = monthSel.value === "" ? NaN : +monthSel.value;
  if (!y || isNaN(m)) { msg("ageMsg", "Choose your birth month and year.", true); return; }
  let age = now.getFullYear() - y;
  if (now.getMonth() < m) age -= 1; // birthday month not reached yet this year
  if (age < 13) { ls.set("bgd-age-blocked", String(Date.now())); render(account.state); return; }
  ss.set("bgd-age-ok", "1");
  render(account.state);
});

// ---- sign in / create account / reset password ----
const forms = { signin: $("signinForm"), create: $("createForm"), reset: $("resetForm") };
function showForm(name) {
  for (const [k, f] of Object.entries(forms)) f.hidden = k !== name;
  $("tabSignin").setAttribute("aria-selected", String(name === "signin"));
  $("tabCreate").setAttribute("aria-selected", String(name === "create"));
  document.querySelector("#vSignin .tabs").hidden = name === "reset";
  msg("signinMsg", "");
}
$("tabSignin").addEventListener("click", () => showForm("signin"));
$("tabCreate").addEventListener("click", () => showForm("create"));
$("forgotBtn").addEventListener("click", () => { $("rsEmail").value = $("siEmail").value; showForm("reset"); $("rsEmail").focus(); });
$("rsBack").addEventListener("click", () => showForm("signin"));
$("siShow").addEventListener("change", (e) => { $("siPass").type = e.target.checked ? "text" : "password"; });
$("crShow").addEventListener("change", (e) => { const t = e.target.checked ? "text" : "password"; $("crPass").type = t; $("crPass2").type = t; });

async function busy(btnId, fn) {
  const b = $(btnId); b.disabled = true;
  try { await fn(); } finally { b.disabled = false; }
}

forms.signin.addEventListener("submit", (e) => {
  e.preventDefault();
  const email = $("siEmail").value.trim(), pass = $("siPass").value;
  if (!email || !pass) { msg("signinMsg", "Enter your email and password.", true); return; }
  busy("siBtn", async () => {
    try { await account.signIn(email, pass); $("siPass").value = ""; }
    catch (err) { msg("signinMsg", friendly(err), true); }
  });
});

forms.create.addEventListener("submit", (e) => {
  e.preventDefault();
  const email = $("crEmail").value.trim(), p1 = $("crPass").value, p2 = $("crPass2").value;
  if (!email) { msg("signinMsg", "Enter your email address.", true); return; }
  if (p1.length < 8) { msg("signinMsg", "Choose a password with at least 8 characters.", true); return; }
  if (p1 !== p2) { msg("signinMsg", "The two passwords don't match.", true); return; }
  busy("crBtn", async () => {
    try { await account.createAccount(email, p1); $("crPass").value = ""; $("crPass2").value = ""; }
    catch (err) { msg("signinMsg", friendly(err), true); }
  });
});

forms.reset.addEventListener("submit", (e) => {
  e.preventDefault();
  const email = $("rsEmail").value.trim();
  if (!email) { msg("signinMsg", "Enter your email address.", true); return; }
  busy("rsBtn", async () => {
    try {
      await account.sendPasswordReset(email);
      showForm("signin"); $("siEmail").value = email;
      msg("signinMsg", "If there's an account for " + email + ", a reset link is on its way. Check your inbox and spam folder.");
    } catch (err) {
      if (err.code === "auth/user-not-found") { showForm("signin"); msg("signinMsg", "If there's an account for " + email + ", a reset link is on its way."); }
      else msg("signinMsg", friendly(err), true);
    }
  });
});

// ---- signed in ----
$("signOutBtn").addEventListener("click", () => account.signOut());
$("syncBtn").addEventListener("click", async () => { msg("profileMsg", "Syncing…"); try { await account.syncNow(); msg("profileMsg", "Synced."); renderStats(); } catch (e) { msg("profileMsg", friendly(e), true); } });
$("deleteBtn").addEventListener("click", () => { $("deleteConfirm").hidden = false; $("deleteBtn").hidden = true; $("delPass").value = ""; $("delPass").focus(); });
$("deleteCancel").addEventListener("click", () => { $("deleteConfirm").hidden = true; $("deleteBtn").hidden = false; msg("profileMsg", ""); });
$("deleteYes").addEventListener("click", async () => {
  const pass = $("delPass").value;
  if (!pass) { msg("profileMsg", "Enter your password to delete your account.", true); return; }
  $("deleteYes").disabled = true;
  try {
    await account.deleteAccount(pass);
    $("deleteConfirm").hidden = true; $("deleteBtn").hidden = false;
    msg("signinMsg", "Your account and its saved progress were deleted. Progress on this device is still here.");
  } catch (e) { msg("profileMsg", friendly(e), true); }
  $("deleteYes").disabled = false; $("delPass").value = "";
});

function friendly(e) {
  const c = (e && e.code) || "";
  if (c === "auth/invalid-email") return "That email address doesn't look right.";
  if (c === "auth/invalid-credential" || c === "auth/wrong-password" || c === "auth/user-not-found" || c === "auth/invalid-login-credentials") return "That email and password don't match. Check them, or reset your password.";
  if (c === "auth/email-already-in-use") return "There's already an account with that email. Sign in instead, or reset your password.";
  if (c === "auth/weak-password" || c === "auth/password-does-not-meet-requirements") return "Choose a stronger password with at least 8 characters.";
  if (c === "auth/too-many-requests") return "Too many tries. Wait a few minutes, then try again.";
  if (c === "auth/network-request-failed") return "Couldn't connect. Check your internet connection and try again.";
  if (c === "auth/missing-password") return "Enter your password.";
  return (e && e.message) || "Something went wrong. Try again.";
}

// ---- stats from this device's saved progress (already merged with the account) ----
function read(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
function pct(a, b) { return b ? Math.round((a / b) * 100) + "%" : "–"; }
function statRow(label, value) { return `<div class="stat"><b>${value}</b><span>${label}</span></div>`; }

function renderStats() {
  const out = [];
  const dvq = [["Daily Verse", read("vu-stats-daily")], ["Unlimited · Easy", read("vu-stats-easy") || read("vu-stats")], ["Unlimited · Hard", read("vu-stats-hard")]];
  out.push(`<section class="game-stats"><h3>Daily Verse Quest</h3>` + dvq.map(([name, s]) => {
    s = s || {};
    return `<div class="mode"><h4>${name}</h4><div class="stats">${statRow("Current streak", s.streak || 0)}${statRow("Best streak", s.best || 0)}${statRow("Played", s.played || 0)}${statRow("Win rate", pct(s.wins || 0, s.played || 0))}</div></div>`;
  }).join("") + `</section>`);

  let crSolved = 0, crGaveUp = 0, crGuesses = 0, xwDays = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (/^versle-\d+$/.test(k)) {
      const s = read(k); if (!s) continue;
      if (s.done && !s.gaveUp) { crSolved++; crGuesses += (s.guesses || []).length; }
      else if (s.gaveUp) crGaveUp++;
    } else if (/^versle-\d{4}-\d{2}-\d{2}$/.test(k)) {
      const s = read(k); if (s && Array.isArray(s.fill) && s.fill.flat().some(Boolean)) xwDays++;
    }
  }
  out.push(`<section class="game-stats"><h3>Cross Reference</h3><div class="stats">${statRow("Daily words found", crSolved)}${statRow("Average guesses", crSolved ? Math.round(crGuesses / crSolved) : "–")}${statRow("Gave up", crGaveUp)}</div></section>`);
  out.push(`<section class="game-stats"><h3>Bible Crossword</h3><div class="stats">${statRow("Puzzles played", xwDays)}</div></section>`);

  let ssDone = 0, ssPts = 0, ssTot = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (/^ss-\d{4}-\d{2}-\d{2}$/.test(k)) { const s = read(k); if (s && s.total) { ssDone++; ssPts += s.score; ssTot += s.total; } }
  }
  out.push(`<section class="game-stats"><h3>Stones &amp; Scripture</h3><div class="stats">${statRow("Readings quizzed", ssDone)}${statRow("Average score", ssTot ? Math.round((ssPts / ssTot) * 100) + "%" : "–")}</div></section>`);
  $("stats").innerHTML = out.join("");
}

// ---- which view to show ----
function render(s) {
  if (!s.enabled) return show("vOff");
  if (!s.ready) return show("vLoading");
  if (s.user) {
    $("who").textContent = s.user.name || s.user.email || "Signed in";
    $("whoEmail").textContent = s.user.name ? s.user.email : "";
    $("syncState").textContent = s.error ? s.error : s.syncing ? "Syncing your progress…" : "Your progress is synced to this account.";
    renderStats();
    return show("vProfile");
  }
  if (blockedRecently()) return show("vBlocked");
  if (ss.get("bgd-age-ok") !== "1") return show("vAge");
  return show("vSignin");
}
account.onChange(render);
