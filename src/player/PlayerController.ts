import * as THREE from 'three';
import { WeaponConfig, WeaponTypeKey, HitResult, WeaponUpgradeLevel } from '../types';
import { WEAPON_DEFINITIONS, UPGRADE_TIERS } from '../data/weapons';
import { WeaponModelFactory } from '../models/WeaponModels';
import { ParticleSystem } from '../effects/ParticleSystem';
import { GunEffects } from '../effects/GunEffects';
import { PostProcessing } from '../effects/PostProcessing';
import { soundFx } from '../audio/SoundEffects';

export interface PlayerInput {
  forward: number;
  strafe: number;
  lookDeltaX: number;
  lookDeltaY: number;
  sprint: boolean;
  jump: boolean;
  shoot: boolean;
  reload: boolean;
  interact: boolean;
  aimDownSights: boolean;
  ascend?: boolean;
  descend?: boolean;
}

export class PlayerController {
  public camera: THREE.PerspectiveCamera;
  public weaponContainer: THREE.Group;
  public currentWeaponMesh: THREE.Group | null = null;

  public position: THREE.Vector3 = new THREE.Vector3(0, 0, -36); // Feet at Y = 0
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public verticalVelocity: number = 0;
  public isGrounded: boolean = true;
  public pitch: number = 0; // vertical camera rotation
  public yaw: number = 0; // Face down the avenue towards +Z (North)

  // Tactical Flashlight (High-Lumen Weapon-Mounted Tactical Array)
  public flashlight: THREE.SpotLight;
  public flashlightFlood: THREE.SpotLight;
  public flashlightFill: THREE.PointLight;
  public flashlightTarget: THREE.Object3D;
  /** Flashlight starts OFF every mission — [F] raises it. */
  public isFlashlightOn: boolean = false;
  public hasPowerfulFlashlight: boolean = false;

  public hp: number = 100;
  public maxHp: number = 100;
  public isDead: boolean = false;
  public damageFlashTime: number = 0;
  public lastDamageAngle: number = 0;

  // Stamina & Exhaustion State
  public stamina: number = 100;
  public maxStamina: number = 100;
  public isExhausted: boolean = false;
  public isSprinting: boolean = false;
  public staminaRegenTimer: number = 0;
  public shoveCooldown: number = 0;
  private pantingSoundTimer: number = 0;

  // Weapon State
  public equippedWeaponKey: WeaponTypeKey = 'pistol';
  public weaponConfig: WeaponConfig = WEAPON_DEFINITIONS.pistol;
  public currentMag: number = 15;
  public reserveAmmo: number = 120;
  public isReloading: boolean = false;
  public reloadProgress: number = 0;
  public fireCooldown: number = 0;
  public upgrades: WeaponUpgradeLevel = { damageLevel: 0, magLevel: 0, fireRateLevel: 0, reloadLevel: 0 };

  // Recoil & Sway
  private recoilOffset: THREE.Vector3 = new THREE.Vector3();
  private recoilRotation: THREE.Euler = new THREE.Euler();
  private swayOffset: THREE.Vector3 = new THREE.Vector3();
  private bobTime: number = 0;
  private isAiming: boolean = false;

  // Weapon presentation state (sprint pose, landing dip, idle breathing)
  private sprintPose: number = 0;        // 0..1 blended weapon lowered pose
  private landDip: number = 0;           // impulse on hard landings
  private prevVerticalVelocity: number = 0;
  private wasGrounded: boolean = true;
  private cameraDipOffset: number = 0;   // short camera y dip on landing
  private recoilPitch: number = 0;       // temporary camera kick, recovers automatically

  // Muzzle dynamic light (world-lighting gunflash attached to camera)
  public muzzleLight: THREE.PointLight;

  // Raycaster
  public raycaster: THREE.Raycaster = new THREE.Raycaster();
  public onGunshot?: (origin: THREE.Vector3, soundRadius: number) => void;
  public onLaunchRocket?: (origin: THREE.Vector3, dir: THREE.Vector3) => void;
  /** Ordinance tablet raised: request satellite targeting mode (turret uplink required). */
  public onLaunchAirstrike?: () => void;

  // Per-map movement bounds (set on environment load; district default)
  public mapBounds: { minX: number; maxX: number; minZ: number; maxZ: number } = {
    minX: -103, maxX: 103, minZ: -141, maxZ: 141,
  };

  public setMapBounds(b: { minX: number; maxX: number; minZ: number; maxZ: number }) {
    this.mapBounds = b;
  }

  // Katana cleave swing state (1 -> 0 drives the slash animation)
  private meleeSwingT: number = 0;

  /** True while aiming down the sniper's scope (drives the HUD scope overlay). */
  get isScoped(): boolean {
    return this.isAiming && this.equippedWeaponKey === 'sniper';
  }

  constructor() {
    this.camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 250);
    this.camera.position.copy(this.position);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    // Layer 1 hosts the first-person weapon: world lights below opt into it,
    // the flashlight does NOT — so the beam never blows out the gun model
    this.camera.layers.enable(1);

    // Tactical weapon-mounted flashlight. Origin pushed PAST the muzzle so the
    // cone's near-field never washes over the gun or the ground at the player's
    // feet, and aimed well below the horizon so the pool lands on the floor
    // ahead — a flat aim washes out walls and white props at eye level.
    // Intensity kept moderate — high values blow out white/albedo surfaces.
    this.flashlight = new THREE.SpotLight(0xfff6e0, 0, 85, Math.PI / 4.6, 0.6, 1.4);
    this.flashlight.position.set(0.16, -0.24, -1.4);
    // No shadow casting: a shadow-mapped spotlight re-renders the whole scene
    // from the beam's view EVERY frame — the single most expensive setting in
    // the game. The moonlight shadow already grounds every prop and actor.
    this.flashlight.castShadow = false;

    this.flashlightTarget = new THREE.Object3D();
    this.flashlightTarget.position.set(0, -3.0, -12);
    this.camera.add(this.flashlightTarget);
    this.flashlight.target = this.flashlightTarget;
    this.camera.add(this.flashlight);

    // Secondary wide-angle peripheral flood beam for doorframes, alleys & close quarters
    this.flashlightFlood = new THREE.SpotLight(0xfff3d6, 0, 40, Math.PI / 3.2, 0.9, 1.5);
    this.flashlightFlood.position.set(0.16, -0.24, -1.4);
    this.flashlightFlood.target = this.flashlightTarget;
    this.camera.add(this.flashlightFlood);

    // Ambient forward fill point light to illuminate ground, curbs, and nearby obstacles
    this.flashlightFill = new THREE.PointLight(0xffecd1, 0, 10, 1.6);
    this.flashlightFill.position.set(0, -0.35, -2.4);
    this.camera.add(this.flashlightFill);

    this.weaponContainer = new THREE.Group();
    this.camera.add(this.weaponContainer);

    // Muzzle flash world light — brief barrel glow, kept subtle so aim stays readable
    this.muzzleLight = new THREE.PointLight(0xffc873, 0, 16, 2.0);
    this.muzzleLight.position.set(0.22, -0.14, -0.9);
    this.muzzleLight.layers.enable(1); // the gun's own flash DOES light the gun
    this.camera.add(this.muzzleLight);

    this.setWeapon('pistol', { damageLevel: 0, magLevel: 0, fireRateLevel: 0, reloadLevel: 0 });
  }

  /** First-person weapon lives on render layer 1 — excluded from flashlight lighting. */
  private applyWeaponLayers() {
    this.weaponContainer.traverse((obj) => obj.layers.set(1));
  }

  public setPowerfulFlashlight(enabled: boolean) {
    this.hasPowerfulFlashlight = enabled;
    if (enabled) {
      // 3,500-lumen Mil-Spec Heavy Searchlight configuration
      this.flashlight.distance = 150;
      this.flashlight.angle = Math.PI / 3.8;
      this.flashlight.penumbra = 0.5;
      this.flashlight.color.setHex(0xffffff);

      this.flashlightFlood.distance = 70;
      this.flashlightFlood.angle = Math.PI / 2.8;
      this.flashlightFlood.penumbra = 0.92;

      this.flashlightFill.distance = 18;
    } else {
      // Standard issue tactical light
      this.flashlight.distance = 85;
      this.flashlight.angle = Math.PI / 4.6;
      this.flashlight.penumbra = 0.5;
      this.flashlight.color.setHex(0xfff6e0);

      this.flashlightFlood.distance = 40;
      this.flashlightFlood.angle = Math.PI / 3.2;
      this.flashlightFlood.penumbra = 0.9;

      this.flashlightFill.distance = 10;
    }

    if (this.isFlashlightOn) {
      this.flashlight.intensity = enabled ? 8.0 : 3.2;
      this.flashlightFlood.intensity = enabled ? 3.2 : 1.2;
      this.flashlightFill.intensity = enabled ? 1.4 : 0.55;
    }
  }

  public toggleFlashlight(): boolean {
    this.isFlashlightOn = !this.isFlashlightOn;
    const isHeavy = this.hasPowerfulFlashlight;
    this.flashlight.intensity = this.isFlashlightOn ? (isHeavy ? 8.0 : 3.2) : 0;
    this.flashlightFlood.intensity = this.isFlashlightOn ? (isHeavy ? 3.2 : 1.2) : 0;
    this.flashlightFill.intensity = this.isFlashlightOn ? (isHeavy ? 1.4 : 0.55) : 0;
    soundFx.playFlashlightClick();
    return this.isFlashlightOn;
  }

  public setWeapon(key: WeaponTypeKey, upgrades: WeaponUpgradeLevel) {
    this.equippedWeaponKey = key;
    this.weaponConfig = WEAPON_DEFINITIONS[key];
    this.upgrades = upgrades;
    this.meleeSwingT = 0;

    // Remove old mesh
    if (this.currentWeaponMesh) {
      this.weaponContainer.remove(this.currentWeaponMesh);
    }

    // Build new mesh
    this.currentWeaponMesh = WeaponModelFactory.createWeaponMesh(key);
    this.weaponContainer.add(this.currentWeaponMesh);
    this.applyWeaponLayers();

    // Calculate upgraded mag size
    const bonusMag = Math.round(this.weaponConfig.baseMagSize * (this.upgrades.magLevel * UPGRADE_TIERS.magBonusPerLevel));
    this.currentMag = this.weaponConfig.baseMagSize + bonusMag;
    this.reserveAmmo = this.weaponConfig.maxReserveAmmo;
    this.isReloading = false;
    this.reloadProgress = 0;
  }

  public update(
    delta: number,
    input: PlayerInput,
    colliders: THREE.Box3[],
    zombieHitboxes: THREE.Object3D[],
    explosiveBarrels: { mesh: THREE.Mesh; position: THREE.Vector3; hp: number; exploded: boolean }[],
    envMeshes: THREE.Object3D[],
    onHitZombie: (result: HitResult) => void,
    onExplodeBarrel: (barrel: { position: THREE.Vector3 }) => void
  ) {
    if (this.isDead) return;

    if (this.damageFlashTime > 0) {
      this.damageFlashTime -= delta;
    }

    // 1. Look rotation (Euler order YXZ ensures pitch is always local & never inverts regardless of yaw)
    // Scoped sniper aim needs heavily damped sensitivity for precision tracking
    const adsSensitivityMult = input.aimDownSights ? (this.equippedWeaponKey === 'sniper' ? 0.26 : 0.62) : 1.0;
    this.yaw -= input.lookDeltaX * adsSensitivityMult;
    this.pitch = Math.max(-Math.PI * 0.44, Math.min(Math.PI * 0.44, this.pitch + input.lookDeltaY * adsSensitivityMult));

    // Fire kick recovers smoothly instead of permanently climbing the aim
    this.recoilPitch = THREE.MathUtils.clamp(this.recoilPitch, -0.14, 0.14);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.set(this.pitch + this.recoilPitch, this.yaw, 0, 'YXZ');
    this.recoilPitch = THREE.MathUtils.lerp(this.recoilPitch, 0, Math.min(1, delta * 9));

    // 2. Movement & Stamina Management
    const wantsSprint = input.sprint && input.forward > 0 && !input.aimDownSights;

    if (wantsSprint && !this.isExhausted && this.stamina > 0) {
      this.isSprinting = true;
      this.stamina = Math.max(0, this.stamina - delta * 19.0);
      this.staminaRegenTimer = 0.8;
      if (this.stamina <= 0) {
        this.stamina = 0;
        this.isExhausted = true;
        this.isSprinting = false;
        this.pantingSoundTimer = 0;
        soundFx.playExhausted();
      }
    } else {
      this.isSprinting = false;
      if (this.staminaRegenTimer > 0) {
        this.staminaRegenTimer -= delta;
      } else {
        const isMoving = Math.abs(input.forward) > 0.05 || Math.abs(input.strafe) > 0.05;
        const regenRate = isMoving ? 18.0 : 30.0;
        this.stamina = Math.min(this.maxStamina, this.stamina + regenRate * delta);
        if (this.isExhausted && this.stamina >= 20.0) {
          this.isExhausted = false;
        }
      }
    }

    // Audio cue for heavy panting when exhausted or critically low stamina
    if (this.isExhausted || (this.stamina < 20 && this.velocity.lengthSq() > 0.5)) {
      this.pantingSoundTimer -= delta;
      if (this.pantingSoundTimer <= 0) {
        soundFx.playPanting();
        this.pantingSoundTimer = this.isExhausted ? 1.6 : 2.6;
      }
    }

    const isSprinting = this.isSprinting;
    const speed = isSprinting ? 6.5 : (input.aimDownSights ? 2.4 : 3.8);

    // Move direction relative to yaw
    const forwardVec = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const rightVec = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    const moveDir = new THREE.Vector3();
    moveDir.addScaledVector(forwardVec, input.forward);
    moveDir.addScaledVector(rightVec, input.strafe);

    if (moveDir.lengthSq() > 0.01) {
      moveDir.normalize();
      this.velocity.lerp(moveDir.multiplyScalar(speed), delta * 16);
      this.bobTime += delta * (isSprinting ? 14 : 9);
    } else {
      this.velocity.lerp(new THREE.Vector3(0, 0, 0), delta * 18);
    }

    // Apply movement with collision & auto-step
    const nextPos = this.position.clone().addScaledVector(this.velocity, delta);

    // Calculate ground support height (can stand on vehicles, dumpsters, crates, stairs, and roofs)
    let groundY = 0;
    for (const box of colliders) {
      if (
        nextPos.x > box.min.x - 0.25 &&
        nextPos.x < box.max.x + 0.25 &&
        nextPos.z > box.min.z - 0.25 &&
        nextPos.z < box.max.z + 0.25
      ) {
        // Can land on top if player feet are near or above the surface
        if (box.max.y <= this.position.y + 0.65) {
          if (box.max.y > groundY) {
            groundY = box.max.y;
          }
        }
      }
    }

    // Natural human player collision radius (0.28m - smooth sliding through doorways, pylons, and corners)
    const playerRadius = 0.28;
    const stepHeight = 0.48; // Can easily step over curbs, low debris, pallets
    let allowedX = true;
    let allowedZ = true;

    const bodyBottom = this.position.y + stepHeight;
    const bodyTop = this.position.y + 1.85;

    for (const box of colliders) {
      // Only block horizontal movement if the obstacle is above step height and at body level
      if (bodyBottom >= box.max.y || bodyTop <= box.min.y) continue;

      // 1. Test X axis movement
      // Only evaluate X collision if player's Z span overlaps box's Z span
      const overlapsZ = (this.position.z + playerRadius > box.min.z) && (this.position.z - playerRadius < box.max.z);
      if (overlapsZ) {
        const nextOverlapsX = (nextPos.x + playerRadius > box.min.x) && (nextPos.x - playerRadius < box.max.x);
        if (nextOverlapsX) {
          const boxCenterX = (box.min.x + box.max.x) * 0.5;
          const currDistX = Math.abs(this.position.x - boxCenterX);
          const nextDistX = Math.abs(nextPos.x - boxCenterX);

          // Only block if movement would move deeper into or stay inside the obstacle
          if (nextDistX <= currDistX) {
            allowedX = false;
            this.velocity.x *= 0.15; // Smooth slide friction along wall
          }
        }
      }

      // 2. Test Z axis movement
      // Only evaluate Z collision if player's X span overlaps box's X span
      const overlapsX = (this.position.x + playerRadius > box.min.x) && (this.position.x - playerRadius < box.max.x);
      if (overlapsX) {
        const nextOverlapsZ = (nextPos.z + playerRadius > box.min.z) && (nextPos.z - playerRadius < box.max.z);
        if (nextOverlapsZ) {
          const boxCenterZ = (box.min.z + box.max.z) * 0.5;
          const currDistZ = Math.abs(this.position.z - boxCenterZ);
          const nextDistZ = Math.abs(nextPos.z - boxCenterZ);

          // Only block if movement would move deeper into or stay inside the obstacle
          if (nextDistZ <= currDistZ) {
            allowedZ = false;
            this.velocity.z *= 0.15; // Smooth slide friction along wall
          }
        }
      }
    }

    // Fully accessible perimeter boundaries — sized to the ACTIVE map
    const mb = this.mapBounds;
    if (allowedX && nextPos.x > mb.minX && nextPos.x < mb.maxX) {
      this.position.x = nextPos.x;
    }
    if (allowedZ && nextPos.z > mb.minZ && nextPos.z < mb.maxZ) {
      this.position.z = nextPos.z;
    }

    // Proactive Corner & Wall Depenetration Pass:
    // Guarantees player is never stuck or embedded in corners between two perpendicular colliders
    for (const box of colliders) {
      if (bodyBottom >= box.max.y || bodyTop <= box.min.y) continue;

      const closestX = Math.max(box.min.x, Math.min(box.max.x, this.position.x));
      const closestZ = Math.max(box.min.z, Math.min(box.max.z, this.position.z));
      const diffX = this.position.x - closestX;
      const diffZ = this.position.z - closestZ;
      const distSq = diffX * diffX + diffZ * diffZ;

      if (distSq < playerRadius * playerRadius) {
        if (distSq > 0.0001) {
          const dist = Math.sqrt(distSq);
          const pushOut = (playerRadius - dist) + 0.005;
          this.position.x += (diffX / dist) * pushOut;
          this.position.z += (diffZ / dist) * pushOut;
        } else {
          // Inside box center fallback: push along the shortest axis face
          const dMinX = Math.abs(this.position.x - box.min.x);
          const dMaxX = Math.abs(box.max.x - this.position.x);
          const dMinZ = Math.abs(this.position.z - box.min.z);
          const dMaxZ = Math.abs(box.max.z - this.position.z);
          const minVal = Math.min(dMinX, dMaxX, dMinZ, dMaxZ);

          if (minVal === dMinX) this.position.x = box.min.x - playerRadius - 0.01;
          else if (minVal === dMaxX) this.position.x = box.max.x + playerRadius + 0.01;
          else if (minVal === dMinZ) this.position.z = box.min.z - playerRadius - 0.01;
          else this.position.z = box.max.z + playerRadius + 0.01;
        }
      }
    }

    // Vertical Physics: Jump & Gravity (with stamina cost)
    if (input.jump && this.isGrounded) {
      if (this.stamina >= 10 && !this.isExhausted) {
        this.stamina = Math.max(0, this.stamina - 12);
        this.staminaRegenTimer = 0.9;
        this.verticalVelocity = 8.5;
        this.isGrounded = false;
        soundFx.playJump();
      } else if (this.stamina >= 4) {
        this.stamina = 0;
        this.isExhausted = true;
        this.staminaRegenTimer = 1.2;
        this.verticalVelocity = 5.2;
        this.isGrounded = false;
        soundFx.playJump();
        soundFx.playExhausted();
      }
    }

    // Gravity & Ground Landing
    if (!this.isGrounded || this.position.y > groundY + 0.02) {
      this.verticalVelocity += -24.0 * delta;
      this.position.y += this.verticalVelocity * delta;

      if (this.position.y <= groundY) {
        if (this.verticalVelocity < -4.0) {
          soundFx.playLand();
        }
        this.position.y = groundY;
        this.verticalVelocity = 0;
        this.isGrounded = true;
      } else {
        this.isGrounded = false;
      }
    } else {
      this.position.y = THREE.MathUtils.lerp(this.position.y, groundY, delta * 18);
      this.verticalVelocity = 0;
      this.isGrounded = true;
    }

    // Head bobbing calculation (only when on ground)
    const bobOffset = this.isGrounded ? Math.sin(this.bobTime) * (isSprinting ? 0.08 : 0.04) : 0;
    this.camera.position.set(
      this.position.x,
      this.position.y + 1.7 + bobOffset + this.cameraDipOffset,
      this.position.z
    );

    // 3. Aim Down Sights (ADS) — the sniper's scope zooms deep into the world.
    // The scope drops the moment a reload is required (mag empty or reloading):
    // the operator is busy seating fresh rounds, not looking down the optic.
    const reloadRequired = this.equippedWeaponKey === 'sniper' && (this.isReloading || this.currentMag === 0);
    this.isAiming = input.aimDownSights && !reloadRequired;
    const targetFov = this.isAiming
      ? (this.equippedWeaponKey === 'sniper' ? 18 : 50)
      : 72;
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, delta * (this.equippedWeaponKey === 'sniper' ? 14 : 10));
    this.camera.updateProjectionMatrix();

    // 4. Weapon Sway & Recoil Recovery (gun lags naturally behind camera rotation)
    const targetSwayX = -input.lookDeltaX * 0.35;
    const targetSwayY = -input.lookDeltaY * 0.35;
    this.swayOffset.x = THREE.MathUtils.lerp(this.swayOffset.x, targetSwayX, delta * 8);
    this.swayOffset.y = THREE.MathUtils.lerp(this.swayOffset.y, targetSwayY, delta * 8);

    this.recoilOffset.lerp(new THREE.Vector3(0, 0, 0), delta * 9);
    this.recoilRotation.x = THREE.MathUtils.lerp(this.recoilRotation.x, 0, delta * 9);

    // Muzzle flash light decays almost instantly for a snappy gunflash
    this.muzzleLight.intensity *= Math.pow(0.000001, delta);

    // Landing impact dip (weapon & camera absorb the fall)
    if (this.isGrounded && !this.wasGrounded && this.prevVerticalVelocity < -6.0) {
      this.landDip = Math.min(1.0, -this.prevVerticalVelocity / 13.0);
      this.cameraDipOffset = -0.09 * this.landDip;
    }
    this.wasGrounded = this.isGrounded;
    this.prevVerticalVelocity = this.verticalVelocity;
    this.landDip = Math.max(0, this.landDip - delta * 3.2);
    this.cameraDipOffset = THREE.MathUtils.lerp(this.cameraDipOffset, 0, delta * 9);

    if (this.currentWeaponMesh) {
      // Sprint pose: weapon lowers & cants inward while sprinting
      const targetSprint = isSprinting && this.velocity.lengthSq() > 1.0 ? 1 : 0;
      this.sprintPose = THREE.MathUtils.lerp(this.sprintPose, targetSprint, delta * 7);

      // Air Strike tablet has unique hold pose - don't apply standard gun positioning
      if (this.equippedWeaponKey === 'airstrike') {
        // Tablet held flat with both hands at chest level, screen facing player
        const idleBreath = this.isGrounded ? Math.sin(this.bobTime * 0.45) * 0.0035 : 0;
        this.currentWeaponMesh.position.set(
          0.08 + this.swayOffset.x + this.recoilOffset.x,
          -0.18 + this.swayOffset.y + this.recoilOffset.y - this.landDip * 0.09 + idleBreath,
          -0.35 + this.recoilOffset.z
        );
        this.currentWeaponMesh.rotation.set(
          -Math.PI / 3.5 + this.recoilRotation.x,
          -this.swayOffset.x * 0.5,
          0
        );
      } else {
        // Default lower-right or centered ADS; scoped sniper drops the gun
        // out of the optic circle so the scope overlay is unobstructed
        const scoped = this.isScoped;
        const defaultX = scoped ? 0.12 : this.isAiming ? 0 : 0.24;
        const defaultY = scoped ? -0.44 : this.isAiming ? -0.15 : -0.22;
        const defaultZ = scoped ? -0.34 : this.isAiming ? -0.36 : -0.45;

        // Idle breathing keeps the weapon alive even standing still
        const idleBreath = this.isGrounded ? Math.sin(this.bobTime * 0.45) * 0.0035 : 0;

        this.currentWeaponMesh.position.set(
          defaultX + this.swayOffset.x + this.recoilOffset.x + this.sprintPose * 0.07,
          defaultY + this.swayOffset.y + this.recoilOffset.y - this.sprintPose * 0.055 - this.landDip * 0.09 + idleBreath,
          defaultZ + this.recoilOffset.z + this.sprintPose * 0.06
        );

        this.currentWeaponMesh.rotation.x =
          this.recoilRotation.x - this.sprintPose * 0.28 - this.landDip * 0.22;
        this.currentWeaponMesh.rotation.y = -this.swayOffset.x * 0.5 + this.sprintPose * 0.5;
        this.currentWeaponMesh.rotation.z = this.sprintPose * -0.45;

        // Katana cleave: wide diagonal slash riding over the base pose
        if (this.meleeSwingT > 0) {
          this.meleeSwingT = Math.max(0, this.meleeSwingT - delta * 3.4);
          const swing = Math.sin((1 - this.meleeSwingT) * Math.PI);
          this.currentWeaponMesh.rotation.z -= swing * 2.1;
          this.currentWeaponMesh.rotation.x += swing * 0.55;
          this.currentWeaponMesh.position.x -= swing * 0.3;
          this.currentWeaponMesh.position.z += swing * 0.2;
        }
      }
    }

    // 5. Weapon Firing & Reloading
    if (this.fireCooldown > 0) {
      this.fireCooldown -= delta;
    }
    if (this.shoveCooldown > 0) {
      this.shoveCooldown -= delta;
    }

    // Reload logic
    if (this.isReloading) {
      const reloadSpeedBonus = this.upgrades.reloadLevel * UPGRADE_TIERS.reloadSpeedBonusPerLevel;
      const effectiveReloadTime = Math.max(0.6, this.weaponConfig.baseReloadTime * (1 - reloadSpeedBonus));
      this.reloadProgress += delta / effectiveReloadTime;

      // Animate weapon dropping & corkscrewing during reload
      if (this.currentWeaponMesh) {
        const reloadPhase = Math.sin(this.reloadProgress * Math.PI);
        this.currentWeaponMesh.position.y -= reloadPhase * 0.15;
        this.currentWeaponMesh.rotation.z = reloadPhase * 0.55;
        this.currentWeaponMesh.rotation.x += reloadPhase * 0.3;
      }

      if (this.reloadProgress >= 1.0) {
        this.isReloading = false;
        this.reloadProgress = 0;
        const maxMag = this.weaponConfig.baseMagSize + Math.round(this.weaponConfig.baseMagSize * (this.upgrades.magLevel * UPGRADE_TIERS.magBonusPerLevel));
        const needed = maxMag - this.currentMag;
        const taken = Math.min(needed, this.reserveAmmo);
        this.currentMag += taken;
        this.reserveAmmo -= taken;
      }
    } else {
      // Check for reload input
      const maxMag = this.weaponConfig.baseMagSize + Math.round(this.weaponConfig.baseMagSize * (this.upgrades.magLevel * UPGRADE_TIERS.magBonusPerLevel));
      if ((input.reload || this.currentMag === 0 && input.shoot) && this.currentMag < maxMag && this.reserveAmmo > 0) {
        this.isReloading = true;
        this.reloadProgress = 0;
        soundFx.playReloadSequence();
      }
    }

    // Shooting
    if (input.shoot && !this.isReloading && this.fireCooldown <= 0) {
      if (this.currentMag > 0) {
        this.executeFire(zombieHitboxes, explosiveBarrels, envMeshes, onHitZombie, onExplodeBarrel);
      } else {
        soundFx.playDryFire();
        const effectiveRpm = this.weaponConfig.fireRateRpm * (1 + this.upgrades.fireRateLevel * UPGRADE_TIERS.fireRateBonusPerLevel);
        this.fireCooldown = 60 / effectiveRpm;
      }
    }
  }

  private executeFire(
    zombieHitboxes: THREE.Object3D[],
    explosiveBarrels: { mesh: THREE.Mesh; position: THREE.Vector3; hp: number; exploded: boolean }[],
    envMeshes: THREE.Object3D[],
    onHitZombie: (result: HitResult) => void,
    onExplodeBarrel: (barrel: { position: THREE.Vector3 }) => void
  ) {
    // Air Strike: raise the ordinance tablet into satellite targeting mode.
    // Requires an active Sentry Turret uplink — handled by AirStrikeManager.
    if (this.equippedWeaponKey === 'airstrike') {
      // Rate-limit arming attempts so holding the trigger doesn't spam
      this.fireCooldown = 0.6;
      if (this.onLaunchAirstrike) {
        this.onLaunchAirstrike();
      } else {
        soundFx.playDryFire();
      }
      return;
    }

    // Melee weapon (katana): infinite ammo, wide cleaving arc — no hitscan
    if (this.weaponConfig.melee) {
      this.executeMeleeSwing(zombieHitboxes, onHitZombie);
      return;
    }

    // Rocket launcher: hand off to the projectile system, big recoil
    if (this.weaponConfig.projectile && this.onLaunchRocket) {
      this.currentMag -= 1;
      const rocketRpm = this.weaponConfig.fireRateRpm * (1 + this.upgrades.fireRateLevel * UPGRADE_TIERS.fireRateBonusPerLevel);
      this.fireCooldown = 60 / rocketRpm;

      const rocketDir = new THREE.Vector3();
      this.camera.getWorldDirection(rocketDir);
      const spread = this.isAiming ? this.weaponConfig.spread * 0.4 : this.weaponConfig.spread;
      rocketDir.x += (Math.random() - 0.5) * spread;
      rocketDir.y += (Math.random() - 0.5) * spread;
      rocketDir.normalize();

      const muzzleWorld = this.camera.localToWorld(new THREE.Vector3(0.22, -0.16, -1.0));
      this.onLaunchRocket(muzzleWorld, rocketDir);

      // Heavy shoulder-fired recoil: weapon kick + sharp camera punch
      this.recoilOffset.z += this.weaponConfig.recoil;
      this.recoilRotation.x += this.weaponConfig.recoil * 0.5;
      this.recoilPitch += this.weaponConfig.recoil * 0.5;
      this.muzzleLight.intensity = 16;

      // Auto-reload the tube right after launch — single-shot weapon, the
      // operator should never have to press R between rockets
      const maxMag = this.weaponConfig.baseMagSize + Math.round(this.weaponConfig.baseMagSize * (this.upgrades.magLevel * UPGRADE_TIERS.magBonusPerLevel));
      if (this.currentMag < maxMag && this.reserveAmmo > 0 && !this.isReloading) {
        this.isReloading = true;
        this.reloadProgress = 0;
        soundFx.playReloadSequence();
      }

      // Launch report is loud — the whole street hears it
      this.onGunshot?.(this.position.clone(), 45);
      return;
    }

    this.currentMag -= 1;

    // RPM calculation with upgrades
    const effectiveRpm = this.weaponConfig.fireRateRpm * (1 + this.upgrades.fireRateLevel * UPGRADE_TIERS.fireRateBonusPerLevel);
    this.fireCooldown = 60 / effectiveRpm;

    // Gunshot audio
    switch (this.equippedWeaponKey) {
      case 'shotgun':
        soundFx.playShotgunShot();
        break;
      case 'rifle':
        soundFx.playRifleShot();
        break;
      case 'smg':
        soundFx.playSMGShot();
        break;
      case 'heavy':
        soundFx.playHeavyShot();
        break;
      case 'sniper':
        soundFx.playSniperShot();
        break;
      case 'pistol':
      default:
        soundFx.playPistolShot();
        break;
    }

    // Recoil kick
    const recoilAmount = this.weaponConfig.recoil;
    this.recoilOffset.z += recoilAmount * 0.8;
    this.recoilOffset.y += recoilAmount * 0.2;
    this.recoilRotation.x += recoilAmount * 0.4;
    this.recoilPitch += recoilAmount * 0.42; // Temporary camera rise (auto-recovers)

    // Muzzle flash: modest world light at the barrel (bright enough to read,
    // never enough to white out the frame) + pooled sprite + slight bloom punch
    const muzzlePower =
      this.equippedWeaponKey === 'heavy' ? 1.2
      : this.equippedWeaponKey === 'sniper' ? 1.15
      : this.equippedWeaponKey === 'shotgun' ? 1.1
      : this.equippedWeaponKey === 'rifle' ? 1.0
      : 0.85;
    this.muzzleLight.intensity = 13 * muzzlePower;
    const cameraForward = new THREE.Vector3();
    this.camera.getWorldDirection(cameraForward);
    const muzzleWorld = this.camera.localToWorld(new THREE.Vector3(0.22, -0.16, -1.0));
    GunEffects.spawnMuzzleFlash(muzzleWorld, cameraForward, muzzlePower);
    PostProcessing.punchBloom(0.06 * muzzlePower);

    // Acoustic gunshot noise (attracts nearby zombies)
    if (this.onGunshot) {
      const gunshotRadius = this.equippedWeaponKey === 'shotgun' ? 38 : this.equippedWeaponKey === 'pistol' ? 22 : 32;
      this.onGunshot(this.position.clone(), gunshotRadius);
    }

    // Shell casing
    const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    ParticleSystem.spawnShellCasing(this.camera.position, camRight);

    // Base damage with upgrades
    const damageMultiplier = 1 + this.upgrades.damageLevel * UPGRADE_TIERS.damageMultiplierPerLevel;
    const baseDmg = this.weaponConfig.baseDamage * damageMultiplier;

    // Pellets count (8 for shotgun, 1 for others)
    const pellets = this.weaponConfig.pellets || 1;
    const maxTracers = pellets > 1 ? 2 : 1;
    const tracerThickness = this.equippedWeaponKey === 'sniper' || this.equippedWeaponKey === 'heavy' ? 1.6 : 1.0;

    for (let p = 0; p < pellets; p++) {
      // Spread calculation
      const spread = this.isAiming ? this.weaponConfig.spread * 0.5 : this.weaponConfig.spread;
      const spreadX = (Math.random() - 0.5) * spread;
      const spreadY = (Math.random() - 0.5) * spread;

      this.raycaster.setFromCamera(new THREE.Vector2(spreadX, spreadY), this.camera);
      const rayDir = this.raycaster.ray.direction;

      // Check explosive barrels
      const barrelMeshes = explosiveBarrels.filter((b) => !b.exploded).map((b) => b.mesh);
      const barrelHits = this.raycaster.intersectObjects(barrelMeshes, false);

      if (barrelHits.length > 0 && barrelHits[0].distance < this.weaponConfig.range) {
        const hit = barrelHits[0];
        const barrelObj = explosiveBarrels.find((b) => b.mesh === hit.object);
        if (barrelObj && !barrelObj.exploded) {
          if (p < maxTracers) GunEffects.spawnTracer(muzzleWorld, hit.point, tracerThickness);
          barrelObj.hp -= baseDmg;
          if (barrelObj.hp <= 0) {
            barrelObj.exploded = true;
            barrelObj.mesh.visible = false;
            soundFx.playExplosion();
            ParticleSystem.spawnExplosion(barrelObj.position);
            PostProcessing.punchBloom(0.9);
            onExplodeBarrel({ position: barrelObj.position });
          } else {
            ParticleSystem.spawnSparks(hit.point, hit.normal || new THREE.Vector3(0, 1, 0));
            GunEffects.spawnImpactFlash(hit.point);
          }
        }
        continue;
      }

      // Real environment impact point (walls, ground, props)
      const envHits = envMeshes.length > 0
        ? this.raycaster.intersectObjects(envMeshes, true)
        : [];

      // Check zombies
      const zombieHits = this.raycaster.intersectObjects(zombieHitboxes, false);
      const zombieHit = zombieHits.length > 0 && zombieHits[0].distance < this.weaponConfig.range ? zombieHits[0] : null;
      const envHit = envHits.length > 0 && envHits[0].distance < this.weaponConfig.range ? envHits[0] : null;

      // Whichever is closer decides the bullet's true endpoint
      const zombieCloser = zombieHit && (!envHit || zombieHit.distance < envHit.distance);

      if (zombieHit && zombieCloser) {
        const hit = zombieHit;
        if (p < maxTracers) GunEffects.spawnTracer(muzzleWorld, hit.point, tracerThickness);
        const hitZone = (hit.object.userData?.hitZone || 'TORSO') as 'HEAD' | 'TORSO' | 'LIMB' | 'WEAKPOINT';
        const zombieId = hit.object.userData?.zombieId;

        let zoneMult = 1.0;
        let isHeadshot = false;

        if (hitZone === 'HEAD') {
          zoneMult = this.weaponConfig.headshotMultiplier;
          isHeadshot = true;
          soundFx.playHeadshotSound();
        } else if (hitZone === 'WEAKPOINT') {
          zoneMult = 3.0; // Boss weak point!
          soundFx.playHeadshotSound();
        } else if (hitZone === 'LIMB') {
          zoneMult = 0.65;
          soundFx.playHitMarker();
        } else {
          soundFx.playHitMarker();
        }

        const totalDamage = Math.round(baseDmg * zoneMult);
        ParticleSystem.spawnBlood(
          hit.point,
          this.raycaster.ray.direction,
          isHeadshot,
          false,
          this.equippedWeaponKey === 'shotgun'
        );

        // Blood/Gore effect of zombie is placed on the ground/floor, NOT on the screen
        const floorPos = hit.point.clone();
        floorPos.y = 0.02;
        ParticleSystem.spawnBloodDecal(floorPos, isHeadshot ? 2.0 : 1.2);

        onHitZombie({
          hit: true,
          zone: hitZone,
          limb: hit.object.userData?.limb as 'ARM_L' | 'ARM_R' | 'LEG_L' | 'LEG_R' | undefined,
          damage: totalDamage,
          isFatal: false, // will be evaluated by ZombieManager
          targetId: zombieId,
          point: [hit.point.x, hit.point.y, hit.point.z],
        });
      } else if (envHit) {
        // Bullet struck real world geometry: impact sparks, flash & tracer to exact point
        if (p < maxTracers) GunEffects.spawnTracer(muzzleWorld, envHit.point, tracerThickness);
        const impactNormal = envHit.face
          ? envHit.face.normal.clone().transformDirection(envHit.object.matrixWorld)
          : rayDir.clone().negate();
        ParticleSystem.spawnSparks(envHit.point, impactNormal);
        GunEffects.spawnImpactFlash(envHit.point);
        // Blood-streak residue occasionally clings to struck vertical surfaces
        // (walls, barriers, props) — anchored to the real hit point/normal and
        // only on opaque geometry, never on fences/light beams
        const struckMat = (envHit.object as THREE.Mesh).material as (THREE.Material & { opacity?: number }) | undefined;
        const opaqueSurface = Boolean(struckMat) && !struckMat!.transparent && (struckMat!.opacity ?? 1) >= 0.95;
        if (Math.abs(impactNormal.y) < 0.5 && Math.random() < 0.12 && opaqueSurface) {
          ParticleSystem.spawnWallBlood(envHit.point, impactNormal, 1.5, true);
        }
      } else {
        // Shot into the void — tracer fades into the distance
        const endPoint = this.camera.position
          .clone()
          .addScaledVector(rayDir, Math.min(this.weaponConfig.range, 90));
        if (p < maxTracers) GunEffects.spawnTracer(muzzleWorld, endPoint, tracerThickness);
      }
    }
  }

  /**
   * Katana cleave: a silent wide arc that hits EVERY zombie in the fan —
   * no ammo, no muzzle flash, minimal acoustic footprint.
   */
  private executeMeleeSwing(
    zombieHitboxes: THREE.Object3D[],
    onHitZombie: (result: HitResult) => void
  ) {
    const effectiveRpm = this.weaponConfig.fireRateRpm * (1 + this.upgrades.fireRateLevel * UPGRADE_TIERS.fireRateBonusPerLevel);
    this.fireCooldown = 60 / effectiveRpm;
    this.meleeSwingT = 1;

    const damageMultiplier = 1 + this.upgrades.damageLevel * UPGRADE_TIERS.damageMultiplierPerLevel;
    const dmg = Math.round(this.weaponConfig.baseDamage * damageMultiplier);

    soundFx.playShove(); // blade whoosh

    const camForward = new THREE.Vector3();
    this.camera.getWorldDirection(camForward);
    const flatFwd = new THREE.Vector3(camForward.x, 0, camForward.z).normalize();
    const origin = this.position.clone().add(new THREE.Vector3(0, 1.1, 0));

    let hits = 0;
    for (const hb of zombieHitboxes) {
      const zombieId = hb.userData?.zombieId;
      if (!zombieId) continue;
      const hitPos = new THREE.Vector3();
      hb.getWorldPosition(hitPos);

      const toZombie = hitPos.clone().sub(origin);
      const dist = toZombie.length();
      if (dist > this.weaponConfig.range + 0.4) continue;
      toZombie.y = 0;
      toZombie.normalize();
      if (flatFwd.dot(toZombie) < 0.35) continue; // ~70° half-angle cleave fan

      hits++;
      ParticleSystem.spawnBlood(hitPos, camForward, false, false, true);
      const floorPos = hitPos.clone();
      floorPos.y = 0.02;
      ParticleSystem.spawnBloodDecal(floorPos, 1.4);

      onHitZombie({
        hit: true,
        zone: 'TORSO',
        damage: dmg,
        isFatal: false,
        targetId: zombieId,
        point: [hitPos.x, hitPos.y, hitPos.z],
      });
    }

    if (hits > 0) {
      soundFx.playHitMarker();
    }

    // A blade whisper carries far less than a gunshot
    this.onGunshot?.(this.position.clone(), 7);
    // Slight lunge into the swing
    this.recoilOffset.z -= 0.12;
  }

  /**
   * Melee shove (V): weapon butt knockback that breaks out of swarms.
   * Returns true when the shove actually goes off (cooldown + stamina ok).
   */
  public tryShove(): boolean {
    if (this.isDead || this.shoveCooldown > 0) return false;
    if (this.stamina < 8) return false;

    this.stamina = Math.max(0, this.stamina - 8);
    this.staminaRegenTimer = 0.7;
    this.shoveCooldown = 1.4;

    // Weapon thrust animation rides the recoil spring
    this.recoilOffset.z -= 0.3;
    this.recoilRotation.x -= 0.35;
    soundFx.playShove();
    return true;
  }

  public takeDamage(amount: number, attackerPos: THREE.Vector3) {
    if (this.isDead) return;

    this.hp = Math.max(0, this.hp - amount);
    this.stamina = Math.max(0, this.stamina - 15); // Physical shock on stamina
    this.staminaRegenTimer = 1.0;
    this.damageFlashTime = 0.4;
    soundFx.playPlayerHurt();

    // Physical knockback: a strike shoves the player away from the attacker,
    // so being surrounded pushes you apart instead of pinning you in place
    const pushDir = new THREE.Vector3(this.position.x - attackerPos.x, 0, this.position.z - attackerPos.z);
    if (pushDir.lengthSq() > 0.0001) {
      pushDir.normalize();
      this.velocity.addScaledVector(pushDir, 2.8);
    }

    // Dynamic blood splatter on player screen / visor
    ParticleSystem.addScreenBlood(Math.min(0.6, amount * 0.02 + 0.18));
    ParticleSystem.spawnBlood(this.position.clone().add(new THREE.Vector3(0, 1.2, 0)), new THREE.Vector3(0, 0.5, 0));

    // Calculate angle to attacker for directional HUD damage indicator
    const dx = attackerPos.x - this.position.x;
    const dz = attackerPos.z - this.position.z;
    const angleToAttacker = Math.atan2(dx, dz);
    this.lastDamageAngle = angleToAttacker - this.yaw;

    // Directional damage indicator set for HUD vignette
    let relAngle = this.lastDamageAngle;
    while (relAngle > Math.PI) relAngle -= Math.PI * 2;
    while (relAngle < -Math.PI) relAngle += Math.PI * 2;

    if (this.hp <= 0) {
      this.isDead = true;
      soundFx.playDefeat();
    }
  }

  public heal(amount: number) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
    soundFx.playPickup();
  }

  public addAmmo(amount: number) {
    this.reserveAmmo = Math.min(this.weaponConfig.maxReserveAmmo * 2, this.reserveAmmo + amount);
    soundFx.playPickup();
  }

  public reset(spawnPos: [number, number, number] = [0, 0, -36]) {
    this.position.set(spawnPos[0], spawnPos[1], spawnPos[2]);
    this.camera.position.set(this.position.x, this.position.y + 1.7, this.position.z);
    this.velocity.set(0, 0, 0);
    this.verticalVelocity = 0;
    this.isGrounded = true;
    this.pitch = 0;
    this.yaw = Math.PI; // Face forward (+Z) down the urban avenue
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    this.hp = this.maxHp;
    this.stamina = this.maxStamina;
    this.isExhausted = false;
    this.isSprinting = false;
    this.staminaRegenTimer = 0;
    this.isDead = false;
    this.damageFlashTime = 0;
    this.recoilPitch = 0;
    this.sprintPose = 0;
    this.landDip = 0;
    this.isReloading = false;
    this.currentMag = this.weaponConfig.baseMagSize;
    this.reserveAmmo = this.weaponConfig.maxReserveAmmo;
    if (this.flashlight) {
      this.flashlight.intensity = this.isFlashlightOn ? (this.hasPowerfulFlashlight ? 20.0 : 9.0) : 0;
      this.flashlightFlood.intensity = this.isFlashlightOn ? (this.hasPowerfulFlashlight ? 7.0 : 3.5) : 0;
      this.flashlightFill.intensity = this.isFlashlightOn ? (this.hasPowerfulFlashlight ? 3.0 : 1.5) : 0;
    }
  }
}
