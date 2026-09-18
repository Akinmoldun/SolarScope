# SolarScope Simulator

SolarScope is an interactive solar-farm simulation that helps non-experts compare fixed, single-axis, and dual-axis panel tracking through visible physics and a simple investment model.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/solar-scope/src/App.tsx` — the simulator controls, metrics, investor readout, and power curve.
- `artifacts/solar-scope/src/lib/simulation.ts` — deterministic solar position, 3D orientation classes, power, energy, and payback calculations.
- `artifacts/solar-scope/src/components/solar-scene.tsx` — the real Three.js / React Three Fiber field, Sun, rays, clouds, shading object, shadows, and camera controls.
- `artifacts/solar-scope/src/index.css` — the dark scientific presentation layout and responsive styling.
- `docs/solar-scope-project-guide.md` — proposal, scope, simulation explanation, class diagram, task plan, presentation plan, and report outline.

## Architecture decisions

- The first version is client-side and deterministic so every demonstration result is reproducible and explainable.
- The model uses transparent approximations instead of external weather or solar APIs.
- Panel strategies are compared through one shared calculation path so changes in assumptions affect all three curves consistently.
- The scene uses real WebGL meshes and lighting, but the model remains separate so the physics is explainable without hiding it inside rendering code.

## Product

Users can orbit a 3D solar field, change panel count, efficiency, cloud cover, shading, electricity price, and tracker hardware cost; animate a day; compare three tracking architectures in one scene or side by side; inspect power and energy charts; and read a model-based investment recommendation.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
