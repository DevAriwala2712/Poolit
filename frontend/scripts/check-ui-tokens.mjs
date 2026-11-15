// Fails if a text size or minimum control height appears that is not part of the app's scale.
// Run with: npm run check:ui   (also in CI). To add a size on purpose, add it to the list below
// and say why in the commit.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const RULES = {
  "apps/student/src": {
    // Body text uses the named scale (text-micro ... text-input, see index.css); these are headings and art.
    text: [17, 18, 19, 20, 23, 24, 26, 28, 30, 32, 34, 40, 44, 76, 110],
    // Tappable controls are at least 44 px tall.
    minH: [44, 48, 56],
  },
  "apps/vendor/src": {
    text: [10, 11, 14, 15, 16, 18, 20, 22, 26, 28, 40],
    minH: null,
  },
};

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (/\.(tsx|ts|css)$/.test(name)) yield p;
  }
}

let bad = 0;
for (const [dir, rule] of Object.entries(RULES)) {
  for (const file of files(dir)) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      for (const m of line.matchAll(/(?<![\w-])text-\[(\d+(?:\.\d+)?)px\]/g)) {
        if (!rule.text.includes(Number(m[1]))) {
          console.log(`${file}:${i + 1}  text-[${m[1]}px] is not in the scale`);
          bad++;
        }
      }
      if (rule.minH) {
        for (const m of line.matchAll(/min-h-\[(\d+)px\]/g)) {
          if (!rule.minH.includes(Number(m[1]))) {
            console.log(`${file}:${i + 1}  min-h-[${m[1]}px] is not in the scale (${rule.minH.join(", ")})`);
            bad++;
          }
        }
      }
    });
  }
}
console.log(bad ? `\n${bad} value(s) outside the scale` : "UI scale OK");
process.exit(bad ? 1 : 0);
