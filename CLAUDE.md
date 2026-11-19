# Daily Expert: notes for Claude

Owner: Buck. Personal learning app, installed on his iPhone as a home-screen web app from GitHub Pages (https://tigers152.github.io/daily-expert/). Plain HTML/CSS/ES modules, no build step, no dependencies.

## Rules
- Writing rules for all lesson and UI text: no em dashes or en dashes, no AI or brochure language, direct and confident tone. `node tools/validate.mjs` fails on dashes.
- Only well-established facts in lessons. Work tracks (power, oil, dc) can carry an "At work" line tying the idea to procurement, materials management, or supply chain.
- **Every deploy: bump `VERSION` in `sw.js`** or phones keep the cached old build. If you add a file, add it to `ASSETS` in `sw.js`.
- Progress lives in localStorage key `dailyexpert.v2`. Never rename the key or reorder existing lessons/cards, since item ids are positional (`power-3.4` = track, lesson number, card index). Append new lessons or units at the end of a track.

## Content format (js/content/<track>.js)
Helpers in `dsl.js`: `learn(h, body, stat, statLabel, atWork)`, `mc(q, [correct, ...3 wrong], explain)`, `tf(q, bool, explain)`, `fill("text ___ text", [correct, ...wrong], explain)`, `match(prompt, [[left, right] x4])`, `order(prompt, [items in correct order])`. First option is always the correct one; the app shuffles. Each lesson: 2 learn cards + 5 questions. Each unit: 4 lessons. New track: add a file and register it in `content/index.js`.

## Test locally
`python3 -m http.server 8765` then open http://localhost:8765. On localhost `window.__deSess` exposes the running session for automated tests.

## Deploy
Commit to `main` and push. Pages rebuilds in about a minute.
