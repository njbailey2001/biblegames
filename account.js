/* Bible Games Daily: accounts and progress sync (Firebase Authentication + Cloud Firestore).
   Loaded on every page as <script type="module" src="/account.js">.
   Until firebase-config.js holds a real config, this does nothing and the site works exactly as before. */
import config from "./firebase-config.js";
import { PATTERN, collectLocal, mergeProgress } from "./sync-core.js";

const FB = "https://www.gstatic.com/firebasejs/10.12.2/";
const listeners = new Set();
const state = { enabled: !!(config && config.apiKey), ready: false, user: null, syncing: false, lastSync: null, error: null };

export const account = {
  state,
  onChange(fn) { listeners.add(fn); fn(state); return () => listeners.delete(fn); },
  signInWithGoogle: () => notReady(),
  sendEmailLink: () => notReady(),
  isEmailLink: () => false,
  finishEmailLink: () => notReady(),
  signOut: () => notReady(),
  deleteAccount: () => notReady(),
  syncNow: () => Promise.resolve()
};
window.BGDAccount = account;

function notReady() { return Promise.reject(new Error("Accounts aren't switched on yet.")); }
function emit() { for (const fn of listeners) { try { fn(state); } catch (e) { console.error(e); } } }

const onAccountPage = /\/account(\.html)?$/.test(location.pathname);
const store = window.__bgdStore;

if (state.enabled && store) {
  start().catch((e) => { console.error("Account setup failed", e); state.error = e.message; state.ready = true; emit(); });
} else {
  state.ready = true;
}

async function start() {
  const [{ initializeApp }, A, F] = await Promise.all([
    import(FB + "firebase-app.js"),
    import(FB + "firebase-auth.js"),
    import(FB + "firebase-firestore.js")
  ]);
  const app = initializeApp(config);
  const auth = A.getAuth(app);
  const db = F.getFirestore(app);
  const userDoc = (uid) => F.doc(db, "users", uid);

  account.signInWithGoogle = async () => {
    const provider = new A.GoogleAuthProvider();
    try { await A.signInWithPopup(auth, provider); }
    catch (e) {
      if (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment") {
        await A.signInWithRedirect(auth, provider);
      } else throw e;
    }
  };
  account.sendEmailLink = async (email) => {
    await A.sendSignInLinkToEmail(auth, email, { url: location.origin + "/account.html", handleCodeInApp: true });
    try { localStorage.setItem("bgd-signin-email", email); } catch (e) {}
  };
  account.isEmailLink = () => A.isSignInWithEmailLink(auth, location.href);
  account.savedEmail = () => { try { return localStorage.getItem("bgd-signin-email") || ""; } catch (e) { return ""; } };
  account.finishEmailLink = async (email) => {
    await A.signInWithEmailLink(auth, email, location.href);
    try { localStorage.removeItem("bgd-signin-email"); } catch (e) {}
    history.replaceState(null, "", location.pathname);
  };
  account.signOut = () => A.signOut(auth);
  account.deleteAccount = async () => {
    const u = auth.currentUser;
    if (!u) return;
    await F.deleteDoc(userDoc(u.uid));
    try { await A.deleteUser(u); }
    catch (e) {
      if (e.code === "auth/requires-recent-login") {
        const err = new Error("For your security, sign in again, then delete your account.");
        err.code = e.code; await A.signOut(auth); throw err;
      }
      throw e;
    }
  };

  // ---- syncing ----
  let pending = new Set();
  let pushTimer = null;
  let mergedOnce = false;

  async function pullAndMerge(user) {
    state.syncing = true; emit();
    const ref = userDoc(user.uid);
    const snap = await F.getDoc(ref);
    const cloud = snap.exists() ? snap.data() : null;
    const keys = []; for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
    const local = collectLocal(keys, (k) => store.get(k), store.times());
    const { merged, updateLocal, updateCloud } = mergeProgress(local, cloud ? { data: cloud.data || {}, times: cloud.times || {} } : null);

    if (updateLocal.length) {
      const times = store.times();
      for (const k of updateLocal) { store.set(k, merged.data[k]); times[k] = merged.times[k]; }
      store.setTimes(times);
    }
    const now = Date.now();
    if (!cloud) {
      await F.setDoc(ref, { ageConfirmed: true, createdAt: now, updatedAt: now, data: merged.data, times: merged.times });
    } else if (updateCloud) {
      await F.setDoc(ref, { ageConfirmed: true, updatedAt: now, data: merged.data, times: merged.times }, { merge: true });
    }
    mergedOnce = true;
    state.syncing = false; state.lastSync = Date.now(); emit();

    // Games read their saves when the page loads, so reload once to show the account's progress.
    if (updateLocal.length && !onAccountPage) {
      let last = 0; try { last = +sessionStorage.getItem("bgd-reloaded") || 0; } catch (e) {}
      if (Date.now() - last > 15000) {
        try { sessionStorage.setItem("bgd-reloaded", String(Date.now())); } catch (e) {}
        location.reload();
      }
    }
  }

  async function push() {
    pushTimer = null;
    const user = auth.currentUser;
    if (!user || !mergedOnce || !pending.size) return;
    const keys = [...pending]; pending = new Set();
    const times = store.times(); const data = {}, t = {};
    for (const k of keys) {
      const v = store.get(k);
      data[k] = v === null ? F.deleteField() : v;
      t[k] = times[k] || Date.now();
    }
    state.syncing = true; emit();
    try {
      await F.setDoc(userDoc(user.uid), { ageConfirmed: true, updatedAt: Date.now(), data, times: t }, { merge: true });
      state.lastSync = Date.now(); state.error = null;
    } catch (e) {
      console.error("Sync failed", e); state.error = "Couldn't sync. Your progress is still saved on this device.";
      for (const k of keys) pending.add(k);
    }
    state.syncing = false; emit();
  }
  function schedulePush(delay) { if (pushTimer) clearTimeout(pushTimer); pushTimer = setTimeout(push, delay); }

  window.addEventListener("bgd-progress-changed", (e) => {
    const k = e.detail && e.detail.key;
    if (!k || !PATTERN.test(k)) return;
    pending.add(k);
    if (auth.currentUser) schedulePush(1500);
  });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden" && pending.size) push(); });
  account.syncNow = async () => { if (auth.currentUser) await pullAndMerge(auth.currentUser); };

  A.onAuthStateChanged(auth, async (user) => {
    state.user = user ? { uid: user.uid, name: user.displayName || "", email: user.email || "" } : null;
    state.ready = true; mergedOnce = false; emit();
    if (user) {
      try { await pullAndMerge(user); if (pending.size) schedulePush(500); }
      catch (e) { console.error(e); state.syncing = false; state.error = "Couldn't reach your account. Your progress is still saved on this device."; emit(); }
    }
  });
}

// ---- the small account button shown on every page ----
function mountPill() {
  if (!state.enabled || onAccountPage || document.getElementById("bgd-account-pill")) return;
  const pill = document.createElement("a");
  pill.id = "bgd-account-pill";
  pill.href = "/account.html";
  pill.style.cssText = "display:inline-flex;align-items:center;gap:7px;font:600 13px/1.2 system-ui,-apple-system,'Segoe UI',sans-serif;padding:6px 12px;border-radius:999px;border:1px solid rgba(128,128,128,.45);color:inherit;text-decoration:none;white-space:nowrap;opacity:.92";
  const dot = document.createElement("span");
  dot.style.cssText = "width:8px;height:8px;border-radius:50%;background:#9AA19D;flex:none";
  const label = document.createElement("span");
  pill.append(dot, label);

  const anchor = document.querySelector("a.home-link, a.back");
  if (anchor) {
    const row = document.createElement("div");
    row.style.cssText = "display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap";
    anchor.replaceWith(row);
    anchor.style.marginBottom = "0";
    row.append(anchor, pill);
  } else {
    const wrap = document.querySelector(".wrap") || document.body;
    const row = document.createElement("div");
    row.style.cssText = "display:flex;justify-content:flex-end";
    row.append(pill);
    wrap.prepend(row);
  }

  account.onChange((s) => {
    if (!s.ready) { label.textContent = "Account"; return; }
    if (!s.user) { label.textContent = "Sign in to save streaks"; dot.style.background = "#9AA19D"; return; }
    const who = s.user.name ? s.user.name.split(" ")[0] : "Account";
    if (s.error) { label.textContent = who + " · not synced"; dot.style.background = "#C38F22"; }
    else if (s.syncing) { label.textContent = who + " · syncing"; dot.style.background = "#C38F22"; }
    else { label.textContent = who + " · synced"; dot.style.background = "#3C7A4C"; }
  });
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountPill);
else mountPill();
