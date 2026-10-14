// Minimal static file server for local development and browser tests.
// ES modules do not load over file://, so tools need http to run locally.
// "/" lists every tool folder (any directory with an index.html).
// Usage: node serve.js [port]   (default 8000)
import { createServer } from "node:http";
import { readdir, readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const port = Number(process.argv[2] ?? 8000);
const root = process.cwd();
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

async function toolFolders() {
  const entries = await readdir(root, { withFileTypes: true });
  const tools = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const hasIndex = await stat(join(root, entry.name, "index.html")).then(() => true, () => false);
    if (hasIndex) tools.push(entry.name);
  }
  return tools.sort();
}

async function toolIndex() {
  const items = (await toolFolders()).map((t) => `<li><a href="/${t}/">${t}</a></li>`);
  return `<!doctype html><meta charset="utf-8"><title>tools</title><h1>tools</h1><ul>${items.join("")}</ul>\n`;
}

createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  if (path === "/") {
    res.writeHead(200, { "content-type": types[".html"], "cache-control": "no-store" });
    res.end(await toolIndex());
    return;
  }
  if (path.endsWith("/")) path += "index.html";
  const file = join(root, normalize(path));
  if (!file.startsWith(root)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, {
      "content-type": types[extname(file)] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" }).end(`not found: ${path}`);
  }
}).listen(port, () => console.log(`http://localhost:${port}/`));
