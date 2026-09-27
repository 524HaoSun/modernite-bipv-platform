import { Canvas } from "@react-three/fiber";
import { Clone, OrbitControls, useGLTF } from "@react-three/drei";
import { Suspense, useMemo } from "react";
import { publicPath } from "@/lib/paths";
import * as THREE from "three";

const ASSET_FOR: Record<string, string> = {
  window: publicPath("assets/window_fixed_3bf5c5a2.glb"),
  facade: publicPath("assets/facade_black_dca3822e.glb"),
  railing: publicPath("assets/railing_d391c76c.glb"),
  structure: publicPath("assets/sunroom_gable_7303a7d6.glb"),
};

const TILE_FINISH: Record<string, string> = { black: "#17242a", terracotta: "#a45c46", "brick-red": "#9e4e43", burgundy: "#7d4144", "silver-grey": "#a7adb0", "dusty-grey": "#7d8289", "graphite-grey": "#55585d", "blue-grey": "#63768b", "steel-blue": "#4e6074", "night-blue": "#273552" };

function ImportedAsset({ source, scale = 1, rotation = [0, 0, 0] as [number, number, number] }: { source: string; scale?: number; rotation?: [number, number, number] }) {
  const { scene } = useGLTF(source);
  return <Clone object={scene} scale={scale} rotation={rotation} castShadow receiveShadow />;
}

function Tile({ position, color }: { position: [number, number, number]; color: string }) {
  return <group position={position} rotation={[-0.32, 0, 0]}>
    <mesh castShadow receiveShadow><boxGeometry args={[0.74, 0.042, 0.48]} /><meshStandardMaterial color="#213036" roughness={0.34} metalness={0.44} /></mesh>
    <mesh position={[0, 0.028, -0.01]}><boxGeometry args={[0.62, 0.018, 0.38]} /><meshStandardMaterial color={color} roughness={0.24} metalness={0.36} /></mesh>
    <mesh position={[-0.35, 0.032, 0]}><boxGeometry args={[0.016, 0.026, 0.47]} /><meshStandardMaterial color="#55656c" metalness={0.65} roughness={0.25} /></mesh>
    <mesh position={[0.35, 0.032, 0]}><boxGeometry args={[0.016, 0.026, 0.47]} /><meshStandardMaterial color="#55656c" metalness={0.65} roughness={0.25} /></mesh>
  </group>;
}

function RoofTileAssembly({ finish }: { finish?: string | null }) {
  const color = TILE_FINISH[finish ?? "black"] ?? TILE_FINISH.black;
  const tiles = useMemo(() => Array.from({ length: 9 }, (_, index) => ({ x: (index % 3) * 0.78 - 0.78, z: Math.floor(index / 3) * 0.44 - 0.44 })), []);
  return <group position={[0, 0.1, 0]} rotation={[0.08, -0.22, 0]}>{tiles.map((tile, index) => <Tile key={index} position={[tile.x, 0, tile.z]} color={color} />)}</group>;
}

function StageContent({ category, finish, variant }: { category: string; finish?: string | null; variant?: "conservatory" | "carport" | "canopy" }) {
  if (category === "roof") return <RoofTileAssembly finish={finish} />;
  if (category === "structure") {
    const isPergola = variant && variant !== "conservatory";
    const src = isPergola ? publicPath("assets/canopy_pergola_46caa817.glb") : publicPath("assets/sunroom_gable_7303a7d6.glb");
    return <group position={[0, -0.9, 0]}><ImportedAsset source={src} scale={0.62} rotation={[0, -0.4, 0]} /></group>;
  }
  const source = ASSET_FOR[category];
  if (source) {
    const scale = category === "railing" ? 1.05 : category === "window" ? 0.95 : 0.9;
    return <group position={[0, -0.35, 0]}><ImportedAsset source={source} scale={scale} rotation={[0, -0.3, 0]} /></group>;
  }
  return <RoofTileAssembly finish={finish} />;
}

export function ProductModelCanvas({ category, finish, label, variant }: { category: "roof" | "window" | "facade" | "railing" | "structure"; finish?: string | null; label: string; variant?: "conservatory" | "carport" | "canopy" }) {
  const isLarge = category === "structure";
  return <div className="product-model-canvas" aria-label={label} tabIndex={0}>
    <Canvas camera={{ position: isLarge ? [5.2, 3.8, 5.8] : [2.9, 2.1, 3.4], fov: 32 }} shadows dpr={[1, 1.5]}>
      <ambientLight intensity={1.8} />
      <directionalLight position={[7, 10, 6]} intensity={2.8} castShadow />
      <directionalLight position={[-5, 4, -4]} intensity={1.1} />
      <Suspense fallback={null}><group position={[0, 0, 0]}><StageContent category={category} finish={finish} variant={variant} /></group></Suspense>
      <mesh position={[0, isLarge ? -0.92 : -0.62, 0]} receiveShadow><planeGeometry args={[10, 10]} /><meshStandardMaterial color="#d4ded7" roughness={0.94} /></mesh>
      <OrbitControls enableDamping dampingFactor={0.08} maxPolarAngle={Math.PI / 2.05} minDistance={1.8} maxDistance={10} target={[0, isLarge ? 0.2 : 0.1, 0]} />
    </Canvas>
    <span className="product-model-badge">REAL 3D PRODUCT GEOMETRY</span>
    <span className="product-model-hint">Drag to orbit · scroll to inspect</span>
  </div>;
}
