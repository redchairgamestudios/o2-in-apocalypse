import * as THREE from 'three';
import { soundFx } from '../audio/SoundEffects';
import { ParticleSystem } from '../effects/ParticleSystem';
import { GunEffects } from '../effects/GunEffects';
import { ZombieManager } from '../zombies/ZombieManager';
import { ZombieInstance } from '../models/ZombieModel';

export interface DefenseTurret {
  id: string;
  mesh: THREE.Group;
  head: THREE.Group;
  laserBeam: THREE.Line;
  laserMat: THREE.LineBasicMaterial;
  position: THREE.Vector3;
  hp: number;
  maxHp: number;
  ammo: number;
  lifetime: number;
  fireTimer: number;
  currentTarget: ZombieInstance | null;
  barrelToggle: boolean;
}

export class TurretManager {
  private static scene: THREE.Scene | null = null;
  private static turrets: DefenseTurret[] = [];

  public static init(scene: THREE.Scene) {
    this.scene = scene;
    this.turrets = [];
  }

  public static clearAll() {
    if (this.scene) {
      for (const t of this.turrets) {
        this.scene.remove(t.mesh);
      }
    }
    this.turrets = [];
  }

  public static getTurrets(): DefenseTurret[] {
    return this.turrets;
  }

  public static hasActiveTurret(): boolean {
    return this.turrets.length > 0;
  }

  public static deployTurret(position: THREE.Vector3, playerFacing: number | THREE.Vector3): boolean {
    if (!this.scene) return false;

    const facingAngle = typeof playerFacing === 'number' ? playerFacing : Math.atan2(playerFacing.x, playerFacing.z);

    const turretGroup = new THREE.Group();
    turretGroup.position.set(position.x, 0, position.z);
    turretGroup.rotation.y = facingAngle;

    // 1. Tripod Base & Steel Feet
    const baseGeo = new THREE.CylinderGeometry(0.3, 0.4, 0.35, 8);
    const darkSteelMat = new THREE.MeshStandardMaterial({
      color: 0x1f2937,
      roughness: 0.4,
      metalness: 0.85,
    });
    const baseMesh = new THREE.Mesh(baseGeo, darkSteelMat);
    baseMesh.position.y = 0.35;
    turretGroup.add(baseMesh);

    // 3 Tripod Legs
    for (let i = 0; i < 3; i++) {
      const legAng = (i / 3) * Math.PI * 2;
      const legGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.7, 6);
      legGeo.rotateZ(0.65);
      legGeo.rotateY(legAng);
      const leg = new THREE.Mesh(legGeo, darkSteelMat);
      leg.position.set(Math.sin(legAng) * 0.3, 0.25, Math.cos(legAng) * 0.3);
      turretGroup.add(leg);
    }

    // 2. Swiveling Gimbal Head
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.65, 0);

    const bodyGeo = new THREE.BoxGeometry(0.35, 0.28, 0.45);
    const armyGreenMat = new THREE.MeshStandardMaterial({
      color: 0x273b22,
      roughness: 0.5,
      metalness: 0.5,
    });
    const bodyMesh = new THREE.Mesh(bodyGeo, armyGreenMat);
    headGroup.add(bodyMesh);

    // Dual Heavy Autocannon Barrels
    [-0.1, 0.1].forEach((bx) => {
      const barrelGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.65, 8);
      barrelGeo.rotateX(Math.PI / 2);
      const barrel = new THREE.Mesh(barrelGeo, darkSteelMat);
      barrel.position.set(bx, 0.02, 0.45);
      headGroup.add(barrel);

      // Muzzle flash / compensator
      const compGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.1, 8);
      compGeo.rotateX(Math.PI / 2);
      const comp = new THREE.Mesh(compGeo, darkSteelMat);
      comp.position.set(bx, 0.02, 0.75);
      headGroup.add(comp);
    });

    // Ammo drum container on side
    const drumGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.2, 10);
    drumGeo.rotateZ(Math.PI / 2);
    const drum = new THREE.Mesh(drumGeo, darkSteelMat);
    drum.position.set(0.24, 0, -0.05);
    headGroup.add(drum);

    // 3. Laser Targeting Beam (Green = Searching, Red = Target Locked)
    const laserMat = new THREE.LineBasicMaterial({
      color: 0x22c55e,
      linewidth: 2,
      transparent: true,
      opacity: 0.8,
    });
    const laserGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.02, 0.7),
      new THREE.Vector3(0, 0.02, 15),
    ]);
    const laserBeam = new THREE.Line(laserGeo, laserMat);
    headGroup.add(laserBeam);

    turretGroup.add(headGroup);
    this.scene.add(turretGroup);

    this.turrets.push({
      id: `turret_${Date.now()}_${Math.random()}`,
      mesh: turretGroup,
      head: headGroup,
      laserBeam,
      laserMat,
      position: position.clone(),
      hp: 200,
      maxHp: 200,
      ammo: 160,
      lifetime: 50.0, // 50 seconds autonomous duration
      fireTimer: 0,
      currentTarget: null,
      barrelToggle: false,
    });

    soundFx.playReloadSequence();
    return true;
  }

  public static update(
    delta: number,
    zombieManager: ZombieManager,
    onKill: (zombie: any, isHeadshot: boolean) => void
  ) {
    if (!this.scene) return;

    for (let i = this.turrets.length - 1; i >= 0; i--) {
      const t = this.turrets[i];
      t.lifetime -= delta;

      if (t.lifetime <= 0 || t.ammo <= 0 || t.hp <= 0) {
        // Destroyed or depleted turret
        ParticleSystem.spawnExplosion(t.mesh.position.clone().add(new THREE.Vector3(0, 0.5, 0)));
        this.scene.remove(t.mesh);
        this.turrets.splice(i, 1);
        continue;
      }

      // Find nearest alive, active zombie within 22m
      let nearestDist = 22.0;
      let target: ZombieInstance | null = null;

      for (const z of zombieManager.zombies) {
        if (z.isDead) continue;
        const d = t.mesh.position.distanceTo(z.mesh.position);
        if (d < nearestDist) {
          nearestDist = d;
          target = z;
        }
      }

      t.currentTarget = target;

      if (target) {
        // Target locked: switch laser to bright red
        t.laserMat.color.setHex(0xef4444);

        // Aim head towards target
        const targetWorldPos = target.mesh.position.clone().add(new THREE.Vector3(0, 1.1, 0));
        const headWorldPos = new THREE.Vector3();
        t.head.getWorldPosition(headWorldPos);

        const toTarget = new THREE.Vector3().subVectors(targetWorldPos, headWorldPos);
        const targetYaw = Math.atan2(toTarget.x, toTarget.z) - t.mesh.rotation.y;
        t.head.rotation.y = THREE.MathUtils.lerp(t.head.rotation.y, targetYaw, delta * 8);

        // Update laser end point
        const localTgt = t.head.worldToLocal(targetWorldPos.clone());
        const pts = [new THREE.Vector3(0, 0.02, 0.7), localTgt];
        t.laserBeam.geometry.setFromPoints(pts);

        // Fire auto-cannon
        t.fireTimer -= delta;
        if (t.fireTimer <= 0) {
          t.fireTimer = 0.14; // rapid burst ~430 RPM
          t.ammo--;
          t.barrelToggle = !t.barrelToggle;

          soundFx.playSMGShot();

          // Sparks & muzzle flash
          const barrelOffset = t.barrelToggle ? 0.1 : -0.1;
          const muzzlePos = new THREE.Vector3(barrelOffset, 0.02, 0.85);
          t.head.localToWorld(muzzlePos);

          ParticleSystem.spawnSparks(muzzlePos, new THREE.Vector3(0, 1, 0));

          const tracerDir = new THREE.Vector3().subVectors(targetWorldPos, muzzlePos).normalize();
          GunEffects.spawnMuzzleFlash(muzzlePos, tracerDir, 0.65);
          GunEffects.spawnTracer(muzzlePos, targetWorldPos, 0.8);

          // Apply damage to zombie: 24 damage per bullet
          zombieManager.applyDamage(
            {
              hit: true,
              zone: 'TORSO',
              damage: 24,
              isFatal: false,
              targetId: target.id,
            },
            onKill
          );
        }
      } else {
        // Idle scan: green laser sweeps slowly
        t.laserMat.color.setHex(0x22c55e);
        t.head.rotation.y = Math.sin(Date.now() * 0.0018) * 0.75;

        const scanEnd = new THREE.Vector3(0, 0.02, 16);
        t.laserBeam.geometry.setFromPoints([new THREE.Vector3(0, 0.02, 0.7), scanEnd]);
      }
    }
  }
}
