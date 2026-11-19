// Sound, haptics, confetti, sheets, toasts, small helpers.
import { S } from "./state.js";

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export function shuffle(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export const pick = (a) => a[Math.floor(Math.random() * a.length)];
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- Sound (synthesized, no files) ---------- */
let ctx;
function ac() {
  if (!S.sound) return null;
  try {
    if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; ctx = new C(); }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  } catch (e) { return null; }
}
function tone(freq, at, dur, type = "sine", vol = 0.16) {
  const c = ac(); if (!c) return;
  const t0 = c.currentTime + at;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination);
  o.start(t0); o.stop(t0 + dur + 0.03);
}
export const sfx = {
  tap() { tone(660, 0, 0.05, "sine", 0.05); },
  good() { tone(784, 0, 0.11); tone(1175, 0.075, 0.22); },
  bad() { tone(196, 0, 0.16, "square", 0.05); tone(147, 0.09, 0.24, "square", 0.045); },
  combo(n) { const base = 523 * Math.pow(2, Math.min(n, 25) / 24); [0, 4, 7, 12].forEach((s, i) => tone(base * Math.pow(2, s / 12), i * 0.06, 0.16, "triangle", 0.12)); },
  win() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.1, 0.32, "triangle", 0.14)); },
  pop() { tone(880, 0, 0.06, "sine", 0.08); },
  tick() { tone(1200, 0, 0.03, "square", 0.03); },
  flame() { [392, 523, 659, 784].forEach((f, i) => tone(f, i * 0.08, 0.3, "sawtooth", 0.05)); tone(1568, 0.34, 0.5, "sine", 0.1); },
};

/* ---------- Haptics ----------
   iOS Safari has no vibrate API, but toggling a native switch input gives a system tick (iOS 18+). */
let hapticLabel;
export function haptic() {
  if (!S.haptics) return;
  try {
    if (navigator.vibrate) { navigator.vibrate(12); return; }
    if (!hapticLabel) {
      hapticLabel = document.createElement("label");
      hapticLabel.setAttribute("aria-hidden", "true");
      hapticLabel.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none";
      const i = document.createElement("input");
      i.type = "checkbox"; i.setAttribute("switch", ""); i.tabIndex = -1;
      hapticLabel.appendChild(i);
      document.body.appendChild(hapticLabel);
    }
    hapticLabel.click();
  } catch (e) {}
}

/* ---------- Confetti ---------- */
export function confetti(colors = ["#FFC83D", "#FF6B4A", "#4F9DFF", "#B47CFF", "#3DDC84", "#ffffff"], count = 160) {
  const cv = document.createElement("canvas");
  cv.className = "confetti";
  document.body.appendChild(cv);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = (cv.width = innerWidth * dpr), H = (cv.height = innerHeight * dpr);
  const c = cv.getContext("2d");
  const parts = Array.from({ length: count }, () => ({
    x: W / 2 + (Math.random() - 0.5) * W * 0.3, y: H * 0.35,
    vx: (Math.random() - 0.5) * 22 * dpr, vy: (-Math.random() * 20 - 8) * dpr,
    w: (6 + Math.random() * 6) * dpr, h: (10 + Math.random() * 8) * dpr,
    r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, col: pick(colors),
  }));
  const t0 = performance.now();
  (function frame(t) {
    const el = t - t0;
    c.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.vy += 0.55 * dpr; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      c.save(); c.translate(p.x, p.y); c.rotate(p.r);
      c.globalAlpha = Math.max(0, 1 - el / 2600);
      c.fillStyle = p.col; c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r)));
      c.restore();
    }
    if (el < 2600) requestAnimationFrame(frame); else cv.remove();
  })(t0);
}

/* ---------- Toast ---------- */
export function toast(html, { ms = 2600, onTap } = {}) {
  const t = document.createElement("div");
  t.className = "toast";
  t.innerHTML = html;
  if (onTap) { t.classList.add("tappable"); t.addEventListener("click", () => { onTap(); t.remove(); }); }
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add("show"));
  if (ms) setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, ms);
  return t;
}

/* ---------- Bottom sheet ---------- */
export function sheet(html, { cls = "", onClose } = {}) {
  const wrap = document.createElement("div");
  wrap.className = "sheet-wrap";
  wrap.innerHTML = `<div class="sheet-bg"></div><div class="sheet ${cls}"><div class="grab"></div>${html}</div>`;
  document.body.appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add("open"));
  const close = () => {
    if (!wrap.isConnected) return;
    wrap.classList.remove("open");
    setTimeout(() => wrap.remove(), 280);
    onClose && onClose();
  };
  wrap.querySelector(".sheet-bg").addEventListener("click", close);
  // swipe down to dismiss
  const sh = wrap.querySelector(".sheet");
  let y0 = null;
  sh.addEventListener("touchstart", (e) => { if (sh.scrollTop <= 0) y0 = e.touches[0].clientY; }, { passive: true });
  sh.addEventListener("touchmove", (e) => { if (y0 == null) return; const dy = e.touches[0].clientY - y0; if (dy > 0) sh.style.transform = `translateY(${dy}px)`; }, { passive: true });
  sh.addEventListener("touchend", (e) => { if (y0 == null) return; const dy = e.changedTouches[0].clientY - y0; sh.style.transform = ""; y0 = null; if (dy > 90) close(); });
  return { el: sh, close };
}

export function confirmBox(title, body, okText = "OK", danger = false) {
  return new Promise((resolve) => {
    const s = sheet(`<h3 class="sh-title">${esc(title)}</h3><p class="sh-body">${esc(body)}</p>
      <div class="sh-actions"><button class="btn ${danger ? "red" : "primary"} big" data-ok>${esc(okText)}</button>
      <button class="btn ghost big" data-cancel>Cancel</button></div>`, { onClose: () => resolve(false) });
    s.el.querySelector("[data-ok]").onclick = () => { resolve(true); s.close(); };
    s.el.querySelector("[data-cancel]").onclick = () => s.close();
  });
}

export function countUp(el, to, ms = 900) {
  const t0 = performance.now();
  (function f(t) {
    const p = Math.min(1, (t - t0) / ms);
    el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(f);
  })(t0);
}

/* ---------- Icons ---------- */
export const ICON = {
  path: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9v11h5v-6h4v6h5V9"/></svg>`,
  swipe: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2.5" width="14" height="19" rx="3"/><path d="M9.5 9.5 12 7l2.5 2.5M12 7v9"/></svg>`,
  practice: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>`,
  me: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>`,
  x: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>`,
  lock: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 10V7a5 5 0 0 1 10 0v3h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2zm2 0h6V7a3 3 0 0 0-6 0z"/></svg>`,
  star: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.2 1.3-6.6L2.5 9.3l6.6-.8z"/></svg>`,
  trophy: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 3h10v2h3v3a4 4 0 0 1-4 4h-.3A5 5 0 0 1 13 14.9V18h3v3H8v-3h3v-3.1A5 5 0 0 1 8.3 12H8a4 4 0 0 1-4-4V5h3zm0 4H6v1a2 2 0 0 0 1 1.7zm10 0v2.7A2 2 0 0 0 18 8V7z"/></svg>`,
  refresh: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>`,
  chevron: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`,
  share: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>`,
  plusSquare: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M12 8v8M8 12h8"/></svg>`,
  heart: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7.5-4.6-9.6-9.4C1 8.4 3 4.5 6.8 4.5c2.1 0 3.6 1.2 5.2 3 1.6-1.8 3.1-3 5.2-3 3.8 0 5.8 3.9 4.4 7.1C19.5 16.4 12 21 12 21z"/></svg>`,
};
