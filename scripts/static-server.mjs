#!/usr/bin/env node
// Tiny zero-dependency static file server for local load/stress testing of
// built frontend assets (mirrors how a CDN would serve the dist/ output).
//
// Usage:
//   node scripts/static-server.mjs <rootDir> [port]

import http from "node:http";
import { createReadStream, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const root = process.argv[2];
const port = Number(process.argv[3] || 4173);
if (!root) {
  console.error("usage: node scripts/static-server.mjs <rootDir> [port]");
  process.exit(1);
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json",
  ".txt": "text/plain",
  ".wasm": "application/wasm",
};

const server = http.createServer((req, res) => {
  try {
    let pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    if (pathname.endsWith("/")) pathname += "index.html";
    const cleaned = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
    let file = join(root, cleaned);
    let st;
    try {
      st = statSync(file);
    } catch {
      // SPA fallback: extensionless routes are served by index.html.
      if (!extname(cleaned)) {
        file = join(root, "index.html");
        try {
          st = statSync(file);
        } catch {
          res.writeHead(404, { "content-type": "text/plain" });
          return res.end("not found");
        }
      } else {
        res.writeHead(404, { "content-type": "text/plain" });
        return res.end("not found");
      }
    }
    if (!st.isFile()) {
      res.writeHead(404, { "content-type": "text/plain" });
      return res.end("not found");
    }
    const immutable = cleaned.includes("/assets/");
    res.writeHead(200, {
      "content-type": MIME[extname(file).toLowerCase()] || "application/octet-stream",
      "content-length": st.size,
      "cache-control": immutable
        ? "public, max-age=31536000, immutable"
        : "no-cache",
    });
    if (req.method === "HEAD") return res.end();
    createReadStream(file).pipe(res);
  } catch {
    res.writeHead(500, { "content-type": "text/plain" });
    res.end("internal error");
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`static server on http://0.0.0.0:${port} serving ${root}`);
});
