"""Build the Stones & Scripture pages from stones/articles/*.json.

Run from the repo root:  python3 tools/build_stones.py
Writes:
  stones/<slug>.html   one page per reading (full text, quiz)
  stones/index.html    the hub: today's reading + every reading so far
  sitemap.xml          every page on the site, for search engines

Each reading JSON has: date (YYYY-MM-DD), kind, title, dek, scripture, labelTitle,
label [[name, value], ...], body [paragraphs; "## " starts a heading], sources [...],
quiz [{q, options [...], answer (index), explain}], readMinutes.
Readings unlock on their date (the player's local date); before that the page shows a "coming soon" note.
"""
import html, json, os, re, glob, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://biblegamesdaily.com"
E = html.escape

HEAD = """<!doctype html>
<html lang="en">
<head>
<script src="/sync-hook.js"></script>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{canonical}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:type" content="{ogtype}">
<meta property="og:url" content="{canonical}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Alegreya+SC:wght@700;800&family=Alegreya:ital,wght@0,400;0,700;1,400&family=Alegreya+Sans:wght@400;500;700&display=swap">
<link rel="stylesheet" href="/stones/stones.css">
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4288496976882487" crossorigin="anonymous"></script>
<meta name="google-adsense-account" content="ca-pub-4288496976882487">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
{extra}<script type="module" src="/account.js"></script>
</head>
<body>
<div class="wrap">
  <a class="home-link" href="/">← All games</a>
  <header class="mast">
    <a class="brand" href="/stones/"><b>Stones <span>&amp;</span> Scripture</b><small>Daily readings in Bible history</small></a>
    <nav><a href="/stones/"{cur_hub}>Today</a><a href="/stones/#all"{cur_all}>All readings</a></nav>
  </header>
"""

FOOT = """  <footer><span>Bible Games Daily</span><nav><a href="/about.html">About</a><a href="/contact.html">Contact</a><a href="/privacy.html">Privacy</a><a href="/account.html">Account</a></nav></footer>
</div>
<script src="/stones/stones.js"></script>
</body>
</html>
"""

def slugify(t):
    s = re.sub(r"[^a-z0-9]+", "-", t.lower().replace("'", "")).strip("-")
    return s[:60].rstrip("-")

def long_date(d):
    dt = datetime.date.fromisoformat(d)
    return dt.strftime("%A, %B ") + str(dt.day) + dt.strftime(", %Y")

def load():
    arts = []
    for f in sorted(glob.glob(os.path.join(ROOT, "stones/articles/*.json"))):
        a = json.load(open(f, encoding="utf-8"))
        a["slug"] = slugify(a["title"])
        arts.append(a)
    arts.sort(key=lambda a: a["date"])
    slugs = [a["slug"] for a in arts]
    assert len(set(slugs)) == len(slugs), "two readings have the same title"
    return arts

def article_page(a, prev, nxt):
    desc = a.get("dek") or a["title"]
    out = [HEAD.format(title=E(a["title"] + " · Stones & Scripture"), desc=E(desc), canonical=f"{SITE}/stones/{a['slug']}.html",
                       ogtype="article", extra="", cur_hub="", cur_all="")]
    out.append(f'  <main data-date="{a["date"]}" data-id="{a["date"]}" data-total="{len(a["quiz"])}">\n')
    out.append(f'    <div class="kicker"><span class="tag">{E(a["kind"])}</span><span>{long_date(a["date"])}</span><span>{a.get("readMinutes", 4)} min read</span></div>\n')
    out.append(f'    <h1>{E(a["title"])}</h1>\n')
    out.append(f'    <div class="locked" id="locked" hidden><p><b>This reading opens on {long_date(a["date"])}.</b> Come back that day to read it and take the quiz.</p><p><a href="/stones/">Go to today\'s reading</a></p></div>\n')
    out.append('    <div id="content">\n')
    if a.get("dek"): out.append(f'    <p class="dek">{E(a["dek"])}</p>\n')
    if a.get("scripture"): out.append(f'    <p class="refs">Read alongside: {E(a["scripture"])}</p>\n')
    if a.get("label"):
        out.append(f'    <dl class="label"><div class="lh">{E(a.get("labelTitle") or "At a glance")}</div>')
        for k, v in a["label"]:
            out.append(f'<dt>{E(k)}</dt><dd>{E(v)}</dd>')
        out.append('</dl>\n')
    out.append('    <article class="body">\n')
    for p in a["body"]:
        out.append(f'      <h2>{E(p[3:])}</h2>\n' if p.startswith("## ") else f'      <p>{E(p)}</p>\n')
    out.append('    </article>\n')
    if a.get("sources"):
        out.append('    <div class="sources"><b>Sources &amp; further reading</b><ul>' + "".join(f"<li>{E(s)}</li>" for s in a["sources"]) + '</ul></div>\n')
    # quiz: answers live in a data block so the page can grade without a server
    out.append('    <section class="quiz" id="quiz">\n      <h2>Quick quiz</h2>\n')
    out.append(f'      <p class="sub">{len(a["quiz"])} questions on this reading. Pick an answer for each, then check your score.</p>\n')
    out.append('      <div class="result" id="result" hidden></div>\n')
    for qi, q in enumerate(a["quiz"]):
        out.append(f'      <fieldset class="q" data-q="{qi}"><legend><span class="n">{qi+1:02d}</span><span>{E(q["q"])}</span></legend>\n')
        for oi, o in enumerate(q["options"]):
            iid = f"q{qi}o{oi}"
            out.append(f'        <label class="opt" for="{iid}"><input type="radio" name="q{qi}" id="{iid}" value="{oi}"><span>{E(o)}</span></label>\n')
        out.append('        <p class="explain" hidden></p>\n      </fieldset>\n')
    out.append('      <button class="btn" id="check" type="button" disabled>Check my answers</button>\n')
    out.append(f'      <p class="hint" id="hint">Answer all {len(a["quiz"])} questions to check your score.</p>\n    </section>\n')
    key = [{"a": q["answer"], "x": q.get("explain", "")} for q in a["quiz"]]
    out.append('    <script type="application/json" id="answers">' + json.dumps(key, ensure_ascii=False).replace("</", "<\\/") + '</script>\n')
    out.append('    </div>\n')
    out.append('    <nav class="pager">')
    out.append(f'<a href="/stones/{prev["slug"]}.html">← {E(prev["title"])}</a>' if prev else '<span></span>')
    if nxt:
        out.append(f'<a href="/stones/{nxt["slug"]}.html" data-date="{nxt["date"]}" class="next-link">{E(nxt["title"])} →</a><span class="next-soon" hidden>The next reading opens tomorrow.</span>')
    else:
        out.append('<span>The next reading opens soon.</span>')
    out.append('</nav>\n  </main>\n')
    out.append(FOOT)
    return "".join(out)

def hub_page(arts):
    index = [{"date": a["date"], "slug": a["slug"], "title": a["title"], "kind": a["kind"], "dek": a.get("dek", ""), "total": len(a["quiz"]), "min": a.get("readMinutes", 4), "label": a.get("label", [])[:3]} for a in arts]
    extra = '<script type="application/json" id="index">' + json.dumps(index, ensure_ascii=False).replace("</", "<\\/") + '</script>\n'
    out = [HEAD.format(title="Stones &amp; Scripture · Daily Bible History Readings", desc="A short daily reading on Bible history and archaeology, with a five-question quiz. Free from Bible Games Daily.",
                       canonical=f"{SITE}/stones/", ogtype="website", extra=extra, cur_hub=' aria-current="page"', cur_all="")]
    out.append('  <main id="hub">\n')
    out.append('    <div class="stats" id="stats"></div>\n')
    out.append('    <a class="today" id="today" href="#"><span class="kicker" id="todayKicker"></span><h2 id="todayTitle">Today\'s reading</h2><p id="todayDek"></p><span class="go">Read and take the quiz →</span></a>\n')
    out.append('    <h2 class="section-h" id="all">ALL READINGS</h2>\n    <ol class="list" id="list"></ol>\n')
    # links for search engines and for anyone without scripts
    out.append('    <noscript><ul>' + "".join(f'<li><a href="/stones/{a["slug"]}.html">{E(a["title"])}</a></li>' for a in arts) + '</ul></noscript>\n')
    out.append('  </main>\n')
    out.append(FOOT)
    return "".join(out)

def sitemap(arts):
    today = datetime.date.today().isoformat()
    pages = ["/", "/daily-verse-quest.html", "/cross-reference.html", "/bible-crossword.html", "/build-a-figure.html", "/stones/", "/about.html", "/contact.html", "/privacy.html"]
    urls = [f"  <url><loc>{SITE}{p}</loc></url>" for p in pages]
    urls += [f"  <url><loc>{SITE}/stones/{a['slug']}.html</loc><lastmod>{a['date']}</lastmod></url>" for a in arts]
    return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "\n".join(urls) + "\n</urlset>\n"

def main():
    arts = load()
    keep = {a["slug"] + ".html" for a in arts} | {"index.html"}
    for f in glob.glob(os.path.join(ROOT, "stones/*.html")):
        if os.path.basename(f) not in keep: os.remove(f)
    for i, a in enumerate(arts):
        page = article_page(a, arts[i - 1] if i else None, arts[i + 1] if i + 1 < len(arts) else None)
        open(os.path.join(ROOT, "stones", a["slug"] + ".html"), "w", encoding="utf-8").write(page)
    open(os.path.join(ROOT, "stones/index.html"), "w", encoding="utf-8").write(hub_page(arts))
    open(os.path.join(ROOT, "sitemap.xml"), "w", encoding="utf-8").write(sitemap(arts))
    print(f"built {len(arts)} readings, {arts[0]['date']} to {arts[-1]['date']}")

if __name__ == "__main__":
    main()
