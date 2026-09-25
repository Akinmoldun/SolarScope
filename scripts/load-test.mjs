#!/usr/bin/env node
// Zero-dependency HTTP load/stress tester for SolarScope.
//
// Usage:
//   node scripts/load-test.mjs --url http://127.0.0.1:4310/api/healthz [options]
//
// Options:
//   --url <u>        Target URL (required)
//   --conns <n>      Concurrent workers, one in-flight request each (default 8)
//   --duration <s>   Test duration in seconds (default 10)
//   --timeout <ms>   Per-request timeout in ms (default 5000)
//   --method <m>     HTTP method (default GET)
//   --rate <n>       Target total requests/sec (0 = as fast as possible, default 0)
//   --warmup <s>     Seconds of samples excluded from latency stats at the start (default 1)
//   --label <s>      Header label for the report
//   --json           Emit machine-readable JSON instead of a table

import http from "node:http";
import https from "node:https";

const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && i + 1 < argv.length ? argv[i + 1] : fallback;
};
const hasFlag = (name) => argv.includes(`--${name}`);

const rawUrl = opt("url");
if (!rawUrl) {
  console.error(
    "error: --url is required (e.g. --url http://127.0.0.1:4310/api/healthz)",
  );
  process.exit(1);
}
const target = new URL(rawUrl);
const mod = target.protocol === "https:" ? https : http;
const conns = Math.max(1, Number(opt("conns", 8)) || 1);
const durationMs = Math.max(0.5, Number(opt("duration", 10)) || 1) * 1000;
const timeoutMs = Math.max(1, Number(opt("timeout", 5000)) || 5000);
const method = (opt("method", "GET") || "GET").toUpperCase();
const rate = Math.max(0, Number(opt("rate", 0)) || 0);
const warmupMs = Math.max(0, Number(opt("warmup", 1)) || 0) * 1000;
const label = opt("label", "") || "";
const asJson = hasFlag("json");

const agent = new mod.Agent({ keepAlive: true, maxSockets: conns + 8 });

const lat = [];
const warmupLat = [];
const statusCounts = new Map();
const errorCounts = new Map();
let bytes = 0;
let sent = 0;
let completed = 0;
let stopped = false;
let workersRunning = conns;
const startedAt = performance.now();
const deadline = startedAt + durationMs;

function workerTick() {
  if (stopped || performance.now() >= deadline) {
    workersRunning -= 1;
    if (workersRunning === 0) finish();
    return;
  }
  if (rate > 0) {
    setTimeout(() => {
      if (stopped || performance.now() >= deadline) {
        workerTick();
      } else {
        send();
      }
    }, (conns * 1000) / rate);
  } else {
    send();
  }
}

function send() {
  sent += 1;
  const t0 = performance.now();
  const req = mod.request(
    {
      hostname: target.hostname,
      port: target.port || (target.protocol === "https:" ? 443 : 80),
      path: `${target.pathname}${target.search}`,
      method,
      agent,
      headers: { "user-agent": "solarscope-loadtest/1.0", accept: "*/*" },
    },
    (res) => {
      res.on("data", (chunk) => {
        bytes += chunk.length;
      });
      res.on("end", () => record(null, res.statusCode, t0));
      res.on("error", (err) => record(err, null, t0));
    },
  );
  req.setTimeout(timeoutMs, () => {
    req.destroy(Object.assign(new Error("timeout"), { code: "ETIMEDOUT" }));
  });
  req.on("error", (err) => record(err, null, t0));
  req.end();
}

function record(err, status, t0) {
  const now = performance.now();
  completed += 1;
  if (err) {
    const key = err.code || err.message || "error";
    errorCounts.set(key, (errorCounts.get(key) || 0) + 1);
  } else {
    statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
    (now < startedAt + warmupMs ? warmupLat : lat).push(now - t0);
  }
  workerTick();
}

process.on("SIGINT", () => {
  stopped = true;
});

let finished = false;
function finish() {
  if (finished) return;
  finished = true;
  const elapsed = Math.max(0.001, (performance.now() - startedAt) / 1000);
  const sorted = lat.slice().sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const at = (p) => {
    if (sorted.length === 0) return 0;
    const idx = Math.min(
      sorted.length - 1,
      Math.ceil((p / 100) * sorted.length) - 1,
    );
    return sorted[Math.max(0, idx)];
  };
  const r2 = (v) => Number(v.toFixed(2));
  const ok = [...statusCounts.entries()].reduce(
    (acc, [status, n]) => acc + (status >= 200 && status < 400 ? n : 0),
    0,
  );
  const result = {
    label,
    url: target.href,
    method,
    conns,
    durationSeconds: r2(elapsed),
    requestedRate: rate > 0 ? rate : null,
    sent,
    completed,
    ok,
    errorCount: [...errorCounts.values()].reduce((acc, v) => acc + v, 0),
    errors: Object.fromEntries(errorCounts),
    statusCounts: Object.fromEntries(statusCounts),
    rps: Number((completed / elapsed).toFixed(1)),
    latencyMs: {
      min: r2(sorted[0] ?? 0),
      p50: r2(at(50)),
      p75: r2(at(75)),
      p90: r2(at(90)),
      p95: r2(at(95)),
      p99: r2(at(99)),
      max: r2(sorted.at(-1) ?? 0),
      mean: sorted.length > 0 ? r2(sum / sorted.length) : 0,
    },
    warmupSamplesExcluded: warmupLat.length,
    bytes,
    bytesPerSecond: Math.round(bytes / elapsed),
    interrupted: stopped,
  };

  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    const row = (k, v) => console.log(`${k.padEnd(9)} ${v}`);
    row(
      "==",
      `${label || "load test"} (conns=${conns}, ${(durationMs / 1000).toFixed(0)}s, ${rate > 0 ? `rate=${rate}/s` : "max-rate"})`,
    );
    row("target", `${method} ${target.href}`);
    row("requests", `${completed}/${sent}${stopped ? " (interrupted)" : ""}`);
    row("rps", result.rps.toFixed(1));
    row(
      "ok",
      `${ok}/${completed} (${completed > 0 ? ((ok / completed) * 100).toFixed(1) : "0.0"}%)`,
    );
    row(
      "status",
      [...statusCounts.entries()].map(([s, n]) => `${s}=${n}`).join("  ") || "-",
    );
    row(
      "errors",
      result.errorCount === 0 ? "0" : JSON.stringify(result.errors),
    );
    const l = result.latencyMs;
    row(
      "latency",
      `p50 ${l.p50} | p75 ${l.p75} | p90 ${l.p90} | p95 ${l.p95} | p99 ${l.p99} | max ${l.max} | mean ${l.mean} (ms)`,
    );
    row(
      "transfer",
      `${(bytes / 1048576).toFixed(1)} MB (${(bytes / 1048576 / elapsed).toFixed(1)} MB/s)`,
    );
  }
  agent.destroy();
  process.exit(0);
}

setTimeout(finish, durationMs + 60000); // safety net

for (let i = 0; i < conns; i += 1) workerTick();
