import * as THREE from 'three';
import { ParticleSystem } from '../effects/ParticleSystem';
import { soundFx } from '../audio/SoundEffects';
import { ZombieManager } from '../zombies/ZombieManager';

export interface ActiveGrenade {
  mesh: THREE.Group;
  velocity: THREE.Vector3;
  timer: number;
  isDetonated: boolean;
  pinLight?: THREE.PointLight;
}

export class GrenadeManager {
  private static scene: THREE.Scene | null = null;
  private static activeGrenades: ActiveGrenade[] = [];
  // Pre-allocated pool: adding/removing lights at runtime forces three.js to
  // recompile every shader (multi-frame hitch) — pooled lights keep the count fixed
  private static lightPool: THREE.PointLight[] = [];

  public static init(scene: THREE.Scene) {
    this.scene = scene;
    this.activeGrenades = [];
    this.lightPool = [];
    if (scene) {
      for (let i = 0; i < 4; i++) {
        const light = new THREE.PointLight(0xef4444, 0, 4);
        light.visible = false;
        scene.add(light);
        this.lightPool.push(light);
      }
    }
  }

  private static takeLight(): THREE.PointLight | undefined {
    return this.lightPool.find((l) => !l.visible) || undefined;
  }

  private static releaseLight(light?: THREE.PointLight | null) {
    if (!light || !this.scene) return;
    this.scene.add(light); // detach from grenade mesh back to scene root
    light.visible = false;
    light.intensity = 0;
  }

  public static clearAll() {
    if (this.scene) {
      for (const g of this.activeGrenades) {
        this.scene.remove(g.mesh);
      }
    }
    this.activeGrenades = [];
    for (const light of this.lightPool) {
      this.releaseLight(light);
    }
  }

  public static throwGrenade(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    force: number = 18
  ): boolean {
    if (!this.scene) return false;

    // Create 3D Frag Grenade Mesh
    const grenadeGroup = new THREE.Group();
    grenadeGroup.position.copy(origin).add(direction.clone().multiplyScalar(0.7));

    // M67 Ribbed Oval Body
    const bodyGeo = new THREE.SphereGeometry(0.12, 10, 10);
    bodyGeo.scale(1.0, 1.25, 1.0);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x2e4228, // Olive drab military green
      roughness: 0.65,
      metalness: 0.35,
    });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    grenadeGroup.add(bodyMesh);

    // Fuse Collar & Fly-off Lever
    const collarGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.08, 8);
    const collarMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8 });
    const collarMesh = new THREE.Mesh(collarGeo, collarMat);
    collarMesh.position.y = 0.14;
    grenadeGroup.add(collarMesh);

    const leverGeo = new THREE.BoxGeometry(0.02, 0.12, 0.04);
    const leverMesh = new THREE.Mesh(leverGeo, collarMat);
    leverMesh.position.set(0.03, 0.12, 0);
    grenadeGroup.add(leverMesh);

    // Blinking red detonation warning LED (pooled — no runtime light creation)
    const pinLight = this.takeLight();
    if (pinLight) {
      pinLight.position.set(0, 0.16, 0);
      pinLight.visible = true;
      grenadeGroup.add(pinLight);
    }

    this.scene.add(grenadeGroup);

    // Initial launch velocity: camera forward + slight upward arc
    const throwDir = direction.clone().normalize();
    throwDir.y += 0.22; // slight upward pitch
    throwDir.normalize();

    const velocity = throwDir.multiplyScalar(force);

    this.activeGrenades.push({
      mesh: grenadeGroup,
      velocity,
      timer: 1.85, // 1.85s fuse
      isDetonated: false,
      pinLight,
    });

    soundFx.playPistolShot(); // Metallic throw audio impulse
    return true;
  }

  public static update(
    delta: number,
    zombieManager: ZombieManager,
    onKill: (zombie: any, isHeadshot: boolean) => void,
    onScreenShake?: (intensity: number) => void
  ) {
    if (!this.scene) return;

    const gravity = -20;

    for (let i = this.activeGrenades.length - 1; i >= 0; i--) {
      const g = this.activeGrenades[i];
      g.timer -= delta;

      // Pulse warning light faster as detonation nears
      const blinkRate = g.timer < 0.6 ? 24 : 10;
      if (g.pinLight) {
        g.pinLight.intensity = Math.sin(Date.now() * 0.02 * blinkRate) > 0 ? 3.5 : 0.2;
      }

      // Apply physics
      g.velocity.y += gravity * delta;
      g.mesh.position.addScaledVector(g.velocity, delta);

      // Tumble rotation
      g.mesh.rotation.x += g.velocity.z * delta * 4;
      g.mesh.rotation.z -= g.velocity.x * delta * 4;

      // Ground bounce & friction
      if (g.mesh.position.y <= 0.12) {
        g.mesh.position.y = 0.12;
        g.velocity.y = -g.velocity.y * 0.42; // damping bounce
        g.velocity.x *= 0.72; // ground friction
        g.velocity.z *= 0.72;
      }

      // Detonation
      if (g.timer <= 0 && !g.isDetonated) {
        g.isDetonated = true;
        this.detonate(g.mesh.position, zombieManager, onKill, onScreenShake);
        this.releaseLight(g.pinLight);
        this.scene.remove(g.mesh);
        this.activeGrenades.splice(i, 1);
      }
    }
  }

  private static detonate(
    pos: THREE.Vector3,
    zombieManager: ZombieManager,
    onKill: (zombie: any, isHeadshot: boolean) => void,
    onScreenShake?: (intensity: number) => void
  ) {
    // Sound & camera shake
    soundFx.playExplosion();
    if (onScreenShake) {
      onScreenShake(0.85);
    }

    // Visual explosion particles & scorch decal
    ParticleSystem.spawnExplosion(pos);
    ParticleSystem.spawnBloodDecal(new THREE.Vector3(pos.x, 0.02, pos.z), 4.2);

    // Area damage to zombies: 420 radial explosive damage within 8 meters!
    zombieManager.damageArea(pos, 8.0, 420, onKill);
  }
}
