// Build step for Cloudflare Pages: records when this version was published,
// for the "Last updated" line on the site.
import { writeFileSync } from "node:fs";
writeFileSync("public/build.json", JSON.stringify({ updated: new Date().toISOString() }) + "\n");
console.log("build.json written");
