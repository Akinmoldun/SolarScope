export type TrackingMode = 'fixed' | 'single' | 'dual';

export type SimulationConfig = {
  panels: number;
  efficiency: number;
  clouds: number;
  shading: number;
  price: number;
  hardwareCost: number;
  mode: TrackingMode;
};

export type SunPosition = {
  altitude: number;
  azimuth: number;
};

export type SolarPoint = SunPosition & {
  time: number;
  power: number;
  incidence: number;
};

export type PanelOrientation = {
  tilt: number;
  yaw: number;
};

const PANEL_AREA = 2.1;
const IRRADIANCE = 1000;
const FIXED_HARDWARE = 280;

export const modeLabels: Record<TrackingMode, string> = {
  fixed: 'Fixed tilt',
  single: 'Single-axis',
  dual: 'Dual-axis',
};

/**
 * Shared base for the three physical panel strategies.
 * The scene uses the returned orientation to rotate real 3D meshes.
 */
export abstract class SolarPanel {
  readonly area = PANEL_AREA;

  abstract orientationFor(sun: SunPosition): PanelOrientation;

  incidenceAngle(sun: SunPosition) {
    const orientation = this.orientationFor(sun);
    const normal = normalFromOrientation(orientation);
    const incoming = sunVector(sun);
    const dot = normal[0] * incoming[0] + normal[1] * incoming[1] + normal[2] * incoming[2];
    return Math.acos(Math.max(-1, Math.min(1, dot))) * (180 / Math.PI);
  }
}

export class FixedPanel extends SolarPanel {
  orientationFor() {
    return { tilt: 28, yaw: 0 };
  }
}

export class SingleAxisTracker extends SolarPanel {
  orientationFor(sun: SunPosition) {
    return { tilt: 28, yaw: sun.azimuth * 0.7 };
  }
}

export class DualAxisTracker extends SolarPanel {
  orientationFor(sun: SunPosition) {
    return { tilt: Math.max(6, 90 - sun.altitude), yaw: sun.azimuth };
  }
}

/** A group of panels that can be positioned as a single 3D field. */
export class SolarField {
  constructor(
    public readonly rows = 3,
    public readonly columns = 5,
    public readonly spacing = 2.8,
  ) {}

  positions() {
    return Array.from({ length: this.rows * this.columns }, (_, index) => {
      const row = Math.floor(index / this.columns);
      const column = index % this.columns;
      return [
        (column - (this.columns - 1) / 2) * this.spacing,
        0,
        (row - (this.rows - 1) / 2) * this.spacing,
      ] as [number, number, number];
    });
  }
}

/** A physical obstruction that can cast a real shadow in the WebGL scene. */
export class ShadingObject {
  constructor(
    public readonly position: [number, number, number] = [5.4, 0, -1.6],
    public readonly radius = 1.6,
  ) {}

  estimatedFraction(shading: number) {
    return Math.max(0, Math.min(1, shading));
  }
}

/** Sun is a model object as well as the source of the scene's moving light. */
export class Sun {
  positionAt(time: number): [number, number, number] {
    const sun = solarPosition(time);
    const altitude = (sun.altitude * Math.PI) / 180;
    const azimuth = (sun.azimuth * Math.PI) / 180;
    const radius = 13;
    return [
      Math.sin(azimuth) * Math.cos(altitude) * radius,
      Math.max(0.35, Math.sin(altitude) * radius),
      Math.cos(azimuth) * Math.cos(altitude) * radius,
    ];
  }
}

function panelForMode(mode: TrackingMode): SolarPanel {
  if (mode === 'dual') return new DualAxisTracker();
  if (mode === 'single') return new SingleAxisTracker();
  return new FixedPanel();
}

export function orientationForMode(mode: TrackingMode, sun: SunPosition) {
  return panelForMode(mode).orientationFor(sun);
}

export function solarPosition(time: number): SunPosition {
  const daylight = Math.max(0, Math.min(1, (time - 6) / 12));
  const altitude = daylight <= 0 || daylight >= 1 ? 0 : Math.sin(daylight * Math.PI) * 64;
  const azimuth = (time - 12) * 11.5;
  return { altitude, azimuth };
}

export function sunVector(sun: SunPosition): [number, number, number] {
  const altitude = (sun.altitude * Math.PI) / 180;
  const azimuth = (sun.azimuth * Math.PI) / 180;
  return [
    Math.sin(azimuth) * Math.cos(altitude),
    Math.sin(altitude),
    Math.cos(azimuth) * Math.cos(altitude),
  ];
}

export function normalFromOrientation(orientation: PanelOrientation): [number, number, number] {
  const tilt = (orientation.tilt * Math.PI) / 180;
  const yaw = (orientation.yaw * Math.PI) / 180;
  return [
    Math.sin(yaw) * Math.sin(tilt),
    Math.cos(tilt),
    Math.cos(yaw) * Math.sin(tilt),
  ];
}

export function incidenceAngle(mode: TrackingMode, altitude: number, azimuth: number) {
  return panelForMode(mode).incidenceAngle({ altitude, azimuth });
}

export function powerAt(time: number, config: SimulationConfig) {
  const sun = solarPosition(time);
  const incidence = incidenceAngle(config.mode, sun.altitude, sun.azimuth);
  const angleFactor = Math.max(0, Math.cos((incidence * Math.PI) / 180));
  const daylightFactor = Math.max(0, Math.sin((sun.altitude * Math.PI) / 180));
  const cloudFactor = 1 - config.clouds * 0.68;
  const shadeFactor = 1 - config.shading * 0.72;
  const gentleAtmosphere = 0.91 + Math.max(0, sun.altitude - 25) / 1000;
  const watts =
    config.panels *
    PANEL_AREA *
    IRRADIANCE *
    config.efficiency *
    daylightFactor *
    angleFactor *
    cloudFactor *
    shadeFactor *
    gentleAtmosphere;
  return {
    power: Math.max(0, watts / 1000),
    altitude: sun.altitude,
    azimuth: sun.azimuth,
    incidence,
  };
}

export function simulateDay(config: SimulationConfig, step = 0.25): SolarPoint[] {
  const points: SolarPoint[] = [];
  for (let time = 5.5; time <= 18.5; time += step) {
    points.push({ time, ...powerAt(time, config) });
  }
  return points;
}

export function dailyEnergy(config: SimulationConfig) {
  return simulateDay(config).reduce((total, point) => total + point.power * 0.25, 0);
}

export function annualValue(config: SimulationConfig) {
  return dailyEnergy(config) * 365 * config.price;
}

export function capitalCost(config: SimulationConfig) {
  const hardwareMultiplier = config.mode === 'dual' ? 1.8 : config.mode === 'single' ? 1.22 : 1;
  return config.panels * (config.mode === 'fixed' ? FIXED_HARDWARE : config.hardwareCost * hardwareMultiplier);
}

export function paybackYears(config: SimulationConfig) {
  const value = annualValue(config);
  return value > 0 ? capitalCost(config) / value : 99;
}

export function projectAt(config: SimulationConfig, time: number) {
  return powerAt(time, config);
}

export function recommendation(config: SimulationConfig) {
  const options: TrackingMode[] = ['fixed', 'single', 'dual'];
  const results = options.map((mode) => {
    const candidate = { ...config, mode };
    return { mode, payback: paybackYears(candidate), energy: dailyEnergy(candidate) };
  });
  const best = results.reduce((winner, item) => (item.payback < winner.payback ? item : winner));
  const bestLabel = modeLabels[best.mode].toLowerCase();
  const note =
    best.mode === config.mode
      ? `At this site profile, ${bestLabel} returns the investment fastest without hiding the operating assumptions.`
      : `${bestLabel[0].toUpperCase()}${bestLabel.slice(1)} is the clearest investment case at this site profile.`;
  return { ...best, note, results };
}

export function formatClock(time: number) {
  const hour = Math.floor(time);
  const minutes = Math.round((time - hour) * 60);
  const normalizedHour = hour % 24;
  const suffix = normalizedHour >= 12 ? 'PM' : 'AM';
  const displayHour = normalizedHour % 12 || 12;
  return `${displayHour}:${String(minutes).padStart(2, '0')} ${suffix}`;
}