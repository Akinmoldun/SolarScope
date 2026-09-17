import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Activity, Check, CloudSun, Info, Pause, Play, RotateCcw, SunMedium, Zap } from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
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

const modeColors: Record<TrackingMode, string> = {
  fixed: '#929783',
  single: '#197b76',
  dual: '#cc8d27',
};

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function Chart({ config, mode }: { config: SimulationConfig; mode: TrackingMode }) {
  const modes: TrackingMode[] = ['fixed', 'single', 'dual'];
  const series = modes.map((seriesMode) => {
    const points = simulateDay({ ...config, mode: seriesMode });
    return { mode: seriesMode, points };
  });
  const maxPower = Math.max(...series.flatMap((line) => line.points.map((point) => point.power)), 1);
  const x = (time: number) => 42 + ((time - 6) / 12) * 728;
  const y = (power: number) => 204 - (power / maxPower) * 175;
  const pathFor = (line: typeof series[number]) => line.points.map((point, index) => `${index ? 'L' : 'M'} ${x(point.time).toFixed(1)} ${y(point.power).toFixed(1)}`).join(' ');

  return (
    <div className="chart-wrap" data-testid="chart-power-comparison">
      <svg className="chart-svg" viewBox="0 0 800 250" role="img" aria-label="Power through the day comparison chart">
        {[0, .25, .5, .75, 1].map((step) => (
          <g key={step}>
            <line x1="42" x2="770" y1={204 - step * 175} y2={204 - step * 175} stroke="hsl(42 25% 84% / .85)" strokeDasharray="3 5" />
            <text className="chart-axis-label" x="4" y={208 - step * 175}>{(maxPower * step).toFixed(0)}</text>
          </g>
        ))}
        {[6, 9, 12, 15, 18].map((hour) => (
          <g key={hour}>
            <line x1={x(hour)} x2={x(hour)} y1="29" y2="204" stroke="hsl(42 25% 84% / .45)" />
            <text className="chart-axis-label" textAnchor="middle" x={x(hour)} y="225">{formatClock(hour).replace(':00 ', ' ')}</text>
          </g>
        ))}
        {series.map((line) => (
          <path
            key={line.mode}
            d={pathFor(line)}
            fill="none"
            stroke={modeColors[line.mode]}
            strokeWidth={line.mode === mode ? 3.2 : 1.7}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={line.mode === mode ? 1 : .52}
          />
        ))}
        <line x1={x(12)} x2={x(12)} y1="18" y2="204" stroke="hsl(193 52% 31% / .25)" strokeDasharray="2 4" />
        <circle cx={x(12)} cy={y(projectAt(config, 12).power)} r="4.5" fill={modeColors[mode]} stroke="hsl(43 42% 98%)" strokeWidth="2" />
      </svg>
    </div>
  );
}

function SimulationStage({ config, time, onTimeChange, isPlaying, onTogglePlay, onRun, onReset }: {
  config: SimulationConfig;
  time: number;
  onTimeChange: (time: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onRun: () => void;
  onReset: () => void;
}) {
  const live = useMemo(() => projectAt(config, time), [config, time]);
  const sunX = 50 + (live.azimuth / 69) * 39;
  const sunY = 58 - (live.altitude / 64) * 42;
  const panelTilt = config.mode === 'fixed' ? 47 : config.mode === 'single' ? 35 : 27;

  return (
    <section className="surface simulation-card fade-in" data-testid="section-simulation-stage">
      <div className="card-header">
        <div>
          <h2 className="card-title">Live sky model</h2>
          <p className="card-kicker">A visual read on the current angle of incidence.</p>
        </div>
        <div className="small-status"><span className="live-dot" /> client-side model</div>
      </div>
      <div className="stage">
        <span className="stage-label">Site / high desert test field</span>
        <div className="stage-time">
          <strong data-testid="text-current-time">{formatClock(time)}</strong>
          <span>solar position</span>
        </div>
        <div className="horizon-line" />
        <div className="sun" style={{ left: `${sunX}%`, top: `${sunY}%` }} aria-label={`Sun at ${formatClock(time)}`} />
        <div className="field-shadow" />
        <div className="panel-field" style={{ transform: `perspective(270px) rotateX(${panelTilt}deg) rotateZ(-4deg)` }}>
          {Array.from({ length: 15 }, (_, index) => (
            <div className="panel" key={index}><div className="panel-glint" /></div>
          ))}
        </div>
        <div className="stage-legend">
          <span className="legend-item"><i className="legend-swatch" /> sun vector</span>
          <span className="legend-item"><i className="legend-swatch panel-swatch" /> array / {modeLabels[config.mode]}</span>
        </div>
      </div>
      <div className="timeline">
        <div className="timeline-head">
          <span>Daylight timeline</span>
          <strong>{live.altitude.toFixed(1)}° altitude / {live.incidence.toFixed(1)}° incidence</strong>
        </div>
        <input
          className="range-input"
          type="range"
          min="5.5"
          max="18.5"
          step=".05"
          value={time}
          onChange={(event) => onTimeChange(Number(event.target.value))}
          aria-label="Set simulated time"
          data-testid="input-simulated-time"
        />
        <div className="time-labels"><span>5:30 AM</span><span>solar noon</span><span>6:30 PM</span></div>
        <div className="timeline-actions">
          <button className="icon-button" onClick={onTogglePlay} aria-label={isPlaying ? 'Pause simulation' : 'Play simulation'} data-testid="button-toggle-simulation">
            {isPlaying ? <Pause size={15} /> : <Play size={15} />}
          </button>
          <button className="primary-button" onClick={onRun} data-testid="button-run-day">
            <Play size={13} style={{ verticalAlign: 'middle', marginRight: 6 }} /> run a day
          </button>
          <button className="icon-button" onClick={onReset} aria-label="Reset scenario" data-testid="button-reset-scenario"><RotateCcw size={14} /></button>
        </div>
      </div>
    </section>
  );
}

function Controls({ config, onChange }: { config: SimulationConfig; onChange: (patch: Partial<SimulationConfig>) => void }) {
  const modes: { id: TrackingMode; description: string }[] = [
    { id: 'fixed', description: 'low capex' },
    { id: 'single', description: 'east → west' },
    { id: 'dual', description: 'full alignment' },
  ];
  return (
    <section className="surface control-card fade-in fade-delay" data-testid="section-scenario-controls">
      <div className="card-header" style={{ padding: '0 0 18px' }}>
        <div>
          <h2 className="card-title">Scenario inputs</h2>
          <p className="card-kicker">Change one variable. Every readout follows.</p>
        </div>
        <CloudSun size={21} color="hsl(193 52% 31%)" strokeWidth={1.6} />
      </div>
      <div className="control-section">
        <div className="section-label"><span>Tracking architecture</span><small>select one</small></div>
        <div className="mode-grid">
          {modes.map((item) => (
            <button
              key={item.id}
              className={`mode-button ${config.mode === item.id ? 'active' : ''}`}
              onClick={() => onChange({ mode: item.id })}
              aria-pressed={config.mode === item.id}
              data-testid={`button-mode-${item.id}`}
            >
              <strong>{modeLabels[item.id]}</strong><span>{item.description}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="control-section">
        <div className="section-label"><span>Array conditions</span><small>physical inputs</small></div>
        <div className="slider-row">
          <div className="slider-meta"><span>Panel count</span><output>{config.panels} panels</output></div>
          <input className="range-input" type="range" min="50" max="1200" step="10" value={config.panels} onChange={(event) => onChange({ panels: Number(event.target.value) })} aria-label="Panel count" data-testid="input-panel-count" />
        </div>
        <div className="slider-row">
          <div className="slider-meta"><span>Module efficiency</span><output>{Math.round(config.efficiency * 100)}%</output></div>
          <input className="range-input" type="range" min=".12" max=".27" step=".01" value={config.efficiency} onChange={(event) => onChange({ efficiency: Number(event.target.value) })} aria-label="Panel efficiency" data-testid="input-panel-efficiency" />
        </div>
        <div className="slider-row">
          <div className="slider-meta"><span>Cloud cover</span><output>{Math.round(config.clouds * 100)}%</output></div>
          <input className="range-input" type="range" min="0" max=".85" step=".01" value={config.clouds} onChange={(event) => onChange({ clouds: Number(event.target.value) })} aria-label="Cloud cover" data-testid="input-cloud-cover" />
        </div>
        <div className="slider-row">
          <div className="slider-meta"><span>Nearby shading</span><output>{Math.round(config.shading * 100)}%</output></div>
          <input className="range-input" type="range" min="0" max=".5" step=".01" value={config.shading} onChange={(event) => onChange({ shading: Number(event.target.value) })} aria-label="Nearby shading" data-testid="input-shading" />
        </div>
      </div>
      <div className="control-section">
        <div className="section-label"><span>Investment lens</span><small>editable assumptions</small></div>
        <div className="number-grid">
          <label><span className="field-label">Electricity price / kWh</span><input className="number-field" type="number" min=".01" max="2" step=".01" value={config.price} onChange={(event) => onChange({ price: Number(event.target.value) || 0 })} data-testid="input-electricity-price" /></label>
          <label><span className="field-label">Tracker hardware / panel</span><input className="number-field" type="number" min="0" max="1000" step="5" value={config.hardwareCost} onChange={(event) => onChange({ hardwareCost: Number(event.target.value) || 0 })} data-testid="input-hardware-cost" /></label>
        </div>
      </div>
    </section>
  );
}

function Home() {
  const [config, setConfig] = useState<SimulationConfig>(defaultConfig);
  const [time, setTime] = useState(12);
  const [isPlaying, setIsPlaying] = useState(false);
  const dayEnergy = useMemo(() => dailyEnergy(config), [config]);
  const current = useMemo(() => projectAt(config, time), [config, time]);
  const revenue = useMemo(() => annualValue(config), [config]);
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
        return Math.min(18.5, previous + .08);
      });
    }, 80);
    return () => window.clearInterval(timer);
  }, [isPlaying]);

  const updateConfig = (patch: Partial<SimulationConfig>) => setConfig((previous) => ({ ...previous, ...patch }));
  const reset = () => { setConfig(defaultConfig); setTime(12); setIsPlaying(false); };
  const runDay = () => { setTime(5.5); setIsPlaying(true); };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="shell-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div className="brand-mark" data-testid="brand-solar-scope">
            <span className="brand-orbit" aria-hidden="true" /><span className="brand-name">SolarScope <span className="brand-sub">SIMULATOR / 01</span></span>
          </div>
          <div className="topbar-actions">
            <div className="live-pill"><span className="live-dot" /> model online</div>
            <button className="ghost-button" onClick={reset} data-testid="button-reset-header">Reset scenario</button>
          </div>
        </div>
      </header>
      <main className="shell-container">
        <section className="hero fade-in">
          <div className="hero-copy">
            <div className="eyebrow">Sunlight, made legible</div>
            <h1>See the value in <em>following the sun.</em></h1>
            <p>SolarScope turns a day of moving light into a transparent investment conversation. Tune the field, watch the geometry change, and see exactly where tracking earns its keep.</p>
          </div>
          <div className="hero-readout" data-testid="panel-site-readout">
            <div className="readout-line"><span>Test field</span><span>35.2° N / 106.6° W</span></div>
            <div className="readout-line"><span>Day type</span><span>clear summer day</span></div>
            <div className="readout-line"><span>Engine</span><span>deterministic / v1.4</span></div>
          </div>
        </section>
        <div className="dashboard-grid">
          <SimulationStage config={config} time={time} onTimeChange={(nextTime) => { setTime(nextTime); setIsPlaying(false); }} isPlaying={isPlaying} onTogglePlay={() => setIsPlaying((playing) => !playing)} onRun={runDay} onReset={reset} />
          <Controls config={config} onChange={updateConfig} />
        </div>
        <section className="metric-strip" data-testid="section-live-metrics">
          <div className="metric"><div className="metric-name">Current power</div><div className="metric-value" data-testid="text-current-power">{current.power.toFixed(1)} kW</div><div className="metric-note"><Zap size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} /> at {formatClock(time)}</div></div>
          <div className="metric"><div className="metric-name">Daily energy</div><div className="metric-value" data-testid="text-daily-energy">{dayEnergy.toFixed(0)} kWh</div><div className="metric-note"><Activity size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} /> modeled from sunrise to sunset</div></div>
          <div className="metric"><div className="metric-name">Annual energy value</div><div className="metric-value" data-testid="text-annual-value">{formatMoney(revenue)}</div><div className="metric-note">at {formatMoney(config.price)}/kWh, before O&amp;M</div></div>
        </section>
        <div className="lower-grid">
          <section className="surface chart-card" data-testid="section-power-chart">
            <div className="card-header" style={{ padding: 0 }}>
              <div>
                <h2 className="card-title">Power through the day</h2>
                <p className="card-kicker">Same weather. Three ways to meet the sun.</p>
              </div>
              <SunMedium size={22} color="hsl(42 91% 46%)" strokeWidth={1.7} />
            </div>
            <div className="chart-legend">
              {(['fixed', 'single', 'dual'] as TrackingMode[]).map((item) => <span key={item}><i className="chart-line" style={{ '--line': modeColors[item] } as CSSProperties} /> {modeLabels[item]}</span>)}
            </div>
            <Chart config={config} mode={config.mode} />
          </section>
          <section className="surface recommendation-card" data-testid="section-investor-recommendation">
            <div className="eyebrow">Investor readout</div>
            <h2>{modeLabels[investor.mode]} is the strongest first conversation.</h2>
            <p>{investor.note} It produces <strong>{investor.energy.toFixed(0)} kWh</strong> per day under this scenario, while the selected architecture is currently <strong>{modeLabels[config.mode].toLowerCase()}</strong>.</p>
            <div className="payback"><strong data-testid="text-payback">{investor.payback.toFixed(1)} yr</strong><span>modeled payback<br />for recommended path</span></div>
            <div style={{ position: 'relative', display: 'flex', gap: 6, alignItems: 'center', marginTop: 18, color: 'hsl(44 45% 97% / .67)', fontSize: '.65rem' }}><Check size={13} color="hsl(43 91% 57%)" /> includes hardware delta by architecture</div>
          </section>
        </div>
        <section className="surface assumptions-card" data-testid="section-model-assumptions">
          <div>
            <div className="eyebrow">Model notes</div>
            <h2>Simple enough to interrogate.<br />Honest enough to present.</h2>
          </div>
          <div>
            <div className="equation">P = A × η × G × cos(θ) × (1 − C) × (1 − S)</div>
            <p className="assumption-copy"><Info size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} /> Angle of incidence is the difference between the sun vector and panel normal. We translate it into useful plane-of-array irradiance; cloud and shade then reduce the available light. Values are deterministic so a presenter can trace every change.</p>
            <ul className="assumption-list">
              <li><b>Panel surface</b>2.1 m² per module at 1,000 W/m² peak irradiance.</li>
              <li><b>Solar window</b>5:30 AM–6:30 PM with a 64° noon altitude.</li>
              <li><b>Fixed tilt</b>28° south-facing array; no moving hardware.</li>
              <li><b>Economics</b>365-day energy value, before operations and maintenance.</li>
            </ul>
          </div>
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
        <Route component={NotFound} />
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