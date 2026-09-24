import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { cpSync, existsSync } from "node:fs";
import { rm } from "node:fs/promises";

// Plugins (e.g. 'esbuild-plugin-pino') may use `require` to resolve dependencies
globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));

// Static web output served by Vercel. The solar-scope frontend (see vercel.json
// buildCommand) is published here so `/` serves the app UI, while /api/* is
// handled by the serverless function in api/index.js.
const staticDir = path.resolve(artifactDir, "dist");

// Long-running server bundle for `pnpm run start` (local dev). Kept out of
// dist/ so server bundles and sourcemaps are never served as public files.
const serverDistDir = path.resolve(artifactDir, "dist-server");

// Where the solar-scope frontend writes its build (vite.config.ts build.outDir).
const frontendDistDir = path.resolve(artifactDir, "../solar-scope/dist/public");

async function buildAll() {
  await rm(staticDir, { recursive: true, force: true });
  await rm(serverDistDir, { recursive: true, force: true });

  // vercel.json builds the frontend before this script; when its output is
  // present, publish it as the static site. (Locally the frontend may not have
  // been built — skip silently so `pnpm run dev` keeps working.)
  if (existsSync(frontendDistDir)) {
    cpSync(frontendDistDir, staticDir, { recursive: true });
    console.log(
      `copied frontend build ${path.relative(artifactDir, frontendDistDir)} -> ${path.relative(artifactDir, staticDir)}`,
    );
  }

  // Bundles the serverless handler for Vercel. Fully bundled (no externals)
  // so the api/ directory is self-contained: @workspace/* TS sources and all
  // node_modules deps are inlined, and Vercel has nothing to resolve.
  // No pino transport plugin here: on Vercel NODE_ENV=production the logger
  // runs without transports, so no worker chunks are needed.
  await esbuild({
    entryPoints: [path.resolve(artifactDir, "src/api.ts")],
    platform: "node",
    bundle: true,
    format: "cjs",
    target: "node20",
    outfile: path.resolve(artifactDir, "api/index.js"),
    logLevel: "info",
    sourcemap: false,
  });

  await esbuild({
    entryPoints: [path.resolve(artifactDir, "src/index.ts")],
    platform: "node",
    bundle: true,
    format: "esm",
    outdir: serverDistDir,
    outExtension: { ".js": ".mjs" },
    logLevel: "info",
    // Some packages may not be bundleable, so we externalize them, we can add more here as needed.
    // Some of the packages below may not be imported or installed, but we're adding them in case they are in the future.
    // Examples of unbundleable packages:
    // - uses native modules and loads them dynamically (e.g. sharp)
    // - use path traversal to read files (e.g. @google-cloud/secret-manager loads sibling .proto files)
    external: [
      "*.node",
      "sharp",
      "better-sqlite3",
      "sqlite3",
      "canvas",
      "bcrypt",
      "argon2",
      "fsevents",
      "re2",
      "farmhash",
      "xxhash-addon",
      "bufferutil",
      "utf-8-validate",
      "ssh2",
      "cpu-features",
      "dtrace-provider",
      "isolated-vm",
      "lightningcss",
      "pg-native",
      "oracledb",
      "mongodb-client-encryption",
      "nodemailer",
      "handlebars",
      "knex",
      "typeorm",
      "protobufjs",
      "onnxruntime-node",
      "@tensorflow/*",
      "@prisma/client",
      "@mikro-orm/*",
      "@grpc/*",
      "@swc/*",
      "@aws-sdk/*",
      "@azure/*",
      "@opentelemetry/*",
      "@google-cloud/*",
      "@google/*",
      "googleapis",
      "firebase-admin",
      "@parcel/watcher",
      "@sentry/profiling-node",
      "@tree-sitter/*",
      "aws-sdk",
      "classic-level",
      "dd-trace",
      "ffi-napi",
      "grpc",
      "hiredis",
      "kerberos",
      "leveldown",
      "miniflare",
      "mysql2",
      "newrelic",
      "odbc",
      "piscina",
      "realm",
      "ref-napi",
      "rocksdb",
      "sass-embedded",
      "sequelize",
      "serialport",
      "snappy",
      "tinypool",
      "usb",
      "workerd",
      "wrangler",
      "zeromq",
      "zeromq-prebuilt",
      "playwright",
      "puppeteer",
      "puppeteer-core",
      "electron",
    ],
    sourcemap: "linked",
    plugins: [
      // pino relies on workers to handle logging, instead of externalizing it we use a plugin to handle it
      esbuildPluginPino({ transports: ["pino-pretty"] })
    ],
    // Make sure packages that are cjs only (e.g. express) but are bundled continue to work in our esm output file
    banner: {
      js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';

globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
    `,
    },
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
