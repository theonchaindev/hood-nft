// Parses a saved list_image_to_image_tasks result, maps each task to a
// trait layer name via prompt keywords, downloads the edited images.
// Usage: npx tsx scripts/download-edits.mts <saved-result.txt>

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { execSync } from "child_process";

const file = process.argv[2];
const raw = readFileSync(file, "utf8");
const start = raw.indexOf("[");
const tasks: Array<{ id: string; prompt: string; status: string; image_urls: string[] }> =
  JSON.parse(raw.slice(start));

// ordered: first match wins
const MAP: Array<[string, string]> = [
  ["red baseball cap", "hat-cap"],
  ["yellow bucket hat", "hat-bucket"],
  ["cowboy", "hat-cowboy"],
  ["fedora", "hat-fedora"],
  ["toque", "hat-chef"],
  ["construction hard hat", "hat-construction"],
  ["police cap", "hat-police"],
  ["santa hat", "hat-santa"],
  ["mortarboard", "hat-graduation"],
  ["black top hat", "hat-tophat"],
  ["army combat helmet", "hat-army"],
  ["pirate tricorn", "hat-pirate"],
  ["over-ear headphones", "hat-headphones"],
  ["bunny ears", "hat-bunny"],
  ["cat ears", "hat-catears"],
  ["zombie face", "face-zombie"],
  ["ghost face", "face-ghost"],
  ["faint thin white glowing outline", "face-hollow"],
  ["smoke wisps", "face-smoke"],
  ["ice crystals", "face-ice"],
  ["ninja face wrap", "face-ninja"],
  ["jack-o-lantern", "face-pumpkin"],
  ["vampire", "face-vampire"],
  ["alien face", "face-alien"],
  ["retro TV screen", "face-tv"],
  ["computer code", "face-matrix"],
  ["golden robot face", "face-robot"],
  ["cyborg mask face", "face-cyborg"],
  ["demon face", "face-demon"],
  ["wayfarer sunglasses", "acc-sunglasses"],
  ["8-bit style black sunglasses", "acc-pixelglasses"],
  ["coffee cup", "acc-coffee"],
  ["lollipop", "acc-lollipop"],
  ["bubblegum", "acc-bubblegum"],
  ["red rose", "acc-rose"],
  ["smoking pipe", "acc-pipe"],
  ["energy drink", "acc-energy"],
  ["wireless earbud", "acc-airpods"],
  ["hoop earring", "acc-earring"],
  ["baseball bat", "acc-bat"],
  ["nose ring", "acc-nosering"],
  ["green frog", "acc-frog"],
  ["green snake", "acc-snake"],
  ["tiny cute white ghost", "acc-ghost"],
  ["raven", "acc-raven"],
];

mkdirSync("assets/edits", { recursive: true });
const assigned = new Set<string>();
let ok = 0, skipped = 0, failed = 0;
for (const t of tasks) {
  const hit = MAP.find(([kw]) => t.prompt.includes(kw));
  if (!hit) { skipped++; continue; }
  const name = hit[1];
  if (assigned.has(name)) { console.log(`DUP match for ${name} (task ${t.id}) — skipped`); continue; }
  if (t.status !== "SUCCEEDED" || !t.image_urls?.[0]) {
    console.log(`NOT READY: ${name} (${t.status})`);
    failed++;
    continue;
  }
  assigned.add(name);
  const dest = `assets/edits/${name}.png`;
  execSync(`curl -sfo '${dest}' '${t.image_urls[0].replace(/'/g, "%27")}'`);
  ok++;
}
console.log(`downloaded=${ok} notready=${failed} unmatched-skipped=${skipped}`);
const missing = MAP.map(([, n]) => n).filter((n) => !assigned.has(n));
if (missing.length) console.log("missing:", missing.join(","));
