// Builds the tablet + dashboard website as plain files and copies them into the backend,
// which then serves everything on one address (http://<computer>:4000).
// Use this for machines that can't run Next.js (e.g. an old Mac on Node 16).
//
//   npm run build:static                 -> copies to ../backend/public
//   npm run build:static -- <folder>     -> copies to <folder>
//
// Needs a current Node (20.9+) on the computer that runs the build, not on the one that serves it.
// Stop `npm run dev` first: the app/api folder is moved aside while the build runs.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.resolve(frontendDir, process.argv[2] || "../backend/public");
const apiDir = path.join(frontendDir, "app", "api");
const stash = path.join(frontendDir, ".static-build-api-stash");

// Put back a folder left aside by an interrupted build
if (fs.existsSync(stash) && !fs.existsSync(apiDir)) fs.renameSync(stash, apiDir);

// The static site uses the real backend, so the stand-in API (app/api) is left out of it:
// a static export can't contain API routes.
let movedApi = false;
if (fs.existsSync(apiDir)) {
  fs.renameSync(apiDir, stash);
  movedApi = true;
}

// The static site calls /api on the same address it's served from, so no API URL is baked in
// (this also overrides any NEXT_PUBLIC_API_URL in .env.local).
const env = { ...process.env, STATIC_EXPORT: "1", NEXT_PUBLIC_API_URL: "" };

let status;
try {
  console.log("Building the static site…");
  status = spawnSync("npx", ["next", "build"], { cwd: frontendDir, env, stdio: "inherit", shell: true }).status;
} finally {
  if (movedApi) fs.renameSync(stash, apiDir);
}
if (status !== 0) process.exit(status ?? 1);

const out = path.join(frontendDir, "out");
if (!fs.existsSync(path.join(out, "index.html"))) {
  console.error("The build didn't produce out/index.html.");
  process.exit(1);
}

fs.rmSync(target, { recursive: true, force: true });
fs.cpSync(out, target, { recursive: true });
console.log(`\nDone: website copied to ${target}`);
console.log("Restart the backend to serve it (pm2 restart coffee-palace).");
