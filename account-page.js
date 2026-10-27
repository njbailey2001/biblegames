/* Bible Games Daily: the account page (sign in, age check, your stats, delete account). */
import { account } from "./account.js";

const $ = (id) => document.getElementById(id);
const views = ["vOff", "vLoading", "vAge", "vBlocked", "vSignin", "vFinish", "vProfile"];
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

// ---- sign in ----
$("googleBtn").addEventListener("click", async () => {
  msg("signinMsg", "");
  try { await account.signInWithGoogle(); }
  catch (e) { if (e.code !== "auth/popup-closed-by-user" && e.code !== "auth/cancelled-popup-request") msg("signinMsg", friendly(e), true); }
});
$("emailForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("emailIn").value.trim();
  if (!email) { msg("signinMsg", "Enter your email address.", true); return; }
  $("emailBtn").disabled = true;
  try { await account.sendEmailLink(email); msg("signinMsg", "Check your inbox. We sent a sign-in link to " + email + ". Open it on this device."); }
  catch (err) { msg("signinMsg", friendly(err), true); }
  $("emailBtn").disabled = false;
});
$("finishForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("finishEmail").value.trim();
  if (!email) { msg("finishMsg", "Enter the email address the link was sent to.", true); return; }
  try { await account.finishEmailLink(email); }
  catch (err) { msg("finishMsg", friendly(err), true); }
});

// ---- signed in ----
$("signOutBtn").addEventListener("click", () => account.signOut());
$("syncBtn").addEventListener("click", async () => { msg("profileMsg", "Syncing…"); try { await account.syncNow(); msg("profileMsg", "Synced."); renderStats(); } catch (e) { msg("profileMsg", friendly(e), true); } });
$("deleteBtn").addEventListener("click", () => { $("deleteConfirm").hidden = false; $("deleteBtn").hidden = true; });
$("deleteCancel").addEventListener("click", () => { $("deleteConfirm").hidden = true; $("deleteBtn").hidden = false; });
$("deleteYes").addEventListener("click", async () => {
  $("deleteYes").disabled = true;
  try { await account.deleteAccount(); ss.set("bgd-age-ok", ""); msg("signinMsg", "Your account and its saved progress were deleted. Progress on this device is still here."); }
  catch (e) { msg("profileMsg", friendly(e), true); }
  $("deleteYes").disabled = false; $("deleteConfirm").hidden = true; $("deleteBtn").hidden = false;
});

function friendly(e) {
  const c = (e && e.code) || "";
  if (c === "auth/invalid-email") return "That email address doesn't look right.";
  if (c === "auth/invalid-action-code" || c === "auth/expired-action-code") return "That sign-in link has expired or was already used. Request a new one.";
  if (c === "auth/network-request-failed") return "Couldn't connect. Check your internet connection and try again.";
  if (c === "auth/unauthorized-domain") return "Sign-in isn't set up for this web address yet.";
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

  let crSolved = 0, crGaveUp = 0, crGuesses = 0;
  let xwDays = 0;
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
  $("stats").innerHTML = out.join("");
}

// ---- which view to show ----
let finishing = false;
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
  if (account.isEmailLink && account.isEmailLink() && !finishing) {
    finishing = true;
    const saved = account.savedEmail ? account.savedEmail() : "";
    if (saved) { show("vLoading"); account.finishEmailLink(saved).catch((e) => { $("finishEmail").value = saved; show("vFinish"); msg("finishMsg", friendly(e), true); }); return; }
    return show("vFinish");
  }
  if (finishing && !s.user && !$("vFinish").hidden) return;
  if (blockedRecently()) return show("vBlocked");
  if (ss.get("bgd-age-ok") !== "1") return show("vAge");
  return show("vSignin");
}
account.onChange(render);
