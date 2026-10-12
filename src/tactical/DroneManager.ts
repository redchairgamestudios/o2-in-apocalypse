import * as THREE from 'three';
import { soundFx } from '../audio/SoundEffects';
import { ParticleSystem } from '../effects/ParticleSystem';
import { ZombieManager } from '../zombies/ZombieManager';
import { SaveManager } from '../core/SaveManager';
import { NavCollision } from '../core/NavCollision';
import { HitResult } from '../types';

export interface DroneStatus {
  isAvailable: boolean;
  isDeployed: boolean;
  batteryRemaining: number;
  maxBattery: number;
  cooldownRemaining: number;
  maxCooldown: number;
  altitude: number;
  hullHp: number;
  maxHullHp: number;
  isUnderAttack: boolean;
}

export interface ActiveDroneRocket {
  mesh: THREE.Group;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  direction: THREE.Vector3;
  speed: number;
  life: number;
  maxLife: number;
  exhaustLight?: THREE.PointLight;
}

export class DroneManager {
  private static scene: THREE.Scene | null = null;
  private static droneGroup: THREE.Group | null = null;
  private static rotors: THREE.Mesh[] = [];
  private static searchlight: THREE.SpotLight | null = null;
  private static searchlightTarget: THREE.Object3D | null = null;
  private static laserBeam: THREE.Line | null = null;

  public static isDeployed: boolean = false;
  public static batteryTimer: number = 30.0;
  public static readonly BASE_DURATION: number = 30.0;
  public static cooldownTimer: number = 0;
  public static readonly BASE_COOLDOWN: number = 60.0;

  public static position: THREE.Vector3 = new THREE.Vector3(0, 4, 0);
  public static targetAltitude: number = 3.5;
  public static readonly MIN_ALTITUDE: number = 1.0;
  public static readonly MAX_ALTITUDE: number = 32.0;
  public static yaw: number = 0;
  public static pitch: number = -0.35; // Default looking slightly down at the battlefield
  private static velocity: THREE.Vector3 = new THREE.Vector3();
  private static fireTimer: number = 0;
  private static raycaster: THREE.Raycaster = new THREE.Raycaster();
  private static podToggle: boolean = false;
  private static activeRockets: ActiveDroneRocket[] = [];
  // Pooled thruster lights: runtime light creation forces full shader recompiles
  private static lightPool: THREE.PointLight[] = [];

  public static hullHp: number = 100;
  public static readonly MAX_HULL_HP: number = 100;
  public static isUnderAttack: boolean = false;
  private static underAttackTimer: number = 0;

  public static init(scene: THREE.Scene) {
    this.scene = scene;
    this.rotors = [];

    if (!this.lightPool.length) {
      for (let i = 0; i < 4; i++) {
        const light = new THREE.PointLight(0xff7700, 0, 7.0);
        light.visible = false;
        scene.add(light);
        this.lightPool.push(light);
      }
    }

    if (this.droneGroup) {
      scene.remove(this.droneGroup);
    }

    const root = new THREE.Group();
    root.name = 'tactical_uav_drone';
    root.visible = false;

    // Tactical Matte Carbon Fiber & Anodized Gunmetal Materials
    const carbonMat = new THREE.MeshStandardMaterial({
      color: 0x181a1b,
      roughness: 0.35,
      metalness: 0.8,
    });

    const armorMat = new THREE.MeshStandardMaterial({
      color: 0x27272a,
      roughness: 0.5,
      metalness: 0.5,
    });

    const rotorMat = new THREE.MeshStandardMaterial({
      color: 0x09090b,
      roughness: 0.2,
      metalness: 0.9,
    });

    const glowRedMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const glowGreenMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
    const sensorGlassMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      roughness: 0.1,
      metalness: 0.9,
    });

    // Central Hexagonal Fuselage
    const bodyGeo = new THREE.CylinderGeometry(0.5, 0.6, 0.22, 6);
    const bodyMesh = new THREE.Mesh(bodyGeo, carbonMat);
    root.add(bodyMesh);

    // Aerodynamic Top Cowling & GPS Dome
    const domeGeo = new THREE.SphereGeometry(0.28, 8, 8);
    domeGeo.scale(1.0, 0.4, 1.2);
    const domeMesh = new THREE.Mesh(domeGeo, armorMat);
    domeMesh.position.y = 0.14;
    root.add(domeMesh);

    // 4 Carbon Fiber Rotor Booms (X-Configuration)
    const boomLength = 0.95;
    const boomAngles = [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4];

    boomAngles.forEach((angle, idx) => {
      const boom = new THREE.Group();
      boom.rotation.y = angle;

      const rodGeo = new THREE.BoxGeometry(0.08, 0.05, boomLength);
      const rodMesh = new THREE.Mesh(rodGeo, armorMat);
      rodMesh.position.z = boomLength / 2;
      boom.add(rodMesh);

      // Motor Nacelle Pod
      const motorGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.16, 8);
      const motorMesh = new THREE.Mesh(motorGeo, carbonMat);
      motorMesh.position.set(0, 0.06, boomLength);
      boom.add(motorMesh);

      // Spinning Twin-Blade Rotor
      const bladeGeo = new THREE.BoxGeometry(0.65, 0.015, 0.05);
      const bladeMesh = new THREE.Mesh(bladeGeo, rotorMat);
      bladeMesh.position.set(0, 0.14, boomLength);
      boom.add(bladeMesh);
      this.rotors.push(bladeMesh);

      // Wingtip LED Strobe (Green Front, Red Rear)
      const isFront = angle < Math.PI;
      const ledGeo = new THREE.SphereGeometry(0.035, 6, 6);
      const ledMesh = new THREE.Mesh(ledGeo, isFront ? glowGreenMat : glowRedMat);
      ledMesh.position.set(0, 0, boomLength + 0.08);
      boom.add(ledMesh);

      root.add(boom);
    });

    // Underbelly Gimballed Tactical Sensor Turret
    const turretGroup = new THREE.Group();
    turretGroup.position.set(0, -0.16, 0.28);

    const gimbalGeo = new THREE.SphereGeometry(0.18, 12, 10);
    const gimbalMesh = new THREE.Mesh(gimbalGeo, carbonMat);
    turretGroup.add(gimbalMesh);

    const lensGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.08, 10);
    lensGeo.rotateX(Math.PI / 2);
    const lensMesh = new THREE.Mesh(lensGeo, sensorGlassMat);
    lensMesh.position.set(0, -0.02, 0.14);
    turretGroup.add(lensMesh);
    root.add(turretGroup);

    // Twin Underwing Heavy Multi-Tube Rocket Launch Pods (Air-to-Ground Missiles)
    [-0.46, 0.46].forEach((gx) => {
      // Pod main carbon armor housing
      const podBoxGeo = new THREE.BoxGeometry(0.18, 0.14, 0.52);
      const podBoxMesh = new THREE.Mesh(podBoxGeo, carbonMat);
      podBoxMesh.position.set(gx, -0.13, 0.38);
      root.add(podBoxMesh);

      // Pod front beveled cowl
      const cowlGeo = new THREE.BoxGeometry(0.19, 0.15, 0.08);
      const cowlMesh = new THREE.Mesh(cowlGeo, armorMat);
      cowlMesh.position.set(gx, -0.13, 0.62);
      root.add(cowlMesh);

      // 4 Launch Tubes in each pod with visible loaded red-tipped rockets
      const tubeOffsets = [
        [-0.045, 0.035],
        [0.045, 0.035],
        [-0.045, -0.035],
        [0.045, -0.035],
      ];
      tubeOffsets.forEach(([tx, ty]) => {
        const tubeGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.12, 6);
        tubeGeo.rotateX(Math.PI / 2);
        const tubeMesh = new THREE.Mesh(tubeGeo, rotorMat);
        tubeMesh.position.set(gx + tx, -0.13 + ty, 0.64);
        root.add(tubeMesh);

        // Visible loaded micro-rocket tip with explosive hazard red marking
        const rTipGeo = new THREE.ConeGeometry(0.02, 0.05, 6);
        rTipGeo.rotateX(Math.PI / 2);
        const rTipMesh = new THREE.Mesh(rTipGeo, new THREE.MeshBasicMaterial({ color: 0xef4444 }));
        rTipMesh.position.set(gx + tx, -0.13 + ty, 0.68);
        root.add(rTipMesh);
      });
    });

    // High-Intensity Tactical Downward Searchlight
    const light = new THREE.SpotLight(0xffffff, 8.0, 45, Math.PI / 3.8, 0.45, 1.2);
    light.position.set(0, -0.2, 0.2);
    const targetObj = new THREE.Object3D();
    targetObj.position.set(0, -15, 6);
    root.add(targetObj);
    light.target = targetObj;
    root.add(light);
    this.searchlight = light;
    this.searchlightTarget = targetObj;

    scene.add(root);
    this.droneGroup = root;
  }

  public static getStatus(): DroneStatus {
    const save = SaveManager.get();
    const isAvailable = Boolean(save.hasDrone);
    const maxDur = this.BASE_DURATION + (save.droneUpgrades?.durationLevel || 0) * 3.0;
    const maxCd = Math.max(35.0, this.BASE_COOLDOWN - (save.droneUpgrades?.cooldownLevel || 0) * 5.0);

    return {
      isAvailable,
      isDeployed: this.isDeployed,
      batteryRemaining: Math.max(0, Math.round(this.batteryTimer * 10) / 10),
      maxBattery: maxDur,
      cooldownRemaining: Math.max(0, Math.ceil(this.cooldownTimer)),
      maxCooldown: maxCd,
      altitude: Math.round(this.position.y * 10) / 10,
      hullHp: Math.max(0, Math.round(this.hullHp)),
      maxHullHp: this.MAX_HULL_HP,
      isUnderAttack: this.isUnderAttack,
    };
  }

  public static canDeploy(): boolean {
    const save = SaveManager.get();
    if (!save.hasDrone) return false;
    return !this.isDeployed && this.cooldownTimer <= 0;
  }

  public static deploy(playerPos: THREE.Vector3, playerYaw: number): boolean {
    if (!this.canDeploy() || !this.droneGroup) return false;

    const save = SaveManager.get();
    const maxDur = this.BASE_DURATION + (save.droneUpgrades?.durationLevel || 0) * 3.0;
    this.batteryTimer = maxDur;
    this.isDeployed = true;
    this.hullHp = this.MAX_HULL_HP;
    this.isUnderAttack = false;
    this.underAttackTimer = 0;

    // Launch drone starting above player, altitude can descend to 1.0m
    this.targetAltitude = Math.max(2.5, Math.min(6.0, playerPos.y + 3.0));
    this.position.set(playerPos.x, this.targetAltitude, playerPos.z - 1.5);
    this.yaw = playerYaw;
    this.pitch = -0.32; // Looking slightly down at zombies
    this.velocity.set(0, 0, 0);

    this.droneGroup.position.copy(this.position);
    this.droneGroup.rotation.set(0, this.yaw, 0);
    this.droneGroup.visible = true;

    soundFx.playRadioTransmission();
    soundFx.playRotorHum();

    return true;
  }

  public static takeDamage(amount: number, onScreenShake?: (intensity: number) => void): boolean {
    if (!this.isDeployed) return false;
    this.hullHp = Math.max(0, this.hullHp - amount);
    this.isUnderAttack = true;
    this.underAttackTimer = 1.4;
    soundFx.playDroneHullAlarm();
    soundFx.playFleshImpact();
    onScreenShake?.(0.65);
    ParticleSystem.spawnSparks(this.position.clone());

    if (this.hullHp <= 0) {
      // Drone destroyed in combat!
      ParticleSystem.spawnExplosion(this.position.clone());
      ParticleSystem.spawnGoreGibs(this.position.clone(), new THREE.Vector3(0, 1, 0), 6);
      soundFx.playExplosion();
      this.recall();
      return true; // Destroyed
    }
    return false;
  }

  public static shiftAltitude(deltaMeters: number) {
    this.targetAltitude = Math.max(this.MIN_ALTITUDE, Math.min(this.MAX_ALTITUDE, this.targetAltitude + deltaMeters));
  }

  public static clearRockets() {
    if (this.scene) {
      for (const r of this.activeRockets) {
        this.scene.remove(r.mesh);
      }
    }
    this.activeRockets = [];
  }

  public static recall() {
    if (!this.isDeployed) return;

    this.isDeployed = false;
    if (this.droneGroup) {
      this.droneGroup.visible = false;
    }

    const save = SaveManager.get();
    const maxCd = Math.max(35.0, this.BASE_COOLDOWN - (save.droneUpgrades?.cooldownLevel || 0) * 5.0);
    this.cooldownTimer = maxCd;

    soundFx.playRadioTransmission();
  }

  public static update(
    delta: number,
    input: {
      forward: number;
      strafe: number;
      lookDeltaX: number;
      lookDeltaY: number;
      shoot: boolean;
      ascend?: boolean;
      descend?: boolean;
      altitudeDelta?: number;
    },
    camera: THREE.PerspectiveCamera,
    zombieManager: ZombieManager,
    onKill: (deadZ: any, isHeadshot: boolean) => void,
    playerPos: THREE.Vector3,
    onScreenShake?: (intensity: number) => void
  ): { isDroneActive: boolean } {
    // 0. Update in-flight active rockets
    this.updateRockets(delta, zombieManager, onKill, onScreenShake, camera);

    // 1. Manage Cooldown when not deployed
    if (!this.isDeployed) {
      if (this.cooldownTimer > 0) {
        this.cooldownTimer -= delta;
        if (this.cooldownTimer <= 0) {
          this.cooldownTimer = 0;
          soundFx.playCashEarned(); // Notification chime
        }
      }
      return { isDroneActive: false };
    }

    // 2. Battery Consumption during active flight
    this.batteryTimer -= delta;
    if (this.batteryTimer <= 0) {
      this.recall();
      return { isDroneActive: false };
    }

    if (!this.droneGroup) return { isDroneActive: false };

    // Update attack status timer
    if (this.underAttackTimer > 0) {
      this.underAttackTimer -= delta;
      if (this.underAttackTimer <= 0) {
        this.isUnderAttack = false;
      }
    }

    // 3. Spin Rotors rapidly
    this.rotors.forEach((rotor, i) => {
      rotor.rotation.y += delta * (i % 2 === 0 ? 45 : -45);
    });

    // 4. Drone Camera & Attitude Control
    const mouseSens = 0.0022;
    this.yaw -= input.lookDeltaX * mouseSens;
    this.pitch -= input.lookDeltaY * mouseSens;
    // Clamp pitch between steep down (-1.2 rad) and horizontal (-0.05 rad)
    this.pitch = Math.max(-1.3, Math.min(-0.08, this.pitch));

    // 5. Flight Kinematics
    const save = SaveManager.get();
    const speedMultiplier = 1.0 + (save.droneUpgrades?.speedLevel || 0) * 0.15;
    const maxFlySpeed = 12.0 * speedMultiplier;

    // Movement relative to drone yaw:
    // Looking along forward (sin yaw, 0, cos yaw) in Three.js screen space,
    // the screen-right vector is (-cos yaw, 0, sin yaw).
    const forwardVec = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)).normalize();
    const rightVec = new THREE.Vector3(-Math.cos(this.yaw), 0, Math.sin(this.yaw)).normalize();

    const moveDir = new THREE.Vector3();
    if (input.forward !== 0) moveDir.addScaledVector(forwardVec, input.forward);
    if (input.strafe !== 0) moveDir.addScaledVector(rightVec, input.strafe);

    if (moveDir.lengthSq() > 0) {
      moveDir.normalize();
      this.velocity.lerp(moveDir.multiplyScalar(maxFlySpeed), delta * 5.0);
    } else {
      this.velocity.lerp(new THREE.Vector3(0, 0, 0), delta * 4.0);
    }

    // 5b. Dynamic Altitude Shift (Ascend / Descend controls)
    const climbSpeed = 8.5;
    if (input.ascend) {
      this.targetAltitude = Math.min(this.MAX_ALTITUDE, this.targetAltitude + delta * climbSpeed);
    }
    if (input.descend) {
      this.targetAltitude = Math.max(this.MIN_ALTITUDE, this.targetAltitude - delta * climbSpeed);
    }
    if (input.altitudeDelta) {
      this.shiftAltitude(input.altitudeDelta);
    }

    // Altitude stabilization: smoothly lerp to user-shifted target altitude
    this.position.addScaledVector(this.velocity, delta);
    this.position.y = THREE.MathUtils.lerp(this.position.y, this.targetAltitude, delta * 3.8);

    // Limit distance from operational zone (expanded district)
    const distFromPlayer = new THREE.Vector2(this.position.x - playerPos.x, this.position.z - playerPos.z).length();
    if (distFromPlayer > 160.0) {
      const angle = Math.atan2(this.position.z - playerPos.z, this.position.x - playerPos.x);
      this.position.x = playerPos.x + Math.cos(angle) * 160.0;
      this.position.z = playerPos.z + Math.sin(angle) * 160.0;
    }

    // 3D building collision: the drone banks off rooftops instead of clipping
    NavCollision.resolveFlying(this.position, 0.7);

    // Dynamic Banking Roll/Pitch for realistic flight physics
    const roll = this.velocity.dot(rightVec) * 0.035;
    const flightPitch = this.velocity.dot(forwardVec) * 0.03;

    this.droneGroup.position.copy(this.position);
    this.droneGroup.rotation.set(flightPitch, this.yaw, roll);

    // Align Searchlight
    if (this.searchlightTarget) {
      this.searchlightTarget.position.set(
        Math.sin(this.yaw) * 12,
        -14,
        Math.cos(this.yaw) * 12
      );
    }

    // 6. Camera Follows Drone in 3rd-person Chase / Recon Cockpit Angle
    const camDistance = 3.2;
    const camHeight = 1.4;
    const camOffset = new THREE.Vector3(
      -Math.sin(this.yaw) * camDistance,
      camHeight,
      -Math.cos(this.yaw) * camDistance
    );

    camera.position.copy(this.position).add(camOffset);
    // Look along pitch and yaw
    const lookTarget = new THREE.Vector3(
      this.position.x + Math.sin(this.yaw) * 20,
      this.position.y + Math.sin(this.pitch) * 20,
      this.position.z + Math.cos(this.yaw) * 20
    );
    camera.lookAt(lookTarget);

    // 7. Tactical Air-To-Ground Rocket Salvo Launch
    this.fireTimer -= delta;
    if (input.shoot && this.fireTimer <= 0) {
      this.fireTimer = 0.35; // Deliberate and impactful rocket salvo cadence
      this.launchRocket(camera, zombieManager, onKill, onScreenShake);
    }

    return { isDroneActive: true };
  }

  // Launch a Physical High-Explosive Rocket Projectile from Underwing Pods
  private static launchRocket(
    camera: THREE.PerspectiveCamera,
    zombieManager: ZombieManager,
    onKill: (deadZ: any, isHeadshot: boolean) => void,
    onScreenShake?: (intensity: number) => void
  ) {
    if (!this.scene || !this.droneGroup) return;

    // Alternate between left pod (-0.46) and right pod (+0.46)
    this.podToggle = !this.podToggle;
    const podX = this.podToggle ? -0.46 : 0.46;
    const localPodPos = new THREE.Vector3(podX, -0.13, 0.65);
    const launchPos = localPodPos.clone();
    this.droneGroup.localToWorld(launchPos);

    // Raycast target point through crosshair in 3D world
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hitboxes = zombieManager.getHitboxMeshes();
    const intersects = this.raycaster.intersectObjects(hitboxes, false);

    let targetPoint: THREE.Vector3;
    if (intersects.length > 0) {
      targetPoint = intersects[0].point.clone();
    } else {
      // Intersection with floor plane or forward distance
      const rayDir = this.raycaster.ray.direction;
      if (rayDir.y < -0.01) {
        const floorDist = -this.raycaster.ray.origin.y / rayDir.y;
        targetPoint = this.raycaster.ray.origin.clone().addScaledVector(rayDir, Math.min(85, Math.max(6, floorDist)));
      } else {
        targetPoint = this.raycaster.ray.origin.clone().addScaledVector(rayDir, 50);
      }
    }

    const fireDir = new THREE.Vector3().subVectors(targetPoint, launchPos).normalize();

    // Create 3D Rocket Projectile Mesh
    const rocket = new THREE.Group();
    rocket.position.copy(launchPos);

    // Dark Carbon Missile Fuselage
    const bodyGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.55, 8);
    bodyGeo.rotateX(Math.PI / 2);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x27272a,
      roughness: 0.35,
      metalness: 0.8,
    });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    rocket.add(bodyMesh);

    // Aerodynamic Explosive Warhead (Hazard Red)
    const warheadGeo = new THREE.ConeGeometry(0.046, 0.18, 8);
    warheadGeo.rotateX(Math.PI / 2);
    const warheadMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      roughness: 0.3,
      metalness: 0.4,
    });
    const warheadMesh = new THREE.Mesh(warheadGeo, warheadMat);
    warheadMesh.position.set(0, 0, 0.36);
    rocket.add(warheadMesh);

    // Yellow warning band
    const bandGeo = new THREE.CylinderGeometry(0.047, 0.047, 0.06, 8);
    bandGeo.rotateX(Math.PI / 2);
    const bandMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    const bandMesh = new THREE.Mesh(bandGeo, bandMat);
    bandMesh.position.set(0, 0, 0.22);
    rocket.add(bandMesh);

    // 4 Stabilizing Tail Fins
    const finMat = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.85 });
    const finGeoH = new THREE.BoxGeometry(0.22, 0.012, 0.12);
    const finH = new THREE.Mesh(finGeoH, finMat);
    finH.position.set(0, 0, -0.2);
    rocket.add(finH);

    const finGeoV = new THREE.BoxGeometry(0.012, 0.22, 0.12);
    const finV = new THREE.Mesh(finGeoV, finMat);
    finV.position.set(0, 0, -0.2);
    rocket.add(finV);

    // Glowing Thruster Exhaust Rim
    const exhaustGeo = new THREE.CylinderGeometry(0.035, 0.04, 0.05, 8);
    exhaustGeo.rotateX(Math.PI / 2);
    const exhaustMat = new THREE.MeshBasicMaterial({ color: 0xff5500 });
    const exhaustMesh = new THREE.Mesh(exhaustGeo, exhaustMat);
    exhaustMesh.position.set(0, 0, -0.28);
    rocket.add(exhaustMesh);

    // Dynamic Thruster Point Light (pooled — no runtime light creation)
    const thrusterLight = this.lightPool.find((l) => !l.visible);
    if (thrusterLight) {
      thrusterLight.position.set(0, 0, -0.32);
      thrusterLight.visible = true;
      thrusterLight.intensity = 3.5;
      rocket.add(thrusterLight);
    }

    // Orient rocket along launch trajectory
    rocket.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), fireDir);

    this.scene.add(rocket);

    // Sound & pod launch muzzle sparks
    soundFx.playRocketLaunch();
    ParticleSystem.spawnSparks(launchPos, fireDir);

    this.activeRockets.push({
      mesh: rocket,
      position: launchPos.clone(),
      velocity: fireDir.clone().multiplyScalar(28.0),
      direction: fireDir.clone(),
      speed: 28.0,
      life: 0,
      maxLife: 3.5,
      exhaustLight: thrusterLight,
    });
  }

  // Update In-Flight Rockets: Kinematics, Smoke Trails, and AoE Detonation
  private static updateRockets(
    delta: number,
    zombieManager: ZombieManager,
    onKill: (deadZ: any, isHeadshot: boolean) => void,
    onScreenShake?: (intensity: number) => void,
    camera?: THREE.PerspectiveCamera
  ) {
    if (!this.scene) return;

    for (let i = this.activeRockets.length - 1; i >= 0; i--) {
      const r = this.activeRockets[i];
      r.life += delta;

      // Rocket acceleration curve (accelerates up to 60 m/s)
      r.speed = Math.min(60.0, r.speed + delta * 52.0);
      r.position.addScaledVector(r.direction, r.speed * delta);
      r.mesh.position.copy(r.position);

      // Rocket propellant smoke and fire particle trail
      const exhaustPos = r.position.clone().addScaledVector(r.direction, -0.35);
      ParticleSystem.spawnSparks(exhaustPos, r.direction.clone().negate());

      // Flicker exhaust light
      if (r.exhaustLight) {
        r.exhaustLight.intensity = 2.8 + Math.random() * 1.5;
      }

      // Collision checks:
      // 1. Direct hit with any active zombie
      let directHit = false;
      const zombies = zombieManager.zombies;
      for (const z of zombies) {
        if (z.isDead) continue;
        if (z.mesh.position.distanceTo(r.position) < 1.35) {
          directHit = true;
          break;
        }
      }

      // 2. Ground collision
      const groundHit = r.position.y <= 0.15;

      // 3. District perimeter bounds
      const outOfBounds = Math.abs(r.position.x) > 120 || Math.abs(r.position.z) > 160;

      // 4. Lifetime expiration
      const expired = r.life >= r.maxLife;

      if (directHit || groundHit || outOfBounds || expired) {
        const impactPos = r.position.clone();
        if (impactPos.y < 0.1) impactPos.y = 0.1;

        this.detonateRocket(impactPos, zombieManager, onKill, onScreenShake, camera);

        // Return pooled thruster light before removing the rocket
        if (r.exhaustLight && this.scene) {
          this.scene.add(r.exhaustLight);
          r.exhaustLight.visible = false;
          r.exhaustLight.intensity = 0;
        }
        // Remove from scene & active array
        this.scene.remove(r.mesh);
        this.activeRockets.splice(i, 1);
      }
    }
  }

  // Detonate High-Explosive Rocket: Explosion, Scorch Decal, Gore Gibs, AoE Blast Damage & Screen Shake
  private static detonateRocket(
    impactPos: THREE.Vector3,
    zombieManager: ZombieManager,
    onKill: (deadZ: any, isHeadshot: boolean) => void,
    onScreenShake?: (intensity: number) => void,
    camera?: THREE.PerspectiveCamera
  ) {
    soundFx.playExplosion();

    // Detonation particles: explosion fireball, smoke plume, and scorch decal
    ParticleSystem.spawnExplosion(impactPos);
    ParticleSystem.spawnBloodDecal(new THREE.Vector3(impactPos.x, 0.02, impactPos.z), 4.2);

    // Gore & dismemberment around blast crater
    ParticleSystem.spawnGoreGibs(impactPos, new THREE.Vector3(0, 1, 0), 10);

    // Kinetic camera screen shake
    if (onScreenShake && camera) {
      const dist = camera.position.distanceTo(impactPos);
      const intensity = Math.max(0.25, 1.0 - dist / 50.0) * 0.95;
      onScreenShake(intensity);
    }

    // Heavy AoE explosive splash damage (scales with drone upgrades)
    const save = SaveManager.get();
    const blastDmg = 380 + (save.droneUpgrades?.damageLevel || 0) * 85;
    zombieManager.damageArea(impactPos, 7.5, blastDmg, onKill);
  }
}
