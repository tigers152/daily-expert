# Daily Expert

A Duolingo-style learning app for power and utilities, oil and gas, data centers, and world history. It runs as a home-screen app on iPhone: full screen, works offline, no App Store.

**Live app:** https://tigers152.github.io/daily-expert/

## Put it on your iPhone

1. Open the link above in **Safari**
2. Tap **Share**, then **Add to Home Screen**, then **Add**
3. Open Daily Expert from your Home Screen

Install before you start playing. The Home Screen app keeps its own progress, separate from Safari. Use Profile > Back up progress to move progress between devices.

## What's in it

- **Learn:** a path per track, 3 units x 4 lessons, plus a boss checkpoint per unit (3 hearts)
- **Exercise types:** concept cards, multiple choice, true/false, fill in the blank, put in order, match pairs
- **Swipe:** a vertical feed of facts and quick questions, built to replace scrolling
- **Practice:** daily quests and a chest, a 60-second Lightning Round, spaced review of fading items, track mixes
- **Me:** level, streaks, weekly XP chart, 15 badges, settings, backup and restore
- **Game loop:** combo XP, daily goal ring, streaks with freezes, missed questions come back until you get them right

## Project layout

```
index.html               app shell
css/app.css              all styles
js/app.js                tabs, path, swipe feed, practice, profile, onboarding
js/session.js            lesson / review / checkpoint runner, Lightning Round, result screens
js/state.js              progress, XP, streaks, spaced repetition, quests, badges (localStorage)
js/fx.js                 sound, haptics, confetti, sheets, icons
js/content/*.js          lesson content, one file per track
sw.js                    offline cache (bump VERSION on every deploy)
tools/validate.mjs       content checker: node tools/validate.mjs
```

No build step. GitHub Pages serves the repo root from `main`.
