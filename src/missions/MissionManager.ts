import * as THREE from 'three';
import { MissionConfig, ObjectiveStep, GameStats, ZombieTypeKey } from '../types';
import { CAMPAIGN_MISSIONS } from '../data/missions';
import { ZombieManager } from '../zombies/ZombieManager';
import { MissionEntityManager } from '../tactical/MissionEntityManager';
import { soundFx } from '../audio/SoundEffects';
import { SaveManager } from '../core/SaveManager';
import { NavCollision } from '../core/NavCollision';

interface QueuedSpawn {
  type: ZombieTypeKey;
  delayTimer: number;
  forceNarrowPath: boolean;
  bossOverride?: { isBoss: boolean; name: string; maxHp: number; scale?: number };
  customPos?: THREE.Vector3;
}

export const MISSION_BOSS_DEFINITIONS: Record<number, { type: ZombieTypeKey; name: string; maxHp: number; scale: number }> = {
  1: { type: 'brute', name: 'GOLIATH DREAD BRUTE', maxHp: 950, scale: 1.8 },
  2: { type: 'stalker', name: 'ELECTRO-STALKER OVERSEER', maxHp: 1250, scale: 1.85 },
  3: { type: 'bloater', name: 'DEPOT FLESH-GORGER', maxHp: 1600, scale: 1.9 },
  4: { type: 'enforcer', name: 'COMMANDER GRAVES', maxHp: 2000, scale: 2.0 },
  5: { type: 'colossus', name: 'THE ABOMINATION', maxHp: 2400, scale: 2.1 },
  6: { type: 'bloater', name: 'PLAGUE TOXIC TITAN', maxHp: 2800, scale: 2.1 },
  7: { type: 'enforcer', name: 'CARNIFEX JUGGERNAUT', maxHp: 3200, scale: 2.2 },
  8: { type: 'brute', name: 'SIEGE DREADNAUGHT', maxHp: 3600, scale: 2.2 },
  9: { type: 'stalker', name: 'NIGHTMARE APEX', maxHp: 4000, scale: 2.3 },
  10: { type: 'colossus', name: 'THE SUPREME COLOSSUS', maxHp: 5000, scale: 2.5 },
};

export class MissionManager {
  private zombieManager: ZombieManager;
  public currentMission: MissionConfig = CAMPAIGN_MISSIONS[0];
  public currentObjectiveIndex: number = 0;
  public currentWaveIndex: number = 0;
  public waveTimer: number = 0;
  public surviveTimer: number = 0;
  public isMissionActive: boolean = false;
  public isMissionComplete: boolean = false;
  public isMissionFailed: boolean = false;

  private spawnQueue: QueuedSpawn[] = [];
  public onVictoryCallback: ((stats: GameStats) => void) | null = null;

  // Kill-count safety valve: cooldown between top-up packs and the no-progress
  // watchdog that rescues missions when the only survivors are unreachable
  private killTopUpCooldown: number = 0;
  private timeSinceLastKill: number = 0;
  private startPlayerPos: THREE.Vector3 | null = null;
  private startPlayerYaw: number = Math.PI;

  public stats: GameStats = {
    kills: 0,
    headshots: 0,
    shotsFired: 0,
    shotsHit: 0,
    damageTaken: 0,
    creditsEarned: 0,
    missionTime: 0,
  };

  constructor(zombieManager: ZombieManager) {
    this.zombieManager = zombieManager;
  }

  public interactRequested: boolean = false;

  /** Nearest beacon target for the active objective (HUD distance + world marker). */
  public getObjectiveAnchor(playerPos: THREE.Vector3): THREE.Vector3 | null {
    const obj = this.getCurrentObjective();
    if (!obj) return null;
    if (obj.type === 'collect_samples') {
      return MissionEntityManager.getNearestTarget(playerPos, 'sample');
    }
    if (obj.type === 'rescue_survivors') {
      return MissionEntityManager.getNearestTarget(playerPos, 'survivor');
    }
    if (obj.targetPosition) {
      return new THREE.Vector3(obj.targetPosition[0], obj.targetPosition[1], obj.targetPosition[2]);
    }
    return null;
  }

  public startMission(missionId: number, playerSpawn?: THREE.Vector3, playerYaw: number = Math.PI) {
    const mission = CAMPAIGN_MISSIONS.find((m) => m.id === missionId) || CAMPAIGN_MISSIONS[0];
    this.currentMission = JSON.parse(JSON.stringify(mission)); // clone
    this.currentObjectiveIndex = 0;
    this.currentWaveIndex = 0;
    this.waveTimer = 2.5; // Initial breathing room before first wave triggers
    this.surviveTimer = 0;
    this.isMissionActive = true;
    this.isMissionComplete = false;
    this.isMissionFailed = false;
    this.spawnQueue = [];
    this.killTopUpCooldown = 6.0;
    this.timeSinceLastKill = 0;
    this.startPlayerPos = playerSpawn ? playerSpawn.clone() : null;
    this.startPlayerYaw = playerYaw;

    this.stats = {
      kills: 0,
      headshots: 0,
      shotsFired: 0,
      shotsHit: 0,
      damageTaken: 0,
      creditsEarned: 0,
      missionTime: 0,
    };

    this.zombieManager.clearAll();
    MissionEntityManager.clearAll();

    // Mission 11: stage survivors & sample cases at validated open spots
    if (missionId === 11) {
      MissionEntityManager.init(this.zombieManager.getScene(), {
        onSurvivorRescued: () => this.progressCountObjective('rescue_survivors'),
        onSampleCollected: () => this.progressCountObjective('collect_samples'),
      });
      const spots: Array<[number, number]> = [
        [-38, -46], [34, -52], [-40, 42], [36, 50],
      ];
      spots.forEach(([x, z], i) => {
        MissionEntityManager.spawnSurvivor(`survivor_${i}`, MissionEntityManager.findOpenSpot(x, z));
      });
      const sampleSpots: Array<[number, number]> = [
        [0, -84], [-52, 12], [48, 8],
      ];
      sampleSpots.forEach(([x, z], i) => {
        MissionEntityManager.spawnSample(`sample_${i}`, MissionEntityManager.findOpenSpot(x, z));
      });
    }

    // Spawn dormant ambient sentries far from the operator's sight
    this.spawnInitialSentries(missionId, this.startPlayerPos, this.startPlayerYaw);

    // Mark the first objective's trigger with the physical task console
    this.placeObjectivePointer();

    // Check if initial objective has a survival timer
    const curObj = this.getCurrentObjective();
    if (curObj && curObj.type === 'survive_time' && curObj.timerSeconds) {
      this.surviveTimer = curObj.timerSeconds;
    }
  }

  private spawnInitialSentries(missionId: number, playerSpawn?: THREE.Vector3 | null, playerYaw: number = Math.PI) {
    // Street sentries in dormant idle/wander mode — always materialize out of
    // the operator's sight so nothing pops into view.
    const away = (fallback?: THREE.Vector3) =>
      playerSpawn
        ? this.zombieManager.pickDistantSpawnPoint(playerSpawn, playerYaw)
        : fallback;

    this.zombieManager.spawnZombie('walker', away(), false);
    this.zombieManager.spawnZombie('walker', away(), false);
    // Alley / narrow path sentries
    this.zombieManager.spawnZombie('walker', away(), true);
    this.zombieManager.spawnZombie('walker', away(), true);

    if (missionId >= 2) {
      this.zombieManager.spawnZombie('runner', away(), true);
    }
    if (missionId >= 3) {
      this.zombieManager.spawnZombie('brute', away(), false);
    }
  }

  public getCurrentObjective(): ObjectiveStep | null {
    if (!this.currentMission || this.currentObjectiveIndex >= this.currentMission.objectives.length) {
      return null;
    }
    return this.currentMission.objectives[this.currentObjectiveIndex];
  }

  public getDistanceToCurrentObjective(playerPos: THREE.Vector3): number | null {
    const obj = this.getCurrentObjective();
    if (!obj || !obj.targetPosition) return null;
    const target = new THREE.Vector3(obj.targetPosition[0], obj.targetPosition[1], obj.targetPosition[2]);
    return Math.round(playerPos.distanceTo(target));
  }

  public update(delta: number, playerPos: THREE.Vector3, playerYaw: number, onVictory: (stats: GameStats) => void) {
    this.onVictoryCallback = onVictory;

    if (!this.isMissionActive) return;
    if (this.isMissionComplete) {
      if (this.onVictoryCallback) {
        this.onVictoryCallback(this.stats);
      }
      return;
    }
    if (this.isMissionFailed) return;

    this.stats.missionTime += delta;

    // Process staggered spawn queue — every hostile materializes OUT of the
    // operator's sight and immediately hunts the player's current location.
    for (let i = this.spawnQueue.length - 1; i >= 0; i--) {
      this.spawnQueue[i].delayTimer -= delta;
      if (this.spawnQueue[i].delayTimer <= 0) {
        const item = this.spawnQueue[i];
        const spawnPos = item.customPos || this.zombieManager.pickDistantSpawnPoint(playerPos, playerYaw);
        this.zombieManager.spawnZombie(item.type, spawnPos, item.forceNarrowPath, item.bossOverride, true);
        this.spawnQueue.splice(i, 1);
      }
    }

    // Handle Wave Spawner (staggered enqueueing so zombies do NOT all spawn together)
    if (this.currentMission.waves && this.currentWaveIndex < this.currentMission.waves.length) {
      this.waveTimer -= delta;
      if (this.waveTimer <= 0) {
        const wave = this.currentMission.waves[this.currentWaveIndex];
        const isFinalWave = this.currentWaveIndex === this.currentMission.waves.length - 1;
        
        let cumulativeDelay = 0;
        wave.enemies.forEach((enemyGroup) => {
          for (let i = 0; i < enemyGroup.count; i++) {
            // Distribute 40-50% to narrow paths (except bosses)
            const isNarrow = (i % 2 === 1) && enemyGroup.type !== 'colossus';
            // Stagger each spawn with 0.8s - 1.4s spacing
            cumulativeDelay += 0.85 + Math.random() * 0.45;
            this.spawnQueue.push({
              type: enemyGroup.type,
              delayTimer: cumulativeDelay,
              forceNarrowPath: isNarrow,
            });
          }
        });

        // INJECT FINAL BOSS ON EVERY MISSION (Heavy health, sudden fast running ability)
        if (isFinalWave) {
          const bossDef = MISSION_BOSS_DEFINITIONS[this.currentMission.id] || {
            type: 'colossus' as ZombieTypeKey,
            name: 'APEX CORRUPTOR',
            maxHp: 1200 + this.currentMission.id * 350,
            scale: 2.0,
          };
          this.spawnQueue.push({
            type: bossDef.type,
            delayTimer: cumulativeDelay + 1.2,
            forceNarrowPath: false,
            bossOverride: {
              isBoss: true,
              name: bossDef.name,
              maxHp: bossDef.maxHp,
              scale: bossDef.scale,
            },
          });
        }

        this.currentWaveIndex++;
        this.waveTimer = (wave.spawnDelay || 14.0) + cumulativeDelay;
      }
    }

    // Mission 4: Barricade defense check - if all waves spawned and all zombies eliminated, win!
    if (this.currentMission.id === 4 && this.currentWaveIndex >= (this.currentMission.waves?.length || 0)) {
      const activeEnemies = this.zombieManager.zombies.filter((z) => !z.isDead).length;
      if (activeEnemies === 0 && this.spawnQueue.length === 0) {
        this.completeMission(onVictory);
        return;
      }
    }

    // Kill-count safety valve: a kill objective can starve when the player
    // spends kills before the objective activates (e.g. clearing the waves
    // while the generator objective is still active) or when the only live
    // stragglers are wedged somewhere unreachable. Once every wave has been
    // enqueued and the district has run dry, funnel fresh hostiles toward
    // the operator so the mission can always finish.
    const killObj = this.getCurrentObjective();
    if (killObj && killObj.type === 'kill_count' && killObj.targetCount) {
      this.timeSinceLastKill += delta;
      const wavesExhausted = this.currentWaveIndex >= (this.currentMission.waves?.length || 0);
      if (wavesExhausted && this.spawnQueue.length === 0) {
        this.killTopUpCooldown -= delta;
        const remaining = killObj.targetCount - (killObj.currentCount || 0);
        const aliveCount = this.zombieManager.zombies.filter((z) => !z.isDead).length;
        const shortOnTargets = remaining > aliveCount;
        const stalledOnStragglers = aliveCount > 0 && remaining > 0 && this.timeSinceLastKill > 25;
        if ((shortOnTargets || stalledOnStragglers) && this.killTopUpCooldown <= 0) {
          const packSize = Math.min(3, Math.max(1, shortOnTargets ? remaining - aliveCount : 2));
          this.spawnTopUpPack(playerPos, packSize);
          this.killTopUpCooldown = 4.0;
        }
      }
    } else {
      this.timeSinceLastKill = 0;
    }

    // Handle Active Objective
    const obj = this.getCurrentObjective();
    if (!obj) {
      this.completeMission(onVictory);
      return;
    }

    if (obj.type === 'reach_zone' && obj.targetPosition) {
      if (obj.timerSeconds) {
        this.surviveTimer -= delta;
        if (this.surviveTimer <= 0) {
          this.surviveTimer = 0;
          this.isMissionFailed = true;
          soundFx.playPlayerDeath();
          return;
        }
      }
      const target = new THREE.Vector3(obj.targetPosition[0], obj.targetPosition[1], obj.targetPosition[2]);
      const dist = playerPos.distanceTo(target);
      if (dist <= (obj.targetRadius || 4.5)) {
        this.advanceObjective(onVictory);
      }
    } else if (obj.type === 'interact_object' && obj.targetPosition) {
      const target = new THREE.Vector3(obj.targetPosition[0], obj.targetPosition[1], obj.targetPosition[2]);
      const dist = playerPos.distanceTo(target);
      // Auto-trigger if standing directly at the generator console
      if (dist <= 2.4) {
        soundFx.playPickup();
        this.advanceObjective(onVictory);
      }
    } else if (obj.type === 'survive_time') {
      this.surviveTimer -= delta;
      if (this.surviveTimer <= 0) {
        this.advanceObjective(onVictory);
      }
    }

    // Rescue & sample entities: animate beacons, handle proximity + [E] rescue
    MissionEntityManager.update(delta, playerPos, this.interactRequested);
    this.interactRequested = false;
    // Animate the objective task pointer (blinking tip, spinning chevron)
    MissionEntityManager.updateTaskPointer(delta);
  }

  /**
   * Place the physical task pointer at the ACTIVE objective's trigger — the
   * same component family as the generator console, so the next task is
   * always marked by a real world object instead of a random spot.
   */
  private placeObjectivePointer() {
    const scene = this.zombieManager.getScene();
    if (!scene) return;

    const obj = this.getCurrentObjective();
    if (!obj || !obj.targetPosition) {
      MissionEntityManager.clearTaskPointer();
      return;
    }

    const pos = new THREE.Vector3(obj.targetPosition[0], 0, obj.targetPosition[2]);
    if (obj.type === 'interact_object') {
      // Interact objectives land on their own consoles/generators — stand the
      // pointer 2.4m to the side so it doesn't clip inside the machine
      MissionEntityManager.placeTaskPointer(scene, new THREE.Vector3(pos.x + 2.4, 0, pos.z), 0xf59e0b, 'INTERACT');
    } else if (obj.type === 'reach_zone') {
      MissionEntityManager.placeTaskPointer(scene, pos, 0x22d3ee, 'REACH');
    } else if (obj.type === 'defeat_boss') {
      MissionEntityManager.placeTaskPointer(scene, pos, 0xef4444, 'BOSS');
    } else {
      // Kill/survive/collect objectives have no fixed trigger point
      MissionEntityManager.clearTaskPointer();
    }
  }

  /** Count up the active rescue/sample objective (called by entity events). */
  private progressCountObjective(type: 'rescue_survivors' | 'collect_samples') {
    soundFx.playPickup();
    const obj = this.getCurrentObjective();
    if (!obj || obj.type !== type || !obj.targetCount) return;
    obj.currentCount = (obj.currentCount || 0) + 1;
    if (obj.currentCount >= obj.targetCount) {
      this.advanceObjective(this.onVictoryCallback || undefined);
    } else {
      // Each pickup stirs the hive — another pack rushes the site
      this.triggerMiniHorde();
    }
  }

  /** Smaller ambush pack (4-6) triggered between rescue/sample progressions. */
  private triggerMiniHorde() {
    const hordeTypes: ZombieTypeKey[] = ['runner', 'walker', 'stalker', 'spitter', 'crawler'];
    let delay = 0.4;
    const count = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      delay += 0.4 + Math.random() * 0.3;
      this.spawnQueue.push({
        type: hordeTypes[Math.floor(Math.random() * hordeTypes.length)],
        delayTimer: delay,
        forceNarrowPath: i % 2 === 1,
      });
    }
  }

  /**
   * Mission-completion guarantee: drop a small hostile pack on open street
   * 16-26m from the operator (never inside buildings) when the kill objective
   * would otherwise be impossible to finish.
   */
  private spawnTopUpPack(playerPos: THREE.Vector3, count: number) {
    const pool: ZombieTypeKey[] = ['walker', 'runner', 'crawler', 'spitter'];
    let delay = 0.3;
    for (let i = 0; i < count; i++) {
      delay += 0.5 + Math.random() * 0.4;
      let customPos: THREE.Vector3 | undefined;
      for (let attempt = 0; attempt < 8; attempt++) {
        const ang = Math.random() * Math.PI * 2;
        const dist = 16 + Math.random() * 10;
        const x = playerPos.x + Math.sin(ang) * dist;
        const z = playerPos.z + Math.cos(ang) * dist;
        if (!NavCollision.isBlocked(x, z, 1.2)) {
          customPos = new THREE.Vector3(x, 0, z);
          break;
        }
      }
      this.spawnQueue.push({
        type: pool[Math.floor(Math.random() * pool.length)],
        delayTimer: delay,
        forceNarrowPath: false,
        customPos,
      });
    }
  }

  public recordKill(isHeadshot: boolean, reward: number, isBoss: boolean = false) {
    this.stats.kills++;
    this.timeSinceLastKill = 0;
    if (isHeadshot) this.stats.headshots++;
    this.stats.creditsEarned += reward;

    SaveManager.addCredits(reward);

    if (isBoss) {
      const bossObj = this.currentMission.objectives.find((o) => o.type === 'defeat_boss');
      if (bossObj) {
        bossObj.currentCount = 1;
      }
    }

    const obj = this.getCurrentObjective();
    if (!obj) return;

    if (obj.type === 'kill_count' && obj.targetCount) {
      obj.currentCount = (obj.currentCount || 0) + 1;
      if (obj.currentCount >= obj.targetCount) {
        this.advanceObjective(this.onVictoryCallback || undefined);
      }
    } else if (obj.type === 'defeat_boss') {
      if (isBoss || (obj.currentCount && obj.currentCount >= (obj.targetCount || 1))) {
        this.advanceObjective(this.onVictoryCallback || undefined);
      }
    }
  }

  public tryInteractObjective(playerPos: THREE.Vector3): boolean {
    const obj = this.getCurrentObjective();
    if (!obj || obj.type !== 'interact_object' || !obj.targetPosition) return false;

    const target = new THREE.Vector3(obj.targetPosition[0], obj.targetPosition[1], obj.targetPosition[2]);
    if (playerPos.distanceTo(target) <= (obj.targetRadius || 5.5)) {
      soundFx.playPickup();
      this.advanceObjective(this.onVictoryCallback || undefined);
      return true;
    }
    return false;
  }

  // Trigger aggressive zombie horde rush whenever an objective is completed
  public triggerObjectiveHorde() {
    soundFx.playHordeSiren();
    const hordeTypes: ZombieTypeKey[] = [
      'runner', 'walker', 'stalker', 'bloater', 'screamer', 'enforcer', 'crawler', 'spitter', 'brute'
    ];
    let delay = 0.3;
    for (let i = 0; i < 11; i++) {
      const type = hordeTypes[Math.floor(Math.random() * hordeTypes.length)];
      delay += 0.45 + Math.random() * 0.35;
      this.spawnQueue.push({
        type,
        delayTimer: delay,
        forceNarrowPath: i % 2 === 1,
      });
    }
  }

  private advanceObjective(onVictory?: (stats: GameStats) => void) {
    soundFx.playClick();
    this.currentObjectiveIndex++;

    const callback = onVictory || this.onVictoryCallback;

    if (this.currentObjectiveIndex >= this.currentMission.objectives.length) {
      this.completeMission(callback || undefined);
    } else {
      const nextObj = this.getCurrentObjective();
      if (nextObj && nextObj.timerSeconds) {
        this.surviveTimer = nextObj.timerSeconds;
      }
      // Re-point the task console at the next objective's trigger
      this.placeObjectivePointer();
      // Start another horde of zombies upon objective completion!
      this.triggerObjectiveHorde();
    }
  }

  private completeMission(onVictory?: (stats: GameStats) => void) {
    if (this.isMissionComplete) return;
    this.isMissionComplete = true;

    // Mission over — retire the task pointer
    MissionEntityManager.clearTaskPointer();

    // Bonus mission reward
    const bonus = this.currentMission.baseRewardCredits;
    this.stats.creditsEarned += bonus;
    SaveManager.addCredits(bonus);

    // Unlock next mission
    SaveManager.completeMission(this.currentMission.id, this.currentMission.id + 1);

    soundFx.playVictory();
    const callback = onVictory || this.onVictoryCallback;
    if (callback) {
      callback(this.stats);
    }
  }
}
