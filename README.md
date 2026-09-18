# ☀️ SolarScope Simulator

SolarScope is an interactive solar-farm simulator that helps non-experts compare **fixed**, **single-axis**, and **dual-axis** panel tracking through visible physics and a simple investment model.

Orbit a real 3D WebGL solar field, watch the sun move across the sky, change panel count / efficiency / cloud cover / shading / electricity price, and see the power, energy, and payback numbers update — all from one shared, deterministic calculation so every result is reproducible and explainable.

## ✨ Features

- **Real 3D scene** — Three.js / React Three Fiber field with moving sun, sunlight rays, clouds, a shading tree with real shadows, and orbit/zoom/pan camera controls.
- **Three tracking strategies** — `FixedPanel`, `SingleAxisTracker`, and `DualAxisTracker` compared through one shared physics path.
- **Day animation** — play, pause, reset, and run-a-day controls with a live power curve.
- **Investment readout** — daily energy, annual energy value, and a simple payback recommendation.
- **Deterministic model** — the core equation `P = N × A × η × I × max(0, cos θ) × C × (1 − S)` is fully visible and traceable.

## 🧱 Tech Stack

| Layer     | Technology                                              |
| --------- | ------------------------------------------------------- |
| Language  | TypeScript 5.9                                          |
| Frontend  | React 19 + Vite 7, Tailwind CSS 4, shadcn/ui, wouter    |
| 3D        | Three.js + React Three Fiber + drei                     |
| Charts    | Recharts                                                |
| Workspace | pnpm workspaces (Node.js 20.19+ / 22.12+ / 24)          |
| Backend*  | Express 5 + PostgreSQL (Drizzle ORM) — *optional, not needed to preview the simulator* |

## 📁 Project Structure

```
.
├── artifacts/
│   ├── solar-scope/          # ⭐ The simulator app (this is what you preview)
│   │   ├── src/
│   │   │   ├── App.tsx           # UI, controls, metrics, charts
│   │   │   ├── components/
│   │   │   │   ├── solar-scene.tsx   # Three.js / R3F 3D scene
│   │   │   │   └── ui/               # shadcn/ui components
│   │   │   ├── lib/
│   │   │   │   ├── simulation.ts     # ⚙️ Solar position, power, energy, payback math
│   │   │   │   └── utils.ts
│   │   │   └── index.css             # Dark scientific theme
│   │   └── vite.config.ts
│   ├── api-server/           # Express API (needs DATABASE_URL — optional)
│   └── mockup-sandbox/       # Design mockup playground
├── lib/                      # Shared packages (db, api-spec, api clients)
├── docs/
│   └── solar-scope-project-guide.md  # Full proposal, scope & architecture guide
├── package.json              # Workspace root
└── pnpm-workspace.yaml
```

---

## 🚀 Run It Locally On Your PC

### Step 0 — Prerequisites

Install these first (one-time setup):

1. **Git** — <https://git-scm.com/downloads>
2. **Node.js** — version **20.19+, 22.12+, or 24**. Check with:
   ```bash
   node -v
   ```
   Download from <https://nodejs.org> if needed.
3. **pnpm** — this repo **requires pnpm** (npm/yarn are deliberately blocked by a preinstall check). Enable it via corepack, which ships with Node.js:
   ```bash
   corepack enable
   pnpm -v   # should print v10.x (or 9.x)
   ```
   > If `corepack` isn't available, install pnpm manually: `npm install -g pnpm`

### Step 1 — Clone the repository

```bash
git clone https://github.com/<your-username>/<your-repo>.git
cd <your-repo>
```

> Replace the URL with your repo's actual clone URL (green **Code** button on GitHub).

### Step 2 — Install dependencies

From the **repository root** (do not `cd` into the app folder — pnpm needs the workspace root):

```bash
pnpm install
```

This installs all workspace packages in one go. It may take a couple of minutes.

> ⚠️ If you see `Use pnpm instead`, you ran `npm install` / `yarn install` — the project intentionally rejects them for supply-chain safety. Use `pnpm install`.

### Step 3 — Start the dev server

The Vite config in this workspace reads the port and base path from environment variables, so set them inline when you run it:

**macOS / Linux:**
```bash
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/solar-scope run dev
```

**Windows (PowerShell):**
```powershell
$env:PORT="5173"; $env:BASE_PATH="/"; pnpm --filter @workspace/solar-scope run dev
```

**Windows (Command Prompt):**
```cmd
set PORT=5173&& set BASE_PATH=/&& pnpm --filter @workspace/solar-scope run dev
```

### Step 4 — Open it in your browser

Visit:

```
http://localhost:5173/
```

You should see the dark-themed simulator with the 3D solar field. Press **▶ Play** to animate a day and watch the panels track the sun. 🌞

### (Optional) Step 5 — Build a production bundle

```bash
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/solar-scope run build
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/solar-scope run serve
```

`build` outputs static files to `artifacts/solar-scope/dist/public/`, and `serve` serves them locally. The build must finish before `serve` works.

---

## 🛠️ Other Useful Commands

Run from the repository root:

| Command                                        | What it does                                  |
| ---------------------------------------------- | --------------------------------------------- |
| `pnpm run typecheck`                           | Typechecks all packages                       |
| `pnpm run build`                               | Typechecks + builds every package             |
| `pnpm --filter @workspace/solar-scope run dev` | Dev server for the simulator (needs PORT/BASE_PATH) |
| `pnpm --filter @workspace/solar-scope run typecheck` | Typechecks just the simulator           |

> The `api-server` package needs a `DATABASE_URL` (PostgreSQL) to run and is **not required** to preview the simulator — the app is fully client-side.

---

## 🔧 Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Error: Use pnpm instead` during install | You used npm/yarn. Run `pnpm install` instead. |
| `PORT environment variable is required but was not provided.` (or the same for `BASE_PATH`) | The Vite config requires both env vars. Prefix the dev command as shown in Step 3. |
| `pnpm: command not found` | Run `corepack enable`, or `npm install -g pnpm`. |
| Port already in use | Change `PORT=5173` to any free port, e.g. `PORT=3000`, and open that URL instead. |
| Blank page / 3D scene missing | Use a modern browser with WebGL enabled (Chrome, Edge, Firefox, Safari). Try a hard refresh (`Ctrl/Cmd + Shift + R`). |
| Engine / Node version warnings | Make sure `node -v` reports 20.19+, 22.12+, or 24. |

---

## 📚 Learn More

- [`docs/solar-scope-project-guide.md`](docs/solar-scope-project-guide.md) — proposal, scope, simulation math, class diagram, and presentation plan.
- The simulation model lives in [`artifacts/solar-scope/src/lib/simulation.ts`](artifacts/solar-scope/src/lib/simulation.ts).
- The 3D scene lives in [`artifacts/solar-scope/src/components/solar-scene.tsx`](artifacts/solar-scope/src/components/solar-scene.tsx).

## 📄 License

MIT
