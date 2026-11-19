// Lesson, review, checkpoint, and Lightning Round runners.
import {
  S, save, addXp, todayKey, dayNum, keyFromNum, STREAK_MIN, srsLearn, srsGrade, questEvent, checkBadges, ITEMS,
} from "./state.js";
import { $, $$, esc, shuffle, pick, sfx, haptic, confetti, confirmBox, countUp, sleep, ICON } from "./fx.js";

const PRAISE = ["Nice!", "Nailed it", "Correct", "Sharp", "Exactly", "You got it", "Clean", "Yes!", "Easy money"];
const MISS = ["Not quite", "Close, but no", "Missed that one", "Not this time"];
const COMBO_MSG = { 3: "3 in a row", 5: "5 in a row!", 10: "10 straight. On fire", 15: "15 straight. Locked in", 20: "20 straight. Unreal" };

let root;
function openOverlay() {
  root = document.getElementById("overlay");
  root.innerHTML = "";
  root.classList.add("open");
  document.body.classList.add("overlay-open");
  return root;
}
function closeOverlay() {
  root.classList.remove("open");
  document.body.classList.remove("overlay-open");
  root.onclick = null;
  setTimeout(() => { if (!root.classList.contains("open")) root.innerHTML = ""; }, 250);
}

/* ============================================================
   Lessons, reviews, checkpoints
   ============================================================ */
export function runSession(opts) {
  return new Promise((resolve) => {
    const s = {
      ...opts, queue: [], i: 0, combo: 0, best: 0, correct: 0, answered: 0, mistakes: 0, xp: 0,
      first: {}, start: Date.now(), hearts: opts.mode === "checkpoint" ? 3 : null, resolve, locked: false,
    };
    if (s.mode === "lesson") {
      const learns = s.lesson.cards.filter((c) => c.t === "learn");
      let qs = s.lesson.cards.filter((c) => c.t !== "learn");
      if (S.done[s.lesson.id]) qs = shuffle(qs);
      s.queue = [...learns, ...qs];
    } else if (s.mode === "review") {
      s.queue = shuffle(s.ids.map((id) => ITEMS[id]).filter(Boolean)).slice(0, 10);
    } else if (s.mode === "checkpoint") {
      const qs = s.unit.lessonIds.flatMap((id) => s.lessonsById[id].cards.filter((c) => c.t !== "learn"));
      s.queue = shuffle(qs).slice(0, 10);
    }
    if (location.hostname === "localhost") window.__deSess = s; // test hook, local only
    openOverlay();
    shell(s);
    renderCard(s);
  });
}

function shell(s) {
  const hearts = s.hearts != null ? `<span class="hearts">${ICON.heart}<b>${s.hearts}</b></span>` : "";
  root.innerHTML = `<div class="sess" style="--c:${s.track.color};--d:${s.track.deep}">
    <div class="s-top">
      <button class="icon-btn" data-quit aria-label="Quit">${ICON.x}</button>
      <div class="s-prog"><i></i></div>
      <div class="s-meta"><span class="combo-pill" data-combo>🔥<b>0</b></span>${hearts}</div>
    </div>
    <div class="s-body"><div class="s-card"></div></div>
    <div class="s-foot"><button class="btn primary big" data-check disabled>Check</button></div>
    <div class="fb"></div>
  </div>`;
  root.onclick = (e) => onTap(s, e);
  progress(s);
}

function progress(s) {
  const p = s.queue.length ? s.i / s.queue.length : 0;
  const bar = $(".s-prog i", root);
  if (bar) bar.style.width = `${Math.max(4, p * 100)}%`;
}

function setFoot(s, label, enabled, cls = "primary") {
  const b = $("[data-check]", root);
  b.textContent = label;
  b.disabled = !enabled;
  b.className = `btn ${cls} big`;
}

function renderCard(s) {
  const c = s.queue[s.i];
  s.cur = { c, sel: null };
  const card = $(".s-card", root);
  const kind = (t) => `<div class="q-kind">${t}</div>`;
  let html = "";
  switch (c.t) {
    case "learn":
      html = `<div class="learn">
        <div class="l-tag">${s.track.icon} New idea</div>
        ${c.stat ? `<div class="l-stat">${esc(c.stat)}</div><div class="l-statlabel">${esc(c.label || "")}</div>` : ""}
        <h2 class="l-h">${esc(c.h)}</h2>
        <p class="l-b">${esc(c.b)}</p>
        ${c.w ? `<div class="atwork"><b>At work</b><span>${esc(c.w)}</span></div>` : ""}
      </div>`;
      setFoot(s, "Got it", true);
      break;
    case "mc":
      s.cur.opts = shuffle(c.o.map((t, i) => ({ t, ok: i === 0 })));
      html = kind("Choose the answer") + `<h2 class="q">${esc(c.q)}</h2>
        <div class="opts">${s.cur.opts.map((o, i) => `<button class="opt" data-opt="${i}"><span class="k">${i + 1}</span><span class="ot">${esc(o.t)}</span></button>`).join("")}</div>`;
      setFoot(s, "Check", false);
      break;
    case "tf":
      html = kind("True or false?") + `<h2 class="q stmt">${esc(c.q)}</h2>
        <div class="tf"><button class="opt tfb" data-tf="1"><span class="tf-ic">${ICON.check}</span>True</button>
        <button class="opt tfb" data-tf="0"><span class="tf-ic">${ICON.x}</span>False</button></div>`;
      setFoot(s, "Check", false);
      break;
    case "fill": {
      s.cur.opts = shuffle(c.o.map((t, i) => ({ t, ok: i === 0 })));
      const [a, b] = c.q.split("___");
      html = kind("Fill in the blank") + `<h2 class="q fillq">${esc(a)}<span class="blank" data-blank>&nbsp;</span>${esc(b)}</h2>
        <div class="chips">${s.cur.opts.map((o, i) => `<button class="chip" data-opt="${i}">${esc(o.t)}</button>`).join("")}</div>`;
      setFoot(s, "Check", false);
      break;
    }
    case "order": {
      let items = shuffle(c.o.map((_, i) => i));
      if (items.every((v, k) => v === k)) items = items.reverse();
      s.cur.bank = items;
      s.cur.placed = [];
      html = kind("Put these in order") + `<h2 class="q">${esc(c.q)}</h2>
        <div class="ord-line" data-line><span class="ord-hint">Tap items below, first to last</span></div><div class="ord-bank" data-bank></div>`;
      setFoot(s, "Check", false);
      break;
    }
    case "match":
      s.cur.L = shuffle(c.p.map((_, i) => i));
      s.cur.R = shuffle(c.p.map((_, i) => i));
      s.cur.miss = 0;
      s.cur.matched = new Set();
      s.cur.pick = null;
      html = kind("Tap the matching pairs") + `<h2 class="q small">${esc(c.q)}</h2>
        <div class="match"><div class="mcol">${s.cur.L.map((i) => `<button class="mt" data-ml="${i}">${esc(c.p[i][0])}</button>`).join("")}</div>
        <div class="mcol">${s.cur.R.map((i) => `<button class="mt" data-mr="${i}">${esc(c.p[i][1])}</button>`).join("")}</div></div>`;
      setFoot(s, "Match all 4 pairs", false);
      break;
  }
  card.innerHTML = html;
  card.classList.remove("in");
  void card.offsetWidth;
  card.classList.add("in");
  $(".s-body", root).scrollTop = 0;
  if (c.t === "order") renderOrder(s);
}

function renderOrder(s) {
  const c = s.cur.c;
  const line = $("[data-line]", root), bank = $("[data-bank]", root);
  line.innerHTML = s.cur.placed.length
    ? s.cur.placed.map((i, k) => `<button class="chip placed" data-un="${i}"><span class="n">${k + 1}</span>${esc(c.o[i])}</button>`).join("")
    : `<span class="ord-hint">Tap items below, first to last</span>`;
  bank.innerHTML = s.cur.bank.map((i) => `<button class="chip ${s.cur.placed.includes(i) ? "ghosted" : ""}" data-pl="${i}" ${s.cur.placed.includes(i) ? "disabled" : ""}>${esc(c.o[i])}</button>`).join("");
  $("[data-check]", root).disabled = s.cur.placed.length !== c.o.length;
}

function onTap(s, e) {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.hasAttribute("data-quit")) return quit(s);
  if (b.hasAttribute("data-next")) return next(s);
  if (b.hasAttribute("data-check")) {
    if (s.cur.c.t === "learn") { sfx.tap(); return next(s); }
    return check(s);
  }
  if (s.locked) return;
  const c = s.cur.c;
  if ((c.t === "mc" || c.t === "fill") && b.dataset.opt != null) {
    $$("[data-opt]", root).forEach((x) => x.classList.remove("sel"));
    b.classList.add("sel");
    s.cur.sel = +b.dataset.opt;
    if (c.t === "fill") { const bl = $("[data-blank]", root); bl.textContent = s.cur.opts[s.cur.sel].t; bl.classList.add("filled"); }
    $("[data-check]", root).disabled = false;
    sfx.tap(); haptic();
  } else if (c.t === "tf" && b.dataset.tf != null) {
    $$("[data-tf]", root).forEach((x) => x.classList.remove("sel"));
    b.classList.add("sel");
    s.cur.sel = b.dataset.tf === "1";
    $("[data-check]", root).disabled = false;
    sfx.tap(); haptic();
  } else if (c.t === "order") {
    if (b.dataset.pl != null) s.cur.placed.push(+b.dataset.pl);
    else if (b.dataset.un != null) s.cur.placed = s.cur.placed.filter((x) => x !== +b.dataset.un);
    else return;
    sfx.tap(); haptic();
    renderOrder(s);
  } else if (c.t === "match" && (b.dataset.ml != null || b.dataset.mr != null)) {
    matchTap(s, b);
  }
}

function matchTap(s, b) {
  const side = b.dataset.ml != null ? "l" : "r";
  const idx = +(b.dataset.ml ?? b.dataset.mr);
  if (s.cur.matched.has(idx) && b.classList.contains("ok")) return;
  const p = s.cur.pick;
  if (!p || p.side === side) {
    $$(".mt.sel", root).forEach((x) => x.classList.remove("sel"));
    b.classList.add("sel");
    s.cur.pick = { side, idx, el: b };
    sfx.tap(); haptic();
    return;
  }
  const other = p.el;
  s.cur.pick = null;
  other.classList.remove("sel");
  if (p.idx === idx) {
    s.cur.matched.add(idx);
    [b, other].forEach((x) => { x.classList.add("ok"); x.disabled = true; });
    sfx.pop(); haptic();
    if (s.cur.matched.size === s.cur.c.p.length) setTimeout(() => check(s), 350);
  } else {
    s.cur.miss++;
    [b, other].forEach((x) => { x.classList.add("bad"); setTimeout(() => x.classList.remove("bad"), 450); });
    sfx.bad(); haptic();
  }
}

function evaluate(s) {
  const c = s.cur.c;
  switch (c.t) {
    case "mc":
    case "fill": return { ok: s.cur.opts[s.cur.sel].ok, ans: c.o[0] };
    case "tf": return { ok: s.cur.sel === c.a, ans: c.a ? "True" : "False" };
    case "order": return { ok: s.cur.placed.every((v, k) => v === k), ans: c.o.join("  →  ") };
    case "match": return { ok: s.cur.miss === 0, ans: c.p.map((p) => `${p[0]}: ${p[1]}`).join("\n") };
  }
}

function paintAnswer(s, ok) {
  const c = s.cur.c;
  if (c.t === "mc" || c.t === "fill") {
    $$("[data-opt]", root).forEach((x) => {
      const o = s.cur.opts[+x.dataset.opt];
      if (o.ok) x.classList.add("ok");
      else if (x.classList.contains("sel")) x.classList.add("bad");
      x.disabled = true;
    });
    if (c.t === "fill") $("[data-blank]", root).classList.add(ok ? "ok" : "bad");
  } else if (c.t === "tf") {
    $$("[data-tf]", root).forEach((x) => {
      const v = x.dataset.tf === "1";
      if (v === c.a) x.classList.add("ok");
      else if (x.classList.contains("sel")) x.classList.add("bad");
      x.disabled = true;
    });
  } else if (c.t === "order") {
    $$("[data-un]", root).forEach((x, k) => { x.classList.add(+x.dataset.un === k ? "ok" : "bad"); x.disabled = true; });
  }
}

function check(s) {
  if (s.locked) return;
  s.locked = true;
  const c = s.cur.c;
  const res = evaluate(s);
  paintAnswer(s, res.ok);
  s.answered++;
  if (!(c.id in s.first)) s.first[c.id] = res.ok;
  let gain = 0, title;
  if (res.ok) {
    s.combo++;
    s.correct++;
    gain = s.combo >= 10 ? 4 : s.combo >= 5 ? 3 : 2;
    s.xp += gain;
    s.best = Math.max(s.best, s.combo);
    const cm = COMBO_MSG[s.combo] || (s.combo > 20 && s.combo % 5 === 0 ? `${s.combo} straight!` : null);
    title = cm || pick(PRAISE);
    if (cm && s.combo >= 5) sfx.combo(s.combo); else sfx.good();
    floatXp(gain);
  } else {
    s.combo = 0;
    s.mistakes++;
    title = pick(MISS);
    sfx.bad();
    if (s.hearts != null) {
      s.hearts--;
      const h = $(".hearts", root);
      h.querySelector("b").textContent = s.hearts;
      h.classList.remove("hit"); void h.offsetWidth; h.classList.add("hit");
    } else {
      s.queue.push(c);
    }
  }
  haptic();
  const pill = $("[data-combo]", root);
  pill.querySelector("b").textContent = s.combo;
  pill.classList.toggle("on", s.combo >= 3);
  pill.classList.toggle("hot", s.combo >= 10);
  if (res.ok && s.combo >= 3) { pill.classList.remove("bump"); void pill.offsetWidth; pill.classList.add("bump"); }

  const ansBlock = !res.ok
    ? `<div class="fb-ans"><small>${c.t === "match" ? "The pairs" : "Correct answer"}</small><div>${esc(res.ans).replace(/\n/g, "<br>")}</div></div>` : "";
  const again = !res.ok && s.hearts == null ? `<p class="fb-again">You will see this one again before the lesson ends.</p>` : "";
  const fb = $(".fb", root);
  fb.className = `fb show ${res.ok ? "ok" : "bad"}`;
  fb.innerHTML = `<div class="fb-in">
    <div class="fb-head"><span class="fb-ic">${res.ok ? ICON.check : ICON.x}</span><b>${esc(title)}</b>${res.ok ? `<span class="fb-xp">+${gain} XP</span>` : ""}</div>
    ${ansBlock}${c.x ? `<p class="fb-x">${esc(c.x)}</p>` : ""}${again}
    <button class="btn ${res.ok ? "green" : "red"} big" data-next>Continue</button></div>`;
  $(".s-foot", root).classList.add("hide");
}

function floatXp(n) {
  const el = document.createElement("div");
  el.className = "float-xp";
  el.textContent = `+${n}`;
  $(".s-top", root).appendChild(el);
  setTimeout(() => el.remove(), 900);
}

function next(s) {
  s.locked = false;
  const fb = $(".fb", root);
  fb.className = "fb";
  $(".s-foot", root).classList.remove("hide");
  s.i++;
  progress(s);
  if (s.hearts === 0) return failCheckpoint(s);
  if (s.i >= s.queue.length) return finish(s);
  renderCard(s);
}

async function quit(s) {
  const what = s.mode === "lesson" ? "lesson" : s.mode === "checkpoint" ? "checkpoint" : "review";
  const ok = await confirmBox(`Quit this ${what}?`, "You will lose the XP from this session.", "Quit", true);
  if (!ok) return;
  closeOverlay();
  s.resolve({ finished: false });
}

async function failCheckpoint(s) {
  addXp(s.xp, s.track.id);
  save();
  root.innerHTML = `<div class="result" style="--c:${s.track.color};--d:${s.track.deep}">
    <div class="res-hero"><div class="res-emoji">💔</div><h1>Out of hearts</h1>
    <p>Checkpoints are tough on purpose. Run back through this unit's lessons, then take another shot.</p></div>
    <div class="tiles"><div class="tile"><small>XP kept</small><b>${s.xp}</b></div><div class="tile"><small>Right</small><b>${s.correct}/${s.answered}</b></div></div>
    <div class="res-actions"><button class="btn primary big" data-retry>Try again</button><button class="btn ghost big" data-cont>Back to path</button></div></div>`;
  root.onclick = (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.hasAttribute("data-retry")) { closeOverlay(); s.resolve({ finished: false, retry: true }); }
    if (b.hasAttribute("data-cont")) { closeOverlay(); s.resolve({ finished: false }); }
  };
}

async function finish(s) {
  const mode = s.mode;
  const bonus = mode === "lesson" ? 10 + (s.mistakes === 0 ? 5 : 0) : mode === "checkpoint" ? 20 : 5;
  const total = s.xp + bonus;
  const acc = s.answered ? Math.round((s.correct / s.answered) * 100) : 100;
  const firstRight = Object.values(s.first).filter(Boolean).length;
  const res = addXp(total, s.track.id);

  S.stats.answered += s.answered;
  S.stats.correct += s.correct;
  S.stats.bestCombo = Math.max(S.stats.bestCombo, s.best);
  questEvent("combo", s.best);
  if (mode === "lesson") {
    S.done[s.lesson.id] = { at: todayKey(), perfect: s.mistakes === 0, acc };
    S.stats.lessons++;
    if (s.mistakes === 0) { S.stats.perfect++; questEvent("perfect", 1); }
    questEvent("lesson", 1);
    for (const id in s.first) srsLearn(id, s.first[id]);
  } else if (mode === "review") {
    for (const id in s.first) srsGrade(id, s.first[id]);
    S.stats.reviews += firstRight;
    questEvent("review", firstRight);
  } else if (mode === "checkpoint") {
    S.cps[s.unit.id] = todayKey();
    for (const id in s.first) srsGrade(id, s.first[id]);
  }
  const badges = checkBadges({ lessonDone: mode === "lesson" });
  save();

  const perfect = s.mistakes === 0;
  const title = mode === "checkpoint" ? "Unit cleared!" : mode === "review" ? "Memory refreshed" : perfect ? "Perfect lesson!" : "Lesson complete!";
  const sub = mode === "checkpoint" ? `${s.unit.title} is done. Next unit unlocked.` : mode === "review" ? "Those items are scheduled further out now." : s.lesson.title;
  const secs = Math.round((Date.now() - s.start) / 1000);
  const time = secs >= 60 ? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}` : `0:${String(secs).padStart(2, "0")}`;
  const third = mode === "checkpoint"
    ? `<div class="tile t-heart"><small>Hearts left</small><b>${s.hearts}</b></div>`
    : `<div class="tile t-combo"><small>Best combo</small><b>${s.best}</b></div>`;
  root.innerHTML = `<div class="result" style="--c:${s.track.color};--d:${s.track.deep}">
    <div class="res-hero"><div class="res-emoji pop">${mode === "checkpoint" ? "🏆" : perfect ? "💎" : "🎉"}</div><h1>${title}</h1><p>${esc(sub)}</p></div>
    <div class="tiles">
      <div class="tile t-xp"><small>Total XP</small><b data-cu="${total}">0</b></div>
      <div class="tile t-acc"><small>Accuracy</small><b>${acc}%</b></div>
      ${third}
    </div>
    <div class="res-lines">
      <span>Answers <b>+${s.xp}</b></span><span>${mode === "lesson" ? "Lesson bonus" : mode === "checkpoint" ? "Checkpoint bonus" : "Review bonus"} <b>+${mode === "lesson" ? 10 : bonus}</b></span>
      ${mode === "lesson" && perfect ? `<span>Perfect <b>+5</b></span>` : ""}<span>Time <b>${time}</b></span>
    </div>
    ${res.goalHit ? `<div class="goal-hit">🎯 Daily goal reached. ${S.goal} XP today.</div>` : ""}
    <div class="res-actions"><button class="btn primary big" data-cont>Continue</button></div></div>`;
  sfx.win();
  confetti([s.track.color, "#ffffff", "#3DDC84", s.track.deep]);
  countUp($("[data-cu]", root), total);
  await waitTap();
  if (res.streakUp) await streakScreen();
  for (const b of badges) await badgeScreen(b);
  closeOverlay();
  s.resolve({ finished: true });
}

function waitTap(sel = "[data-cont]") {
  return new Promise((r) => {
    root.onclick = (e) => { if (e.target.closest(sel)) { sfx.tap(); r(); } };
  });
}

export async function streakScreen() {
  const n = S.streak;
  const t = dayNum();
  const days = [];
  for (let k = 6; k >= 0; k--) {
    const key = keyFromNum(t - k);
    const d = new Date(key + "T12:00:00");
    const lit = (S.days[key] || 0) >= STREAK_MIN;
    const ice = S.frozen.includes(key);
    days.push(`<div class="wd ${lit ? "lit" : ice ? "ice" : ""} ${k === 0 ? "today" : ""}"><span>${"SMTWTFS"[d.getDay()]}</span><i>${lit ? "🔥" : ice ? "🧊" : ""}</i></div>`);
  }
  const msg = n === 1 ? "Day one. Come back tomorrow and make it two."
    : n < 3 ? `${3 - n} more day${3 - n > 1 ? "s" : ""} to earn Kindling.`
    : n < 7 ? `${7 - n} more day${7 - n > 1 ? "s" : ""} to Week Warrior.`
    : n < 30 ? `You are building a real habit. ${30 - n} days to Unstoppable.`
    : "This is who you are now.";
  root.innerHTML = `<div class="streak-screen">
    <div class="flame-big">🔥</div>
    <div class="streak-n" data-cu="${n}">${Math.max(0, n - 1)}</div>
    <h2>day streak!</h2>
    <div class="week">${days.join("")}</div>
    <p>${msg}</p>
    ${S.freezes ? `<p class="frz">🧊 ${S.freezes} streak freeze${S.freezes > 1 ? "s" : ""} ready. A missed day uses one automatically.</p>` : ""}
    <div class="res-actions"><button class="btn orange big" data-cont>Continue</button></div></div>`;
  sfx.flame();
  haptic();
  setTimeout(() => { const el = $("[data-cu]", root); if (el) { el.textContent = n; el.classList.add("pop"); } }, 450);
  await waitTap();
}

export async function badgeScreen(b) {
  root.innerHTML = `<div class="badge-screen">
    <div class="bs-glow"></div><div class="bs-icon pop">${b.icon}</div>
    <small>Badge unlocked</small><h1>${esc(b.name)}</h1><p>${esc(b.desc)}</p>
    <div class="res-actions"><button class="btn primary big" data-cont>Nice</button></div></div>`;
  sfx.win();
  confetti();
  await waitTap();
}

export async function rewardScreen({ icon, title, body, cta = "Collect" }) {
  openOverlay();
  root.innerHTML = `<div class="badge-screen"><div class="bs-glow"></div><div class="bs-icon pop">${icon}</div>
    <h1>${esc(title)}</h1><p>${body}</p><div class="res-actions"><button class="btn primary big" data-cont>${esc(cta)}</button></div></div>`;
  sfx.win();
  confetti();
  await waitTap();
  closeOverlay();
}

export async function celebrateStreakOnly() {
  openOverlay();
  await streakScreen();
  closeOverlay();
}

/* ============================================================
   Lightning Round: 60 seconds, instant answers
   ============================================================ */
export function runLightning(pool, trackOf) {
  return new Promise((resolve) => {
    const L = { score: 0, combo: 0, best: 0, idx: 0, deck: shuffle(pool), left: 60, over: false, busy: false };
    openOverlay();
    root.innerHTML = `<div class="sess lightning" style="--c:#FFC83D;--d:#D99A0B">
      <div class="s-top"><button class="icon-btn" data-quit aria-label="Quit">${ICON.x}</button>
        <div class="lt-bar"><i></i></div><div class="lt-score"><b>0</b></div></div>
      <div class="s-body"><div class="s-card"></div></div>
      <div class="countdown"><b>3</b></div></div>`;
    root.onclick = async (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.hasAttribute("data-quit")) {
        L.over = true;
        closeOverlay();
        resolve({ finished: false });
        return;
      }
      if (b.dataset.ans != null && !L.busy && !L.over) answer(+b.dataset.ans, b);
    };

    const card = () => L.deck[L.idx % L.deck.length];
    function draw() {
      if (L.idx > 0 && L.idx % L.deck.length === 0) L.deck = shuffle(L.deck);
      const c = card();
      const t = trackOf(c);
      let opts;
      if (c.t === "tf") opts = [{ t: "True", ok: c.a }, { t: "False", ok: !c.a }];
      else opts = shuffle(c.o.slice(0, 4).map((t, i) => ({ t, ok: i === 0 })));
      L.opts = opts;
      const q = c.t === "fill" ? esc(c.q).replace("___", `<span class="blank">&nbsp;</span>`) : esc(c.q);
      const el = $(".s-card", root);
      el.innerHTML = `<div class="lt-chip" style="--c:${t.color}">${t.icon} ${esc(t.short)}</div>
        <h2 class="q ${c.t === "tf" ? "stmt" : ""}">${q}</h2>
        <div class="opts ${c.t === "tf" ? "two" : ""}">${opts.map((o, i) => `<button class="opt" data-ans="${i}"><span class="ot">${esc(o.t)}</span></button>`).join("")}</div>`;
      el.classList.remove("in"); void el.offsetWidth; el.classList.add("in");
    }
    async function answer(i, btn) {
      L.busy = true;
      const ok = L.opts[i].ok;
      $$("[data-ans]", root).forEach((x) => { if (L.opts[+x.dataset.ans].ok) x.classList.add("ok"); });
      if (ok) {
        L.score++; L.combo++; L.best = Math.max(L.best, L.combo);
        sfx.good(); haptic();
        const sc = $(".lt-score", root);
        sc.querySelector("b").textContent = L.score;
        sc.classList.remove("bump"); void sc.offsetWidth; sc.classList.add("bump");
        await sleep(220);
      } else {
        L.combo = 0;
        btn.classList.add("bad");
        sfx.bad(); haptic();
        await sleep(750);
      }
      L.idx++;
      L.busy = false;
      if (!L.over) draw();
    }
    async function start() {
      const cd = $(".countdown", root);
      for (const n of ["3", "2", "1", "Go!"]) {
        cd.querySelector("b").textContent = n;
        cd.classList.remove("tick"); void cd.offsetWidth; cd.classList.add("tick");
        sfx.tick();
        await sleep(650);
        if (L.over) return;
      }
      cd.remove();
      draw();
      const t0 = performance.now();
      const bar = $(".lt-bar i", root);
      (function frame(t) {
        if (L.over) return;
        const el = (t - t0) / 1000;
        L.left = Math.max(0, 60 - el);
        bar.style.width = `${(L.left / 60) * 100}%`;
        bar.parentElement.classList.toggle("low", L.left < 10);
        if (L.left <= 0) return end();
        requestAnimationFrame(frame);
      })(t0);
    }
    async function end() {
      L.over = true;
      const prevBest = S.stats.speedBest;
      const isBest = L.score > prevBest;
      S.stats.speedBest = Math.max(prevBest, L.score);
      S.stats.bestCombo = Math.max(S.stats.bestCombo, L.best);
      questEvent("speed", L.score);
      questEvent("combo", L.best);
      const res = addXp(L.score);
      const badges = checkBadges();
      save();
      root.innerHTML = `<div class="result" style="--c:#FFC83D;--d:#D99A0B">
        <div class="res-hero"><div class="res-emoji pop">⚡</div><h1>${isBest && L.score > 0 ? "New personal best!" : "Time!"}</h1>
        <p>${L.score >= 15 ? "That is elite recall." : L.score >= 8 ? "Solid round." : "Every round makes the next one faster."}</p></div>
        <div class="tiles"><div class="tile t-xp"><small>Score</small><b data-cu="${L.score}">0</b></div>
        <div class="tile"><small>Best ever</small><b>${S.stats.speedBest}</b></div>
        <div class="tile t-combo"><small>Best streak</small><b>${L.best}</b></div></div>
        <div class="res-lines"><span>XP earned <b>+${L.score}</b></span></div>
        ${res.goalHit ? `<div class="goal-hit">🎯 Daily goal reached</div>` : ""}
        <div class="res-actions"><button class="btn primary big" data-again>Play again</button><button class="btn ghost big" data-cont>Done</button></div></div>`;
      sfx.win();
      if (isBest && L.score > 0) confetti();
      countUp($("[data-cu]", root), L.score);
      const again = await new Promise((r) => {
        root.onclick = (e) => { if (e.target.closest("[data-again]")) r(true); if (e.target.closest("[data-cont]")) r(false); };
      });
      if (res.streakUp) await streakScreen();
      for (const b of badges) await badgeScreen(b);
      closeOverlay();
      resolve({ finished: true, again });
    }
    start();
  });
}
