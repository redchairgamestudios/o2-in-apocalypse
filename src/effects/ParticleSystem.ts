import * as THREE from 'three';
import { PickupItem } from '../types';
import { ProceduralTextures } from '../textures/ProceduralTextures';
import { soundFx } from '../audio/SoundEffects';

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  rotVelocity: THREE.Vector3;
  life: number;
  maxLife: number;
  gravity: number;
  scaleDelta: number;
  active: boolean;
  isGib?: boolean;
}

interface BloodDecal {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
  initialScale: number;
  maxScale: number;
  type: 'POOL' | 'SPLATTER' | 'WALL' | 'SCORCH';
}

export interface ScreenBloodDrop {
  id: string;
  x: number;
  y: number;
  size: number;
  rotation: number;
  type: 'blood' | 'acid';
  alpha: number;
  dripLength: number;
  variant: 'burst' | 'drip' | 'mist' | 'smear';
  speed: number;
}

export class ParticleSystem {
  private static scene: THREE.Scene | null = null;
  private static particles: Particle[] = [];
  private static decals: BloodDecal[] = [];
  private static decalIndex: number = 0;
  private static pickupMeshes: Map<string, THREE.Group> = new Map();
  // Current mission environment — wall-blood raycasts anchor against these so
  // splatter decals only ever cling to real surfaces, never float in air
  private static envMeshes: THREE.Object3D[] = [];
  private static wallRaycaster: THREE.Raycaster = new THREE.Raycaster();

  /** Give the particle system the active mission environment for surface queries. */
  public static setEnvMeshes(group: THREE.Object3D | null) {
    this.envMeshes = group ? [group] : [];
  }

  /**
   * First hit that lands on a SOLID, opaque, visible surface. Transparent
   * props (the objective light beam, chain-link fences, the extraction ring)
   * and hidden helpers must never carry a decal — blood anchored to a
   * see-through mesh reads as blood floating in mid-air.
   */
  private static firstSolidHit(hits: THREE.Intersection[]): THREE.Intersection | null {
    for (const h of hits) {
      const mesh = h.object as THREE.Mesh;
      if (!mesh.isMesh || !mesh.visible) continue;
      const mat = mesh.material as (THREE.Material & { opacity?: number }) | undefined;
      if (!mat) continue;
      if (mat.transparent || (mat.opacity ?? 1) < 0.95) continue;
      return h;
    }
    return null;
  }

  private static bloodMat: THREE.MeshBasicMaterial | null = null;
  private static darkBloodMat: THREE.MeshStandardMaterial | null = null;
  private static acidMat: THREE.MeshBasicMaterial | null = null;
  private static fleshMat: THREE.MeshStandardMaterial | null = null;
  private static boneMat: THREE.MeshStandardMaterial | null = null;
  private static sparkMat: THREE.MeshBasicMaterial | null = null;
  private static fireMat: THREE.MeshBasicMaterial | null = null;
  private static smokeMat: THREE.MeshBasicMaterial | null = null;
  private static brassMat: THREE.MeshStandardMaterial | null = null;

  // Reusable decal materials
  private static poolMat: THREE.MeshStandardMaterial | null = null;
  private static splatterMat: THREE.MeshBasicMaterial | null = null;
  private static wallDripMat: THREE.MeshBasicMaterial | null = null;
  private static scorchMat: THREE.MeshBasicMaterial | null = null;

  // Screen blood droplets state
  public static screenBloodIntensity: number = 0;
  public static screenSplats: ScreenBloodDrop[] = [];

  public static init(scene: THREE.Scene) {
    this.scene = scene;

    // Mobile: every active particle/decal is its own draw call with per-frame
    // CPU simulation — pool sizes are cut roughly in half on touch devices.
    const isTouch =
      'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth <= 1024;
    const PARTICLE_POOL = isTouch ? 140 : 300;
    const GIB_START = isTouch ? 100 : 210;
    const GIB_END = isTouch ? 120 : 260;
    const DECAL_POOL = isTouch ? 60 : 140;
    const WALL_DECAL_START = isTouch ? 40 : 90;
    const WALL_DECAL_END = isTouch ? 52 : 120;

    this.bloodMat = new THREE.MeshBasicMaterial({ color: 0x990000 });
    this.darkBloodMat = new THREE.MeshStandardMaterial({
      color: 0x4a0000,
      roughness: 0.25,
      metalness: 0.15,
    });
    this.acidMat = new THREE.MeshBasicMaterial({ color: 0xa3e635 });
    this.fleshMat = new THREE.MeshStandardMaterial({
      color: 0x6e1b23,
      roughness: 0.8,
      metalness: 0.05,
    });
    this.boneMat = new THREE.MeshStandardMaterial({
      color: 0xe2ded4,
      roughness: 0.6,
      metalness: 0.1,
    });
    this.sparkMat = new THREE.MeshBasicMaterial({ color: 0xffe066 });
    this.fireMat = new THREE.MeshBasicMaterial({ color: 0xff5511 });
    this.smokeMat = new THREE.MeshBasicMaterial({ color: 0x444449, transparent: true, opacity: 0.6 });
    this.brassMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.3 });

    // Decal materials
    // Wet-blood pool: standard material with low roughness picks up the sky
    // environment + moonlight so fresh pools glint like the reference still
    this.poolMat = new THREE.MeshStandardMaterial({
      map: ProceduralTextures.getBloodPool(),
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      roughness: 0.22,
      metalness: 0.45,
      envMapIntensity: 0.75,
    });

    this.splatterMat = new THREE.MeshBasicMaterial({
      map: ProceduralTextures.getBloodSplatter(),
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    });

    this.wallDripMat = new THREE.MeshBasicMaterial({
      map: ProceduralTextures.getBloodWallDrip(),
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.scorchMat = new THREE.MeshBasicMaterial({
      map: ProceduralTextures.getScorchMark(),
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });

    // Pre-allocate pooled particle meshes (300 desktop / 140 mobile)
    const sphereGeo = new THREE.SphereGeometry(0.065, 4, 4);
    const boxGibGeo = new THREE.BoxGeometry(0.14, 0.09, 0.12);
    const boneGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.2, 5);

    for (let i = 0; i < PARTICLE_POOL; i++) {
      let geo: THREE.BufferGeometry = sphereGeo;
      let mat: THREE.Material = this.bloodMat;
      let isGib = false;

      if (i >= GIB_START && i < GIB_END) {
        geo = boxGibGeo;
        mat = this.fleshMat;
        isGib = true;
      } else if (i >= GIB_END) {
        geo = boneGeo;
        mat = this.boneMat;
        isGib = true;
      }

      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      mesh.castShadow = isGib;
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        velocity: new THREE.Vector3(),
        rotVelocity: new THREE.Vector3(),
        life: 0,
        maxLife: 1,
        gravity: 9.8,
        scaleDelta: 0,
        active: false,
        isGib,
      });
    }

    // Pre-allocate decals (140 desktop / 60 mobile): ground pools/splatters + wall decals + scorch marks
    const decalGeo = new THREE.PlaneGeometry(1, 1);
    decalGeo.rotateX(-Math.PI / 2);

    for (let i = 0; i < DECAL_POOL; i++) {
      const isWall = i >= WALL_DECAL_START && i < WALL_DECAL_END;
      const isScorch = i >= WALL_DECAL_END;
      const geo = isWall ? new THREE.PlaneGeometry(1, 1) : decalGeo;
      const mat = isScorch
        ? this.scorchMat!.clone()
        : isWall
          ? this.wallDripMat.clone()
          : i % 2 === 0 ? this.poolMat!.clone() : this.splatterMat!.clone();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.decals.push({
        mesh,
        life: 0,
        maxLife: 35, // Decals stay for up to 35 seconds of persistent carnage!
        initialScale: 0.3,
        maxScale: 2.2,
        type: isScorch ? 'SCORCH' : isWall ? 'WALL' : (i % 2 === 0 ? 'POOL' : 'SPLATTER'),
      });
    }
  }

  private static getFreeParticle(preferGib: boolean = false): Particle | null {
    if (preferGib) {
      for (let i = 210; i < this.particles.length; i++) {
        if (!this.particles[i].active) return this.particles[i];
      }
    }
    for (const p of this.particles) {
      if (!p.active) return p;
    }
    return null;
  }

  // Realistic Visceral Blood & Gore Splatter on hit
  public static spawnBlood(
    pos: THREE.Vector3,
    dir: THREE.Vector3,
    isHeadshot: boolean = false,
    isAcid: boolean = false,
    isShotgun: boolean = false
  ) {
    const count = isShotgun ? 48 : (isHeadshot ? 38 : 22);
    for (let i = 0; i < count; i++) {
      const p = this.getFreeParticle();
      if (!p) break;

      p.mesh.material = isAcid
        ? this.acidMat!
        : Math.random() > 0.35
        ? this.bloodMat!
        : this.darkBloodMat!;

      p.mesh.position.copy(pos);
      p.mesh.scale.setScalar(isHeadshot ? 1.8 : 1.1);
      p.mesh.visible = true;
      p.active = true;
      p.life = 0;
      p.maxLife = 0.55 + Math.random() * 0.45;
      p.gravity = 14.5;
      p.scaleDelta = -0.4;

      const spread = isShotgun ? 5.8 : (isHeadshot ? 4.8 : 3.0);
      p.velocity.set(
        dir.x * 3.6 + (Math.random() - 0.5) * spread,
        dir.y * 2.4 + Math.random() * spread * 0.9,
        dir.z * 3.6 + (Math.random() - 0.5) * spread
      );
      p.rotVelocity.set(0, 0, 0);
    }

    // Spawn 3D Flesh/Bone Gibs on headshot or heavy hit
    if (isHeadshot || isShotgun) {
      this.spawnGoreGibs(pos, dir, isHeadshot ? 8 : 5);
      if (isHeadshot) {
        this.spawnArterialSpurt(pos, new THREE.Vector3(0, 1, 0));
        soundFx.playGoreSplatter();
      }
    }

    // Dynamic ground decal directly below impact
    this.spawnBloodDecal(new THREE.Vector3(pos.x, 0.02, pos.z), isHeadshot ? 3.0 : (isShotgun ? 2.6 : 1.8));

    // Directional forward splatter spray trail landing on ground ahead
    if (Math.abs(dir.x) > 0.05 || Math.abs(dir.z) > 0.05) {
      const forwardSplatPos = new THREE.Vector3(
        pos.x + dir.x * (1.2 + Math.random() * 1.4),
        0.02,
        pos.z + dir.z * (1.2 + Math.random() * 1.4)
      );
      this.spawnBloodDecal(forwardSplatPos, isHeadshot ? 2.2 : 1.4);
    }

  // Wall blood check: spray toward a REAL surface — the search direction is
  // raycast and the decal is dropped when no wall is actually there (the old
  // fixed ±1.2m guess stamped floating blood circles in open air)
  if (Math.abs(pos.x) > 7.5 || Math.random() < 0.35) {
    const searchDir = new THREE.Vector3(dir.x, 0, dir.z);
    if (searchDir.lengthSq() < 0.01) {
      searchDir.set(pos.x > 0 ? -1 : 1, 0, 0);
    }
    this.spawnWallBlood(pos, searchDir.normalize(), isHeadshot ? 2.4 : 1.6);
  }
}

  // Pulsing Arterial Blood Fountain (Headshot decapitation geyser)
  public static spawnArterialSpurt(neckPos: THREE.Vector3, dir: THREE.Vector3) {
    for (let burst = 0; burst < 3; burst++) {
      setTimeout(() => {
        if (!this.scene) return;
        for (let i = 0; i < 14; i++) {
          const p = this.getFreeParticle();
          if (!p) break;

          p.mesh.material = Math.random() > 0.5 ? this.bloodMat! : this.darkBloodMat!;
          p.mesh.position.copy(neckPos);
          p.mesh.scale.setScalar(1.2 + Math.random() * 0.6);
          p.mesh.visible = true;
          p.active = true;
          p.life = 0;
          p.maxLife = 0.65;
          p.gravity = 15.0;
          p.scaleDelta = -0.3;

          const spread = 1.2;
          p.velocity.set(
            (Math.random() - 0.5) * spread,
            Math.random() * 4.5 + 4.0, // High vertical geyser arc
            (Math.random() - 0.5) * spread
          );
        }
      }, burst * 140);
    }
  }

  // Small blood drip on floor for crawling or wounded zombies
  public static spawnBleedDrip(pos: THREE.Vector3) {
    const p = this.getFreeParticle();
    if (p) {
      p.mesh.material = this.darkBloodMat!;
      p.mesh.position.copy(pos);
      p.mesh.scale.setScalar(0.7);
      p.mesh.visible = true;
      p.active = true;
      p.life = 0;
      p.maxLife = 0.4;
      p.gravity = 18.0;
      p.velocity.set((Math.random() - 0.5) * 0.4, -0.5, (Math.random() - 0.5) * 0.4);
    }
    if (Math.random() < 0.35) {
      this.spawnBloodDecal(new THREE.Vector3(pos.x, 0.02, pos.z), 0.65);
    }
  }

  // Visceral 3D Gibs (meat chunks, skull bone shards)
  public static spawnGoreGibs(pos: THREE.Vector3, dir: THREE.Vector3, count: number = 6) {
    soundFx.playDismemberment();

    for (let i = 0; i < count; i++) {
      const p = this.getFreeParticle(true);
      if (!p) break;

      p.mesh.position.copy(pos);
      p.mesh.scale.setScalar(Math.random() * 0.8 + 0.6);
      p.mesh.visible = true;
      p.active = true;
      p.life = 0;
      p.maxLife = 2.8 + Math.random() * 1.5;
      p.gravity = 16.0;
      p.scaleDelta = 0;

      const spread = 5.0;
      p.velocity.set(
        dir.x * 2.2 + (Math.random() - 0.5) * spread,
        Math.random() * 4.8 + 2.2,
        dir.z * 2.2 + (Math.random() - 0.5) * spread
      );
      p.rotVelocity.set(
        (Math.random() - 0.5) * 16,
        (Math.random() - 0.5) * 16,
        (Math.random() - 0.5) * 16
      );
    }
  }

  // Expanding Ground Blood Pool Decal
  public static spawnBloodDecal(groundPos: THREE.Vector3, size: number = 2.0, life: number = 32 + Math.random() * 10) {
    // Find free ground decal (indices 0..89)
    let decal: BloodDecal | null = null;
    for (let i = 0; i < 90; i++) {
      const idx = (this.decalIndex + i) % 90;
      if (!this.decals[idx].mesh.visible) {
        decal = this.decals[idx];
        this.decalIndex = (idx + 1) % 90;
        break;
      }
    }
    if (!decal) {
      // Reuse oldest
      this.decalIndex = (this.decalIndex + 1) % 90;
      decal = this.decals[this.decalIndex];
    }
    if (!decal) return;

    // Slight Y offset prevents z-fighting
    const yJitter = 0.022 + (this.decalIndex % 25) * 0.0008;
    decal.mesh.position.set(groundPos.x, yJitter, groundPos.z);
    decal.mesh.rotation.set(-Math.PI / 2, 0, Math.random() * Math.PI * 2);
    decal.mesh.scale.setScalar(0.35);
    decal.mesh.visible = true;
    decal.life = 0;
    decal.maxLife = life;
    decal.initialScale = 0.35;
    decal.maxScale = size;
    (decal.mesh.material as THREE.MeshBasicMaterial).opacity = 0.94;
  }

  // Charred blast-residue ground mark (explosions — never blood-colored)
  public static spawnScorchDecal(groundPos: THREE.Vector3, size: number = 3.0) {
    let decal: BloodDecal | null = null;
    for (let i = 120; i < 140; i++) {
      if (!this.decals[i].mesh.visible) {
        decal = this.decals[i];
        break;
      }
    }
    if (!decal) {
      decal = this.decals[120 + Math.floor(Math.random() * 20)];
    }
    if (!decal) return;

    decal.mesh.position.set(groundPos.x, 0.024, groundPos.z);
    decal.mesh.rotation.set(-Math.PI / 2, 0, Math.random() * Math.PI * 2);
    decal.mesh.scale.setScalar(0.3);
    decal.mesh.visible = true;
    decal.life = 0;
    decal.maxLife = 45 + Math.random() * 15;
    decal.initialScale = 0.3;
    decal.maxScale = size;
    (decal.mesh.material as THREE.MeshBasicMaterial).opacity = 0.85;
  }

  // Wall Blood Splatter Decal — surface-anchored. `exact=true` places the
  // decal directly on a real bullet impact point/normal; otherwise the given
  // search direction is raycast for a nearby surface and the decal is skipped
  // entirely when none exists — floating blood-in-air is never acceptable.
  public static spawnWallBlood(
    pos: THREE.Vector3,
    normal: THREE.Vector3,
    size: number = 1.6,
    exact: boolean = false
  ) {
    // Find free wall decal (indices 90..119)
    let decal: BloodDecal | null = null;
    for (let i = 90; i < 120; i++) {
      if (!this.decals[i].mesh.visible) {
        decal = this.decals[i];
        break;
      }
    }
    if (!decal) {
      decal = this.decals[90 + Math.floor(Math.random() * 30)];
    }
    if (!decal) return;

    let anchor: THREE.Vector3;
    let faceNormal: THREE.Vector3;

    if (exact || this.envMeshes.length === 0) {
      if (!exact) return; // no environment to search — skip rather than float
      anchor = pos.clone();
      faceNormal = normal.clone().normalize();
    } else {
      this.wallRaycaster.set(pos, normal);
      this.wallRaycaster.far = 3.2;
      const solid = this.firstSolidHit(this.wallRaycaster.intersectObjects(this.envMeshes, true));
      if (!solid) return; // no opaque wall in range — no decal
      anchor = solid.point.clone();
      faceNormal = solid.face
        ? solid.face.normal.clone().transformDirection(solid.object.matrixWorld)
        : normal.clone().negate();
    }

    decal.mesh.position.copy(anchor);
    decal.mesh.position.addScaledVector(faceNormal, 0.04);
    decal.mesh.lookAt(anchor.clone().add(faceNormal));
    decal.mesh.scale.set(size, size * 1.3, 1);
    decal.mesh.visible = true;
    decal.life = 0;
    decal.maxLife = 35;
    decal.initialScale = size * 0.7;
    decal.maxScale = size;
    (decal.mesh.material as THREE.MeshBasicMaterial).opacity = 0.95;
  }

  // Add Screen / Visor Blood Splatter
  public static addScreenBlood(
    amount: number,
    type: 'blood' | 'acid' = 'blood',
    origin?: { x: number; y: number }
  ) {
    this.screenBloodIntensity = Math.min(1.0, this.screenBloodIntensity + amount);
    soundFx.playBloodSplat();

    // Create 1-3 individual organic screen splatters
    const count = amount > 0.45 ? 3 : amount > 0.22 ? 2 : 1;
    const variants: Array<'burst' | 'drip' | 'mist' | 'smear'> = ['burst', 'drip', 'mist', 'smear'];

    for (let i = 0; i < count; i++) {
      if (this.screenSplats.length > 12) {
        this.screenSplats.shift(); // keep max 12 screen splatters
      }

      const baseX = origin ? origin.x + (Math.random() - 0.5) * 20 : Math.random() * 80 + 10;
      const baseY = origin ? origin.y + (Math.random() - 0.5) * 20 : Math.random() * 70 + 15;
      const variant = variants[Math.floor(Math.random() * variants.length)];

      this.screenSplats.push({
        id: `splat_${Date.now()}_${Math.random()}`,
        x: Math.max(8, Math.min(92, baseX)),
        y: Math.max(8, Math.min(88, baseY)),
        size: variant === 'mist' ? Math.random() * 30 + 45 : Math.random() * 55 + 65,
        rotation: Math.random() * 360,
        type,
        alpha: 1.0,
        dripLength: variant === 'drip' ? Math.random() * 40 + 20 : Math.random() * 20 + 8,
        variant,
        speed: variant === 'drip' ? Math.random() * 1.5 + 1.0 : Math.random() * 0.7 + 0.3,
      });
    }
  }

  // Metal sparks / wall impact
  public static spawnSparks(pos: THREE.Vector3, normal?: THREE.Vector3) {
    const norm = normal || new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < 6; i++) {
      const p = this.getFreeParticle();
      if (!p) break;

      p.mesh.material = this.sparkMat!;
      p.mesh.position.copy(pos);
      p.mesh.scale.setScalar(0.4);
      p.mesh.visible = true;
      p.active = true;
      p.life = 0;
      p.maxLife = 0.25;
      p.gravity = 8.0;
      p.scaleDelta = -0.3;

      p.velocity.set(
        norm.x * 3 + (Math.random() - 0.5) * 3,
        norm.y * 3 + Math.random() * 3,
        norm.z * 3 + (Math.random() - 0.5) * 3
      );
      p.rotVelocity.set(0, 0, 0);
    }
  }

  // Ejected brass casing
  public static spawnShellCasing(pos: THREE.Vector3, camRight: THREE.Vector3) {
    const p = this.getFreeParticle();
    if (!p) return;

    p.mesh.material = this.brassMat!;
    p.mesh.position.copy(pos);
    p.mesh.scale.set(0.02, 0.08, 0.02);
    p.mesh.visible = true;
    p.active = true;
    p.life = 0;
    p.maxLife = 0.6;
    p.gravity = 12.0;
    p.scaleDelta = 0;

    p.velocity.set(
      camRight.x * 3.5 + (Math.random() - 0.5) * 0.5,
      2.5 + Math.random() * 0.8,
      camRight.z * 3.5 + (Math.random() - 0.5) * 0.5
    );
    p.rotVelocity.set(Math.random() * 20, Math.random() * 20, 0);
  }

  // Explosive barrel explosion burst. `groundMark = false` skips the scorch
  // decal — used for the RPG's muzzle backblast so firing never stamps the
  // ground at the player's own feet.
  public static spawnExplosion(pos: THREE.Vector3, groundMark: boolean = true) {
    for (let i = 0; i < 35; i++) {
      const p = this.getFreeParticle();
      if (!p) break;

      p.mesh.material = Math.random() > 0.4 ? this.fireMat! : this.smokeMat!;
      p.mesh.position.copy(pos);
      p.mesh.scale.setScalar(Math.random() * 2.5 + 1.0);
      p.mesh.visible = true;
      p.active = true;
      p.life = 0;
      p.maxLife = 0.7 + Math.random() * 0.5;
      p.gravity = -2.0;
      p.scaleDelta = 1.2;

      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 8 + 2;
      p.velocity.set(
        Math.cos(angle) * speed,
        Math.random() * 6 + 2,
        Math.sin(angle) * speed
      );
      p.rotVelocity.set(0, 0, 0);
    }

    // Explosion ground scorch decal (charred blast residue, NOT blood)
    if (groundMark) {
      this.spawnScorchDecal(new THREE.Vector3(pos.x, 0.02, pos.z), 3.5);
    }
  }

  // Drop Pickups (Ammo box, Medkit, Cash)
  public static createPickupMesh(item: PickupItem): THREE.Group {
    const group = new THREE.Group();
    group.position.set(item.position[0], item.position[1] + 0.35, item.position[2]);
    group.name = `pickup_${item.id}`;

    if (item.type === 'MEDKIT') {
      const boxGeo = new THREE.BoxGeometry(0.5, 0.35, 0.35);
      const boxMat = new THREE.MeshStandardMaterial({ color: 0xf4f4f5, roughness: 0.4 });
      const box = new THREE.Mesh(boxGeo, boxMat);
      group.add(box);

      const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.25, 0.36), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
      const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.1, 0.36), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
      group.add(crossV, crossH);
    } else if (item.type === 'AMMO') {
      const canGeo = new THREE.BoxGeometry(0.5, 0.35, 0.25);
      const canMat = new THREE.MeshStandardMaterial({ color: 0x223522, roughness: 0.6 });
      const can = new THREE.Mesh(canGeo, canMat);
      group.add(can);

      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.08, 0.27), new THREE.MeshBasicMaterial({ color: 0xeab308 }));
      group.add(stripe);
    } else {
      const cashGeo = new THREE.BoxGeometry(0.4, 0.15, 0.25);
      const cashMat = new THREE.MeshStandardMaterial({ color: 0xeab308, metalness: 0.8, roughness: 0.2 });
      const cash = new THREE.Mesh(cashGeo, cashMat);
      group.add(cash);
    }

    if (this.scene) {
      this.scene.add(group);
      this.pickupMeshes.set(item.id, group);
    }

    return group;
  }

  public static removePickupMesh(id: string) {
    const mesh = this.pickupMeshes.get(id);
    if (mesh && this.scene) {
      this.scene.remove(mesh);
      this.pickupMeshes.delete(id);
    }
  }

  public static update(delta: number) {
    // Fade screen blood gradually & dynamic dripping
    if (this.screenBloodIntensity > 0) {
      this.screenBloodIntensity = Math.max(0, this.screenBloodIntensity - delta * 0.2);
    }
    for (let i = this.screenSplats.length - 1; i >= 0; i--) {
      const s = this.screenSplats[i];
      s.alpha -= delta * 0.15;
      s.dripLength += delta * s.speed * 12; // dynamic elongated drip streak
      s.y += delta * (s.speed * 1.8); // subtle visceral downward slide on screen glass
      if (s.alpha <= 0) {
        this.screenSplats.splice(i, 1);
      }
    }

    // Update active particles & gibs
    for (const p of this.particles) {
      if (!p.active) continue;

      p.life += delta;
      if (p.life >= p.maxLife) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }

      p.velocity.y -= p.gravity * delta;
      p.mesh.position.addScaledVector(p.velocity, delta);

      // Rotate gibs
      if (p.isGib) {
        p.mesh.rotation.x += p.rotVelocity.x * delta;
        p.mesh.rotation.y += p.rotVelocity.y * delta;
        p.mesh.rotation.z += p.rotVelocity.z * delta;
      }

      // Bounce off ground or splat into micro-blood stains
      if (p.mesh.position.y < 0.05) {
        p.mesh.position.y = 0.05;
        // Dynamic micro blood splatter on asphalt when droplet hits with vertical velocity
        if (!p.isGib && Math.abs(p.velocity.y) > 2.2 && Math.random() < 0.35) {
          ParticleSystem.spawnBloodDecal(new THREE.Vector3(p.mesh.position.x, 0.02, p.mesh.position.z), 0.45 + Math.random() * 0.35);
        }
        p.velocity.y *= -0.22;
        p.velocity.x *= 0.55;
        p.velocity.z *= 0.55;
        p.rotVelocity.multiplyScalar(0.65);
      }

      if (p.scaleDelta !== 0) {
        const s = Math.max(0.01, p.mesh.scale.x + p.scaleDelta * delta);
        p.mesh.scale.set(s, s, s);
      }
    }

    // Update dynamic expanding blood decals with fluid viscosity curve
    for (const d of this.decals) {
      if (!d.mesh.visible) continue;
      d.life += delta;
      if (d.life < 2.4) {
        // Fluid viscous pooling expansion with ease-out cubic curve
        const progress = Math.min(1.0, d.life / 2.0);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const currentScale = THREE.MathUtils.lerp(d.initialScale, d.maxScale, easeOut);
        d.mesh.scale.set(currentScale, currentScale, currentScale);
      } else if (d.life >= d.maxLife) {
        d.mesh.visible = false;
      } else if (d.life > d.maxLife - 3) {
        // Fade out
        const fade = (d.maxLife - d.life) / 3;
        (d.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, fade * 0.85);
      }
    }

    // Animate pickups bobbing & rotating
    const now = performance.now() * 0.003;
    this.pickupMeshes.forEach((mesh) => {
      mesh.rotation.y += delta * 2.0;
      mesh.position.y = 0.4 + Math.sin(now) * 0.1;
    });
  }

  public static clearAll() {
    for (const p of this.particles) {
      p.active = false;
      p.mesh.visible = false;
    }
    for (const d of this.decals) {
      d.mesh.visible = false;
    }
    this.pickupMeshes.forEach((mesh) => {
      if (this.scene) this.scene.remove(mesh);
    });
    this.pickupMeshes.clear();
    this.screenBloodIntensity = 0;
    this.screenSplats = [];
  }
}
