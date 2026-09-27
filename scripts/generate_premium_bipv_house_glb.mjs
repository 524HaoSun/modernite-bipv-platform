import fs from "node:fs";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

const OUT = "/home/ubuntu/modernite-bipv-platform-artifacts/premium-bipv-house.glb";

// GLTFExporter expects browser FileReader APIs. This narrow polyfill keeps the
// export binary and does not affect the browser application bundle.
if (!globalThis.FileReader) {
  globalThis.FileReader = class {
    result = null;
    onloadend = null;
    onerror = null;
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((buffer) => {
        this.result = buffer;
        this.onloadend?.();
      }).catch((error) => this.onerror?.(error));
    }
    readAsDataURL(blob) {
      blob.arrayBuffer().then((buffer) => {
        this.result = `data:${blob.type || "application/octet-stream"};base64,${Buffer.from(buffer).toString("base64")}`;
        this.onloadend?.();
      }).catch((error) => this.onerror?.(error));
    }
  };
}

const materials = {
  stone: new THREE.MeshStandardMaterial({ color: "#d2c5ae", roughness: 0.82, metalness: 0.0 }),
  stoneLight: new THREE.MeshStandardMaterial({ color: "#ddd2bd", roughness: 0.79, metalness: 0.0 }),
  stoneShadow: new THREE.MeshStandardMaterial({ color: "#b9aa93", roughness: 0.86, metalness: 0.0 }),
  mortar: new THREE.MeshStandardMaterial({ color: "#a99b87", roughness: 0.93, metalness: 0.0 }),
  charcoal: new THREE.MeshStandardMaterial({ color: "#172225", roughness: 0.34, metalness: 0.56 }),
  trim: new THREE.MeshStandardMaterial({ color: "#2a3334", roughness: 0.29, metalness: 0.72 }),
  bipv: new THREE.MeshPhysicalMaterial({ color: "#101d26", roughness: 0.2, metalness: 0.54, clearcoat: 0.38, clearcoatRoughness: 0.16 }),
  bipvLine: new THREE.MeshStandardMaterial({ color: "#536772", roughness: 0.24, metalness: 0.82 }),
  glass: new THREE.MeshPhysicalMaterial({ color: "#789ba1", roughness: 0.08, metalness: 0.04, transmission: 0.22, transparent: true, opacity: 0.78, side: THREE.DoubleSide }),
  warmGlass: new THREE.MeshPhysicalMaterial({ color: "#a8a08d", roughness: 0.1, metalness: 0.04, transmission: 0.12, transparent: true, opacity: 0.88, side: THREE.DoubleSide }),
  timber: new THREE.MeshStandardMaterial({ color: "#634b3a", roughness: 0.71, metalness: 0.0 }),
  paving: new THREE.MeshStandardMaterial({ color: "#7d837f", roughness: 0.9, metalness: 0.0 }),
  grass: new THREE.MeshStandardMaterial({ color: "#72836f", roughness: 1.0, metalness: 0.0 }),
};

function mesh(geometry, material, name) {
  const object = new THREE.Mesh(geometry, material);
  object.name = name;
  object.castShadow = true;
  object.receiveShadow = true;
  return object;
}

function box(group, name, [x, y, z], [w, h, d], material, rotation = [0, 0, 0]) {
  const object = mesh(new THREE.BoxGeometry(w, h, d), material, name);
  object.position.set(x, y, z);
  object.rotation.set(...rotation);
  group.add(object);
  return object;
}

function panel(group, name, [x, y, z], [w, h, d], material, rotation = [0, 0, 0]) {
  return box(group, name, [x, y, z], [w, h, d], material, rotation);
}

function gable(group, name, width, depth, rise, [x, y, z], rotation, material) {
  const shape = new THREE.Shape();
  shape.moveTo(-depth / 2, 0);
  shape.lineTo(depth / 2, 0);
  shape.lineTo(0, rise);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
  geometry.center();
  const object = mesh(geometry, material, name);
  object.position.set(x, y, z);
  object.rotation.set(...rotation);
  group.add(object);
  return object;
}

function createWindow(group, name, x, y, z, width, height, side = "front") {
  const isSide = side === "side";
  const rotation = isSide ? [0, Math.PI / 2, 0] : [0, 0, 0];
  const thickness = 0.08;
  const depth = isSide ? 0.08 : thickness;
  const horizontal = isSide ? thickness : width + 0.13;
  const vertical = isSide ? width + 0.13 : thickness;
  box(group, `${name}_frame`, [x, y, z], [horizontal, height + 0.13, vertical], materials.trim, rotation);
  const glassDepth = isSide ? 0.092 : 0.092;
  const glass = mesh(new THREE.PlaneGeometry(width, height), materials.glass, `${name}_glass`);
  glass.position.set(x, y, z + (isSide ? 0 : 0.055));
  if (isSide) {
    glass.rotation.y = Math.PI / 2;
    glass.position.x += 0.055;
  }
  group.add(glass);
  for (const divider of [-0.24, 0.24]) {
    if (isSide) box(group, `${name}_mullion`, [x + 0.06, y, z + divider * width], [0.034, height, 0.035], materials.trim);
    else box(group, `${name}_mullion`, [x + divider * width, y, z + 0.065], [0.034, height, 0.028], materials.trim);
  }
  if (isSide) box(group, `${name}_transom`, [x + 0.06, y + height * 0.12, z], [0.034, 0.03, width], materials.trim);
  else box(group, `${name}_transom`, [x, y + height * 0.12, z + 0.065], [width, 0.03, 0.028], materials.trim);
}

function createDoor(group, x, y, z) {
  box(group, "entrance_portal", [x, y + 0.04, z - 0.035], [1.55, 2.65, 0.2], materials.stoneLight);
  box(group, "entrance_door", [x, y, z + 0.08], [1.12, 2.22, 0.07], materials.charcoal);
  box(group, "entrance_sideglass", [x + 0.74, y, z + 0.08], [0.28, 2.22, 0.05], materials.glass);
  box(group, "door_handle", [x + 0.38, y, z + 0.145], [0.035, 0.68, 0.035], materials.stoneLight);
}

function createRoof(group, width, depth, wallHeight) {
  const pitch = 34 * Math.PI / 180;
  const half = depth / 2;
  const rise = half * Math.tan(pitch);
  const run = half / Math.cos(pitch);
  const overhang = 0.38;
  const roofWidth = width + overhang * 2;
  const roofRun = run + overhang * 0.72;
  const zOffset = half / 2;
  const yOffset = wallHeight + rise / 2;
  const roofA = new THREE.Group(); roofA.name = "solar_roof_south"; roofA.position.set(0, yOffset, -zOffset); roofA.rotation.x = -pitch;
  const roofB = new THREE.Group(); roofB.name = "solar_roof_north"; roofB.position.set(0, yOffset, zOffset); roofB.rotation.x = pitch;
  [roofA, roofB].forEach((roof) => {
    box(roof, "bipv_roof_plane", [0, 0, 0], [roofWidth, 0.13, roofRun], materials.bipv);
    const rows = 15;
    for (let row = 0; row < rows; row++) {
      const z = -roofRun / 2 + (row + 0.5) * (roofRun / rows);
      box(roof, `bipv_tile_joint_${row}`, [0, 0.071, z], [roofWidth - 0.12, 0.012, 0.018], materials.bipvLine);
    }
    const cols = 8;
    for (let col = 1; col < cols; col++) {
      const x = -roofWidth / 2 + col * (roofWidth / cols);
      box(roof, `bipv_tile_vertical_${col}`, [x, 0.071, 0], [0.012, 0.012, roofRun - 0.08], materials.bipvLine);
    }
    group.add(roof);
  });
  box(group, "roof_ridge", [0, wallHeight + rise + 0.08, 0], [roofWidth + 0.04, 0.14, 0.17], materials.trim);
  return { rise };
}

function stoneCladding(group, width, depth, wallHeight) {
  const frontZ = depth / 2 + 0.06;
  const rearZ = -depth / 2 - 0.06;
  box(group, "limestone_front", [0, wallHeight / 2, frontZ], [width + 0.04, wallHeight, 0.035], materials.stone);
  box(group, "limestone_rear", [0, wallHeight / 2, rearZ], [width + 0.04, wallHeight, 0.035], materials.stoneLight);
  for (const side of [-1, 1]) box(group, `limestone_side_${side}`, [side * (width / 2 + 0.06), wallHeight / 2, 0], [0.035, wallHeight, depth + 0.04], materials.stoneLight);
  // Large-format limestone courses keep the massing crisp at interactive scale.
  for (let row = 1; row < 12; row++) {
    const y = row * (wallHeight / 12);
    box(group, `limestone_course_front_${row}`, [0, y, frontZ + 0.024], [width, 0.015, 0.012], materials.mortar);
    box(group, `limestone_course_rear_${row}`, [0, y, rearZ - 0.024], [width, 0.015, 0.012], materials.mortar);
  }
  for (const x of [-width / 3, 0, width / 3]) box(group, `limestone_joint_front_${x}`, [x, wallHeight / 2, frontZ + 0.024], [0.015, wallHeight, 0.012], materials.mortar);
  for (const side of [-1, 1]) {
    for (let row = 1; row < 12; row++) box(group, `limestone_course_side_${side}_${row}`, [side * (width / 2 + 0.024), row * (wallHeight / 12), 0], [0.012, 0.015, depth], materials.mortar);
  }
}

function timberScreen(group, name, centerX, centerY, z, width, height) {
  box(group, `${name}_backing`, [centerX, centerY, z], [width, height, 0.035], materials.charcoal);
  const count = Math.max(4, Math.floor(width / 0.21));
  for (let index = 0; index < count; index++) {
    const x = centerX - width / 2 + 0.09 + index * (width - 0.18) / Math.max(1, count - 1);
    box(group, `${name}_slat_${index}`, [x, centerY, z + 0.045], [0.075, height, 0.04], materials.timber);
  }
}

function addLandscape(group, width, depth) {
  const shrubMaterial = new THREE.MeshStandardMaterial({ color: "#526a52", roughness: 1 });
  const hedgeMaterial = new THREE.MeshStandardMaterial({ color: "#6d8063", roughness: 1 });
  for (const [x, z, s] of [[-width * 0.48, depth * 0.66, 0.46], [-width * 0.36, depth * 0.76, 0.6], [width * 0.32, depth * 0.7, 0.5], [width * 0.47, depth * 0.54, 0.38]]) {
    const shrub = mesh(new THREE.IcosahedronGeometry(s, 2), shrubMaterial, "landscape_shrub");
    shrub.position.set(x, s * 0.75, z);
    group.add(shrub);
  }
  box(group, "landscape_hedge", [-width * 0.36, 0.37, -depth * 0.68], [width * 0.62, 0.74, 0.42], hedgeMaterial);
}

function createCarport() {
  const group = new THREE.Group(); group.name = "carport"; group.position.set(-5.85, 0, 0.35);
  const w = 3.3, d = 4.6, h = 3.1;
  for (const [x, z] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) box(group, "carport_post", [x, h / 2, z], [0.14, h, 0.14], materials.trim);
  const roof = new THREE.Group(); roof.name = "carport_solar_plane"; roof.position.set(0, h + 0.03, 0); roof.rotation.x = 0.1;
  box(roof, "carport_bipv", [0, 0, 0], [w + 0.24, 0.1, d + 0.18], materials.bipv);
  for (let x = -1.1; x <= 1.1; x += 1.1) box(roof, "carport_seam", [x, 0.057, 0], [0.018, 0.012, d], materials.bipvLine);
  group.add(roof);
  return group;
}

function createConservatory() {
  const group = new THREE.Group(); group.name = "conservatory"; group.position.set(5.72, 0, 0.8);
  const w = 3.65, d = 3.35, base = 0.5, h = 2.15;
  box(group, "conservatory_plinth", [0, base / 2, 0], [w, base, d], materials.stone);
  const glassBox = mesh(new THREE.BoxGeometry(w - 0.1, h, d - 0.1), materials.glass, "conservatory_glass"); glassBox.position.set(0, base + h / 2, 0); group.add(glassBox);
  for (const x of [-w / 2, -w / 4, 0, w / 4, w / 2]) box(group, "conservatory_frame_front", [x, base + h / 2, d / 2 + 0.025], [0.08, h + 0.05, 0.08], materials.trim);
  for (const z of [-d / 2, -d / 4, 0, d / 4, d / 2]) box(group, "conservatory_frame_side", [w / 2 + 0.025, base + h / 2, z], [0.08, h + 0.05, 0.08], materials.trim);
  const roof = new THREE.Group(); roof.name = "conservatory_solar_glass"; roof.position.set(0, base + h + 0.24, 0); roof.rotation.x = 0.17;
  box(roof, "conservatory_roof", [0, 0, 0], [w + 0.15, 0.075, d + 0.18], materials.warmGlass);
  for (const x of [-w / 2, -w / 4, 0, w / 4, w / 2]) box(roof, "conservatory_roof_frame", [x, 0.047, 0], [0.055, 0.027, d + 0.1], materials.trim);
  group.add(roof);
  return group;
}

function createHouse() {
  const root = new THREE.Group(); root.name = "Premium_BIPV_House";
  const width = 11.8, depth = 7.8, wallHeight = 6.15;
  box(root, "site_ground", [0, -0.15, 0], [26, 0.28, 20], materials.grass);
  box(root, "patio", [0.2, 0.015, depth / 2 + 1.42], [11.8, 0.08, 3.25], materials.paving);
  box(root, "house_wall_core", [0, wallHeight / 2, 0], [width, wallHeight, depth], materials.mortar);
  stoneCladding(root, width, depth, wallHeight);
  const { rise } = createRoof(root, width, depth, wallHeight);
  gable(root, "west_gable", 0.16, depth, rise, [-width / 2 - 0.02, wallHeight + rise / 2, 0], [0, Math.PI / 2, 0], materials.stoneLight);
  gable(root, "east_gable", 0.16, depth, rise, [width / 2 + 0.02, wallHeight + rise / 2, 0], [0, -Math.PI / 2, 0], materials.stoneLight);
  // The front elevation follows the reference: deep portal, broad glazing, then a restrained upper timber screen.
  createDoor(root, 0.2, 1.18, depth / 2 + 0.1);
  createWindow(root, "front_left_window", -3.55, 1.6, depth / 2 + 0.1, 2.6, 1.82);
  createWindow(root, "front_right_window", 3.85, 1.6, depth / 2 + 0.1, 2.25, 1.82);
  createWindow(root, "upper_glazing_left", -3.6, 4.5, depth / 2 + 0.105, 2.45, 1.34);
  createWindow(root, "upper_glazing_right", 3.75, 4.5, depth / 2 + 0.105, 2.18, 1.34);
  timberScreen(root, "upper_timber_left", -1.45, 4.5, depth / 2 + 0.11, 1.72, 1.55);
  timberScreen(root, "upper_timber_right", 1.55, 4.5, depth / 2 + 0.11, 1.46, 1.55);
  createWindow(root, "side_window_a", width / 2 + 0.105, 1.75, -1.72, 1.55, 1.8, "side");
  createWindow(root, "side_window_b", width / 2 + 0.105, 4.48, -1.15, 1.38, 1.35, "side");
  createWindow(root, "side_window_c", -width / 2 - 0.105, 4.48, 0.8, 1.2, 1.35, "side");
  // Thin plinth and sill lines break up the stone without turning the model into a brick-texture box.
  box(root, "limestone_plinth", [0, 0.38, depth / 2 + 0.1], [width + 0.12, 0.16, 0.14], materials.stoneShadow);
  box(root, "upper_limestone_band", [0, 3.12, depth / 2 + 0.1], [width + 0.1, 0.11, 0.1], materials.stoneLight);
  const carport = createCarport(); root.add(carport);
  const conservatory = createConservatory(); root.add(conservatory);
  addLandscape(root, width, depth);
  root.userData = { category: "premium-bipv-house", visualReference: "premium-solar-house-turntable.png" };
  return root;
}

const root = createHouse();
const exporter = new GLTFExporter();
exporter.parse(root, (result) => {
  fs.mkdirSync(new URL(".", `file://${OUT}`).pathname, { recursive: true });
  fs.writeFileSync(OUT, Buffer.from(result));
  console.log(`Wrote ${OUT} (${Math.round(fs.statSync(OUT).size / 1024)} KB)`);
}, (error) => { console.error(error); process.exit(1); }, { binary: true, onlyVisible: true, trs: false, includeCustomExtensions: false });
