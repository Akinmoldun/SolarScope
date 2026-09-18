import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html, Line, OrbitControls, Sky, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import {
  ShadingObject,
  SolarField,
  Sun,
  formatClock,
  orientationForMode,
  solarPosition,
  sunVector,
  type SimulationConfig,
  type TrackingMode,
} from '@/lib/simulation';

type SolarSceneProps = {
  config: SimulationConfig;
  time: number;
  comparison: boolean;
  onResetCamera: () => void;
};

const modeColors: Record<TrackingMode, string> = {
  fixed: '#c7a447',
  single: '#49c3bf',
  dual: '#f1b84c',
};

const modeNames: Record<TrackingMode, string> = {
  fixed: 'Fixed tilt',
  single: 'Single-axis',
  dual: 'Dual-axis',
};

function fieldSize(panelCount: number, comparison: boolean) {
  const count = comparison ? Math.min(12, Math.max(6, Math.round(panelCount / 80))) : Math.min(24, Math.max(8, Math.round(panelCount / 28)));
  return {
    rows: comparison ? 2 : Math.ceil(count / 6),
    columns: comparison ? 3 : 6,
  };
}

function PanelModule({
  position,
  orientation,
  compact = false,
}: {
  position: [number, number, number];
  orientation: { tilt: number; yaw: number };
  compact?: boolean;
}) {
  const width = compact ? 1.45 : 2.25;
  const depth = compact ? 0.78 : 1.18;
  const cellColor = compact ? '#1d5665' : '#1b5f70';
  return (
    <group position={position} rotation={[
      THREE.MathUtils.degToRad(orientation.tilt),
      THREE.MathUtils.degToRad(orientation.yaw),
      0,
    ]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[width, 0.075, depth]} />
        <meshStandardMaterial color={cellColor} metalness={0.5} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.048, 0]} castShadow>
        <boxGeometry args={[width + 0.08, 0.035, 0.035]} />
        <meshStandardMaterial color="#b5d2d0" metalness={0.75} roughness={0.22} />
      </mesh>
      <mesh position={[0, 0.048, depth / 2]} castShadow>
        <boxGeometry args={[width + 0.08, 0.035, 0.035]} />
        <meshStandardMaterial color="#b5d2d0" metalness={0.75} roughness={0.22} />
      </mesh>
      <mesh position={[0, 0.048, 0]} castShadow>
        <boxGeometry args={[0.028, 0.04, depth]} />
        <meshStandardMaterial color="#8fb8b7" metalness={0.7} roughness={0.24} />
      </mesh>
      {[-0.33, 0, 0.33].map((cell) => (
        <mesh key={cell} position={[cell * width, 0.05, 0]} castShadow>
          <boxGeometry args={[0.018, 0.02, depth - 0.1]} />
          <meshStandardMaterial color="#80aeb0" metalness={0.45} roughness={0.3} />
        </mesh>
      ))}
      <mesh position={[0, -0.55, 0]} castShadow>
        <cylinderGeometry args={[0.055, 0.07, 1.1, 8]} />
        <meshStandardMaterial color="#52636a" metalness={0.62} roughness={0.42} />
      </mesh>
      <mesh position={[0, -1.08, 0]} castShadow>
        <boxGeometry args={[0.65, 0.07, 0.38]} />
        <meshStandardMaterial color="#39494e" metalness={0.55} roughness={0.48} />
      </mesh>
    </group>
  );
}

function SolarFieldMesh({
  mode,
  config,
  sun,
  offsetX = 0,
  comparison = false,
}: {
  mode: TrackingMode;
  config: SimulationConfig;
  sun: { altitude: number; azimuth: number };
  offsetX?: number;
  comparison?: boolean;
}) {
  const size = fieldSize(config.panels, comparison);
  const field = useMemo(() => new SolarField(size.rows, size.columns, comparison ? 1.95 : 2.8), [comparison, size.columns, size.rows]);
  const orientation = orientationForMode(mode, sun);
  return (
    <group position={[offsetX, 0, 0]}>
      {field.positions().map((position, index) => (
        <PanelModule
          key={`${mode}-${index}`}
          position={[position[0], 1.12, position[2]]}
          orientation={orientation}
          compact={comparison}
        />
      ))}
      {comparison && (
        <Html position={[0, 3.4, 0]} center distanceFactor={11}>
          <div className="scene-field-label" style={{ borderColor: modeColors[mode] }}>
            <span style={{ background: modeColors[mode] }} />
            {modeNames[mode]}
          </div>
        </Html>
      )}
    </group>
  );
}

function Tree({ object }: { object: ShadingObject }) {
  return (
    <group position={object.position}>
      <mesh position={[0, 1.5, 0]} castShadow>
        <cylinderGeometry args={[0.24, 0.34, 3, 8]} />
        <meshStandardMaterial color="#574b3e" roughness={0.9} />
      </mesh>
      {[
        [-0.9, 3.05, 0],
        [0.1, 3.45, 0.1],
        [0.95, 3.0, 0],
        [0, 2.7, 0.7],
      ].map((position, index) => (
        <mesh key={index} position={position as [number, number, number]} castShadow>
          <icosahedronGeometry args={[1.15, 1]} />
          <meshStandardMaterial color="#3d7567" roughness={0.88} />
        </mesh>
      ))}
      <Html position={[0, 4.3, 0]} center distanceFactor={9}>
        <div className="scene-object-label">shading object</div>
      </Html>
    </group>
  );
}

function CloudLayer({ cover }: { cover: number }) {
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (group.current) group.current.position.x = Math.sin(clock.elapsedTime * 0.04) * 0.35;
  });
  const opacity = 0.08 + cover * 0.6;
  return (
    <group ref={group} position={[0, 8.4, -1]}>
      {[[-4, 0, 0], [0, 0.5, -1], [4.5, -0.2, 0.5]].map((position, index) => (
        <group key={index} position={position as [number, number, number]}>
          <mesh>
            <sphereGeometry args={[1.45, 20, 12]} />
            <meshStandardMaterial color="#ecf3ef" transparent opacity={opacity} roughness={1} />
          </mesh>
          <mesh position={[1.2, -0.25, 0]}>
            <sphereGeometry args={[1, 20, 12]} />
            <meshStandardMaterial color="#ecf3ef" transparent opacity={opacity} roughness={1} />
          </mesh>
          <mesh position={[-1.15, -0.3, 0.1]}>
            <sphereGeometry args={[0.9, 20, 12]} />
            <meshStandardMaterial color="#ecf3ef" transparent opacity={opacity} roughness={1} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function SunMarker({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      const scale = 1 + Math.sin(clock.elapsedTime * 2) * 0.035;
      ref.current.scale.setScalar(scale);
    }
  });
  return (
    <group ref={ref} position={position}>
      <pointLight color="#ffd96a" intensity={25} distance={26} decay={2} castShadow shadow-mapSize={[1024, 1024]} />
      <mesh>
        <sphereGeometry args={[0.48, 32, 20]} />
        <meshStandardMaterial color="#ffd166" emissive="#f5a623" emissiveIntensity={2.5} roughness={0.28} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.82, 0.018, 8, 48]} />
        <meshBasicMaterial color="#f6d36f" transparent opacity={0.7} />
      </mesh>
    </group>
  );
}

function SunRays({ position }: { position: [number, number, number] }) {
  const targets: [number, number, number][] = [
    [-4.3, 1.12, -2.5],
    [0, 1.12, 0],
    [4.3, 1.12, 2.5],
  ];
  return (
    <group>
      {targets.map((target, index) => (
        <Line
          key={index}
          points={[position, target]}
          color="#f6d36f"
          transparent
          opacity={0.28}
          lineWidth={1}
          dashed
          dashSize={0.22}
          gapSize={0.15}
        />
      ))}
    </group>
  );
}

function SceneContents({
  config,
  time,
  comparison,
  onControlsReady,
}: SolarSceneProps & { onControlsReady: (controls: any) => void }) {
  const sunModel = useMemo(() => new Sun(), []);
  const shadingObject = useMemo(() => new ShadingObject(), []);
  const sun = solarPosition(time);
  const sunPosition = sunModel.positionAt(time);
  const skySun = sunVector(sun);
  const modes: TrackingMode[] = comparison ? ['fixed', 'single', 'dual'] : [config.mode];
  const offsets = comparison ? [-5.5, 0, 5.5] : [0];

  return (
    <>
      <Sky distance={450} sunPosition={skySun} turbidity={7} rayleigh={1.5} mieCoefficient={0.01} mieDirectionalG={0.8} />
      <ambientLight intensity={0.44} color="#b9d9dc" />
      <hemisphereLight intensity={0.5} color="#d8edf1" groundColor="#31483d" />
      <SunMarker position={sunPosition} />
      <SunRays position={sunPosition} />
      <CloudLayer cover={config.clouds} />
      <SolarFieldMesh mode={modes[0]} config={config} sun={sun} offsetX={offsets[0]} comparison={comparison} />
      {modes.slice(1).map((mode, index) => (
        <SolarFieldMesh key={mode} mode={mode} config={config} sun={sun} offsetX={offsets[index + 1]} comparison={comparison} />
      ))}
      <Tree object={shadingObject} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow>
        <planeGeometry args={[36, 26]} />
        <meshStandardMaterial color="#283d38" roughness={0.92} metalness={0.04} />
      </mesh>
      <gridHelper args={[26, 26, '#527268', '#334f46']} position={[0, 0.01, 0]} />
      <Sparkles count={45} scale={[20, 8, 16]} size={1.2} speed={0.15} opacity={0.22} color="#dbe8c5" />
      <OrbitControls
        ref={onControlsReady}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={7}
        maxDistance={28}
        maxPolarAngle={Math.PI / 2.05}
        target={[0, 1.3, 0]}
      />
    </>
  );
}

function WebGLFallback() {
  return (
    <div className="webgl-fallback">
      <div className="section-eyebrow">WebGL unavailable in this preview</div>
      <h2>The solar field needs a graphics context.</h2>
      <p>This is a real Three.js scene. Enable hardware-accelerated WebGL in the presentation browser to orbit the field, inspect panel rotations, and see live shadows.</p>
    </div>
  );
}

export function SolarScene({ config, time, comparison, onResetCamera }: SolarSceneProps) {
  const controlsRef = useRef<any>(null);
  const [webglAvailable, setWebglAvailable] = useState<boolean | null>(null);
  const defaultCamera = comparison ? [13, 10, 18] : [10, 7.5, 13];
  useEffect(() => {
    try {
      const probe = document.createElement('canvas');
      const context = probe.getContext('webgl2') ?? probe.getContext('webgl');
      setWebglAvailable(Boolean(context));
    } catch {
      setWebglAvailable(false);
    }
  }, []);
  const resetCamera = () => {
    controlsRef.current?.reset();
    onResetCamera();
  };
  if (webglAvailable !== true) {
    return (
      <div className="three-stage" data-testid="three-solar-scene">
        {webglAvailable === false ? <WebGLFallback /> : <div className="webgl-fallback"><div className="section-eyebrow">Loading WebGL scene</div></div>}
      </div>
    );
  }
  return (
    <div className="three-stage" data-testid="three-solar-scene">
      <Canvas
        shadows="basic"
        dpr={[1, 1.5]}
        fallback={<WebGLFallback />}
        camera={{ position: defaultCamera as [number, number, number], fov: 42, near: 0.1, far: 500 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <SceneContents config={config} time={time} comparison={comparison} onResetCamera={onResetCamera} onControlsReady={(controls) => { controlsRef.current = controls; }} />
      </Canvas>
      <div className="scene-badge"><span className="live-dot" /> WebGL scene / live model</div>
      <div className="scene-hint">drag to orbit · scroll to zoom · shift-drag to pan</div>
      <div className="scene-clock"><b>{formatClock(time)}</b><span>{solarPosition(time).altitude.toFixed(1)}° altitude · {solarPosition(time).azimuth.toFixed(1)}° azimuth</span></div>
      <button className="camera-reset" onClick={resetCamera}>reset camera</button>
      <div className="scene-ray-key"><i /> sunlight direction <i className="scene-panel-key" /> panel normals</div>
    </div>
  );
}