// Tiny authoring helpers for lesson content.
// Convention: for mc and fill, the FIRST option is the correct one. The app shuffles at runtime.
// For order, list items in the CORRECT order. The app shuffles at runtime.
export const learn = (h, b, stat, label, w) => ({ t: "learn", h, b, stat, label, w });
export const mc = (q, o, x) => ({ t: "mc", q, o, x });
export const tf = (q, a, x) => ({ t: "tf", q, a, x });
export const fill = (q, o, x) => ({ t: "fill", q, o, x });
export const match = (q, p) => ({ t: "match", q, p });
export const order = (q, o, x) => ({ t: "order", q, o, x });
export const lesson = (title, ...cards) => ({ title, cards });
export const unit = (title, sub, ...lessons) => ({ title, sub, lessons });
