// Run: node tools/validate.mjs
// Checks every lesson card for schema problems and banned characters.
import { TRACKS, LESSONS, ITEMS } from "../js/content/index.js";

const errors = [];
const BANNED = /[—–]/; // em dash, en dash
const err = (where, msg) => errors.push(`${where}: ${msg}`);

function strings(c) {
  const out = [];
  for (const [k, v] of Object.entries(c)) {
    if (["lesson", "track", "id", "t", "a"].includes(k)) continue;
    if (typeof v === "string") out.push(v);
    else if (Array.isArray(v)) v.flat().forEach((s) => typeof s === "string" && out.push(s));
  }
  return out;
}

let cards = 0;
for (const t of TRACKS) {
  for (const s of [t.name, t.tagline]) if (BANNED.test(s)) err(t.id, "dash in track text");
  for (const u of t.units) {
    if (BANNED.test(u.title + u.sub)) err(u.id, "dash in unit text");
    for (const l of u.lessons) {
      const learns = l.cards.filter((c) => c.t === "learn").length;
      const qs = l.cards.length - learns;
      if (learns < 1) err(l.id, "no learn card");
      if (qs < 4) err(l.id, `only ${qs} questions`);
      for (const c of l.cards) {
        cards++;
        const w = `${c.id} (${c.t})`;
        for (const s of strings(c)) if (BANNED.test(s)) err(w, `dash in "${s.slice(0, 40)}"`);
        switch (c.t) {
          case "learn":
            if (!c.h || !c.b) err(w, "missing h/b");
            if (c.b.length > 330) err(w, `body long (${c.b.length})`);
            break;
          case "mc":
            if (!c.q || !Array.isArray(c.o) || c.o.length !== 4) err(w, "mc needs 4 options");
            if (new Set(c.o).size !== c.o.length) err(w, "duplicate options");
            break;
          case "tf":
            if (typeof c.a !== "boolean") err(w, "tf needs boolean a");
            break;
          case "fill":
            if ((c.q.match(/___/g) || []).length !== 1) err(w, "fill needs exactly one ___");
            if (!Array.isArray(c.o) || c.o.length < 3) err(w, "fill needs 3+ options");
            if (new Set(c.o).size !== c.o.length) err(w, "duplicate options");
            break;
          case "match":
            if (!Array.isArray(c.p) || c.p.length !== 4) err(w, "match needs 4 pairs");
            if (new Set(c.p.map((p) => p[0])).size !== 4 || new Set(c.p.map((p) => p[1])).size !== 4) err(w, "match sides not unique");
            break;
          case "order":
            if (!Array.isArray(c.o) || c.o.length < 3) err(w, "order needs 3+ items");
            if (new Set(c.o).size !== c.o.length) err(w, "duplicate order items");
            break;
          default:
            err(w, "unknown type");
        }
      }
    }
  }
}

console.log(`${TRACKS.length} tracks, ${Object.keys(LESSONS).length} lessons, ${cards} cards, ${Object.keys(ITEMS).length} questions`);
if (errors.length) {
  console.log(errors.join("\n"));
  process.exit(1);
}
console.log("OK");
