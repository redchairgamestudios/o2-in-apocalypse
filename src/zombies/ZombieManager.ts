import * as THREE from 'three';
import { ZombieInstance, ZombieModelFactory } from '../models/ZombieModel';
import { GltfZombieFactory } from '../models/GltfZombieFactory';
import { ZombieTypeKey, HitResult, PickupItem } from '../types';
import { ZOMBIE_DEFINITIONS } from '../data/zombies';
import { soundFx } from '../audio/SoundEffects';
import { ParticleSystem } from '../effects/ParticleSystem';
import { NavCollision } from '../core/NavCollision';
import { SaveManager } from '../core/SaveManager';
import { GraphicsSettings, getZombieLimits } from '../core/GraphicsSettings';
import { NarrowPathSpawn } from '../models/EnvironmentBuilder';

interface CorpseRecord {
  mesh: THREE.Group;
  settle: number;
  mixer: THREE.AnimationMixer | null;
  bleedTimer: number;
  repoolTimer: number;
  poolSize: number;
  sinkTimer: number;
  sinking: boolean;
  deathTime: number;
}

export class ZombieManager {
  private scene: THREE.Scene;
  public getScene(): THREE.Scene {
    return this.scene;
  }
  public zombies: ZombieInstance[] = [];
  public activeZombieCount: number = 0;
  public bossInstance: ZombieInstance | null = null;
  // Dead bodies stay on the ground bleeding out (capped, oldest sinks away)
  private corpses: CorpseRecord[] = [];
  // Mobile perf: every zombie is a full skinned GLTF rig with its own mixer —
  // hard-cap the concurrent alive count there so hordes can't stack 20+ rigs
  // (the single biggest GPU/CPU cost on mid-range phones).
  private MAX_ALIVE: number;
  private MAX_CORPSES: number;
  public pickups: PickupItem[] = [];

  // Rolling frame counter for far-zombie LOD staggering
  private frame: number = 0;

  // Distance beyond which non-boss zombies are hidden entirely (fog hides them).
  // Tighter on touch devices where vertex/fill cost dominates.
  private farCullDistance: number;

  // Zombies currently using the procedural fallback while the custom GLTF
  // model is still streaming — upgraded in place once the model arrives
  private fallbackAlive = 0;

  // Designated urban spawn points along the street and side alleys
  private spawnPoints: THREE.Vector3[] = [
    new THREE.Vector3(-8, 0, -18),
    new THREE.Vector3(8, 0, -14),
    new THREE.Vector3(-8, 0, -5),
    new THREE.Vector3(8, 0, 8),
    new THREE.Vector3(-9, 0, 22),
    new THREE.Vector3(9, 0, 32),
    new THREE.Vector3(0, 0, 42),
    new THREE.Vector3(-12, 0, 15),
  ];

  // Specific narrow paths / side alleys per mission
  private narrowPathSpawns: NarrowPathSpawn[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    const isTouch =
      'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth <= 1024;
    // Cap scales with the effects quality preset (centralized GraphicsSettings):
    // SMOOTH holds the horde to ~6 concurrent rigs — the single biggest
    // GPU/CPU cost on mid-range phones. Desktop headroom is unchanged.
    const limits = getZombieLimits(GraphicsSettings.get().effectsQuality, isTouch);
    this.MAX_ALIVE = limits.maxAlive;
    this.MAX_CORPSES = limits.maxCorpses;
    this.farCullDistance = isTouch ? 40 : 85;
  }

  /** Live cap change from the graphics settings UI (no scene remount). */
  public setLimits(maxAlive: number, maxCorpses: number) {
    this.MAX_ALIVE = maxAlive;
    this.MAX_CORPSES = maxCorpses;
  }

  public setSpawnPoints(points: THREE.Vector3[]) {
    if (points && points.length > 0) {
      this.spawnPoints = points.map((p) => p.clone());
    }
  }

  public setNarrowPathSpawns(spawns: NarrowPathSpawn[]) {
    if (spawns) {
      this.narrowPathSpawns = spawns.map((s) => ({
        spawn: s.spawn.clone(),
        exitPoint: s.exitPoint.clone(),
        name: s.name,
      }));
    }
  }

  public getHitboxMeshes(): THREE.Object3D[] {
    const meshes: THREE.Object3D[] = [];
    for (const z of this.zombies) {
      if (!z.isDead) {
        meshes.push(...z.hitboxMeshes);
      }
    }
    return meshes;
  }

  /** Swap every alive procedural-fallback zombie to the skinned GLTF rig. */
  private upgradeFallbackZombies() {
    let remaining = 0;
    let upgraded = 0;
    for (const z of this.zombies) {
      if (z.gltfRig || z.staticRig || z.isDead) continue;
      if (ZombieModelFactory.upgradeZombieToGltf(z)) {
        upgraded++;
      } else {
        remaining++;
      }
    }
    this.fallbackAlive = remaining;
    if (upgraded > 0) {
      console.info(`O²: upgraded ${upgraded} fallback zombie(s) to the skinned rig`);
    }
  }

  public spawnZombie(
    type: ZombieTypeKey,
    customPos?: THREE.Vector3,
    forceNarrowPath?: boolean,
    bossOverride?: { isBoss: boolean; name: string; maxHp: number; scale?: number },
    huntPlayer: boolean = false
  ): ZombieInstance | null {
    const baseConfig = ZOMBIE_DEFINITIONS[type] || ZOMBIE_DEFINITIONS['walker'];
    const config = { ...baseConfig };
    if (bossOverride) {
      config.isBoss = true;
      config.name = bossOverride.name;
      config.maxHp = bossOverride.maxHp;
      if (bossOverride.scale) config.scale = bossOverride.scale;
    }

    // Hard cap on concurrent alive rigs. Bosses always get through so mission
    // objectives can't stall; regular spawns are simply dropped (the wave
    // top-up logic will retry on its next tick).
    const aliveCount = this.zombies.filter((z) => !z.isDead).length;
    if (!config.isBoss && aliveCount >= this.MAX_ALIVE) {
      return null;
    }
    const id = `z_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    let spawnPos: THREE.Vector3;
    let isFromNarrow = false;
    let narrowExit: THREE.Vector3 | null = null;

    // Check if narrow path spawn should be selected
    const shouldSpawnNarrow = !bossOverride && (forceNarrowPath ?? (this.narrowPathSpawns.length > 0 && Math.random() < 0.42 && type !== 'colossus'));

    if (customPos) {
      spawnPos = customPos.clone();
    } else if (shouldSpawnNarrow && this.narrowPathSpawns.length > 0) {
      const routeIdx = Math.floor(Math.random() * this.narrowPathSpawns.length);
      const route = this.narrowPathSpawns[routeIdx];
      spawnPos = route.spawn.clone();
      // Slight jitter inside the alley
      spawnPos.x += (Math.random() - 0.5) * 1.5;
      spawnPos.z += (Math.random() - 0.5) * 2.0;
      isFromNarrow = true;
      narrowExit = route.exitPoint.clone();
    } else {
      const idx = Math.floor(Math.random() * this.spawnPoints.length);
      spawnPos = this.spawnPoints[idx].clone();
      // Add slight jitter along the thoroughfare
      spawnPos.x += (Math.random() - 0.5) * 3;
      spawnPos.z += (Math.random() - 0.5) * 4;
    }

    const zombie = ZombieModelFactory.createZombie(type, id, config, isFromNarrow, narrowExit, spawnPos);
    zombie.attackTimer = 1.5; // Grace period on spawn
    zombie.mesh.position.copy(spawnPos);

    // Fallback tracking: spawned without the skinned GLTF rig (model still
    // streaming or failed) — the update loop upgrades them once it arrives
    if (!zombie.gltfRig && !zombie.staticRig) {
      this.fallbackAlive++;
    }

    // Initial orientation: if emerging from narrow path, face toward the alley exit mouth
    if (isFromNarrow && narrowExit) {
      const toExit = new THREE.Vector3().subVectors(narrowExit, spawnPos).normalize();
      zombie.mesh.rotation.y = Math.atan2(toExit.x, toExit.z);
    } else {
      // Face randomly or down the street
      zombie.mesh.rotation.y = (Math.random() - 0.5) * Math.PI;
    }

    this.scene.add(zombie.mesh);
    this.zombies.push(zombie);
    this.activeZombieCount++;

    if (config.isBoss || type === 'colossus') {
      zombie.isBoss = true;
      zombie.bossName = config.name;
      zombie.maxHp = config.maxHp;
      zombie.hp = config.maxHp;
      this.bossInstance = zombie;
      zombie.isAlerted = true; // Boss is active immediately
      zombie.state = 'CHASE';
      soundFx.playBossRoar();
    }

    // Off-screen spawn: immediately hunt the player's current location so the
    // horde converges on the operator instead of idling at the spawn point.
    if (huntPlayer && zombie.state !== 'CHASE') {
      zombie.isAlerted = true;
      zombie.state = 'ALERT';
      zombie.stateTimer = 0.3 + Math.random() * 0.7;
    }

    return zombie;
  }

  /**
   * Pick a spawn position OUT of the player's sight: never within 26m, and
   * preferring points behind or beside the operator's view cone. Falls back
   * to the farthest point when every spawn is close.
   */
  public pickDistantSpawnPoint(playerPos: THREE.Vector3, playerYaw: number): THREE.Vector3 {
    const fwd = new THREE.Vector3(-Math.sin(playerYaw), 0, -Math.cos(playerYaw));
    let best: THREE.Vector3 | null = null;
    let bestScore = -Infinity;

    for (const sp of this.spawnPoints) {
      const d = sp.distanceTo(playerPos);
      if (d < 26) continue; // never materialize right next to the player
      const toSpawn = sp.clone().sub(playerPos).setY(0).normalize();
      const facingDot = fwd.dot(toSpawn); // > 0.25 means inside the view cone
      const score = (facingDot > 0.25 ? 0 : 40) + Math.min(d, 70) / 2;
      if (score > bestScore) {
        bestScore = score;
        best = sp.clone();
      }
    }

    if (!best) {
      for (const sp of this.spawnPoints) {
        if (!best || sp.distanceTo(playerPos) > best.distanceTo(playerPos)) {
          best = sp.clone();
        }
      }
    }
    return best!;
  }

  // Gunshots reverberate through the district, alerting dormant zombies within auditory range with acoustic latency
  public onGunshotFired(playerPosition: THREE.Vector3, soundRadius: number = 28) {
    for (const z of this.zombies) {
      if (z.isDead) continue;
      const dist = z.mesh.position.distanceTo(playerPosition);
      if (dist <= soundRadius && !z.isAlerted) {
        // Acoustic latency: closer zombies hear and react first, distant zombies register seconds later
        const acousticDelay = 0.25 + (dist / soundRadius) * 0.95;
        z.isAlerted = true;
        z.state = 'ALERT';
        z.stateTimer = acousticDelay;

        // Occasional audio growl when registering the gunshot
        if (Math.random() < 0.45 && dist < 24) {
          const pitch = z.type === 'brute' || z.type === 'colossus' ? 0.65 : z.type === 'runner' ? 1.25 : 1.0;
          soundFx.playZombieGrowl(pitch);
        }
      }
    }
  }

  public applyDamage(
    hit: HitResult,
    onKill: (zombie: ZombieInstance, isHeadshot: boolean) => void,
    playerPos?: THREE.Vector3
  ): { isFatal: boolean; zombie: ZombieInstance | null } {
    const zombie = this.zombies.find((z) => z.id === hit.targetId);
    if (!zombie || zombie.isDead) return { isFatal: false, zombie: null };

    // Enforcer body armor absorbs 45% of chest damage
    let finalDamage = hit.damage;
    if (zombie.type === 'enforcer' && hit.zone === 'TORSO') {
      finalDamage = Math.max(1, Math.round(finalDamage * 0.55));
    }

    zombie.hp -= finalDamage;
    zombie.isAlerted = true; // Instantly alerted upon receiving damage
    zombie.state = 'STAGGER';
    zombie.staggerTimer = 0.22;

    const hitPos = hit.point
      ? new THREE.Vector3(hit.point[0], hit.point[1], hit.point[2])
      : zombie.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0));
    const isSpitter = zombie.type === 'spitter';
    const isHeadshot = hit.zone === 'HEAD';
    const isHeavyShot = finalDamage >= 40 || hit.zone === 'WEAKPOINT' || hit.zone === 'BARREL';

    // Armor sparks on enforcer torso hit
    if (zombie.type === 'enforcer' && hit.zone === 'TORSO') {
      ParticleSystem.spawnSparks(hitPos);
    }

    // Dynamic blood splatter on every hit
    ParticleSystem.spawnBlood(
      hitPos,
      new THREE.Vector3(0, 0.4, 0),
      isHeadshot,
      isSpitter,
      isHeavyShot
    );

    // Bullet-hit slowdown ("They slowed down when shot down")
    const slowFactor = isHeavyShot ? 0.32 : 0.52;
    const slowDuration = isHeavyShot ? 1.2 : 0.75;
    zombie.slowTimer = Math.max(zombie.slowTimer || 0, slowDuration);
    zombie.slowMultiplier = Math.min(zombie.slowMultiplier || 1.0, slowFactor);

    // LIMB BREAKS (while still alive): every shot to a limb accumulates trauma
    // on that specific limb — enough of it tears the limb off mid-fight. A
    // severed leg cripples the gait to a stagger; a severed arm ends its reach.
    if (hit.zone === 'LIMB' && hit.limb) {
      zombie.limbDamage = zombie.limbDamage || {};
      const trauma = (zombie.limbDamage[hit.limb] || 0) + finalDamage;
      zombie.limbDamage[hit.limb] = trauma;
      if (!zombie.severedLimbs?.[hit.limb] && trauma >= 70) {
        this.severLimb(zombie, hit.limb, hitPos, isSpitter);
        if (hit.limb === 'LEG_L' || hit.limb === 'LEG_R') {
          zombie.speedMultiplier = Math.min(zombie.speedMultiplier || 1.0, 0.45);
        }
      }
    }

    // Volatile explosive fuel drum strapped to chest (matching image)
    if (hit.zone === 'BARREL' && !zombie.isDead) {
      soundFx.playExplosion();
      ParticleSystem.spawnExplosion(zombie.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0)));
      zombie.hp = 0; // Detonates instantly
      this.damageArea(zombie.mesh.position, 6.8, 390, onKill);
    }

    // Chain alert nearby zombies within 12 meters hearing the impact & pain roar
    for (const other of this.zombies) {
      if (other !== zombie && !other.isDead && !other.isAlerted) {
        const d = other.mesh.position.distanceTo(zombie.mesh.position);
        if (d < 12) {
          other.isAlerted = true;
          other.state = 'ALERT';
          other.stateTimer = 0.25 + Math.random() * 0.6;
        }
      }
    }

    if (zombie.hp <= 0) {
      zombie.isDead = true;
      zombie.hp = 0;
      zombie.state = 'DEAD';
      this.activeZombieCount = Math.max(0, this.activeZombieCount - 1);

      // Bloater toxic chemical explosion on death
      if (zombie.type === 'bloater') {
        soundFx.playExplosion();
        ParticleSystem.spawnExplosion(zombie.mesh.position.clone().add(new THREE.Vector3(0, 0.8, 0)));
        this.damageArea(zombie.mesh.position, 6.5, 260, onKill);
      }

      // Boss death audio and impact shockwave
      if (zombie.isBoss) {
        soundFx.playBossDeath();
        ParticleSystem.spawnExplosion(zombie.mesh.position.clone().add(new THREE.Vector3(0, 1.4, 0)));
      }

      // Decapitation gore effect on fatal headshot
      if (hit.zone === 'HEAD') {
        zombie.isDecapitated = true;
        ZombieModelFactory.applyDecapitation(zombie);
        ParticleSystem.spawnGoreGibs(zombie.mesh.position.clone().add(new THREE.Vector3(0, 1.6, 0)), new THREE.Vector3(0, 1, 0), 8);
        ParticleSystem.spawnBlood(zombie.mesh.position.clone().add(new THREE.Vector3(0, 1.6, 0)), new THREE.Vector3(0, 1, 0), true, zombie.type === 'spitter');
        soundFx.playDismemberment();
      } else if (hit.zone === 'LIMB' && hit.limb) {
        // Fatal limb shot: the struck limb always comes off
        this.severLimb(zombie, hit.limb, hitPos, isSpitter);
      } else if (hit.zone === 'TORSO' && !zombie.isBoss && Math.random() < 0.25) {
        // Torso kills occasionally tear an arm loose from the blunt trauma
        this.severLimb(zombie, Math.random() < 0.5 ? 'ARM_L' : 'ARM_R', hitPos, isSpitter);
      }

      // Heavy gore spill: a large glossy pool spreads UNDER the fallen body
      // plus splatter satellites around it — the kill site stays drenched
      const poolSize = zombie.type === 'colossus' ? 6.0 : zombie.type === 'brute' ? 4.2 : 3.4;
      const bodyPos = zombie.mesh.position;
      const poolLife = 42 + Math.random() * 12; // outlives the corpse bleed window
      ParticleSystem.spawnBloodDecal(new THREE.Vector3(bodyPos.x, 0.02, bodyPos.z), poolSize, poolLife);
      for (let pool = 0; pool < 6; pool++) {
        const angle = Math.random() * Math.PI * 2;
        const spread = 0.5 + Math.random() * 1.7;
        ParticleSystem.spawnBloodDecal(
          new THREE.Vector3(
            bodyPos.x + Math.cos(angle) * spread,
            0.02 + pool * 0.001,
            bodyPos.z + Math.sin(angle) * spread
          ),
          poolSize * (0.3 + Math.random() * 0.42),
          poolLife
        );
      }
      // Directional splatter from impact
      ParticleSystem.spawnBlood(zombie.mesh.position.clone().add(new THREE.Vector3(0, 1.0, 0)), new THREE.Vector3(0, 0.5, 0), hit.zone === 'HEAD', zombie.type === 'spitter');

      // Dynamic Visceral Screen Blood Splatter if killed in close quarters (< 4.2 meters)
      if (playerPos && zombie.mesh.position.distanceTo(playerPos) < 4.2) {
        ParticleSystem.addScreenBlood(0.35, zombie.type === 'spitter' ? 'acid' : 'blood');
      }

      // Reward credits & audio
      soundFx.playCashEarned();

      // Chance to drop Ammo or Medkit
      const dropRoll = Math.random();
      if (dropRoll < 0.28) {
        const pickupType = dropRoll < 0.12 ? 'MEDKIT' : 'AMMO';
        const pickup: PickupItem = {
          id: `p_${Date.now()}_${Math.random()}`,
          type: pickupType,
          value: pickupType === 'MEDKIT' ? 35 : 30,
          position: [zombie.mesh.position.x, 0, zombie.mesh.position.z],
        };
        this.pickups.push(pickup);
        ParticleSystem.createPickupMesh(pickup);
      }

      onKill(zombie, hit.zone === 'HEAD');
      return { isFatal: true, zombie };
    }

    return { isFatal: false, zombie };
  }

  /**
   * Tear a specific limb off a zombie (live or fatal) with a gore burst at
   * the impact point. Returns false when the limb was already gone — callers
   * use that to avoid duplicate effects.
   */
  private severLimb(
    zombie: ZombieInstance,
    limb: 'ARM_L' | 'ARM_R' | 'LEG_L' | 'LEG_R',
    at: THREE.Vector3,
    isSpitter: boolean
  ): boolean {
    if (!ZombieModelFactory.applyDismemberLimb(zombie, limb)) return false;
    zombie.severedLimbs = zombie.severedLimbs || {};
    zombie.severedLimbs[limb] = true;

    const stump = at.clone();
    const gushDir = new THREE.Vector3((Math.random() - 0.5) * 1.6, 0.7, (Math.random() - 0.5) * 1.6).normalize();
    ParticleSystem.spawnGoreGibs(stump, gushDir, 5);
    // shotgun=true gives the heavy burst that also stamps the ground decal below
    ParticleSystem.spawnBlood(stump, gushDir, false, isSpitter, true);
    soundFx.playDismemberment();
    return true;
  }

  public damageArea(center: THREE.Vector3, radius: number, damage: number, onKill: (zombie: ZombieInstance, isHeadshot: boolean) => void) {
    for (const z of this.zombies) {
      if (z.isDead) continue;
      const dist = z.mesh.position.distanceTo(center);
      if (dist <= radius) {
        const falloff = 1 - dist / radius;
        const totalDmg = Math.round(damage * Math.max(0.3, falloff));
        this.applyDamage({ hit: true, zone: 'TORSO', damage: totalDmg, isFatal: false, targetId: z.id }, onKill);
      }
    }
  }

  /**
   * Melee shove: knocks every zombie in range away from the player and
   * staggers them — the anti-crowd escape move. Returns how many were hit.
   */
  public shove(origin: THREE.Vector3, range: number = 2.4): number {
    let shoved = 0;
    for (const z of this.zombies) {
      if (z.isDead) continue;
      const dist = z.mesh.position.distanceTo(origin);
      if (dist > range) continue;

      const dir = z.mesh.position.clone().sub(origin).setY(0);
      if (dir.lengthSq() < 0.001) {
        dir.set(Math.random() - 0.5, 0, Math.random() - 0.5);
      }
      dir.normalize();

      // Knockback: strongest at point-blank; bosses barely budge
      const falloff = 1 - dist / range;
      const knock = z.isBoss ? 0.45 : 1.2 + falloff * 0.7;
      z.mesh.position.addScaledVector(dir, knock);
      z.mesh.position.y = 0;

      // Stun window — they cannot chase or attack while reeling
      z.state = 'STAGGER';
      z.staggerTimer = z.isBoss ? 0.35 : 0.75 + Math.random() * 0.35;
      z.isAlerted = true;
      shoved++;
    }
    return shoved;
  }

  public update(
    delta: number,
    playerPosition: THREE.Vector3,
    onPlayerAttacked: (damage: number, attackerPos: THREE.Vector3) => void,
    playerForward?: THREE.Vector3,
    isFlashlightOn: boolean = false,
    droneTarget?: { isDeployed: boolean; position: THREE.Vector3; onDamageDrone?: (amount: number) => void }
  ) {
    this.frame++;

    // Custom zombie model arrived after some zombies already spawned with the
    // procedural fallback (slow stream / offline start) — swap them over so
    // the roster matches the authored model.
    if (this.fallbackAlive > 0 && GltfZombieFactory.ready) {
      this.upgradeFallbackZombies();
    }

    for (let i = this.zombies.length - 1; i >= 0; i--) {
      const z = this.zombies[i];

      // Death animation settles, then the corpse STAYS on the ground bleeding
      // out (moved to the corpse roster instead of being removed)
      if (z.isDead) {
        ZombieModelFactory.updateZombieAnimation(z, delta, 10);
        if (z.deathTimer > 3.0) {
          this.corpses.push({
            mesh: z.mesh,
            settle: z.deathTimer,
            mixer: z.gltfRig ? z.gltfRig.mixer : null,
            bleedTimer: 0,
            repoolTimer: 0,
            poolSize: z.type === 'colossus' ? 5.5 : z.type === 'brute' ? 4.0 : 3.0,
            sinkTimer: 0,
            sinking: false,
            deathTime: 0,
          });
          this.zombies.splice(i, 1);
          if (this.bossInstance === z) this.bossInstance = null;
        }
        continue;
      }

      const distToPlayer = z.mesh.position.distanceTo(playerPosition);

      // FAR-VISIBILITY CULL: frustumCulled is disabled on skinned meshes
      // (bind-pose bounds are wrong), so distant zombies behind/above the
      // camera would keep rendering. Mobile uses a tighter radius — fill rate
      // and vertex cost dominate there. Beyond the radius they sit inside the
      // fog haze anyway — hide the whole rig and skip all per-frame cosmetics.
      const farCullDist = this.farCullDistance;
      const farCull = !z.isBoss && distToPlayer > farCullDist;
      if (z.mesh.visible === farCull) z.mesh.visible = !farCull;
      if (farCull) continue;

      // FAR-AI LOD: beyond 70% of the cull radius (but still visible), skip
      // full AI/state updates every other frame. These zombies are too far to
      // meaningfully interact with the player. Bosses/colossi never skip AI.
      const farLodDist = farCullDist * 0.8;
      if (distToPlayer > farLodDist && !z.isBoss && z.type !== 'colossus' && (this.frame + i) % 2 !== 0) {
        // Still apply position bounds so they don't drift off-map
        z.mesh.position.x = Math.max(-115, Math.min(115, z.mesh.position.x));
        z.mesh.position.z = Math.max(-145, Math.min(155, z.mesh.position.z));
        continue;
      }

      // Target determination: player or low recon drone (when altitude <= 3.8m)
      let targetPos = playerPosition;
      let distToTarget = distToPlayer;
      let isTargetingDrone = false;

      if (droneTarget?.isDeployed) {
        const dronePos = droneTarget.position;
        const hDistToDrone = new THREE.Vector2(z.mesh.position.x - dronePos.x, z.mesh.position.z - dronePos.z).length();
        const distToDrone = z.mesh.position.distanceTo(dronePos);

        // Drone is flying low (<= 3.8m altitude, down to 1m) and within attack awareness
        if (dronePos.y <= 3.8) {
          if (hDistToDrone < 12.0 || (hDistToDrone < distToPlayer && distToPlayer > 6.0)) {
            targetPos = dronePos;
            distToTarget = distToDrone;
            isTargetingDrone = true;
            z.isAlerted = true;
            if (z.state === 'IDLE' || z.state === 'WANDER') {
              z.state = 'CHASE';
            }
          }
        }
      }

      // Screamer variant: shrieks and alerts entire district
      if (z.type === 'screamer' && z.isAlerted && !z.isDead && !z.hasScreamed) {
        z.hasScreamed = true;
        soundFx.playScreamerScreech();
        ParticleSystem.spawnSparks(z.mesh.position.clone().add(new THREE.Vector3(0, 1.6, 0)));
        for (const other of this.zombies) {
          if (other !== z && !other.isDead && !other.isAlerted) {
            if (other.mesh.position.distanceTo(z.mesh.position) <= 40.0) {
              other.isAlerted = true;
              other.state = 'ALERT';
              other.stateTimer = 0.2 + Math.random() * 0.4;
            }
          }
        }
      }

      // Final Boss Mechanics: Sudden Fast Running ability (Frenzy Charge)
      if (z.isBoss) {
        if (!this.bossInstance) this.bossInstance = z;

        if (!z.isFrenzied) {
          z.frenzyCooldownTimer = (z.frenzyCooldownTimer || 7.0) - delta;
          if (z.frenzyCooldownTimer <= 0 && distToTarget > 4.0 && distToTarget < 48.0) {
            z.isFrenzied = true;
            z.frenzyTimer = 3.6;
            z.frenzyCooldownTimer = 8.5 + Math.random() * 4.0;
            soundFx.playFrenzyRoar();
            ParticleSystem.spawnSparks(z.mesh.position.clone().add(new THREE.Vector3(0, 0.8, 0)));
          }
        } else {
          z.frenzyTimer = (z.frenzyTimer || 3.6) - delta;
          if (Math.random() < 0.35) {
            ParticleSystem.spawnSparks(z.mesh.position.clone().add(new THREE.Vector3(0, 0.2, 0)));
          }
          if (z.frenzyTimer <= 0 || distToTarget < 2.0) {
            z.isFrenzied = false;
            z.exhaustionTimer = 1.2;
          }
        }

        if (z.exhaustionTimer && z.exhaustionTimer > 0) {
          z.exhaustionTimer -= delta;
        }
      }

      // Dynamic Wounded Zombie Blood Dripping Trail
      if (z.hp < z.config.maxHp) {
        z.bleedTimer = (z.bleedTimer || 0) - delta;
        const bleedInterval = z.hp < z.config.maxHp * 0.4 ? 0.35 : 0.75;
        if (z.bleedTimer <= 0) {
          z.bleedTimer = bleedInterval + Math.random() * 0.25;
          const dripPos = z.mesh.position.clone().add(
            new THREE.Vector3((Math.random() - 0.5) * 0.35, 0.8, (Math.random() - 0.5) * 0.35)
          );
          ParticleSystem.spawnBleedDrip(dripPos);
        }
      }

      // Groan audio (only if alerted or player is close)
      z.groanTimer -= delta;
      if (z.groanTimer <= 0 && distToPlayer < 22 && (z.isAlerted || distToPlayer < 12)) {
        const pitch = z.type === 'brute' || z.type === 'colossus' ? 0.6 : z.type === 'runner' ? 1.3 : 1.0;
        soundFx.playZombieGrowl(pitch);
        z.groanTimer = Math.random() * 5 + 3;
      }

      // 1. ATTRACTION & PROXIMITY DETECTION
      // Zombies only attract when player is near to them or visible in front
      if (!z.isAlerted) {
        let shouldAlert = false;

        // Immediate proximity scent / heavy footsteps (< 7 meters)
        if (distToPlayer <= 7.0) {
          shouldAlert = true;
        }
        // Within detection radius: check field of view
        else if (distToPlayer <= z.detectionRadius) {
          const zFwd = new THREE.Vector3(Math.sin(z.mesh.rotation.y), 0, Math.cos(z.mesh.rotation.y));
          const toPlayer = new THREE.Vector3().subVectors(playerPosition, z.mesh.position).normalize();
          const dot = zFwd.dot(toPlayer);

          // Facing player (approx 200 deg vision cone)
          if (dot > -0.2) {
            shouldAlert = true;
          } else if (distToPlayer <= z.detectionRadius * 0.45) {
            // Close hearing behind back
            shouldAlert = true;
          }
        }

        // High-powered tactical flashlight beam detection (sweeping high-lumen beam illuminates and alerts zombies up to 42m)
        if (!shouldAlert && isFlashlightOn && playerForward && distToPlayer <= 42.0) {
          const pToZ = new THREE.Vector3().subVectors(z.mesh.position, playerPosition).normalize();
          if (playerForward.dot(pToZ) > 0.82) {
            shouldAlert = true;
          }
        }

        if (shouldAlert) {
          z.isAlerted = true;
          z.state = 'ALERT';
          z.stateTimer = z.alertReactionTimer; // Staggered reaction time (not all react at same frame)

          if (Math.random() < 0.5 && distToPlayer < 24) {
            const pitch = z.type === 'brute' || z.type === 'colossus' ? 0.65 : z.type === 'runner' ? 1.25 : 1.0;
            soundFx.playZombieGrowl(pitch);
          }
        }
      }

      // Attack cooldown timer
      if (z.attackTimer > 0) {
        z.attackTimer -= delta;
      }

      // 2. UNALERTED BEHAVIOR: IDLE & AMBIENT WANDERING OR NARROW PATH EMERGENCE
      if (!z.isAlerted) {
        // Emerging out of narrow path
        if (z.isFromNarrowPath && !z.hasExitedNarrowPath && z.narrowPathExit) {
          const toExit = new THREE.Vector3().subVectors(z.narrowPathExit, z.mesh.position);
          toExit.y = 0;
          const distToExit = toExit.length();

          if (distToExit > 1.2) {
            toExit.normalize();
            const exitAngle = Math.atan2(toExit.x, toExit.z);
            z.mesh.rotation.y = THREE.MathUtils.lerp(z.mesh.rotation.y, exitAngle, delta * 4);
            z.state = 'WANDER';

            const shambleSpeed = z.speed * z.speedMultiplier * 0.42;
            const fwd = new THREE.Vector3(Math.sin(z.mesh.rotation.y), 0, Math.cos(z.mesh.rotation.y));
            z.mesh.position.addScaledVector(fwd, shambleSpeed * delta);
          } else {
            z.hasExitedNarrowPath = true;
            z.state = 'IDLE';
            z.wanderTimer = Math.random() * 4 + 2;
          }
        } else {
          // Standard idle / slow shuffle around spawn origin
          z.wanderTimer -= delta;
          if (z.wanderTimer <= 0) {
            if (z.state === 'IDLE') {
              z.state = 'WANDER';
              z.wanderTimer = Math.random() * 4 + 3;
              const ang = Math.random() * Math.PI * 2;
              const rad = Math.random() * 3.5 + 1.5;
              z.wanderTarget = new THREE.Vector3(
                z.spawnOrigin.x + Math.sin(ang) * rad,
                0,
                z.spawnOrigin.z + Math.cos(ang) * rad
              );
            } else {
              z.state = 'IDLE';
              z.wanderTimer = Math.random() * 4 + 2;
              z.wanderTarget = null;
            }
          }

          if (z.state === 'WANDER' && z.wanderTarget) {
            const toTgt = new THREE.Vector3().subVectors(z.wanderTarget, z.mesh.position);
            toTgt.y = 0;
            if (toTgt.length() > 0.8) {
              toTgt.normalize();
              const targetAngle = Math.atan2(toTgt.x, toTgt.z);
              z.mesh.rotation.y = THREE.MathUtils.lerp(z.mesh.rotation.y, targetAngle, delta * 3);

              const wanderSpeed = z.speed * z.speedMultiplier * 0.35;
              const fwd = new THREE.Vector3(Math.sin(z.mesh.rotation.y), 0, Math.cos(z.mesh.rotation.y));
              z.mesh.position.addScaledVector(fwd, wanderSpeed * delta);
            } else {
              z.state = 'IDLE';
              z.wanderTimer = Math.random() * 3 + 2;
              z.wanderTarget = null;
            }
          }
        }
      }
      // 3. ALERTED BEHAVIOR: ALERT REACTION, CHASE & ATTACK
      else {
        // Direct Drone Attack Check (when drone is within striking distance)
        if (isTargetingDrone && droneTarget?.isDeployed) {
          const dronePos = droneTarget.position;
          const hDist = new THREE.Vector2(z.mesh.position.x - dronePos.x, z.mesh.position.z - dronePos.z).length();
          if (hDist < 2.3 && dronePos.y <= 2.8) {
            z.state = 'ATTACK';
            const dx = dronePos.x - z.mesh.position.x;
            const dz = dronePos.z - z.mesh.position.z;
            z.mesh.rotation.y = THREE.MathUtils.lerp(z.mesh.rotation.y, Math.atan2(dx, dz), delta * 8);

            if (z.attackTimer <= 0) {
              z.attackTimer = z.config.attackCooldown;
              soundFx.playZombieAttack();
              droneTarget.onDamageDrone?.(z.config.damage);
              ParticleSystem.spawnSparks(dronePos.clone());
            }
            ZombieModelFactory.updateZombieAnimation(z, delta, distToTarget);
            continue;
          }
        }

        // Reaction delay before rushing
        if (z.state === 'ALERT') {
          const dx = targetPos.x - z.mesh.position.x;
          const dz = targetPos.z - z.mesh.position.z;
          const targetAngle = Math.atan2(dx, dz);
          z.mesh.rotation.y = THREE.MathUtils.lerp(z.mesh.rotation.y, targetAngle, delta * 6);

          z.stateTimer -= delta;
          if (z.stateTimer <= 0) {
            z.state = 'CHASE';
          }
        } else if (z.state === 'STAGGER') {
          z.staggerTimer -= delta;
          if (z.staggerTimer <= 0) {
            z.state = 'CHASE';
          }
        } else if (z.state === 'ATTACK' || z.state === 'CHASE') {
          if (!isTargetingDrone && distToPlayer <= z.config.attackRange) {
            // ATTACK PLAYER
            z.state = 'ATTACK';
            const dx = playerPosition.x - z.mesh.position.x;
            const dz = playerPosition.z - z.mesh.position.z;
            z.mesh.rotation.y = THREE.MathUtils.lerp(z.mesh.rotation.y, Math.atan2(dx, dz), delta * 8);

            // PREVENT FAST ZOMBIES GETTING STUCK TO PLAYER
            z.strafeTimer -= delta;
            if (z.strafeTimer <= 0) {
              z.strafeTimer = 1.0 + Math.random() * 1.5;
              z.strafeDir = Math.random() < 0.5 ? -1 : 1;
            }

            const toPlayerNorm = new THREE.Vector3(dx, 0, dz).normalize();
            const rightVec = new THREE.Vector3(-toPlayerNorm.z, 0, toPlayerNorm.x);

            // Push away immediately if overlapping player (< 1.1m) so fast zombies never get glued/stuck to player
            if (distToPlayer < 1.1 && distToPlayer > 0.01) {
              const pushAwaySpeed = z.type === 'runner' ? 3.8 : 2.2;
              z.mesh.position.addScaledVector(toPlayerNorm, -pushAwaySpeed * delta);
            } else if (distToPlayer < 1.35) {
              const backSpeed = z.type === 'runner' ? 2.2 : 1.3;
              z.mesh.position.addScaledVector(toPlayerNorm, -backSpeed * delta);
            }

            // Circle around player laterally so they do not jam into a single sticky cluster
            const strafeSpeed = (z.type === 'runner' ? 2.4 : 1.2) * z.strafeDir;
            z.mesh.position.addScaledVector(rightVec, strafeSpeed * delta);

            if (z.attackTimer <= 0) {
              z.attackTimer = z.config.attackCooldown;
              soundFx.playZombieAttack();
              // Blood/gore effect of zombie is placed on ground/floor, not on screen
              const impactFloor = z.mesh.position.clone();
              impactFloor.y = 0.02;
              ParticleSystem.spawnBloodDecal(impactFloor, z.type === 'colossus' ? 2.5 : 1.4);
              onPlayerAttacked(z.config.damage, z.mesh.position);

              // Lunge recovery: the zombie reels after striking, giving the
              // player a beat to shove or back away instead of being blendered
              z.state = 'STAGGER';
              z.staggerTimer = z.isBoss ? 0.3 : 0.55;
            }
          } else {
            // CHASE
            z.state = 'CHASE';

            // Bleeding drops left on ground by wounded zombies
            if (z.hp < z.config.maxHp * 0.45 && Math.random() < 0.08) {
              ParticleSystem.spawnBleedDrip(z.mesh.position.clone().add(new THREE.Vector3(0, 0.8, 0)));
            }

            // Path navigation: if inside a narrow path, navigate toward the exit point to reach the street
            let navTarget = targetPos;
            if (z.isFromNarrowPath && !z.hasExitedNarrowPath && z.narrowPathExit) {
              const toExit = new THREE.Vector3().subVectors(z.narrowPathExit, z.mesh.position);
              toExit.y = 0;
              if (toExit.length() > 1.4) {
                navTarget = z.narrowPathExit;
              } else {
                z.hasExitedNarrowPath = true;
              }
            }

            // Face destination smoothly
            const dx = navTarget.x - z.mesh.position.x;
            const dz = navTarget.z - z.mesh.position.z;
            const targetAngle = Math.atan2(dx, dz);
            z.mesh.rotation.y = THREE.MathUtils.lerp(z.mesh.rotation.y, targetAngle, delta * 7);

            // FLOCKING & LATERAL SEPARATION ("not all of them should come together to the player")
            // Apply soft repulsion between pursuing zombies so they fan out across sidewalks & alleys
            let sepX = 0;
            let sepZ = 0;
            for (const other of this.zombies) {
              if (other === z || other.isDead) continue;
              const dist = z.mesh.position.distanceTo(other.mesh.position);
              if (dist < 1.8 && dist > 0.05) {
                const push = (1.8 - dist) / 1.8;
                sepX += ((z.mesh.position.x - other.mesh.position.x) / dist) * push;
                sepZ += ((z.mesh.position.z - other.mesh.position.z) / dist) * push;
              }
            }

            // Boss Berserk / Frenzy Phase check
            let currentSpeed = z.speed * z.speedMultiplier;
            if (z.isFrenzied) {
              currentSpeed *= 2.75; // Sudden fast running ability!
            } else if (z.exhaustionTimer && z.exhaustionTimer > 0) {
              currentSpeed *= 0.55; // Post-sprint recovery
            } else if (z.type === 'colossus' && z.hp < z.maxHp * 0.5) {
              currentSpeed *= 1.4; // 40% faster in rage mode!
            }

            // Apply bullet-hit slowdown ("They slowed down when shot down")
            if (z.slowTimer > 0) {
              currentSpeed *= z.slowMultiplier;
            }

            // Close-range falloff: sprinting away actually opens distance
            if (distToPlayer < 6.0) {
              currentSpeed *= 0.85;
            }

            // Forward movement combined with lateral separation
            const forward = new THREE.Vector3(Math.sin(z.mesh.rotation.y), 0, Math.cos(z.mesh.rotation.y));
            const moveVec = forward.multiplyScalar(currentSpeed);
            moveVec.x += sepX * 1.5;
            moveVec.z += sepZ * 1.5;

            z.mesh.position.addScaledVector(moveVec, delta);

            // Body block: zombies never overlap the player's body — they stop
            // at melee reach instead of walking through/into the camera
            const distAfter = z.mesh.position.distanceTo(playerPosition);
            if (distAfter < 0.65 && distAfter > 0.001) {
              const pushOut = z.mesh.position.clone().sub(playerPosition).setY(0).normalize().multiplyScalar(0.65);
              z.mesh.position.copy(playerPosition).add(pushOut);
              z.mesh.position.y = 0;
            }

            // Keep in bounds across expanded map
            z.mesh.position.x = Math.max(-115, Math.min(115, z.mesh.position.x));
            z.mesh.position.z = Math.max(-145, Math.min(155, z.mesh.position.z));
          }
        }
      }

      // Building collision for every movement mode (wander / alleys / chase):
      // zombies slide along walls, never phase through them
      NavCollision.resolve(z.mesh.position, z.isBoss ? 0.85 : 0.45, z.isBoss ? 3.2 : 1.8);

      // FAR-ZOMBIE LOD: beyond 40m, animation updates are staggered across
      // frames (movement already happened above; the animation clock is
      // compensated with a multiplied delta on update frames so pace stays
      // correct). Skinning cost still applies on rendered frames, but mixer
      // evaluation — the CPU side — drops sharply.
      const farLod = distToPlayer > 40 && !z.isBoss;
      const lodStride = distToPlayer > 60 ? 3 : 2;
      if (farLod && (this.frame + i) % lodStride !== 0) continue;

      // Update procedural animation based on state
      ZombieModelFactory.updateZombieAnimation(z, farLod ? delta * lodStride : delta, distToTarget);
    }

    this.updateCorpses(delta, playerPosition);
  }

  /**
   * Persistent corpses: bodies stay on the ground bleeding out for ~10 seconds,
   * then fade out when out of view or when the roster overflows.
   * Keeps the battlefield covered in bodies without unbounded memory/render cost.
   */
  private updateCorpses(delta: number, playerPosition: THREE.Vector3) {
    const CORPSE_LIFETIME = 10.0; // seconds before fade starts
    const FADE_DURATION = 3.0;    // seconds to fade out
    const CULL_DISTANCE = 60.0;   // distance at which corpses fade if past lifetime
    const MAX_CORPSES = this.MAX_CORPSES;

    for (let i = this.corpses.length - 1; i >= 0; i--) {
      const c = this.corpses[i];

      // Track time since death
      c.deathTime += delta;

      // Overflow: oldest corpses sink away immediately
      if (this.corpses.length > MAX_CORPSES) {
        if (!this.corpses[0].sinking) {
          this.corpses[0].sinking = true;
        }
      }

      if (c.sinking) {
        c.sinkTimer += delta;
        c.mesh.position.y -= delta * 0.45;
        if (c.sinkTimer > 3.2) {
          this.scene.remove(c.mesh);
          this.corpses.splice(i, 1);
        }
        continue;
      }

      // Let the death clip finish playing, then freeze the pose (zero cost)
      if (c.mixer && c.settle < 5.0) {
        c.mixer.update(delta);
        c.settle += delta;
      }

      // Freshly dead bodies keep leaking — the pool beneath them grows
      c.bleedTimer -= delta;
      if (c.bleedTimer <= 0 && c.settle < 9.0) {
        c.bleedTimer = 0.55 + Math.random() * 0.5;
        const dripPos = c.mesh.position.clone().add(
          new THREE.Vector3((Math.random() - 0.5) * 1.3, 0.1, (Math.random() - 0.5) * 1.3)
        );
        ParticleSystem.spawnBleedDrip(dripPos);
      }

      // Long-lived pool: refresh the blood beneath the corpse so the stain
      // stays fresh around the body instead of fading out with the decals.
      c.repoolTimer -= delta;
      if (c.repoolTimer <= 0) {
        c.repoolTimer = 4.5 + Math.random() * 2.0;
        const poolPos = c.mesh.position.clone().add(
          new THREE.Vector3((Math.random() - 0.5) * 2.2, 0.02, (Math.random() - 0.5) * 2.2)
        );
        ParticleSystem.spawnBloodDecal(poolPos, c.poolSize * (0.3 + Math.random() * 0.25), 25);
      }

      // Time-based corpse removal: after 10 seconds, start fading if far from player
      if (c.deathTime > CORPSE_LIFETIME) {
        const distToPlayer = c.mesh.position.distanceTo(playerPosition);
        
        // If far from player, start sinking/fading
        if (distToPlayer > CULL_DISTANCE) {
          c.sinking = true;
          c.sinkTimer = 0;
        }
        // If very old (13+ seconds), force remove regardless of distance
        else if (c.deathTime > CORPSE_LIFETIME + FADE_DURATION) {
          c.sinking = true;
          c.sinkTimer = 0;
        }
      }
    }
  }

  public checkPickups(playerPos: THREE.Vector3, onPickup: (item: PickupItem) => void) {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      const dist = new THREE.Vector3(p.position[0], p.position[1], p.position[2]).distanceTo(playerPos);
      if (dist < 2.0) {
        ParticleSystem.removePickupMesh(p.id);
        this.pickups.splice(i, 1);
        onPickup(p);
      }
    }
  }

  public clearAll() {
    for (const z of this.zombies) {
      this.scene.remove(z.mesh);
    }
    this.zombies = [];
    this.activeZombieCount = 0;
    this.bossInstance = null;
    for (const c of this.corpses) {
      this.scene.remove(c.mesh);
    }
    this.corpses = [];
    for (const p of this.pickups) {
      ParticleSystem.removePickupMesh(p.id);
    }
    this.pickups = [];
  }
}

