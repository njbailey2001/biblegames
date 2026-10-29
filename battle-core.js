/* Build-a-Figure battles: pure rules and helpers (no browser or Firebase code, so it can be tested on its own).
   A battle is seven rounds. Each round both players play one category they haven't used yet;
   the higher value wins the round, equal values are a draw. Most rounds won takes the match;
   if that's level, the higher total of all seven stats wins; if that's level too, it's a draw. */

export const KEYS = ["faith", "wisdom", "courage", "leader", "strength", "obed", "compassion"];
export const LABELS = { faith: "Faith", wisdom: "Wisdom", courage: "Courage", leader: "Leadership", strength: "Strength", obed: "Obedience", compassion: "Compassion" };
export const ROUND_SECONDS = 30;

// Small, fast seeded random number generator, so "same spins" gives both players the same figures.
export function seededRandom(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function newSeed() { return (Math.random() * 4294967296) >>> 0; }

export function total(stats) { return KEYS.reduce((s, k) => s + (+stats[k] || 0), 0); }

export function validStats(stats) {
  return !!stats && KEYS.every((k) => Number.isInteger(stats[k]) && stats[k] >= 0 && stats[k] <= 10);
}
export function validOrder(order) {
  return Array.isArray(order) && order.length === KEYS.length && new Set(order).size === KEYS.length && order.every((k) => KEYS.includes(k));
}

export function resolveRound(statsA, keyA, statsB, keyB) {
  const a = statsA[keyA], b = statsB[keyB];
  return { a: { key: keyA, value: a }, b: { key: keyB, value: b }, winner: a > b ? "a" : b > a ? "b" : "tie" };
}

// Score a list of finished rounds. When all seven are in, `winner` says who took the match and `decidedBy` says how.
export function score(rounds, statsA, statsB) {
  let winsA = 0, winsB = 0, ties = 0;
  for (const r of rounds) { if (r.winner === "a") winsA++; else if (r.winner === "b") winsB++; else ties++; }
  const out = { winsA, winsB, ties, totalA: total(statsA), totalB: total(statsB), winner: null, decidedBy: null };
  if (rounds.length < KEYS.length) return out;
  if (winsA !== winsB) { out.winner = winsA > winsB ? "a" : "b"; out.decidedBy = "rounds"; }
  else if (out.totalA !== out.totalB) { out.winner = out.totalA > out.totalB ? "a" : "b"; out.decidedBy = "total"; }
  else { out.winner = "tie"; out.decidedBy = "draw"; }
  return out;
}

// A whole battle where both orders are known up front (challenge links).
export function resolveBattle(statsA, orderA, statsB, orderB) {
  const rounds = KEYS.map((_, i) => resolveRound(statsA, orderA[i], statsB, orderB[i]));
  return { rounds, ...score(rounds, statsA, statsB) };
}

export function unusedKeys(used) { return KEYS.filter((k) => !used.includes(k)); }
export function randomPick(used, rand = Math.random) {
  const left = unusedKeys(used);
  return left[Math.floor(rand() * left.length)];
}

// ---- challenge links ----
// The build travels inside the link (after the #, so it never reaches a server). It's lightly scrambled so the
// opponent's stats and order aren't readable at a glance; it isn't meant to stop someone determined.
const MASK = "BibleGamesDaily:Build-a-Figure";
function toBytes(str) { return new TextEncoder().encode(str); }
function fromBytes(bytes) { return new TextDecoder().decode(bytes); }
function b64urlEncode(bytes) {
  let s = ""; for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(str) {
  const s = atob(str.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
function mask(bytes) { const m = toBytes(MASK); return bytes.map((b, i) => b ^ m[i % m.length]); }

export function encodePayload(obj) { return b64urlEncode(mask(toBytes(JSON.stringify(obj)))); }
export function decodePayload(str) {
  try { return JSON.parse(fromBytes(mask(b64urlDecode(str)))); } catch (e) { return null; }
}

function cleanName(n, fallback) {
  const s = String(n || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 24);
  return s || fallback;
}
function cleanFigs(figs) {
  const out = {};
  for (const k of KEYS) out[k] = String((figs && figs[k]) || "").replace(/[<>]/g, "").slice(0, 40);
  return out;
}
export function cleanSettings(s) {
  s = s || {};
  const skips = s.skips === "inf" || s.skips === Infinity ? "inf" : Math.max(0, Math.min(99, parseInt(s.skips, 10) || 0));
  const seed = Number.isInteger(s.seed) && s.seed >= 0 ? s.seed >>> 0 : null;
  return { mode: s.mode === "hard" ? "hard" : "easy", skips, seed };
}

// One player's finished side: name, stats {key: value}, figs {key: figure name}, order [keys].
export function cleanSide(p, fallbackName) {
  if (!p || !validStats(p.stats)) return null;
  const side = { name: cleanName(p.name, fallbackName), stats: {}, figs: cleanFigs(p.figs) };
  for (const k of KEYS) side.stats[k] = p.stats[k];
  if (p.order !== undefined) { if (!validOrder(p.order)) return null; side.order = p.order.slice(); }
  return side;
}

export function makeChallenge(side, settings, id) {
  return encodePayload({ v: 1, id, settings: cleanSettings(settings), a: side });
}
export function readChallenge(code) {
  const o = decodePayload(code);
  if (!o || o.v !== 1) return null;
  const a = cleanSide(o.a, "Your friend");
  if (!a || !a.order) return null;
  return { id: String(o.id || "").slice(0, 16), settings: cleanSettings(o.settings), a };
}
export function makeResult(challenge, sideB) {
  return encodePayload({ v: 1, id: challenge.id, settings: challenge.settings, a: challenge.a, b: sideB });
}
export function readResult(code) {
  const o = decodePayload(code);
  if (!o || o.v !== 1) return null;
  const a = cleanSide(o.a, "You"), b = cleanSide(o.b, "Your friend");
  if (!a || !b || !a.order || !b.order) return null;
  return { id: String(o.id || "").slice(0, 16), settings: cleanSettings(o.settings), a, b };
}

// ---- hidden picks for live battles ----
// Each pick is first sent as a fingerprint of (round, category, random salt). The category and salt are only sent
// once both players have locked in, and the other side checks they match the fingerprint it saw first.
export function pickMessage(round, key, salt) { return `baf:${round}:${key}:${salt}`; }
export async function sha256Hex(text, subtle = globalThis.crypto.subtle) {
  const buf = await subtle.digest("SHA-256", toBytes(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export function randomSalt(getRandomValues = (a) => globalThis.crypto.getRandomValues(a)) {
  const a = getRandomValues(new Uint8Array(16));
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export async function commitPick(round, key, salt) { return sha256Hex(pickMessage(round, key, salt)); }
export async function checkReveal(round, commit, reveal, usedBefore) {
  if (!reveal || !KEYS.includes(reveal.k) || typeof reveal.s !== "string") return false;
  if (usedBefore.includes(reveal.k)) return false;
  return (await commitPick(round, reveal.k, reveal.s)) === commit;
}

export function roomCode(rand = Math.random) {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let s = ""; for (let i = 0; i < 10; i++) s += chars[Math.floor(rand() * chars.length)];
  return s;
}
