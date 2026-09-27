import fs from "node:fs";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const buffer = fs.readFileSync("/home/ubuntu/modernite-bipv-platform-artifacts/premium-bipv-house.glb");
const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
new GLTFLoader().parse(arrayBuffer, "", (gltf) => {
  const names = [];
  gltf.scene.traverse((node) => names.push({ name: node.name, type: node.type, visible: node.visible }));
  const bounds = new THREE.Box3().setFromObject(gltf.scene);
  console.log(JSON.stringify({ children: gltf.scene.children.length, bounds: { min: bounds.min, max: bounds.max, size: bounds.getSize(new THREE.Vector3()) }, nodes: names.slice(0, 30), count: names.length }, null, 2));
}, (error) => { console.error(error); process.exit(1); });
