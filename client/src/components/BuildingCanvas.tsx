import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import type { AdditionalStructure, BuildingConfig, Surface } from "../../../types/solar";
import { clampRoofPitch } from "../../../lib/roof-pitch";

const TILE_FINISH: Record<string, string> = {
  black: "#18232b", terracotta: "#a45c46", "brick-red": "#9e4e43", burgundy: "#7d4144", "silver-grey": "#9ba2a5", "dusty-grey": "#737981", "graphite-grey": "#4f5459", "blue-grey": "#5a6d80", "steel-blue": "#495c70", "night-blue": "#203149",
};

type ArchitectureProfile = "detached" | "semi" | "terrace" | "endTerrace" | "bungalow" | "lowrise" | "highrise";
type SelectableSurface = "roof" | "facade" | "window" | "railing" | "structure";
export type SunSimulation = { season: "spring" | "summer" | "autumn" | "winter"; hour: number };

function architectureProfile(building: BuildingConfig): ArchitectureProfile {
  const modelNumber = Number(building.archetypeId.slice(-2));
  if (modelNumber === 7 || building.storeys >= 8) return "highrise";
  if (modelNumber === 6 || building.storeys >= 3) return "lowrise";
  if (modelNumber === 5 || building.storeys === 1) return "bungalow";
  if (modelNumber === 2) return "semi";
  if (modelNumber === 3) return "terrace";
  if (modelNumber === 4) return "endTerrace";
  return "detached";
}

function sunParameters(simulation: SunSimulation) {
  const elevationBySeason = { spring: 0.68, summer: 1.12, autumn: 0.46, winter: 0.24 } as const;
  const phase = ((simulation.hour - 6) / 12) * Math.PI;
  const elevation = Math.max(0, Math.sin(phase) * elevationBySeason[simulation.season]);
  const angle = -Math.PI * 0.7 + phase * Math.PI * 0.88;
  return {
    isDaylight: elevation > 0.05,
    position: [20 * Math.cos(angle), 4 + 19 * elevation, 20 * Math.sin(angle)] as [number, number, number],
    intensity: elevation > 0 ? 1.2 + elevation * 2.1 : 0.12,
    ambient: elevation > 0 ? 0.52 + elevation * 0.55 : 0.16,
    colour: simulation.hour > 16 ? "#ffd6a8" : simulation.season === "winter" ? "#dce9ff" : "#fff3d9",
  };
}

function selectedRoofFinish(surfaces: Surface[]) {
  return surfaces.find((surface) => surface.kind === "roof-plane" && surface.included && surface.productId)?.finishId ?? "black";
}

function hasProduct(surfaces: Surface[], kind: Surface["kind"]) {
  return surfaces.some((surface) => surface.kind === kind && surface.included && surface.productId);
}

function interactionFor(name: string): SelectableSurface {
  const lower = name.toLowerCase();
  if (lower.includes("roof")) return "roof";
  if (lower.includes("window") || lower.includes("glass") || lower.includes("door")) return "window";
  if (lower.includes("rail")) return "railing";
  if (lower.includes("conservatory") || lower.includes("carport") || lower.includes("canopy")) return "structure";
  return "facade";
}

function WindowGrid({ width, wallHeight, depth, storeys, solar }: { width: number; wallHeight: number; depth: number; storeys: number; solar: boolean }) {
  const count = Math.min(6, Math.max(2, Math.round(width / 2.15)));
  return <group>{Array.from({ length: Math.max(1, storeys) * count }, (_, index) => {
    const floor = Math.floor(index / count);
    const column = index % count;
    const x = -width / 2 + (column + 0.5) * (width / count);
    const y = wallHeight * (0.16 + floor / Math.max(1, storeys) + 0.18 / Math.max(1, storeys));
    return <mesh key={index} name={solar ? "bipv-glass-window" : "window"} position={[x, y, -depth / 2 - 0.026]} castShadow>
      <boxGeometry args={[Math.min(0.94, width / count * 0.56), Math.min(1.25, wallHeight / Math.max(1, storeys) * 0.46), 0.07]} />
      <meshPhysicalMaterial color={solar ? "#2f7184" : "#b8d9e5"} metalness={solar ? 0.36 : 0.12} roughness={solar ? 0.18 : 0.1} transmission={0.06} />
    </mesh>;
  })}</group>;
}

function RoofSolarArray({ width, slope }: { width: number; slope: number }) {
  const columns = Math.max(2, Math.min(6, Math.floor(width / 1.25)));
  const rows = Math.max(2, Math.min(4, Math.floor(slope / 1.05)));
  const panelWidth = (width * 0.76) / columns;
  const panelHeight = (slope * 0.72) / rows;
  return <group position={[0, 0, 0.012]}>{Array.from({ length: columns * rows }, (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = -width * 0.38 + panelWidth * (column + 0.5);
    const y = -slope * 0.36 + panelHeight * (row + 0.5);
    return <mesh key={index} name="bipv-roof-panel" position={[x, y, 0]}><planeGeometry args={[panelWidth - 0.035, panelHeight - 0.035]} /><meshStandardMaterial color="#163e58" metalness={0.78} roughness={0.16} /></mesh>;
  })}</group>;
}

function RoofPlanes({ width, depth, wallHeight, pitchDeg, roofColour, active }: { width: number; depth: number; wallHeight: number; pitchDeg: number; roofColour: string; active: boolean }) {
  const visualPitch = THREE.MathUtils.degToRad(clampRoofPitch(pitchDeg));
  const run = depth / 2;
  const rise = Math.min(run * Math.tan(visualPitch), 5.8);
  const slope = Math.hypot(run, rise);
  const material = <meshStandardMaterial color={active ? roofColour : "#4e5860"} metalness={active ? 0.68 : 0.3} roughness={active ? 0.24 : 0.52} side={THREE.DoubleSide} />;
  return <group>
    <group position={[0, wallHeight + rise / 2, -depth / 4]} rotation={[visualPitch, 0, 0]}><mesh name="bipv-roof-south" castShadow receiveShadow><planeGeometry args={[width + 0.24, slope + 0.16]} />{material}</mesh>{active && <RoofSolarArray width={width} slope={slope} />}</group>
    <group position={[0, wallHeight + rise / 2, depth / 4]} rotation={[-visualPitch, 0, 0]}><mesh name="bipv-roof-north" castShadow receiveShadow><planeGeometry args={[width + 0.24, slope + 0.16]} />{material}</mesh>{active && <RoofSolarArray width={width} slope={slope} />}</group>
    <mesh name="roof-ridge" position={[0, wallHeight + rise + 0.04, 0]} rotation={[0, Math.PI / 2, 0]} castShadow><cylinderGeometry args={[0.045, 0.045, width + 0.2, 10]} /><meshStandardMaterial color="#232c32" roughness={0.45} /></mesh>
  </group>;
}

function GableInfill({ width, depth, wallHeight, pitchDeg, colour }: { width: number; depth: number; wallHeight: number; pitchDeg: number; colour: string }) {
  const shape = useMemo(() => {
    const visualPitch = THREE.MathUtils.degToRad(clampRoofPitch(pitchDeg));
    const rise = Math.min((depth / 2) * Math.tan(visualPitch), 5.8);
    const next = new THREE.Shape();
    next.moveTo(-depth / 2, 0);
    next.lineTo(depth / 2, 0);
    next.lineTo(0, rise);
    next.closePath();
    return next;
  }, [depth, pitchDeg]);
  if (pitchDeg <= 0) return null;
  return <group>{[-1, 1].map((side) => <mesh key={side} name="facade" position={[side * (width / 2 + 0.006), wallHeight, 0]} rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow><shapeGeometry args={[shape]} /><meshStandardMaterial color={colour} roughness={0.65} metalness={0.04} side={THREE.DoubleSide} /></mesh>)}</group>;
}

function StructureModel({ structure, buildingWidth, buildingDepth, wallHeight, active }: { structure: AdditionalStructure; buildingWidth: number; buildingDepth: number; wallHeight: number; active: boolean }) {
  const width = Math.min(structure.widthM, buildingWidth * 1.35);
  const depth = Math.min(structure.depthM, buildingDepth * 1.25);
  const coverage = structure.solarCoverage ?? 1;
  const frame = "#334f58";
  const solar = active ? "#204b5d" : "#52626a";
  if (structure.kind === "conservatory") return <group position={[0, 0, buildingDepth / 2 + depth / 2]} name="conservatory">
    <mesh position={[0, structure.eavesHeightM / 2, 0]}><boxGeometry args={[width, structure.eavesHeightM, depth]} /><meshPhysicalMaterial color="#b9dce5" transparent opacity={0.24} roughness={0.12} metalness={0.18} /></mesh>
    <mesh position={[0, structure.eavesHeightM + depth * 0.12, 0]} rotation={[Math.PI / 2.85, 0, 0]} name="conservatory-roof"><planeGeometry args={[width + 0.12, depth * 1.08]} /><meshStandardMaterial color={solar} metalness={0.64} roughness={0.22} /></mesh>
    {[-1, 1].map((side) => <mesh key={side} position={[side * (width / 2 - 0.05), structure.eavesHeightM / 2, 0]}><boxGeometry args={[0.1, structure.eavesHeightM, depth]} /><meshStandardMaterial color={frame} /></mesh>)}
  </group>;
  const isCarport = structure.kind === "carport";
  const xOffset = isCarport ? buildingWidth / 2 + width / 2 + 0.35 : 0;
  const zOffset = isCarport ? 0 : -buildingDepth / 2 - depth / 2;
  return <group position={[xOffset, 0, zOffset]} name={structure.kind}>
    {[-1, 1].flatMap((x) => [-1, 1].map((z) => <mesh key={`${x}-${z}`} position={[x * (width / 2 - 0.12), structure.eavesHeightM / 2, z * (depth / 2 - 0.12)]}><boxGeometry args={[0.12, structure.eavesHeightM, 0.12]} /><meshStandardMaterial color={frame} metalness={0.34} roughness={0.38} /></mesh>))}
    <mesh position={[0, structure.eavesHeightM, 0]} rotation={[-Math.PI / 2, 0, 0]} name={`${structure.kind}-roof`} castShadow receiveShadow><planeGeometry args={[width, depth]} /><meshStandardMaterial color={solar} metalness={0.65} roughness={0.22} /></mesh>
    {coverage < 0.99 && <mesh position={[0, structure.eavesHeightM + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[width * (1 - coverage), depth * 0.92]} /><meshStandardMaterial color="#a6b6ba" roughness={0.5} /></mesh>}
  </group>;
}

function HouseModel({ building, surfaces, onSelectSurface }: { building: BuildingConfig; surfaces: Surface[]; onSelectSurface?: (kind: SelectableSurface) => void }) {
  const profile = architectureProfile(building);
  const scale = profile === "terrace" ? 1.22 : profile === "semi" || profile === "endTerrace" ? 1.12 : 1;
  const width = Math.min(16, Math.max(5, building.widthM * scale));
  const depth = Math.min(14, Math.max(5, building.depthM));
  const storeys = Math.max(1, Math.min(4, building.storeys));
  const wallHeight = storeys * Math.max(2.35, Math.min(3.1, building.storeyHeightM));
  const pitchDeg = clampRoofPitch(building.roofPitchDeg);
  const roofColour = TILE_FINISH[selectedRoofFinish(surfaces)] ?? TILE_FINISH.black;
  const roofActive = hasProduct(surfaces, "roof-plane");
  const facadeActive = hasProduct(surfaces, "facade");
  const windowActive = hasProduct(surfaces, "window") || hasProduct(surfaces, "skylight");
  const railingActive = hasProduct(surfaces, "railing");
  const facadeColour = facadeActive ? "#536b72" : profile === "bungalow" ? "#b9aa95" : "#b88866";
  const unitCount = profile === "terrace" ? 3 : profile === "semi" || profile === "endTerrace" ? 2 : 1;
  const partyWalls = profile === "terrace" || profile === "semi" || profile === "endTerrace";
  return <group onClick={(event: ThreeEvent<MouseEvent>) => { event.stopPropagation(); onSelectSurface?.(interactionFor(event.object.name)); }}>
    <mesh name="facade" position={[0, wallHeight / 2, 0]} castShadow receiveShadow><boxGeometry args={[width, wallHeight, depth]} /><meshStandardMaterial color={facadeColour} roughness={0.62} metalness={facadeActive ? 0.16 : 0.03} /></mesh>
    <WindowGrid width={width} wallHeight={wallHeight} depth={depth} storeys={storeys} solar={windowActive} />
    <mesh name="door" position={[0, 1.05, -depth / 2 - 0.07]}><boxGeometry args={[0.95, 2.1, 0.08]} /><meshStandardMaterial color="#1d3945" roughness={0.35} metalness={0.28} /></mesh>
    <GableInfill width={width} depth={depth} wallHeight={wallHeight} pitchDeg={pitchDeg} colour={facadeColour} />
    <RoofPlanes width={width} depth={depth} wallHeight={wallHeight} pitchDeg={pitchDeg} roofColour={roofColour} active={roofActive} />
    {facadeActive && <mesh name="bipv-facade" position={[0, wallHeight * 0.59, -depth / 2 - 0.09]}><planeGeometry args={[width * 0.58, Math.min(wallHeight * 0.33, 2.4)]} /><meshStandardMaterial color="#315c69" metalness={0.46} roughness={0.24} /></mesh>}
    {railingActive && <group name="solar-railing" position={[0, wallHeight * 0.62, -depth / 2 - 0.19]}>{[-width * 0.26, 0, width * 0.26].map((x) => <mesh key={x} position={[x, 0, 0]}><boxGeometry args={[width * 0.2, 0.65, 0.05]} /><meshPhysicalMaterial color="#4d899b" opacity={0.75} transparent roughness={0.18} metalness={0.36} /></mesh>)}</group>}
    {partyWalls && Array.from({ length: unitCount - 1 }, (_, index) => <mesh key={index} position={[-width / 2 + ((index + 1) / unitCount) * width, wallHeight / 2, 0]}><boxGeometry args={[0.08, wallHeight, depth + 0.1]} /><meshStandardMaterial color="#6f5347" roughness={0.82} /></mesh>)}
    {building.structures.map((structure) => <StructureModel key={structure.id} structure={structure} buildingWidth={width} buildingDepth={depth} wallHeight={wallHeight} active={hasProduct(surfaces, structure.kind === "conservatory" ? "conservatory-roof" : "canopy")} />)}
    <mesh position={[0, -0.16, 0]} receiveShadow><boxGeometry args={[width + 3.6, 0.32, depth + 3.6]} /><meshStandardMaterial color="#879992" roughness={0.95} /></mesh>
    <mesh position={[0, 0.012, -depth / 2 - 1.2]} receiveShadow><boxGeometry args={[1.3, 0.03, 2.5]} /><meshStandardMaterial color="#d2cfbf" roughness={0.9} /></mesh>
  </group>;
}

function ApartmentBlock({ building, surfaces, onSelectSurface }: { building: BuildingConfig; surfaces: Surface[]; onSelectSurface?: (kind: SelectableSurface) => void }) {
  const profile = architectureProfile(building);
  const width = Math.max(12, Math.min(28, building.widthM));
  const depth = Math.max(9, Math.min(21, building.depthM));
  const storeys = profile === "highrise" ? Math.max(8, building.storeys) : Math.max(3, building.storeys);
  const height = storeys * 1.08;
  const roofColour = TILE_FINISH[selectedRoofFinish(surfaces)] ?? TILE_FINISH.black;
  const windowActive = hasProduct(surfaces, "window");
  const facadeActive = hasProduct(surfaces, "facade");
  return <group onClick={(event: ThreeEvent<MouseEvent>) => { event.stopPropagation(); onSelectSurface?.(interactionFor(event.object.name)); }}>
    <mesh name="facade" position={[0, height / 2, 0]} castShadow receiveShadow><boxGeometry args={[width, height, depth]} /><meshStandardMaterial color={facadeActive ? "#708487" : "#c0b69f"} roughness={0.6} metalness={0.08} /></mesh>
    {Array.from({ length: storeys * 5 }, (_, index) => { const floor = Math.floor(index / 5); const col = index % 5; return <mesh key={index} name={windowActive ? "bipv-glass-window" : "window"} position={[-width * 0.32 + col * width * 0.16, 0.7 + floor * (height / storeys), -depth / 2 - 0.035]}><boxGeometry args={[width * 0.105, Math.min(0.6, height / storeys * 0.48), 0.06]} /><meshPhysicalMaterial color={windowActive ? "#346c7e" : "#aacad5"} metalness={0.27} roughness={0.16} /></mesh>; })}
    {facadeActive && <mesh name="bipv-facade" position={[0, height * 0.65, -depth / 2 - 0.08]}><boxGeometry args={[width * 0.9, height * 0.18, 0.06]} /><meshStandardMaterial color="#315d68" metalness={0.5} roughness={0.22} /></mesh>}
    <mesh name="bipv-roof" position={[0, height + 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[width * 0.92, depth * 0.92]} /><meshStandardMaterial color={roofColour} metalness={0.64} roughness={0.24} /></mesh>
    <mesh position={[0, -0.16, 0]} receiveShadow><boxGeometry args={[width + 2.6, 0.32, depth + 2.6]} /><meshStandardMaterial color="#8a9b91" roughness={0.95} /></mesh>
  </group>;
}

export function BuildingCanvas({ building, surfaces, label, onSelectSurface, sunSimulation = { season: "summer", hour: 13 } }: { building: BuildingConfig; surfaces: Surface[]; label: string; onSelectSurface?: (kind: SelectableSurface) => void; sunSimulation?: SunSimulation }) {
  const sun = sunParameters(sunSimulation);
  const profile = architectureProfile(building);
  const apartments = profile === "lowrise" || profile === "highrise";
  const targetY = apartments ? Math.max(3, Math.min(9, building.storeys * 0.52)) : Math.max(2.3, building.storeys * 1.3);
  const legend = apartments ? ["BIPV roof deck", "Solar glazing", "Facade modules"] : building.roofPitchDeg >= 89 ? ["Vertical solar plane", "Facade envelope", "Solar glazing"] : ["Solar roof plane", "Facade envelope", "Solar glazing"];
  return <div className="building-canvas premium-building-canvas" aria-label={label} tabIndex={0}>
    <Canvas camera={{ position: apartments ? [17, 12, 20] : [15, 10, 16], fov: apartments ? 36 : 33 }} shadows dpr={[1, 1.75]}>
      <color attach="background" args={[sun.isDaylight ? "#dce8e4" : "#17262d"]} />
      <fog attach="fog" args={[sun.isDaylight ? "#dce8e4" : "#17262d", 18, 55]} />
      <ambientLight intensity={sun.ambient} />
      <hemisphereLight args={[sun.isDaylight ? "#dcecf1" : "#8898a3", "#385349", 0.55]} />
      <directionalLight position={sun.position} color={sun.colour} intensity={sun.intensity} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-bias={-0.00018} />
      <directionalLight position={[-12, 8, -6]} intensity={0.45} color="#a8d7d9" />
      {apartments ? <ApartmentBlock building={building} surfaces={surfaces} onSelectSurface={onSelectSurface} /> : <HouseModel building={building} surfaces={surfaces} onSelectSurface={onSelectSurface} />}
      <OrbitControls enableDamping dampingFactor={0.08} maxPolarAngle={Math.PI / 2.07} minDistance={8} maxDistance={36} target={[0, targetY, 0]} />
    </Canvas>
    <div className="canvas-legend"><span><i style={{ background: TILE_FINISH[selectedRoofFinish(surfaces)] ?? TILE_FINISH.black }} />{legend[0]}</span><span><i style={{ background: "#b88866" }} />{legend[1]}</span><span><i style={{ background: "#5d98a8" }} />{legend[2]}</span></div>
    <span className="model-asset-badge">PARAMETRIC 3D · {profile.toUpperCase()}</span><span className="north-arrow" aria-hidden="true">N ↑</span>
  </div>;
}
