import {
  S, save, resetAll, exportCode, importCode, GOALS, STREAK_MIN, todayKey, dayNum, keyFromNum, todayXp, streakView,
  levelFor, levelBounds, dueItems, dueInLesson, lessonState, cpState, nextUp, lessonsDone, trackRank, quests,
  questsDone, claimChest, questEvent, checkBadges, srsGrade, addXp, BADGES, TRACKS, LESSONS, UNITS, ITEMS,
} from "./state.js";
import { trackById } from "./content/index.js";
import { $, $$, esc, shuffle, sfx, haptic, toast, sheet, confirmBox, ICON, confetti } from "./fx.js";
import { runSession, runLightning, rewardScreen, badgeScreen, celebrateStreakOnly } from "./session.js";

const app = $("#app");
let tab = "learn";
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const standalone = () => window.navigator.standalone === true || matchMedia("(display-mode: standalone)").matches;

/* ============================================================
   Shell
   ============================================================ */
function shell() {
  app.innerHTML = `
    <main id="screen"></main>
    <nav id="tabs">
      ${[["learn", "Learn", ICON.path], ["swipe", "Swipe", ICON.swipe], ["practice", "Practice", ICON.practice], ["me", "Me", ICON.me]]
        .map(([id, label, ic]) => `<button class="tab" data-tab="${id}">${ic}<span>${label}</span><i class="dot" hidden></i></button>`).join("")}
    </nav>`;
  $("#tabs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-tab]");
    if (!b) return;
    sfx.tap(); haptic();
    go(b.dataset.tab);
  });
  $("#screen").addEventListener("click", onScreenTap);
}

function go(t, opts = {}) {
  tab = t;
  $$("#tabs .tab").forEach((b) => b.classList.toggle("on", b.dataset.tab === t));
  const scr = $("#screen");
  scr.className = `scr-${t}`;
  if (feedObserver) { feedObserver.disconnect(); feedObserver = null; }
  ({ learn: vLearn, swipe: vSwipe, practice: vPractice, me: vMe })[t](scr, opts);
  updateDots();
}
const refresh = (opts) => go(tab, opts);

function updateDots() {
  const q = quests();
  const pdot = $('#tabs [data-tab="practice"] .dot');
  if (pdot) pdot.hidden = !((questsDone() && !q.claimed) || dueItems().length >= 5);
}

/* ---------- Shared header ---------- */
function ring(pct, size = 34, stroke = 4) {
  const r = (size - stroke) / 2, C = 2 * Math.PI * r;
  return `<svg class="ring-svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" class="ring-bg"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" class="ring-fg" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - Math.min(1, pct))}"/></svg>`;
}
function statusPills() {
  const sv = streakView();
  const tx = todayXp();
  const pct = tx / S.goal;
  return `<div class="pills">
    <button class="pill streak ${sv.today ? "lit" : sv.count ? "risk" : ""}" data-act="streakInfo"><span class="fl">🔥</span><b>${sv.count}</b></button>
    ${S.freezes ? `<span class="pill frz">🧊<b>${S.freezes}</b></span>` : ""}
    <button class="pill goal ${pct >= 1 ? "full" : ""}" data-act="goalInfo">${ring(pct)}<b>${Math.min(tx, 999)}</b></button>
  </div>`;
}

/* ============================================================
   LEARN: the path
   ============================================================ */
function vLearn(scr, opts) {
  const t = trackById(S.track);
  const sv = streakView();
  const nx = nextUp(t);
  let banner = "";
  if (isIOS && !standalone() && !S.flags.installDismissed) {
    banner = `<button class="banner install" data-act="install"><span>📲</span><div><b>Put Daily Expert on your Home Screen</b><small>Full screen, offline, one tap from your thumb</small></div></button>`;
  } else if (sv.count > 0 && !sv.today) {
    banner = `<button class="banner risk" data-act="quick"><span>🔥</span><div><b>Your ${sv.count} day streak is on the line</b><small>Earn ${STREAK_MIN} XP today to keep it. One lesson does it.</small></div></button>`;
  } else if (sv.lost) {
    banner = `<div class="banner lost"><span>🥶</span><div><b>Your ${sv.lost} day streak ended</b><small>Start a new one today. Day one starts now.</small></div></div>`;
  }

  let html = `<header class="topbar">
      <button class="trackchip" data-act="pickTrack" style="--c:${t.color}"><span class="ti">${t.icon}</span><span class="tn">${esc(t.short)}</span>${ICON.chevron}</button>
      ${statusPills()}${banner}
    </header>
    <section class="path" style="--c:${t.color};--d:${t.deep}">`;

  const offsets = [0, 62, 88, 62, 0, -62, -88, -62];
  let k = 0;
  t.units.forEach((u) => {
    const done = u.lessonIds.filter((id) => S.done[id]).length;
    const cps = cpState(u);
    const unitLocked = lessonState(LESSONS[u.lessonIds[0]]) === "locked";
    html += `<div class="unit-banner ${unitLocked ? "locked" : ""}">
        <div><small>Unit ${u.num}</small><h3>${esc(u.title)}</h3><p>${esc(u.sub)}</p></div>
        <div class="u-prog">${cps === "done" ? "🏆" : `${done}/${u.lessonIds.length}`}</div></div><div class="nodes">`;
    u.lessons.forEach((l) => {
      const st = lessonState(l);
      const isNext = nx && nx.kind === "lesson" && nx.item === l;
      const due = st === "done" ? dueInLesson(l.id).length : 0;
      const ic = st === "done" ? (due ? ICON.refresh : ICON.check) : st === "locked" ? ICON.lock : ICON.star;
      html += `<div class="node-row" style="--x:${offsets[k++ % offsets.length]}px">
        ${isNext ? `<div class="start-bubble">${S.stats.lessons ? "START" : "START HERE"}</div>` : ""}
        <button class="node ${st} ${isNext ? "current" : ""} ${due ? "fading" : ""}" data-act="node" data-id="${l.id}" aria-label="${esc(l.title)}">
          <span class="node-face">${ic}</span>${isNext ? `<span class="node-ring"></span>` : ""}
        </button>
        <span class="node-label">${esc(l.title)}</span></div>`;
    });
    const isNextCp = nx && nx.kind === "cp" && nx.item === u;
    html += `<div class="node-row" style="--x:${offsets[k++ % offsets.length]}px">
        ${isNextCp ? `<div class="start-bubble boss">BOSS</div>` : ""}
        <button class="node cp ${cps} ${isNextCp ? "current" : ""}" data-act="cp" data-id="${u.id}" aria-label="Unit ${u.num} checkpoint">
          <span class="node-face">${cps === "locked" ? ICON.lock : ICON.trophy}</span>${isNextCp ? `<span class="node-ring"></span>` : ""}
        </button><span class="node-label">Checkpoint</span></div></div>`;
  });
  if (!nx) html += `<div class="track-done"><div>👑</div><h3>${esc(t.name)} complete</h3><p>You finished every lesson and checkpoint. Keep it sharp in Practice and Swipe, or start another track.</p><button class="btn primary" data-act="pickTrack">Pick another track</button></div>`;
  html += `</section><div class="path-end"></div>`;
  scr.innerHTML = html;
  const cur = $(".node.current", scr);
  if (cur && !opts.keepScroll) requestAnimationFrame(() => cur.scrollIntoView({ block: "center", behavior: opts.smooth ? "smooth" : "auto" }));
}

function lessonSheet(l) {
  const st = lessonState(l);
  const t = l.track;
  const due = dueInLesson(l.id);
  const qn = l.cards.filter((c) => c.t !== "learn").length;
  let body;
  if (st === "locked") {
    body = `<p class="sh-body">Finish the lesson before this one to unlock it${l.unit.num > 1 && l === l.unit.lessons[0] ? ", and clear the previous unit's checkpoint" : ""}.</p>
      <button class="btn ghost big" disabled>${ICON.lock} Locked</button>`;
  } else if (st === "done") {
    const d = S.done[l.id];
    body = `<p class="sh-body">${d.perfect ? "💎 Finished with zero mistakes." : `Finished with ${d.acc}% accuracy.`} ${due.length ? `${due.length} item${due.length > 1 ? "s are" : " is"} fading and due for review.` : "Memory is fresh."}</p>
      ${due.length ? `<button class="btn primary big" data-go="refresh">Refresh ${due.length} item${due.length > 1 ? "s" : ""}</button>` : ""}
      <button class="btn ${due.length ? "ghost" : "primary"} big" data-go="lesson">Replay lesson</button>`;
  } else {
    body = `<p class="sh-body">${l.cards.length - qn} quick reads, ${qn} questions. About 3 minutes.</p>
      <button class="btn primary big" data-go="lesson">Start  <span class="xp-tag">+15 XP</span></button>`;
  }
  const s = sheet(`<div class="lsheet" style="--c:${t.color};--d:${t.deep}">
      <div class="ls-top"><span class="ls-icon">${t.icon}</span><small>Unit ${l.unit.num} · Lesson ${l.num} of ${t.lessonIds.length}</small></div>
      <h3 class="sh-title">${esc(l.title)}</h3>${body}</div>`);
  s.el.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-go]");
    if (!b) return;
    sfx.tap(); haptic();
    s.close();
    if (b.dataset.go === "lesson") await playLesson(l);
    else await playReview(due, t);
  });
}

function cpSheet(u) {
  const st = cpState(u);
  const t = u.track;
  const isLast = u.num === t.units.length;
  const body = st === "locked"
    ? `<p class="sh-body">Finish all ${u.lessonIds.length} lessons in this unit to face the checkpoint.</p><button class="btn ghost big" disabled>${ICON.lock} Locked</button>`
    : `<p class="sh-body">10 questions pulled from the whole unit. You get 3 hearts. ${st === "done" ? "You already cleared it, but a rematch keeps it sharp." : isLast ? "Clear it to finish the track." : `Clear it to unlock Unit ${u.num + 1}.`}</p>
       <button class="btn primary big" data-go>${st === "done" ? "Rematch" : "Take the checkpoint"} <span class="xp-tag">+20 XP</span></button>`;
  const s = sheet(`<div class="lsheet" style="--c:${t.color};--d:${t.deep}">
    <div class="ls-top"><span class="ls-icon">🏆</span><small>Unit ${u.num} checkpoint</small></div>
    <h3 class="sh-title">${esc(u.title)}</h3>${body}</div>`);
  s.el.addEventListener("click", async (e) => {
    if (!e.target.closest("[data-go]")) return;
    s.close();
    await playCheckpoint(u);
  });
}

function trackPicker() {
  const s = sheet(`<h3 class="sh-title">Choose a track</h3><div class="tp-list">${TRACKS.map((t) => {
    const d = lessonsDone(t), n = t.lessonIds.length;
    return `<button class="tp ${t.id === S.track ? "on" : ""}" data-t="${t.id}" style="--c:${t.color};--d:${t.deep}">
      <span class="tp-ic">${t.icon}</span>
      <span class="tp-txt"><b>${esc(t.name)}</b><small>${esc(t.tagline)}</small>
      <span class="bar"><i style="width:${(d / n) * 100}%"></i></span></span>
      <span class="tp-rank">${trackRank(t)}<small>${d}/${n}</small></span></button>`;
  }).join("")}</div>`);
  s.el.addEventListener("click", (e) => {
    const b = e.target.closest("[data-t]");
    if (!b) return;
    S.track = b.dataset.t;
    save();
    sfx.tap(); haptic();
    s.close();
    go("learn");
  });
}

async function afterSession(r) {
  updateDots();
  if (tab === "learn") go("learn", { smooth: true });
  else refresh({ keepScroll: true });
  return r;
}
async function playLesson(l) {
  const r = await runSession({ mode: "lesson", lesson: l, track: l.track });
  return afterSession(r);
}
async function playCheckpoint(u) {
  let r;
  do r = await runSession({ mode: "checkpoint", unit: u, track: u.track, lessonsById: LESSONS });
  while (r.retry);
  return afterSession(r);
}
async function playReview(ids, t) {
  if (!ids.length) return;
  const track = t || ITEMS[ids[0]].track;
  const r = await runSession({ mode: "review", ids, track });
  return afterSession(r);
}

/* ============================================================
   SWIPE: the scroll replacement
   ============================================================ */
let feedObserver = null;
let feedFilter = "all";
let feedSeen = new Set();
const feedState = { combo: 0 };

function feedPool() {
  const tracks = feedFilter === "all" ? TRACKS : [trackById(feedFilter)];
  const facts = [], quiz = [];
  for (const t of tracks) {
    for (const id of t.lessonIds) {
      const l = LESSONS[id];
      const st = lessonState(l);
      const w = st === "done" ? 3 : st === "open" ? 2 : 1;
      for (const c of l.cards) {
        if (c.t === "learn") facts.push({ c, w });
        else if ((c.t === "mc" || c.t === "tf") && (st !== "locked" || Math.random() < 0.35)) quiz.push({ c, w: st === "done" ? 3 : 1 });
      }
    }
  }
  return { facts, quiz };
}
function weightedPick(arr) {
  const avail = arr.filter((x) => !feedSeen.has(x.c.id));
  const src = avail.length ? avail : arr;
  if (!avail.length) arr.forEach((x) => feedSeen.delete(x.c.id));
  const total = src.reduce((a, x) => a + x.w, 0);
  let r = Math.random() * total;
  for (const x of src) { r -= x.w; if (r <= 0) return x.c; }
  return src[src.length - 1].c;
}
function feedBatch(n = 10) {
  const { facts, quiz } = feedPool();
  const due = shuffle(dueItems().map((id) => ITEMS[id]).filter((c) => (c.t === "mc" || c.t === "tf") && (feedFilter === "all" || c.track.id === feedFilter) && !feedSeen.has(c.id)));
  const out = [];
  for (let i = 0; i < n; i++) {
    let c;
    if (due.length && i % 3 === 1) c = due.pop();
    else if (quiz.length && (i % 2 === 1)) c = weightedPick(quiz);
    else c = weightedPick(facts);
    feedSeen.add(c.id);
    out.push(c);
  }
  return out;
}
function feedCardHtml(c) {
  const t = c.track, l = c.lesson;
  const head = `<div class="f-top"><span class="f-chip">${t.icon} ${esc(t.short)}</span><span class="f-from">${esc(l.title)}</span></div>`;
  if (c.t === "learn") {
    return `<article class="fcard fact" data-id="${c.id}" style="--c:${t.color};--d:${t.deep}">${head}
      <div class="f-main">${c.stat ? `<div class="f-stat">${esc(c.stat)}</div><div class="f-label">${esc(c.label || "")}</div>` : ""}
      <h2>${esc(c.h)}</h2><p>${esc(c.b)}</p>${c.w ? `<div class="atwork"><b>At work</b><span>${esc(c.w)}</span></div>` : ""}</div>
      <div class="f-foot">Swipe up</div></article>`;
  }
  const opts = c.t === "tf" ? [["True", c.a], ["False", !c.a]] : shuffle(c.o.map((o, i) => [o, i === 0]));
  return `<article class="fcard quiz" data-id="${c.id}" style="--c:${t.color};--d:${t.deep}">${head}
    <div class="f-main"><div class="q-kind">${c.t === "tf" ? "True or false?" : "Quick check"}</div><h2>${esc(c.q)}</h2>
    <div class="fopts ${c.t === "tf" ? "two" : ""}">${opts.map(([o, ok]) => `<button class="fopt" data-fans="${ok ? 1 : 0}">${esc(o)}</button>`).join("")}</div>
    <div class="freveal"></div></div><div class="f-foot">Answer, then swipe</div></article>`;
}
// First card in a fresh feed comes from the track you are working on.
function openerCard() {
  const t = trackById(feedFilter === "all" ? S.track : feedFilter);
  const cands = t.lessonIds.map((id) => LESSONS[id]).filter((l) => lessonState(l) !== "locked")
    .flatMap((l) => l.cards.filter((c) => c.t === "learn" && !feedSeen.has(c.id)));
  return cands.length ? cands[Math.floor(Math.random() * cands.length)] : null;
}
function vSwipe(scr) {
  const chips = [["all", "All"], ...TRACKS.map((t) => [t.id, `${t.icon} ${t.short}`])];
  const opener = openerCard();
  if (opener) feedSeen.add(opener.id);
  const firstCards = [...(opener ? [opener] : []), ...feedBatch(opener ? 7 : 8)];
  scr.innerHTML = `<div class="feed-top"><div class="feed-chips">${chips.map(([id, lbl]) => `<button class="fchip ${feedFilter === id ? "on" : ""}" data-filter="${id}">${lbl}</button>`).join("")}</div>
    <div class="feed-count">📵 <b>${S.stats.swipes}</b></div></div>
    <div class="feed" id="feed">${firstCards.map(feedCardHtml).join("")}</div>
    ${S.flags.swipeHint ? "" : `<div class="swipe-hint"><div class="hand">👆</div><b>Swipe up</b><span>Every swipe teaches you something</span></div>`}`;
  const feed = $("#feed", scr);
  feedObserver = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      const el = en.target;
      if (!el.dataset.counted) {
        el.dataset.counted = "1";
        if (el !== feed.firstElementChild || feed.scrollTop > 10) {
          S.stats.swipes++;
          questEvent("swipe", 1);
          const fc = $(".feed-count b", scr);
          if (fc) fc.textContent = S.stats.swipes;
          if (!S.flags.swipeHint) { S.flags.swipeHint = true; $(".swipe-hint", scr)?.remove(); }
          const nb = checkBadges();
          save();
          nb.forEach((b) => toast(`${b.icon} <b>${esc(b.name)}</b> unlocked`));
        }
      }
      const cards = [...feed.children];
      if (cards.indexOf(el) >= cards.length - 3) {
        feed.insertAdjacentHTML("beforeend", feedBatch(8).map(feedCardHtml).join(""));
        [...feed.children].slice(cards.length).forEach((x) => feedObserver.observe(x));
        while (feed.children.length > 40) { const first = feed.firstElementChild; const h = first.offsetHeight; first.remove(); feed.scrollTop -= h; }
      }
    }
  }, { root: feed, threshold: 0.6 });
  [...feed.children].forEach((x) => feedObserver.observe(x));
}
function feedAnswer(btn) {
  const card = btn.closest(".fcard");
  if (card.dataset.answered) return;
  card.dataset.answered = "1";
  const ok = btn.dataset.fans === "1";
  const c = ITEMS[card.dataset.id];
  $$(".fopt", card).forEach((b) => { b.disabled = true; if (b.dataset.fans === "1") b.classList.add("ok"); });
  if (!ok) btn.classList.add("bad");
  const rv = $(".freveal", card);
  if (ok) {
    feedState.combo++;
    const g = feedState.combo >= 5 ? 2 : 1;
    const r = addXp(g, c.track.id);
    questEvent("combo", feedState.combo);
    S.stats.bestCombo = Math.max(S.stats.bestCombo, feedState.combo);
    sfx.good();
    rv.innerHTML = `<b class="okc">Correct${feedState.combo >= 3 ? ` · 🔥 ${feedState.combo}` : ""}</b> <span class="xpp">+${g} XP</span>${c.x ? `<p>${esc(c.x)}</p>` : ""}`;
    if (r.streakUp) setTimeout(() => celebrateStreakOnly().then(() => refreshPills()), 500);
    else if (r.goalHit) toast("🎯 <b>Daily goal reached</b>");
  } else {
    feedState.combo = 0;
    sfx.bad();
    rv.innerHTML = `<b class="badc">Not quite.</b>${c.x ? `<p>${esc(c.x)}</p>` : ""}`;
  }
  if (S.srs[c.id]) srsGrade(c.id, ok);
  S.stats.answered++;
  if (ok) S.stats.correct++;
  haptic();
  save();
}
function refreshPills() { const p = $(".pills"); if (p) p.outerHTML = statusPills(); }

/* ============================================================
   PRACTICE
   ============================================================ */
function vPractice(scr) {
  const q = quests();
  const allDone = questsDone();
  const due = dueItems();
  const qhtml = q.list.map((x) => {
    const p = Math.min(1, x.prog / x.goal);
    return `<div class="quest ${p >= 1 ? "done" : ""}"><div class="q-ic">${p >= 1 ? ICON.check : questIcon(x.id)}</div>
      <div class="q-main"><b>${esc(x.text)}</b><div class="bar"><i style="width:${p * 100}%"></i><span>${Math.min(x.prog, x.goal)} / ${x.goal}</span></div></div></div>`;
  }).join("");
  const chest = q.claimed
    ? `<div class="chest claimed">🎁 Chest collected. New quests at midnight.</div>`
    : `<button class="chest ${allDone ? "ready" : ""}" data-act="chest" ${allDone ? "" : "disabled"}><span class="ch-ic">🎁</span><span><b>${allDone ? "Open your chest" : "Daily chest"}</b><small>${allDone ? "Tap to collect" : "Finish all 3 quests"}: +25 XP${S.freezes < 2 ? " and a streak freeze" : ""}</small></span></button>`;
  const hrs = 24 - new Date().getHours();
  scr.innerHTML = `<header class="topbar plain"><h1>Practice</h1>${statusPills()}</header>
    <section class="card quests"><div class="card-h"><h3>Daily quests</h3><small>${hrs}h left</small></div>${qhtml}${chest}</section>
    <button class="card big-action lightning" data-act="lightning">
      <div class="ba-ic">⚡</div><div class="ba-txt"><b>Lightning Round</b><small>60 seconds. Tap fast. Best: ${S.stats.speedBest}</small></div><span class="ba-go">Play</span></button>
    <button class="card big-action review ${due.length ? "" : "empty"}" data-act="review" ${due.length ? "" : "disabled"}>
      <div class="ba-ic">🧠</div><div class="ba-txt"><b>${due.length ? `Strengthen ${Math.min(10, due.length)} memories` : "Nothing fading yet"}</b>
      <small>${due.length ? `${due.length} item${due.length > 1 ? "s" : ""} due. Spaced review locks them in.` : "Finish lessons and items you missed come back here on a schedule."}</small></div>${due.length ? `<span class="ba-go">Go</span>` : ""}</button>
    <section class="card mix"><div class="card-h"><h3>Quick mix by track</h3></div><div class="mix-grid">${TRACKS.map((t) => {
      const n = t.lessonIds.filter((id) => S.done[id]).length;
      return `<button class="mixb" data-act="mix" data-t="${t.id}" style="--c:${t.color};--d:${t.deep}" ${n ? "" : "disabled"}><span>${t.icon}</span><b>${esc(t.short)}</b><small>${n ? "10 from your lessons" : "Finish a lesson first"}</small></button>`;
    }).join("")}</div></section>`;
}
const questIcon = (id) => ({ xp: "⭐", combo: "🔥", lesson: "📘", perfect: "💎", swipe: "📵", speed: "⚡", review: "🧠" }[id] || "⭐");

function lightningPool() {
  const learned = Object.values(ITEMS).filter((c) => S.done[c.lesson.id] && c.t !== "match" && c.t !== "order");
  if (learned.length >= 20) return learned;
  const extra = Object.values(ITEMS).filter((c) => c.t !== "match" && c.t !== "order" && lessonState(c.lesson) !== "locked");
  const firsts = TRACKS.flatMap((t) => t.lessonIds.slice(0, 2)).flatMap((id) => LESSONS[id].cards.filter((c) => c.t !== "learn" && c.t !== "match" && c.t !== "order"));
  return [...new Set([...learned, ...extra, ...firsts])];
}
async function playLightning() {
  let r;
  do r = await runLightning(lightningPool(), (c) => c.track);
  while (r.again);
  afterSession(r);
}

/* ============================================================
   ME
   ============================================================ */
function vMe(scr) {
  const L = levelFor(S.xp);
  const [lo, hi] = levelBounds(L);
  const sv = streakView();
  const t = dayNum();
  const week = [];
  for (let k = 6; k >= 0; k--) {
    const key = keyFromNum(t - k);
    week.push({ key, xp: S.days[key] || 0, label: "SMTWTFS"[new Date(key + "T12:00:00").getDay()], today: k === 0 });
  }
  const max = Math.max(S.goal, ...week.map((w) => w.xp));
  const acc = S.stats.answered ? Math.round((S.stats.correct / S.stats.answered) * 100) : 0;
  const weekXp = week.reduce((a, w) => a + w.xp, 0);
  scr.innerHTML = `<header class="topbar plain"><h1>Profile</h1>${statusPills()}</header>
    <section class="card hero-me">
      <div class="lvl-badge"><small>LVL</small><b>${L}</b></div>
      <div class="lvl-main"><b>${S.xp.toLocaleString()} XP</b><small>${(hi - S.xp).toLocaleString()} XP to level ${L + 1}</small>
      <div class="bar"><i style="width:${((S.xp - lo) / (hi - lo)) * 100}%"></i></div></div>
    </section>
    <section class="stat-grid">
      <div class="stat"><span>🔥</span><b>${sv.count}</b><small>Day streak</small></div>
      <div class="stat"><span>🏅</span><b>${S.bestStreak}</b><small>Best streak</small></div>
      <div class="stat"><span>📘</span><b>${Object.keys(S.done).length}</b><small>Lessons</small></div>
      <div class="stat"><span>🎯</span><b>${acc}%</b><small>Accuracy</small></div>
      <div class="stat"><span>⚡</span><b>${S.stats.speedBest}</b><small>Lightning best</small></div>
      <div class="stat"><span>📵</span><b>${S.stats.swipes}</b><small>Cards swiped</small></div>
    </section>
    <section class="card"><div class="card-h"><h3>This week</h3><small>${weekXp} XP</small></div>
      <div class="chart"><div class="bars">${week.map((w) => `<div class="col ${w.today ? "today" : ""} ${w.xp >= S.goal ? "hit" : ""}"><span class="v">${w.xp || ""}</span><i style="height:${Math.max(3, (w.xp / max) * 100)}%"></i></div>`).join("")}
      <div class="goal-line" style="bottom:${(S.goal / max) * 100}%"><span>Goal ${S.goal}</span></div></div>
      <div class="labels">${week.map((w) => `<small class="${w.today ? "today" : ""}">${w.label}</small>`).join("")}</div></div></section>
    <section class="card"><div class="card-h"><h3>Tracks</h3></div>${TRACKS.map((tr) => {
      const d = lessonsDone(tr), n = tr.lessonIds.length;
      return `<div class="trk" style="--c:${tr.color};--d:${tr.deep}"><span class="tp-ic">${tr.icon}</span><div class="trk-main"><b>${esc(tr.name)}</b>
        <div class="bar"><i style="width:${(d / n) * 100}%"></i></div></div><div class="trk-r"><b>${trackRank(tr)}</b><small>${S.trackXp[tr.id] || 0} XP</small></div></div>`;
    }).join("")}</section>
    <section class="card"><div class="card-h"><h3>Badges</h3><small>${Object.keys(S.badges).length} of ${BADGES.length}</small></div>
      <div class="badges">${BADGES.map((b) => `<button class="badge ${S.badges[b.id] ? "got" : ""}" data-badge="${b.id}"><span>${b.icon}</span><small>${esc(b.name)}</small></button>`).join("")}</div></section>
    <section class="card settings"><div class="card-h"><h3>Settings</h3></div>
      <div class="set-row"><span>Daily goal</span><div class="seg">${GOALS.map((g) => `<button class="${S.goal === g.xp ? "on" : ""}" data-goal="${g.xp}">${g.xp}</button>`).join("")}</div></div>
      <div class="set-row"><span>Sound effects</span><button class="toggle ${S.sound ? "on" : ""}" data-toggle="sound"><i></i></button></div>
      <div class="set-row"><span>Haptics</span><button class="toggle ${S.haptics ? "on" : ""}" data-toggle="haptics"><i></i></button></div>
      <button class="set-link" data-act="install">📲 Install on your Home Screen</button>
      <button class="set-link" data-act="backup">💾 Back up progress</button>
      <button class="set-link" data-act="restore">♻️ Restore from a backup</button>
      <button class="set-link danger" data-act="reset">Reset all progress</button>
    </section>
    <p class="foot-note">Daily Expert · progress is saved on this device</p>`;
}

/* ============================================================
   Screen taps
   ============================================================ */
async function onScreenTap(e) {
  const b = e.target.closest("button");
  if (!b) return;
  const act = b.dataset.act;
  if (b.classList.contains("fopt")) return feedAnswer(b);
  if (b.dataset.filter) { feedFilter = b.dataset.filter; feedSeen = new Set(); sfx.tap(); return go("swipe"); }
  if (b.dataset.goal) { S.goal = +b.dataset.goal; const q = quests(); const xq = q.list.find((x) => x.id === "xp"); if (xq) { xq.goal = S.goal; xq.text = `Earn ${S.goal} XP`; } save(); sfx.tap(); return refresh({ keepScroll: true }); }
  if (b.dataset.toggle) { S[b.dataset.toggle] = !S[b.dataset.toggle]; save(); b.classList.toggle("on"); sfx.tap(); haptic(); return; }
  if (b.dataset.badge) {
    const bd = BADGES.find((x) => x.id === b.dataset.badge);
    const got = S.badges[bd.id];
    sheet(`<div class="badge-detail ${got ? "got" : ""}"><div class="bd-ic">${bd.icon}</div><h3 class="sh-title">${esc(bd.name)}</h3><p class="sh-body">${esc(bd.desc)}${got ? `<br><small>Earned ${got}</small>` : ""}</p></div>`);
    return;
  }
  if (!act) return;
  sfx.tap(); haptic();
  switch (act) {
    case "node": return lessonSheet(LESSONS[b.dataset.id]);
    case "cp": return cpSheet(UNITS[b.dataset.id]);
    case "pickTrack": return trackPicker();
    case "quick": {
      const nx = nextUp(trackById(S.track));
      if (nx && nx.kind === "lesson") return playLesson(nx.item);
      if (nx) return playCheckpoint(nx.item);
      return playLightning();
    }
    case "streakInfo": {
      const sv = streakView();
      sheet(`<div class="info-sheet"><div class="big">🔥</div><h3 class="sh-title">${sv.count} day streak</h3>
        <p class="sh-body">${sv.today ? "Today is locked in. See you tomorrow." : `Earn ${STREAK_MIN} XP today to ${sv.count ? "keep it going" : "start one"}. A lesson, a Lightning Round, or a few right answers in Swipe all count.`}</p>
        <p class="sh-body">🧊 Streak freezes: <b>${S.freezes}</b> of 2. Open the daily chest to earn one. A missed day uses a freeze automatically.</p>
        <p class="sh-body">Best ever: <b>${S.bestStreak}</b> days.</p></div>`);
      return;
    }
    case "goalInfo": {
      const tx = todayXp();
      sheet(`<div class="info-sheet"><div class="big-ring">${ring(tx / S.goal, 96, 10)}<b>${tx}</b></div><h3 class="sh-title">${tx >= S.goal ? "Goal crushed" : `${S.goal - tx} XP to go`}</h3>
        <p class="sh-body">Daily goal: ${S.goal} XP. Change it in Profile.</p></div>`);
      return;
    }
    case "install": return installGuide();
    case "lightning": return playLightning();
    case "review": return playReview(dueItems().slice(0, 10));
    case "mix": {
      const t = trackById(b.dataset.t);
      const ids = shuffle(Object.keys(ITEMS).filter((id) => ITEMS[id].track === t && S.done[ITEMS[id].lesson.id])).slice(0, 10);
      return playReview(ids, t);
    }
    case "chest": {
      const r = claimChest();
      if (!r) return;
      await rewardScreen({ icon: "🎁", title: "Chest opened", body: `+${r.xp} XP${r.freeze ? "<br>🧊 +1 streak freeze" : ""}`, cta: "Collect" });
      if (r.streakUp) await celebrateStreakOnly();
      const nb = checkBadges();
      save();
      for (const bd of nb) toast(`${bd.icon} <b>${esc(bd.name)}</b> unlocked`);
      return refresh();
    }
    case "backup": {
      const code = exportCode();
      const s = sheet(`<h3 class="sh-title">Backup code</h3><p class="sh-body">Copy this and keep it somewhere safe, like Notes. Paste it into Restore on any device to bring your progress back.</p>
        <textarea class="code" readonly>${esc(code)}</textarea><button class="btn primary big" data-copy>Copy code</button>`);
      s.el.querySelector("[data-copy]").onclick = async () => {
        try { await navigator.clipboard.writeText(code); toast("✅ Copied"); }
        catch (err) { s.el.querySelector("textarea").select(); toast("Select the code and copy it"); }
      };
      return;
    }
    case "restore": {
      const s = sheet(`<h3 class="sh-title">Restore progress</h3><p class="sh-body">Paste a backup code. This replaces the progress on this device.</p>
        <textarea class="code" placeholder="DE2:..."></textarea><button class="btn primary big" data-restore>Restore</button>`);
      s.el.querySelector("[data-restore]").onclick = () => {
        try { importCode(s.el.querySelector("textarea").value); s.close(); toast("✅ Progress restored"); go("learn"); }
        catch (err) { toast(`⚠️ ${esc(err.message)}`); }
      };
      return;
    }
    case "reset": {
      const ok = await confirmBox("Reset everything?", "This erases all XP, streaks, lessons, and badges on this device. It cannot be undone.", "Erase it all", true);
      if (!ok) return;
      resetAll();
      return boot();
    }
  }
}

/* ============================================================
   Install guide and onboarding
   ============================================================ */
function installGuide(fromOnboarding = false) {
  return new Promise((resolve) => {
    const steps = isIOS
      ? `<ol class="steps">
          <li><span class="sn">1</span><div>Tap the <b>Share</b> button <span class="inline-ic">${ICON.share}</span> in Safari's toolbar</div></li>
          <li><span class="sn">2</span><div>Scroll down and tap <b>Add to Home Screen</b> <span class="inline-ic">${ICON.plusSquare}</span></div></li>
          <li><span class="sn">3</span><div>Tap <b>Add</b>, then open Daily Expert from your Home Screen</div></li></ol>
        <p class="sh-note">Install before you play. The Home Screen app keeps its own progress, separate from Safari.</p>`
      : `<p class="sh-body">On your iPhone, open this page in Safari, tap Share, then Add to Home Screen. On Android or desktop Chrome, use Install app from the browser menu.</p>`;
    const s = sheet(`<div class="install-sheet"><div class="app-ic"><img src="icons/icon-192.png" alt=""></div><h3 class="sh-title">Make it an app</h3>${steps}
      <button class="btn ghost big" data-later>${fromOnboarding ? "Continue in the browser" : "Got it"}</button></div>`, { onClose: resolve });
    s.el.querySelector("[data-later]").onclick = () => { S.flags.installDismissed = true; save(); s.close(); if (tab === "learn") go("learn"); };
  });
}

function onboarding() {
  const ov = document.getElementById("overlay");
  ov.classList.add("open");
  document.body.classList.add("overlay-open");
  let step = 0;
  let goal = S.goal, track = S.track;
  const render = () => {
    if (step === 0) {
      ov.innerHTML = `<div class="onb welcome"><div class="onb-art"><img src="icons/icon-512.png" alt=""><span class="o1">⚡</span><span class="o2">🛢️</span><span class="o3">🖥️</span><span class="o4">🏛️</span></div>
        <h1>Daily Expert</h1><p>Five minutes a day. Real fluency in power, oil and gas, data centers, and history.</p>
        <div class="res-actions"><button class="btn primary big" data-n>Get started</button></div></div>`;
    } else if (step === 1) {
      ov.innerHTML = `<div class="onb"><small class="onb-step">1 of 2</small><h2>Pick a daily goal</h2><p>You can change this any time.</p>
        <div class="goal-list">${GOALS.map((g) => `<button class="goal-opt ${goal === g.xp ? "on" : ""}" data-g="${g.xp}"><b>${g.name}</b><span>${g.xp} XP a day</span><small>${g.note}</small></button>`).join("")}</div>
        <div class="res-actions"><button class="btn primary big" data-n>Continue</button></div></div>`;
    } else if (step === 2) {
      ov.innerHTML = `<div class="onb"><small class="onb-step">2 of 2</small><h2>Where do you want to start?</h2><p>All four tracks stay open. This just sets your home path.</p>
        <div class="tp-list">${TRACKS.map((t) => `<button class="tp ${track === t.id ? "on" : ""}" data-tr="${t.id}" style="--c:${t.color};--d:${t.deep}"><span class="tp-ic">${t.icon}</span><span class="tp-txt"><b>${esc(t.name)}</b><small>${esc(t.tagline)}</small></span></button>`).join("")}</div>
        <div class="res-actions"><button class="btn primary big" data-n>Start learning</button></div></div>`;
    }
  };
  ov.onclick = async (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    sfx.tap(); haptic();
    if (b.dataset.g) { goal = +b.dataset.g; render(); return; }
    if (b.dataset.tr) { track = b.dataset.tr; render(); return; }
    if (b.hasAttribute("data-n")) {
      step++;
      if (step <= 2) return render();
      S.goal = goal; S.track = track; S.onboarded = true;
      quests();
      save();
      ov.classList.remove("open");
      document.body.classList.remove("overlay-open");
      ov.onclick = null;
      ov.innerHTML = "";
      go("learn");
      const nx = nextUp(trackById(S.track));
      if (nx && nx.kind === "lesson") setTimeout(() => lessonSheet(nx.item), 400);
    }
  };
  render();
}

/* ============================================================
   Boot, day rollover, service worker
   ============================================================ */
let bootDay = todayKey();
function boot() {
  shell();
  quests();
  save();
  go("learn");
  if (!S.onboarded) {
    onboarding();
    if (isIOS && !standalone()) setTimeout(() => installGuide(true), 300);
  }
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  if (todayKey() !== bootDay) { bootDay = todayKey(); quests(); save(); }
  if (!document.body.classList.contains("overlay-open") && tab !== "swipe") refresh({ keepScroll: true });
});

let updating = false;
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  navigator.serviceWorker.register("./sw.js").then((reg) => {
    reg.addEventListener("updatefound", () => {
      const nw = reg.installing;
      nw && nw.addEventListener("statechange", () => {
        if (nw.state === "installed" && navigator.serviceWorker.controller) {
          toast("✨ <b>New lessons ready.</b> Tap to update.", { ms: 0, onTap: () => { updating = true; nw.postMessage("skip"); } });
        }
      });
    });
    setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
  }).catch(() => {});
  // Reload only when the user asked for an update, never on the first install.
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (!updating) return; updating = false; location.reload(); });
}
try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) {}

boot();
