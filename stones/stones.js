/* Stones & Scripture: unlock readings by date, run the quiz, save scores, build the hub list.
   Scores are saved per reading under "ss-<date>" so player accounts sync them like the games. */
(function () {
  function today() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function shortDate(s) { var p = s.split("-").map(Number); return new Date(p[0], p[1] - 1, p[2]).toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
  function longDate(s) { var p = s.split("-").map(Number); return new Date(p[0], p[1] - 1, p[2]).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  var T = today();

  // ---------- a reading page ----------
  var main = document.querySelector("main[data-date]");
  if (main) {
    var date = main.dataset.date, key = "ss-" + date, total = +main.dataset.total;
    if (date > T) { document.getElementById("content").hidden = true; document.getElementById("locked").hidden = false; }
    var nl = document.querySelector(".next-link");
    if (nl && nl.dataset.date > T) { nl.hidden = true; document.querySelector(".next-soon").hidden = false; }

    var answerKey = JSON.parse(document.getElementById("answers").textContent);
    var quiz = document.getElementById("quiz"), btn = document.getElementById("check"), hint = document.getElementById("hint"), result = document.getElementById("result");
    var sets = Array.prototype.slice.call(quiz.querySelectorAll("fieldset.q"));
    var picks = {};

    function ready() { var n = Object.keys(picks).length; btn.disabled = n < total; hint.hidden = n >= total; }
    sets.forEach(function (fs) {
      fs.addEventListener("change", function (e) { if (e.target.name) { picks[fs.dataset.q] = +e.target.value; ready(); } });
    });

    function showGraded(saved) {
      quiz.classList.add("graded");
      sets.forEach(function (fs, qi) {
        var mine = saved.answers[qi], right = answerKey[qi].a;
        fs.querySelectorAll("input").forEach(function (inp) {
          var oi = +inp.value, lab = inp.closest(".opt");
          inp.checked = oi === mine; inp.disabled = true;
          lab.classList.toggle("correct", oi === right);
          lab.classList.toggle("wrong", oi === mine && oi !== right);
        });
        var ex = fs.querySelector(".explain");
        ex.textContent = "";
        var b = el("b", null, mine === right ? "Correct. " : "Answer: " + fs.querySelectorAll(".opt span")[right].textContent + ". ");
        ex.append(b, document.createTextNode(answerKey[qi].x || "")); ex.hidden = false;
      });
      result.textContent = "";
      var msg = saved.score === saved.total ? "Perfect score." : saved.score >= Math.ceil(saved.total * 0.6) ? "Nicely done." : "Read it once more and try again.";
      var again = el("button", "btn ghost", "Retake quiz"); again.type = "button";
      again.addEventListener("click", reset);
      result.append(el("span", "score", saved.score + " / " + saved.total), el("span", null, msg), again);
      result.hidden = false; btn.hidden = true; hint.hidden = true;
    }
    function reset() {
      quiz.classList.remove("graded"); picks = {};
      sets.forEach(function (fs) {
        fs.querySelectorAll("input").forEach(function (inp) { inp.checked = false; inp.disabled = false; inp.closest(".opt").classList.remove("correct", "wrong"); });
        fs.querySelector(".explain").hidden = true;
      });
      result.hidden = true; btn.hidden = false; ready();
      quiz.scrollIntoView({ block: "start" });
    }
    btn.addEventListener("click", function () {
      var score = 0, answers = {};
      sets.forEach(function (fs, qi) { answers[qi] = picks[qi]; if (picks[qi] === answerKey[qi].a) score++; });
      var saved = { score: score, total: total, answers: answers, at: new Date().toISOString() };
      set(key, saved);
      showGraded(saved);
      result.scrollIntoView({ block: "center" });
    });
    var prev = get(key);
    if (prev && prev.answers) showGraded(prev); else ready();
  }

  // ---------- the hub ----------
  var idxEl = document.getElementById("index");
  if (idxEl) {
    var all = JSON.parse(idxEl.textContent);
    var open = all.filter(function (a) { return a.date <= T; });
    var done = 0, pts = 0, tot = 0;
    open.forEach(function (a) { var s = get("ss-" + a.date); if (s && s.total) { done++; pts += s.score; tot += s.total; } });
    // day streak: readings in a row, counting back from today (or yesterday if today's isn't done yet)
    var streak = 0, byDate = {};
    open.forEach(function (a) { byDate[a.date] = !!get("ss-" + a.date); });
    var i = open.length - 1;
    if (i >= 0 && open[i].date === T && !byDate[T]) i--;
    for (; i >= 0 && byDate[open[i].date]; i--) streak++;
    var stats = document.getElementById("stats");
    [["Readings so far", open.length], ["Quizzes done", done], ["Average score", tot ? Math.round(pts / tot * 100) + "%" : "–"], ["Day streak", streak]].forEach(function (p) {
      var s = el("span", null, p[0] + " "); s.append(el("b", null, String(p[1]))); stats.append(s);
    });

    var todayCard = document.getElementById("today");
    if (!open.length) {
      document.getElementById("todayTitle").textContent = "The first reading opens soon";
      document.getElementById("todayDek").textContent = "Check back tomorrow.";
      todayCard.removeAttribute("href");
    } else {
      var cur = open[open.length - 1];
      todayCard.href = "/stones/" + cur.slug + ".html";
      document.getElementById("todayKicker").textContent = (cur.date === T ? "Today · " : "") + longDate(cur.date) + " · " + cur.kind + " · " + cur.min + " min read";
      document.getElementById("todayTitle").textContent = cur.title;
      document.getElementById("todayDek").textContent = cur.dek;
      var cs = get("ss-" + cur.date);
      if (cs) todayCard.querySelector(".go").textContent = "You scored " + cs.score + "/" + cs.total + ". Read it again →";
    }

    var list = document.getElementById("list");
    open.slice().reverse().forEach(function (a) {
      var s = get("ss-" + a.date);
      var li = el("li"), link = el("a"); link.href = "/stones/" + a.slug + ".html";
      var t = el("span", "t"); t.append(el("small", null, a.kind), document.createTextNode(a.title));
      link.append(el("span", "d", shortDate(a.date)), t, el("span", "chip" + (s ? " done" : ""), s ? s.score + "/" + s.total : "Not taken"));
      li.append(link); list.append(li);
    });
  }
})();
