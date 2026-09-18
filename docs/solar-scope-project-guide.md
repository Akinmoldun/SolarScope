# SolarScope project guide

## Short project proposal

SolarScope is a Three.js-powered interactive simulation that demonstrates how the position of the Sun, panel orientation, weather, shading, and tracking hardware affect solar-panel energy production. Users can orbit a real 3D solar field, compare fixed, single-axis, and dual-axis arrays through animation and graphs, and use a simple return-on-investment estimate to evaluate when a more expensive tracking system is commercially worthwhile.

## Project scope

SolarScope is intentionally a solo-project scope. It models one solar field and three panel strategies:

- Fixed tilt: low capital cost and no moving parts.
- Single-axis tracking: follows the Sun from east to west.
- Dual-axis tracking: follows both the Sun's east-west and altitude movement.

The user can orbit, zoom, and pan around the field; change panel count, module efficiency, cloud cover, nearby shading, electricity price, and tracker hardware cost; and switch to an optional three-field comparison view. The application responds with a moving 3D Sun, physically rotated panel meshes, visible sunlight rays, a tree that casts shadows, current power, daily energy, annual energy value, a through-the-day comparison chart, and a recommended investment path.

The simulation is an educational model rather than an engineering quotation. Its value is that every assumption is visible and every output can be traced back to a small number of understandable equations.

## Technical approach

SolarScope is a client-side React, TypeScript, Three.js, and React Three Fiber application. The simulation is deterministic: the same inputs always produce the same outputs, which makes the tool reliable during a presentation and easy to validate with hand calculations. The numerical model is kept in `src/lib/simulation.ts`; the WebGL rendering interface is kept in `src/components/solar-scene.tsx`.

For each time step in the selected day:

1. Calculate an approximate solar altitude and azimuth.
2. Calculate the panel's incidence angle for the selected tracking strategy.
3. Convert the angle into an alignment factor using `max(0, cos(theta))`.
4. Apply daylight, cloud, and shading factors.
5. Calculate power for the selected panel count.
6. Add power over the time interval to estimate daily energy.
7. Convert daily energy into annual energy value and a simple payback period.

The central educational equation shown in the interface is:

```text
P = N × A × η × I × max(0, cos θ) × C × (1 − S)
```

Where:

- `N` is the number of modules.
- `A` is the total panel area.
- `η` is module efficiency.
- `I` is peak solar irradiance.
- `θ` is the angle between the Sun's rays and the panel normal.
- `C` is the effective cloud multiplier and `S` is the effective shading fraction.

The model uses a 15-minute step for daily energy and a continuous slider for the animated time readout. The Sun is above the horizon from 5:30 AM to 6:30 PM, reaches a simplified 64-degree altitude at noon, and drives both the calculation and the 3D light position.

## 3D scene approach

The primary visual is a real WebGL scene rather than a flat dashboard illustration:

- Each visible module is a box mesh with thickness, frame rails, cell separators, a support post, and a footing.
- `FixedPanel`, `SingleAxisTracker`, and `DualAxisTracker` produce different 3D orientations from the same Sun position.
- `Sun` maps the simulated altitude and azimuth to a moving 3D light source and emissive Sun mesh.
- Gold dashed lines visualize the incoming sunlight direction.
- `SolarField` lays out the modules in rows and columns.
- `ShadingObject` represents a tree with trunk and foliage; it casts a real shadow when WebGL shadows are available.
- `OrbitControls` provides camera orbit, zoom, and pan. The optional comparison mode places three smaller fields side by side under the same Sun.
- `CloudLayer` changes its visible opacity from the cloud-cover control.

The 3D scene is intentionally separated from the model. A presenter can explain the mathematics without needing to understand React Three Fiber, and can explain the scene components without treating rendering code as physics.

## Why the model is simplified

The application does not attempt to reproduce a particular site's complete atmospheric, electrical, or mechanical behavior. It omits temperature coefficients, inverter losses, latitude/longitude calculations, maintenance, battery storage, seasonal weather, and detailed row geometry. The tree provides a visible 3D shading object, but the current power equation uses the user-controlled shading fraction as the transparent educational input. These are appropriate future enhancements, but including them in the first version would make the code harder to explain without improving the central demonstration.

## Three-week solo task plan

### Week 1: model and proof of concept

- Confirm requirements and write down assumptions.
- Sketch the user flow and screen layout.
- Implement solar position and incidence-angle functions.
- Implement the shared panel class and the three tracking strategies.
- Implement power and daily-energy calculations.
- Check the model with simple cases: night is zero, a perpendicular panel has maximum alignment, and a 90-degree incidence angle contributes approximately zero.
- Render the first moving Sun and panel field.

### Week 2: interactive simulator

- Add the scenario controls.
- Add panel-array rendering.
- Add play, pause, reset, and run-a-day controls.
- Add the power-through-the-day comparison chart.
- Add daily energy, annual value, and payback calculations.
- Add the investor recommendation.
- Explain the equation and assumptions inside the interface.

### Week 3: evidence and presentation

- Validate representative results by hand.
- Test extreme and invalid input cases.
- Improve responsive layout, labels, contrast, and animation.
- Capture screenshots for the report.
- Finish the class-hierarchy diagram and report figures.
- Rehearse a six-minute presentation with a fixed demo scenario.
- Prepare screenshots as a backup to the live demo.

## Class hierarchy and responsibilities

The only user-defined class hierarchy is between the panel strategies. The numerical simulation and financial calculations are pure functions in the same module; this is deliberate because it keeps the equations easy to trace. The UI is composed of React function components, which are not part of the scientific class hierarchy.

```mermaid
classDiagram
    class SolarPanel {
        <<base class>>
        +area: number
        +orientationFor(sun)
        +incidenceAngle(sun)
    }
    class FixedPanel {
        +orientationFor(sunPosition)
    }
    class SingleAxisTracker {
        +orientationFor(sunPosition)
    }
    class DualAxisTracker {
        +orientationFor(sun)
    }
    class Sun {
        +positionAt(time)
    }
    class SolarField {
        +rows: number
        +columns: number
        +positions()
    }
    class ShadingObject {
        +position: vector3
        +estimatedFraction(shading)
    }
    SolarPanel <|-- FixedPanel
    SolarPanel <|-- SingleAxisTracker
    SolarPanel <|-- DualAxisTracker
    Sun ..> SolarPanel : supplies position
    SolarField --> SolarPanel : lays out modules
    ShadingObject ..> SolarField : casts shadow
```

The rest of the implementation is organized as functions and data:

- `solarPosition`, `powerAt`, `simulateDay`, and `projectAt` form the simulation pipeline.
- `dailyEnergy`, `annualValue`, `capitalCost`, and `paybackYears` form the financial readout.
- `recommendation` evaluates all three strategies with the same scenario inputs.
- `src/components/solar-scene.tsx` handles the Canvas, lighting, shadows, meshes, camera controls, comparison fields, cloud layer, and 3D labels.
- React components in `App.tsx` handle controls, animation, chart rendering, and display.

This is an intentional alternative to a deep hierarchy: the only behavior that varies by type is panel tracking, so only that behavior uses inheritance.

## Verification note

Type checking and the production build pass. The shared preview environment used for development reports that it cannot create a hardware WebGL context, so it shows the explicit WebGL-unavailable message instead of a crash overlay. The actual Three.js scene is implemented in the code and must be checked in a hardware-accelerated browser before the final presentation; that browser check is a required final project step, not a claim made by this preview.

## Presentation plan: approximately six minutes

1. **0:00–0:45 — Problem:** solar investors must compare extra energy against tracking hardware cost.
2. **0:45–1:30 — Scientific idea:** useful energy depends on the angle between sunlight and the panel.
3. **1:30–2:30 — Technical approach:** explain the time steps, the core equation, and the three tracking strategies.
4. **2:30–4:30 — Demonstration:** run the default day, change the tracking mode, then increase cloud cover or shading.
5. **4:30–5:15 — Results:** show daily energy, annual value, chart separation, and payback.
6. **5:15–6:00 — Commercial version:** discuss real weather, location data, maintenance, battery storage, and uncertainty.

The safest demonstration sequence is:

1. Start at solar noon with the default single-axis scenario.
2. Press **run a day** so the Sun and the field animate.
3. Select **Fixed tilt** and point out the lower curve.
4. Select **Dual-axis** and point out the improved alignment.
5. Increase cloud cover and explain why all strategies fall together.
6. Return to single-axis and finish on the investor readout.

## Report outline

### 1. Problem statement and background

Describe the energy-versus-cost decision and why panel orientation matters. Define the target user as a non-expert investor or project planner.

### 2. Technical approach and simulation method

Explain the Sun approximation, incidence angle, power equation, time stepping, weather/shading factors, and financial model. State the assumptions and limitations explicitly.

### 3. Software design

Include the class-hierarchy diagram, the data flow from controls to simulation to chart, and short explanations of the simulation, financial, and rendering responsibilities.

### 4. Results and screenshots

Include the default scenario, a fixed-versus-tracking comparison, a weather/shading sensitivity example, and screenshots of the stage, controls, chart, and investor readout. Explain what each result means rather than only listing numbers.

### 5. Future commercial version

Discuss location-specific Sun paths, real weather feeds, temperature and inverter losses, detailed shading geometry, maintenance costs, battery storage, grid tariffs, uncertainty ranges, and exporting a feasibility report.

## Commercial-version enhancements

- Accept latitude, longitude, date, and roof orientation.
- Use historical weather and satellite irradiance data.
- Model temperature, inverter efficiency, wiring loss, and panel degradation.
- Add row spacing and time-dependent shadows.
- Include maintenance and replacement costs in the payback model.
- Add battery storage and time-of-use electricity pricing.
- Show optimistic, typical, and conservative scenarios rather than one deterministic answer.
- Export a short investor report containing assumptions, charts, and a recommendation.