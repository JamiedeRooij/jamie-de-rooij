// One-time helper: copies every Framer-hosted image/video used in /content into /uploads
// and rewrites the JSON to point at the local copies. Run it before you cancel Framer:
//
//   node tools/fetch-media.mjs
//
// Needs Node 18 or newer. Safe to run more than once (already-downloaded files are skipped).
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { basename, join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const FILES = ["content/trail.json", "content/projects.json", "content/wall.json"];
const UPLOADS = join(ROOT, "uploads");
await mkdir(UPLOADS, { recursive: true });

const exists = (p) => access(p).then(() => true, () => false);

async function localize(url) {
  if (typeof url !== "string" || !url.includes("framerusercontent.com")) return url;
  const name = basename(new URL(url).pathname);
  const dest = join(UPLOADS, name);
  if (!(await exists(dest))) {
    const res = await fetch(url);
    if (!res.ok) { console.warn(`  ! ${res.status} ${url}`); return url; }
    await writeFile(dest, Buffer.from(await res.arrayBuffer()));
    console.log(`  ↓ ${name}`);
  }
  return `/uploads/${name}`;
}

async function walk(value) {
  if (Array.isArray(value)) return Promise.all(value.map(walk));
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = await walk(v);
    return out;
  }
  return localize(value);
}

for (const f of FILES) {
  const path = join(ROOT, f);
  console.log(f);
  const data = JSON.parse(await readFile(path, "utf8"));
  await writeFile(path, JSON.stringify(await walk(data), null, 2) + "\n");
}
console.log("Done. Commit the new /uploads files and the updated /content files.");
