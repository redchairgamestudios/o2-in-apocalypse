import * as THREE from 'three';
import { soundFx } from '../audio/SoundEffects';
import { ParticleSystem } from '../effects/ParticleSystem';
import { GunEffects } from '../effects/GunEffects';
import { ZombieManager } from '../zombies/ZombieManager';
import { ZombieInstance } from '../models/ZombieModel';
import { ProceduralTextures } from '../textures/ProceduralTextures';
import { NavCollision } from '../core/NavCollision';
import { AllyModelFactory, AllyRig } from '../models/AllyModel';
import { AllyOrder } from '../types';
import { SaveManager } from '../core/SaveManager';

export interface AllyStatus {
  isActive: boolean;
  hp: number;
  maxHp: number;
  name: string;
  kills: number;
  radioMessage: string;
  radioTimer: number;
}

export interface AllyMemberInfo {
  id: string;
  name: string;
  callsign: string;
  role: string;
  badge: string;
  hp: number;
  maxHp: number;
  isAlive: boolean;
  kills: number;
}

export interface AllyProfile {
  id: string;
  name: string;
  callsign: string;
  role: string;
  badge: string;
  maxHp: number;
  offsetX: number;
  offsetZ: number;
  weaponType: 'rifle' | 'sniper' | 'heavy' | 'smg';
  damage: number;
  headshotRate: number;
  burstMax: number;
  burstInterval: number;
  cooldown: number;
}

export const ALLY_PROFILES: AllyProfile[] = [
  {
    id: 'vance',
    name: 'Sgt. Vance',
    callsign: 'VANGUARD',
    role: 'Assault Rifleman',
    badge: '🎖️',
    maxHp: 400,
    offsetX: -2.5,
    offsetZ: -2.4,
    weaponType: 'rifle',
    damage: 34,
    headshotRate: 0.28,
    burstMax: 3,
    burstInterval: 0.12,
    cooldown: 1.1,
  },
  {
    id: 'miller',
    name: 'Cpl. Miller',
    callsign: 'GHOST',
    role: 'Marksman Sniper',
    badge: '🎯',
    maxHp: 320,
    offsetX: 2.5,
    offsetZ: -2.4,
    weaponType: 'sniper',
    damage: 95,
    headshotRate: 0.65,
    burstMax: 1,
    burstInterval: 0.1,
    cooldown: 1.6,
  },
  {
    id: 'torres',
    name: 'Medic Torres',
    callsign: 'LIFELINE',
    role: 'Combat Support',
    badge: '💉',
    maxHp: 360,
    offsetX: -3.4,
    offsetZ: 0.4,
    weaponType: 'smg',
    damage: 24,
    headshotRate: 0.22,
    burstMax: 4,
    burstInterval: 0.09,
    cooldown: 0.9,
  },
  {
    id: 'jackson',
    name: 'Gunner Jackson',
    callsign: 'ANVIL',
    role: 'Heavy Suppression',
    badge: '🛡️',
    maxHp: 480,
    offsetX: 3.4,
    offsetZ: 0.4,
    weaponType: 'heavy',
    damage: 42,
    headshotRate: 0.25,
    burstMax: 5,
    burstInterval: 0.11,
    cooldown: 1.4,
  },
  {
    id: 'briggs',
    name: 'Lt. Briggs',
    callsign: 'OVERLORD',
    role: 'Spec-Ops Commando',
    badge: '⭐',
    maxHp: 450,
    offsetX: 0.0,
    offsetZ: -3.8,
    weaponType: 'rifle',
    damage: 38,
    headshotRate: 0.35,
    burstMax: 3,
    burstInterval: 0.1,
    cooldown: 1.0,
  },
];

interface AllyEntity {
  profile: AllyProfile;
  hp: number;
  maxHp: number;
  isAlive: boolean;
  kills: number;
  mesh: THREE.Group;
  rifleGroup: THREE.Group;
  headGroup: THREE.Group | null;
  leftLeg: THREE.Group | null;
  rightLeg: THREE.Group | null;
  healthBarGroup?: THREE.Group;
  healthBarFill?: THREE.Mesh;
  walkCycle: number;
  fireCooldown: number;
  burstCount: number;
  burstDelay: number;
  currentTarget: ZombieInstance | null;
  // Anti-stuck navigation: detect grinding into a wall/box and detour around it
  prevX: number;
  prevZ: number;
  stuckTimer: number;
  avoidSign: number;
  stuckCount: number;
  // Skinned character rig (null when using the procedural fallback soldier)
  rig: AllyRig | null;
  gunGroup: THREE.Group | null;
  gunMuzzleDist: number;
  // Upgrade system
  upgradeHealth: number;    // +20% max HP per level
  upgradeDamage: number;    // +15% damage per level
  upgradeArmor: number;     // +10% damage reduction per level
  upgradeRegen: number;     // +2 HP/sec per level
  upgradeAccuracy: number;  // +10% accuracy per level
  // Regen timer
  regenTimer: number;
  // Debug telemetry (read via __dzGame.allySquad)
  dbgMoved?: number;
  dbgDelta?: number;
}

export class AllySoldier {
  private static scene: THREE.Scene | null = null;
  public static squad: AllyEntity[] = [];
  /** Frame counter for distance-driven LOD on far squad members (alternates which rigs update). */
  public static lodFrame = 0;

  // Legacy single-soldier compatibility getters
  public static get isAlive(): boolean {
    return this.squad.some((s) => s.isAlive);
  }
  public static get hp(): number {
    const alive = this.squad.filter((s) => s.isAlive);
    if (alive.length === 0) return 0;
    return Math.round(alive.reduce((sum, s) => sum + s.hp, 0) / alive.length);
  }
  public static get maxHp(): number {
    return this.squad.length > 0 ? this.squad[0].maxHp : 350;
  }
  public static get kills(): number {
    return this.squad.reduce((sum, s) => sum + s.kills, 0);
  }

  public static radioMessage: string = '';
  public static radioTimer: number = 0;
  public static currentOrder: AllyOrder = 'FOLLOW_ME';

  public static setOrder(order: AllyOrder) {
    this.currentOrder = order;
    if (order === 'FOLLOW_ME') {
      this.radioMessage = 'Sgt. Vance: "Roger that, Commander! Fireteam falling in - escort formation on your six."';
    } else {
      this.radioMessage = 'Lt. Briggs: "Orders received: Moving forward and searching! Sweeping area and engaging all hostiles!"';
    }
    this.radioTimer = 4.5;
    soundFx.playRadioTransmission();
  }

  public static toggleOrder(): AllyOrder {
    const next: AllyOrder = this.currentOrder === 'FOLLOW_ME' ? 'SEARCH_AND_DESTROY' : 'FOLLOW_ME';
    this.setOrder(next);
    return next;
  }

  public static getSquadInfo(): AllyMemberInfo[] {
    return this.squad.map((s) => ({
      id: s.profile.id,
      name: s.profile.name,
      callsign: s.profile.callsign,
      role: s.profile.role,
      badge: s.profile.badge,
      hp: s.hp,
      maxHp: s.maxHp,
      isAlive: s.isAlive,
      kills: s.kills,
    }));
  }

  public static init(scene: THREE.Scene, spawnPos: THREE.Vector3, count: number = 1) {
    this.scene = scene;
    this.clear();

    // Kick the character GLB stream if it has not landed yet — members built
    // before it arrives fall back to the procedural soldier, then upgrade in
    // place the moment the model is ready (no box dummies in any mission).
    AllyModelFactory.preload().then(() => {
      this.upgradeSquadToRigs();
    });

    // Load ally upgrades from save
    const saveData = SaveManager.get();
    const allyUpgrades = saveData.allyUpgrades || { healthLevel: 0, damageLevel: 0, armorLevel: 0, regenLevel: 0, accuracyLevel: 0 };

    const actualCount = Math.max(1, Math.min(5, count));
    this.radioMessage = `Tactical Fireteam deployed: ${actualCount} combat specialists escorting Commander.`;
    this.radioTimer = 5.0;

    for (let i = 0; i < actualCount; i++) {
      const profile = ALLY_PROFILES[i];
      const entity = this.buildSoldierMesh(scene, spawnPos, profile, allyUpgrades);
      this.squad.push(entity);
    }
  }

  private static buildSoldierMesh(scene: THREE.Scene, spawnPos: THREE.Vector3, profile: AllyProfile, allyUpgrades: any): AllyEntity {
    // Prefer the skinned character rig; fall back to the procedural soldier
    // while the GLB is still streaming (or if it failed to load).
    const rig = AllyModelFactory.createRig(profile.id);
    if (rig) {
      return this.buildGltfSoldierMesh(scene, spawnPos, profile, rig, allyUpgrades);
    }
    return this.buildProceduralSoldierMesh(scene, spawnPos, profile, allyUpgrades);
  }

  /**
   * Spiral-search outward from a pinned position for the closest point that
   * is not inside any building collider. Returns null when nothing open is
   * found within maxRadius (caller keeps the soldier where they are).
   */
  private static nearestOpenSpot(from: THREE.Vector3, maxRadius: number): THREE.Vector3 | null {
    for (let ring = 1; ring <= 5; ring++) {
      const r = (maxRadius / 5) * ring;
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2 + ring * 0.4;
        const x = from.x + Math.sin(ang) * r;
        const z = from.z + Math.cos(ang) * r;
        if (!NavCollision.isBlocked(x, z, 0.6)) {
          return new THREE.Vector3(x, 0, z);
        }
      }
    }
    return null;
  }

  /**
   * Replace any procedural box soldiers with skinned Winter Soldier rigs,
   * preserving each member's position, facing and health bar.
   */
  private static upgradeSquadToRigs() {
    for (const soldier of this.squad) {
      if (soldier.rig || !this.scene) continue;
      const rig = AllyModelFactory.createRig(soldier.profile.id);
      if (!rig) return; // still not ready — the next init will retry

      const oldMesh = soldier.mesh;
      const pos = oldMesh.position.clone();
      const rotY = oldMesh.rotation.y;

      const root = new THREE.Group();
      root.name = `tactical_ally_${soldier.profile.id}`;
      root.position.copy(pos);
      root.rotation.y = rotY;
      root.add(rig.root);

      const rifle = this.buildRifleMesh(soldier.profile);
      const socket = rig.weaponSocketL || rig.handL;
      if (socket) socket.add(rifle.group);
      AllyModelFactory.applyStance(rig);
      root.updateMatrixWorld(true);
      AllyModelFactory.orientRifleToForward(rig, rifle.group);

      const healthBar = this.buildHealthBar();
      root.add(healthBar.group);
      this.scene.add(root);
      this.scene.remove(oldMesh);

      soldier.mesh = root;
      soldier.rifleGroup = rifle.group;
      soldier.headGroup = null;
      soldier.leftLeg = null;
      soldier.rightLeg = null;
      soldier.healthBarGroup = healthBar.group;
      soldier.healthBarFill = healthBar.fill;
      soldier.rig = rig;
      soldier.gunGroup = socket ? rifle.group : null;
      soldier.gunMuzzleDist = rifle.muzzleDist;
      soldier.prevX = root.position.x;
      soldier.prevZ = root.position.z;
    }
  }

  /** Shared profile-specific rifle (recoil body + barrel + laser sight). */  private static buildRifleMesh(profile: AllyProfile): { group: THREE.Group; muzzleDist: number } {
    const darkGearMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.6, metalness: 0.3 });

    const rifleGroup = new THREE.Group();

    const recGeo = new THREE.BoxGeometry(0.06, 0.12, 0.45);
    const rifleMesh = new THREE.Mesh(recGeo, darkGearMat);
    rifleGroup.add(rifleMesh);

    const barrelLength = profile.weaponType === 'sniper' ? 0.6 : profile.weaponType === 'heavy' ? 0.5 : 0.38;
    const barrelGeo = new THREE.CylinderGeometry(0.018, 0.018, barrelLength, 6);
    barrelGeo.rotateX(Math.PI / 2);
    const barrel = new THREE.Mesh(barrelGeo, darkGearMat);
    barrel.position.set(0, 0.02, barrelLength);
    rifleGroup.add(barrel);

    // Tactical Laser Sight
    const laserColor = profile.weaponType === 'sniper' ? 0x3b82f6 : 0xef4444;
    const laserMat = new THREE.LineBasicMaterial({ color: laserColor, transparent: true, opacity: 0.65 });
    const laserGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0.03, 0.02, 0.3),
      new THREE.Vector3(0.03, 0.02, 16),
    ]);
    const laser = new THREE.Line(laserGeo, laserMat);
    rifleGroup.add(laser);

    return { group: rifleGroup, muzzleDist: barrelLength + 0.4 };
  }

  /** Floating 3D overhead health bar billboard. */
  private static buildHealthBar(): { group: THREE.Group; fill: THREE.Mesh } {
    const healthBarGroup = new THREE.Group();
    healthBarGroup.position.set(0, 1.95, 0);

    const bgBarGeo = new THREE.PlaneGeometry(0.72, 0.08);
    const bgBarMat = new THREE.MeshBasicMaterial({ color: 0x09090b, side: THREE.DoubleSide });
    const bgBar = new THREE.Mesh(bgBarGeo, bgBarMat);
    healthBarGroup.add(bgBar);

    const fillBarGeo = new THREE.PlaneGeometry(0.68, 0.06);
    fillBarGeo.translate(0.34, 0, 0); // Origin at left edge
    const fillBarMat = new THREE.MeshBasicMaterial({ color: 0x22c55e, side: THREE.DoubleSide });
    const fillBar = new THREE.Mesh(fillBarGeo, fillBarMat);
    fillBar.position.set(-0.34, 0, 0.005);
    healthBarGroup.add(fillBar);

    return { group: healthBarGroup, fill: fillBar };
  }

  /** Skinned character rig squad member (Winter Soldier GLB). */
  private static buildGltfSoldierMesh(scene: THREE.Scene, spawnPos: THREE.Vector3, profile: AllyProfile, rig: AllyRig, allyUpgrades: any): AllyEntity {
    const root = new THREE.Group();
    root.name = `tactical_ally_${profile.id}`;
    root.position.set(spawnPos.x + profile.offsetX, 0, spawnPos.z + profile.offsetZ);

    root.add(rig.root);

    // Profile weapon mounted on the character's hand weapon-socket
    const rifle = this.buildRifleMesh(profile);
    const socket = rig.weaponSocketL || rig.handL;
    if (socket) {
      socket.add(rifle.group);
    }

    // Apply the stance first, then compute the rifle's local rotation so the
    // barrel points along the character's forward regardless of hand-bone axes
    AllyModelFactory.applyStance(rig);
    root.updateMatrixWorld(true);
    AllyModelFactory.orientRifleToForward(rig, rifle.group);

    const healthBar = this.buildHealthBar();
    root.add(healthBar.group);
    scene.add(root);

    // Apply upgrades
    const baseMaxHp = profile.maxHp * (1 + allyUpgrades.healthLevel * 0.20);
    const baseDamage = profile.damage * (1 + allyUpgrades.damageLevel * 0.15);
    const armorReduction = allyUpgrades.armorLevel * 0.10;
    const regenRate = allyUpgrades.regenLevel * 2.0; // HP/sec
    const accuracyBonus = allyUpgrades.accuracyLevel * 0.10;

    return {
      profile,
      hp: baseMaxHp,
      maxHp: baseMaxHp,
      isAlive: true,
      kills: 0,
      mesh: root,
      rifleGroup: rifle.group,
      headGroup: null,
      leftLeg: null,
      rightLeg: null,
      healthBarGroup: healthBar.group,
      healthBarFill: healthBar.fill,
      walkCycle: Math.random() * Math.PI * 2,
      fireCooldown: Math.random() * 0.5,
      burstCount: 0,
      burstDelay: 0,
      currentTarget: null,
      prevX: root.position.x,
      prevZ: root.position.z,
      stuckTimer: 0,

      avoidSign: Math.random() < 0.5 ? -1 : 1,
      stuckCount: 0,
      rig,
      gunGroup: socket ? rifle.group : null,
      gunMuzzleDist: rifle.muzzleDist,
      // Upgrade system
      upgradeHealth: allyUpgrades.healthLevel,
      upgradeDamage: allyUpgrades.damageLevel,
      upgradeArmor: allyUpgrades.armorLevel,
      upgradeRegen: allyUpgrades.regenLevel,
      upgradeAccuracy: allyUpgrades.accuracyLevel,
      regenTimer: 0,
      // Debug telemetry
      dbgMoved: 0,
      dbgDelta: 0,
    };
  }

private static buildProceduralSoldierMesh(scene: THREE.Scene, spawnPos: THREE.Vector3, profile: AllyProfile, allyUpgrades: any): AllyEntity {
    const root = new THREE.Group();
    root.name = `tactical_ally_${profile.id}`;
    root.position.set(spawnPos.x + profile.offsetX, 0, spawnPos.z + profile.offsetZ);

    const camoTex = ProceduralTextures.getCamoFabric();
    const armorTex = ProceduralTextures.getTacticalArmorPlate();

    const uniformMat = new THREE.MeshStandardMaterial({
      map: camoTex,
      roughness: 0.8,
      metalness: 0.1,
    });

    const armorMat = new THREE.MeshStandardMaterial({
      map: armorTex,
      roughness: 0.45,
      metalness: 0.4,
    });

    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xd4a373,
      roughness: 0.7,
    });

    const darkGearMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.6,
      metalness: 0.3,
    });

    // Torso
    const torsoGroup = new THREE.Group();
    torsoGroup.position.y = 1.0;

    const chestGeo = new THREE.BoxGeometry(0.5, 0.55, 0.28);
    const chestMesh = new THREE.Mesh(chestGeo, uniformMat);
    torsoGroup.add(chestMesh);

    // Ballistic Plate Carrier Vest
    const vestGeo = new THREE.BoxGeometry(0.54, 0.44, 0.32);
    const vestMesh = new THREE.Mesh(vestGeo, armorMat);
    vestMesh.position.set(0, 0.04, 0.02);
    torsoGroup.add(vestMesh);

    // Mag Pouches
    for (let p = -1; p <= 1; p++) {
      const pGeo = new THREE.BoxGeometry(0.11, 0.16, 0.06);
      const pMesh = new THREE.Mesh(pGeo, darkGearMat);
      pMesh.position.set(p * 0.15, -0.05, 0.2);
      torsoGroup.add(pMesh);
    }

    // Head & Helmet
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.45, 0);

    const headGeo = new THREE.SphereGeometry(0.16, 12, 12);
    const headMesh = new THREE.Mesh(headGeo, skinMat);
    headGroup.add(headMesh);

    const helmGeo = new THREE.SphereGeometry(0.19, 12, 10);
    helmGeo.scale(1.0, 0.85, 1.05);
    const helmMesh = new THREE.Mesh(helmGeo, armorMat);
    helmMesh.position.set(0, 0.05, 0);
    headGroup.add(helmMesh);

    // NVG Mount
    const nvgGeo = new THREE.BoxGeometry(0.18, 0.08, 0.1);
    const nvgMesh = new THREE.Mesh(nvgGeo, darkGearMat);
    nvgMesh.position.set(0, 0.06, 0.18);
    headGroup.add(nvgMesh);

    // Headset
    [-0.17, 0.17].forEach((hx) => {
      const earGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.05, 8);
      earGeo.rotateZ(Math.PI / 2);
      const ear = new THREE.Mesh(earGeo, darkGearMat);
      ear.position.set(hx, 0.02, 0);
      headGroup.add(ear);
    });

    torsoGroup.add(headGroup);

    // Weapon Group (shared rifle builder)
    const { group: rifleGroup } = this.buildRifleMesh(profile);
    rifleGroup.position.set(0.22, 0.1, 0.35);
    torsoGroup.add(rifleGroup);

    // Legs
    const leftLeg = new THREE.Group();
    leftLeg.position.set(-0.16, -0.3, 0);
    const legGeo = new THREE.CapsuleGeometry(0.09, 0.5, 6, 8);
    const lLegMesh = new THREE.Mesh(legGeo, uniformMat);
    lLegMesh.position.y = -0.3;
    leftLeg.add(lLegMesh);
    torsoGroup.add(leftLeg);

    const rightLeg = new THREE.Group();
    rightLeg.position.set(0.16, -0.3, 0);
    const rLegMesh = new THREE.Mesh(legGeo, uniformMat);
    rLegMesh.position.y = -0.3;
    rightLeg.add(rLegMesh);
    torsoGroup.add(rightLeg);

    root.add(torsoGroup);

    // Floating 3D Overhead Health Bar Billboard (shared builder)
    const healthBar = this.buildHealthBar();

    root.add(healthBar.group);
    scene.add(root);

    // Apply upgrades
    const baseMaxHp = profile.maxHp * (1 + allyUpgrades.healthLevel * 0.20);
    const baseDamage = profile.damage * (1 + allyUpgrades.damageLevel * 0.15);
    const armorReduction = allyUpgrades.armorLevel * 0.10;
    const regenRate = allyUpgrades.regenLevel * 2.0; // HP/sec
    const accuracyBonus = allyUpgrades.accuracyLevel * 0.10;

    return {
      profile,
      hp: baseMaxHp,
      maxHp: baseMaxHp,
      isAlive: true,
      kills: 0,
      mesh: root,
      rifleGroup,
      headGroup,
      leftLeg,
      rightLeg,
      healthBarGroup: healthBar.group,
      healthBarFill: healthBar.fill,
      walkCycle: Math.random() * Math.PI * 2,
      fireCooldown: Math.random() * 0.5,
      burstCount: 0,
      burstDelay: 0,
      currentTarget: null,
      prevX: root.position.x,
      prevZ: root.position.z,
      stuckTimer: 0,

      avoidSign: Math.random() < 0.5 ? -1 : 1,
      stuckCount: 0,
      rig: null,
      gunGroup: null,
      gunMuzzleDist: 0.8,
      // Upgrade system
      upgradeHealth: allyUpgrades.healthLevel,
      upgradeDamage: allyUpgrades.damageLevel,
      upgradeArmor: allyUpgrades.armorLevel,
      upgradeRegen: allyUpgrades.regenLevel,
      upgradeAccuracy: allyUpgrades.accuracyLevel,
      regenTimer: 0,
      // Debug telemetry
      dbgMoved: 0,
      dbgDelta: 0,
    };
  }

  public static clear() {
    if (this.scene) {
      for (const s of this.squad) {
        if (s.mesh) this.scene.remove(s.mesh);
      }
    }
    this.squad = [];
  }

  public static update(
    delta: number,
    playerPos: THREE.Vector3,
    playerYaw: number,
    zombieManager: ZombieManager,
    onKill: (zombie: any, isHeadshot: boolean) => void
  ) {
    if (this.squad.length === 0) return;

    if (this.radioTimer > 0) {
      this.radioTimer -= delta;
      if (this.radioTimer <= 0) {
        this.radioMessage = '';
      }
    }

    // Frame counter for distance-driven LOD (alternates which far rigs update)
    this.lodFrame++;
    let soldierLodIdx = 0;

    for (const soldier of this.squad) {
      if (!soldier.isAlive || !soldier.mesh) continue;

      // Health regeneration from upgrades
      if (soldier.upgradeRegen > 0 && soldier.hp < soldier.maxHp) {
        soldier.regenTimer += delta;
        if (soldier.regenTimer >= 1.0) {
          soldier.hp = Math.min(soldier.maxHp, soldier.hp + (soldier.upgradeRegen * 2.0));
          soldier.regenTimer = 0;
        }
      }

      // Update 3D overhead health bar billboard
      if (soldier.healthBarGroup && soldier.healthBarFill) {
        soldier.healthBarGroup.lookAt(playerPos.x, soldier.mesh.position.y + 1.95, playerPos.z);
        const hpPct = Math.max(0, soldier.hp / soldier.maxHp);
        soldier.healthBarFill.scale.x = hpPct;
        const fillMat = soldier.healthBarFill.material as THREE.MeshBasicMaterial;
        if (hpPct < 0.25) {
          fillMat.color.setHex(0xef4444);
        } else if (hpPct < 0.5) {
          fillMat.color.setHex(0xeab308);
        } else {
          fillMat.color.setHex(0x22c55e);
        }
      }

      // Check zombie melee attacks on this ally soldier
      for (const z of zombieManager.zombies) {
        if (z.isDead) continue;
        const d = soldier.mesh.position.distanceTo(z.mesh.position);
        if (d < z.config.attackRange + 0.35 && z.attackTimer <= 0) {
          if (soldier.upgradeArmor > 0) {
            const armorReduction = Math.min(0.5, (soldier.upgradeArmor || 0) * 0.10);
            soldier.hp = Math.max(0, soldier.hp - z.config.damage * 0.55 * (1 - armorReduction));
          } else {
            soldier.hp = Math.max(0, soldier.hp - z.config.damage * 0.55);
          }
          ParticleSystem.spawnBlood(
            soldier.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0)),
            new THREE.Vector3(0, 0.4, 0)
          );
          if (soldier.hp <= 0) {
            soldier.isAlive = false;
            soldier.mesh.visible = false;
            this.radioMessage = `${soldier.profile.name}: "I'm hit! Officer down! Stay alert...!"`;
            this.radioTimer = 5.0;
            soundFx.playPlayerDeath();
          }
          break;
        }
      }

      // 1. Navigation & Orders: Follow Me vs Move Forward & Search
      let targetWorldPos: THREE.Vector3;
      let target: ZombieInstance | null = null;
      let nearestDist = this.currentOrder === 'SEARCH_AND_DESTROY' ? 75.0 : (soldier.profile.weaponType === 'sniper' ? 38.0 : 28.0);

      // Search for enemies across area
      for (const z of zombieManager.zombies) {
        if (z.isDead) continue;
        const d = soldier.mesh.position.distanceTo(z.mesh.position);
        if (d < nearestDist) {
          nearestDist = d;
          target = z;
        }
      }

      soldier.currentTarget = target;

      if (this.currentOrder === 'SEARCH_AND_DESTROY') {
        // "Move Forward and Search" command: sprint into area, hunt zombies and purge
        if (target) {
          const preferredRange = soldier.profile.weaponType === 'sniper' ? 18.0 : soldier.profile.weaponType === 'smg' ? 7.0 : 11.0;
          const toZombie = new THREE.Vector3().subVectors(target.mesh.position, soldier.mesh.position);
          toZombie.y = 0;
          const distToZombie = toZombie.length();

          if (distToZombie > preferredRange) {
            toZombie.normalize();
            targetWorldPos = target.mesh.position.clone().addScaledVector(toZombie.clone().negate(), preferredRange);
            targetWorldPos.y = 0;
          } else {
            targetWorldPos = soldier.mesh.position.clone();
          }
        } else {
          // No current zombie: advance in the direction the operator is
          // FACING (not a fixed world axis) — validate the rally point so
          // the squad never grinds against a building's walls forever.
          const fwdX = -Math.sin(playerYaw);
          const fwdZ = -Math.cos(playerYaw);
          let rallyX = playerPos.x + fwdX * 16.0 + soldier.profile.offsetX * 1.5;
          let rallyZ = playerPos.z + fwdZ * 16.0 + soldier.profile.offsetZ * 1.5;
          if (NavCollision.isBlocked(rallyX, rallyZ, 1.0)) {
            rallyX = playerPos.x + soldier.profile.offsetX;
            rallyZ = playerPos.z + soldier.profile.offsetZ;
          }
          targetWorldPos = new THREE.Vector3(rallyX, 0, rallyZ);
        }
      } else {
        // "Follow-Me" command: each soldier maintains assigned escort offset relative to player
        targetWorldPos = new THREE.Vector3(
          playerPos.x + soldier.profile.offsetX,
          0,
          playerPos.z + soldier.profile.offsetZ
        );
      }

      const toSlot = new THREE.Vector3().subVectors(targetWorldPos, soldier.mesh.position);
      toSlot.y = 0;
      const distToSlot = toSlot.length();

      let isWalking = false;

      // Actual displacement last frame — drives both anti-stuck detection
      // and the walk-gait cadence (feet planted at true ground speed)
      const moved = Math.hypot(
        soldier.mesh.position.x - soldier.prevX,
        soldier.mesh.position.z - soldier.prevZ
      );

      if (distToSlot > 0.8) {
        isWalking = true;
        toSlot.normalize();

        const maxSprint = this.currentOrder === 'SEARCH_AND_DESTROY' ? 7.5 : 6.8;
        const speed = distToSlot > 6 ? maxSprint : distToSlot > 3 ? 5.2 : 3.4;

        // Stuck watch: if the soldier makes almost no progress for a while
        // while a distant slot is calling, flip the slide side; if flipping
        // keeps failing they are wedged inside geometry — snap them free.
        if (distToSlot > 1.6 && moved < speed * delta * 0.3) {
          soldier.stuckTimer += delta;
          if (soldier.stuckTimer > 0.6) {
            soldier.avoidSign *= -1;
            soldier.stuckTimer = 0.25;
            soldier.stuckCount++;
            if (soldier.stuckCount >= 3) {
              const open = this.nearestOpenSpot(soldier.mesh.position, 3.5);
              if (open) {
                soldier.mesh.position.copy(open);
              }
              soldier.stuckCount = 0;
              soldier.stuckTimer = 0;
            }
          }
        } else {
          soldier.stuckTimer = Math.max(0, soldier.stuckTimer - delta * 3);
          if (moved > speed * delta * 0.5) {
            soldier.stuckCount = 0; // free movement — path is clear again
          }
        }

        // Straight pursuit toward the slot. ONLY when a wall actually blocks
        // the step does the soldier shuffle sideways along it (left/right),
        // and the slide stops the moment the path clears itself. While
        // sliding, they face the real movement direction so the stride
        // matches the motion instead of skating sideways.
        soldier.mesh.position.addScaledVector(toSlot, speed * delta);

        let facing = toSlot;
        const blocked = NavCollision.resolve(soldier.mesh.position, 0.42, 1.8);
        if (blocked) {
          const side = new THREE.Vector3(-toSlot.z, 0, toSlot.x);
          soldier.mesh.position.addScaledVector(side, soldier.avoidSign * speed * 0.6 * delta);
          NavCollision.resolve(soldier.mesh.position, 0.42, 1.8);
          facing = new THREE.Vector3(
            toSlot.x + side.x * soldier.avoidSign * 0.6,
            0,
            toSlot.z + side.z * soldier.avoidSign * 0.6
          ).normalize();
        }

        const targetAngle = Math.atan2(facing.x, facing.z);
        soldier.mesh.rotation.y = THREE.MathUtils.lerp(soldier.mesh.rotation.y, targetAngle, delta * 6);
      }

      soldier.prevX = soldier.mesh.position.x;
      soldier.prevZ = soldier.mesh.position.z;

      // Leg locomotion: speed-synced planted-foot gait with leg IK.
      // Squad members beyond 45m animate at half rate (596-bone rigs are the
      // heaviest skinning in the scene) — their poses still interpolate fine.
      if (soldier.rig) {
        const distToPlayer = soldier.mesh.position.distanceTo(playerPos);
        const rigLod = distToPlayer > 45;
        soldierLodIdx++;
        if (rigLod && (this.lodFrame + soldierLodIdx) % 2 !== 0) {
          continue;
        }
        const moveSpeed = delta > 0 ? Math.min(8, moved / delta) : 0;
        AllyModelFactory.updateGait(soldier.rig, rigLod ? delta * 2 : delta, moveSpeed);
      } else if (isWalking && soldier.leftLeg && soldier.rightLeg) {
        soldier.walkCycle += delta * 12;
        soldier.leftLeg.rotation.x = Math.sin(soldier.walkCycle) * 0.45;
        soldier.rightLeg.rotation.x = -Math.sin(soldier.walkCycle) * 0.45;
      } else if (soldier.leftLeg && soldier.rightLeg) {
        soldier.leftLeg.rotation.x = 0;
        soldier.rightLeg.rotation.x = 0;
      }

      // 2. Combat Engagement & Target Acquisition
      if (target) {
        // Face hostile target
        const toTgt = new THREE.Vector3().subVectors(target.mesh.position, soldier.mesh.position);
        const angle = Math.atan2(toTgt.x, toTgt.z);
        soldier.mesh.rotation.y = THREE.MathUtils.lerp(soldier.mesh.rotation.y, angle, delta * 8);

        // Weapon firing loop
        soldier.fireCooldown -= delta;
        if (soldier.fireCooldown <= 0) {
          if (soldier.burstCount < soldier.profile.burstMax) {
            soldier.burstDelay -= delta;
            if (soldier.burstDelay <= 0) {
              soldier.burstDelay = soldier.profile.burstInterval;
              soldier.burstCount++;

              if (soldier.profile.weaponType === 'sniper') {
                soundFx.playSniperShot();
              } else if (soldier.profile.weaponType === 'heavy') {
                soundFx.playHeavyShot();
              } else {
                soundFx.playRifleShot();
              }

              // Muzzle flash & sparks (from the actual barrel when skinned)
              const muzzlePos = soldier.gunGroup
                ? soldier.gunGroup.localToWorld(new THREE.Vector3(0, 0.02, soldier.gunMuzzleDist))
                : soldier.mesh.localToWorld(new THREE.Vector3(0.22, 1.1, 0.85));
              ParticleSystem.spawnSparks(muzzlePos, new THREE.Vector3(0, 1, 0));

              const targetChest = target.mesh.position.clone().add(new THREE.Vector3(0, 1.1, 0));
              const aimDir = new THREE.Vector3().subVectors(targetChest, muzzlePos).normalize();
              GunEffects.spawnMuzzleFlash(muzzlePos, aimDir, 0.7);
              GunEffects.spawnTracer(muzzlePos, targetChest, 0.85);

              // Calculate damage with upgrades
              const baseDmg = soldier.profile.damage * (1 + (soldier.upgradeDamage || 0) * 0.15);
              const isHead = Math.random() < (soldier.profile.headshotRate + (soldier.upgradeAccuracy || 0) * 0.10);
              const dmg = isHead ? Math.round(baseDmg * 2.2) : Math.round(baseDmg);

              zombieManager.applyDamage(
                {
                  hit: true,
                  zone: isHead ? 'HEAD' : 'TORSO',
                  damage: dmg,
                  isFatal: false,
                  targetId: target.id,
                },
                (deadZ, headshot) => {
                  soldier.kills++;
                  onKill(deadZ, headshot);

                  // Specialized squad radio chatter
                  const callouts: Record<string, string[]> = {
                    vance: [
                      'Sgt. Vance: "Hostile down! Keeping perimeter secure."',
                      'Sgt. Vance: "Target dropped. Watch the flanks."',
                    ],
                    miller: [
                      'Cpl. Miller: "Headshot confirmed. Clean kill at range."',
                      'Cpl. Miller: "Hostile eliminated. Cycling bolt."',
                    ],
                    torres: [
                      'Medic Torres: "Bio-threat suppressed! Clear in my sector."',
                      'Medic Torres: "Target down! Stay in formation."',
                    ],
                    jackson: [
                      'Gunner Jackson: "Heavy suppression effective! Meat grinder active!"',
                      'Gunner Jackson: "Mowing them down! Keep moving!"',
                    ],
                    briggs: [
                      'Lt. Briggs: "Hostile neutralized. Fireteam, maintain discipline."',
                      'Lt. Briggs: "Direct hit! Sector bravo secured."',
                    ],
                  };

                  const list = callouts[soldier.profile.id] || callouts.vance;
                  this.radioMessage = list[Math.floor(Math.random() * list.length)];
                  this.radioTimer = 3.5;
                }
              );

              if (soldier.burstCount >= soldier.profile.burstMax) {
                soldier.fireCooldown = soldier.profile.cooldown;
                soldier.burstCount = 0;
              }
            }
          }
        }
      }
    }
  }
}
