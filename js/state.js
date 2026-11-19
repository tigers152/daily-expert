// All progress lives here, saved to localStorage on the device.
import { TRACKS, LESSONS, UNITS, ITEMS } from "./content/index.js";

const KEY = "dailyexpert.v2";
export const STREAK_MIN = 10; // XP needed in a day to keep the streak
export const GOALS = [
  { xp: 20, name: "Casual", note: "About 1 lesson" },
  { xp: 40, name: "Regular", note: "About 2 lessons" },
  { xp: 60, name: "Serious", note: "About 3 lessons" },
  { xp: 100, name: "Intense", note: "5 lessons or a lot of swiping" },
];

const pad = (n) => String(n).padStart(2, "0");
export const todayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const dayNum = (key = todayKey()) => {
  const [y, m, d] = key.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 864e5);
};
export const keyFromNum = (n) => {
  const d = new Date(n * 864e5);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};

const fresh = () => ({
  v: 2,
  onboarded: false,
  goal: 40,
  sound: true,
  haptics: true,
  track: "power",
  xp: 0,
  days: {},
  trackXp: {},
  streak: 0,
  lastDay: null,
  bestStreak: 0,
  freezes: 0,
  frozen: [],
  done: {},
  cps: {},
  srs: {},
  quests: null,
  badges: {},
  stats: { answered: 0, correct: 0, bestCombo: 0, lessons: 0, perfect: 0, swipes: 0, speedBest: 0, reviews: 0 },
  flags: {},
});

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      const f = fresh();
      return { ...f, ...s, stats: { ...f.stats, ...(s.stats || {}) }, flags: { ...(s.flags || {}) } };
    }
  } catch (e) {}
  return fresh();
}

export let S = load();
export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {}
}
export function resetAll() { S = fresh(); save(); }

export function exportCode() {
  const json = JSON.stringify(S);
  return "DE2:" + btoa(unescape(encodeURIComponent(json)));
}
export function importCode(code) {
  const c = String(code || "").trim();
  if (!c.startsWith("DE2:")) throw new Error("That does not look like a Daily Expert backup code.");
  const obj = JSON.parse(decodeURIComponent(escape(atob(c.slice(4)))));
  if (!obj || obj.v !== 2) throw new Error("Backup code is from a different version.");
  const f = fresh();
  S = { ...f, ...obj, stats: { ...f.stats, ...(obj.stats || {}) } };
  save();
}

/* ---------- Streak, XP, levels ---------- */
export const todayXp = () => S.days[todayKey()] || 0;

export function streakView() {
  const t = dayNum();
  if (!S.lastDay) return { count: 0, today: false };
  const last = dayNum(S.lastDay);
  if (last === t) return { count: S.streak, today: true };
  const gap = t - last - 1;
  if (gap === 0) return { count: S.streak, today: false };
  if (gap <= S.freezes) return { count: S.streak, today: false, frozenGap: gap };
  return { count: 0, today: false, lost: S.streak };
}

function bumpStreak() {
  const tk = todayKey();
  const t = dayNum(tk);
  if (S.lastDay === tk) return false;
  if (!S.lastDay) S.streak = 1;
  else {
    const gap = t - dayNum(S.lastDay) - 1;
    if (gap <= 0) S.streak += 1;
    else if (gap <= S.freezes) {
      S.freezes -= gap;
      for (let i = 1; i <= gap; i++) S.frozen.push(keyFromNum(t - i));
      S.streak += 1;
    } else S.streak = 1;
  }
  S.lastDay = tk;
  S.bestStreak = Math.max(S.bestStreak, S.streak);
  return true;
}

export function addXp(n, trackId) {
  if (!n || n <= 0) return { streakUp: false, goalHit: false };
  const tk = todayKey();
  const before = S.days[tk] || 0;
  S.days[tk] = before + n;
  S.xp += n;
  if (trackId) S.trackXp[trackId] = (S.trackXp[trackId] || 0) + n;
  const streakUp = before + n >= STREAK_MIN ? bumpStreak() : false;
  const goalHit = before < S.goal && before + n >= S.goal;
  questEvent("xp", n);
  return { streakUp, goalHit };
}

export const levelFor = (xp) => { let L = 1; while (xp >= 25 * L * (L + 1)) L++; return L; };
export const levelBounds = (L) => [25 * (L - 1) * L, 25 * L * (L + 1)];

/* ---------- Spaced repetition (Leitner boxes) ---------- */
const BOX_DAYS = [0, 1, 3, 7, 16, 35];
export function srsLearn(id, correct) {
  if (S.srs[id]) return srsGrade(id, correct);
  const box = correct ? 2 : 1;
  S.srs[id] = { box, due: dayNum() + BOX_DAYS[box] };
}
export function srsGrade(id, correct) {
  const cur = S.srs[id] || { box: 0 };
  const box = correct ? Math.min(5, (cur.box || 0) + 1) : 1;
  S.srs[id] = { box, due: dayNum() + BOX_DAYS[box] };
}
export const dueItems = () => {
  const t = dayNum();
  return Object.keys(S.srs).filter((id) => ITEMS[id] && S.srs[id].due <= t);
};
export const dueInLesson = (lessonId) => dueItems().filter((id) => id.startsWith(lessonId + "."));

/* ---------- Unlocks and ranks ---------- */
export function lessonState(l) {
  if (S.done[l.id]) return "done";
  const ids = l.track.lessonIds;
  const i = ids.indexOf(l.id);
  if (i === 0) return "open";
  const prev = LESSONS[ids[i - 1]];
  if (!S.done[prev.id]) return "locked";
  if (prev.unit !== l.unit && !S.cps[prev.unit.id]) return "locked";
  return "open";
}
export function cpState(u) {
  if (S.cps[u.id]) return "done";
  return u.lessonIds.every((id) => S.done[id]) ? "open" : "locked";
}
// The next thing to do in a track: {kind:'lesson'|'cp', item}
export function nextUp(t) {
  for (const u of t.units) {
    for (const l of u.lessons) if (lessonState(l) === "open") return { kind: "lesson", item: l };
    if (cpState(u) === "open") return { kind: "cp", item: u };
  }
  return null;
}
export const lessonsDone = (t) => t.lessonIds.filter((id) => S.done[id]).length;
export function trackRank(t) {
  const d = lessonsDone(t);
  const cps = t.unitIds.filter((id) => S.cps[id]).length;
  if (d === t.lessonIds.length && cps === t.unitIds.length) return "Expert";
  return d >= 9 ? "Pro" : d >= 6 ? "Practitioner" : d >= 3 ? "Apprentice" : "Novice";
}
export const trackComplete = (t) => trackRank(t) === "Expert";

/* ---------- Daily quests ---------- */
const QUEST_POOL = [
  { id: "combo", text: "Get 8 right in a row", goal: 8, kind: "max" },
  { id: "lesson", text: "Finish 2 lessons", goal: 2 },
  { id: "perfect", text: "Finish a lesson with zero mistakes", goal: 1 },
  { id: "swipe", text: "Swipe through 15 cards", goal: 15 },
  { id: "speed", text: "Score 8+ in a Lightning Round", goal: 8, kind: "max" },
  { id: "review", text: "Nail 5 review questions", goal: 5 },
];
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}
export function quests() {
  const tk = todayKey();
  if (!S.quests || S.quests.day !== tk) {
    const r = rng(dayNum(tk) * 7919);
    const pool = QUEST_POOL.slice();
    const pick = [];
    while (pick.length < 2) pick.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
    S.quests = {
      day: tk,
      claimed: false,
      list: [{ id: "xp", text: `Earn ${S.goal} XP`, goal: S.goal, prog: todayXp() }, ...pick.map((q) => ({ ...q, prog: 0 }))],
    };
  }
  return S.quests;
}
export function questEvent(id, n) {
  const q = quests();
  for (const x of q.list) {
    if (x.id !== id) continue;
    x.prog = x.kind === "max" ? Math.max(x.prog, n) : x.prog + n;
  }
}
export const questsDone = () => quests().list.every((x) => x.prog >= x.goal);
export function claimChest() {
  const q = quests();
  if (q.claimed || !questsDone()) return null;
  q.claimed = true;
  const res = addXp(25);
  const freeze = S.freezes < 2;
  if (freeze) S.freezes++;
  save();
  return { xp: 25, freeze, ...res };
}

/* ---------- Badges ---------- */
export const BADGES = [
  { id: "first", icon: "🎓", name: "First Steps", desc: "Finish your first lesson" },
  { id: "streak3", icon: "🔥", name: "Kindling", desc: "Reach a 3 day streak" },
  { id: "streak7", icon: "📅", name: "Week Warrior", desc: "Reach a 7 day streak" },
  { id: "streak30", icon: "☄️", name: "Unstoppable", desc: "Reach a 30 day streak" },
  { id: "combo10", icon: "🎯", name: "Hot Hand", desc: "Get 10 right in a row" },
  { id: "combo25", icon: "🧠", name: "Locked In", desc: "Get 25 right in a row" },
  { id: "perfect5", icon: "💎", name: "Flawless", desc: "Finish 5 lessons with zero mistakes" },
  { id: "boss", icon: "🏆", name: "Boss Down", desc: "Pass a unit checkpoint" },
  { id: "expert", icon: "👑", name: "Expert", desc: "Complete an entire track" },
  { id: "detox", icon: "📵", name: "Scroll Detox", desc: "Swipe through 100 cards" },
  { id: "lightning", icon: "⚡", name: "Lightning", desc: "Score 15+ in a Lightning Round" },
  { id: "grinder", icon: "💪", name: "Grinder", desc: "Earn 1,000 total XP" },
  { id: "poly", icon: "🌐", name: "Polymath", desc: "Finish a lesson in every track" },
  { id: "early", icon: "🌅", name: "Early Bird", desc: "Finish a lesson before 7 AM" },
  { id: "owl", icon: "🦉", name: "Night Owl", desc: "Finish a lesson after 10 PM" },
];
export function checkBadges(ctx = {}) {
  const has = (id) => !!S.badges[id];
  const earn = [];
  const give = (id, cond) => { if (!has(id) && cond) { S.badges[id] = todayKey(); earn.push(BADGES.find((b) => b.id === id)); } };
  const st = S.stats;
  give("first", st.lessons >= 1);
  give("streak3", S.streak >= 3);
  give("streak7", S.streak >= 7);
  give("streak30", S.streak >= 30);
  give("combo10", st.bestCombo >= 10);
  give("combo25", st.bestCombo >= 25);
  give("perfect5", st.perfect >= 5);
  give("boss", Object.keys(S.cps).length >= 1);
  give("expert", TRACKS.some(trackComplete));
  give("detox", st.swipes >= 100);
  give("lightning", st.speedBest >= 15);
  give("grinder", S.xp >= 1000);
  give("poly", TRACKS.every((t) => lessonsDone(t) >= 1));
  if (ctx.lessonDone) {
    const h = new Date().getHours();
    give("early", h < 7);
    give("owl", h >= 22);
  }
  return earn;
}

export { TRACKS, LESSONS, UNITS, ITEMS };
