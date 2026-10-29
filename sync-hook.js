/* Bible Games Daily: records when game progress changes, so accounts can sync it.
   Loaded as a plain script in <head>, before any game code runs.
   It only notes the time of each save; it never changes what the games store. */
(function () {
  var PATTERN = /^(vu-|versle-|ss-)/;
  var META = "bgd-sync-times";
  var ls;
  try { ls = window.localStorage; } catch (e) { return; }
  if (!ls || !window.Storage) return;

  var proto = Storage.prototype;
  var rawGet = proto.getItem, rawSet = proto.setItem, rawRemove = proto.removeItem;

  // Saves made while the page is still starting up are the game restoring itself,
  // not the player doing something, so they keep their old timestamp.
  var booting = true;
  function endBoot() { setTimeout(function () { booting = false; }, 0); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", endBoot);
  else endBoot();

  function readTimes() { try { return JSON.parse(rawGet.call(ls, META) || "{}") || {}; } catch (e) { return {}; } }
  function writeTimes(t) { try { rawSet.call(ls, META, JSON.stringify(t)); } catch (e) {} }

  function stamp(key) {
    var t = readTimes();
    if (booting) { if (!t[key]) t[key] = 1; }
    else t[key] = Date.now();
    writeTimes(t);
    if (!booting) {
      try { window.dispatchEvent(new CustomEvent("bgd-progress-changed", { detail: { key: key } })); } catch (e) {}
    }
  }

  proto.setItem = function (k, v) {
    rawSet.call(this, k, v);
    if (this === ls && PATTERN.test(String(k))) stamp(String(k));
  };
  proto.removeItem = function (k) {
    rawRemove.call(this, k);
    if (this === ls && PATTERN.test(String(k))) stamp(String(k));
  };

  // Used by the account code to apply progress from the cloud without re-stamping it.
  window.__bgdStore = {
    pattern: PATTERN,
    get: function (k) { return rawGet.call(ls, k); },
    set: function (k, v) { rawSet.call(ls, k, v); },
    times: readTimes,
    setTimes: writeTimes
  };
})();
