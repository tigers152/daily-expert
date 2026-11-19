import power from "./power.js";
import oil from "./oil.js";
import dc from "./datacenters.js";
import history from "./history.js";

export const TRACKS = [power, oil, dc, history];
export const LESSONS = {};
export const UNITS = {};
export const ITEMS = {}; // every question card, keyed by stable id

for (const t of TRACKS) {
  let n = 0;
  t.lessonIds = [];
  t.unitIds = [];
  t.units.forEach((u, ui) => {
    u.id = `${t.id}-u${ui + 1}`;
    u.track = t;
    u.num = ui + 1;
    u.lessonIds = [];
    UNITS[u.id] = u;
    t.unitIds.push(u.id);
    u.lessons.forEach((l) => {
      n++;
      l.id = `${t.id}-${n}`;
      l.num = n;
      l.track = t;
      l.unit = u;
      LESSONS[l.id] = l;
      t.lessonIds.push(l.id);
      u.lessonIds.push(l.id);
      l.cards.forEach((c, ci) => {
        c.id = `${l.id}.${ci}`;
        c.lesson = l;
        c.track = t;
        if (c.t !== "learn") ITEMS[c.id] = c;
      });
    });
  });
}

export const trackById = (id) => TRACKS.find((t) => t.id === id) || TRACKS[0];
export const questionsOf = (lessonIds) =>
  lessonIds.flatMap((id) => LESSONS[id].cards.filter((c) => c.t !== "learn"));
