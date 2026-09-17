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

export type SolarPoint = {
  time: number;
  altitude: number;
  azimuth: number;
  power: number;
  incidence: number;
};

const PANEL_AREA = 2.1;
const IRRADIANCE = 1000;
const FIXED_HARDWARE = 280;

export const modeLabels: Record<TrackingMode, string> = {
  fixed: 'Fixed tilt',
  single: 'Single-axis',
  dual: 'Dual-axis',
};

export abstract class SolarPanel {
  readonly area = PANEL_AREA;

  abstract incidenceAngle(altitude: number, azimuth: number): number;
}

export class FixedPanel extends SolarPanel {
  incidenceAngle(altitude: number, azimuth: number) {
    if (altitude <= 0) return 90;
    return Math.min(89, Math.sqrt(Math.pow(altitude - 28, 2) + Math.pow(azimuth * 0.35, 2)));
  }
}

export class SingleAxisTracker extends SolarPanel {
  incidenceAngle(altitude: number, azimuth: number) {
    if (altitude <= 0) return 90;
    return Math.min(58, Math.abs(azimuth) * 0.12 + Math.abs(altitude - 40) * 0.08);
  }
}

export class DualAxisTracker extends SolarPanel {
  incidenceAngle(altitude: number) {
    return altitude <= 0 ? 90 : 1.8;
  }
}

function panelStrategyFor(mode: TrackingMode): SolarPanel {
  if (mode === 'dual') return new DualAxisTracker();
  if (mode === 'single') return new SingleAxisTracker();
  return new FixedPanel();
}

export function solarPosition(time: number) {
  const daylight = Math.max(0, Math.min(1, (time - 6) / 12));
  const altitude = daylight <= 0 || daylight >= 1 ? 0 : Math.sin(daylight * Math.PI) * 64;
  const azimuth = (time - 12) * 11.5;
  return { altitude, azimuth };
}

export function incidenceAngle(mode: TrackingMode, altitude: number, azimuth: number) {
  return panelStrategyFor(mode).incidenceAngle(altitude, azimuth);
}

export function powerAt(time: number, config: SimulationConfig) {
  const { altitude, azimuth } = solarPosition(time);
  const incidence = incidenceAngle(config.mode, altitude, azimuth);
  const angleFactor = Math.max(0, Math.cos((incidence * Math.PI) / 180));
  const daylightFactor = Math.max(0, Math.sin((altitude * Math.PI) / 180));
  const cloudFactor = 1 - config.clouds * 0.68;
  const shadeFactor = 1 - config.shading * 0.72;
  const gentleAtmosphere = 0.91 + Math.max(0, altitude - 25) / 1000;
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
  return { power: Math.max(0, watts / 1000), altitude, azimuth, incidence };
}

export function simulateDay(config: SimulationConfig, step = 0.25): SolarPoint[] {
  const points: SolarPoint[] = [];
  for (let time = 5.5; time <= 18.5; time += step) {
    const sample = powerAt(time, config);
    points.push({ time, ...sample });
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
  const best = results.reduce((winner, item) => item.payback < winner.payback ? item : winner);
  const bestLabel = modeLabels[best.mode].toLowerCase();
  const note = best.mode === config.mode
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