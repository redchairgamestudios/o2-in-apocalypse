import * as THREE from 'three';
import { ParticleSystem } from '../effects/ParticleSystem';
import { PostProcessing } from '../effects/PostProcessing';
import { soundFx } from '../audio/SoundEffects';
import { ZombieManager } from '../zombies/ZombieManager';

interface ActiveRocket {
  mesh: THREE.Group;
  velocity: THREE.Vector3;
  life: number;
  trailTimer: number;
  exhaustLight: THREE.PointLight | null;
}

interface GroundFire {
  group: THREE.Group;
  light: THREE.PointLight;
  life: number;
  maxLife: number;
  flames: THREE.Sprite[];
  baseScales: number[];
}

/**
 * HAVOC RPG-X high-explosive rockets. Straight-flying projectile with a
 * smoke/spark trail that detonates on the first thing it touches — zombie,
 * barrel, wall or ground — with a wide kinetic fireball (7.5m AoE), a
 * lingering ground fire that burns down over ~8 seconds, and a shockwave
 * shake. Mild self-damage if the operator fires point-blank.
 */
export class RocketManager {
  private static scene: THREE.Scene | null = null;
  private static rockets: ActiveRocket[] = [];
  private static fires: GroundFire[] = [];
  private static raycaster: THREE.Raycaster = new THREE.Raycaster();
  private static flameTexture: THREE.Texture | null = null;

  public static init(scene: THREE.Scene) {
    this.scene = scene;
    this.clearAll();
  }

  /** Soft radial flame sprite texture (generated once). */
  private static getFlameTexture(): THREE.Texture {
    if (this.flameTexture) return this.flameTexture;
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(size / 2, size * 0.62, 4, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(255,240,180,1)');
    grad.addColorStop(0.35, 'rgba(255,160,40,0.9)');
    grad.addColorStop(0.65, 'rgba(230,80,20,0.55)');
    grad.addColorStop(1, 'rgba(120,20,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    this.flameTexture = new THREE.CanvasTexture(canvas);
    return this.flameTexture;
  }

  public static clearAll() {
    if (this.scene) {
      for (const r of this.rockets) {
        this.scene.remove(r.mesh);
        if (r.exhaustLight) this.scene.remove(r.exhaustLight);
      }
      for (const f of this.fires) {
        this.scene.remove(f.group);
        this.scene.remove(f.light);
      }
    }
    this.rockets = [];
    this.fires = [];
  }

  public static launch(origin: THREE.Vector3, dir: THREE.Vector3): boolean {
    if (!this.scene) return false;

    const group = new THREE.Group();
    group.position.copy(origin).addScaledVector(dir, 0.8);

    // Rocket body (engine tube + warhead + fins)
    const bodyGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.42, 10);
    bodyGeo.rotateX(Math.PI / 2);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3a4038, roughness: 0.55, metalness: 0.55 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    group.add(body);

    const warheadGeo = new THREE.ConeGeometry(0.055, 0.16, 12);
    warheadGeo.rotateX(-Math.PI / 2);
    const warheadMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.4, metalness: 0.5 });
    const warhead = new THREE.Mesh(warheadGeo, warheadMat);
    warhead.position.z = -0.28;
    group.add(warhead);

    const finGeo = new THREE.BoxGeometry(0.012, 0.09, 0.1);
    for (let i = 0; i < 4; i++) {
      const fin = new THREE.Mesh(finGeo, bodyMat);
      fin.position.z = 0.18;
      fin.rotation.z = (i / 4) * Math.PI * 2;
      fin.position.x = Math.sin((i / 4) * Math.PI * 2) * 0.05;
      fin.position.y = Math.cos((i / 4) * Math.PI * 2) * 0.05;
      group.add(fin);
    }

    // Exhaust glow light (max 2 rockets airborne — allocate directly)
    const exhaustLight = new THREE.PointLight(0xff9040, 2.2, 7, 2.0);
    group.add(exhaustLight);

    this.scene.add(group);
    this.rockets.push({
      mesh: group,
      velocity: dir.clone().normalize().multiplyScalar(30),
      life: 4.0,
      trailTimer: 0,
      exhaustLight,
    });

    // Muzzle backblast: flash, smoke ring & shake — no ground mark, this sits
    // at the operator's feet and must never stamp the floor there
    ParticleSystem.spawnExplosion(origin.clone().addScaledVector(dir, 0.6), false);
    soundFx.playRocketLaunch();
    PostProcessing.punchBloom(0.35);
    return true;
  }

  public static update(
    delta: number,
    zombieManager: ZombieManager,
    envMeshes: THREE.Object3D[],
    explosiveBarrels: { mesh: THREE.Mesh; position: THREE.Vector3; hp: number; exploded: boolean }[],
    onKill: (zombie: any, isHeadshot: boolean) => void,
    onShake: (intensity: number) => void,
    onSelfBlast: (blastPos: THREE.Vector3) => void
  ) {
    this.updateFires(delta, performance.now());
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i];
      r.life -= delta;

      const prevPos = r.mesh.position.clone();
      // Rockets fly essentially flat — meaningful gravity would drop them
      // over the aimed target at range (blast landing far away with no kills)
      r.velocity.y -= 0.4 * delta;
      const step = r.velocity.clone().multiplyScalar(delta);
      const stepLen = step.length();
      const dirNorm = step.clone().normalize();

      // --- Collision sweep over this frame's travel segment ---
      let detonateAt: THREE.Vector3 | null = null;

      // Zombies: thin raycast PLUS a proximity tube (rocket body is fat —
      // a line-only sweep can graze past a hitbox at high speed)
      this.raycaster.set(prevPos, dirNorm);
      this.raycaster.far = stepLen + 0.5;
      const zombieHitboxes = zombieManager.getHitboxMeshes();
      const hits = this.raycaster.intersectObjects(
        [...zombieHitboxes, ...explosiveBarrels.filter((b) => !b.exploded).map((b) => b.mesh)],
        false
      );
      if (hits.length > 0) {
        detonateAt = hits[0].point.clone();
      } else {
        const midPoint = prevPos.clone().addScaledVector(dirNorm, stepLen * 0.5);
        for (const z of zombieManager.zombies) {
          if (z.isDead) continue;
          if (z.mesh.position.distanceTo(midPoint) < 1.0 + stepLen * 0.5) {
            detonateAt = z.mesh.position.clone().add(new THREE.Vector3(0, 1.0, 0));
            break;
          }
        }
      }

      // Environment (walls, props) — only if no zombie/barrel was closer
      if (!detonateAt && envMeshes.length > 0) {
        this.raycaster.set(prevPos, dirNorm);
        this.raycaster.far = stepLen;
        const envHits = this.raycaster.intersectObjects(envMeshes, true);
        if (envHits.length > 0) {
          detonateAt = envHits[0].point.clone();
        }
      }

      // Ground impact
      const groundY = prevPos.y + step.y;
      if (!detonateAt && groundY <= 0.12) {
        const t = Math.max(0, (prevPos.y - 0.12) / Math.max(0.001, -step.y));
        detonateAt = prevPos.clone().addScaledVector(step, Math.min(1, t));
      }

      // --- Detonation ---
      if (detonateAt || r.life <= 0) {
        const at = detonateAt || r.mesh.position;
        this.detonate(at, zombieManager, explosiveBarrels, onKill, onShake, onSelfBlast);
        this.spawnGroundFire(at);
        this.scene!.remove(r.mesh);
        this.rockets.splice(i, 1);
        continue;
      }

      // --- Flight ---
      r.mesh.position.add(step);
      r.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dirNorm);

      // Exhaust trail: hot spark burst + drifting smoke puffs
      r.trailTimer -= delta;
      if (r.trailTimer <= 0) {
        r.trailTimer = 0.03;
        const tail = r.mesh.position.clone().addScaledVector(dirNorm, 0.3);
        ParticleSystem.spawnSparks(tail, dirNorm.clone().negate());
      }
    }
  }

  private static detonate(
    at: THREE.Vector3,
    zombieManager: ZombieManager,
    explosiveBarrels: { mesh: THREE.Mesh; position: THREE.Vector3; hp: number; exploded: boolean }[],
    onKill: (zombie: any, isHeadshot: boolean) => void,
    onShake: (intensity: number) => void,
    onSelfBlast: (blastPos: THREE.Vector3) => void
  ) {
    soundFx.playRocketExplosion(0);
    ParticleSystem.spawnExplosion(at);
    ParticleSystem.spawnExplosion(at.clone().add(new THREE.Vector3(0, 0.8, 0)));
    PostProcessing.punchBloom(1.0);

    // Devastating kinetic fireball: 550 base damage with distance falloff over 9m
    zombieManager.damageArea(at, 9.0, 550, onKill);

    // Chain-detonate any barrel caught in the blast
    for (const barrel of explosiveBarrels) {
      if (barrel.exploded) continue;
      if (barrel.position.distanceTo(at) < 4.0) {
        barrel.exploded = true;
        barrel.mesh.visible = false;
        ParticleSystem.spawnExplosion(barrel.position);
      }
    }

    // Shockwave shake & point-blank self-damage
    onShake(1.4);
    onSelfBlast(at);
  }

  /**
   * Lingering fire pool at the impact point: a ring of flickering flame
   * sprites + an orange light that burn down over ~8 seconds.
   */
  private static spawnGroundFire(at: THREE.Vector3) {
    if (!this.scene) return;

    const group = new THREE.Group();
    const pos = at.clone();
    pos.y = Math.max(0.06, Math.min(pos.y, 1.2)); // fire pool hugs the ground

    const tex = this.getFlameTexture();
    const flames: THREE.Sprite[] = [];
    const baseScales: number[] = [];
    const count = 7;
    for (let i = 0; i < count; i++) {
      const mat = new THREE.SpriteMaterial({
        map: tex,
        color: 0xffffff,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        opacity: 0.95,
      });
      const flame = new THREE.Sprite(mat);
      const ang = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const rad = i === 0 ? 0 : 0.8 + Math.random() * 1.6;
      flame.position.set(Math.sin(ang) * rad, 0.55, Math.cos(ang) * rad);
      const base = i === 0 ? 2.6 : 1.4 + Math.random() * 1.2;
      flame.scale.set(base, base * 1.5, 1);
      group.add(flame);
      flames.push(flame);
      baseScales.push(base);
    }

    const light = new THREE.PointLight(0xff7020, 6.0, 14, 2.0);
    light.position.set(0, 1.0, 0);
    this.scene.add(light);

    group.position.copy(pos);
    this.scene.add(group);
    this.fires.push({ group, light, life: 8.0, maxLife: 8.0, flames, baseScales });
  }

  /** Flicker + fade the ground fires; call every frame. */
  private static updateFires(delta: number, time: number) {
    for (let i = this.fires.length - 1; i >= 0; i--) {
      const f = this.fires[i];
      f.life -= delta;
      const t = Math.max(0, f.life / f.maxLife); // 1 -> 0
      const flicker = 0.75 + Math.sin(time * 0.021 + i * 2.1) * 0.18 + Math.random() * 0.07;

      for (let j = 0; j < f.flames.length; j++) {
        const flame = f.flames[j];
        const mat = flame.material as THREE.SpriteMaterial;
        mat.opacity = 0.9 * t * (0.7 + Math.random() * 0.3);
        const s = f.baseScales[j] * (0.75 + 0.35 * flicker) * (0.5 + 0.5 * t);
        flame.scale.set(s, s * (1.4 + Math.sin(time * 0.017 + j) * 0.12), 1);
        // Flames lean and dance
        flame.position.x += Math.sin(time * 0.011 + j * 3) * 0.002;
      }

      f.light.intensity = 7.0 * t * flicker;

      if (f.life <= 0) {
        this.scene?.remove(f.group);
        this.scene?.remove(f.light);
        this.fires.splice(i, 1);
      }
    }
  }
}
