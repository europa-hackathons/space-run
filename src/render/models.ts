import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CONFIG as C } from '../config';

/** Every model is scaled to a radius of 1, so the renderer can scale it to a game radius. */
export interface Models {
  ship: THREE.Object3D;
  aliens: THREE.Object3D[];
  asteroids: THREE.Object3D[];
}

function unitSize(obj: THREE.Object3D, horizontalOnly: boolean): THREE.Object3D {
  const size = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
  const half = (horizontalOnly ? Math.max(size.x, size.z) : Math.max(size.x, size.y, size.z)) / 2;
  obj.scale.multiplyScalar(1 / (half || 1));
  const group = new THREE.Group();
  group.add(obj);
  return group;
}

/** Optional single file holding every model as base64, used where .glb files cannot be served. */
type ModelPack = Record<string, string>;

async function loadPack(): Promise<ModelPack | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}models.json`);
    return res.ok ? ((await res.json()) as ModelPack) : null;
  } catch {
    return null;
  }
}

function decode(base64: string): ArrayBuffer {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

async function load(loader: GLTFLoader, pack: ModelPack | null, file: string, horizontalOnly: boolean): Promise<THREE.Object3D | null> {
  try {
    const gltf = pack?.[file]
      ? await loader.parseAsync(decode(pack[file]), '')
      : await loader.loadAsync(`${import.meta.env.BASE_URL}models/${file}`);
    return unitSize(gltf.scene, horizontalOnly);
  } catch {
    console.warn(`Model ${file} is missing or invalid, skipping it.`);
    return null;
  }
}

function fallbackShip(): THREE.Object3D {
  const mesh = new THREE.Mesh(
    new THREE.ConeGeometry(0.55, 1.8, 6),
    new THREE.MeshStandardMaterial({ color: 0x8a90a8, flatShading: true }),
  );
  mesh.rotation.x = -Math.PI / 2; // tip points along -Z, the flight direction
  return new THREE.Group().add(mesh);
}

function fallbackAlien(): THREE.Object3D {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(1, 12, 8),
    new THREE.MeshStandardMaterial({ color: 0x2c8a3a, emissive: 0x1d6b25, flatShading: true }),
  );
  mesh.scale.y = 0.35;
  return new THREE.Group().add(mesh);
}

function fallbackAsteroid(): THREE.Object3D {
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(pos, i);
    // Same displacement for vertices that share a position, so the surface stays closed.
    const n = Math.sin(v.x * 7.1) * Math.cos(v.y * 5.3) * Math.sin(v.z * 6.7);
    v.multiplyScalar(0.85 + 0.2 * n);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return new THREE.Group().add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x55525e, flatShading: true })));
}

export async function loadModels(): Promise<Models> {
  const loader = new GLTFLoader();
  const pack = await loadPack();
  const [ship, aliens, asteroids] = await Promise.all([
    load(loader, pack, C.models.ship, true),
    Promise.all(C.models.aliens.map((f) => load(loader, pack, f, true))),
    Promise.all(C.models.asteroids.map((f) => load(loader, pack, f, false))),
  ]);
  const found = (list: (THREE.Object3D | null)[]) => list.filter((m): m is THREE.Object3D => m !== null);
  const alienModels = found(aliens);
  const asteroidModels = found(asteroids);
  return {
    ship: ship ?? fallbackShip(),
    aliens: alienModels.length ? alienModels : [fallbackAlien()],
    asteroids: asteroidModels.length ? asteroidModels : [fallbackAsteroid()],
  };
}
