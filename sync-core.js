/* Bible Games Daily: pure helpers for merging saved game progress between this device and the cloud.
   No browser or Firebase code here, so it can be tested on its own. */

export const PATTERN = /^(vu-|versle-|ss-|baf-b-)/;

// Everything this device has saved for the games: { data: {key: rawString}, times: {key: ms} }
export function collectLocal(keys, getItem, times) {
  const data = {}, t = {};
  for (const k of keys) {
    if (!PATTERN.test(k)) continue;
    const v = getItem(k);
    if (v === null || v === undefined) continue;
    data[k] = v;
    t[k] = (times && times[k]) || 0;
  }
  return { data, times: t };
}

function parse(v) { try { return JSON.parse(v); } catch (e) { return null; } }

// How far along a saved value is, for when we can't tell which copy is newer.
export function progressScore(v) {
  const o = parse(v);
  if (!o || typeof o !== "object") return 0;
  if (typeof o.played === "number") return o.played;
  if (Array.isArray(o.guesses)) return o.guesses.length + (o.done ? 1000 : 0);
  if (Array.isArray(o.fill)) return o.fill.flat().filter(Boolean).length;
  return 0;
}

// Decide which copy of one key to keep. Returns "local" or "cloud".
export function pickWinner(local, cloud, localTime, cloudTime) {
  const a = parse(local), b = parse(cloud);
  // Stats objects: the copy with more games played has seen everything the other has.
  if (a && b && typeof a.played === "number" && typeof b.played === "number" && a.played !== b.played) {
    return a.played > b.played ? "local" : "cloud";
  }
  const lt = localTime || 0, ct = cloudTime || 0;
  if (lt > 1 || ct > 1) {
    if (lt === ct) return "cloud";
    return lt > ct ? "local" : "cloud";
  }
  // Neither copy has a real timestamp: keep whichever is further along.
  return progressScore(local) >= progressScore(cloud) ? "local" : "cloud";
}

// Merge this device's progress with the account's.
// Returns the merged copy, which keys this device must update, and whether the cloud needs an update.
export function mergeProgress(local, cloud) {
  cloud = cloud || { data: {}, times: {} };
  const ld = local.data || {}, lt = local.times || {}, cd = cloud.data || {}, ct = cloud.times || {};
  const merged = { data: {}, times: {} };
  const updateLocal = [];
  let updateCloud = false;
  const keys = new Set([...Object.keys(ld), ...Object.keys(cd)]);
  for (const k of keys) {
    if (!PATTERN.test(k)) continue;
    const l = ld[k], c = cd[k];
    if (l === undefined) { merged.data[k] = c; merged.times[k] = ct[k] || 0; updateLocal.push(k); continue; }
    if (c === undefined) { merged.data[k] = l; merged.times[k] = lt[k] || 0; updateCloud = true; continue; }
    if (l === c) {
      merged.data[k] = l; merged.times[k] = Math.max(lt[k] || 0, ct[k] || 0);
      if ((ct[k] || 0) < merged.times[k]) updateCloud = true;
      continue;
    }
    if (pickWinner(l, c, lt[k], ct[k]) === "local") {
      merged.data[k] = l; merged.times[k] = lt[k] || 0; updateCloud = true;
    } else {
      merged.data[k] = c; merged.times[k] = ct[k] || 0; updateLocal.push(k);
    }
  }
  return { merged, updateLocal, updateCloud };
}
