import * as THREE from 'three';
import { CONFIG as C } from '../config';
import { flightSpeed, type GameState } from '../game';
import type { Models } from './models';

interface Flash {
  mesh: THREE.Mesh;
  age: number;
  life: number;
  from: number;
  to: number;
}

const STAR_DEPTH = 2400;

/** Draws the game state with Three.js. Game x maps to x, game z (distance ahead) maps to -z. */
export class Renderer {
  private readonly gl: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(C.camera.fov, 16 / 9, 1, 4000);
  private readonly ship = new THREE.Group();
  private readonly flames: THREE.Mesh[] = [];
  private readonly stars: THREE.Points;
  private readonly asteroids = new Map<number, THREE.Object3D>();
  private readonly aliens = new Map<number, THREE.Object3D>();
  private readonly bullets = new Map<number, THREE.Object3D>();
  private readonly bulletGeo = new THREE.BoxGeometry(3, 3, 46);
  private readonly bulletMat = new THREE.MeshBasicMaterial({ color: 0x8fdcff, fog: false });
  private readonly flashGeo = new THREE.IcosahedronGeometry(1, 1);
  private flashes: Flash[] = [];
  private t = 0;
  private camX = 0;
  private bank = 0;
  private shake = 0;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly models: Models) {
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.gl.toneMapping = THREE.ACESFilmicToneMapping;

    this.scene.background = new THREE.Color(C.fog.color);
    this.scene.fog = new THREE.Fog(C.fog.color, C.fog.near, C.fog.far);

    this.scene.add(new THREE.HemisphereLight(0x9fb0ff, 0x14121c, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 3.0);
    key.position.set(-0.5, 1, 0.9); // from above and behind the camera
    const rim = new THREE.DirectionalLight(0x3b6cff, 2.6);
    rim.position.set(0.7, 0.35, -1); // blue light from ahead, for the edge glow on rocks and hulls
    this.scene.add(key, rim);

    this.stars = this.makeStars();
    this.scene.add(this.stars);

    const hull = models.ship;
    hull.scale.setScalar(C.shipVisualRadius);
    hull.rotation.y = Math.PI; // the exported models have their nose along +Z; flight direction is -Z
    this.ship.add(hull);
    this.addFlames();
    this.scene.add(this.ship);

    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  private makeStars(): THREE.Points {
    const pos = new Float32Array(C.starCount * 3);
    for (let i = 0; i < C.starCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 3600;
      pos[i * 3 + 1] = (Math.random() - 0.4) * 1800;
      pos[i * 3 + 2] = 250 - Math.random() * STAR_DEPTH;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xcfd8ff, size: 1.8, sizeAttenuation: false, fog: false }));
  }

  private addFlames(): void {
    // Engine nozzle positions, in the ship model's unit-radius space.
    const geo = new THREE.ConeGeometry(0.085, 0.7, 10);
    geo.translate(0, 0.35, 0); // base at the origin so scaling stretches it backwards
    const mat = new THREE.MeshBasicMaterial({
      color: 0x4aa8ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    });
    for (const side of [-1, 1]) {
      const flame = new THREE.Mesh(geo, mat);
      flame.rotation.x = Math.PI / 2; // tip points backwards (+Z)
      flame.position.set(side * 0.362 * C.shipVisualRadius, 0.145 * C.shipVisualRadius, 0.95 * C.shipVisualRadius);
      flame.scale.setScalar(C.shipVisualRadius);
      this.flames.push(flame);
      this.ship.add(flame);
    }
  }

  resize(): void {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.gl.setSize(w, h, false);
    const aspect = w / h;
    this.camera.aspect = aspect;
    // On tall (portrait) screens, widen the vertical field of view so the sides stay visible.
    const minHalfHorizontal = THREE.MathUtils.degToRad(33);
    const halfVertical = Math.max(THREE.MathUtils.degToRad(C.camera.fov / 2), Math.atan(Math.tan(minHalfHorizontal) / aspect));
    this.camera.fov = Math.min(100, THREE.MathUtils.radToDeg(halfVertical * 2));
    this.camera.updateProjectionMatrix();
  }

  private sync<T extends { id: number }>(
    items: T[], pool: Map<number, THREE.Object3D>, create: (item: T) => THREE.Object3D, place: (obj: THREE.Object3D, item: T) => void,
  ): void {
    const seen = new Set<number>();
    for (const item of items) {
      seen.add(item.id);
      let obj = pool.get(item.id);
      if (!obj) {
        obj = create(item);
        pool.set(item.id, obj);
        this.scene.add(obj);
      }
      place(obj, item);
    }
    for (const [id, obj] of pool) {
      if (!seen.has(id)) {
        this.scene.remove(obj);
        pool.delete(id);
      }
    }
  }

  private flash(x: number, z: number, color: number, from: number, to: number, life: number): void {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const mesh = new THREE.Mesh(this.flashGeo, mat);
    mesh.position.set(x, 6, -z);
    this.scene.add(mesh);
    this.flashes.push({ mesh, age: 0, life, from, to });
  }

  render(s: GameState, dt: number): void {
    this.t += dt;
    const playing = s.phase === 'playing';
    const speed = playing ? flightSpeed(s) : C.flightSpeedStart * (s.phase === 'start' ? 0.6 : 0.25);

    // Stars stream towards the camera and wrap around.
    const pos = this.stars.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      let z = pos.getZ(i) + speed * dt * 0.8;
      if (z > 250) z -= STAR_DEPTH;
      pos.setZ(i, z);
    }
    pos.needsUpdate = true;
    this.stars.position.x = this.camX * 0.5;

    // Ship
    const k = Math.min(1, dt * 8);
    this.bank += ((playing ? s.moveX : 0) - this.bank) * k;
    this.ship.position.set(s.shipX, Math.sin(this.t * 2.2) * 1.5, 0);
    this.ship.rotation.set(0, -this.bank * 0.12, -this.bank * 0.5);
    const blinkOff = s.invuln > 0 && Math.floor(s.invuln * 12) % 2 === 1;
    this.ship.visible = !(blinkOff || (s.phase === 'results' && s.lives <= 0));
    for (const [i, flame] of this.flames.entries()) {
      flame.scale.y = C.shipVisualRadius * (0.8 + 0.25 * Math.sin(this.t * 40 + i * 2) + 0.15 * Math.random()) * (playing ? 1 : 0.7);
    }

    this.sync(s.asteroids, this.asteroids,
      (a) => {
        const list = this.models.asteroids;
        const obj = list[Math.floor(a.seed * list.length) % list.length].clone(true);
        obj.scale.setScalar(a.radius);
        obj.rotation.set(a.seed * 20, a.seed * 50, a.seed * 90);
        obj.userData.spin = new THREE.Vector3(Math.sin(a.seed * 31) * 0.8, Math.cos(a.seed * 57) * 0.8, Math.sin(a.seed * 83) * 0.5);
        return obj;
      },
      (obj, a) => {
        obj.position.set(a.x, 0, -a.z);
        const spin = obj.userData.spin as THREE.Vector3;
        obj.rotation.x += spin.x * dt;
        obj.rotation.y += spin.y * dt;
        obj.rotation.z += spin.z * dt;
      });

    this.sync(s.aliens, this.aliens,
      (a) => {
        const list = this.models.aliens;
        const obj = list[Math.floor(a.seed * list.length) % list.length].clone(true);
        obj.scale.setScalar(a.radius * C.alienVisualScale);
        return obj;
      },
      (obj, a) => {
        obj.position.set(a.x, 4 + Math.sin(this.t * 3 + a.swayPhase) * 4, -a.z);
        // The exported models have their nose along +Z, so aliens already face the player.
        obj.rotation.set(0.12, 0, Math.sin(this.t * C.alienSwayFrequency + a.swayPhase) * 0.25);
      });

    this.sync(s.bullets, this.bullets,
      () => new THREE.Mesh(this.bulletGeo, this.bulletMat),
      (obj, b) => obj.position.set(b.x, 3, -b.z));

    for (const e of s.events) {
      if (e.type === 'alienDestroyed') {
        this.flash(e.x, e.z, 0x7dff6a, 25, 110, 0.4);
        this.flash(e.x, e.z, 0xffffff, 10, 55, 0.2);
      } else if (e.type === 'shipHit') {
        this.flash(s.shipX, 0, 0xff5a3c, 30, 120, 0.45);
        this.shake = 0.4;
      } else if (e.type === 'bulletBlocked') {
        this.flash(e.x, e.z, 0xbfe6ff, 6, 26, 0.15);
      }
    }
    this.flashes = this.flashes.filter((f) => {
      f.age += dt;
      const p = f.age / f.life;
      if (p >= 1) {
        this.scene.remove(f.mesh);
        (f.mesh.material as THREE.Material).dispose();
        return false;
      }
      f.mesh.scale.setScalar(f.from + (f.to - f.from) * p);
      (f.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - p;
      return true;
    });

    // Camera follows the ship sideways with a small lag.
    const cam = C.camera;
    this.camX += (s.shipX * cam.followX - this.camX) * Math.min(1, dt * cam.lag);
    this.shake = Math.max(0, this.shake - dt);
    const jitter = this.shake * 14;
    this.camera.position.set(this.camX + (Math.random() - 0.5) * jitter, cam.height + (Math.random() - 0.5) * jitter, cam.distance);
    this.camera.lookAt(this.camX, cam.lookHeight, -cam.lookAhead);

    this.gl.render(this.scene, this.camera);
  }
}
