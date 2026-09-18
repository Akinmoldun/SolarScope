import { useEffect, useMemo, useState } from 'react';
import { Activity, Camera, Cloud, Info, Pause, Play, RotateCcw, SunMedium, Waves, Zap } from 'lucide-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import { ErrorBoundary } from '@/components/error-boundary';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { SolarScene } from '@/components/solar-scene';
import {
  annualValue,
  dailyEnergy,
  formatClock,
  modeLabels,
  paybackYears,
  projectAt,
  recommendation,
  simulateDay,
  type SimulationConfig,
  type TrackingMode,
} from '@/lib/simulation';
import '@/index.css';

const queryClient = new QueryClient();

const defaultConfig: SimulationConfig = {
  panels: 480,
  efficiency: 0.21,
  clouds: 0.14,
  shading: 0.06,
  price: 0.16,
  hardwareCost: 140,
  mode: 'single',
};

const modeDescriptions: Record<TrackingMode, string> = {
  fixed: 'A south-facing array holds one 28° tilt all day. It is the simplest and cheapest baseline.',
  single: 'The array rotates east to west around one axis, keeping the panel face closer to the Sun.',
  dual: 'Each panel follows both altitude and azimuth for maximum alignment, with the most moving hardware.',
};

const modeColors: Record<TrackingMode, string> = {
  fixed: '#c7a447',
  single: '#49c3bf',
  dual: '#f1b84c',
};

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function Metric({ label, value, note, icon }: { label: string; value: string; note: string; icon: React.ReactNode }) {
  return (
    <div className="metric-line">
      <div className="metric-line-label">{label}</div>
      <div className="metric-line-value">{value}</div>
      <div className="metric-line-note">{icon}{note}</div>
    </div>
  );
}

function PowerCurve({ config }: { config: SimulationConfig }) {
  const modes: TrackingMode[] = ['fixed', 'single', 'dual'];
  const series = modes.map((mode) => ({
    mode,
    points: simulateDay({ ...config, mode }),
  }));
  const maxPower = Math.max(...series.flatMap((line) => line.points.map((point) => point.power)), 1);
  const x = (time: number) => 38 + ((time - 6) / 12) * 680;
  const y = (power: number) => 148 - (power / maxPower) * 116;
  return (
    <div className="power-curve">
      <div className="curve-heading">
        <div>
          <div className="section-eyebrow">Output comparison</div>
          <h2>Power follows alignment.</h2>
        </div>
        <div className="curve-legend">
          {modes.map((mode) => <span key={mode}><i style={{ background: modeColors[mode] }} />{modeLabels[mode]}</span>)}
        </div>
      </div>
      <svg viewBox="0 0 750 180" role="img" aria-label="Power output comparison for the three tracking strategies">
        {[0, 0.5, 1].map((step) => (
          <g key={step}>
            <line x1="38" x2="720" y1={148 - step * 116} y2={148 - step * 116} stroke="#36564f" strokeOpacity=".4" strokeDasharray="3 5" />
            <text x="4" y={152 - step * 116} fill="#8ca59e" fontSize="9" fontFamily="DM Mono">{Math.round(maxPower * step)}</text>
          </g>
        ))}
        {[6, 9, 12, 15, 18].map((hour) => (
          <g key={hour}>
            <line x1={x(hour)} x2={x(hour)} y1="24" y2="148" stroke="#36564f" strokeOpacity=".22" />
            <text x={x(hour)} y="170" textAnchor="middle" fill="#8ca59e" fontSize="9" fontFamily="DM Mono">{formatClock(hour).replace(':00 ', ' ')}</text>
          </g>
        ))}
        {series.map((line) => (
          <path
            key={line.mode}
            d={line.points.map((point, index) => `${index ? 'L' : 'M'} ${x(point.time).toFixed(1)} ${y(point.power).toFixed(1)}`).join(' ')}
            fill="none"
            stroke={modeColors[line.mode]}
            strokeWidth={line.mode === config.mode ? 3 : 1.5}
            opacity={line.mode === config.mode ? 1 : 0.5}
            strokeLinecap="round"
          />
        ))}
        <line x1={x(12)} x2={x(12)} y1="20" y2="148" stroke="#f1b84c" strokeOpacity=".4" strokeDasharray="2 4" />
      </svg>
    </div>
  );
}

function RangeInput({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
  testId,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  onChange: (value: number) => void;
  testId: string;
}) {
  return (
    <label className="control-row">
      <span><b>{label}</b><output>{suffix}</output></span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label={label}
        data-testid={testId}
      />
    </label>
  );
}

function Home() {
  const [config, setConfig] = useState<SimulationConfig>(defaultConfig);
  const [time, setTime] = useState(12);
  const [isPlaying, setIsPlaying] = useState(false);
  const [comparison, setComparison] = useState(false);
  const current = useMemo(() => projectAt(config, time), [config, time]);
  const energy = useMemo(() => dailyEnergy(config), [config]);
  const value = useMemo(() => annualValue(config), [config]);
  const payback = useMemo(() => paybackYears(config), [config]);
  const investor = useMemo(() => recommendation(config), [config]);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setInterval(() => {
      setTime((previous) => {
        if (previous >= 18.5) {
          setIsPlaying(false);
          return 18.5;
        }
        return Math.min(18.5, previous + 0.08);
      });
    }, 80);
    return () => window.clearInterval(timer);
  }, [isPlaying]);

  const updateConfig = (patch: Partial<SimulationConfig>) => setConfig((previous) => ({ ...previous, ...patch }));
  const reset = () => {
    setConfig(defaultConfig);
    setTime(12);
    setIsPlaying(false);
    setComparison(false);
  };
  const runDay = () => {
    setTime(5.5);
    setIsPlaying(true);
  };

  return (
    <div className="solar-app">
      <header className="site-header">
        <div className="brand-lockup">
          <div className="brand-mark"><span /><i /></div>
          <div>
            <strong>SolarScope</strong>
            <small>3D SOLAR TRACKING LAB / 01</small>
          </div>
        </div>
        <div className="header-actions">
          <span className="model-status"><i /> physics model online</span>
          <button className="text-button" onClick={reset} data-testid="button-reset-header"><RotateCcw size={13} /> reset scenario</button>
        </div>
      </header>

      <main className="main-shell">
        <section className="title-row">
          <div>
            <div className="section-eyebrow">Interactive scientific demonstration</div>
            <h1>Follow the Sun.<br /><em>See the difference.</em></h1>
          </div>
          <div className="title-context">
            <p>SolarScope turns sunlight geometry into an investor-ready decision. Inspect the field in 3D, then change the assumptions and watch the output respond.</p>
            <button className={`compare-toggle ${comparison ? 'active' : ''}`} onClick={() => setComparison((value) => !value)} aria-pressed={comparison} data-testid="button-comparison-mode">
              <Camera size={14} /> {comparison ? 'single field view' : 'compare three fields'}
            </button>
          </div>
        </section>

        <section className="sim-layout">
          <div className="scene-column">
            <SolarScene config={config} time={time} comparison={comparison} onResetCamera={() => undefined} />
            <div className="timeline-bar">
              <div className="timeline-controls">
                <button className="round-button" onClick={() => setIsPlaying((value) => !value)} aria-label={isPlaying ? 'Pause simulation' : 'Play simulation'} data-testid="button-toggle-simulation">
                  {isPlaying ? <Pause size={15} /> : <Play size={15} />}
                </button>
                <button className="run-button" onClick={runDay} data-testid="button-run-day"><Play size={12} /> run a day</button>
                <button className="round-button" onClick={reset} aria-label="Reset scenario" data-testid="button-reset-scenario"><RotateCcw size={14} /></button>
              </div>
              <div className="time-scrubber">
                <div className="scrubber-label"><span>simulation time</span><b>{formatClock(time)}</b></div>
                <input type="range" min="5.5" max="18.5" step=".05" value={time} onChange={(event) => { setTime(Number(event.target.value)); setIsPlaying(false); }} aria-label="Set simulated time" data-testid="input-simulated-time" />
                <div className="scrubber-scale"><span>5:30 AM</span><span>solar noon</span><span>6:30 PM</span></div>
              </div>
            </div>
          </div>

          <aside className="control-rail">
            <div className="rail-heading"><div><div className="section-eyebrow">Field controls</div><h2>Change the system.</h2></div><Waves size={19} /></div>
            <div className="mode-selector">
              <div className="control-label">tracking architecture <small>select one</small></div>
              {(['fixed', 'single', 'dual'] as TrackingMode[]).map((mode) => (
                <button key={mode} className={`mode-option ${config.mode === mode ? 'selected' : ''}`} onClick={() => updateConfig({ mode })} aria-pressed={config.mode === mode} data-testid={`button-mode-${mode}`}>
                  <span className="mode-dot" style={{ background: modeColors[mode] }} />
                  <span><b>{modeLabels[mode]}</b><small>{mode === 'fixed' ? 'no moving hardware' : mode === 'single' ? 'east ↔ west' : 'full alignment'}</small></span>
                  <i>{config.mode === mode ? 'active' : ''}</i>
                </button>
              ))}
            </div>
            <div className="control-group">
              <div className="control-label">physical inputs <small>array conditions</small></div>
              <RangeInput label="Panel count" value={config.panels} min={50} max={1200} step={10} suffix={`${config.panels} modules`} onChange={(panels) => updateConfig({ panels })} testId="input-panel-count" />
              <RangeInput label="Module efficiency" value={config.efficiency} min={.12} max={.27} step={.01} suffix={`${Math.round(config.efficiency * 100)}%`} onChange={(efficiency) => updateConfig({ efficiency })} testId="input-panel-efficiency" />
              <RangeInput label="Cloud cover" value={config.clouds} min={0} max={.85} step={.01} suffix={`${Math.round(config.clouds * 100)}%`} onChange={(clouds) => updateConfig({ clouds })} testId="input-cloud-cover" />
              <RangeInput label="Nearby shading" value={config.shading} min={0} max={.5} step={.01} suffix={`${Math.round(config.shading * 100)}%`} onChange={(shading) => updateConfig({ shading })} testId="input-shading" />
            </div>
            <div className="control-group investment-inputs">
              <div className="control-label">investment lens <small>editable assumptions</small></div>
              <label><span>electricity price / kWh</span><input type="number" min=".01" max="2" step=".01" value={config.price} onChange={(event) => updateConfig({ price: Number(event.target.value) || 0 })} data-testid="input-electricity-price" /></label>
              <label><span>tracker cost / panel</span><input type="number" min="0" max="1000" step="5" value={config.hardwareCost} onChange={(event) => updateConfig({ hardwareCost: Number(event.target.value) || 0 })} data-testid="input-hardware-cost" /></label>
            </div>
            <div className="mode-explanation"><Info size={14} /><p><b>{modeLabels[config.mode]}</b> — {modeDescriptions[config.mode]}</p></div>
          </aside>
        </section>

        <section className="metrics-rail" data-testid="section-live-metrics">
          <Metric label="Current power" value={`${current.power.toFixed(1)} kW`} note={`at ${formatClock(time)}`} icon={<Zap size={12} />} />
          <Metric label="Daily energy" value={`${energy.toFixed(0)} kWh`} note="modeled daylight output" icon={<Activity size={12} />} />
          <Metric label="Annual value" value={formatMoney(value)} note={`at ${formatMoney(config.price)}/kWh`} icon={<SunMedium size={12} />} />
          <Metric label="Payback" value={`${payback.toFixed(1)} yr`} note="selected architecture" icon={<Waves size={12} />} />
        </section>

        <section className="analysis-layout">
          <PowerCurve config={config} />
          <div className="recommendation-panel" data-testid="section-investor-recommendation">
            <div className="section-eyebrow">Investor readout</div>
            <h2>{modeLabels[investor.mode]} is the clearest first case.</h2>
            <p>{investor.note} Under this scenario it produces <b>{investor.energy.toFixed(0)} kWh</b> per day.</p>
            <div className="recommendation-number"><strong>{investor.payback.toFixed(1)}</strong><span>years to modeled payback<br />for the recommended path</span></div>
          </div>
        </section>

        <section className="model-note">
          <div className="section-eyebrow">What the scene is showing</div>
          <div className="equation">P = N × A × η × I × max(0, cos θ) × C × (1 − S)</div>
          <p><Info size={14} /> <b>θ</b> is the incidence angle between the Sun's direction and each panel normal. In the 3D scene, that relationship is visible as the gold sunlight rays meet the rotating blue modules. Clouds soften the light source; the tree casts a real shadow onto the ground and panels.</p>
        </section>
      </main>
    </div>
  );
}

function Router() {
  return (
    <ErrorBoundary resetKey={useLocation()[0]}>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={() => <div className="not-found">SolarScope route not found.</div>} />
      </Switch>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;