import * as THREE from 'three';

/**
 * Pooled first-person gun effects: muzzle flash sprites + dynamic lights,
 * hitscan bullet tracers, and wall impact flashes. All pool-backed,
 * zero per-shot allocation after warmup.
 */

function createGlowTexture(inner: string, outer: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.25, outer);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface FlashInstance {
  sprite: THREE.Sprite;
  light: THREE.PointLight;
  life: number;
  maxLife: number;
  baseScale: number;
  active: boolean;
}

interface TracerInstance {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
  active: boolean;
}

export class GunEffects {
  private static scene: THREE.Scene | null = null;
  private static flashes: FlashInstance[] = [];
  private static tracers: TracerInstance[] = [];
  private static impactLights: { light: THREE.PointLight; life: number; active: boolean }[] = [];
  private static flashTextures: THREE.CanvasTexture[] = [];

  private static muzzleFlashMat: THREE.SpriteMaterial | null = null;

  public static init(scene: THREE.Scene) {
    if (this.scene) return;
    this.scene = scene;

    // Debug/testing hook (used by automated visual checks)
    (globalThis as Record<string, unknown>).__dzGunFX = GunEffects;

    const warmFlash = createGlowTexture('rgba(255,252,230,1)', 'rgba(255,170,60,0.85)');
    const coolFlash = createGlowTexture('rgba(235,245,255,1)', 'rgba(120,170,255,0.7)');
    this.flashTextures = [warmFlash, coolFlash];

    this.muzzleFlashMat = new THREE.SpriteMaterial({
      map: warmFlash,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      transparent: true,
      opacity: 1,
    });

    // 4 pooled muzzle flashes (sprite + light)
    for (let i = 0; i < 4; i++) {
      const sprite = new THREE.Sprite(this.muzzleFlashMat.clone());
      sprite.visible = false;
      sprite.renderOrder = 999;
      scene.add(sprite);

      const light = new THREE.PointLight(0xffc46b, 0, 14, 2.0);
      light.visible = false;
      scene.add(light);

      this.flashes.push({ sprite, light, life: 0, maxLife: 0.06, baseScale: 0.4, active: false });
    }

    // 28 pooled tracers: thin stretched additive beams along Z
    const tracerGeo = new THREE.CylinderGeometry(0.014, 0.003, 1, 5, 1, true);
    tracerGeo.rotateX(Math.PI / 2); // axis -> +Z so lookAt() aims it
    tracerGeo.translate(0, 0, -0.5); // origin at muzzle end
    const tracerMat = new THREE.MeshBasicMaterial({
      color: 0xffc873,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    for (let i = 0; i < 28; i++) {
      const mesh = new THREE.Mesh(tracerGeo, tracerMat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      scene.add(mesh);
      this.tracers.push({ mesh, life: 0, maxLife: 0.09, active: false });
    }

    // 3 pooled impact lights for bullet hits on world geometry
    for (let i = 0; i < 3; i++) {
      const light = new THREE.PointLight(0xffd9a0, 0, 10, 2.0);
      light.visible = false;
      scene.add(light);
      this.impactLights.push({ light, life: 0, active: false });
    }
  }

  public static spawnMuzzleFlash(pos: THREE.Vector3, dir: THREE.Vector3, power: number = 1.0) {
    if (!this.scene) return;

    let fx = this.flashes.find((f) => !f.active) || this.flashes[0];

    fx.active = true;
    fx.life = 0;
    fx.maxLife = 0.045 + Math.random() * 0.025;
    // Small on-screen quad at the barrel tip — bright but never a whiteout
    fx.baseScale = (0.14 + Math.random() * 0.07) * power;

    fx.sprite.position.copy(pos);
    fx.sprite.material.rotation = Math.random() * Math.PI * 2;
    // Alternate warm/cool flash texture per shot for variety
    fx.sprite.material.map = this.flashTextures[Math.random() > 0.25 ? 0 : 1];
    fx.sprite.material.opacity = 1;
    fx.sprite.scale.setScalar(fx.baseScale);
    fx.sprite.visible = true;

    fx.light.position.copy(pos).addScaledVector(dir, 0.25);
    fx.light.intensity = 18 * power;
    fx.light.visible = true;
  }

  public static spawnTracer(from: THREE.Vector3, to: THREE.Vector3, thickness: number = 1.0) {
    const t = this.tracers.find((tr) => !tr.active);
    if (!t) return;

    const dir = to.clone().sub(from);
    const length = dir.length();
    if (length < 0.5) return;

    t.active = true;
    t.life = 0;
    t.maxLife = 0.05 + length * 0.0006;

    t.mesh.position.copy(from);
    t.mesh.lookAt(to);
    t.mesh.scale.set(thickness, thickness, length);
    t.mesh.visible = true;
  }

  public static spawnImpactFlash(pos: THREE.Vector3) {
    const slot = this.impactLights.find((l) => !l.active) || this.impactLights[0];
    slot.active = true;
    slot.life = 0;
    slot.light.position.copy(pos);
    slot.light.intensity = 18;
    slot.light.visible = true;
  }

  public static update(delta: number) {
    for (const f of this.flashes) {
      if (!f.active) continue;
      f.life += delta;
      const t = f.life / f.maxLife;
      if (t >= 1) {
        f.active = false;
        f.sprite.visible = false;
        f.light.visible = false;
        f.light.intensity = 0;
        continue;
      }
      // Snappy flash: fast fade, slight scale growth
      f.sprite.material.opacity = 1 - t;
      f.sprite.scale.setScalar(f.baseScale * (1 + t * 1.6));
      f.light.intensity *= Math.pow(0.0001, delta);
    }

    for (const t of this.tracers) {
      if (!t.active) continue;
      t.life += delta;
      if (t.life >= t.maxLife) {
        t.active = false;
        t.mesh.visible = false;
        continue;
      }
      const mat = t.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.85 * (1 - t.life / t.maxLife);
    }

    for (const l of this.impactLights) {
      if (!l.active) continue;
      l.life += delta;
      if (l.life > 0.09) {
        l.active = false;
        l.light.visible = false;
        l.light.intensity = 0;
        continue;
      }
      l.light.intensity *= Math.pow(0.0002, delta);
    }
  }

  public static clearAll() {
    for (const f of this.flashes) {
      f.active = false;
      f.sprite.visible = false;
      f.light.visible = false;
      f.light.intensity = 0;
    }
    for (const t of this.tracers) {
      t.active = false;
      t.mesh.visible = false;
    }
    for (const l of this.impactLights) {
      l.active = false;
      l.light.visible = false;
      l.light.intensity = 0;
    }
  }
}
