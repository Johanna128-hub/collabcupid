// Vendors Monaco editor's static assets into public/, so the Repository
// page's in-browser code editor works fully offline instead of depending
// on a CDN (@monaco-editor/react's default loader fetches from
// cdn.jsdelivr.net, which many locked-down networks/sandboxes block).
// Runs automatically via the "postinstall" npm script.
import { existsSync, mkdirSync, cpSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = join(__dirname, "..", "node_modules", "monaco-editor", "min", "vs");
const dest = join(__dirname, "..", "public", "monaco-editor", "vs");

if (!existsSync(src)) {
  console.warn("[copy-monaco] monaco-editor/min/vs not found -- skipping (did npm install finish?)");
  process.exit(0);
}

mkdirSync(dirname(dest), { recursive: true });
cpSync(src, dest, { recursive: true });
console.log("[copy-monaco] Vendored Monaco editor assets into public/monaco-editor/vs");
