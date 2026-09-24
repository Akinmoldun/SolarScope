# SolarScope

SolarScope is an interactive solar-farm simulator that helps non-experts compare **fixed**, **single-axis**, and **dual-axis** panel tracking through visible physics and a simple investment model.

Orbit a real 3D WebGL solar field, watch the sun move across the sky, change panel count / efficiency / cloud cover / shading / electricity price, and see the power, energy, and payback numbers update — all from one shared, deterministic calculation so every result is reproducible and explainable.

## Features

- **Real 3D scene**: Three.js / React Three Fiber field with a moving sun, sunlight rays, clouds, a shading tree with real shadows, and orbit/zoom/pan camera controls.
- **Three tracking strategies**: `FixedPanel`, `SingleAxisTracker`, and `DualAxisTracker` compared through one shared physics path.
- **Day animation**: play, pause, reset, and run-a-day controls with a live power curve.
- **Investment readout**: daily energy, annual energy value, and a simple payback recommendation.
- **Deterministic model**: the core equation `P = N × A × η × I × max(0, cos θ) × C × (1 − S)` is fully visible and traceable.

## Tech Stack

| Layer     | Technology                                     |
| --------- | ---------------------------------------------- |
| Language  | TypeScript 5.9                                 |
| Frontend  | React 19 + Vite 7, Tailwind CSS 4, shadcn/ui, wouter |
| 3D        | Three.js + React Three Fiber + drei            |
| Workspace | pnpm workspaces (Node.js 20.19+ / 22.12+ / 24) |
| API       | Express 5, pino logging, Zod-validated routes  |
| Database  | PostgreSQL + Drizzle ORM (optional — not needed for the simulator) |

The deployed app is fully client-side; the API server is an optional companion that currently exposes a single health endpoint.

## Project Structure

```
.
├── artifacts/
│   ├── solar-scope/          # The simulator app (this is what you run)
│   │   ├── src/
│   │   │   ├── App.tsx               # UI, controls, metrics, charts
│   │   │   ├── components/
│   │   │   │   ├── solar-scene.tsx   # Three.js / R3F 3D scene
│   │   │   │   ├── error-boundary.tsx
│   │   │   │   └── ui/               # shadcn/ui components
│   │   │   ├── lib/
│   │   │   │   ├── simulation.ts     # Solar position, power, energy, payback math
│   │   │   │   └── utils.ts
│   │   │   └── index.css             # Dark scientific theme
│   │   └── vite.config.ts
│   └── api-server/           # Express API + Vercel serverless entry (optional)
├── lib/                      # Shared packages (db, api-spec, api clients)
├── scripts/                  # Workspace maintenance scripts (pnpm guard)
├── docs/
│   └── solar-scope-project-guide.md  # Full proposal, scope & architecture guide
├── package.json              # Workspace root
└── pnpm-workspace.yaml
```

## Getting Started

### Prerequisites

1. **Node.js** 20.19+, 22.12+, or 24 — check with `node -v` (<https://nodejs.org>).
2. **pnpm** — this repo **requires pnpm** (npm/yarn are deliberately blocked by a preinstall check). Enable it via corepack, which ships with Node.js:

   ```bash
   corepack enable
   pnpm -v   # should print v10.x (or 9.x)
   ```

   > If `corepack` isn't available, install pnpm manually: `npm install -g pnpm`.

### Install and run

```bash
git clone https://github.com/Akinmoldun/SolarScope.git
cd SolarScope
pnpm install
```

Then start the simulator (no environment variables needed — the Vite config defaults to `PORT=5173`, `BASE_PATH=/`):

```bash
pnpm --filter @workspace/solar-scope run dev
```

Open <http://localhost:5173/>, press **Play**, and watch the panels track the sun.

### Production build (local)

```bash
pnpm --filter @workspace/solar-scope run build   # static files in artifacts/solar-scope/dist/public
pnpm --filter @workspace/solar-scope run serve   # serve the built bundle locally
```

### Typecheck and full workspace build

```bash
pnpm run typecheck   # typechecks libs + all packages
pnpm run build       # typecheck + build every package
```

## Environment Variables

Copy `.env.example` to `.env.local` and fill in only what you use. Real values are never committed. None of these are required to run the simulator.

| Variable       | Used by                | Default   | Purpose                                                     |
| -------------- | ---------------------- | --------- | ----------------------------------------------------------- |
| `PORT`         | frontend, API server   | `5173` (Vite) / required (API) | Server port                                |
| `BASE_PATH`    | frontend               | `/`       | Vite base path (change when serving from a sub-path)         |
| `DATABASE_URL` | `lib/db`, API server   | —         | PostgreSQL connection string (API server / Drizzle tooling)  |
| `LOG_LEVEL`    | API server             | `info`    | pino log level (`trace`…`fatal`)                             |

## Optional API Server

```bash
DATABASE_URL=postgres://user:password@localhost:5432/solarscope PORT=3000 \
  pnpm --filter @workspace/api-server run dev
```

- `GET /api/healthz` → `{"status":"ok"}`
- Routes are validated with Zod schemas generated from [`lib/api-spec/openapi.yaml`](lib/api-spec/openapi.yaml); regenerate clients with `pnpm --filter @workspace/api-spec run codegen`.
- Push database schema changes (dev only): `pnpm --filter @workspace/db run push`.

## Deployment (Vercel)

The repository deploys to Vercel as **one project** that serves both the static app and the API:

1. Import the repo into Vercel.
2. Set **Root Directory** to `artifacts/api-server`.
3. Leave all build settings on "auto" — [`artifacts/api-server/vercel.json`](artifacts/api-server/vercel.json) already defines:
   - install: `pnpm install`
   - build: builds the solar-scope frontend, then the API server bundle
   - output: `dist` (the frontend static site)
   - rewrites: `/api/(.*)` → the serverless function in `api/index.js`
4. No environment variables are needed for the default deployment.

After deploying, if the site asks you to log in with Vercel, open **Settings → Deployment Protection** in the Vercel dashboard and disable Vercel Authentication to make the deployment publicly accessible.

The app is a single-page simulator at `/`; unknown `/api/*` paths return a 404 JSON error from Express.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Error: Use pnpm instead` during install | You used npm/yarn. Run `pnpm install` instead. |
| `Ignored build scripts: esbuild` | On the `pnpm approve-builds` prompt, select esbuild with Space, then confirm with Enter. Newer clones already allow it via the workspace config. |
| `pnpm: command not found` | Run `corepack enable`, or `npm install -g pnpm`. |
| Port already in use | Set `PORT=3000` (or any free port) when starting the dev server. |
| Blank page / 3D scene missing | Use a modern browser with WebGL enabled (Chrome, Edge, Firefox, Safari). Try a hard refresh (`Ctrl/Cmd + Shift + R`). |
| Engine / Node version warnings | Make sure `node -v` reports 20.19+, 22.12+, or 24. |

## Learn More

- The [project guide](docs/solar-scope-project-guide.md) covers the proposal, scope, simulation math, class diagram, and presentation plan.
- The simulation model lives in [`artifacts/solar-scope/src/lib/simulation.ts`](artifacts/solar-scope/src/lib/simulation.ts).
- The 3D scene lives in [`artifacts/solar-scope/src/components/solar-scene.tsx`](artifacts/solar-scope/src/components/solar-scene.tsx).

## License

This project is licensed under a custom license based on the MIT License, with two additional restrictions:

- **Attribution required**: anyone who uses, shares, or talks about the project or its derivatives must credit the creator, Akinmoldun, and link back to the [original repository](https://github.com/Akinmoldun/SolarScope).
- **No selling**: the project or its derivatives may not be sold or included in paid products or services without prior written permission from the copyright holder.

See the [LICENSE](LICENSE) file for full terms.
