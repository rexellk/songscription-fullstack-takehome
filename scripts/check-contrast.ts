// Verifies WCAG AA contrast for every token pairing the UI uses, in both themes.
// Reads the token values straight from globals.css so the check can't drift from the code.
// Run: npx tsx scripts/check-contrast.ts
import { readFileSync } from "node:fs";

const css = readFileSync("src/app/globals.css", "utf8");

function tokens(selector: string) {
  const block = css.slice(css.indexOf(selector)).match(/\{([^}]*)\}/)?.[1] ?? "";
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]));
}

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// [foreground, background, minimum, what it is]
const PAIRS: [string, string, number, string][] = [
  ["ink", "paper", 4.5, "body text"],
  ["ink", "paper-raised", 4.5, "card text"],
  ["ink-2", "paper", 4.5, "secondary text"],
  ["ink-2", "paper-raised", 4.5, "secondary text on cards"],
  ["ink-2", "paper-sunk", 4.5, "avatar initials"],
  ["ink-3", "paper", 4.5, "metadata"],
  ["ink-3", "paper-raised", 4.5, "metadata on cards"],
  // ink-3 on paper-sunk lands at 4.4-4.5:1, so captions on sunk surfaces use ink-2 instead.
  ["ink-2", "paper-sunk", 4.5, "skeleton caption"],
  ["ink", "brass-soft", 4.5, "selected chip"],
  ["on-brass", "brass", 4.5, "primary button"],
  // brass is 4.49:1 on paper: fine for icons, rings, and notes, never used for small text.
  ["brass", "paper", 3, "focus ring, favorite icon"],
  ["brass", "paper-raised", 3, "favorite icon on card"],
  ["brass", "paper-sunk", 3, "left-hand notes on roll"],
  ["ink", "paper-sunk", 3, "right-hand notes on roll"],
  ["oxblood", "paper-raised", 4.5, "error / delete text"],
  ["oxblood", "paper", 4.5, "error text on page"],
  ["ivory-note", "ebony", 4.5, "practice stage text"],
  ["brass", "ebony", 3, "left-hand notes on ebony"],
  ["rule-strong", "paper-raised", 1.4, "hairline (decorative, see DECISIONS)"],
  ["ink-3", "paper-raised", 3, "input boundary icon"],
];

let failed = 0;
for (const [name, selector] of [["Ivory (light)", ":root {"], ["Moonlight (dark)", '[data-theme="dark"] {']] as const) {
  const t = tokens(selector);
  console.log(`\n${name}`);
  for (const [fg, bg, min, use] of PAIRS) {
    const r = ratio(t[fg], t[bg]);
    const ok = r >= min;
    if (!ok) failed++;
    console.log(`  ${ok ? "pass" : "FAIL"}  ${r.toFixed(2).padStart(5)} : 1  (min ${min})  ${fg} on ${bg}  ${use}`);
  }
}
console.log(failed ? `\n${failed} pairing(s) below AA` : "\nAll pairings meet AA");
process.exit(failed ? 1 : 0);
