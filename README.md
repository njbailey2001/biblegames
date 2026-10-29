# Bible Games Daily

Live at **[biblegamesdaily.com](https://biblegamesdaily.com)**.

Free Bible games that run in the browser. No sign-up, no install.

| Game | What you do |
| --- | --- |
| [Daily Verse Quest](daily-verse-quest.html) | Read a verse and find its book, chapter and verse in five guesses. Daily Verse plus Unlimited (Easy and Hard). |
| [Cross Reference](cross-reference.html) | Find the hidden word from Scripture. Every guess gets a rank; the lower the number, the closer you are. |
| [Bible Crossword](bible-crossword.html) | A new 9×9 Bible crossword every day (NIV), with past puzzles to catch up on. |
| [Build-a-Figure](build-a-figure.html) | Spin seven biblical figures and draw one attribute from each to fuse the strongest figure you can. Solo or pass-and-play. |

## Daily reading

[Stones & Scripture](stones/) is a daily Bible history reading with a quiz. Readings live in `stones/articles/*.json`; run `python3 tools/build_stones.py` to rebuild the pages and `sitemap.xml` after adding or editing one.

## How it's built

Plain static HTML. Each game is one self-contained file, and `index.html` is the home page that links to them. There is no build step and no server code, so the folder can be hosted as-is on GitHub Pages, Netlify or Cloudflare Pages.

Game stats are saved in each player's own browser (localStorage).

## Adding a game

1. Add the game's `.html` file to this folder.
2. Give it an `← All games` link to `index.html`.
3. Add a card for it to the games shelf in `index.html`.
